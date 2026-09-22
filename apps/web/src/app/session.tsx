/**
 * Sesion de demo, selector «Ver plataforma como» y asistencia comercial.
 *
 * No hay autenticacion: el rol se elige desde el header y se persiste.
 * Cambiar de rol cambia menu, dashboard, acciones, datos sensibles y lenguaje.
 *
 * Ademas, un rol interno con permiso (comercial o administrador) puede
 * **operar el portal en nombre de un reseller**: es el caso real de un
 * cliente que pide por telefono o WhatsApp y el vendedor le arma el pedido
 * en la plataforma para que siga el circuito normal. No es un cambio de
 * identidad: la sesion conserva los permisos del interno y todo lo que se
 * haga queda auditado con su nombre.
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
import type { OnBehalfOf, Role, Session } from '@/types';
import { DEFAULT_USER_BY_ROLE, INTERNAL_USERS } from '@/mocks/fixtures/people';
import { CUSTOMERS, DEMO_CUSTOMER_ID } from '@/mocks/fixtures/customers';
import { canActOnBehalf, sessionFromUser } from '@/lib/rbac';

const ROLE_KEY = 'ashir-partner-hub:role:v1';
const CUSTOMER_KEY = 'ashir-partner-hub:customer:v1';
const ASSIST_KEY = 'ashir-partner-hub:assist:v1';

interface SessionContextValue {
  session: Session;
  role: Role;
  setRole: (role: Role) => void;
  /** Permite recorrer la demo como otro reseller (rol CLIENT). */
  setCustomerId: (id: string) => void;
  /** Cuenta que el interno esta asistiendo, o null. */
  assisting: OnBehalfOf | null;
  /** Empieza a operar el portal en nombre de un reseller. */
  startAssist: (customerId: string) => void;
  /** Vuelve a la sesion interna normal. */
  stopAssist: () => void;
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

function readAssist(): string | null {
  if (typeof window === 'undefined') return null;
  const id = window.localStorage.getItem(ASSIST_KEY);
  // Si la cuenta guardada ya no existe, la asistencia se descarta.
  return id && CUSTOMERS.some((c) => c.id === id) ? id : null;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<Role>(readRole);
  const [customerId, setCustomerIdState] = useState<string>(readCustomerId);
  const [assistId, setAssistId] = useState<string | null>(readAssist);

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

  useEffect(() => {
    try {
      if (assistId) window.localStorage.setItem(ASSIST_KEY, assistId);
      else window.localStorage.removeItem(ASSIST_KEY);
    } catch {
      /* modo privado */
    }
  }, [assistId]);

  const setRole = useCallback((next: Role) => {
    setRoleState(next);
    // Cambiar de rol cierra la asistencia: el permiso no se arrastra.
    setAssistId(null);
  }, []);
  const setCustomerId = useCallback((next: string) => setCustomerIdState(next), []);

  const user = useMemo(
    () => INTERNAL_USERS.find((u) => u.id === DEFAULT_USER_BY_ROLE[role]) ?? INTERNAL_USERS[0]!,
    [role],
  );

  /* La asistencia solo existe si el rol actual tiene permiso para ejercerla. */
  const assisting = useMemo<OnBehalfOf | null>(() => {
    if (!assistId) return null;
    if (!canActOnBehalf(sessionFromUser(user))) return null;
    const customer = CUSTOMERS.find((c) => c.id === assistId);
    if (!customer) return null;
    return {
      customerId: customer.id,
      customerName: customer.tradeName,
      userId: user.id,
      userName: user.name,
      startedAt: new Date().toISOString(),
    };
  }, [assistId, user]);

  const startAssist = useCallback((id: string) => setAssistId(id), []);
  const stopAssist = useCallback(() => setAssistId(null), []);

  const session = useMemo<Session>(() => {
    if (assisting) return sessionFromUser(user, assisting.customerId, assisting);
    return sessionFromUser(user, role === 'CLIENT' ? customerId : undefined);
  }, [assisting, user, role, customerId]);

  const value = useMemo(
    () => ({ session, role, setRole, setCustomerId, assisting, startAssist, stopAssist }),
    [session, role, setRole, setCustomerId, assisting, startAssist, stopAssist],
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
