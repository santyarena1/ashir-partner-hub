/**
 * Control de PVP (precio de venta al público).
 *
 * El PM fija un PVP por SKU y el sistema lo contrasta todos los días contra
 * lo que cada reseller publica en su propio sitio. Tres vistas:
 *
 *   Desvíos     — quién está vendiendo fuera del PVP y cuánto.
 *   Políticas   — el PVP de cada SKU, con el margen que le deja al reseller.
 *   Conexiones  — de dónde se lee el precio publicado de cada reseller.
 *
 * La lectura del feed es SIMULADA. El contrato de la conexión está definido
 * en `services/contracts.ts` para que el job real la reemplace sin tocar la UI.
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowDownRight,
  ArrowUpRight,
  BadgeDollarSign,
  ExternalLink,
  Pencil,
  Plug,
  RefreshCw,
  Search,
  ShieldAlert,
  Store,
  TriangleAlert,
} from 'lucide-react';
import type { ResellerFeed, RetailObservation, RetailPolicy } from '@/types';
import { api } from '@/services';
import { useSession } from '@/app/session';
import { useAction, useAsync } from '@/app/hooks';
import { can } from '@/lib/rbac';
import { cn, fmtDateTime, fmtMoney, fmtNumber, fmtRelative, num } from '@/lib/utils';
import { useToast, Dialog } from '@/components/ui/overlays';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Checkbox,
  Field,
  Input,
  Select,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/primitives';
import {
  Callout,
  type Column,
  DataTable,
  EmptyState,
  FilterBar,
  ForbiddenState,
  PageHeader,
  ResultCount,
  StatGrid,
  StatTile,
} from '@/components/ui/data';
import { Bars, ChartFrame } from '@/components/ui/charts';

const FEED_KIND_LABEL: Record<ResellerFeed['kind'], string> = {
  XML: 'Feed XML',
  GOOGLE_MERCHANT: 'Google Merchant',
  CSV: 'CSV programado',
  API: 'API del reseller',
  MANUAL: 'Sin conexión',
};

const FEED_STATUS: Record<ResellerFeed['status'], { label: string; tone: 'ok' | 'warn' | 'bad' | 'neutral' }> = {
  OK: { label: 'Leyendo', tone: 'ok' },
  WARNING: { label: 'Con observaciones', tone: 'warn' },
  ERROR: { label: 'No responde', tone: 'bad' },
  PENDING: { label: 'Sin configurar', tone: 'neutral' },
};

function DeviationBadge({ observation }: { observation: RetailObservation }) {
  if (observation.status === 'OK') return <Badge tone="ok" size="sm">En línea</Badge>;
  const below = observation.status === 'BELOW';
  return (
    <Badge tone={below ? (observation.enforced ? 'bad' : 'warn') : 'tech'} size="sm">
      {below ? 'Por debajo' : 'Por encima'} {observation.deviationPct > 0 ? '+' : ''}
      {observation.deviationPct.toFixed(1)}%
    </Badge>
  );
}

export function PmRetailPrice() {
  const { session } = useSession();
  const toast = useToast();
  const [tab, setTab] = useState('deviations');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'ALL' | RetailObservation['status']>('BELOW');
  const [editing, setEditing] = useState<RetailPolicy | null>(null);

  const summary = useAsync(() => api.retail.summary(session), [session]);
  const observations = useAsync(() => api.retail.observations({}, session), [session]);
  const policies = useAsync(() => api.retail.policies({}, session), [session]);
  const feeds = useAsync(() => api.retail.feeds(session), [session]);

  const canManage = can(session, 'pricing:manage');

  const filteredObservations = useMemo(() => {
    const rows = observations.data ?? [];
    const q = query.trim().toLowerCase();
    return rows
      .filter((o) => (status === 'ALL' ? true : o.status === status))
      .filter(
        (o) =>
          !q ||
          o.sku.toLowerCase().includes(q) ||
          o.productName.toLowerCase().includes(q) ||
          o.customerName.toLowerCase().includes(q),
      )
      .sort((a, b) => a.deviationPct - b.deviationPct);
  }, [observations.data, query, status]);

  if (!can(session, 'pricing:read')) return <ForbiddenState scope="pricing:read" />;

  const s = summary.data;

  const observationColumns: Column<RetailObservation>[] = [
    {
      key: 'reseller',
      header: 'Reseller',
      cell: (o) => (
        <div className="min-w-0">
          <Link to={`/bo/clientes/${o.customerId}`} className="truncate text-[13px] font-semibold text-ashir-600 hover:text-ashir-700">
            {o.customerName}
          </Link>
          <a
            href={o.url}
            onClick={(e) => e.preventDefault()}
            className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-ink-400"
            title="En la demo el enlace no navega: el sitio del reseller no existe."
          >
            <ExternalLink className="size-3 shrink-0" aria-hidden />
            <span className="truncate">{o.url.replace(/^https?:\/\//, '')}</span>
          </a>
        </div>
      ),
      sortable: true,
      sortValue: (o) => o.customerName,
    },
    {
      key: 'product',
      header: 'Producto',
      cell: (o) => (
        <div className="min-w-0">
          <Link to={`/catalogo/${o.sku}`} className="truncate text-[13px] text-ink-900 hover:text-ashir-700">
            {o.productName}
          </Link>
          <p className="mt-0.5 font-mono text-[11px] text-ink-400">
            {o.sku} · {o.brand}
          </p>
        </div>
      ),
      sortable: true,
      sortValue: (o) => o.productName,
    },
    {
      key: 'pvp',
      header: 'PVP',
      align: 'right',
      cell: (o) => <span className="tabular-nums text-ink-600">{fmtMoney(o.pvp)}</span>,
      sortable: true,
      sortValue: (o) => num(o.pvp),
    },
    {
      key: 'published',
      header: 'Publicado',
      align: 'right',
      cell: (o) => (
        <span
          className={cn(
            'font-semibold tabular-nums',
            o.status === 'BELOW' ? 'text-bad-600' : o.status === 'ABOVE' ? 'text-ink-900' : 'text-ok-600',
          )}
        >
          {fmtMoney(o.publishedPrice)}
        </span>
      ),
      sortable: true,
      sortValue: (o) => num(o.publishedPrice),
    },
    {
      key: 'deviation',
      header: 'Desvío',
      align: 'right',
      cell: (o) => (
        <div className="flex flex-col items-end gap-1">
          <DeviationBadge observation={o} />
          {o.enforced && o.status === 'BELOW' && (
            <span className="flex items-center gap-1 text-[11px] text-bad-600">
              <ShieldAlert className="size-3" aria-hidden />
              MAP acordado
            </span>
          )}
        </div>
      ),
      sortable: true,
      sortValue: (o) => o.deviationPct,
    },
    {
      key: 'ack',
      header: 'Aviso',
      align: 'right',
      hideOnMobile: true,
      cell: (o) =>
        o.status !== 'BELOW' ? (
          <span className="text-ink-300">—</span>
        ) : o.acknowledgedAt ? (
          <span className="text-[11px] text-ok-600">Visto {fmtRelative(o.acknowledgedAt)}</span>
        ) : (
          <span className="text-[11px] text-ink-400">Sin abrir</span>
        ),
    },
  ];

  const policyColumns: Column<RetailPolicy>[] = [
    {
      key: 'product',
      header: 'Producto',
      cell: (p) => (
        <div className="min-w-0">
          <Link to={`/catalogo/${p.sku}`} className="truncate text-[13px] font-semibold text-ink-900 hover:text-ashir-700">
            {p.productName}
          </Link>
          <p className="mt-0.5 font-mono text-[11px] text-ink-400">
            {p.sku} · {p.brand}
          </p>
        </div>
      ),
      sortable: true,
      sortValue: (p) => p.productName,
    },
    {
      key: 'pvp',
      header: 'PVP',
      align: 'right',
      cell: (p) => <span className="font-semibold tabular-nums text-ink-900">{fmtMoney(p.pvp)}</span>,
      sortable: true,
      sortValue: (p) => num(p.pvp),
    },
    {
      key: 'margin',
      header: 'Margen reseller',
      align: 'right',
      hideOnMobile: true,
      cell: (p) =>
        p.resellerMarginPct === null ? (
          <span className="text-ink-300">—</span>
        ) : (
          <span className="tabular-nums text-ink-600">{p.resellerMarginPct.toFixed(1)}%</span>
        ),
      sortable: true,
      sortValue: (p) => p.resellerMarginPct ?? 0,
    },
    {
      key: 'tolerance',
      header: 'Tolerancia',
      align: 'right',
      hideOnMobile: true,
      cell: (p) => <span className="tabular-nums text-ink-600">±{p.tolerancePct}%</span>,
    },
    {
      key: 'enforced',
      header: 'Régimen',
      cell: (p) =>
        p.enforced ? (
          <Badge tone="bad" size="sm">
            MAP
          </Badge>
        ) : (
          <Badge tone="neutral" size="sm">
            Sugerido
          </Badge>
        ),
    },
    {
      key: 'updated',
      header: 'Actualizado',
      align: 'right',
      hideOnMobile: true,
      cell: (p) => (
        <span className="text-[11px] text-ink-500">
          {fmtRelative(p.updatedAt)}
          <span className="block text-ink-400">{p.updatedBy}</span>
        </span>
      ),
      sortable: true,
      sortValue: (p) => new Date(p.updatedAt).getTime(),
    },
    {
      key: 'edit',
      header: '',
      align: 'right',
      cell: (p) =>
        canManage ? (
          <Button size="sm" variant="ghost" icon={<Pencil className="size-3.5" />} onClick={() => setEditing(p)}>
            Editar
          </Button>
        ) : null,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Control de PVP"
        subtitle="Precio de venta al público por SKU y cómo lo está respetando cada reseller."
        badge={
          s?.lastRunAt ? (
            <Badge tone="neutral" size="sm" title={fmtDateTime(s.lastRunAt)}>
              Última lectura {fmtRelative(s.lastRunAt)}
            </Badge>
          ) : undefined
        }
      />

      <Callout tone="tech" icon={<Plug className="size-4" />} className="mb-5">
        Los precios publicados se leen una vez por día del feed que informa cada reseller (XML, Google Merchant, CSV o
        API). En esta demo la lectura está simulada; el contrato de la conexión ya está definido para que el job real
        la reemplace sin tocar las pantallas.
      </Callout>

      <StatGrid cols={4} className="mb-5">
        <StatTile
          label="SKUs con PVP definido"
          value={summary.initialLoading ? <Skeleton className="h-7 w-16" /> : fmtNumber(s?.policies ?? 0)}
          icon={<BadgeDollarSign className="size-4" />}
        />
        <StatTile
          label="Publicaciones leídas"
          value={summary.initialLoading ? <Skeleton className="h-7 w-16" /> : fmtNumber(s?.observations ?? 0)}
          hint={`${s?.monitoredResellers ?? 0} resellers`}
          icon={<Store className="size-4" />}
        />
        <StatTile
          label="Por debajo del PVP"
          value={summary.initialLoading ? <Skeleton className="h-7 w-16" /> : fmtNumber(s?.below ?? 0)}
          tone={(s?.below ?? 0) > 0 ? 'bad' : 'ok'}
          hint={`en ${s?.resellersBelow ?? 0} resellers`}
          icon={<ArrowDownRight className="size-4" />}
        />
        <StatTile
          label="Por encima del PVP"
          value={summary.initialLoading ? <Skeleton className="h-7 w-16" /> : fmtNumber(s?.above ?? 0)}
          hint="Lista desactualizada"
          icon={<ArrowUpRight className="size-4" />}
        />
      </StatGrid>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="deviations">Desvíos</TabsTrigger>
          <TabsTrigger value="policies">Políticas de PVP</TabsTrigger>
          <TabsTrigger value="feeds">Conexiones</TabsTrigger>
        </TabsList>

        {/* ---------------- desvíos ---------------- */}
        <TabsContent value="deviations">
          {(s?.byBrand.length ?? 0) > 1 && (
            <ChartFrame
              title="Incumplimientos por marca"
              subtitle="Publicaciones por debajo del PVP en la última lectura"
              height={200}
              className="mb-4"
            >
              <Bars
                data={(s?.byBrand ?? []).slice(0, 8)}
                xKey="brand"
                yKey="below"
                horizontal
                formatter={(v) => `${fmtNumber(v)} publicaciones`}
              />
            </ChartFrame>
          )}

          <FilterBar className="mb-3">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por SKU, producto o reseller"
              leading={<Search className="size-4" />}
              className="w-full sm:w-80"
            />
            <Select value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
              <option value="BELOW">Sólo por debajo</option>
              <option value="ABOVE">Sólo por encima</option>
              <option value="OK">En línea</option>
              <option value="ALL">Todas</option>
            </Select>
            <ResultCount
              shown={filteredObservations.length}
              total={observations.data?.length ?? 0}
              noun="publicaciones"
            />
          </FilterBar>

          <Card className="p-0">
            <DataTable
              columns={observationColumns}
              rows={filteredObservations}
              rowKey={(o) => o.id}
              loading={observations.initialLoading}
              empty={
                <EmptyState
                  title="Ningún reseller está fuera del PVP"
                  description="Con el filtro actual no hay desvíos para revisar."
                />
              }
            />
          </Card>
        </TabsContent>

        {/* ---------------- políticas ---------------- */}
        <TabsContent value="policies">
          <Callout tone="neutral" className="mb-3">
            El <strong>PVP</strong> es el precio sugerido de venta al público. Cuando está marcado como{' '}
            <strong>MAP</strong> funciona como precio mínimo anunciado: publicar por debajo incumple el acuerdo con la
            marca, no es sólo una sugerencia ignorada.
          </Callout>
          <Card className="p-0">
            <DataTable
              columns={policyColumns}
              rows={policies.data ?? []}
              rowKey={(p) => p.id}
              loading={policies.initialLoading}
              empty={<EmptyState title="Todavía no hay PVP definido para tus marcas" />}
            />
          </Card>
        </TabsContent>

        {/* ---------------- conexiones ---------------- */}
        <TabsContent value="feeds">
          {feeds.initialLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {(feeds.data ?? []).map((feed) => (
                <FeedCard key={feed.id} feed={feed} onRefreshed={() => feeds.refetch()} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {editing && (
        <PolicyDialog
          policy={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            policies.refetch();
            observations.refetch();
            summary.refetch();
            toast.success('PVP actualizado', 'Los desvíos se recalcularon contra el nuevo precio.');
          }}
        />
      )}
    </div>
  );
}

/* ================================================================== */

function FeedCard({ feed, onRefreshed }: { feed: ResellerFeed; onRefreshed: () => void }) {
  const { session } = useSession();
  const toast = useToast();
  const run = useAction(() => api.retail.runFeed(feed.customerId, session));
  const spec = FEED_STATUS[feed.status];

  return (
    <Card>
      <CardHeader
        title={
          <Link to={`/bo/clientes/${feed.customerId}`} className="hover:text-ashir-700">
            {feed.customerName}
          </Link>
        }
        subtitle={FEED_KIND_LABEL[feed.kind]}
        action={
          <Badge tone={spec.tone} dot size="sm">
            {spec.label}
          </Badge>
        }
      />
      <div className="space-y-2 px-5 pb-4">
        <p className="truncate font-mono text-[11px] text-ink-500" title={feed.url || 'Sin URL'}>
          {feed.url || '— sin URL configurada —'}
        </p>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-ink-50 py-2">
            <p className="text-[11px] text-ink-500">Ítems</p>
            <p className="text-[13px] font-semibold tabular-nums text-ink-900">{fmtNumber(feed.itemsFound)}</p>
          </div>
          <div className="rounded-lg bg-ink-50 py-2">
            <p className="text-[11px] text-ink-500">Matcheados</p>
            <p className="text-[13px] font-semibold tabular-nums text-ink-900">{fmtNumber(feed.matchedSkus)}</p>
          </div>
          <div className="rounded-lg bg-ink-50 py-2">
            <p className="text-[11px] text-ink-500">Match por</p>
            <p className="text-[13px] font-semibold text-ink-900">{feed.matchBy}</p>
          </div>
        </div>
        {feed.message && (
          <Callout tone={feed.status === 'ERROR' ? 'bad' : 'warn'} icon={<TriangleAlert className="size-4" />}>
            {feed.message}
          </Callout>
        )}
        <div className="flex items-center justify-between gap-2 pt-1">
          <span className="text-[11px] text-ink-400">
            {feed.lastRunAt ? `Última lectura ${fmtRelative(feed.lastRunAt)}` : 'Nunca se leyó'}
          </span>
          <Button
            size="sm"
            variant="outline"
            icon={<RefreshCw className="size-3.5" />}
            loading={run.pending}
            onClick={async () => {
              const result = await run.run();
              if (result) {
                toast.success('Feed leído', `Se actualizaron los precios publicados de ${feed.customerName}.`);
                onRefreshed();
              } else if (run.error) {
                toast.error('No se pudo leer el feed', run.error.message);
              }
            }}
          >
            Leer ahora
          </Button>
        </div>
      </div>
    </Card>
  );
}

/* ================================================================== */

function PolicyDialog({
  policy,
  onClose,
  onSaved,
}: {
  policy: RetailPolicy;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { session } = useSession();
  const toast = useToast();
  const [pvp, setPvp] = useState(policy.pvp.amount);
  const [tolerance, setTolerance] = useState(String(policy.tolerancePct));
  const [enforced, setEnforced] = useState(policy.enforced);

  const save = useAction(() =>
    api.retail.upsertPolicy(
      {
        productId: policy.productId,
        pvp,
        tolerancePct: Number.parseFloat(tolerance) || 0,
        enforced,
      },
      session,
    ),
  );

  return (
    <Dialog
      open
      onClose={onClose}
      title={`PVP de ${policy.sku}`}
      description={policy.productName}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            loading={save.pending}
            onClick={async () => {
              const result = await save.run();
              if (result) onSaved();
              else if (save.error) toast.error('No se pudo guardar el PVP', save.error.message);
            }}
          >
            Guardar
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Precio de venta al público" hint="IVA incluido, en USD, igual que el resto del catálogo.">
          <Input value={pvp} onChange={(e) => setPvp(e.target.value)} inputMode="decimal" />
        </Field>
        <Field
          label="Tolerancia"
          hint="Cuánto puede alejarse un reseller antes de que cuente como desvío."
        >
          <Input value={tolerance} onChange={(e) => setTolerance(e.target.value)} inputMode="decimal" trailing={<span className="text-[12px]">%</span>} />
        </Field>
        <Checkbox
          checked={enforced}
          onChange={(e) => setEnforced(e.target.checked)}
          label="Precio mínimo anunciado (MAP)"
          description="Publicar por debajo pasa a ser un incumplimiento del acuerdo, no una sugerencia."
        />
        {save.error && (
          <Callout tone="bad" icon={<TriangleAlert className="size-4" />}>
            {save.error.message}
          </Callout>
        )}
      </div>
    </Dialog>
  );
}
