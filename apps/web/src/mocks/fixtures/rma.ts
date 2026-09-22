/**
 * Casos de RMA.
 *
 * Cada caso se construye sobre seriales reales del dataset, de modo que el
 * lookup, la garantia, el lote y el analytics del PM cuentan la misma historia.
 */
import type {
  AuditEvent,
  RmaCase,
  RmaProblemType,
  RmaSla,
  RmaStatus,
  RmaTimelineEvent,
  RmaUnit,
  Role,
  WarrantyEligibility,
  WarrantyFlagCode,
} from '@/types';
import {
  EXPIRED_WARRANTY_SERIAL,
  HERO_SERIAL,
  OTHER_RESELLER_SERIAL,
  SERIALS,
  policyFor,
  serialByCode,
} from '@/mocks/fixtures/serials';
import { RMA_PROBLEM, RMA_FLOW } from '@/lib/labels';
import { addDays, betweenSeeded, money, requestId, seeded } from '@/lib/utils';

const NOW = new Date('2026-09-22T11:00:00-03:00');

/* ------------------------------------------------------------------ */
/* preguntas dinamicas por categoria                                   */
/* ------------------------------------------------------------------ */

export const CATEGORY_QUESTIONS: Record<string, string[]> = {
  GPUs: [
    '¿La placa da imagen?',
    '¿Fue probada en otro equipo?',
    '¿Se probaron otros cables de alimentación?',
    '¿Presenta daño físico visible?',
    '¿Se reinstalaron los drivers?',
  ],
  Motherboards: [
    '¿El equipo enciende y da POST?',
    '¿Probaron con una sola memoria?',
    '¿Los pines del socket están en buen estado?',
    '¿Se actualizó el BIOS?',
  ],
  Procesadores: [
    '¿Probaron el procesador en otra motherboard compatible?',
    '¿Los pines están derechos?',
    '¿Qué temperatura alcanza en reposo?',
  ],
  Fuentes: [
    '¿La fuente enciende en vacío con el puente de PS_ON?',
    '¿Se probó con otro cable de alimentación?',
    '¿Hay olor a quemado o marcas visibles?',
  ],
  Memorias: [
    '¿Probaron los módulos de a uno?',
    '¿Probaron en otro slot?',
    '¿Corrieron un test de memoria?',
  ],
  SSD: [
    '¿La unidad es detectada en BIOS?',
    '¿Probaron en otro puerto o equipo?',
    '¿El firmware está actualizado?',
  ],
  Refrigeración: [
    '¿La bomba o el ventilador giran?',
    '¿Hay pérdida de líquido visible?',
    '¿El conector está alimentado correctamente?',
  ],
  Gabinetes: [
    '¿El daño es estructural o estético?',
    '¿El producto llegó así de fábrica?',
    '¿Falta algún accesorio del kit?',
  ],
  Monitores: [
    '¿Se probó con otro cable y otra fuente de video?',
    '¿Tiene píxeles muertos? ¿Cuántos?',
    '¿El daño es en el panel o en la carcasa?',
  ],
  Periféricos: [
    '¿Se probó en otro equipo o puerto USB?',
    '¿Se instaló el software del fabricante?',
    '¿El problema es intermitente?',
  ],
  'Sillas gamer': [
    '¿El problema es en el pistón, la base o la tapicería?',
    '¿Se respetó el peso máximo soportado?',
    '¿Conserva el embalaje original?',
  ],
};

export function questionsForCategory(category: string): string[] {
  return CATEGORY_QUESTIONS[category] ?? [
    '¿Cuándo empezó a manifestarse la falla?',
    '¿Se probó el producto en otro equipo?',
    '¿Presenta daño físico visible?',
  ];
}

/** Recomendaciones de troubleshooting previas al envio. */
export const TROUBLESHOOTING: Record<string, { title: string; steps: string[] }> = {
  GPUs: {
    title: 'Antes de enviar la placa de video',
    steps: [
      'Probar la placa en otro equipo con una fuente de al menos la potencia recomendada.',
      'Reemplazar los cables PCIe por otros del mismo fabricante de fuente (no usar adaptadores encadenados).',
      'Desinstalar los drivers con DDU en modo seguro y reinstalar la última versión estable.',
      'Verificar que el monitor esté conectado a la placa y no a la salida de video de la motherboard.',
    ],
  },
  Motherboards: {
    title: 'Antes de enviar la motherboard',
    steps: [
      'Probar con una sola memoria en el slot A2 y sin periféricos conectados.',
      'Reiniciar la BIOS quitando la pila o usando el jumper CLR_CMOS.',
      'Verificar visualmente el estado de los pines del socket.',
    ],
  },
  Fuentes: {
    title: 'Antes de enviar la fuente',
    steps: [
      'Probar el encendido en vacío puenteando PS_ON con GND.',
      'Cambiar el cable de alimentación y el tomacorriente.',
      'Verificar que la llave 115/230 V esté en la posición correcta.',
    ],
  },
  Memorias: {
    title: 'Antes de enviar las memorias',
    steps: [
      'Probar los módulos de a uno, en distintos slots.',
      'Desactivar el perfil XMP/EXPO y probar en frecuencia JEDEC.',
      'Correr MemTest86 durante al menos un pase completo.',
    ],
  },
};

export function troubleshootingFor(category: string) {
  return (
    TROUBLESHOOTING[category] ?? {
      title: 'Antes de iniciar la garantía',
      steps: [
        'Probar el producto en otro equipo para descartar incompatibilidad.',
        'Verificar que el problema se repita de forma consistente.',
        'Tener a mano la factura de compra y el número de serie.',
      ],
    }
  );
}

/* ------------------------------------------------------------------ */
/* elegibilidad                                                        */
/* ------------------------------------------------------------------ */

export function buildEligibility(
  serial: string,
  flags: WarrantyFlagCode[] = [],
): WarrantyEligibility | null {
  const record = serialByCode(serial);
  if (!record) return null;
  const policy = policyFor(record.brand);
  const expired = new Date(record.warrantyExpiresAt).getTime() < NOW.getTime();
  const needsReview = flags.some((f) => policy.flagsRequireReview.includes(f));

  const reasons: string[] = [];
  if (expired) reasons.push(`La garantía venció el ${new Date(record.warrantyExpiresAt).toLocaleDateString('es-AR')}.`);
  if (needsReview) {
    reasons.push('Se detectaron condiciones que requieren revisión manual antes de aprobar la garantía.');
  }
  if (!expired && !needsReview) {
    reasons.push(`Cubierto por la política "${policy.name}" (${record.warrantyMonths} meses desde la compra).`);
  }

  return {
    eligible: !expired,
    requiresManualReview: needsReview,
    policyId: policy.id,
    policyName: policy.name,
    warrantyMonths: record.warrantyMonths,
    expiresAt: record.warrantyExpiresAt,
    reasons,
    flags: flags.map((code) => ({
      code,
      label: code,
      raisedBy: 'Javier Ocampo',
      at: NOW.toISOString(),
      note: 'Detectado en la recepción del producto.',
    })),
  };
}

/* ------------------------------------------------------------------ */
/* SLA                                                                 */
/* ------------------------------------------------------------------ */

const SLA_STAGE_BY_STATUS: Record<RmaStatus, RmaSla['stage']> = {
  DRAFT: 'VALIDATION',
  SUBMITTED: 'VALIDATION',
  ASHIR_VALIDATION: 'VALIDATION',
  AWAITING_SHIPMENT: 'VALIDATION',
  RECEIVED: 'DIAGNOSIS',
  DIAGNOSIS: 'DIAGNOSIS',
  MANUFACTURER: 'RESOLUTION',
  RESOLUTION: 'RESOLUTION',
  READY_FOR_PICKUP: 'DONE',
  CLOSED: 'DONE',
  REJECTED: 'DONE',
};

function buildSla(status: RmaStatus, stageStartedAt: string, brand: string, pausedReason: string | null): RmaSla {
  const policy = policyFor(brand);
  const stage = SLA_STAGE_BY_STATUS[status];
  const targetHours =
    stage === 'VALIDATION'
      ? policy.slaValidationHours
      : stage === 'DIAGNOSIS'
        ? policy.slaDiagnosisHours
        : policy.slaResolutionDays * 24;

  const elapsedHours = Math.max(
    0,
    Math.round((NOW.getTime() - new Date(stageStartedAt).getTime()) / 3_600_000),
  );
  const remaining = targetHours - elapsedHours;

  return {
    stage,
    targetHours,
    elapsedHours,
    remainingHours: remaining,
    breached: stage !== 'DONE' && remaining < 0 && !pausedReason,
    pausedReason,
    dueAt: addDays(stageStartedAt, targetHours / 24),
  };
}

/* ------------------------------------------------------------------ */
/* construccion de casos                                               */
/* ------------------------------------------------------------------ */

const PROBLEM_BY_CATEGORY: Record<string, RmaProblemType[]> = {
  GPUs: ['NO_VIDEO', 'NO_POWER', 'TEMPERATURE', 'NOISE', 'INTERMITTENT'],
  Motherboards: ['NO_POWER', 'INTERMITTENT', 'INCOMPATIBILITY', 'PHYSICAL_DAMAGE'],
  Procesadores: ['NO_POWER', 'TEMPERATURE', 'INCOMPATIBILITY'],
  Fuentes: ['NO_POWER', 'NOISE', 'INTERMITTENT'],
  Memorias: ['INTERMITTENT', 'INCOMPATIBILITY', 'NO_POWER'],
  SSD: ['INTERMITTENT', 'NO_POWER'],
  Refrigeración: ['NOISE', 'TEMPERATURE', 'NO_POWER'],
  Gabinetes: ['PHYSICAL_DAMAGE', 'MISSING_ACCESSORY'],
  Monitores: ['NO_VIDEO', 'PHYSICAL_DAMAGE', 'INTERMITTENT'],
  Periféricos: ['INTERMITTENT', 'NO_POWER', 'MISSING_ACCESSORY'],
  'Sillas gamer': ['PHYSICAL_DAMAGE', 'MISSING_ACCESSORY'],
};

const DESCRIPTIONS: Record<RmaProblemType, string> = {
  NO_POWER: 'El equipo no arranca con el producto instalado. Probado en dos equipos distintos con el mismo resultado.',
  NO_VIDEO: 'El equipo enciende pero no hay señal de video. Se probaron dos monitores y tres cables diferentes.',
  INTERMITTENT: 'Funciona correctamente durante un rato y luego se cuelga o reinicia el equipo de forma aleatoria.',
  TEMPERATURE: 'Alcanza temperaturas muy por encima de lo normal en reposo y termina apagándose por protección.',
  NOISE: 'Ruido mecánico constante desde el primer encendido, aumenta con la carga.',
  PHYSICAL_DAMAGE: 'El producto llegó con daño visible en el embalaje original, sin señales de golpe externo.',
  INCOMPATIBILITY: 'No es reconocido por la plataforma indicada en la lista de compatibilidad del fabricante.',
  MISSING_ACCESSORY: 'Falta uno de los accesorios incluidos según la ficha del producto.',
  OTHER: 'Comportamiento anómalo difícil de encuadrar en las categorías anteriores. Se adjunta video.',
};

const STATUS_PLAN: { status: RmaStatus; count: number }[] = [
  { status: 'CLOSED', count: 9 },
  { status: 'READY_FOR_PICKUP', count: 2 },
  { status: 'RESOLUTION', count: 2 },
  { status: 'MANUFACTURER', count: 3 },
  { status: 'DIAGNOSIS', count: 4 },
  { status: 'RECEIVED', count: 3 },
  { status: 'AWAITING_SHIPMENT', count: 3 },
  { status: 'ASHIR_VALIDATION', count: 3 },
  { status: 'SUBMITTED', count: 2 },
  { status: 'REJECTED', count: 2 },
];

const TECHNICIANS = ['Javier Ocampo', 'Andrés Villalba', 'Mariela Sosa'];
const FAULT_CODES = ['GPU-NOSIG-02', 'PSU-OCP-11', 'MB-POST-07', 'MEM-ECC-03', 'SSD-CTRL-05', 'COOL-PUMP-01'];

function actorRoleFor(status: RmaStatus): Role | 'SYSTEM' {
  if (status === 'SUBMITTED') return 'CLIENT';
  if (status === 'ASHIR_VALIDATION' || status === 'RESOLUTION') return 'RMA';
  return 'RMA';
}

function buildTimeline(code: string, status: RmaStatus, createdAt: string, serial: string): RmaTimelineEvent[] {
  const upto = RMA_FLOW.indexOf(status);
  const stages = status === 'REJECTED' ? RMA_FLOW.slice(0, 5) : RMA_FLOW.slice(0, upto + 1);
  const events: RmaTimelineEvent[] = [];

  stages.forEach((stage, i) => {
    const at = addDays(createdAt, i * 1.4);
    events.push({
      id: `tl_${code}_${i}`,
      at,
      status: stage,
      label: STAGE_LABEL[stage],
      actor: i === 0 ? 'Cliente' : TECHNICIANS[betweenSeeded(`${code}t${i}`, 0, 2)]!,
      actorRole: i === 0 ? 'CLIENT' : actorRoleFor(stage),
      comment: STAGE_COMMENT[stage] ?? null,
      documents:
        stage === 'AWAITING_SHIPMENT'
          ? [{ name: `remito-${code}.pdf`, type: 'application/pdf' }]
          : stage === 'RECEIVED'
            ? [{ name: `recepcion-${serial}.jpg`, type: 'image/jpeg' }]
            : [],
      unitSerial: null,
    });
  });

  if (status === 'REJECTED') {
    events.push({
      id: `tl_${code}_rej`,
      at: addDays(createdAt, stages.length * 1.4),
      status: 'REJECTED',
      label: 'Garantía rechazada',
      actor: TECHNICIANS[0]!,
      actorRole: 'RMA',
      comment: 'Se detectó daño eléctrico por fuente no certificada. Queda fuera de cobertura del fabricante.',
      documents: [{ name: `informe-tecnico-${code}.pdf`, type: 'application/pdf' }],
      unitSerial: null,
    });
  }

  return events;
}

const STAGE_LABEL: Record<RmaStatus, string> = {
  DRAFT: 'Borrador',
  SUBMITTED: 'Solicitud creada',
  ASHIR_VALIDATION: 'Validación Ashir',
  AWAITING_SHIPMENT: 'Esperando envío/retiro',
  RECEIVED: 'Producto recibido',
  DIAGNOSIS: 'Diagnóstico técnico',
  MANUFACTURER: 'Gestión con fabricante',
  RESOLUTION: 'Resolución',
  READY_FOR_PICKUP: 'Listo para entrega',
  CLOSED: 'Finalizado',
  REJECTED: 'Rechazado',
};

const STAGE_COMMENT: Partial<Record<RmaStatus, string>> = {
  SUBMITTED: 'El reseller inició la solicitud desde el portal con serial validado.',
  ASHIR_VALIDATION: 'Serial y garantía verificados contra la factura de compra.',
  AWAITING_SHIPMENT: 'Se emitió el remito y la etiqueta de envío.',
  RECEIVED: 'Producto recibido en depósito y fotografiado.',
  DIAGNOSIS: 'Banco de pruebas: se replica la falla reportada.',
  MANUFACTURER: 'Caso escalado al soporte del fabricante con número de referencia.',
  RESOLUTION: 'Resolución aprobada por el responsable de RMA.',
  READY_FOR_PICKUP: 'Producto disponible para retiro o próximo despacho.',
  CLOSED: 'Caso cerrado y notificado al cliente.',
};

function buildCase(index: number, status: RmaStatus, seq: number, serialPool: string[]): RmaCase {
  const code = `RMA-${260_100 + seq}`;
  const seed = `rma${index}`;
  const rnd = seeded(seed);
  const serial = serialPool[Math.floor(rnd() * serialPool.length) % serialPool.length]!;
  const record = serialByCode(serial)!;
  const ageDays = betweenSeeded(`${seed}age`, status === 'CLOSED' ? 20 : 1, status === 'CLOSED' ? 160 : 14);
  const createdAt = addDays(NOW.toISOString(), -ageDays);

  const problems = PROBLEM_BY_CATEGORY[record.category] ?? ['OTHER'];
  const problemType = problems[Math.floor(rnd() * problems.length) % problems.length]!;
  const flags: WarrantyFlagCode[] =
    status === 'REJECTED' ? ['ELECTRICAL_DAMAGE'] : betweenSeeded(`${seed}f`, 0, 10) > 8 ? ['PHYSICAL_DAMAGE'] : [];

  const timeline = buildTimeline(code, status, createdAt, serial);
  const stageStartedAt = timeline[timeline.length - 1]?.at ?? createdAt;
  const paused = status === 'MANUFACTURER' ? 'Esperando respuesta del fabricante' : null;

  const isResolved = status === 'CLOSED' || status === 'READY_FOR_PICKUP';
  const hasDiagnosis = ['DIAGNOSIS', 'MANUFACTURER', 'RESOLUTION', 'READY_FOR_PICKUP', 'CLOSED', 'REJECTED'].includes(status);

  const unit: RmaUnit = {
    id: `unit_${code}`,
    serial,
    productId: record.productId,
    sku: record.sku,
    productName: record.productName,
    brand: record.brand,
    lotId: record.lotId,
    problemType,
    problemLabel: RMA_PROBLEM[problemType],
    description: DESCRIPTIONS[problemType],
    answers: questionsForCategory(record.category)
      .slice(0, 3)
      .map((question, i) => ({
        question,
        answer: ['Sí', 'No', 'Sí, sin cambios'][betweenSeeded(`${seed}a${i}`, 0, 2)]!,
      })),
    status,
    eligibility: buildEligibility(serial, flags),
    diagnosis: hasDiagnosis
      ? {
          at: addDays(createdAt, 4),
          technician: TECHNICIANS[betweenSeeded(`${seed}tech`, 0, 2)]!,
          faultConfirmed: status !== 'REJECTED',
          faultCode: FAULT_CODES[betweenSeeded(`${seed}fc`, 0, FAULT_CODES.length - 1)]!,
          findings:
            status === 'REJECTED'
              ? 'Se observan marcas de sobretensión en la etapa de alimentación. El daño es consistente con una fuente defectuosa externa al producto.'
              : 'Se reproduce la falla reportada en banco de pruebas. El producto no responde en condiciones nominales.',
          testsPerformed: ['Banco de pruebas', 'Inspección visual', 'Medición de consumo'],
          flags,
          recommendation:
            status === 'REJECTED'
              ? 'REJECTED'
              : record.category === 'GPUs'
                ? 'REPLACED_NEW'
                : 'REPAIRED',
        }
      : null,
    resolution: isResolved
      ? {
          at: addDays(createdAt, 7),
          type: record.category === 'GPUs' ? 'REPLACED_NEW' : betweenSeeded(`${seed}r`, 0, 10) > 6 ? 'CREDIT_NOTE' : 'REPAIRED',
          approvedBy: 'Javier Ocampo',
          notes: 'Resolución acordada con el cliente y con el PM de la marca.',
          replacementSerial:
            record.category === 'GPUs' ? `${serial.slice(0, 4)}${betweenSeeded(`${seed}rep`, 1_000_000, 9_999_999)}` : null,
          replacementSku: record.category === 'GPUs' ? record.sku : null,
          creditNoteNumber:
            betweenSeeded(`${seed}r`, 0, 10) > 6 ? `NC-0004-${String(betweenSeeded(seed, 100, 999)).padStart(8, '0')}` : null,
          creditAmount: betweenSeeded(`${seed}r`, 0, 10) > 6 ? money(betweenSeeded(`${seed}ca`, 80, 900)) : null,
          resultingWarrantyExpiresAt: record.warrantyExpiresAt,
        }
      : null,
    receivedAt: ['RECEIVED', 'DIAGNOSIS', 'MANUFACTURER', 'RESOLUTION', 'READY_FOR_PICKUP', 'CLOSED', 'REJECTED'].includes(status)
      ? addDays(createdAt, 3)
      : null,
    receptionIssue: betweenSeeded(`${seed}ri`, 0, 20) === 3 ? 'VISIBLE_DAMAGE' : 'NONE',
  };

  const auditLog: AuditEvent[] = timeline.map((event, i) => ({
    id: `aud_${code}_${i}`,
    at: event.at,
    actor: event.actor,
    actorRole: event.actorRole,
    action: event.label,
    entity: 'RmaCase',
    entityId: code,
    previousValue: i > 0 ? timeline[i - 1]!.status : null,
    newValue: event.status,
    origin: event.actorRole === 'CLIENT' ? 'PORTAL' : 'PORTAL',
    requestId: requestId(),
    comment: event.comment,
  }));

  return {
    id: `rma_${code.toLowerCase().replace('-', '_')}`,
    code,
    customerId: record.customerId,
    customerName: record.customerName,
    units: [unit],
    status,
    isBatch: false,
    createdAt,
    updatedAt: stageStartedAt,
    submittedAt: createdAt,
    closedAt: status === 'CLOSED' || status === 'REJECTED' ? addDays(createdAt, 8) : null,
    assignedTo: status === 'SUBMITTED' ? null : TECHNICIANS[betweenSeeded(`${seed}as`, 0, 2)]!,
    priority: flags.length > 0 ? 'HIGH' : betweenSeeded(`${seed}p`, 0, 10) > 8 ? 'HIGH' : 'NORMAL',
    logistics: {
      mode: betweenSeeded(`${seed}lm`, 0, 10) > 6 ? 'PICKUP' : 'CARRIER',
      remitNumber: unit.receivedAt ? `RM-${betweenSeeded(seed, 10_000, 99_999)}` : null,
      labelCode: `ETQ-${code}`,
      carrier: 'Andreani',
      expectedUnits: 1,
      receivedUnits: unit.receivedAt ? 1 : 0,
      receptionPhotos: unit.receivedAt ? betweenSeeded(`${seed}ph`, 2, 5) : 0,
      receptionNotes: unit.receptionIssue === 'VISIBLE_DAMAGE' ? 'Embalaje con golpe visible en una esquina.' : null,
    },
    sla: buildSla(status, stageStartedAt, record.brand, paused),
    attachments: [
      { name: `falla-${serial}.jpg`, size: '1,8 MB', type: 'image/jpeg', unitSerial: serial },
      ...(betweenSeeded(`${seed}at`, 0, 10) > 6
        ? [{ name: `video-${serial}.mp4`, size: '12,4 MB', type: 'video/mp4', unitSerial: serial }]
        : []),
    ],
    timeline,
    auditLog,
    troubleshootingOutcome: betweenSeeded(`${seed}ts`, 0, 10) > 5 ? 'ALREADY_TRIED' : 'CONTINUED',
  };
}

/* ------------------------------------------------------------------ */

function buildAll(): RmaCase[] {
  // Los seriales del guion de demo quedan libres de casos generados: el
  // recorrido tiene que poder crear su propia gestión sobre ellos.
  const reserved = new Set([HERO_SERIAL, OTHER_RESELLER_SERIAL, EXPIRED_WARRANTY_SERIAL]);
  const pool = SERIALS.filter((s) => !reserved.has(s.serial) && s.customerId !== 'cus_gamerzone').map((s) => s.serial);
  const cases: RmaCase[] = [];
  let index = 0;
  let seq = 0;
  for (const plan of STATUS_PLAN) {
    for (let i = 0; i < plan.count; i++) {
      cases.push(buildCase(index++, plan.status, seq++, pool));
    }
  }

  /* --- un caso fuera de SLA, para la alerta del centro de RMA --- */
  const breached = cases.find((c) => c.status === 'DIAGNOSIS');
  if (breached) {
    breached.code = 'RMA-260181';
    breached.id = 'rma_rma_260181';
    breached.sla = {
      ...breached.sla,
      elapsedHours: 144,
      remainingHours: -72,
      breached: true,
      targetHours: 72,
    };
    breached.priority = 'CRITICAL';
  }

  /* --- un caso multiple (RMA por lote), para la vista de RMA multiple --- */
  const batchSerials = SERIALS.filter(
    (s) => s.lotId === 'LOTE-MSI-260326-A' && s.serial !== HERO_SERIAL,
  ).slice(0, 4);
  if (batchSerials.length >= 3) {
    const createdAt = addDays(NOW.toISOString(), -9);
    const units: RmaUnit[] = batchSerials.map((record, i) => ({
      id: `unit_batch_${i}`,
      serial: record.serial,
      productId: record.productId,
      sku: record.sku,
      productName: record.productName,
      brand: record.brand,
      lotId: record.lotId,
      problemType: (['NO_VIDEO', 'NO_VIDEO', 'NO_POWER', 'TEMPERATURE'] as RmaProblemType[])[i] ?? 'NO_VIDEO',
      problemLabel: RMA_PROBLEM[(['NO_VIDEO', 'NO_VIDEO', 'NO_POWER', 'TEMPERATURE'] as RmaProblemType[])[i] ?? 'NO_VIDEO'],
      description: 'Cuatro unidades del mismo lote con el mismo cuadro de falla en menos de tres semanas.',
      answers: questionsForCategory(record.category)
        .slice(0, 3)
        .map((question) => ({ question, answer: 'Sí' })),
      status: i === 3 ? 'AWAITING_SHIPMENT' : 'DIAGNOSIS',
      eligibility: buildEligibility(record.serial),
      diagnosis:
        i < 2
          ? {
              at: addDays(createdAt, 5),
              technician: 'Andrés Villalba',
              faultConfirmed: true,
              faultCode: 'GPU-NOSIG-02',
              findings: 'Falla reproducible en el mismo componente de salida de video. Patrón consistente con el resto del lote.',
              testsPerformed: ['Banco de pruebas', 'Inspección visual', 'Prueba cruzada de fuente'],
              flags: [],
              recommendation: 'SENT_TO_MANUFACTURER',
            }
          : null,
      resolution: null,
      receivedAt: i === 3 ? null : addDays(createdAt, 4),
      receptionIssue: i === 3 ? null : 'NONE',
    }));

    const timeline = buildTimeline('RMA-260194', 'DIAGNOSIS', createdAt, batchSerials[0]!.serial);

    cases.unshift({
      id: 'rma_rma_260194',
      code: 'RMA-260194',
      customerId: batchSerials[0]!.customerId,
      customerName: batchSerials[0]!.customerName,
      units,
      status: 'DIAGNOSIS',
      isBatch: true,
      createdAt,
      updatedAt: addDays(createdAt, 5),
      submittedAt: createdAt,
      closedAt: null,
      assignedTo: 'Andrés Villalba',
      priority: 'CRITICAL',
      logistics: {
        mode: 'CARRIER',
        remitNumber: 'RM-48122',
        labelCode: 'ETQ-RMA-260194',
        carrier: 'Andreani',
        expectedUnits: 4,
        receivedUnits: 3,
        receptionPhotos: 6,
        receptionNotes: 'Se recibieron 3 de 4 unidades. La cuarta figura como despachada pero no llegó con el remito.',
      },
      sla: buildSla('DIAGNOSIS', addDays(createdAt, 4), 'MSI', null),
      attachments: [
        { name: 'falla-lote-msi.mp4', size: '18,2 MB', type: 'video/mp4', unitSerial: null },
        { name: 'remito-firmado.pdf', size: '340 KB', type: 'application/pdf', unitSerial: null },
      ],
      timeline,
      auditLog: timeline.map((event, i) => ({
        id: `aud_batch_${i}`,
        at: event.at,
        actor: event.actor,
        actorRole: event.actorRole,
        action: event.label,
        entity: 'RmaCase',
        entityId: 'RMA-260194',
        previousValue: i > 0 ? timeline[i - 1]!.status : null,
        newValue: event.status,
        origin: 'PORTAL',
        requestId: requestId(),
        comment: event.comment,
      })),
      troubleshootingOutcome: 'ALREADY_TRIED',
    });
  }

  return cases.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export const RMA_CASES: RmaCase[] = buildAll();

export function rmaById(id: string): RmaCase | undefined {
  return RMA_CASES.find((r) => r.id === id || r.code === id);
}

export function rmasByCustomer(customerId: string): RmaCase[] {
  return RMA_CASES.filter((r) => r.customerId === customerId);
}

export function rmasBySerial(serial: string): RmaCase[] {
  return RMA_CASES.filter((r) => r.units.some((u) => u.serial === serial));
}

export const BATCH_RMA_ID = 'rma_rma_260194';
export const BREACHED_RMA_CODE = 'RMA-260181';
