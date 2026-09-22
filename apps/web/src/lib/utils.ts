import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { Money, Currency } from '@/types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/* ------------------------------------------------------------------ */
/* dinero                                                             */
/* ------------------------------------------------------------------ */

export const money = (amount: number | string, currency: Currency = 'USD'): Money => ({
  amount: typeof amount === 'number' ? amount.toFixed(2) : amount,
  currency,
});

export const ZERO_USD: Money = { amount: '0.00', currency: 'USD' };

export const num = (m: Money | null | undefined): number =>
  m ? Number.parseFloat(m.amount) || 0 : 0;

export const addMoney = (a: Money, b: Money): Money =>
  money(num(a) + num(b), a.currency);

export const scaleMoney = (m: Money, factor: number): Money =>
  money(num(m) * factor, m.currency);

const CURRENCY_SYMBOL: Record<Currency, string> = { USD: 'USD', ARS: 'ARS' };

/** "USD 1.234,56" — formato es-AR con separador de miles. */
export function fmtMoney(
  m: Money | null | undefined,
  opts: { decimals?: number; withCode?: boolean; compact?: boolean } = {},
): string {
  if (!m) return '—';
  const { decimals = 2, withCode = true, compact = false } = opts;
  const value = num(m);
  const formatted = compact
    ? compactNumber(value)
    : value.toLocaleString('es-AR', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });
  return withCode ? `${CURRENCY_SYMBOL[m.currency]} ${formatted}` : formatted;
}

export function fmtNumber(value: number, decimals = 0): string {
  return value.toLocaleString('es-AR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function compactNumber(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace('.', ',')}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1).replace('.', ',')}k`;
  return fmtNumber(value, 0);
}

/** Porcentaje con signo explicito: "+4,2%" / "-1,8%". */
export function fmtPctDelta(value: number | string, decimals = 1): string {
  const n = typeof value === 'string' ? Number.parseFloat(value) : value;
  if (!Number.isFinite(n)) return '—';
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(decimals).replace('.', ',')}%`;
}

export function fmtPct(value: number | string | null | undefined, decimals = 1): string {
  if (value === null || value === undefined) return '—';
  const n = typeof value === 'string' ? Number.parseFloat(value) : value;
  if (!Number.isFinite(n)) return '—';
  return `${n.toFixed(decimals).replace('.', ',')}%`;
}

/* ------------------------------------------------------------------ */
/* fechas                                                             */
/* ------------------------------------------------------------------ */

const MONTHS_SHORT = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

export function fmtDateShort(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${String(d.getDate()).padStart(2, '0')} ${MONTHS_SHORT[d.getMonth()]}`;
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${fmtDate(iso)} · ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function fmtTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** "hace 4 min", "hace 2 h", "hace 3 d". */
export function fmtRelative(iso: string | null | undefined): string {
  if (!iso) return 'nunca';
  const diffMs = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diffMs)) return '—';
  const future = diffMs < 0;
  const abs = Math.abs(diffMs);
  const mins = Math.floor(abs / 60_000);
  const prefix = future ? 'en' : 'hace';
  if (mins < 1) return future ? 'en instantes' : 'hace instantes';
  if (mins < 60) return `${prefix} ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${prefix} ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${prefix} ${days} d`;
  const months = Math.floor(days / 30);
  return `${prefix} ${months} ${months === 1 ? 'mes' : 'meses'}`;
}

export function daysBetween(a: string, b: string = new Date().toISOString()): number {
  return Math.round((new Date(a).getTime() - new Date(b).getTime()) / 86_400_000);
}

export function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export function addMonths(iso: string, months: number): string {
  const d = new Date(iso);
  d.setMonth(d.getMonth() + months);
  return d.toISOString();
}

export function monthLabel(iso: string): string {
  const d = new Date(iso);
  return `${MONTHS_SHORT[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
}

export function greeting(): string {
  const h = new Date().getHours();
  if (h < 13) return 'Buenos días';
  if (h < 20) return 'Buenas tardes';
  return 'Buenas noches';
}

/* ------------------------------------------------------------------ */
/* texto                                                              */
/* ------------------------------------------------------------------ */

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

export function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}

/** Normaliza para busquedas: sin tildes, minusculas. */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

export function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/* ------------------------------------------------------------------ */
/* varios                                                             */
/* ------------------------------------------------------------------ */

/** PRNG determinista: los datos de demo no cambian en cada render. */
export function seeded(str: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return ((h >>> 0) % 100000) / 100000;
  };
}

export function pickSeeded<T>(seed: string, arr: readonly T[]): T {
  const rnd = seeded(seed);
  return arr[Math.floor(rnd() * arr.length) % arr.length]!;
}

export function betweenSeeded(seed: string, min: number, max: number): number {
  const rnd = seeded(seed);
  return min + Math.floor(rnd() * (max - min + 1));
}

export function groupBy<T, K extends string>(
  items: T[],
  key: (item: T) => K,
): Record<K, T[]> {
  return items.reduce(
    (acc, item) => {
      const k = key(item);
      (acc[k] ??= []).push(item);
      return acc;
    },
    {} as Record<K, T[]>,
  );
}

export function sumBy<T>(items: T[], value: (item: T) => number): number {
  return items.reduce((acc, item) => acc + value(item), 0);
}

export function uniqueBy<T, K>(items: T[], key: (item: T) => K): T[] {
  const seen = new Set<K>();
  return items.filter((item) => {
    const k = key(item);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Id de request de demo, para trazabilidad visual. */
export function requestId(): string {
  return `req_demo_${Math.random().toString(36).slice(2, 10)}`;
}

export function eventId(): string {
  return `evt_${Math.random().toString(36).slice(2, 12)}`;
}

/** Copia al portapapeles devolviendo si tuvo exito. */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function downloadTextFile(filename: string, content: string, mime = 'text/plain') {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
