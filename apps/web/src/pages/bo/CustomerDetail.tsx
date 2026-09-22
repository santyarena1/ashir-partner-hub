/**
 * Ficha 360° del cliente: comercial, cuenta corriente, pedidos, RMAs,
 * solicitudes, beneficios, documentación y notas internas.
 */
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Building2,
  CreditCard,
  FileText,
  Mail,
  MapPin,
  Phone,
  Plus,
  Star,
  StickyNote,
  Tag,
  TrendingUp,
  Wrench,
} from 'lucide-react';
import type { Invoice, Order, RmaCase, SpecialPriceRequest } from '@/types';
import { api } from '@/services';
import { useSession } from '@/app/session';
import { useAction, useAsync } from '@/app/hooks';
import { useToast, Dialog } from '@/components/ui/overlays';
import { partnerStatusFor } from '@/mocks/fixtures/commerce';
import { priceListById } from '@/mocks/fixtures/pricing';
import { personName } from '@/mocks/fixtures/people';
import { PAYMENT_TERM } from '@/lib/labels';
import { can } from '@/lib/rbac';
import { cn, fmtDate, fmtMoney, fmtNumber, fmtRelative, num } from '@/lib/utils';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  ProgressBar,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
} from '@/components/ui/primitives';
import {
  Callout,
  DataRow,
  DataTable,
  EmptyState,
  ErrorState,
  Mono,
  PageHeader,
  StatGrid,
  StatTile,
  type Column,
} from '@/components/ui/data';
import { OrderStatusBadge, RmaStatusBadge, SegmentBadge, SpecialPriceStatusBadge } from '@/components/domain/common';

export function BoCustomerDetail() {
  const { id = '' } = useParams();
  const { session } = useSession();
  const toast = useToast();
  const [tab, setTab] = useState('overview');
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState('');

  const customer = useAsync(() => api.customers.get(id), [id]);
  const orders = useAsync(() => api.orders.list({ customerId: id }, session), [id, session.role]);
  const rmas = useAsync(() => api.rma.listCases({ customerId: id }, session), [id, session.role]);
  const requests = useAsync(() => api.specialPrice.list({ customerId: id }, session), [id, session.role]);
  const addNote = useAction((text: string) => api.customers.addNote(id, text, session.name));

  if (customer.error) {
    return (
      <Card>
        <ErrorState title="No encontramos el cliente" description={customer.error.message} onRetry={customer.refetch} />
      </Card>
    );
  }
  if (customer.initialLoading || !customer.data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full rounded-card" />
        <Skeleton className="h-64 w-full rounded-card" />
      </div>
    );
  }

  const c = customer.data;
  const account = c.account;
  const partner = partnerStatusFor(c.id);
  const list = priceListById(c.priceListId);
  const creditUsedPct = (num(account.creditUsed) / Math.max(1, num(account.creditLimit))) * 100;
  const growth =
    num(c.purchasesPrevious12m) > 0
      ? ((num(c.purchases12m) - num(c.purchasesPrevious12m)) / num(c.purchasesPrevious12m)) * 100
      : 0;

  const orderColumns: Column<Order>[] = [
    {
      key: 'number',
      header: 'Pedido',
      cell: (o) => (
        <Link to={`/bo/pedidos/${o.id}`} className="font-semibold text-ashir-600 hover:text-ashir-700">
          {o.number}
        </Link>
      ),
    },
    { key: 'date', header: 'Fecha', cell: (o) => <span className="text-ink-600">{fmtDate(o.createdAt)}</span> },
    { key: 'status', header: 'Estado', cell: (o) => <OrderStatusBadge status={o.status} size="sm" /> },
    {
      key: 'items',
      header: 'Ítems',
      align: 'right',
      hideOnMobile: true,
      cell: (o) => <span className="tabular-nums text-ink-600">{o.items.length}</span>,
    },
    {
      key: 'total',
      header: 'Total',
      align: 'right',
      cell: (o) => <span className="font-semibold tabular-nums">{fmtMoney(o.total)}</span>,
      sortable: true,
      sortValue: (o) => num(o.total),
    },
  ];

  const invoiceColumns: Column<Invoice>[] = [
    { key: 'number', header: 'Comprobante', cell: (i) => <Mono>{i.number}</Mono> },
    { key: 'issued', header: 'Emitida', cell: (i) => <span className="text-ink-600">{fmtDate(i.issuedAt)}</span> },
    {
      key: 'due',
      header: 'Vence',
      cell: (i) => (
        <span className={cn(i.status === 'OVERDUE' ? 'font-medium text-bad-600' : 'text-ink-600')}>{fmtDate(i.dueAt)}</span>
      ),
    },
    {
      key: 'status',
      header: 'Estado',
      cell: (i) => (
        <Badge tone={i.status === 'PAID' ? 'ok' : i.status === 'OVERDUE' ? 'bad' : i.status === 'PARTIAL' ? 'warn' : 'tech'} size="sm">
          {i.status === 'PAID' ? 'Pagada' : i.status === 'OVERDUE' ? 'Vencida' : i.status === 'PARTIAL' ? 'Parcial' : 'Pendiente'}
        </Badge>
      ),
    },
    {
      key: 'total',
      header: 'Importe',
      align: 'right',
      cell: (i) => <span className="font-semibold tabular-nums">{fmtMoney(i.total)}</span>,
    },
  ];

  const rmaColumns: Column<RmaCase>[] = [
    {
      key: 'code',
      header: 'Caso',
      cell: (r) => (
        <Link to={`/bo/rma/${r.id}`} className="font-semibold text-ashir-600 hover:text-ashir-700">
          {r.code}
        </Link>
      ),
    },
    {
      key: 'product',
      header: 'Producto',
      cell: (r) => <span className="truncate text-ink-800">{r.units[0]?.productName}</span>,
    },
    { key: 'status', header: 'Estado', cell: (r) => <RmaStatusBadge status={r.status} size="sm" /> },
    { key: 'date', header: 'Creado', align: 'right', cell: (r) => <span className="text-ink-500">{fmtDate(r.createdAt)}</span> },
  ];

  const requestColumns: Column<SpecialPriceRequest>[] = [
    {
      key: 'code',
      header: 'Solicitud',
      cell: (r) => (
        <Link to={`/bo/solicitudes/${r.id}`} className="font-semibold text-ashir-600 hover:text-ashir-700">
          {r.code}
        </Link>
      ),
    },
    { key: 'sku', header: 'SKU', cell: (r) => <Mono>{r.sku}</Mono> },
    { key: 'qty', header: 'Cant.', align: 'right', cell: (r) => <span className="tabular-nums">{r.quantity}</span> },
    {
      key: 'target',
      header: 'Solicitado',
      align: 'right',
      cell: (r) => <span className="tabular-nums">{fmtMoney(r.targetPrice)}</span>,
    },
    ...(can(session, 'margin:read')
      ? [
          {
            key: 'margin',
            header: 'Margen result.',
            align: 'right' as const,
            cell: (r: SpecialPriceRequest) =>
              r.resultingMarginPct ? (
                <span
                  className={cn(
                    'font-semibold tabular-nums',
                    Number.parseFloat(r.resultingMarginPct) < 10 ? 'text-bad-600' : 'text-ok-700',
                  )}
                >
                  {r.resultingMarginPct}%
                </span>
              ) : (
                <span className="text-ink-400">—</span>
              ),
          },
        ]
      : []),
    { key: 'status', header: 'Estado', cell: (r) => <SpecialPriceStatusBadge status={r.status} size="sm" /> },
  ];

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'Clientes', href: '/bo/clientes' }, { label: c.tradeName }]}
        title={c.tradeName}
        subtitle={
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span>{c.legalName}</span>
            <span>·</span>
            <span>CUIT {c.taxId}</span>
            <span>·</span>
            <span>Código {c.code}</span>
            <span>·</span>
            <span>Cliente desde {fmtDate(c.createdAt)}</span>
          </span>
        }
        badge={
          <span className="flex items-center gap-2">
            <SegmentBadge segment={c.segment} />
            {c.status !== 'ACTIVE' && (
              <Badge tone={c.status === 'ON_HOLD' ? 'warn' : c.status === 'SUSPENDED' ? 'bad' : 'neutral'}>
                {c.status === 'ON_HOLD' ? 'En observación' : c.status === 'SUSPENDED' ? 'Suspendido' : 'Prospecto'}
              </Badge>
            )}
          </span>
        }
        actions={
          <>
            <Button variant="outline" icon={<StickyNote className="size-4" />} onClick={() => setNoteOpen(true)}>
              Agregar nota
            </Button>
            <Button variant="outline" icon={<Mail className="size-4" />} onClick={() => toast.simulated('El envío de correo al cliente')}>
              Contactar
            </Button>
          </>
        }
      />

      {c.status === 'ON_HOLD' && (
        <Callout tone="warn" title="Cuenta en observación" className="mb-5">
          {c.internalNotes[0]?.text ?? 'La cuenta requiere liberación de administración antes de despachar pedidos.'}
        </Callout>
      )}

      <StatGrid cols={5} className="mb-6">
        <StatTile
          label="Compras 12 meses"
          value={fmtMoney(c.purchases12m, { compact: true })}
          delta={growth}
          deltaLabel="vs. período anterior"
          icon={<TrendingUp className="size-4" />}
          tone="ok"
        />
        <StatTile
          label="Crédito disponible"
          value={fmtMoney(account.creditAvailable, { compact: true })}
          icon={<CreditCard className="size-4" />}
          footer={<ProgressBar value={creditUsedPct} tone={creditUsedPct > 85 ? 'bad' : creditUsedPct > 65 ? 'warn' : 'ok'} showLabel />}
        />
        <StatTile
          label="Deuda vencida"
          value={fmtMoney(account.overdue)}
          tone={num(account.overdue) > 0 ? 'bad' : 'ok'}
          footer={account.nextDueDate ? `Próximo vencimiento ${fmtDate(account.nextDueDate)}` : 'Sin vencimientos'}
        />
        <StatTile
          label="Frecuencia de compra"
          value={c.orderFrequencyDays > 0 ? `${c.orderFrequencyDays} días` : '—'}
          footer={c.lastOrderAt ? `Última compra ${fmtRelative(c.lastOrderAt)}` : 'Nunca compró'}
        />
        <StatTile
          label="Puntos Ashir"
          value={fmtNumber(c.points)}
          icon={<Star className="size-4" />}
          tone="plat"
          footer={`Nivel ${c.partnerTier}`}
        />
      </StatGrid>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="overview">Resumen</TabsTrigger>
          <TabsTrigger value="orders" count={orders.data?.length}>
            Pedidos
          </TabsTrigger>
          <TabsTrigger value="account" count={account.invoices.length}>
            Cuenta corriente
          </TabsTrigger>
          <TabsTrigger value="rma" count={rmas.data?.length}>
            RMA
          </TabsTrigger>
          <TabsTrigger value="requests" count={requests.data?.length}>
            Precios especiales
          </TabsTrigger>
          <TabsTrigger value="partner">Beneficios</TabsTrigger>
          <TabsTrigger value="notes" count={c.internalNotes.length}>
            Notas internas
          </TabsTrigger>
        </TabsList>

        {/* ---------- resumen ---------- */}
        <TabsContent value="overview">
          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader title="Datos comerciales" icon={<Building2 className="size-4" />} />
              <div className="space-y-0.5 p-5">
                <DataRow label="Ejecutivo asignado" value={personName(c.salesRepId)} />
                <DataRow
                  label="Lista de precios"
                  value={
                    list ? (
                      <Link to={`/bo/precios/${list.id}`} className="font-medium text-ashir-600 hover:text-ashir-700">
                        {list.code}
                      </Link>
                    ) : (
                      c.priceListId
                    )
                  }
                />
                <DataRow label="Condición de pago" value={PAYMENT_TERM[c.paymentTerm].label} />
                <DataRow label="Límite de crédito" value={fmtMoney(account.creditLimit)} />
                <DataRow label="Zona" value={c.zone} />
                <DataRow label="Segmento Partner" value={c.partnerTier} />
              </div>
            </Card>

            <Card>
              <CardHeader title="Contacto" icon={<MapPin className="size-4" />} />
              <div className="space-y-2.5 p-5 text-[13px]">
                <p className="flex items-start gap-2 text-ink-700">
                  <MapPin className="mt-0.5 size-3.5 shrink-0 text-ink-400" aria-hidden />
                  <span>
                    {c.address}
                    <br />
                    <span className="text-ink-500">
                      {c.city}, {c.province}
                    </span>
                  </span>
                </p>
                <p className="flex items-center gap-2 text-ink-700">
                  <Mail className="size-3.5 shrink-0 text-ink-400" aria-hidden />
                  {c.email}
                </p>
                <p className="flex items-center gap-2 text-ink-700">
                  <Phone className="size-3.5 shrink-0 text-ink-400" aria-hidden />
                  {c.phone}
                </p>
              </div>
            </Card>

            <Card>
              <CardHeader title="Marcas compradas" icon={<Tag className="size-4" />} />
              <div className="p-5">
                {c.topBrands.length > 0 ? (
                  <ol className="space-y-2">
                    {c.topBrands.map((brand, i) => (
                      <li key={brand} className="flex items-center gap-3">
                        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-ink-100 text-[11px] font-bold text-ink-600">
                          {i + 1}
                        </span>
                        <Link to={`/bo/productos?q=${brand}`} className="text-[13px] font-medium text-ink-800 hover:text-ashir-700">
                          {brand}
                        </Link>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-[13px] text-ink-500">Todavía no registró compras.</p>
                )}
              </div>
            </Card>

            <Card className="lg:col-span-3">
              <CardHeader title="Documentación impositiva" icon={<FileText className="size-4" />} />
              <ul className="divide-y divide-ink-100 px-5">
                {c.documents.map((doc) => (
                  <li key={doc.name} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-ink-900">{doc.name}</p>
                      {doc.expiresAt && <p className="text-xs text-ink-500">Vence el {fmtDate(doc.expiresAt)}</p>}
                    </div>
                    <Badge tone={doc.status === 'OK' ? 'ok' : doc.status === 'EXPIRING' ? 'warn' : 'bad'} size="sm">
                      {doc.status === 'OK' ? 'Vigente' : doc.status === 'EXPIRING' ? 'Por vencer' : 'Faltante'}
                    </Badge>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </TabsContent>

        {/* ---------- pedidos ---------- */}
        <TabsContent value="orders">
          <DataTable
            columns={orderColumns}
            rows={orders.data ?? []}
            rowKey={(o) => o.id}
            loading={orders.initialLoading}
            dense
            empty={<EmptyState title="Sin pedidos registrados" icon={<FileText className="size-5" />} />}
          />
        </TabsContent>

        {/* ---------- cuenta corriente ---------- */}
        <TabsContent value="account">
          <div className="mb-4 grid gap-3 sm:grid-cols-4">
            <StatTile label="Límite" value={fmtMoney(account.creditLimit)} />
            <StatTile label="Utilizado" value={fmtMoney(account.creditUsed)} tone="warn" />
            <StatTile label="Disponible" value={fmtMoney(account.creditAvailable)} tone="ok" />
            <StatTile label="Vencido" value={fmtMoney(account.overdue)} tone={num(account.overdue) > 0 ? 'bad' : 'neutral'} />
          </div>
          <DataTable
            columns={invoiceColumns}
            rows={account.invoices}
            rowKey={(i) => i.id}
            dense
            empty={<EmptyState title="Sin comprobantes" icon={<FileText className="size-5" />} />}
          />
          <Callout tone="neutral" className="mt-3">
            En producción la cuenta corriente y los comprobantes se sincronizarían desde el ERP. Los importes de esta
            pantalla son datos de demostración.
          </Callout>
        </TabsContent>

        {/* ---------- RMA ---------- */}
        <TabsContent value="rma">
          <DataTable
            columns={rmaColumns}
            rows={rmas.data ?? []}
            rowKey={(r) => r.id}
            loading={rmas.initialLoading}
            dense
            empty={<EmptyState title="Sin casos de garantía" icon={<Wrench className="size-5" />} />}
          />
        </TabsContent>

        {/* ---------- solicitudes ---------- */}
        <TabsContent value="requests">
          <DataTable
            columns={requestColumns}
            rows={requests.data ?? []}
            rowKey={(r) => r.id}
            loading={requests.initialLoading}
            dense
            empty={<EmptyState title="Sin solicitudes de precio especial" icon={<Tag className="size-5" />} />}
          />
        </TabsContent>

        {/* ---------- beneficios ---------- */}
        <TabsContent value="partner">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader title="Estado del programa" subtitle={`Nivel ${partner.tier}`} />
              <div className="p-5">
                <div className="space-y-0.5">
                  <DataRow label="Puntos disponibles" value={fmtNumber(partner.points)} emphasis />
                  <DataRow
                    label="Puntos por vencer"
                    value={`${fmtNumber(partner.pointsExpiringSoon.points)} el ${fmtDate(partner.pointsExpiringSoon.expiresAt)}`}
                  />
                  <DataRow
                    label="Progreso de nivel"
                    value={
                      partner.tierProgress.next
                        ? `${partner.tierProgress.progressPct}% hacia ${partner.tierProgress.next}`
                        : 'Nivel máximo'
                    }
                  />
                </div>
                <ProgressBar className="mt-3" value={partner.tierProgress.progressPct} tone="plat" showLabel />
              </div>
            </Card>

            <Card>
              <CardHeader title="Beneficios activos" />
              <ul className="divide-y divide-ink-100 px-5">
                {partner.benefits
                  .filter((b) => b.status === 'ACTIVE')
                  .map((b) => (
                    <li key={b.id} className="py-3">
                      <p className="text-[13px] font-semibold text-ink-900">{b.name}</p>
                      <p className="mt-0.5 text-xs text-ink-500">{b.rules}</p>
                    </li>
                  ))}
                {partner.benefits.filter((b) => b.status === 'ACTIVE').length === 0 && (
                  <li className="py-6">
                    <EmptyState compact title="Sin beneficios activos" icon={<Star className="size-5" />} />
                  </li>
                )}
              </ul>
            </Card>
          </div>
        </TabsContent>

        {/* ---------- notas ---------- */}
        <TabsContent value="notes">
          <Card>
            <CardHeader
              title="Notas internas"
              subtitle="Solo visibles para el equipo de Ashir. El cliente nunca las ve."
              action={
                <Button size="sm" variant="outline" icon={<Plus className="size-3.5" />} onClick={() => setNoteOpen(true)}>
                  Nueva nota
                </Button>
              }
            />
            {c.internalNotes.length === 0 ? (
              <EmptyState compact title="Sin notas registradas" icon={<StickyNote className="size-5" />} />
            ) : (
              <ul className="divide-y divide-ink-100">
                {c.internalNotes.map((note) => (
                  <li key={note.id} className="px-5 py-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-[13px] font-semibold text-ink-900">{note.author}</p>
                      <p className="text-xs text-ink-400">{fmtDate(note.at)}</p>
                    </div>
                    <p className="mt-1 text-[13px] leading-relaxed text-ink-700">{note.text}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog
        open={noteOpen}
        onClose={() => setNoteOpen(false)}
        title="Agregar nota interna"
        description="Queda registrada con tu usuario y la fecha. No es visible para el cliente."
        footer={
          <>
            <Button variant="outline" onClick={() => setNoteOpen(false)}>
              Cancelar
            </Button>
            <Button
              loading={addNote.pending}
              disabled={noteText.trim().length < 3}
              onClick={async () => {
                await addNote.run(noteText);
                setNoteOpen(false);
                setNoteText('');
                toast.success('Nota agregada', 'En el prototipo la nota no persiste en el dataset base.');
              }}
            >
              Guardar nota
            </Button>
          </>
        }
      >
        <Textarea
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          rows={4}
          placeholder="Pidió cotización por un proyecto corporativo de 80 equipos…"
          aria-label="Texto de la nota"
        />
      </Dialog>
    </div>
  );
}
