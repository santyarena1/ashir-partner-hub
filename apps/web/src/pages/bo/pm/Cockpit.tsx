/**
 * Product Manager Cockpit.
 *
 * Todo el tablero de una marca en una pantalla: ventas, margen, stock,
 * rotación, objetivo, clientes, mix, quiebres y calidad.
 */
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  Boxes,
  DollarSign,
  Package,
  Percent,
  Target,
  TrendingDown,
  Users,
  Wrench,
} from 'lucide-react';
import { api } from '@/services';
import { useSession } from '@/app/session';
import { useAsync } from '@/app/hooks';
import { can } from '@/lib/rbac';
import { CHART_COLORS } from '@/lib/labels';
import { cn, fmtDate, fmtMoney, fmtNumber, fmtRelative } from '@/lib/utils';
import { Badge, Button, Card, CardHeader, ProgressBar, Segmented, Skeleton } from '@/components/ui/primitives';
import {
  Callout,
  DataTable,
  EmptyState,
  ErrorState,
  ForbiddenState,
  Mono,
  PageHeader,
  SectionTitle,
  StatGrid,
  StatTile,
  type Column,
} from '@/components/ui/data';
import { Bars, ChartFrame, Donut, MultiLine, TrendArea } from '@/components/ui/charts';
import { brandColor } from '@/components/domain/common';
import type { PmBrandDashboard } from '@/types';

export function PmCockpit() {
  const { session } = useSession();
  const [params, setParams] = useSearchParams();
  const [seriesMetric, setSeriesMetric] = useState<'sales' | 'units' | 'marginPct' | 'stockValue' | 'coverageDays'>('sales');

  const brands = useAsync(() => api.pm.listBrandsForPm(session), [session.role, session.userId]);
  const brandId = params.get('brand') ?? brands.data?.[0]?.id ?? '';
  const dashboard = useAsync(
    () => (brandId ? api.pm.dashboard(brandId, session) : Promise.resolve(null)),
    [brandId, session.role],
  );

  useEffect(() => {
    if (!params.get('brand') && brands.data?.[0]) {
      setParams({ brand: brands.data[0].id }, { replace: true });
    }
  }, [brands.data, params, setParams]);

  if (!can(session, 'pm:read')) {
    return (
      <Card>
        <ForbiddenState scope="pm:read" />
      </Card>
    );
  }

  if (dashboard.error) {
    return (
      <Card>
        <ErrorState description={dashboard.error.message} onRetry={dashboard.refetch} />
      </Card>
    );
  }

  const d = dashboard.data;

  return (
    <div>
      <PageHeader
        title="Product Manager Cockpit"
        subtitle={d ? `${d.brand} · responsable ${d.pm}` : 'Elegí una marca para ver su tablero'}
        actions={
          <>
            <Link to="/bo/pm/simulador">
              <Button variant="outline">Simulador comercial</Button>
            </Link>
            <Link to={`/bo/rma/analytics?brand=${brandId}`}>
              <Button variant="outline" icon={<Wrench className="size-4" />}>
                Calidad de la marca
              </Button>
            </Link>
          </>
        }
      />

      {/* ---------- selector de marca ---------- */}
      <div className="no-scrollbar mb-6 flex gap-2 overflow-x-auto pb-1">
        {(brands.data ?? []).map((brand) => (
          <button
            key={brand.id}
            type="button"
            onClick={() => setParams({ brand: brand.id }, { replace: true })}
            className={cn(
              'flex shrink-0 items-center gap-2 rounded-lg border px-3.5 py-2 text-[13px] font-medium transition-colors',
              brand.id === brandId
                ? 'border-ashir-300 bg-ashir-50 text-ashir-800'
                : 'border-ink-200 bg-white text-ink-600 hover:border-ink-300 hover:bg-ink-50',
            )}
          >
            <span className="size-2.5 rounded-sm" style={{ background: brandColor(brand.name) }} aria-hidden />
            {brand.name}
            <span className="text-[11px] text-ink-400">{brand.skuCount}</span>
          </button>
        ))}
      </div>

      {dashboard.initialLoading || !d ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full rounded-card" />
            ))}
          </div>
          <Skeleton className="h-72 w-full rounded-card" />
        </div>
      ) : (
        <CockpitContent
          d={d}
          seriesMetric={seriesMetric}
          setSeriesMetric={setSeriesMetric}
          canSeeMargin={can(session, 'margin:read')}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function CockpitContent({
  d,
  seriesMetric,
  setSeriesMetric,
  canSeeMargin,
}: {
  d: PmBrandDashboard;
  seriesMetric: 'sales' | 'units' | 'marginPct' | 'stockValue' | 'coverageDays';
  setSeriesMetric: (v: 'sales' | 'units' | 'marginPct' | 'stockValue' | 'coverageDays') => void;
  canSeeMargin: boolean;
}) {
  const stagnantColumns: Column<PmBrandDashboard['stagnantProducts'][number]>[] = [
    {
      key: 'sku',
      header: 'Producto',
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate text-[13px] text-ink-900">{row.name}</p>
          <Mono>{row.sku}</Mono>
        </div>
      ),
    },
    { key: 'stock', header: 'Stock', align: 'right', cell: (row) => <span className="tabular-nums">{fmtNumber(row.stock)}</span> },
    {
      key: 'days',
      header: 'Días sin venta',
      align: 'right',
      cell: (row) => (
        <span className={cn('font-semibold tabular-nums', row.daysWithoutSale > 120 ? 'text-bad-600' : 'text-warn-700')}>
          {row.daysWithoutSale}
        </span>
      ),
      sortable: true,
      sortValue: (r) => r.daysWithoutSale,
    },
    {
      key: 'value',
      header: 'Inmovilizado',
      align: 'right',
      cell: (row) => (
        <span className="tabular-nums text-ink-700">
          {fmtMoney({ amount: row.stockValue.toFixed(2), currency: 'USD' }, { compact: true })}
        </span>
      ),
      sortable: true,
      sortValue: (r) => r.stockValue,
    },
    {
      key: 'action',
      header: '',
      align: 'right',
      width: '120px',
      cell: () => (
        <Link to="/bo/condiciones" className="text-[13px] font-medium text-ashir-600 hover:text-ashir-700">
          Crear promoción
        </Link>
      ),
    },
  ];

  const stockoutColumns: Column<PmBrandDashboard['upcomingStockouts'][number]>[] = [
    {
      key: 'sku',
      header: 'Producto',
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate text-[13px] text-ink-900">{row.name}</p>
          <Mono>{row.sku}</Mono>
        </div>
      ),
    },
    { key: 'stock', header: 'Stock', align: 'right', cell: (row) => <span className="tabular-nums">{row.stock}</span> },
    {
      key: 'rate',
      header: 'Venta diaria',
      align: 'right',
      hideOnMobile: true,
      cell: (row) => <span className="tabular-nums text-ink-600">{row.dailyRate}</span>,
    },
    {
      key: 'days',
      header: 'Días de cobertura',
      align: 'right',
      cell: (row) => (
        <span className={cn('font-semibold tabular-nums', row.daysLeft < 10 ? 'text-bad-600' : 'text-warn-700')}>
          {row.daysLeft} d
        </span>
      ),
      sortable: true,
      sortValue: (r) => r.daysLeft,
    },
  ];

  const topSkuColumns: Column<PmBrandDashboard['topSkus'][number]>[] = [
    {
      key: 'sku',
      header: 'SKU',
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate text-[13px] text-ink-900">{row.name}</p>
          <Mono>{row.sku}</Mono>
        </div>
      ),
    },
    { key: 'units', header: 'Unidades/mes', align: 'right', cell: (row) => <span className="tabular-nums">{fmtNumber(row.units)}</span> },
    {
      key: 'amount',
      header: 'Facturación/mes',
      align: 'right',
      cell: (row) => (
        <span className="font-semibold tabular-nums">
          {fmtMoney({ amount: row.amount.toFixed(2), currency: 'USD' }, { compact: true })}
        </span>
      ),
      sortable: true,
      sortValue: (r) => r.amount,
    },
    ...(canSeeMargin
      ? [
          {
            key: 'margin',
            header: 'Margen',
            align: 'right' as const,
            cell: (row: PmBrandDashboard['topSkus'][number]) => (
              <span
                className={cn(
                  'tabular-nums',
                  Number.parseFloat(row.marginPct) < 12 ? 'text-bad-600' : 'text-ok-700',
                )}
              >
                {row.marginPct}%
              </span>
            ),
          },
        ]
      : []),
  ];

  const agingTotal = d.stockAging.reduce((a, b) => a + b.value, 0);
  const oldStock = d.stockAging.find((b) => b.bucket === '120+');

  return (
    <div className="space-y-6">
      {/* ---------- KPIs ---------- */}
      <StatGrid cols={6}>
        <StatTile
          label="Ventas del mes"
          value={fmtMoney(d.salesMonth, { compact: true })}
          delta={d.salesMonthVsPrevPct}
          deltaLabel="vs. mes anterior"
          icon={<DollarSign className="size-4" />}
          tone="ok"
        />
        {canSeeMargin && (
          <StatTile
            label="Margen bruto"
            value={`${d.grossMarginPct}%`}
            delta={d.grossMarginVsPrevPct}
            icon={<Percent className="size-4" />}
            tone="tech"
          />
        )}
        <StatTile
          label="Stock valorizado"
          value={fmtMoney(d.stockValue, { compact: true })}
          icon={<Boxes className="size-4" />}
          footer={`Rotación ${d.turnover}× anual`}
        />
        <StatTile
          label="Días de cobertura"
          value={`${d.coverageDays} d`}
          tone={d.coverageDays > 90 ? 'warn' : d.coverageDays < 20 ? 'bad' : 'ok'}
          invertDelta
          footer={d.coverageDays > 90 ? 'Stock por encima de lo recomendado' : 'Dentro del rango objetivo'}
        />
        <StatTile
          label="Clientes activos"
          value={d.activeCustomers}
          delta={d.activeCustomersVsPrev}
          icon={<Users className="size-4" />}
        />
        <StatTile
          label="Tasa de RMA"
          value={`${d.rmaRatePct}%`}
          icon={<Wrench className="size-4" />}
          tone={Number.parseFloat(d.rmaRatePct) > 1.5 ? 'bad' : 'ok'}
          invertDelta
          footer={`${d.rmaCount} casos registrados`}
        />
      </StatGrid>

      {/* ---------- objetivo ---------- */}
      <Card className="p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-[13px] font-semibold text-ink-900">
              <Target className="size-4 text-ashir-500" aria-hidden />
              Objetivo mensual de {d.brand}
            </p>
            <p className="mt-1 text-xs text-ink-500">
              {fmtMoney(d.salesMonth)} de {fmtMoney(d.monthlyTarget)}
            </p>
          </div>
          <p className={cn('text-2xl font-semibold tabular-nums', d.targetProgressPct >= 100 ? 'text-ok-600' : 'text-ink-900')}>
            {d.targetProgressPct}%
          </p>
        </div>
        <ProgressBar
          className="mt-3"
          height="lg"
          value={Math.min(100, d.targetProgressPct)}
          tone={d.targetProgressPct >= 100 ? 'ok' : d.targetProgressPct >= 70 ? 'brand' : 'warn'}
        />
      </Card>

      {/* ---------- alertas ---------- */}
      <div className="space-y-2">
        {oldStock && oldStock.units > 0 && (
          <Callout
            tone="warn"
            icon={<AlertTriangle className="size-4" />}
            title={`${fmtNumber(oldStock.units)} unidades llevan más de 120 días en inventario`}
            action={
              <Link to="/bo/condiciones">
                <Button size="sm" variant="outline">
                  Crear promoción
                </Button>
              </Link>
            }
          >
            Representan {fmtMoney({ amount: oldStock.value.toFixed(2), currency: 'USD' })} inmovilizados
            {oldStock.skus[0] && <> · el más antiguo es {oldStock.skus[0].sku} con {oldStock.skus[0].days} días</>}.
          </Callout>
        )}
        {d.criticalSkus > 0 && (
          <Callout tone="bad" icon={<Package className="size-4" />} title={`${d.criticalSkus} SKUs con stock crítico`}>
            Quedan 5 unidades o menos. Revisá los próximos quiebres para anticipar la reposición.
          </Callout>
        )}
      </div>

      {/* ---------- serie 12 meses ---------- */}
      <ChartFrame
        title={`Evolución de ${d.brand} · 12 meses`}
        subtitle="Serie de demostración construida a partir del peso real de la marca en el catálogo"
        height={280}
        action={
          <Segmented
            size="sm"
            value={seriesMetric}
            onChange={setSeriesMetric}
            options={[
              { value: 'sales', label: 'Ventas' },
              { value: 'units', label: 'Unidades' },
              ...(canSeeMargin ? [{ value: 'marginPct' as const, label: 'Margen %' }] : []),
              { value: 'stockValue', label: 'Stock' },
              { value: 'coverageDays', label: 'Cobertura' },
            ]}
          />
        }
      >
        <TrendArea
          data={d.series}
          xKey="month"
          yKey={seriesMetric}
          color={brandColor(d.brand)}
          formatter={(v) =>
            seriesMetric === 'marginPct'
              ? `${v.toFixed(1)}%`
              : seriesMetric === 'coverageDays'
                ? `${v} días`
                : seriesMetric === 'units'
                  ? `${fmtNumber(v)} u.`
                  : `USD ${fmtNumber(v)}`
          }
        />
      </ChartFrame>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartFrame
          title="Ventas y margen"
          subtitle="Comparación de la evolución mensual"
          height={250}
          legend={[
            { label: 'Ventas (USD)', color: CHART_COLORS[0]! },
            ...(canSeeMargin ? [{ label: 'Margen %', color: CHART_COLORS[2]! }] : []),
          ]}
        >
          <MultiLine
            data={d.series}
            xKey="month"
            series={[
              { key: 'sales', label: 'Ventas', color: CHART_COLORS[0] },
              ...(canSeeMargin ? [{ key: 'marginPct', label: 'Margen %', color: CHART_COLORS[2] }] : []),
            ]}
          />
        </ChartFrame>

        <ChartFrame title="Mix de categorías" subtitle="Participación en la facturación mensual" height={250}>
          <Donut data={d.categoryMix} nameKey="category" valueKey="amount" formatter={(v) => `USD ${fmtNumber(v)}`} />
        </ChartFrame>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartFrame title="Sell-in por cliente" subtitle="Facturación mensual estimada de la marca" height={260}>
          <Bars
            data={d.sellInByCustomer.map((s) => ({ label: s.customer, amount: s.amount }))}
            xKey="label"
            yKey="amount"
            horizontal
            color={brandColor(d.brand)}
            formatter={(v) => `USD ${fmtNumber(v)}`}
          />
        </ChartFrame>

        <ChartFrame title="Stock aging" subtitle="Antigüedad del inventario valorizado" height={260}>
          <Bars
            data={d.stockAging.map((b) => ({ label: `${b.bucket} días`, value: b.value }))}
            xKey="label"
            yKey="value"
            colorByIndex={(_, i) => [CHART_COLORS[2]!, CHART_COLORS[2]!, CHART_COLORS[4]!, CHART_COLORS[4]!, CHART_COLORS[6]!][i]!}
            formatter={(v) => `USD ${fmtNumber(v)}`}
          />
        </ChartFrame>
      </div>

      {/* ---------- stock aging detalle ---------- */}
      <section>
        <SectionTitle
          title="Stock aging por tramo"
          subtitle={`${fmtMoney({ amount: agingTotal.toFixed(2), currency: 'USD' })} inmovilizados en total`}
          action={
            <Link to="/bo/pm/stock" className="text-[13px] font-medium text-ashir-600 hover:text-ashir-700">
              Ver detalle completo
            </Link>
          }
        />
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {d.stockAging.map((bucket) => (
            <Card key={bucket.bucket} className="p-4">
              <p className="text-[11px] font-semibold tracking-wide text-ink-500 uppercase">{bucket.bucket} días</p>
              <p className="mt-1.5 text-lg font-semibold tabular-nums text-ink-900">
                {fmtMoney({ amount: bucket.value.toFixed(2), currency: 'USD' }, { compact: true })}
              </p>
              <p className="text-xs text-ink-500">{fmtNumber(bucket.units)} unidades</p>
              <ProgressBar
                className="mt-2"
                value={agingTotal > 0 ? (bucket.value / agingTotal) * 100 : 0}
                tone={bucket.bucket === '120+' ? 'bad' : bucket.bucket === '91-120' ? 'warn' : 'ok'}
              />
              {bucket.skus[0] && (
                <p className="mt-2 truncate text-[11px] text-ink-400">
                  Más antiguo: {bucket.skus[0].sku} ({bucket.skus[0].days} d)
                </p>
              )}
            </Card>
          ))}
        </div>
      </section>

      {/* ---------- tablas ---------- */}
      <div className="grid gap-5 lg:grid-cols-2">
        <section>
          <SectionTitle title="Top SKUs" subtitle="Mayor facturación mensual de la marca" />
          <DataTable columns={topSkuColumns} rows={d.topSkus} rowKey={(r) => r.sku} dense />
        </section>

        <section>
          <SectionTitle title="Próximos quiebres de stock" subtitle="Menos de 30 días de cobertura" />
          <DataTable
            columns={stockoutColumns}
            rows={d.upcomingStockouts}
            rowKey={(r) => r.sku}
            dense
            empty={<EmptyState compact title="Sin quiebres previstos" icon={<Package className="size-5" />} />}
          />
        </section>

        <section>
          <SectionTitle title="Productos sin movimiento" subtitle="Candidatos a liquidación o promoción" />
          <DataTable
            columns={stagnantColumns}
            rows={d.stagnantProducts}
            rowKey={(r) => r.sku}
            dense
            empty={<EmptyState compact title="Todo el catálogo rota" icon={<TrendingDown className="size-5" />} />}
          />
        </section>

        <section>
          <SectionTitle title="Clientes que dejaron de comprar" subtitle="Superaron su frecuencia habitual" />
          <Card>
            {d.churningCustomers.length === 0 ? (
              <EmptyState compact title="Ningún cliente en riesgo" icon={<Users className="size-5" />} />
            ) : (
              <ul className="divide-y divide-ink-100">
                {d.churningCustomers.map((customer) => (
                  <li key={customer.customerId} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <Link
                        to={`/bo/clientes/${customer.customerId}`}
                        className="text-[13px] font-medium text-ashir-600 hover:text-ashir-700"
                      >
                        {customer.customer}
                      </Link>
                      <p className="text-[11px] text-ink-400">
                        Última compra {fmtDate(customer.lastOrderAt)} · {fmtRelative(customer.lastOrderAt)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[13px] font-semibold tabular-nums text-ink-800">
                        {fmtMoney({ amount: customer.previous12m.toFixed(2), currency: 'USD' }, { compact: true })}
                      </p>
                      <Badge tone="warn" size="sm">
                        En riesgo
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </section>
      </div>

      <Card>
        <CardHeader title="Sobre estos números" />
        <p className="px-5 py-4 text-[13px] leading-relaxed text-ink-600">
          Las cantidades de SKUs, las categorías y los precios de lista provienen del archivo real de distribuidor de
          Ashir. Las series de ventas, el margen, el stock y la rotación son datos de demostración generados de forma
          determinista a partir del peso real de cada marca, de modo que sean coherentes entre pantallas. En producción
          estas métricas vendrían del ERP.
        </p>
      </Card>
    </div>
  );
}
