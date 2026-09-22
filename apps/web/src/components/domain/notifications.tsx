/**
 * Centro de notificaciones por rol.
 * Permite marcar como leída y navegar directo a la entidad.
 */
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BadgeDollarSign,
  Bell,
  CheckCheck,
  CircleAlert,
  FileText,
  Package,
  Plug,
  Star,
  Tag,
  TriangleAlert,
  Wrench,
} from 'lucide-react';
import type { Notification } from '@/types';
import { api } from '@/services';
import { useSession } from '@/app/session';
import { useAsync } from '@/app/hooks';
import { cn, fmtRelative } from '@/lib/utils';
import { EmptyState } from '@/components/ui/data';

const KIND_ICON: Record<Notification['kind'], typeof Bell> = {
  ORDER: FileText,
  SPECIAL_PRICE: Tag,
  RMA: Wrench,
  POINTS: Star,
  STOCK: Package,
  APPROVAL: CircleAlert,
  IMPORT: Package,
  INTEGRATION: Plug,
  PVP: BadgeDollarSign,
};

const SEVERITY_STYLE: Record<Notification['severity'], string> = {
  INFO: 'text-tech-600 bg-tech-50',
  SUCCESS: 'text-ok-600 bg-ok-50',
  WARNING: 'text-warn-600 bg-warn-50',
  CRITICAL: 'text-bad-600 bg-bad-50',
};

export function NotificationBell({ variant = 'dark' }: { variant?: 'dark' | 'light' }) {
  const { session } = useSession();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { data: notifications = [], refetch } = useAsync(() => api.notifications.list(session), [session.role, session.customerId]);

  const unread = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notificaciones${unread > 0 ? ` (${unread} sin leer)` : ''}`}
        aria-expanded={open}
        className={cn(
          'relative rounded-lg p-2 transition-colors',
          variant === 'dark' ? 'text-ink-300 hover:bg-ink-800 hover:text-white' : 'text-ink-500 hover:bg-ink-100 hover:text-ink-800',
        )}
      >
        <Bell className="size-4.5" aria-hidden />
        {unread > 0 && (
          <span className="absolute top-1 right-1 flex min-w-4 items-center justify-center rounded-full bg-ashir-500 px-1 text-[10px] leading-4 font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="animate-fade-up absolute right-0 z-70 mt-2 w-[min(400px,calc(100vw-2rem))] overflow-hidden rounded-xl border border-ink-200 bg-white shadow-pop">
          <div className="flex items-center justify-between gap-3 border-b border-ink-100 px-4 py-2.5">
            <p className="text-[13px] font-semibold text-ink-900">
              Notificaciones
              {unread > 0 && <span className="ml-1.5 text-ink-400">({unread} sin leer)</span>}
            </p>
            {unread > 0 && (
              <button
                type="button"
                onClick={async () => {
                  await api.notifications.markAllRead(session);
                  refetch();
                }}
                className="inline-flex items-center gap-1 text-xs font-medium text-ashir-600 hover:text-ashir-700"
              >
                <CheckCheck className="size-3.5" aria-hidden />
                Marcar todas
              </button>
            )}
          </div>

          <div className="max-h-[420px] overflow-y-auto">
            {notifications.length === 0 ? (
              <EmptyState
                compact
                title="Sin novedades"
                description="Cuando haya cambios en pedidos, garantías o precios los vas a ver acá."
                icon={<Bell className="size-5" />}
              />
            ) : (
              <ul className="divide-y divide-ink-100">
                {notifications.map((n) => {
                  const Icon = KIND_ICON[n.kind];
                  return (
                    <li key={n.id}>
                      <Link
                        to={n.href}
                        onClick={async () => {
                          setOpen(false);
                          if (!n.read) {
                            await api.notifications.markRead(n.id);
                            refetch();
                          }
                        }}
                        className={cn('flex gap-3 px-4 py-3 transition-colors hover:bg-ink-50', !n.read && 'bg-ashir-50/40')}
                      >
                        <span className={cn('mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg', SEVERITY_STYLE[n.severity])}>
                          {n.severity === 'CRITICAL' ? <TriangleAlert className="size-3.5" aria-hidden /> : <Icon className="size-3.5" aria-hidden />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-start justify-between gap-2">
                            <span className={cn('text-[13px] leading-snug', n.read ? 'font-medium text-ink-700' : 'font-semibold text-ink-900')}>
                              {n.title}
                            </span>
                            {!n.read && <span className="mt-1 size-1.5 shrink-0 rounded-full bg-ashir-500" aria-hidden />}
                          </span>
                          <span className="mt-0.5 block text-xs leading-relaxed text-ink-500">{n.body}</span>
                          <span className="mt-1 block text-[11px] text-ink-400">{fmtRelative(n.at)}</span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
