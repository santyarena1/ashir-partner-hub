/**
 * Centro de integraciones.
 *
 * El ERP de Ashir todavía no está definido: su adaptador figura explícitamente
 * como pendiente. Ninguna integración de esta pantalla está conectada a un
 * sistema productivo.
 */
import { Link } from 'react-router-dom';
import {
  Bell,
  Boxes,
  Database,
  FileText,
  Plug,
  RefreshCw,
  Server,
  Tag,
  Truck,
  Wrench,
} from 'lucide-react';
import type { Integration } from '@/types';
import { api } from '@/services';
import { useAction, useAsync } from '@/app/hooks';
import { useToast } from '@/components/ui/overlays';
import { DIRECTION_LABEL, FREQUENCY_LABEL } from '@/lib/labels';
import { cn, fmtDateTime, fmtNumber, fmtRelative } from '@/lib/utils';
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
import { IntegrationStatusBadge } from '@/components/domain/common';
import type { IntegrationRun } from '@/types';

const KIND_ICON: Record<Integration['kind'], typeof Plug> = {
  ERP: Database,
  CONNECTOR: Server,
  STOCK: Boxes,
  PRICING: Tag,
  BILLING: FileText,
  LOGISTICS: Truck,
  RMA: Wrench,
  NOTIFICATIONS: Bell,
};

export function BoIntegrations() {
  const toast = useToast();
  const integrations = useAsync(() => api.integrations.list(), []);
  /** Ejecuciones de todos los conectores, unificadas en una sola línea de tiempo. */
  const allRuns = useAsync(async () => {
    const list = await api.integrations.list();
    const results = await Promise.all(list.map((i) => api.integrations.runs(i.id)));
    return results.flat().sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }, []);
  const sync = useAction((id: string) => api.integrations.sync(id));

  const list = integrations.data ?? [];
  const operational = list.filter((i) => i.status === 'OPERATIONAL');
  const withErrors = list.filter((i) => i.errorCount > 0);

  const runColumns: Column<IntegrationRun>[] = [
    {
      key: 'at',
      header: 'Fecha',
      cell: (r) => <span className="text-xs text-ink-600">{fmtDateTime(r.at)}</span>,
      sortable: true,
      sortValue: (r) => new Date(r.at).getTime(),
    },
    {
      key: 'integration',
      header: 'Integración',
      cell: (r) => {
        const integration = list.find((i) => i.id === r.integrationId);
        return (
          <Link
            to={r.integrationId === 'int_nodo' ? '/bo/integraciones/nodo' : `/bo/integraciones/${r.integrationId}`}
            className="text-[13px] font-medium text-ashir-600 hover:text-ashir-700"
          >
            {integration?.name ?? r.integrationId}
          </Link>
        );
      },
    },
    { key: 'process', header: 'Proceso', cell: (r) => <span className="text-ink-800">{r.process}</span> },
    {
      key: 'direction',
      header: 'Dirección',
      hideOnMobile: true,
      cell: (r) => <span className="text-xs text-ink-600">{DIRECTION_LABEL[r.direction]}</span>,
    },
    {
      key: 'records',
      header: 'Registros',
      align: 'right',
      cell: (r) => <span className="tabular-nums text-ink-700">{fmtNumber(r.records)}</span>,
      sortable: true,
      sortValue: (r) => r.records,
    },
    {
      key: 'duration',
      header: 'Duración',
      align: 'right',
      hideOnMobile: true,
      cell: (r) => <span className="tabular-nums text-ink-500">{(r.durationMs / 1000).toFixed(1)}s</span>,
    },
    {
      key: 'result',
      header: 'Resultado',
      cell: (r) => (
        <Badge tone={r.result === 'SUCCESS' ? 'ok' : r.result === 'WARNING' ? 'warn' : 'bad'} size="sm" dot>
          {r.result === 'SUCCESS' ? 'Exitoso' : r.result === 'WARNING' ? 'Con advertencias' : 'Fallido'}
        </Badge>
      ),
    },
    {
      key: 'request',
      header: 'Request ID',
      align: 'right',
      hideOnMobile: true,
      cell: (r) => <Mono>{r.requestId}</Mono>,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Integraciones"
        subtitle="Estado de los flujos de datos entre el Partner Hub y los sistemas de Ashir. Ninguno está conectado a un entorno productivo."
      />

      <Callout tone="tech" className="mb-6" title="El ERP de Ashir todavía no está definido">
        No sabemos qué sistema de gestión usa la empresa ni con qué protocolo expone sus datos. El contrato de
        integración está diseñado para tolerar cualquiera de las variantes posibles: API REST, intercambio de archivos,
        procesos batch o eventos. El adaptador se define cuando se conozca el sistema.
      </Callout>

      <StatGrid cols={4} className="mb-6">
        <StatTile label="Integraciones" value={list.length} icon={<Plug className="size-4" />} />
        <StatTile label="Operativas" value={operational.length} tone="ok" />
        <StatTile
          label="Con errores"
          value={withErrors.length}
          tone={withErrors.length > 0 ? 'bad' : 'ok'}
          footer={`${list.reduce((a, i) => a + i.errorCount, 0)} errores acumulados`}
        />
        <StatTile
          label="Registros procesados"
          value={fmtNumber(list.reduce((a, i) => a + i.recordsProcessed, 0))}
          footer="En las últimas ejecuciones"
        />
      </StatGrid>

      {/* ---------- arquitectura ---------- */}
      <Card className="mb-6">
        <CardHeader title="Arquitectura de integración" subtitle="El portal nunca accede directamente a la base del ERP" />
        <div className="flex flex-wrap items-center justify-center gap-3 px-5 py-8">
          {['Ashir Partner Hub', 'Integration API', 'ERP Ashir'].map((node, i, arr) => (
            <div key={node} className="flex items-center gap-3">
              <div
                className={cn(
                  'rounded-xl border px-5 py-3.5 text-center',
                  i === 0
                    ? 'border-ashir-200 bg-ashir-50'
                    : i === 1
                      ? 'border-tech-200 bg-tech-50'
                      : 'border-ink-200 bg-ink-50 border-dashed',
                )}
              >
                <p className="text-[13px] font-semibold text-ink-900">{node}</p>
                <p className="mt-0.5 text-[11px] text-ink-500">
                  {i === 0 ? 'Portal B2B' : i === 1 ? 'Contrato versionado /v1' : 'Sistema a definir'}
                </p>
              </div>
              {i < arr.length - 1 && <span className="text-ink-300">→</span>}
            </div>
          ))}
        </div>
        <p className="border-t border-ink-100 px-5 py-3 text-xs leading-relaxed text-ink-500">
          La Integration API aísla al portal del sistema de gestión: si el ERP cambia, se reemplaza el adaptador sin
          tocar el frontend ni los contratos públicos.
        </p>
      </Card>

      {/* ---------- tarjetas ---------- */}
      <SectionTitle title="Conectores" subtitle="Estado, entidades sincronizadas y última ejecución" />
      {integrations.error ? (
        <Card>
          <ErrorState description={integrations.error.message} onRetry={integrations.refetch} />
        </Card>
      ) : integrations.initialLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-56 w-full rounded-card" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((integration) => {
            const Icon = KIND_ICON[integration.kind];
            const href = integration.id === 'int_nodo' ? '/bo/integraciones/nodo' : `/bo/integraciones/${integration.id}`;
            return (
              <Card
                key={integration.id}
                className={cn('flex flex-col', integration.featured && 'border-ashir-300 ring-1 ring-ashir-100')}
              >
                <div className="flex items-start justify-between gap-3 p-4">
                  <div className="flex min-w-0 items-start gap-2.5">
                    <span
                      className={cn(
                        'flex size-9 shrink-0 items-center justify-center rounded-lg',
                        integration.featured ? 'bg-ashir-50 text-ashir-600' : 'bg-ink-100 text-ink-500',
                      )}
                    >
                      <Icon className="size-4.5" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <h3 className="flex flex-wrap items-center gap-2 text-[14px] font-semibold text-ink-900">
                        {integration.name}
                        {integration.featured && (
                          <Badge tone="brand" size="sm">
                            Destacada
                          </Badge>
                        )}
                      </h3>
                      <p className="mt-0.5 text-[11px] text-ink-400">{integration.adapter}</p>
                    </div>
                  </div>
                  <IntegrationStatusBadge status={integration.status} size="sm" />
                </div>

                <p className="line-clamp-3 px-4 text-[13px] leading-relaxed text-ink-500">{integration.description}</p>

                <dl className="mt-3 space-y-1 border-t border-ink-100 px-4 pt-3 text-[12px]">
                  <div className="flex justify-between gap-2">
                    <dt className="text-ink-500">Última sincronización</dt>
                    <dd className="font-medium text-ink-800">
                      {integration.lastSyncAt ? fmtRelative(integration.lastSyncAt) : 'Nunca'}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-ink-500">Frecuencia</dt>
                    <dd className="text-ink-700">{FREQUENCY_LABEL[integration.frequency]}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-ink-500">Entidades activas</dt>
                    <dd className="tabular-nums text-ink-700">
                      {integration.entities.filter((e) => e.enabled).length} de {integration.entities.length}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-ink-500">Errores</dt>
                    <dd className={cn('tabular-nums', integration.errorCount > 0 ? 'font-medium text-bad-600' : 'text-ink-700')}>
                      {integration.errorCount}
                    </dd>
                  </div>
                </dl>

                <div className="mt-auto flex gap-2 p-4 pt-3">
                  <Link to={href} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full">
                      Ver detalle
                    </Button>
                  </Link>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<RefreshCw className={cn('size-3.5', sync.pending && 'animate-spin')} />}
                    onClick={async () => {
                      const result = await sync.run(integration.id);
                      if (result) {
                        toast.success(
                          `${integration.name} sincronizada`,
                          `${fmtNumber(result.records)} registros procesados.`,
                        );
                        allRuns.refetch();
                        integrations.refetch();
                      } else if (sync.error) {
                        toast.error(`No pudimos sincronizar ${integration.name}`, sync.error.message);
                      }
                    }}
                  >
                    Sincronizar
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* ---------- ejecuciones ---------- */}
      <section className="mt-8">
        <SectionTitle
          title="Actividad reciente"
          subtitle="Últimas ejecuciones de todos los conectores"
          action={
            <Link to="/bo/webhooks" className="text-[13px] font-medium text-ashir-600 hover:text-ashir-700">
              Ver webhooks
            </Link>
          }
        />
        <DataTable
          columns={runColumns}
          rows={(allRuns.data ?? []).slice(0, 20)}
          rowKey={(r) => r.id}
          loading={allRuns.initialLoading}
          dense
          empty={<EmptyState title="Sin ejecuciones registradas" icon={<RefreshCw className="size-5" />} />}
        />
      </section>
    </div>
  );
}
