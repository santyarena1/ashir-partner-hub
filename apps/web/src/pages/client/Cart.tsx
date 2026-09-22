/**
 * Pedido en armado (carrito B2B).
 *
 * No es un checkout de consumidor: muestra condiciones aplicadas, descuentos
 * que faltan alcanzar, crédito, aprobaciones necesarias y resumen impositivo.
 */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  CreditCard,
  Info,
  Minus,
  Package,
  Plus,
  ShieldCheck,
  ShoppingCart,
  Tag,
  Trash2,
  TrendingDown,
  Truck,
  TriangleAlert,
} from 'lucide-react';
import { api } from '@/services';
import { useSession } from '@/app/session';
import { useAction } from '@/app/hooks';
import { useCart } from '@/app/cart';
import { useToast } from '@/components/ui/overlays';
import { customerById } from '@/mocks/fixtures/customers';
import { personName } from '@/mocks/fixtures/people';
import { PAYMENT_TERM } from '@/lib/labels';
import { cn, fmtMoney, fmtNumber, num } from '@/lib/utils';
import { Badge, Button, Card, CardHeader, Field, Input, Segmented, Textarea } from '@/components/ui/primitives';
import { Callout, DataRow, EmptyState, PageHeader } from '@/components/ui/data';
import { ProductTile, StockIndicator } from '@/components/domain/common';

export function CartPage() {
  const { session } = useSession();
  const cart = useCart();
  const toast = useToast();
  const navigate = useNavigate();
  const customer = customerById(session.customerId ?? '');
  const [confirming, setConfirming] = useState(false);

  const submit = useAction(async () => {
    const order = await api.orders.create(
      {
        customerId: session.customerId!,
        items: cart.lines.map((l) => ({ productId: l.productId, quantity: l.quantity })),
        notes: cart.notes || undefined,
        customerPO: cart.customerPO || undefined,
        deliveryMethod: cart.deliveryMethod,
      },
      session,
    );
    return api.orders.submit(order.id, session);
  });

  if (!customer) {
    return <EmptyState title="Elegí una cuenta de reseller para armar un pedido" />;
  }

  const { totals } = cart;

  if (cart.lines.length === 0) {
    return (
      <div>
        <PageHeader title="Pedido en armado" />
        <Card>
          <EmptyState
            title="Tu pedido está vacío"
            description="Podés cargarlo desde el catálogo, repetir un pedido anterior o pegar tu lista completa en Compra rápida."
            icon={<ShoppingCart className="size-5" />}
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Link to="/catalogo">
                  <Button>Ir al catálogo</Button>
                </Link>
                <Link to="/quick-order">
                  <Button variant="outline">Compra rápida</Button>
                </Link>
              </div>
            }
          />
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Pedido en armado"
        subtitle={`${cart.lines.length} SKUs · ${fmtNumber(cart.itemCount)} unidades · precios en USD sin IVA para ${customer.tradeName}`}
        actions={
          <Button variant="ghost" icon={<Trash2 className="size-4" />} onClick={cart.clear}>
            Vaciar pedido
          </Button>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* ---------------- ítems ---------------- */}
        <div className="min-w-0 space-y-5">
          {/* --- inteligencia comercial --- */}
          {totals.missedOpportunities.length > 0 && (
            <div className="space-y-2">
              {totals.missedOpportunities.map((m) => (
                <Callout
                  key={`${m.conditionId}-${m.label}`}
                  tone="warn"
                  icon={<TrendingDown className="size-4" />}
                  title={m.label}
                >
                  {m.message}
                </Callout>
              ))}
            </div>
          )}

          <Card>
            <CardHeader
              title="Productos"
              subtitle="Las condiciones se recalculan en cada cambio de cantidad"
              icon={<Package className="size-4" />}
            />
            <ul className="divide-y divide-ink-100">
              {totals.lines.map(({ line, product, evaluation }) => (
                <li key={line.productId} className="p-4">
                  <div className="flex gap-3.5">
                    <Link to={`/catalogo/${product.sku}`} className="w-16 shrink-0 sm:w-20">
                      <ProductTile product={product} size="sm" />
                    </Link>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <Link
                            to={`/catalogo/${product.sku}`}
                            className="line-clamp-2 text-[13px] font-semibold text-ink-900 hover:text-ashir-700"
                          >
                            {product.name}
                          </Link>
                          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-ink-400">
                            <code className="font-mono">{product.sku}</code>
                            <span>·</span>
                            <span>{product.brand}</span>
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => cart.remove(line.productId)}
                          className="shrink-0 rounded p-1 text-ink-400 transition-colors hover:bg-bad-50 hover:text-bad-600"
                          aria-label={`Quitar ${product.sku}`}
                        >
                          <Trash2 className="size-4" aria-hidden />
                        </button>
                      </div>

                      <StockIndicator product={product} className="mt-1.5" />

                      {/* condiciones de la línea */}
                      {evaluation.appliedConditions.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {evaluation.appliedConditions.map((c) => (
                            <Badge key={c.conditionId} tone="ok" size="sm">
                              {c.name} {c.effect}
                            </Badge>
                          ))}
                        </div>
                      )}

                      {evaluation.bonusUnits > 0 && (
                        <p className="mt-1.5 text-[12px] font-medium text-ok-700">
                          + {evaluation.bonusUnits} unidad(es) bonificadas sin cargo
                        </p>
                      )}

                      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
                        <div className="flex h-9 items-center rounded-lg border border-ink-200">
                          <button
                            type="button"
                            onClick={() => cart.setQuantity(line.productId, line.quantity - 1)}
                            className="px-2.5 text-ink-500 transition-colors hover:text-ink-900"
                            aria-label="Disminuir cantidad"
                          >
                            <Minus className="size-3.5" aria-hidden />
                          </button>
                          <input
                            type="number"
                            min={1}
                            value={line.quantity}
                            onChange={(e) => cart.setQuantity(line.productId, Math.max(1, Number.parseInt(e.target.value, 10) || 1))}
                            className="w-12 border-0 bg-transparent p-0 text-center text-[13px] font-semibold tabular-nums focus:outline-none"
                            aria-label={`Cantidad de ${product.sku}`}
                          />
                          <button
                            type="button"
                            onClick={() => cart.setQuantity(line.productId, line.quantity + 1)}
                            className="px-2.5 text-ink-500 transition-colors hover:text-ink-900"
                            aria-label="Aumentar cantidad"
                          >
                            <Plus className="size-3.5" aria-hidden />
                          </button>
                        </div>

                        <div className="text-right">
                          <p className="text-[11px] text-ink-500">
                            {fmtMoney(evaluation.finalUnitPrice)} c/u
                            {Number.parseFloat(evaluation.totalDiscountPct) < -0.01 && (
                              <span className="ml-1.5 text-ink-400 line-through">{fmtMoney(product.listPrice)}</span>
                            )}
                          </p>
                          <p className="text-[15px] font-semibold tabular-nums text-ink-900">
                            {fmtMoney(evaluation.lineTotal)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          {/* --- datos del pedido --- */}
          <Card>
            <CardHeader title="Datos del pedido" subtitle="Entrega, orden de compra y observaciones" />
            <div className="space-y-4 p-5">
              <Field label="Método de entrega">
                <Segmented
                  value={cart.deliveryMethod}
                  onChange={cart.setDeliveryMethod}
                  options={[
                    { value: 'DELIVERY', label: 'Envío a domicilio' },
                    { value: 'PICKUP', label: 'Retiro en depósito' },
                  ]}
                />
              </Field>

              {cart.deliveryMethod === 'DELIVERY' ? (
                <div className="rounded-lg border border-ink-200 bg-ink-50 px-3.5 py-3">
                  <p className="text-[11px] font-semibold tracking-wide text-ink-500 uppercase">Dirección de entrega</p>
                  <p className="mt-1 text-[13px] text-ink-800">{customer.address}</p>
                  <p className="mt-0.5 text-xs text-ink-500">
                    {customer.city}, {customer.province} · zona {customer.zone}
                  </p>
                  <button
                    type="button"
                    onClick={() => toast.simulated('La edición de la dirección de entrega')}
                    className="mt-2 text-xs font-medium text-ashir-600 underline underline-offset-2 hover:text-ashir-700"
                  >
                    Usar otra dirección
                  </button>
                </div>
              ) : (
                <Callout tone="tech" icon={<Truck className="size-4" />}>
                  Retiro en el depósito de Ashir. Coordinamos el horario cuando el pedido pase a estado «Listo para
                  retirar».
                </Callout>
              )}

              <Field
                label="Orden de compra del cliente"
                hint="Opcional. Se imprime en el remito y en la factura."
                htmlFor="cart-po"
              >
                <Input
                  id="cart-po"
                  value={cart.customerPO}
                  onChange={(e) => cart.setCustomerPO(e.target.value)}
                  placeholder="OC-2291"
                />
              </Field>

              <Field label="Observaciones" htmlFor="cart-notes">
                <Textarea
                  id="cart-notes"
                  value={cart.notes}
                  onChange={(e) => cart.setNotes(e.target.value)}
                  placeholder="Entregar por la mañana, coordinar con el encargado del depósito…"
                  rows={3}
                />
              </Field>
            </div>
          </Card>
        </div>

        {/* ---------------- resumen ---------------- */}
        <div className="space-y-4 lg:sticky lg:top-32 lg:self-start">
          <Card>
            <CardHeader title="Resumen del pedido" />
            <div className="p-5">
              <div className="space-y-0.5">
                <DataRow label={`Subtotal (${cart.lines.length} SKUs)`} value={fmtMoney(totals.subtotal)} />
                <DataRow
                  label="Descuentos aplicados"
                  value={<span className="text-ok-700">− {fmtMoney(totals.discountTotal, { withCode: false })}</span>}
                />
                <DataRow
                  label="Envío"
                  value={
                    num(totals.freight) === 0 ? (
                      <span className="font-medium text-ok-700">Bonificado</span>
                    ) : (
                      fmtMoney(totals.freight)
                    )
                  }
                />
                <DataRow label="IVA" value={fmtMoney(totals.taxTotal)} />
                <div className="mt-2 flex items-baseline justify-between gap-3 border-t border-ink-200 pt-2.5">
                  <span className="text-[13px] font-semibold tracking-wide text-ink-900 uppercase">Total</span>
                  <span className="text-xl font-semibold tabular-nums text-ink-900">{fmtMoney(totals.total)}</span>
                </div>
                <p className="text-[11px] text-ink-400">
                  Equivale a ARS{' '}
                  {(num(totals.total) * 1412).toLocaleString('es-AR', { maximumFractionDigits: 0 })} al tipo de cambio de
                  referencia (BNA venta 1.412).
                </p>
              </div>

              {/* condiciones aplicadas al pedido */}
              {totals.appliedConditions.length > 0 && (
                <div className="mt-4 border-t border-ink-100 pt-3">
                  <p className="mb-2 text-[11px] font-semibold tracking-wide text-ink-500 uppercase">
                    Condiciones aplicadas
                  </p>
                  <ul className="space-y-1.5">
                    {totals.appliedConditions.map((c) => (
                      <li key={c.conditionId} className="flex items-center justify-between gap-2 text-[12px]">
                        <span className="min-w-0 truncate text-ink-600">{c.name}</span>
                        <Badge tone="ok" size="sm">
                          {c.effect}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </Card>

          {/* --- cuenta y crédito --- */}
          <Card>
            <CardHeader title="Cuenta corriente" icon={<CreditCard className="size-4" />} />
            <div className="p-5">
              <div className="space-y-0.5">
                <DataRow label="Condición de pago" value={PAYMENT_TERM[customer.paymentTerm].label} />
                <DataRow label="Crédito disponible" value={fmtMoney(customer.account.creditAvailable)} />
                <DataRow
                  label="Crédito después de este pedido"
                  value={
                    <span className={cn(num(totals.creditAfter) < 0 ? 'font-semibold text-bad-600' : 'text-ink-800')}>
                      {fmtMoney(totals.creditAfter)}
                    </span>
                  }
                  emphasis
                />
                {num(customer.account.overdue) > 0 && (
                  <DataRow
                    label="Deuda vencida"
                    value={<span className="font-semibold text-bad-600">{fmtMoney(customer.account.overdue)}</span>}
                  />
                )}
              </div>
              {totals.creditWarning && (
                <Callout tone={num(totals.creditAfter) < 0 ? 'bad' : 'warn'} icon={<TriangleAlert className="size-4" />} className="mt-3">
                  {totals.creditWarning}
                </Callout>
              )}
            </div>
          </Card>

          {/* --- aprobaciones --- */}
          {totals.requiredApprovals.length > 0 && (
            <Card>
              <CardHeader title="Aprobaciones requeridas" icon={<ShieldCheck className="size-4" />} />
              <ul className="divide-y divide-ink-100 px-5">
                {totals.requiredApprovals.map((approval) => (
                  <li key={approval.label} className="py-3">
                    <p className="text-[13px] font-semibold text-ink-900">{approval.label}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-ink-500">{approval.reason}</p>
                  </li>
                ))}
              </ul>
              <p className="border-t border-ink-100 px-5 py-3 text-xs text-ink-500">
                El pedido se registra igual y queda en estado «Pendiente de aprobación» para que{' '}
                {personName(customer.salesRepId)} lo revise.
              </p>
            </Card>
          )}

          <div className="space-y-2">
            <Button
              size="lg"
              className="w-full"
              loading={submit.pending || confirming}
              onClick={async () => {
                setConfirming(true);
                const order = await submit.run();
                setConfirming(false);
                if (order) {
                  cart.clear();
                  toast.success(`Pedido ${order.number} confirmado`, 'Ya podés seguir su estado desde Mis pedidos.');
                  navigate(`/pedidos/${order.id}`);
                } else if (submit.error) {
                  toast.error('No pudimos confirmar el pedido', submit.error.message);
                }
              }}
            >
              Confirmar pedido
            </Button>
            <Link to="/catalogo" className="block">
              <Button variant="outline" className="w-full">
                Seguir agregando productos
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              icon={<Tag className="size-3.5" />}
              onClick={() => toast.simulated('La solicitud de precio especial sobre el pedido completo')}
            >
              Solicitar precio especial por el pedido
            </Button>
          </div>

          <Callout tone="neutral" icon={<Info className="size-4" />}>
            Al confirmar, el stock queda reservado de forma provisoria hasta la validación comercial. En producción esa
            reserva la resolvería el servicio de stock del ERP.
          </Callout>
        </div>
      </div>
    </div>
  );
}
