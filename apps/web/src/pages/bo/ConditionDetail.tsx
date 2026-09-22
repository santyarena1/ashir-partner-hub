/**
 * Detalle de una condición comercial, con acciones de ciclo de vida.
 */
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, FlaskConical, Pause, Play, Tag, XCircle } from 'lucide-react';
import { api } from '@/services';
import { useAction, useAsync } from '@/app/hooks';
import { useToast } from '@/components/ui/overlays';
import { PRODUCTS, productBySku } from '@/mocks/fixtures/catalog';
import { CONDITION_ACTION, CONDITION_SCOPE, OPERATOR_LABEL } from '@/lib/labels';
import { fmtDate, fmtDateTime, fmtNumber, fmtRelative } from '@/lib/utils';
import { Badge, Button, Card, CardHeader, ProgressBar, Skeleton } from '@/components/ui/primitives';
import { Callout, DataRow, ErrorState, Mono, PageHeader } from '@/components/ui/data';
import { ConditionSimulator } from '@/components/domain/condition-simulator';

export function BoConditionDetail() {
  const { id = '' } = useParams();
  const toast = useToast();
  const [simulatorOpen, setSimulatorOpen] = useState(false);

  const condition = useAsync(() => api.pricing.getCondition(id), [id]);
  const update = useAction((patch: Parameters<typeof api.pricing.updateCondition>[1]) =>
    api.pricing.updateCondition(condition.data?.id ?? id, patch),
  );

  if (condition.error) {
    return (
      <Card>
        <ErrorState title="No encontramos la condición" description={condition.error.message} onRetry={condition.refetch} />
      </Card>
    );
  }
  if (condition.initialLoading || !condition.data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-64 w-full rounded-card" />
      </div>
    );
  }

  const c = condition.data;

  /** SKUs que la condición podría alcanzar, según sus criterios de producto. */
  const brandValues = c.criteria.find((cr) => cr.scope === 'BRAND')?.values ?? [];
  const categoryValues = c.criteria.find((cr) => cr.scope === 'CATEGORY')?.values ?? [];
  const reach = PRODUCTS.filter(
    (p) =>
      (brandValues.length === 0 || brandValues.includes(p.brand)) &&
      (categoryValues.length === 0 || categoryValues.includes(p.category)) &&
      !c.exclusions.includes(p.sku),
  );

  const isActive = c.status === 'ACTIVE';
  const usagePct = c.usageLimit ? (c.usageCount / c.usageLimit) * 100 : 0;

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'Condiciones comerciales', href: '/bo/condiciones' }, { label: c.code }]}
        title={c.name}
        subtitle={c.description}
        badge={
          <span className="flex flex-wrap items-center gap-2">
            <Mono>{c.code}</Mono>
            <Badge
              tone={c.status === 'ACTIVE' ? 'ok' : c.status === 'SCHEDULED' ? 'tech' : c.status === 'EXPIRED' ? 'neutral' : 'warn'}
              dot
            >
              {c.status === 'ACTIVE'
                ? 'Vigente'
                : c.status === 'SCHEDULED'
                  ? 'Programada'
                  : c.status === 'DRAFT'
                    ? 'Borrador'
                    : c.status === 'PAUSED'
                      ? 'Pausada'
                      : 'Vencida'}
            </Badge>
            <Badge tone={c.kind === 'PROMOTION' ? 'brand' : 'neutral'}>
              {c.kind === 'PROMOTION' ? 'Promoción' : 'Condición permanente'}
            </Badge>
          </span>
        }
        actions={
          <>
            <Button variant="outline" icon={<FlaskConical className="size-4" />} onClick={() => setSimulatorOpen(true)}>
              Simular
            </Button>
            {c.status !== 'EXPIRED' && (
              <Button
                variant={isActive ? 'outline' : 'primary'}
                icon={isActive ? <Pause className="size-4" /> : <Play className="size-4" />}
                loading={update.pending}
                onClick={async () => {
                  const next = isActive ? 'PAUSED' : 'ACTIVE';
                  await update.run({ status: next });
                  toast.success(
                    next === 'ACTIVE' ? 'Condición activada' : 'Condición pausada',
                    next === 'ACTIVE'
                      ? 'Ya afecta el precio de los pedidos que cumplan los criterios.'
                      : 'Deja de aplicarse hasta que la reactives.',
                  );
                  condition.refetch();
                }}
              >
                {isActive ? 'Pausar' : 'Activar'}
              </Button>
            )}
          </>
        }
      />

      {c.status === 'DRAFT' && (
        <Callout tone="warn" className="mb-5" title="Esta condición está en borrador">
          No afecta ningún precio todavía. Activala cuando la política comercial esté confirmada.
        </Callout>
      )}
      {c.status === 'EXPIRED' && (
        <Callout tone="neutral" className="mb-5" title="Condición vencida">
          Se conserva para auditoría: los pedidos históricos que la aplicaron mantienen el precio con el que se cerraron.
        </Callout>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-5">
          {/* ---------- criterios ---------- */}
          <Card>
            <CardHeader title="Aplica cuando" subtitle="Todos los criterios deben cumplirse" />
            <ul className="divide-y divide-ink-100">
              {c.criteria.map((criterion, i) => (
                <li key={i} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-ink-100 text-[11px] font-bold text-ink-600">
                    {i + 1}
                  </span>
                  <Badge tone="neutral" size="sm">
                    {CONDITION_SCOPE[criterion.scope]}
                  </Badge>
                  <span className="text-[13px] text-ink-500">{OPERATOR_LABEL[criterion.operator] ?? criterion.operator}</span>
                  <span className="text-[13px] font-semibold text-ink-900">{criterion.values.join(', ')}</span>
                </li>
              ))}
            </ul>
          </Card>

          {/* ---------- acciones ---------- */}
          <Card>
            <CardHeader title="Entonces" subtitle="Efecto sobre el precio, el flete, las unidades o los puntos" />
            <ul className="divide-y divide-ink-100">
              {c.actions.map((action) => (
                <li key={action.type} className="px-5 py-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-ink-900">{CONDITION_ACTION[action.type]}</p>
                      <p className="mt-0.5 text-xs text-ink-500">{action.label}</p>
                    </div>
                    <Badge tone="brand">{action.value}{action.type === 'DISCOUNT_PCT' ? '%' : ''}</Badge>
                  </div>

                  {action.tiers && action.tiers.length > 0 && (
                    <div className="mt-3 grid gap-2 sm:grid-cols-3">
                      {action.tiers.map((tier) => (
                        <div key={tier.minQty} className="rounded-lg border border-ink-200 px-3 py-2">
                          <p className="text-[11px] font-semibold tracking-wide text-ink-500 uppercase">
                            {tier.minQty}+ unidades
                          </p>
                          <p className="mt-0.5 text-[15px] font-semibold tabular-nums text-ok-700">
                            {Number.parseFloat(tier.discountPct).toFixed(2).replace('.', ',')}%
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </Card>

          {/* ---------- alcance ---------- */}
          <Card>
            <CardHeader
              title="Alcance estimado"
              subtitle={`${fmtNumber(reach.length)} SKUs del catálogo podrían alcanzar esta condición`}
              icon={<Tag className="size-4" />}
            />
            <div className="p-5">
              <div className="flex flex-wrap gap-1.5">
                {reach.slice(0, 24).map((p) => (
                  <Mono key={p.sku}>{p.sku}</Mono>
                ))}
                {reach.length > 24 && (
                  <span className="text-xs text-ink-400">+{fmtNumber(reach.length - 24)} más</span>
                )}
              </div>

              {c.exclusions.length > 0 && (
                <div className="mt-4 border-t border-ink-100 pt-3">
                  <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-bad-600 uppercase">
                    <XCircle className="size-3.5" aria-hidden />
                    SKUs excluidos
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {c.exclusions.map((sku) => {
                      const product = productBySku(sku);
                      return (
                        <span key={sku} className="inline-flex items-center gap-1.5 rounded-md bg-bad-50 px-2 py-1 text-[11px] text-bad-700">
                          <code className="font-mono">{sku}</code>
                          {product && <span className="text-bad-600/70">{product.name.slice(0, 28)}</span>}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* ---------- panel derecho ---------- */}
        <div className="space-y-4">
          <Card>
            <CardHeader title="Propiedades" />
            <div className="space-y-0.5 p-5">
              <DataRow label="Prioridad" value={c.priority} hint={undefined} emphasis />
              <DataRow
                label="Acumulable"
                value={
                  c.stackable ? (
                    <Badge tone="ok" size="sm">
                      Sí
                    </Badge>
                  ) : (
                    <Badge tone="warn" size="sm">
                      No
                    </Badge>
                  )
                }
              />
              <DataRow
                label="Requiere aprobación"
                value={
                  c.requiresApproval ? (
                    <Badge tone="warn" size="sm">
                      Sí
                    </Badge>
                  ) : (
                    'No'
                  )
                }
              />
              <DataRow label="Vigente desde" value={fmtDate(c.validFrom)} />
              <DataRow
                label="Vigente hasta"
                value={
                  <span>
                    {fmtDate(c.validTo)}
                    <span className="ml-1 text-xs text-ink-400">({fmtRelative(c.validTo)})</span>
                  </span>
                }
              />
              <DataRow label="Responsable" value={c.owner} />
              <DataRow label="Creada" value={fmtDate(c.createdAt)} />
              <DataRow label="Actualizada" value={fmtDateTime(c.updatedAt)} />
            </div>
          </Card>

          <Card>
            <CardHeader title="Uso" />
            <div className="p-5">
              <p className="text-2xl font-semibold tabular-nums text-ink-900">{fmtNumber(c.usageCount)}</p>
              <p className="mt-0.5 text-[13px] text-ink-500">
                {c.usageLimit ? `de ${fmtNumber(c.usageLimit)} usos permitidos` : 'aplicaciones registradas (sin límite)'}
              </p>
              {c.usageLimit && (
                <ProgressBar className="mt-3" value={usagePct} tone={usagePct > 85 ? 'bad' : usagePct > 60 ? 'warn' : 'ok'} showLabel />
              )}
              {c.usageLimit && c.usageCount >= c.usageLimit && (
                <Callout tone="bad" className="mt-3">
                  Se alcanzó el límite de usos: la condición ya no se aplica a nuevos pedidos.
                </Callout>
              )}
            </div>
          </Card>

          {!c.stackable && (
            <Callout tone="warn" icon={<CheckCircle2 className="size-4" />} title="Condición exclusiva">
              Cuando se aplica, descarta los descuentos de menor prioridad. Es la regla que evita apilar promociones sin
              control.
            </Callout>
          )}
        </div>
      </div>

      <ConditionSimulator open={simulatorOpen} onClose={() => setSimulatorOpen(false)} />
    </div>
  );
}
