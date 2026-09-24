/**
 * Menú «Mi cuenta» del portal.
 *
 * Separa las dos cosas que el reseller hace acá y que antes convivían en la
 * misma barra: **comprar** (catálogo, marcas, promociones) y **administrar
 * su cuenta** (pedidos, cuenta corriente, comprobantes, PVP, beneficios y
 * garantías). Mezclarlas obligaba a leer ocho ítems iguales para encontrar
 * uno; separadas, la barra de arriba es una tienda y esto es el resto.
 *
 * El menú además adelanta lo que requiere atención, para que el reseller no
 * tenga que entrar a cada sección a chequear si pasó algo.
 */
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  BadgeDollarSign,
  ChevronDown,
  FileText,
  Gift,
  Heart,
  ListOrdered,
  Tag,
  UserRound,
  Wallet,
  Wrench,
} from 'lucide-react';
import { useSession } from '@/app/session';
import { customerById } from '@/mocks/fixtures/customers';
import { openBreachesForCustomer } from '@/mocks/fixtures/retail';
import { cn, fmtMoney, num } from '@/lib/utils';

export interface AccountLink {
  to: string;
  label: string;
  hint: string;
  icon: typeof ListOrdered;
}

/** Secciones de gestión de la cuenta, fuera de la barra de compra. */
export const ACCOUNT_LINKS: { group: string; items: AccountLink[] }[] = [
  {
    group: 'Mis compras',
    items: [
      { to: '/pedidos', label: 'Mis pedidos', hint: 'Estado, seguimiento y modificaciones', icon: ListOrdered },
      { to: '/precio-especial', label: 'Precios especiales', hint: 'Solicitudes y su resolución', icon: Tag },
      { to: '/favoritos', label: 'Favoritos', hint: 'Productos que guardaste', icon: Heart },
    ],
  },
  {
    group: 'Administración',
    items: [
      { to: '/cuenta', label: 'Cuenta corriente', hint: 'Saldo, crédito y vencimientos', icon: Wallet },
      { to: '/cuenta?tab=documents', label: 'Comprobantes', hint: 'Facturas y notas de crédito', icon: FileText },
      { to: '/pvp', label: 'Control de PVP', hint: 'Tus precios publicados vs. el sugerido', icon: BadgeDollarSign },
    ],
  },
  {
    group: 'Programa y posventa',
    items: [
      { to: '/beneficios', label: 'Beneficios Ashir Partner', hint: 'Puntos, nivel y objetivos', icon: Gift },
      { to: '/rma', label: 'Garantías y RMA', hint: 'Consultar serial y seguir casos', icon: Wrench },
    ],
  },
];

/** Todos los destinos en una lista plana, para el menú mobile. */
export const ACCOUNT_LINKS_FLAT = ACCOUNT_LINKS.flatMap((g) => g.items);

export function isAccountRoute(pathname: string): boolean {
  return ACCOUNT_LINKS_FLAT.some((l) => {
    const base = l.to.split('?')[0]!;
    return pathname === base || pathname.startsWith(`${base}/`);
  });
}

export function AccountMenu() {
  const { session } = useSession();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const location = useLocation();

  const customer = customerById(session.customerId ?? '');
  const breaches = customer ? openBreachesForCustomer(customer.id).length : 0;
  const overdue = customer ? num(customer.account.overdue) : 0;
  const alerts = (breaches > 0 ? 1 : 0) + (overdue > 0 ? 1 : 0);

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

  const active = isAccountRoute(location.pathname);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={cn(
          '-mb-px flex items-center gap-1.5 border-b-2 px-3.5 py-3 text-[13px] font-semibold transition-colors',
          active || open
            ? 'border-ashir-500 text-ashir-700'
            : 'border-transparent text-ink-600 hover:border-ink-200 hover:text-ink-900',
        )}
      >
        <UserRound className="size-4" aria-hidden />
        Mi cuenta
        {alerts > 0 && (
          <span className="flex size-4 items-center justify-center rounded-full bg-ashir-600 text-[10px] font-bold text-white">
            {alerts}
          </span>
        )}
        <ChevronDown className={cn('size-3.5 transition-transform', open && 'rotate-180')} aria-hidden />
      </button>

      {open && (
        <div
          role="menu"
          className="animate-fade-in absolute top-full right-0 z-80 mt-1 w-[320px] overflow-hidden rounded-card border border-ink-200 bg-white shadow-pop"
        >
          {customer && (
            <div className="border-b border-ink-100 bg-ink-50 px-4 py-3">
              <p className="text-[13px] font-semibold text-ink-900">{customer.tradeName}</p>
              <div className="mt-1.5 flex items-baseline justify-between gap-2 text-[12px]">
                <span className="text-ink-500">Crédito disponible</span>
                <span className="font-semibold tabular-nums text-ink-900">
                  {fmtMoney(customer.account.creditAvailable)}
                </span>
              </div>
              {overdue > 0 && (
                <div className="mt-1 flex items-baseline justify-between gap-2 text-[12px]">
                  <span className="text-bad-600">Deuda vencida</span>
                  <span className="font-semibold tabular-nums text-bad-600">{fmtMoney(customer.account.overdue)}</span>
                </div>
              )}
              {breaches > 0 && (
                <p className="mt-1.5 text-[11px] text-warn-700">
                  {breaches} producto(s) publicados por debajo del PVP
                </p>
              )}
            </div>
          )}

          {ACCOUNT_LINKS.map((group) => (
            <div key={group.group} className="border-b border-ink-100 py-1.5 last:border-b-0">
              <p className="px-4 py-1 text-[10px] font-semibold tracking-wide text-ink-400 uppercase">{group.group}</p>
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    role="menuitem"
                    onClick={() => setOpen(false)}
                    className="flex items-start gap-2.5 px-4 py-2 transition-colors hover:bg-ink-50"
                  >
                    <Icon className="mt-0.5 size-4 shrink-0 text-ink-400" aria-hidden />
                    <span className="min-w-0">
                      <span className="block text-[13px] font-medium text-ink-800">{item.label}</span>
                      <span className="block text-[11px] leading-snug text-ink-500">{item.hint}</span>
                    </span>
                  </Link>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
