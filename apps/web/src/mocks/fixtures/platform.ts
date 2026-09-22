/**
 * Integraciones, webhooks, notificaciones, importaciones y escenarios de demo.
 *
 * Nota importante: ninguna de estas integraciones esta conectada a un sistema
 * real. El ERP de Ashir todavia no esta definido, por lo que su adaptador
 * figura explicitamente como "Pendiente de definición".
 */
import type {
  DemoScenarioDefinition,
  ImportRun,
  Integration,
  IntegrationRun,
  Notification,
  WebhookDelivery,
} from '@/types';
import { addDays, betweenSeeded, requestId } from '@/lib/utils';
import { CATALOG_META } from '@/mocks/fixtures/catalog';

const NOW = new Date('2026-09-22T11:00:00-03:00').toISOString();
const mins = (n: number) => addDays(NOW, -n / 1440);

/* ------------------------------------------------------------------ */
/* integraciones                                                       */
/* ------------------------------------------------------------------ */

export const INTEGRATIONS: Integration[] = [
  {
    id: 'int_erp',
    name: 'ERP Ashir',
    kind: 'ERP',
    description:
      'Sistema de gestión interno de Ashir. Sería la fuente de verdad de clientes, stock, costos, facturación y cuenta corriente.',
    status: 'NOT_CONFIGURED',
    adapter: 'Pendiente de definición',
    mode: 'MOCK',
    environment: 'DEMO',
    lastSyncAt: mins(4),
    nextSyncAt: addDays(NOW, 11 / 1440),
    frequency: 'EVERY_15M',
    recordsProcessed: 1_284,
    errorCount: 0,
    retryCount: 0,
    entities: [
      { key: 'customers', label: 'Clientes', direction: 'INBOUND', enabled: true, lastUpdatedAt: mins(4), records: 16, status: 'NOT_CONFIGURED' },
      { key: 'products', label: 'Productos', direction: 'INBOUND', enabled: true, lastUpdatedAt: mins(4), records: 245, status: 'NOT_CONFIGURED' },
      { key: 'stock', label: 'Stock', direction: 'INBOUND', enabled: true, lastUpdatedAt: mins(4), records: 245, status: 'NOT_CONFIGURED' },
      { key: 'costs', label: 'Costos', direction: 'INBOUND', enabled: true, lastUpdatedAt: mins(18), records: 245, status: 'NOT_CONFIGURED' },
      { key: 'prices', label: 'Precios', direction: 'BIDIRECTIONAL', enabled: true, lastUpdatedAt: mins(18), records: 245, status: 'NOT_CONFIGURED' },
      { key: 'price_lists', label: 'Listas', direction: 'OUTBOUND', enabled: true, lastUpdatedAt: mins(62), records: 6, status: 'NOT_CONFIGURED' },
      { key: 'account', label: 'Cuenta corriente', direction: 'INBOUND', enabled: true, lastUpdatedAt: mins(4), records: 16, status: 'NOT_CONFIGURED' },
      { key: 'invoices', label: 'Facturas', direction: 'INBOUND', enabled: true, lastUpdatedAt: mins(4), records: 84, status: 'NOT_CONFIGURED' },
      { key: 'orders', label: 'Pedidos', direction: 'OUTBOUND', enabled: true, lastUpdatedAt: mins(6), records: 35, status: 'NOT_CONFIGURED' },
      { key: 'serials', label: 'Números de serie', direction: 'INBOUND', enabled: false, lastUpdatedAt: null, records: 0, status: 'NOT_CONFIGURED' },
      { key: 'warranties', label: 'Garantías', direction: 'BIDIRECTIONAL', enabled: false, lastUpdatedAt: null, records: 0, status: 'NOT_CONFIGURED' },
      { key: 'credit_notes', label: 'Notas de crédito', direction: 'INBOUND', enabled: false, lastUpdatedAt: null, records: 0, status: 'NOT_CONFIGURED' },
    ],
    maskedConfig: [
      { key: 'Endpoint', value: 'pendiente de definición', secret: false },
      { key: 'Protocolo', value: 'a definir (REST · archivos · batch)', secret: false },
      { key: 'Credencial', value: '••••••••••••', secret: true },
      { key: 'Ambiente', value: 'Demo', secret: false },
    ],
    architecture: ['Ashir Partner Hub', 'Integration API', 'ERP Ashir'],
    featured: false,
  },
  {
    id: 'int_nodo',
    name: 'NODO',
    kind: 'CONNECTOR',
    description:
      'Conector comercial y de sincronización. Puede funcionar como puente operativo para centralizar e intercambiar información comercial entre el Partner Hub y otros procesos o canales.',
    status: 'OPERATIONAL',
    adapter: 'nodo-connector v1 (demo)',
    mode: 'DEMO',
    environment: 'DEMO',
    lastSyncAt: mins(6),
    nextSyncAt: addDays(NOW, 9 / 1440),
    frequency: 'EVERY_15M',
    recordsProcessed: 247,
    errorCount: 0,
    retryCount: 1,
    entities: [
      { key: 'products', label: 'Productos y SKUs', direction: 'OUTBOUND', enabled: true, lastUpdatedAt: mins(6), records: 245, status: 'OPERATIONAL' },
      { key: 'stock', label: 'Stock y disponibilidad', direction: 'OUTBOUND', enabled: true, lastUpdatedAt: mins(18), records: 214, status: 'OPERATIONAL' },
      { key: 'prices', label: 'Precios y listas', direction: 'OUTBOUND', enabled: true, lastUpdatedAt: mins(27), records: 25, status: 'DEGRADED' },
      { key: 'orders', label: 'Pedidos y estados', direction: 'INBOUND', enabled: true, lastUpdatedAt: mins(12), records: 8, status: 'OPERATIONAL' },
      { key: 'customers', label: 'Clientes / cuentas comerciales', direction: 'BIDIRECTIONAL', enabled: false, lastUpdatedAt: null, records: 0, status: 'NOT_CONFIGURED' },
    ],
    maskedConfig: [
      { key: 'URL del servicio', value: 'https://api.nodo.example/v1', secret: false },
      { key: 'Identificador de cuenta', value: 'ashir-demo-001', secret: false },
      { key: 'API key', value: 'nod_live_••••••••••••3f2a', secret: true },
      { key: 'Ambiente', value: 'Demo', secret: false },
      { key: 'Frecuencia', value: 'Cada 15 minutos', secret: false },
    ],
    architecture: ['Ashir Partner Hub', 'Integration API', 'NODO', 'Canales y procesos externos'],
    benefits: [
      'Centraliza la información comercial en un único flujo.',
      'Reduce carga manual, planillas y duplicación de tareas.',
      'Mantiene catálogo, stock y precios más consistentes entre sistemas.',
      'Permite seguir pedidos y detectar errores de sincronización.',
      'Deja una base preparada para sumar nuevos canales o automatizaciones.',
    ],
    featured: true,
  },
  {
    id: 'int_stock',
    name: 'Servicio de stock',
    kind: 'STOCK',
    description: 'Disponibilidad en tiempo real por depósito y reserva de mercadería para pedidos confirmados.',
    status: 'DEGRADED',
    adapter: 'stock-service (mock)',
    mode: 'MOCK',
    environment: 'DEMO',
    lastSyncAt: mins(22),
    nextSyncAt: addDays(NOW, 38 / 1440),
    frequency: 'EVERY_15M',
    recordsProcessed: 214,
    errorCount: 3,
    retryCount: 2,
    entities: [
      { key: 'availability', label: 'Disponibilidad', direction: 'INBOUND', enabled: true, lastUpdatedAt: mins(22), records: 214, status: 'DEGRADED' },
      { key: 'reservations', label: 'Reservas', direction: 'OUTBOUND', enabled: true, lastUpdatedAt: mins(22), records: 12, status: 'OPERATIONAL' },
    ],
    maskedConfig: [{ key: 'Endpoint', value: 'https://stock.internal.example/v1', secret: false }],
    architecture: ['Ashir Partner Hub', 'Integration API', 'Servicio de stock'],
    featured: false,
  },
  {
    id: 'int_pricing',
    name: 'Pricing',
    kind: 'PRICING',
    description: 'Publicación de listas y condiciones comerciales hacia los canales de venta.',
    status: 'OPERATIONAL',
    adapter: 'pricing-service (mock)',
    mode: 'MOCK',
    environment: 'DEMO',
    lastSyncAt: mins(41),
    nextSyncAt: addDays(NOW, 19 / 1440),
    frequency: 'HOURLY',
    recordsProcessed: 31,
    errorCount: 0,
    retryCount: 0,
    entities: [
      { key: 'price_lists', label: 'Listas de precios', direction: 'OUTBOUND', enabled: true, lastUpdatedAt: mins(41), records: 6, status: 'OPERATIONAL' },
      { key: 'conditions', label: 'Condiciones comerciales', direction: 'OUTBOUND', enabled: true, lastUpdatedAt: mins(41), records: 12, status: 'OPERATIONAL' },
    ],
    maskedConfig: [{ key: 'Endpoint', value: 'https://pricing.internal.example/v1', secret: false }],
    architecture: ['Ashir Partner Hub', 'Integration API', 'Pricing service'],
    featured: false,
  },
  {
    id: 'int_billing',
    name: 'Facturación',
    kind: 'BILLING',
    description: 'Emisión de comprobantes y notas de crédito. Dependería del ERP una vez definido.',
    status: 'NOT_CONFIGURED',
    adapter: 'Pendiente de definición',
    mode: 'MOCK',
    environment: 'DEMO',
    lastSyncAt: null,
    nextSyncAt: null,
    frequency: 'MANUAL',
    recordsProcessed: 0,
    errorCount: 0,
    retryCount: 0,
    entities: [
      { key: 'invoices', label: 'Facturas', direction: 'INBOUND', enabled: false, lastUpdatedAt: null, records: 0, status: 'NOT_CONFIGURED' },
      { key: 'credit_notes', label: 'Notas de crédito', direction: 'INBOUND', enabled: false, lastUpdatedAt: null, records: 0, status: 'NOT_CONFIGURED' },
    ],
    maskedConfig: [{ key: 'Endpoint', value: 'pendiente de definición', secret: false }],
    architecture: ['Ashir Partner Hub', 'Integration API', 'ERP Ashir', 'AFIP'],
    featured: false,
  },
  {
    id: 'int_logistics',
    name: 'Logística',
    kind: 'LOGISTICS',
    description: 'Etiquetas de envío, remitos y seguimiento de despachos con los transportes habituales.',
    status: 'OPERATIONAL',
    adapter: 'carrier-gateway (mock)',
    mode: 'MOCK',
    environment: 'DEMO',
    lastSyncAt: mins(9),
    nextSyncAt: addDays(NOW, 51 / 1440),
    frequency: 'HOURLY',
    recordsProcessed: 47,
    errorCount: 0,
    retryCount: 0,
    entities: [
      { key: 'shipments', label: 'Despachos', direction: 'OUTBOUND', enabled: true, lastUpdatedAt: mins(9), records: 31, status: 'OPERATIONAL' },
      { key: 'tracking', label: 'Seguimiento', direction: 'INBOUND', enabled: true, lastUpdatedAt: mins(9), records: 16, status: 'OPERATIONAL' },
    ],
    maskedConfig: [{ key: 'Transportes', value: 'Andreani · OCA · Cruz del Sur', secret: false }],
    architecture: ['Ashir Partner Hub', 'Integration API', 'Carrier gateway'],
    featured: false,
  },
  {
    id: 'int_rma',
    name: 'RMA / fabricantes',
    kind: 'RMA',
    description: 'Escalamiento de casos a los portales de garantía de cada fabricante.',
    status: 'OFFLINE',
    adapter: 'manufacturer-bridge (mock)',
    mode: 'MOCK',
    environment: 'DEMO',
    lastSyncAt: addDays(NOW, -2),
    nextSyncAt: null,
    frequency: 'DAILY',
    recordsProcessed: 0,
    errorCount: 7,
    retryCount: 3,
    entities: [
      { key: 'cases', label: 'Casos escalados', direction: 'OUTBOUND', enabled: true, lastUpdatedAt: addDays(NOW, -2), records: 3, status: 'OFFLINE' },
    ],
    maskedConfig: [{ key: 'Fabricantes', value: 'MSI · ASUS · Thermaltake', secret: false }],
    architecture: ['Ashir Partner Hub', 'Integration API', 'Portales de fabricantes'],
    featured: false,
  },
  {
    id: 'int_notifications',
    name: 'Notificaciones',
    kind: 'NOTIFICATIONS',
    description: 'Envío de avisos por correo y mensajería a resellers y equipos internos.',
    status: 'OPERATIONAL',
    adapter: 'notifications (mock)',
    mode: 'MOCK',
    environment: 'DEMO',
    lastSyncAt: mins(2),
    nextSyncAt: null,
    frequency: 'MANUAL',
    recordsProcessed: 312,
    errorCount: 0,
    retryCount: 0,
    entities: [
      { key: 'email', label: 'Correo', direction: 'OUTBOUND', enabled: true, lastUpdatedAt: mins(2), records: 284, status: 'OPERATIONAL' },
      { key: 'push', label: 'Notificaciones del portal', direction: 'OUTBOUND', enabled: true, lastUpdatedAt: mins(2), records: 28, status: 'OPERATIONAL' },
    ],
    maskedConfig: [{ key: 'Remitente', value: 'no-reply@ashir.example', secret: false }],
    architecture: ['Ashir Partner Hub', 'Notifications service'],
    featured: false,
  },
];

export function integrationById(id: string): Integration | undefined {
  return INTEGRATIONS.find((i) => i.id === id);
}

/* ------------------------------------------------------------------ */
/* ejecuciones de sincronizacion                                       */
/* ------------------------------------------------------------------ */

const RUN_SEEDS: { integrationId: string; process: string; direction: IntegrationRun['direction']; records: number; result: IntegrationRun['result']; minutesAgo: number; warnings?: string[]; errors?: string[] }[] = [
  { integrationId: 'int_nodo', process: 'Stock', direction: 'OUTBOUND', records: 214, result: 'SUCCESS', minutesAgo: 18 },
  { integrationId: 'int_nodo', process: 'Pedidos', direction: 'INBOUND', records: 8, result: 'SUCCESS', minutesAgo: 30 },
  {
    integrationId: 'int_nodo', process: 'Precios', direction: 'OUTBOUND', records: 25, result: 'WARNING', minutesAgo: 45,
    warnings: [
      'El SKU MSVG5060S2O8 no tiene precio publicado: se omitió del envío.',
      'El SKU ASLMVG249QL3 no tiene precio publicado: se omitió del envío.',
    ],
  },
  { integrationId: 'int_nodo', process: 'Productos', direction: 'OUTBOUND', records: 245, result: 'SUCCESS', minutesAgo: 75 },
  { integrationId: 'int_erp', process: 'Clientes', direction: 'INBOUND', records: 16, result: 'SUCCESS', minutesAgo: 4 },
  { integrationId: 'int_erp', process: 'Stock', direction: 'INBOUND', records: 245, result: 'SUCCESS', minutesAgo: 4 },
  { integrationId: 'int_erp', process: 'Costos', direction: 'INBOUND', records: 245, result: 'SUCCESS', minutesAgo: 18 },
  { integrationId: 'int_erp', process: 'Pedidos', direction: 'OUTBOUND', records: 35, result: 'SUCCESS', minutesAgo: 6 },
  {
    integrationId: 'int_stock', process: 'Disponibilidad', direction: 'INBOUND', records: 214, result: 'WARNING', minutesAgo: 22,
    warnings: ['3 SKUs devolvieron disponibilidad negativa y se normalizaron a 0.'],
  },
  {
    integrationId: 'int_rma', process: 'Casos escalados', direction: 'OUTBOUND', records: 0, result: 'FAILED', minutesAgo: 2_880,
    errors: ['El portal del fabricante devolvió 503 Service Unavailable tras 3 reintentos.'],
  },
  { integrationId: 'int_pricing', process: 'Listas de precios', direction: 'OUTBOUND', records: 6, result: 'SUCCESS', minutesAgo: 41 },
  { integrationId: 'int_logistics', process: 'Despachos', direction: 'OUTBOUND', records: 31, result: 'SUCCESS', minutesAgo: 9 },
];

export const INTEGRATION_RUNS: IntegrationRun[] = RUN_SEEDS.map((seed, i) => ({
  id: `run_${i}`,
  integrationId: seed.integrationId,
  at: mins(seed.minutesAgo),
  process: seed.process,
  direction: seed.direction,
  records: seed.records,
  durationMs: betweenSeeded(`run${i}`, 320, 8_400),
  result: seed.result,
  warnings: seed.warnings ?? [],
  errors: seed.errors ?? [],
  requestId: requestId(),
  summary:
    seed.result === 'SUCCESS'
      ? `${seed.records} registros procesados sin errores.`
      : seed.result === 'WARNING'
        ? `${seed.records} registros procesados con ${seed.warnings?.length ?? 0} advertencia(s).`
        : 'La ejecución falló y se reintentará según la política del conector.',
})).sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

export function runsForIntegration(integrationId: string): IntegrationRun[] {
  return INTEGRATION_RUNS.filter((r) => r.integrationId === integrationId);
}

/* ------------------------------------------------------------------ */
/* webhooks                                                            */
/* ------------------------------------------------------------------ */

export const WEBHOOK_EVENT_CATALOG: { type: WebhookDelivery['type']; description: string }[] = [
  { type: 'order.created', description: 'Se creó un pedido, en estado borrador o confirmado.' },
  { type: 'order.updated', description: 'Cambiaron los ítems, cantidades o condiciones de un pedido.' },
  { type: 'order.status_changed', description: 'El pedido cambió de estado dentro del flujo comercial o logístico.' },
  { type: 'order.cancelled', description: 'El pedido fue cancelado por el cliente o por Ashir.' },
  { type: 'special_price.approved', description: 'Una solicitud de precio especial fue aprobada con vigencia y cantidad máxima.' },
  { type: 'rma.created', description: 'Un reseller inició un caso de garantía.' },
  { type: 'rma.status_changed', description: 'El caso de RMA avanzó de etapa.' },
  { type: 'rma.resolved', description: 'El caso de RMA llegó a una resolución final.' },
  { type: 'customer.updated', description: 'Cambiaron datos comerciales, lista asignada o condición de pago del cliente.' },
  { type: 'product.stock_changed', description: 'Cambió la disponibilidad de un SKU.' },
  { type: 'price_list.updated', description: 'Se publicó una nueva versión de una lista de precios.' },
  { type: 'integration.sync_failed', description: 'Una ejecución de sincronización falló tras agotar los reintentos.' },
];

function payloadFor(type: WebhookDelivery['type'], i: number): Record<string, unknown> {
  const base = {
    eventId: `evt_${String(1_000 + i)}`,
    type,
    occurredAt: mins(i * 27 + 3),
    apiVersion: '2026-09-01',
  };
  switch (type) {
    case 'order.status_changed':
      return { ...base, data: { orderId: 'ord_ash_24853', number: 'ASH-24853', previousStatus: 'PICKING', status: 'SHIPPED', customerId: 'cus_gaming_store' } };
    case 'rma.created':
      return { ...base, data: { rmaId: 'rma_rma_260194', code: 'RMA-260194', customerId: 'cus_compumundo', units: 4, serials: ['9MSI5070X93821'] } };
    case 'rma.resolved':
      return { ...base, data: { rmaId: 'rma_rma_260155', code: 'RMA-260155', resolution: 'REPLACED_NEW', replacementSerial: '9MSI4410233' } };
    case 'special_price.approved':
      return { ...base, data: { requestId: 'spr_pe_1042', code: 'PE-1042', approvedPrice: { amount: '148.50', currency: 'USD' }, maxQuantity: 80, validUntil: '2026-10-22T23:59:59-03:00' } };
    case 'product.stock_changed':
      return { ...base, data: { productId: 'prod_msvg5070tv3o', sku: 'MSVG5070TV3O', previousStock: 12, stock: 4, availability: 'IN_STOCK' } };
    case 'integration.sync_failed':
      return { ...base, data: { integrationId: 'int_rma', process: 'Casos escalados', attempts: 3, lastError: '503 Service Unavailable' } };
    case 'price_list.updated':
      return { ...base, data: { priceListId: 'pl_platinum_02', code: 'LP-PLATINUM-02', version: 7, effectiveFrom: '2026-10-01T00:00:00-03:00' } };
    default:
      return { ...base, data: { id: 'demo_entity_id' } };
  }
}

export const WEBHOOK_DELIVERIES: WebhookDelivery[] = [
  'order.status_changed',
  'rma.created',
  'product.stock_changed',
  'order.created',
  'special_price.approved',
  'rma.status_changed',
  'integration.sync_failed',
  'price_list.updated',
  'order.updated',
  'rma.resolved',
  'customer.updated',
  'order.cancelled',
].map((type, i) => {
  const failed = type === 'integration.sync_failed' || i === 6;
  const dead = i === 11;
  return {
    id: `whd_${i}`,
    eventId: `evt_${String(1_000 + i)}`,
    type: type as WebhookDelivery['type'],
    occurredAt: mins(i * 27 + 3),
    apiVersion: '2026-09-01',
    endpoint: 'https://hooks.partner.example/ashir',
    status: dead ? 'DEAD_LETTER' : failed ? 'FAILED' : i === 3 ? 'PENDING' : 'DELIVERED',
    attempts: dead ? 6 : failed ? 3 : 1,
    responseCode: dead ? 500 : failed ? 502 : i === 3 ? null : 200,
    durationMs: betweenSeeded(`wh${i}`, 80, 1_900),
    payload: payloadFor(type as WebhookDelivery['type'], i),
  };
});

/* ------------------------------------------------------------------ */
/* notificaciones                                                      */
/* ------------------------------------------------------------------ */

export const NOTIFICATIONS: Notification[] = [
  {
    id: 'ntf_1', roles: ['CLIENT'], customerId: 'cus_gaming_store', kind: 'ORDER',
    title: 'Tu pedido ASH-24853 fue entregado',
    body: 'La entrega se confirmó el 17/03. Ya podés iniciar una garantía desde cualquier unidad del pedido.',
    at: mins(35), read: false, href: '/pedidos/ord_ash_24853', severity: 'SUCCESS',
  },
  {
    id: 'ntf_2', roles: ['CLIENT'], customerId: 'cus_gaming_store', kind: 'POINTS',
    title: '4.188 puntos por vencer',
    body: 'Tenés puntos Ashir que vencen el 31/10. Podés canjearlos por beneficios activos.',
    at: mins(180), read: false, href: '/beneficios', severity: 'WARNING',
  },
  {
    id: 'ntf_3', roles: ['CLIENT'], customerId: 'cus_gaming_store', kind: 'STOCK',
    title: 'Ingresó stock de una marca que seguís',
    body: 'Nuevo ingreso de motherboards MSI socket AM5. 34 SKUs disponibles.',
    at: mins(320), read: true, href: '/catalogo?brandId=brand_msi', severity: 'INFO',
  },
  {
    id: 'ntf_4', roles: ['CLIENT'], customerId: 'cus_compumundo', kind: 'SPECIAL_PRICE',
    title: 'Tu solicitud PE-1042 está en revisión del PM',
    body: 'El Product Manager de MSI está evaluando el precio para 80 unidades.',
    at: mins(60), read: false, href: '/precio-especial/spr_pe_1042', severity: 'INFO',
  },
  {
    id: 'ntf_5', roles: ['CLIENT'], customerId: 'cus_gaming_store', kind: 'RMA',
    title: 'Tu caso RMA-260194 avanzó a diagnóstico',
    body: 'Se recibieron 3 de 4 unidades. La unidad faltante está en revisión con el transporte.',
    at: mins(95), read: false, href: '/rma/rma_rma_260194', severity: 'WARNING',
  },
  {
    id: 'ntf_6', roles: ['SALES', 'ADMIN'], customerId: null, kind: 'APPROVAL',
    title: '2 pedidos pendientes de aprobación',
    body: 'Superan el crédito disponible del cliente y requieren tu revisión.',
    at: mins(25), read: false, href: '/bo/pedidos?status=PENDING_APPROVAL', severity: 'WARNING',
  },
  {
    id: 'ntf_7', roles: ['PM', 'ADMIN'], customerId: null, kind: 'SPECIAL_PRICE',
    title: 'Solicitud PE-1042 esperando tu decisión',
    body: 'Compumundo X pide USD 142 por 80 unidades. Margen resultante estimado: 8,3%.',
    at: mins(58), read: false, href: '/bo/solicitudes/spr_pe_1042', severity: 'WARNING',
  },
  {
    id: 'ntf_8', roles: ['RMA', 'ADMIN'], customerId: null, kind: 'RMA',
    title: 'RMA-260181 fuera de SLA',
    body: 'Lleva 6 días esperando diagnóstico. El objetivo de la etapa es de 72 horas.',
    at: mins(15), read: false, href: '/bo/rma/rma_rma_260181', severity: 'CRITICAL',
  },
  {
    id: 'ntf_9', roles: ['PM', 'ADMIN'], customerId: null, kind: 'STOCK',
    title: 'Stock crítico en 6 SKUs de tus marcas',
    body: 'Quedan menos de 5 unidades y hay pedidos abiertos que los incluyen.',
    at: mins(140), read: true, href: '/bo/pm', severity: 'WARNING',
  },
  {
    id: 'ntf_10', roles: ['ADMIN'], customerId: null, kind: 'IMPORT',
    title: 'Importación de productos con observaciones',
    body: `${CATALOG_META.problemCount} filas del último archivo quedaron marcadas para revisión.`,
    at: mins(410), read: true, href: '/bo/importaciones', severity: 'WARNING',
  },
  {
    id: 'ntf_11', roles: ['ADMIN'], customerId: null, kind: 'INTEGRATION',
    title: 'La integración con fabricantes está sin conexión',
    body: 'El portal de garantías devolvió 503 tras 3 reintentos. Hay 3 casos esperando escalamiento.',
    at: mins(2_880), read: false, href: '/bo/integraciones/int_rma', severity: 'CRITICAL',
  },
  {
    id: 'ntf_12', roles: ['PM', 'ADMIN'], customerId: null, kind: 'RMA',
    title: 'Posible incidencia de lote detectada',
    body: 'LOTE-MSI-260326-A presenta una tasa de RMA muy por encima del promedio de la marca.',
    at: mins(220), read: false, href: '/bo/rma/lotes/LOTE-MSI-260326-A', severity: 'CRITICAL',
  },
];

/* ------------------------------------------------------------------ */
/* historial de importaciones                                          */
/* ------------------------------------------------------------------ */

const DEFAULT_MAPPING: ImportRun['mapping'] = [
  { source: 'COD. INTERNO', target: 'sku', required: true },
  { source: 'PART NUMBER', target: 'partNumber', required: false },
  { source: 'DESCRIPCIÓN', target: 'name', required: true },
  { source: 'DISTRI S/IVA', target: 'listPrice', required: true },
  { source: 'FINAL', target: 'suggestedRetail', required: false },
  { source: 'IVA', target: 'vatRate', required: false },
  { source: 'ESTADO', target: 'availability', required: true },
  { source: 'DETALLES', target: 'description', required: false },
];

export const IMPORT_RUNS: ImportRun[] = [
  {
    id: 'imp_0091',
    fileName: CATALOG_META.source,
    sheet: CATALOG_META.sheet,
    startedAt: CATALOG_META.importedAt,
    finishedAt: addDays(CATALOG_META.importedAt, 0.0004),
    actor: 'Valeria Quiroga',
    status: 'COMMITTED',
    rowsTotal: CATALOG_META.productCount + CATALOG_META.skippedRows,
    rowsValid: CATALOG_META.productCount,
    rowsWithErrors: CATALOG_META.problemCount,
    creates: CATALOG_META.productCount,
    updates: 0,
    unchanged: 0,
    mapping: DEFAULT_MAPPING,
    errors: [
      { row: 20, column: 'DISTRI S/IVA', value: '-', code: 'PRICE_NOT_PUBLISHED', message: 'Sin precio publicado: el producto se importa como "consultar".', severity: 'WARNING' },
      { row: 23, column: 'DISTRI S/IVA', value: '-', code: 'PRICE_NOT_PUBLISHED', message: 'Sin precio publicado: el producto se importa como "consultar".', severity: 'WARNING' },
      { row: 76, column: 'DISTRI S/IVA', value: '-', code: 'PRICE_NOT_PUBLISHED', message: 'Sin precio publicado: el producto se importa como "consultar".', severity: 'WARNING' },
    ],
    mode: 'COMMIT',
  },
  {
    id: 'imp_0090',
    fileName: 'Ashir Lista Distribuidor 11-09-26.xlsx',
    sheet: 'Lista Ashir',
    startedAt: addDays(NOW, -11),
    finishedAt: addDays(NOW, -11),
    actor: 'Valeria Quiroga',
    status: 'COMMITTED',
    rowsTotal: 251,
    rowsValid: 238,
    rowsWithErrors: 13,
    creates: 6,
    updates: 232,
    unchanged: 0,
    mapping: DEFAULT_MAPPING,
    errors: [
      { row: 112, column: 'COD. INTERNO', value: 'TTCCA600ARGB', code: 'DUPLICATE_SKU', message: 'SKU repetido en la misma hoja.', severity: 'ERROR' },
      { row: 188, column: 'ESTADO', value: 'RESERVADO', code: 'UNKNOWN_STATE', message: 'Estado no reconocido: se importó como "En stock".', severity: 'WARNING' },
    ],
    mode: 'COMMIT',
  },
  {
    id: 'imp_0089',
    fileName: 'Ashir Lista Distribuidor 02-09-26.xlsx',
    sheet: 'Lista Ashir',
    startedAt: addDays(NOW, -20),
    finishedAt: addDays(NOW, -20),
    actor: 'Florencia Bravo',
    status: 'FAILED',
    rowsTotal: 249,
    rowsValid: 0,
    rowsWithErrors: 249,
    creates: 0,
    updates: 0,
    unchanged: 0,
    mapping: DEFAULT_MAPPING,
    errors: [
      { row: 0, column: '—', value: '—', code: 'HEADER_NOT_FOUND', message: 'No se encontró la fila de encabezados en la hoja seleccionada.', severity: 'ERROR' },
    ],
    mode: 'COMMIT',
  },
  {
    id: 'imp_0088',
    fileName: 'listado_productos_agosto.csv',
    sheet: '—',
    startedAt: addDays(NOW, -34),
    finishedAt: addDays(NOW, -34),
    actor: 'Valeria Quiroga',
    status: 'COMMITTED',
    rowsTotal: 186,
    rowsValid: 186,
    rowsWithErrors: 0,
    creates: 12,
    updates: 174,
    unchanged: 0,
    mapping: DEFAULT_MAPPING,
    errors: [],
    mode: 'COMMIT',
  },
];

/* ------------------------------------------------------------------ */
/* escenarios de demo                                                  */
/* ------------------------------------------------------------------ */

export const DEMO_SCENARIOS: DemoScenarioDefinition[] = [
  { code: 'SLOW_API', label: 'API lenta', description: 'Agrega 2,5 s de latencia a todas las respuestas del mock.', affects: 'Todas las pantallas' },
  { code: 'SERVER_ERROR', label: 'Error 500', description: 'El siguiente listado de catálogo devuelve un error recuperable.', affects: 'Catálogo y dashboards' },
  { code: 'OUT_OF_STOCK', label: 'Sin stock', description: 'Fuerza stock 0 en el catálogo para mostrar estados vacíos y reemplazos.', affects: 'Catálogo, carrito, Quick Order' },
  { code: 'ORDER_VERSION_CONFLICT', label: 'Conflicto de versión de pedido', description: 'La próxima edición de pedido responde 409 ORDER_VERSION_CONFLICT.', affects: 'Modificación de pedidos' },
  { code: 'SERIAL_OTHER_RESELLER', label: 'Serial de otro reseller', description: 'Cualquier serial consultado responde como perteneciente a otra cuenta.', affects: 'Lookup de serial · RMA' },
  { code: 'WARRANTY_EXPIRED', label: 'Garantía vencida', description: 'El lookup devuelve la garantía vencida aunque esté vigente.', affects: 'Lookup de serial · RMA' },
  { code: 'RMA_SLA_BREACH', label: 'RMA fuera de SLA', description: 'Marca todos los casos abiertos como fuera de SLA.', affects: 'Centro de RMA' },
  { code: 'ERP_DOWN', label: 'Integración ERP caída', description: 'El ERP y el conector NODO pasan a estado Sin conexión.', affects: 'Integraciones y widgets de sincronización' },
];
