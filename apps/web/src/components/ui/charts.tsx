/**
 * Envoltorios de Recharts con estilo unificado.
 *
 * Reglas: ejes livianos, grilla solo horizontal, tooltip propio,
 * sin leyendas cuando hay una sola serie, y unidades siempre explicitas.
 */
import type { ReactNode } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { cn, compactNumber, fmtNumber } from '@/lib/utils';
import { CHART_COLORS } from '@/lib/labels';

const AXIS = {
  stroke: '#aeb5c0',
  fontSize: 11,
  tickLine: false,
  axisLine: false,
} as const;

const GRID = { stroke: '#eceef1', vertical: false } as const;

interface TooltipPayloadItem {
  name?: string;
  value?: number | string;
  color?: string;
  dataKey?: string | number;
}

function ChartTooltip({
  active,
  payload,
  label,
  formatter,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string | number;
  formatter?: (value: number, name: string) => string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border border-ink-200 bg-white px-3 py-2 shadow-pop">
      {label !== undefined && <p className="mb-1 text-[11px] font-semibold text-ink-500">{label}</p>}
      <div className="space-y-0.5">
        {payload.map((entry, i) => (
          <div key={i} className="flex items-center gap-2 text-[12px]">
            <span className="size-2 shrink-0 rounded-full" style={{ background: entry.color }} aria-hidden />
            <span className="text-ink-600">{entry.name}</span>
            <span className="ml-auto font-semibold tabular-nums text-ink-900">
              {formatter && typeof entry.value === 'number'
                ? formatter(entry.value, String(entry.name))
                : typeof entry.value === 'number'
                  ? fmtNumber(entry.value)
                  : entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ChartFrame({
  title,
  subtitle,
  action,
  children,
  height = 240,
  className,
  legend,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  height?: number;
  className?: string;
  legend?: { label: string; color: string }[];
}) {
  return (
    <div className={cn('rounded-card border border-ink-200 bg-white p-4', className)}>
      {(title || action) && (
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {title && <h3 className="text-[14px] font-semibold text-ink-900">{title}</h3>}
            {subtitle && <p className="mt-0.5 text-xs text-ink-500">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {legend && legend.length > 1 && (
        <div className="mb-2 flex flex-wrap gap-3">
          {legend.map((l) => (
            <span key={l.label} className="flex items-center gap-1.5 text-[11px] text-ink-600">
              <span className="size-2 rounded-full" style={{ background: l.color }} aria-hidden />
              {l.label}
            </span>
          ))}
        </div>
      )}
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          {children as React.ReactElement}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ================================================================== */

export function TrendArea<T extends Record<string, unknown>>({
  data,
  xKey,
  yKey,
  color = CHART_COLORS[0]!,
  formatter,
}: {
  data: T[];
  xKey: string;
  yKey: string;
  color?: string;
  formatter?: (v: number) => string;
}) {
  const gradientId = `grad-${yKey}-${color.replace('#', '')}`;
  return (
    <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.22} />
          <stop offset="100%" stopColor={color} stopOpacity={0.01} />
        </linearGradient>
      </defs>
      <CartesianGrid {...GRID} />
      <XAxis dataKey={xKey} {...AXIS} />
      <YAxis {...AXIS} tickFormatter={(v: number) => compactNumber(v)} width={52} />
      <RTooltip content={<ChartTooltip formatter={formatter ? (v) => formatter(v) : undefined} />} />
      <Area type="monotone" dataKey={yKey} stroke={color} strokeWidth={2} fill={`url(#${gradientId})`} />
    </AreaChart>
  );
}

export function MultiLine<T extends Record<string, unknown>>({
  data,
  xKey,
  series,
  formatter,
}: {
  data: T[];
  xKey: string;
  series: { key: string; label: string; color?: string }[];
  formatter?: (v: number, name: string) => string;
}) {
  return (
    <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
      <CartesianGrid {...GRID} />
      <XAxis dataKey={xKey} {...AXIS} />
      <YAxis {...AXIS} tickFormatter={(v: number) => compactNumber(v)} width={52} />
      <RTooltip content={<ChartTooltip formatter={formatter} />} />
      {series.map((s, i) => (
        <Line
          key={s.key}
          type="monotone"
          dataKey={s.key}
          name={s.label}
          stroke={s.color ?? CHART_COLORS[i % CHART_COLORS.length]}
          strokeWidth={2}
          dot={false}
        />
      ))}
    </LineChart>
  );
}

export function Bars<T extends Record<string, unknown>>({
  data,
  xKey,
  yKey,
  color = CHART_COLORS[0]!,
  horizontal,
  formatter,
  colorByIndex,
}: {
  data: T[];
  xKey: string;
  yKey: string;
  color?: string;
  horizontal?: boolean;
  formatter?: (v: number) => string;
  colorByIndex?: (row: T, i: number) => string;
}) {
  if (horizontal) {
    return (
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, bottom: 0, left: 8 }}>
        <CartesianGrid stroke="#eceef1" horizontal={false} />
        <XAxis type="number" {...AXIS} tickFormatter={(v: number) => compactNumber(v)} />
        <YAxis type="category" dataKey={xKey} {...AXIS} width={128} />
        <RTooltip cursor={{ fill: '#f6f7f8' }} content={<ChartTooltip formatter={formatter ? (v) => formatter(v) : undefined} />} />
        <Bar dataKey={yKey} radius={[0, 4, 4, 0]} maxBarSize={22}>
          {data.map((row, i) => (
            <Cell key={i} fill={colorByIndex ? colorByIndex(row, i) : color} />
          ))}
        </Bar>
      </BarChart>
    );
  }
  return (
    <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
      <CartesianGrid {...GRID} />
      <XAxis dataKey={xKey} {...AXIS} />
      <YAxis {...AXIS} tickFormatter={(v: number) => compactNumber(v)} width={52} />
      <RTooltip cursor={{ fill: '#f6f7f8' }} content={<ChartTooltip formatter={formatter ? (v) => formatter(v) : undefined} />} />
      <Bar dataKey={yKey} radius={[4, 4, 0, 0]} maxBarSize={38}>
        {data.map((row, i) => (
          <Cell key={i} fill={colorByIndex ? colorByIndex(row, i) : color} />
        ))}
      </Bar>
    </BarChart>
  );
}

export function Donut<T extends Record<string, unknown>>({
  data,
  nameKey,
  valueKey,
  colors = CHART_COLORS,
  formatter,
}: {
  data: T[];
  nameKey: string;
  valueKey: string;
  colors?: readonly string[];
  formatter?: (v: number) => string;
}) {
  return (
    <PieChart>
      <RTooltip content={<ChartTooltip formatter={formatter ? (v) => formatter(v) : undefined} />} />
      <Pie
        data={data}
        dataKey={valueKey}
        nameKey={nameKey}
        innerRadius="58%"
        outerRadius="82%"
        paddingAngle={2}
        strokeWidth={0}
      >
        {data.map((_, i) => (
          <Cell key={i} fill={colors[i % colors.length]} />
        ))}
      </Pie>
    </PieChart>
  );
}

export { CHART_COLORS };
