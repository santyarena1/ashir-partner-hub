/**
 * Control de PVP del lado del reseller.
 *
 * Le muestra lo mismo que ve el Product Manager, pero sólo de su propia
 * cuenta: qué publicó en su sitio, cuál es el PVP sugerido de cada SKU y
 * dónde está fuera de rango. Nunca ve los precios de otro reseller.
 *
 * La conexión con el sitio la configura el propio reseller: un feed XML,
 * Google Merchant, un CSV o su API. La lectura corre una vez por día.
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowDownRight,
  ArrowUpRight,
  CheckCheck,
  ExternalLink,
  Plug,
  RefreshCw,
  Search,
  ShieldAlert,
  TriangleAlert,
} from 'lucide-react';
import type { ResellerFeed, RetailObservation } from '@/types';
import { api } from '@/services';
import { useSession } from '@/app/session';
import { useAction, useAsync } from '@/app/hooks';
import { cn, fmtDateTime, fmtMoney, fmtNumber, fmtRelative, num } from '@/lib/utils';
import { useToast } from '@/components/ui/overlays';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Field,
  Input,
  Select,
  Skeleton,
} from '@/components/ui/primitives';
import {
  Callout,
  type Column,
  DataTable,
  EmptyState,
  FilterBar,
  PageHeader,
  ResultCount,
  StatGrid,
  StatTile,
} from '@/components/ui/data';

const FEED_KIND_LABEL: Record<ResellerFeed['kind'], string> = {
  XML: 'Feed XML de productos',
  GOOGLE_MERCHANT: 'Google Merchant Center',
  CSV: 'CSV publicado por URL',
  API: 'API de tu tienda',
  MANUAL: 'Sin conexión',
};

export function ClientRetailPrice() {
  const { session } = useSession();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'ALL' | RetailObservation['status']>('ALL');

  const observations = useAsync(() => api.retail.observations({}, session), [session]);
  const feed = useAsync(
    () => (session.customerId ? api.retail.feedForCustomer(session.customerId, session) : Promise.resolve(null)),
    [session],
  );

  const rows = observations.data ?? [];
  const below = rows.filter((o) => o.status === 'BELOW');
  const above = rows.filter((o) => o.status === 'ABOVE');
  const pendingAck = below.filter((o) => !o.acknowledgedAt);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .filter((o) => (status === 'ALL' ? true : o.status === status))
      .filter((o) => !q || o.sku.toLowerCase().includes(q) || o.productName.toLowerCase().includes(q))
      .sort((a, b) => a.deviationPct - b.deviationPct);
  }, [rows, query, status]);

  const acknowledge = useAction((id: string) => api.retail.acknowledge(id, session));

  if (!session.customerId) {
    return <EmptyState title="Elegí una cuenta de reseller para ver tu control de PVP" />;
  }

  const columns: Column<RetailObservation>[] = [
    {
      key: 'product',
      header: 'Producto',
      cell: (o) => (
        <div className="min-w-0">
          <Link to={`/catalogo/${o.sku}`} className="truncate text-[13px] font-semibold text-ink-900 hover:text-ashir-700">
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
      header: 'PVP sugerido',
      align: 'right',
      cell: (o) => (
        <div className="flex flex-col items-end">
          <span className="tabular-nums text-ink-700">{fmtMoney(o.pvp)}</span>
          {o.enforced && (
            <span className="flex items-center gap-1 text-[11px] text-ink-400">
              <ShieldAlert className="size-3" aria-hidden />
              MAP
            </span>
          )}
        </div>
      ),
      sortable: true,
      sortValue: (o) => num(o.pvp),
    },
    {
      key: 'published',
      header: 'Tu precio publicado',
      align: 'right',
      cell: (o) => (
        <span
          className={cn(
            'font-semibold tabular-nums',
            o.status === 'BELOW' ? 'text-bad-600' : o.status === 'ABOVE' ? 'text-warn-600' : 'text-ok-600',
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
      header: 'Diferencia',
      align: 'right',
      cell: (o) =>
        o.status === 'OK' ? (
          <Badge tone="ok" size="sm">
            En línea
          </Badge>
        ) : (
          <Badge tone={o.status === 'BELOW' ? (o.enforced ? 'bad' : 'warn') : 'tech'} size="sm">
            {o.deviationPct > 0 ? '+' : ''}
            {o.deviationPct.toFixed(1)}%
          </Badge>
        ),
      sortable: true,
      sortValue: (o) => o.deviationPct,
    },
    {
      key: 'action',
      header: '',
      align: 'right',
      cell: (o) =>
        o.status !== 'BELOW' ? null : o.acknowledgedAt ? (
          <span className="text-[11px] text-ok-600">Visto {fmtRelative(o.acknowledgedAt)}</span>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            icon={<CheckCheck className="size-3.5" />}
            onClick={async () => {
              const result = await acknowledge.run(o.id);
              if (result) {
                observations.refetch();
                toast.success('Aviso marcado como visto', `Quedó registrado para ${o.sku}.`);
              }
            }}
          >
            Marcar visto
          </Button>
        ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Control de PVP"
        subtitle="Cómo se compara lo que publicás en tu sitio contra el precio sugerido de venta al público."
        badge={
          feed.data?.lastRunAt ? (
            <Badge tone="neutral" size="sm" title={fmtDateTime(feed.data.lastRunAt)}>
              Última lectura {fmtRelative(feed.data.lastRunAt)}
            </Badge>
          ) : undefined
        }
      />

      {pendingAck.length > 0 && (
        <Callout
          tone="warn"
          icon={<TriangleAlert className="size-4" />}
          title={`${pendingAck.length} publicación(es) por debajo del PVP`}
          className="mb-5"
        >
          El PVP es el precio sugerido por la marca. En los productos marcados como <strong>MAP</strong> publicar por
          debajo incumple el acuerdo comercial y puede afectar tus condiciones. Revisá el detalle y corregí en tu sitio,
          o hablá con tu ejecutivo si hay un motivo.
        </Callout>
      )}

      <StatGrid cols={4} className="mb-5">
        <StatTile
          label="Productos monitoreados"
          value={observations.initialLoading ? <Skeleton className="h-7 w-14" /> : fmtNumber(rows.length)}
          hint="De tu feed, matcheados contra el catálogo"
        />
        <StatTile
          label="En línea con el PVP"
          value={observations.initialLoading ? <Skeleton className="h-7 w-14" /> : fmtNumber(rows.length - below.length - above.length)}
          tone="ok"
        />
        <StatTile
          label="Por debajo del PVP"
          value={observations.initialLoading ? <Skeleton className="h-7 w-14" /> : fmtNumber(below.length)}
          tone={below.length > 0 ? 'bad' : 'ok'}
          icon={<ArrowDownRight className="size-4" />}
        />
        <StatTile
          label="Por encima del PVP"
          value={observations.initialLoading ? <Skeleton className="h-7 w-14" /> : fmtNumber(above.length)}
          hint="Suele ser una lista desactualizada"
          icon={<ArrowUpRight className="size-4" />}
        />
      </StatGrid>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          <FilterBar className="mb-3">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por SKU o producto"
              leading={<Search className="size-4" />}
              className="w-full sm:w-72"
            />
            <Select value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
              <option value="ALL">Todos</option>
              <option value="BELOW">Por debajo del PVP</option>
              <option value="ABOVE">Por encima del PVP</option>
              <option value="OK">En línea</option>
            </Select>
            <ResultCount shown={filtered.length} total={rows.length} noun="productos" />
          </FilterBar>

          <Card className="p-0">
            <DataTable
              columns={columns}
              rows={filtered}
              rowKey={(o) => o.id}
              loading={observations.initialLoading}
              empty={
                <EmptyState
                  title="Todavía no leímos precios de tu sitio"
                  description="Configurá la conexión de tu feed para que el control empiece a correr."
                />
              }
            />
          </Card>
        </div>

        <FeedPanel feed={feed.data ?? null} loading={feed.initialLoading} onSaved={() => feed.refetch()} />
      </div>
    </div>
  );
}

/* ================================================================== */

function FeedPanel({
  feed,
  loading,
  onSaved,
}: {
  feed: ResellerFeed | null;
  loading: boolean;
  onSaved: () => void;
}) {
  const { session } = useSession();
  const toast = useToast();
  const [kind, setKind] = useState<ResellerFeed['kind']>(feed?.kind ?? 'XML');
  const [url, setUrl] = useState(feed?.url ?? '');
  const [matchBy, setMatchBy] = useState<ResellerFeed['matchBy']>(feed?.matchBy ?? 'PART_NUMBER');
  const [editing, setEditing] = useState(false);

  const save = useAction(() =>
    api.retail.saveFeed({ customerId: session.customerId!, kind, url, matchBy }, session),
  );
  const run = useAction(() => api.retail.runFeed(session.customerId!, session));

  if (loading) return <Skeleton className="h-64 w-full" />;

  const connected = feed && feed.status !== 'PENDING';

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Conexión con tu sitio"
          subtitle="De acá leemos los precios que publicás"
          icon={<Plug className="size-4" />}
          action={
            connected ? (
              <Badge tone={feed.status === 'OK' ? 'ok' : feed.status === 'WARNING' ? 'warn' : 'bad'} dot size="sm">
                {feed.status === 'OK' ? 'Activa' : feed.status === 'WARNING' ? 'Con avisos' : 'No responde'}
              </Badge>
            ) : (
              <Badge tone="neutral" size="sm">
                Sin configurar
              </Badge>
            )
          }
        />

        <div className="space-y-3 px-5 pb-4">
          {!editing && connected && (
            <>
              <div className="space-y-0.5 text-[12px]">
                <p className="text-ink-500">{FEED_KIND_LABEL[feed.kind]}</p>
                <p className="flex items-center gap-1 truncate font-mono text-[11px] text-ink-600" title={feed.url}>
                  <ExternalLink className="size-3 shrink-0" aria-hidden />
                  <span className="truncate">{feed.url.replace(/^https?:\/\//, '')}</span>
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="rounded-lg bg-ink-50 py-2">
                  <p className="text-[11px] text-ink-500">Ítems leídos</p>
                  <p className="text-[13px] font-semibold tabular-nums text-ink-900">{fmtNumber(feed.itemsFound)}</p>
                </div>
                <div className="rounded-lg bg-ink-50 py-2">
                  <p className="text-[11px] text-ink-500">Matcheados</p>
                  <p className="text-[13px] font-semibold tabular-nums text-ink-900">{fmtNumber(feed.matchedSkus)}</p>
                </div>
              </div>
              {feed.message && (
                <Callout tone={feed.status === 'ERROR' ? 'bad' : 'warn'} icon={<TriangleAlert className="size-4" />}>
                  {feed.message}
                </Callout>
              )}
              <p className="text-[11px] text-ink-400">
                Se lee una vez por día.
                {feed.nextRunAt ? ` Próxima lectura ${fmtRelative(feed.nextRunAt)}.` : ''}
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="flex-1" onClick={() => setEditing(true)}>
                  Editar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  icon={<RefreshCw className="size-3.5" />}
                  loading={run.pending}
                  onClick={async () => {
                    const result = await run.run();
                    if (result) {
                      toast.success('Feed leído', 'Actualizamos tus precios publicados.');
                      onSaved();
                    } else if (run.error) {
                      toast.error('No pudimos leer el feed', run.error.message);
                    }
                  }}
                >
                  Leer ahora
                </Button>
              </div>
            </>
          )}

          {(editing || !connected) && (
            <>
              <Field label="Tipo de conexión">
                <Select value={kind} onChange={(e) => setKind(e.target.value as ResellerFeed['kind'])}>
                  <option value="XML">Feed XML de productos</option>
                  <option value="GOOGLE_MERCHANT">Google Merchant Center</option>
                  <option value="CSV">CSV publicado por URL</option>
                  <option value="API">API de mi tienda</option>
                </Select>
              </Field>
              <Field label="URL" hint="Tiene que ser accesible públicamente o habilitar el lector de Ashir.">
                <Input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://mitienda.com.ar/feed/productos.xml"
                />
              </Field>
              <Field label="Cómo identificamos cada producto">
                <Select value={matchBy} onChange={(e) => setMatchBy(e.target.value as ResellerFeed['matchBy'])}>
                  <option value="PART_NUMBER">Por part number del fabricante</option>
                  <option value="SKU">Por el SKU de Ashir</option>
                  <option value="EAN">Por código EAN</option>
                  <option value="TITLE">Por título del aviso</option>
                </Select>
              </Field>
              {save.error && (
                <Callout tone="bad" icon={<TriangleAlert className="size-4" />}>
                  {save.error.message}
                </Callout>
              )}
              <div className="flex gap-2">
                {connected && (
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => setEditing(false)}>
                    Cancelar
                  </Button>
                )}
                <Button
                  size="sm"
                  className="flex-1"
                  loading={save.pending}
                  onClick={async () => {
                    const result = await save.run();
                    if (result) {
                      setEditing(false);
                      onSaved();
                      toast.success('Conexión guardada', 'La vamos a leer en la próxima corrida diaria.');
                    }
                  }}
                >
                  Guardar conexión
                </Button>
              </div>
            </>
          )}
        </div>
      </Card>

      <Callout tone="neutral">
        Sólo ves tus propias publicaciones. Los precios de otros resellers son información comercial de terceros y no se
        exponen en el portal.
      </Callout>
    </div>
  );
}
