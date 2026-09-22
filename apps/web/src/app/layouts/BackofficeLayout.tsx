/**
 * Layout del backoffice.
 *
 * El sidebar se arma según el rol: Comercial, Product Manager, RMA/Técnico y
 * Administrador ven menús distintos, no el mismo menú con items deshabilitados.
 */
import { useState, type ComponentType } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import {
  BadgePercent,
  Boxes,
  Building2,
  ClipboardList,
  FileCode2,
  FileText,
  FlaskConical,
  Gauge,
  Import,
  LayoutDashboard,
  ListOrdered,
  Menu,
  PackageSearch,
  Play,
  Plug,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Tag,
  Target,
  Users,
  Webhook,
  Wrench,
  X,
} from 'lucide-react';
import type { Role } from '@/types';
import { cn } from '@/lib/utils';
import { useSession } from '@/app/session';
import { RoleSwitcher } from '@/components/domain/role-switcher';
import { NotificationBell } from '@/components/domain/notifications';
import { CommandPalette, useCommandPalette } from '@/components/domain/command-palette';
import { DemoModeChip } from '@/components/domain/common';
import { Kbd } from '@/components/ui/primitives';
import { AshirLogo } from '@/components/domain/logo';
import { ROLE_LABEL } from '@/lib/labels';

interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  end?: boolean;
}

interface NavGroup {
  label: string | null;
  items: NavItem[];
}

const SALES_NAV: NavGroup[] = [
  { label: null, items: [{ to: '/bo', label: 'Tablero', icon: Gauge, end: true }] },
  {
    label: 'Comercial',
    items: [
      { to: '/bo/pedidos', label: 'Pedidos', icon: ListOrdered },
      { to: '/bo/clientes', label: 'Clientes', icon: Building2 },
      { to: '/bo/solicitudes', label: 'Precios especiales', icon: Tag },
      { to: '/bo/condiciones', label: 'Condiciones comerciales', icon: BadgePercent },
      { to: '/bo/precios', label: 'Listas de precios', icon: FileText },
    ],
  },
  {
    label: 'Consulta',
    items: [
      { to: '/bo/productos', label: 'Productos', icon: Boxes },
      { to: '/bo/rma', label: 'RMA', icon: Wrench },
      { to: '/bo/partner', label: 'Ashir Partner', icon: Sparkles },
    ],
  },
];

const PM_NAV: NavGroup[] = [
  { label: null, items: [{ to: '/bo/pm', label: 'Mi Dashboard', icon: Gauge, end: true }] },
  {
    label: 'Mis marcas',
    items: [
      { to: '/bo/marcas', label: 'Marcas', icon: Tag },
      { to: '/bo/productos', label: 'Productos', icon: Boxes },
      { to: '/bo/pm/pricing', label: 'Pricing', icon: BadgePercent },
      { to: '/bo/pm/stock', label: 'Stock y aging', icon: PackageSearch },
      { to: '/bo/pm/simulador', label: 'Simulador comercial', icon: FlaskConical },
    ],
  },
  {
    label: 'Gestión',
    items: [
      { to: '/bo/clientes', label: 'Clientes', icon: Building2 },
      { to: '/bo/condiciones', label: 'Promociones y condiciones', icon: Tag },
      { to: '/bo/solicitudes', label: 'Solicitudes', icon: ClipboardList },
      { to: '/bo/pm/objetivos', label: 'Objetivos', icon: Target },
    ],
  },
  {
    label: 'Calidad',
    items: [
      { to: '/bo/rma/analytics', label: 'Calidad / RMA', icon: Wrench },
      { to: '/bo/reportes', label: 'Reportes', icon: FileText },
    ],
  },
];

const RMA_NAV: NavGroup[] = [
  { label: null, items: [{ to: '/bo/rma', label: 'Centro de RMA', icon: Wrench, end: true }] },
  {
    label: 'Operación',
    items: [
      { to: '/bo/rma/recepcion', label: 'Recepción', icon: PackageSearch },
      { to: '/bo/rma/politicas', label: 'Políticas de garantía', icon: ShieldCheck },
      { to: '/bo/rma/analytics', label: 'Analytics de calidad', icon: Gauge },
      { to: '/bo/rma/lotes', label: 'Lotes', icon: Boxes },
    ],
  },
  {
    label: 'Consulta',
    items: [
      { to: '/bo/productos', label: 'Productos', icon: Boxes },
      { to: '/bo/clientes', label: 'Clientes', icon: Building2 },
      { to: '/bo/pedidos', label: 'Pedidos', icon: ListOrdered },
    ],
  },
];

const ADMIN_NAV: NavGroup[] = [
  { label: null, items: [{ to: '/bo', label: 'Dashboard', icon: LayoutDashboard, end: true }] },
  {
    label: 'Comercial',
    items: [
      { to: '/bo/pedidos', label: 'Pedidos', icon: ListOrdered },
      { to: '/bo/clientes', label: 'Clientes', icon: Building2 },
      { to: '/bo/solicitudes', label: 'Solicitudes especiales', icon: Tag },
      { to: '/bo/partner', label: 'Ashir Partner', icon: Sparkles },
    ],
  },
  {
    label: 'Producto y pricing',
    items: [
      { to: '/bo/productos', label: 'Productos', icon: Boxes },
      { to: '/bo/marcas', label: 'Marcas', icon: Tag },
      { to: '/bo/precios', label: 'Listas de precios', icon: FileText },
      { to: '/bo/condiciones', label: 'Condiciones comerciales', icon: BadgePercent },
      { to: '/bo/pm', label: 'Product Managers', icon: Users },
    ],
  },
  {
    label: 'Posventa',
    items: [
      { to: '/bo/rma', label: 'RMA', icon: Wrench },
      { to: '/bo/rma/analytics', label: 'Calidad', icon: Gauge },
    ],
  },
  {
    label: 'Plataforma',
    items: [
      { to: '/bo/importaciones', label: 'Importaciones', icon: Import },
      { to: '/bo/integraciones', label: 'Integraciones', icon: Plug },
      { to: '/bo/webhooks', label: 'Webhooks', icon: Webhook },
      { to: '/bo/reportes', label: 'Reportes', icon: FileText },
      { to: '/bo/auditoria', label: 'Auditoría', icon: ClipboardList },
      { to: '/docs', label: 'Documentación API', icon: FileCode2 },
      { to: '/bo/configuracion', label: 'Configuración', icon: Settings },
    ],
  },
  {
    label: 'Demostración',
    items: [{ to: '/bo/demo', label: 'Recorrido de demo', icon: Play }],
  },
];

const NAV_BY_ROLE: Record<Role, NavGroup[]> = {
  CLIENT: ADMIN_NAV,
  SALES: SALES_NAV,
  PM: PM_NAV,
  RMA: RMA_NAV,
  ADMIN: ADMIN_NAV,
};

export function BackofficeLayout() {
  const { session, role } = useSession();
  const palette = useCommandPalette();
  const [mobileOpen, setMobileOpen] = useState(false);
  const groups = NAV_BY_ROLE[role];

  return (
    <div className="flex min-h-dvh bg-ink-50">
      {/* --- sidebar --- */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-80 flex w-[248px] flex-col bg-ink-900 transition-transform lg:sticky lg:inset-auto lg:top-0 lg:h-dvh lg:self-start lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-ink-800 px-4">
          <Link to="/bo" aria-label="Backoffice · inicio">
            <AshirLogo className="h-7" />
          </Link>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-800 hover:text-white lg:hidden"
            aria-label="Cerrar menú"
          >
            <X className="size-4.5" aria-hidden />
          </button>
        </div>

        <div className="border-b border-ink-800 px-4 py-3">
          <p className="text-[10px] font-semibold tracking-wider text-ink-500 uppercase">Backoffice</p>
          <p className="mt-0.5 truncate text-[13px] font-semibold text-white">{ROLE_LABEL[role]}</p>
          <p className="mt-0.5 truncate text-[11px] text-ink-400">{session.name}</p>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto px-2 py-3" aria-label="Navegación del backoffice">
          {groups.map((group, gi) => (
            <div key={group.label ?? `g${gi}`} className={cn(gi > 0 && 'mt-4')}>
              {group.label && (
                <p className="px-2.5 pb-1.5 text-[10px] font-semibold tracking-wider text-ink-500 uppercase">
                  {group.label}
                </p>
              )}
              <ul className="space-y-0.5">
                {group.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.end}
                      onClick={() => setMobileOpen(false)}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors',
                          isActive
                            ? 'bg-ashir-600/15 text-white ring-1 ring-ashir-600/30 ring-inset'
                            : 'text-ink-300 hover:bg-ink-800 hover:text-white',
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <item.icon className={cn('size-4 shrink-0', isActive ? 'text-ashir-400' : 'text-ink-500')} />
                          <span className="truncate">{item.label}</span>
                        </>
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="shrink-0 border-t border-ink-800 p-3">
          <Link
            to="/"
            className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] font-medium text-ink-300 transition-colors hover:bg-ink-800 hover:text-white"
          >
            <Boxes className="size-4 shrink-0 text-ink-500" aria-hidden />
            Ver portal de cliente
          </Link>
        </div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-70 bg-ink-950/50 lg:hidden" onClick={() => setMobileOpen(false)} aria-hidden />
      )}

      {/* --- contenido --- */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-60 flex h-16 items-center gap-3 border-b border-ink-200 bg-white px-4 sm:px-6">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="rounded-lg p-2 text-ink-500 transition-colors hover:bg-ink-100 lg:hidden"
            aria-label="Abrir menú"
          >
            <Menu className="size-4.5" aria-hidden />
          </button>

          <button
            type="button"
            onClick={() => palette.setOpen(true)}
            className="hidden h-9 max-w-md min-w-0 flex-1 items-center gap-2.5 rounded-lg border border-ink-200 bg-ink-50 px-3 text-left text-[13px] text-ink-400 transition-colors hover:border-ink-300 hover:bg-white sm:flex"
          >
            <Search className="size-4 shrink-0" aria-hidden />
            <span className="min-w-0 flex-1 truncate">Buscar serial, RMA, pedido, cliente o SKU…</span>
            <span className="flex shrink-0 gap-1">
              <Kbd>Ctrl</Kbd>
              <Kbd>K</Kbd>
            </span>
          </button>

          <div className="ml-auto flex items-center gap-1.5">
            <DemoModeChip className="hidden sm:inline-flex" />
            <button
              type="button"
              onClick={() => palette.setOpen(true)}
              className="rounded-lg p-2 text-ink-500 transition-colors hover:bg-ink-100 sm:hidden"
              aria-label="Buscar"
            >
              <Search className="size-4.5" aria-hidden />
            </button>
            <NotificationBell variant="light" />
            <div className="mx-1 h-6 w-px bg-ink-200" aria-hidden />
            <RoleSwitcher variant="light" />
          </div>
        </header>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 sm:py-8">
          <Outlet />
        </main>
      </div>

      <CommandPalette open={palette.open} onClose={() => palette.setOpen(false)} />
    </div>
  );
}
