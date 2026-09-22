/**
 * Separacion de permisos por rol.
 *
 * Aunque el prototipo no tiene autenticacion productiva, las pantallas
 * respetan esta matriz. La regla no negociable: el rol CLIENT nunca accede
 * a `cost:read` ni a `margin:read`, y toda vista que muestre costo o margen
 * se renderiza detras de `can()`.
 */
import type { Role, Scope, Session, InternalUser, OnBehalfOf } from '@/types';

const CLIENT_SCOPES: Scope[] = [
  'catalog:read',
  'pricing:read',
  'orders:read',
  'orders:write',
  'rma:read',
  'rma:write',
  'partner:read',
];

const SALES_SCOPES: Scope[] = [
  'catalog:read',
  'pricing:read',
  'orders:read',
  'orders:write',
  'orders:approve',
  'customers:read',
  'customers:write',
  'rma:read',
  'partner:read',
  'margin:read',
  'audit:read',
];

const PM_SCOPES: Scope[] = [
  'catalog:read',
  'pricing:read',
  'pricing:manage',
  'orders:read',
  'customers:read',
  'rma:read',
  'pm:read',
  'pm:manage',
  'cost:read',
  'margin:read',
  'audit:read',
];

const RMA_SCOPES: Scope[] = [
  'catalog:read',
  'orders:read',
  'customers:read',
  'rma:read',
  'rma:write',
  'rma:manage',
  'audit:read',
];

const ADMIN_SCOPES: Scope[] = [
  'catalog:read',
  'pricing:read',
  'pricing:manage',
  'orders:read',
  'orders:write',
  'orders:approve',
  'customers:read',
  'customers:write',
  'rma:read',
  'rma:write',
  'rma:manage',
  'pm:read',
  'pm:manage',
  'partner:read',
  'partner:manage',
  'imports:manage',
  'integrations:read',
  'integrations:manage',
  'cost:read',
  'margin:read',
  'audit:read',
];

export const SCOPES_BY_ROLE: Record<Role, Scope[]> = {
  CLIENT: CLIENT_SCOPES,
  SALES: SALES_SCOPES,
  PM: PM_SCOPES,
  RMA: RMA_SCOPES,
  ADMIN: ADMIN_SCOPES,
};

export function can(session: Session | null, scope: Scope): boolean {
  if (!session) return false;
  return session.scopes.includes(scope);
}

export function canAny(session: Session | null, scopes: Scope[]): boolean {
  return scopes.some((s) => can(session, s));
}

/** true si el rol puede ver costos internos o margen. */
export function canSeeCost(session: Session | null): boolean {
  return can(session, 'cost:read');
}

export function canSeeMargin(session: Session | null): boolean {
  return can(session, 'margin:read');
}

/** El portal de cliente y el backoffice son experiencias distintas. */
export function isClientPortal(role: Role): boolean {
  return role === 'CLIENT';
}

/**
 * Filtra un valor sensible segun permisos: devuelve null cuando el rol
 * no deberia verlo. Usar en lugar de condicionales ad hoc.
 */
export function guard<T>(session: Session | null, requiredScope: Scope, value: T): T | null {
  return can(session, requiredScope) ? value : null;
}

/** Un PM solo ve el detalle profundo de sus marcas. */
export function ownsBrand(session: Session | null, brandId: string): boolean {
  if (!session) return false;
  if (session.role === 'ADMIN') return true;
  if (session.role !== 'PM') return false;
  return (session.brandIds ?? []).includes(brandId);
}

export function sessionFromUser(
  user: InternalUser,
  customerId?: string,
  onBehalfOf?: OnBehalfOf | null,
): Session {
  return {
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    roleLabel: user.jobTitle,
    avatarInitials: user.initials,
    scopes: SCOPES_BY_ROLE[user.role],
    customerId,
    onBehalfOf: onBehalfOf ?? null,
    brandIds: user.brandIds,
    jobTitle: user.jobTitle,
  };
}

/**
 * Roles que pueden operar el portal en nombre de un reseller.
 *
 * Es una funcion de asistencia comercial, no un cambio de identidad: la
 * sesion conserva los permisos del interno y la auditoria guarda su nombre.
 */
export function canActOnBehalf(session: Session | null): boolean {
  if (!session) return false;
  return session.role === 'SALES' || session.role === 'ADMIN';
}

/**
 * true si la cuenta de reseller en contexto manda sobre los listados:
 * el propio cliente, o un interno asistiendolo.
 */
export function isCustomerScoped(session: Session | null): boolean {
  if (!session) return false;
  return session.role === 'CLIENT' || Boolean(session.onBehalfOf);
}
