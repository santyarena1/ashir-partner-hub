/**
 * Mi cuenta: cuenta corriente y comprobantes del reseller.
 *
 * Junta en un solo lugar lo que el cliente hoy tiene que pedirle por
 * teléfono a su ejecutivo: cuánto debe, qué vence, qué comprobantes se le
 * emitieron y contra qué pedido salió cada uno.
 *
 * DEPENDE DEL ERP: el saldo, los comprobantes, el CAE y las cobranzas salen
 * del sistema de gestión de Ashir. Acá están simulados con datos coherentes.
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarClock,
  CreditCard,
  Download,
  FileText,
  Receipt,
  Search,
  TriangleAlert,
  Wallet,
} from 'lucide-react';
import type { AccountMovement, Invoice } from '@/types';
import { useSession } from '@/app/session';
import { customerById, accountMovements } from '@/mocks/fixtures/customers';
import { personName } from '@/mocks/fixtures/people';
import { PAYMENT_TERM } from '@/lib/labels';
import { cn, fmtDate, fmtMoney, fmtRelative, num } from '@/lib/utils';
import { useToast } from '@/components/ui/overlays';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Input,
  ProgressBar,
  Select,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/primitives';
import {
  Callout,
  type Column,
  DataRow,
  DataTable,
  EmptyState,
  FilterBar,
  PageHeader,
  StatGrid,
  StatTile,
} from '@/components/ui/data';
import { SyncStamp } from '@/components/domain/common';

const DOC_LABEL: Record<Invoice['kind'], string> = {
  INVOICE: 'Factura',
  CREDIT_NOTE: 'Nota de crédito',
  DEBIT_NOTE: 'Nota de débito',
};

const DOC_STATUS: Record<Invoice['status'], { label: string; tone: 'ok' | 'warn' | 'bad' | 'neutral' }> = {
  PAID: { label: 'Cancelado', tone: 'ok' },
  PENDING: { label: 'Pendiente', tone: 'warn' },
  OVERDUE: { label: 'Vencido', tone: 'bad' },
  PARTIAL: { label: 'Pago parcial', tone: 'warn' },
};

export function AccountPage() {
  const { session } = useSession();
  const toast = useToast();
  const [tab, setTab] = useState('documents');
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<'ALL' | Invoice['kind']>('ALL');

  const customer = customerById(session.customerId ?? '');

  const documents = useMemo(() => {
    if (!customer) return [];
    const q = query.trim().toLowerCase();
    return [...customer.account.invoices]
      .filter((d) => (kind === 'ALL' ? true : d.kind === kind))
      .filter((d) => !q || d.number.toLowerCase().includes(q))
      .sort((a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime());
  }, [customer, query, kind]);

  const movements = useMemo(() => (customer ? accountMovements(customer.id) : []), [customer]);

  if (!customer) {
    return <EmptyState title="Elegí una cuenta de reseller para ver su cuenta corriente" />;
  }

  const account = customer.account;
  // La sincronizacion la informa el ERP; aca se usa la ultima emision conocida.
  const lastSyncAt = customer.account.invoices[0]?.issuedAt ?? customer.lastOrderAt;
  const usedPct = num(account.creditLimit) > 0 ? (num(account.creditUsed) / num(account.creditLimit)) * 100 : 0;

  const documentColumns: Column<Invoice>[] = [
    {
      key: 'number',
      header: 'Comprobante',
      cell: (d) => (
        <div className="min-w-0">
          <p className="truncate font-mono text-[13px] font-semibold text-ink-900">{d.number}</p>
          <p className="mt-0.5 text-[11px] text-ink-400">
            {DOC_LABEL[d.kind]} {d.letter}
            {d.relatedDocumentId && ' · ajusta una factura anterior'}
          </p>
        </div>
      ),
      sortable: true,
      sortValue: (d) => d.number,
    },
    {
      key: 'issued',
      header: 'Emitido',
      cell: (d) => <span className="text-xs text-ink-600">{fmtDate(d.issuedAt)}</span>,
      sortable: true,
      sortValue: (d) => new Date(d.issuedAt).getTime(),
    },
    {
      key: 'due',
      header: 'Vence',
      hideOnMobile: true,
      cell: (d) =>
        d.kind === 'CREDIT_NOTE' ? (
          <span className="text-ink-300">—</span>
        ) : (
          <span className={cn('text-xs', d.status === 'OVERDUE' ? 'font-semibold text-bad-600' : 'text-ink-600')}>
            {fmtDate(d.dueAt)}
          </span>
        ),
      sortable: true,
      sortValue: (d) => new Date(d.dueAt).getTime(),
    },
    {
      key: 'total',
      header: 'Importe',
      align: 'right',
      cell: (d) => (
        <span
          className={cn(
            'font-semibold tabular-nums',
            d.kind === 'CREDIT_NOTE' ? 'text-ok-600' : 'text-ink-900',
          )}
        >
          {d.kind === 'CREDIT_NOTE' ? '−' : ''}
          {fmtMoney(d.total)}
        </span>
      ),
      sortable: true,
      sortValue: (d) => num(d.total),
    },
    {
      key: 'balance',
      header: 'Saldo',
      align: 'right',
      hideOnMobile: true,
      cell: (d) =>
        num(d.balance) > 0 ? (
          <span className="tabular-nums text-ink-700">{fmtMoney(d.balance)}</span>
        ) : (
          <span className="text-ink-300">—</span>
        ),
    },
    {
      key: 'status',
      header: 'Estado',
      cell: (d) => (
        <Badge tone={DOC_STATUS[d.status].tone} size="sm" dot>
          {DOC_STATUS[d.status].label}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (d) => (
        <div className="flex items-center justify-end gap-1">
          {d.orderId && (
            <Link to={`/pedidos/${d.orderId}`}>
              <Button size="sm" variant="ghost">
                Ver pedido
              </Button>
            </Link>
          )}
          <Button
            size="sm"
            variant="ghost"
            icon={<Download className="size-3.5" />}
            onClick={() => toast.simulated(`La descarga del PDF de ${d.number}`)}
          >
            PDF
          </Button>
        </div>
      ),
    },
  ];

  const movementColumns: Column<AccountMovement>[] = [
    {
      key: 'at',
      header: 'Fecha',
      cell: (m) => <span className="text-xs text-ink-600">{fmtDate(m.at)}</span>,
      sortable: true,
      sortValue: (m) => new Date(m.at).getTime(),
    },
    {
      key: 'label',
      header: 'Movimiento',
      cell: (m) => (
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={cn(
              'flex size-6 shrink-0 items-center justify-center rounded-full',
              num(m.amount) < 0 ? 'bg-ok-50 text-ok-600' : 'bg-ink-100 text-ink-500',
            )}
            aria-hidden
          >
            {num(m.amount) < 0 ? <ArrowDownLeft className="size-3.5" /> : <ArrowUpRight className="size-3.5" />}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[13px] text-ink-900">{m.label}</p>
            <p className="truncate font-mono text-[11px] text-ink-400">{m.reference}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'Importe',
      align: 'right',
      cell: (m) => (
        <span className={cn('font-semibold tabular-nums', num(m.amount) < 0 ? 'text-ok-600' : 'text-ink-900')}>
          {num(m.amount) < 0 ? '−' : '+'}
          {fmtMoney({ ...m.amount, amount: Math.abs(num(m.amount)).toFixed(2) })}
        </span>
      ),
      sortable: true,
      sortValue: (m) => num(m.amount),
    },
    {
      key: 'running',
      header: 'Saldo',
      align: 'right',
      hideOnMobile: true,
      cell: (m) => <span className="tabular-nums text-ink-600">{fmtMoney(m.runningBalance)}</span>,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Mi cuenta"
        subtitle="Cuenta corriente, comprobantes emitidos y movimientos de tu cuenta con Ashir."
        actions={<SyncStamp at={lastSyncAt} source="ERP Ashir" />}
      />

      {num(account.overdue) > 0 && (
        <Callout tone="bad" icon={<TriangleAlert className="size-4" />} title="Tenés deuda vencida" className="mb-5">
          Hay {fmtMoney(account.overdue)} vencidos. Mientras figure vencido, los pedidos nuevos quedan pendientes de
          liberación. Si ya lo pagaste, avisale a {personName(customer.salesRepId)} para que lo imputen.
        </Callout>
      )}

      <StatGrid cols={4} className="mb-5">
        <StatTile
          label="Crédito disponible"
          value={fmtMoney(account.creditAvailable)}
          icon={<CreditCard className="size-4" />}
          footer={
            <div className="mt-2">
              <ProgressBar value={usedPct} tone={usedPct > 85 ? 'bad' : usedPct > 65 ? 'warn' : 'ok'} />
              <p className="mt-1 text-[11px] text-ink-500">
                {fmtMoney(account.creditUsed)} usados de {fmtMoney(account.creditLimit)}
              </p>
            </div>
          }
        />
        <StatTile label="Saldo de cuenta" value={fmtMoney(account.balance)} icon={<Wallet className="size-4" />} />
        <StatTile
          label="Deuda vencida"
          value={fmtMoney(account.overdue)}
          tone={num(account.overdue) > 0 ? 'bad' : 'ok'}
          hint={num(account.overdue) > 0 ? 'Regularizar para liberar pedidos' : 'Sin deuda vencida'}
          icon={<TriangleAlert className="size-4" />}
        />
        <StatTile
          label="Próximo vencimiento"
          value={account.nextDueDate ? fmtDate(account.nextDueDate) : '—'}
          hint={
            account.nextDueAmount
              ? `${fmtMoney(account.nextDueAmount)} · ${fmtRelative(account.nextDueDate ?? '')}`
              : 'No hay vencimientos próximos'
          }
          icon={<CalendarClock className="size-4" />}
        />
      </StatGrid>

      <div className="mb-5 grid gap-4 lg:grid-cols-[1fr_320px]">
        <Tabs value={tab} onValueChange={setTab} className="min-w-0">
          <TabsList>
            <TabsTrigger value="documents">Comprobantes</TabsTrigger>
            <TabsTrigger value="movements">Movimientos</TabsTrigger>
          </TabsList>

          <TabsContent value="documents">
            <FilterBar className="mb-3">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por número de comprobante"
                leading={<Search className="size-4" />}
                className="w-full sm:w-72"
              />
              <Select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
                <option value="ALL">Todos los comprobantes</option>
                <option value="INVOICE">Sólo facturas</option>
                <option value="CREDIT_NOTE">Sólo notas de crédito</option>
                <option value="DEBIT_NOTE">Sólo notas de débito</option>
              </Select>
            </FilterBar>
            <Card className="p-0">
              <DataTable
                columns={documentColumns}
                rows={documents}
                rowKey={(d) => d.id}
                empty={<EmptyState title="Todavía no hay comprobantes emitidos" />}
              />
            </Card>
          </TabsContent>

          <TabsContent value="movements">
            <Card className="p-0">
              <DataTable
                columns={movementColumns}
                rows={movements}
                rowKey={(m) => m.id}
                empty={<EmptyState title="Sin movimientos registrados" />}
                footer={
                  <div className="flex items-center justify-between px-4 py-2.5 text-[12px]">
                    <span className="text-ink-500">Saldo actual</span>
                    <span className="font-semibold tabular-nums text-ink-900">{fmtMoney(account.balance)}</span>
                  </div>
                }
              />
            </Card>
          </TabsContent>
        </Tabs>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Condiciones de tu cuenta" icon={<FileText className="size-4" />} />
            <div className="space-y-0.5 px-5 pb-4">
              <DataRow label="Razón social" value={customer.legalName} />
              <DataRow label="CUIT" value={customer.taxId} />
              <DataRow label="Condición de pago" value={PAYMENT_TERM[customer.paymentTerm].label} />
              <DataRow label="Lista de precios" value={customer.priceListId.replace('pl_', 'LP-').toUpperCase()} />
              <DataRow label="Ejecutivo" value={personName(customer.salesRepId)} />
            </div>
          </Card>

          <Card>
            <CardHeader title="Historial de compras" icon={<Receipt className="size-4" />} />
            <div className="space-y-0.5 px-5 pb-4">
              <DataRow label="Compras últimos 12 meses" value={fmtMoney(customer.purchases12m)} emphasis />
              <DataRow label="12 meses anteriores" value={fmtMoney(customer.purchasesPrevious12m)} />
              <DataRow
                label="Última compra"
                value={customer.lastOrderAt ? fmtRelative(customer.lastOrderAt) : 'Nunca'}
              />
              <DataRow label="Puntos Ashir" value={`${customer.points.toLocaleString('es-AR')} pts`} />
            </div>
            <div className="border-t border-ink-100 px-5 py-3">
              <Link to="/pedidos">
                <Button variant="outline" size="sm" className="w-full">
                  Ver todos mis pedidos
                </Button>
              </Link>
            </div>
          </Card>

          <Callout tone="neutral" icon={<FileText className="size-4" />}>
            Los comprobantes y el saldo se sincronizan desde el sistema de gestión de Ashir. En esta demo los datos son
            simulados, pero cierran entre pantallas.
          </Callout>
        </div>
      </div>
    </div>
  );
}
