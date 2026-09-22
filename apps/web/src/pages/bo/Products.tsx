/**
 * Productos en el backoffice.
 * Con permiso `cost:read` se muestran costo y margen; sin él, nunca.
 */
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Boxes, Package, Search } from 'lucide-react';
import type { Product } from '@/types';
import { api } from '@/services';
import { useSession } from '@/app/session';
import { useAsync, useDebounced } from '@/app/hooks';
import { BRANDS, CATALOG_META, CATEGORIES } from '@/mocks/fixtures/catalog';
import { personName } from '@/mocks/fixtures/people';
import { can } from '@/lib/rbac';
import { AVAILABILITY } from '@/lib/labels';
import { cn, fmtDate, fmtMoney, fmtNumber, num } from '@/lib/utils';
import { Badge, Card, Input, Select } from '@/components/ui/primitives';
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
import { ProductRow } from '@/components/domain/product-card';
import { StockIndicator } from '@/components/domain/common';

export function BoProducts() {
  const { session } = useSession();
  const [params, setParams] = useSearchParams();
  const [term, setTerm] = useState(params.get('q') ?? '');
  const debounced = useDebounced(term);
  const showCost = can(session, 'cost:read');

  const { data, initialLoading, error, refetch } = useAsync(
    () =>
      api.catalog.listProducts(
        {
          query: debounced || undefined,
          brandId: params.get('brandId') ?? undefined,
          categoryId: params.get('categoryId') ?? undefined,
          inStock: params.get('inStock') === '1' || undefined,
          pageSize: 50,
          page: Number(params.get('page') ?? 1),
          sort: 'best_sellers',
        },
        session,
      ),
    [debounced, params.toString(), session.role],
  );

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next, { replace: true });
  };

  const products = data?.data ?? [];

  const columns: Column<Product>[] = [
    { key: 'product', header: 'Producto', cell: (p) => <ProductRow product={p} /> },
    {
      key: 'brand',
      header: 'Marca',
      hideOnMobile: true,
      cell: (p) => <span className="text-ink-700">{p.brand}</span>,
      sortable: true,
      sortValue: (p) => p.brand,
    },
    {
      key: 'category',
      header: 'Categoría',
      hideOnMobile: true,
      cell: (p) => (
        <span className="text-xs text-ink-600">
          {p.category}
          {p.subcategory && <span className="block text-ink-400">{p.subcategory}</span>}
        </span>
      ),
      sortable: true,
      sortValue: (p) => p.category,
    },
    {
      key: 'stock',
      header: 'Stock',
      cell: (p) => <StockIndicator product={p} compact />,
      sortable: true,
      sortValue: (p) => p.stock,
    },
    {
      key: 'list',
      header: 'Precio lista',
      align: 'right',
      cell: (p) => <span className="font-medium tabular-nums">{fmtMoney(p.listPrice)}</span>,
      sortable: true,
      sortValue: (p) => num(p.listPrice),
    },
    ...(showCost
      ? [
          {
            key: 'cost',
            header: 'Costo',
            align: 'right' as const,
            hideOnMobile: true,
            cell: (p: Product) =>
              p.cost ? (
                <span className="tabular-nums text-ink-600">
                  {fmtMoney(p.cost)}
                  <span className="ml-1 text-[10px] text-ink-400">sim</span>
                </span>
              ) : (
                <span className="text-ink-400">—</span>
              ),
            sortable: true,
            sortValue: (p: Product) => num(p.cost),
          },
          {
            key: 'margin',
            header: 'Margen',
            align: 'right' as const,
            cell: (p: Product) =>
              p.marginPct !== null ? (
                <span
                  className={cn(
                    'font-semibold tabular-nums',
                    p.marginPct < 12 ? 'text-bad-600' : p.marginPct < 18 ? 'text-warn-700' : 'text-ok-700',
                  )}
                >
                  {p.marginPct}%
                </span>
              ) : (
                <span className="text-ink-400">—</span>
              ),
            sortable: true,
            sortValue: (p: Product) => p.marginPct ?? 0,
          },
        ]
      : []),
    {
      key: 'sold',
      header: 'Vendidas 12 m',
      align: 'right',
      hideOnMobile: true,
      cell: (p) => <span className="tabular-nums text-ink-600">{fmtNumber(p.unitsSold12m)}</span>,
      sortable: true,
      sortValue: (p) => p.unitsSold12m,
    },
    {
      key: 'pm',
      header: 'PM',
      hideOnMobile: true,
      cell: (p) => <span className="text-xs text-ink-500">{personName(p.pmId)}</span>,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Productos"
        subtitle={`${fmtNumber(CATALOG_META.productCount)} SKUs importados de «${CATALOG_META.source}» (hoja ${CATALOG_META.sheet}) el ${fmtDate(CATALOG_META.importedAt)}.`}
      />

      <Callout tone="tech" className="mb-5">
        SKU, descripción, marca, categoría, precio de lista, IVA y estado provienen del archivo real.{' '}
        <strong>Costo, margen y cantidad de stock son datos simulados</strong> generados de forma determinista para la
        demostración: el Excel de distribuidor no los contiene.
      </Callout>

      <StatGrid cols={5} className="mb-6">
        <StatTile label="SKUs totales" value={fmtNumber(CATALOG_META.productCount)} icon={<Package className="size-4" />} />
        <StatTile
          label="Con stock"
          value={fmtNumber(products.filter((p) => p.stock > 0).length)}
          tone="ok"
          footer={`de ${products.length} en esta página`}
        />
        <StatTile
          label="Sin precio publicado"
          value={fmtNumber(products.filter((p) => !p.listPrice).length)}
          tone="warn"
          footer="Figuran como «consultar» en el archivo"
        />
        <StatTile label="Marcas" value={CATALOG_META.brandCount} icon={<Boxes className="size-4" />} />
        <StatTile label="Categorías" value={CATALOG_META.categoryCount} />
      </StatGrid>

      <FilterBar>
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Buscar por nombre, SKU o part number…"
          leading={<Search className="size-4" />}
          className="max-w-xs"
        />
        <Select value={params.get('brandId') ?? ''} onChange={(e) => setParam('brandId', e.target.value || null)} className="w-auto min-w-[150px]" aria-label="Marca">
          <option value="">Todas las marcas</option>
          {BRANDS.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name} ({b.skuCount})
            </option>
          ))}
        </Select>
        <Select
          value={params.get('categoryId') ?? ''}
          onChange={(e) => setParam('categoryId', e.target.value || null)}
          className="w-auto min-w-[160px]"
          aria-label="Categoría"
        >
          <option value="">Todas las categorías</option>
          {CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.skuCount})
            </option>
          ))}
        </Select>
        <Select
          value={params.get('inStock') ?? ''}
          onChange={(e) => setParam('inStock', e.target.value || null)}
          className="w-auto"
          aria-label="Disponibilidad"
        >
          <option value="">Toda disponibilidad</option>
          <option value="1">Solo con stock</option>
        </Select>
        {data && (
          <span className="ml-auto">
            <ResultCount shown={products.length} total={data.meta.total} noun="productos" />
          </span>
        )}
      </FilterBar>

      {error ? (
        <Card>
          <ErrorState description={error.message} onRetry={refetch} />
        </Card>
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={products}
            rowKey={(p) => p.id}
            loading={initialLoading}
            dense
            empty={<EmptyState title="No hay productos con estos filtros" icon={<Package className="size-5" />} />}
            mobileCard={(p) => (
              <div>
                <ProductRow product={p} />
                <div className="mt-2 flex items-center justify-between gap-2">
                  <StockIndicator product={p} compact />
                  <span className="text-[13px] font-semibold tabular-nums">{fmtMoney(p.listPrice)}</span>
                </div>
              </div>
            )}
          />

          {data && data.meta.totalPages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-2">
              <Badge tone="neutral">
                Página {data.meta.page} de {data.meta.totalPages}
              </Badge>
              <button
                type="button"
                disabled={data.meta.page <= 1}
                onClick={() => setParam('page', String(data.meta.page - 1))}
                className="rounded-lg px-3 py-1.5 text-[13px] font-medium text-ink-600 transition-colors hover:bg-ink-100 disabled:opacity-40"
              >
                Anterior
              </button>
              <button
                type="button"
                disabled={data.meta.page >= data.meta.totalPages}
                onClick={() => setParam('page', String(data.meta.page + 1))}
                className="rounded-lg px-3 py-1.5 text-[13px] font-medium text-ink-600 transition-colors hover:bg-ink-100 disabled:opacity-40"
              >
                Siguiente
              </button>
            </div>
          )}
        </>
      )}

      {/* --- leyenda de estados del archivo --- */}
      <Card className="mt-6 p-4">
        <p className="mb-2 text-[11px] font-semibold tracking-wide text-ink-500 uppercase">
          Estados del archivo de distribuidor
        </p>
        <div className="flex flex-wrap gap-3">
          {(Object.keys(AVAILABILITY) as (keyof typeof AVAILABILITY)[]).map((key) => (
            <span key={key} className="flex items-center gap-1.5 text-xs text-ink-600">
              <Badge tone={AVAILABILITY[key].tone} size="sm" dot>
                {AVAILABILITY[key].label}
              </Badge>
              {key === 'IN_STOCK' && <Mono>EN STOCK</Mono>}
              {key === 'NEW_ARRIVAL' && <Mono>NUEVO INGRESO</Mono>}
              {key === 'INCOMING' && <Mono>PRÓXIMAMENTE</Mono>}
              {key === 'OUT_OF_STOCK' && <Mono>AGOTADO</Mono>}
            </span>
          ))}
        </div>
      </Card>
    </div>
  );
}
