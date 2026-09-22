/**
 * Etiquetas en castellano y colores semanticos para los enums de dominio.
 * Centralizado para que ningun estado dependa unicamente del color.
 */
import type {
  Availability,
  ConditionActionType,
  ConditionScope,
  CustomerSegment,
  IntegrationStatusCode,
  OrderStatus,
  PaymentTerm,
  RmaProblemType,
  RmaResolutionType,
  RmaStatus,
  Role,
  SpecialPriceStatus,
  WarrantyFlagCode,
} from '@/types';

export type Tone = 'neutral' | 'ok' | 'warn' | 'bad' | 'tech' | 'brand' | 'plat';

export interface LabelSpec {
  label: string;
  tone: Tone;
  /** Descripcion corta para tooltips. */
  hint?: string;
}

/* ------------------------------------------------------------------ */

export const ROLE_LABEL: Record<Role, string> = {
  CLIENT: 'Cliente / Reseller',
  SALES: 'Comercial',
  PM: 'Product Manager',
  RMA: 'RMA / Técnico',
  ADMIN: 'Administrador',
};

export const ROLE_SHORT: Record<Role, string> = {
  CLIENT: 'Cliente',
  SALES: 'Comercial',
  PM: 'PM',
  RMA: 'RMA',
  ADMIN: 'Admin',
};

/* ------------------------------------------------------------------ */

export const AVAILABILITY: Record<Availability, LabelSpec> = {
  IN_STOCK: { label: 'En stock', tone: 'ok' },
  NEW_ARRIVAL: { label: 'Nuevo ingreso', tone: 'tech', hint: 'Mercadería recién ingresada' },
  INCOMING: { label: 'Próximamente', tone: 'warn', hint: 'Sin stock actual, con ingreso previsto' },
  OUT_OF_STOCK: { label: 'Sin stock', tone: 'bad' },
};

export const ORDER_STATUS: Record<OrderStatus, LabelSpec> = {
  DRAFT: { label: 'Borrador', tone: 'neutral', hint: 'Editable por el cliente' },
  CONFIRMED: { label: 'Confirmado', tone: 'tech', hint: 'Recibido por Ashir' },
  SALES_REVIEW: { label: 'Validación comercial', tone: 'warn', hint: 'En revisión del ejecutivo' },
  PENDING_APPROVAL: { label: 'Pendiente de aprobación', tone: 'warn' },
  PENDING_PAYMENT: { label: 'Pendiente de pago', tone: 'warn' },
  OBSERVED: { label: 'Observado', tone: 'bad', hint: 'Requiere acción del cliente' },
  PICKING: { label: 'Preparación', tone: 'tech' },
  PARTIALLY_SHIPPED: { label: 'Parcialmente despachado', tone: 'warn' },
  SHIPPED: { label: 'Despachado', tone: 'tech' },
  DELIVERED: { label: 'Entregado', tone: 'ok' },
  CANCELLED: { label: 'Cancelado', tone: 'neutral' },
};

/** Etapas del flujo feliz, para el timeline del pedido. */
export const ORDER_FLOW: OrderStatus[] = [
  'DRAFT',
  'CONFIRMED',
  'SALES_REVIEW',
  'PICKING',
  'SHIPPED',
  'DELIVERED',
];

export const PAYMENT_TERM: Record<PaymentTerm, LabelSpec> = {
  CASH: { label: 'Contado', tone: 'ok' },
  TRANSFER_7: { label: 'Transferencia ≤ 7 días', tone: 'ok' },
  TRANSFER_15: { label: 'Transferencia 15 días', tone: 'neutral' },
  CHECK_30: { label: 'Cheque 30 días', tone: 'warn' },
  CREDIT_45: { label: 'Cuenta corriente 45 días', tone: 'warn' },
};

export const SEGMENT: Record<CustomerSegment, LabelSpec> = {
  SILVER: { label: 'Silver', tone: 'neutral' },
  GOLD: { label: 'Gold', tone: 'warn' },
  PLATINUM: { label: 'Platinum', tone: 'plat' },
};

export const SPECIAL_PRICE_STATUS: Record<SpecialPriceStatus, LabelSpec> = {
  DRAFT: { label: 'Borrador', tone: 'neutral' },
  SUBMITTED: { label: 'Enviada', tone: 'tech' },
  SALES_REVIEW: { label: 'Revisión comercial', tone: 'warn' },
  PM_REVIEW: { label: 'Revisión del PM', tone: 'warn' },
  COUNTEROFFERED: { label: 'Contraofertada', tone: 'tech' },
  APPROVED: { label: 'Aprobada', tone: 'ok' },
  REJECTED: { label: 'Rechazada', tone: 'bad' },
  EXPIRED: { label: 'Vencida', tone: 'neutral' },
};

/* ------------------------------------------------------------------ */
/* RMA                                                                 */
/* ------------------------------------------------------------------ */

export const RMA_STATUS: Record<RmaStatus, LabelSpec> = {
  DRAFT: { label: 'Borrador', tone: 'neutral' },
  SUBMITTED: { label: 'Solicitud creada', tone: 'tech' },
  ASHIR_VALIDATION: { label: 'Validación Ashir', tone: 'warn' },
  AWAITING_SHIPMENT: { label: 'Esperando envío/retiro', tone: 'warn' },
  RECEIVED: { label: 'Producto recibido', tone: 'tech' },
  DIAGNOSIS: { label: 'Diagnóstico técnico', tone: 'tech' },
  MANUFACTURER: { label: 'Gestión con fabricante', tone: 'warn' },
  RESOLUTION: { label: 'Resolución', tone: 'tech' },
  READY_FOR_PICKUP: { label: 'Listo para entrega', tone: 'ok' },
  CLOSED: { label: 'Finalizado', tone: 'ok' },
  REJECTED: { label: 'Rechazado', tone: 'bad' },
};

/** Orden canonico del timeline de RMA. */
export const RMA_FLOW: RmaStatus[] = [
  'SUBMITTED',
  'ASHIR_VALIDATION',
  'AWAITING_SHIPMENT',
  'RECEIVED',
  'DIAGNOSIS',
  'MANUFACTURER',
  'RESOLUTION',
  'READY_FOR_PICKUP',
  'CLOSED',
];

export const RMA_PROBLEM: Record<RmaProblemType, string> = {
  NO_POWER: 'No enciende',
  NO_VIDEO: 'Sin imagen',
  INTERMITTENT: 'Fallas intermitentes',
  TEMPERATURE: 'Temperatura',
  NOISE: 'Ruido',
  PHYSICAL_DAMAGE: 'Daño físico',
  INCOMPATIBILITY: 'Incompatibilidad',
  MISSING_ACCESSORY: 'Accesorio faltante',
  OTHER: 'Otro',
};

export const RMA_RESOLUTION: Record<RmaResolutionType, LabelSpec> = {
  REPAIRED: { label: 'Reparado', tone: 'ok' },
  REPLACED_NEW: { label: 'Cambio por producto nuevo', tone: 'ok' },
  REPLACED_EQUIVALENT: { label: 'Cambio por equivalente', tone: 'ok' },
  CREDIT_NOTE: { label: 'Nota de crédito', tone: 'tech' },
  REJECTED: { label: 'Rechazado', tone: 'bad' },
  NO_FAULT_FOUND: { label: 'Sin falla detectada', tone: 'warn' },
  SENT_TO_MANUFACTURER: { label: 'Derivado al fabricante', tone: 'warn' },
};

export const WARRANTY_FLAG: Record<WarrantyFlagCode, string> = {
  PHYSICAL_DAMAGE: 'Daño físico',
  ILLEGIBLE_SERIAL: 'Serial ilegible',
  LABEL_REMOVED: 'Etiqueta removida',
  ELECTRICAL_DAMAGE: 'Daño eléctrico',
  CORROSION: 'Sulfatación',
  TAMPERING: 'Manipulación',
};

/* ------------------------------------------------------------------ */
/* condiciones comerciales                                             */
/* ------------------------------------------------------------------ */

export const CONDITION_SCOPE: Record<ConditionScope, string> = {
  BRAND: 'Marca',
  CATEGORY: 'Categoría',
  SUBCATEGORY: 'Subcategoría',
  PRODUCT: 'Producto / SKU',
  CUSTOMER: 'Cliente',
  SEGMENT: 'Segmento',
  PRICE_LIST: 'Lista de precios',
  ZONE: 'Zona',
  QUANTITY: 'Cantidad',
  AMOUNT: 'Monto',
  PAYMENT: 'Medio / plazo de pago',
  DATE: 'Fecha',
};

export const CONDITION_ACTION: Record<ConditionActionType, string> = {
  DISCOUNT_PCT: 'Descuento porcentual',
  FIXED_PRICE: 'Precio fijo',
  TIERED_PRICE: 'Precio escalonado',
  BONUS_UNITS: 'Bonificación de unidades',
  FREE_FREIGHT: 'Envío bonificado',
  POINTS_MULTIPLIER: 'Multiplicador de puntos',
  STOCK_PRIORITY: 'Acceso prioritario a stock',
};

export const OPERATOR_LABEL: Record<string, string> = {
  IS: 'es',
  IS_NOT: 'no es',
  IN: 'está en',
  GTE: '≥',
  LTE: '≤',
  BETWEEN: 'entre',
};

/* ------------------------------------------------------------------ */
/* integraciones                                                       */
/* ------------------------------------------------------------------ */

export const INTEGRATION_STATUS: Record<IntegrationStatusCode, LabelSpec> = {
  OPERATIONAL: { label: 'Operativa', tone: 'ok' },
  DEGRADED: { label: 'Degradada', tone: 'warn', hint: 'Responde con errores o demoras' },
  OFFLINE: { label: 'Sin conexión', tone: 'bad' },
  NOT_CONFIGURED: { label: 'No configurada', tone: 'neutral', hint: 'Adaptador pendiente de definición' },
};

export const DIRECTION_LABEL: Record<string, string> = {
  OUTBOUND: 'Ashir → destino',
  INBOUND: 'destino → Ashir',
  BIDIRECTIONAL: 'Bidireccional',
};

export const FREQUENCY_LABEL: Record<string, string> = {
  MANUAL: 'Manual',
  EVERY_15M: 'Cada 15 minutos',
  HOURLY: 'Cada hora',
  DAILY: 'Diaria',
};

/* ------------------------------------------------------------------ */
/* clases de color por tono                                            */
/* ------------------------------------------------------------------ */

export const TONE_BADGE: Record<Tone, string> = {
  neutral: 'bg-ink-100 text-ink-700 ring-ink-200',
  ok: 'bg-ok-50 text-ok-700 ring-ok-100',
  warn: 'bg-warn-50 text-warn-700 ring-warn-100',
  bad: 'bg-bad-50 text-bad-700 ring-bad-100',
  tech: 'bg-tech-50 text-tech-700 ring-tech-100',
  brand: 'bg-ashir-50 text-ashir-700 ring-ashir-100',
  plat: 'bg-plat-50 text-plat-700 ring-plat-100',
};

export const TONE_DOT: Record<Tone, string> = {
  neutral: 'bg-ink-400',
  ok: 'bg-ok-500',
  warn: 'bg-warn-500',
  bad: 'bg-bad-500',
  tech: 'bg-tech-500',
  brand: 'bg-ashir-500',
  plat: 'bg-plat-500',
};

export const TONE_TEXT: Record<Tone, string> = {
  neutral: 'text-ink-600',
  ok: 'text-ok-600',
  warn: 'text-warn-600',
  bad: 'text-bad-600',
  tech: 'text-tech-600',
  brand: 'text-ashir-600',
  plat: 'text-plat-600',
};

/** Paleta para graficos: consistente en toda la app. */
export const CHART_COLORS = [
  '#fb5a11',
  '#1570ef',
  '#12b76a',
  '#7c3aed',
  '#f79009',
  '#636e80',
  '#d92d20',
  '#0e9384',
];
