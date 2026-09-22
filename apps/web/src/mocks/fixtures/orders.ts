/**
 * Pedidos de la demo.
 *
 * Se generan de forma determinista a partir de clientes y productos reales,
 * pasando por el motor de precios: los totales de un pedido coinciden con lo
 * que el catalogo mostraria hoy para ese cliente.
 */
import type { AuditEvent, Money, Order, OrderItem, OrderStatus, Role } from '@/types';
import { CUSTOMERS } from '@/mocks/fixtures/customers';
import { SELLABLE_PRODUCTS, productBySku } from '@/mocks/fixtures/catalog';
import { evaluatePrice, estimateFreight } from '@/services/mock/pricing-engine';
import { addDays, betweenSeeded, money, num, requestId, seeded } from '@/lib/utils';
import { personJobTitle, personName } from '@/mocks/fixtures/people';

const NOW = new Date('2026-09-22T11:00:00-03:00').toISOString();

/** Distribucion de estados: mayoria entregados, algunos en curso. */
const STATUS_PLAN: { status: OrderStatus; count: number }[] = [
  { status: 'DELIVERED', count: 12 },
  { status: 'SHIPPED', count: 4 },
  { status: 'PICKING', count: 4 },
  { status: 'CONFIRMED', count: 3 },
  { status: 'SALES_REVIEW', count: 2 },
  { status: 'PENDING_APPROVAL', count: 2 },
  { status: 'PENDING_PAYMENT', count: 2 },
  { status: 'PARTIALLY_SHIPPED', count: 1 },
  { status: 'OBSERVED', count: 1 },
  { status: 'DRAFT', count: 2 },
  { status: 'CANCELLED', count: 1 },
];

const STATUS_AGE_DAYS: Record<OrderStatus, [number, number]> = {
  DRAFT: [0, 2],
  CONFIRMED: [0, 3],
  SALES_REVIEW: [0, 2],
  PENDING_APPROVAL: [1, 4],
  PENDING_PAYMENT: [2, 8],
  OBSERVED: [1, 5],
  PICKING: [1, 4],
  PARTIALLY_SHIPPED: [3, 7],
  SHIPPED: [3, 9],
  DELIVERED: [10, 180],
  CANCELLED: [5, 60],
};

/** Modificaciones permitidas por estado: el motor de "modificacion inteligente". */
export const ALLOWED_MODIFICATIONS: Record<OrderStatus, Order['allowedModifications']> = {
  DRAFT: ['ADD_ITEM', 'REMOVE_ITEM', 'CHANGE_QTY', 'CHANGE_NOTES', 'CHANGE_DELIVERY', 'CANCEL'],
  CONFIRMED: ['ADD_ITEM', 'REMOVE_ITEM', 'CHANGE_QTY', 'CHANGE_NOTES', 'CHANGE_DELIVERY', 'CANCEL'],
  SALES_REVIEW: ['CHANGE_QTY', 'CHANGE_NOTES', 'REQUEST_CHANGE'],
  PENDING_APPROVAL: ['CHANGE_NOTES', 'REQUEST_CHANGE'],
  PENDING_PAYMENT: ['CHANGE_NOTES', 'REQUEST_CHANGE', 'CANCEL'],
  OBSERVED: ['CHANGE_QTY', 'REMOVE_ITEM', 'CHANGE_NOTES', 'REQUEST_CHANGE'],
  PICKING: ['CHANGE_NOTES', 'REQUEST_CHANGE'],
  PARTIALLY_SHIPPED: ['CHANGE_NOTES', 'REQUEST_CHANGE'],
  SHIPPED: ['CHANGE_NOTES'],
  DELIVERED: [],
  CANCELLED: [],
};

const CARRIERS = ['Andreani', 'OCA', 'Cruz del Sur', 'Vía Cargo', 'Flete propio Ashir'];

const NOTE_POOL = [
  'Entregar por la mañana, el depósito cierra a las 13 h.',
  'Facturar a nombre de la sucursal centro.',
  'Coordinar con Nicolás antes de despachar.',
  'Unificar con el pedido anterior si todavía no salió.',
  null,
  null,
];

function auditEvent(
  seed: string,
  at: string,
  actor: string,
  actorRole: Role | 'SYSTEM',
  action: string,
  entityId: string,
  extra: Partial<AuditEvent> = {},
): AuditEvent {
  return {
    id: `aud_${seed}`,
    at,
    actor,
    actorRole,
    action,
    entity: 'Order',
    entityId,
    previousValue: null,
    newValue: null,
    origin: 'PORTAL',
    requestId: requestId(),
    comment: null,
    ...extra,
  };
}

function buildItems(orderSeed: string, customerIndex: number, status: OrderStatus): OrderItem[] {
  const customer = CUSTOMERS[customerIndex]!;
  const rnd = seeded(orderSeed);
  const itemCount = 2 + Math.floor(rnd() * 4);
  const items: OrderItem[] = [];
  const pool = SELLABLE_PRODUCTS.filter((p) =>
    customer.topBrands.length ? customer.topBrands.includes(p.brand) : true,
  );
  const source = pool.length >= itemCount ? pool : SELLABLE_PRODUCTS;

  for (let i = 0; i < itemCount; i++) {
    const product = source[Math.floor(rnd() * source.length) % source.length]!;
    if (items.some((it) => it.productId === product.id)) continue;
    const quantity = betweenSeeded(`${orderSeed}q${i}`, 1, 24);
    const evaluation = evaluatePrice({ product, customer, quantity, skipTiers: true });

    items.push({
      id: `oi_${orderSeed}_${i}`,
      productId: product.id,
      sku: product.sku,
      name: product.name,
      brand: product.brand,
      quantity,
      unitPrice: evaluation.finalUnitPrice,
      listPrice: product.listPrice!,
      discountPct: evaluation.totalDiscountPct,
      lineTotal: evaluation.lineTotal,
      appliedConditions: evaluation.appliedConditions.map((c) => c.code),
      shippedQty:
        status === 'DELIVERED' || status === 'SHIPPED'
          ? quantity
          : status === 'PARTIALLY_SHIPPED'
            ? Math.max(1, Math.floor(quantity / 2))
            : 0,
      stockAtOrder: product.stock,
    });
  }

  return items.length > 0 ? items : buildItems(`${orderSeed}x`, customerIndex, status);
}

function buildOrder(index: number, status: OrderStatus, numberSeq: number): Order {
  const seed = `ord${index}`;
  const customerIndex = betweenSeeded(`${seed}c`, 0, CUSTOMERS.length - 2); // el prospect no tiene pedidos
  const customer = CUSTOMERS[customerIndex]!;
  const [minAge, maxAge] = STATUS_AGE_DAYS[status];
  const ageDays = betweenSeeded(`${seed}age`, minAge, maxAge);
  const createdAt = addDays(NOW, -ageDays);

  const items = buildItems(seed, customerIndex, status);
  const subtotalNet = items.reduce((acc, it) => acc + num(it.lineTotal), 0);
  const listTotal = items.reduce((acc, it) => acc + num(it.listPrice) * it.quantity, 0);
  const discountTotal = listTotal - subtotalNet;

  const firstProduct = productBySku(items[0]!.sku)!;
  const evaluation = evaluatePrice({
    product: firstProduct,
    customer,
    quantity: items[0]!.quantity,
    orderAmount: subtotalNet,
    skipTiers: true,
  });

  const freight = evaluation.freeFreight ? money(0) : estimateFreight(customer, subtotalNet);
  const taxTotal = items.reduce((acc, it) => {
    const p = productBySku(it.sku);
    return acc + num(it.lineTotal) * (p?.vatRate ?? 0.21);
  }, 0);
  const total = subtotalNet + num(freight) + taxTotal;

  const isDone = status === 'DELIVERED';
  const shippedAt =
    status === 'SHIPPED' || status === 'DELIVERED' || status === 'PARTIALLY_SHIPPED'
      ? addDays(createdAt, 2)
      : null;
  const deliveredAt = isDone ? addDays(createdAt, 4) : null;

  const number = `ASH-${24_500 + numberSeq}`;
  const orderId = `ord_${number.toLowerCase().replace('-', '_')}`;

  /* --- historial inmutable --- */
  const auditLog: AuditEvent[] = [
    auditEvent(`${seed}1`, createdAt, personName('usr_cliente'), 'CLIENT', 'Pedido creado como borrador', orderId, {
      newValue: 'DRAFT',
    }),
  ];
  if (status !== 'DRAFT') {
    auditLog.push(
      auditEvent(`${seed}2`, addDays(createdAt, 0.02), customer.tradeName, 'CLIENT', 'Pedido confirmado', orderId, {
        previousValue: 'DRAFT',
        newValue: 'CONFIRMED',
      }),
    );
  }
  if (['SALES_REVIEW', 'PICKING', 'SHIPPED', 'DELIVERED', 'PARTIALLY_SHIPPED'].includes(status)) {
    auditLog.push(
      auditEvent(
        `${seed}3`,
        addDays(createdAt, 0.1),
        personName(customer.salesRepId),
        'SALES',
        'Validación comercial aprobada',
        orderId,
        { previousValue: 'CONFIRMED', newValue: 'SALES_REVIEW', comment: 'Crédito y condiciones verificados' },
      ),
    );
  }
  if (['PICKING', 'SHIPPED', 'DELIVERED', 'PARTIALLY_SHIPPED'].includes(status)) {
    auditLog.push(
      auditEvent(`${seed}4`, addDays(createdAt, 1), 'Depósito Ashir', 'SYSTEM', 'Pedido en preparación', orderId, {
        previousValue: 'SALES_REVIEW',
        newValue: 'PICKING',
        origin: 'ERP',
      }),
    );
  }
  if (shippedAt) {
    auditLog.push(
      auditEvent(`${seed}5`, shippedAt, 'Logística Ashir', 'SYSTEM', 'Pedido despachado', orderId, {
        previousValue: 'PICKING',
        newValue: status === 'PARTIALLY_SHIPPED' ? 'PARTIALLY_SHIPPED' : 'SHIPPED',
        origin: 'ERP',
      }),
    );
  }
  if (deliveredAt) {
    auditLog.push(
      auditEvent(`${seed}6`, deliveredAt, 'Transporte', 'SYSTEM', 'Entrega confirmada', orderId, {
        previousValue: 'SHIPPED',
        newValue: 'DELIVERED',
        origin: 'ERP',
      }),
    );
  }
  if (status === 'OBSERVED') {
    auditLog.push(
      auditEvent(
        `${seed}7`,
        addDays(createdAt, 1),
        personName(customer.salesRepId),
        'SALES',
        'Pedido observado',
        orderId,
        { newValue: 'OBSERVED', comment: 'Falta orden de compra del cliente para liberar la preparación.' },
      ),
    );
  }
  if (status === 'CANCELLED') {
    auditLog.push(
      auditEvent(`${seed}8`, addDays(createdAt, 1), customer.tradeName, 'CLIENT', 'Pedido cancelado', orderId, {
        newValue: 'CANCELLED',
        comment: 'Cancelado a pedido del cliente.',
      }),
    );
  }

  const requiredApprovals: Order['requiredApprovals'] = [];
  if (status === 'PENDING_APPROVAL') {
    requiredApprovals.push({
      type: 'CREDIT',
      label: 'Excede crédito disponible',
      status: 'PENDING',
      approver: personName(customer.salesRepId),
    });
  }
  if (evaluation.requiresApproval.length > 0 && status !== 'DRAFT') {
    requiredApprovals.push({
      type: 'CONDITION',
      label: `Condición ${evaluation.requiresApproval[0]!.label} requiere aprobación`,
      status: status === 'PENDING_APPROVAL' ? 'PENDING' : 'APPROVED',
      approver: 'Diego Sanabria',
    });
  }

  return {
    id: orderId,
    number,
    customerId: customer.id,
    customerName: customer.tradeName,
    status,
    version: auditLog.length,
    items,
    subtotal: money(subtotalNet),
    discountTotal: money(discountTotal),
    taxTotal: money(taxTotal),
    freight,
    total: money(total),
    currency: 'USD',
    fxRate: 1_412,
    paymentTerm: customer.paymentTerm,
    deliveryMethod: betweenSeeded(`${seed}dm`, 0, 10) > 2 ? 'DELIVERY' : 'PICKUP',
    deliveryAddress: customer.address,
    customerPO:
      betweenSeeded(`${seed}po`, 0, 10) > 5 ? `OC-${betweenSeeded(`${seed}po2`, 1000, 9999)}` : null,
    notes: NOTE_POOL[betweenSeeded(`${seed}n`, 0, NOTE_POOL.length - 1)] ?? null,
    appliedConditions: evaluation.appliedConditions,
    requiredApprovals,
    salesRepId: customer.salesRepId,
    // Parte de los pedidos historicos los cargo el ejecutivo por el cliente:
    // es el flujo de «me lo pidio por WhatsApp y se lo armo yo».
    ...(betweenSeeded(`${seed}origin`, 0, 10) > 7
      ? {
          origin: 'ASSISTED' as const,
          placedBy: {
            userId: customer.salesRepId,
            name: personName(customer.salesRepId),
            jobTitle: personJobTitle(customer.salesRepId),
          },
        }
      : { origin: 'PORTAL' as const, placedBy: null }),
    createdAt,
    updatedAt: auditLog[auditLog.length - 1]!.at,
    confirmedAt: status === 'DRAFT' ? null : addDays(createdAt, 0.02),
    shippedAt,
    deliveredAt,
    invoiceIds: isDone || status === 'SHIPPED' ? [customer.account.invoices[0]?.id ?? ''].filter(Boolean) : [],
    tracking: shippedAt
      ? {
          carrier: CARRIERS[betweenSeeded(`${seed}car`, 0, CARRIERS.length - 1)]!,
          code: `${betweenSeeded(`${seed}tr`, 100_000_000, 999_999_999)}`,
          url: null,
          status: deliveredAt ? 'Entregado' : 'En tránsito',
        }
      : null,
    auditLog,
    allowedModifications: ALLOWED_MODIFICATIONS[status],
  };
}

/* ------------------------------------------------------------------ */
/* construccion                                                        */
/* ------------------------------------------------------------------ */

function buildAll(): Order[] {
  const orders: Order[] = [];
  let index = 0;
  let seq = 0;
  for (const plan of STATUS_PLAN) {
    for (let i = 0; i < plan.count; i++) {
      orders.push(buildOrder(index++, plan.status, seq++));
    }
  }
  return orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export const ORDERS: Order[] = buildAll();

/**
 * Pedido protagonista de la demo: ASH-24853 de Gaming Store.
 * Se construye aparte para poder fijar su contenido exacto (es el que aparece
 * en el guion de RMA y en la cadena serial -> factura -> garantia).
 */
export const HERO_ORDER_ID = 'ord_ash_24853';

function buildHeroOrder(): Order {
  const customer = CUSTOMERS.find((c) => c.id === 'cus_gaming_store')!;
  const skus = ['MSVG5070TV3O', 'MSMOPRB650MB', 'TTGACE300TGB', 'ADRAD16G4320'];
  const quantities = [4, 10, 12, 6];
  const createdAt = '2026-03-14T10:22:00-03:00';

  const items: OrderItem[] = skus.flatMap((sku, i) => {
    const product = productBySku(sku);
    if (!product?.listPrice) return [];
    const quantity = quantities[i]!;
    const evaluation = evaluatePrice({
      product,
      customer,
      quantity,
      date: createdAt,
      skipTiers: true,
    });
    return [
      {
        id: `oi_hero_${i}`,
        productId: product.id,
        sku: product.sku,
        name: product.name,
        brand: product.brand,
        quantity,
        unitPrice: evaluation.finalUnitPrice,
        listPrice: product.listPrice,
        discountPct: evaluation.totalDiscountPct,
        lineTotal: evaluation.lineTotal,
        appliedConditions: evaluation.appliedConditions.map((c) => c.code),
        shippedQty: quantity,
        stockAtOrder: product.stock,
      },
    ];
  });

  const subtotal = items.reduce((acc, it) => acc + num(it.lineTotal), 0);
  const listTotal = items.reduce((acc, it) => acc + num(it.listPrice) * it.quantity, 0);
  const taxTotal = items.reduce((acc, it) => {
    const p = productBySku(it.sku);
    return acc + num(it.lineTotal) * (p?.vatRate ?? 0.21);
  }, 0);
  const freight: Money = money(0);
  const auditLog: AuditEvent[] = [
    auditEvent('hero1', createdAt, 'Gaming Store', 'CLIENT', 'Pedido creado como borrador', HERO_ORDER_ID, {
      newValue: 'DRAFT',
    }),
    auditEvent('hero2', '2026-03-14T11:22:00-03:00', 'Gaming Store', 'CLIENT', 'Cliente agregó 5 × MSMOPRB650MB', HERO_ORDER_ID),
    auditEvent('hero3', '2026-03-14T11:31:00-03:00', 'Martín Rodríguez', 'SALES', 'Comercial modificó cantidad 5 → 10', HERO_ORDER_ID, {
      previousValue: '5',
      newValue: '10',
      comment: 'El cliente pidió duplicar para alcanzar el escalón de volumen.',
    }),
    auditEvent('hero4', '2026-03-14T11:34:00-03:00', 'Diego Sanabria', 'PM', 'PM autorizó precio especial', HERO_ORDER_ID, {
      comment: 'Solicitud PE-1042 aprobada a USD 121,90 por unidad.',
    }),
    auditEvent('hero5', '2026-03-14T11:37:00-03:00', 'Gaming Store', 'CLIENT', 'Pedido confirmado', HERO_ORDER_ID, {
      previousValue: 'DRAFT',
      newValue: 'CONFIRMED',
    }),
    auditEvent('hero6', '2026-03-15T09:05:00-03:00', 'Depósito Ashir', 'SYSTEM', 'Pedido en preparación', HERO_ORDER_ID, {
      origin: 'ERP',
      previousValue: 'CONFIRMED',
      newValue: 'PICKING',
    }),
    auditEvent('hero7', '2026-03-16T14:20:00-03:00', 'Logística Ashir', 'SYSTEM', 'Pedido despachado', HERO_ORDER_ID, {
      origin: 'ERP',
      previousValue: 'PICKING',
      newValue: 'SHIPPED',
    }),
    auditEvent('hero8', '2026-03-17T11:40:00-03:00', 'Andreani', 'SYSTEM', 'Entrega confirmada', HERO_ORDER_ID, {
      origin: 'ERP',
      previousValue: 'SHIPPED',
      newValue: 'DELIVERED',
    }),
  ];

  return {
    id: HERO_ORDER_ID,
    number: 'ASH-24853',
    customerId: customer.id,
    customerName: customer.tradeName,
    status: 'DELIVERED',
    version: auditLog.length,
    items,
    subtotal: money(subtotal),
    discountTotal: money(listTotal - subtotal),
    taxTotal: money(taxTotal),
    freight,
    total: money(subtotal + taxTotal),
    currency: 'USD',
    fxRate: 1_385,
    paymentTerm: 'TRANSFER_7',
    deliveryMethod: 'DELIVERY',
    deliveryAddress: customer.address,
    customerPO: 'OC-2291',
    notes: 'Entregar por la mañana, el depósito cierra a las 13 h.',
    appliedConditions: [
      { conditionId: 'cond_volumen_general', code: 'VOL-GEN-26', name: 'Volumen general por unidad', effect: '-4% por 10+ u.' },
      { conditionId: 'cond_pronto_pago', code: 'PRONTO-PAGO', name: 'Pronto pago', effect: '-1.5%' },
      { conditionId: 'cond_envio_amba', code: 'FLETE-AMBA', name: 'Envío bonificado AMBA', effect: 'Envío bonificado' },
    ],
    requiredApprovals: [
      { type: 'SPECIAL_PRICE', label: 'Precio especial PE-1042', status: 'APPROVED', approver: 'Diego Sanabria' },
    ],
    salesRepId: 'usr_martin',
    origin: 'PORTAL',
    placedBy: null,
    createdAt,
    updatedAt: '2026-03-17T11:40:00-03:00',
    confirmedAt: '2026-03-14T11:37:00-03:00',
    shippedAt: '2026-03-16T14:20:00-03:00',
    deliveredAt: '2026-03-17T11:40:00-03:00',
    invoiceIds: ['inv_hero'],
    tracking: { carrier: 'Andreani', code: '772394118', url: null, status: 'Entregado' },
    auditLog,
    allowedModifications: [],
  };
}

export const HERO_ORDER = buildHeroOrder();
export const HERO_INVOICE_NUMBER = 'FA-0004-00012831';

/** Catalogo completo de pedidos, con el pedido protagonista incluido. */
export const ALL_ORDERS: Order[] = [HERO_ORDER, ...ORDERS];

export function orderById(id: string): Order | undefined {
  return ALL_ORDERS.find((o) => o.id === id);
}

export function ordersByCustomer(customerId: string): Order[] {
  return ALL_ORDERS.filter((o) => o.customerId === customerId);
}
