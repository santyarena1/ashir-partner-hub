/**
 * Numeros de serie, lotes de importacion y politicas de garantia.
 *
 * Cada serial esta atado a un pedido entregado y a un cliente concreto:
 * es lo que permite que el lookup por serial valide propiedad y calcule
 * garantia sin pedirle datos al reseller.
 */
import type { RmaLot, SerialRecord, WarrantyPolicy } from '@/types';
import { ALL_ORDERS, HERO_INVOICE_NUMBER, HERO_ORDER } from '@/mocks/fixtures/orders';
import { productBySku } from '@/mocks/fixtures/catalog';
import { CUSTOMERS } from '@/mocks/fixtures/customers';
import { addMonths, betweenSeeded, seeded } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/* politicas de garantia                                               */
/* ------------------------------------------------------------------ */

export const WARRANTY_POLICIES: WarrantyPolicy[] = [
  {
    id: 'wp_default',
    name: 'Política general Ashir',
    scope: 'CATEGORY',
    target: 'Todas',
    months: 12,
    exceptions: [],
    flagsRequireReview: ['PHYSICAL_DAMAGE', 'ILLEGIBLE_SERIAL', 'LABEL_REMOVED', 'ELECTRICAL_DAMAGE', 'CORROSION', 'TAMPERING'],
    slaValidationHours: 24,
    slaDiagnosisHours: 72,
    slaResolutionDays: 5,
    updatedAt: '2026-01-10T09:00:00-03:00',
  },
  {
    id: 'wp_msi_gpu',
    name: 'MSI · Placas de video',
    scope: 'BRAND',
    target: 'MSI',
    months: 36,
    exceptions: [
      { type: 'SKU', target: 'MSVG5070TV3O', months: 36, note: 'Garantía extendida de fábrica sobre serie Ventus' },
      { type: 'LOT', target: 'LOTE-MSI-260326-A', months: 24, note: 'Lote con cobertura reducida acordada con el fabricante' },
    ],
    flagsRequireReview: ['PHYSICAL_DAMAGE', 'LABEL_REMOVED', 'ELECTRICAL_DAMAGE', 'TAMPERING'],
    slaValidationHours: 24,
    slaDiagnosisHours: 72,
    slaResolutionDays: 5,
    updatedAt: '2026-04-02T11:30:00-03:00',
  },
  {
    id: 'wp_asus',
    name: 'ASUS · Componentes',
    scope: 'BRAND',
    target: 'ASUS',
    months: 36,
    exceptions: [{ type: 'DATE_RANGE', target: '2025-01-01 → 2025-06-30', months: 24, note: 'Política anterior del fabricante' }],
    flagsRequireReview: ['PHYSICAL_DAMAGE', 'ILLEGIBLE_SERIAL', 'CORROSION'],
    slaValidationHours: 24,
    slaDiagnosisHours: 96,
    slaResolutionDays: 7,
    updatedAt: '2026-02-18T10:15:00-03:00',
  },
  {
    id: 'wp_adata',
    name: 'ADATA · Memorias y SSD',
    scope: 'BRAND',
    target: 'ADATA',
    months: 60,
    exceptions: [],
    flagsRequireReview: ['PHYSICAL_DAMAGE', 'ILLEGIBLE_SERIAL', 'CORROSION'],
    slaValidationHours: 24,
    slaDiagnosisHours: 48,
    slaResolutionDays: 5,
    updatedAt: '2026-03-05T14:00:00-03:00',
  },
  {
    id: 'wp_thermaltake',
    name: 'Thermaltake · Gabinetes y refrigeración',
    scope: 'BRAND',
    target: 'THERMALTAKE',
    months: 24,
    exceptions: [{ type: 'SKU', target: 'TTGACE300TGB', months: 12, note: 'Gabinete sin componentes activos' }],
    flagsRequireReview: ['PHYSICAL_DAMAGE', 'TAMPERING'],
    slaValidationHours: 24,
    slaDiagnosisHours: 72,
    slaResolutionDays: 6,
    updatedAt: '2026-01-22T09:40:00-03:00',
  },
  {
    id: 'wp_evolabs',
    name: 'Evolabs · Línea propia',
    scope: 'BRAND',
    target: 'EVOLABS',
    months: 12,
    exceptions: [],
    flagsRequireReview: ['PHYSICAL_DAMAGE', 'LABEL_REMOVED', 'TAMPERING'],
    slaValidationHours: 48,
    slaDiagnosisHours: 96,
    slaResolutionDays: 10,
    updatedAt: '2026-05-14T12:00:00-03:00',
  },
];

export function policyFor(brand: string): WarrantyPolicy {
  return WARRANTY_POLICIES.find((p) => p.scope === 'BRAND' && p.target === brand) ?? WARRANTY_POLICIES[0]!;
}

/* ------------------------------------------------------------------ */
/* generacion de seriales                                              */
/* ------------------------------------------------------------------ */

/** Prefijo de serial por marca, al estilo de los fabricantes reales. */
const SERIAL_PREFIX: Record<string, string> = {
  MSI: '9MSI',
  ASUS: 'M4A',
  THERMALTAKE: 'TT',
  ADATA: 'AD',
  EVOLABS: 'EVO',
  AUREOX: 'AX',
  AMD: 'AMD',
  ACER: 'ACR',
  TTESPORTS: 'TTE',
  WICGTYP: 'WG',
};

function makeSerial(brand: string, sku: string, index: number): string {
  const prefix = SERIAL_PREFIX[brand] ?? 'ASH';
  const body = betweenSeeded(`${sku}${index}serial`, 1_000_000, 9_999_999);
  const suffix = betweenSeeded(`${sku}${index}sfx`, 10, 99);
  return `${prefix}${body}${suffix}`;
}

function lotCodeFor(brand: string, sku: string): string {
  const month = betweenSeeded(`${sku}lot`, 1, 9);
  const letter = ['A', 'B', 'C'][betweenSeeded(`${sku}lotl`, 0, 2)]!;
  return `LOTE-${brand}-2603${String(month).padStart(2, '0')}-${letter}`;
}

/** Serial protagonista del guion de demo (Escenario C). */
export const HERO_SERIAL = '9MSI5070X93821';

function buildSerials(): SerialRecord[] {
  const records: SerialRecord[] = [];

  /* --- 1. el serial del guion, sobre el pedido protagonista --- */
  const heroItem = HERO_ORDER.items.find((it) => it.brand === 'MSI' && it.sku.startsWith('MSVG'));
  const heroProduct = heroItem ? productBySku(heroItem.sku) : undefined;
  if (heroItem && heroProduct) {
    const policy = policyFor('MSI');
    records.push({
      serial: HERO_SERIAL,
      productId: heroProduct.id,
      sku: heroProduct.sku,
      productName: heroProduct.name,
      brand: heroProduct.brand,
      category: heroProduct.category,
      customerId: HERO_ORDER.customerId,
      customerName: HERO_ORDER.customerName,
      orderId: HERO_ORDER.id,
      orderNumber: HERO_ORDER.number,
      invoiceNumber: HERO_INVOICE_NUMBER,
      purchasedAt: HERO_ORDER.deliveredAt ?? HERO_ORDER.createdAt,
      warrantyMonths: policy.months,
      warrantyExpiresAt: addMonths(HERO_ORDER.deliveredAt ?? HERO_ORDER.createdAt, policy.months),
      lotId: 'LOTE-MSI-260326-A',
      openRmaId: null,
      replacedBySerial: null,
    });

    // Resto de unidades del mismo item, elegibles para RMA desde "mis compras".
    for (let i = 1; i < heroItem.quantity; i++) {
      records.push({
        ...records[0]!,
        serial: makeSerial('MSI', heroProduct.sku, i),
        openRmaId: null,
      });
    }
  }

  /* --- 2. resto de los items del pedido protagonista --- */
  for (const item of HERO_ORDER.items) {
    if (item === heroItem) continue;
    const product = productBySku(item.sku);
    if (!product) continue;
    const policy = policyFor(product.brand);
    const exception = policy.exceptions.find((e) => e.type === 'SKU' && e.target === product.sku);
    const months = exception?.months ?? policy.months;
    for (let i = 0; i < Math.min(item.quantity, 6); i++) {
      records.push({
        serial: makeSerial(product.brand, product.sku, i),
        productId: product.id,
        sku: product.sku,
        productName: product.name,
        brand: product.brand,
        category: product.category,
        customerId: HERO_ORDER.customerId,
        customerName: HERO_ORDER.customerName,
        orderId: HERO_ORDER.id,
        orderNumber: HERO_ORDER.number,
        invoiceNumber: HERO_INVOICE_NUMBER,
        purchasedAt: HERO_ORDER.deliveredAt!,
        warrantyMonths: months,
        warrantyExpiresAt: addMonths(HERO_ORDER.deliveredAt!, months),
        lotId: lotCodeFor(product.brand, product.sku),
        openRmaId: null,
        replacedBySerial: null,
      });
    }
  }

  /* --- 3. seriales del resto de los pedidos entregados --- */
  const delivered = ALL_ORDERS.filter((o) => o.status === 'DELIVERED' && o.id !== HERO_ORDER.id);
  for (const order of delivered) {
    for (const item of order.items) {
      const product = productBySku(item.sku);
      if (!product) continue;
      const policy = policyFor(product.brand);
      const months = policy.exceptions.find((e) => e.type === 'SKU' && e.target === product.sku)?.months ?? policy.months;
      const count = Math.min(item.quantity, 3);
      for (let i = 0; i < count; i++) {
        records.push({
          serial: makeSerial(product.brand, `${order.number}${product.sku}`, i),
          productId: product.id,
          sku: product.sku,
          productName: product.name,
          brand: product.brand,
          category: product.category,
          customerId: order.customerId,
          customerName: order.customerName,
          orderId: order.id,
          orderNumber: order.number,
          invoiceNumber: `FA-0004-${String(betweenSeeded(order.number + i, 10_000, 99_999)).padStart(8, '0')}`,
          purchasedAt: order.deliveredAt!,
          warrantyMonths: months,
          warrantyExpiresAt: addMonths(order.deliveredAt!, months),
          lotId: lotCodeFor(product.brand, product.sku),
          openRmaId: null,
          replacedBySerial: null,
        });
      }
    }
  }

  /* --- 4. un serial con garantia vencida, para el escenario de demo --- */
  const oldProduct = productBySku('TTGAVEH16ARB') ?? productBySku('ADRAD8GD4320');
  if (oldProduct) {
    const purchased = '2023-02-11T10:00:00-03:00';
    records.push({
      serial: 'TT2201884431',
      productId: oldProduct.id,
      sku: oldProduct.sku,
      productName: oldProduct.name,
      brand: oldProduct.brand,
      category: oldProduct.category,
      customerId: 'cus_gaming_store',
      customerName: 'Gaming Store',
      orderId: 'ord_legacy_21044',
      orderNumber: 'ASH-21044',
      invoiceNumber: 'FA-0004-00009120',
      purchasedAt: purchased,
      warrantyMonths: 24,
      warrantyExpiresAt: addMonths(purchased, 24),
      lotId: 'LOTE-THERMALTAKE-250118-B',
      openRmaId: null,
      replacedBySerial: null,
    });
  }

  /* --- 5. un serial de OTRO reseller, para probar la regla de privacidad --- */
  const otherProduct = productBySku('ASVG5060DO8E');
  const otherCustomer = CUSTOMERS.find((c) => c.id === 'cus_compumundo')!;
  if (otherProduct) {
    records.push({
      serial: 'M4A7761200341',
      productId: otherProduct.id,
      sku: otherProduct.sku,
      productName: otherProduct.name,
      brand: otherProduct.brand,
      category: otherProduct.category,
      customerId: otherCustomer.id,
      customerName: otherCustomer.tradeName,
      orderId: 'ord_other_24101',
      orderNumber: 'ASH-24101',
      invoiceNumber: 'FA-0004-00012044',
      purchasedAt: '2026-05-20T10:00:00-03:00',
      warrantyMonths: 36,
      warrantyExpiresAt: addMonths('2026-05-20T10:00:00-03:00', 36),
      lotId: 'LOTE-ASUS-260412-C',
      openRmaId: null,
      replacedBySerial: null,
    });
  }

  // Eliminar duplicados accidentales de serial.
  const seen = new Set<string>();
  return records.filter((r) => {
    if (seen.has(r.serial)) return false;
    seen.add(r.serial);
    return true;
  });
}

export const SERIALS: SerialRecord[] = buildSerials();

const SERIAL_INDEX = new Map(SERIALS.map((s) => [s.serial.toUpperCase(), s]));

export function serialByCode(code: string): SerialRecord | undefined {
  return SERIAL_INDEX.get(code.trim().toUpperCase());
}

export function serialsByCustomer(customerId: string): SerialRecord[] {
  return SERIALS.filter((s) => s.customerId === customerId);
}

export function serialsByOrder(orderId: string): SerialRecord[] {
  return SERIALS.filter((s) => s.orderId === orderId);
}

/** Serial de otro reseller, usado por el escenario de privacidad. */
export const OTHER_RESELLER_SERIAL = 'M4A7761200341';
export const EXPIRED_WARRANTY_SERIAL = 'TT2201884431';

/* ------------------------------------------------------------------ */
/* lotes de importacion                                                */
/* ------------------------------------------------------------------ */

function buildLots(): RmaLot[] {
  const byLot = new Map<string, SerialRecord[]>();
  for (const serial of SERIALS) {
    const list = byLot.get(serial.lotId) ?? [];
    list.push(serial);
    byLot.set(serial.lotId, list);
  }

  const lots: RmaLot[] = [];
  for (const [code, serials] of byLot) {
    const first = serials[0]!;
    const rnd = seeded(code);
    const imported = betweenSeeded(`${code}imp`, 180, 1_400);
    const sold = Math.floor(imported * (0.55 + rnd() * 0.4));
    // El lote protagonista tiene una tasa anormalmente alta, a proposito.
    const isIncident = code === 'LOTE-MSI-260326-A';
    const rmaCount = isIncident
      ? Math.max(18, Math.floor(sold * 0.061))
      : Math.floor(sold * (0.004 + rnd() * 0.018));
    const rate = sold > 0 ? (rmaCount / sold) * 100 : 0;

    lots.push({
      id: `lot_${code.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
      code,
      brand: first.brand,
      sku: first.sku,
      productName: first.productName,
      importedAt: `2026-0${betweenSeeded(`${code}m`, 1, 9)}-1${betweenSeeded(`${code}d`, 0, 9)}T09:00:00-03:00`,
      unitsImported: imported,
      unitsSold: sold,
      rmaCount,
      rmaRatePct: rate.toFixed(2),
      brandAverageRatePct: isIncident ? '1.24' : (0.9 + rnd()).toFixed(2),
      affectedSerials: serials.slice(0, Math.min(serials.length, rmaCount)).map((s) => s.serial),
      commonReasons: isIncident
        ? [
            { reason: 'Sin imagen / no da video', count: Math.floor(rmaCount * 0.52) },
            { reason: 'No enciende', count: Math.floor(rmaCount * 0.27) },
            { reason: 'Temperatura elevada', count: Math.floor(rmaCount * 0.14) },
          ]
        : [
            { reason: 'No enciende', count: Math.max(1, Math.floor(rmaCount * 0.4)) },
            { reason: 'Fallas intermitentes', count: Math.max(1, Math.floor(rmaCount * 0.3)) },
          ],
      incidentSuspected: isIncident,
      note: isIncident
        ? 'Tasa de RMA 4,9× superior al promedio de la marca. Se solicitó revisión al fabricante y se pausó la venta del remanente.'
        : 'Comportamiento dentro del rango esperado para la marca.',
    });
  }

  return lots.sort((a, b) => Number.parseFloat(b.rmaRatePct) - Number.parseFloat(a.rmaRatePct));
}

export const RMA_LOTS: RmaLot[] = buildLots();

export function lotByCode(code: string): RmaLot | undefined {
  return RMA_LOTS.find((l) => l.code === code || l.id === code);
}

export const HERO_LOT_CODE = 'LOTE-MSI-260326-A';
