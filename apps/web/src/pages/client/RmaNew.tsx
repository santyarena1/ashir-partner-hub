/**
 * Creación de una gestión de garantía.
 *
 * No vuelve a pedir datos que ya se obtuvieron del serial. Incluye
 * troubleshooting previo (sin bloquear al cliente), preguntas dinámicas por
 * categoría y carga de evidencia. Admite múltiples seriales en una sola gestión.
 */
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  Lightbulb,
  Package,
  Paperclip,
  Plus,
  Truck,
  Wrench,
  X,
} from 'lucide-react';
import type { RmaProblemType, SerialRecord } from '@/types';
import { api } from '@/services';
import { useSession } from '@/app/session';
import { useAction, useAsync } from '@/app/hooks';
import { useToast } from '@/components/ui/overlays';
import { questionsForCategory, troubleshootingFor } from '@/mocks/fixtures/rma';
import { serialByCode } from '@/mocks/fixtures/serials';
import { RMA_PROBLEM } from '@/lib/labels';
import { cn, fmtDate } from '@/lib/utils';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Field,
  Input,
  Segmented,
  Select,
  Textarea,
} from '@/components/ui/primitives';
import { Callout, DataRow, EmptyState, Mono, PageHeader, Stepper } from '@/components/ui/data';

const STEPS = [
  { label: 'Unidades' },
  { label: 'Diagnóstico previo' },
  { label: 'Problema y evidencia' },
  { label: 'Logística' },
];

export function RmaNew() {
  const { session } = useSession();
  const navigate = useNavigate();
  const toast = useToast();
  const [params] = useSearchParams();

  const [step, setStep] = useState(0);
  const [serials, setSerials] = useState<SerialRecord[]>([]);
  const [manualSerial, setManualSerial] = useState('');
  const [troubleshooting, setTroubleshooting] = useState<'SOLVED' | 'ALREADY_TRIED' | 'CONTINUED' | null>(null);
  const [problemType, setProblemType] = useState<RmaProblemType>('NO_POWER');
  const [description, setDescription] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<string[]>([]);
  const [logistics, setLogistics] = useState<'PICKUP' | 'CARRIER' | 'DROP_OFF'>('CARRIER');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const eligible = useAsync(() => api.rma.eligibleSerials(session), [session.customerId]);

  /* Precarga del serial que viene del lookup o de «mis compras». */
  useEffect(() => {
    const preset = params.get('serial');
    if (!preset) return;
    const record = serialByCode(preset);
    if (record) setSerials([record]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const category = serials[0] ? serialByCode(serials[0].serial)?.category ?? '' : '';
  const questions = category ? questionsForCategory(category) : [];
  const tips = category ? troubleshootingFor(category) : null;

  const create = useAction(async () => {
    const validation: Record<string, string> = {};
    if (serials.length === 0) validation.serials = 'Agregá al menos una unidad.';
    if (description.trim().length < 15) {
      validation.description = 'Contanos qué pasa con un poco más de detalle: ayuda a resolverlo más rápido.';
    }
    setErrors(validation);
    if (Object.keys(validation).length > 0) throw new Error('validation');

    return api.rma.createCase(
      {
        serials: serials.map((s) => s.serial),
        problemType,
        description,
        answers: questions.map((question) => ({ question, answer: answers[question] ?? 'Sin respuesta' })),
        troubleshootingOutcome: troubleshooting,
        logisticsMode: logistics,
      },
      session,
    );
  });

  const addSerial = (code: string) => {
    const record = serialByCode(code.trim());
    if (!record) {
      toast.warning('Serial no reconocido', 'Verificá el número o consultalo primero desde «Consultar garantía».');
      return;
    }
    if (record.customerId !== session.customerId) {
      toast.error('Ese serial no pertenece a tu cuenta', 'Contactá a tu ejecutivo para revisar el caso.');
      return;
    }
    if (serials.some((s) => s.serial === record.serial)) {
      toast.info('Esa unidad ya está en la gestión');
      return;
    }
    setSerials((prev) => [...prev, record]);
    setManualSerial('');
  };

  const canAdvance =
    step === 0 ? serials.length > 0 : step === 1 ? troubleshooting !== null : step === 2 ? description.trim().length >= 15 : true;

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'RMA', href: '/rma' }, { label: 'Nueva gestión' }]}
        title="Iniciar gestión de garantía"
        subtitle="Cuatro pasos. Los datos del producto, el pedido y la garantía los tomamos del número de serie."
      />

      <Card className="mb-5 p-5">
        <Stepper steps={STEPS} currentIndex={step} />
      </Card>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-5">
          {/* ---------------- paso 1: unidades ---------------- */}
          {step === 0 && (
            <>
              <Card>
                <CardHeader
                  title="Unidades a gestionar"
                  subtitle="Podés incluir varias unidades en una misma gestión logística: cada una se valida y se resuelve por separado."
                  icon={<Package className="size-4" />}
                />
                <div className="p-5">
                  <form
                    className="flex flex-wrap gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      addSerial(manualSerial);
                    }}
                  >
                    <Input
                      value={manualSerial}
                      onChange={(e) => setManualSerial(e.target.value.toUpperCase())}
                      placeholder="Pegá o escribí un número de serie"
                      className="min-w-[220px] flex-1 font-mono"
                    />
                    <Button type="submit" variant="outline" icon={<Plus className="size-4" />}>
                      Agregar unidad
                    </Button>
                  </form>

                  {errors.serials && <p className="mt-2 text-xs font-medium text-bad-600">{errors.serials}</p>}

                  {serials.length > 0 ? (
                    <ul className="mt-4 divide-y divide-ink-100 rounded-lg border border-ink-200">
                      {serials.map((record) => {
                        const expired = new Date(record.warrantyExpiresAt).getTime() < Date.now();
                        return (
                          <li key={record.serial} className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-3">
                            <div className="min-w-0">
                              <p className="flex flex-wrap items-center gap-2 text-[13px] font-medium text-ink-900">
                                <Mono>{record.serial}</Mono>
                                {expired ? (
                                  <Badge tone="warn" size="sm">
                                    Garantía vencida
                                  </Badge>
                                ) : (
                                  <Badge tone="ok" size="sm">
                                    En garantía
                                  </Badge>
                                )}
                              </p>
                              <p className="mt-0.5 truncate text-xs text-ink-500">
                                {record.productName} · {record.orderNumber} · vence el {fmtDate(record.warrantyExpiresAt)}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setSerials((prev) => prev.filter((s) => s.serial !== record.serial))}
                              className="shrink-0 rounded p-1.5 text-ink-400 transition-colors hover:bg-bad-50 hover:text-bad-600"
                              aria-label={`Quitar ${record.serial}`}
                            >
                              <X className="size-3.5" aria-hidden />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <EmptyState
                      compact
                      className="mt-2"
                      title="Todavía no agregaste unidades"
                      description="Podés pegar el serial o elegirlo de la lista de tus compras."
                      icon={<Wrench className="size-5" />}
                    />
                  )}
                </div>
              </Card>

              <Card>
                <CardHeader title="Elegir de tus compras" subtitle="Unidades sin gestión abierta" />
                <div className="max-h-72 overflow-y-auto">
                  <ul className="divide-y divide-ink-100">
                    {(eligible.data ?? [])
                      .filter((r) => !serials.some((s) => s.serial === r.serial))
                      .slice(0, 15)
                      .map((record) => (
                        <li key={record.serial}>
                          <button
                            type="button"
                            onClick={() => setSerials((prev) => [...prev, record])}
                            className="flex w-full items-center gap-3 px-5 py-2.5 text-left transition-colors hover:bg-ink-50"
                          >
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-mono text-[12px] text-ink-900">{record.serial}</span>
                              <span className="mt-0.5 block truncate text-[11px] text-ink-500">{record.productName}</span>
                            </span>
                            <Plus className="size-3.5 shrink-0 text-ink-400" aria-hidden />
                          </button>
                        </li>
                      ))}
                  </ul>
                </div>
              </Card>
            </>
          )}

          {/* ---------------- paso 2: troubleshooting ---------------- */}
          {step === 1 && tips && (
            <Card>
              <CardHeader
                title={tips.title}
                subtitle="Estas pruebas resuelven buena parte de los casos. No son obligatorias: podés continuar igual."
                icon={<Lightbulb className="size-4" />}
              />
              <div className="p-5">
                <ol className="space-y-3">
                  {tips.steps.map((tip, i) => (
                    <li key={tip} className="flex gap-3">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-ashir-50 text-[11px] font-bold text-ashir-700">
                        {i + 1}
                      </span>
                      <p className="text-[13px] leading-relaxed text-ink-700">{tip}</p>
                    </li>
                  ))}
                </ol>

                <div className="mt-5 flex flex-wrap gap-2 border-t border-ink-100 pt-4">
                  <Button
                    variant={troubleshooting === 'SOLVED' ? 'primary' : 'outline'}
                    icon={<CheckCircle2 className="size-4" />}
                    onClick={() => setTroubleshooting('SOLVED')}
                  >
                    La solución funcionó
                  </Button>
                  <Button
                    variant={troubleshooting === 'ALREADY_TRIED' ? 'primary' : 'outline'}
                    onClick={() => setTroubleshooting('ALREADY_TRIED')}
                  >
                    Ya realicé estas pruebas
                  </Button>
                  <Button
                    variant={troubleshooting === 'CONTINUED' ? 'primary' : 'outline'}
                    onClick={() => setTroubleshooting('CONTINUED')}
                  >
                    Continuar con el RMA
                  </Button>
                </div>

                {troubleshooting === 'SOLVED' && (
                  <Callout tone="ok" className="mt-4" title="Nos alegra que se haya resuelto">
                    No hace falta iniciar la gestión. Si el problema vuelve a aparecer, podés retomar desde acá.{' '}
                    <Link to="/rma" className="font-semibold underline underline-offset-2">
                      Volver al portal de RMA
                    </Link>
                  </Callout>
                )}
              </div>
            </Card>
          )}

          {/* ---------------- paso 3: problema ---------------- */}
          {step === 2 && (
            <>
              <Card>
                <CardHeader title="Describí el problema" icon={<Wrench className="size-4" />} />
                <div className="space-y-4 p-5">
                  <Field label="Tipo de problema" required htmlFor="rma-problem">
                    <Select
                      id="rma-problem"
                      value={problemType}
                      onChange={(e) => setProblemType(e.target.value as RmaProblemType)}
                    >
                      {(Object.keys(RMA_PROBLEM) as RmaProblemType[]).map((key) => (
                        <option key={key} value={key}>
                          {RMA_PROBLEM[key]}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <Field
                    label="Descripción"
                    required
                    error={errors.description}
                    hint="Contanos qué hace el producto, desde cuándo y en qué condiciones se repite la falla."
                    htmlFor="rma-desc"
                  >
                    <Textarea
                      id="rma-desc"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={4}
                      invalid={Boolean(errors.description)}
                      placeholder="El equipo enciende pero no da imagen. Probamos con dos monitores y tres cables distintos…"
                    />
                  </Field>
                </div>
              </Card>

              {questions.length > 0 && (
                <Card>
                  <CardHeader
                    title={`Preguntas para ${category}`}
                    subtitle="Ayudan al técnico a reproducir la falla sin pedirte información después"
                  />
                  <div className="space-y-3 p-5">
                    {questions.map((question) => (
                      <div key={question}>
                        <p className="text-[13px] font-medium text-ink-800">{question}</p>
                        <div className="mt-1.5">
                          <Segmented
                            size="sm"
                            value={answers[question] ?? ''}
                            onChange={(value) => setAnswers((prev) => ({ ...prev, [question]: value }))}
                            options={[
                              { value: 'Sí', label: 'Sí' },
                              { value: 'No', label: 'No' },
                              { value: 'No lo probé', label: 'No lo probé' },
                            ]}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              <Card>
                <CardHeader
                  title="Evidencia"
                  subtitle="Fotos, videos o documentos. Una foto de la etiqueta con el serial agiliza la validación."
                  icon={<Paperclip className="size-4" />}
                />
                <div className="p-5">
                  <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-ink-200 px-6 py-8 text-center transition-colors hover:border-ashir-400 hover:bg-ashir-50/40">
                    <Paperclip className="size-5 text-ink-400" aria-hidden />
                    <span className="text-[13px] font-semibold text-ink-800">Adjuntar fotos, videos o documentos</span>
                    <span className="text-xs text-ink-500">JPG, PNG, MP4 o PDF · hasta 25 MB por archivo</span>
                    <input
                      type="file"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        const names = Array.from(e.target.files ?? []).map((f) => f.name);
                        setFiles((prev) => [...prev, ...names]);
                      }}
                    />
                  </label>
                  {files.length > 0 && (
                    <ul className="mt-3 flex flex-wrap gap-2">
                      {files.map((name, i) => (
                        <li
                          key={`${name}-${i}`}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-ink-100 px-2.5 py-1 text-xs text-ink-700"
                        >
                          {name}
                          <button
                            type="button"
                            onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                            aria-label={`Quitar ${name}`}
                          >
                            <X className="size-3" aria-hidden />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </Card>
            </>
          )}

          {/* ---------------- paso 4: logística ---------------- */}
          {step === 3 && (
            <Card>
              <CardHeader
                title="Cómo llega el producto a Ashir"
                subtitle="Al aprobar la gestión emitimos el remito y la etiqueta con el código del caso."
                icon={<Truck className="size-4" />}
              />
              <div className="space-y-3 p-5">
                {(
                  [
                    { value: 'CARRIER', title: 'Envío por transporte', detail: 'Te enviamos la etiqueta y el remito para despachar por Andreani, OCA o Cruz del Sur.' },
                    { value: 'PICKUP', title: 'Retiro a domicilio', detail: 'Coordinamos el retiro en tu local. Disponible en CABA y AMBA, y para clientes Gold o Platinum.' },
                    { value: 'DROP_OFF', title: 'Entrega en depósito', detail: 'Llevás el producto al depósito de Ashir con el remito impreso.' },
                  ] as const
                ).map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setLogistics(option.value)}
                    className={cn(
                      'flex w-full items-start gap-3 rounded-lg border px-4 py-3.5 text-left transition-colors',
                      logistics === option.value
                        ? 'border-ashir-400 bg-ashir-50/60 ring-1 ring-ashir-200'
                        : 'border-ink-200 hover:border-ink-300 hover:bg-ink-50',
                    )}
                  >
                    <span
                      className={cn(
                        'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border-2',
                        logistics === option.value ? 'border-ashir-600' : 'border-ink-300',
                      )}
                    >
                      {logistics === option.value && <span className="size-1.5 rounded-full bg-ashir-600" />}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[13px] font-semibold text-ink-900">{option.title}</span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-ink-500">{option.detail}</span>
                    </span>
                  </button>
                ))}

                <Callout tone="tech" className="mt-2">
                  No envíes el producto antes de que la gestión quede aprobada: sin remito ni etiqueta no podemos
                  asociar la recepción a tu caso.
                </Callout>
              </div>
            </Card>
          )}

          {/* ---------------- navegación ---------------- */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button variant="outline" onClick={() => (step === 0 ? navigate('/rma') : setStep(step - 1))}>
              {step === 0 ? 'Cancelar' : 'Volver'}
            </Button>

            {step < STEPS.length - 1 ? (
              <Button
                disabled={!canAdvance}
                iconRight={<ArrowRight className="size-4" />}
                onClick={() => setStep(step + 1)}
              >
                Continuar
              </Button>
            ) : (
              <Button
                size="lg"
                loading={create.pending}
                icon={<Wrench className="size-4" />}
                onClick={async () => {
                  const result = await create.run();
                  if (result) {
                    toast.success(`Gestión ${result.code} creada`, 'Ashir tiene 24 horas hábiles para validarla.');
                    navigate(`/rma/${result.id}`);
                  } else if (create.error && create.error.message !== 'validation') {
                    toast.error('No pudimos crear la gestión', create.error.message);
                  }
                }}
              >
                Crear gestión de garantía
              </Button>
            )}
          </div>
        </div>

        {/* ---------------- resumen ---------------- */}
        <div className="space-y-4 lg:sticky lg:top-32 lg:self-start">
          <Card>
            <CardHeader title="Resumen de la gestión" />
            <div className="space-y-0.5 p-5">
              <DataRow label="Unidades" value={serials.length} emphasis />
              {category && <DataRow label="Categoría" value={category} />}
              <DataRow label="Problema" value={RMA_PROBLEM[problemType]} />
              <DataRow label="Evidencia adjunta" value={files.length > 0 ? `${files.length} archivo(s)` : 'Sin adjuntos'} />
              <DataRow
                label="Logística"
                value={logistics === 'CARRIER' ? 'Transporte' : logistics === 'PICKUP' ? 'Retiro a domicilio' : 'Entrega en depósito'}
              />
              <DataRow
                label="Diagnóstico previo"
                value={
                  troubleshooting === 'ALREADY_TRIED'
                    ? 'Pruebas ya realizadas'
                    : troubleshooting === 'CONTINUED'
                      ? 'Continúa sin probar'
                      : troubleshooting === 'SOLVED'
                        ? 'Resuelto'
                        : 'Pendiente'
                }
              />
            </div>
          </Card>

          {serials.length > 1 && (
            <Callout tone="tech" title="Gestión múltiple">
              Las {serials.length} unidades viajan con un remito y una etiqueta comunes, pero cada una tiene su propia
              validación, diagnóstico y resolución.
            </Callout>
          )}

          <Card>
            <CardHeader title="Plazos comprometidos" />
            <div className="space-y-0.5 p-5 text-[13px]">
              <DataRow label="Validación de Ashir" value="24 h hábiles" />
              <DataRow label="Diagnóstico técnico" value="72 h desde la recepción" />
              <DataRow label="Resolución" value="5 días hábiles" />
              <p className="mt-2 border-t border-ink-100 pt-2 text-[11px] leading-relaxed text-ink-400">
                Los plazos se pausan mientras el caso está en gestión con el fabricante. Vas a ver el SLA restante en el
                detalle de tu caso.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
