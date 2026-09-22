/**
 * Decisión de una solicitud de precio especial.
 * El PM aprueba, contraoferta o rechaza, viendo el margen resultante.
 */
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Building2,
  Calculator,
  Check,
  History,
  Paperclip,
  Target,
  TrendingDown,
  X,
} from 'lucide-react';
import { api } from '@/services';
import { useSession } from '@/app/session';
import { useAction, useAsync } from '@/app/hooks';
import { useToast, Dialog } from '@/components/ui/overlays';
import { customerById } from '@/mocks/fixtures/customers';
import { productBySku } from '@/mocks/fixtures/catalog';
import { personName } from '@/mocks/fixtures/people';
import { can } from '@/lib/rbac';
import { cn, fmtDate, fmtDateTime, fmtMoney, fmtNumber, num } from '@/lib/utils';
import { Badge, Button, Card, CardHeader, Field, Input, Skeleton, Textarea } from '@/components/ui/primitives';
import {
  Callout,
  DataRow,
  ErrorState,
  ForbiddenState,
  Mono,
  PageHeader,
  StatGrid,
  StatTile,
  Timeline,
} from '@/components/ui/data';
import { SegmentBadge, SpecialPriceStatusBadge } from '@/components/domain/common';

export function BoSpecialRequestDetail() {
  const { id = '' } = useParams();
  const { session } = useSession();
  const toast = useToast();
  const [action, setAction] = useState<'APPROVE' | 'COUNTER' | 'REJECT' | null>(null);
  const [counterPrice, setCounterPrice] = useState('');
  const [comment, setComment] = useState('');

  const request = useAsync(() => api.specialPrice.get(id, session), [id, session.role]);
  const decide = useAction(async (kind: 'APPROVE' | 'COUNTER' | 'REJECT', price: number, note: string) => {
    if (kind === 'APPROVE') return api.specialPrice.approve(id, session, note);
    if (kind === 'COUNTER') return api.specialPrice.counteroffer(id, price, session, note);
    return api.specialPrice.reject(id, session, note);
  });

  if (request.error) {
    return (
      <Card>
        <ErrorState title="No encontramos la solicitud" description={request.error.message} onRetry={request.refetch} />
      </Card>
    );
  }
  if (request.initialLoading || !request.data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-64 w-full rounded-card" />
      </div>
    );
  }

  const r = request.data;
  const customer = customerById(r.customerId);
  const product = productBySku(r.sku);
  const showMargin = can(session, 'margin:read');
  const canDecide = can(session, 'pricing:manage') && ['SUBMITTED', 'SALES_REVIEW', 'PM_REVIEW'].includes(r.status);

  const cost = num(r.cost);
  const current = num(r.currentPrice);
  const target = num(r.targetPrice);
  const marginAtTarget = target > 0 ? ((target - cost) / target) * 100 : 0;
  const marginAtCurrent = current > 0 ? ((current - cost) / current) * 100 : 0;
  const counter = Number.parseFloat(counterPrice) || 0;
  const marginAtCounter = counter > 0 ? ((counter - cost) / counter) * 100 : 0;

  const totalAtTarget = target * r.quantity;
  const marginUsdAtTarget = (target - cost) * r.quantity;
  const marginUsdAtCurrent = (current - cost) * r.quantity;

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'Solicitudes', href: '/bo/solicitudes' }, { label: r.code }]}
        title={`${r.code} · ${r.customerName}`}
        subtitle={`${r.productName} · ${fmtNumber(r.quantity)} unidades · creada ${fmtDateTime(r.createdAt)}`}
        badge={<SpecialPriceStatusBadge status={r.status} />}
        actions={
          canDecide ? (
            <>
              <Button variant="outline" icon={<X className="size-4" />} onClick={() => setAction('REJECT')}>
                Rechazar
              </Button>
              <Button
                variant="outline"
                icon={<TrendingDown className="size-4" />}
                onClick={() => {
                  setCounterPrice(((target + (current - target) * 0.4)).toFixed(2));
                  setAction('COUNTER');
                }}
              >
                Contraofertar
              </Button>
              <Button icon={<Check className="size-4" />} onClick={() => setAction('APPROVE')}>
                Aprobar
              </Button>
            </>
          ) : undefined
        }
      />

      {!showMargin ? (
        <Card>
          <ForbiddenState scope="margin:read" />
        </Card>
      ) : (
        <>
          {/* ---------- análisis de margen ---------- */}
          <StatGrid cols={4} className="mb-6">
            <StatTile
              label="Precio actual del cliente"
              value={fmtMoney(r.currentPrice)}
              footer={`Margen ${marginAtCurrent.toFixed(1).replace('.', ',')}%`}
            />
            <StatTile
              label="Precio solicitado"
              value={fmtMoney(r.targetPrice)}
              tone="brand"
              footer={`${(((target - current) / Math.max(0.01, current)) * 100).toFixed(1).replace('.', ',')}% respecto del actual`}
            />
            <StatTile
              label="Margen resultante"
              value={`${marginAtTarget.toFixed(1).replace('.', ',')}%`}
              tone={marginAtTarget < 8 ? 'bad' : marginAtTarget < 14 ? 'warn' : 'ok'}
              delta={marginAtTarget - marginAtCurrent}
              deltaLabel="vs. precio actual"
              footer={`Costo simulado ${fmtMoney(r.cost)}`}
            />
            <StatTile
              label="Margen total del negocio"
              value={fmtMoney({ amount: marginUsdAtTarget.toFixed(2), currency: 'USD' })}
              tone={marginUsdAtTarget > 0 ? 'ok' : 'bad'}
              footer={`Facturación ${fmtMoney({ amount: totalAtTarget.toFixed(2), currency: 'USD' })}`}
            />
          </StatGrid>

          {marginAtTarget < 8 && (
            <Callout tone="bad" icon={<TrendingDown className="size-4" />} title="Margen por debajo del piso de la marca" className="mb-5">
              Aprobar a {fmtMoney(r.targetPrice)} deja un margen de {marginAtTarget.toFixed(1).replace('.', ',')}%.
              Considerá contraofertar: a{' '}
              {fmtMoney({ amount: (cost / (1 - 0.12)).toFixed(2), currency: 'USD' })} el margen se ubicaría en el 12%.
            </Callout>
          )}

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="min-w-0 space-y-5">
              {/* ---------- contexto del negocio ---------- */}
              <Card>
                <CardHeader title="Contexto del negocio" icon={<Target className="size-4" />} />
                <div className="p-5">
                  <div className="grid gap-x-6 sm:grid-cols-2">
                    <DataRow label="Cliente final" value={r.endCustomer || '—'} />
                    <DataRow label="Proyecto" value={r.project || '—'} />
                    <DataRow label="Competencia" value={r.competitor ?? 'No declarada'} />
                    <DataRow label="Cierre estimado" value={fmtDate(r.expectedCloseDate)} />
                    <DataRow label="Ejecutivo" value={personName(r.salesRepId)} />
                    <DataRow label="Product Manager" value={personName(r.pmId)} />
                  </div>
                  {r.comments && (
                    <div className="mt-4 rounded-lg bg-ink-50 px-3.5 py-3">
                      <p className="text-[11px] font-semibold tracking-wide text-ink-500 uppercase">
                        Comentarios del reseller
                      </p>
                      <p className="mt-1 text-[13px] leading-relaxed text-ink-700">{r.comments}</p>
                    </div>
                  )}
                  {r.attachments.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {r.attachments.map((file) => (
                        <button
                          key={file.name}
                          type="button"
                          onClick={() => toast.simulated('La descarga del adjunto')}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 px-2.5 py-1.5 text-xs text-ink-700 transition-colors hover:bg-ink-50"
                        >
                          <Paperclip className="size-3.5 text-ink-400" aria-hidden />
                          {file.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </Card>

              {/* ---------- escenarios de precio ---------- */}
              <Card>
                <CardHeader
                  title="Escenarios de precio"
                  subtitle="Margen resultante según el precio que se apruebe"
                  icon={<Calculator className="size-4" />}
                />
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[13px]">
                    <thead>
                      <tr className="border-b border-ink-200 bg-ink-50">
                        <th className="px-5 py-2 font-medium text-ink-500">Escenario</th>
                        <th className="px-5 py-2 text-right font-medium text-ink-500">Precio unitario</th>
                        <th className="px-5 py-2 text-right font-medium text-ink-500">Margen %</th>
                        <th className="px-5 py-2 text-right font-medium text-ink-500">Margen total</th>
                        <th className="px-5 py-2 text-right font-medium text-ink-500">Facturación</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink-100">
                      {[
                        { label: 'Precio actual (sin cambio)', price: current },
                        { label: 'Precio solicitado', price: target, highlight: true },
                        { label: 'Contraoferta al 12% de margen', price: Math.round((cost / 0.88) * 100) / 100 },
                        { label: 'Contraoferta al 15% de margen', price: Math.round((cost / 0.85) * 100) / 100 },
                      ].map((scenario) => {
                        const m = scenario.price > 0 ? ((scenario.price - cost) / scenario.price) * 100 : 0;
                        return (
                          <tr key={scenario.label} className={cn(scenario.highlight && 'bg-ashir-50/50')}>
                            <td className="px-5 py-2.5 font-medium text-ink-800">{scenario.label}</td>
                            <td className="px-5 py-2.5 text-right tabular-nums text-ink-900">
                              {fmtMoney({ amount: scenario.price.toFixed(2), currency: 'USD' })}
                            </td>
                            <td
                              className={cn(
                                'px-5 py-2.5 text-right font-semibold tabular-nums',
                                m < 8 ? 'text-bad-600' : m < 14 ? 'text-warn-700' : 'text-ok-700',
                              )}
                            >
                              {m.toFixed(1).replace('.', ',')}%
                            </td>
                            <td className="px-5 py-2.5 text-right tabular-nums text-ink-700">
                              {fmtMoney({ amount: ((scenario.price - cost) * r.quantity).toFixed(2), currency: 'USD' })}
                            </td>
                            <td className="px-5 py-2.5 text-right tabular-nums text-ink-700">
                              {fmtMoney({ amount: (scenario.price * r.quantity).toFixed(2), currency: 'USD' })}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="border-t border-ink-100 px-5 py-3 text-xs text-ink-500">
                  El costo utilizado ({fmtMoney(r.cost)}) es un valor simulado para la demostración: el archivo de
                  distribuidor no contiene costos. En producción vendría del ERP.
                </p>
              </Card>

              {/* ---------- auditoría ---------- */}
              <Card>
                <CardHeader title="Auditoría de la decisión" icon={<History className="size-4" />} />
                <div className="p-5">
                  <Timeline
                    items={r.auditLog.map((event, i) => ({
                      id: event.id,
                      title: event.action,
                      at: fmtDateTime(event.at),
                      actor: event.actor,
                      actorRole: `${event.actorRole} · ${event.requestId}`,
                      comment: event.comment ?? undefined,
                      tone: i === r.auditLog.length - 1 ? (r.status === 'REJECTED' ? 'bad' : 'ok') : 'tech',
                      current: i === r.auditLog.length - 1,
                    }))}
                  />
                </div>
              </Card>
            </div>

            {/* ---------- panel derecho ---------- */}
            <div className="space-y-4">
              {customer && (
                <Card>
                  <CardHeader
                    title="Cliente"
                    icon={<Building2 className="size-4" />}
                    action={
                      <Link to={`/bo/clientes/${customer.id}`} className="text-[13px] font-medium text-ashir-600 hover:text-ashir-700">
                        Ver ficha
                      </Link>
                    }
                  />
                  <div className="space-y-0.5 p-5">
                    <DataRow label="Segmento" value={<SegmentBadge segment={customer.segment} size="sm" />} />
                    <DataRow label="Compras 12 m" value={fmtMoney(customer.purchases12m, { compact: true })} emphasis />
                    <DataRow label="Frecuencia" value={`cada ~${customer.orderFrequencyDays} días`} />
                    <DataRow label="Lista" value={customer.priceListId.replace('pl_', 'LP-').toUpperCase()} />
                    <DataRow label="Deuda vencida" value={fmtMoney(customer.account.overdue)} />
                    <DataRow label="Marcas top" value={customer.topBrands.join(', ') || '—'} />
                  </div>
                </Card>
              )}

              {product && (
                <Card>
                  <CardHeader title="Producto" />
                  <div className="space-y-0.5 p-5">
                    <DataRow label="SKU" value={<Mono copy>{product.sku}</Mono>} />
                    <DataRow label="Marca" value={product.brand} />
                    <DataRow label="Categoría" value={product.category} />
                    <DataRow label="Stock disponible" value={fmtNumber(product.stock)} />
                    <DataRow
                      label="Cubre la cantidad pedida"
                      value={
                        product.stock >= r.quantity ? (
                          <Badge tone="ok" size="sm">
                            Sí
                          </Badge>
                        ) : (
                          <Badge tone="warn" size="sm">
                            Faltan {r.quantity - product.stock} u.
                          </Badge>
                        )
                      }
                    />
                    <DataRow label="Vendidas 12 m" value={fmtNumber(product.unitsSold12m)} />
                  </div>
                </Card>
              )}

              {r.approvedPrice && (
                <Card>
                  <CardHeader title="Decisión registrada" />
                  <div className="space-y-0.5 p-5">
                    <DataRow label="Precio aprobado" value={fmtMoney(r.approvedPrice)} emphasis />
                    <DataRow label="Cantidad máxima" value={fmtNumber(r.approvedQuantity ?? 0)} />
                    <DataRow label="Vigencia" value={fmtDate(r.approvedValidUntil)} />
                    <DataRow label="Margen final" value={`${r.resultingMarginPct}%`} />
                  </div>
                </Card>
              )}

              {!canDecide && r.status !== 'APPROVED' && r.status !== 'REJECTED' && (
                <Callout tone="neutral">
                  Tu rol puede consultar la solicitud pero no decidir. Cambiá a Product Manager o Administrador para
                  aprobar, contraofertar o rechazar.
                </Callout>
              )}
            </div>
          </div>
        </>
      )}

      {/* ---------- diálogo de decisión ---------- */}
      <Dialog
        open={action !== null}
        onClose={() => setAction(null)}
        title={
          action === 'APPROVE'
            ? `Aprobar ${r.code}`
            : action === 'COUNTER'
              ? `Contraofertar ${r.code}`
              : `Rechazar ${r.code}`
        }
        description={
          action === 'REJECT'
            ? 'El reseller va a recibir el motivo en su portal. La decisión queda auditada.'
            : 'El precio aprobado tiene vigencia de 30 días y una cantidad máxima igual a la solicitada.'
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setAction(null)} disabled={decide.pending}>
              Cancelar
            </Button>
            <Button
              variant={action === 'REJECT' ? 'danger' : 'primary'}
              loading={decide.pending}
              disabled={action === 'REJECT' && comment.trim().length < 10}
              onClick={async () => {
                if (!action) return;
                const result = await decide.run(action, counter, comment);
                setAction(null);
                setComment('');
                if (result) {
                  toast.success(
                    action === 'APPROVE' ? 'Solicitud aprobada' : action === 'COUNTER' ? 'Contraoferta enviada' : 'Solicitud rechazada',
                    'El reseller recibió la notificación en su portal.',
                  );
                  request.refetch();
                } else if (decide.error) {
                  toast.error('No pudimos registrar la decisión', decide.error.message);
                }
              }}
            >
              {action === 'APPROVE' ? 'Aprobar' : action === 'COUNTER' ? 'Enviar contraoferta' : 'Rechazar'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {action === 'COUNTER' && (
            <>
              <Field
                label="Precio ofrecido (USD por unidad)"
                hint={`Margen resultante: ${marginAtCounter.toFixed(1).replace('.', ',')}%`}
                htmlFor="counter-price"
              >
                <Input
                  id="counter-price"
                  type="number"
                  step="0.01"
                  min={0}
                  value={counterPrice}
                  onChange={(e) => setCounterPrice(e.target.value)}
                />
              </Field>
              <div className="grid gap-3 sm:grid-cols-3">
                <StatTile label="Solicitado" value={fmtMoney(r.targetPrice)} />
                <StatTile label="Tu oferta" value={fmtMoney({ amount: counter.toFixed(2), currency: 'USD' })} tone="brand" />
                <StatTile
                  label="Margen"
                  value={`${marginAtCounter.toFixed(1).replace('.', ',')}%`}
                  tone={marginAtCounter < 8 ? 'bad' : marginAtCounter < 14 ? 'warn' : 'ok'}
                />
              </div>
            </>
          )}

          {action === 'APPROVE' && (
            <div className="grid gap-3 sm:grid-cols-3">
              <StatTile label="Precio a aprobar" value={fmtMoney(r.targetPrice)} tone="brand" />
              <StatTile
                label="Margen resultante"
                value={`${marginAtTarget.toFixed(1).replace('.', ',')}%`}
                tone={marginAtTarget < 8 ? 'bad' : marginAtTarget < 14 ? 'warn' : 'ok'}
              />
              <StatTile
                label="Impacto vs. actual"
                value={fmtMoney({ amount: (marginUsdAtTarget - marginUsdAtCurrent).toFixed(2), currency: 'USD' })}
                tone={marginUsdAtTarget - marginUsdAtCurrent < 0 ? 'warn' : 'ok'}
              />
            </div>
          )}

          <Field
            label="Comentario"
            required={action === 'REJECT'}
            hint={action === 'REJECT' ? 'El reseller lo va a leer: explicá el motivo con claridad.' : 'Queda en la auditoría de la solicitud.'}
            htmlFor="decision-comment"
          >
            <Textarea
              id="decision-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              placeholder={
                action === 'REJECT'
                  ? 'El margen resultante queda por debajo del piso de la marca para este volumen…'
                  : 'Aprobado por el volumen y la recurrencia del cliente…'
              }
            />
          </Field>
        </div>
      </Dialog>
    </div>
  );
}
