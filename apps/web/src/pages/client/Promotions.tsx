/**
 * Promociones y condiciones comerciales visibles para el reseller.
 * Muestra qué aplica a su segmento y qué requisitos faltan cumplir.
 */
import { Link } from 'react-router-dom';
import { CalendarClock, CheckCircle2, Info, Lock, Package } from 'lucide-react';
import { api } from '@/services';
import { useSession } from '@/app/session';
import { useAsync } from '@/app/hooks';
import { customerById } from '@/mocks/fixtures/customers';
import { CONDITION_ACTION, CONDITION_SCOPE, OPERATOR_LABEL } from '@/lib/labels';
import { fmtDate, fmtRelative } from '@/lib/utils';
import { Badge, Button, Card, Skeleton } from '@/components/ui/primitives';
import { Callout, EmptyState, PageHeader, SectionTitle } from '@/components/ui/data';

export function PromotionsPage() {
  const { session } = useSession();
  const customer = customerById(session.customerId ?? '');
  const { data: conditions, initialLoading } = useAsync(() => api.pricing.listConditions({}), []);

  const promotions = (conditions ?? []).filter((c) => c.kind === 'PROMOTION');
  const active = promotions.filter((c) => c.status === 'ACTIVE');
  const scheduled = promotions.filter((c) => c.status === 'SCHEDULED');
  const structural = (conditions ?? []).filter((c) => c.kind === 'CONDITION' && c.status === 'ACTIVE');

  /** ¿La promoción alcanza al segmento del cliente? */
  const appliesToMe = (criteria: { scope: string; values: string[] }[]) => {
    if (!customer) return true;
    const segment = criteria.find((c) => c.scope === 'SEGMENT');
    if (segment && !segment.values.includes(customer.segment)) return false;
    const zone = criteria.find((c) => c.scope === 'ZONE');
    if (zone && !zone.values.includes(customer.zone)) return false;
    return true;
  };

  return (
    <div>
      <PageHeader
        title="Promociones y condiciones"
        subtitle="Todo lo que hoy puede mejorar el precio de tu pedido, con sus requisitos y vigencias."
      />

      {customer && (
        <Callout tone="tech" icon={<Info className="size-4" />} className="mb-6">
          Estás viendo las condiciones aplicables a <strong>{customer.tradeName}</strong> — zona{' '}
          {customer.zone}, condición de pago habitual{' '}
          {customer.paymentTerm === 'CASH' ? 'contado' : customer.paymentTerm.toLowerCase().replace('_', ' ')}. Los
          descuentos se aplican automáticamente al armar el pedido.
        </Callout>
      )}

      {initialLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-52 w-full rounded-card" />
          ))}
        </div>
      ) : (
        <>
          <section className="mb-8">
            <SectionTitle title="Promociones vigentes" subtitle={`${active.length} activas en este momento`} />
            {active.length === 0 ? (
              <Card>
                <EmptyState title="No hay promociones activas" icon={<Package className="size-5" />} />
              </Card>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {active.map((promo) => {
                  const eligible = appliesToMe(promo.criteria);
                  return (
                    <Card key={promo.id} id={promo.code} className="flex flex-col p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <code className="rounded bg-ashir-50 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-ashir-700">
                            {promo.code}
                          </code>
                          <h3 className="mt-2 text-base font-semibold text-ink-900">{promo.name}</h3>
                        </div>
                        {eligible ? (
                          <Badge tone="ok" dot>
                            Aplicable a tu cuenta
                          </Badge>
                        ) : (
                          <Badge tone="neutral">
                            <Lock className="size-3" aria-hidden /> No aplicable
                          </Badge>
                        )}
                      </div>

                      <p className="mt-2 text-[13px] leading-relaxed text-ink-600">{promo.description}</p>

                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {promo.actions.map((action) => (
                          <Badge key={action.type} tone="brand">
                            {action.label}
                          </Badge>
                        ))}
                      </div>

                      <div className="mt-4 space-y-1.5 border-t border-ink-100 pt-3">
                        <p className="text-[11px] font-semibold tracking-wide text-ink-500 uppercase">Requisitos</p>
                        <ul className="space-y-1">
                          {promo.criteria.map((criterion, i) => (
                            <li key={i} className="flex items-start gap-2 text-[13px] text-ink-700">
                              <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-ok-500" aria-hidden />
                              <span>
                                <span className="text-ink-500">{CONDITION_SCOPE[criterion.scope as keyof typeof CONDITION_SCOPE]}</span>{' '}
                                {OPERATOR_LABEL[criterion.operator] ?? criterion.operator}{' '}
                                <span className="font-medium">{criterion.values.join(', ')}</span>
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {promo.exclusions.length > 0 && (
                        <p className="mt-2.5 text-xs text-bad-600">
                          Excluye: {promo.exclusions.join(', ')}
                        </p>
                      )}

                      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 pt-3 text-xs text-ink-500">
                        <span className="flex items-center gap-1.5">
                          <CalendarClock className="size-3.5" aria-hidden />
                          Hasta el {fmtDate(promo.validTo)} · {fmtRelative(promo.validTo)}
                        </span>
                        <span className="flex items-center gap-2">
                          {!promo.stackable && <Badge tone="warn" size="sm">No acumulable</Badge>}
                          {promo.usageLimit && (
                            <span className="tabular-nums">
                              {promo.usageCount}/{promo.usageLimit} usos
                            </span>
                          )}
                        </span>
                      </div>

                      {eligible && (
                        <Link to={`/catalogo?promotionId=${promo.id}`} className="mt-3">
                          <Button variant="outline" size="sm" className="w-full">
                            Ver productos de la promoción
                          </Button>
                        </Link>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
          </section>

          {scheduled.length > 0 && (
            <section className="mb-8">
              <SectionTitle title="Próximamente" subtitle="Promociones programadas que todavía no están vigentes" />
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {scheduled.map((promo) => (
                  <Card key={promo.id} className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <code className="rounded bg-ink-100 px-1.5 py-0.5 font-mono text-[11px] text-ink-600">{promo.code}</code>
                      <Badge tone="tech" size="sm">
                        Programada
                      </Badge>
                    </div>
                    <p className="mt-2 text-[13px] font-semibold text-ink-900">{promo.name}</p>
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink-500">{promo.description}</p>
                    <p className="mt-2.5 text-xs text-ink-500">
                      Desde el <span className="font-medium text-ink-800">{fmtDate(promo.validFrom)}</span>
                    </p>
                  </Card>
                ))}
              </div>
            </section>
          )}

          <section>
            <SectionTitle
              title="Condiciones comerciales permanentes"
              subtitle="Reglas estructurales que se aplican todo el año"
            />
            <div className="overflow-hidden rounded-card border border-ink-200 bg-white">
              <ul className="divide-y divide-ink-100">
                {structural.map((condition) => (
                  <li key={condition.id} className="flex flex-wrap items-start justify-between gap-4 px-5 py-4">
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 text-[13px] font-semibold text-ink-900">
                        {condition.name}
                        <code className="rounded bg-ink-100 px-1.5 py-0.5 font-mono text-[11px] font-normal text-ink-500">
                          {condition.code}
                        </code>
                        {condition.stackable && (
                          <Badge tone="ok" size="sm">
                            Acumulable
                          </Badge>
                        )}
                      </p>
                      <p className="mt-1 text-[13px] leading-relaxed text-ink-500">{condition.description}</p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-1.5">
                      {condition.actions.map((action) => (
                        <Badge key={action.type} tone="tech" size="sm">
                          {CONDITION_ACTION[action.type]}
                        </Badge>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
