/**
 * Detalle de un lote: seriales afectados, motivos y acciones sugeridas.
 */
import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, Boxes, Factory, Megaphone, Package, Tag } from 'lucide-react';
import { api } from '@/services';
import { useSession } from '@/app/session';
import { useAsync } from '@/app/hooks';
import { useToast } from '@/components/ui/overlays';
import { CHART_COLORS } from '@/lib/labels';
import { cn, fmtDate, fmtNumber } from '@/lib/utils';
import { Badge, Button, Card, CardHeader, ProgressBar, Skeleton } from '@/components/ui/primitives';
import {
  Callout,
  DataRow,
  EmptyState,
  ErrorState,
  Mono,
  PageHeader,
  SectionTitle,
  StatGrid,
  StatTile,
} from '@/components/ui/data';
import { Bars, ChartFrame } from '@/components/ui/charts';
import { RmaStatusBadge, brandColor } from '@/components/domain/common';

export function RmaLotDetail() {
  const { code = '' } = useParams();
  const { session } = useSession();
  const toast = useToast();

  const lot = useAsync(() => api.rma.getLot(code), [code]);
  const cases = useAsync(() => api.rma.listCases({}, session), [session.role]);

  if (lot.error) {
    return (
      <Card>
        <ErrorState title="No encontramos el lote" description={lot.error.message} onRetry={lot.refetch} />
      </Card>
    );
  }
  if (lot.initialLoading || !lot.data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full rounded-card" />
      </div>
    );
  }

  const l = lot.data;
  const ratio = Number.parseFloat(l.rmaRatePct) / Math.max(0.01, Number.parseFloat(l.brandAverageRatePct));
  const sellThrough = (l.unitsSold / Math.max(1, l.unitsImported)) * 100;

  /* Casos abiertos que involucran seriales de este lote. */
  const relatedCases = (cases.data ?? []).filter((c) => c.units.some((u) => u.lotId === l.code));

  return (
    <div>
      <PageHeader
        breadcrumbs={[
          { label: 'Centro de RMA', href: '/bo/rma' },
          { label: 'Lotes', href: '/bo/rma/lotes' },
          { label: l.code },
        ]}
        title={l.code}
        subtitle={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm" style={{ background: brandColor(l.brand) }} aria-hidden />
              {l.brand}
            </span>
            <span>·</span>
            <span>{l.productName}</span>
            <span>·</span>
            <Mono>{l.sku}</Mono>
            <span>·</span>
            <span>Importado el {fmtDate(l.importedAt)}</span>
          </span>
        }
        badge={
          l.incidentSuspected ? (
            <Badge tone="bad" dot>
              Incidencia detectada
            </Badge>
          ) : (
            <Badge tone="ok" dot>
              Comportamiento normal
            </Badge>
          )
        }
        actions={
          <>
            <Link to="/bo/condiciones">
              <Button variant="outline" icon={<Tag className="size-4" />}>
                Crear promoción
              </Button>
            </Link>
            <Button
              icon={<Factory className="size-4" />}
              onClick={() => toast.simulated('El escalamiento del lote al fabricante')}
            >
              Escalar al fabricante
            </Button>
          </>
        }
      />

      {l.incidentSuspected && (
        <Callout tone="bad" icon={<AlertTriangle className="size-4" />} title="Posible incidencia de lote" className="mb-5">
          {l.note}
        </Callout>
      )}

      <StatGrid cols={5} className="mb-6">
        <StatTile label="Unidades importadas" value={fmtNumber(l.unitsImported)} icon={<Package className="size-4" />} />
        <StatTile
          label="Vendidas"
          value={fmtNumber(l.unitsSold)}
          footer={<ProgressBar value={sellThrough} tone="ok" showLabel />}
        />
        <StatTile label="Casos de RMA" value={fmtNumber(l.rmaCount)} icon={<Boxes className="size-4" />} />
        <StatTile
          label="Tasa del lote"
          value={`${l.rmaRatePct}%`}
          tone={l.incidentSuspected ? 'bad' : 'ok'}
          footer={`Promedio de la marca: ${l.brandAverageRatePct}%`}
        />
        <StatTile
          label="Desvío"
          value={`${ratio.toFixed(1).replace('.', ',')}×`}
          tone={ratio >= 2 ? 'bad' : ratio >= 1.4 ? 'warn' : 'ok'}
          footer="Respecto del promedio de la marca"
        />
      </StatGrid>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-5">
          <ChartFrame title="Motivos de falla del lote" subtitle="Distribución de los casos reportados" height={240}>
            <Bars
              data={l.commonReasons.map((r) => ({ label: r.reason, count: r.count }))}
              xKey="label"
              yKey="count"
              horizontal
              colorByIndex={(_, i) => CHART_COLORS[i % CHART_COLORS.length]!}
              formatter={(v) => `${v} casos`}
            />
          </ChartFrame>

          <Card>
            <CardHeader
              title="Seriales afectados"
              subtitle={`${l.affectedSerials.length} unidades del lote con un caso de garantía registrado`}
            />
            <div className="p-5">
              {l.affectedSerials.length === 0 ? (
                <EmptyState compact title="Sin seriales afectados" icon={<Boxes className="size-5" />} />
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {l.affectedSerials.map((serial) => (
                    <Link key={serial} to={`/bo/rma?q=${serial}`}>
                      <Mono className="transition-colors hover:bg-ashir-50 hover:text-ashir-700">{serial}</Mono>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </Card>

          <section>
            <SectionTitle title="Casos abiertos del lote" subtitle={`${relatedCases.length} gestiones asociadas`} />
            <Card>
              {relatedCases.length === 0 ? (
                <EmptyState compact title="Sin casos asociados" icon={<Boxes className="size-5" />} />
              ) : (
                <ul className="divide-y divide-ink-100">
                  {relatedCases.slice(0, 10).map((c) => (
                    <li key={c.id}>
                      <Link to={`/bo/rma/${c.id}`} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-ink-50">
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold text-ink-900">{c.code}</p>
                          <p className="mt-0.5 truncate text-[11px] text-ink-500">
                            {c.customerName} · {c.units.filter((u) => u.lotId === l.code).length} unidad(es) del lote
                          </p>
                        </div>
                        <RmaStatusBadge status={c.status} size="sm" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </section>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Datos del lote" />
            <div className="space-y-0.5 p-5">
              <DataRow label="Código" value={<Mono copy>{l.code}</Mono>} />
              <DataRow label="Marca" value={l.brand} />
              <DataRow label="SKU" value={<Mono>{l.sku}</Mono>} />
              <DataRow label="Producto" value={l.productName} />
              <DataRow label="Fecha de importación" value={fmtDate(l.importedAt)} />
              <DataRow label="Sell-through" value={`${sellThrough.toFixed(0)}%`} emphasis />
              <DataRow label="Stock remanente" value={fmtNumber(l.unitsImported - l.unitsSold)} />
            </div>
          </Card>

          <Card>
            <CardHeader title="Motivos más frecuentes" />
            <ul className="divide-y divide-ink-100 px-5">
              {l.commonReasons.map((reason, i) => (
                <li key={reason.reason} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                      aria-hidden
                    />
                    <span className="truncate text-[13px] text-ink-700">{reason.reason}</span>
                  </span>
                  <span className="shrink-0 text-[13px] font-medium tabular-nums">{reason.count}</span>
                </li>
              ))}
            </ul>
          </Card>

          {l.incidentSuspected && (
            <Card className="border-bad-200">
              <CardHeader title="Acciones sugeridas" icon={<Megaphone className="size-4" />} />
              <ul className="space-y-2.5 p-5 text-[13px] text-ink-700">
                {[
                  'Pausar la venta del remanente hasta tener respuesta del fabricante.',
                  'Escalar el caso con el detalle de seriales y los informes técnicos.',
                  'Avisar proactivamente a los resellers que compraron unidades del lote.',
                  'Revisar si conviene un recall preventivo o un reemplazo anticipado.',
                ].map((action) => (
                  <li key={action} className="flex gap-2">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-bad-500" aria-hidden />
                    {action}
                  </li>
                ))}
              </ul>
              <div className="border-t border-ink-100 px-5 py-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => toast.simulated('El aviso masivo a los resellers del lote')}
                >
                  Avisar a los resellers afectados
                </Button>
              </div>
            </Card>
          )}

          <Callout tone="neutral" className={cn(!l.incidentSuspected && 'mt-0')}>
            La trazabilidad por lote se apoya en la relación serial → lote registrada en el ingreso de mercadería. En
            producción esa relación vendría del ERP o del proceso de recepción de importación.
          </Callout>
        </div>
      </div>
    </div>
  );
}
