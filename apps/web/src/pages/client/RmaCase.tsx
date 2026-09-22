/**
 * Detalle de una gestión de garantía, vista del reseller.
 */
import { Link, useParams } from 'react-router-dom';
import {
  Download,
  Package,
  Paperclip,
  Printer,
  QrCode,
  ShieldCheck,
  Truck,
  TriangleAlert,
} from 'lucide-react';
import { api } from '@/services';
import { useSession } from '@/app/session';
import { useAsync } from '@/app/hooks';
import { useToast } from '@/components/ui/overlays';
import { RMA_FLOW, RMA_RESOLUTION, RMA_STATUS, WARRANTY_FLAG } from '@/lib/labels';
import { fmtDate, fmtDateTime, fmtMoney } from '@/lib/utils';
import { Badge, Button, Card, CardHeader, Skeleton } from '@/components/ui/primitives';
import {
  Callout,
  DataRow,
  ErrorState,
  Mono,
  PageHeader,
  Stepper,
  Timeline,
} from '@/components/ui/data';
import { RmaStatusBadge, SlaIndicator } from '@/components/domain/common';

export function RmaCasePage() {
  const { id = '' } = useParams();
  const { session } = useSession();
  const toast = useToast();
  const rma = useAsync(() => api.rma.getCase(id, session), [id, session.customerId]);

  if (rma.error) {
    return (
      <Card>
        <ErrorState title="No pudimos abrir el caso" description={rma.error.message} onRetry={rma.refetch} />
      </Card>
    );
  }
  if (rma.initialLoading || !rma.data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-24 w-full rounded-card" />
        <Skeleton className="h-64 w-full rounded-card" />
      </div>
    );
  }

  const c = rma.data;
  const flowIndex = RMA_FLOW.indexOf(c.status);
  const awaitingShipment = c.status === 'AWAITING_SHIPMENT';

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'RMA', href: '/rma' }, { label: c.code }]}
        title={`Gestión ${c.code}`}
        subtitle={`Creada el ${fmtDateTime(c.createdAt)} · ${c.units.length} ${c.units.length === 1 ? 'unidad' : 'unidades'}${c.isBatch ? ' · gestión múltiple' : ''}`}
        badge={<RmaStatusBadge status={c.status} />}
        actions={
          <>
            {c.logistics.remitNumber && (
              <Button
                variant="outline"
                icon={<Printer className="size-4" />}
                onClick={() => toast.simulated('La impresión del remito')}
              >
                Imprimir remito
              </Button>
            )}
            <Button
              variant="outline"
              icon={<Download className="size-4" />}
              onClick={() => toast.simulated('La descarga del informe del caso')}
            >
              Descargar informe
            </Button>
          </>
        }
      />

      {/* --- aviso de acción pendiente --- */}
      {awaitingShipment && (
        <Callout
          tone="warn"
          icon={<Truck className="size-4" />}
          title="Tenés que enviar el producto"
          className="mb-5"
        >
          La gestión fue aprobada. Imprimí el remito {c.logistics.remitNumber} y la etiqueta {c.logistics.labelCode}, y
          despachá {c.logistics.expectedUnits === 1 ? 'la unidad' : `las ${c.logistics.expectedUnits} unidades`}
          {c.logistics.carrier ? ` por ${c.logistics.carrier}` : ''}. Sin la etiqueta no podemos asociar la recepción a
          tu caso.
        </Callout>
      )}
      {c.sla.breached && (
        <Callout tone="bad" icon={<TriangleAlert className="size-4" />} title="Caso demorado" className="mb-5">
          Este caso lleva más tiempo del comprometido en la etapa actual. Tu ejecutivo ya está notificado.
        </Callout>
      )}

      {/* --- timeline de etapas --- */}
      <Card className="mb-5 p-5">
        <Stepper
          steps={RMA_FLOW.filter((s) => s !== 'CLOSED' || true).map((s) => ({ label: RMA_STATUS[s].label }))}
          currentIndex={flowIndex >= 0 ? flowIndex : 0}
        />
        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-ink-100 pt-4 text-[13px]">
          <SlaIndicator sla={c.sla} />
          {c.sla.stage !== 'DONE' && !c.sla.pausedReason && (
            <span className="text-ink-500">
              Objetivo de la etapa: {c.sla.targetHours} h · vence el {fmtDate(c.sla.dueAt)}
            </span>
          )}
          {c.assignedTo && <span className="text-ink-500">Responsable: {c.assignedTo}</span>}
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-5">
          {/* --- unidades --- */}
          <Card>
            <CardHeader
              title="Unidades de la gestión"
              subtitle={c.isBatch ? 'Cada unidad se valida, diagnostica y resuelve por separado' : undefined}
              icon={<Package className="size-4" />}
            />
            <ul className="divide-y divide-ink-100">
              {c.units.map((unit) => (
                <li key={unit.id} className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link to={`/catalogo/${unit.sku}`} className="text-[13px] font-semibold text-ink-900 hover:text-ashir-700">
                        {unit.productName}
                      </Link>
                      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-ink-400">
                        <Mono copy>{unit.serial}</Mono>
                        <span>·</span>
                        <span>{unit.brand}</span>
                        <span>·</span>
                        <span>Lote {unit.lotId}</span>
                      </p>
                    </div>
                    <RmaStatusBadge status={unit.status} size="sm" />
                  </div>

                  <div className="mt-3 rounded-lg bg-ink-50 px-3.5 py-3">
                    <p className="text-[11px] font-semibold tracking-wide text-ink-500 uppercase">
                      Problema reportado · {unit.problemLabel}
                    </p>
                    <p className="mt-1 text-[13px] leading-relaxed text-ink-700">{unit.description}</p>
                    {unit.answers.length > 0 && (
                      <ul className="mt-2.5 space-y-1 border-t border-ink-200 pt-2.5">
                        {unit.answers.map((answer) => (
                          <li key={answer.question} className="flex flex-wrap justify-between gap-2 text-xs">
                            <span className="text-ink-500">{answer.question}</span>
                            <span className="font-medium text-ink-800">{answer.answer}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* elegibilidad */}
                  {unit.eligibility && (
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px]">
                      <ShieldCheck className="size-3.5 shrink-0 text-ink-400" aria-hidden />
                      <span className="text-ink-600">{unit.eligibility.policyName}</span>
                      <span className="text-ink-400">·</span>
                      <span className="text-ink-600">{unit.eligibility.warrantyMonths} meses</span>
                      {unit.eligibility.requiresManualReview && (
                        <Badge tone="warn" size="sm">
                          Requiere revisión manual
                        </Badge>
                      )}
                      {unit.eligibility.flags.length > 0 &&
                        unit.eligibility.flags.map((flag) => (
                          <Badge key={flag.code} tone="bad" size="sm">
                            {WARRANTY_FLAG[flag.code]}
                          </Badge>
                        ))}
                    </div>
                  )}

                  {/* diagnóstico visible para el cliente */}
                  {unit.diagnosis && (
                    <div className="mt-3 rounded-lg border border-tech-100 bg-tech-50 px-3.5 py-3">
                      <p className="text-[11px] font-semibold tracking-wide text-tech-700 uppercase">
                        Diagnóstico técnico · {fmtDate(unit.diagnosis.at)}
                      </p>
                      <p className="mt-1 text-[13px] leading-relaxed text-ink-700">{unit.diagnosis.findings}</p>
                      <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-ink-500">
                        <span>Pruebas: {unit.diagnosis.testsPerformed.join(', ')}</span>
                        <span>·</span>
                        <span>
                          Falla {unit.diagnosis.faultConfirmed ? 'confirmada' : 'no reproducida'} (
                          <code className="font-mono">{unit.diagnosis.faultCode}</code>)
                        </span>
                      </p>
                    </div>
                  )}

                  {/* resolución */}
                  {unit.resolution && (
                    <div className="mt-3 rounded-lg border border-ok-100 bg-ok-50 px-3.5 py-3">
                      <p className="flex flex-wrap items-center gap-2 text-[11px] font-semibold tracking-wide text-ok-700 uppercase">
                        Resolución · {fmtDate(unit.resolution.at)}
                        <Badge tone={RMA_RESOLUTION[unit.resolution.type].tone} size="sm">
                          {RMA_RESOLUTION[unit.resolution.type].label}
                        </Badge>
                      </p>
                      <p className="mt-1.5 text-[13px] leading-relaxed text-ink-700">{unit.resolution.notes}</p>
                      <dl className="mt-2 space-y-1 border-t border-ok-100 pt-2 text-xs">
                        {unit.resolution.replacementSerial && (
                          <div className="flex justify-between gap-2">
                            <dt className="text-ink-500">Serial de reemplazo</dt>
                            <dd className="font-mono font-medium text-ink-800">{unit.resolution.replacementSerial}</dd>
                          </div>
                        )}
                        {unit.resolution.creditNoteNumber && (
                          <div className="flex justify-between gap-2">
                            <dt className="text-ink-500">Nota de crédito</dt>
                            <dd className="font-mono font-medium text-ink-800">{unit.resolution.creditNoteNumber}</dd>
                          </div>
                        )}
                        {unit.resolution.creditAmount && (
                          <div className="flex justify-between gap-2">
                            <dt className="text-ink-500">Importe acreditado</dt>
                            <dd className="font-medium tabular-nums text-ink-800">{fmtMoney(unit.resolution.creditAmount)}</dd>
                          </div>
                        )}
                        {unit.resolution.resultingWarrantyExpiresAt && (
                          <div className="flex justify-between gap-2">
                            <dt className="text-ink-500">Garantía resultante</dt>
                            <dd className="font-medium text-ink-800">
                              hasta el {fmtDate(unit.resolution.resultingWarrantyExpiresAt)}
                            </dd>
                          </div>
                        )}
                        <div className="flex justify-between gap-2">
                          <dt className="text-ink-500">Responsable</dt>
                          <dd className="font-medium text-ink-800">{unit.resolution.approvedBy}</dd>
                        </div>
                      </dl>
                    </div>
                  )}

                  {unit.receptionIssue && unit.receptionIssue !== 'NONE' && (
                    <Callout tone="warn" className="mt-3">
                      En la recepción se registró una discrepancia:{' '}
                      {unit.receptionIssue === 'VISIBLE_DAMAGE'
                        ? 'daño visible en el embalaje'
                        : unit.receptionIssue === 'MISSING'
                          ? 'la unidad no llegó con el envío'
                          : unit.receptionIssue === 'WRONG_SERIAL'
                            ? 'el serial recibido no coincide con el declarado'
                            : 'llegó una unidad adicional no declarada'}
                      .
                    </Callout>
                  )}
                </li>
              ))}
            </ul>
          </Card>

          {/* --- timeline completo --- */}
          <Card>
            <CardHeader title="Seguimiento" subtitle="Cada evento con fecha, responsable y documentos" />
            <div className="p-5">
              <Timeline
                items={c.timeline.map((event, i) => ({
                  id: event.id,
                  title: event.label,
                  at: fmtDateTime(event.at),
                  actor: event.actor,
                  actorRole:
                    event.actorRole === 'CLIENT'
                      ? 'Cliente'
                      : event.actorRole === 'RMA'
                        ? 'Técnico Ashir'
                        : event.actorRole === 'SYSTEM'
                          ? 'Sistema'
                          : String(event.actorRole),
                  comment: event.comment ?? undefined,
                  documents: event.documents,
                  tone: i === c.timeline.length - 1 ? (c.status === 'REJECTED' ? 'bad' : 'ok') : 'tech',
                  current: i === c.timeline.length - 1,
                }))}
              />
            </div>
          </Card>
        </div>

        {/* ---------------- columna derecha ---------------- */}
        <div className="space-y-4">
          <Card>
            <CardHeader title="Logística" icon={<Truck className="size-4" />} />
            <div className="p-5">
              <div className="space-y-0.5">
                <DataRow
                  label="Modalidad"
                  value={
                    c.logistics.mode === 'CARRIER'
                      ? 'Envío por transporte'
                      : c.logistics.mode === 'PICKUP'
                        ? 'Retiro a domicilio'
                        : 'Entrega en depósito'
                  }
                />
                {c.logistics.carrier && <DataRow label="Transporte" value={c.logistics.carrier} />}
                {c.logistics.remitNumber && <DataRow label="Remito" value={<Mono copy>{c.logistics.remitNumber}</Mono>} />}
                {c.logistics.labelCode && <DataRow label="Etiqueta" value={<Mono copy>{c.logistics.labelCode}</Mono>} />}
                <DataRow
                  label="Unidades recibidas"
                  value={`${c.logistics.receivedUnits} de ${c.logistics.expectedUnits}`}
                  emphasis
                />
              </div>

              {c.logistics.receptionNotes && (
                <Callout tone="warn" className="mt-3">
                  {c.logistics.receptionNotes}
                </Callout>
              )}

              {c.logistics.labelCode && (
                <div className="mt-4 print-sheet rounded-lg border border-ink-300 border-dashed p-4 text-center">
                  <QrCode className="mx-auto size-16 text-ink-300" aria-hidden />
                  <p className="mt-2 font-mono text-[11px] font-semibold text-ink-700">{c.logistics.labelCode}</p>
                  <p className="text-[10px] text-ink-400">Código de la gestión · escanear en recepción</p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-3 w-full no-print"
                    icon={<Printer className="size-3.5" />}
                    onClick={() => window.print()}
                  >
                    Imprimir etiqueta
                  </Button>
                </div>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Datos del caso" />
            <div className="space-y-0.5 p-5">
              <DataRow label="Código" value={<Mono copy>{c.code}</Mono>} />
              <DataRow label="Prioridad" value={c.priority === 'CRITICAL' ? 'Crítica' : c.priority === 'HIGH' ? 'Alta' : 'Normal'} />
              <DataRow label="Creado" value={fmtDate(c.createdAt)} />
              {c.closedAt && <DataRow label="Cerrado" value={fmtDate(c.closedAt)} />}
              <DataRow label="Responsable" value={c.assignedTo ?? 'Pendiente de asignación'} />
            </div>
          </Card>

          {c.attachments.length > 0 && (
            <Card>
              <CardHeader title="Evidencia adjunta" icon={<Paperclip className="size-4" />} />
              <ul className="divide-y divide-ink-100 px-5">
                {c.attachments.map((file) => (
                  <li key={file.name} className="flex items-center justify-between gap-2 py-2.5">
                    <span className="min-w-0 truncate text-[13px] text-ink-700">{file.name}</span>
                    <span className="shrink-0 text-[11px] text-ink-400">{file.size}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Link to="/rma" className="block">
            <Button variant="outline" className="w-full">
              Volver a mis gestiones
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
