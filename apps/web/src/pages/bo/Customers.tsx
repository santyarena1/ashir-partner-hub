/**
 * Listado de clientes / resellers.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, CreditCard, Search, TrendingUp, Users } from 'lucide-react';
import type { Customer } from '@/types';
import { api } from '@/services';
import { useAsync, useDebounced } from '@/app/hooks';
import { useSession } from '@/app/session';
import { SALES_REPS, personName } from '@/mocks/fixtures/people';
import { PAYMENT_TERM } from '@/lib/labels';
import { cn, fmtMoney, fmtPctDelta, fmtRelative, num } from '@/lib/utils';
import { Badge, Card, Input, Select } from '@/components/ui/primitives';
import {
  DataTable,
  EmptyState,
  ErrorState,
  FilterBar,
  PageHeader,
  ResultCount,
  StatGrid,
  StatTile,
  type Column,
} from '@/components/ui/data';
import { SegmentBadge } from '@/components/domain/common';

export function BoCustomers() {
  const { role, session } = useSession();
  const [term, setTerm] = useState('');
  const debounced = useDebounced(term);
  const [segment, setSegment] = useState('');
  const [rep, setRep] = useState(role === 'SALES' ? session.userId : '');
  const [status, setStatus] = useState('');

  const { data, initialLoading, error, refetch } = useAsync(
    () => api.customers.list({ query: debounced || undefined, segment: segment || undefined, salesRepId: rep || undefined, status: status || undefined }),
    [debounced, segment, rep, status],
  );

  const customers = data ?? [];
  const totalPurchases = customers.reduce((a, c) => a + num(c.purchases12m), 0);
  const overdue = customers.filter((c) => num(c.account.overdue) > 0);

  const columns: Column<Customer>[] = [
    {
      key: 'name',
      header: 'Cliente',
      cell: (c) => (
        <div className="min-w-0">
          <Link to={`/bo/clientes/${c.id}`} className="truncate text-[13px] font-semibold text-ashir-600 hover:text-ashir-700">
            {c.tradeName}
          </Link>
          <p className="mt-0.5 truncate text-[11px] text-ink-400">
            {c.code} · CUIT {c.taxId}
          </p>
        </div>
      ),
      sortable: true,
      sortValue: (c) => c.tradeName,
    },
    {
      key: 'segment',
      header: 'Segmento',
      cell: (c) => (
        <div className="flex flex-col gap-1">
          <SegmentBadge segment={c.segment} size="sm" />
          {c.status !== 'ACTIVE' && (
            <Badge tone={c.status === 'SUSPENDED' ? 'bad' : c.status === 'ON_HOLD' ? 'warn' : 'neutral'} size="sm">
              {c.status === 'ON_HOLD' ? 'En observación' : c.status === 'SUSPENDED' ? 'Suspendido' : 'Prospecto'}
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: 'rep',
      header: 'Ejecutivo',
      hideOnMobile: true,
      cell: (c) => <span className="text-xs text-ink-600">{personName(c.salesRepId)}</span>,
    },
    {
      key: 'zone',
      header: 'Zona',
      hideOnMobile: true,
      cell: (c) => (
        <span className="text-xs text-ink-600">
          {c.zone}
          <br />
          <span className="text-ink-400">{c.city}</span>
        </span>
      ),
    },
    {
      key: 'list',
      header: 'Lista / pago',
      hideOnMobile: true,
      cell: (c) => (
        <span className="text-xs text-ink-600">
          {c.priceListId.replace('pl_', 'LP-').toUpperCase()}
          <br />
          <span className="text-ink-400">{PAYMENT_TERM[c.paymentTerm].label}</span>
        </span>
      ),
    },
    {
      key: 'purchases',
      header: 'Compras 12 m',
      align: 'right',
      cell: (c) => {
        const current = num(c.purchases12m);
        const prev = num(c.purchasesPrevious12m);
        const delta = prev > 0 ? ((current - prev) / prev) * 100 : 0;
        return (
          <div>
            <span className="font-semibold tabular-nums text-ink-900">{fmtMoney(c.purchases12m, { compact: true })}</span>
            {prev > 0 && (
              <p className={cn('text-[11px] tabular-nums', delta >= 0 ? 'text-ok-600' : 'text-bad-600')}>
                {fmtPctDelta(delta)}
              </p>
            )}
          </div>
        );
      },
      sortable: true,
      sortValue: (c) => num(c.purchases12m),
    },
    {
      key: 'credit',
      header: 'Crédito',
      align: 'right',
      cell: (c) => (
        <div>
          <span className="tabular-nums text-ink-700">{fmtMoney(c.account.creditAvailable, { compact: true })}</span>
          <p className="text-[11px] text-ink-400 tabular-nums">de {fmtMoney(c.account.creditLimit, { compact: true })}</p>
        </div>
      ),
      sortable: true,
      sortValue: (c) => num(c.account.creditAvailable),
    },
    {
      key: 'overdue',
      header: 'Vencido',
      align: 'right',
      cell: (c) =>
        num(c.account.overdue) > 0 ? (
          <span className="font-semibold tabular-nums text-bad-600">{fmtMoney(c.account.overdue)}</span>
        ) : (
          <span className="text-ink-400">—</span>
        ),
      sortable: true,
      sortValue: (c) => num(c.account.overdue),
    },
    {
      key: 'last',
      header: 'Última compra',
      align: 'right',
      hideOnMobile: true,
      cell: (c) => (
        <span className="text-xs text-ink-500">
          {c.lastOrderAt ? fmtRelative(c.lastOrderAt) : 'Nunca'}
          {c.orderFrequencyDays > 0 && <span className="block text-ink-400">cada ~{c.orderFrequencyDays} d</span>}
        </span>
      ),
      sortable: true,
      sortValue: (c) => (c.lastOrderAt ? new Date(c.lastOrderAt).getTime() : 0),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Clientes"
        subtitle={
          role === 'SALES'
            ? 'Tu cartera y el resto de los resellers del portal. Los filtros arrancan en tus clientes.'
            : 'Resellers habilitados en el portal, con su segmento, lista, cuenta corriente y actividad.'
        }
      />

      <StatGrid cols={4} className="mb-6">
        <StatTile label="Clientes" value={customers.length} icon={<Users className="size-4" />} />
        <StatTile
          label="Compras acumuladas 12 m"
          value={fmtMoney({ amount: totalPurchases.toFixed(2), currency: 'USD' }, { compact: true })}
          icon={<TrendingUp className="size-4" />}
          tone="ok"
        />
        <StatTile
          label="Con deuda vencida"
          value={overdue.length}
          icon={<CreditCard className="size-4" />}
          tone={overdue.length > 0 ? 'bad' : 'ok'}
          footer={
            overdue.length > 0
              ? fmtMoney({ amount: overdue.reduce((a, c) => a + num(c.account.overdue), 0).toFixed(2), currency: 'USD' })
              : 'Cartera al día'
          }
        />
        <StatTile
          label="Platinum / Gold / Silver"
          value={`${customers.filter((c) => c.segment === 'PLATINUM').length} / ${customers.filter((c) => c.segment === 'GOLD').length} / ${customers.filter((c) => c.segment === 'SILVER').length}`}
        />
      </StatGrid>

      <FilterBar>
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Buscar por nombre, código o CUIT…"
          leading={<Search className="size-4" />}
          className="max-w-xs"
        />
        <Select value={segment} onChange={(e) => setSegment(e.target.value)} className="w-auto" aria-label="Segmento">
          <option value="">Todos los segmentos</option>
          <option value="PLATINUM">Platinum</option>
          <option value="GOLD">Gold</option>
          <option value="SILVER">Silver</option>
        </Select>
        <Select value={rep} onChange={(e) => setRep(e.target.value)} className="w-auto min-w-[160px]" aria-label="Ejecutivo">
          <option value="">Todos los ejecutivos</option>
          {SALES_REPS.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-auto" aria-label="Estado">
          <option value="">Todos los estados</option>
          <option value="ACTIVE">Activos</option>
          <option value="ON_HOLD">En observación</option>
          <option value="PROSPECT">Prospectos</option>
        </Select>
        <span className="ml-auto">
          <ResultCount shown={customers.length} total={customers.length} noun="clientes" />
        </span>
      </FilterBar>

      {error ? (
        <Card>
          <ErrorState description={error.message} onRetry={refetch} />
        </Card>
      ) : (
        <DataTable
          columns={columns}
          rows={customers}
          rowKey={(c) => c.id}
          loading={initialLoading}
          dense
          empty={
            <EmptyState
              title="No hay clientes con estos filtros"
              description="Probá con otro segmento o limpiando la búsqueda."
              icon={<Building2 className="size-5" />}
            />
          }
          mobileCard={(c) => (
            <div>
              <div className="flex items-start justify-between gap-2">
                <Link to={`/bo/clientes/${c.id}`} className="text-[13px] font-semibold text-ashir-600">
                  {c.tradeName}
                </Link>
                <SegmentBadge segment={c.segment} size="sm" />
              </div>
              <p className="mt-1 text-xs text-ink-500">
                {c.code} · {c.city}
              </p>
              <p className="mt-1 text-[13px] font-semibold tabular-nums">{fmtMoney(c.purchases12m, { compact: true })}</p>
            </div>
          )}
        />
      )}
    </div>
  );
}
