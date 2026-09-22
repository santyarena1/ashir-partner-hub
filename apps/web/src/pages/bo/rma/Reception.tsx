/**
 * Recepción de mercadería de RMA.
 *
 * Escanear el código del caso, verificar unidades esperadas, registrar
 * seriales recibidos y anotar discrepancias.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Camera,
  Check,
  PackageCheck,
  PackageSearch,
  QrCode,
  Scan,
  X,
} from 'lucide-react';
import type { RmaCase, RmaUnit } from '@/types';
import { api } from '@/services';
import { useSession } from '@/app/session';
import { useAction, useAsync } from '@/app/hooks';
import { useToast } from '@/components/ui/overlays';
import { can } from '@/lib/rbac';
import { cn, fmtDate, fmtRelative } from '@/lib/utils';
import { Badge, Button, Card, CardHeader, Field, Input, Select, Textarea } from '@/components/ui/primitives';
import {
  Callout,
  DataRow,
  EmptyState,
  ForbiddenState,
  Mono,
  PageHeader,
  SectionTitle,
  StatGrid,
  StatTile,
} from '@/components/ui/data';
import { RmaStatusBadge } from '@/components/domain/common';

type Issue = RmaUnit['receptionIssue'];

const ISSUE_LABEL: Record<NonNullable<Issue>, string> = {
  NONE: 'Sin novedades',
  MISSING: 'Unidad faltante',
  WRONG_SERIAL: 'Serial incorrecto',
  EXTRA: 'Unidad adicional no declarada',
  VISIBLE_DAMAGE: 'Daño visible en el embalaje',
};

export function RmaReception() {
  const { session } = useSession();
  const toast = useToast();
  const [scan, setScan] = useState('');
  const [selected, setSelected] = useState<RmaCase | null>(null);
  const [received, setReceived] = useState<Record<string, Issue>>({});
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState(0);

  const cases = useAsync(() => api.rma.listCases({ status: 'AWAITING_SHIPMENT' }, session), [session.role]);
  const receive = useAction(() =>
    api.rma.receive(
      selected!.id,
      Object.entries(received).map(([serial, issue]) => ({ serial, issue })),
      notes,
      session,
    ),
  );

  if (!can(session, 'rma:manage')) {
    return (
      <Card>
        <ForbiddenState scope="rma:manage" />
      </Card>
    );
  }

  const pending = cases.data ?? [];

  const openCase = (rmaCase: RmaCase) => {
    setSelected(rmaCase);
    setReceived({});
    setNotes('');
    setPhotos(0);
  };

  const findByCode = (code: string) => {
    const normalized = code.trim().toUpperCase();
    const found = pending.find(
      (c) => c.code.toUpperCase() === normalized || c.logistics.labelCode?.toUpperCase() === normalized || c.logistics.remitNumber?.toUpperCase() === normalized,
    );
    if (found) {
      openCase(found);
      setScan('');
    } else {
      toast.warning('No encontramos ese código', 'Verificá la etiqueta o elegí el caso de la lista de esperados.');
    }
  };

  const expectedUnits = selected?.units ?? [];
  const allMarked = expectedUnits.length > 0 && expectedUnits.every((u) => received[u.serial] !== undefined);
  const withIssues = Object.values(received).filter((i) => i && i !== 'NONE').length;

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'Centro de RMA', href: '/bo/rma' }, { label: 'Recepción' }]}
        title="Recepción de mercadería"
        subtitle="Escaneá el código del caso, verificá los seriales y registrá cualquier discrepancia antes de pasar a diagnóstico."
      />

      <StatGrid cols={4} className="mb-6">
        <StatTile label="Casos esperando recepción" value={pending.length} icon={<PackageSearch className="size-4" />} tone="warn" />
        <StatTile
          label="Unidades esperadas"
          value={pending.reduce((a, c) => a + c.logistics.expectedUnits, 0)}
          icon={<PackageCheck className="size-4" />}
        />
        <StatTile
          label="Gestiones múltiples"
          value={pending.filter((c) => c.isBatch).length}
          footer="Varias unidades bajo un mismo remito"
        />
        <StatTile
          label="Prioridad alta o crítica"
          value={pending.filter((c) => c.priority === 'HIGH' || c.priority === 'CRITICAL').length}
          tone="bad"
        />
      </StatGrid>

      <div className="grid gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
        {/* ---------------- escaneo y lista ---------------- */}
        <div className="space-y-4">
          <Card>
            <CardHeader title="Escanear recepción" icon={<Scan className="size-4" />} />
            <div className="p-5">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  findByCode(scan);
                }}
              >
                <Field label="Código del caso, etiqueta o remito" htmlFor="scan-input">
                  <Input
                    id="scan-input"
                    value={scan}
                    onChange={(e) => setScan(e.target.value.toUpperCase())}
                    placeholder="ETQ-RMA-260194"
                    leading={<QrCode className="size-4" />}
                    className="font-mono"
                    autoComplete="off"
                  />
                </Field>
                <Button type="submit" className="mt-3 w-full">
                  Buscar caso
                </Button>
              </form>
              <p className="mt-2 text-[11px] leading-relaxed text-ink-400">
                En producción este campo recibiría la lectura del escáner de códigos del depósito.
              </p>
            </div>
          </Card>

          <Card>
            <CardHeader title="Esperando recepción" subtitle={`${pending.length} casos`} />
            <div className="max-h-[420px] overflow-y-auto">
              {pending.length === 0 ? (
                <EmptyState compact title="No hay envíos pendientes" icon={<PackageCheck className="size-5" />} />
              ) : (
                <ul className="divide-y divide-ink-100">
                  {pending.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => openCase(c)}
                        className={cn(
                          'w-full px-4 py-3 text-left transition-colors hover:bg-ink-50',
                          selected?.id === c.id && 'bg-ashir-50',
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-[13px] font-semibold text-ink-900">{c.code}</span>
                          <Badge tone="neutral" size="sm">
                            {c.logistics.expectedUnits} u.
                          </Badge>
                        </div>
                        <p className="mt-0.5 truncate text-[11px] text-ink-500">{c.customerName}</p>
                        <p className="mt-0.5 flex items-center gap-2 text-[11px] text-ink-400">
                          <Mono>{c.logistics.labelCode ?? c.code}</Mono>
                          <span>{fmtRelative(c.updatedAt)}</span>
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>
        </div>

        {/* ---------------- detalle de la recepción ---------------- */}
        <div className="min-w-0">
          {!selected ? (
            <Card>
              <EmptyState
                title="Elegí un caso para registrar la recepción"
                description="Escaneá la etiqueta del bulto o seleccioná uno de los envíos esperados."
                icon={<PackageSearch className="size-5" />}
              />
            </Card>
          ) : (
            <div className="space-y-5">
              <Card>
                <CardHeader
                  title={
                    <span className="flex flex-wrap items-center gap-2">
                      {selected.code}
                      <RmaStatusBadge status={selected.status} size="sm" />
                    </span>
                  }
                  subtitle={`${selected.customerName} · creado el ${fmtDate(selected.createdAt)}`}
                  action={
                    <Link to={`/bo/rma/${selected.id}`} className="text-[13px] font-medium text-ashir-600 hover:text-ashir-700">
                      Ver caso
                    </Link>
                  }
                />
                <div className="grid gap-x-6 p-5 sm:grid-cols-2">
                  <DataRow label="Remito" value={<Mono>{selected.logistics.remitNumber ?? '—'}</Mono>} />
                  <DataRow label="Etiqueta" value={<Mono>{selected.logistics.labelCode ?? '—'}</Mono>} />
                  <DataRow label="Transporte" value={selected.logistics.carrier ?? 'Retiro / entrega directa'} />
                  <DataRow label="Unidades esperadas" value={selected.logistics.expectedUnits} emphasis />
                </div>
              </Card>

              <SectionTitle
                title="Verificación de unidades"
                subtitle="Marcá el estado de cada serial recibido"
              />
              <Card>
                <ul className="divide-y divide-ink-100">
                  {expectedUnits.map((unit) => {
                    const issue = received[unit.serial];
                    return (
                      <li key={unit.id} className="p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="flex flex-wrap items-center gap-2 text-[13px] font-semibold text-ink-900">
                              <Mono copy>{unit.serial}</Mono>
                              {issue !== undefined && (
                                <Badge tone={issue === 'NONE' ? 'ok' : 'warn'} size="sm">
                                  {ISSUE_LABEL[issue ?? 'NONE']}
                                </Badge>
                              )}
                            </p>
                            <p className="mt-0.5 truncate text-xs text-ink-500">
                              {unit.productName} · {unit.problemLabel}
                            </p>
                          </div>

                          <div className="flex shrink-0 flex-wrap items-center gap-2">
                            <Select
                              value={issue ?? ''}
                              onChange={(e) =>
                                setReceived((prev) => ({ ...prev, [unit.serial]: (e.target.value || 'NONE') as Issue }))
                              }
                              className="h-8 w-auto min-w-[190px] text-[13px]"
                              aria-label={`Estado de recepción de ${unit.serial}`}
                            >
                              <option value="">Sin verificar</option>
                              {(Object.keys(ISSUE_LABEL) as NonNullable<Issue>[]).map((key) => (
                                <option key={key} value={key}>
                                  {ISSUE_LABEL[key]}
                                </option>
                              ))}
                            </Select>
                            <Button
                              size="sm"
                              variant={issue === 'NONE' ? 'primary' : 'outline'}
                              icon={<Check className="size-3.5" />}
                              onClick={() => setReceived((prev) => ({ ...prev, [unit.serial]: 'NONE' }))}
                            >
                              Recibida
                            </Button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </Card>

              <Card>
                <CardHeader title="Registro de la recepción" icon={<Camera className="size-4" />} />
                <div className="space-y-4 p-5">
                  <div className="flex flex-wrap items-center gap-3">
                    <Button variant="outline" icon={<Camera className="size-4" />} onClick={() => setPhotos((p) => p + 1)}>
                      Registrar foto de recepción
                    </Button>
                    {photos > 0 && (
                      <Badge tone="ok" size="sm">
                        {photos} foto(s) registradas
                      </Badge>
                    )}
                  </div>

                  <Field label="Observaciones de la recepción" htmlFor="rec-notes">
                    <Textarea
                      id="rec-notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={3}
                      placeholder="El bulto llegó con un golpe en una esquina. Se fotografió antes de abrirlo."
                    />
                  </Field>

                  {withIssues > 0 && (
                    <Callout tone="warn" icon={<AlertTriangle className="size-4" />}>
                      Hay {withIssues} discrepancia(s) registradas. Van a quedar visibles en el caso y en el portal del
                      cliente.
                    </Callout>
                  )}

                  {!allMarked && (
                    <Callout tone="neutral">
                      Verificá las {expectedUnits.length} unidades esperadas antes de confirmar. Si alguna no llegó,
                      marcala como «Unidad faltante».
                    </Callout>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="lg"
                      icon={<PackageCheck className="size-4" />}
                      loading={receive.pending}
                      disabled={Object.keys(received).length === 0}
                      onClick={async () => {
                        const result = await receive.run();
                        if (result) {
                          toast.success(
                            `Recepción de ${selected.code} registrada`,
                            'El caso pasó a diagnóstico técnico.',
                          );
                          setSelected(null);
                          cases.refetch();
                        } else if (receive.error) {
                          toast.error('No pudimos registrar la recepción', receive.error.message);
                        }
                      }}
                    >
                      Confirmar recepción
                    </Button>
                    <Button variant="ghost" icon={<X className="size-4" />} onClick={() => setSelected(null)}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
