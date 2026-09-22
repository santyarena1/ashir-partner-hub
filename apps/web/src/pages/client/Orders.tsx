/**
 * Mis pedidos (portal del reseller).
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Repeat, Search, Truck } from 'lucide-react';
import type { Order, OrderStatus } from '@/types';
import { api } from '@/services';
import { useSession } from '@/app/session';
import { useAsync } from '@/app/hooks';
import { useCart } from '@/app/cart';
import { useToast } from '@/components/ui/overlays';
import { ORDER_STATUS } from '@/lib/labels';
import { fmtDate, fmtMoney, fmtNumber, normalize } from '@/lib/utils';
import { Button, Card, Input, Select } from '@/components/ui/primitives';
import { DataTable, EmptyState, ErrorState, FilterBar, PageHeader, ResultCount, StatGrid, StatTile, type Column } from '@/components/ui/data';
import { OrderStatusBadge } from '@/components/domain/common';

export function OrdersPage() {
  const { session } = useSession();
  const cart = useCart();
  const toast = useToast();
  const [status, setStatus] = useState<string>('');
  const [term, setTerm] = useState('');

  const { data: orders, initialLoading, error, refetch } = useAsync(() => api.orders.list({}, session), [session.customerId]);

  const filtered = (orders ?? []).filter((order) => {
    if (status && order.status !== status) return false;
    if (term) {
      const q = normalize(term);
      return (
        normalize(order.number).includes(q) ||
        order.items.some((it) => normalize(it.sku).includes(q) || normalize(it.name).includes(q))
      );
    }
    return true;
  });

  const inProgress = (orders ?? []).filter((o) => !['DELIVERED', 'CANCELLED'].includes(o.status));
  const delivered = (orders ?? []).filter((o) => o.status === 'DELIVERED');
  const totalDelivered = delivered.reduce((acc, o) => acc + Number.parseFloat(o.total.amount), 0);

  const columns: Column<Order>[] = [
    {
      key: 'number',
      header: 'Pedido',
      cell: (order) => (
        <div>
          <Link to={`/pedidos/${order.id}`} className="font-semibold text-ashir-600 hover:text-ashir-700">
            {order.number}
          </Link>
          {order.customerPO && <p className="text-[11px] text-ink-400">OC {order.customerPO}</p>}
        </div>
      ),
      sortable: true,
      sortValue: (o) => o.number,
    },
    {
      key: 'date',
      header: 'Fecha',
      cell: (order) => <span className="text-ink-600">{fmtDate(order.createdAt)}</span>,
      sortable: true,
      sortValue: (o) => new Date(o.createdAt).getTime(),
    },
    {
      key: 'items',
      header: 'Ítems',
      align: 'right',
      hideOnMobile: true,
      cell: (order) => (
        <span className="tabular-nums text-ink-600">
          {order.items.length} SKUs · {fmtNumber(order.items.reduce((a, i) => a + i.quantity, 0))} u.
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Estado',
      cell: (order) => <OrderStatusBadge status={order.status} size="sm" />,
      sortable: true,
      sortValue: (o) => ORDER_STATUS[o.status].label,
    },
    {
      key: 'tracking',
      header: 'Seguimiento',
      hideOnMobile: true,
      cell: (order) =>
        order.tracking ? (
          <span className="text-xs text-ink-600">
            {order.tracking.carrier}
            <br />
            <code className="font-mono text-[11px] text-ink-400">{order.tracking.code}</code>
          </span>
        ) : (
          <span className="text-ink-400">—</span>
        ),
    },
    {
      key: 'total',
      header: 'Total',
      align: 'right',
      cell: (order) => <span className="font-semibold tabular-nums text-ink-900">{fmtMoney(order.total)}</span>,
      sortable: true,
      sortValue: (o) => Number.parseFloat(o.total.amount),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      width: '110px',
      cell: (order) => (
        <Button
          size="sm"
          variant="ghost"
          icon={<Repeat className="size-3.5" />}
          onClick={(e) => {
            e.stopPropagation();
            let added = 0;
            for (const item of order.items) {
              if (cart.add(item.productId, item.quantity).ok) added++;
            }
            toast.success('Pedido cargado', `Se agregaron ${added} ítems de ${order.number} al carrito.`);
          }}
        >
          Repetir
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Mis pedidos"
        subtitle="Seguí el estado de cada pedido, descargá comprobantes e iniciá garantías desde las unidades entregadas."
        actions={
          <Link to="/quick-order">
            <Button>Nuevo pedido</Button>
          </Link>
        }
      />

      <StatGrid cols={4} className="mb-6">
        <StatTile label="Pedidos en curso" value={inProgress.length} icon={<Truck className="size-4" />} tone="tech" />
        <StatTile label="Entregados (histórico)" value={delivered.length} icon={<FileText className="size-4" />} tone="ok" />
        <StatTile
          label="Facturado acumulado"
          value={fmtMoney({ amount: totalDelivered.toFixed(2), currency: 'USD' }, { compact: true })}
          footer="Suma de pedidos entregados en la demo"
        />
        <StatTile
          label="Unidades compradas"
          value={fmtNumber(delivered.reduce((acc, o) => acc + o.items.reduce((a, i) => a + i.quantity, 0), 0))}
        />
      </StatGrid>

      <FilterBar>
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Buscar por número de pedido o SKU…"
          leading={<Search className="size-4" />}
          className="max-w-xs"
        />
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-auto min-w-[190px]" aria-label="Filtrar por estado">
          <option value="">Todos los estados</option>
          {(Object.keys(ORDER_STATUS) as OrderStatus[]).map((s) => (
            <option key={s} value={s}>
              {ORDER_STATUS[s].label}
            </option>
          ))}
        </Select>
        {orders && <span className="ml-auto"><ResultCount shown={filtered.length} total={orders.length} noun="pedidos" /></span>}
      </FilterBar>

      {error ? (
        <Card>
          <ErrorState description={error.message} onRetry={refetch} />
        </Card>
      ) : (
        <DataTable
          columns={columns}
          rows={filtered}
          rowKey={(o) => o.id}
          loading={initialLoading}
          empty={
            <EmptyState
              title="No hay pedidos con estos filtros"
              description="Probá quitando el filtro de estado o buscando por otro número."
              icon={<FileText className="size-5" />}
            />
          }
          mobileCard={(order) => (
            <div>
              <div className="flex items-start justify-between gap-2">
                <Link to={`/pedidos/${order.id}`} className="text-[13px] font-semibold text-ashir-600">
                  {order.number}
                </Link>
                <OrderStatusBadge status={order.status} size="sm" />
              </div>
              <p className="mt-1 text-xs text-ink-500">
                {fmtDate(order.createdAt)} · {order.items.length} SKUs
              </p>
              <p className="mt-1 text-[13px] font-semibold tabular-nums text-ink-900">{fmtMoney(order.total)}</p>
            </div>
          )}
        />
      )}
    </div>
  );
}
