/**
 * Tablero del backoffice. Cambia según el rol: el ejecutivo ve su cartera,
 * el administrador ve la operación completa.
 */
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  Boxes,
  Building2,
  ClipboardList,
  CreditCard,
  DollarSign,
  ListOrdered,
  Package,
  ShieldAlert,
  Tag,
  TrendingUp,
  Wrench,
} from 'lucide-react';
import { api } from '@/services';
import { useSession } from '@/app/session';
import { useAsync } from '@/app/hooks';
import { backofficeOverview, salesOverview } from '@/services/mock/analytics';
import { CATALOG_META } from '@/mocks/fixtures/catalog';
import { ORDER_STATUS, CHART_COLORS } from '@/lib/labels';
import { fmtDate, fmtMoney, fmtNumber, fmtRelative, num } from '@/lib/utils';
import { Badge, Button, Card, CardHeader } from '@/components/ui/primitives';
import {
  Callout,
  DataTable,
  EmptyState,
  PageHeader,
  SectionTitle,
  ZoneHeader,
  StatGrid,
  StatTile,
  type Column,
} from '@/components/ui/data';
import { Bars, ChartFrame, Donut, TrendArea } from '@/components/ui/charts';
import { IntegrationStatusWidget, OrderStatusBadge, SegmentBadge, SlaIndicator } from '@/components/domain/common';
import type { Customer, Order } from '@/types';
import { ROLE_LABEL } from '@/lib/labels';

export function BoDashboard() {
  const { session, role } = useSession();
  const overview = backofficeOverview();
  const mine = salesOverview(session.userId);
  const integrations = useAsync(() => api.integrations.list(), []);
  const requests = useAsync(() => api.specialPrice.list({}, session), [session.role]);
  const rmas = useAsync(() => api.rma.listCases({}, session), [session.role]);

  const erp = integrations.data?.find((i) => i.id === 'int_erp');
  const nodo = integrations.data?.find((i) => i.id === 'int_nodo');
  const isSales = role === 'SALES';

  const pendingRequests = (requests.data ?? []).filter((r) =>
    ['SUBMITTED', 'SALES_REVIEW', 'PM_REVIEW'].includes(r.status),
  );
  const breachedRmas = (rmas.data ?? []).filter((r) => r.sla.breached);

  const orderColumns: Column<Order>[] = [
    {
      key: 'number',
      header: 'Pedido',
      cell: (o) => (
        <Link to={`/bo/pedidos/${o.id}`} className="font-semibold text-ashir-600 hover:text-ashir-700">
          {o.number}
        </Link>
      ),
    },
    {
      key: 'customer',
      header: 'Cliente',
      cell: (o) => <span className="truncate text-ink-800">{o.customerName}</span>,
    },
    {
      key: 'status',
      header: 'Estado',
      cell: (o) => <OrderStatusBadge status={o.status} size="sm" />,
    },
    {
      key: 'date',
      header: 'Creado',
      hideOnMobile: true,
      cell: (o) => <span className="text-ink-500">{fmtRelative(o.createdAt)}</span>,
    },
    {
      key: 'total',
      header: 'Total',
      align: 'right',
      cell: (o) => <span className="font-semibold tabular-nums">{fmtMoney(o.total)}</span>,
    },
  ];

  const customerColumns: Column<Customer>[] = [
    {
      key: 'name',
      header: 'Cliente',
      cell: (c) => (
        <div className="min-w-0">
          <Link to={`/bo/clientes/${c.id}`} className="truncate text-[13px] font-medium text-ashir-600 hover:text-ashir-700">
            {c.tradeName}
          </Link>
          <p className="text-[11px] text-ink-400">{c.code}</p>
        </div>
      ),
    },
    { key: 'segment', header: 'Segmento', cell: (c) => <SegmentBadge segment={c.segment} size="sm" /> },
    {
      key: 'overdue',
      header: 'Vencido',
      align: 'right',
      cell: (c) => (
        <span className={num(c.account.overdue) > 0 ? 'font-semibold text-bad-600' : 'text-ink-400'}>
          {num(c.account.overdue) > 0 ? fmtMoney(c.account.overdue) : '—'}
        </span>
      ),
    },
    {
      key: 'last',
      header: 'Última compra',
      align: 'right',
      hideOnMobile: true,
      cell: (c) => <span className="text-ink-500">{c.lastOrderAt ? fmtRelative(c.lastOrderAt) : 'Nunca'}</span>,
    },
  ];

  return (
    <div>
      <PageHeader
        title={isSales ? 'Tablero comercial' : 'Tablero general'}
        subtitle={
          isSales
            ? `Tu cartera: ${mine.customers.length} clientes, ${mine.orders.length} pedidos registrados en la demo.`
            : `Vista integral de la operación. Catálogo de ${fmtNumber(CATALOG_META.productCount)} SKUs importados de la lista de distribuidor.`
        }
        badge={<Badge tone="neutral">{ROLE_LABEL[role]}</Badge>}
      />

      {/* ================= zona 1 — requiere acción ================= */}
      {(breachedRmas.length > 0 || overview.pendingApproval > 0 || pendingRequests.length > 0) && (
        <ZoneHeader
          title="Requiere una acción"
          subtitle="Cosas frenadas esperando que alguien decida"
        />
      )}
      <div className="mb-6 space-y-2">
        {breachedRmas.length > 0 && (
          <Callout
            tone="bad"
            icon={<ShieldAlert className="size-4" />}
            title={`${breachedRmas.length} caso(s) de RMA fuera de SLA`}
            action={
              <Link to="/bo/rma?sla=breached">
                <Button size="sm" variant="outline">
                  Revisar
                </Button>
              </Link>
            }
          >
            {breachedRmas[0]!.code} lleva {Math.round(breachedRmas[0]!.sla.elapsedHours / 24)} días en la etapa de{' '}
            {breachedRmas[0]!.sla.stage === 'DIAGNOSIS' ? 'diagnóstico' : 'resolución'} (objetivo:{' '}
            {breachedRmas[0]!.sla.targetHours} h).
          </Callout>
        )}
        {overview.pendingApproval > 0 && (
          <Callout
            tone="warn"
            icon={<AlertCircle className="size-4" />}
            title={`${overview.pendingApproval} pedido(s) pendientes de aprobación`}
            action={
              <Link to="/bo/pedidos?status=PENDING_APPROVAL">
                <Button size="sm" variant="outline">
                  Aprobar
                </Button>
              </Link>
            }
          >
            Superan el crédito disponible del cliente y no avanzan hasta que un ejecutivo los autorice.
          </Callout>
        )}
        {pendingRequests.length > 0 && (
          <Callout
            tone="warn"
            icon={<Tag className="size-4" />}
            title={`${pendingRequests.length} solicitud(es) de precio especial esperando decisión`}
            action={
              <Link to="/bo/solicitudes">
                <Button size="sm" variant="outline">
                  Ver solicitudes
                </Button>
              </Link>
            }
          >
            {pendingRequests[0]!.code} · {pendingRequests[0]!.customerName} pide{' '}
            {fmtMoney(pendingRequests[0]!.targetPrice)} por {fmtNumber(pendingRequests[0]!.quantity)} unidades de{' '}
            {pendingRequests[0]!.sku}.
          </Callout>
        )}
      </div>

      {/* ================= zona 2 — cómo viene el mes ================= */}
      <ZoneHeader title="Cómo viene el mes" subtitle="Volumen, mezcla de marcas y distribución de pedidos" />

      {/* KPIs */}
      {isSales ? (
        <StatGrid cols={4} className="mb-6">
          <StatTile
            label="Facturación de tu cartera (12 m)"
            value={fmtMoney(mine.portfolio, { compact: true })}
            icon={<DollarSign className="size-4" />}
            tone="ok"
            footer={`${mine.customers.length} clientes asignados`}
          />
          <StatTile
            label="Pedidos por revisar"
            value={mine.pendingApproval.length}
            icon={<ClipboardList className="size-4" />}
            tone="warn"
            footer={`${mine.observed.length} observados`}
          />
          <StatTile
            label="Clientes con deuda vencida"
            value={mine.overdue.length}
            icon={<CreditCard className="size-4" />}
            tone={mine.overdue.length > 0 ? 'bad' : 'ok'}
            footer={
              mine.overdue.length > 0
                ? `${fmtMoney({ amount: mine.overdue.reduce((a, c) => a + num(c.account.overdue), 0).toFixed(2), currency: 'USD' })} total`
                : 'Cartera al día'
            }
          />
          <StatTile
            label="Clientes sin comprar"
            value={mine.inactive.length}
            icon={<Building2 className="size-4" />}
            tone="warn"
            footer="Superaron el doble de su frecuencia habitual"
          />
        </StatGrid>
      ) : (
        <StatGrid cols={4} className="mb-6">
          <StatTile
            label="Facturación del mes"
            value={fmtMoney(overview.monthRevenue, { compact: true })}
            delta={overview.monthRevenueVsPrevPct}
            deltaLabel="vs. mes anterior"
            icon={<TrendingUp className="size-4" />}
            tone="ok"
          />
          <StatTile
            label="Pedidos activos"
            value={overview.activeOrders}
            icon={<ListOrdered className="size-4" />}
            tone="tech"
            footer={`${overview.pendingApproval} esperando aprobación`}
          />
          <StatTile
            label="RMAs abiertos"
            value={overview.openRmas}
            icon={<Wrench className="size-4" />}
            tone={overview.breachedRmas > 0 ? 'bad' : 'warn'}
            footer={`${overview.breachedRmas} fuera de SLA`}
          />
          <StatTile
            label="Stock valorizado"
            value={fmtMoney(overview.totalStockValue, { compact: true })}
            icon={<Boxes className="size-4" />}
            footer={`${overview.criticalStock} SKUs con stock crítico`}
          />
        </StatGrid>
      )}

      {/* ---------- gráficos ---------- */}
      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <ChartFrame
          title="Facturación de los últimos 12 meses"
          subtitle="Serie de demostración en USD"
          className="lg:col-span-2"
          height={260}
        >
          <TrendArea
            data={overview.salesSeries}
            xKey="month"
            yKey="revenue"
            formatter={(v) => `USD ${fmtNumber(v)}`}
          />
        </ChartFrame>

        <ChartFrame title="Participación por marca" subtitle="Promedio mensual estimado" height={260}>
          <Donut
            data={overview.brandShare}
            nameKey="brand"
            valueKey="value"
            formatter={(v) => `USD ${fmtNumber(v)}`}
          />
        </ChartFrame>
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <ChartFrame title="Pedidos por estado" subtitle="Distribución actual de la demo" height={240}>
          <Bars
            data={overview.ordersByStatus.map((row) => ({
              label: ORDER_STATUS[row.status as keyof typeof ORDER_STATUS]?.label ?? row.status,
              count: row.count,
            }))}
            xKey="label"
            yKey="count"
            horizontal
            colorByIndex={(_, i) => CHART_COLORS[i % CHART_COLORS.length]!}
          />
        </ChartFrame>

        <ChartFrame title="Principales clientes" subtitle="Compras acumuladas 12 meses" height={240}>
          <Bars
            data={overview.topCustomers.map((c) => ({ label: c.name, amount: c.amount }))}
            xKey="label"
            yKey="amount"
            horizontal
            formatter={(v) => `USD ${fmtNumber(v)}`}
          />
        </ChartFrame>
      </div>

      {/* ================= zona 3 — operación del día ================= */}
      <ZoneHeader title="Operación del día" subtitle="Lo que hay sobre la mesa ahora mismo" />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-5">
          <section>
            <SectionTitle
              title={isSales ? 'Pedidos de tu cartera que requieren acción' : 'Pedidos que requieren acción'}
              action={
                <Link to="/bo/pedidos" className="text-[13px] font-medium text-ashir-600 hover:text-ashir-700">
                  Ver todos
                </Link>
              }
            />
            <ActionableOrders isSales={isSales} columns={orderColumns} />
          </section>

          {isSales && (
            <section>
              <SectionTitle title="Clientes de tu cartera para seguir" subtitle="Deuda vencida o inactividad" />
              <DataTable
                columns={customerColumns}
                rows={[...mine.overdue, ...mine.inactive].slice(0, 6)}
                rowKey={(c) => c.id}
                dense
                empty={<EmptyState compact title="Tu cartera está al día" icon={<Building2 className="size-5" />} />}
              />
            </section>
          )}

          {!isSales && (
            <section>
              <SectionTitle
                title="Próximos vencimientos de cuenta corriente"
                action={
                  <Link to="/bo/clientes" className="text-[13px] font-medium text-ashir-600 hover:text-ashir-700">
                    Ver clientes
                  </Link>
                }
              />
              <NextDueCustomers columns={customerColumns} />
            </section>
          )}
        </div>

        {/* ---------- integraciones ---------- */}
        <div className="space-y-4">
          {erp && (
            <IntegrationStatusWidget
              source="ERP Ashir"
              status={erp.status}
              lastSyncAt={erp.lastSyncAt}
              nextSyncAt={erp.nextSyncAt}
              entities={erp.entities.filter((e) => e.enabled).length}
              errorCount={erp.errorCount}
              detailHref="/bo/integraciones/int_erp"
            />
          )}
          {nodo && (
            <IntegrationStatusWidget
              source="NODO"
              status={nodo.status}
              lastSyncAt={nodo.lastSyncAt}
              nextSyncAt={nodo.nextSyncAt}
              entities={nodo.entities.filter((e) => e.enabled).length}
              errorCount={nodo.errorCount}
              detailHref="/bo/integraciones/nodo"
            />
          )}

          <Card>
            <CardHeader title="Casos de RMA a vigilar" icon={<Wrench className="size-4" />} />
            <ul className="divide-y divide-ink-100">
              {(rmas.data ?? [])
                .filter((r) => !['CLOSED', 'REJECTED'].includes(r.status))
                .sort((a, b) => a.sla.remainingHours - b.sla.remainingHours)
                .slice(0, 5)
                .map((r) => (
                  <li key={r.id}>
                    <Link to={`/bo/rma/${r.id}`} className="block px-4 py-3 transition-colors hover:bg-ink-50">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-[13px] font-semibold text-ink-900">{r.code}</span>
                        <SlaIndicator sla={r.sla} />
                      </div>
                      <p className="mt-0.5 truncate text-xs text-ink-500">
                        {r.customerName} · {r.units[0]?.brand} · {r.units.length} u.
                      </p>
                    </Link>
                  </li>
                ))}
            </ul>
            <div className="border-t border-ink-100 px-4 py-2.5">
              <Link to="/bo/rma" className="text-[13px] font-medium text-ashir-600 hover:text-ashir-700">
                Ir al centro de RMA
              </Link>
            </div>
          </Card>

          <Card>
            <CardHeader title="Última importación de productos" icon={<Package className="size-4" />} />
            <div className="p-4 text-[13px]">
              <p className="font-medium text-ink-900">{CATALOG_META.source}</p>
              <p className="mt-1 text-ink-500">
                {fmtNumber(CATALOG_META.productCount)} productos · {CATALOG_META.problemCount} observaciones
              </p>
              <p className="mt-1 text-xs text-ink-400">
                Hoja «{CATALOG_META.sheet}» · {fmtDate(CATALOG_META.importedAt)}
              </p>
              <Link to="/bo/importaciones" className="mt-3 block">
                <Button variant="outline" size="sm" className="w-full">
                  Ver centro de importaciones
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sub-tablas que necesitan su propio fetch                            */
/* ------------------------------------------------------------------ */

function ActionableOrders({ isSales, columns }: { isSales: boolean; columns: Column<Order>[] }) {
  const { session } = useSession();
  const { data, initialLoading } = useAsync(() => api.orders.list({}, session), [session.role]);

  const actionable = (data ?? []).filter((o) =>
    ['PENDING_APPROVAL', 'SALES_REVIEW', 'OBSERVED', 'PENDING_PAYMENT'].includes(o.status),
  );

  if (initialLoading) return <DataTable columns={columns} rows={[]} rowKey={() => ''} loading loadingRows={4} className="border-0" />;
  if (actionable.length === 0) {
    return (
      <EmptyState
        compact
        title={isSales ? 'No hay pedidos de tu cartera esperando acción' : 'No hay pedidos esperando acción'}
        description="Todos los pedidos están dentro del flujo normal."
        icon={<ListOrdered className="size-5" />}
      />
    );
  }

  return (
    <DataTable columns={columns} rows={actionable.slice(0, 6)} rowKey={(o) => o.id} dense className="border-0" />
  );
}

function NextDueCustomers({ columns }: { columns: Column<Customer>[] }) {
  const { data, initialLoading } = useAsync(() => api.customers.list({}), []);
  const due = (data ?? [])
    .filter((c) => c.account.nextDueDate)
    .sort((a, b) => new Date(a.account.nextDueDate!).getTime() - new Date(b.account.nextDueDate!).getTime())
    .slice(0, 6);

  if (initialLoading) return <DataTable columns={columns} rows={[]} rowKey={() => ''} loading loadingRows={4} className="border-0" />;
  if (due.length === 0) return <EmptyState compact title="Sin vencimientos próximos" icon={<CreditCard className="size-5" />} />;

  return <DataTable columns={columns} rows={due} rowKey={(c) => c.id} dense className="border-0" />;
}
