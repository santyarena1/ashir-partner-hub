/**
 * Stock y aging por marca: dónde está inmovilizado el capital.
 */
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertTriangle, Boxes, Package, TrendingDown } from 'lucide-react';
import { api } from '@/services';
import { useSession } from '@/app/session';
import { useAsync } from '@/app/hooks';
import { CHART_COLORS } from '@/lib/labels';
import { cn, fmtMoney, fmtNumber } from '@/lib/utils';
import { Badge, Button, Card, CardHeader, Segmented, Skeleton } from '@/components/ui/primitives';
import {
  Callout,
  DataTable,
  EmptyState,
  ErrorState,
  Mono,
  PageHeader,
  SectionTitle,
  StatGrid,
  StatTile,
  type Column,
} from '@/components/ui/data';
import { Bars, ChartFrame } from '@/components/ui/charts';
import { brandColor } from '@/components/domain/common';
import type { StockAgingBucket } from '@/types';

type SkuRow = StockAgingBucket['skus'][number] & { bucket: string };

export function PmStock() {
  const { session } = useSession();
  const [params, setParams] = useSearchParams();
  const [bucket, setBucket] = useState<string>('all');

  const brands = useAsync(() => api.pm.listBrandsForPm(session), [session.role, session.userId]);
  const brandId = params.get('brand') ?? brands.data?.[0]?.id ?? '';
  const dashboard = useAsync(
    () => (brandId ? api.pm.dashboard(brandId, session) : Promise.resolve(null)),
    [brandId, session.role],
  );

  if (dashboard.error) {
    return (
      <Card>
        <ErrorState description={dashboard.error.message} onRetry={dashboard.refetch} />
      </Card>
    );
  }

  const d = dashboard.data;
  const agingTotal = d?.stockAging.reduce((a, b) => a + b.value, 0) ?? 0;
  const agingUnits = d?.stockAging.reduce((a, b) => a + b.units, 0) ?? 0;
  const old = d?.stockAging.filter((b) => b.bucket === '91-120' || b.bucket === '120+') ?? [];
  const oldValue = old.reduce((a, b) => a + b.value, 0);

  const rows: SkuRow[] =
    d?.stockAging
      .filter((b) => bucket === 'all' || b.bucket === bucket)
      .flatMap((b) => b.skus.map((s) => ({ ...s, bucket: b.bucket }))) ?? [];

  const columns: Column<SkuRow>[] = [
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
    {
      key: 'bucket',
      header: 'Tramo',
      cell: (row) => (
        <Badge tone={row.bucket === '120+' ? 'bad' : row.bucket === '91-120' ? 'warn' : 'ok'} size="sm">
          {row.bucket} días
        </Badge>
      ),
    },
    {
      key: 'units',
      header: 'Unidades',
      align: 'right',
      cell: (row) => <span className="font-medium tabular-nums">{fmtNumber(row.units)}</span>,
      sortable: true,
      sortValue: (r) => r.units,
    },
    {
      key: 'days',
      header: 'Días de cobertura',
      align: 'right',
      cell: (row) => (
        <span className={cn('tabular-nums', row.days > 120 ? 'font-semibold text-bad-600' : 'text-ink-600')}>
          {row.days} d
        </span>
      ),
      sortable: true,
      sortValue: (r) => r.days,
    },
    {
      key: 'action',
      header: '',
      align: 'right',
      width: '150px',
      cell: (row) => (
        <div className="flex justify-end gap-2">
          <Link to={`/bo/pm/simulador?sku=${row.sku}`} className="text-[13px] font-medium text-ashir-600 hover:text-ashir-700">
            Simular
          </Link>
          <Link to="/bo/condiciones" className="text-[13px] font-medium text-ashir-600 hover:text-ashir-700">
            Promocionar
          </Link>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'PM Cockpit', href: '/bo/pm' }, { label: 'Stock y aging' }]}
        title="Stock y antigüedad de inventario"
        subtitle={d ? `${d.brand} · ${fmtNumber(agingUnits)} unidades por ${fmtMoney({ amount: agingTotal.toFixed(2), currency: 'USD' })}` : 'Elegí una marca'}
      />

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
          </button>
        ))}
      </div>

      {dashboard.initialLoading || !d ? (
        <div className="space-y-4">
          <Skeleton className="h-28 w-full rounded-card" />
          <Skeleton className="h-64 w-full rounded-card" />
        </div>
      ) : (
        <>
          {oldValue > 0 && (
            <Callout
              tone="warn"
              icon={<AlertTriangle className="size-4" />}
              title={`${fmtMoney({ amount: oldValue.toFixed(2), currency: 'USD' })} con más de 90 días de antigüedad`}
              className="mb-5"
              action={
                <Link to="/bo/condiciones">
                  <Button size="sm" variant="outline">
                    Crear promoción
                  </Button>
                </Link>
              }
            >
              Representan el {((oldValue / Math.max(1, agingTotal)) * 100).toFixed(0)}% del stock valorizado de{' '}
              {d.brand}. Es capital inmovilizado que conviene mover antes de que siga envejeciendo.
            </Callout>
          )}

          <StatGrid cols={5} className="mb-6">
            {d.stockAging.map((b) => (
              <StatTile
                key={b.bucket}
                label={`${b.bucket} días`}
                value={fmtMoney({ amount: b.value.toFixed(2), currency: 'USD' }, { compact: true })}
                tone={b.bucket === '120+' ? 'bad' : b.bucket === '91-120' ? 'warn' : 'ok'}
                footer={`${fmtNumber(b.units)} unidades · ${b.skus.length} SKUs`}
              />
            ))}
          </StatGrid>

          <div className="mb-6 grid gap-4 lg:grid-cols-2">
            <ChartFrame title="Valor inmovilizado por tramo" height={250}>
              <Bars
                data={d.stockAging.map((b) => ({ label: `${b.bucket} d`, value: b.value }))}
                xKey="label"
                yKey="value"
                colorByIndex={(_, i) => [CHART_COLORS[2]!, CHART_COLORS[2]!, CHART_COLORS[4]!, CHART_COLORS[4]!, '#d92d20'][i]!}
                formatter={(v) => `USD ${fmtNumber(v)}`}
              />
            </ChartFrame>
            <ChartFrame title="Unidades por tramo" height={250}>
              <Bars
                data={d.stockAging.map((b) => ({ label: `${b.bucket} d`, units: b.units }))}
                xKey="label"
                yKey="units"
                color={brandColor(d.brand)}
                formatter={(v) => `${fmtNumber(v)} unidades`}
              />
            </ChartFrame>
          </div>

          <SectionTitle
            title="Detalle por SKU"
            subtitle="Ordenado por antigüedad: primero lo que menos rota"
            action={
              <Segmented
                size="sm"
                value={bucket}
                onChange={setBucket}
                options={[
                  { value: 'all', label: 'Todos' },
                  ...d.stockAging.map((b) => ({ value: b.bucket, label: `${b.bucket} d` })),
                ]}
              />
            }
          />
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(r) => `${r.bucket}-${r.sku}`}
            dense
            empty={<EmptyState title="Sin SKUs en este tramo" icon={<Boxes className="size-5" />} />}
          />

          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            <section>
              <SectionTitle title="Productos sin movimiento" subtitle="Los mejores candidatos para liquidar" />
              <Card>
                <ul className="divide-y divide-ink-100">
                  {d.stagnantProducts.map((p) => (
                    <li key={p.sku} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium text-ink-900">{p.name}</p>
                        <p className="mt-0.5 flex items-center gap-2 text-[11px] text-ink-400">
                          <Mono>{p.sku}</Mono>
                          <span>{fmtNumber(p.stock)} u.</span>
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className={cn('text-[13px] font-semibold tabular-nums', p.daysWithoutSale > 120 ? 'text-bad-600' : 'text-warn-700')}>
                          {p.daysWithoutSale} días
                        </p>
                        <p className="text-[11px] tabular-nums text-ink-500">
                          {fmtMoney({ amount: p.stockValue.toFixed(2), currency: 'USD' }, { compact: true })}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>
            </section>

            <section>
              <SectionTitle title="Próximos quiebres" subtitle="Menos de 30 días de cobertura" />
              <Card>
                {d.upcomingStockouts.length === 0 ? (
                  <EmptyState compact title="Sin quiebres previstos" icon={<Package className="size-5" />} />
                ) : (
                  <ul className="divide-y divide-ink-100">
                    {d.upcomingStockouts.map((p) => (
                      <li key={p.sku} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-medium text-ink-900">{p.name}</p>
                          <p className="mt-0.5 flex items-center gap-2 text-[11px] text-ink-400">
                            <Mono>{p.sku}</Mono>
                            <span>{p.dailyRate} u./día</span>
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className={cn('text-[13px] font-semibold tabular-nums', p.daysLeft < 10 ? 'text-bad-600' : 'text-warn-700')}>
                            {p.daysLeft} días
                          </p>
                          <p className="text-[11px] tabular-nums text-ink-500">{fmtNumber(p.stock)} u. en stock</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </section>
          </div>

          <Card className="mt-6">
            <CardHeader title="Cómo se calcula la antigüedad" icon={<TrendingDown className="size-4" />} />
            <p className="px-5 py-4 text-[13px] leading-relaxed text-ink-600">
              El tramo de aging se deriva de la rotación: se divide el stock disponible por la venta diaria promedio del
              SKU. Un producto con mucho stock y poca salida cae en los tramos más altos. En producción el aging se
              calcularía con las fechas reales de ingreso de cada lote, que hoy administra el ERP.
            </p>
          </Card>
        </>
      )}
    </div>
  );
}
