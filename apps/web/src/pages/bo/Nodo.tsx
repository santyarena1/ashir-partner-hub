/**
 * Integración con NODO.
 *
 * NODO se presenta como una plataforma externa que puede funcionar de puente
 * operativo para centralizar e intercambiar información comercial entre el
 * Partner Hub y otros procesos o canales. La conexión es una propuesta
 * configurable para la demostración: no existe hoy.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeftRight,
  ArrowRight,
  CheckCircle2,
  Pause,
  Play,
  Plug,
  RefreshCw,
  Server,
  Settings2,
  XCircle,
  Zap,
} from 'lucide-react';
import type { IntegrationEntity, IntegrationRun } from '@/types';
import { api } from '@/services';
import { useAction, useAsync } from '@/app/hooks';
import { useToast, Dialog } from '@/components/ui/overlays';
import { DIRECTION_LABEL, FREQUENCY_LABEL } from '@/lib/labels';
import { cn, fmtDateTime, fmtNumber, fmtRelative } from '@/lib/utils';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Field,
  Input,
  Select,
  Skeleton,
  Switch,
} from '@/components/ui/primitives';
import {
  Callout,
  CodeBlock,
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

const NODO_ENDPOINTS = [
  { method: 'GET', path: '/integrations/nodo', description: 'Estado, configuración enmascarada y entidades habilitadas.', implemented: true },
  { method: 'PATCH', path: '/integrations/nodo/configuration', description: 'Actualiza endpoint, credencial, ambiente y frecuencia.', implemented: false },
  { method: 'POST', path: '/integrations/nodo/test-connection', description: 'Prueba la conexión y devuelve latencia y request id.', implemented: true },
  { method: 'POST', path: '/integrations/nodo/sync', description: 'Dispara una sincronización manual de las entidades activas.', implemented: true },
  { method: 'GET', path: '/integrations/nodo/runs', description: 'Historial de ejecuciones con resultado y advertencias.', implemented: true },
  { method: 'GET', path: '/integrations/nodo/runs/{runId}', description: 'Detalle de una ejecución puntual.', implemented: true },
];

export function BoNodo() {
  const toast = useToast();
  const [configOpen, setConfigOpen] = useState(false);
  const [selectedRun, setSelectedRun] = useState<IntegrationRun | null>(null);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string; latencyMs: number; requestId: string } | null>(null);

  const integration = useAsync(() => api.integrations.get('int_nodo'), []);
  const runs = useAsync(() => api.integrations.runs('int_nodo'), []);
  const sync = useAction(() => api.integrations.sync('int_nodo'));
  const test = useAction(() => api.integrations.testConnection('int_nodo'));
  const toggleEntity = useAction((entities: IntegrationEntity[]) =>
    api.integrations.updateConfiguration('int_nodo', { entities }),
  );

  if (integration.error) {
    return (
      <Card>
        <ErrorState description={integration.error.message} onRetry={integration.refetch} />
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

  const n = integration.data;

  const runColumns: Column<IntegrationRun>[] = [
    {
      key: 'at',
      header: 'Fecha',
      cell: (r) => <span className="text-xs text-ink-600">{fmtDateTime(r.at)}</span>,
      sortable: true,
      sortValue: (r) => new Date(r.at).getTime(),
    },
    { key: 'process', header: 'Proceso', cell: (r) => <span className="font-medium text-ink-900">{r.process}</span> },
    {
      key: 'direction',
      header: 'Dirección',
      cell: (r) => (
        <span className="inline-flex items-center gap-1.5 text-xs text-ink-600">
          {r.direction === 'BIDIRECTIONAL' ? (
            <ArrowLeftRight className="size-3.5" aria-hidden />
          ) : (
            <ArrowRight className={cn('size-3.5', r.direction === 'INBOUND' && 'rotate-180')} aria-hidden />
          )}
          {r.direction === 'OUTBOUND' ? 'Ashir → NODO' : r.direction === 'INBOUND' ? 'NODO → Ashir' : 'Bidireccional'}
        </span>
      ),
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
      key: 'result',
      header: 'Resultado',
      cell: (r) => (
        <Badge tone={r.result === 'SUCCESS' ? 'ok' : r.result === 'WARNING' ? 'warn' : 'bad'} size="sm" dot>
          {r.result === 'SUCCESS' ? 'Exitoso' : r.result === 'WARNING' ? `${r.warnings.length} advertencia(s)` : 'Fallido'}
        </Badge>
      ),
    },
    {
      key: 'detail',
      header: '',
      align: 'right',
      width: '90px',
      cell: (r) => (
        <button
          type="button"
          onClick={() => setSelectedRun(r)}
          className="text-[13px] font-medium text-ashir-600 hover:text-ashir-700"
        >
          Ver detalle
        </button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'Integraciones', href: '/bo/integraciones' }, { label: 'NODO' }]}
        title="NODO"
        subtitle="Conector comercial y de sincronización. Puede funcionar como puente operativo para centralizar e intercambiar información comercial entre el Partner Hub y otros procesos o canales."
        badge={
          <span className="flex items-center gap-2">
            <IntegrationStatusBadge status={n.status} />
            <Badge tone="neutral">Ambiente {n.environment === 'DEMO' ? 'demo' : 'producción'}</Badge>
          </span>
        }
        actions={
          <>
            <Button variant="outline" icon={<Settings2 className="size-4" />} onClick={() => setConfigOpen(true)}>
              Configurar conexión
            </Button>
            <Button
              variant="outline"
              icon={<Zap className="size-4" />}
              loading={test.pending}
              onClick={async () => {
                const result = await test.run();
                if (result) {
                  setTestResult(result);
                  if (result.ok) toast.success('Conexión establecida', result.message);
                  else toast.warning('No pudimos conectar', result.message);
                }
              }}
            >
              Probar conexión
            </Button>
            <Button
              icon={<RefreshCw className={cn('size-4', sync.pending && 'animate-spin')} />}
              loading={sync.pending}
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

      <Callout tone="tech" className="mb-6" title="Integración propuesta">
        La conexión con NODO no existe hoy: se muestra como una integración configurable para la presentación. Las
        credenciales de esta pantalla son placeholders enmascarados, no valores reales.
      </Callout>

      {testResult && (
        <Callout
          tone={testResult.ok ? 'ok' : 'bad'}
          icon={testResult.ok ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />}
          title={testResult.ok ? 'Prueba de conexión exitosa' : 'Prueba de conexión fallida'}
          className="mb-6"
        >
          {testResult.message}
          <span className="mt-1 block font-mono text-[11px]">
            Latencia: {testResult.latencyMs} ms · Request ID: {testResult.requestId}
          </span>
        </Callout>
      )}

      {/* ---------- resumen ---------- */}
      <StatGrid cols={4} className="mb-6">
        <StatTile
          label="Última sincronización"
          value={n.lastSyncAt ? fmtRelative(n.lastSyncAt) : 'Nunca'}
          icon={<RefreshCw className="size-4" />}
          tone="ok"
          footer={n.nextSyncAt ? `Próxima ${fmtRelative(n.nextSyncAt)}` : FREQUENCY_LABEL[n.frequency]}
        />
        <StatTile label="Registros procesados" value={fmtNumber(n.recordsProcessed)} icon={<Server className="size-4" />} />
        <StatTile
          label="Errores críticos"
          value={n.errorCount}
          tone={n.errorCount > 0 ? 'bad' : 'ok'}
          footer={`${n.retryCount} reintentos`}
        />
        <StatTile
          label="Entidades activas"
          value={`${n.entities.filter((e) => e.enabled).length} de ${n.entities.length}`}
          icon={<Plug className="size-4" />}
        />
      </StatGrid>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-5">
          {/* ---------- entidades ---------- */}
          <Card>
            <CardHeader
              title="Qué se sincroniza"
              subtitle="Activá o desactivá cada entidad y definí la dirección del flujo"
            />
            <ul className="divide-y divide-ink-100">
              {n.entities.map((entity) => (
                <li key={entity.key} className="px-5 py-3.5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <Switch
                        label={entity.label}
                        description={`${DIRECTION_LABEL[entity.direction].replace('destino', 'NODO')} · ${
                          entity.lastUpdatedAt ? `actualizado ${fmtRelative(entity.lastUpdatedAt)}` : 'sin sincronizar'
                        }`}
                        checked={entity.enabled}
                        onChange={async (next) => {
                          const entities = n.entities.map((e) =>
                            e.key === entity.key ? { ...e, enabled: next } : e,
                          );
                          await toggleEntity.run(entities);
                          integration.refetch();
                          toast.info(
                            next ? `${entity.label}: sincronización activada` : `${entity.label}: sincronización pausada`,
                          );
                        }}
                      />
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="text-[13px] tabular-nums text-ink-600">{fmtNumber(entity.records)} reg.</span>
                      <IntegrationStatusBadge status={entity.status} size="sm" />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          {/* ---------- actividad ---------- */}
          <section>
            <SectionTitle title="Actividad y logs" subtitle="Cada ejecución con su resultado y su request id" />
            <DataTable
              columns={runColumns}
              rows={runs.data ?? []}
              rowKey={(r) => r.id}
              loading={runs.initialLoading}
              dense
              empty={<EmptyState title="Sin ejecuciones registradas" icon={<RefreshCw className="size-5" />} />}
            />
          </section>

          {/* ---------- API ---------- */}
          <Card>
            <CardHeader
              title="API de la integración"
              subtitle="Endpoints previstos para administrar el conector"
              action={
                <Link to="/docs" className="text-[13px] font-medium text-ashir-600 hover:text-ashir-700">
                  Ver documentación
                </Link>
              }
            />
            <ul className="divide-y divide-ink-100">
              {NODO_ENDPOINTS.map((endpoint) => (
                <li key={endpoint.path + endpoint.method} className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <Badge
                    tone={endpoint.method === 'GET' ? 'tech' : endpoint.method === 'POST' ? 'ok' : 'warn'}
                    size="sm"
                    className="w-14 justify-center"
                  >
                    {endpoint.method}
                  </Badge>
                  <Mono className="flex-1">{endpoint.path}</Mono>
                  <span className="min-w-[200px] flex-1 text-xs text-ink-500">{endpoint.description}</span>
                  <Badge tone={endpoint.implemented ? 'ok' : 'neutral'} size="sm">
                    {endpoint.implemented ? 'Simulado en la demo' : 'Alcance futuro'}
                  </Badge>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        {/* ---------------- panel derecho ---------------- */}
        <div className="space-y-4">
          <Card>
            <CardHeader title="Configuración" icon={<Settings2 className="size-4" />} />
            <div className="space-y-0.5 p-5">
              {n.maskedConfig.map((item) => (
                <DataRow
                  key={item.key}
                  label={item.key}
                  value={
                    item.secret ? (
                      <span className="font-mono text-[12px] text-ink-500">{item.value}</span>
                    ) : (
                      <span className="text-[13px]">{item.value}</span>
                    )
                  }
                />
              ))}
            </div>
            <div className="border-t border-ink-100 px-5 py-3">
              <Button variant="outline" size="sm" className="w-full" onClick={() => setConfigOpen(true)}>
                Editar configuración
              </Button>
            </div>
          </Card>

          <Card className="border-ashir-200">
            <CardHeader title="Qué aporta esta integración" />
            <ul className="space-y-2.5 p-5">
              {(n.benefits ?? []).map((benefit) => (
                <li key={benefit} className="flex gap-2.5 text-[13px] leading-relaxed text-ink-700">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-ok-500" aria-hidden />
                  {benefit}
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHeader title="Flujo de datos" />
            <div className="p-5">
              <ol className="space-y-2">
                {n.architecture.map((node, i) => (
                  <li key={node} className="flex items-center gap-2.5">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-ink-100 text-[11px] font-bold text-ink-600">
                      {i + 1}
                    </span>
                    <span className="text-[13px] text-ink-800">{node}</span>
                  </li>
                ))}
              </ol>
            </div>
          </Card>

          <Card>
            <CardHeader title="Control" />
            <div className="space-y-2 p-5">
              <Button
                variant="outline"
                className="w-full"
                icon={n.status === 'OPERATIONAL' ? <Pause className="size-4" /> : <Play className="size-4" />}
                onClick={async () => {
                  await api.integrations.updateConfiguration('int_nodo', {
                    status: n.status === 'OPERATIONAL' ? 'NOT_CONFIGURED' : 'OPERATIONAL',
                  });
                  integration.refetch();
                  toast.info(n.status === 'OPERATIONAL' ? 'Integración pausada' : 'Integración reanudada');
                }}
              >
                {n.status === 'OPERATIONAL' ? 'Pausar integración' : 'Reanudar integración'}
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {/* ---------- configuración ---------- */}
      <ConfigDialog open={configOpen} onClose={() => setConfigOpen(false)} integration={n} onSaved={integration.refetch} />

      {/* ---------- detalle de ejecución ---------- */}
      <Dialog
        open={selectedRun !== null}
        onClose={() => setSelectedRun(null)}
        title={selectedRun ? `Ejecución · ${selectedRun.process}` : ''}
        description={selectedRun ? `${fmtDateTime(selectedRun.at)} · ${DIRECTION_LABEL[selectedRun.direction]}` : undefined}
        size="lg"
        footer={
          <Button variant="outline" onClick={() => setSelectedRun(null)}>
            Cerrar
          </Button>
        }
      >
        {selectedRun && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <StatTile label="Registros" value={fmtNumber(selectedRun.records)} />
              <StatTile label="Duración" value={`${(selectedRun.durationMs / 1000).toFixed(1)}s`} />
              <StatTile
                label="Resultado"
                value={selectedRun.result === 'SUCCESS' ? 'Exitoso' : selectedRun.result === 'WARNING' ? 'Con advertencias' : 'Fallido'}
                tone={selectedRun.result === 'SUCCESS' ? 'ok' : selectedRun.result === 'WARNING' ? 'warn' : 'bad'}
              />
            </div>

            <div className="space-y-0.5 rounded-lg border border-ink-200 px-3.5 py-3">
              <DataRow label="Proceso" value={selectedRun.process} />
              <DataRow label="Dirección" value={DIRECTION_LABEL[selectedRun.direction]} />
              <DataRow label="Request ID" value={<Mono copy>{selectedRun.requestId}</Mono>} />
              <DataRow label="Resumen" value={selectedRun.summary} />
            </div>

            {selectedRun.warnings.length > 0 && (
              <Callout tone="warn" title={`${selectedRun.warnings.length} advertencia(s)`}>
                <ul className="mt-1 space-y-1">
                  {selectedRun.warnings.map((w) => (
                    <li key={w}>· {w}</li>
                  ))}
                </ul>
              </Callout>
            )}

            {selectedRun.errors.length > 0 && (
              <Callout tone="bad" title={`${selectedRun.errors.length} error(es)`}>
                <ul className="mt-1 space-y-1">
                  {selectedRun.errors.map((e) => (
                    <li key={e}>· {e}</li>
                  ))}
                </ul>
              </Callout>
            )}

            <div>
              <p className="mb-2 text-[13px] font-semibold text-ink-900">Payload de la ejecución</p>
              <JsonViewer
                maxHeight="240px"
                value={{
                  runId: selectedRun.id,
                  integrationId: selectedRun.integrationId,
                  process: selectedRun.process,
                  direction: selectedRun.direction,
                  startedAt: selectedRun.at,
                  durationMs: selectedRun.durationMs,
                  records: selectedRun.records,
                  result: selectedRun.result,
                  warnings: selectedRun.warnings,
                  errors: selectedRun.errors,
                  requestId: selectedRun.requestId,
                }}
              />
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* configuración                                                       */
/* ------------------------------------------------------------------ */

function ConfigDialog({
  open,
  onClose,
  integration,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  integration: { frequency: string; environment: string };
  onSaved: () => void;
}) {
  const toast = useToast();
  const [url, setUrl] = useState('https://api.nodo.example/v1');
  const [account, setAccount] = useState('ashir-demo-001');
  const [apiKey, setApiKey] = useState('');
  const [environment, setEnvironment] = useState(integration.environment);
  const [frequency, setFrequency] = useState(integration.frequency);
  const test = useAction(() => api.integrations.testConnection('int_nodo'));

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Configurar la conexión con NODO"
      description="Los valores quedan enmascarados. El prototipo no almacena credenciales reales."
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={async () => {
              await api.integrations.updateConfiguration('int_nodo', {
                frequency: frequency as 'MANUAL' | 'EVERY_15M' | 'HOURLY' | 'DAILY',
                environment: environment as 'DEMO' | 'PRODUCTION',
              });
              onSaved();
              onClose();
              toast.success('Configuración actualizada', 'Se guardó la frecuencia y el ambiente del conector.');
            }}
          >
            Guardar configuración
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="URL del servicio" htmlFor="nodo-url">
          <Input id="nodo-url" value={url} onChange={(e) => setUrl(e.target.value)} className="font-mono text-[12px]" />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Identificador de cuenta" htmlFor="nodo-account">
            <Input id="nodo-account" value={account} onChange={(e) => setAccount(e.target.value)} className="font-mono text-[12px]" />
          </Field>
          <Field label="API key" hint="Se guarda enmascarada. No uses una credencial real." htmlFor="nodo-key">
            <Input
              id="nodo-key"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="nod_live_••••••••••••"
              className="font-mono text-[12px]"
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Ambiente" htmlFor="nodo-env">
            <Select id="nodo-env" value={environment} onChange={(e) => setEnvironment(e.target.value)}>
              <option value="DEMO">Demo</option>
              <option value="PRODUCTION">Producción futura</option>
            </Select>
          </Field>
          <Field label="Frecuencia de sincronización" htmlFor="nodo-freq">
            <Select id="nodo-freq" value={frequency} onChange={(e) => setFrequency(e.target.value)}>
              <option value="MANUAL">Manual</option>
              <option value="EVERY_15M">Cada 15 minutos</option>
              <option value="HOURLY">Cada hora</option>
              <option value="DAILY">Diaria</option>
            </Select>
          </Field>
        </div>

        <Button
          variant="outline"
          className="w-full"
          icon={<Zap className="size-4" />}
          loading={test.pending}
          onClick={async () => {
            const result = await test.run();
            if (result?.ok) toast.success('Conexión establecida', `${result.message} (${result.latencyMs} ms)`);
            else if (result) toast.warning('No pudimos conectar', result.message);
          }}
        >
          Probar conexión
        </Button>

        <div>
          <p className="mb-2 text-[13px] font-semibold text-ink-900">Ejemplo de request</p>
          <CodeBlock
            title="POST /integrations/nodo/test-connection"
            maxHeight="200px"
            code={`curl -X POST "https://api.example.ashir.com.ar/v1/integrations/nodo/test-connection" \\
  -H "Authorization: Bearer $ASHIR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -H "X-Request-Id: req_demo_$(uuidgen)" \\
  -d '{
    "endpoint": "${url}",
    "accountId": "${account}",
    "environment": "${environment}"
  }'`}
          />
        </div>

        <Callout tone="warn">
          Nunca ingreses credenciales productivas en este prototipo. Los campos sensibles se muestran enmascarados y no
          se transmiten a ningún servicio.
        </Callout>
      </div>
    </Dialog>
  );
}
