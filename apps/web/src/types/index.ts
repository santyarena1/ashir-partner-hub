/**
 * Contratos de dominio del Ashir Partner Hub.
 *
 * Estos tipos son la fuente de verdad compartida entre la UI, los servicios
 * y el adaptador mock. Estan alineados con /docs/openapi.yaml: los importes
 * viajan como objeto { amount, currency } y las fechas como ISO 8601.
 */

/* ------------------------------------------------------------------ */
/* primitivas                                                          */
/* ------------------------------------------------------------------ */

export type Currency = 'USD' | 'ARS';

/** Importe monetario. `amount` es string para evitar floats ambiguos. */
export interface Money {
  amount: string;
  currency: Currency;
  /** true cuando el valor es simulado para la demo (p. ej. costos). */
  simulated?: boolean;
}

/** Envoltorio de coleccion de la API. */
export interface Paginated<T> {
  data: T[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
  requestId: string;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: { field: string; reason: string }[];
  };
  requestId: string;
}

export type DataMode = 'mock' | 'api';

/* ------------------------------------------------------------------ */
/* identidad y roles                                                   */
/* ------------------------------------------------------------------ */

export type Role = 'CLIENT' | 'SALES' | 'PM' | 'RMA' | 'ADMIN';

export type Scope =
  | 'catalog:read'
  | 'pricing:read'
  | 'pricing:manage'
  | 'orders:read'
  | 'orders:write'
  | 'orders:approve'
  | 'customers:read'
  | 'customers:write'
  | 'rma:read'
  | 'rma:write'
  | 'rma:manage'
  | 'pm:read'
  | 'pm:manage'
  | 'partner:read'
  | 'partner:manage'
  | 'imports:manage'
  | 'integrations:read'
  | 'integrations:manage'
  | 'cost:read'
  | 'margin:read'
  | 'audit:read';

export interface Session {
  userId: string;
  name: string;
  email: string;
  role: Role;
  roleLabel: string;
  avatarInitials: string;
  scopes: Scope[];
  /** Solo para el rol CLIENT: la cuenta de reseller autenticada. */
  customerId?: string;
  /** Marcas a cargo, solo para PM. */
  brandIds?: string[];
  jobTitle: string;
}

/* ------------------------------------------------------------------ */
/* catalogo                                                            */
/* ------------------------------------------------------------------ */

export type Availability = 'IN_STOCK' | 'NEW_ARRIVAL' | 'INCOMING' | 'OUT_OF_STOCK';

export interface Product {
  id: string;
  sku: string;
  partNumber: string | null;
  name: string;
  brand: string;
  brandId: string;
  category: string;
  categoryId: string;
  categoryGroup: string;
  subcategory: string | null;
  sourceSection: string | null;
  tags: string[];
  /** Precio de lista distribuidor sin IVA. null = "consultar" (no publicado). */
  listPrice: Money | null;
  suggestedRetail: Money | null;
  vatRate: number;
  /** Costo interno. SIMULADO. Nunca visible para el rol CLIENT. */
  cost: Money | null;
  /** Margen % sobre precio de lista. SIMULADO. */
  marginPct: number | null;
  stock: number;
  incoming: { units: number; etaDays: number } | null;
  availability: Availability;
  rawState: string | null;
  warrantyMonths: number;
  specs: string[];
  description: string | null;
  image: string | null;
  pmId: string;
  active: boolean;
  unitsSold12m: number;
  createdAt: string;
  dataSource: 'excel' | 'demo';
}

export interface Brand {
  id: string;
  name: string;
  pmId: string;
  color: string;
  skuCount: number;
  categories: string[];
}

export interface Category {
  id: string;
  name: string;
  group: string;
  subcategories: string[];
  skuCount: number;
}

export interface ProductQuery {
  query?: string;
  sku?: string;
  brandId?: string;
  categoryId?: string;
  subcategory?: string;
  inStock?: boolean;
  promotionId?: string;
  minPrice?: number;
  maxPrice?: number;
  purchasedBefore?: boolean;
  incomingSoon?: boolean;
  sort?: ProductSort;
  page?: number;
  pageSize?: number;
}

export type ProductSort =
  | 'relevance'
  | 'price_asc'
  | 'price_desc'
  | 'best_sellers'
  | 'newest'
  | 'stock_desc';

export interface SearchSuggestion {
  type: 'product' | 'brand' | 'category' | 'sku';
  id: string;
  label: string;
  sublabel?: string;
  href: string;
}

/* ------------------------------------------------------------------ */
/* pricing y condiciones comerciales                                   */
/* ------------------------------------------------------------------ */

export type AdjustmentType =
  | 'PRICE_LIST'
  | 'CUSTOMER_DISCOUNT'
  | 'PROMOTION'
  | 'VOLUME_TIER'
  | 'PAYMENT_TERM'
  | 'SPECIAL_PRICE'
  | 'FREIGHT';

export interface PriceAdjustment {
  type: AdjustmentType;
  /** Id de la condicion comercial que lo genero, si aplica. */
  conditionId?: string;
  label: string;
  percentage: string | null;
  amount: string;
  /** Explicacion legible para el desglose de precio. */
  note?: string;
}

export interface PriceEvaluation {
  productId: string;
  sku: string;
  quantity: number;
  basePrice: Money;
  adjustments: PriceAdjustment[];
  finalUnitPrice: Money;
  lineTotal: Money;
  /** Descuento total aplicado, en porcentaje sobre la base. */
  totalDiscountPct: string;
  validUntil: string;
  /** Condiciones que estan cerca de cumplirse pero todavia no aplican. */
  missedOpportunities: MissedOpportunity[];
  /** Escalones por cantidad disponibles para este producto/cliente. */
  tiers: PriceTier[];
  explanation: string;
  /** Condiciones que efectivamente se aplicaron, con su efecto legible. */
  appliedConditions: { conditionId: string; code: string; name: string; effect: string }[];
  /** Condiciones que no aplicaron y por qué: la UI lo muestra para transparencia. */
  skippedConditions: { conditionId: string; code: string; name: string; reason: string }[];
  /** Unidades bonificadas sin cargo otorgadas por alguna condición. */
  bonusUnits: number;
  freeFreight: boolean;
  pointsMultiplier: number;
  /** Condiciones aplicadas que exigen autorización antes de confirmar. */
  requiresApproval: { conditionId: string; label: string }[];
}

export interface MissedOpportunity {
  conditionId: string;
  label: string;
  /** Mensaje accionable, p. ej. "Agregando 2 unidades alcanzas el 4%". */
  message: string;
  potentialPct: string;
  missingUnits?: number;
  missingAmount?: Money;
}

export interface PriceTier {
  minQty: number;
  maxQty: number | null;
  discountPct: string;
  unitPrice: Money;
}

export interface PriceList {
  id: string;
  code: string;
  name: string;
  segment: CustomerSegment | null;
  currency: Currency;
  /** Ajuste porcentual base sobre el precio de lista distribuidor. */
  baseAdjustmentPct: string;
  /** Reglas por marca o categoria. */
  rules: PriceListRule[];
  /** Overrides puntuales por SKU. */
  overrides: { sku: string; price: Money; note?: string }[];
  customerCount: number;
  validFrom: string;
  validTo: string | null;
  status: 'ACTIVE' | 'DRAFT' | 'ARCHIVED';
  fxRate: number;
  updatedAt: string;
  updatedBy: string;
}

export interface PriceListRule {
  id: string;
  scope: 'BRAND' | 'CATEGORY' | 'ALL';
  target: string;
  adjustmentPct: string;
}

/* --- motor de condiciones comerciales --- */

export type ConditionScope =
  | 'BRAND'
  | 'CATEGORY'
  | 'SUBCATEGORY'
  | 'PRODUCT'
  | 'CUSTOMER'
  | 'SEGMENT'
  | 'PRICE_LIST'
  | 'ZONE'
  | 'QUANTITY'
  | 'AMOUNT'
  | 'PAYMENT'
  | 'DATE';

export interface ConditionCriterion {
  scope: ConditionScope;
  operator: 'IS' | 'IS_NOT' | 'IN' | 'GTE' | 'LTE' | 'BETWEEN';
  values: string[];
  label: string;
}

export type ConditionActionType =
  | 'DISCOUNT_PCT'
  | 'FIXED_PRICE'
  | 'TIERED_PRICE'
  | 'BONUS_UNITS'
  | 'FREE_FREIGHT'
  | 'POINTS_MULTIPLIER'
  | 'STOCK_PRIORITY';

export interface ConditionAction {
  type: ConditionActionType;
  value: string;
  label: string;
  tiers?: { minQty: number; discountPct: string }[];
}

export interface CommercialCondition {
  id: string;
  code: string;
  name: string;
  description: string;
  criteria: ConditionCriterion[];
  actions: ConditionAction[];
  validFrom: string;
  validTo: string;
  priority: number;
  stackable: boolean;
  exclusions: string[];
  usageLimit: number | null;
  usageCount: number;
  requiresApproval: boolean;
  owner: string;
  status: 'ACTIVE' | 'SCHEDULED' | 'EXPIRED' | 'DRAFT' | 'PAUSED';
  kind: 'CONDITION' | 'PROMOTION';
  createdAt: string;
  updatedAt: string;
}

export interface ConditionSimulationInput {
  customerId: string;
  productId: string;
  quantity: number;
  date: string;
  paymentTerm: PaymentTerm;
}

export interface ConditionSimulationResult {
  evaluation: PriceEvaluation;
  appliedConditions: { conditionId: string; code: string; name: string; effect: string }[];
  skippedConditions: { conditionId: string; code: string; name: string; reason: string }[];
}

/* ------------------------------------------------------------------ */
/* clientes                                                            */
/* ------------------------------------------------------------------ */

export type CustomerSegment = 'SILVER' | 'GOLD' | 'PLATINUM';
export type PaymentTerm = 'CASH' | 'TRANSFER_7' | 'TRANSFER_15' | 'CHECK_30' | 'CREDIT_45';

export interface Customer {
  id: string;
  code: string;
  legalName: string;
  tradeName: string;
  taxId: string;
  segment: CustomerSegment;
  status: 'ACTIVE' | 'ON_HOLD' | 'SUSPENDED' | 'PROSPECT';
  salesRepId: string;
  priceListId: string;
  paymentTerm: PaymentTerm;
  zone: string;
  city: string;
  province: string;
  address: string;
  email: string;
  phone: string;
  account: CustomerAccount;
  /** Marcas mas compradas, en orden. */
  topBrands: string[];
  lastOrderAt: string | null;
  orderFrequencyDays: number;
  purchases12m: Money;
  purchasesPrevious12m: Money;
  partnerTier: CustomerSegment;
  points: number;
  createdAt: string;
  internalNotes: { id: string; author: string; at: string; text: string }[];
  documents: { name: string; status: 'OK' | 'EXPIRING' | 'MISSING'; expiresAt: string | null }[];
}

export interface CustomerAccount {
  creditLimit: Money;
  creditUsed: Money;
  creditAvailable: Money;
  balance: Money;
  overdue: Money;
  nextDueDate: string | null;
  nextDueAmount: Money | null;
  invoices: Invoice[];
}

export interface Invoice {
  id: string;
  number: string;
  orderId: string | null;
  issuedAt: string;
  dueAt: string;
  total: Money;
  status: 'PAID' | 'PENDING' | 'OVERDUE' | 'PARTIAL';
}

/* ------------------------------------------------------------------ */
/* pedidos                                                             */
/* ------------------------------------------------------------------ */

export type OrderStatus =
  | 'DRAFT'
  | 'CONFIRMED'
  | 'SALES_REVIEW'
  | 'PENDING_APPROVAL'
  | 'PENDING_PAYMENT'
  | 'OBSERVED'
  | 'PICKING'
  | 'PARTIALLY_SHIPPED'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED';

export interface OrderItem {
  id: string;
  productId: string;
  sku: string;
  name: string;
  brand: string;
  quantity: number;
  unitPrice: Money;
  listPrice: Money;
  discountPct: string;
  lineTotal: Money;
  appliedConditions: string[];
  /** Cantidad ya despachada, para pedidos parciales. */
  shippedQty: number;
  stockAtOrder: number;
  serials?: string[];
}

export interface Order {
  id: string;
  number: string;
  customerId: string;
  customerName: string;
  status: OrderStatus;
  /** Version para concurrencia optimista (If-Match / 409). */
  version: number;
  items: OrderItem[];
  subtotal: Money;
  discountTotal: Money;
  taxTotal: Money;
  freight: Money;
  total: Money;
  currency: Currency;
  fxRate: number;
  paymentTerm: PaymentTerm;
  deliveryMethod: 'DELIVERY' | 'PICKUP';
  deliveryAddress: string;
  customerPO: string | null;
  notes: string | null;
  appliedConditions: { conditionId: string; code: string; name: string; effect: string }[];
  requiredApprovals: { type: string; label: string; status: 'PENDING' | 'APPROVED' | 'REJECTED'; approver: string | null }[];
  salesRepId: string;
  createdAt: string;
  updatedAt: string;
  confirmedAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  invoiceIds: string[];
  tracking: { carrier: string; code: string; url: string | null; status: string } | null;
  auditLog: AuditEvent[];
  /** Acciones de modificacion permitidas en el estado actual. */
  allowedModifications: OrderModification[];
}

export type OrderModification =
  | 'ADD_ITEM'
  | 'REMOVE_ITEM'
  | 'CHANGE_QTY'
  | 'CHANGE_NOTES'
  | 'CHANGE_DELIVERY'
  | 'REQUEST_CHANGE'
  | 'CANCEL';

/* ------------------------------------------------------------------ */
/* carrito                                                             */
/* ------------------------------------------------------------------ */

export interface CartLine {
  productId: string;
  sku: string;
  quantity: number;
  addedAt: string;
}

export interface CartTotals {
  lines: {
    line: CartLine;
    product: Product;
    evaluation: PriceEvaluation;
  }[];
  subtotal: Money;
  discountTotal: Money;
  taxTotal: Money;
  freight: Money;
  total: Money;
  appliedConditions: { conditionId: string; code: string; name: string; effect: string }[];
  missedOpportunities: MissedOpportunity[];
  creditAfter: Money;
  creditWarning: string | null;
  requiredApprovals: { type: string; label: string; reason: string }[];
}

/* ------------------------------------------------------------------ */
/* solicitudes de precio especial / deal registration                  */
/* ------------------------------------------------------------------ */

export type SpecialPriceStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'SALES_REVIEW'
  | 'PM_REVIEW'
  | 'COUNTEROFFERED'
  | 'APPROVED'
  | 'REJECTED'
  | 'EXPIRED';

export interface SpecialPriceRequest {
  id: string;
  code: string;
  customerId: string;
  customerName: string;
  productId: string;
  sku: string;
  productName: string;
  brand: string;
  quantity: number;
  currentPrice: Money;
  targetPrice: Money;
  /** Precio aprobado (puede diferir del solicitado si hubo contraoferta). */
  approvedPrice: Money | null;
  approvedQuantity: number | null;
  approvedValidUntil: string | null;
  /** Costo y margen: solo visible para PM/Comercial/Admin. */
  cost: Money | null;
  resultingMarginPct: string | null;
  baseMarginPct: string | null;
  endCustomer: string;
  project: string;
  competitor: string | null;
  expectedCloseDate: string;
  comments: string;
  attachments: { name: string; size: string; type: string }[];
  status: SpecialPriceStatus;
  pmId: string;
  salesRepId: string;
  createdAt: string;
  updatedAt: string;
  auditLog: AuditEvent[];
}

/* ------------------------------------------------------------------ */
/* programa Ashir Partner                                              */
/* ------------------------------------------------------------------ */

export interface PartnerStatus {
  customerId: string;
  tier: CustomerSegment;
  points: number;
  pointsExpiringSoon: { points: number; expiresAt: string };
  tierProgress: {
    current: CustomerSegment;
    next: CustomerSegment | null;
    /** Compras acumuladas del periodo. */
    achieved: Money;
    required: Money;
    progressPct: number;
    periodEndsAt: string;
  };
  benefits: PartnerBenefit[];
  missions: PartnerMission[];
  ledger: PointsLedgerEntry[];
}

export interface PartnerBenefit {
  id: string;
  name: string;
  description: string;
  category: 'COMMERCIAL' | 'LOGISTICS' | 'MARKETING' | 'TRAINING' | 'STOCK' | 'SUPPORT';
  cost: number | null;
  requiredTier: CustomerSegment;
  status: 'ACTIVE' | 'AVAILABLE' | 'LOCKED' | 'REDEEMED';
  validUntil: string | null;
  rules: string;
}

export interface PartnerMission {
  id: string;
  name: string;
  description: string;
  reward: string;
  rewardPoints: number;
  progress: number;
  target: number;
  unit: 'USD' | 'CATEGORIES' | 'UNITS' | 'ORDERS';
  brand: string | null;
  endsAt: string;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'EXPIRED';
}

export interface PointsLedgerEntry {
  id: string;
  at: string;
  type: 'EARNED' | 'REDEEMED' | 'EXPIRED' | 'ADJUSTED';
  points: number;
  balance: number;
  reason: string;
  reference: string | null;
  rule: string | null;
  expiresAt: string | null;
  actor: string;
}

/* ------------------------------------------------------------------ */
/* RMA / garantias                                                     */
/* ------------------------------------------------------------------ */

export interface SerialRecord {
  serial: string;
  productId: string;
  sku: string;
  productName: string;
  brand: string;
  category: string;
  /** Cuenta propietaria. La consulta se valida contra la sesion. */
  customerId: string;
  customerName: string;
  orderId: string;
  orderNumber: string;
  invoiceNumber: string;
  purchasedAt: string;
  warrantyMonths: number;
  warrantyExpiresAt: string;
  lotId: string;
  openRmaId: string | null;
  /** Serial de reemplazo, si este ya fue cambiado por RMA. */
  replacedBySerial: string | null;
}

export type SerialLookupStatus =
  | 'IN_WARRANTY'
  | 'WARRANTY_EXPIRED'
  | 'NEEDS_REVIEW'
  | 'NOT_FOUND'
  | 'NOT_YOUR_ACCOUNT'
  | 'RMA_ALREADY_OPEN';

/**
 * Resultado del lookup de serial.
 *
 * Regla critica de privacidad: cuando `status === 'NOT_YOUR_ACCOUNT'` el
 * payload NO incluye `record` — ni factura, ni fecha, ni razon social del
 * tercero. Solo el mensaje generico.
 */
export interface SerialLookupResult {
  status: SerialLookupStatus;
  serial: string;
  record: SerialRecord | null;
  message: string;
  warrantyDaysRemaining: number | null;
  eligibility: WarrantyEligibility | null;
}

export interface WarrantyEligibility {
  eligible: boolean;
  requiresManualReview: boolean;
  policyId: string;
  policyName: string;
  warrantyMonths: number;
  expiresAt: string;
  reasons: string[];
  flags: WarrantyFlag[];
}

export type WarrantyFlagCode =
  | 'PHYSICAL_DAMAGE'
  | 'ILLEGIBLE_SERIAL'
  | 'LABEL_REMOVED'
  | 'ELECTRICAL_DAMAGE'
  | 'CORROSION'
  | 'TAMPERING';

export interface WarrantyFlag {
  code: WarrantyFlagCode;
  label: string;
  raisedBy: string;
  at: string;
  note: string;
}

export interface WarrantyPolicy {
  id: string;
  name: string;
  scope: 'BRAND' | 'CATEGORY' | 'PRODUCT';
  target: string;
  months: number;
  /** Excepciones por SKU o por lote/fecha. */
  exceptions: { type: 'SKU' | 'LOT' | 'DATE_RANGE'; target: string; months: number; note: string }[];
  flagsRequireReview: WarrantyFlagCode[];
  slaValidationHours: number;
  slaDiagnosisHours: number;
  slaResolutionDays: number;
  updatedAt: string;
}

export type RmaStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'ASHIR_VALIDATION'
  | 'AWAITING_SHIPMENT'
  | 'RECEIVED'
  | 'DIAGNOSIS'
  | 'MANUFACTURER'
  | 'RESOLUTION'
  | 'READY_FOR_PICKUP'
  | 'CLOSED'
  | 'REJECTED';

export type RmaProblemType =
  | 'NO_POWER'
  | 'NO_VIDEO'
  | 'INTERMITTENT'
  | 'TEMPERATURE'
  | 'NOISE'
  | 'PHYSICAL_DAMAGE'
  | 'INCOMPATIBILITY'
  | 'MISSING_ACCESSORY'
  | 'OTHER';

export type RmaResolutionType =
  | 'REPAIRED'
  | 'REPLACED_NEW'
  | 'REPLACED_EQUIVALENT'
  | 'CREDIT_NOTE'
  | 'REJECTED'
  | 'NO_FAULT_FOUND'
  | 'SENT_TO_MANUFACTURER';

export interface RmaUnit {
  id: string;
  serial: string;
  productId: string;
  sku: string;
  productName: string;
  brand: string;
  lotId: string;
  problemType: RmaProblemType;
  problemLabel: string;
  description: string;
  answers: { question: string; answer: string }[];
  status: RmaStatus;
  eligibility: WarrantyEligibility | null;
  diagnosis: RmaDiagnosis | null;
  resolution: RmaResolution | null;
  receivedAt: string | null;
  receptionIssue: 'NONE' | 'MISSING' | 'WRONG_SERIAL' | 'EXTRA' | 'VISIBLE_DAMAGE' | null;
}

export interface RmaDiagnosis {
  at: string;
  technician: string;
  faultConfirmed: boolean;
  faultCode: string;
  findings: string;
  testsPerformed: string[];
  flags: WarrantyFlagCode[];
  recommendation: RmaResolutionType;
}

export interface RmaResolution {
  at: string;
  type: RmaResolutionType;
  approvedBy: string;
  notes: string;
  replacementSerial: string | null;
  replacementSku: string | null;
  creditNoteNumber: string | null;
  creditAmount: Money | null;
  resultingWarrantyExpiresAt: string | null;
}

export interface RmaCase {
  id: string;
  code: string;
  customerId: string;
  customerName: string;
  /** Un caso puede agrupar varias unidades bajo una misma logistica. */
  units: RmaUnit[];
  status: RmaStatus;
  isBatch: boolean;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
  closedAt: string | null;
  assignedTo: string | null;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
  logistics: {
    mode: 'PICKUP' | 'DROP_OFF' | 'CARRIER';
    remitNumber: string | null;
    labelCode: string | null;
    carrier: string | null;
    expectedUnits: number;
    receivedUnits: number;
    receptionPhotos: number;
    receptionNotes: string | null;
  };
  sla: RmaSla;
  attachments: { name: string; size: string; type: string; unitSerial: string | null }[];
  timeline: RmaTimelineEvent[];
  auditLog: AuditEvent[];
  troubleshootingOutcome: 'SOLVED' | 'ALREADY_TRIED' | 'CONTINUED' | null;
}

export interface RmaSla {
  stage: 'VALIDATION' | 'DIAGNOSIS' | 'RESOLUTION' | 'DONE';
  targetHours: number;
  elapsedHours: number;
  remainingHours: number;
  breached: boolean;
  pausedReason: string | null;
  dueAt: string;
}

export interface RmaTimelineEvent {
  id: string;
  at: string;
  status: RmaStatus;
  label: string;
  actor: string;
  actorRole: Role | 'SYSTEM';
  comment: string | null;
  documents: { name: string; type: string }[];
  unitSerial: string | null;
}

export interface RmaLot {
  id: string;
  code: string;
  brand: string;
  sku: string;
  productName: string;
  importedAt: string;
  unitsImported: number;
  unitsSold: number;
  rmaCount: number;
  rmaRatePct: string;
  brandAverageRatePct: string;
  affectedSerials: string[];
  commonReasons: { reason: string; count: number }[];
  incidentSuspected: boolean;
  note: string;
}

export interface RmaAnalytics {
  brandId: string;
  brand: string;
  unitsSold: number;
  rmaCount: number;
  rmaRatePct: string;
  avgResolutionDays: number;
  awaitingManufacturer: number;
  monthly: { month: string; sold: number; rma: number; ratePct: string }[];
  reasons: { reason: string; count: number; pct: string }[];
  topSkus: {
    sku: string;
    productName: string;
    sold: number;
    rma: number;
    ratePct: string;
    /** Multiplo respecto del promedio de la marca. */
    vsBrandAvg: string;
    alert: boolean;
  }[];
  outcomes: { outcome: string; count: number; pct: string }[];
  lots: { lotId: string; code: string; ratePct: string; incidentSuspected: boolean }[];
}

/* ------------------------------------------------------------------ */
/* Product Manager                                                     */
/* ------------------------------------------------------------------ */

export interface ProductManager {
  id: string;
  name: string;
  email: string;
  initials: string;
  brandIds: string[];
  brands: string[];
  monthlyTarget: Money;
}

export interface PmBrandDashboard {
  brandId: string;
  brand: string;
  color: string;
  pm: string;
  salesMonth: Money;
  salesMonthVsPrevPct: string;
  grossMarginPct: string;
  grossMarginVsPrevPct: string;
  stockValue: Money;
  turnover: string;
  coverageDays: number;
  monthlyTarget: Money;
  targetProgressPct: number;
  activeCustomers: number;
  activeCustomersVsPrev: number;
  criticalSkus: number;
  rmaCount: number;
  rmaRatePct: string;
  /** Series de 12 meses. */
  series: {
    month: string;
    sales: number;
    units: number;
    marginPct: number;
    stockValue: number;
    coverageDays: number;
  }[];
  sellInByCustomer: { customerId: string; customer: string; amount: number; sharePct: string }[];
  categoryMix: { category: string; amount: number; sharePct: string }[];
  topSkus: { sku: string; name: string; units: number; amount: number; marginPct: string }[];
  stagnantProducts: { sku: string; name: string; stock: number; daysWithoutSale: number; stockValue: number }[];
  churningCustomers: { customerId: string; customer: string; lastOrderAt: string; previous12m: number }[];
  upcomingStockouts: { sku: string; name: string; stock: number; dailyRate: string; daysLeft: number }[];
  stockAging: StockAgingBucket[];
}

export interface StockAgingBucket {
  bucket: '0-30' | '31-60' | '61-90' | '91-120' | '120+';
  units: number;
  value: number;
  skus: { sku: string; name: string; units: number; days: number }[];
}

export interface CommercialSimulationInput {
  productId: string;
  cost: number;
  currentPrice: number;
  stock: number;
  fxRate: number;
  discountPct: number;
  expectedUnits: number;
}

export interface CommercialSimulationResult {
  input: CommercialSimulationInput;
  newPrice: number;
  marginPct: number;
  marginUsd: number;
  baseMarginPct: number;
  baseMarginUsd: number;
  revenueEstimate: number;
  fullStockImpact: number;
  stockSellThroughPct: number;
  comparison: { label: string; base: number; scenario: number; delta: number; unit: string }[];
  fxSensitivity: { fxRate: number; marginPct: number; marginUsd: number }[];
}

/* ------------------------------------------------------------------ */
/* importaciones                                                       */
/* ------------------------------------------------------------------ */

export interface ImportRun {
  id: string;
  fileName: string;
  sheet: string;
  startedAt: string;
  finishedAt: string | null;
  actor: string;
  status: 'PENDING' | 'VALIDATING' | 'PREVIEW' | 'COMMITTED' | 'FAILED' | 'CANCELLED';
  rowsTotal: number;
  rowsValid: number;
  rowsWithErrors: number;
  creates: number;
  updates: number;
  unchanged: number;
  mapping: { source: string; target: string; required: boolean }[];
  errors: ImportRowError[];
  mode: 'SIMULATION' | 'COMMIT';
}

export interface ImportRowError {
  row: number;
  column: string;
  value: string;
  code: string;
  message: string;
  severity: 'ERROR' | 'WARNING';
}

export interface ImportPreview {
  headers: string[];
  rows: (string | number | null)[][];
  detectedSheets: string[];
  suggestedMapping: { source: string; target: string; confidence: number }[];
}

/* ------------------------------------------------------------------ */
/* integraciones                                                       */
/* ------------------------------------------------------------------ */

export type IntegrationStatusCode = 'OPERATIONAL' | 'DEGRADED' | 'OFFLINE' | 'NOT_CONFIGURED';

export interface Integration {
  id: string;
  name: string;
  kind: 'ERP' | 'CONNECTOR' | 'STOCK' | 'PRICING' | 'BILLING' | 'LOGISTICS' | 'RMA' | 'NOTIFICATIONS';
  description: string;
  status: IntegrationStatusCode;
  adapter: string;
  mode: 'MOCK' | 'DEMO' | 'PRODUCTION';
  environment: 'DEMO' | 'PRODUCTION';
  lastSyncAt: string | null;
  nextSyncAt: string | null;
  frequency: 'MANUAL' | 'EVERY_15M' | 'HOURLY' | 'DAILY';
  recordsProcessed: number;
  errorCount: number;
  retryCount: number;
  entities: IntegrationEntity[];
  maskedConfig: { key: string; value: string; secret: boolean }[];
  architecture: string[];
  benefits?: string[];
  featured: boolean;
}

export interface IntegrationEntity {
  key: string;
  label: string;
  direction: 'OUTBOUND' | 'INBOUND' | 'BIDIRECTIONAL';
  enabled: boolean;
  lastUpdatedAt: string | null;
  records: number;
  status: IntegrationStatusCode;
}

export interface IntegrationRun {
  id: string;
  integrationId: string;
  at: string;
  process: string;
  direction: 'OUTBOUND' | 'INBOUND' | 'BIDIRECTIONAL';
  records: number;
  durationMs: number;
  result: 'SUCCESS' | 'WARNING' | 'FAILED';
  warnings: string[];
  errors: string[];
  requestId: string;
  summary: string;
}

/* ------------------------------------------------------------------ */
/* webhooks                                                            */
/* ------------------------------------------------------------------ */

export type WebhookEventType =
  | 'order.created'
  | 'order.updated'
  | 'order.status_changed'
  | 'order.cancelled'
  | 'special_price.approved'
  | 'rma.created'
  | 'rma.status_changed'
  | 'rma.resolved'
  | 'customer.updated'
  | 'product.stock_changed'
  | 'price_list.updated'
  | 'integration.sync_failed';

export interface WebhookDelivery {
  id: string;
  eventId: string;
  type: WebhookEventType;
  occurredAt: string;
  apiVersion: string;
  endpoint: string;
  status: 'DELIVERED' | 'FAILED' | 'PENDING' | 'DEAD_LETTER';
  attempts: number;
  responseCode: number | null;
  durationMs: number;
  payload: Record<string, unknown>;
}

/* ------------------------------------------------------------------ */
/* notificaciones y auditoria                                          */
/* ------------------------------------------------------------------ */

export interface Notification {
  id: string;
  roles: Role[];
  customerId: string | null;
  kind:
    | 'ORDER'
    | 'SPECIAL_PRICE'
    | 'RMA'
    | 'POINTS'
    | 'STOCK'
    | 'APPROVAL'
    | 'IMPORT'
    | 'INTEGRATION';
  title: string;
  body: string;
  at: string;
  read: boolean;
  href: string;
  severity: 'INFO' | 'SUCCESS' | 'WARNING' | 'CRITICAL';
}

export interface AuditEvent {
  id: string;
  at: string;
  actor: string;
  actorRole: Role | 'SYSTEM';
  action: string;
  entity: string;
  entityId: string;
  previousValue: string | null;
  newValue: string | null;
  origin: 'PORTAL' | 'API' | 'ERP' | 'IMPORT' | 'SYSTEM';
  requestId: string;
  comment: string | null;
}

export interface InternalUser {
  id: string;
  name: string;
  email: string;
  initials: string;
  role: Role;
  jobTitle: string;
  scopes: Scope[];
  brandIds?: string[];
}

/* ------------------------------------------------------------------ */
/* panel de escenarios de demo                                         */
/* ------------------------------------------------------------------ */

export type DemoScenario =
  | 'SLOW_API'
  | 'SERVER_ERROR'
  | 'OUT_OF_STOCK'
  | 'ORDER_VERSION_CONFLICT'
  | 'SERIAL_OTHER_RESELLER'
  | 'WARRANTY_EXPIRED'
  | 'RMA_SLA_BREACH'
  | 'ERP_DOWN';

export interface DemoScenarioDefinition {
  code: DemoScenario;
  label: string;
  description: string;
  affects: string;
}
