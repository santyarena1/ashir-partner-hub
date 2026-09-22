/**
 * Sesion de demo y selector «Ver plataforma como».
 *
 * No hay autenticacion: el rol se elige desde el header y se persiste.
 * Cambiar de rol cambia menu, dashboard, acciones, datos sensibles y lenguaje.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Role, Session } from '@/types';
import { DEFAULT_USER_BY_ROLE, INTERNAL_USERS } from '@/mocks/fixtures/people';
import { DEMO_CUSTOMER_ID } from '@/mocks/fixtures/customers';
import { sessionFromUser } from '@/lib/rbac';

const ROLE_KEY = 'ashir-partner-hub:role:v1';
const CUSTOMER_KEY = 'ashir-partner-hub:customer:v1';

interface SessionContextValue {
  session: Session;
  role: Role;
  setRole: (role: Role) => void;
  /** Permite recorrer la demo como otro reseller (rol CLIENT). */
  setCustomerId: (id: string) => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

function readRole(): Role {
  if (typeof window === 'undefined') return 'CLIENT';
  const stored = window.localStorage.getItem(ROLE_KEY);
  const valid: Role[] = ['CLIENT', 'SALES', 'PM', 'RMA', 'ADMIN'];
  return valid.includes(stored as Role) ? (stored as Role) : 'CLIENT';
}

function readCustomerId(): string {
  if (typeof window === 'undefined') return DEMO_CUSTOMER_ID;
  return window.localStorage.getItem(CUSTOMER_KEY) ?? DEMO_CUSTOMER_ID;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<Role>(readRole);
  const [customerId, setCustomerIdState] = useState<string>(readCustomerId);

  useEffect(() => {
    try {
      window.localStorage.setItem(ROLE_KEY, role);
    } catch {
      /* modo privado */
    }
  }, [role]);

  useEffect(() => {
    try {
      window.localStorage.setItem(CUSTOMER_KEY, customerId);
    } catch {
      /* modo privado */
    }
  }, [customerId]);

  const setRole = useCallback((next: Role) => setRoleState(next), []);
  const setCustomerId = useCallback((next: string) => setCustomerIdState(next), []);

  const session = useMemo<Session>(() => {
    const user = INTERNAL_USERS.find((u) => u.id === DEFAULT_USER_BY_ROLE[role]) ?? INTERNAL_USERS[0]!;
    return sessionFromUser(user, role === 'CLIENT' ? customerId : undefined);
  }, [role, customerId]);

  const value = useMemo(
    () => ({ session, role, setRole, setCustomerId }),
    [session, role, setRole, setCustomerId],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession debe usarse dentro de <SessionProvider>');
  return ctx;
}

/** Atajo: la sesión sola, que es lo que consumen los servicios. */
export function useCurrentSession(): Session {
  return useSession().session;
}
