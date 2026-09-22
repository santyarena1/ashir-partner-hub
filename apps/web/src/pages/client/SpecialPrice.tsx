/**
 * Solicitudes de precio especial del reseller.
 */
import { Link } from 'react-router-dom';
import { Tag } from 'lucide-react';
import type { SpecialPriceRequest } from '@/types';
import { api } from '@/services';
import { useSession } from '@/app/session';
import { useAsync } from '@/app/hooks';
import { fmtDate, fmtMoney, fmtNumber, num } from '@/lib/utils';
import { Button, Card } from '@/components/ui/primitives';
import { DataTable, EmptyState, ErrorState, PageHeader, StatGrid, StatTile, type Column } from '@/components/ui/data';
import { SpecialPriceStatusBadge } from '@/components/domain/common';

export function SpecialPricePage() {
  const { session } = useSession();
  const { data: requests, initialLoading, error, refetch } = useAsync(
    () => api.specialPrice.list({}, session),
    [session.customerId],
  );

  const list = requests ?? [];
  const open = list.filter((r) => ['SUBMITTED', 'SALES_REVIEW', 'PM_REVIEW', 'COUNTEROFFERED'].includes(r.status));
  const approved = list.filter((r) => r.status === 'APPROVED');

  const columns: Column<SpecialPriceRequest>[] = [
    {
      key: 'code',
      header: 'Solicitud',
      cell: (r) => (
        <Link to={`/precio-especial/${r.id}`} className="font-semibold text-ashir-600 hover:text-ashir-700">
          {r.code}
        </Link>
      ),
    },
    {
      key: 'product',
      header: 'Producto',
      cell: (r) => (
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium text-ink-900">{r.productName}</p>
          <p className="text-[11px] text-ink-400">
            <code className="font-mono">{r.sku}</code> · {r.brand}
          </p>
        </div>
      ),
    },
    {
      key: 'qty',
      header: 'Cant.',
      align: 'right',
      cell: (r) => <span className="tabular-nums">{fmtNumber(r.quantity)}</span>,
    },
    {
      key: 'current',
      header: 'Precio actual',
      align: 'right',
      hideOnMobile: true,
      cell: (r) => <span className="tabular-nums text-ink-500">{fmtMoney(r.currentPrice)}</span>,
    },
    {
      key: 'target',
      header: 'Solicitado',
      align: 'right',
      cell: (r) => <span className="font-medium tabular-nums">{fmtMoney(r.targetPrice)}</span>,
    },
    {
      key: 'approved',
      header: 'Aprobado',
      align: 'right',
      cell: (r) =>
        r.approvedPrice ? (
          <span className="font-semibold tabular-nums text-ok-700">{fmtMoney(r.approvedPrice)}</span>
        ) : (
          <span className="text-ink-400">—</span>
        ),
    },
    {
      key: 'status',
      header: 'Estado',
      cell: (r) => <SpecialPriceStatusBadge status={r.status} size="sm" />,
    },
    {
      key: 'date',
      header: 'Creada',
      hideOnMobile: true,
      cell: (r) => <span className="text-ink-600">{fmtDate(r.createdAt)}</span>,
      sortable: true,
      sortValue: (r) => new Date(r.createdAt).getTime(),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Precios especiales"
        subtitle="Pedidos de precio por proyecto o volumen. Tu ejecutivo los revisa y el Product Manager de la marca decide."
        actions={
          <Link to="/catalogo">
            <Button icon={<Tag className="size-4" />}>Solicitar desde un producto</Button>
          </Link>
        }
      />

      <StatGrid cols={4} className="mb-6">
        <StatTile label="En revisión" value={open.length} tone="warn" />
        <StatTile label="Aprobadas vigentes" value={approved.length} tone="ok" />
        <StatTile
          label="Ahorro aprobado"
          value={fmtMoney({
            amount: approved
              .reduce((acc, r) => acc + (num(r.currentPrice) - num(r.approvedPrice)) * (r.approvedQuantity ?? 0), 0)
              .toFixed(2),
            currency: 'USD',
          })}
          footer="Diferencia contra tu precio de lista, por las cantidades aprobadas"
        />
        <StatTile label="Total de solicitudes" value={list.length} />
      </StatGrid>

      {error ? (
        <Card>
          <ErrorState description={error.message} onRetry={refetch} />
        </Card>
      ) : (
        <DataTable
          columns={columns}
          rows={list}
          rowKey={(r) => r.id}
          loading={initialLoading}
          empty={
            <EmptyState
              title="Todavía no pediste ningún precio especial"
              description="Desde la ficha de cualquier producto podés pedir un precio por proyecto o por volumen, indicando el cliente final y la cantidad."
              icon={<Tag className="size-5" />}
              action={
                <Link to="/catalogo">
                  <Button>Ir al catálogo</Button>
                </Link>
              }
            />
          }
          mobileCard={(r) => (
            <div>
              <div className="flex items-start justify-between gap-2">
                <Link to={`/precio-especial/${r.id}`} className="text-[13px] font-semibold text-ashir-600">
                  {r.code}
                </Link>
                <SpecialPriceStatusBadge status={r.status} size="sm" />
              </div>
              <p className="mt-1 truncate text-xs text-ink-600">{r.productName}</p>
              <p className="mt-1 text-xs tabular-nums text-ink-500">
                {fmtNumber(r.quantity)} u. · solicitado {fmtMoney(r.targetPrice)}
              </p>
            </div>
          )}
        />
      )}
    </div>
  );
}
