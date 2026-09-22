/**
 * Objetivos comerciales del Product Manager por marca y por período.
 */
import { Link } from 'react-router-dom';
import { Target, TrendingUp, Users } from 'lucide-react';
import { api } from '@/services';
import { useSession } from '@/app/session';
import { useAsync } from '@/app/hooks';
import { PRODUCT_MANAGERS, pmById } from '@/mocks/fixtures/people';
import { brandDashboard } from '@/services/mock/analytics';
import { cn, fmtMoney, fmtNumber, num } from '@/lib/utils';
import { Badge, Card, CardHeader, ProgressBar, Skeleton } from '@/components/ui/primitives';
import { Callout, DataTable, PageHeader, SectionTitle, StatGrid, StatTile, type Column } from '@/components/ui/data';
import { Bars, ChartFrame } from '@/components/ui/charts';
import { brandColor } from '@/components/domain/common';

interface ObjectiveRow {
  brandId: string;
  brand: string;
  sales: number;
  target: number;
  progressPct: number;
  marginPct: number;
  activeCustomers: number;
  rmaRatePct: string;
}

export function PmObjectives() {
  const { session } = useSession();
  const brands = useAsync(() => api.pm.listBrandsForPm(session), [session.role, session.userId]);
  const pm = pmById(session.userId) ?? PRODUCT_MANAGERS[0]!;

  if (brands.initialLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-64 w-full rounded-card" />
      </div>
    );
  }

  const rows: ObjectiveRow[] = (brands.data ?? []).map((brand) => {
    const d = brandDashboard(brand.id);
    return {
      brandId: brand.id,
      brand: brand.name,
      sales: num(d.salesMonth),
      target: num(d.monthlyTarget),
      progressPct: d.targetProgressPct,
      marginPct: Number.parseFloat(d.grossMarginPct),
      activeCustomers: d.activeCustomers,
      rmaRatePct: d.rmaRatePct,
    };
  });

  const totalSales = rows.reduce((a, r) => a + r.sales, 0);
  const totalTarget = rows.reduce((a, r) => a + r.target, 0);
  const overallPct = totalTarget > 0 ? (totalSales / totalTarget) * 100 : 0;

  const columns: Column<ObjectiveRow>[] = [
    {
      key: 'brand',
      header: 'Marca',
      cell: (row) => (
        <div className="flex items-center gap-2.5">
          <span className="size-2.5 shrink-0 rounded-sm" style={{ background: brandColor(row.brand) }} aria-hidden />
          <Link to={`/bo/pm?brand=${row.brandId}`} className="text-[13px] font-semibold text-ashir-600 hover:text-ashir-700">
            {row.brand}
          </Link>
        </div>
      ),
    },
    {
      key: 'sales',
      header: 'Ventas del mes',
      align: 'right',
      cell: (row) => (
        <span className="font-semibold tabular-nums">
          {fmtMoney({ amount: row.sales.toFixed(2), currency: 'USD' }, { compact: true })}
        </span>
      ),
      sortable: true,
      sortValue: (r) => r.sales,
    },
    {
      key: 'target',
      header: 'Objetivo',
      align: 'right',
      cell: (row) => (
        <span className="tabular-nums text-ink-600">
          {fmtMoney({ amount: row.target.toFixed(2), currency: 'USD' }, { compact: true })}
        </span>
      ),
    },
    {
      key: 'progress',
      header: 'Cumplimiento',
      cell: (row) => (
        <div className="min-w-[120px]">
          <ProgressBar
            value={Math.min(100, row.progressPct)}
            tone={row.progressPct >= 100 ? 'ok' : row.progressPct >= 70 ? 'brand' : 'warn'}
          />
          <p className={cn('mt-1 text-[11px] font-semibold tabular-nums', row.progressPct >= 100 ? 'text-ok-600' : 'text-ink-600')}>
            {row.progressPct}%
          </p>
        </div>
      ),
      sortable: true,
      sortValue: (r) => r.progressPct,
    },
    {
      key: 'margin',
      header: 'Margen',
      align: 'right',
      cell: (row) => (
        <span className={cn('tabular-nums', row.marginPct < 15 ? 'text-warn-700' : 'text-ok-700')}>
          {row.marginPct.toFixed(1).replace('.', ',')}%
        </span>
      ),
    },
    {
      key: 'customers',
      header: 'Clientes activos',
      align: 'right',
      hideOnMobile: true,
      cell: (row) => <span className="tabular-nums text-ink-600">{row.activeCustomers}</span>,
    },
    {
      key: 'rma',
      header: 'Tasa RMA',
      align: 'right',
      hideOnMobile: true,
      cell: (row) => (
        <span className={cn('tabular-nums', Number.parseFloat(row.rmaRatePct) > 1.5 ? 'text-bad-600' : 'text-ink-600')}>
          {row.rmaRatePct}%
        </span>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'PM Cockpit', href: '/bo/pm' }, { label: 'Objetivos' }]}
        title="Objetivos comerciales"
        subtitle={`${pm.name} · ${rows.length} marca(s) a cargo · período ${new Date().toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}`}
      />

      <StatGrid cols={4} className="mb-6">
        <StatTile
          label="Ventas acumuladas"
          value={fmtMoney({ amount: totalSales.toFixed(2), currency: 'USD' }, { compact: true })}
          icon={<TrendingUp className="size-4" />}
          tone="ok"
        />
        <StatTile
          label="Objetivo total"
          value={fmtMoney({ amount: totalTarget.toFixed(2), currency: 'USD' }, { compact: true })}
          icon={<Target className="size-4" />}
        />
        <StatTile
          label="Cumplimiento global"
          value={`${overallPct.toFixed(0)}%`}
          tone={overallPct >= 100 ? 'ok' : overallPct >= 70 ? 'warn' : 'bad'}
          footer={
            <ProgressBar value={Math.min(100, overallPct)} tone={overallPct >= 100 ? 'ok' : overallPct >= 70 ? 'brand' : 'warn'} />
          }
        />
        <StatTile
          label="Marcas por encima del objetivo"
          value={`${rows.filter((r) => r.progressPct >= 100).length} de ${rows.length}`}
          icon={<Users className="size-4" />}
        />
      </StatGrid>

      {overallPct < 70 && (
        <Callout tone="warn" className="mb-5" title="El período va por debajo del objetivo">
          Faltan {fmtMoney({ amount: (totalTarget - totalSales).toFixed(2), currency: 'USD' })} para alcanzar la meta.
          Revisá los productos sin movimiento y las oportunidades de promoción en cada marca.
        </Callout>
      )}

      <ChartFrame title="Cumplimiento por marca" subtitle="Ventas del mes contra objetivo asignado" height={260} className="mb-6">
        <Bars
          data={rows.map((r) => ({ label: r.brand, pct: r.progressPct }))}
          xKey="label"
          yKey="pct"
          colorByIndex={(row) =>
            (row as { pct: number }).pct >= 100 ? '#12b76a' : (row as { pct: number }).pct >= 70 ? '#fb5a11' : '#f79009'
          }
          formatter={(v) => `${v.toFixed(0)}% del objetivo`}
        />
      </ChartFrame>

      <SectionTitle title="Detalle por marca" />
      <DataTable columns={columns} rows={rows} rowKey={(r) => r.brandId} />

      <Card className="mt-6">
        <CardHeader title="Cómo se definen los objetivos" />
        <div className="px-5 py-4 text-[13px] leading-relaxed text-ink-600">
          <p>
            En el prototipo el objetivo mensual de cada PM se reparte proporcionalmente entre las marcas que tiene a
            cargo. En producción los definiría la dirección comercial, probablemente con estacionalidad, objetivos por
            categoría y componentes de margen además de facturación.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {PRODUCT_MANAGERS.map((manager) => (
              <Badge key={manager.id} tone={manager.id === pm.id ? 'brand' : 'neutral'} size="sm">
                {manager.name} · {fmtMoney(manager.monthlyTarget, { compact: true })} · {fmtNumber(manager.brands.length)} marca(s)
              </Badge>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}
