/**
 * Marca del portal.
 *
 * Es el logotipo institucional de Ashir Technology Corp, sin redibujar:
 * el isotipo y la tipografía se recortaron del archivo original para
 * poder armar la lockup horizontal que pide un header web. La lockup
 * vertical completa (`stacked`) se usa donde hay altura de sobra.
 *
 * Sobre fondo oscuro sólo cambia el color de la tipografía; el isotipo
 * y el naranja de marca son siempre los mismos.
 */
import { cn } from '@/lib/utils';

export function AshirLogo({
  className,
  tone = 'light',
  stacked = false,
}: {
  className?: string;
  /** `light` = pensado para fondos oscuros; `dark` = para fondos claros. */
  tone?: 'light' | 'dark';
  /** Lockup vertical completa, tal cual el archivo institucional. */
  stacked?: boolean;
  /** @deprecated el logotipo ya incluye la tipografía de la marca. */
  showSubtitle?: boolean;
}) {
  if (stacked) {
    return (
      <img
        src={tone === 'light' ? '/ashir-logo-dark.png' : '/ashir-logo.png'}
        alt="Ashir Technology Corp"
        width={259}
        height={276}
        className={cn('w-auto shrink-0 select-none object-contain', className)}
        draggable={false}
      />
    );
  }
  return (
    <span className={cn('inline-flex shrink-0 select-none items-center gap-2.5', className)}>
      <img
        src="/ashir-mark.png"
        alt="Ashir Technology Corp"
        width={254}
        height={221}
        className="h-full w-auto object-contain"
        draggable={false}
      />
      <img
        src={tone === 'light' ? '/ashir-wordmark-light.png' : '/ashir-wordmark.png'}
        alt=""
        aria-hidden
        width={255}
        height={45}
        className="h-[46%] w-auto object-contain"
        draggable={false}
      />
    </span>
  );
}
