/**
 * Dialogs, drawers y toasts.
 * Foco atrapado, cierre con Escape y bloqueo de scroll de fondo.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/primitives';

/* ================================================================== */
/* utilidades comunes                                                  */
/* ================================================================== */

function useDismiss(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);
}

function useAutoFocus(open: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      const focusable = ref.current?.querySelector<HTMLElement>(
        'input:not([type=hidden]), textarea, select, button:not([data-no-autofocus]), [href], [tabindex]:not([tabindex="-1"])',
      );
      focusable?.focus();
    }, 40);
    return () => clearTimeout(timer);
  }, [open]);
  return ref;
}

/* ================================================================== */
/* Dialog                                                              */
/* ================================================================== */

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  useDismiss(open, onClose);
  const ref = useAutoFocus(open);
  if (!open) return null;

  const width = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }[size];

  return createPortal(
    <div className="fixed inset-0 z-100 flex items-end justify-center sm:items-center">
      <div className="animate-fade-in absolute inset-0 bg-ink-950/45 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        className={cn(
          'animate-fade-up relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-pop sm:rounded-2xl',
          width,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-ink-100 px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-ink-900">{title}</h2>
            {description && <p className="mt-1 text-[13px] leading-relaxed text-ink-500">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            data-no-autofocus
            className="-mt-1 -mr-1 shrink-0 rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700"
            aria-label="Cerrar"
          >
            <X className="size-4.5" />
          </button>
        </div>
        {children && <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>}
        {footer && <div className="flex justify-end gap-2 border-t border-ink-100 bg-ink-50 px-5 py-3.5">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/* ================================================================== */
/* Drawer                                                              */
/* ================================================================== */

export function Drawer({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: 'md' | 'lg' | 'xl';
}) {
  useDismiss(open, onClose);
  const ref = useAutoFocus(open);
  if (!open) return null;

  const size = { md: 'sm:max-w-md', lg: 'sm:max-w-xl', xl: 'sm:max-w-3xl' }[width];

  return createPortal(
    <div className="fixed inset-0 z-100 flex justify-end">
      <div className="animate-fade-in absolute inset-0 bg-ink-950/45 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        className={cn('animate-slide-right relative flex h-full w-full flex-col bg-white shadow-pop', size)}
      >
        <div className="flex items-start justify-between gap-4 border-b border-ink-100 px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-ink-900">{title}</h2>
            {description && <p className="mt-1 text-[13px] text-ink-500">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            data-no-autofocus
            className="-mt-1 -mr-1 shrink-0 rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700"
            aria-label="Cerrar"
          >
            <X className="size-4.5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-ink-100 bg-ink-50 px-5 py-3.5">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/* ================================================================== */
/* Confirm                                                             */
/* ================================================================== */

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  tone = 'primary',
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'primary' | 'danger';
  loading?: boolean;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={tone} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm leading-relaxed text-ink-600">{description}</p>
    </Dialog>
  );
}

/* ================================================================== */
/* Toasts                                                              */
/* ================================================================== */

export interface Toast {
  id: string;
  title: string;
  description?: string;
  tone: 'success' | 'error' | 'warning' | 'info';
  action?: { label: string; onClick: () => void };
}

interface ToastContextValue {
  toast: (t: Omit<Toast, 'id'>) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  warning: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
  /** Atajo para acciones secundarias que no tienen implementacion profunda. */
  simulated: (what?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TOAST_ICON = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
} as const;

const TOAST_STYLE = {
  success: 'border-ok-200 bg-white text-ok-700',
  error: 'border-bad-200 bg-white text-bad-700',
  warning: 'border-warn-200 bg-white text-warn-700',
  info: 'border-tech-200 bg-white text-tech-700',
} as const;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (t: Omit<Toast, 'id'>) => {
      const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [...prev.slice(-3), { ...t, id }]);
      setTimeout(() => remove(id), t.tone === 'error' ? 7_000 : 4_500);
    },
    [remove],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      toast,
      success: (title, description) => toast({ title, description, tone: 'success' }),
      error: (title, description) => toast({ title, description, tone: 'error' }),
      warning: (title, description) => toast({ title, description, tone: 'warning' }),
      info: (title, description) => toast({ title, description, tone: 'info' }),
      simulated: (what) =>
        toast({
          title: 'Acción simulada en modo demo',
          description: what ? `${what} no se ejecuta en el prototipo, pero el flujo está previsto en el alcance.` : undefined,
          tone: 'info',
        }),
    }),
    [toast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {createPortal(
        <div className="pointer-events-none fixed right-4 bottom-4 z-200 flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2">
          {toasts.map((t) => {
            const Icon = TOAST_ICON[t.tone];
            return (
              <div
                key={t.id}
                role="status"
                className={cn(
                  'animate-fade-up pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 shadow-pop',
                  TOAST_STYLE[t.tone],
                )}
              >
                <Icon className="mt-0.5 size-4.5 shrink-0" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-ink-900">{t.title}</p>
                  {t.description && <p className="mt-0.5 text-xs leading-relaxed text-ink-600">{t.description}</p>}
                  {t.action && (
                    <button
                      type="button"
                      onClick={() => {
                        t.action!.onClick();
                        remove(t.id);
                      }}
                      className="mt-1.5 text-xs font-semibold text-ashir-600 underline underline-offset-2 hover:text-ashir-700"
                    >
                      {t.action.label}
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => remove(t.id)}
                  className="-mt-0.5 -mr-1 shrink-0 rounded p-1 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700"
                  aria-label="Cerrar aviso"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            );
          })}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast debe usarse dentro de <ToastProvider>');
  return ctx;
}
