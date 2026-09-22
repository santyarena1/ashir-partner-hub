/**
 * Tarjeta de producto del catálogo B2B.
 *
 * Muestra precio de lista, precio personalizado, descuento aplicado,
 * promoción activa, stock real y control de cantidad. Nunca costo ni margen.
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
import { Badge, Button, Card, Skeleton } from '@/components/ui/primitives';
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

  return (
    <Card as="article" interactive className={cn('flex flex-col overflow-hidden', className)}>
      <div className="relative p-3 pb-0">
        <Link to={`/catalogo/${product.sku}`} className="block">
          <ProductTile product={product} />
        </Link>
        <button
          type="button"
          onClick={() => toggle(product.id)}
          aria-label={isFavorite(product.id) ? 'Quitar de favoritos' : 'Guardar en favoritos'}
          aria-pressed={isFavorite(product.id)}
          className="absolute top-4 right-4 rounded-full bg-white/90 p-1.5 text-ink-400 shadow-subtle backdrop-blur transition-colors hover:text-ashir-600"
        >
          <Heart className={cn('size-4', isFavorite(product.id) && 'fill-ashir-500 text-ashir-500')} aria-hidden />
        </button>
        {product.tags.includes('LIQUIDACION') && (
          <Badge tone="bad" size="sm" className="absolute top-4 left-4">
            Liquidación
          </Badge>
        )}
        {product.availability === 'NEW_ARRIVAL' && !product.tags.includes('LIQUIDACION') && (
          <Badge tone="tech" size="sm" className="absolute top-4 left-4">
            Nuevo ingreso
          </Badge>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col p-3.5">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-[11px] font-bold tracking-wide text-ink-400 uppercase">{product.brand}</span>
          <span className="truncate text-[11px] text-ink-400">{product.category}</span>
        </div>

        <Link
          to={`/catalogo/${product.sku}`}
          className="mt-1 line-clamp-2 min-h-[36px] text-[13px] leading-snug font-semibold text-ink-900 hover:text-ashir-700"
        >
          {product.name}
        </Link>

        <code className="mt-1 block truncate font-mono text-[11px] text-ink-400">{product.sku}</code>

        <div className="mt-2.5">
          {session.role === 'CLIENT' ? (
            evaluation ? (
              <PriceDisplay
                listPrice={product.listPrice}
                finalPrice={evaluation.finalUnitPrice}
                discountPct={evaluation.totalDiscountPct}
                size="sm"
              />
            ) : product.listPrice ? (
              <Skeleton className="h-6 w-28" />
            ) : (
              <span className="text-[13px] font-medium text-ink-500">A consultar</span>
            )
          ) : (
            <span className="text-[15px] font-semibold tabular-nums text-ink-900">{fmtMoney(product.listPrice)}</span>
          )}
        </div>

        {promotion && (
          <p className="mt-1 truncate text-[11px] font-medium text-ok-700">{promotion.label}</p>
        )}

        <StockIndicator product={product} className="mt-2" />

        {session.role === 'CLIENT' && product.listPrice && (
          <div className="mt-3 flex items-center gap-2">
            <div className="flex h-8 items-center rounded-lg border border-ink-200">
              <button
                type="button"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="px-2 text-ink-500 transition-colors hover:text-ink-900"
                aria-label="Disminuir cantidad"
              >
                <Minus className="size-3.5" aria-hidden />
              </button>
              <input
                type="number"
                min={1}
                value={qty}
                onChange={(e) => setQty(Math.max(1, Number.parseInt(e.target.value, 10) || 1))}
                className="w-10 border-0 bg-transparent p-0 text-center text-[13px] font-semibold tabular-nums focus:outline-none"
                aria-label="Cantidad"
              />
              <button
                type="button"
                onClick={() => setQty((q) => q + 1)}
                className="px-2 text-ink-500 transition-colors hover:text-ink-900"
                aria-label="Aumentar cantidad"
              >
                <Plus className="size-3.5" aria-hidden />
              </button>
            </div>
            <Button
              size="sm"
              className="flex-1"
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
          <Button variant="outline" size="sm" className="mt-3" onClick={() => toast.simulated('La consulta de disponibilidad')}>
            Consultar disponibilidad
          </Button>
        )}
      </div>
    </Card>
  );
}

/** Fila compacta de producto, para la vista tabla del catálogo. */
export function ProductRow({ product }: { product: Product }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="w-10 shrink-0">
        <ProductTile product={product} size="sm" />
      </div>
      <div className="min-w-0">
        <Link to={`/catalogo/${product.sku}`} className="block truncate text-[13px] font-medium text-ink-900 hover:text-ashir-700">
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
    <Card className="flex flex-col overflow-hidden p-3">
      <Skeleton className="aspect-square w-full rounded-lg" />
      <Skeleton className="mt-3 h-3 w-16" />
      <Skeleton className="mt-2 h-4 w-full" />
      <Skeleton className="mt-1.5 h-4 w-2/3" />
      <Skeleton className="mt-3 h-6 w-24" />
      <Skeleton className="mt-2 h-3 w-28" />
      <Skeleton className="mt-3 h-8 w-full" />
    </Card>
  );
}
