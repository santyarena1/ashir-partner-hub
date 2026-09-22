/**
 * Primitivas de interfaz del design system.
 * Componentes accesibles, sin dependencias externas de UI.
 */
import {
  createContext,
  useContext,
  useId,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { Check, ChevronDown, Info, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TONE_BADGE, TONE_DOT, type Tone } from '@/lib/labels';

/* ================================================================== */
/* Button                                                              */
/* ================================================================== */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline' | 'link';
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-ashir-600 text-white hover:bg-ashir-700 active:bg-ashir-800 shadow-subtle',
  secondary: 'bg-ink-900 text-white hover:bg-ink-800 active:bg-ink-950 shadow-subtle',
  outline: 'bg-white text-ink-800 ring-1 ring-ink-200 hover:bg-ink-50 hover:ring-ink-300',
  ghost: 'text-ink-700 hover:bg-ink-100 hover:text-ink-900',
  danger: 'bg-bad-600 text-white hover:bg-bad-700 shadow-subtle',
  link: 'text-ashir-600 hover:text-ashir-700 underline underline-offset-2 hover:decoration-2',
};

const BUTTON_SIZE: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-[13px] gap-1.5 rounded-lg',
  md: 'h-9.5 px-4 text-sm gap-2 rounded-lg',
  lg: 'h-11 px-5 text-[15px] gap-2 rounded-xl',
  icon: 'h-9 w-9 rounded-lg',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
  iconRight?: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  iconRight,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center font-medium whitespace-nowrap transition-colors',
        'disabled:pointer-events-none disabled:opacity-50',
        BUTTON_VARIANT[variant],
        BUTTON_SIZE[size],
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden /> : icon}
      {children}
      {iconRight}
    </button>
  );
}

/* ================================================================== */
/* Badge                                                               */
/* ================================================================== */

export interface BadgeProps {
  tone?: Tone;
  children: ReactNode;
  /** Punto de color: los estados no dependen solo del color, pero ayuda a escanear. */
  dot?: boolean;
  className?: string;
  title?: string;
  size?: 'sm' | 'md';
}

export function Badge({ tone = 'neutral', children, dot, className, title, size = 'md' }: BadgeProps) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium ring-1 ring-inset whitespace-nowrap',
        size === 'sm' ? 'px-1.5 py-0.5 text-[11px]' : 'px-2 py-0.5 text-xs',
        TONE_BADGE[tone],
        className,
      )}
    >
      {dot && <span className={cn('size-1.5 shrink-0 rounded-full', TONE_DOT[tone])} aria-hidden />}
      {children}
    </span>
  );
}

/* ================================================================== */
/* Card                                                               */
/* ================================================================== */

export function Card({
  className,
  children,
  as: Tag = 'div',
  interactive,
  ...props
}: {
  className?: string;
  children: ReactNode;
  as?: 'div' | 'article' | 'section' | 'li';
  interactive?: boolean;
} & React.HTMLAttributes<HTMLElement>) {
  return (
    <Tag
      className={cn(
        'rounded-card border border-ink-200 bg-white shadow-card',
        interactive && 'transition-shadow hover:shadow-pop',
        className,
      )}
      {...props}
    >
      {children}
    </Tag>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
  icon,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-start justify-between gap-4 border-b border-ink-100 px-5 py-4', className)}>
      <div className="flex min-w-0 items-start gap-3">
        {icon && <div className="mt-0.5 shrink-0 text-ink-400">{icon}</div>}
        <div className="min-w-0">
          <h3 className="truncate text-[15px] font-semibold text-ink-900">{title}</h3>
          {subtitle && <p className="mt-0.5 text-[13px] text-ink-500">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/* ================================================================== */
/* Campos de formulario                                                */
/* ================================================================== */

export interface FieldProps {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
  htmlFor?: string;
}

export function Field({ label, hint, error, required, children, className, htmlFor }: FieldProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={htmlFor} className="text-[13px] font-medium text-ink-700">
          {label}
          {required && <span className="ml-0.5 text-bad-600" aria-hidden>*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="text-xs font-medium text-bad-600" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-ink-500">{hint}</p>
      ) : null}
    </div>
  );
}

const INPUT_BASE =
  'w-full rounded-lg border border-ink-200 bg-white px-3 text-sm text-ink-900 placeholder:text-ink-400 ' +
  'transition-colors hover:border-ink-300 focus:border-ashir-500 focus:outline-none focus:ring-2 focus:ring-ashir-500/20 ' +
  'disabled:cursor-not-allowed disabled:bg-ink-50 disabled:text-ink-500';

export function Input({
  className,
  invalid,
  leading,
  trailing,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean; leading?: ReactNode; trailing?: ReactNode }) {
  if (leading || trailing) {
    return (
      <div className="relative">
        {leading && (
          <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-400" aria-hidden>
            {leading}
          </span>
        )}
        <input
          className={cn(
            INPUT_BASE,
            'h-9.5',
            leading && 'pl-9',
            trailing && 'pr-9',
            invalid && 'border-bad-500 focus:border-bad-500 focus:ring-bad-500/20',
            className,
          )}
          aria-invalid={invalid}
          {...props}
        />
        {trailing && <span className="absolute top-1/2 right-3 -translate-y-1/2 text-ink-400">{trailing}</span>}
      </div>
    );
  }
  return (
    <input
      className={cn(INPUT_BASE, 'h-9.5', invalid && 'border-bad-500 focus:border-bad-500 focus:ring-bad-500/20', className)}
      aria-invalid={invalid}
      {...props}
    />
  );
}

export function Textarea({ className, invalid, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return (
    <textarea
      className={cn(INPUT_BASE, 'min-h-[84px] py-2 leading-relaxed', invalid && 'border-bad-500', className)}
      aria-invalid={invalid}
      {...props}
    />
  );
}

export function Select({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select
        className={cn(INPUT_BASE, 'h-9.5 appearance-none pr-9', className)}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-ink-400" aria-hidden />
    </div>
  );
}

export function Checkbox({
  label,
  description,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; description?: string }) {
  const id = useId();
  return (
    <label htmlFor={props.id ?? id} className={cn('flex cursor-pointer items-start gap-2.5 select-none', className)}>
      <span className="relative mt-0.5 flex size-4 shrink-0 items-center justify-center">
        <input
          id={props.id ?? id}
          type="checkbox"
          className="peer size-4 cursor-pointer appearance-none rounded border border-ink-300 bg-white transition-colors checked:border-ashir-600 checked:bg-ashir-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ashir-500"
          {...props}
        />
        <Check className="pointer-events-none absolute size-3 text-white opacity-0 peer-checked:opacity-100" strokeWidth={3} aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] leading-tight font-medium text-ink-800">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-ink-500">{description}</span>}
      </span>
    </label>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: ReactNode;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-ink-800">{label}</p>
        {description && <p className="mt-0.5 text-xs text-ink-500">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={typeof label === 'string' ? label : 'Alternar'}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-50',
          checked ? 'bg-ashir-600' : 'bg-ink-300',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 size-4 rounded-full bg-white shadow-sm transition-transform',
            checked ? 'translate-x-4.5' : 'translate-x-0.5',
          )}
        />
      </button>
    </div>
  );
}

/* ================================================================== */
/* Tabs                                                                */
/* ================================================================== */

interface TabsContextValue {
  value: string;
  setValue: (v: string) => void;
}
const TabsContext = createContext<TabsContextValue | null>(null);

export function Tabs({
  value,
  onValueChange,
  children,
  className,
}: {
  value: string;
  onValueChange: (v: string) => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <TabsContext.Provider value={{ value, setValue: onValueChange }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabsList({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div role="tablist" className={cn('no-scrollbar flex gap-1 overflow-x-auto border-b border-ink-200', className)}>
      {children}
    </div>
  );
}

export function TabsTrigger({
  value,
  children,
  count,
}: {
  value: string;
  children: ReactNode;
  count?: number;
}) {
  const ctx = useContext(TabsContext);
  const active = ctx?.value === value;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={() => ctx?.setValue(value)}
      className={cn(
        '-mb-px flex items-center gap-2 border-b-2 px-3.5 py-2.5 text-[13px] font-medium whitespace-nowrap transition-colors',
        active
          ? 'border-ashir-600 text-ashir-700'
          : 'border-transparent text-ink-500 hover:border-ink-300 hover:text-ink-800',
      )}
    >
      {children}
      {count !== undefined && (
        <span
          className={cn(
            'rounded-full px-1.5 py-px text-[11px] font-semibold tabular-nums',
            active ? 'bg-ashir-100 text-ashir-700' : 'bg-ink-100 text-ink-600',
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

export function TabsContent({ value, children, className }: { value: string; children: ReactNode; className?: string }) {
  const ctx = useContext(TabsContext);
  if (ctx?.value !== value) return null;
  return (
    <div role="tabpanel" className={cn('animate-fade-in', className)}>
      {children}
    </div>
  );
}

/* ================================================================== */
/* Segmented control                                                   */
/* ================================================================== */

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
  className,
}: {
  options: { value: T; label: ReactNode; title?: string }[];
  value: T;
  onChange: (v: T) => void;
  size?: 'sm' | 'md';
  className?: string;
}) {
  return (
    <div className={cn('inline-flex rounded-lg bg-ink-100 p-0.5', className)} role="group">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          title={opt.title}
          aria-pressed={value === opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            'rounded-[7px] font-medium transition-colors',
            size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-[13px]',
            value === opt.value ? 'bg-white text-ink-900 shadow-subtle' : 'text-ink-500 hover:text-ink-800',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/* ================================================================== */
/* Tooltip                                                             */
/* ================================================================== */

export function Tooltip({
  content,
  children,
  side = 'top',
}: {
  content: ReactNode;
  children: ReactNode;
  side?: 'top' | 'bottom';
}) {
  const [open, setOpen] = useState(false);
  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      {open && (
        <span
          role="tooltip"
          className={cn(
            'pointer-events-none absolute left-1/2 z-50 w-max max-w-[260px] -translate-x-1/2 rounded-lg bg-ink-900 px-2.5 py-1.5 text-xs leading-snug font-medium text-white shadow-pop',
            side === 'top' ? 'bottom-[calc(100%+6px)]' : 'top-[calc(100%+6px)]',
          )}
        >
          {content}
        </span>
      )}
    </span>
  );
}

/** Icono de ayuda con tooltip, para explicar metricas. */
export function InfoHint({ children }: { children: ReactNode }) {
  return (
    <Tooltip content={children}>
      <Info className="size-3.5 cursor-help text-ink-400" aria-label="Más información" />
    </Tooltip>
  );
}

/* ================================================================== */
/* Progreso / skeleton / avatar                                        */
/* ================================================================== */

export function ProgressBar({
  value,
  tone = 'brand',
  className,
  showLabel,
  height = 'md',
}: {
  value: number;
  tone?: Tone;
  className?: string;
  showLabel?: boolean;
  height?: 'sm' | 'md' | 'lg';
}) {
  const pct = Math.max(0, Math.min(100, value));
  const bar: Record<Tone, string> = {
    brand: 'bg-ashir-500',
    ok: 'bg-ok-500',
    warn: 'bg-warn-500',
    bad: 'bg-bad-500',
    tech: 'bg-tech-500',
    plat: 'bg-plat-500',
    neutral: 'bg-ink-400',
  };
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div
        className={cn(
          'w-full overflow-hidden rounded-full bg-ink-150 bg-ink-100',
          height === 'sm' ? 'h-1' : height === 'lg' ? 'h-2.5' : 'h-1.5',
        )}
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className={cn('h-full rounded-full transition-[width] duration-500', bar[tone])} style={{ width: `${pct}%` }} />
      </div>
      {showLabel && <span className="shrink-0 text-xs font-semibold tabular-nums text-ink-600">{Math.round(pct)}%</span>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} aria-hidden />;
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('size-4 animate-spin text-ink-400', className)} aria-label="Cargando" />;
}

export function Avatar({
  initials,
  className,
  tone = 'neutral',
  title,
}: {
  initials: string;
  className?: string;
  tone?: Tone;
  title?: string;
}) {
  const bg: Record<Tone, string> = {
    neutral: 'bg-ink-200 text-ink-700',
    brand: 'bg-ashir-100 text-ashir-700',
    ok: 'bg-ok-100 text-ok-700',
    warn: 'bg-warn-100 text-warn-700',
    bad: 'bg-bad-100 text-bad-700',
    tech: 'bg-tech-100 text-tech-700',
    plat: 'bg-plat-100 text-plat-700',
  };
  return (
    <span
      title={title}
      className={cn('inline-flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold', bg[tone], className)}
    >
      {initials}
    </span>
  );
}

/* ================================================================== */
/* Divider / Kbd                                                       */
/* ================================================================== */

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-ink-200 bg-ink-50 px-1.5 font-sans text-[11px] font-medium text-ink-500">
      {children}
    </kbd>
  );
}
