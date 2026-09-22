/**
 * Reportes: vistas agregadas de venta, clientes, marcas y calidad.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, Download, FileText, TrendingUp, Users, Wrench } from 'lucide-react';
import { api } from '@/services';
import { useSession } from '@/app/session';
import { useAsync } from '@/app/hooks';
import { useToast } from '@/components/ui/overlays';
import { backofficeOverview } from '@/services/mock/analytics';
import { BRANDS, CATEGORIES, PRODUCTS } from '@/mocks/fixtures/catalog';
import { can } from '@/lib/rbac';
import { CHART_COLORS, ORDER_STATUS } from '@/lib/labels';
import { cn, downloadTextFile, fmtMoney, fmtNumber, num } from '@/lib/utils';
import { Badge, Button, Card, CardHeader, Segmented } from '@/components/ui/primitives';
import {
  Callout,
  DataTable,
  PageHeader,
  SectionTitle,
  StatGrid,
  StatTile,
  type Column,
} from '@/components/ui/data';
import { Bars, ChartFrame, Donut, TrendArea } from '@/components/ui/charts';
import { SegmentBadge, brandColor } from '@/components/domain/common';

interface CategoryRow {
  category: string;
  group: string;
  skus: number;
  stockUnits: number;
  stockValue: number;
  unitsSold: number;
  revenue: number;
}

export function BoReports() {
  const { session } = useSession();
  const toast = useToast();
  const [tab, setTab] = useState<'sales' | 'catalog' | 'customers' | 'quality'>('sales');

  const overview = backofficeOverview();
  const customers = useAsync(() => api.customers.list({}), []);
  const rmas = useAsync(() => api.rma.listCases({}, session), [session.role]);

  const categoryRows: CategoryRow[] = CATEGORIES.map((category) => {
    const products = PRODUCTS.filter((p) => p.categoryId === category.id);
    const priced = products.filter((p) => p.listPrice);
    return {
      category: category.name,
      group: category.group,
      skus: products.length,
      stockUnits: products.reduce((a, p) => a + p.stock, 0),
      stockValue: priced.reduce((a, p) => a + num(p.listPrice) * p.stock, 0),
      unitsSold: products.reduce((a, p) => a + p.unitsSold12m, 0),
      revenue: priced.reduce((a, p) => a + num(p.listPrice) * p.unitsSold12m, 0),
    };
  }).sort((a, b) => b.revenue - a.revenue);

  const categoryColumns: Column<CategoryRow>[] = [
    { key: 'category', header: 'Categoría', cell: (r) => <span className="font-medium text-ink-900">{r.category}</span> },
    { key: 'group', header: 'Grupo', hideOnMobile: true, cell: (r) => <span className="text-xs text-ink-500">{r.group}</span> },
    { key: 'skus', header: 'SKUs', align: 'right', cell: (r) => <span className="tabular-nums">{r.skus}</span>, sortable: true, sortValue: (r) => r.skus },
    {
      key: 'stock',
      header: 'Stock (u.)',
      align: 'right',
      hideOnMobile: true,
      cell: (r) => <span className="tabular-nums text-ink-600">{fmtNumber(r.stockUnits)}</span>,
      sortable: true,
      sortValue: (r) => r.stockUnits,
    },
    {
      key: 'stockValue',
      header: 'Stock valorizado',
      align: 'right',
      cell: (r) => (
        <span className="tabular-nums text-ink-700">
          {fmtMoney({ amount: r.stockValue.toFixed(2), currency: 'USD' }, { compact: true })}
        </span>
      ),
      sortable: true,
      sortValue: (r) => r.stockValue,
    },
    {
      key: 'sold',
      header: 'Vendidas 12 m',
      align: 'right',
      hideOnMobile: true,
      cell: (r) => <span className="tabular-nums text-ink-600">{fmtNumber(r.unitsSold)}</span>,
      sortable: true,
      sortValue: (r) => r.unitsSold,
    },
    {
      key: 'revenue',
      header: 'Facturación 12 m',
      align: 'right',
      cell: (r) => (
        <span className="font-semibold tabular-nums text-ink-900">
          {fmtMoney({ amount: r.revenue.toFixed(2), currency: 'USD' }, { compact: true })}
        </span>
      ),
      sortable: true,
      sortValue: (r) => r.revenue,
    },
  ];

  const exportCsv = () => {
    const rows = ['categoria,grupo,skus,stock_unidades,stock_valorizado_usd,unidades_vendidas_12m,facturacion_12m_usd']
      .concat(
        categoryRows.map((r) =>
          [r.category, r.group, r.skus, r.stockUnits, r.stockValue.toFixed(2), r.unitsSold, r.revenue.toFixed(2)].join(','),
        ),
      )
      .join('\n');
    downloadTextFile('reporte-categorias-ashir.csv', rows, 'text/csv');
    toast.success('Reporte descargado', 'reporte-categorias-ashir.csv');
  };

  return (
    <div>
      <PageHeader
        title="Reportes"
        subtitle="Vistas agregadas de la operación. Los datos de venta son de demostración; el catálogo es real."
        actions={
          <Button variant="outline" icon={<Download className="size-4" />} onClick={exportCsv}>
            Exportar CSV
          </Button>
        }
      />

      <Segmented
        className="mb-6"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'sales', label: 'Ventas' },
          { value: 'catalog', label: 'Catálogo' },
          { value: 'customers', label: 'Clientes' },
          { value: 'quality', label: 'Calidad' },
        ]}
      />

      {/* ---------------- ventas ---------------- */}
      {tab === 'sales' && (
        <div className="space-y-5">
          <StatGrid cols={4}>
            <StatTile
              label="Facturación del mes"
              value={fmtMoney(overview.monthRevenue, { compact: true })}
              delta={overview.monthRevenueVsPrevPct}
              icon={<TrendingUp className="size-4" />}
              tone="ok"
            />
            <StatTile label="Pedidos activos" value={overview.activeOrders} />
            <StatTile label="Clientes activos" value={overview.activeCustomers} icon={<Users className="size-4" />} />
            <StatTile
              label="Stock valorizado"
              value={fmtMoney(overview.totalStockValue, { compact: true })}
              footer={`${overview.criticalStock} SKUs críticos`}
            />
          </StatGrid>

          <ChartFrame title="Facturación mensual" subtitle="Últimos 12 meses" height={280}>
            <TrendArea data={overview.salesSeries} xKey="month" yKey="revenue" formatter={(v) => `USD ${fmtNumber(v)}`} />
          </ChartFrame>

          <div className="grid gap-4 lg:grid-cols-2">
            <ChartFrame title="Cantidad de pedidos por mes" height={250}>
              <Bars data={overview.salesSeries} xKey="month" yKey="orders" formatter={(v) => `${v} pedidos`} />
            </ChartFrame>
            <ChartFrame title="Pedidos por estado" height={250}>
              <Bars
                data={overview.ordersByStatus.map((r) => ({
                  label: ORDER_STATUS[r.status as keyof typeof ORDER_STATUS]?.label ?? r.status,
                  count: r.count,
                }))}
                xKey="label"
                yKey="count"
                horizontal
                colorByIndex={(_, i) => CHART_COLORS[i % CHART_COLORS.length]!}
              />
            </ChartFrame>
          </div>
        </div>
      )}

      {/* ---------------- catálogo ---------------- */}
      {tab === 'catalog' && (
        <div className="space-y-5">
          <StatGrid cols={4}>
            <StatTile label="SKUs en catálogo" value={fmtNumber(PRODUCTS.length)} icon={<FileText className="size-4" />} />
            <StatTile label="Con stock" value={fmtNumber(PRODUCTS.filter((p) => p.stock > 0).length)} tone="ok" />
            <StatTile label="Marcas" value={BRANDS.length} />
            <StatTile label="Categorías" value={CATEGORIES.length} />
          </StatGrid>

          <div className="grid gap-4 lg:grid-cols-2">
            <ChartFrame title="Facturación por categoría" subtitle="Acumulado 12 meses" height={280}>
              <Bars
                data={categoryRows.slice(0, 8).map((r) => ({ label: r.category, revenue: r.revenue }))}
                xKey="label"
                yKey="revenue"
                horizontal
                formatter={(v) => `USD ${fmtNumber(v)}`}
              />
            </ChartFrame>
            <ChartFrame title="Participación por marca" height={280}>
              <Donut data={overview.brandShare} nameKey="brand" valueKey="value" formatter={(v) => `USD ${fmtNumber(v)}`} />
            </ChartFrame>
          </div>

          <SectionTitle title="Detalle por categoría" />
          <DataTable columns={categoryColumns} rows={categoryRows} rowKey={(r) => r.category} dense />
        </div>
      )}

      {/* ---------------- clientes ---------------- */}
      {tab === 'customers' && (
        <div className="space-y-5">
          <StatGrid cols={4}>
            <StatTile label="Clientes" value={(customers.data ?? []).length} icon={<Users className="size-4" />} />
            <StatTile
              label="Platinum"
              value={(customers.data ?? []).filter((c) => c.segment === 'PLATINUM').length}
              tone="plat"
            />
            <StatTile
              label="Con deuda vencida"
              value={(customers.data ?? []).filter((c) => num(c.account.overdue) > 0).length}
              tone="bad"
            />
            <StatTile
              label="Crédito otorgado"
              value={fmtMoney(
                {
                  amount: (customers.data ?? []).reduce((a, c) => a + num(c.account.creditLimit), 0).toFixed(2),
                  currency: 'USD',
                },
                { compact: true },
              )}
            />
          </StatGrid>

          <ChartFrame title="Principales clientes" subtitle="Compras acumuladas 12 meses" height={300}>
            <Bars
              data={overview.topCustomers.map((c) => ({ label: c.name, amount: c.amount }))}
              xKey="label"
              yKey="amount"
              horizontal
              formatter={(v) => `USD ${fmtNumber(v)}`}
            />
          </ChartFrame>

          <Card>
            <CardHeader title="Ranking de clientes" />
            <ul className="divide-y divide-ink-100">
              {overview.topCustomers.map((customer, i) => (
                <li key={customer.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-ink-100 text-[11px] font-bold text-ink-600">
                      {i + 1}
                    </span>
                    <Link to={`/bo/clientes/${customer.id}`} className="truncate text-[13px] font-medium text-ashir-600 hover:text-ashir-700">
                      {customer.name}
                    </Link>
                    <SegmentBadge segment={customer.segment} size="sm" />
                  </div>
                  <span className="shrink-0 text-[13px] font-semibold tabular-nums text-ink-900">
                    {fmtMoney({ amount: customer.amount.toFixed(2), currency: 'USD' }, { compact: true })}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}

      {/* ---------------- calidad ---------------- */}
      {tab === 'quality' && (
        <div className="space-y-5">
          <StatGrid cols={4}>
            <StatTile label="Casos de RMA" value={(rmas.data ?? []).length} icon={<Wrench className="size-4" />} />
            <StatTile
              label="Abiertos"
              value={(rmas.data ?? []).filter((r) => !['CLOSED', 'REJECTED'].includes(r.status)).length}
              tone="warn"
            />
            <StatTile
              label="Fuera de SLA"
              value={(rmas.data ?? []).filter((r) => r.sla.breached).length}
              tone="bad"
            />
            <StatTile
              label="Cerrados"
              value={(rmas.data ?? []).filter((r) => r.status === 'CLOSED').length}
              tone="ok"
            />
          </StatGrid>

          <ChartFrame title="Casos de RMA por marca" height={280}>
            <Bars
              data={BRANDS.map((b) => ({
                label: b.name,
                count: (rmas.data ?? []).filter((r) => r.units.some((u) => u.brand === b.name)).length,
              })).filter((r) => r.count > 0)}
              xKey="label"
              yKey="count"
              horizontal
              colorByIndex={(row) => brandColor((row as { label: string }).label)}
              formatter={(v) => `${v} casos`}
            />
          </ChartFrame>

          <Card>
            <CardHeader title="Tasa de RMA por marca" subtitle="Casos sobre unidades vendidas del período" />
            <ul className="divide-y divide-ink-100">
              {BRANDS.map((brand) => {
                const cases = (rmas.data ?? []).filter((r) => r.units.some((u) => u.brand === brand.name)).length;
                const sold = PRODUCTS.filter((p) => p.brandId === brand.id).reduce((a, p) => a + p.unitsSold12m, 0);
                const rate = sold > 0 ? (cases / sold) * 100 : 0;
                return (
                  <li key={brand.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                    <span className="flex min-w-0 items-center gap-2.5">
                      <span className="size-2.5 shrink-0 rounded-sm" style={{ background: brandColor(brand.name) }} aria-hidden />
                      <Link to={`/bo/rma/analytics?brand=${brand.id}`} className="text-[13px] font-medium text-ashir-600 hover:text-ashir-700">
                        {brand.name}
                      </Link>
                    </span>
                    <span className="flex shrink-0 items-center gap-3 text-[13px] tabular-nums">
                      <span className="text-ink-500">{cases} casos</span>
                      <Badge tone={rate > 1.5 ? 'bad' : rate > 1 ? 'warn' : 'ok'} size="sm">
                        {rate.toFixed(2).replace('.', ',')}%
                      </Badge>
                    </span>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>
      )}

      <Callout tone="neutral" className="mt-6">
        <span className="flex items-center gap-2">
          <BarChart3 className="size-4 shrink-0" aria-hidden />
          Los reportes de venta usan series de demostración. El catálogo, las marcas, las categorías y los precios de
          lista provienen del archivo real de distribuidor de Ashir.
        </span>
      </Callout>

      {!can(session, 'audit:read') && (
        <Callout tone="warn" className={cn('mt-3')}>
          Algunos reportes detallados requieren permisos adicionales.
        </Callout>
      )}
    </div>
  );
}
