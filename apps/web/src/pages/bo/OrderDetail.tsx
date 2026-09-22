/**
 * Detalle de pedido en el backoffice: aprobar, avanzar de estado y auditar.
 */
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Check, History, Info, ShieldCheck, Truck, X } from 'lucide-react';
import type { Order, OrderStatus } from '@/types';
import { api } from '@/services';
import { useSession } from '@/app/session';
import { useAction, useAsync } from '@/app/hooks';
import { useToast, Dialog } from '@/components/ui/overlays';
import { customerById } from '@/mocks/fixtures/customers';
import { personName } from '@/mocks/fixtures/people';
import { ORDER_FLOW, ORDER_STATUS, PAYMENT_TERM } from '@/lib/labels';
import { can } from '@/lib/rbac';
import { fmtDate, fmtDateTime, fmtMoney, fmtNumber, num } from '@/lib/utils';
import { Badge, Button, Card, CardHeader, Select, Skeleton, Textarea } from '@/components/ui/primitives';
import {
  Callout,
  DataRow,
  DataTable,
  ErrorState,
  Mono,
  PageHeader,
  SectionTitle,
  Stepper,
  Timeline,
  type Column,
} from '@/components/ui/data';
import { OrderStatusBadge, SegmentBadge } from '@/components/domain/common';

const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  CONFIRMED: ['SALES_REVIEW', 'OBSERVED', 'CANCELLED'],
  SALES_REVIEW: ['PICKING', 'OBSERVED', 'PENDING_PAYMENT', 'CANCELLED'],
  PENDING_APPROVAL: ['SALES_REVIEW', 'OBSERVED', 'CANCELLED'],
  PENDING_PAYMENT: ['PICKING', 'CANCELLED'],
  OBSERVED: ['SALES_REVIEW', 'CANCELLED'],
  PICKING: ['SHIPPED', 'PARTIALLY_SHIPPED'],
  PARTIALLY_SHIPPED: ['SHIPPED', 'DELIVERED'],
  SHIPPED: ['DELIVERED'],
};

export function BoOrderDetail() {
  const { id = '' } = useParams();
  const { session } = useSession();
  const toast = useToast();
  const [advanceOpen, setAdvanceOpen] = useState(false);
  const [nextStatus, setNextStatus] = useState<OrderStatus | ''>('');
  const [comment, setComment] = useState('');

  const order = useAsync(() => api.orders.get(id, session), [id, session.role]);
  const advance = useAction((status: OrderStatus, note: string) => api.orders.advanceStatus(id, status, session, note));

  if (order.error) {
    return (
      <Card>
        <ErrorState title="No pudimos abrir el pedido" description={order.error.message} onRetry={order.refetch} />
      </Card>
    );
  }
  if (order.initialLoading || !order.data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full rounded-card" />
      </div>
    );
  }

  const o = order.data;
  const customer = customerById(o.customerId);
  const options = NEXT_STATUS[o.status] ?? [];
  const canApprove = can(session, 'orders:approve');
  const pendingApproval = o.requiredApprovals.filter((a) => a.status === 'PENDING');

  const columns: Column<Order['items'][number]>[] = [
    {
      key: 'product',
      header: 'Producto',
      cell: (item) => (
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium text-ink-900">{item.name}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-ink-400">
            <code className="font-mono">{item.sku}</code>
            <span>·</span>
            <span>{item.brand}</span>
          </p>
        </div>
      ),
    },
    { key: 'qty', header: 'Cant.', align: 'right', cell: (item) => <span className="tabular-nums">{item.quantity}</span> },
    {
      key: 'shipped',
      header: 'Despachadas',
      align: 'right',
      hideOnMobile: true,
      cell: (item) => (
        <span className={item.shippedQty < item.quantity ? 'tabular-nums text-warn-700' : 'tabular-nums text-ink-600'}>
          {item.shippedQty}
        </span>
      ),
    },
    {
      key: 'list',
      header: 'Lista',
      align: 'right',
      hideOnMobile: true,
      cell: (item) => <span className="tabular-nums text-ink-500">{fmtMoney(item.listPrice)}</span>,
    },
    {
      key: 'unit',
      header: 'Unitario',
      align: 'right',
      cell: (item) => (
        <div>
          <span className="font-medium tabular-nums">{fmtMoney(item.unitPrice)}</span>
          {Number.parseFloat(item.discountPct) < -0.01 && (
            <p className="text-[11px] text-ok-700">{Number.parseFloat(item.discountPct).toFixed(1).replace('.', ',')}%</p>
          )}
        </div>
      ),
    },
    {
      key: 'conditions',
      header: 'Condiciones',
      hideOnMobile: true,
      cell: (item) =>
        item.appliedConditions.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {item.appliedConditions.map((code) => (
              <Badge key={code} tone="ok" size="sm">
                {code}
              </Badge>
            ))}
          </div>
        ) : (
          <span className="text-ink-400">—</span>
        ),
    },
    {
      key: 'total',
      header: 'Subtotal',
      align: 'right',
      cell: (item) => <span className="font-semibold tabular-nums">{fmtMoney(item.lineTotal)}</span>,
    },
  ];

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'Pedidos', href: '/bo/pedidos' }, { label: o.number }]}
        title={`${o.number} · ${o.customerName}`}
        subtitle={`Creado el ${fmtDateTime(o.createdAt)} · ${
          o.origin === 'ASSISTED' && o.placedBy
            ? `cargado por ${o.placedBy.name} en nombre del cliente`
            : 'cargado por el cliente desde el portal'
        } · versión ${o.version} · ejecutivo ${personName(o.salesRepId)}`}
        badge={<OrderStatusBadge status={o.status} />}
        actions={
          canApprove && options.length > 0 ? (
            <Button icon={<Check className="size-4" />} onClick={() => setAdvanceOpen(true)}>
              Cambiar estado
            </Button>
          ) : undefined
        }
      />

      {/* --- aprobaciones pendientes --- */}
      {pendingApproval.length > 0 && (
        <Callout
          tone="warn"
          icon={<ShieldCheck className="size-4" />}
          title="Aprobaciones pendientes"
          className="mb-5"
          action={
            canApprove && (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  icon={<Check className="size-3.5" />}
                  loading={advance.pending}
                  onClick={async () => {
                    await advance.run('SALES_REVIEW', 'Aprobación otorgada desde el backoffice.');
                    toast.success('Pedido aprobado', 'Pasó a validación comercial.');
                    order.refetch();
                  }}
                >
                  Aprobar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  icon={<X className="size-3.5" />}
                  onClick={async () => {
                    await advance.run('OBSERVED', 'El pedido queda observado a la espera de una acción del cliente.');
                    toast.info('Pedido observado');
                    order.refetch();
                  }}
                >
                  Observar
                </Button>
              </div>
            )
          }
        >
          {pendingApproval.map((a) => a.label).join(' · ')}
          {customer && (
            <p className="mt-1 text-xs">
              Crédito disponible del cliente: {fmtMoney(customer.account.creditAvailable)} · total del pedido:{' '}
              {fmtMoney(o.total)}
            </p>
          )}
        </Callout>
      )}

      {o.status !== 'CANCELLED' && (
        <Card className="mb-5 p-5">
          <Stepper
            steps={ORDER_FLOW.map((s) => ({ label: ORDER_STATUS[s].label }))}
            currentIndex={Math.max(0, ORDER_FLOW.indexOf(o.status))}
          />
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-5">
          <Card>
            <CardHeader
              title="Ítems del pedido"
              subtitle={`${o.items.length} SKUs · ${fmtNumber(o.items.reduce((a, i) => a + i.quantity, 0))} unidades`}
            />
            <DataTable
              columns={columns}
              rows={o.items}
              rowKey={(i) => i.id}
              className="rounded-none border-0"
              dense
              footer={
                <>
                  <tr>
                    <td colSpan={6} className="px-4 py-2 text-right text-ink-600">
                      Subtotal / descuentos
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {fmtMoney(o.subtotal)}
                      <span className="ml-2 text-ok-700">− {fmtMoney(o.discountTotal, { withCode: false })}</span>
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={6} className="px-4 py-2 text-right text-ink-600">
                      Envío + IVA
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {fmtMoney(o.freight, { withCode: false })} + {fmtMoney(o.taxTotal, { withCode: false })}
                    </td>
                  </tr>
                  <tr className="border-t border-ink-200">
                    <td colSpan={6} className="px-4 py-2.5 text-right font-semibold text-ink-900">
                      Total
                    </td>
                    <td className="px-4 py-2.5 text-right text-[15px] font-semibold tabular-nums text-ink-900">
                      {fmtMoney(o.total)}
                    </td>
                  </tr>
                </>
              }
            />
          </Card>

          <Card>
            <CardHeader
              title="Auditoría del pedido"
              subtitle="Quién hizo qué, cuándo y desde dónde"
              icon={<History className="size-4" />}
            />
            <div className="p-5">
              <Timeline
                items={o.auditLog.map((event, i) => ({
                  id: event.id,
                  title: event.action,
                  at: fmtDateTime(event.at),
                  actor: event.actor,
                  actorRole: `${event.actorRole === 'SYSTEM' ? 'Sistema' : event.actorRole} · origen ${event.origin}`,
                  comment: (
                    <>
                      {event.comment}
                      {(event.previousValue || event.newValue) && (
                        <span className="mt-1 block font-mono text-[11px] text-ink-400">
                          {event.previousValue ?? '—'} → {event.newValue ?? '—'} · {event.requestId}
                        </span>
                      )}
                    </>
                  ),
                  tone: i === o.auditLog.length - 1 ? 'ok' : 'tech',
                  current: i === o.auditLog.length - 1,
                }))}
              />
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          {customer && (
            <Card>
              <CardHeader
                title="Cliente"
                action={
                  <Link to={`/bo/clientes/${customer.id}`} className="text-[13px] font-medium text-ashir-600 hover:text-ashir-700">
                    Ver ficha
                  </Link>
                }
              />
              <div className="space-y-0.5 p-5">
                <DataRow label="Razón social" value={customer.legalName} />
                <DataRow label="Código" value={<Mono>{customer.code}</Mono>} />
                <DataRow label="Segmento" value={<SegmentBadge segment={customer.segment} size="sm" />} />
                <DataRow label="Lista" value={customer.priceListId.replace('pl_', 'LP-').toUpperCase()} />
                <DataRow label="Condición de pago" value={PAYMENT_TERM[customer.paymentTerm].label} />
                <DataRow label="Crédito disponible" value={fmtMoney(customer.account.creditAvailable)} />
                {num(customer.account.overdue) > 0 && (
                  <DataRow
                    label="Deuda vencida"
                    value={<span className="font-semibold text-bad-600">{fmtMoney(customer.account.overdue)}</span>}
                  />
                )}
                <DataRow label="Zona" value={`${customer.zone} · ${customer.city}`} />
              </div>
            </Card>
          )}

          <Card>
            <CardHeader title="Logística" icon={<Truck className="size-4" />} />
            <div className="space-y-0.5 p-5">
              <DataRow label="Método" value={o.deliveryMethod === 'PICKUP' ? 'Retiro en depósito' : 'Envío'} />
              {o.tracking && (
                <>
                  <DataRow label="Transporte" value={o.tracking.carrier} />
                  <DataRow label="Seguimiento" value={<Mono copy>{o.tracking.code}</Mono>} />
                  <DataRow label="Estado del envío" value={o.tracking.status} />
                </>
              )}
              {o.shippedAt && <DataRow label="Despachado" value={fmtDate(o.shippedAt)} />}
              {o.deliveredAt && <DataRow label="Entregado" value={fmtDate(o.deliveredAt)} />}
              {o.deliveryMethod === 'DELIVERY' && (
                <div className="mt-2 border-t border-ink-100 pt-2">
                  <p className="text-[11px] font-semibold tracking-wide text-ink-500 uppercase">Dirección</p>
                  <p className="mt-1 text-[13px] text-ink-700">{o.deliveryAddress}</p>
                </div>
              )}
            </div>
          </Card>

          {o.appliedConditions.length > 0 && (
            <Card>
              <CardHeader title="Condiciones aplicadas" />
              <ul className="divide-y divide-ink-100 px-5">
                {o.appliedConditions.map((c) => (
                  <li key={c.conditionId} className="flex items-center justify-between gap-2 py-2.5">
                    <Link
                      to={`/bo/condiciones/${c.conditionId}`}
                      className="min-w-0 truncate text-[13px] text-ashir-600 hover:text-ashir-700"
                    >
                      {c.name}
                    </Link>
                    <Badge tone="ok" size="sm">
                      {c.effect}
                    </Badge>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {o.notes && (
            <Card>
              <CardHeader title="Observaciones del cliente" />
              <p className="p-5 text-[13px] leading-relaxed text-ink-700">{o.notes}</p>
            </Card>
          )}

          {!canApprove && (
            <Callout tone="neutral" icon={<Info className="size-4" />}>
              Tu rol puede consultar el pedido pero no cambiar su estado. Cambiá a Comercial o Administrador para
              recorrer las aprobaciones.
            </Callout>
          )}
        </div>
      </div>

      <SectionTitle title="" className="sr-only" />

      <Dialog
        open={advanceOpen}
        onClose={() => setAdvanceOpen(false)}
        title={`Cambiar el estado de ${o.number}`}
        description="El cambio se registra en la auditoría con tu usuario, la fecha y el comentario."
        footer={
          <>
            <Button variant="outline" onClick={() => setAdvanceOpen(false)}>
              Cancelar
            </Button>
            <Button
              loading={advance.pending}
              disabled={!nextStatus}
              onClick={async () => {
                if (!nextStatus) return;
                const result = await advance.run(nextStatus, comment);
                setAdvanceOpen(false);
                setComment('');
                if (result) {
                  toast.success('Estado actualizado', `${o.number} pasó a «${ORDER_STATUS[nextStatus].label}».`);
                  order.refetch();
                } else if (advance.error) {
                  toast.error('No pudimos actualizar el estado', advance.error.message);
                }
              }}
            >
              Confirmar cambio
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="next-status" className="mb-1.5 block text-[13px] font-medium text-ink-700">
              Nuevo estado
            </label>
            <Select id="next-status" value={nextStatus} onChange={(e) => setNextStatus(e.target.value as OrderStatus)}>
              <option value="">Elegí un estado</option>
              {options.map((s) => (
                <option key={s} value={s}>
                  {ORDER_STATUS[s].label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label htmlFor="advance-comment" className="mb-1.5 block text-[13px] font-medium text-ink-700">
              Comentario
            </label>
            <Textarea
              id="advance-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              placeholder="Crédito verificado, se libera a preparación."
            />
          </div>
          {nextStatus === 'OBSERVED' && (
            <Callout tone="warn">
              El cliente va a ver este comentario en su portal como motivo de la observación.
            </Callout>
          )}
        </div>
      </Dialog>
    </div>
  );
}
