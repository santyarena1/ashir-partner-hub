/**
 * Selector «Ver plataforma como».
 *
 * Cambia el rol de la demo y, para el rol Cliente, permite elegir con qué
 * cuenta de reseller se recorre el portal.
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ChevronDown, Eye, Headset, LayoutDashboard, ShieldCheck, Store, Wrench } from 'lucide-react';
import type { Role } from '@/types';
import { ROLE_LABEL } from '@/lib/labels';
import { useSession } from '@/app/session';
import { useCart } from '@/app/cart';
import { canActOnBehalf } from '@/lib/rbac';
import { CUSTOMERS } from '@/mocks/fixtures/customers';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/ui/primitives';

const ROLE_ICON: Record<Role, typeof Store> = {
  CLIENT: Store,
  SALES: Headset,
  PM: LayoutDashboard,
  RMA: Wrench,
  ADMIN: ShieldCheck,
};

const ROLE_DESCRIPTION: Record<Role, string> = {
  CLIENT: 'Marketplace, pedidos, beneficios y garantías de su propia cuenta.',
  SALES: 'Cartera de clientes, aprobaciones y condiciones comerciales.',
  PM: 'Cockpit por marca: ventas, margen, stock, calidad y pricing.',
  RMA: 'Centro de garantías: recepción, diagnóstico y resolución.',
  ADMIN: 'Vista integral del portal, integraciones y configuración.',
};

/** Ruta de inicio de cada rol. */
export const ROLE_HOME: Record<Role, string> = {
  CLIENT: '/',
  SALES: '/bo',
  PM: '/bo/pm',
  RMA: '/bo/rma',
  ADMIN: '/bo',
};

export function RoleSwitcher({ variant = 'dark' }: { variant?: 'dark' | 'light' }) {
  const { role, setRole, session, setCustomerId, assisting, startAssist, stopAssist } = useSession();
  const cart = useCart();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const Icon = ROLE_ICON[role];
  const customer = CUSTOMERS.find((c) => c.id === session.customerId);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={cn(
          'flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition-colors',
          variant === 'dark'
            ? 'text-ink-200 hover:bg-ink-800 hover:text-white'
            : 'text-ink-700 ring-1 ring-ink-200 hover:bg-ink-50',
        )}
      >
        <Eye className={cn('size-4 shrink-0', variant === 'dark' ? 'text-ink-400' : 'text-ink-400')} aria-hidden />
        <span className="hidden min-w-0 sm:block">
          <span className={cn('block text-[10px] leading-none font-medium', variant === 'dark' ? 'text-ink-400' : 'text-ink-400')}>
            Ver plataforma como
          </span>
          <span className="mt-0.5 block truncate text-[13px] leading-none font-semibold">
            {role === 'CLIENT' && customer ? customer.tradeName : ROLE_LABEL[role]}
          </span>
        </span>
        <Icon className="size-4 shrink-0 sm:hidden" aria-hidden />
        <ChevronDown className={cn('size-3.5 shrink-0 transition-transform', open && 'rotate-180')} aria-hidden />
      </button>

      {open && (
        <div
          role="menu"
          className="animate-fade-up absolute right-0 z-70 mt-2 w-[min(340px,calc(100vw-2rem))] overflow-hidden rounded-xl border border-ink-200 bg-white shadow-pop"
        >
          <div className="border-b border-ink-100 bg-ink-50 px-3.5 py-2.5">
            <p className="text-[11px] font-semibold tracking-wide text-ink-500 uppercase">Rol de la demostración</p>
            <p className="mt-0.5 text-xs text-ink-500">
              Cambia menú, tablero, permisos y datos visibles.
            </p>
          </div>

          <ul className="p-1.5">
            {(Object.keys(ROLE_LABEL) as Role[]).map((r) => {
              const RoleIcon = ROLE_ICON[r];
              const active = r === role;
              return (
                <li key={r}>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setRole(r);
                      setOpen(false);
                      navigate(ROLE_HOME[r]);
                    }}
                    className={cn(
                      'flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors',
                      active ? 'bg-ashir-50' : 'hover:bg-ink-50',
                    )}
                  >
                    <RoleIcon className={cn('mt-0.5 size-4 shrink-0', active ? 'text-ashir-600' : 'text-ink-400')} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className={cn('block text-[13px] font-semibold', active ? 'text-ashir-800' : 'text-ink-800')}>
                        {ROLE_LABEL[r]}
                      </span>
                      <span className="mt-0.5 block text-xs leading-snug text-ink-500">{ROLE_DESCRIPTION[r]}</span>
                    </span>
                    {active && <Check className="mt-0.5 size-4 shrink-0 text-ashir-600" aria-hidden />}
                  </button>
                </li>
              );
            })}
          </ul>

          {canActOnBehalf(session) && (
            <div className="border-t border-ink-100 bg-ink-50 p-3">
              <label htmlFor="assist-customer" className="text-[11px] font-semibold tracking-wide text-ink-500 uppercase">
                Operar en nombre de un cliente
              </label>
              <p className="mt-1 text-[11px] leading-snug text-ink-500">
                Para cargarle el pedido cuando te lo pide por teléfono o WhatsApp. Queda registrado a tu nombre.
              </p>
              <select
                id="assist-customer"
                value={assisting?.customerId ?? ''}
                onChange={(e) => {
                  const id = e.target.value;
                  setOpen(false);
                  cart.clear();
                  if (!id) {
                    stopAssist();
                    return;
                  }
                  startAssist(id);
                  navigate('/');
                }}
                className="mt-1.5 h-8 w-full rounded-lg border border-ink-200 bg-white px-2 text-[13px] text-ink-800"
              >
                <option value="">— No asistir a nadie —</option>
                {CUSTOMERS.filter((c) => c.status !== 'PROSPECT').map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.tradeName}
                  </option>
                ))}
              </select>
            </div>
          )}

          {role === 'CLIENT' && (
            <div className="border-t border-ink-100 bg-ink-50 p-3">
              <label htmlFor="demo-customer" className="text-[11px] font-semibold tracking-wide text-ink-500 uppercase">
                Recorrer como reseller
              </label>
              <select
                id="demo-customer"
                value={session.customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                className="mt-1.5 h-8 w-full rounded-lg border border-ink-200 bg-white px-2 text-[13px] text-ink-800"
              >
                {CUSTOMERS.filter((c) => c.status !== 'PROSPECT').map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.tradeName}
                  </option>
                ))}
              </select>
              {customer && (
                <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-ink-500">
                  <span>Lista {customer.priceListId.replace('pl_', '').toUpperCase()}</span>
                </p>
              )}
            </div>
          )}

          <div className="flex items-center gap-2.5 border-t border-ink-100 px-3.5 py-2.5">
            <Avatar initials={session.avatarInitials} tone="brand" />
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium text-ink-800">{session.name}</p>
              <p className="truncate text-xs text-ink-500">{session.jobTitle}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
