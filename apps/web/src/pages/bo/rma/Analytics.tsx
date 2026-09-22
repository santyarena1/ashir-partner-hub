/**
 * Analytics de calidad por marca: tasa de RMA, motivos, SKUs anómalos,
 * resultados y lotes sospechosos.
 */
import { Link, useSearchParams } from 'react-router-dom';
import { AlertTriangle, Boxes, Clock, Factory, TrendingUp, Wrench } from 'lucide-react';
import type { RmaAnalytics } from '@/types';
import { api } from '@/services';
import { useSession } from '@/app/session';
import { useAsync } from '@/app/hooks';
import { CHART_COLORS } from '@/lib/labels';
import { cn, fmtNumber } from '@/lib/utils';
import { Badge, Button, Card, CardHeader, Skeleton } from '@/components/ui/primitives';
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
import { Bars, ChartFrame, Donut, MultiLine } from '@/components/ui/charts';
import { brandColor } from '@/components/domain/common';

export function RmaAnalyticsPage() {
  const { session } = useSession();
  const [params, setParams] = useSearchParams();

  const brands = useAsync(() => api.pm.listBrandsForPm(session), [session.role, session.userId]);
  const brandId = params.get('brand') ?? brands.data?.[0]?.id ?? '';
  const analytics = useAsync(
    () => (brandId ? api.rma.analytics(brandId) : Promise.resolve(null)),
    [brandId],
  );

  if (analytics.error) {
    return (
      <Card>
        <ErrorState description={analytics.error.message} onRetry={analytics.refetch} />
      </Card>
    );
  }

  const a = analytics.data;
  const alertSkus = a?.topSkus.filter((s) => s.alert) ?? [];
  const suspectLots = a?.lots.filter((l) => l.incidentSuspected) ?? [];

  const skuColumns: Column<RmaAnalytics['topSkus'][number]>[] = [
    {
      key: 'sku',
      header: 'Producto',
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate text-[13px] text-ink-900">{row.productName}</p>
          <Mono>{row.sku}</Mono>
        </div>
      ),
    },
    {
      key: 'sold',
      header: 'Vendidas',
      align: 'right',
      hideOnMobile: true,
      cell: (row) => <span className="tabular-nums text-ink-600">{fmtNumber(row.sold)}</span>,
      sortable: true,
      sortValue: (r) => r.sold,
    },
    {
      key: 'rma',
      header: 'RMAs',
      align: 'right',
      cell: (row) => <span className="font-medium tabular-nums">{row.rma}</span>,
      sortable: true,
      sortValue: (r) => r.rma,
    },
    {
      key: 'rate',
      header: 'Tasa',
      align: 'right',
      cell: (row) => (
        <span className={cn('font-semibold tabular-nums', row.alert ? 'text-bad-600' : 'text-ink-700')}>
          {row.ratePct}%
        </span>
      ),
      sortable: true,
      sortValue: (r) => Number.parseFloat(r.ratePct),
    },
    {
      key: 'vs',
      header: 'vs. promedio marca',
      align: 'right',
      cell: (row) => (
        <Badge tone={row.alert ? 'bad' : 'neutral'} size="sm">
          {row.vsBrandAvg}
        </Badge>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Calidad y analytics de RMA"
        subtitle={a ? `${a.brand} · ${fmtNumber(a.unitsSold)} unidades vendidas · ${a.rmaCount} casos de garantía` : 'Elegí una marca'}
        actions={
          <Link to="/bo/rma/lotes">
            <Button variant="outline" icon={<Boxes className="size-4" />}>
              Ver lotes
            </Button>
          </Link>
        }
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

      {analytics.initialLoading || !a ? (
        <div className="space-y-4">
          <Skeleton className="h-28 w-full rounded-card" />
          <Skeleton className="h-72 w-full rounded-card" />
        </div>
      ) : (
        <>
          {/* ---------- alertas ---------- */}
          <div className="mb-5 space-y-2">
            {alertSkus.map((sku) => (
              <Callout
                key={sku.sku}
                tone="bad"
                icon={<AlertTriangle className="size-4" />}
                title={`El SKU ${sku.sku} presenta una tasa de RMA ${sku.vsBrandAvg} superior al promedio de la marca`}
              >
                {sku.productName} · {sku.rma} casos sobre {fmtNumber(sku.sold)} unidades vendidas ({sku.ratePct}%).
                Conviene revisar los lotes involucrados y escalar al fabricante.
              </Callout>
            ))}
            {suspectLots.map((lot) => (
              <Callout
                key={lot.lotId}
                tone="bad"
                icon={<Boxes className="size-4" />}
                title="Posible incidencia de lote detectada"
                action={
                  <Link to={`/bo/rma/lotes/${lot.code}`}>
                    <Button size="sm" variant="outline">
                      Analizar lote
                    </Button>
                  </Link>
                }
              >
                {lot.code} acumula una tasa de RMA del {lot.ratePct}%, muy por encima del comportamiento habitual de la
                marca.
              </Callout>
            ))}
          </div>

          <StatGrid cols={5} className="mb-6">
            <StatTile
              label="Unidades vendidas"
              value={fmtNumber(a.unitsSold)}
              icon={<TrendingUp className="size-4" />}
              footer="Período de 12 meses"
            />
            <StatTile label="Casos de RMA" value={a.rmaCount} icon={<Wrench className="size-4" />} />
            <StatTile
              label="Tasa de RMA"
              value={`${a.rmaRatePct}%`}
              tone={Number.parseFloat(a.rmaRatePct) > 1.5 ? 'bad' : Number.parseFloat(a.rmaRatePct) > 1 ? 'warn' : 'ok'}
              invertDelta
            />
            <StatTile
              label="Tiempo medio de resolución"
              value={`${a.avgResolutionDays} días`}
              icon={<Clock className="size-4" />}
              tone={a.avgResolutionDays > 10 ? 'warn' : 'ok'}
            />
            <StatTile
              label="Esperando fabricante"
              value={a.awaitingManufacturer}
              icon={<Factory className="size-4" />}
              tone={a.awaitingManufacturer > 0 ? 'warn' : 'ok'}
              footer="SLA en pausa mientras dure la gestión"
            />
          </StatGrid>

          {/* ---------- evolución ---------- */}
          <ChartFrame
            title="Evolución mensual de RMAs"
            subtitle="Unidades vendidas contra casos de garantía"
            height={280}
            className="mb-4"
            legend={[
              { label: 'Vendidas', color: CHART_COLORS[1]! },
              { label: 'RMAs', color: CHART_COLORS[6]! },
            ]}
          >
            <MultiLine
              data={a.monthly}
              xKey="month"
              series={[
                { key: 'sold', label: 'Vendidas', color: CHART_COLORS[1] },
                { key: 'rma', label: 'RMAs', color: CHART_COLORS[6] },
              ]}
            />
          </ChartFrame>

          <div className="mb-6 grid gap-4 lg:grid-cols-2">
            <ChartFrame title="Motivos de RMA" subtitle="Distribución de los problemas reportados" height={260}>
              <Donut data={a.reasons} nameKey="reason" valueKey="count" formatter={(v) => `${v} casos`} />
            </ChartFrame>

            <ChartFrame title="Resultado de los casos cerrados" subtitle="Cómo se resolvieron" height={260}>
              <Bars
                data={a.outcomes.map((o) => ({ label: o.outcome, count: o.count }))}
                xKey="label"
                yKey="count"
                horizontal
                colorByIndex={(_, i) => CHART_COLORS[i % CHART_COLORS.length]!}
                formatter={(v) => `${v} casos`}
              />
            </ChartFrame>
          </div>

          {/* ---------- tablas ---------- */}
          <div className="grid gap-5 lg:grid-cols-2">
            <section>
              <SectionTitle title="SKUs con mayor tasa de RMA" subtitle="Ordenados por tasa, no por volumen" />
              <DataTable
                columns={skuColumns}
                rows={a.topSkus}
                rowKey={(r) => r.sku}
                dense
                empty={<EmptyState compact title="Sin casos registrados para esta marca" icon={<Wrench className="size-5" />} />}
              />
            </section>

            <section>
              <SectionTitle title="Motivos en detalle" subtitle="Participación sobre el total de casos" />
              <Card>
                <ul className="divide-y divide-ink-100">
                  {a.reasons.map((reason, i) => (
                    <li key={reason.reason} className="flex items-center justify-between gap-3 px-4 py-3">
                      <span className="flex min-w-0 items-center gap-2.5">
                        <span
                          className="size-2.5 shrink-0 rounded-full"
                          style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                          aria-hidden
                        />
                        <span className="truncate text-[13px] text-ink-800">{reason.reason}</span>
                      </span>
                      <span className="shrink-0 text-[13px] tabular-nums text-ink-600">
                        {reason.count} <span className="text-ink-400">({reason.pct}%)</span>
                      </span>
                    </li>
                  ))}
                  {a.reasons.length === 0 && (
                    <li className="py-6">
                      <EmptyState compact title="Sin motivos registrados" icon={<Wrench className="size-5" />} />
                    </li>
                  )}
                </ul>
              </Card>
            </section>
          </div>

          {/* ---------- lotes ---------- */}
          <section className="mt-6">
            <SectionTitle
              title="Lotes de la marca"
              subtitle="La tasa por lote permite aislar problemas de fabricación"
              action={
                <Link to="/bo/rma/lotes" className="text-[13px] font-medium text-ashir-600 hover:text-ashir-700">
                  Ver todos los lotes
                </Link>
              }
            />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {a.lots.slice(0, 8).map((lot) => (
                <Link key={lot.lotId} to={`/bo/rma/lotes/${lot.code}`}>
                  <Card interactive className={cn('h-full p-4', lot.incidentSuspected && 'border-bad-200')}>
                    <div className="flex items-start justify-between gap-2">
                      <Mono>{lot.code}</Mono>
                      {lot.incidentSuspected && (
                        <Badge tone="bad" size="sm">
                          Incidencia
                        </Badge>
                      )}
                    </div>
                    <p
                      className={cn(
                        'mt-2 text-lg font-semibold tabular-nums',
                        lot.incidentSuspected ? 'text-bad-600' : 'text-ink-900',
                      )}
                    >
                      {lot.ratePct}%
                    </p>
                    <p className="text-xs text-ink-500">tasa de RMA del lote</p>
                  </Card>
                </Link>
              ))}
              {a.lots.length === 0 && (
                <Card className="sm:col-span-2 lg:col-span-4">
                  <EmptyState compact title="Sin lotes registrados para esta marca" icon={<Boxes className="size-5" />} />
                </Card>
              )}
            </div>
          </section>

          <Card className="mt-6">
            <CardHeader title="Cómo leer esta pantalla" />
            <p className="px-5 py-4 text-[13px] leading-relaxed text-ink-600">
              La tasa de RMA se calcula como casos de garantía sobre unidades vendidas del período. Un SKU con una tasa
              dos veces superior al promedio de su marca se marca como alerta: suele indicar un problema de
              fabricación o de un lote puntual, no de uso. El paso siguiente es abrir el lote, ver los seriales
              afectados y escalar al fabricante con evidencia.
            </p>
          </Card>
        </>
      )}
    </div>
  );
}
