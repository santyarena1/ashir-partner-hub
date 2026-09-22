/**
 * Lotes de importación con su tasa de RMA.
 */
import { Link } from 'react-router-dom';
import { AlertTriangle, Boxes } from 'lucide-react';
import type { RmaLot } from '@/types';
import { api } from '@/services';
import { useAsync } from '@/app/hooks';
import { cn, fmtDate, fmtNumber } from '@/lib/utils';
import { Badge, Card } from '@/components/ui/primitives';
import {
  Callout,
  DataTable,
  EmptyState,
  ErrorState,
  Mono,
  PageHeader,
  StatGrid,
  StatTile,
  type Column,
} from '@/components/ui/data';
import { brandColor } from '@/components/domain/common';

export function RmaLotsPage() {
  const { data, initialLoading, error, refetch } = useAsync(() => api.rma.listLots(), []);

  const lots = data ?? [];
  const incidents = lots.filter((l) => l.incidentSuspected);

  const columns: Column<RmaLot>[] = [
    {
      key: 'code',
      header: 'Lote',
      cell: (lot) => (
        <div className="flex items-center gap-2.5">
          <span className="size-2.5 shrink-0 rounded-sm" style={{ background: brandColor(lot.brand) }} aria-hidden />
          <div className="min-w-0">
            <Link to={`/bo/rma/lotes/${lot.code}`} className="text-[13px] font-semibold text-ashir-600 hover:text-ashir-700">
              {lot.code}
            </Link>
            <p className="truncate text-[11px] text-ink-400">{lot.productName}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'brand',
      header: 'Marca',
      hideOnMobile: true,
      cell: (lot) => <span className="text-ink-700">{lot.brand}</span>,
      sortable: true,
      sortValue: (l) => l.brand,
    },
    {
      key: 'imported',
      header: 'Importado',
      hideOnMobile: true,
      cell: (lot) => <span className="text-xs text-ink-600">{fmtDate(lot.importedAt)}</span>,
      sortable: true,
      sortValue: (l) => new Date(l.importedAt).getTime(),
    },
    {
      key: 'units',
      header: 'Importadas / vendidas',
      align: 'right',
      cell: (lot) => (
        <span className="tabular-nums text-ink-600">
          {fmtNumber(lot.unitsImported)} / <span className="font-medium text-ink-900">{fmtNumber(lot.unitsSold)}</span>
        </span>
      ),
      sortable: true,
      sortValue: (l) => l.unitsSold,
    },
    {
      key: 'rma',
      header: 'RMAs',
      align: 'right',
      cell: (lot) => <span className="font-medium tabular-nums">{lot.rmaCount}</span>,
      sortable: true,
      sortValue: (l) => l.rmaCount,
    },
    {
      key: 'rate',
      header: 'Tasa del lote',
      align: 'right',
      cell: (lot) => (
        <div>
          <span className={cn('font-semibold tabular-nums', lot.incidentSuspected ? 'text-bad-600' : 'text-ink-800')}>
            {lot.rmaRatePct}%
          </span>
          <p className="text-[11px] text-ink-400">marca {lot.brandAverageRatePct}%</p>
        </div>
      ),
      sortable: true,
      sortValue: (l) => Number.parseFloat(l.rmaRatePct),
    },
    {
      key: 'status',
      header: 'Estado',
      cell: (lot) =>
        lot.incidentSuspected ? (
          <Badge tone="bad" dot size="sm">
            Incidencia detectada
          </Badge>
        ) : (
          <Badge tone="ok" dot size="sm">
            Normal
          </Badge>
        ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Lotes de importación"
        subtitle="La trazabilidad por lote permite distinguir una falla aislada de un problema de fabricación."
      />

      {incidents.length > 0 && (
        <Callout
          tone="bad"
          icon={<AlertTriangle className="size-4" />}
          title={`${incidents.length} lote(s) con incidencia detectada`}
          className="mb-5"
        >
          {incidents[0]!.code} presenta una tasa de RMA de {incidents[0]!.rmaRatePct}% contra un promedio de marca de{' '}
          {incidents[0]!.brandAverageRatePct}%. {incidents[0]!.note}
        </Callout>
      )}

      <StatGrid cols={4} className="mb-6">
        <StatTile label="Lotes registrados" value={lots.length} icon={<Boxes className="size-4" />} />
        <StatTile
          label="Unidades importadas"
          value={fmtNumber(lots.reduce((a, l) => a + l.unitsImported, 0))}
          footer={`${fmtNumber(lots.reduce((a, l) => a + l.unitsSold, 0))} vendidas`}
        />
        <StatTile label="RMAs totales" value={lots.reduce((a, l) => a + l.rmaCount, 0)} />
        <StatTile
          label="Con incidencia"
          value={incidents.length}
          tone={incidents.length > 0 ? 'bad' : 'ok'}
          footer="Tasa muy por encima del promedio de la marca"
        />
      </StatGrid>

      {error ? (
        <Card>
          <ErrorState description={error.message} onRetry={refetch} />
        </Card>
      ) : (
        <DataTable
          columns={columns}
          rows={lots}
          rowKey={(l) => l.id}
          loading={initialLoading}
          dense
          empty={<EmptyState title="Sin lotes registrados" icon={<Boxes className="size-5" />} />}
          mobileCard={(lot) => (
            <div>
              <div className="flex items-start justify-between gap-2">
                <Link to={`/bo/rma/lotes/${lot.code}`} className="text-[13px] font-semibold text-ashir-600">
                  <Mono>{lot.code}</Mono>
                </Link>
                {lot.incidentSuspected && (
                  <Badge tone="bad" size="sm">
                    Incidencia
                  </Badge>
                )}
              </div>
              <p className="mt-1 truncate text-xs text-ink-600">{lot.productName}</p>
              <p className="mt-1 text-xs tabular-nums text-ink-500">
                {lot.rmaCount} RMAs · tasa {lot.rmaRatePct}%
              </p>
            </div>
          )}
        />
      )}
    </div>
  );
}
