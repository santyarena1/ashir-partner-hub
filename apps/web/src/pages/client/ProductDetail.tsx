/**
 * Ficha de producto.
 *
 * El desglose de precio es el corazón de la pantalla: muestra de dónde sale
 * cada centavo (lista, descuento de cliente, promoción, volumen).
 */
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeftRight,
  FileText,
  Heart,
  Minus,
  Plus,
  ShieldCheck,
  ShoppingCart,
  Tag,
  TrendingDown,
} from 'lucide-react';
import { api } from '@/services';
import { useSession } from '@/app/session';
import { useAsync } from '@/app/hooks';
import { useCart, useFavorites } from '@/app/cart';
import { useToast } from '@/components/ui/overlays';
import { customerById } from '@/mocks/fixtures/customers';
import { relatedProducts } from '@/mocks/fixtures/catalog';
import { pmById } from '@/mocks/fixtures/people';
import { personName } from '@/mocks/fixtures/people';
import { cn, fmtDate, fmtMoney, fmtNumber, num } from '@/lib/utils';
import { Badge, Button, Card, CardHeader, Skeleton, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/primitives';
import {
  Callout,
  DataRow,
  DataTable,
  ErrorState,
  Mono,
  PageHeader,
  SectionTitle,
  type Column,
} from '@/components/ui/data';
import { ProductTile, StockIndicator } from '@/components/domain/common';
import { ProductCard } from '@/components/domain/product-card';
import { SpecialPriceDialog } from '@/components/domain/special-price-dialog';
import type { PriceTier } from '@/types';

export function ProductDetail() {
  const { sku = '' } = useParams();
  const { session } = useSession();
  const cart = useCart();
  const toast = useToast();
  const { isFavorite, toggle } = useFavorites();
  const [qty, setQty] = useState(1);
  const [tab, setTab] = useState('specs');
  const [requestOpen, setRequestOpen] = useState(false);

  const product = useAsync(() => api.catalog.getProduct(sku, session), [sku, session.role]);
  const evaluation = useAsync(
    () => (product.data?.listPrice ? api.pricing.evaluate(product.data.id, qty, session) : Promise.resolve(null)),
    [product.data?.id, qty, session.customerId],
  );
  const orders = useAsync(() => api.orders.list({}, session), [session.customerId]);

  const customer = customerById(session.customerId ?? '');

  if (product.error) {
    return (
      <Card>
        <ErrorState
          title="No encontramos ese producto"
          description={product.error.message}
          onRetry={product.refetch}
        />
      </Card>
    );
  }

  if (product.initialLoading || !product.data) {
    return (
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-4">
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="aspect-video w-full rounded-card" />
          <Skeleton className="h-40 w-full rounded-card" />
        </div>
        <Skeleton className="h-96 w-full rounded-card" />
      </div>
    );
  }

  const p = product.data;
  const pm = pmById(p.pmId);
  const related = relatedProducts(p);

  /* --- historial de compras de este SKU --- */
  const history = (orders.data ?? [])
    .flatMap((order) => order.items.filter((it) => it.sku === p.sku).map((it) => ({ order, item: it })))
    .sort((a, b) => new Date(b.order.createdAt).getTime() - new Date(a.order.createdAt).getTime());

  const tierColumns: Column<PriceTier>[] = [
    {
      key: 'qty',
      header: 'Cantidad',
      cell: (tier) => (
        <span className="font-medium tabular-nums">
          {tier.maxQty ? `${tier.minQty} – ${tier.maxQty}` : `${tier.minQty} o más`}
        </span>
      ),
    },
    {
      key: 'discount',
      header: 'Descuento',
      align: 'right',
      cell: (tier) => {
        const pct = Number.parseFloat(tier.discountPct);
        return pct < -0.01 ? (
          <Badge tone="ok" size="sm">
            {pct.toFixed(2).replace('.', ',')}%
          </Badge>
        ) : (
          <span className="text-ink-400">—</span>
        );
      },
    },
    {
      key: 'unit',
      header: 'Precio unitario',
      align: 'right',
      cell: (tier) => <span className="font-semibold tabular-nums">{fmtMoney(tier.unitPrice)}</span>,
    },
  ];

  return (
    <div>
      <PageHeader
        breadcrumbs={[
          { label: 'Catálogo', href: '/catalogo' },
          { label: p.category, href: `/catalogo?categoryId=${p.categoryId}` },
          { label: p.sku },
        ]}
        title={p.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Link to={`/catalogo?brandId=${p.brandId}`} className="font-medium text-ashir-600 hover:text-ashir-700">
              {p.brand}
            </Link>
            <span>·</span>
            <Mono copy>{p.sku}</Mono>
            {p.partNumber && (
              <>
                <span>·</span>
                <span className="text-[13px]">
                  Part number: <Mono>{p.partNumber}</Mono>
                </span>
              </>
            )}
          </span>
        }
        badge={
          p.tags.includes('LIQUIDACION') ? (
            <Badge tone="bad">Liquidación</Badge>
          ) : p.availability === 'NEW_ARRIVAL' ? (
            <Badge tone="tech">Nuevo ingreso</Badge>
          ) : undefined
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_390px]">
        {/* ---------------- columna izquierda ---------------- */}
        <div className="min-w-0 space-y-5">
          <Card className="p-5">
            <div className="flex flex-col gap-5 sm:flex-row">
              <div className="w-full shrink-0 sm:w-72">
                {/* El archivo de distribuidor no trae imágenes: en lugar de
                    inventar fotos se compone un tile con la marca. */}
                <div className="rounded-xl border border-ink-150 border-ink-200 bg-white p-6">
                  <ProductTile product={p} size="lg" className="border-0" />
                </div>
                <p className="mt-2.5 text-[11px] leading-snug text-ink-400">
                  La lista de distribuidor no incluye imágenes de producto. En producción se cargarían desde el ERP o
                  desde el material de cada marca.
                </p>
              </div>

              <div className="min-w-0 flex-1">
                <StockIndicator product={p} />
                <dl className="mt-4 divide-y divide-ink-100">
                  <DataRow label="Categoría" value={p.category} />
                  {p.subcategory && <DataRow label="Subcategoría" value={p.subcategory} />}
                  <DataRow
                    label="Garantía estimada"
                    value={
                      <span className="inline-flex items-center gap-1.5">
                        <ShieldCheck className="size-3.5 text-ok-600" aria-hidden />
                        {p.warrantyMonths} meses
                      </span>
                    }
                  />
                  <DataRow label="IVA aplicable" value={`${(p.vatRate * 100).toFixed(1).replace('.', ',')}%`} />
                  {p.suggestedRetail && (
                    <DataRow
                      label="Precio final sugerido"
                      value={<span className="text-ink-600">{fmtMoney(p.suggestedRetail)}</span>}
                      hint={undefined}
                    />
                  )}
                  {p.incoming && (
                    <DataRow
                      label="Próximo ingreso"
                      value={`${fmtNumber(p.incoming.units)} unidades · ${fmtDate(
                        new Date(Date.now() + p.incoming.etaDays * 86_400_000).toISOString(),
                      )}`}
                    />
                  )}
                  {pm && <DataRow label="Product Manager de la marca" value={pm.name} />}
                  {customer && (
                    <DataRow label="Tu ejecutivo" value={personName(customer.salesRepId)} />
                  )}
                </dl>
              </div>
            </div>
          </Card>

          {/* ---------- tabs ---------- */}
          <Card>
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="px-2">
                <TabsTrigger value="specs">Especificaciones</TabsTrigger>
                <TabsTrigger value="tiers" count={evaluation.data?.tiers.length}>
                  Precio por cantidad
                </TabsTrigger>
                <TabsTrigger value="history" count={history.length}>
                  Tus compras
                </TabsTrigger>
                <TabsTrigger value="docs">Documentos</TabsTrigger>
              </TabsList>

              <TabsContent value="specs" className="p-5">
                {p.specs.length > 0 ? (
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {p.specs.map((spec) => (
                      <li key={spec} className="flex items-start gap-2 text-[13px] text-ink-700">
                        <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-ashir-400" aria-hidden />
                        {spec}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[13px] text-ink-500">
                    Este producto no trae especificaciones en la lista de distribuidor.
                  </p>
                )}
                {p.description && (
                  <p className="mt-4 border-t border-ink-100 pt-4 text-[13px] leading-relaxed text-ink-600">
                    {p.description}
                  </p>
                )}
              </TabsContent>

              <TabsContent value="tiers" className="p-5">
                {evaluation.data && evaluation.data.tiers.length > 0 ? (
                  <>
                    <p className="mb-3 text-[13px] text-ink-500">
                      Escalones vigentes para tu cuenta. El precio ya incluye tu lista y las condiciones acumulables.
                    </p>
                    <DataTable columns={tierColumns} rows={evaluation.data.tiers} rowKey={(t) => String(t.minQty)} dense />
                  </>
                ) : (
                  <p className="text-[13px] text-ink-500">
                    Este producto no tiene escalones por cantidad configurados hoy.
                  </p>
                )}
              </TabsContent>

              <TabsContent value="history" className="p-5">
                {history.length === 0 ? (
                  <p className="text-[13px] text-ink-500">Todavía no compraste este producto.</p>
                ) : (
                  <ul className="divide-y divide-ink-100">
                    {history.slice(0, 8).map(({ order, item }) => (
                      <li key={`${order.id}-${item.id}`} className="flex items-center justify-between gap-3 py-2.5">
                        <div className="min-w-0">
                          <Link to={`/pedidos/${order.id}`} className="text-[13px] font-medium text-ashir-600 hover:text-ashir-700">
                            {order.number}
                          </Link>
                          <p className="text-xs text-ink-500">{fmtDate(order.createdAt)}</p>
                        </div>
                        <div className="text-right text-[13px] tabular-nums">
                          <p className="font-medium text-ink-900">{item.quantity} u.</p>
                          <p className="text-xs text-ink-500">{fmtMoney(item.unitPrice)} c/u</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </TabsContent>

              <TabsContent value="docs" className="p-5">
                <ul className="space-y-2">
                  {['Ficha técnica del fabricante', 'Certificado de garantía', 'Manual de usuario'].map((doc) => (
                    <li key={doc}>
                      <button
                        type="button"
                        onClick={() => toast.simulated(`La descarga de «${doc}»`)}
                        className="flex w-full items-center gap-2.5 rounded-lg border border-ink-200 px-3 py-2.5 text-left text-[13px] text-ink-700 transition-colors hover:border-ink-300 hover:bg-ink-50"
                      >
                        <FileText className="size-4 shrink-0 text-ink-400" aria-hidden />
                        <span className="flex-1">{doc}</span>
                        <span className="text-[11px] text-ink-400">PDF</span>
                      </button>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-xs text-ink-400">
                  Los documentos son de demostración. En producción se vincularían al repositorio de cada marca.
                </p>
              </TabsContent>
            </Tabs>
          </Card>

          {/* ---------- relacionados ---------- */}
          {related.length > 0 && (
            <section>
              <SectionTitle title="Productos relacionados" subtitle={`Otras opciones en ${p.category}`} />
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {related.map((item) => (
                  <ProductCard key={item.id} product={item} />
                ))}
              </div>
            </section>
          )}
        </div>

        {/* ---------------- columna derecha: precio ---------------- */}
        <div className="lg:sticky lg:top-32 lg:self-start">
          <Card>
            <CardHeader title="Tu precio" subtitle={customer ? `Lista ${customer.priceListId.replace('pl_', 'LP-').toUpperCase()} · ${customer.segment}` : undefined} icon={<Tag className="size-4" />} />

            <div className="p-5">
              {!p.listPrice ? (
                <>
                  <p className="text-lg font-semibold text-ink-900">Precio a consultar</p>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-ink-500">
                    Este producto figura sin precio publicado en la lista vigente. Consultá disponibilidad y precio con
                    tu ejecutivo.
                  </p>
                  <Button variant="outline" className="mt-4 w-full" onClick={() => toast.simulated('La consulta al ejecutivo')}>
                    Consultar a mi ejecutivo
                  </Button>
                </>
              ) : evaluation.initialLoading || !evaluation.data ? (
                <div className="space-y-2">
                  <Skeleton className="h-8 w-32" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-4/5" />
                </div>
              ) : (
                <>
                  {/* --- desglose --- */}
                  <div className="space-y-1.5 font-mono text-[12px]">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-ink-500">Precio lista</span>
                      <span className="tabular-nums text-ink-700">{fmtMoney(evaluation.data.basePrice)}</span>
                    </div>
                    {evaluation.data.adjustments.map((adj, i) => (
                      <div key={`${adj.label}-${i}`} className="flex items-baseline justify-between gap-3">
                        <span className="min-w-0 flex-1 truncate text-ink-500" title={adj.note ?? adj.label}>
                          {adj.label}
                        </span>
                        <span className={cn('shrink-0 tabular-nums', num({ amount: adj.amount, currency: 'USD' }) < 0 ? 'text-ok-700' : 'text-ink-700')}>
                          {adj.percentage ? `${Number.parseFloat(adj.percentage).toFixed(2).replace('.', ',')}%` : fmtMoney({ amount: adj.amount, currency: 'USD' }, { withCode: false })}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* --- precio final, destacado --- */}
                  <div className="mt-3 rounded-xl bg-ashir-50 px-4 py-3.5 ring-1 ring-ashir-100 ring-inset">
                    <p className="text-[11px] font-semibold tracking-wider text-ashir-700 uppercase">Tu precio</p>
                    <p className="mt-0.5 text-3xl font-bold tracking-tight tabular-nums text-ink-900">
                      {fmtMoney(evaluation.data.finalUnitPrice)}
                    </p>
                    <p className="mt-0.5 text-[11px] text-ink-500">
                      por unidad, sin IVA
                      {Number.parseFloat(evaluation.data.totalDiscountPct) < -0.01 && (
                        <span className="ml-1.5 font-semibold text-ok-700">
                          ahorrás {Number.parseFloat(evaluation.data.totalDiscountPct).toFixed(1).replace('.', ',')}%
                        </span>
                      )}
                    </p>
                  </div>

                  <p className="mt-2 text-[11px] leading-relaxed text-ink-400">
                    {evaluation.data.explanation} Precio válido hasta el {fmtDate(evaluation.data.validUntil)}.
                  </p>

                  {/* --- condiciones aplicadas --- */}
                  {evaluation.data.appliedConditions.length > 0 && (
                    <div className="mt-3 space-y-1.5 border-t border-ink-100 pt-3">
                      <p className="text-[11px] font-semibold tracking-wide text-ink-500 uppercase">Condiciones aplicadas</p>
                      {evaluation.data.appliedConditions.map((c) => (
                        <div key={c.conditionId} className="flex items-center justify-between gap-2 text-[12px]">
                          <span className="min-w-0 truncate text-ink-600">{c.name}</span>
                          <Badge tone="ok" size="sm">
                            {c.effect}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* --- oportunidades --- */}
                  {evaluation.data.missedOpportunities.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {evaluation.data.missedOpportunities.slice(0, 2).map((m) => (
                        <Callout key={m.conditionId} tone="warn" icon={<TrendingDown className="size-4" />}>
                          {m.message}
                          {m.missingUnits && (
                            <button
                              type="button"
                              onClick={() => setQty(qty + m.missingUnits!)}
                              className="mt-1.5 block font-semibold underline underline-offset-2"
                            >
                              Ajustar cantidad a {qty + m.missingUnits}
                            </button>
                          )}
                        </Callout>
                      ))}
                    </div>
                  )}

                  {/* --- cantidad y acciones --- */}
                  <div className="mt-4 border-t border-ink-100 pt-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 items-center rounded-lg border border-ink-200">
                        <button
                          type="button"
                          onClick={() => setQty((q) => Math.max(1, q - 1))}
                          className="px-3 text-ink-500 transition-colors hover:text-ink-900"
                          aria-label="Disminuir cantidad"
                        >
                          <Minus className="size-4" aria-hidden />
                        </button>
                        <input
                          type="number"
                          min={1}
                          value={qty}
                          onChange={(e) => setQty(Math.max(1, Number.parseInt(e.target.value, 10) || 1))}
                          className="w-14 border-0 bg-transparent p-0 text-center text-sm font-semibold tabular-nums focus:outline-none"
                          aria-label="Cantidad"
                        />
                        <button
                          type="button"
                          onClick={() => setQty((q) => q + 1)}
                          className="px-3 text-ink-500 transition-colors hover:text-ink-900"
                          aria-label="Aumentar cantidad"
                        >
                          <Plus className="size-4" aria-hidden />
                        </button>
                      </div>
                      <div className="min-w-0 flex-1 text-right">
                        <p className="text-[11px] text-ink-500">Total de la línea</p>
                        <p className="text-base font-semibold tabular-nums text-ink-900">
                          {fmtMoney(evaluation.data.lineTotal)}
                        </p>
                      </div>
                    </div>

                    {evaluation.data.bonusUnits > 0 && (
                      <p className="mt-2 text-[12px] font-medium text-ok-700">
                        Incluye {evaluation.data.bonusUnits} unidad(es) bonificadas sin cargo.
                      </p>
                    )}

                    <Button
                      className="mt-3 w-full"
                      size="lg"
                      icon={<ShoppingCart className="size-4" />}
                      onClick={() => {
                        const result = cart.add(p.id, qty);
                        if (result.ok) toast.success('Agregado al pedido', result.message);
                        else toast.warning('No se pudo agregar', result.message);
                      }}
                    >
                      Agregar al pedido
                    </Button>

                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <Button variant="outline" size="sm" icon={<Tag className="size-3.5" />} onClick={() => setRequestOpen(true)}>
                        Precio especial
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        icon={<Heart className={cn('size-3.5', isFavorite(p.id) && 'fill-ashir-500 text-ashir-500')} />}
                        onClick={() => toggle(p.id)}
                      >
                        {isFavorite(p.id) ? 'Guardado' : 'Favorito'}
                      </Button>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-1 w-full"
                      icon={<ArrowLeftRight className="size-3.5" />}
                      onClick={() => toast.simulated('El comparador de productos')}
                    >
                      Comparar con otro producto
                    </Button>
                  </div>
                </>
              )}
            </div>
          </Card>

          {/* --- condiciones que no aplican, para transparencia --- */}
          {evaluation.data && evaluation.data.skippedConditions.length > 0 && (
            <Card className="mt-4">
              <CardHeader title="Condiciones que hoy no aplican" subtitle="Por qué no se descontaron" />
              <ul className="divide-y divide-ink-100 px-5 py-1">
                {evaluation.data.skippedConditions.slice(0, 5).map((c) => (
                  <li key={c.conditionId} className="py-2.5">
                    <p className="text-[13px] font-medium text-ink-800">{c.name}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-ink-500">{c.reason}</p>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>

      <SpecialPriceDialog open={requestOpen} onClose={() => setRequestOpen(false)} product={p} defaultQuantity={qty} />
    </div>
  );
}
