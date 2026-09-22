/**
 * Gestión de pedidos (backoffice).
 */
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ListOrdered, Search, UserCog } from 'lucide-react';
import type { Order, OrderStatus } from '@/types';
import { api } from '@/services';
import { useSession } from '@/app/session';
import { useAsync, useDebounced } from '@/app/hooks';
import { CUSTOMERS } from '@/mocks/fixtures/customers';
import { personName } from '@/mocks/fixtures/people';
import { ORDER_STATUS, PAYMENT_TERM } from '@/lib/labels';
import { fmtDate, fmtMoney, fmtNumber, fmtRelative, num } from '@/lib/utils';
import { Badge, Card, Input, Segmented, Select } from '@/components/ui/primitives';
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
import { OrderStatusBadge } from '@/components/domain/common';

export function BoOrders() {
  const { session, role } = useSession();
  const [params, setParams] = useSearchParams();
  const [term, setTerm] = useState('');
  const debounced = useDebounced(term);
  const [view, setView] = useState<'all' | 'action'>('all');

  const status = params.get('status') as OrderStatus | null;
  const customerId = params.get('customerId');

  const { data, initialLoading, error, refetch } = useAsync(
    () => api.orders.list({ status: status ?? undefined, customerId: customerId ?? undefined, query: debounced || undefined }, session),
    [status, customerId, debounced, session.role],
  );

  const all = data ?? [];
  const actionable = all.filter((o) =>
    ['PENDING_APPROVAL', 'SALES_REVIEW', 'OBSERVED', 'PENDING_PAYMENT'].includes(o.status),
  );
  const rows = view === 'action' ? actionable : all;

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const columns: Column<Order>[] = [
    {
      key: 'number',
      header: 'Pedido',
      cell: (o) => (
        <div>
          <Link to={`/bo/pedidos/${o.id}`} className="font-semibold text-ashir-600 hover:text-ashir-700">
            {o.number}
          </Link>
          <p className="text-[11px] text-ink-400">
            {fmtDate(o.createdAt)}
            {o.customerPO && ` · OC ${o.customerPO}`}
          </p>
          {o.origin === 'ASSISTED' && o.placedBy && (
            <p className="mt-0.5 flex items-center gap-1 text-[11px] text-ink-500">
              <UserCog className="size-3 shrink-0 text-ashir-500" aria-hidden />
              <span className="truncate">Cargado por {o.placedBy.name}</span>
            </p>
          )}
        </div>
      ),
      sortable: true,
      sortValue: (o) => o.number,
    },
    {
      key: 'customer',
      header: 'Cliente',
      cell: (o) => (
        <div className="min-w-0">
          <Link to={`/bo/clientes/${o.customerId}`} className="truncate text-[13px] font-medium text-ink-900 hover:text-ashir-700">
            {o.customerName}
          </Link>
          <p className="text-[11px] text-ink-400">{personName(o.salesRepId)}</p>
        </div>
      ),
      sortable: true,
      sortValue: (o) => o.customerName,
    },
    {
      key: 'items',
      header: 'Ítems',
      align: 'right',
      hideOnMobile: true,
      cell: (o) => (
        <span className="tabular-nums text-ink-600">
          {o.items.length} / {fmtNumber(o.items.reduce((a, i) => a + i.quantity, 0))} u.
        </span>
      ),
    },
    {
      key: 'payment',
      header: 'Pago',
      hideOnMobile: true,
      cell: (o) => <span className="text-xs text-ink-600">{PAYMENT_TERM[o.paymentTerm].label}</span>,
    },
    {
      key: 'status',
      header: 'Estado',
      cell: (o) => (
        <div className="flex flex-col gap-1">
          <OrderStatusBadge status={o.status} size="sm" />
          {o.requiredApprovals.some((a) => a.status === 'PENDING') && (
            <Badge tone="warn" size="sm">
              Requiere aprobación
            </Badge>
          )}
        </div>
      ),
      sortable: true,
      sortValue: (o) => ORDER_STATUS[o.status].label,
    },
    {
      key: 'updated',
      header: 'Actualizado',
      hideOnMobile: true,
      cell: (o) => <span className="text-xs text-ink-500">{fmtRelative(o.updatedAt)}</span>,
      sortable: true,
      sortValue: (o) => new Date(o.updatedAt).getTime(),
    },
    {
      key: 'total',
      header: 'Total',
      align: 'right',
      cell: (o) => <span className="font-semibold tabular-nums text-ink-900">{fmtMoney(o.total)}</span>,
      sortable: true,
      sortValue: (o) => num(o.total),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Pedidos"
        subtitle={
          role === 'SALES'
            ? 'Pedidos de todos los clientes. Los de tu cartera son los que requieren tu aprobación.'
            : 'Todos los pedidos del portal, con su estado comercial y logístico.'
        }
      />

      <StatGrid cols={4} className="mb-6">
        <StatTile label="Total de pedidos" value={all.length} icon={<ListOrdered className="size-4" />} />
        <StatTile
          label="Requieren acción"
          value={actionable.length}
          tone={actionable.length > 0 ? 'warn' : 'ok'}
          footer="Aprobación, validación comercial u observados"
        />
        <StatTile
          label="En preparación o tránsito"
          value={all.filter((o) => ['PICKING', 'SHIPPED', 'PARTIALLY_SHIPPED'].includes(o.status)).length}
          tone="tech"
        />
        <StatTile
          label="Monto total"
          value={fmtMoney({ amount: all.reduce((a, o) => a + num(o.total), 0).toFixed(2), currency: 'USD' }, { compact: true })}
        />
      </StatGrid>

      <FilterBar>
        <Segmented
          value={view}
          onChange={setView}
          options={[
            { value: 'all', label: `Todos (${all.length})` },
            { value: 'action', label: `Requieren acción (${actionable.length})` },
          ]}
        />
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Buscar por pedido, cliente o SKU…"
          leading={<Search className="size-4" />}
          className="max-w-xs"
        />
        <Select value={status ?? ''} onChange={(e) => setParam('status', e.target.value || null)} className="w-auto min-w-[180px]" aria-label="Estado">
          <option value="">Todos los estados</option>
          {(Object.keys(ORDER_STATUS) as OrderStatus[]).map((s) => (
            <option key={s} value={s}>
              {ORDER_STATUS[s].label}
            </option>
          ))}
        </Select>
        <Select
          value={customerId ?? ''}
          onChange={(e) => setParam('customerId', e.target.value || null)}
          className="w-auto min-w-[180px]"
          aria-label="Cliente"
        >
          <option value="">Todos los clientes</option>
          {CUSTOMERS.map((c) => (
            <option key={c.id} value={c.id}>
              {c.tradeName}
            </option>
          ))}
        </Select>
        <span className="ml-auto">
          <ResultCount shown={rows.length} total={all.length} noun="pedidos" />
        </span>
      </FilterBar>

      {error ? (
        <Card>
          <ErrorState description={error.message} onRetry={refetch} />
        </Card>
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(o) => o.id}
          loading={initialLoading}
          empty={
            <EmptyState
              title="No hay pedidos con estos filtros"
              description="Probá con otro estado, otro cliente o limpiando la búsqueda."
              icon={<ListOrdered className="size-5" />}
            />
          }
          mobileCard={(o) => (
            <div>
              <div className="flex items-start justify-between gap-2">
                <Link to={`/bo/pedidos/${o.id}`} className="text-[13px] font-semibold text-ashir-600">
                  {o.number}
                </Link>
                <OrderStatusBadge status={o.status} size="sm" />
              </div>
              <p className="mt-1 truncate text-xs text-ink-600">{o.customerName}</p>
              <p className="mt-1 text-[13px] font-semibold tabular-nums">{fmtMoney(o.total)}</p>
            </div>
          )}
        />
      )}
    </div>
  );
}
