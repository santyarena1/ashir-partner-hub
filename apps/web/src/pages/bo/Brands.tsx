/**
 * Marcas con su PM responsable, peso en el catálogo y stock valorizado.
 */
import { Link } from 'react-router-dom';
import { ArrowRight, Boxes, Tag, Users } from 'lucide-react';
import { BRANDS, PRODUCTS } from '@/mocks/fixtures/catalog';
import { PRODUCT_MANAGERS, personName } from '@/mocks/fixtures/people';
import { RMA_CASES } from '@/mocks/fixtures/rma';
import { useSession } from '@/app/session';
import { can, ownsBrand } from '@/lib/rbac';
import { cn, fmtMoney, fmtNumber, num } from '@/lib/utils';
import { Badge, Card, CardHeader } from '@/components/ui/primitives';
import { DataTable, PageHeader, SectionTitle, StatGrid, StatTile, type Column } from '@/components/ui/data';
import { brandColor } from '@/components/domain/common';

interface BrandRow {
  id: string;
  name: string;
  pmId: string;
  skuCount: number;
  inStock: number;
  stockValue: number;
  unitsSold: number;
  rmaCount: number;
  rmaRate: number;
  categories: string[];
  avgMargin: number | null;
}

export function BoBrands() {
  const { session, role } = useSession();
  const showMargin = can(session, 'margin:read');

  const rows: BrandRow[] = BRANDS.map((brand) => {
    const products = PRODUCTS.filter((p) => p.brandId === brand.id);
    const priced = products.filter((p) => p.listPrice);
    const unitsSold = products.reduce((a, p) => a + p.unitsSold12m, 0);
    const rmaCount = RMA_CASES.filter((r) => r.units.some((u) => u.brand === brand.name)).length;
    const margins = priced.map((p) => p.marginPct).filter((m): m is number => m !== null);

    return {
      id: brand.id,
      name: brand.name,
      pmId: brand.pmId,
      skuCount: brand.skuCount,
      inStock: products.filter((p) => p.stock > 0).length,
      stockValue: priced.reduce((a, p) => a + num(p.listPrice) * p.stock, 0),
      unitsSold,
      rmaCount,
      rmaRate: unitsSold > 0 ? (rmaCount / unitsSold) * 100 : 0,
      categories: brand.categories,
      avgMargin: margins.length > 0 ? margins.reduce((a, b) => a + b, 0) / margins.length : null,
    };
  }).sort((a, b) => b.stockValue - a.stockValue);

  const visible = role === 'PM' ? rows.filter((r) => ownsBrand(session, r.id)) : rows;

  const columns: Column<BrandRow>[] = [
    {
      key: 'brand',
      header: 'Marca',
      cell: (row) => (
        <div className="flex items-center gap-2.5">
          <span className="size-2.5 shrink-0 rounded-sm" style={{ background: brandColor(row.name) }} aria-hidden />
          <div className="min-w-0">
            <Link to={`/bo/productos?brandId=${row.id}`} className="text-[13px] font-semibold text-ashir-600 hover:text-ashir-700">
              {row.name}
            </Link>
            <p className="truncate text-[11px] text-ink-400">{row.categories.join(' · ')}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'pm',
      header: 'Product Manager',
      hideOnMobile: true,
      cell: (row) => <span className="text-xs text-ink-600">{personName(row.pmId)}</span>,
    },
    {
      key: 'skus',
      header: 'SKUs',
      align: 'right',
      cell: (row) => (
        <span className="tabular-nums">
          {row.skuCount}
          <span className="ml-1 text-[11px] text-ink-400">({row.inStock} c/stock)</span>
        </span>
      ),
      sortable: true,
      sortValue: (r) => r.skuCount,
    },
    {
      key: 'stock',
      header: 'Stock valorizado',
      align: 'right',
      cell: (row) => (
        <span className="font-semibold tabular-nums">
          {fmtMoney({ amount: row.stockValue.toFixed(2), currency: 'USD' }, { compact: true })}
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
      cell: (row) => <span className="tabular-nums text-ink-600">{fmtNumber(row.unitsSold)}</span>,
      sortable: true,
      sortValue: (r) => r.unitsSold,
    },
    ...(showMargin
      ? [
          {
            key: 'margin',
            header: 'Margen prom.',
            align: 'right' as const,
            cell: (row: BrandRow) =>
              row.avgMargin !== null ? (
                <span className="font-medium tabular-nums text-ink-800">{row.avgMargin.toFixed(1).replace('.', ',')}%</span>
              ) : (
                <span className="text-ink-400">—</span>
              ),
            sortable: true,
            sortValue: (r: BrandRow) => r.avgMargin ?? 0,
          },
        ]
      : []),
    {
      key: 'rma',
      header: 'Tasa RMA',
      align: 'right',
      cell: (row) => (
        <span className={cn('tabular-nums', row.rmaRate > 1.5 ? 'font-semibold text-bad-600' : 'text-ink-600')}>
          {row.rmaRate.toFixed(2).replace('.', ',')}%
          <span className="ml-1 text-[11px] text-ink-400">({row.rmaCount})</span>
        </span>
      ),
      sortable: true,
      sortValue: (r) => r.rmaRate,
    },
    {
      key: 'link',
      header: '',
      align: 'right',
      width: '90px',
      cell: (row) => (
        <Link to={`/bo/pm?brand=${row.id}`} className="inline-flex items-center gap-1 text-[13px] font-medium text-ashir-600 hover:text-ashir-700">
          Cockpit
          <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Marcas"
        subtitle={
          role === 'PM'
            ? 'Las marcas que tenés a cargo, con su peso en el catálogo y su calidad.'
            : 'Marcas representadas por Ashir, con su Product Manager responsable.'
        }
      />

      <StatGrid cols={4} className="mb-6">
        <StatTile label="Marcas" value={visible.length} icon={<Tag className="size-4" />} />
        <StatTile
          label="SKUs bajo gestión"
          value={fmtNumber(visible.reduce((a, r) => a + r.skuCount, 0))}
          icon={<Boxes className="size-4" />}
        />
        <StatTile
          label="Stock valorizado"
          value={fmtMoney(
            { amount: visible.reduce((a, r) => a + r.stockValue, 0).toFixed(2), currency: 'USD' },
            { compact: true },
          )}
          tone="ok"
        />
        <StatTile label="Product Managers" value={PRODUCT_MANAGERS.length} icon={<Users className="size-4" />} />
      </StatGrid>

      <DataTable columns={columns} rows={visible} rowKey={(r) => r.id} dense />

      {role !== 'PM' && (
        <section className="mt-8">
          <SectionTitle title="Product Managers" subtitle="Responsables y objetivo mensual asignado" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {PRODUCT_MANAGERS.map((pm) => (
              <Card key={pm.id} className="p-4">
                <div className="flex items-center gap-2.5">
                  <span className="flex size-9 items-center justify-center rounded-full bg-ashir-50 text-xs font-bold text-ashir-700">
                    {pm.initials}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-ink-900">{pm.name}</p>
                    <p className="truncate text-[11px] text-ink-400">{pm.email}</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {pm.brands.map((brand) => (
                    <Badge key={brand} tone="neutral" size="sm">
                      {brand}
                    </Badge>
                  ))}
                </div>
                <p className="mt-3 border-t border-ink-100 pt-2.5 text-xs text-ink-500">
                  Objetivo mensual:{' '}
                  <span className="font-semibold text-ink-800">{fmtMoney(pm.monthlyTarget, { compact: true })}</span>
                </p>
              </Card>
            ))}
          </div>
        </section>
      )}

      <Card className="mt-6">
        <CardHeader title="Cómo se calculan estas métricas" />
        <ul className="space-y-1.5 px-5 py-4 text-[13px] text-ink-600">
          <li>
            <strong>SKUs y stock valorizado</strong> salen del catálogo real importado; la cantidad de stock es simulada.
          </li>
          <li>
            <strong>Vendidas 12 m</strong> es una serie de demostración por SKU, estable entre recargas.
          </li>
          <li>
            <strong>Tasa RMA</strong> es la cantidad de casos de garantía de la marca sobre las unidades vendidas del
            período.
          </li>
        </ul>
      </Card>
    </div>
  );
}
