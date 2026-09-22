/**
 * Portal de RMA del reseller: consulta por serial, casos abiertos e historial.
 */
import { Link } from 'react-router-dom';
import { Clock, PackageCheck, Search, ShieldCheck, Wrench } from 'lucide-react';
import type { RmaCase } from '@/types';
import { api } from '@/services';
import { useSession } from '@/app/session';
import { useAsync } from '@/app/hooks';
import { RMA_STATUS } from '@/lib/labels';
import { fmtDate, fmtNumber, fmtRelative } from '@/lib/utils';
import { Button, Card, CardHeader } from '@/components/ui/primitives';
import {
  DataTable,
  EmptyState,
  ErrorState,
  Mono,
  PageHeader,
  SectionTitle,
  StatGrid,
  StatTile,
  type Column,
} from '@/components/ui/data';
import { RmaStatusBadge, SlaIndicator } from '@/components/domain/common';

export function RmaPortal() {
  const { session } = useSession();
  const cases = useAsync(() => api.rma.listCases({}, session), [session.customerId]);
  const serials = useAsync(() => api.rma.eligibleSerials(session), [session.customerId]);

  const list = cases.data ?? [];
  const open = list.filter((c) => !['CLOSED', 'REJECTED'].includes(c.status));
  const closed = list.filter((c) => ['CLOSED', 'REJECTED'].includes(c.status));

  const columns: Column<RmaCase>[] = [
    {
      key: 'code',
      header: 'Caso',
      cell: (c) => (
        <div>
          <Link to={`/rma/${c.id}`} className="font-semibold text-ashir-600 hover:text-ashir-700">
            {c.code}
          </Link>
          <p className="text-[11px] text-ink-400">{fmtDate(c.createdAt)}</p>
        </div>
      ),
    },
    {
      key: 'product',
      header: 'Producto',
      cell: (c) => (
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium text-ink-900">{c.units[0]?.productName}</p>
          <p className="mt-0.5 text-[11px] text-ink-400">
            {c.units.length > 1 ? (
              <>{c.units.length} unidades · gestión múltiple</>
            ) : (
              <Mono>{c.units[0]?.serial ?? ''}</Mono>
            )}
          </p>
        </div>
      ),
    },
    {
      key: 'problem',
      header: 'Problema',
      hideOnMobile: true,
      cell: (c) => <span className="text-ink-600">{c.units[0]?.problemLabel}</span>,
    },
    {
      key: 'status',
      header: 'Estado',
      cell: (c) => <RmaStatusBadge status={c.status} size="sm" />,
      sortable: true,
      sortValue: (c) => RMA_STATUS[c.status].label,
    },
    {
      key: 'sla',
      header: 'Plazo',
      hideOnMobile: true,
      cell: (c) => <SlaIndicator sla={c.sla} />,
    },
    {
      key: 'updated',
      header: 'Actualizado',
      align: 'right',
      cell: (c) => <span className="text-xs text-ink-500">{fmtRelative(c.updatedAt)}</span>,
      sortable: true,
      sortValue: (c) => new Date(c.updatedAt).getTime(),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Garantías y RMA"
        subtitle="Consultá una garantía por número de serie, iniciá una gestión y seguí cada etapa hasta la resolución."
        actions={
          <>
            <Link to="/rma/consulta">
              <Button variant="outline" icon={<Search className="size-4" />}>
                Consultar por serial
              </Button>
            </Link>
            <Link to="/rma/nuevo">
              <Button icon={<Wrench className="size-4" />}>Nueva gestión</Button>
            </Link>
          </>
        }
      />

      {/* ---------- acceso rápido a la consulta ---------- */}
      <Card className="mb-6 overflow-hidden border-ashir-200 bg-linear-to-r from-ashir-50 to-white">
        <div className="flex flex-wrap items-center justify-between gap-5 p-5">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold text-ink-900">¿Tenés un producto con falla?</h2>
            <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-ink-600">
              Empezá por el número de serie: recuperamos el producto, el pedido, la factura y la garantía aplicable sin
              que tengas que buscar nada.
            </p>
          </div>
          <Link to="/rma/consulta" className="shrink-0">
            <Button size="lg" icon={<Search className="size-4" />}>
              Consultar garantía
            </Button>
          </Link>
        </div>
      </Card>

      <StatGrid cols={4} className="mb-6">
        <StatTile label="Gestiones abiertas" value={open.length} icon={<Clock className="size-4" />} tone="warn" />
        <StatTile label="Finalizadas" value={closed.length} icon={<PackageCheck className="size-4" />} tone="ok" />
        <StatTile
          label="Unidades en garantía"
          value={fmtNumber((serials.data ?? []).filter((s) => new Date(s.warrantyExpiresAt).getTime() > Date.now()).length)}
          icon={<ShieldCheck className="size-4" />}
          footer="Seriales de tus compras con cobertura vigente"
        />
        <StatTile
          label="Resolución promedio"
          value={
            closed.length > 0
              ? `${Math.round(
                  closed.reduce(
                    (acc, c) => acc + (new Date(c.closedAt ?? c.updatedAt).getTime() - new Date(c.createdAt).getTime()) / 86_400_000,
                    0,
                  ) / closed.length,
                )} días`
              : '—'
          }
          footer="Desde la solicitud hasta el cierre"
        />
      </StatGrid>

      {cases.error ? (
        <Card>
          <ErrorState description={cases.error.message} onRetry={cases.refetch} />
        </Card>
      ) : (
        <>
          <section className="mb-8">
            <SectionTitle title="Gestiones en curso" subtitle={`${open.length} casos abiertos`} />
            <DataTable
              columns={columns}
              rows={open}
              rowKey={(c) => c.id}
              loading={cases.initialLoading}
              empty={
                <EmptyState
                  title="No tenés gestiones abiertas"
                  description="Cuando inicies una garantía vas a poder seguir acá cada etapa, desde la validación hasta la resolución."
                  icon={<Wrench className="size-5" />}
                  action={
                    <Link to="/rma/consulta">
                      <Button>Consultar una garantía</Button>
                    </Link>
                  }
                />
              }
              mobileCard={(c) => (
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <Link to={`/rma/${c.id}`} className="text-[13px] font-semibold text-ashir-600">
                      {c.code}
                    </Link>
                    <RmaStatusBadge status={c.status} size="sm" />
                  </div>
                  <p className="mt-1 truncate text-xs text-ink-600">{c.units[0]?.productName}</p>
                  <div className="mt-1.5">
                    <SlaIndicator sla={c.sla} />
                  </div>
                </div>
              )}
            />
          </section>

          {closed.length > 0 && (
            <section>
              <SectionTitle title="Historial" subtitle="Gestiones finalizadas" />
              <DataTable columns={columns} rows={closed} rowKey={(c) => c.id} dense />
            </section>
          )}
        </>
      )}

      {/* ---------- cómo funciona ---------- */}
      <Card className="mt-8">
        <CardHeader title="Cómo funciona una gestión de garantía" />
        <ol className="grid gap-px bg-ink-100 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['1. Consultás el serial', 'Recuperamos producto, pedido, factura y garantía aplicable.'],
            ['2. Ashir valida', 'Verificamos cobertura y emitimos remito y etiqueta. Plazo: 24 h hábiles.'],
            ['3. Diagnóstico técnico', 'Recibimos el producto, lo probamos en banco y registramos el resultado.'],
            ['4. Resolución', 'Reparación, cambio, equivalente o nota de crédito, con trazabilidad del serial.'],
          ].map(([title, detail]) => (
            <li key={title} className="bg-white p-4">
              <p className="text-[13px] font-semibold text-ink-900">{title}</p>
              <p className="mt-1 text-xs leading-relaxed text-ink-500">{detail}</p>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
