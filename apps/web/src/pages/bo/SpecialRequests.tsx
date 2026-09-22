/**
 * Cola de solicitudes de precio especial.
 * El margen resultante solo se muestra a roles con `margin:read`.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Tag, TrendingDown } from 'lucide-react';
import type { SpecialPriceRequest } from '@/types';
import { api } from '@/services';
import { useSession } from '@/app/session';
import { useAsync } from '@/app/hooks';
import { personName } from '@/mocks/fixtures/people';
import { can } from '@/lib/rbac';
import { SPECIAL_PRICE_STATUS } from '@/lib/labels';
import { cn, fmtDate, fmtMoney, fmtNumber, fmtRelative, normalize, num } from '@/lib/utils';
import { Card, Input, Segmented, Select } from '@/components/ui/primitives';
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
import { SpecialPriceStatusBadge } from '@/components/domain/common';

export function BoSpecialRequests() {
  const { session, role } = useSession();
  const [term, setTerm] = useState('');
  const [status, setStatus] = useState('');
  const [view, setView] = useState<'pending' | 'all'>('pending');
  const showMargin = can(session, 'margin:read');

  const { data, initialLoading, error, refetch } = useAsync(() => api.specialPrice.list({}, session), [session.role]);

  const all = data ?? [];
  const pending = all.filter((r) => ['SUBMITTED', 'SALES_REVIEW', 'PM_REVIEW'].includes(r.status));

  const filtered = (view === 'pending' ? pending : all).filter((r) => {
    if (status && r.status !== status) return false;
    if (term) {
      const q = normalize(term);
      return normalize(r.code).includes(q) || normalize(r.customerName).includes(q) || normalize(r.sku).includes(q);
    }
    return true;
  });

  const columns: Column<SpecialPriceRequest>[] = [
    {
      key: 'code',
      header: 'Solicitud',
      cell: (r) => (
        <div>
          <Link to={`/bo/solicitudes/${r.id}`} className="font-semibold text-ashir-600 hover:text-ashir-700">
            {r.code}
          </Link>
          <p className="text-[11px] text-ink-400">{fmtRelative(r.createdAt)}</p>
        </div>
      ),
    },
    {
      key: 'customer',
      header: 'Cliente',
      cell: (r) => (
        <div className="min-w-0">
          <Link to={`/bo/clientes/${r.customerId}`} className="truncate text-[13px] font-medium text-ink-900 hover:text-ashir-700">
            {r.customerName}
          </Link>
          <p className="truncate text-[11px] text-ink-400">{r.endCustomer || r.project || '—'}</p>
        </div>
      ),
    },
    {
      key: 'product',
      header: 'Producto',
      cell: (r) => (
        <div className="min-w-0">
          <p className="truncate text-[13px] text-ink-800">{r.productName}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-ink-400">
            <Mono>{r.sku}</Mono>
            <span>{r.brand}</span>
          </p>
        </div>
      ),
    },
    {
      key: 'qty',
      header: 'Cant.',
      align: 'right',
      cell: (r) => <span className="font-medium tabular-nums">{fmtNumber(r.quantity)}</span>,
      sortable: true,
      sortValue: (r) => r.quantity,
    },
    {
      key: 'prices',
      header: 'Actual → solicitado',
      align: 'right',
      cell: (r) => (
        <div className="tabular-nums">
          <span className="text-ink-500">{fmtMoney(r.currentPrice, { withCode: false })}</span>
          <span className="mx-1 text-ink-300">→</span>
          <span className="font-semibold text-ink-900">{fmtMoney(r.targetPrice, { withCode: false })}</span>
          <p className="text-[11px] text-bad-600">
            {(((num(r.targetPrice) - num(r.currentPrice)) / Math.max(0.01, num(r.currentPrice))) * 100).toFixed(1).replace('.', ',')}%
          </p>
        </div>
      ),
    },
    ...(showMargin
      ? [
          {
            key: 'margin',
            header: 'Margen result.',
            align: 'right' as const,
            cell: (r: SpecialPriceRequest) =>
              r.resultingMarginPct ? (
                <div className="tabular-nums">
                  <span
                    className={cn(
                      'font-semibold',
                      Number.parseFloat(r.resultingMarginPct) < 8
                        ? 'text-bad-600'
                        : Number.parseFloat(r.resultingMarginPct) < 14
                          ? 'text-warn-700'
                          : 'text-ok-700',
                    )}
                  >
                    {r.resultingMarginPct}%
                  </span>
                  {r.baseMarginPct && <p className="text-[11px] text-ink-400">base {r.baseMarginPct}%</p>}
                </div>
              ) : (
                <span className="text-ink-400">—</span>
              ),
            sortable: true,
            sortValue: (r: SpecialPriceRequest) => Number.parseFloat(r.resultingMarginPct ?? '0'),
          },
        ]
      : []),
    {
      key: 'status',
      header: 'Estado',
      cell: (r) => <SpecialPriceStatusBadge status={r.status} size="sm" />,
      sortable: true,
      sortValue: (r) => SPECIAL_PRICE_STATUS[r.status].label,
    },
    {
      key: 'pm',
      header: 'PM / Comercial',
      hideOnMobile: true,
      cell: (r) => (
        <span className="text-xs text-ink-600">
          {personName(r.pmId)}
          <br />
          <span className="text-ink-400">{personName(r.salesRepId)}</span>
        </span>
      ),
    },
    {
      key: 'close',
      header: 'Cierre est.',
      align: 'right',
      hideOnMobile: true,
      cell: (r) => <span className="text-xs text-ink-500">{fmtDate(r.expectedCloseDate)}</span>,
      sortable: true,
      sortValue: (r) => new Date(r.expectedCloseDate).getTime(),
    },
  ];

  const lowMargin = all.filter((r) => r.resultingMarginPct && Number.parseFloat(r.resultingMarginPct) < 8);

  return (
    <div>
      <PageHeader
        title="Solicitudes de precio especial"
        subtitle={
          role === 'PM'
            ? 'Solicitudes sobre las marcas que tenés a cargo. Cada decisión queda auditada con el margen resultante.'
            : 'Pedidos de precio por proyecto o volumen. Pasan por el ejecutivo y los decide el Product Manager de la marca.'
        }
      />

      {lowMargin.length > 0 && showMargin && (
        <Callout tone="bad" icon={<TrendingDown className="size-4" />} title={`${lowMargin.length} solicitud(es) con margen crítico`} className="mb-5">
          Quedarían por debajo del 8% de margen. Revisá si el volumen o la recurrencia del cliente lo justifican antes
          de aprobar.
        </Callout>
      )}

      <StatGrid cols={5} className="mb-6">
        <StatTile label="Total" value={all.length} icon={<Tag className="size-4" />} />
        <StatTile label="Esperando decisión" value={pending.length} tone="warn" />
        <StatTile label="Aprobadas" value={all.filter((r) => r.status === 'APPROVED').length} tone="ok" />
        <StatTile label="Contraofertadas" value={all.filter((r) => r.status === 'COUNTEROFFERED').length} tone="tech" />
        <StatTile
          label="Rechazadas"
          value={all.filter((r) => r.status === 'REJECTED').length}
          footer={showMargin ? `${lowMargin.length} con margen bajo el piso` : undefined}
        />
      </StatGrid>

      <FilterBar>
        <Segmented
          value={view}
          onChange={setView}
          options={[
            { value: 'pending', label: `Pendientes (${pending.length})` },
            { value: 'all', label: `Todas (${all.length})` },
          ]}
        />
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Buscar por código, cliente o SKU…"
          leading={<Search className="size-4" />}
          className="max-w-xs"
        />
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-auto min-w-[170px]" aria-label="Estado">
          <option value="">Todos los estados</option>
          {(Object.keys(SPECIAL_PRICE_STATUS) as (keyof typeof SPECIAL_PRICE_STATUS)[]).map((s) => (
            <option key={s} value={s}>
              {SPECIAL_PRICE_STATUS[s].label}
            </option>
          ))}
        </Select>
        <span className="ml-auto">
          <ResultCount shown={filtered.length} total={all.length} noun="solicitudes" />
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
          rowKey={(r) => r.id}
          loading={initialLoading}
          dense
          empty={
            <EmptyState
              title="No hay solicitudes con estos filtros"
              description={role === 'PM' ? 'No hay pedidos de precio sobre tus marcas en este momento.' : 'Probá con otro estado o quitando la búsqueda.'}
              icon={<Tag className="size-5" />}
            />
          }
          mobileCard={(r) => (
            <div>
              <div className="flex items-start justify-between gap-2">
                <Link to={`/bo/solicitudes/${r.id}`} className="text-[13px] font-semibold text-ashir-600">
                  {r.code}
                </Link>
                <SpecialPriceStatusBadge status={r.status} size="sm" />
              </div>
              <p className="mt-1 truncate text-xs text-ink-600">
                {r.customerName} · {r.sku}
              </p>
              <p className="mt-1 text-xs tabular-nums text-ink-500">
                {fmtNumber(r.quantity)} u. · {fmtMoney(r.targetPrice)}
                {showMargin && r.resultingMarginPct && <span className="ml-2">margen {r.resultingMarginPct}%</span>}
              </p>
            </div>
          )}
        />
      )}

      {!showMargin && (
        <Callout tone="neutral" className="mt-5">
          Tu rol no tiene acceso al costo ni al margen resultante. Cambiá a Product Manager o Administrador para ver el
          análisis completo de cada solicitud.
        </Callout>
      )}
    </div>
  );
}
