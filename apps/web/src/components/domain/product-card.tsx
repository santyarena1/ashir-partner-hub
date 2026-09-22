/**
 * Tarjeta de producto del catálogo B2B.
 *
 * Estilo de mayorista: la imagen manda, el SKU va arriba en gris, el nombre
 * en negrita y el precio destacado. Muestra precio de lista, precio
 * personalizado, descuento, promoción y stock real. Nunca costo ni margen.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Minus, Plus, ShoppingCart } from 'lucide-react';
import type { PriceEvaluation, Product } from '@/types';
import { api } from '@/services';
import { useSession } from '@/app/session';
import { useCart, useFavorites } from '@/app/cart';
import { useToast } from '@/components/ui/overlays';
import { cn, fmtMoney } from '@/lib/utils';
import { Badge, Button, Skeleton } from '@/components/ui/primitives';
import { PriceDisplay, ProductTile, StockIndicator } from '@/components/domain/common';

export function ProductCard({ product, className }: { product: Product; className?: string }) {
  const { session } = useSession();
  const cart = useCart();
  const toast = useToast();
  const { isFavorite, toggle } = useFavorites();
  const [evaluation, setEvaluation] = useState<PriceEvaluation | null>(null);
  const [qty, setQty] = useState(1);

  useEffect(() => {
    if (!product.listPrice || session.role !== 'CLIENT') return;
    let cancelled = false;
    api.pricing
      .evaluate(product.id, qty, session)
      .then((result) => !cancelled && setEvaluation(result))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [product.id, product.listPrice, qty, session]);

  const promotion = evaluation?.adjustments.find((a) => a.type === 'PROMOTION');
  const discount = evaluation ? Number.parseFloat(evaluation.totalDiscountPct) : 0;

  return (
    <article
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-xl border border-ink-150 border-ink-200 bg-white transition-all hover:border-ashir-200 hover:shadow-pop',
        className,
      )}
    >
      {/* ---------------- imagen ---------------- */}
      <div className="relative bg-white p-4 pb-2">
        <Link to={`/catalogo/${product.sku}`} className="block">
          <ProductTile product={product} className="border-0 bg-white transition-transform duration-300 group-hover:scale-[1.03]" />
        </Link>

        <button
          type="button"
          onClick={() => toggle(product.id)}
          aria-label={isFavorite(product.id) ? 'Quitar de favoritos' : 'Guardar en favoritos'}
          aria-pressed={isFavorite(product.id)}
          className="absolute top-3 right-3 rounded-full bg-white/90 p-2 text-ink-300 shadow-subtle backdrop-blur transition-colors hover:text-ashir-600"
        >
          <Heart className={cn('size-4', isFavorite(product.id) && 'fill-ashir-500 text-ashir-500')} aria-hidden />
        </button>

        <div className="absolute top-3 left-3 flex flex-col gap-1.5">
          {discount < -0.01 && (
            <span className="rounded-full bg-ashir-600 px-2 py-0.5 text-[11px] font-bold text-white">
              {discount.toFixed(1).replace('.', ',')}%
            </span>
          )}
          {product.tags.includes('LIQUIDACION') && (
            <span className="rounded-full bg-bad-600 px-2 py-0.5 text-[11px] font-bold text-white">Liquidación</span>
          )}
          {product.availability === 'NEW_ARRIVAL' && !product.tags.includes('LIQUIDACION') && (
            <span className="rounded-full bg-tech-600 px-2 py-0.5 text-[11px] font-bold text-white">Nuevo</span>
          )}
        </div>
      </div>

      {/* ---------------- contenido ---------------- */}
      <div className="flex min-w-0 flex-1 flex-col px-4 pb-4">
        <code className="block truncate font-mono text-[11px] tracking-wide text-ink-400 uppercase">{product.sku}</code>

        <Link
          to={`/catalogo/${product.sku}`}
          className="mt-1 line-clamp-2 min-h-[38px] text-[13px] leading-snug font-bold text-ink-900 transition-colors hover:text-ashir-700"
        >
          {product.name}
        </Link>

        <p className="mt-1 truncate text-[11px] text-ink-400">
          {product.brand} · {product.category}
        </p>

        <div className="mt-3">
          {session.role === 'CLIENT' ? (
            evaluation ? (
              <PriceDisplay
                listPrice={product.listPrice}
                finalPrice={evaluation.finalUnitPrice}
                discountPct={evaluation.totalDiscountPct}
                size="md"
              />
            ) : product.listPrice ? (
              <Skeleton className="h-7 w-32" />
            ) : (
              <span className="text-[15px] font-semibold text-ink-500">A consultar</span>
            )
          ) : (
            <span className="text-lg font-semibold tracking-tight tabular-nums text-ink-900">
              {fmtMoney(product.listPrice)}
            </span>
          )}
          <p className="mt-0.5 text-[11px] text-ink-400">precio unitario sin IVA</p>
        </div>

        {promotion && (
          <Badge tone="ok" size="sm" className="mt-2 self-start">
            {promotion.label}
          </Badge>
        )}

        <StockIndicator product={product} className="mt-2.5" compact />

        {session.role === 'CLIENT' && product.listPrice && (
          <div className="mt-3 flex items-center gap-2 border-t border-ink-100 pt-3">
            <div className="flex h-9 items-center rounded-lg border border-ink-200">
              <button
                type="button"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="px-2.5 text-ink-500 transition-colors hover:text-ashir-600"
                aria-label="Disminuir cantidad"
              >
                <Minus className="size-3.5" aria-hidden />
              </button>
              <input
                type="number"
                min={1}
                value={qty}
                onChange={(e) => setQty(Math.max(1, Number.parseInt(e.target.value, 10) || 1))}
                className="w-9 border-0 bg-transparent p-0 text-center text-[13px] font-semibold tabular-nums focus:outline-none"
                aria-label="Cantidad"
              />
              <button
                type="button"
                onClick={() => setQty((q) => q + 1)}
                className="px-2.5 text-ink-500 transition-colors hover:text-ashir-600"
                aria-label="Aumentar cantidad"
              >
                <Plus className="size-3.5" aria-hidden />
              </button>
            </div>
            <Button
              size="sm"
              className="h-9 flex-1 rounded-lg"
              icon={<ShoppingCart className="size-3.5" />}
              onClick={() => {
                const result = cart.add(product.id, qty);
                if (result.ok) toast.success('Agregado al pedido', result.message);
                else toast.warning('No se pudo agregar', result.message);
              }}
            >
              Agregar
            </Button>
          </div>
        )}

        {session.role === 'CLIENT' && !product.listPrice && (
          <Button
            variant="outline"
            size="sm"
            className="mt-3 h-9 w-full rounded-lg"
            onClick={() => toast.simulated('La consulta de disponibilidad')}
          >
            Consultar disponibilidad
          </Button>
        )}
      </div>
    </article>
  );
}

/** Fila compacta de producto, para la vista tabla del catálogo. */
export function ProductRow({ product }: { product: Product }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="w-11 shrink-0">
        <ProductTile product={product} size="sm" />
      </div>
      <div className="min-w-0">
        <Link
          to={`/catalogo/${product.sku}`}
          className="block truncate text-[13px] font-semibold text-ink-900 hover:text-ashir-700"
        >
          {product.name}
        </Link>
        <p className="mt-0.5 flex items-center gap-2 text-[11px] text-ink-400">
          <code className="font-mono">{product.sku}</code>
          <span>·</span>
          <span>{product.brand}</span>
        </p>
      </div>
    </div>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-ink-200 bg-white p-4">
      <Skeleton className="aspect-square w-full rounded-lg" />
      <Skeleton className="mt-3 h-3 w-20" />
      <Skeleton className="mt-2 h-4 w-full" />
      <Skeleton className="mt-1.5 h-4 w-2/3" />
      <Skeleton className="mt-3 h-7 w-28" />
      <Skeleton className="mt-2.5 h-3 w-24" />
      <Skeleton className="mt-3 h-9 w-full" />
    </div>
  );
}
