/**
 * Consulta de garantía por número de serie.
 *
 * REGLA CRÍTICA DE PRIVACIDAD: si el serial pertenece a otro reseller, la
 * respuesta no incluye factura, fecha, precio ni razón social del tercero.
 * Solo el mensaje genérico que devuelve el servicio.
 */
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Info,
  Search,
  ShieldCheck,
  ShieldOff,
  Wrench,
} from 'lucide-react';
import type { SerialLookupResult } from '@/types';
import { api } from '@/services';
import { useSession } from '@/app/session';
import { useAction, useAsync } from '@/app/hooks';
import { HERO_SERIAL } from '@/mocks/fixtures/serials';
import { cn, fmtDate, fmtNumber } from '@/lib/utils';
import { Badge, Button, Card, CardHeader, Input, Skeleton } from '@/components/ui/primitives';
import { Callout, DataRow, EmptyState, Mono, PageHeader, SectionTitle } from '@/components/ui/data';
import { ProductTile } from '@/components/domain/common';
import { productBySku } from '@/mocks/fixtures/catalog';

export function RmaLookup() {
  const { session } = useSession();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [serial, setSerial] = useState(params.get('serial') ?? '');
  const [result, setResult] = useState<SerialLookupResult | null>(null);

  const lookup = useAction((code: string) => api.rma.lookupSerial(code, session));
  const eligible = useAsync(() => api.rma.eligibleSerials(session), [session.customerId]);

  const run = async (code: string) => {
    if (!code.trim()) return;
    const found = await lookup.run(code.trim());
    setResult(found ?? null);
  };

  useEffect(() => {
    const preset = params.get('serial');
    if (preset) void run(preset);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'RMA', href: '/rma' }, { label: 'Consulta por serial' }]}
        title="Consultar garantía"
        subtitle="Con el número de serie recuperamos el producto, el pedido, la factura y la garantía aplicable. No hace falta que cargues nada más."
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-5">
          <Card className="p-5">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void run(serial);
              }}
            >
              <label htmlFor="serial-input" className="block text-[15px] font-semibold text-ink-900">
                Ingresá el número de serie del producto
              </label>
              <p className="mt-1 text-[13px] text-ink-500">
                Está impreso en la etiqueta del producto o de su caja. Podés pegarlo tal como figura, con o sin espacios.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Input
                  id="serial-input"
                  value={serial}
                  onChange={(e) => setSerial(e.target.value.toUpperCase())}
                  placeholder="9MSI5070X93821"
                  leading={<Search className="size-4" />}
                  className="min-w-[240px] flex-1 font-mono"
                  autoComplete="off"
                />
                <Button type="submit" loading={lookup.pending} size="md">
                  Consultar
                </Button>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSerial(HERO_SERIAL);
                  void run(HERO_SERIAL);
                }}
                className="mt-2 text-xs font-medium text-ashir-600 underline underline-offset-2 hover:text-ashir-700"
              >
                Usar el serial de ejemplo de la demo ({HERO_SERIAL})
              </button>
            </form>
          </Card>

          {/* ---------- resultado ---------- */}
          {lookup.pending && (
            <Card className="p-5">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="mt-3 h-24 w-full" />
            </Card>
          )}

          {!lookup.pending && result && <LookupResult result={result} onCreate={() => navigate(`/rma/nuevo?serial=${result.serial}`)} />}

          {!lookup.pending && !result && (
            <Card>
              <EmptyState
                title="Esperando un número de serie"
                description="También podés elegir una unidad de tus compras recientes en el panel de la derecha."
                icon={<Wrench className="size-5" />}
              />
            </Card>
          )}
        </div>

        {/* ---------- unidades elegibles ---------- */}
        <div className="space-y-4">
          <Card>
            <CardHeader
              title="Tus unidades elegibles"
              subtitle="Seriales de tus compras sin gestión abierta"
            />
            <div className="max-h-[440px] overflow-y-auto">
              {eligible.initialLoading ? (
                <div className="space-y-2 p-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (eligible.data ?? []).length === 0 ? (
                <EmptyState compact title="No hay unidades disponibles" icon={<ShieldCheck className="size-5" />} />
              ) : (
                <ul className="divide-y divide-ink-100">
                  {(eligible.data ?? []).slice(0, 12).map((record) => {
                    const expired = new Date(record.warrantyExpiresAt).getTime() < Date.now();
                    return (
                      <li key={record.serial}>
                        <button
                          type="button"
                          onClick={() => {
                            setSerial(record.serial);
                            void run(record.serial);
                          }}
                          className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left transition-colors hover:bg-ink-50"
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-mono text-[12px] font-medium text-ink-900">
                              {record.serial}
                            </span>
                            <span className="mt-0.5 block truncate text-[11px] text-ink-500">
                              {record.productName}
                            </span>
                          </span>
                          {expired ? (
                            <Badge tone="neutral" size="sm">
                              Vencida
                            </Badge>
                          ) : (
                            <Badge tone="ok" size="sm">
                              En garantía
                            </Badge>
                          )}
                          <ChevronRight className="size-3.5 shrink-0 text-ink-300" aria-hidden />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            {(eligible.data ?? []).length > 12 && (
              <p className="border-t border-ink-100 px-4 py-2.5 text-[11px] text-ink-500">
                Mostrando 12 de {fmtNumber((eligible.data ?? []).length)} unidades.
              </p>
            )}
          </Card>

          <Callout tone="tech" icon={<Info className="size-4" />}>
            La consulta se valida contra tu cuenta autenticada. Un número de serie por sí solo nunca autoriza a ver
            información comercial de otro reseller.
          </Callout>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function LookupResult({ result, onCreate }: { result: SerialLookupResult; onCreate: () => void }) {
  /* --- serial de otra cuenta: sin ningún dato del tercero --- */
  if (result.status === 'NOT_YOUR_ACCOUNT') {
    return (
      <Card className="border-warn-200">
        <div className="p-5">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-warn-50 text-warn-600">
              <ShieldOff className="size-4.5" aria-hidden />
            </span>
            <div className="min-w-0">
              <h2 className="text-[15px] font-semibold text-ink-900">No encontramos esta compra en tu cuenta</h2>
              <p className="mt-1.5 text-[13px] leading-relaxed text-ink-600">{result.message}</p>
              <p className="mt-3 text-xs leading-relaxed text-ink-400">
                Por privacidad no mostramos datos comerciales de compras realizadas por otras cuentas: ni factura, ni
                fecha, ni precio, ni razón social.
              </p>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  if (result.status === 'NOT_FOUND') {
    return (
      <Card className="border-bad-200">
        <div className="p-5">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-bad-50 text-bad-600">
              <AlertTriangle className="size-4.5" aria-hidden />
            </span>
            <div>
              <h2 className="text-[15px] font-semibold text-ink-900">Serial no encontrado</h2>
              <p className="mt-1.5 text-[13px] leading-relaxed text-ink-600">{result.message}</p>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  const record = result.record!;
  const product = productBySku(record.sku);
  const expired = result.status === 'WARRANTY_EXPIRED';
  const openCase = result.status === 'RMA_ALREADY_OPEN';

  return (
    <div className="space-y-4">
      <Card className={cn(expired ? 'border-warn-200' : openCase ? 'border-tech-200' : 'border-ok-200')}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <span
              className={cn(
                'flex size-8 items-center justify-center rounded-lg',
                expired ? 'bg-warn-50 text-warn-600' : openCase ? 'bg-tech-50 text-tech-600' : 'bg-ok-50 text-ok-600',
              )}
            >
              {expired ? <ShieldOff className="size-4" aria-hidden /> : <CheckCircle2 className="size-4" aria-hidden />}
            </span>
            <div>
              <p className="text-[13px] font-semibold text-ink-900">
                {expired ? 'Garantía vencida' : openCase ? 'Ya existe una gestión abierta' : 'Producto en garantía'}
              </p>
              <p className="text-xs text-ink-500">{result.message}</p>
            </div>
          </div>
          {result.warrantyDaysRemaining !== null && !expired && (
            <Badge tone="ok">
              {result.warrantyDaysRemaining >= 365
                ? `${Math.floor(result.warrantyDaysRemaining / 365)} año(s) restantes`
                : `${result.warrantyDaysRemaining} días restantes`}
            </Badge>
          )}
        </div>

        <div className="flex flex-col gap-5 p-5 sm:flex-row">
          {product && (
            <div className="w-full shrink-0 sm:w-36">
              <ProductTile product={product} />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <Link to={`/catalogo/${record.sku}`} className="text-[15px] font-semibold text-ink-900 hover:text-ashir-700">
              {record.productName}
            </Link>
            <dl className="mt-3 divide-y divide-ink-100">
              <DataRow label="SKU" value={<Mono>{record.sku}</Mono>} />
              <DataRow label="Marca" value={record.brand} />
              <DataRow label="Número de serie" value={<Mono copy>{record.serial}</Mono>} />
              <DataRow
                label="Pedido"
                value={
                  <Link to={`/pedidos/${record.orderId}`} className="font-medium text-ashir-600 hover:text-ashir-700">
                    {record.orderNumber}
                  </Link>
                }
              />
              <DataRow label="Factura" value={<Mono>{record.invoiceNumber}</Mono>} />
              <DataRow label="Fecha de compra" value={fmtDate(record.purchasedAt)} />
              <DataRow label="Garantía" value={`${record.warrantyMonths} meses`} />
              <DataRow
                label="Vencimiento"
                value={
                  <span className={expired ? 'font-semibold text-bad-600' : 'font-medium text-ok-700'}>
                    {fmtDate(record.warrantyExpiresAt)}
                  </span>
                }
              />
              <DataRow label="Lote de importación" value={<Mono>{record.lotId}</Mono>} />
              {record.replacedBySerial && (
                <DataRow
                  label="Reemplazado por"
                  value={<Mono>{record.replacedBySerial}</Mono>}
                />
              )}
            </dl>
          </div>
        </div>
      </Card>

      {/* --- elegibilidad --- */}
      {result.eligibility && (
        <Card>
          <CardHeader title="Elegibilidad de la garantía" subtitle={result.eligibility.policyName} />
          <div className="p-5">
            <ul className="space-y-2">
              {result.eligibility.reasons.map((reason) => (
                <li key={reason} className="flex items-start gap-2 text-[13px] text-ink-700">
                  {result.eligibility!.eligible && !result.eligibility!.requiresManualReview ? (
                    <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-ok-500" aria-hidden />
                  ) : (
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warn-500" aria-hidden />
                  )}
                  {reason}
                </li>
              ))}
            </ul>
            {result.eligibility.requiresManualReview && (
              <Callout tone="warn" className="mt-3">
                El caso se va a marcar como «Requiere revisión manual». No es un rechazo: un técnico va a evaluar el
                producto antes de definir la cobertura.
              </Callout>
            )}
          </div>
        </Card>
      )}

      {/* --- acciones --- */}
      <div className="flex flex-wrap gap-2">
        {openCase ? (
          <Link to="/rma">
            <Button icon={<Wrench className="size-4" />}>Ver la gestión abierta</Button>
          </Link>
        ) : (
          <Button size="lg" icon={<Wrench className="size-4" />} onClick={onCreate} disabled={expired && false}>
            {expired ? 'Solicitar revisión paga' : 'Iniciar gestión de garantía'}
          </Button>
        )}
        <Link to={`/catalogo/${record.sku}`}>
          <Button variant="outline" size="lg">
            Comprar nuevamente
          </Button>
        </Link>
      </div>

      {expired && (
        <Callout tone="warn">
          La garantía de fábrica venció, pero podés iniciar igual una solicitud para una revisión técnica con cargo, o
          consultar con tu ejecutivo si el caso admite alguna excepción.
        </Callout>
      )}

      <SectionTitle
        title="Qué sigue después de iniciar la gestión"
        className="pt-2"
        subtitle="Validación de Ashir, envío o retiro, diagnóstico técnico y resolución. Vas a poder seguir cada etapa desde el portal."
      />
    </div>
  );
}
