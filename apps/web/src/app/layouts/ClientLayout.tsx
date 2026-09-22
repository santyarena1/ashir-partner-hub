/**
 * Layout del portal de cliente / reseller.
 * Header con buscador principal, navegación y accesos del reseller.
 */
import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  Heart,
  Menu,
  Search,
  ShoppingCart,
  Sparkles,
  Store,
  Wrench,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCart } from '@/app/cart';
import { useSession } from '@/app/session';
import { RoleSwitcher } from '@/components/domain/role-switcher';
import { NotificationBell } from '@/components/domain/notifications';
import { CommandPalette, useCommandPalette } from '@/components/domain/command-palette';
import { DemoModeChip } from '@/components/domain/common';
import { Badge, Kbd } from '@/components/ui/primitives';
import { CUSTOMERS } from '@/mocks/fixtures/customers';
import { AshirLogo } from '@/components/domain/logo';

const NAV = [
  { to: '/catalogo', label: 'Productos' },
  { to: '/marcas', label: 'Marcas' },
  { to: '/promociones', label: 'Promociones' },
  { to: '/pedidos', label: 'Mis pedidos' },
  { to: '/beneficios', label: 'Beneficios' },
  { to: '/rma', label: 'RMA' },
];

export function ClientLayout() {
  const { itemCount } = useCart();
  const { session } = useSession();
  const palette = useCommandPalette();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const customer = CUSTOMERS.find((c) => c.id === session.customerId);

  return (
    <div className="flex min-h-dvh flex-col bg-ink-50">
      {/* --- barra superior: contexto de la cuenta --- */}
      <div className="bg-ink-950 text-ink-300">
        <div className="mx-auto flex h-9 max-w-[1400px] items-center justify-between gap-4 px-4 text-[11px] sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="hidden truncate sm:inline">
              Portal mayorista exclusivo para comercios y resellers
            </span>
            <DemoModeChip />
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {customer && (
              <span className="hidden items-center gap-1.5 md:flex">
                Ejecutivo asignado:
                <span className="font-semibold text-white">
                  {customer.salesRepId === 'usr_martin'
                    ? 'Martín Rodríguez'
                    : customer.salesRepId === 'usr_sofia'
                      ? 'Sofía Maidana'
                      : customer.salesRepId === 'usr_pablo'
                        ? 'Pablo Ledesma'
                        : 'Rocío Alcaraz'}
                </span>
              </span>
            )}
            <Link to="/docs" className="transition-colors hover:text-white">
              Documentación API
            </Link>
          </div>
        </div>
      </div>

      {/* --- header principal --- */}
      <header className="sticky top-0 z-60 border-b border-ink-800 bg-ink-900 text-white">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-3 px-4 sm:px-6">
          <Link to="/" className="shrink-0" aria-label="Ashir Partner Hub · inicio">
            <AshirLogo className="h-7" />
          </Link>

          {/* buscador principal */}
          <button
            type="button"
            onClick={() => palette.setOpen(true)}
            className="ml-2 hidden h-10 min-w-0 flex-1 items-center gap-2.5 rounded-lg bg-ink-800 px-3.5 text-left text-[13px] text-ink-400 ring-1 ring-ink-700 transition-colors ring-inset hover:bg-ink-800/70 hover:ring-ink-600 md:flex"
          >
            <Search className="size-4 shrink-0" aria-hidden />
            <span className="min-w-0 flex-1 truncate">Buscar SKU, producto, marca o categoría…</span>
            <span className="flex shrink-0 gap-1">
              <Kbd>Ctrl</Kbd>
              <Kbd>K</Kbd>
            </span>
          </button>

          <div className="ml-auto flex items-center gap-1 md:ml-0">
            <button
              type="button"
              onClick={() => palette.setOpen(true)}
              className="rounded-lg p-2 text-ink-300 transition-colors hover:bg-ink-800 hover:text-white md:hidden"
              aria-label="Buscar"
            >
              <Search className="size-4.5" aria-hidden />
            </button>

            <Link
              to="/quick-order"
              className="hidden items-center gap-1.5 rounded-lg px-2.5 py-2 text-[13px] font-medium text-ink-200 transition-colors hover:bg-ink-800 hover:text-white lg:flex"
            >
              <Sparkles className="size-4" aria-hidden />
              Compra rápida
            </Link>

            <NotificationBell />

            <Link
              to="/favoritos"
              className="rounded-lg p-2 text-ink-300 transition-colors hover:bg-ink-800 hover:text-white"
              aria-label="Favoritos"
            >
              <Heart className="size-4.5" aria-hidden />
            </Link>

            <Link
              to="/carrito"
              className="relative rounded-lg p-2 text-ink-300 transition-colors hover:bg-ink-800 hover:text-white"
              aria-label={`Pedido en armado${itemCount > 0 ? ` (${itemCount} unidades)` : ''}`}
            >
              <ShoppingCart className="size-4.5" aria-hidden />
              {itemCount > 0 && (
                <span className="absolute top-1 right-0.5 flex min-w-4 items-center justify-center rounded-full bg-ashir-500 px-1 text-[10px] leading-4 font-bold text-white">
                  {itemCount > 99 ? '99+' : itemCount}
                </span>
              )}
            </Link>

            <div className="mx-1 hidden h-6 w-px bg-ink-700 sm:block" aria-hidden />
            <RoleSwitcher />

            <button
              type="button"
              onClick={() => setMobileOpen((v) => !v)}
              className="rounded-lg p-2 text-ink-300 transition-colors hover:bg-ink-800 hover:text-white lg:hidden"
              aria-label="Menú"
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X className="size-4.5" aria-hidden /> : <Menu className="size-4.5" aria-hidden />}
            </button>
          </div>
        </div>

        {/* navegación desktop */}
        <nav className="hidden border-t border-ink-800 lg:block" aria-label="Navegación principal">
          <div className="mx-auto flex max-w-[1400px] items-center gap-1 px-4 sm:px-6">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'border-b-2 px-3 py-2.5 text-[13px] font-medium transition-colors',
                    isActive || location.pathname.startsWith(item.to)
                      ? 'border-ashir-500 text-white'
                      : 'border-transparent text-ink-300 hover:text-white',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
            <span className="ml-auto flex items-center gap-2 py-2 text-[11px] text-ink-400">
              <Store className="size-3.5" aria-hidden />
              {customer?.tradeName}
              {customer && (
                <Badge
                  tone={customer.segment === 'PLATINUM' ? 'plat' : customer.segment === 'GOLD' ? 'warn' : 'neutral'}
                  size="sm"
                >
                  {customer.segment}
                </Badge>
              )}
            </span>
          </div>
        </nav>

        {/* navegación mobile */}
        {mobileOpen && (
          <nav className="animate-fade-in border-t border-ink-800 lg:hidden" aria-label="Navegación principal">
            <ul className="px-2 py-2">
              {[...NAV, { to: '/quick-order', label: 'Compra rápida' }, { to: '/docs', label: 'Documentación API' }].map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        'block rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                        isActive ? 'bg-ink-800 text-white' : 'text-ink-300 hover:bg-ink-800 hover:text-white',
                      )
                    }
                  >
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </header>

      <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <Outlet />
      </main>

      <footer className="mt-8 border-t border-ink-200 bg-white">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-4 px-4 py-6 text-[13px] text-ink-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <AshirLogo className="h-5" tone="dark" />
            <p className="mt-2 max-w-md text-xs leading-relaxed">
              Prototipo de presentación del Ashir Partner Hub. Los datos de catálogo provienen de la lista de
              distribuidor real; el resto de la información es simulada para la demostración.
            </p>
          </div>
          <div className="flex flex-wrap gap-4 text-xs">
            <Link to="/rma/consulta" className="inline-flex items-center gap-1.5 hover:text-ink-800">
              <Wrench className="size-3.5" aria-hidden />
              Consultar garantía
            </Link>
            <Link to="/docs" className="hover:text-ink-800">
              Documentación API
            </Link>
            <span>© {new Date().getFullYear()} Ashir Technology Corp · demo</span>
          </div>
        </div>
      </footer>

      <CommandPalette open={palette.open} onClose={() => palette.setOpen(false)} />
    </div>
  );
}
