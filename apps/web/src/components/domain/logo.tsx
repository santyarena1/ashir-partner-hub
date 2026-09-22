/**
 * Marca del portal.
 *
 * No se reutiliza el logotipo institucional de Ashir: se compone una
 * lockup tipográfica propia con el naranja de la marca, adecuada para
 * un prototipo de presentación.
 */
import { cn } from '@/lib/utils';

export function AshirLogo({
  className,
  tone = 'light',
  showSubtitle = true,
}: {
  className?: string;
  tone?: 'light' | 'dark';
  showSubtitle?: boolean;
}) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <svg viewBox="0 0 32 32" className="h-full w-auto shrink-0" aria-hidden>
        <rect width="32" height="32" rx="7" fill="#fb5a11" />
        <path d="M10 22.5 16 9l6 13.5h-3.3L16 16.2l-2.7 6.3H10Z" fill="#fff" />
        <rect x="12.6" y="18.6" width="6.8" height="1.9" rx="0.9" fill="#fff" opacity=".65" />
      </svg>
      <span className="flex min-w-0 flex-col justify-center leading-none">
        <span
          className={cn(
            'text-[15px] font-extrabold tracking-tight',
            tone === 'light' ? 'text-white' : 'text-ink-900',
          )}
        >
          ASHIR
        </span>
        {showSubtitle && (
          <span
            className={cn(
              'mt-0.5 text-[9px] font-semibold tracking-[0.14em] uppercase',
              tone === 'light' ? 'text-ashir-400' : 'text-ashir-600',
            )}
          >
            Partner Hub
          </span>
        )}
      </span>
    </span>
  );
}
