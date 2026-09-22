/**
 * Detalle genérico de una integración.
 */
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeftRight, ArrowRight, RefreshCw, Server, Settings2, Zap } from 'lucide-react';
import type { IntegrationRun } from '@/types';
import { api } from '@/services';
import { useAction, useAsync } from '@/app/hooks';
import { useToast, Dialog } from '@/components/ui/overlays';
import { DIRECTION_LABEL, FREQUENCY_LABEL } from '@/lib/labels';
import { cn, fmtDateTime, fmtNumber, fmtRelative } from '@/lib/utils';
import { Badge, Button, Card, CardHeader, Skeleton } from '@/components/ui/primitives';
import {
  Callout,
  DataRow,
  DataTable,
  EmptyState,
  ErrorState,
  JsonViewer,
  Mono,
  PageHeader,
  SectionTitle,
  StatGrid,
  StatTile,
  type Column,
} from '@/components/ui/data';
import { IntegrationStatusBadge } from '@/components/domain/common';

export function BoIntegrationDetail() {
  const { id = '' } = useParams();
  const toast = useToast();
  const [selectedRun, setSelectedRun] = useState<IntegrationRun | null>(null);

  const integration = useAsync(() => api.integrations.get(id), [id]);
  const runs = useAsync(() => api.integrations.runs(id), [id]);
  const sync = useAction(() => api.integrations.sync(id));
  const test = useAction(() => api.integrations.testConnection(id));

  if (integration.error) {
    return (
      <Card>
        <ErrorState title="No encontramos la integración" description={integration.error.message} onRetry={integration.refetch} />
      </Card>
    );
  }
  if (integration.initialLoading || !integration.data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full rounded-card" />
      </div>
    );
  }

  const i = integration.data;
  const notConfigured = i.status === 'NOT_CONFIGURED';

  const runColumns: Column<IntegrationRun>[] = [
    { key: 'at', header: 'Fecha', cell: (r) => <span className="text-xs text-ink-600">{fmtDateTime(r.at)}</span> },
    { key: 'process', header: 'Proceso', cell: (r) => <span className="font-medium text-ink-900">{r.process}</span> },
    {
      key: 'direction',
      header: 'Dirección',
      hideOnMobile: true,
      cell: (r) => (
        <span className="inline-flex items-center gap-1.5 text-xs text-ink-600">
          {r.direction === 'BIDIRECTIONAL' ? (
            <ArrowLeftRight className="size-3.5" aria-hidden />
          ) : (
            <ArrowRight className={cn('size-3.5', r.direction === 'INBOUND' && 'rotate-180')} aria-hidden />
          )}
          {DIRECTION_LABEL[r.direction]}
        </span>
      ),
    },
    {
      key: 'records',
      header: 'Registros',
      align: 'right',
      cell: (r) => <span className="tabular-nums text-ink-700">{fmtNumber(r.records)}</span>,
    },
    {
      key: 'result',
      header: 'Resultado',
      cell: (r) => (
        <Badge tone={r.result === 'SUCCESS' ? 'ok' : r.result === 'WARNING' ? 'warn' : 'bad'} size="sm" dot>
          {r.result === 'SUCCESS' ? 'Exitoso' : r.result === 'WARNING' ? 'Advertencias' : 'Fallido'}
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
    {
      key: 'detail',
      header: '',
      align: 'right',
      width: '90px',
      cell: (r) => (
        <button type="button" onClick={() => setSelectedRun(r)} className="text-[13px] font-medium text-ashir-600 hover:text-ashir-700">
          Detalle
        </button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'Integraciones', href: '/bo/integraciones' }, { label: i.name }]}
        title={i.name}
        subtitle={i.description}
        badge={
          <span className="flex flex-wrap items-center gap-2">
            <IntegrationStatusBadge status={i.status} />
            <Badge tone="neutral">Modo {i.mode.toLowerCase()}</Badge>
          </span>
        }
        actions={
          <>
            <Button
              variant="outline"
              icon={<Zap className="size-4" />}
              loading={test.pending}
              onClick={async () => {
                const result = await test.run();
                if (result?.ok) toast.success('Conexión establecida', `${result.message} (${result.latencyMs} ms)`);
                else if (result) toast.warning('Sin conexión', result.message);
              }}
            >
              Probar conexión
            </Button>
            <Button
              icon={<RefreshCw className={cn('size-4', sync.pending && 'animate-spin')} />}
              loading={sync.pending}
              disabled={notConfigured}
              onClick={async () => {
                const result = await sync.run();
                if (result) {
                  toast.success('Sincronización completada', `${fmtNumber(result.records)} registros procesados.`);
                  runs.refetch();
                  integration.refetch();
                } else if (sync.error) {
                  toast.error('La sincronización falló', sync.error.message);
                }
              }}
            >
              Sincronizar ahora
            </Button>
          </>
        }
      />

      {notConfigured && (
        <Callout tone="warn" className="mb-6" title="Adaptador pendiente de definición">
          Esta integración no está configurada porque todavía no se conoce el sistema del otro extremo. El contrato ya
          está previsto: cuando se defina el ERP, se implementa el adaptador sin tocar el resto del portal.
        </Callout>
      )}

      <StatGrid cols={4} className="mb-6">
        <StatTile
          label="Última sincronización"
          value={i.lastSyncAt ? fmtRelative(i.lastSyncAt) : 'Nunca'}
          icon={<RefreshCw className="size-4" />}
          footer={i.nextSyncAt ? `Próxima ${fmtRelative(i.nextSyncAt)}` : FREQUENCY_LABEL[i.frequency]}
        />
        <StatTile label="Registros procesados" value={fmtNumber(i.recordsProcessed)} icon={<Server className="size-4" />} />
        <StatTile
          label="Errores"
          value={i.errorCount}
          tone={i.errorCount > 0 ? 'bad' : 'ok'}
          footer={`${i.retryCount} reintentos`}
        />
        <StatTile
          label="Entidades activas"
          value={`${i.entities.filter((e) => e.enabled).length} de ${i.entities.length}`}
        />
      </StatGrid>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-5">
          <Card>
            <CardHeader title="Entidades" subtitle="Qué datos viajan, en qué dirección y con qué frecuencia" />
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b border-ink-200 bg-ink-50">
                    <th className="px-5 py-2 font-medium text-ink-500">Entidad</th>
                    <th className="px-5 py-2 font-medium text-ink-500">Dirección</th>
                    <th className="px-5 py-2 text-right font-medium text-ink-500">Registros</th>
                    <th className="px-5 py-2 text-right font-medium text-ink-500">Actualizado</th>
                    <th className="px-5 py-2 font-medium text-ink-500">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {i.entities.map((entity) => (
                    <tr key={entity.key} className={cn(!entity.enabled && 'opacity-55')}>
                      <td className="px-5 py-2.5">
                        <span className="font-medium text-ink-900">{entity.label}</span>
                        {!entity.enabled && (
                          <Badge tone="neutral" size="sm" className="ml-2">
                            Inactiva
                          </Badge>
                        )}
                      </td>
                      <td className="px-5 py-2.5 text-xs text-ink-600">{DIRECTION_LABEL[entity.direction]}</td>
                      <td className="px-5 py-2.5 text-right tabular-nums text-ink-700">{fmtNumber(entity.records)}</td>
                      <td className="px-5 py-2.5 text-right text-xs text-ink-500">
                        {entity.lastUpdatedAt ? fmtRelative(entity.lastUpdatedAt) : '—'}
                      </td>
                      <td className="px-5 py-2.5">
                        <IntegrationStatusBadge status={entity.status} size="sm" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <section>
            <SectionTitle title="Historial de ejecuciones" />
            <DataTable
              columns={runColumns}
              rows={runs.data ?? []}
              rowKey={(r) => r.id}
              loading={runs.initialLoading}
              dense
              empty={
                <EmptyState
                  title="Sin ejecuciones registradas"
                  description={notConfigured ? 'La integración todavía no tiene un adaptador definido.' : undefined}
                  icon={<RefreshCw className="size-5" />}
                />
              }
            />
          </section>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Configuración" icon={<Settings2 className="size-4" />} />
            <div className="space-y-0.5 p-5">
              <DataRow label="Adaptador" value={i.adapter} />
              <DataRow label="Modo" value={i.mode} />
              <DataRow label="Ambiente" value={i.environment} />
              <DataRow label="Frecuencia" value={FREQUENCY_LABEL[i.frequency]} />
              {i.maskedConfig.map((item) => (
                <DataRow
                  key={item.key}
                  label={item.key}
                  value={<span className={item.secret ? 'font-mono text-[12px] text-ink-500' : ''}>{item.value}</span>}
                />
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="Flujo de datos" />
            <div className="p-5">
              <ol className="space-y-2">
                {i.architecture.map((node, index) => (
                  <li key={node} className="flex items-center gap-2.5">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-ink-100 text-[11px] font-bold text-ink-600">
                      {index + 1}
                    </span>
                    <span className="text-[13px] text-ink-800">{node}</span>
                  </li>
                ))}
              </ol>
            </div>
          </Card>

          <Link to="/bo/integraciones" className="block">
            <Button variant="outline" className="w-full">
              Volver a integraciones
            </Button>
          </Link>
        </div>
      </div>

      <Dialog
        open={selectedRun !== null}
        onClose={() => setSelectedRun(null)}
        title={selectedRun ? `Ejecución · ${selectedRun.process}` : ''}
        description={selectedRun ? fmtDateTime(selectedRun.at) : undefined}
        size="lg"
        footer={
          <Button variant="outline" onClick={() => setSelectedRun(null)}>
            Cerrar
          </Button>
        }
      >
        {selectedRun && (
          <div className="space-y-4">
            <div className="space-y-0.5 rounded-lg border border-ink-200 px-3.5 py-3">
              <DataRow label="Registros" value={fmtNumber(selectedRun.records)} emphasis />
              <DataRow label="Duración" value={`${(selectedRun.durationMs / 1000).toFixed(1)} s`} />
              <DataRow label="Resultado" value={selectedRun.result} />
              <DataRow label="Request ID" value={<Mono copy>{selectedRun.requestId}</Mono>} />
              <DataRow label="Resumen" value={selectedRun.summary} />
            </div>
            {selectedRun.errors.length > 0 && (
              <Callout tone="bad" title="Errores">
                {selectedRun.errors.join(' · ')}
              </Callout>
            )}
            {selectedRun.warnings.length > 0 && (
              <Callout tone="warn" title="Advertencias">
                {selectedRun.warnings.join(' · ')}
              </Callout>
            )}
            <JsonViewer maxHeight="220px" value={selectedRun} />
          </div>
        )}
      </Dialog>
    </div>
  );
}
