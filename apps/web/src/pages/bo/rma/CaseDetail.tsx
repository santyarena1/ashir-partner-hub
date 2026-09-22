/**
 * Detalle interno de un caso de RMA.
 * Permite aprobar la recepción, registrar diagnóstico y resolver cada unidad.
 */
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Boxes,
  Check,
  FileText,
  History,
  Package,
  PackageCheck,
  ShieldCheck,
  Truck,
  TriangleAlert,
  Wrench,
} from 'lucide-react';
import type { RmaResolutionType, RmaUnit, WarrantyFlagCode } from '@/types';
import { api } from '@/services';
import { useSession } from '@/app/session';
import { useAction, useAsync } from '@/app/hooks';
import { useToast, Dialog } from '@/components/ui/overlays';
import { customerById } from '@/mocks/fixtures/customers';
import { lotByCode } from '@/mocks/fixtures/serials';
import { can } from '@/lib/rbac';
import { RMA_FLOW, RMA_RESOLUTION, RMA_STATUS, WARRANTY_FLAG } from '@/lib/labels';
import { addMonths, cn, fmtDate, fmtDateTime, fmtMoney, fmtNumber } from '@/lib/utils';
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
  Textarea,
} from '@/components/ui/primitives';
import {
  Callout,
  DataRow,
  ErrorState,
  Mono,
  PageHeader,
  SectionTitle,
  Stepper,
  Timeline,
} from '@/components/ui/data';
import { RmaStatusBadge, SegmentBadge, SlaIndicator } from '@/components/domain/common';

const FAULT_CODES = [
  'GPU-NOSIG-02',
  'PSU-OCP-11',
  'MB-POST-07',
  'MEM-ECC-03',
  'SSD-CTRL-05',
  'COOL-PUMP-01',
  'NFF-000',
];

const TESTS = ['Banco de pruebas', 'Inspección visual', 'Medición de consumo', 'Prueba cruzada de fuente', 'Test de estrés'];

export function RmaCaseBackoffice() {
  const { id = '' } = useParams();
  const { session } = useSession();
  const toast = useToast();
  const [diagnosisUnit, setDiagnosisUnit] = useState<RmaUnit | null>(null);
  const [resolutionUnit, setResolutionUnit] = useState<RmaUnit | null>(null);

  const rma = useAsync(() => api.rma.getCase(id, session), [id, session.role]);
  const approve = useAction(() => api.rma.approveReception(id, session));

  const canManage = can(session, 'rma:manage');

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
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full rounded-card" />
      </div>
    );
  }

  const c = rma.data;
  const customer = customerById(c.customerId);
  const lot = c.units[0] ? lotByCode(c.units[0].lotId) : undefined;

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'Centro de RMA', href: '/bo/rma' }, { label: c.code }]}
        title={`${c.code} · ${c.customerName}`}
        subtitle={`Creado ${fmtDateTime(c.createdAt)} · ${c.units.length} ${c.units.length === 1 ? 'unidad' : 'unidades'}${c.isBatch ? ' · gestión múltiple' : ''} · responsable ${c.assignedTo ?? 'sin asignar'}`}
        badge={
          <span className="flex items-center gap-2">
            <RmaStatusBadge status={c.status} />
            {c.priority === 'CRITICAL' && <Badge tone="bad">Prioridad crítica</Badge>}
          </span>
        }
        actions={
          canManage && c.status === 'SUBMITTED' ? (
            <Button
              icon={<Check className="size-4" />}
              loading={approve.pending}
              onClick={async () => {
                await approve.run();
                toast.success('Recepción aprobada', 'Se emitió el remito y la etiqueta para que el cliente despache.');
                rma.refetch();
              }}
            >
              Aprobar recepción
            </Button>
          ) : canManage && c.status === 'AWAITING_SHIPMENT' ? (
            <Link to="/bo/rma/recepcion">
              <Button icon={<PackageCheck className="size-4" />}>Ir a recepción</Button>
            </Link>
          ) : undefined
        }
      />

      {/* --- alertas --- */}
      <div className="mb-5 space-y-2">
        {c.sla.breached && (
          <Callout tone="bad" icon={<TriangleAlert className="size-4" />} title="Caso fuera de SLA">
            Lleva {Math.round(c.sla.elapsedHours / 24)} días en la etapa actual, con un objetivo de{' '}
            {c.sla.targetHours} horas. Priorizá su resolución o registrá el motivo de la demora.
          </Callout>
        )}
        {c.logistics.receivedUnits < c.logistics.expectedUnits && c.logistics.receivedUnits > 0 && (
          <Callout tone="warn" icon={<Package className="size-4" />} title="Discrepancia en la recepción">
            Se esperaban {c.logistics.expectedUnits} unidades y se recibieron {c.logistics.receivedUnits}.{' '}
            {c.logistics.receptionNotes}
          </Callout>
        )}
        {lot?.incidentSuspected && (
          <Callout
            tone="bad"
            icon={<Boxes className="size-4" />}
            title="El lote de este producto tiene una incidencia detectada"
            action={
              <Link to={`/bo/rma/lotes/${lot.code}`}>
                <Button size="sm" variant="outline">
                  Ver lote
                </Button>
              </Link>
            }
          >
            {lot.code} presenta una tasa de RMA de {lot.rmaRatePct}% contra un promedio de marca de{' '}
            {lot.brandAverageRatePct}%.
          </Callout>
        )}
      </div>

      <Card className="mb-5 p-5">
        <Stepper steps={RMA_FLOW.map((s) => ({ label: RMA_STATUS[s].label }))} currentIndex={Math.max(0, RMA_FLOW.indexOf(c.status))} />
        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-ink-100 pt-4 text-[13px]">
          <SlaIndicator sla={c.sla} />
          <span className="text-ink-500">
            Etapa {c.sla.stage === 'VALIDATION' ? 'validación' : c.sla.stage === 'DIAGNOSIS' ? 'diagnóstico' : c.sla.stage === 'RESOLUTION' ? 'resolución' : 'cerrada'} · objetivo{' '}
            {c.sla.targetHours} h · vence {fmtDate(c.sla.dueAt)}
          </span>
          {c.sla.pausedReason && <Badge tone="neutral">SLA pausado: {c.sla.pausedReason}</Badge>}
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-5">
          {/* ---------- unidades ---------- */}
          <SectionTitle title="Unidades del caso" subtitle="Cada unidad se diagnostica y se resuelve por separado" />
          {c.units.map((unit) => (
            <Card key={unit.id}>
              <CardHeader
                title={unit.productName}
                subtitle={
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <Mono copy>{unit.serial}</Mono>
                    <span>·</span>
                    <span>{unit.sku}</span>
                    <span>·</span>
                    <span>{unit.brand}</span>
                    <span>·</span>
                    <Link to={`/bo/rma/lotes/${unit.lotId}`} className="text-ashir-600 hover:text-ashir-700">
                      {unit.lotId}
                    </Link>
                  </span>
                }
                action={<RmaStatusBadge status={unit.status} size="sm" />}
              />

              <div className="space-y-4 p-5">
                {/* problema */}
                <div className="rounded-lg bg-ink-50 px-3.5 py-3">
                  <p className="text-[11px] font-semibold tracking-wide text-ink-500 uppercase">
                    Reportado por el cliente · {unit.problemLabel}
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
                  {c.troubleshootingOutcome && (
                    <p className="mt-2 text-[11px] text-ink-400">
                      Diagnóstico previo:{' '}
                      {c.troubleshootingOutcome === 'ALREADY_TRIED'
                        ? 'el cliente declaró haber hecho las pruebas sugeridas'
                        : c.troubleshootingOutcome === 'CONTINUED'
                          ? 'el cliente continuó sin realizar las pruebas'
                          : 'el problema se había resuelto con las pruebas'}
                      .
                    </p>
                  )}
                </div>

                {/* elegibilidad */}
                {unit.eligibility && (
                  <div
                    className={cn(
                      'rounded-lg border px-3.5 py-3',
                      unit.eligibility.eligible && !unit.eligibility.requiresManualReview
                        ? 'border-ok-100 bg-ok-50'
                        : 'border-warn-100 bg-warn-50',
                    )}
                  >
                    <p className="flex flex-wrap items-center gap-2 text-[11px] font-semibold tracking-wide uppercase">
                      <ShieldCheck className="size-3.5" aria-hidden />
                      {unit.eligibility.policyName} · {unit.eligibility.warrantyMonths} meses
                      {unit.eligibility.requiresManualReview && (
                        <Badge tone="warn" size="sm">
                          Requiere revisión manual
                        </Badge>
                      )}
                    </p>
                    <ul className="mt-1.5 space-y-0.5">
                      {unit.eligibility.reasons.map((reason) => (
                        <li key={reason} className="text-[13px] text-ink-700">
                          {reason}
                        </li>
                      ))}
                    </ul>
                    {unit.eligibility.flags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5 border-t border-warn-100 pt-2">
                        {unit.eligibility.flags.map((flag) => (
                          <Badge key={flag.code} tone="bad" size="sm" title={flag.note}>
                            {WARRANTY_FLAG[flag.code]}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* diagnóstico */}
                {unit.diagnosis ? (
                  <div className="rounded-lg border border-tech-100 bg-tech-50 px-3.5 py-3">
                    <p className="text-[11px] font-semibold tracking-wide text-tech-700 uppercase">
                      Diagnóstico · {fmtDate(unit.diagnosis.at)} · {unit.diagnosis.technician}
                    </p>
                    <p className="mt-1 text-[13px] leading-relaxed text-ink-700">{unit.diagnosis.findings}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                      <Badge tone={unit.diagnosis.faultConfirmed ? 'bad' : 'ok'} size="sm">
                        {unit.diagnosis.faultConfirmed ? 'Falla confirmada' : 'Sin falla detectada'}
                      </Badge>
                      <Mono>{unit.diagnosis.faultCode}</Mono>
                      <span className="text-ink-500">Pruebas: {unit.diagnosis.testsPerformed.join(', ')}</span>
                      <Badge tone="tech" size="sm">
                        Recomendación: {RMA_RESOLUTION[unit.diagnosis.recommendation].label}
                      </Badge>
                    </div>
                  </div>
                ) : (
                  canManage &&
                  unit.receivedAt && (
                    <Button variant="outline" icon={<Wrench className="size-4" />} onClick={() => setDiagnosisUnit(unit)}>
                      Registrar diagnóstico
                    </Button>
                  )
                )}

                {/* resolución */}
                {unit.resolution ? (
                  <div className="rounded-lg border border-ok-100 bg-ok-50 px-3.5 py-3">
                    <p className="flex flex-wrap items-center gap-2 text-[11px] font-semibold tracking-wide text-ok-700 uppercase">
                      Resolución · {fmtDate(unit.resolution.at)} · {unit.resolution.approvedBy}
                      <Badge tone={RMA_RESOLUTION[unit.resolution.type].tone} size="sm">
                        {RMA_RESOLUTION[unit.resolution.type].label}
                      </Badge>
                    </p>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-ink-700">{unit.resolution.notes}</p>
                    <dl className="mt-2 grid gap-x-6 border-t border-ok-100 pt-2 text-xs sm:grid-cols-2">
                      {unit.resolution.replacementSerial && (
                        <DataRow label="Serial de reemplazo" value={<Mono>{unit.resolution.replacementSerial}</Mono>} />
                      )}
                      {unit.resolution.creditNoteNumber && (
                        <DataRow label="Nota de crédito" value={<Mono>{unit.resolution.creditNoteNumber}</Mono>} />
                      )}
                      {unit.resolution.creditAmount && (
                        <DataRow label="Importe" value={fmtMoney(unit.resolution.creditAmount)} />
                      )}
                      {unit.resolution.resultingWarrantyExpiresAt && (
                        <DataRow label="Garantía resultante" value={fmtDate(unit.resolution.resultingWarrantyExpiresAt)} />
                      )}
                    </dl>
                  </div>
                ) : (
                  canManage &&
                  unit.diagnosis && (
                    <Button icon={<Check className="size-4" />} onClick={() => setResolutionUnit(unit)}>
                      Registrar resolución
                    </Button>
                  )
                )}
              </div>
            </Card>
          ))}

          {/* ---------- auditoría ---------- */}
          <Card>
            <CardHeader title="Auditoría del caso" icon={<History className="size-4" />} />
            <div className="p-5">
              <Timeline
                items={c.auditLog.map((event, i) => ({
                  id: event.id,
                  title: event.action,
                  at: fmtDateTime(event.at),
                  actor: event.actor,
                  actorRole: `${event.actorRole} · ${event.origin}`,
                  comment: (
                    <>
                      {event.comment}
                      <span className="mt-1 block font-mono text-[11px] text-ink-400">
                        {event.previousValue ?? '—'} → {event.newValue ?? '—'} · {event.requestId}
                      </span>
                    </>
                  ),
                  tone: i === c.auditLog.length - 1 ? 'ok' : 'tech',
                  current: i === c.auditLog.length - 1,
                }))}
              />
            </div>
          </Card>
        </div>

        {/* ---------------- panel derecho ---------------- */}
        <div className="space-y-4">
          {customer && (
            <Card>
              <CardHeader
                title="Cliente"
                action={
                  <Link to={`/bo/clientes/${customer.id}`} className="text-[13px] font-medium text-ashir-600 hover:text-ashir-700">
                    Ver ficha
                  </Link>
                }
              />
              <div className="space-y-0.5 p-5">
                <DataRow label="Razón social" value={customer.legalName} />
                <DataRow label="Segmento" value={<SegmentBadge segment={customer.segment} size="sm" />} />
                <DataRow label="Ejecutivo" value={customer.salesRepId.replace('usr_', '')} />
                <DataRow label="Zona" value={customer.zone} />
                <DataRow label="Compras 12 m" value={fmtMoney(customer.purchases12m, { compact: true })} />
              </div>
            </Card>
          )}

          <Card>
            <CardHeader title="Logística" icon={<Truck className="size-4" />} />
            <div className="space-y-0.5 p-5">
              <DataRow
                label="Modalidad"
                value={c.logistics.mode === 'CARRIER' ? 'Transporte' : c.logistics.mode === 'PICKUP' ? 'Retiro a domicilio' : 'Entrega en depósito'}
              />
              {c.logistics.carrier && <DataRow label="Transporte" value={c.logistics.carrier} />}
              {c.logistics.remitNumber && <DataRow label="Remito" value={<Mono copy>{c.logistics.remitNumber}</Mono>} />}
              <DataRow label="Etiqueta" value={<Mono copy>{c.logistics.labelCode ?? '—'}</Mono>} />
              <DataRow
                label="Unidades"
                value={
                  <span className={c.logistics.receivedUnits < c.logistics.expectedUnits ? 'font-semibold text-warn-700' : ''}>
                    {c.logistics.receivedUnits} de {c.logistics.expectedUnits} recibidas
                  </span>
                }
                emphasis
              />
              <DataRow label="Fotos de recepción" value={c.logistics.receptionPhotos} />
            </div>
          </Card>

          {c.attachments.length > 0 && (
            <Card>
              <CardHeader title="Evidencia" icon={<FileText className="size-4" />} />
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

          {lot && (
            <Card>
              <CardHeader title="Lote de importación" icon={<Boxes className="size-4" />} />
              <div className="space-y-0.5 p-5">
                <DataRow label="Lote" value={<Mono>{lot.code}</Mono>} />
                <DataRow label="Unidades vendidas" value={fmtNumber(lot.unitsSold)} />
                <DataRow label="RMAs del lote" value={fmtNumber(lot.rmaCount)} />
                <DataRow
                  label="Tasa del lote"
                  value={
                    <span className={lot.incidentSuspected ? 'font-semibold text-bad-600' : ''}>
                      {lot.rmaRatePct}%
                    </span>
                  }
                  emphasis
                />
                <DataRow label="Promedio de la marca" value={`${lot.brandAverageRatePct}%`} />
              </div>
              <div className="border-t border-ink-100 px-5 py-3">
                <Link to={`/bo/rma/lotes/${lot.code}`}>
                  <Button variant="outline" size="sm" className="w-full">
                    Analizar el lote
                  </Button>
                </Link>
              </div>
            </Card>
          )}

          {!canManage && (
            <Callout tone="neutral">
              Tu rol puede consultar el caso pero no operarlo. Cambiá a RMA/Técnico o Administrador para registrar
              recepciones, diagnósticos y resoluciones.
            </Callout>
          )}
        </div>
      </div>

      <DiagnosisDialog
        unit={diagnosisUnit}
        onClose={() => setDiagnosisUnit(null)}
        caseId={c.id}
        onSaved={() => {
          rma.refetch();
          toast.success('Diagnóstico registrado');
        }}
      />
      <ResolutionDialog
        unit={resolutionUnit}
        onClose={() => setResolutionUnit(null)}
        caseId={c.id}
        onSaved={() => {
          rma.refetch();
          toast.success('Resolución registrada', 'El cliente recibió la notificación en su portal.');
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* diagnóstico                                                         */
/* ------------------------------------------------------------------ */

function DiagnosisDialog({
  unit,
  onClose,
  caseId,
  onSaved,
}: {
  unit: RmaUnit | null;
  onClose: () => void;
  caseId: string;
  onSaved: () => void;
}) {
  const { session } = useSession();
  const toast = useToast();
  const [faultConfirmed, setFaultConfirmed] = useState(true);
  const [faultCode, setFaultCode] = useState(FAULT_CODES[0]!);
  const [findings, setFindings] = useState('');
  const [tests, setTests] = useState<string[]>(['Banco de pruebas', 'Inspección visual']);
  const [flags, setFlags] = useState<WarrantyFlagCode[]>([]);
  const [recommendation, setRecommendation] = useState<RmaResolutionType>('REPLACED_NEW');

  const save = useAction(() =>
    api.rma.registerDiagnosis(
      caseId,
      unit!.serial,
      {
        technician: session.name,
        faultConfirmed,
        faultCode,
        findings,
        testsPerformed: tests,
        flags,
        recommendation,
      },
      session,
    ),
  );

  return (
    <Dialog
      open={unit !== null}
      onClose={onClose}
      title={`Diagnóstico de ${unit?.serial ?? ''}`}
      description={unit ? `${unit.productName} · problema reportado: ${unit.problemLabel}` : undefined}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={save.pending}>
            Cancelar
          </Button>
          <Button
            loading={save.pending}
            disabled={findings.trim().length < 15}
            onClick={async () => {
              const result = await save.run();
              onClose();
              if (result) onSaved();
              else if (save.error) toast.error('No pudimos registrar el diagnóstico', save.error.message);
            }}
          >
            Guardar diagnóstico
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Resultado de la prueba">
            <div className="flex gap-2">
              <Button
                variant={faultConfirmed ? 'primary' : 'outline'}
                size="sm"
                className="flex-1"
                onClick={() => setFaultConfirmed(true)}
              >
                Falla confirmada
              </Button>
              <Button
                variant={!faultConfirmed ? 'primary' : 'outline'}
                size="sm"
                className="flex-1"
                onClick={() => {
                  setFaultConfirmed(false);
                  setRecommendation('NO_FAULT_FOUND');
                  setFaultCode('NFF-000');
                }}
              >
                Sin falla
              </Button>
            </div>
          </Field>
          <Field label="Código de falla" htmlFor="diag-code">
            <Select id="diag-code" value={faultCode} onChange={(e) => setFaultCode(e.target.value)}>
              {FAULT_CODES.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field
          label="Hallazgos"
          required
          hint="El cliente va a ver este texto en su portal: escribilo de forma clara y sin jerga interna."
          htmlFor="diag-findings"
        >
          <Textarea
            id="diag-findings"
            value={findings}
            onChange={(e) => setFindings(e.target.value)}
            rows={4}
            placeholder="Se reproduce la falla reportada en banco de pruebas. El producto no responde en condiciones nominales…"
          />
        </Field>

        <Field label="Pruebas realizadas">
          <div className="grid gap-2 sm:grid-cols-2">
            {TESTS.map((test) => (
              <Checkbox
                key={test}
                label={test}
                checked={tests.includes(test)}
                onChange={(e) =>
                  setTests((prev) => (e.target.checked ? [...prev, test] : prev.filter((t) => t !== test)))
                }
              />
            ))}
          </div>
        </Field>

        <Field
          label="Condiciones detectadas"
          hint="Marcarlas no rechaza la garantía: genera una revisión manual antes de resolver."
        >
          <div className="grid gap-2 sm:grid-cols-2">
            {(Object.keys(WARRANTY_FLAG) as WarrantyFlagCode[]).map((code) => (
              <Checkbox
                key={code}
                label={WARRANTY_FLAG[code]}
                checked={flags.includes(code)}
                onChange={(e) =>
                  setFlags((prev) => (e.target.checked ? [...prev, code] : prev.filter((f) => f !== code)))
                }
              />
            ))}
          </div>
        </Field>

        <Field label="Recomendación" htmlFor="diag-rec">
          <Select
            id="diag-rec"
            value={recommendation}
            onChange={(e) => setRecommendation(e.target.value as RmaResolutionType)}
          >
            {(Object.keys(RMA_RESOLUTION) as RmaResolutionType[]).map((type) => (
              <option key={type} value={type}>
                {RMA_RESOLUTION[type].label}
              </option>
            ))}
          </Select>
        </Field>

        {flags.length > 0 && (
          <Callout tone="warn">
            Con {flags.length} condición(es) marcadas el caso queda como «Requiere revisión manual». La cobertura final
            la define el responsable de RMA junto con el PM de la marca.
          </Callout>
        )}
      </div>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* resolución                                                          */
/* ------------------------------------------------------------------ */

function ResolutionDialog({
  unit,
  onClose,
  caseId,
  onSaved,
}: {
  unit: RmaUnit | null;
  onClose: () => void;
  caseId: string;
  onSaved: () => void;
}) {
  const { session } = useSession();
  const toast = useToast();
  const [type, setType] = useState<RmaResolutionType>('REPLACED_NEW');
  const [notes, setNotes] = useState('');
  const [replacementSerial, setReplacementSerial] = useState('');
  const [creditAmount, setCreditAmount] = useState('');
  const [extendWarranty, setExtendWarranty] = useState(false);

  const save = useAction(() =>
    api.rma.resolve(
      caseId,
      unit!.serial,
      {
        type,
        approvedBy: session.name,
        notes,
        replacementSerial: type === 'REPLACED_NEW' || type === 'REPLACED_EQUIVALENT' ? replacementSerial || `${unit!.serial}-R` : null,
        replacementSku: type === 'REPLACED_NEW' || type === 'REPLACED_EQUIVALENT' ? unit!.sku : null,
        creditNoteNumber: type === 'CREDIT_NOTE' ? `NC-0004-${String(Math.floor(Math.random() * 90_000 + 10_000)).padStart(8, '0')}` : null,
        creditAmount: type === 'CREDIT_NOTE' && creditAmount ? { amount: Number.parseFloat(creditAmount).toFixed(2), currency: 'USD' } : null,
        resultingWarrantyExpiresAt: extendWarranty ? addMonths(new Date().toISOString(), 12) : (unit!.eligibility?.expiresAt ?? null),
      },
      session,
    ),
  );

  const needsSerial = type === 'REPLACED_NEW' || type === 'REPLACED_EQUIVALENT';

  return (
    <Dialog
      open={unit !== null}
      onClose={onClose}
      title={`Resolver ${unit?.serial ?? ''}`}
      description={unit ? `${unit.productName} · ${unit.diagnosis ? `diagnóstico: ${unit.diagnosis.faultCode}` : 'sin diagnóstico'}` : undefined}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={save.pending}>
            Cancelar
          </Button>
          <Button
            loading={save.pending}
            disabled={notes.trim().length < 10}
            onClick={async () => {
              const result = await save.run();
              onClose();
              if (result) onSaved();
              else if (save.error) toast.error('No pudimos registrar la resolución', save.error.message);
            }}
          >
            Confirmar resolución
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Tipo de resolución" required htmlFor="res-type">
          <Select id="res-type" value={type} onChange={(e) => setType(e.target.value as RmaResolutionType)}>
            {(Object.keys(RMA_RESOLUTION) as RmaResolutionType[]).map((key) => (
              <option key={key} value={key}>
                {RMA_RESOLUTION[key].label}
              </option>
            ))}
          </Select>
        </Field>

        {needsSerial && (
          <>
            <Field
              label="Serial de la unidad de reemplazo"
              hint="Si lo dejás vacío se genera uno de demostración. La trazabilidad del original se conserva."
              htmlFor="res-serial"
            >
              <Input
                id="res-serial"
                value={replacementSerial}
                onChange={(e) => setReplacementSerial(e.target.value.toUpperCase())}
                placeholder={`${unit?.serial ?? ''}-R`}
                className="font-mono"
              />
            </Field>
            <Checkbox
              label="Renovar la garantía por 12 meses desde el reemplazo"
              description="Si no se marca, la unidad nueva hereda la garantía restante de la original."
              checked={extendWarranty}
              onChange={(e) => setExtendWarranty(e.target.checked)}
            />
          </>
        )}

        {type === 'CREDIT_NOTE' && (
          <Field label="Importe a acreditar (USD)" htmlFor="res-credit">
            <Input
              id="res-credit"
              type="number"
              step="0.01"
              min={0}
              value={creditAmount}
              onChange={(e) => setCreditAmount(e.target.value)}
              placeholder="0.00"
            />
          </Field>
        )}

        <Field
          label="Notas de la resolución"
          required
          hint="El cliente las va a leer en su portal."
          htmlFor="res-notes"
        >
          <Textarea
            id="res-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Se reemplaza la unidad por una nueva del mismo SKU. El despacho sale con el próximo envío a la zona."
          />
        </Field>

        {type === 'REJECTED' && (
          <Callout tone="warn">
            Un rechazo debe estar respaldado por el diagnóstico técnico. Asegurate de que las condiciones detectadas
            estén registradas y de que el motivo sea comprensible para el cliente.
          </Callout>
        )}
      </div>
    </Dialog>
  );
}
