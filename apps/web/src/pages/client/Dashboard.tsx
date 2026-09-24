/**
 * Home del reseller: es una tienda, no un tablero.
 *
 * Tres zonas, en este orden y sin mezclarse:
 *
 *   1. Comprar        — hero, categorías y avisos que frenan un pedido.
 *   2. Tu cuenta      — una sola franja: crédito, vencimiento, pedidos en
 *                       curso y puntos. El detalle vive en «Mi cuenta».
 *   3. Catálogo       — «Para tu próximo pedido» (reposición y promos) y
 *                       «Explorar», con los cortes del catálogo en pestañas.
 *
 * Antes eran nueve secciones apiladas con el mismo peso visual y el home
 * medía más de 5.000 px: el estado de cuenta, los objetivos del programa y
 * cuatro grillas de productos idénticas competían entre sí y empujaban el
 * catálogo fuera de la primera pantalla.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Boxes,
  CalendarClock,
  CreditCard,
  FileText,
  Sparkles,
  Star,
  TriangleAlert,
  Truck,
} from 'lucide-react';
import { api } from '@/services';
import { useSession } from '@/app/session';
import { useAsync } from '@/app/hooks';
import { customerById } from '@/mocks/fixtures/customers';
import { CATEGORIES, featuredByCategory, newArrivals, topSellers, SELLABLE_PRODUCTS } from '@/mocks/fixtures/catalog';
import { ACTIVE_PROMOTIONS } from '@/mocks/fixtures/pricing';
import { personName } from '@/mocks/fixtures/people';
import { ORDER_STATUS, PAYMENT_TERM } from '@/lib/labels';
import { fmtDate, fmtMoney, fmtNumber, fmtRelative, greeting, num } from '@/lib/utils';
import {
  Badge,
  Button,
  Card,
  ProgressBar,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/primitives';
import {
  Callout,
  ErrorState,
  SectionTitle,
} from '@/components/ui/data';
import { ProductCard, ProductCardSkeleton } from '@/components/domain/product-card';

export function ClientDashboard() {
  const { session } = useSession();
  const customer = customerById(session.customerId ?? '');
  const [explore, setExplore] = useState('offers');

  const orders = useAsync(() => api.orders.list({}, session), [session.customerId]);
  const partner = useAsync(() => api.partner.status(session), [session.customerId]);
  const purchased = useAsync(() => api.catalog.previouslyPurchased(session), [session.customerId]);

  if (!customer) {
    return <ErrorState title="No encontramos la cuenta" description="Elegí un reseller desde el selector de la demo." />;
  }

  const account = customer.account;
  const creditUsedPct = (num(account.creditUsed) / Math.max(1, num(account.creditLimit))) * 100;
  const inProgress = orders.data?.filter((o) => ['PICKING', 'SHIPPED', 'PARTIALLY_SHIPPED', 'CONFIRMED', 'SALES_REVIEW'].includes(o.status)) ?? [];
  const blockers = orders.data?.filter((o) => ['OBSERVED', 'PENDING_APPROVAL', 'PENDING_PAYMENT'].includes(o.status)) ?? [];

  /* --- reposición recomendada: lo más comprado con stock bajo --- */
  const replenish = (purchased.data ?? [])
    .filter((p) => p.listPrice && p.stock > 0)
    .sort((a, b) => a.stock - b.stock)
    .slice(0, 4);

  const topBrandProducts = SELLABLE_PRODUCTS.filter(
    (p) => customer.topBrands.includes(p.brand) && p.stock > 0,
  ).slice(0, 4);

  return (
    <div className="space-y-8">
      {/* ---------- hero ---------- */}
      <section className="overflow-hidden rounded-2xl bg-linear-to-br from-ashir-600 via-ashir-600 to-ashir-800 text-white">
        <div className="relative flex flex-wrap items-center justify-between gap-8 px-6 py-8 sm:px-10 sm:py-10">
          {/* textura discreta para que el bloque no se vea plano */}
          <span
            className="pointer-events-none absolute -top-20 -right-16 size-72 rounded-full bg-white/10 blur-2xl"
            aria-hidden
          />
          <span
            className="pointer-events-none absolute -bottom-24 left-1/3 size-64 rounded-full bg-white/5 blur-2xl"
            aria-hidden
          />

          <div className="relative min-w-0">
            <p className="text-xs font-semibold tracking-widest text-ashir-100 uppercase">Portal mayorista</p>
            <h1 className="mt-1.5 text-2xl font-bold tracking-tight sm:text-3xl">
              {greeting()}, {customer.tradeName}
            </h1>
            <p className="mt-2 max-w-lg text-[13px] leading-relaxed text-ashir-50/90">
              Tu lista {customer.priceListId.replace('pl_', 'LP-').toUpperCase()} ya está aplicada en todo el catálogo.
              Los precios que ves son los tuyos, con tus descuentos y promociones vigentes.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link to="/catalogo">
                <Button className="bg-white text-ashir-700 shadow-sm hover:bg-ashir-50">Ver catálogo</Button>
              </Link>
              <Link to="/quick-order">
                <Button
                  variant="outline"
                  className="border-white/40 bg-transparent text-white ring-0 hover:bg-white/10"
                  icon={<Sparkles className="size-4" />}
                >
                  Compra rápida
                </Button>
              </Link>
            </div>
          </div>

          <div className="relative grid shrink-0 grid-cols-3 gap-6 text-center">
            {[
              { label: 'Crédito disponible', value: fmtMoney(account.creditAvailable, { compact: true }) },
              { label: 'Puntos Ashir', value: partner.data ? `${fmtNumber(partner.data.points)}` : '—' },
              { label: 'Pedidos en curso', value: String(inProgress.length) },
            ].map((stat) => (
              <div key={stat.label}>
                <p className="text-xl font-bold tabular-nums sm:text-2xl">{stat.value}</p>
                <p className="mt-0.5 text-[11px] text-ashir-100">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- acceso rápido por categoría ---------- */}
      <nav aria-label="Categorías del catálogo">
        <div className="no-scrollbar -mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
          {CATEGORIES.slice(0, 8).map((category) => (
            <Link
              key={category.id}
              to={`/catalogo?categoryId=${category.id}`}
              className="group flex min-w-[132px] flex-1 shrink-0 flex-col items-center gap-2 rounded-xl border border-ink-200 bg-white px-4 py-4 transition-colors hover:border-ashir-300 hover:bg-ashir-50/40"
            >
              <span className="flex size-10 items-center justify-center rounded-full bg-ink-50 text-ink-400 transition-colors group-hover:bg-white group-hover:text-ashir-600">
                <Boxes className="size-5" aria-hidden />
              </span>
              <span className="text-center text-[13px] leading-tight font-semibold text-ink-800 group-hover:text-ashir-700">
                {category.name}
              </span>
              <span className="text-[11px] text-ink-400">{category.skuCount} SKUs</span>
            </Link>
          ))}
        </div>
      </nav>

      {/* ---------- lo que requiere una acción tuya ---------- */}
      {(num(account.overdue) > 0 || customer.documents.some((d) => d.status !== 'OK') || blockers.length > 0) && (
        <section className="space-y-2">
          {num(account.overdue) > 0 && (
            <Callout tone="bad" icon={<TriangleAlert className="size-4" />} title="Tenés deuda vencida">
              Hay {fmtMoney(account.overdue)} vencidos. Regularizá el saldo para liberar nuevos pedidos o contactá a tu
              ejecutivo.
            </Callout>
          )}
          {customer.documents
            .filter((d) => d.status !== 'OK')
            .map((doc) => (
              <Callout
                key={doc.name}
                tone="warn"
                icon={<FileText className="size-4" />}
                title={doc.status === 'MISSING' ? `Falta documentación: ${doc.name}` : `Documentación por vencer: ${doc.name}`}
              >
                {doc.status === 'MISSING'
                  ? 'Subí el comprobante para mantener tus condiciones impositivas vigentes.'
                  : `Vence el ${fmtDate(doc.expiresAt)}. Enviá la renovación a tu ejecutivo.`}
              </Callout>
            ))}
          {blockers.map((order) => (
            <Callout
              key={order.id}
              tone="warn"
              icon={<TriangleAlert className="size-4" />}
              title={`${order.number} · ${ORDER_STATUS[order.status].label}`}
              action={
                <Link to={`/pedidos/${order.id}`}>
                  <Button size="sm" variant="outline">
                    Revisar
                  </Button>
                </Link>
              }
            >
              {order.status === 'OBSERVED'
                ? 'El pedido está observado y necesita una acción de tu parte para continuar.'
                : order.status === 'PENDING_PAYMENT'
                  ? 'El pedido espera la acreditación del pago para pasar a preparación.'
                  : 'El pedido requiere aprobación comercial antes de avanzar.'}
            </Callout>
          ))}
        </section>
      )}

      {/*
        ---------- franja de cuenta ----------
        El detalle vive en «Mi cuenta». Acá va sólo lo que puede cambiar
        una decisión de compra: cuánto crédito queda, qué vence y si hay
        algo en camino. Antes esto ocupaba tres secciones enteras del home
        y empujaba el catálogo fuera de la primera pantalla.
      */}
      <section className="overflow-hidden rounded-card border border-ink-200 bg-white">
        <div className="grid divide-y divide-ink-100 sm:grid-cols-2 sm:divide-y-0 sm:divide-x lg:grid-cols-4">
          <div className="px-5 py-4">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-ink-500 uppercase">
              <CreditCard className="size-3.5" aria-hidden />
              Crédito disponible
            </p>
            <p className="mt-1 text-[19px] font-bold tabular-nums text-ink-900">{fmtMoney(account.creditAvailable)}</p>
            <ProgressBar
              className="mt-2"
              value={creditUsedPct}
              tone={creditUsedPct > 85 ? 'bad' : creditUsedPct > 65 ? 'warn' : 'ok'}
            />
          </div>

          <div className="px-5 py-4">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-ink-500 uppercase">
              <CalendarClock className="size-3.5" aria-hidden />
              Próximo vencimiento
            </p>
            <p className="mt-1 text-[19px] font-bold tabular-nums text-ink-900">
              {account.nextDueDate ? fmtDate(account.nextDueDate) : '—'}
            </p>
            <p className="mt-1 text-[12px] text-ink-500">
              {account.nextDueAmount
                ? `${fmtMoney(account.nextDueAmount)} · ${fmtRelative(account.nextDueDate)}`
                : 'Sin comprobantes pendientes'}
            </p>
          </div>

          <div className="px-5 py-4">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-ink-500 uppercase">
              <Truck className="size-3.5" aria-hidden />
              Pedidos en curso
            </p>
            <p className="mt-1 text-[19px] font-bold tabular-nums text-ink-900">{inProgress.length}</p>
            <p className="mt-1 truncate text-[12px] text-ink-500">
              {inProgress[0] ? `${inProgress[0].number} · ${ORDER_STATUS[inProgress[0].status].label}` : 'Nada en preparación'}
            </p>
          </div>

          <div className="px-5 py-4">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-ink-500 uppercase">
              <Star className="size-3.5" aria-hidden />
              Puntos Ashir
            </p>
            <p className="mt-1 text-[19px] font-bold tabular-nums text-ink-900">
              {partner.data ? fmtNumber(partner.data.points) : '—'}
            </p>
            <p className="mt-1 text-[12px] text-ink-500">
              {partner.data ? `Nivel ${partner.data.tier}` : 'Programa Ashir Partner'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 bg-ink-50 px-5 py-2.5">
          <p className="text-[12px] text-ink-500">
            Ejecutivo <span className="font-medium text-ink-700">{personName(customer.salesRepId)}</span>
            {' · '}Lista{' '}
            <code className="rounded bg-white px-1.5 py-0.5 font-mono text-[11px]">
              {customer.priceListId.replace('pl_', 'LP-').toUpperCase()}
            </code>
            {' · '}
            {PAYMENT_TERM[customer.paymentTerm].label}
          </p>
          <Link
            to="/cuenta"
            className="flex items-center gap-1 text-[13px] font-semibold text-ashir-600 hover:text-ashir-700"
          >
            Ver mi cuenta
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </div>
      </section>

      {/* ================================================================ */}
      {/* ZONA 1 — para tu próximo pedido                                   */}
      {/* ================================================================ */}
      <section className="space-y-5">
        <SectionTitle
          title="Para tu próximo pedido"
          subtitle="Lo que conviene mirar antes de armar la compra"
        />

        {replenish.length > 0 && (
          <div>
            <div className="mb-2.5 flex items-baseline justify-between gap-3">
              <h3 className="text-[14px] font-semibold text-ink-900">Reposición recomendada</h3>
              <span className="text-[12px] text-ink-500">Ya los compraste y hoy tienen poco stock</span>
            </div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {replenish.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </div>
        )}

        <div>
          <div className="mb-2.5 flex items-baseline justify-between gap-3">
            <h3 className="text-[14px] font-semibold text-ink-900">Promociones vigentes</h3>
            <Link to="/promociones" className="text-[12px] font-medium text-ashir-600 hover:text-ashir-700">
              Ver todas
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {ACTIVE_PROMOTIONS.slice(0, 4).map((promo) => (
              <Link key={promo.id} to={`/promociones#${promo.code}`}>
                <Card interactive className="h-full p-4">
                  <div className="flex items-start justify-between gap-2">
                    <code className="rounded bg-ashir-50 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-ashir-700">
                      {promo.code}
                    </code>
                    <Badge tone="ok" size="sm" dot>
                      Vigente
                    </Badge>
                  </div>
                  <p className="mt-2 text-[13px] font-semibold text-ink-900">{promo.name}</p>
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink-500">{promo.description}</p>
                  <p className="mt-2.5 text-xs font-medium text-ashir-700">{promo.actions[0]?.label}</p>
                  <p className="mt-1 text-[11px] text-ink-400">Hasta el {fmtDate(promo.validTo)}</p>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* ZONA 2 — explorar el catálogo                                     */}
      {/* ================================================================ */}
      {/*
        Antes eran cuatro grillas seguidas —ofertas, tus marcas, novedades,
        comprados antes— visualmente idénticas, y el home se leía como una
        sola lista infinita. Con pestañas se ve que son cuatro cortes del
        mismo catálogo y se elige cuál mirar.
      */}
      <section>
        <SectionTitle
          title="Explorar el catálogo"
          subtitle="Cuatro cortes del catálogo, con tus precios ya aplicados"
          action={
            <Link to="/catalogo" className="text-[13px] font-medium text-ashir-600 hover:text-ashir-700">
              Ver catálogo completo
            </Link>
          }
        />
        <Tabs value={explore} onValueChange={setExplore}>
          <TabsList>
            <TabsTrigger value="offers">Ofertas para vos</TabsTrigger>
            {topBrandProducts.length > 0 && <TabsTrigger value="brands">Tus marcas</TabsTrigger>}
            <TabsTrigger value="new">Nuevos lanzamientos</TabsTrigger>
            <TabsTrigger value="again">Comprados antes</TabsTrigger>
          </TabsList>

          <TabsContent value="offers">
            <p className="mb-3 text-[12px] text-ink-500">
              Seleccionadas según tu lista {customer.priceListId.replace('pl_', 'LP-').toUpperCase()} y tu historial.
            </p>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {purchased.initialLoading
                ? Array.from({ length: 4 }).map((_, i) => <ProductCardSkeleton key={i} />)
                : topSellers(4).map((product) => <ProductCard key={product.id} product={product} />)}
            </div>
          </TabsContent>

          {topBrandProducts.length > 0 && (
            <TabsContent value="brands">
              <p className="mb-3 text-[12px] text-ink-500">{customer.topBrands.join(' · ')}</p>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {topBrandProducts.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            </TabsContent>
          )}

          <TabsContent value="new">
            <p className="mb-3 text-[12px] text-ink-500">Ingresos recientes al depósito.</p>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {newArrivals(4).map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="again">
            <p className="mb-3 text-[12px] text-ink-500">Tu historial de compras en Ashir.</p>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {(purchased.data ?? []).filter((p) => p.listPrice).slice(0, 4).map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
              {!purchased.initialLoading &&
                (purchased.data ?? []).length === 0 &&
                featuredByCategory('GPUs', 4).map((product) => <ProductCard key={product.id} product={product} />)}
            </div>
          </TabsContent>
        </Tabs>
      </section>
    </div>
  );
}