/**
 * Dashboard del reseller.
 * Estado de cuenta, crédito, pedidos en curso, ofertas y objetivos.
 */
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Boxes,
  CalendarClock,
  CreditCard,
  FileText,
  PackageCheck,
  Repeat,
  Sparkles,
  Star,
  TriangleAlert,
  Truck,
  Wrench,
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
import { Badge, Button, Card, CardHeader, ProgressBar, Skeleton } from '@/components/ui/primitives';
import {
  Callout,
  DataRow,
  EmptyState,
  ErrorState,
  SectionTitle,
  StatGrid,
  StatTile,
} from '@/components/ui/data';
import { OrderStatusBadge, SegmentBadge, SyncStamp } from '@/components/domain/common';
import { ProductCard, ProductCardSkeleton } from '@/components/domain/product-card';
import { useCart } from '@/app/cart';
import { useToast } from '@/components/ui/overlays';

export function ClientDashboard() {
  const { session } = useSession();
  const customer = customerById(session.customerId ?? '');
  const cart = useCart();
  const toast = useToast();

  const orders = useAsync(() => api.orders.list({}, session), [session.customerId]);
  const partner = useAsync(() => api.partner.status(session), [session.customerId]);
  const purchased = useAsync(() => api.catalog.previouslyPurchased(session), [session.customerId]);

  if (!customer) {
    return <ErrorState title="No encontramos la cuenta" description="Elegí un reseller desde el selector de la demo." />;
  }

  const account = customer.account;
  const creditUsedPct = (num(account.creditUsed) / Math.max(1, num(account.creditLimit))) * 100;
  const lastOrder = orders.data?.find((o) => o.status === 'DELIVERED');
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

      {/* ---------- contexto de la cuenta ---------- */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-ink-500">
            <span className="flex items-center gap-1.5">
              Ejecutivo asignado:
              <span className="font-medium text-ink-800">{personName(customer.salesRepId)}</span>
            </span>
            <span className="flex items-center gap-1.5">
              Segmento: <SegmentBadge segment={customer.segment} size="sm" />
            </span>
            <span>
              Lista: <code className="rounded bg-ink-100 px-1.5 py-0.5 font-mono text-[11px]">{customer.priceListId.replace('pl_', 'LP-').toUpperCase()}</code>
            </span>
            <span>
              Condición: <span className="font-medium text-ink-800">{PAYMENT_TERM[customer.paymentTerm].label}</span>
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" icon={<Repeat className="size-4" />} onClick={async () => {
            if (!lastOrder) {
              toast.info('Todavía no hay pedidos entregados para repetir.');
              return;
            }
            let added = 0;
            for (const item of lastOrder.items) {
              const result = cart.add(item.productId, item.quantity);
              if (result.ok) added++;
            }
            toast.success('Pedido cargado en el carrito', `Se agregaron ${added} ítems del pedido ${lastOrder.number}.`);
          }}>
            Repetir último pedido
          </Button>
          <Link to="/quick-order">
            <Button icon={<Sparkles className="size-4" />}>Compra rápida</Button>
          </Link>
        </div>
      </div>

      {/* ---------- alertas ---------- */}
      {(num(account.overdue) > 0 || customer.documents.some((d) => d.status !== 'OK') || blockers.length > 0) && (
        <div className="space-y-2">
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
                tone={doc.status === 'MISSING' ? 'warn' : 'warn'}
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
        </div>
      )}

      {/* ---------- estado de cuenta ---------- */}
      <section>
        <SectionTitle
          title="Estado de cuenta"
          subtitle="Crédito, saldo y próximos vencimientos"
          action={<SyncStamp at={new Date(Date.now() - 4 * 60_000).toISOString()} />}
        />
        <StatGrid cols={4}>
          <StatTile
            label="Crédito disponible"
            value={fmtMoney(account.creditAvailable)}
            icon={<CreditCard className="size-4" />}
            tone="ok"
            footer={
              <div className="space-y-1.5">
                <ProgressBar
                  value={creditUsedPct}
                  tone={creditUsedPct > 85 ? 'bad' : creditUsedPct > 65 ? 'warn' : 'ok'}
                />
                <span>
                  {fmtMoney(account.creditUsed)} usados de {fmtMoney(account.creditLimit)}
                </span>
              </div>
            }
          />
          <StatTile
            label="Saldo utilizado"
            value={fmtMoney(account.balance)}
            icon={<FileText className="size-4" />}
            footer={
              num(account.overdue) > 0 ? (
                <span className="font-medium text-bad-600">{fmtMoney(account.overdue)} vencidos</span>
              ) : (
                <span className="text-ok-600">Sin deuda vencida</span>
              )
            }
          />
          <StatTile
            label="Próximo vencimiento"
            value={account.nextDueDate ? fmtDate(account.nextDueDate) : '—'}
            icon={<CalendarClock className="size-4" />}
            tone="warn"
            footer={
              account.nextDueAmount ? (
                <span>
                  {fmtMoney(account.nextDueAmount)} · {fmtRelative(account.nextDueDate)}
                </span>
              ) : (
                'Sin comprobantes pendientes'
              )
            }
          />
          <StatTile
            label="Puntos Ashir"
            value={partner.data ? `${fmtNumber(partner.data.points)} pts` : <Skeleton className="h-7 w-24" />}
            icon={<Star className="size-4" />}
            tone="plat"
            footer={
              partner.data ? (
                <span>
                  Nivel {partner.data.tier} ·{' '}
                  <Link to="/beneficios" className="font-medium text-ashir-600 hover:text-ashir-700">
                    Ver beneficios
                  </Link>
                </span>
              ) : null
            }
          />
        </StatGrid>
      </section>

      {/* ---------- pedidos ---------- */}
      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Pedido en preparación"
            icon={<Truck className="size-4" />}
            action={
              <Link to="/pedidos" className="text-[13px] font-medium text-ashir-600 hover:text-ashir-700">
                Ver todos
              </Link>
            }
          />
          <div className="p-4">
            {orders.initialLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : inProgress.length === 0 ? (
              <EmptyState
                compact
                title="No hay pedidos en curso"
                description="Cuando confirmes un pedido vas a poder seguir su preparación y despacho desde acá."
                icon={<Truck className="size-5" />}
                action={
                  <Link to="/catalogo">
                    <Button size="sm">Ir al catálogo</Button>
                  </Link>
                }
              />
            ) : (
              <ul className="space-y-3">
                {inProgress.slice(0, 3).map((order) => (
                  <li key={order.id}>
                    <Link
                      to={`/pedidos/${order.id}`}
                      className="flex items-center justify-between gap-3 rounded-lg border border-ink-100 px-3 py-2.5 transition-colors hover:border-ink-300 hover:bg-ink-50"
                    >
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 text-[13px] font-semibold text-ink-900">
                          {order.number}
                          <OrderStatusBadge status={order.status} size="sm" />
                        </p>
                        <p className="mt-0.5 text-xs text-ink-500">
                          {order.items.length} ítems · {fmtMoney(order.total)}
                          {order.tracking && ` · ${order.tracking.carrier} ${order.tracking.code}`}
                        </p>
                      </div>
                      <ArrowRight className="size-4 shrink-0 text-ink-300" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Último pedido entregado"
            icon={<PackageCheck className="size-4" />}
            action={
              lastOrder && (
                <Link to={`/pedidos/${lastOrder.id}`} className="text-[13px] font-medium text-ashir-600 hover:text-ashir-700">
                  Ver detalle
                </Link>
              )
            }
          />
          <div className="p-4">
            {orders.initialLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : !lastOrder ? (
              <EmptyState compact title="Todavía no hay entregas registradas" icon={<PackageCheck className="size-5" />} />
            ) : (
              <>
                <div className="space-y-0.5">
                  <DataRow label="Pedido" value={lastOrder.number} emphasis />
                  <DataRow label="Entregado" value={fmtDate(lastOrder.deliveredAt)} />
                  <DataRow label="Ítems" value={`${lastOrder.items.length} SKUs · ${lastOrder.items.reduce((a, i) => a + i.quantity, 0)} u.`} />
                  <DataRow label="Total" value={fmtMoney(lastOrder.total)} emphasis />
                </div>
                <div className="mt-3 flex flex-wrap gap-2 border-t border-ink-100 pt-3">
                  <Link to={`/pedidos/${lastOrder.id}`} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full" icon={<Repeat className="size-3.5" />}>
                      Repetir pedido
                    </Button>
                  </Link>
                  <Link to="/rma/consulta" className="flex-1">
                    <Button variant="outline" size="sm" className="w-full" icon={<Wrench className="size-3.5" />}>
                      Iniciar garantía
                    </Button>
                  </Link>
                </div>
              </>
            )}
          </div>
        </Card>
      </section>

      {/* ---------- objetivos de beneficios ---------- */}
      {partner.data && (
        <section>
          <SectionTitle
            title="Objetivos del programa Ashir Partner"
            subtitle={`Nivel ${partner.data.tier} · el período cierra el ${fmtDate(partner.data.tierProgress.periodEndsAt)}`}
            action={
              <Link to="/beneficios" className="text-[13px] font-medium text-ashir-600 hover:text-ashir-700">
                Ver programa
              </Link>
            }
          />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {partner.data.missions.slice(0, 3).map((mission) => (
              <Card key={mission.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[13px] font-semibold text-ink-900">{mission.name}</p>
                  {mission.status === 'COMPLETED' && (
                    <Badge tone="ok" size="sm">
                      Cumplida
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-xs leading-relaxed text-ink-500">{mission.description}</p>
                <div className="mt-3">
                  <ProgressBar
                    value={(mission.progress / mission.target) * 100}
                    tone={mission.status === 'COMPLETED' ? 'ok' : 'brand'}
                  />
                  <p className="mt-1.5 flex items-center justify-between text-xs tabular-nums text-ink-600">
                    <span>
                      {mission.unit === 'USD' ? fmtMoney({ amount: String(mission.progress), currency: 'USD' }) : fmtNumber(mission.progress)}
                      {' / '}
                      {mission.unit === 'USD' ? fmtMoney({ amount: String(mission.target), currency: 'USD' }) : fmtNumber(mission.target)}
                    </span>
                    <span className="font-medium text-ok-700">+{fmtNumber(mission.rewardPoints)} pts</span>
                  </p>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* ---------- promociones vigentes ---------- */}
      <section>
        <SectionTitle
          title="Promociones vigentes"
          subtitle="Condiciones activas que podés aprovechar en este pedido"
          action={
            <Link to="/promociones" className="text-[13px] font-medium text-ashir-600 hover:text-ashir-700">
              Ver todas
            </Link>
          }
        />
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
      </section>

      {/* ---------- reposición recomendada ---------- */}
      {replenish.length > 0 && (
        <section>
          <SectionTitle
            title="Reposición recomendada"
            subtitle="Productos que ya compraste y hoy tienen poco stock disponible"
          />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {replenish.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}

      {/* ---------- ofertas para vos ---------- */}
      <section>
        <SectionTitle title="Ofertas para vos" subtitle={`Seleccionadas según tu lista ${customer.priceListId.replace('pl_', 'LP-').toUpperCase()} y tu historial`} />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {purchased.initialLoading
            ? Array.from({ length: 4 }).map((_, i) => <ProductCardSkeleton key={i} />)
            : topSellers(4).map((product) => <ProductCard key={product.id} product={product} />)}
        </div>
      </section>

      {/* ---------- tus marcas ---------- */}
      {topBrandProducts.length > 0 && (
        <section>
          <SectionTitle
            title="Tus marcas"
            subtitle={customer.topBrands.join(' · ')}
            action={
              <Link to="/marcas" className="text-[13px] font-medium text-ashir-600 hover:text-ashir-700">
                Ver todas las marcas
              </Link>
            }
          />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {topBrandProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}

      {/* ---------- nuevos lanzamientos ---------- */}
      <section>
        <SectionTitle title="Nuevos lanzamientos" subtitle="Ingresos recientes al depósito" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {newArrivals(4).map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      {/* ---------- comprados anteriormente ---------- */}
      <section>
        <SectionTitle
          title="Comprados anteriormente"
          subtitle="Tu historial de compras en Ashir"
          action={
            <Link to="/catalogo?purchased=1" className="text-[13px] font-medium text-ashir-600 hover:text-ashir-700">
              Ver todo el historial
            </Link>
          }
        />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {(purchased.data ?? []).filter((p) => p.listPrice).slice(0, 4).map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
          {!purchased.initialLoading && (purchased.data ?? []).length === 0 &&
            featuredByCategory('GPUs', 4).map((product) => <ProductCard key={product.id} product={product} />)}
        </div>
      </section>
    </div>
  );
}
