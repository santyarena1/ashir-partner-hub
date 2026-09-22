/**
 * Layout del portal de cliente / reseller.
 *
 * Estética clara, al estilo de los mayoristas del rubro: header blanco,
 * buscador protagonista y naranja Ashir como único acento. El backoffice
 * mantiene su propia identidad oscura; acá el peso visual lo tiene el producto.
 */
import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Heart, Menu, Phone, Search, ShoppingCart, Sparkles, Wrench, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCart } from '@/app/cart';
import { useSession } from '@/app/session';
import { RoleSwitcher } from '@/components/domain/role-switcher';
import { NotificationBell } from '@/components/domain/notifications';
import { CommandPalette, useCommandPalette } from '@/components/domain/command-palette';
import { DemoModeChip } from '@/components/domain/common';
import { Badge, Kbd } from '@/components/ui/primitives';
import { CUSTOMERS } from '@/mocks/fixtures/customers';
import { personName } from '@/mocks/fixtures/people';
import { AshirLogo } from '@/components/domain/logo';

const NAV = [
  { to: '/catalogo', label: 'Productos' },
  { to: '/marcas', label: 'Marcas' },
  { to: '/promociones', label: 'Promociones' },
  { to: '/pedidos', label: 'Mis pedidos' },
  { to: '/beneficios', label: 'Beneficios' },
  { to: '/rma', label: 'Garantías' },
];

export function ClientLayout() {
  const { itemCount } = useCart();
  const { session } = useSession();
  const palette = useCommandPalette();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const customer = CUSTOMERS.find((c) => c.id === session.customerId);

  return (
    <div className="flex min-h-dvh flex-col bg-white">
      {/* ---------------- barra de utilidades ---------------- */}
      <div className="hidden border-b border-ink-100 bg-ink-50 sm:block">
        <div className="mx-auto flex h-9 max-w-[1320px] items-center justify-between gap-4 px-4 text-[11px] text-ink-500 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="truncate">Portal mayorista exclusivo para comercios y resellers</span>
            <DemoModeChip />
          </div>
          <div className="flex shrink-0 items-center gap-4">
            {customer && (
              <span className="hidden items-center gap-1.5 md:flex">
                <Phone className="size-3" aria-hidden />
                Tu ejecutivo:
                <span className="font-semibold text-ink-700">{personName(customer.salesRepId)}</span>
              </span>
            )}
            <Link to="/docs" className="transition-colors hover:text-ashir-600">
              Documentación API
            </Link>
          </div>
        </div>
      </div>

      {/* ---------------- header principal ---------------- */}
      <header className="sticky top-0 z-60 border-b border-ink-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-18 max-w-[1320px] items-center gap-4 px-4 sm:px-6">
          <Link to="/" className="shrink-0" aria-label="Ashir Partner Hub · inicio">
            <AshirLogo className="h-9" tone="dark" />
          </Link>

          {/* buscador protagonista */}
          <button
            type="button"
            onClick={() => palette.setOpen(true)}
            className="group ml-2 hidden h-11 min-w-0 flex-1 items-center gap-3 rounded-full border border-ink-200 bg-ink-50 px-4 text-left text-[13px] text-ink-400 transition-colors hover:border-ashir-300 hover:bg-white md:flex"
          >
            <Search className="size-4 shrink-0 text-ink-400 transition-colors group-hover:text-ashir-500" aria-hidden />
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
              className="rounded-lg p-2 text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-900 md:hidden"
              aria-label="Buscar"
            >
              <Search className="size-5" aria-hidden />
            </button>

            <Link
              to="/quick-order"
              className="hidden items-center gap-1.5 rounded-full border border-ashir-200 bg-ashir-50 px-3.5 py-2 text-[13px] font-semibold text-ashir-700 transition-colors hover:border-ashir-300 hover:bg-ashir-100 lg:flex"
            >
              <Sparkles className="size-4" aria-hidden />
              Compra rápida
            </Link>

            <NotificationBell variant="light" />

            <Link
              to="/favoritos"
              className="rounded-lg p-2 text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-900"
              aria-label="Favoritos"
            >
              <Heart className="size-5" aria-hidden />
            </Link>

            <Link
              to="/carrito"
              className="relative rounded-lg p-2 text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-900"
              aria-label={`Pedido en armado${itemCount > 0 ? ` (${itemCount} unidades)` : ''}`}
            >
              <ShoppingCart className="size-5" aria-hidden />
              {itemCount > 0 && (
                <span className="absolute top-0.5 right-0 flex min-w-4.5 items-center justify-center rounded-full bg-ashir-600 px-1 text-[10px] leading-4.5 font-bold text-white">
                  {itemCount > 99 ? '99+' : itemCount}
                </span>
              )}
            </Link>

            <div className="mx-1.5 hidden h-7 w-px bg-ink-200 sm:block" aria-hidden />
            <RoleSwitcher variant="light" />

            <button
              type="button"
              onClick={() => setMobileOpen((v) => !v)}
              className="rounded-lg p-2 text-ink-500 transition-colors hover:bg-ink-100 lg:hidden"
              aria-label="Menú"
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
            </button>
          </div>
        </div>

        {/* navegación desktop */}
        <nav className="hidden border-t border-ink-100 lg:block" aria-label="Navegación principal">
          <div className="mx-auto flex max-w-[1320px] items-center gap-1 px-4 sm:px-6">
            {NAV.map((item) => {
              const active = location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={cn(
                    '-mb-px border-b-2 px-3.5 py-3 text-[13px] font-semibold transition-colors',
                    active
                      ? 'border-ashir-500 text-ashir-700'
                      : 'border-transparent text-ink-600 hover:border-ink-200 hover:text-ink-900',
                  )}
                >
                  {item.label}
                </NavLink>
              );
            })}

            {customer && (
              <span className="ml-auto flex items-center gap-2 py-2 text-[11px] text-ink-400">
                Comprando como
                <span className="font-semibold text-ink-700">{customer.tradeName}</span>
                <Badge
                  tone={customer.segment === 'PLATINUM' ? 'plat' : customer.segment === 'GOLD' ? 'warn' : 'neutral'}
                  size="sm"
                >
                  {customer.segment}
                </Badge>
              </span>
            )}
          </div>
        </nav>

        {/* navegación mobile */}
        {mobileOpen && (
          <nav className="animate-fade-in border-t border-ink-100 lg:hidden" aria-label="Navegación principal">
            <ul className="px-2 py-2">
              {[...NAV, { to: '/quick-order', label: 'Compra rápida' }, { to: '/docs', label: 'Documentación API' }].map(
                (item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      onClick={() => setMobileOpen(false)}
                      className={({ isActive }) =>
                        cn(
                          'block rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                          isActive ? 'bg-ashir-50 text-ashir-700' : 'text-ink-700 hover:bg-ink-100',
                        )
                      }
                    >
                      {item.label}
                    </NavLink>
                  </li>
                ),
              )}
            </ul>
          </nav>
        )}
      </header>

      <main className="mx-auto w-full max-w-[1320px] flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <Outlet />
      </main>

      {/* ---------------- footer ---------------- */}
      <footer className="mt-10 border-t border-ink-100 bg-ink-50">
        <div className="mx-auto max-w-[1320px] px-4 py-10 sm:px-6">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <AshirLogo className="h-8" tone="dark" />
              <p className="mt-3 max-w-xs text-xs leading-relaxed text-ink-500">
                Prototipo de presentación del Ashir Partner Hub. El catálogo proviene de la lista de distribuidor real;
                el resto de la información es simulada para la demostración.
              </p>
            </div>

            <div>
              <h2 className="text-[11px] font-semibold tracking-wider text-ink-500 uppercase">Comprar</h2>
              <ul className="mt-3 space-y-2 text-[13px] text-ink-600">
                <li>
                  <Link to="/catalogo" className="transition-colors hover:text-ashir-600">
                    Catálogo completo
                  </Link>
                </li>
                <li>
                  <Link to="/marcas" className="transition-colors hover:text-ashir-600">
                    Marcas
                  </Link>
                </li>
                <li>
                  <Link to="/promociones" className="transition-colors hover:text-ashir-600">
                    Promociones vigentes
                  </Link>
                </li>
                <li>
                  <Link to="/quick-order" className="transition-colors hover:text-ashir-600">
                    Compra rápida
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h2 className="text-[11px] font-semibold tracking-wider text-ink-500 uppercase">Tu cuenta</h2>
              <ul className="mt-3 space-y-2 text-[13px] text-ink-600">
                <li>
                  <Link to="/pedidos" className="transition-colors hover:text-ashir-600">
                    Mis pedidos
                  </Link>
                </li>
                <li>
                  <Link to="/beneficios" className="transition-colors hover:text-ashir-600">
                    Ashir Partner
                  </Link>
                </li>
                <li>
                  <Link to="/precio-especial" className="transition-colors hover:text-ashir-600">
                    Precios especiales
                  </Link>
                </li>
                <li>
                  <Link to="/favoritos" className="transition-colors hover:text-ashir-600">
                    Favoritos
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h2 className="text-[11px] font-semibold tracking-wider text-ink-500 uppercase">Posventa</h2>
              <ul className="mt-3 space-y-2 text-[13px] text-ink-600">
                <li>
                  <Link to="/rma/consulta" className="inline-flex items-center gap-1.5 transition-colors hover:text-ashir-600">
                    <Wrench className="size-3.5" aria-hidden />
                    Consultar garantía
                  </Link>
                </li>
                <li>
                  <Link to="/rma" className="transition-colors hover:text-ashir-600">
                    Mis gestiones
                  </Link>
                </li>
                <li>
                  <Link to="/docs" className="transition-colors hover:text-ashir-600">
                    Documentación API
                  </Link>
                </li>
                <li>
                  <Link to="/bo" className="transition-colors hover:text-ashir-600">
                    Backoffice
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-ink-200 pt-5 text-xs text-ink-400">
            <span>© {new Date().getFullYear()} Ashir Technology Corp · prototipo de demostración</span>
            <span>Precios en USD sin IVA · envíos bonificados desde USD 599 en CABA</span>
          </div>
        </div>
      </footer>

      <CommandPalette open={palette.open} onClose={() => palette.setOpen(false)} />
    </div>
  );
}
