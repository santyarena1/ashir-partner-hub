/**
 * Command palette (Ctrl/Cmd + K).
 *
 * Busca SKU, producto, marca, categoría, pedido, cliente, serial y RMA,
 * ofrece acciones rápidas por rol y recuerda las búsquedas recientes.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Clock,
  CornerDownLeft,
  FileText,
  Package,
  Plug,
  Search,
  ShoppingCart,
  Sparkles,
  Tag,
  Users,
  Wrench,
} from 'lucide-react';
import type { Role } from '@/types';
import { api } from '@/services';
import { useSession } from '@/app/session';
import { useDebounced, usePersistentState } from '@/app/hooks';
import { cn } from '@/lib/utils';
import { Kbd, Spinner } from '@/components/ui/primitives';

interface PaletteItem {
  id: string;
  group: string;
  label: string;
  sublabel?: string;
  href: string;
  icon: typeof Search;
}

const QUICK_ACTIONS: Record<Role, PaletteItem[]> = {
  CLIENT: [
    { id: 'qa-catalog', group: 'Ir a', label: 'Catálogo', href: '/catalogo', icon: Package },
    { id: 'qa-quick', group: 'Ir a', label: 'Compra rápida (Quick Order)', href: '/quick-order', icon: Sparkles },
    { id: 'qa-cart', group: 'Ir a', label: 'Pedido en armado', href: '/carrito', icon: ShoppingCart },
    { id: 'qa-orders', group: 'Ir a', label: 'Mis pedidos', href: '/pedidos', icon: FileText },
    { id: 'qa-rma', group: 'Ir a', label: 'Consultar garantía por serial', href: '/rma/consulta', icon: Wrench },
    { id: 'qa-benefits', group: 'Ir a', label: 'Ashir Partner · beneficios', href: '/beneficios', icon: Tag },
  ],
  SALES: [
    { id: 'qa-bo', group: 'Ir a', label: 'Tablero comercial', href: '/bo', icon: Sparkles },
    { id: 'qa-customers', group: 'Ir a', label: 'Clientes', href: '/bo/clientes', icon: Users },
    { id: 'qa-orders', group: 'Ir a', label: 'Pedidos', href: '/bo/pedidos', icon: FileText },
    { id: 'qa-req', group: 'Ir a', label: 'Solicitudes de precio especial', href: '/bo/solicitudes', icon: Tag },
  ],
  PM: [
    { id: 'qa-pm', group: 'Ir a', label: 'PM Cockpit', href: '/bo/pm', icon: Sparkles },
    { id: 'qa-sim', group: 'Ir a', label: 'Simulador comercial', href: '/bo/pm/simulador', icon: Tag },
    { id: 'qa-quality', group: 'Ir a', label: 'Calidad / RMA por marca', href: '/bo/rma/analytics', icon: Wrench },
    { id: 'qa-cond', group: 'Ir a', label: 'Condiciones comerciales', href: '/bo/condiciones', icon: Tag },
  ],
  RMA: [
    { id: 'qa-rma-center', group: 'Ir a', label: 'Centro de RMA', href: '/bo/rma', icon: Wrench },
    { id: 'qa-reception', group: 'Ir a', label: 'Recepción de mercadería', href: '/bo/rma/recepcion', icon: Package },
    { id: 'qa-analytics', group: 'Ir a', label: 'Analytics de calidad', href: '/bo/rma/analytics', icon: Sparkles },
  ],
  ADMIN: [
    { id: 'qa-bo', group: 'Ir a', label: 'Tablero general', href: '/bo', icon: Sparkles },
    { id: 'qa-orders', group: 'Ir a', label: 'Pedidos', href: '/bo/pedidos', icon: FileText },
    { id: 'qa-cond', group: 'Ir a', label: 'Condiciones comerciales', href: '/bo/condiciones', icon: Tag },
    { id: 'qa-int', group: 'Ir a', label: 'Integraciones', href: '/bo/integraciones', icon: Plug },
    { id: 'qa-imports', group: 'Ir a', label: 'Importaciones de productos', href: '/bo/importaciones', icon: Package },
    { id: 'qa-docs', group: 'Ir a', label: 'Documentación API', href: '/docs', icon: FileText },
    { id: 'qa-demo', group: 'Ir a', label: 'Recorrido de demo', href: '/bo/demo', icon: Sparkles },
  ],
};

const GROUP_ICON: Record<string, typeof Search> = {
  SKU: Package,
  Serial: Wrench,
  RMA: Wrench,
  Pedido: FileText,
  Cliente: Users,
};

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { session, role } = useSession();
  const navigate = useNavigate();
  const [term, setTerm] = useState('');
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<PaletteItem[]>([]);
  const [recent, setRecent] = usePersistentState<string[]>('ashir-partner-hub:recent-search:v1', []);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounced = useDebounced(term, 220);

  useEffect(() => {
    if (open) {
      setTerm('');
      setActive(0);
      setResults([]);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !debounced.trim()) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setLoading(true);

    Promise.all([api.catalog.suggestions(debounced, session), api.rma.universalSearch(debounced, session)])
      .then(([suggestions, universal]) => {
        if (cancelled) return;
        const fromSuggestions: PaletteItem[] = suggestions.map((s, i) => ({
          id: `sug_${i}_${s.id}`,
          group: s.type === 'sku' ? 'SKU' : s.type === 'brand' ? 'Marcas' : s.type === 'category' ? 'Categorías' : 'Productos',
          label: s.label,
          sublabel: s.sublabel,
          href: s.href,
          icon: s.type === 'brand' || s.type === 'category' ? Tag : Package,
        }));
        const fromUniversal: PaletteItem[] = universal.map((u, i) => ({
          id: `uni_${i}_${u.href}`,
          group: u.kind,
          label: u.label,
          sublabel: u.sublabel,
          href: u.href,
          icon: GROUP_ICON[u.kind] ?? Search,
        }));
        const seen = new Set<string>();
        setResults(
          [...fromUniversal, ...fromSuggestions].filter((item) => {
            if (seen.has(item.href)) return false;
            seen.add(item.href);
            return true;
          }),
        );
        setActive(0);
      })
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [debounced, open, session]);

  const items = useMemo(() => {
    if (term.trim()) return results;
    const quick = QUICK_ACTIONS[role];
    const recentItems: PaletteItem[] = recent.slice(0, 4).map((r, i) => ({
      id: `recent_${i}`,
      group: 'Búsquedas recientes',
      label: r,
      href: '',
      icon: Clock,
    }));
    return [...recentItems, ...quick];
  }, [term, results, role, recent]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActive((a) => Math.min(a + 1, items.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActive((a) => Math.max(a - 1, 0));
      } else if (e.key === 'Enter') {
        const item = items[active];
        if (!item) return;
        e.preventDefault();
        if (!item.href) {
          setTerm(item.label);
          return;
        }
        if (term.trim()) setRecent([term.trim(), ...recent.filter((r) => r !== term.trim())].slice(0, 6));
        navigate(item.href);
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, items, active, navigate, onClose, term, recent, setRecent]);

  if (!open) return null;

  let lastGroup = '';

  return createPortal(
    <div className="fixed inset-0 z-150 flex items-start justify-center pt-[12vh]">
      <div className="animate-fade-in absolute inset-0 bg-ink-950/50 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Buscador"
        className="animate-fade-up relative flex max-h-[68vh] w-[min(620px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl bg-white shadow-pop"
      >
        <div className="flex items-center gap-3 border-b border-ink-100 px-4 py-3">
          <Search className="size-4.5 shrink-0 text-ink-400" aria-hidden />
          <input
            ref={inputRef}
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Buscar SKU, producto, marca, pedido, cliente, serial o RMA…"
            className="min-w-0 flex-1 bg-transparent text-sm text-ink-900 placeholder:text-ink-400 focus:outline-none"
            aria-label="Término de búsqueda"
          />
          {loading && <Spinner />}
          <Kbd>ESC</Kbd>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
          {items.length === 0 ? (
            <p className="px-3 py-8 text-center text-[13px] text-ink-500">
              Sin resultados para «{term}». Probá con un SKU, un número de pedido o un serial.
            </p>
          ) : (
            <ul>
              {items.map((item, i) => {
                const showGroup = item.group !== lastGroup;
                lastGroup = item.group;
                const Icon = item.icon;
                return (
                  <li key={item.id}>
                    {showGroup && (
                      <p className="px-2.5 pt-2.5 pb-1 text-[11px] font-semibold tracking-wide text-ink-400 uppercase">
                        {item.group}
                      </p>
                    )}
                    <button
                      type="button"
                      onMouseEnter={() => setActive(i)}
                      onClick={() => {
                        if (!item.href) {
                          setTerm(item.label);
                          return;
                        }
                        if (term.trim()) setRecent([term.trim(), ...recent.filter((r) => r !== term.trim())].slice(0, 6));
                        navigate(item.href);
                        onClose();
                      }}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors',
                        i === active ? 'bg-ashir-50' : 'hover:bg-ink-50',
                      )}
                    >
                      <Icon className={cn('size-4 shrink-0', i === active ? 'text-ashir-600' : 'text-ink-400')} aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium text-ink-900">{item.label}</span>
                        {item.sublabel && <span className="block truncate text-xs text-ink-500">{item.sublabel}</span>}
                      </span>
                      {i === active && <CornerDownLeft className="size-3.5 shrink-0 text-ashir-500" aria-hidden />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-ink-100 bg-ink-50 px-4 py-2 text-[11px] text-ink-500">
          <span className="flex items-center gap-1.5">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd> navegar
            <Kbd>↵</Kbd> abrir
          </span>
          <span className="flex items-center gap-1">
            Búsqueda universal
            <ArrowRight className="size-3" aria-hidden />
            serial, RMA, pedido, factura, cliente, SKU
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Registra el atajo global Ctrl/Cmd + K. */
export function useCommandPalette() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  return { open, setOpen };
}
