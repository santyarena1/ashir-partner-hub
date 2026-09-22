/**
 * Centro de RMA interno: tabla y Kanban por etapa, con control de SLA.
 */
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Clock,
  Factory,
  KanbanSquare,
  PackageCheck,
  PackageSearch,
  Rows3,
  Search,
  TriangleAlert,
  Wrench,
} from 'lucide-react';
import type { RmaCase, RmaStatus } from '@/types';
import { api } from '@/services';
import { useSession } from '@/app/session';
import { useAsync, useDebounced } from '@/app/hooks';
import { BRANDS } from '@/mocks/fixtures/catalog';
import { RMA_FLOW, RMA_STATUS, TONE_DOT } from '@/lib/labels';
import { cn, fmtDate, fmtRelative } from '@/lib/utils';
import { Badge, Card, Input, Segmented, Select } from '@/components/ui/primitives';
import {
  Callout,
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
import { RmaStatusBadge, SlaIndicator } from '@/components/domain/common';

const KANBAN_STAGES: RmaStatus[] = [
  'SUBMITTED',
  'ASHIR_VALIDATION',
  'AWAITING_SHIPMENT',
  'RECEIVED',
  'DIAGNOSIS',
  'MANUFACTURER',
  'RESOLUTION',
  'READY_FOR_PICKUP',
];

export function RmaCenter() {
  const { session } = useSession();
  const [params, setParams] = useSearchParams();
  const [term, setTerm] = useState(params.get('q') ?? '');
  const debounced = useDebounced(term);
  const [view, setView] = useState<'table' | 'kanban'>('table');

  const breachedOnly = params.get('sla') === 'breached';

  const { data, initialLoading, error, refetch } = useAsync(
    () =>
      api.rma.listCases(
        {
          query: debounced || undefined,
          status: (params.get('status') as RmaStatus | null) ?? undefined,
          brand: params.get('brand') ?? undefined,
          breachedOnly: breachedOnly || undefined,
        },
        session,
      ),
    [debounced, params.toString(), session.role],
  );

  const all = data ?? [];
  const open = all.filter((c) => !['CLOSED', 'REJECTED'].includes(c.status));
  const breached = all.filter((c) => c.sla.breached);

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const columns: Column<RmaCase>[] = [
    {
      key: 'code',
      header: 'RMA',
      cell: (c) => (
        <div>
          <Link to={`/bo/rma/${c.id}`} className="font-semibold text-ashir-600 hover:text-ashir-700">
            {c.code}
          </Link>
          <p className="text-[11px] text-ink-400">
            {fmtDate(c.createdAt)}
            {c.isBatch && <span className="ml-1 text-ashir-600">· múltiple</span>}
          </p>
        </div>
      ),
      sortable: true,
      sortValue: (c) => c.code,
    },
    {
      key: 'customer',
      header: 'Cliente',
      cell: (c) => (
        <Link to={`/bo/clientes/${c.customerId}`} className="truncate text-[13px] text-ink-900 hover:text-ashir-700">
          {c.customerName}
        </Link>
      ),
      sortable: true,
      sortValue: (c) => c.customerName,
    },
    {
      key: 'product',
      header: 'Producto',
      cell: (c) => (
        <div className="min-w-0">
          <p className="truncate text-[13px] text-ink-800">{c.units[0]?.productName}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-ink-400">
            <Mono>{c.units[0]?.sku ?? ''}</Mono>
            <span>{c.units[0]?.brand}</span>
            {c.units.length > 1 && <span className="text-ashir-600">+{c.units.length - 1} u.</span>}
          </p>
        </div>
      ),
    },
    {
      key: 'serial',
      header: 'Serial',
      hideOnMobile: true,
      cell: (c) => (c.units.length === 1 ? <Mono>{c.units[0]!.serial}</Mono> : <span className="text-ink-500">{c.units.length} seriales</span>),
    },
    {
      key: 'problem',
      header: 'Problema',
      hideOnMobile: true,
      cell: (c) => <span className="text-xs text-ink-600">{c.units[0]?.problemLabel}</span>,
    },
    {
      key: 'status',
      header: 'Estado',
      cell: (c) => <RmaStatusBadge status={c.status} size="sm" />,
      sortable: true,
      sortValue: (c) => RMA_FLOW.indexOf(c.status),
    },
    {
      key: 'age',
      header: 'Antigüedad',
      align: 'right',
      hideOnMobile: true,
      cell: (c) => <span className="text-xs text-ink-500">{fmtRelative(c.createdAt)}</span>,
      sortable: true,
      sortValue: (c) => new Date(c.createdAt).getTime(),
    },
    {
      key: 'owner',
      header: 'Responsable',
      hideOnMobile: true,
      cell: (c) => <span className="text-xs text-ink-600">{c.assignedTo ?? 'Sin asignar'}</span>,
    },
    {
      key: 'sla',
      header: 'SLA',
      cell: (c) => <SlaIndicator sla={c.sla} />,
      sortable: true,
      sortValue: (c) => c.sla.remainingHours,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Centro de RMA"
        subtitle="Todas las gestiones de garantía, con su etapa, responsable y plazo comprometido."
        actions={
          <Segmented
            value={view}
            onChange={setView}
            options={[
              { value: 'table', label: <Rows3 className="size-4" />, title: 'Vista tabla' },
              { value: 'kanban', label: <KanbanSquare className="size-4" />, title: 'Vista Kanban' },
            ]}
          />
        }
      />

      {breached.length > 0 && !breachedOnly && (
        <Callout
          tone="bad"
          icon={<TriangleAlert className="size-4" />}
          title={`${breached.length} caso(s) fuera de SLA`}
          className="mb-5"
          action={
            <button
              type="button"
              onClick={() => setParam('sla', 'breached')}
              className="rounded-lg border border-bad-200 bg-white px-3 py-1.5 text-[13px] font-medium text-bad-700 transition-colors hover:bg-bad-50"
            >
              Ver solo esos
            </button>
          }
        >
          {breached[0]!.code} lleva {Math.round(breached[0]!.sla.elapsedHours / 24)} días en la etapa de{' '}
          {breached[0]!.sla.stage === 'DIAGNOSIS' ? 'diagnóstico' : breached[0]!.sla.stage === 'VALIDATION' ? 'validación' : 'resolución'}
          , con un objetivo de {breached[0]!.sla.targetHours} horas.
        </Callout>
      )}

      <StatGrid cols={6} className="mb-6">
        <StatTile label="RMAs abiertos" value={open.length} icon={<Wrench className="size-4" />} tone="tech" />
        <StatTile
          label="Esperando recepción"
          value={all.filter((c) => c.status === 'AWAITING_SHIPMENT').length}
          icon={<PackageSearch className="size-4" />}
          tone="warn"
        />
        <StatTile label="En diagnóstico" value={all.filter((c) => c.status === 'DIAGNOSIS').length} icon={<Clock className="size-4" />} />
        <StatTile
          label="Con fabricante"
          value={all.filter((c) => c.status === 'MANUFACTURER').length}
          icon={<Factory className="size-4" />}
        />
        <StatTile label="Fuera de SLA" value={breached.length} tone={breached.length > 0 ? 'bad' : 'ok'} />
        <StatTile
          label="Finalizados este mes"
          value={
            all.filter((c) => c.closedAt && new Date(c.closedAt).getMonth() === new Date().getMonth()).length
          }
          icon={<PackageCheck className="size-4" />}
          tone="ok"
        />
      </StatGrid>

      <FilterBar>
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Buscar por RMA, serial, cliente o SKU…"
          leading={<Search className="size-4" />}
          className="max-w-xs"
        />
        <Select
          value={params.get('status') ?? ''}
          onChange={(e) => setParam('status', e.target.value || null)}
          className="w-auto min-w-[180px]"
          aria-label="Estado"
        >
          <option value="">Todos los estados</option>
          {(Object.keys(RMA_STATUS) as RmaStatus[]).map((s) => (
            <option key={s} value={s}>
              {RMA_STATUS[s].label}
            </option>
          ))}
        </Select>
        <Select
          value={params.get('brand') ?? ''}
          onChange={(e) => setParam('brand', e.target.value || null)}
          className="w-auto min-w-[150px]"
          aria-label="Marca"
        >
          <option value="">Todas las marcas</option>
          {BRANDS.map((b) => (
            <option key={b.id} value={b.name}>
              {b.name}
            </option>
          ))}
        </Select>
        <button
          type="button"
          onClick={() => setParam('sla', breachedOnly ? null : 'breached')}
          className={cn(
            'rounded-lg px-3 py-1.5 text-[13px] font-medium ring-1 transition-colors ring-inset',
            breachedOnly ? 'bg-bad-50 text-bad-700 ring-bad-200' : 'text-ink-600 ring-ink-200 hover:bg-ink-50',
          )}
        >
          Solo fuera de SLA
        </button>
        <span className="ml-auto">
          <ResultCount shown={all.length} total={all.length} noun="casos" />
        </span>
      </FilterBar>

      {error ? (
        <Card>
          <ErrorState description={error.message} onRetry={refetch} />
        </Card>
      ) : view === 'kanban' ? (
        <KanbanBoard cases={all} loading={initialLoading} />
      ) : (
        <DataTable
          columns={columns}
          rows={all}
          rowKey={(c) => c.id}
          loading={initialLoading}
          dense
          empty={
            <EmptyState
              title="No hay casos con estos filtros"
              description="Probá con otro estado, otra marca o limpiando la búsqueda."
              icon={<Wrench className="size-5" />}
            />
          }
          mobileCard={(c) => (
            <div>
              <div className="flex items-start justify-between gap-2">
                <Link to={`/bo/rma/${c.id}`} className="text-[13px] font-semibold text-ashir-600">
                  {c.code}
                </Link>
                <RmaStatusBadge status={c.status} size="sm" />
              </div>
              <p className="mt-1 truncate text-xs text-ink-600">
                {c.customerName} · {c.units[0]?.brand}
              </p>
              <div className="mt-1.5">
                <SlaIndicator sla={c.sla} />
              </div>
            </div>
          )}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Kanban                                                              */
/* ------------------------------------------------------------------ */

function KanbanBoard({ cases, loading }: { cases: RmaCase[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="flex gap-3 overflow-x-auto pb-2">
        {KANBAN_STAGES.map((stage) => (
          <div key={stage} className="w-[260px] shrink-0 rounded-card bg-ink-100 p-3">
            <div className="skeleton h-5 w-32 rounded" />
            <div className="mt-3 space-y-2">
              <div className="skeleton h-20 w-full rounded-lg" />
              <div className="skeleton h-20 w-full rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {KANBAN_STAGES.map((stage) => {
        const items = cases.filter((c) => c.status === stage);
        const spec = RMA_STATUS[stage];
        return (
          <section key={stage} className="flex w-[268px] shrink-0 flex-col rounded-card bg-ink-100/70">
            <header className="flex items-center justify-between gap-2 px-3 py-2.5">
              <h2 className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-800">
                <span className={cn('size-2 rounded-full', TONE_DOT[spec.tone])} aria-hidden />
                {spec.label}
              </h2>
              <Badge tone="neutral" size="sm">
                {items.length}
              </Badge>
            </header>

            <div className="min-h-[120px] space-y-2 px-2 pb-2">
              {items.length === 0 ? (
                <p className="px-2 py-6 text-center text-xs text-ink-400">Sin casos en esta etapa</p>
              ) : (
                items.map((c) => (
                  <Link
                    key={c.id}
                    to={`/bo/rma/${c.id}`}
                    className={cn(
                      'block rounded-lg border bg-white p-3 transition-shadow hover:shadow-card',
                      c.sla.breached ? 'border-bad-200' : 'border-ink-200',
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[13px] font-semibold text-ink-900">{c.code}</span>
                      {c.priority === 'CRITICAL' && (
                        <Badge tone="bad" size="sm">
                          Crítico
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 truncate text-[11px] text-ink-500">{c.customerName}</p>
                    <p className="mt-0.5 truncate text-[11px] text-ink-400">
                      {c.units[0]?.brand} · {c.units.length} u.
                    </p>
                    <div className="mt-2 border-t border-ink-100 pt-2">
                      <SlaIndicator sla={c.sla} />
                    </div>
                  </Link>
                ))
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
