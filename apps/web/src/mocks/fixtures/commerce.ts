/**
 * Solicitudes de precio especial y programa Ashir Partner.
 */
import type {
  AuditEvent,
  PartnerBenefit,
  PartnerMission,
  PartnerStatus,
  PointsLedgerEntry,
  SpecialPriceRequest,
  SpecialPriceStatus,
  CustomerSegment,
} from '@/types';
import { CUSTOMERS, customerById } from '@/mocks/fixtures/customers';
import { SELLABLE_PRODUCTS, productBySku } from '@/mocks/fixtures/catalog';
import { addDays, betweenSeeded, money, num, requestId, seeded } from '@/lib/utils';

const NOW = new Date('2026-09-22T11:00:00-03:00').toISOString();

/* ------------------------------------------------------------------ */
/* precio especial / deal registration                                 */
/* ------------------------------------------------------------------ */

const END_CUSTOMERS = [
  'Municipalidad de Vicente López',
  'Estudio Contable Marino & Asoc.',
  'Colegio San Andrés',
  'Cooperativa Eléctrica Zona Norte',
  'Clínica Del Valle',
  'Instituto Tecnológico Sur',
  'Agencia Digital Nodo',
  'Consorcio Torres del Parque',
];

const PROJECTS = [
  'Renovación de parque de PCs 2026',
  'Laboratorio de diseño',
  'Sala de capacitación',
  'Puesto de trabajo híbrido',
  'Servidor de archivos departamental',
  'Renovación de gaming corner',
];

const COMPETITORS = ['Air Computers', 'Invid', 'Grupo Núcleo', 'New Bytes', null, null];

const STATUS_PLAN: SpecialPriceStatus[] = [
  'PM_REVIEW',
  'PM_REVIEW',
  'SALES_REVIEW',
  'SUBMITTED',
  'COUNTEROFFERED',
  'APPROVED',
  'APPROVED',
  'APPROVED',
  'REJECTED',
  'EXPIRED',
  'SUBMITTED',
  'PM_REVIEW',
];

function buildRequest(index: number, status: SpecialPriceStatus, seq: number): SpecialPriceRequest {
  const seed = `spr${index}`;
  const rnd = seeded(seed);
  const customer = CUSTOMERS[Math.floor(rnd() * (CUSTOMERS.length - 1))]!;
  const product = SELLABLE_PRODUCTS[Math.floor(rnd() * SELLABLE_PRODUCTS.length)]!;
  const quantity = betweenSeeded(`${seed}q`, 15, 140);
  const current = num(product.listPrice);
  const targetPct = betweenSeeded(`${seed}t`, 6, 18);
  const target = Math.round(current * (1 - targetPct / 100) * 100) / 100;
  const cost = product.cost ? num(product.cost) : current * 0.82;
  const resultingMargin = target > 0 ? ((target - cost) / target) * 100 : 0;
  const baseMargin = current > 0 ? ((current - cost) / current) * 100 : 0;

  const createdAt = addDays(NOW, -betweenSeeded(`${seed}age`, 1, 45));
  const code = `PE-${1_030 + seq}`;
  const id = `spr_${code.toLowerCase().replace('-', '_')}`;

  const approved = status === 'APPROVED';
  const counter = status === 'COUNTEROFFERED';
  const approvedPrice = approved
    ? target
    : counter
      ? Math.round((target + (current - target) * 0.4) * 100) / 100
      : null;

  const auditLog: AuditEvent[] = [
    {
      id: `aud_${code}_1`,
      at: createdAt,
      actor: customer.tradeName,
      actorRole: 'CLIENT',
      action: 'Solicitud de precio especial creada',
      entity: 'SpecialPriceRequest',
      entityId: code,
      previousValue: null,
      newValue: 'SUBMITTED',
      origin: 'PORTAL',
      requestId: requestId(),
      comment: null,
    },
  ];

  if (status !== 'SUBMITTED') {
    auditLog.push({
      id: `aud_${code}_2`,
      at: addDays(createdAt, 0.3),
      actor: 'Martín Rodríguez',
      actorRole: 'SALES',
      action: 'Revisión comercial completada',
      entity: 'SpecialPriceRequest',
      entityId: code,
      previousValue: 'SUBMITTED',
      newValue: 'PM_REVIEW',
      origin: 'PORTAL',
      requestId: requestId(),
      comment: 'Cliente con historial de compra sostenido. Se eleva al PM de la marca.',
    });
  }

  if (approved || counter || status === 'REJECTED') {
    auditLog.push({
      id: `aud_${code}_3`,
      at: addDays(createdAt, 1.2),
      actor: 'Diego Sanabria',
      actorRole: 'PM',
      action:
        status === 'REJECTED'
          ? 'Solicitud rechazada'
          : counter
            ? 'Contraoferta enviada'
            : 'Solicitud aprobada',
      entity: 'SpecialPriceRequest',
      entityId: code,
      previousValue: 'PM_REVIEW',
      newValue: status,
      origin: 'PORTAL',
      requestId: requestId(),
      comment:
        status === 'REJECTED'
          ? `El margen resultante (${resultingMargin.toFixed(1)}%) queda por debajo del piso de la marca.`
          : counter
            ? `Se ofrece USD ${approvedPrice} manteniendo un margen aceptable para el volumen solicitado.`
            : `Aprobado por ${quantity} unidades con vigencia de 30 días.`,
    });
  }

  return {
    id,
    code,
    customerId: customer.id,
    customerName: customer.tradeName,
    productId: product.id,
    sku: product.sku,
    productName: product.name,
    brand: product.brand,
    quantity,
    currentPrice: money(current),
    targetPrice: money(target),
    approvedPrice: approvedPrice === null ? null : money(approvedPrice),
    approvedQuantity: approved || counter ? quantity : null,
    approvedValidUntil: approved || counter ? addDays(createdAt, 30) : null,
    cost: money(cost),
    resultingMarginPct: resultingMargin.toFixed(1),
    baseMarginPct: baseMargin.toFixed(1),
    endCustomer: END_CUSTOMERS[betweenSeeded(`${seed}ec`, 0, END_CUSTOMERS.length - 1)]!,
    project: PROJECTS[betweenSeeded(`${seed}pr`, 0, PROJECTS.length - 1)]!,
    competitor: COMPETITORS[betweenSeeded(`${seed}co`, 0, COMPETITORS.length - 1)] ?? null,
    expectedCloseDate: addDays(createdAt, betweenSeeded(`${seed}cd`, 10, 60)),
    comments:
      'El cliente final pidió tres cotizaciones. Necesitamos el precio para cerrar esta semana o el proyecto se posterga al trimestre siguiente.',
    attachments:
      betweenSeeded(`${seed}at`, 0, 10) > 6
        ? [{ name: 'cotizacion-competencia.pdf', size: '620 KB', type: 'application/pdf' }]
        : [],
    status,
    pmId: product.pmId,
    salesRepId: customer.salesRepId,
    createdAt,
    updatedAt: auditLog[auditLog.length - 1]!.at,
    auditLog,
  };
}

/**
 * Solicitud protagonista del guion (Escenario B): PE-1042, Compumundo X,
 * 80 unidades de una motherboard MSI. Se fija a mano para que los numeros
 * del guion coincidan exactamente con la pantalla.
 */
function buildHeroRequest(): SpecialPriceRequest {
  const product = productBySku('MSMOPRB650MB')!;
  const customer = customerById('cus_compumundo')!;
  const current = num(product.listPrice);
  const target = 142;
  const cost = product.cost ? num(product.cost) : current * 0.85;
  const createdAt = addDays(NOW, -2);

  return {
    id: 'spr_pe_1042',
    code: 'PE-1042',
    customerId: customer.id,
    customerName: customer.tradeName,
    productId: product.id,
    sku: product.sku,
    productName: product.name,
    brand: product.brand,
    quantity: 80,
    currentPrice: money(current),
    targetPrice: money(target),
    approvedPrice: null,
    approvedQuantity: null,
    approvedValidUntil: null,
    cost: money(cost),
    resultingMarginPct: (((target - cost) / target) * 100).toFixed(1),
    baseMarginPct: (((current - cost) / current) * 100).toFixed(1),
    endCustomer: 'Municipalidad de Vicente López',
    project: 'Renovación de parque de PCs 2026',
    competitor: 'Air Computers',
    expectedCloseDate: addDays(NOW, 12),
    comments:
      'Licitación por 80 equipos. El pliego cierra el viernes. Si mejoramos el precio unitario cerramos las 80 unidades de una sola vez.',
    attachments: [{ name: 'pliego-licitacion.pdf', size: '1,2 MB', type: 'application/pdf' }],
    status: 'PM_REVIEW',
    pmId: product.pmId,
    salesRepId: customer.salesRepId,
    createdAt,
    updatedAt: addDays(createdAt, 0.4),
    auditLog: [
      {
        id: 'aud_pe1042_1',
        at: createdAt,
        actor: 'Compumundo X',
        actorRole: 'CLIENT',
        action: 'Solicitud de precio especial creada',
        entity: 'SpecialPriceRequest',
        entityId: 'PE-1042',
        previousValue: null,
        newValue: 'SUBMITTED',
        origin: 'PORTAL',
        requestId: requestId(),
        comment: null,
      },
      {
        id: 'aud_pe1042_2',
        at: addDays(createdAt, 0.4),
        actor: 'Sofía Maidana',
        actorRole: 'SALES',
        action: 'Elevada al Product Manager',
        entity: 'SpecialPriceRequest',
        entityId: 'PE-1042',
        previousValue: 'SUBMITTED',
        newValue: 'PM_REVIEW',
        origin: 'PORTAL',
        requestId: requestId(),
        comment: 'Cliente Platinum con compra sostenida. El volumen justifica revisar el margen.',
      },
    ],
  };
}

export const SPECIAL_PRICE_REQUESTS: SpecialPriceRequest[] = [
  buildHeroRequest(),
  ...STATUS_PLAN.map((status, i) => buildRequest(i, status, i)),
].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

export const HERO_REQUEST_ID = 'spr_pe_1042';

export function specialPriceById(id: string): SpecialPriceRequest | undefined {
  return SPECIAL_PRICE_REQUESTS.find((r) => r.id === id || r.code === id);
}

/* ------------------------------------------------------------------ */
/* programa Ashir Partner                                              */
/* ------------------------------------------------------------------ */

const TIER_REQUIREMENT: Record<CustomerSegment, number> = {
  SILVER: 0,
  GOLD: 180_000,
  PLATINUM: 480_000,
};

const NEXT_TIER: Record<CustomerSegment, CustomerSegment | null> = {
  SILVER: 'GOLD',
  GOLD: 'PLATINUM',
  PLATINUM: null,
};

export const PARTNER_BENEFITS: PartnerBenefit[] = [
  {
    id: 'ben_desc_adicional',
    name: 'Descuento adicional seleccionado',
    description: 'Un 2% extra sobre una marca a elección durante un mes calendario.',
    category: 'COMMERCIAL',
    cost: 18_000,
    requiredTier: 'GOLD',
    status: 'AVAILABLE',
    validUntil: null,
    rules: 'Aplicable a una sola marca por período. No acumulable con promociones no acumulables.',
  },
  {
    id: 'ben_envio',
    name: 'Envío bonificado sin mínimo',
    description: 'Envíos sin cargo durante 30 días, sin exigir el monto mínimo de la zona.',
    category: 'LOGISTICS',
    cost: 9_500,
    requiredTier: 'SILVER',
    status: 'ACTIVE',
    validUntil: addDays(NOW, 18),
    rules: 'Hasta 8 envíos dentro del período. No incluye despachos al exterior.',
  },
  {
    id: 'ben_lanzamientos',
    name: 'Acceso anticipado a lanzamientos',
    description: 'Cupo reservado en los lanzamientos de marca antes de la apertura general.',
    category: 'STOCK',
    cost: null,
    requiredTier: 'PLATINUM',
    status: 'ACTIVE',
    validUntil: null,
    rules: 'Beneficio automático del nivel Platinum. El cupo se define por lanzamiento.',
  },
  {
    id: 'ben_capacitacion',
    name: 'Capacitación técnica de marca',
    description: 'Dos cupos por trimestre en las capacitaciones dictadas por los fabricantes.',
    category: 'TRAINING',
    cost: 6_000,
    requiredTier: 'SILVER',
    status: 'AVAILABLE',
    validUntil: null,
    rules: 'Sujeto a calendario del fabricante. Los cupos no utilizados no se acumulan.',
  },
  {
    id: 'ben_pop',
    name: 'Material POP para el local',
    description: 'Kit de exhibición de marca: banners, cenefas y separadores de góndola.',
    category: 'MARKETING',
    cost: 12_000,
    requiredTier: 'GOLD',
    status: 'AVAILABLE',
    validUntil: null,
    rules: 'Un kit por local por semestre. Requiere foto de la exhibición montada.',
  },
  {
    id: 'ben_fondos_mkt',
    name: 'Fondos de marketing cooperativo',
    description: 'Reintegro de hasta USD 1.500 en campañas conjuntas con Ashir.',
    category: 'MARKETING',
    cost: 45_000,
    requiredTier: 'PLATINUM',
    status: 'AVAILABLE',
    validUntil: null,
    rules: 'Requiere plan de campaña aprobado y comprobantes. El reintegro se acredita como nota de crédito.',
  },
  {
    id: 'ben_demo',
    name: 'Equipos demo en comodato',
    description: 'Unidades de exhibición para el salón de ventas, en préstamo por 90 días.',
    category: 'STOCK',
    cost: 30_000,
    requiredTier: 'PLATINUM',
    status: 'LOCKED',
    validUntil: null,
    rules: 'Sujeto a disponibilidad de la marca. Requiere acta de comodato firmada.',
  },
  {
    id: 'ben_prioridad',
    name: 'Prioridad de stock',
    description: 'Prioridad en la asignación de mercadería con cupo limitado.',
    category: 'STOCK',
    cost: null,
    requiredTier: 'PLATINUM',
    status: 'ACTIVE',
    validUntil: null,
    rules: 'Beneficio automático del nivel Platinum mientras se mantenga el volumen del período.',
  },
  {
    id: 'ben_atencion',
    name: 'Atención comercial prioritaria',
    description: 'Línea directa con el ejecutivo asignado y respuesta garantizada en 4 horas hábiles.',
    category: 'SUPPORT',
    cost: null,
    requiredTier: 'GOLD',
    status: 'ACTIVE',
    validUntil: null,
    rules: 'Beneficio automático desde nivel Gold.',
  },
  {
    id: 'ben_rma_express',
    name: 'RMA express',
    description: 'Retiro a domicilio y diagnóstico prioritario en casos de garantía.',
    category: 'SUPPORT',
    cost: 22_000,
    requiredTier: 'GOLD',
    status: 'AVAILABLE',
    validUntil: null,
    rules: 'Hasta 5 casos por trimestre. No modifica los plazos del fabricante.',
  },
];

function buildMissions(customerId: string): PartnerMission[] {
  const s = seeded(customerId + 'mis');
  return [
    {
      id: 'mis_msi_volumen',
      name: 'Alcanzar USD 25.000 en MSI',
      description: 'Compras acumuladas de la marca MSI durante el trimestre en curso.',
      reward: '+8.000 puntos y 1% de descuento adicional el mes siguiente',
      rewardPoints: 8_000,
      progress: Math.round(14_200 + s() * 6_000),
      target: 25_000,
      unit: 'USD',
      brand: 'MSI',
      endsAt: '2026-09-30T23:59:59-03:00',
      status: 'IN_PROGRESS',
    },
    {
      id: 'mis_mix_categorias',
      name: 'Incorporar 6 categorías distintas',
      description: 'Comprar al menos una unidad de seis categorías diferentes en el trimestre.',
      reward: '+4.000 puntos',
      rewardPoints: 4_000,
      progress: 4,
      target: 6,
      unit: 'CATEGORIES',
      brand: null,
      endsAt: '2026-09-30T23:59:59-03:00',
      status: 'IN_PROGRESS',
    },
    {
      id: 'mis_lanzamiento',
      name: 'Comprar un lanzamiento del trimestre',
      description: 'Adquirir al menos 3 unidades de un producto marcado como nuevo ingreso.',
      reward: '+3.000 puntos y acceso anticipado al próximo lanzamiento',
      rewardPoints: 3_000,
      progress: 3,
      target: 3,
      unit: 'UNITS',
      brand: null,
      endsAt: '2026-09-30T23:59:59-03:00',
      status: 'COMPLETED',
    },
    {
      id: 'mis_pronto_pago',
      name: 'Cuatro pedidos con pronto pago',
      description: 'Cerrar cuatro pedidos con pago contado o transferencia dentro de 7 días.',
      reward: '+5.000 puntos',
      rewardPoints: 5_000,
      progress: 3,
      target: 4,
      unit: 'ORDERS',
      brand: null,
      endsAt: '2026-10-31T23:59:59-03:00',
      status: 'IN_PROGRESS',
    },
    {
      id: 'mis_thermaltake',
      name: 'Sumar Thermaltake al mix',
      description: 'Comprar al menos USD 6.000 de Thermaltake en el trimestre.',
      reward: '+6.000 puntos y kit POP de la marca',
      rewardPoints: 6_000,
      progress: Math.round(2_100 + s() * 1_500),
      target: 6_000,
      unit: 'USD',
      brand: 'THERMALTAKE',
      endsAt: '2026-09-30T23:59:59-03:00',
      status: 'IN_PROGRESS',
    },
  ];
}

function buildLedger(customerId: string, points: number): PointsLedgerEntry[] {
  const entries: PointsLedgerEntry[] = [];
  let balance = points;
  const reasons: [PointsLedgerEntry['type'], string, string | null][] = [
    ['EARNED', 'Puntos por pedido facturado', 'ASH-24853'],
    ['EARNED', 'Multiplicador x2 ADATA', 'PTS-X2-ADATA'],
    ['REDEEMED', 'Canje: Envío bonificado sin mínimo', 'ben_envio'],
    ['EARNED', 'Misión completada: comprar un lanzamiento', 'mis_lanzamiento'],
    ['EARNED', 'Puntos por pedido facturado', 'ASH-24790'],
    ['EXPIRED', 'Vencimiento de puntos del período anterior', null],
    ['EARNED', 'Puntos por pedido facturado', 'ASH-24702'],
    ['ADJUSTED', 'Ajuste manual por nota de crédito', 'NC-0004-00000121'],
    ['EARNED', 'Puntos por pedido facturado', 'ASH-24655'],
  ];

  reasons.forEach(([type, reason, reference], i) => {
    const magnitude = betweenSeeded(`${customerId}pt${i}`, 900, 9_500);
    const delta = type === 'EARNED' ? magnitude : -magnitude;
    entries.push({
      id: `pt_${customerId}_${i}`,
      at: addDays(NOW, -(i * 12 + betweenSeeded(`${customerId}d${i}`, 1, 6))),
      type,
      points: delta,
      balance,
      reason,
      reference,
      rule: type === 'EARNED' ? '1 punto cada USD 0,20 facturado' : null,
      expiresAt: type === 'EARNED' ? addDays(NOW, 365 - i * 12) : null,
      actor: type === 'ADJUSTED' ? 'Valeria Quiroga' : 'Sistema',
    });
    balance -= delta;
  });

  return entries;
}

export function partnerStatusFor(customerId: string): PartnerStatus {
  const customer = customerById(customerId) ?? CUSTOMERS[0]!;
  const tier = customer.partnerTier;
  const next = NEXT_TIER[tier];
  const achieved = num(customer.purchases12m);
  const required = next ? TIER_REQUIREMENT[next] : TIER_REQUIREMENT[tier];

  return {
    customerId: customer.id,
    tier,
    points: customer.points,
    pointsExpiringSoon: {
      points: Math.round(customer.points * 0.08),
      expiresAt: '2026-10-31T23:59:59-03:00',
    },
    tierProgress: {
      current: tier,
      next,
      achieved: money(achieved),
      required: money(required),
      progressPct: next ? Math.min(100, Math.round((achieved / required) * 100)) : 100,
      periodEndsAt: '2026-12-31T23:59:59-03:00',
    },
    benefits: PARTNER_BENEFITS.map((b) => ({
      ...b,
      status:
        TIER_ORDER[b.requiredTier] > TIER_ORDER[tier]
          ? 'LOCKED'
          : b.status === 'LOCKED'
            ? 'AVAILABLE'
            : b.status,
    })),
    missions: buildMissions(customer.id),
    ledger: buildLedger(customer.id, customer.points),
  };
}

const TIER_ORDER: Record<CustomerSegment, number> = { SILVER: 0, GOLD: 1, PLATINUM: 2 };

export { TIER_REQUIREMENT, NEXT_TIER, TIER_ORDER };
