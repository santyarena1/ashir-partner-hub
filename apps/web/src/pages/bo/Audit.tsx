/**
 * Auditoría transversal: un solo lugar donde ver quién hizo qué,
 * sobre qué entidad, desde dónde y con qué request id.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList, Search, ShieldCheck } from 'lucide-react';
import type { AuditEvent, Role } from '@/types';
import { api } from '@/services';
import { useSession } from '@/app/session';
import { useAsync, useDebounced } from '@/app/hooks';
import { can } from '@/lib/rbac';
import { ROLE_LABEL } from '@/lib/labels';
import { cn, fmtDateTime, normalize } from '@/lib/utils';
import { Badge, Card, CardHeader, Input, Select } from '@/components/ui/primitives';
import {
  Callout,
  DataTable,
  EmptyState,
  ForbiddenState,
  Mono,
  PageHeader,
  StatGrid,
  StatTile,
  type Column,
} from '@/components/ui/data';

interface AuditRow extends AuditEvent {
  href: string;
  entityLabel: string;
}

export function BoAudit() {
  const { session } = useSession();
  const [term, setTerm] = useState('');
  const debounced = useDebounced(term);
  const [entityFilter, setEntityFilter] = useState('');
  const [originFilter, setOriginFilter] = useState('');

  const orders = useAsync(() => api.orders.list({}, session), [session.role]);
  const rmas = useAsync(() => api.rma.listCases({}, session), [session.role]);
  const requests = useAsync(() => api.specialPrice.list({}, session), [session.role]);

  if (!can(session, 'audit:read')) {
    return (
      <Card>
        <ForbiddenState scope="audit:read" />
      </Card>
    );
  }

  /* --- se unifican los logs de las tres entidades auditadas --- */
  const rows: AuditRow[] = [
    ...(orders.data ?? []).flatMap((o) =>
      o.auditLog.map((event) => ({ ...event, href: `/bo/pedidos/${o.id}`, entityLabel: `Pedido ${o.number}` })),
    ),
    ...(rmas.data ?? []).flatMap((r) =>
      r.auditLog.map((event) => ({ ...event, href: `/bo/rma/${r.id}`, entityLabel: `RMA ${r.code}` })),
    ),
    ...(requests.data ?? []).flatMap((s) =>
      s.auditLog.map((event) => ({ ...event, href: `/bo/solicitudes/${s.id}`, entityLabel: `Solicitud ${s.code}` })),
    ),
  ]
    .filter((row) => {
      if (entityFilter && row.entity !== entityFilter) return false;
      if (originFilter && row.origin !== originFilter) return false;
      if (debounced) {
        const q = normalize(debounced);
        return (
          normalize(row.actor).includes(q) ||
          normalize(row.action).includes(q) ||
          normalize(row.entityId).includes(q) ||
          normalize(row.requestId).includes(q)
        );
      }
      return true;
    })
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 300);

  const columns: Column<AuditRow>[] = [
    {
      key: 'at',
      header: 'Fecha y hora',
      cell: (row) => <span className="text-xs tabular-nums text-ink-600">{fmtDateTime(row.at)}</span>,
      sortable: true,
      sortValue: (r) => new Date(r.at).getTime(),
    },
    {
      key: 'actor',
      header: 'Actor',
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium text-ink-900">{row.actor}</p>
          <p className="text-[11px] text-ink-400">
            {row.actorRole === 'SYSTEM' ? 'Sistema' : ROLE_LABEL[row.actorRole as Role] ?? row.actorRole}
          </p>
        </div>
      ),
      sortable: true,
      sortValue: (r) => r.actor,
    },
    { key: 'action', header: 'Acción', cell: (row) => <span className="text-[13px] text-ink-800">{row.action}</span> },
    {
      key: 'entity',
      header: 'Entidad',
      cell: (row) => (
        <Link to={row.href} className="text-[13px] font-medium text-ashir-600 hover:text-ashir-700">
          {row.entityLabel}
        </Link>
      ),
    },
    {
      key: 'change',
      header: 'Cambio',
      hideOnMobile: true,
      cell: (row) =>
        row.previousValue || row.newValue ? (
          <span className="font-mono text-[11px] text-ink-600">
            {row.previousValue ?? '—'} <span className="text-ink-300">→</span>{' '}
            <span className="font-semibold text-ink-800">{row.newValue ?? '—'}</span>
          </span>
        ) : (
          <span className="text-ink-400">—</span>
        ),
    },
    {
      key: 'origin',
      header: 'Origen',
      cell: (row) => (
        <Badge
          tone={row.origin === 'PORTAL' ? 'tech' : row.origin === 'ERP' ? 'warn' : row.origin === 'API' ? 'brand' : 'neutral'}
          size="sm"
        >
          {row.origin}
        </Badge>
      ),
    },
    {
      key: 'request',
      header: 'Request ID',
      align: 'right',
      hideOnMobile: true,
      cell: (row) => <Mono>{row.requestId}</Mono>,
    },
  ];

  const byOrigin = ['PORTAL', 'API', 'ERP', 'IMPORT', 'SYSTEM'].map((origin) => ({
    origin,
    count: rows.filter((r) => r.origin === origin).length,
  }));

  return (
    <div>
      <PageHeader
        title="Auditoría"
        subtitle="Registro transversal de acciones sobre pedidos, garantías y solicitudes de precio. Cada evento conserva el estado anterior y el nuevo."
      />

      <Callout tone="tech" className="mb-6" title="Patrón común de auditoría" icon={<ShieldCheck className="size-4" />}>
        Todo evento auditado incluye: id del evento, fecha y hora, usuario, rol, acción, entidad, estado anterior y
        nuevo cuando corresponde, origen (portal, API, ERP, importación) y request id para trazabilidad punta a punta.
      </Callout>

      <StatGrid cols={5} className="mb-6">
        <StatTile label="Eventos registrados" value={rows.length} icon={<ClipboardList className="size-4" />} />
        {byOrigin.slice(0, 4).map((item) => (
          <StatTile key={item.origin} label={`Origen ${item.origin}`} value={item.count} />
        ))}
      </StatGrid>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Buscar por actor, acción, entidad o request id…"
          leading={<Search className="size-4" />}
          className="max-w-sm"
        />
        <Select value={entityFilter} onChange={(e) => setEntityFilter(e.target.value)} className="w-auto min-w-[180px]" aria-label="Entidad">
          <option value="">Todas las entidades</option>
          <option value="Order">Pedidos</option>
          <option value="RmaCase">Casos de RMA</option>
          <option value="SpecialPriceRequest">Solicitudes de precio</option>
        </Select>
        <Select value={originFilter} onChange={(e) => setOriginFilter(e.target.value)} className="w-auto min-w-[150px]" aria-label="Origen">
          <option value="">Todos los orígenes</option>
          <option value="PORTAL">Portal</option>
          <option value="API">API</option>
          <option value="ERP">ERP</option>
          <option value="IMPORT">Importación</option>
          <option value="SYSTEM">Sistema</option>
        </Select>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id + r.at}
        loading={orders.initialLoading || rmas.initialLoading}
        dense
        empty={
          <EmptyState
            title="Sin eventos con estos filtros"
            description="Probá quitando el filtro de entidad o de origen."
            icon={<ClipboardList className="size-5" />}
          />
        }
        mobileCard={(row) => (
          <div>
            <p className="text-[13px] font-medium text-ink-900">{row.action}</p>
            <p className="mt-0.5 text-xs text-ink-500">
              {row.actor} · {fmtDateTime(row.at)}
            </p>
            <Link to={row.href} className="mt-1 block text-xs font-medium text-ashir-600">
              {row.entityLabel}
            </Link>
          </div>
        )}
      />

      <Card className="mt-6">
        <CardHeader title="Dónde más se registra auditoría" />
        <ul className="grid gap-px bg-ink-100 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ['Pedidos', 'Creación, cambios de cantidad, aprobaciones, cambios de estado y cancelaciones.', '/bo/pedidos'],
            ['Casos de RMA', 'Validación, recepción, diagnóstico, escalamiento y resolución.', '/bo/rma'],
            ['Solicitudes de precio', 'Elevación, aprobación, contraoferta y rechazo con margen resultante.', '/bo/solicitudes'],
            ['Condiciones comerciales', 'Alta, activación, pausa y cambios de vigencia.', '/bo/condiciones'],
            ['Importaciones', 'Archivo, mapeo, validación y aplicación de cada carga.', '/bo/importaciones'],
            ['Integraciones', 'Ejecuciones, errores y reintentos de cada conector.', '/bo/integraciones'],
          ].map(([title, detail, href]) => (
            <li key={title} className="bg-white p-4">
              <Link to={href!} className="text-[13px] font-semibold text-ashir-600 hover:text-ashir-700">
                {title}
              </Link>
              <p className={cn('mt-1 text-xs leading-relaxed text-ink-500')}>{detail}</p>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
