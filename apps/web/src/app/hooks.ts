/**
 * Hooks de acceso a datos.
 *
 * Mantiene la cadena UI -> hooks -> servicios sin sumar TanStack Query:
 * el prototipo necesita loading, error y refetch, no una cache completa.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ServiceError } from '@/services';
import { subscribe, subscribeScenarios } from '@/services/mock/store';

export interface AsyncState<T> {
  data: T | undefined;
  loading: boolean;
  error: ServiceError | Error | null;
  refetch: () => void;
  /** true la primera vez que carga; false en refetch, para no parpadear. */
  initialLoading: boolean;
}

/**
 * Ejecuta `fn` y re-ejecuta cuando cambian `deps`, cuando muta el estado
 * de demo o cuando se activa un escenario.
 */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[], options: { watchStore?: boolean } = {}): AsyncState<T> {
  const { watchStore = true } = options;
  const [data, setData] = useState<T>();
  const [loading, setLoading] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<ServiceError | Error | null>(null);
  const [nonce, setNonce] = useState(0);

  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fnRef
      .current()
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err : new Error(String(err)));
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
        setInitialLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  const refetch = useCallback(() => setNonce((n) => n + 1), []);

  // Cualquier mutacion del store de demo refresca las vistas abiertas.
  useEffect(() => {
    if (!watchStore) return;
    const unsubStore = subscribe(() => setNonce((n) => n + 1));
    const unsubScenarios = subscribeScenarios(() => setNonce((n) => n + 1));
    return () => {
      unsubStore();
      unsubScenarios();
    };
  }, [watchStore]);

  return { data, loading, error, refetch, initialLoading };
}

/** Para acciones (mutaciones) con estado de envío y manejo de error. */
export function useAction<Args extends unknown[], R>(
  fn: (...args: Args) => Promise<R>,
): {
  run: (...args: Args) => Promise<R | undefined>;
  pending: boolean;
  error: ServiceError | Error | null;
  reset: () => void;
} {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ServiceError | Error | null>(null);

  const run = useCallback(
    async (...args: Args) => {
      setPending(true);
      setError(null);
      try {
        return await fn(...args);
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
        return undefined;
      } finally {
        setPending(false);
      }
    },
    [fn],
  );

  return { run, pending, error, reset: () => setError(null) };
}

/** Debounce simple para buscadores. */
export function useDebounced<T>(value: T, delay = 280): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/** Estado persistido en localStorage, tolerante a modo privado. */
export function usePersistentState<T>(key: string, initial: T): [T, (next: T | ((prev: T) => T)) => void] {
  const [state, setState] = useState<T>(() => {
    if (typeof window === 'undefined') return initial;
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });

  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      setState((prev) => {
        const value = typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
        try {
          window.localStorage.setItem(key, JSON.stringify(value));
        } catch {
          /* modo privado */
        }
        return value;
      });
    },
    [key],
  );

  return [state, set];
}

/** Devuelve el mensaje y el requestId de un error de servicio. */
export function describeError(error: Error | ServiceError | null): { message: string; requestId?: string; code?: string } {
  if (!error) return { message: '' };
  if (error instanceof ServiceError) {
    return { message: error.message, requestId: error.requestId, code: error.code };
  }
  return { message: error.message };
}
