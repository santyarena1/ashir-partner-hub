/**
 * Detalle de una solicitud de precio especial, vista del reseller.
 * No expone costo ni margen: eso queda del lado de Ashir.
 */
import { Link, useParams } from 'react-router-dom';
import { CalendarClock, CheckCircle2, Paperclip, ShoppingCart, Target } from 'lucide-react';
import { api } from '@/services';
import { useSession } from '@/app/session';
import { useAsync } from '@/app/hooks';
import { useCart } from '@/app/cart';
import { useToast } from '@/components/ui/overlays';
import { personName } from '@/mocks/fixtures/people';
import { fmtDate, fmtDateTime, fmtMoney, fmtNumber, fmtRelative, num } from '@/lib/utils';
import { Button, Card, CardHeader, Skeleton } from '@/components/ui/primitives';
import { Callout, DataRow, ErrorState, PageHeader, Timeline } from '@/components/ui/data';
import { SpecialPriceStatusBadge } from '@/components/domain/common';

export function SpecialPriceDetailPage() {
  const { id = '' } = useParams();
  const { session } = useSession();
  const cart = useCart();
  const toast = useToast();

  const request = useAsync(() => api.specialPrice.get(id, session), [id, session.customerId]);

  if (request.error) {
    return (
      <Card>
        <ErrorState title="No pudimos abrir la solicitud" description={request.error.message} onRetry={request.refetch} />
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
  const savingPerUnit = num(r.currentPrice) - num(r.approvedPrice ?? r.targetPrice);
  const totalSaving = savingPerUnit * (r.approvedQuantity ?? r.quantity);
  const expired = r.approvedValidUntil ? new Date(r.approvedValidUntil).getTime() < Date.now() : false;

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'Precios especiales', href: '/precio-especial' }, { label: r.code }]}
        title={`Solicitud ${r.code}`}
        subtitle={`Creada el ${fmtDateTime(r.createdAt)} · ${fmtRelative(r.createdAt)}`}
        badge={<SpecialPriceStatusBadge status={r.status} />}
      />

      {r.status === 'APPROVED' && r.approvedPrice && (
        <Callout
          tone={expired ? 'neutral' : 'ok'}
          icon={<CheckCircle2 className="size-4" />}
          title={expired ? 'El precio aprobado venció' : 'Precio aprobado y vigente'}
          className="mb-5"
          action={
            !expired && (
              <Button
                size="sm"
                icon={<ShoppingCart className="size-3.5" />}
                onClick={() => {
                  const result = cart.add(r.productId, r.approvedQuantity ?? r.quantity);
                  if (result.ok) toast.success('Agregado al pedido', 'El precio especial se aplica al confirmar el pedido.');
                }}
              >
                Cargar al pedido
              </Button>
            )
          }
        >
          {fmtMoney(r.approvedPrice)} por unidad, hasta {fmtNumber(r.approvedQuantity ?? r.quantity)} unidades, con
          vigencia hasta el {fmtDate(r.approvedValidUntil)}.
        </Callout>
      )}

      {r.status === 'COUNTEROFFERED' && r.approvedPrice && (
        <Callout tone="tech" title="Recibiste una contraoferta" className="mb-5">
          Ashir ofrece {fmtMoney(r.approvedPrice)} por unidad en lugar de los {fmtMoney(r.targetPrice)} solicitados.
          Podés aceptarla cargando el producto al pedido o conversarlo con {personName(r.salesRepId)}.
        </Callout>
      )}

      {r.status === 'REJECTED' && (
        <Callout tone="bad" title="La solicitud fue rechazada" className="mb-5">
          {r.auditLog[r.auditLog.length - 1]?.comment ??
            'El precio solicitado queda por debajo del piso de margen de la marca.'}
        </Callout>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-5">
          <Card>
            <CardHeader title="Producto solicitado" />
            <div className="p-5">
              <Link to={`/catalogo/${r.sku}`} className="text-[15px] font-semibold text-ink-900 hover:text-ashir-700">
                {r.productName}
              </Link>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-ink-500">
                <code className="font-mono">{r.sku}</code>
                <span>{r.brand}</span>
              </p>

              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <div className="rounded-lg border border-ink-200 bg-ink-50 px-3.5 py-3">
                  <p className="text-[11px] font-semibold tracking-wide text-ink-500 uppercase">Tu precio actual</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums text-ink-900">{fmtMoney(r.currentPrice)}</p>
                </div>
                <div className="rounded-lg border border-ashir-200 bg-ashir-50 px-3.5 py-3">
                  <p className="text-[11px] font-semibold tracking-wide text-ashir-700 uppercase">Precio solicitado</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums text-ashir-800">{fmtMoney(r.targetPrice)}</p>
                </div>
                <div
                  className={
                    r.approvedPrice
                      ? 'rounded-lg border border-ok-200 bg-ok-50 px-3.5 py-3'
                      : 'rounded-lg border border-dashed border-ink-200 px-3.5 py-3'
                  }
                >
                  <p className="text-[11px] font-semibold tracking-wide text-ink-500 uppercase">Precio aprobado</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums text-ink-900">
                    {r.approvedPrice ? fmtMoney(r.approvedPrice) : 'Pendiente'}
                  </p>
                </div>
              </div>

              <dl className="mt-4 divide-y divide-ink-100 border-t border-ink-100 pt-2">
                <DataRow label="Cantidad solicitada" value={`${fmtNumber(r.quantity)} unidades`} />
                {r.approvedQuantity && <DataRow label="Cantidad aprobada" value={`${fmtNumber(r.approvedQuantity)} unidades`} />}
                <DataRow label="Cliente final" value={r.endCustomer || '—'} />
                <DataRow label="Proyecto" value={r.project || '—'} />
                <DataRow label="Competencia declarada" value={r.competitor ?? 'Sin competencia identificada'} />
                <DataRow
                  label="Cierre estimado"
                  value={
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarClock className="size-3.5 text-ink-400" aria-hidden />
                      {fmtDate(r.expectedCloseDate)}
                    </span>
                  }
                />
              </dl>

              {r.comments && (
                <div className="mt-4 rounded-lg bg-ink-50 px-3.5 py-3">
                  <p className="text-[11px] font-semibold tracking-wide text-ink-500 uppercase">Comentarios</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-ink-700">{r.comments}</p>
                </div>
              )}

              {r.attachments.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {r.attachments.map((file) => (
                    <button
                      key={file.name}
                      type="button"
                      onClick={() => toast.simulated('La descarga del adjunto')}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 px-2.5 py-1.5 text-xs text-ink-700 transition-colors hover:bg-ink-50"
                    >
                      <Paperclip className="size-3.5 text-ink-400" aria-hidden />
                      {file.name}
                      <span className="text-ink-400">{file.size}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Seguimiento de la solicitud" subtitle="Cada decisión queda auditada" />
            <div className="p-5">
              <Timeline
                items={r.auditLog.map((event, i) => ({
                  id: event.id,
                  title: event.action,
                  at: fmtDateTime(event.at),
                  actor: event.actor,
                  actorRole:
                    event.actorRole === 'CLIENT'
                      ? 'Cliente'
                      : event.actorRole === 'SALES'
                        ? 'Comercial'
                        : event.actorRole === 'PM'
                          ? 'Product Manager'
                          : String(event.actorRole),
                  comment: event.comment ?? undefined,
                  tone: i === r.auditLog.length - 1 ? (r.status === 'REJECTED' ? 'bad' : 'ok') : 'tech',
                  current: i === r.auditLog.length - 1,
                }))}
              />
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Impacto para tu negocio" icon={<Target className="size-4" />} />
            <div className="p-5">
              <div className="space-y-0.5">
                <DataRow
                  label="Ahorro por unidad"
                  value={
                    savingPerUnit > 0 ? (
                      <span className="font-semibold text-ok-700">
                        {fmtMoney({ amount: savingPerUnit.toFixed(2), currency: 'USD' })}
                      </span>
                    ) : (
                      '—'
                    )
                  }
                />
                <DataRow
                  label="Ahorro total"
                  value={
                    totalSaving > 0 ? (
                      <span className="font-semibold text-ok-700">
                        {fmtMoney({ amount: totalSaving.toFixed(2), currency: 'USD' })}
                      </span>
                    ) : (
                      '—'
                    )
                  }
                  emphasis
                />
                <DataRow
                  label="Descuento efectivo"
                  value={
                    num(r.currentPrice) > 0
                      ? `${(((num(r.approvedPrice ?? r.targetPrice) - num(r.currentPrice)) / num(r.currentPrice)) * 100)
                          .toFixed(1)
                          .replace('.', ',')}%`
                      : '—'
                  }
                />
              </div>
              {/* El costo y el margen de Ashir no se exponen al cliente. */}
              <p className="mt-3 border-t border-ink-100 pt-3 text-[11px] leading-relaxed text-ink-400">
                El análisis de margen se realiza del lado de Ashir y no forma parte de esta vista.
              </p>
            </div>
          </Card>

          <Card>
            <CardHeader title="Responsables" />
            <div className="space-y-0.5 p-5">
              <DataRow label="Tu ejecutivo" value={personName(r.salesRepId)} />
              <DataRow label="Product Manager" value={personName(r.pmId)} />
              <DataRow label="Última actualización" value={fmtRelative(r.updatedAt)} />
            </div>
          </Card>

          {r.approvedPrice && !expired && (
            <Button
              className="w-full"
              size="lg"
              icon={<ShoppingCart className="size-4" />}
              onClick={() => {
                const result = cart.add(r.productId, r.approvedQuantity ?? r.quantity);
                if (result.ok) toast.success('Agregado al pedido', 'El precio especial se aplica al confirmar.');
              }}
            >
              Cargar al pedido
            </Button>
          )}

          {(r.status === 'PM_REVIEW' || r.status === 'SALES_REVIEW' || r.status === 'SUBMITTED') && (
            <Callout tone="tech">
              Estamos revisando tu pedido. Vas a recibir una notificación en el portal cuando haya una decisión, con el
              precio aprobado, la cantidad máxima y la vigencia.
            </Callout>
          )}
        </div>
      </div>
    </div>
  );
}
