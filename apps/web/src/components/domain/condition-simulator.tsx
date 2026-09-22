/**
 * Simulador del motor de condiciones.
 *
 *   cliente + producto + cantidad + fecha + pago → precio final explicado
 *
 * No devuelve sólo un número: lista qué condiciones se aplicaron, cuáles no
 * y por qué, más el margen resultante para los roles autorizados.
 */
import { useEffect, useState } from 'react';
import { CheckCircle2, FlaskConical, XCircle } from 'lucide-react';
import type { ConditionSimulationResult, PaymentTerm } from '@/types';
import { api } from '@/services';
import { useSession } from '@/app/session';
import { useAction } from '@/app/hooks';
import { Dialog } from '@/components/ui/overlays';
import { CUSTOMERS } from '@/mocks/fixtures/customers';
import { SELLABLE_PRODUCTS, productBySku } from '@/mocks/fixtures/catalog';
import { PAYMENT_TERM } from '@/lib/labels';
import { can } from '@/lib/rbac';
import { cn, fmtMoney, fmtNumber, num } from '@/lib/utils';
import { Badge, Button, Field, Input, Select, Skeleton } from '@/components/ui/primitives';
import { Callout, DataRow, StatTile } from '@/components/ui/data';

export function ConditionSimulator({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { session } = useSession();
  const [customerId, setCustomerId] = useState('cus_gaming_store');
  const [sku, setSku] = useState('MSMOPRB650MB');
  const [quantity, setQuantity] = useState(10);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentTerm, setPaymentTerm] = useState<PaymentTerm>('TRANSFER_7');
  const [result, setResult] = useState<ConditionSimulationResult | null>(null);

  const simulate = useAction(async () => {
    const product = productBySku(sku);
    if (!product) throw new Error('SKU inexistente');
    const output = await api.pricing.simulateCondition({
      customerId,
      productId: product.id,
      quantity,
      date: new Date(date).toISOString(),
      paymentTerm,
    });
    setResult(output);
    return output;
  });

  /* Simula automáticamente al abrir y en cada cambio de parámetro. */
  useEffect(() => {
    if (!open) return;
    void simulate.run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, customerId, sku, quantity, date, paymentTerm]);

  const product = productBySku(sku);
  const showMargin = can(session, 'margin:read');
  const evaluation = result?.evaluation;
  const cost = product?.cost ? num(product.cost) : null;
  const finalUnit = evaluation ? num(evaluation.finalUnitPrice) : 0;
  const margin = cost !== null && finalUnit > 0 ? ((finalUnit - cost) / finalUnit) * 100 : null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Simulador de condiciones comerciales"
      description="Elegí un cliente, un producto, una cantidad, una fecha y una condición de pago para ver el precio final explicado."
      size="xl"
      footer={
        <Button variant="outline" onClick={onClose}>
          Cerrar
        </Button>
      }
    >
      <div className="space-y-5">
        {/* ---------- parámetros ---------- */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Cliente" htmlFor="sim-customer">
            <Select id="sim-customer" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              {CUSTOMERS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.tradeName} · {c.segment} · {c.zone}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Producto" htmlFor="sim-sku">
            <Select id="sim-sku" value={sku} onChange={(e) => setSku(e.target.value)}>
              {SELLABLE_PRODUCTS.slice(0, 80).map((p) => (
                <option key={p.sku} value={p.sku}>
                  {p.sku} · {p.name.slice(0, 38)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Cantidad" htmlFor="sim-qty">
            <Input
              id="sim-qty"
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Number.parseInt(e.target.value, 10) || 1))}
            />
          </Field>
          <Field label="Fecha de evaluación" htmlFor="sim-date">
            <Input id="sim-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Condición de pago" htmlFor="sim-payment">
            <Select id="sim-payment" value={paymentTerm} onChange={(e) => setPaymentTerm(e.target.value as PaymentTerm)}>
              {(Object.keys(PAYMENT_TERM) as PaymentTerm[]).map((term) => (
                <option key={term} value={term}>
                  {PAYMENT_TERM[term].label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="&nbsp;">
            <Button
              className="w-full"
              icon={<FlaskConical className="size-4" />}
              loading={simulate.pending}
              onClick={() => void simulate.run()}
            >
              Recalcular
            </Button>
          </Field>
        </div>

        {/* ---------- resultado ---------- */}
        {simulate.pending && !result ? (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full rounded-lg" />
            <Skeleton className="h-40 w-full rounded-lg" />
          </div>
        ) : evaluation ? (
          <>
            <div className={cn('grid gap-3', showMargin ? 'sm:grid-cols-4' : 'sm:grid-cols-3')}>
              <StatTile label="Precio de lista" value={fmtMoney(evaluation.basePrice)} />
              <StatTile
                label="Precio final unitario"
                value={fmtMoney(evaluation.finalUnitPrice)}
                tone="ok"
                footer={`${Number.parseFloat(evaluation.totalDiscountPct).toFixed(2).replace('.', ',')}% de descuento total`}
              />
              <StatTile
                label={`Total por ${fmtNumber(quantity)} u.`}
                value={fmtMoney(evaluation.lineTotal)}
                footer={evaluation.freeFreight ? 'Con envío bonificado' : undefined}
              />
              {showMargin && (
                <StatTile
                  label="Margen resultante"
                  value={margin !== null ? `${margin.toFixed(1).replace('.', ',')}%` : '—'}
                  tone={margin === null ? 'neutral' : margin < 10 ? 'bad' : margin < 15 ? 'warn' : 'ok'}
                  footer={cost !== null ? `Costo simulado ${fmtMoney({ amount: cost.toFixed(2), currency: 'USD' })}` : undefined}
                />
              )}
            </div>

            {/* --- desglose --- */}
            <div className="rounded-lg border border-ink-200 bg-white p-4">
              <h3 className="mb-3 text-[13px] font-semibold text-ink-900">Desglose del precio</h3>
              <div className="space-y-1.5 font-mono text-[12px]">
                <div className="flex justify-between gap-3">
                  <span className="text-ink-500">Precio lista distribuidor</span>
                  <span className="tabular-nums text-ink-700">{fmtNumber(num(evaluation.basePrice), 2)}</span>
                </div>
                {evaluation.adjustments.map((adj, i) => (
                  <div key={i} className="flex justify-between gap-3">
                    <span className="min-w-0 flex-1 truncate text-ink-500" title={adj.note ?? adj.label}>
                      {adj.label}
                    </span>
                    <span className="shrink-0 tabular-nums text-ok-700">
                      {adj.percentage ? `${Number.parseFloat(adj.percentage).toFixed(2).replace('.', ',')}%` : fmtNumber(Number.parseFloat(adj.amount), 2)}
                    </span>
                  </div>
                ))}
                <div className="flex items-baseline justify-between gap-3 border-t border-ink-200 pt-2">
                  <span className="font-sans text-[13px] font-semibold tracking-wide text-ink-900 uppercase">
                    Precio final
                  </span>
                  <span className="font-sans text-base font-semibold tabular-nums text-ink-900">
                    {fmtMoney(evaluation.finalUnitPrice)}
                  </span>
                </div>
              </div>
              <p className="mt-3 border-t border-ink-100 pt-2.5 text-[12px] leading-relaxed text-ink-500">
                {evaluation.explanation}
              </p>
            </div>

            {/* --- condiciones aplicadas / descartadas --- */}
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-ok-200 bg-ok-50/40 p-4">
                <h3 className="mb-2.5 flex items-center gap-2 text-[13px] font-semibold text-ok-800">
                  <CheckCircle2 className="size-4" aria-hidden />
                  Condiciones aplicadas ({result!.appliedConditions.length})
                </h3>
                {result!.appliedConditions.length === 0 ? (
                  <p className="text-[13px] text-ink-500">Ninguna condición modifica el precio en este escenario.</p>
                ) : (
                  <ul className="space-y-2">
                    {result!.appliedConditions.map((c) => (
                      <li key={c.conditionId} className="flex items-start justify-between gap-2">
                        <span className="min-w-0">
                          <span className="block text-[13px] font-medium text-ink-900">{c.name}</span>
                          <code className="font-mono text-[11px] text-ink-400">{c.code}</code>
                        </span>
                        <Badge tone="ok" size="sm">
                          {c.effect}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="rounded-lg border border-ink-200 bg-ink-50 p-4">
                <h3 className="mb-2.5 flex items-center gap-2 text-[13px] font-semibold text-ink-700">
                  <XCircle className="size-4" aria-hidden />
                  No se aplicaron ({result!.skippedConditions.length})
                </h3>
                {result!.skippedConditions.length === 0 ? (
                  <p className="text-[13px] text-ink-500">Todas las condiciones vigentes aplicaron.</p>
                ) : (
                  <ul className="max-h-56 space-y-2 overflow-y-auto pr-1">
                    {result!.skippedConditions.map((c) => (
                      <li key={c.conditionId}>
                        <p className="text-[13px] font-medium text-ink-800">{c.name}</p>
                        <p className="mt-0.5 text-xs leading-relaxed text-ink-500">{c.reason}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* --- oportunidades y escalones --- */}
            {evaluation.missedOpportunities.length > 0 && (
              <div className="space-y-2">
                {evaluation.missedOpportunities.map((m) => (
                  <Callout key={`${m.conditionId}-${m.potentialPct}`} tone="warn" title={m.label}>
                    {m.message}
                  </Callout>
                ))}
              </div>
            )}

            {evaluation.tiers.length > 1 && (
              <div className="rounded-lg border border-ink-200 p-4">
                <h3 className="mb-2.5 text-[13px] font-semibold text-ink-900">Escalones por cantidad</h3>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {evaluation.tiers.map((tier) => (
                    <div
                      key={tier.minQty}
                      className={cn(
                        'rounded-lg border px-3 py-2.5',
                        quantity >= tier.minQty && (tier.maxQty === null || quantity <= tier.maxQty)
                          ? 'border-ashir-300 bg-ashir-50'
                          : 'border-ink-200',
                      )}
                    >
                      <p className="text-[11px] font-semibold tracking-wide text-ink-500 uppercase">
                        {tier.maxQty ? `${tier.minQty}–${tier.maxQty} u.` : `${tier.minQty}+ u.`}
                      </p>
                      <p className="mt-1 text-[15px] font-semibold tabular-nums text-ink-900">{fmtMoney(tier.unitPrice)}</p>
                      <p className="text-[11px] text-ok-700">
                        {Number.parseFloat(tier.discountPct).toFixed(2).replace('.', ',')}%
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {evaluation.requiresApproval.length > 0 && (
              <Callout tone="warn" title="Este escenario requiere autorización">
                {evaluation.requiresApproval.map((a) => a.label).join(', ')}. El pedido quedaría pendiente de aprobación
                del Product Manager.
              </Callout>
            )}

            {/* --- datos de contexto --- */}
            <div className="rounded-lg border border-ink-200 p-4">
              <h3 className="mb-2 text-[13px] font-semibold text-ink-900">Contexto de la simulación</h3>
              <div className="grid gap-x-6 sm:grid-cols-2">
                <DataRow label="Lista aplicada" value={CUSTOMERS.find((c) => c.id === customerId)?.priceListId.replace('pl_', 'LP-').toUpperCase() ?? '—'} />
                <DataRow label="Segmento" value={CUSTOMERS.find((c) => c.id === customerId)?.segment ?? '—'} />
                <DataRow label="Zona" value={CUSTOMERS.find((c) => c.id === customerId)?.zone ?? '—'} />
                <DataRow label="Marca / categoría" value={product ? `${product.brand} · ${product.category}` : '—'} />
                <DataRow label="Stock disponible" value={product ? fmtNumber(product.stock) : '—'} />
                <DataRow label="Puntos Ashir" value={`x${evaluation.pointsMultiplier}`} />
              </div>
            </div>
          </>
        ) : simulate.error ? (
          <Callout tone="bad" title="No pudimos simular">
            {simulate.error.message}
          </Callout>
        ) : null}
      </div>
    </Dialog>
  );
}
