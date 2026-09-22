/**
 * Motor de condiciones comerciales: listado, constructor visual y simulador.
 * Es el módulo central de pricing del portal.
 */
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { BadgePercent, FlaskConical, Plus, Search, Tag } from 'lucide-react';
import type { CommercialCondition } from '@/types';
import { api } from '@/services';
import { useAsync } from '@/app/hooks';
import { useToast } from '@/components/ui/overlays';
import { CONDITION_ACTION, CONDITION_SCOPE, OPERATOR_LABEL } from '@/lib/labels';
import { fmtDate, fmtNumber, normalize } from '@/lib/utils';
import { Badge, Button, Card, Input, Segmented, Select } from '@/components/ui/primitives';
import {
  DataTable,
  EmptyState,
  ErrorState,
  FilterBar,
  Mono,
  PageHeader,
  ResultCount,
  StatGrid,
  StatTile,
  type Column,
} from '@/components/ui/data';
import { ConditionBuilderDialog } from '@/components/domain/condition-builder';
import { ConditionSimulator } from '@/components/domain/condition-simulator';

export function BoConditions() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [term, setTerm] = useState('');
  const [tab, setTab] = useState<'all' | 'CONDITION' | 'PROMOTION'>(
    (params.get('kind') as 'CONDITION' | 'PROMOTION' | null) ?? 'all',
  );
  const [builderOpen, setBuilderOpen] = useState(false);
  const [simulatorOpen, setSimulatorOpen] = useState(false);

  const { data, initialLoading, error, refetch } = useAsync(() => api.pricing.listConditions({}), []);

  const all = data ?? [];
  const filtered = all.filter((c) => {
    if (tab !== 'all' && c.kind !== tab) return false;
    if (params.get('status') && c.status !== params.get('status')) return false;
    if (term) {
      const q = normalize(term);
      return normalize(c.name).includes(q) || normalize(c.code).includes(q) || normalize(c.description).includes(q);
    }
    return true;
  });

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const columns: Column<CommercialCondition>[] = [
    {
      key: 'name',
      header: 'Condición',
      cell: (c) => (
        <div className="min-w-0">
          <Link to={`/bo/condiciones/${c.id}`} className="text-[13px] font-semibold text-ashir-600 hover:text-ashir-700">
            {c.name}
          </Link>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-ink-400">
            <Mono>{c.code}</Mono>
            <span>·</span>
            <span>{c.kind === 'PROMOTION' ? 'Promoción' : 'Condición permanente'}</span>
          </p>
        </div>
      ),
      sortable: true,
      sortValue: (c) => c.name,
    },
    {
      key: 'criteria',
      header: 'Aplica cuando',
      cell: (c) => (
        <ul className="space-y-0.5">
          {c.criteria.slice(0, 3).map((criterion, i) => (
            <li key={i} className="text-[12px] leading-snug text-ink-600">
              <span className="text-ink-400">{CONDITION_SCOPE[criterion.scope]}</span>{' '}
              {OPERATOR_LABEL[criterion.operator] ?? criterion.operator}{' '}
              <span className="font-medium text-ink-800">{criterion.values.join(', ')}</span>
            </li>
          ))}
          {c.criteria.length > 3 && <li className="text-[11px] text-ink-400">+{c.criteria.length - 3} criterio(s)</li>}
        </ul>
      ),
    },
    {
      key: 'actions',
      header: 'Efecto',
      cell: (c) => (
        <div className="flex flex-wrap gap-1">
          {c.actions.map((action) => (
            <Badge key={action.type} tone="brand" size="sm" title={CONDITION_ACTION[action.type]}>
              {action.label}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      key: 'priority',
      header: 'Prioridad',
      align: 'right',
      hideOnMobile: true,
      cell: (c) => (
        <div>
          <span className="tabular-nums text-ink-700">{c.priority}</span>
          <p className="text-[11px] text-ink-400">{c.stackable ? 'Acumulable' : 'Exclusiva'}</p>
        </div>
      ),
      sortable: true,
      sortValue: (c) => c.priority,
    },
    {
      key: 'validity',
      header: 'Vigencia',
      hideOnMobile: true,
      cell: (c) => (
        <span className="text-xs text-ink-600">
          {fmtDate(c.validFrom)}
          <br />
          <span className="text-ink-400">→ {fmtDate(c.validTo)}</span>
        </span>
      ),
    },
    {
      key: 'usage',
      header: 'Usos',
      align: 'right',
      hideOnMobile: true,
      cell: (c) => (
        <span className="tabular-nums text-ink-600">
          {fmtNumber(c.usageCount)}
          {c.usageLimit && <span className="text-ink-400"> / {fmtNumber(c.usageLimit)}</span>}
        </span>
      ),
      sortable: true,
      sortValue: (c) => c.usageCount,
    },
    {
      key: 'status',
      header: 'Estado',
      cell: (c) => (
        <div className="flex flex-col gap-1">
          <Badge
            tone={
              c.status === 'ACTIVE'
                ? 'ok'
                : c.status === 'SCHEDULED'
                  ? 'tech'
                  : c.status === 'DRAFT'
                    ? 'warn'
                    : c.status === 'PAUSED'
                      ? 'warn'
                      : 'neutral'
            }
            size="sm"
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
          {c.requiresApproval && (
            <Badge tone="warn" size="sm">
              Requiere aprobación
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: 'owner',
      header: 'Responsable',
      hideOnMobile: true,
      cell: (c) => <span className="text-xs text-ink-500">{c.owner}</span>,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Condiciones comerciales"
        subtitle="Las reglas que definen el precio final: por marca, categoría, cliente, segmento, zona, cantidad, monto, medio de pago o fecha."
        actions={
          <>
            <Button variant="outline" icon={<FlaskConical className="size-4" />} onClick={() => setSimulatorOpen(true)}>
              Simulador
            </Button>
            <Button icon={<Plus className="size-4" />} onClick={() => setBuilderOpen(true)}>
              Nueva condición
            </Button>
          </>
        }
      />

      <StatGrid cols={5} className="mb-6">
        <StatTile label="Total configuradas" value={all.length} icon={<BadgePercent className="size-4" />} />
        <StatTile label="Vigentes" value={all.filter((c) => c.status === 'ACTIVE').length} tone="ok" />
        <StatTile label="Programadas" value={all.filter((c) => c.status === 'SCHEDULED').length} tone="tech" />
        <StatTile
          label="Promociones activas"
          value={all.filter((c) => c.kind === 'PROMOTION' && c.status === 'ACTIVE').length}
          icon={<Tag className="size-4" />}
          tone="brand"
        />
        <StatTile
          label="No acumulables"
          value={all.filter((c) => !c.stackable).length}
          tone="warn"
          footer="Bloquean otros descuentos del mismo grupo"
        />
      </StatGrid>

      <FilterBar>
        <Segmented
          value={tab}
          onChange={(v) => {
            setTab(v);
            setParam('kind', v === 'all' ? null : v);
          }}
          options={[
            { value: 'all', label: `Todas (${all.length})` },
            { value: 'CONDITION', label: `Permanentes (${all.filter((c) => c.kind === 'CONDITION').length})` },
            { value: 'PROMOTION', label: `Promociones (${all.filter((c) => c.kind === 'PROMOTION').length})` },
          ]}
        />
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Buscar por nombre o código…"
          leading={<Search className="size-4" />}
          className="max-w-xs"
        />
        <Select
          value={params.get('status') ?? ''}
          onChange={(e) => setParam('status', e.target.value || null)}
          className="w-auto min-w-[150px]"
          aria-label="Estado"
        >
          <option value="">Todos los estados</option>
          <option value="ACTIVE">Vigentes</option>
          <option value="SCHEDULED">Programadas</option>
          <option value="DRAFT">Borradores</option>
          <option value="EXPIRED">Vencidas</option>
        </Select>
        <span className="ml-auto">
          <ResultCount shown={filtered.length} total={all.length} noun="condiciones" />
        </span>
      </FilterBar>

      {error ? (
        <Card>
          <ErrorState description={error.message} onRetry={refetch} />
        </Card>
      ) : (
        <DataTable
          columns={columns}
          rows={filtered}
          rowKey={(c) => c.id}
          loading={initialLoading}
          empty={
            <EmptyState
              title="No hay condiciones con estos filtros"
              description="Probá con otro estado o creá una condición nueva desde el constructor visual."
              icon={<BadgePercent className="size-5" />}
              action={<Button onClick={() => setBuilderOpen(true)}>Nueva condición</Button>}
            />
          }
          mobileCard={(c) => (
            <div>
              <div className="flex items-start justify-between gap-2">
                <Link to={`/bo/condiciones/${c.id}`} className="text-[13px] font-semibold text-ashir-600">
                  {c.name}
                </Link>
                <Badge tone={c.status === 'ACTIVE' ? 'ok' : 'neutral'} size="sm">
                  {c.status === 'ACTIVE' ? 'Vigente' : c.status}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-ink-500">{c.actions[0]?.label}</p>
            </div>
          )}
        />
      )}

      {/* --- orden de evaluación --- */}
      <Card className="mt-6 p-5">
        <h2 className="text-[15px] font-semibold text-ink-900">Orden de evaluación del motor</h2>
        <ol className="mt-3 space-y-2">
          {[
            'Precio de lista distribuidor del archivo de Ashir.',
            'Lista de precios del cliente: override por SKU, regla por marca o categoría, ajuste base.',
            'Condiciones comerciales ordenadas por prioridad ascendente.',
            'Una condición no acumulable descarta los descuentos de menor prioridad.',
            'Se respetan exclusiones por SKU, vigencia y límite de uso.',
            'El resultado se devuelve explicado: cada componente del precio queda visible.',
          ].map((step, i) => (
            <li key={step} className="flex gap-3 text-[13px] text-ink-700">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-ashir-50 text-[11px] font-bold text-ashir-700">
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
        <p className="mt-3 text-xs text-ink-500">
          Este orden está implementado de verdad en{' '}
          <Mono>src/services/mock/pricing-engine.ts</Mono>: todas las pantallas que muestran un precio pasan por el
          mismo motor, por eso el desglose siempre coincide con el total.
        </p>
      </Card>

      <ConditionBuilderDialog
        open={builderOpen}
        onClose={() => setBuilderOpen(false)}
        onCreated={(condition) => {
          toast.success(`Condición ${condition.code} creada`, 'Queda en estado borrador hasta que la actives.');
          refetch();
        }}
      />

      <ConditionSimulator open={simulatorOpen} onClose={() => setSimulatorOpen(false)} />
    </div>
  );
}
