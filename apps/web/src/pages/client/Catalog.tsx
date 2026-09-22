/**
 * Catálogo B2B con filtros, ordenamiento y vista grilla o tabla compacta.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { LayoutGrid, ListFilter, Rows3, Search, ShoppingCart, SlidersHorizontal, X } from 'lucide-react';
import type { PriceEvaluation, Product, ProductQuery, ProductSort } from '@/types';
import { api } from '@/services';
import { useSession } from '@/app/session';
import { useAsync, useDebounced, usePersistentState } from '@/app/hooks';
import { useCart } from '@/app/cart';
import { useToast } from '@/components/ui/overlays';
import { BRANDS, CATEGORIES } from '@/mocks/fixtures/catalog';
import { ACTIVE_PROMOTIONS } from '@/mocks/fixtures/pricing';
import { cn, fmtMoney, fmtNumber } from '@/lib/utils';
import { Badge, Button, Card, Checkbox, Input, Segmented, Select } from '@/components/ui/primitives';
import {
  DataTable,
  EmptyState,
  ErrorState,
  FilterBar,
  PageHeader,
  ResultCount,
  type Column,
} from '@/components/ui/data';
import { Drawer } from '@/components/ui/overlays';
import { ProductCard, ProductCardSkeleton, ProductRow } from '@/components/domain/product-card';
import { PriceDisplay, StockIndicator } from '@/components/domain/common';

const SORT_OPTIONS: { value: ProductSort; label: string }[] = [
  { value: 'relevance', label: 'Relevancia' },
  { value: 'price_asc', label: 'Menor precio' },
  { value: 'price_desc', label: 'Mayor precio' },
  { value: 'best_sellers', label: 'Más vendidos' },
  { value: 'newest', label: 'Novedades' },
  { value: 'stock_desc', label: 'Mayor stock' },
];

export function Catalog() {
  const { session } = useSession();
  const [params, setParams] = useSearchParams();
  const [view, setView] = usePersistentState<'grid' | 'table'>('ashir-partner-hub:catalog-view', 'grid');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [term, setTerm] = useState(params.get('q') ?? '');
  const debouncedTerm = useDebounced(term);

  const query = useMemo<ProductQuery>(
    () => ({
      query: debouncedTerm || undefined,
      brandId: params.get('brandId') ?? undefined,
      categoryId: params.get('categoryId') ?? undefined,
      subcategory: params.get('subcategory') ?? undefined,
      inStock: params.get('inStock') === '1' || undefined,
      incomingSoon: params.get('incoming') === '1' || undefined,
      promotionId: params.get('promotionId') ?? undefined,
      purchasedBefore: params.get('purchased') === '1' || undefined,
      minPrice: params.get('minPrice') ? Number(params.get('minPrice')) : undefined,
      maxPrice: params.get('maxPrice') ? Number(params.get('maxPrice')) : undefined,
      sort: (params.get('sort') as ProductSort | null) ?? 'relevance',
      page: Number(params.get('page') ?? 1),
      pageSize: view === 'table' ? 40 : 24,
    }),
    [debouncedTerm, params, view],
  );

  const { data, initialLoading, error, refetch } = useAsync(
    () => api.catalog.listProducts(query, session),
    [JSON.stringify(query), session.role, session.customerId],
  );

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value === null || value === '') next.delete(key);
    else next.set(key, value);
    if (key !== 'page') next.delete('page');
    setParams(next, { replace: true });
  };

  const activeFilters = [
    params.get('brandId') && { key: 'brandId', label: BRANDS.find((b) => b.id === params.get('brandId'))?.name ?? '' },
    params.get('categoryId') && {
      key: 'categoryId',
      label: CATEGORIES.find((c) => c.id === params.get('categoryId'))?.name ?? '',
    },
    params.get('subcategory') && { key: 'subcategory', label: params.get('subcategory')! },
    params.get('inStock') === '1' && { key: 'inStock', label: 'Con stock' },
    params.get('incoming') === '1' && { key: 'incoming', label: 'Próximo ingreso' },
    params.get('purchased') === '1' && { key: 'purchased', label: 'Comprados antes' },
    params.get('promotionId') && {
      key: 'promotionId',
      label: ACTIVE_PROMOTIONS.find((p) => p.id === params.get('promotionId'))?.name ?? 'Promoción',
    },
    params.get('minPrice') && { key: 'minPrice', label: `Desde USD ${params.get('minPrice')}` },
    params.get('maxPrice') && { key: 'maxPrice', label: `Hasta USD ${params.get('maxPrice')}` },
  ].filter(Boolean) as { key: string; label: string }[];

  const filtersPanel = (
    <CatalogFilters params={params} setParam={setParam} onClose={() => setFiltersOpen(false)} />
  );

  return (
    <div>
      <PageHeader
        title="Catálogo mayorista"
        subtitle="Precios de distribuidor en USD sin IVA. Los importes ya incluyen tu lista y las condiciones comerciales vigentes."
        actions={
          <Segmented
            value={view}
            onChange={setView}
            options={[
              { value: 'grid', label: <LayoutGrid className="size-4" />, title: 'Vista grilla' },
              { value: 'table', label: <Rows3 className="size-4" />, title: 'Vista tabla compacta' },
            ]}
          />
        }
      />

      <div className="flex gap-6">
        {/* --- filtros desktop --- */}
        <aside className="hidden w-60 shrink-0 lg:block">
          <div className="sticky top-36 rounded-xl border border-ink-200 bg-white p-4">{filtersPanel}</div>
        </aside>

        <div className="min-w-0 flex-1">
          <FilterBar>
            <Input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Buscar por nombre, SKU o part number…"
              leading={<Search className="size-4" />}
              trailing={
                term ? (
                  <button type="button" onClick={() => setTerm('')} aria-label="Limpiar búsqueda">
                    <X className="size-3.5" />
                  </button>
                ) : undefined
              }
              className="max-w-sm"
            />
            <Button
              variant="outline"
              icon={<SlidersHorizontal className="size-4" />}
              onClick={() => setFiltersOpen(true)}
              className="lg:hidden"
            >
              Filtros
              {activeFilters.length > 0 && (
                <Badge tone="brand" size="sm">
                  {activeFilters.length}
                </Badge>
              )}
            </Button>
            <Select
              value={params.get('sort') ?? 'relevance'}
              onChange={(e) => setParam('sort', e.target.value)}
              className="ml-auto w-auto min-w-[170px]"
              aria-label="Ordenar por"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </FilterBar>

          {activeFilters.length > 0 && (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {activeFilters.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setParam(f.key, null)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-ashir-50 px-2.5 py-1 text-xs font-medium text-ashir-700 ring-1 ring-ashir-100 ring-inset transition-colors hover:bg-ashir-100"
                >
                  {f.label}
                  <X className="size-3" aria-hidden />
                </button>
              ))}
              <button
                type="button"
                onClick={() => setParams(new URLSearchParams(), { replace: true })}
                className="text-xs font-medium text-ink-500 underline underline-offset-2 hover:text-ink-800"
              >
                Limpiar todo
              </button>
            </div>
          )}

          <div className="mb-3 flex items-center justify-between gap-3">
            {data && <ResultCount shown={data.data.length} total={data.meta.total} noun="productos" />}
            {data && data.meta.totalPages > 1 && (
              <p className="text-[13px] text-ink-500">
                Página {data.meta.page} de {data.meta.totalPages}
              </p>
            )}
          </div>

          {error ? (
            <Card>
              <ErrorState
                description={error.message}
                onRetry={refetch}
                requestId={'requestId' in error ? String(error.requestId) : undefined}
              />
            </Card>
          ) : initialLoading ? (
            view === 'grid' ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <ProductCardSkeleton key={i} />
                ))}
              </div>
            ) : (
              <DataTable columns={[]} rows={[]} rowKey={() => ''} loading loadingRows={10} />
            )
          ) : data && data.data.length === 0 ? (
            <Card>
              <EmptyState
                title="No encontramos productos con estos filtros"
                description="Probá quitando algún filtro, buscando por SKU parcial o revisando la lista de marcas."
                icon={<ListFilter className="size-5" />}
                action={
                  <Button variant="outline" onClick={() => setParams(new URLSearchParams(), { replace: true })}>
                    Limpiar filtros
                  </Button>
                }
              />
            </Card>
          ) : view === 'grid' ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
              {data!.data.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <CatalogTable products={data!.data} />
          )}

          {/* --- paginación --- */}
          {data && data.meta.totalPages > 1 && (
            <nav className="mt-6 flex items-center justify-center gap-1.5" aria-label="Paginación">
              <Button
                variant="outline"
                size="sm"
                disabled={data.meta.page <= 1}
                onClick={() => setParam('page', String(data.meta.page - 1))}
              >
                Anterior
              </Button>
              {Array.from({ length: Math.min(7, data.meta.totalPages) }).map((_, i) => {
                const start = Math.max(1, Math.min(data.meta.page - 3, data.meta.totalPages - 6));
                const page = start + i;
                if (page > data.meta.totalPages) return null;
                return (
                  <button
                    key={page}
                    type="button"
                    onClick={() => setParam('page', String(page))}
                    aria-current={page === data.meta.page ? 'page' : undefined}
                    className={cn(
                      'size-8 rounded-lg text-[13px] font-medium tabular-nums transition-colors',
                      page === data.meta.page ? 'bg-ink-900 text-white' : 'text-ink-600 hover:bg-ink-100',
                    )}
                  >
                    {page}
                  </button>
                );
              })}
              <Button
                variant="outline"
                size="sm"
                disabled={data.meta.page >= data.meta.totalPages}
                onClick={() => setParam('page', String(data.meta.page + 1))}
              >
                Siguiente
              </Button>
            </nav>
          )}
        </div>
      </div>

      <Drawer open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filtros" width="md">
        {filtersPanel}
      </Drawer>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* filtros                                                             */
/* ------------------------------------------------------------------ */

function CatalogFilters({
  params,
  setParam,
  onClose,
}: {
  params: URLSearchParams;
  setParam: (key: string, value: string | null) => void;
  onClose: () => void;
}) {
  const selectedCategory = CATEGORIES.find((c) => c.id === params.get('categoryId'));

  return (
    <div className="space-y-5">
      <FilterSection title="Disponibilidad">
        <div className="space-y-2">
          <Checkbox
            label="Solo con stock"
            checked={params.get('inStock') === '1'}
            onChange={(e) => setParam('inStock', e.target.checked ? '1' : null)}
          />
          <Checkbox
            label="Con próximo ingreso"
            description="Sin stock hoy, con fecha de reposición"
            checked={params.get('incoming') === '1'}
            onChange={(e) => setParam('incoming', e.target.checked ? '1' : null)}
          />
          <Checkbox
            label="Comprados anteriormente"
            checked={params.get('purchased') === '1'}
            onChange={(e) => setParam('purchased', e.target.checked ? '1' : null)}
          />
        </div>
      </FilterSection>

      <FilterSection title="Marca">
        <ul className="max-h-56 space-y-0.5 overflow-y-auto pr-1">
          {BRANDS.map((brand) => (
            <li key={brand.id}>
              <button
                type="button"
                onClick={() => {
                  setParam('brandId', params.get('brandId') === brand.id ? null : brand.id);
                  onClose();
                }}
                className={cn(
                  'flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] transition-colors',
                  params.get('brandId') === brand.id ? 'bg-ashir-50 font-semibold text-ashir-700' : 'text-ink-700 hover:bg-ink-100',
                )}
              >
                <span className="truncate">{brand.name}</span>
                <span className="shrink-0 text-[11px] tabular-nums text-ink-400">{brand.skuCount}</span>
              </button>
            </li>
          ))}
        </ul>
      </FilterSection>

      <FilterSection title="Categoría">
        <ul className="space-y-0.5">
          {CATEGORIES.map((category) => (
            <li key={category.id}>
              <button
                type="button"
                onClick={() => {
                  setParam('categoryId', params.get('categoryId') === category.id ? null : category.id);
                  setParam('subcategory', null);
                  onClose();
                }}
                className={cn(
                  'flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] transition-colors',
                  params.get('categoryId') === category.id
                    ? 'bg-ashir-50 font-semibold text-ashir-700'
                    : 'text-ink-700 hover:bg-ink-100',
                )}
              >
                <span className="truncate">{category.name}</span>
                <span className="shrink-0 text-[11px] tabular-nums text-ink-400">{category.skuCount}</span>
              </button>
            </li>
          ))}
        </ul>
      </FilterSection>

      {selectedCategory && selectedCategory.subcategories.length > 0 && (
        <FilterSection title="Subcategoría">
          <div className="flex flex-wrap gap-1.5">
            {selectedCategory.subcategories.map((sub) => (
              <button
                key={sub}
                type="button"
                onClick={() => setParam('subcategory', params.get('subcategory') === sub ? null : sub)}
                className={cn(
                  'rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition-colors',
                  params.get('subcategory') === sub
                    ? 'bg-ashir-50 text-ashir-700 ring-ashir-200'
                    : 'text-ink-600 ring-ink-200 hover:bg-ink-50',
                )}
              >
                {sub}
              </button>
            ))}
          </div>
        </FilterSection>
      )}

      <FilterSection title="Precio (USD)">
        <div className="flex items-center gap-2">
          <Input
            type="number"
            placeholder="Desde"
            min={0}
            defaultValue={params.get('minPrice') ?? ''}
            onBlur={(e) => setParam('minPrice', e.target.value || null)}
            className="h-8 text-[13px]"
            aria-label="Precio mínimo"
          />
          <span className="text-ink-400">—</span>
          <Input
            type="number"
            placeholder="Hasta"
            min={0}
            defaultValue={params.get('maxPrice') ?? ''}
            onBlur={(e) => setParam('maxPrice', e.target.value || null)}
            className="h-8 text-[13px]"
            aria-label="Precio máximo"
          />
        </div>
      </FilterSection>

      <FilterSection title="Promoción">
        <ul className="space-y-0.5">
          {ACTIVE_PROMOTIONS.map((promo) => (
            <li key={promo.id}>
              <button
                type="button"
                onClick={() => {
                  setParam('promotionId', params.get('promotionId') === promo.id ? null : promo.id);
                  onClose();
                }}
                className={cn(
                  'w-full truncate rounded-lg px-2 py-1.5 text-left text-[13px] transition-colors',
                  params.get('promotionId') === promo.id
                    ? 'bg-ashir-50 font-semibold text-ashir-700'
                    : 'text-ink-700 hover:bg-ink-100',
                )}
              >
                {promo.name}
              </button>
            </li>
          ))}
        </ul>
      </FilterSection>
    </div>
  );
}

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-[11px] font-semibold tracking-wide text-ink-500 uppercase">{title}</h3>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* vista tabla                                                         */
/* ------------------------------------------------------------------ */

function CatalogTable({ products }: { products: Product[] }) {
  const { session } = useSession();
  const cart = useCart();
  const toast = useToast();
  const [evaluations, setEvaluations] = useState<Record<string, PriceEvaluation>>({});

  useEffect(() => {
    if (session.role !== 'CLIENT') return;
    let cancelled = false;
    api.pricing
      .evaluateMany(
        products.filter((p) => p.listPrice).map((p) => ({ productId: p.id, quantity: 1 })),
        session,
      )
      .then((results) => {
        if (cancelled) return;
        setEvaluations(Object.fromEntries(results.map((r) => [r.productId, r])));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [products, session]);

  const columns: Column<Product>[] = [
    {
      key: 'product',
      header: 'Producto',
      cell: (product) => <ProductRow product={product} />,
    },
    {
      key: 'category',
      header: 'Categoría',
      hideOnMobile: true,
      cell: (product) => <span className="text-ink-600">{product.category}</span>,
      sortable: true,
      sortValue: (p) => p.category,
    },
    {
      key: 'stock',
      header: 'Disponibilidad',
      cell: (product) => <StockIndicator product={product} compact />,
      sortable: true,
      sortValue: (p) => p.stock,
    },
    {
      key: 'list',
      header: 'Precio lista',
      align: 'right',
      hideOnMobile: true,
      cell: (product) => <span className="text-ink-500">{fmtMoney(product.listPrice)}</span>,
      sortable: true,
      sortValue: (p) => (p.listPrice ? Number.parseFloat(p.listPrice.amount) : 0),
    },
    {
      key: 'price',
      header: 'Tu precio',
      align: 'right',
      cell: (product) => {
        const evaluation = evaluations[product.id];
        if (!product.listPrice) return <span className="text-ink-500">A consultar</span>;
        if (session.role !== 'CLIENT') return <span className="font-semibold">{fmtMoney(product.listPrice)}</span>;
        if (!evaluation) return <span className="text-ink-400">…</span>;
        return (
          <PriceDisplay
            listPrice={product.listPrice}
            finalPrice={evaluation.finalUnitPrice}
            discountPct={evaluation.totalDiscountPct}
            size="sm"
            showList={false}
            className="justify-end"
          />
        );
      },
    },
    {
      key: 'discount',
      header: 'Desc.',
      align: 'right',
      hideOnMobile: true,
      cell: (product) => {
        const evaluation = evaluations[product.id];
        if (!evaluation) return <span className="text-ink-400">—</span>;
        const pct = Number.parseFloat(evaluation.totalDiscountPct);
        return pct < -0.01 ? (
          <Badge tone="ok" size="sm">
            {pct.toFixed(1).replace('.', ',')}%
          </Badge>
        ) : (
          <span className="text-ink-400">—</span>
        );
      },
    },
    {
      key: 'action',
      header: '',
      align: 'right',
      width: '90px',
      cell: (product) =>
        product.listPrice && session.role === 'CLIENT' ? (
          <Button
            size="sm"
            variant="outline"
            icon={<ShoppingCart className="size-3.5" />}
            onClick={(e) => {
              e.stopPropagation();
              const result = cart.add(product.id, 1);
              if (result.ok) toast.success('Agregado al pedido', result.message);
              else toast.warning('No se pudo agregar', result.message);
            }}
          >
            Agregar
          </Button>
        ) : (
          <Link to={`/catalogo/${product.sku}`} className="text-[13px] font-medium text-ashir-600 hover:text-ashir-700">
            Ver
          </Link>
        ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={products}
      rowKey={(p) => p.id}
      dense
      mobileCard={(product) => (
        <div>
          <ProductRow product={product} />
          <div className="mt-2 flex items-center justify-between gap-2">
            <StockIndicator product={product} compact />
            <span className="text-[13px] font-semibold tabular-nums">
              {evaluations[product.id] ? fmtMoney(evaluations[product.id]!.finalUnitPrice) : fmtMoney(product.listPrice)}
            </span>
          </div>
        </div>
      )}
      footer={
        <tr>
          <td colSpan={columns.length} className="px-4 py-2.5 text-[13px] text-ink-500">
            {fmtNumber(products.length)} productos en esta página · precios en USD sin IVA
          </td>
        </tr>
      }
    />
  );
}
