/**
 * Marcas del catálogo, con su peso real en SKUs y categorías.
 */
import { Link } from 'react-router-dom';
import { ArrowRight, Package } from 'lucide-react';
import { BRANDS, CATEGORIES, PRODUCTS } from '@/mocks/fixtures/catalog';
import { customerById } from '@/mocks/fixtures/customers';
import { useSession } from '@/app/session';
import { fmtNumber, num } from '@/lib/utils';
import { Badge, Card } from '@/components/ui/primitives';
import { PageHeader, SectionTitle } from '@/components/ui/data';
import { brandColor } from '@/components/domain/common';

export function BrandsPage() {
  const { session } = useSession();
  const customer = customerById(session.customerId ?? '');

  return (
    <div>
      <PageHeader
        title="Marcas"
        subtitle={`${BRANDS.length} marcas representadas por Ashir, con ${fmtNumber(PRODUCTS.length)} SKUs en la lista vigente.`}
      />

      {customer && customer.topBrands.length > 0 && (
        <section className="mb-8">
          <SectionTitle title="Tus marcas" subtitle="Las que más compraste en los últimos 12 meses" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {customer.topBrands.map((name, i) => {
              const brand = BRANDS.find((b) => b.name === name);
              if (!brand) return null;
              return <BrandCard key={brand.id} brand={brand} rank={i + 1} />;
            })}
          </div>
        </section>
      )}

      <section>
        <SectionTitle title="Todas las marcas" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {BRANDS.map((brand) => (
            <BrandCard key={brand.id} brand={brand} />
          ))}
        </div>
      </section>

      <section className="mt-8">
        <SectionTitle title="Categorías" subtitle="Podés navegar el catálogo por rubro" />
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {CATEGORIES.map((category) => (
            <Link
              key={category.id}
              to={`/catalogo?categoryId=${category.id}`}
              className="flex items-center justify-between gap-3 rounded-lg border border-ink-200 bg-white px-4 py-3 transition-colors hover:border-ashir-300 hover:bg-ashir-50/40"
            >
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold text-ink-900">{category.name}</p>
                <p className="text-xs text-ink-500">{category.group}</p>
              </div>
              <span className="shrink-0 text-[13px] font-semibold tabular-nums text-ink-400">{category.skuCount}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function BrandCard({ brand, rank }: { brand: (typeof BRANDS)[number]; rank?: number }) {
  const products = PRODUCTS.filter((p) => p.brandId === brand.id);
  const inStock = products.filter((p) => p.stock > 0).length;
  const priced = products.filter((p) => p.listPrice);
  const minPrice = priced.length ? Math.min(...priced.map((p) => num(p.listPrice))) : 0;

  return (
    <Link to={`/catalogo?brandId=${brand.id}`}>
      <Card interactive className="h-full overflow-hidden">
        <div className="h-1.5" style={{ background: brandColor(brand.name) }} aria-hidden />
        <div className="p-4">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-base font-bold tracking-tight text-ink-900">{brand.name}</h3>
            {rank && (
              <Badge tone="brand" size="sm">
                #{rank} en tu cuenta
              </Badge>
            )}
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-[13px] text-ink-500">
            <Package className="size-3.5" aria-hidden />
            {brand.skuCount} SKUs · {inStock} con stock
          </p>
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink-400">{brand.categories.join(' · ')}</p>
          <div className="mt-3 flex items-center justify-between gap-2 border-t border-ink-100 pt-3">
            <span className="text-xs text-ink-500">
              Desde{' '}
              <span className="font-semibold tabular-nums text-ink-800">
                USD {minPrice.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </span>
            <ArrowRight className="size-4 text-ink-300" aria-hidden />
          </div>
        </div>
      </Card>
    </Link>
  );
}
