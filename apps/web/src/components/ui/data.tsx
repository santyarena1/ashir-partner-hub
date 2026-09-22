/**
 * Componentes de presentacion de datos: tablas, KPIs, estados de carga,
 * vacios y error, timelines, bloques de codigo.
 */
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  Copy,
  Inbox,
  Lock,
  Minus,
  RefreshCw,
  WifiOff,
} from 'lucide-react';
import { cn, copyToClipboard, fmtPctDelta } from '@/lib/utils';
import { TONE_DOT, TONE_TEXT, type Tone } from '@/lib/labels';
import { Badge, Button, Card, Skeleton, Tooltip } from '@/components/ui/primitives';

/* ================================================================== */
/* Encabezados                                                         */
/* ================================================================== */

export function PageHeader({
  title,
  subtitle,
  actions,
  breadcrumbs,
  badge,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  breadcrumbs?: { label: string; href?: string }[];
  badge?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mb-6', className)}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Ruta de navegación" className="mb-2 flex flex-wrap items-center gap-1 text-[13px] text-ink-500">
          {breadcrumbs.map((crumb, i) => (
            <span key={`${crumb.label}-${i}`} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="size-3.5 text-ink-300" aria-hidden />}
              {crumb.href ? (
                <Link to={crumb.href} className="transition-colors hover:text-ink-800">
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-ink-700">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl font-semibold tracking-tight text-ink-900 sm:text-[26px]">{title}</h1>
            {badge}
          </div>
          {subtitle && <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-ink-500">{subtitle}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function SectionTitle({
  title,
  subtitle,
  action,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mb-3 flex items-end justify-between gap-4', className)}>
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold text-ink-900">{title}</h2>
        {subtitle && <p className="mt-0.5 text-[13px] text-ink-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/* ================================================================== */
/* KPIs                                                                */
/* ================================================================== */

export function StatTile({
  label,
  value,
  delta,
  deltaLabel,
  hint,
  icon,
  tone = 'neutral',
  footer,
  className,
  /** Invierte la lectura del delta: para métricas donde bajar es bueno. */
  invertDelta,
}: {
  label: ReactNode;
  value: ReactNode;
  delta?: number | string | null;
  deltaLabel?: string;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: Tone;
  footer?: ReactNode;
  className?: string;
  invertDelta?: boolean;
}) {
  const deltaNum = delta === null || delta === undefined ? null : Number.parseFloat(String(delta));
  const positive = deltaNum !== null && deltaNum > 0;
  const negative = deltaNum !== null && deltaNum < 0;
  const good = invertDelta ? negative : positive;
  const bad = invertDelta ? positive : negative;

  return (
    <Card className={cn('p-4', className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <p className="text-[13px] font-medium text-ink-500">{label}</p>
          {hint}
        </div>
        {icon && <span className={cn('shrink-0', TONE_TEXT[tone])}>{icon}</span>}
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums text-ink-900">{value}</p>
      {deltaNum !== null && (
        <div className="mt-1.5 flex items-center gap-1.5 text-[13px]">
          <span
            className={cn(
              'inline-flex items-center gap-0.5 font-semibold tabular-nums',
              good ? 'text-ok-600' : bad ? 'text-bad-600' : 'text-ink-500',
            )}
          >
            {deltaNum === 0 ? (
              <Minus className="size-3.5" aria-hidden />
            ) : positive ? (
              <ArrowUpRight className="size-3.5" aria-hidden />
            ) : (
              <ArrowDownRight className="size-3.5" aria-hidden />
            )}
            {fmtPctDelta(deltaNum)}
          </span>
          {deltaLabel && <span className="text-ink-500">{deltaLabel}</span>}
        </div>
      )}
      {footer && <div className="mt-3 border-t border-ink-100 pt-3 text-[13px] text-ink-500">{footer}</div>}
    </Card>
  );
}

export function StatGrid({ children, cols = 4, className }: { children: ReactNode; cols?: 2 | 3 | 4 | 5 | 6; className?: string }) {
  const map = {
    2: 'sm:grid-cols-2',
    3: 'sm:grid-cols-2 lg:grid-cols-3',
    4: 'sm:grid-cols-2 lg:grid-cols-4',
    5: 'sm:grid-cols-2 lg:grid-cols-5',
    6: 'sm:grid-cols-3 lg:grid-cols-6',
  } as const;
  return <div className={cn('grid grid-cols-1 gap-3', map[cols], className)}>{children}</div>;
}

/** Fila compacta etiqueta/valor, para fichas y resúmenes. */
export function DataRow({
  label,
  value,
  hint,
  className,
  emphasis,
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  className?: string;
  emphasis?: boolean;
}) {
  return (
    <div className={cn('flex items-start justify-between gap-4 py-1.5', className)}>
      <span className="flex items-center gap-1.5 text-[13px] text-ink-500">
        {label}
        {hint}
      </span>
      <span className={cn('text-right text-[13px] tabular-nums', emphasis ? 'font-semibold text-ink-900' : 'text-ink-800')}>
        {value}
      </span>
    </div>
  );
}

/* ================================================================== */
/* Tabla                                                               */
/* ================================================================== */

export interface Column<T> {
  key: string;
  header: ReactNode;
  cell: (row: T, index: number) => ReactNode;
  align?: 'left' | 'right' | 'center';
  width?: string;
  /** Oculta la columna en mobile: la tabla se vuelve tarjeta. */
  hideOnMobile?: boolean;
  sortable?: boolean;
  sortValue?: (row: T) => string | number;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  empty,
  loading,
  loadingRows = 6,
  className,
  dense,
  footer,
  /** Render alternativo para mobile; si no se pasa, se usa scroll horizontal. */
  mobileCard,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  empty?: ReactNode;
  loading?: boolean;
  loadingRows?: number;
  className?: string;
  dense?: boolean;
  footer?: ReactNode;
  mobileCard?: (row: T) => ReactNode;
}) {
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null);

  const sorted = (() => {
    if (!sort) return rows;
    const column = columns.find((c) => c.key === sort.key);
    if (!column?.sortValue) return rows;
    return [...rows].sort((a, b) => {
      const va = column.sortValue!(a);
      const vb = column.sortValue!(b);
      const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), 'es');
      return sort.dir === 'asc' ? cmp : -cmp;
    });
  })();

  if (loading) {
    return (
      <div className={cn('overflow-hidden rounded-card border border-ink-200 bg-white', className)}>
        <div className="space-y-px">
          {Array.from({ length: loadingRows }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3.5">
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="hidden h-4 w-20 sm:block" />
              <Skeleton className="hidden h-4 w-16 md:block" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (sorted.length === 0 && empty) {
    return <div className={cn('rounded-card border border-ink-200 bg-white', className)}>{empty}</div>;
  }

  return (
    <div className={cn('overflow-hidden rounded-card border border-ink-200 bg-white', className)}>
      {mobileCard && (
        <ul className="divide-y divide-ink-100 sm:hidden">
          {sorted.map((row) => (
            <li
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cn('px-4 py-3', onRowClick && 'cursor-pointer active:bg-ink-50')}
            >
              {mobileCard(row)}
            </li>
          ))}
        </ul>
      )}
      <div className={cn('overflow-x-auto', mobileCard && 'hidden sm:block')}>
        <table className="w-full min-w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-ink-200 bg-ink-50/70">
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  style={col.width ? { width: col.width } : undefined}
                  className={cn(
                    'px-4 py-2.5 font-medium whitespace-nowrap text-ink-500',
                    col.align === 'right' && 'text-right',
                    col.align === 'center' && 'text-center',
                    col.hideOnMobile && 'hidden md:table-cell',
                  )}
                >
                  {col.sortable && col.sortValue ? (
                    <button
                      type="button"
                      onClick={() =>
                        setSort((prev) =>
                          prev?.key === col.key
                            ? { key: col.key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
                            : { key: col.key, dir: 'asc' },
                        )
                      }
                      className="inline-flex items-center gap-1 transition-colors hover:text-ink-800"
                    >
                      {col.header}
                      <span className="text-[10px]" aria-hidden>
                        {sort?.key === col.key ? (sort.dir === 'asc' ? '▲' : '▼') : '⇅'}
                      </span>
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {sorted.map((row, index) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn('transition-colors', onRowClick && 'cursor-pointer hover:bg-ashir-50/40')}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn(
                      'px-4 align-middle text-ink-800',
                      dense ? 'py-2' : 'py-3',
                      col.align === 'right' && 'text-right',
                      col.align === 'center' && 'text-center',
                      col.hideOnMobile && 'hidden md:table-cell',
                    )}
                  >
                    {col.cell(row, index)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {footer && (
            <tfoot className="border-t-2 border-ink-200 bg-ink-50/70 font-medium">
              {footer}
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

/* ================================================================== */
/* Estados                                                             */
/* ================================================================== */

export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
  compact,
}: {
  title: string;
  description?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center', compact ? 'px-5 py-8' : 'px-6 py-14', className)}>
      <div className="mb-3 flex size-11 items-center justify-center rounded-full bg-ink-100 text-ink-400">
        {icon ?? <Inbox className="size-5" aria-hidden />}
      </div>
      <p className="text-sm font-semibold text-ink-800">{title}</p>
      {description && <p className="mt-1.5 max-w-md text-[13px] leading-relaxed text-ink-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({
  title = 'No pudimos cargar esta información',
  description,
  onRetry,
  requestId,
  className,
  offline,
}: {
  title?: string;
  description?: ReactNode;
  onRetry?: () => void;
  requestId?: string;
  className?: string;
  offline?: boolean;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-12 text-center', className)}>
      <div className="mb-3 flex size-11 items-center justify-center rounded-full bg-bad-50 text-bad-600">
        {offline ? <WifiOff className="size-5" aria-hidden /> : <AlertCircle className="size-5" aria-hidden />}
      </div>
      <p className="text-sm font-semibold text-ink-800">{title}</p>
      {description && <p className="mt-1.5 max-w-md text-[13px] leading-relaxed text-ink-500">{description}</p>}
      {requestId && (
        <p className="mt-2 font-mono text-[11px] text-ink-400">
          Request ID: {requestId}
        </p>
      )}
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-4" icon={<RefreshCw className="size-3.5" />} onClick={onRetry}>
          Reintentar
        </Button>
      )}
    </div>
  );
}

export function ForbiddenState({ scope, className }: { scope?: string; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-12 text-center', className)}>
      <div className="mb-3 flex size-11 items-center justify-center rounded-full bg-ink-100 text-ink-400">
        <Lock className="size-5" aria-hidden />
      </div>
      <p className="text-sm font-semibold text-ink-800">Tu rol no tiene acceso a esta sección</p>
      <p className="mt-1.5 max-w-md text-[13px] leading-relaxed text-ink-500">
        Cambiá de rol con el selector «Ver plataforma como» para recorrer esta parte del portal.
        {scope && <span className="mt-1 block font-mono text-[11px] text-ink-400">Permiso requerido: {scope}</span>}
      </p>
    </div>
  );
}

/** Indica que un dato viene de una sincronización previa y puede estar desactualizado. */
export function StaleDataNotice({ at, onRefresh }: { at: string; onRefresh?: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-warn-200 bg-warn-50 px-3 py-2 text-[13px] text-warn-700">
      <span className="flex items-center gap-2">
        <AlertCircle className="size-4 shrink-0" aria-hidden />
        Estos datos corresponden a la última sincronización ({at}) y pueden estar desactualizados.
      </span>
      {onRefresh && (
        <button type="button" onClick={onRefresh} className="shrink-0 font-semibold underline underline-offset-2">
          Actualizar
        </button>
      )}
    </div>
  );
}

/* ================================================================== */
/* Timeline / Stepper                                                  */
/* ================================================================== */

export interface TimelineItem {
  id: string;
  title: ReactNode;
  at: string;
  actor?: string;
  actorRole?: string;
  comment?: ReactNode;
  documents?: { name: string; type: string }[];
  tone?: Tone;
  current?: boolean;
}

export function Timeline({ items, className }: { items: TimelineItem[]; className?: string }) {
  return (
    <ol className={cn('relative space-y-0', className)}>
      {items.map((item, i) => (
        <li key={item.id} className="relative flex gap-3.5 pb-5 last:pb-0">
          <div className="relative flex flex-col items-center">
            <span
              className={cn(
                'mt-1 size-2.5 shrink-0 rounded-full ring-4 ring-white',
                TONE_DOT[item.tone ?? 'tech'],
                item.current && 'animate-pulse-ring',
              )}
              aria-hidden
            />
            {i < items.length - 1 && <span className="mt-1 w-px flex-1 bg-ink-200" aria-hidden />}
          </div>
          <div className="-mt-0.5 min-w-0 flex-1 pb-1">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <p className="text-[13px] font-semibold text-ink-900">{item.title}</p>
              <span className="text-xs tabular-nums text-ink-400">{item.at}</span>
            </div>
            {item.actor && (
              <p className="mt-0.5 text-xs text-ink-500">
                {item.actor}
                {item.actorRole && <span className="text-ink-400"> · {item.actorRole}</span>}
              </p>
            )}
            {item.comment && <p className="mt-1.5 text-[13px] leading-relaxed text-ink-600">{item.comment}</p>}
            {item.documents && item.documents.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {item.documents.map((doc) => (
                  <span
                    key={doc.name}
                    className="inline-flex items-center gap-1 rounded-md bg-ink-100 px-2 py-0.5 font-mono text-[11px] text-ink-600"
                  >
                    {doc.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

export function Stepper({
  steps,
  currentIndex,
  className,
}: {
  steps: { label: string; sublabel?: string }[];
  currentIndex: number;
  className?: string;
}) {
  return (
    <ol className={cn('no-scrollbar flex gap-1 overflow-x-auto', className)}>
      {steps.map((step, i) => {
        const done = i < currentIndex;
        const current = i === currentIndex;
        return (
          <li key={step.label} className="flex min-w-0 flex-1 flex-col gap-1.5">
            <div
              className={cn(
                'h-1 rounded-full',
                done ? 'bg-ok-500' : current ? 'bg-ashir-500' : 'bg-ink-200',
              )}
              aria-hidden
            />
            <div className="min-w-0 px-0.5">
              <p
                className={cn(
                  'truncate text-[11px] font-semibold',
                  done ? 'text-ok-700' : current ? 'text-ashir-700' : 'text-ink-400',
                )}
              >
                {step.label}
              </p>
              {step.sublabel && <p className="truncate text-[11px] text-ink-400">{step.sublabel}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/* ================================================================== */
/* Codigo                                                              */
/* ================================================================== */

export function CopyButton({ value, label = 'Copiar', className }: { value: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        const ok = await copyToClipboard(value);
        if (ok) {
          setCopied(true);
          setTimeout(() => setCopied(false), 1_600);
        }
      }}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium transition-colors',
        copied ? 'bg-ok-50 text-ok-700' : 'text-ink-400 hover:bg-ink-100 hover:text-ink-700',
        className,
      )}
      aria-label={copied ? 'Copiado' : label}
    >
      {copied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
      {copied ? 'Copiado' : label}
    </button>
  );
}

export function CodeBlock({
  code,
  language,
  title,
  className,
  maxHeight = '420px',
}: {
  code: string;
  language?: string;
  title?: ReactNode;
  className?: string;
  maxHeight?: string;
}) {
  return (
    <div className={cn('overflow-hidden rounded-lg border border-ink-800 bg-ink-950', className)}>
      <div className="flex items-center justify-between gap-3 border-b border-ink-800 bg-ink-900 px-3 py-1.5">
        <span className="truncate font-mono text-[11px] text-ink-300">{title ?? language ?? 'código'}</span>
        <CopyButton value={code} className="text-ink-400 hover:bg-ink-800 hover:text-white" />
      </div>
      <pre
        className="overflow-auto px-3.5 py-3 font-mono text-[12px] leading-relaxed text-ink-100"
        style={{ maxHeight }}
      >
        <code>{code}</code>
      </pre>
    </div>
  );
}

/** Visor JSON coloreado sin librerías: suficiente para payloads de demo. */
export function JsonViewer({ value, className, maxHeight }: { value: unknown; className?: string; maxHeight?: string }) {
  return <CodeBlock code={JSON.stringify(value, null, 2)} language="json" className={className} maxHeight={maxHeight} />;
}

/* ================================================================== */
/* Varios                                                              */
/* ================================================================== */

/** Etiqueta monoespaciada para SKUs, seriales, códigos y request IDs. */
export function Mono({ children, className, copy }: { children: string; className?: string; copy?: boolean }) {
  if (copy) {
    return (
      <Tooltip content="Clic para copiar">
        <span className="inline-flex items-center gap-1">
          <code className={cn('rounded bg-ink-100 px-1.5 py-0.5 font-mono text-[11px] text-ink-700', className)}>{children}</code>
          <CopyButton value={children} label="" className="px-1" />
        </span>
      </Tooltip>
    );
  }
  return <code className={cn('rounded bg-ink-100 px-1.5 py-0.5 font-mono text-[11px] text-ink-700', className)}>{children}</code>;
}

/** Aviso contextual dentro de una pantalla. */
export function Callout({
  tone = 'tech',
  title,
  children,
  icon,
  action,
  className,
}: {
  tone?: Tone;
  title?: ReactNode;
  children?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const styles: Record<Tone, string> = {
    neutral: 'border-ink-200 bg-ink-50 text-ink-700',
    ok: 'border-ok-100 bg-ok-50 text-ok-700',
    warn: 'border-warn-100 bg-warn-50 text-warn-700',
    bad: 'border-bad-100 bg-bad-50 text-bad-700',
    tech: 'border-tech-100 bg-tech-50 text-tech-700',
    brand: 'border-ashir-100 bg-ashir-50 text-ashir-700',
    plat: 'border-plat-100 bg-plat-50 text-plat-700',
  };
  return (
    <div className={cn('flex items-start gap-3 rounded-lg border px-3.5 py-3', styles[tone], className)}>
      {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
      <div className="min-w-0 flex-1">
        {title && <p className="text-[13px] font-semibold">{title}</p>}
        {children && <div className={cn('text-[13px] leading-relaxed', title && 'mt-1')}>{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/** Barra de filtros consistente en listados. */
export function FilterBar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('mb-4 flex flex-wrap items-center gap-2', className)}>
      {children}
    </div>
  );
}

export function ResultCount({ shown, total, noun = 'resultados' }: { shown: number; total: number; noun?: string }) {
  return (
    <p className="text-[13px] text-ink-500">
      <span className="font-semibold tabular-nums text-ink-800">{shown}</span>
      {shown !== total && <> de <span className="tabular-nums">{total}</span></>} {noun}
    </p>
  );
}

export { Badge, Card };
