/**
 * Motor de garantía: políticas por marca, categoría o producto,
 * con excepciones y flags que disparan revisión manual.
 */
import { AlertTriangle, Clock, ShieldCheck } from 'lucide-react';
import type { WarrantyPolicy } from '@/types';
import { api } from '@/services';
import { useAsync } from '@/app/hooks';
import { WARRANTY_FLAG } from '@/lib/labels';
import { fmtDate } from '@/lib/utils';
import { Badge, Card, CardHeader, Skeleton } from '@/components/ui/primitives';
import { Callout, DataRow, EmptyState, ErrorState, Mono, PageHeader, StatGrid, StatTile } from '@/components/ui/data';

export function RmaPolicies() {
  const { data, initialLoading, error, refetch } = useAsync(() => api.rma.listPolicies(), []);
  const policies = data ?? [];

  if (error) {
    return (
      <Card>
        <ErrorState description={error.message} onRetry={refetch} />
      </Card>
    );
  }

  return (
    <div>
      <PageHeader
        title="Políticas de garantía"
        subtitle="El motor resuelve la cobertura de cada serial: meses aplicables, excepciones por SKU, lote o fecha, y condiciones que exigen revisión manual."
      />

      <StatGrid cols={4} className="mb-6">
        <StatTile label="Políticas configuradas" value={policies.length} icon={<ShieldCheck className="size-4" />} />
        <StatTile
          label="Cobertura máxima"
          value={`${Math.max(...policies.map((p) => p.months), 0)} meses`}
          tone="ok"
          footer="Memorias y SSD"
        />
        <StatTile
          label="Excepciones registradas"
          value={policies.reduce((a, p) => a + p.exceptions.length, 0)}
          footer="Por SKU, lote o rango de fechas"
        />
        <StatTile
          label="SLA de validación"
          value="24 h"
          icon={<Clock className="size-4" />}
          footer="Plazo estándar antes de emitir el remito"
        />
      </StatGrid>

      <Callout tone="tech" className="mb-6" title="Cómo resuelve el motor">
        Para un serial dado busca primero una excepción por SKU, después por lote o rango de fechas, y en última
        instancia aplica la política de la marca. Si no existe ninguna, usa la política general de Ashir. Las
        condiciones detectadas en el diagnóstico (daño físico, serial ilegible, daño eléctrico, sulfatación)
        <strong> no rechazan automáticamente</strong>: marcan el caso como «Requiere revisión manual».
      </Callout>

      {initialLoading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-full rounded-card" />
          ))}
        </div>
      ) : policies.length === 0 ? (
        <Card>
          <EmptyState title="Sin políticas configuradas" icon={<ShieldCheck className="size-5" />} />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {policies.map((policy) => (
            <PolicyCard key={policy.id} policy={policy} />
          ))}
        </div>
      )}
    </div>
  );
}

function PolicyCard({ policy }: { policy: WarrantyPolicy }) {
  return (
    <Card>
      <CardHeader
        title={policy.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone="neutral" size="sm">
              {policy.scope === 'BRAND' ? 'Por marca' : policy.scope === 'CATEGORY' ? 'Por categoría' : 'Por producto'}
            </Badge>
            <span>{policy.target}</span>
          </span>
        }
        action={<Badge tone="ok">{policy.months} meses</Badge>}
      />

      <div className="space-y-4 p-5">
        {/* SLA */}
        <div>
          <p className="mb-2 text-[11px] font-semibold tracking-wide text-ink-500 uppercase">Plazos comprometidos</p>
          <div className="grid gap-x-6 sm:grid-cols-2">
            <DataRow label="Validación" value={`${policy.slaValidationHours} h`} />
            <DataRow label="Diagnóstico" value={`${policy.slaDiagnosisHours} h`} />
            <DataRow label="Resolución" value={`${policy.slaResolutionDays} días`} />
            <DataRow label="Actualizada" value={fmtDate(policy.updatedAt)} />
          </div>
        </div>

        {/* excepciones */}
        <div>
          <p className="mb-2 text-[11px] font-semibold tracking-wide text-ink-500 uppercase">Excepciones</p>
          {policy.exceptions.length === 0 ? (
            <p className="text-[13px] text-ink-500">Sin excepciones: se aplica la cobertura general de la política.</p>
          ) : (
            <ul className="space-y-2">
              {policy.exceptions.map((exception) => (
                <li key={`${exception.type}-${exception.target}`} className="rounded-lg border border-ink-200 px-3 py-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="flex flex-wrap items-center gap-2">
                      <Badge tone="warn" size="sm">
                        {exception.type === 'SKU' ? 'SKU' : exception.type === 'LOT' ? 'Lote' : 'Rango de fechas'}
                      </Badge>
                      <Mono>{exception.target}</Mono>
                    </span>
                    <Badge tone="tech" size="sm">
                      {exception.months} meses
                    </Badge>
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-ink-500">{exception.note}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* flags */}
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-ink-500 uppercase">
            <AlertTriangle className="size-3.5" aria-hidden />
            Condiciones que disparan revisión manual
          </p>
          <div className="flex flex-wrap gap-1.5">
            {policy.flagsRequireReview.map((flag) => (
              <Badge key={flag} tone="bad" size="sm">
                {WARRANTY_FLAG[flag]}
              </Badge>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}
