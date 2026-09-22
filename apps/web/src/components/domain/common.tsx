/**
 * Componentes de dominio compartidos entre el portal y el backoffice.
 */
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Boxes, CircleDollarSign, Clock, PackageCheck, RefreshCw, TriangleAlert } from 'lucide-react';
import type {

  CustomerSegment,
  IntegrationStatusCode,
  Money,
  OrderStatus,
  Product,
  RmaSla,
  RmaStatus,
  SpecialPriceStatus,
} from '@/types';
import {
  AVAILABILITY,
  INTEGRATION_STATUS,
  ORDER_STATUS,
  RMA_STATUS,
  SEGMENT,
  SPECIAL_PRICE_STATUS,
} from '@/lib/labels';
import { cn, fmtMoney, fmtNumber, fmtRelative } from '@/lib/utils';
import { Badge, Tooltip } from '@/components/ui/primitives';
import { DATA_SOURCE_INFO } from '@/services';

/* ================================================================== */
/* Badges de estado                                                    */
/* ================================================================== */

export function OrderStatusBadge({ status, size }: { status: OrderStatus; size?: 'sm' | 'md' }) {
  const spec = ORDER_STATUS[status];
  return (
    <Badge tone={spec.tone} dot size={size} title={spec.hint}>
      {spec.label}
    </Badge>
  );
}

export function RmaStatusBadge({ status, size }: { status: RmaStatus; size?: 'sm' | 'md' }) {
  const spec = RMA_STATUS[status];
  return (
    <Badge tone={spec.tone} dot size={size}>
      {spec.label}
    </Badge>
  );
}

export function SegmentBadge({ segment, size }: { segment: CustomerSegment; size?: 'sm' | 'md' }) {
  const spec = SEGMENT[segment];
  return (
    <Badge tone={spec.tone} size={size}>
      {spec.label}
    </Badge>
  );
}

export function SpecialPriceStatusBadge({ status, size }: { status: SpecialPriceStatus; size?: 'sm' | 'md' }) {
  const spec = SPECIAL_PRICE_STATUS[status];
  return (
    <Badge tone={spec.tone} dot size={size}>
      {spec.label}
    </Badge>
  );
}

export function IntegrationStatusBadge({ status, size }: { status: IntegrationStatusCode; size?: 'sm' | 'md' }) {
  const spec = INTEGRATION_STATUS[status];
  return (
    <Badge tone={spec.tone} dot size={size} title={spec.hint}>
      {spec.label}
    </Badge>
  );
}

/* ================================================================== */
/* Stock                                                               */
/* ================================================================== */

/**
 * Disponibilidad con el lenguaje que necesita un mayorista: cantidad exacta,
 * aviso de stock bajo y fecha de próximo ingreso.
 */
export function StockIndicator({
  product,
  className,
  compact,
}: {
  product: Product;
  className?: string;
  compact?: boolean;
}) {
  const spec = AVAILABILITY[product.availability];

  if (product.availability === 'INCOMING' && product.incoming) {
    const eta = new Date(Date.now() + product.incoming.etaDays * 86_400_000);
    return (
      <span className={cn('inline-flex items-center gap-1.5 text-[13px] font-medium text-warn-700', className)}>
        <Clock className="size-3.5 shrink-0" aria-hidden />
        Próximo ingreso: {fmtNumber(product.incoming.units)} unidades ·{' '}
        {eta.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }).toUpperCase().replace('.', '')}
      </span>
    );
  }

  if (product.availability === 'OUT_OF_STOCK' || product.stock === 0) {
    return (
      <span className={cn('inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-500', className)}>
        <span className="size-1.5 shrink-0 rounded-full bg-bad-500" aria-hidden />
        {product.listPrice ? 'Sin stock' : 'Consultar disponibilidad'}
      </span>
    );
  }

  const low = product.stock <= 8;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-[13px] font-medium',
        low ? 'text-warn-700' : 'text-ok-700',
        className,
      )}
    >
      <span className={cn('size-1.5 shrink-0 rounded-full', low ? 'bg-warn-500' : 'bg-ok-500')} aria-hidden />
      {low
        ? `Stock bajo: ${product.stock} ${product.stock === 1 ? 'unidad' : 'unidades'}`
        : compact
          ? `${fmtNumber(product.stock)} u.`
          : `Stock disponible: ${fmtNumber(product.stock)}`}
      {product.availability === 'NEW_ARRIVAL' && !compact && (
        <Badge tone="tech" size="sm" className="ml-1">
          {spec.label}
        </Badge>
      )}
    </span>
  );
}

/* ================================================================== */
/* Imagen de producto                                                  */
/* ================================================================== */

/**
 * El Excel de Ashir no trae URLs de imagen, así que en lugar de inventar
 * fotos se compone un tile con la marca y la categoría. Si en el futuro el
 * producto trae `image`, se usa esa.
 */
export function ProductTile({
  product,
  className,
  size = 'md',
}: {
  product: Product;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  if (product.image) {
    return (
      <img
        src={product.image}
        alt={product.name}
        loading="lazy"
        className={cn('aspect-square w-full rounded-lg bg-white object-contain', className)}
      />
    );
  }

  const color = brandColor(product.brand);
  const text = { sm: 'text-[11px]', md: 'text-2xl', lg: 'text-4xl' }[size];

  return (
    <div
      className={cn(
        'relative flex aspect-square w-full flex-col items-center justify-center gap-1.5 overflow-hidden rounded-lg border border-ink-100 bg-white',
        className,
      )}
      role="img"
      aria-label={`${product.brand} · ${product.category}`}
    >
      {/* Halo suave con el color de la marca: da presencia visual sin inventar
          una foto de producto que el archivo de distribuidor no incluye. */}
      <span
        className="absolute inset-0 opacity-[0.07]"
        style={{ background: `radial-gradient(circle at 50% 42%, ${color} 0%, transparent 62%)` }}
        aria-hidden
      />
      <span className={cn('relative font-extrabold tracking-tighter', text)} style={{ color }}>
        {product.brand.slice(0, size === 'sm' ? 2 : 4)}
      </span>
      {size !== 'sm' && (
        <span className="relative px-3 text-center text-[10px] leading-tight font-semibold tracking-widest text-ink-400 uppercase">
          {product.category}
        </span>
      )}
    </div>
  );
}

function brandColor(brand: string): string {
  const map: Record<string, string> = {
    MSI: '#c8102e',
    ASUS: '#00539b',
    THERMALTAKE: '#d32027',
    TTESPORTS: '#d32027',
    ADATA: '#e11d48',
    EVOLABS: '#f97316',
    AUREOX: '#22c55e',
    AMD: '#ed1c24',
    ACER: '#83b81a',
  };
  return map[brand] ?? '#aeb5c0';
}

export { brandColor };

/* ================================================================== */
/* Precio                                                              */
/* ================================================================== */

/**
 * Precio personalizado con el de lista tachado cuando hay descuento.
 * El cliente ve su precio; nunca costo ni margen.
 */
export function PriceDisplay({
  listPrice,
  finalPrice,
  discountPct,
  size = 'md',
  className,
  showList = true,
}: {
  listPrice: Money | null;
  finalPrice: Money | null;
  discountPct?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showList?: boolean;
}) {
  if (!finalPrice || !listPrice) {
    return (
      <span className={cn('text-[13px] font-medium text-ink-500', className)}>A consultar</span>
    );
  }

  const discount = discountPct ? Number.parseFloat(discountPct) : 0;
  const hasDiscount = discount < -0.01;
  const valueSize = { sm: 'text-[15px]', md: 'text-xl', lg: 'text-3xl' }[size];

  return (
    <div className={cn('flex flex-wrap items-baseline gap-x-2 gap-y-0.5', className)}>
      {hasDiscount && showList && (
        <span className="w-full text-[12px] tabular-nums text-ink-400 line-through">{fmtMoney(listPrice)}</span>
      )}
      <span className={cn('font-bold tracking-tight tabular-nums text-ink-900', valueSize)}>{fmtMoney(finalPrice)}</span>
      {hasDiscount && !showList && (
        <Badge tone="ok" size="sm">
          {discount.toFixed(1).replace('.', ',')}%
        </Badge>
      )}
    </div>
  );
}

/* ================================================================== */
/* Modo demo / integracion                                             */
/* ================================================================== */

/** Etiqueta permanente: nunca presentar datos mock como productivos. */
export function DemoModeChip({ className }: { className?: string }) {
  return (
    <Tooltip content={DATA_SOURCE_INFO.description}>
      <span
        className={cn(
          'inline-flex cursor-help items-center gap-1.5 rounded-full bg-warn-50 px-2 py-0.5 text-[11px] font-semibold text-warn-700 ring-1 ring-warn-100 ring-inset',
          className,
        )}
      >
        <span className="size-1.5 rounded-full bg-warn-500" aria-hidden />
        {DATA_SOURCE_INFO.label}
      </span>
    </Tooltip>
  );
}

/**
 * Widget reutilizable de estado de sincronización.
 * Aparece en dashboards y en el centro de integraciones.
 */
export function IntegrationStatusWidget({
  source,
  status,
  lastSyncAt,
  nextSyncAt,
  entities,
  errorCount,
  detailHref,
  onRetry,
  retrying,
  className,
  compact,
}: {
  source: string;
  status: IntegrationStatusCode;
  lastSyncAt: string | null;
  nextSyncAt?: string | null;
  entities: number;
  errorCount: number;
  detailHref?: string;
  onRetry?: () => void;
  retrying?: boolean;
  className?: string;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <span className={cn('inline-flex items-center gap-2 text-[11px] text-ink-500', className)}>
        <span
          className={cn(
            'size-1.5 rounded-full',
            status === 'OPERATIONAL' ? 'bg-ok-500' : status === 'DEGRADED' ? 'bg-warn-500' : status === 'OFFLINE' ? 'bg-bad-500' : 'bg-ink-400',
          )}
          aria-hidden
        />
        {source} · {lastSyncAt ? fmtRelative(lastSyncAt) : 'sin sincronizar'}
      </span>
    );
  }

  return (
    <div className={cn('rounded-card border border-ink-200 bg-white p-4', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-ink-900">{source}</p>
          <p className="mt-0.5 text-xs text-ink-500">Fuente de datos</p>
        </div>
        <IntegrationStatusBadge status={status} />
      </div>

      <dl className="mt-3 space-y-1.5 border-t border-ink-100 pt-3 text-[13px]">
        <div className="flex justify-between gap-3">
          <dt className="text-ink-500">Última sincronización</dt>
          <dd className="font-medium tabular-nums text-ink-800">
            {lastSyncAt ? fmtRelative(lastSyncAt) : 'Nunca'}
          </dd>
        </div>
        {nextSyncAt !== undefined && (
          <div className="flex justify-between gap-3">
            <dt className="text-ink-500">Próxima</dt>
            <dd className="font-medium tabular-nums text-ink-800">{nextSyncAt ? fmtRelative(nextSyncAt) : 'Manual'}</dd>
          </div>
        )}
        <div className="flex justify-between gap-3">
          <dt className="text-ink-500">Entidades sincronizadas</dt>
          <dd className="font-medium tabular-nums text-ink-800">{entities}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-ink-500">Errores</dt>
          <dd className={cn('font-medium tabular-nums', errorCount > 0 ? 'text-bad-600' : 'text-ink-800')}>{errorCount}</dd>
        </div>
      </dl>

      <div className="mt-3 flex gap-2 border-t border-ink-100 pt-3">
        {detailHref && (
          <Link
            to={detailHref}
            className="inline-flex h-8 flex-1 items-center justify-center rounded-lg bg-white text-[13px] font-medium text-ink-800 ring-1 ring-ink-200 transition-colors hover:bg-ink-50"
          >
            Ver detalle
          </Link>
        )}
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            disabled={retrying}
            className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg bg-white text-[13px] font-medium text-ink-800 ring-1 ring-ink-200 transition-colors hover:bg-ink-50 disabled:opacity-50"
          >
            <RefreshCw className={cn('size-3.5', retrying && 'animate-spin')} aria-hidden />
            Reintentar sincronización
          </button>
        )}
      </div>
    </div>
  );
}

/** Línea corta «Sincronizado con ERP · hace 4 min» para encabezados de widget. */
export function SyncStamp({ source = 'ERP', at, className }: { source?: string; at: string | null; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-[11px] text-ink-400', className)}>
      <RefreshCw className="size-3" aria-hidden />
      Sincronizado con {source} · {at ? fmtRelative(at) : 'sin datos'}
    </span>
  );
}

/* ================================================================== */
/* SLA                                                                 */
/* ================================================================== */

export function SlaIndicator({ sla, className }: { sla: RmaSla; className?: string }) {
  if (sla.stage === 'DONE') {
    return (
      <span className={cn('inline-flex items-center gap-1.5 text-[13px] text-ink-500', className)}>
        <PackageCheck className="size-3.5" aria-hidden />
        Cerrado
      </span>
    );
  }

  if (sla.pausedReason) {
    return (
      <Tooltip content={sla.pausedReason}>
        <span className={cn('inline-flex cursor-help items-center gap-1.5 text-[13px] font-medium text-ink-500', className)}>
          <Clock className="size-3.5" aria-hidden />
          SLA en pausa
        </span>
      </Tooltip>
    );
  }

  if (sla.breached) {
    const over = Math.abs(sla.remainingHours);
    return (
      <span className={cn('inline-flex items-center gap-1.5 text-[13px] font-semibold text-bad-600', className)}>
        <TriangleAlert className="size-3.5" aria-hidden />
        Vencido hace {over >= 24 ? `${Math.round(over / 24)} d` : `${over} h`}
      </span>
    );
  }

  const soon = sla.remainingHours <= sla.targetHours * 0.25;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-[13px] font-medium',
        soon ? 'text-warn-700' : 'text-ok-700',
        className,
      )}
    >
      <Clock className="size-3.5" aria-hidden />
      {sla.remainingHours >= 24 ? `${Math.round(sla.remainingHours / 24)} d restantes` : `${sla.remainingHours} h restantes`}
    </span>
  );
}

/* ================================================================== */
/* Varios                                                              */
/* ================================================================== */

/** Marca visual que un valor es un dato simulado y no productivo. */
export function SimulatedValue({ children, reason }: { children: ReactNode; reason?: string }) {
  return (
    <Tooltip content={reason ?? 'Valor simulado para la demostración. No proviene del sistema de gestión de Ashir.'}>
      <span className="inline-flex cursor-help items-center gap-1 border-b border-dashed border-ink-300">
        {children}
        <span className="text-[10px] font-semibold text-ink-400" aria-hidden>
          sim
        </span>
      </span>
    </Tooltip>
  );
}

export function BrandChip({ brand, className }: { brand: string; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-700', className)}>
      <span className="size-2 shrink-0 rounded-sm" style={{ background: brandColor(brand) }} aria-hidden />
      {brand}
    </span>
  );
}

export function MetricHint({ children }: { children: ReactNode }) {
  return <span className="text-xs text-ink-500">{children}</span>;
}

export const DOMAIN_ICONS = { Boxes, CircleDollarSign, PackageCheck } as const;
