/**
 * Webhooks: catálogo de eventos y log de entregas con reenvío simulado.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, Send, Shield, Webhook } from 'lucide-react';
import type { WebhookDelivery } from '@/types';
import { api } from '@/services';
import { useAction, useAsync } from '@/app/hooks';
import { useToast, Dialog } from '@/components/ui/overlays';
import { WEBHOOK_EVENT_CATALOG } from '@/mocks/fixtures/platform';
import { cn, fmtDateTime, fmtNumber } from '@/lib/utils';
import { Badge, Button, Card, CardHeader, Select } from '@/components/ui/primitives';
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

export function BoWebhooks() {
  const toast = useToast();
  const [selected, setSelected] = useState<WebhookDelivery | null>(null);
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const deliveries = useAsync(() => api.integrations.listWebhooks(), []);
  const resend = useAction((id: string) => api.integrations.resendWebhook(id));

  const all = deliveries.data ?? [];
  const filtered = all.filter(
    (d) => (!typeFilter || d.type === typeFilter) && (!statusFilter || d.status === statusFilter),
  );
  const failed = all.filter((d) => d.status === 'FAILED' || d.status === 'DEAD_LETTER');

  const columns: Column<WebhookDelivery>[] = [
    {
      key: 'event',
      header: 'Evento',
      cell: (d) => (
        <div className="min-w-0">
          <Mono>{d.type}</Mono>
          <p className="mt-0.5 text-[11px] text-ink-400">{d.eventId}</p>
        </div>
      ),
      sortable: true,
      sortValue: (d) => d.type,
    },
    {
      key: 'at',
      header: 'Ocurrió',
      cell: (d) => <span className="text-xs text-ink-600">{fmtDateTime(d.occurredAt)}</span>,
      sortable: true,
      sortValue: (d) => new Date(d.occurredAt).getTime(),
    },
    {
      key: 'endpoint',
      header: 'Destino',
      hideOnMobile: true,
      cell: (d) => <span className="truncate font-mono text-[11px] text-ink-500">{d.endpoint}</span>,
    },
    {
      key: 'attempts',
      header: 'Intentos',
      align: 'right',
      cell: (d) => (
        <span className={cn('tabular-nums', d.attempts > 1 ? 'text-warn-700' : 'text-ink-600')}>{d.attempts}</span>
      ),
      sortable: true,
      sortValue: (d) => d.attempts,
    },
    {
      key: 'response',
      header: 'Respuesta',
      align: 'right',
      hideOnMobile: true,
      cell: (d) =>
        d.responseCode ? (
          <span className={cn('font-mono text-[12px] tabular-nums', d.responseCode >= 400 ? 'text-bad-600' : 'text-ok-700')}>
            {d.responseCode}
          </span>
        ) : (
          <span className="text-ink-400">—</span>
        ),
    },
    {
      key: 'duration',
      header: 'Duración',
      align: 'right',
      hideOnMobile: true,
      cell: (d) => <span className="tabular-nums text-ink-500">{d.durationMs} ms</span>,
    },
    {
      key: 'status',
      header: 'Estado',
      cell: (d) => (
        <Badge
          tone={d.status === 'DELIVERED' ? 'ok' : d.status === 'PENDING' ? 'tech' : d.status === 'DEAD_LETTER' ? 'neutral' : 'bad'}
          size="sm"
          dot
        >
          {d.status === 'DELIVERED'
            ? 'Entregado'
            : d.status === 'PENDING'
              ? 'Pendiente'
              : d.status === 'DEAD_LETTER'
                ? 'Dead letter'
                : 'Fallido'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      width: '160px',
      cell: (d) => (
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => setSelected(d)} className="text-[13px] font-medium text-ashir-600 hover:text-ashir-700">
            Payload
          </button>
          {(d.status === 'FAILED' || d.status === 'DEAD_LETTER') && (
            <button
              type="button"
              onClick={async () => {
                await resend.run(d.id);
                deliveries.refetch();
                toast.success('Entrega reenviada', `${d.type} se entregó correctamente en el reintento.`);
              }}
              className="text-[13px] font-medium text-ashir-600 hover:text-ashir-700"
            >
              Reenviar
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Webhooks"
        subtitle="Eventos que el Partner Hub emitiría hacia sistemas externos, con su log de entregas y reintentos."
        actions={
          <Link to="/docs/webhooks">
            <Button variant="outline">Ver documentación</Button>
          </Link>
        }
      />

      <Callout tone="tech" className="mb-6" title="Webhooks de demostración">
        Las entregas de esta pantalla son simuladas: no se envía nada a ningún endpoint externo. La firma HMAC, los
        reintentos con backoff y la cola de dead-letter están documentados como arquitectura propuesta.
      </Callout>

      <StatGrid cols={4} className="mb-6">
        <StatTile label="Entregas registradas" value={all.length} icon={<Webhook className="size-4" />} />
        <StatTile
          label="Entregadas"
          value={all.filter((d) => d.status === 'DELIVERED').length}
          tone="ok"
          footer={`${((all.filter((d) => d.status === 'DELIVERED').length / Math.max(1, all.length)) * 100).toFixed(0)}% de éxito`}
        />
        <StatTile
          label="Fallidas"
          value={failed.length}
          tone={failed.length > 0 ? 'bad' : 'ok'}
          footer={`${all.filter((d) => d.status === 'DEAD_LETTER').length} en dead letter`}
        />
        <StatTile label="Tipos de evento" value={WEBHOOK_EVENT_CATALOG.length} />
      </StatGrid>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="w-auto min-w-[220px]" aria-label="Tipo de evento">
          <option value="">Todos los eventos</option>
          {WEBHOOK_EVENT_CATALOG.map((event) => (
            <option key={event.type} value={event.type}>
              {event.type}
            </option>
          ))}
        </Select>
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-auto min-w-[160px]" aria-label="Estado">
          <option value="">Todos los estados</option>
          <option value="DELIVERED">Entregados</option>
          <option value="PENDING">Pendientes</option>
          <option value="FAILED">Fallidos</option>
          <option value="DEAD_LETTER">Dead letter</option>
        </Select>
      </div>

      {deliveries.error ? (
        <Card>
          <ErrorState description={deliveries.error.message} onRetry={deliveries.refetch} />
        </Card>
      ) : (
        <DataTable
          columns={columns}
          rows={filtered}
          rowKey={(d) => d.id}
          loading={deliveries.initialLoading}
          dense
          empty={<EmptyState title="Sin entregas con estos filtros" icon={<Webhook className="size-5" />} />}
        />
      )}

      {/* ---------- catálogo de eventos ---------- */}
      <section className="mt-8">
        <SectionTitle title="Catálogo de eventos" subtitle="Todos los eventos que el portal puede emitir" />
        <Card>
          <ul className="divide-y divide-ink-100">
            {WEBHOOK_EVENT_CATALOG.map((event) => (
              <li key={event.type} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <Mono copy>{event.type}</Mono>
                  <p className="mt-1 text-[13px] text-ink-500">{event.description}</p>
                </div>
                <Badge tone="neutral" size="sm">
                  {fmtNumber(all.filter((d) => d.type === event.type).length)} entregas
                </Badge>
              </li>
            ))}
          </ul>
        </Card>
      </section>

      {/* ---------- seguridad ---------- */}
      <Card className="mt-6">
        <CardHeader title="Seguridad y entrega" icon={<Shield className="size-4" />} />
        <div className="grid gap-5 p-5 lg:grid-cols-2">
          <div>
            <h3 className="mb-2 text-[13px] font-semibold text-ink-900">Arquitectura propuesta</h3>
            <ul className="space-y-2 text-[13px] leading-relaxed text-ink-600">
              <li>
                <strong>Firma HMAC:</strong> cada entrega incluye un header <Mono>X-Ashir-Signature</Mono> con el HMAC
                SHA-256 del cuerpo usando un secreto compartido por endpoint.
              </li>
              <li>
                <strong>Timestamp:</strong> el header <Mono>X-Ashir-Timestamp</Mono> permite descartar reenvíos viejos y
                evitar ataques de repetición.
              </li>
              <li>
                <strong>Reintentos:</strong> hasta 5 intentos con backoff exponencial ante respuestas 5xx o timeouts.
              </li>
              <li>
                <strong>Idempotencia del receptor:</strong> el <Mono>eventId</Mono> es estable entre reintentos; el
                receptor debe descartar duplicados.
              </li>
              <li>
                <strong>Dead letter:</strong> tras agotar los reintentos la entrega queda para revisión manual y se puede
                reenviar desde esta pantalla.
              </li>
              <li>
                <strong>Respuesta esperada:</strong> cualquier 2xx dentro de 10 segundos.
              </li>
            </ul>
          </div>

          <div>
            <h3 className="mb-2 text-[13px] font-semibold text-ink-900">Ejemplo de verificación</h3>
            <CodeBlock
              title="verify.ts"
              maxHeight="260px"
              code={`import crypto from 'node:crypto';

export function verifyAshirWebhook(req, secret) {
  const signature = req.headers['x-ashir-signature'];
  const timestamp = req.headers['x-ashir-timestamp'];

  // Descarta entregas de más de 5 minutos: evita replay.
  if (Math.abs(Date.now() - Number(timestamp)) > 300_000) return false;

  const expected = crypto
    .createHmac('sha256', secret)
    .update(\`\${timestamp}.\${req.rawBody}\`)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected),
  );
}`}
            />
          </div>
        </div>
      </Card>

      {/* ---------- payload ---------- */}
      <Dialog
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected ? selected.type : ''}
        description={selected ? `${selected.eventId} · ${fmtDateTime(selected.occurredAt)}` : undefined}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setSelected(null)}>
              Cerrar
            </Button>
            {selected && (selected.status === 'FAILED' || selected.status === 'DEAD_LETTER') && (
              <Button
                icon={<Send className="size-4" />}
                loading={resend.pending}
                onClick={async () => {
                  await resend.run(selected.id);
                  setSelected(null);
                  deliveries.refetch();
                  toast.success('Entrega reenviada');
                }}
              >
                Reenviar
              </Button>
            )}
          </>
        }
      >
        {selected && (
          <div className="space-y-4">
            <div className="space-y-0.5 rounded-lg border border-ink-200 px-3.5 py-3">
              <DataRow label="Tipo" value={<Mono>{selected.type}</Mono>} />
              <DataRow label="Event ID" value={<Mono copy>{selected.eventId}</Mono>} />
              <DataRow label="API version" value={selected.apiVersion} />
              <DataRow label="Destino" value={<span className="font-mono text-[12px]">{selected.endpoint}</span>} />
              <DataRow label="Intentos" value={selected.attempts} />
              <DataRow label="Respuesta" value={selected.responseCode ?? 'sin respuesta'} />
              <DataRow label="Duración" value={`${selected.durationMs} ms`} />
            </div>

            {selected.status === 'DEAD_LETTER' && (
              <Callout tone="warn" icon={<RefreshCw className="size-4" />} title="Entrega en dead letter">
                Se agotaron los reintentos automáticos. Requiere revisión manual antes de reenviar.
              </Callout>
            )}

            <div>
              <p className="mb-2 text-[13px] font-semibold text-ink-900">Payload</p>
              <JsonViewer value={selected.payload} maxHeight="320px" />
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
