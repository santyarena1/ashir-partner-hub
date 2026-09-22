/**
 * Detalle de pedido del reseller.
 *
 * Incluye la modificación inteligente: al cambiar cantidades, se previsualiza
 * qué condiciones se pierden o se ganan antes de confirmar el cambio.
 */
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Ban,
  Download,
  FileText,
  History,
  Info,
  Minus,
  PencilLine,
  Plus,
  Repeat,
  Truck,
  TriangleAlert,
  Wrench,
} from 'lucide-react';
import type { Order } from '@/types';
import { api, ServiceError } from '@/services';
import { useSession } from '@/app/session';
import { useAsync, useAction } from '@/app/hooks';
import { useCart } from '@/app/cart';
import { useToast, Dialog, ConfirmDialog } from '@/components/ui/overlays';
import { customerById } from '@/mocks/fixtures/customers';
import { serialsByOrder } from '@/mocks/fixtures/serials';
import { personName } from '@/mocks/fixtures/people';
import { ORDER_FLOW, ORDER_STATUS, PAYMENT_TERM } from '@/lib/labels';
import { cn, fmtDate, fmtDateTime, fmtMoney, fmtNumber, num } from '@/lib/utils';
import { Badge, Button, Card, CardHeader, Input, Skeleton, Textarea } from '@/components/ui/primitives';
import {
  Callout,
  DataRow,
  DataTable,
  ErrorState,
  Mono,
  PageHeader,

  Stepper,
  Timeline,
  type Column,
} from '@/components/ui/data';
import { OrderStatusBadge } from '@/components/domain/common';

export function OrderDetailPage() {
  const { id = '' } = useParams();
  const { session } = useSession();
  const cart = useCart();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const order = useAsync(() => api.orders.get(id, session), [id, session.customerId]);

  if (order.error) {
    return (
      <Card>
        <ErrorState
          title="No pudimos abrir el pedido"
          description={order.error.message}
          onRetry={order.refetch}
          requestId={order.error instanceof ServiceError ? order.error.requestId : undefined}
        />
      </Card>
    );
  }

  if (order.initialLoading || !order.data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-24 w-full rounded-card" />
        <Skeleton className="h-64 w-full rounded-card" />
      </div>
    );
  }

  const o = order.data;
  const customer = customerById(o.customerId);
  const serials = serialsByOrder(o.id);
  const flowIndex = ORDER_FLOW.indexOf(o.status);
  const canModify = o.allowedModifications.length > 0;

  const itemColumns: Column<Order['items'][number]>[] = [
    {
      key: 'product',
      header: 'Producto',
      cell: (item) => (
        <div className="min-w-0">
          <Link to={`/catalogo/${item.sku}`} className="text-[13px] font-medium text-ink-900 hover:text-ashir-700">
            {item.name}
          </Link>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-ink-400">
            <code className="font-mono">{item.sku}</code>
            <span>·</span>
            <span>{item.brand}</span>
          </p>
          {item.appliedConditions.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {item.appliedConditions.map((code) => (
                <Badge key={code} tone="ok" size="sm">
                  {code}
                </Badge>
              ))}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'qty',
      header: 'Cant.',
      align: 'right',
      cell: (item) => (
        <div className="tabular-nums">
          <span className="font-medium">{item.quantity}</span>
          {item.shippedQty > 0 && item.shippedQty < item.quantity && (
            <p className="text-[11px] text-warn-700">{item.shippedQty} despachadas</p>
          )}
        </div>
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
          <span className="font-medium tabular-nums text-ink-900">{fmtMoney(item.unitPrice)}</span>
          {Number.parseFloat(item.discountPct) < -0.01 && (
            <p className="text-[11px] text-ok-700">{Number.parseFloat(item.discountPct).toFixed(1).replace('.', ',')}%</p>
          )}
        </div>
      ),
    },
    {
      key: 'total',
      header: 'Subtotal',
      align: 'right',
      cell: (item) => <span className="font-semibold tabular-nums text-ink-900">{fmtMoney(item.lineTotal)}</span>,
    },
  ];

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'Mis pedidos', href: '/pedidos' }, { label: o.number }]}
        title={`Pedido ${o.number}`}
        subtitle={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>Creado el {fmtDateTime(o.createdAt)}</span>
            <span>·</span>
            <span>{PAYMENT_TERM[o.paymentTerm].label}</span>
            {o.customerPO && (
              <>
                <span>·</span>
                <span>OC del cliente: {o.customerPO}</span>
              </>
            )}
            <span>·</span>
            <span>Versión {o.version}</span>
          </span>
        }
        badge={<OrderStatusBadge status={o.status} />}
        actions={
          <>
            {canModify && (
              <Button variant="outline" icon={<PencilLine className="size-4" />} onClick={() => setEditing(true)}>
                Modificar pedido
              </Button>
            )}
            <Button
              variant="outline"
              icon={<Repeat className="size-4" />}
              onClick={() => {
                let added = 0;
                for (const item of o.items) if (cart.add(item.productId, item.quantity).ok) added++;
                toast.success('Pedido cargado en el carrito', `${added} ítems agregados.`);
              }}
            >
              Repetir pedido
            </Button>
            <Button
              variant="ghost"
              icon={<Download className="size-4" />}
              onClick={() => toast.simulated('La descarga del comprobante en PDF')}
            >
              Comprobante
            </Button>
          </>
        }
      />

      {/* --- avisos --- */}
      {o.status === 'OBSERVED' && (
        <Callout tone="bad" icon={<TriangleAlert className="size-4" />} title="Pedido observado" className="mb-5">
          {o.auditLog.find((e) => e.newValue === 'OBSERVED')?.comment ??
            'El pedido necesita una acción de tu parte para continuar.'}{' '}
          Contactá a {personName(o.salesRepId)} para resolverlo.
        </Callout>
      )}
      {o.requiredApprovals.some((a) => a.status === 'PENDING') && (
        <Callout tone="warn" icon={<Info className="size-4" />} title="Aprobación pendiente" className="mb-5">
          {o.requiredApprovals.filter((a) => a.status === 'PENDING').map((a) => a.label).join(' · ')}. El pedido avanza
          cuando el ejecutivo lo autorice.
        </Callout>
      )}

      {/* --- timeline de estados --- */}
      {o.status !== 'CANCELLED' && (
        <Card className="mb-5 p-5">
          <Stepper
            steps={ORDER_FLOW.map((s) => ({ label: ORDER_STATUS[s].label }))}
            currentIndex={flowIndex >= 0 ? flowIndex : 1}
          />
          {o.tracking && (
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-ink-100 pt-4 text-[13px]">
              <span className="flex items-center gap-1.5 font-medium text-ink-800">
                <Truck className="size-4 text-ink-400" aria-hidden />
                {o.tracking.carrier}
              </span>
              <Mono copy>{o.tracking.code}</Mono>
              <Badge tone={o.tracking.status === 'Entregado' ? 'ok' : 'tech'}>{o.tracking.status}</Badge>
              {o.shippedAt && <span className="text-ink-500">Despachado el {fmtDate(o.shippedAt)}</span>}
              {o.deliveredAt && <span className="text-ink-500">Entregado el {fmtDate(o.deliveredAt)}</span>}
            </div>
          )}
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-5">
          {/* --- ítems --- */}
          <Card>
            <CardHeader
              title="Detalle del pedido"
              subtitle={`${o.items.length} SKUs · ${fmtNumber(o.items.reduce((a, i) => a + i.quantity, 0))} unidades`}
            />
            <DataTable
              columns={itemColumns}
              rows={o.items}
              rowKey={(i) => i.id}
              className="rounded-none border-0"
              footer={
                <>
                  <tr>
                    <td colSpan={4} className="px-4 py-2 text-right text-ink-600">
                      Subtotal
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{fmtMoney(o.subtotal)}</td>
                  </tr>
                  <tr>
                    <td colSpan={4} className="px-4 py-2 text-right text-ink-600">
                      Descuentos
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-ok-700">
                      − {fmtMoney(o.discountTotal, { withCode: false })}
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={4} className="px-4 py-2 text-right text-ink-600">
                      Envío
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {num(o.freight) === 0 ? <span className="text-ok-700">Bonificado</span> : fmtMoney(o.freight)}
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={4} className="px-4 py-2 text-right text-ink-600">
                      IVA
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{fmtMoney(o.taxTotal)}</td>
                  </tr>
                  <tr className="border-t border-ink-200">
                    <td colSpan={4} className="px-4 py-2.5 text-right font-semibold text-ink-900">
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

          {/* --- unidades y garantía --- */}
          {serials.length > 0 && (
            <Card>
              <CardHeader
                title="Unidades entregadas"
                subtitle="Cada unidad tiene su número de serie y su garantía. Podés iniciar una gestión desde acá."
                icon={<Wrench className="size-4" />}
              />
              <ul className="divide-y divide-ink-100">
                {serials.slice(0, 10).map((serial) => {
                  const expired = new Date(serial.warrantyExpiresAt).getTime() < Date.now();
                  return (
                    <li key={serial.serial} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2 text-[13px] font-medium text-ink-900">
                          <Mono copy>{serial.serial}</Mono>
                          {expired ? (
                            <Badge tone="neutral" size="sm">
                              Garantía vencida
                            </Badge>
                          ) : (
                            <Badge tone="ok" size="sm">
                              En garantía
                            </Badge>
                          )}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-ink-500">
                          {serial.productName} · vence el {fmtDate(serial.warrantyExpiresAt)}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <Link to={`/catalogo/${serial.sku}`}>
                          <Button size="sm" variant="ghost">
                            Ver producto
                          </Button>
                        </Link>
                        <Link to={`/rma/nuevo?serial=${serial.serial}`}>
                          <Button size="sm" variant="outline" disabled={expired}>
                            Iniciar garantía
                          </Button>
                        </Link>
                      </div>
                    </li>
                  );
                })}
              </ul>
              {serials.length > 10 && (
                <p className="border-t border-ink-100 px-5 py-3 text-xs text-ink-500">
                  Mostrando 10 de {serials.length} unidades. La búsqueda por serial está disponible en{' '}
                  <Link to="/rma/consulta" className="font-medium text-ashir-600 hover:text-ashir-700">
                    Consultar garantía
                  </Link>
                  .
                </p>
              )}
            </Card>
          )}

          {/* --- historial inmutable --- */}
          <Card>
            <CardHeader
              title="Historial del pedido"
              subtitle="Registro inmutable: cada cambio agrega un evento, no reemplaza el anterior"
              icon={<History className="size-4" />}
            />
            <div className="p-5">
              <Timeline
                items={o.auditLog.map((event, i) => ({
                  id: event.id,
                  title: event.action,
                  at: fmtDateTime(event.at),
                  actor: event.actor,
                  actorRole: event.actorRole === 'SYSTEM' ? 'Sistema' : event.actorRole,
                  comment: event.comment ?? undefined,
                  tone: i === o.auditLog.length - 1 ? 'ok' : 'tech',
                  current: i === o.auditLog.length - 1,
                }))}
              />
            </div>
          </Card>
        </div>

        {/* ---------------- columna derecha ---------------- */}
        <div className="space-y-4">
          <Card>
            <CardHeader title="Resumen" />
            <div className="p-5">
              <div className="space-y-0.5">
                <DataRow label="Estado" value={<OrderStatusBadge status={o.status} size="sm" />} />
                <DataRow label="Total" value={fmtMoney(o.total)} emphasis />
                <DataRow label="Condición de pago" value={PAYMENT_TERM[o.paymentTerm].label} />
                <DataRow label="Entrega" value={o.deliveryMethod === 'PICKUP' ? 'Retiro en depósito' : 'Envío a domicilio'} />
                <DataRow label="Ejecutivo" value={personName(o.salesRepId)} />
                {customer && <DataRow label="Lista aplicada" value={customer.priceListId.replace('pl_', 'LP-').toUpperCase()} />}
              </div>
              {o.deliveryMethod === 'DELIVERY' && (
                <div className="mt-3 border-t border-ink-100 pt-3">
                  <p className="text-[11px] font-semibold tracking-wide text-ink-500 uppercase">Dirección</p>
                  <p className="mt-1 text-[13px] text-ink-700">{o.deliveryAddress}</p>
                </div>
              )}
              {o.notes && (
                <div className="mt-3 border-t border-ink-100 pt-3">
                  <p className="text-[11px] font-semibold tracking-wide text-ink-500 uppercase">Observaciones</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-ink-700">{o.notes}</p>
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
                    <span className="min-w-0 truncate text-[13px] text-ink-700">{c.name}</span>
                    <Badge tone="ok" size="sm">
                      {c.effect}
                    </Badge>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {o.invoiceIds.length > 0 && customer && (
            <Card>
              <CardHeader title="Facturas asociadas" icon={<FileText className="size-4" />} />
              <ul className="divide-y divide-ink-100 px-5">
                {customer.account.invoices.slice(0, 2).map((invoice) => (
                  <li key={invoice.id} className="flex items-center justify-between gap-2 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-[12px] text-ink-800">{invoice.number}</p>
                      <p className="text-[11px] text-ink-500">Vence el {fmtDate(invoice.dueAt)}</p>
                    </div>
                    <span className="shrink-0 text-[13px] font-medium tabular-nums">{fmtMoney(invoice.total)}</span>
                  </li>
                ))}
              </ul>
              <div className="border-t border-ink-100 px-5 py-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={() => toast.simulated('La descarga de la factura')}
                >
                  Descargar factura
                </Button>
              </div>
            </Card>
          )}

          {o.allowedModifications.includes('CANCEL') && (
            <Button variant="ghost" className="w-full text-bad-600 hover:bg-bad-50" icon={<Ban className="size-4" />} onClick={() => setCancelOpen(true)}>
              Cancelar pedido
            </Button>
          )}

          {!canModify && o.status !== 'CANCELLED' && (
            <Callout tone="neutral" icon={<Info className="size-4" />}>
              Un pedido en estado «{ORDER_STATUS[o.status].label}» ya no admite modificaciones desde el portal. Si
              necesitás un cambio, escribile a {personName(o.salesRepId)}.
            </Callout>
          )}
        </div>
      </div>

      <ModifyOrderDialog open={editing} onClose={() => setEditing(false)} order={o} onSaved={order.refetch} />

      <ConfirmDialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title={`Cancelar el pedido ${o.number}`}
        description={
          <>
            <p>
              El pedido queda cancelado y se libera la reserva de stock. La acción se registra en el historial y no se
              puede revertir desde el portal.
            </p>
            <Textarea
              className="mt-3"
              rows={3}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Motivo de la cancelación (queda en el historial)"
              aria-label="Motivo de la cancelación"
            />
          </>
        }
        confirmLabel="Cancelar el pedido"
        cancelLabel="Volver"
        tone="danger"
        onConfirm={async () => {
          await api.orders.cancel(o.id, cancelReason || 'Cancelado por el cliente desde el portal.', session);
          setCancelOpen(false);
          toast.success(`${o.number} cancelado`);
          order.refetch();
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* modificación inteligente                                            */
/* ------------------------------------------------------------------ */

function ModifyOrderDialog({
  open,
  onClose,
  order,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  order: Order;
  onSaved: () => void;
}) {
  const { session } = useSession();
  const toast = useToast();
  const [items, setItems] = useState(order.items.map((i) => ({ productId: i.productId, sku: i.sku, name: i.name, quantity: i.quantity })));
  const [notes, setNotes] = useState(order.notes ?? '');
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof api.orders.previewChange>> | null>(null);

  useEffect(() => {
    if (open) {
      setItems(order.items.map((i) => ({ productId: i.productId, sku: i.sku, name: i.name, quantity: i.quantity })));
      setNotes(order.notes ?? '');
      setPreview(null);
    }
  }, [open, order]);

  /* Previsualiza el impacto en cada cambio de cantidad. */
  useEffect(() => {
    if (!open) return;
    const changed = items.some((i) => order.items.find((oi) => oi.productId === i.productId)?.quantity !== i.quantity);
    if (!changed) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    api.orders
      .previewChange(order.id, items.map((i) => ({ productId: i.productId, quantity: i.quantity })), session)
      .then((result) => !cancelled && setPreview(result))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [items, open, order, session]);

  const save = useAction(async () =>
    api.orders.update(
      order.id,
      {
        version: order.version,
        items: items.filter((i) => i.quantity > 0).map((i) => ({ productId: i.productId, quantity: i.quantity })),
        notes,
      },
      session,
    ),
  );

  const canChangeQty = order.allowedModifications.includes('CHANGE_QTY');
  const canRemove = order.allowedModifications.includes('REMOVE_ITEM');

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Modificar el pedido ${order.number}`}
      description="Los cambios recalculan las condiciones comerciales. Te avisamos antes de confirmar si el pedido pierde algún beneficio."
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={save.pending}>
            Descartar
          </Button>
          <Button
            loading={save.pending}
            onClick={async () => {
              const updated = await save.run();
              if (updated) {
                toast.success('Pedido actualizado', `Quedó en versión ${updated.version}. El cambio se registró en el historial.`);
                onClose();
                onSaved();
              } else if (save.error) {
                toast.error(
                  save.error instanceof ServiceError && save.error.code === 'ORDER_VERSION_CONFLICT'
                    ? 'El pedido cambió en otra sesión'
                    : 'No pudimos guardar el cambio',
                  save.error.message,
                );
              }
            }}
          >
            Guardar cambios
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <ul className="divide-y divide-ink-100 rounded-lg border border-ink-200">
          {items.map((item) => {
            const original = order.items.find((oi) => oi.productId === item.productId);
            const changed = original && original.quantity !== item.quantity;
            return (
              <li key={item.productId} className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-ink-900">{item.name}</p>
                  <p className="text-[11px] text-ink-400">
                    <code className="font-mono">{item.sku}</code>
                    {changed && (
                      <span className="ml-2 font-medium text-warn-700">
                        {original!.quantity} → {item.quantity}
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <div className="flex h-8 items-center rounded-lg border border-ink-200">
                    <button
                      type="button"
                      disabled={!canChangeQty}
                      onClick={() =>
                        setItems((prev) =>
                          prev.map((i) => (i.productId === item.productId ? { ...i, quantity: Math.max(1, i.quantity - 1) } : i)),
                        )
                      }
                      className="px-2 text-ink-500 transition-colors hover:text-ink-900 disabled:opacity-40"
                      aria-label="Disminuir"
                    >
                      <Minus className="size-3.5" aria-hidden />
                    </button>
                    <Input
                      type="number"
                      min={1}
                      disabled={!canChangeQty}
                      value={item.quantity}
                      onChange={(e) =>
                        setItems((prev) =>
                          prev.map((i) =>
                            i.productId === item.productId
                              ? { ...i, quantity: Math.max(1, Number.parseInt(e.target.value, 10) || 1) }
                              : i,
                          ),
                        )
                      }
                      className="h-8 w-14 border-0 text-center text-[13px] focus:ring-0"
                      aria-label={`Cantidad de ${item.sku}`}
                    />
                    <button
                      type="button"
                      disabled={!canChangeQty}
                      onClick={() =>
                        setItems((prev) => prev.map((i) => (i.productId === item.productId ? { ...i, quantity: i.quantity + 1 } : i)))
                      }
                      className="px-2 text-ink-500 transition-colors hover:text-ink-900 disabled:opacity-40"
                      aria-label="Aumentar"
                    >
                      <Plus className="size-3.5" aria-hidden />
                    </button>
                  </div>
                  {canRemove && (
                    <button
                      type="button"
                      onClick={() => setItems((prev) => prev.filter((i) => i.productId !== item.productId))}
                      className="rounded p-1.5 text-ink-400 transition-colors hover:bg-bad-50 hover:text-bad-600"
                      aria-label={`Quitar ${item.sku}`}
                    >
                      <Minus className="size-3.5" aria-hidden />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        {/* --- consecuencias del cambio --- */}
        {preview && (
          <div className="space-y-2">
            {preview.warnings.map((warning) => (
              <Callout key={warning} tone="warn" icon={<TriangleAlert className="size-4" />}>
                {warning}
              </Callout>
            ))}
            {preview.gainedConditions.length > 0 && (
              <Callout tone="ok" title="El cambio activa nuevas condiciones">
                {preview.gainedConditions.join(', ')}
              </Callout>
            )}
            <div className="flex items-center justify-between rounded-lg border border-ink-200 bg-ink-50 px-3.5 py-2.5 text-[13px]">
              <span className="text-ink-600">Nuevo total estimado</span>
              <span className={cn('font-semibold tabular-nums', num(preview.newTotal) > num(order.total) ? 'text-ink-900' : 'text-ok-700')}>
                {fmtMoney(preview.newTotal)}
                <span className="ml-2 text-xs font-normal text-ink-400">antes {fmtMoney(order.total)}</span>
              </span>
            </div>
          </div>
        )}

        {order.allowedModifications.includes('CHANGE_NOTES') && (
          <div>
            <label htmlFor="mod-notes" className="mb-1.5 block text-[13px] font-medium text-ink-700">
              Observaciones
            </label>
            <Textarea id="mod-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
        )}

        {!canChangeQty && (
          <Callout tone="neutral" icon={<Info className="size-4" />}>
            En el estado actual solo podés actualizar las observaciones o pedirle el cambio a tu ejecutivo.
          </Callout>
        )}
      </div>
    </Dialog>
  );
}
