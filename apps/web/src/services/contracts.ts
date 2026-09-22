/**
 * Interfaz de la capa de datos.
 *
 * Todas las pantallas consumen estos servicios y nunca importan fixtures
 * directamente. Hoy existe una sola implementacion (adaptador mock); el dia
 * que exista la API de Ashir alcanza con escribir un segundo adaptador que
 * cumpla el mismo contrato, sin tocar la UI.
 *
 *   UI / Pages -> hooks -> Domain Services -> ApiClient -> Mock | REST | ERP
 */
import type {
  CommercialCondition,
  CommercialSimulationInput,
  CommercialSimulationResult,
  ConditionSimulationResult,
  Customer,
  ImportPreview,
  ImportRun,
  Integration,
  IntegrationRun,
  Notification,
  Order,
  OrderStatus,
  Paginated,
  PartnerStatus,
  PmBrandDashboard,
  PriceEvaluation,
  PriceList,
  Product,
  ProductQuery,
  ResellerFeed,
  RetailObservation,
  RetailPolicy,
  RetailSummary,
  RmaAnalytics,
  RmaCase,
  RmaDiagnosis,
  RmaLot,
  RmaProblemType,
  RmaResolution,
  RmaStatus,
  SearchSuggestion,
  SerialLookupResult,
  SerialRecord,
  Session,
  SpecialPriceRequest,
  WarrantyPolicy,
  WebhookDelivery,
} from '@/types';

/* ------------------------------------------------------------------ */

export interface CatalogService {
  listProducts(query: ProductQuery, session: Session): Promise<Paginated<Product>>;
  getProduct(idOrSku: string, session: Session): Promise<Product>;
  getAvailability(productId: string): Promise<{ stock: number; incoming: Product['incoming']; availability: Product['availability'] }>;
  listBrands(): Promise<{ id: string; name: string; skuCount: number; color: string; categories: string[]; pmId: string }[]>;
  listCategories(): Promise<{ id: string; name: string; group: string; skuCount: number; subcategories: string[] }[]>;
  suggestions(term: string, session: Session): Promise<SearchSuggestion[]>;
  /** Productos ya comprados por el cliente de la sesion. */
  previouslyPurchased(session: Session): Promise<Product[]>;
}

export interface PricingService {
  evaluate(
    productId: string,
    quantity: number,
    session: Session,
    options?: { date?: string; paymentTerm?: Customer['paymentTerm']; customerId?: string; orderAmount?: number },
  ): Promise<PriceEvaluation>;
  evaluateMany(
    lines: { productId: string; quantity: number }[],
    session: Session,
  ): Promise<PriceEvaluation[]>;
  listPriceLists(): Promise<PriceList[]>;
  getPriceList(id: string): Promise<PriceList>;
  listConditions(filter?: { kind?: CommercialCondition['kind']; status?: CommercialCondition['status'] }): Promise<CommercialCondition[]>;
  getCondition(id: string): Promise<CommercialCondition>;
  createCondition(draft: Partial<CommercialCondition>): Promise<CommercialCondition>;
  updateCondition(id: string, patch: Partial<CommercialCondition>): Promise<CommercialCondition>;
  simulateCondition(input: {
    customerId: string;
    productId: string;
    quantity: number;
    date: string;
    paymentTerm: Customer['paymentTerm'];
  }): Promise<ConditionSimulationResult>;
}

export interface CustomerService {
  list(filter?: { query?: string; segment?: string; salesRepId?: string; status?: string }): Promise<Customer[]>;
  get(id: string): Promise<Customer>;
  update(id: string, patch: Partial<Customer>): Promise<Customer>;
  purchases(id: string): Promise<Order[]>;
  addNote(id: string, text: string, author: string): Promise<Customer>;
}

export interface OrderService {
  list(filter: { customerId?: string; status?: OrderStatus; query?: string }, session: Session): Promise<Order[]>;
  get(id: string, session: Session): Promise<Order>;
  create(draft: { customerId: string; items: { productId: string; quantity: number }[]; notes?: string; customerPO?: string; deliveryMethod?: Order['deliveryMethod'] }, session: Session): Promise<Order>;
  /** Modificacion con concurrencia optimista: si `version` no coincide -> 409. */
  update(
    id: string,
    patch: { version: number; items?: { productId: string; quantity: number }[]; notes?: string; customerPO?: string; deliveryMethod?: Order['deliveryMethod'] },
    session: Session,
  ): Promise<Order>;
  submit(id: string, session: Session): Promise<Order>;
  cancel(id: string, reason: string, session: Session): Promise<Order>;
  duplicate(id: string, session: Session): Promise<Order>;
  advanceStatus(id: string, status: OrderStatus, session: Session, comment?: string): Promise<Order>;
  /** Previsualiza el impacto de un cambio antes de aplicarlo. */
  previewChange(
    id: string,
    items: { productId: string; quantity: number }[],
    session: Session,
  ): Promise<{ warnings: string[]; lostConditions: string[]; gainedConditions: string[]; newTotal: Order['total'] }>;
}

export interface SpecialPriceService {
  list(filter: { customerId?: string; status?: string; pmId?: string }, session: Session): Promise<SpecialPriceRequest[]>;
  get(id: string, session: Session): Promise<SpecialPriceRequest>;
  create(draft: Partial<SpecialPriceRequest>, session: Session): Promise<SpecialPriceRequest>;
  approve(id: string, session: Session, comment?: string): Promise<SpecialPriceRequest>;
  counteroffer(id: string, price: number, session: Session, comment?: string): Promise<SpecialPriceRequest>;
  reject(id: string, session: Session, comment: string): Promise<SpecialPriceRequest>;
}

export interface PartnerService {
  status(session: Session): Promise<PartnerStatus>;
  redeem(benefitId: string, session: Session): Promise<PartnerStatus>;
}

export interface RmaService {
  lookupSerial(serial: string, session: Session): Promise<SerialLookupResult>;
  eligibleSerials(session: Session): Promise<SerialRecord[]>;
  listCases(filter: { customerId?: string; status?: RmaStatus; query?: string; brand?: string; breachedOnly?: boolean }, session: Session): Promise<RmaCase[]>;
  getCase(id: string, session: Session): Promise<RmaCase>;
  createCase(
    draft: {
      serials: string[];
      problemType: RmaProblemType;
      description: string;
      answers: { question: string; answer: string }[];
      troubleshootingOutcome: RmaCase['troubleshootingOutcome'];
      logisticsMode: RmaCase['logistics']['mode'];
    },
    session: Session,
  ): Promise<RmaCase>;
  approveReception(id: string, session: Session): Promise<RmaCase>;
  receive(id: string, units: { serial: string; issue: RmaCase['units'][number]['receptionIssue'] }[], notes: string, session: Session): Promise<RmaCase>;
  registerDiagnosis(id: string, serial: string, diagnosis: Omit<RmaDiagnosis, 'at'>, session: Session): Promise<RmaCase>;
  resolve(id: string, serial: string, resolution: Omit<RmaResolution, 'at'>, session: Session): Promise<RmaCase>;
  analytics(brandId: string): Promise<RmaAnalytics>;
  listLots(): Promise<RmaLot[]>;
  getLot(code: string): Promise<RmaLot>;
  listPolicies(): Promise<WarrantyPolicy[]>;
  /** Busqueda universal: serial, RMA, factura, pedido, cliente o SKU. */
  universalSearch(term: string, session: Session): Promise<{ kind: string; label: string; sublabel: string; href: string }[]>;
}

export interface ProductManagerService {
  listBrandsForPm(session: Session): Promise<{ id: string; name: string; color: string; skuCount: number }[]>;
  dashboard(brandId: string, session: Session): Promise<PmBrandDashboard>;
  simulate(input: CommercialSimulationInput): Promise<CommercialSimulationResult>;
}

export interface IntegrationService {
  list(): Promise<Integration[]>;
  get(id: string): Promise<Integration>;
  runs(id: string): Promise<IntegrationRun[]>;
  getRun(runId: string): Promise<IntegrationRun>;
  sync(id: string): Promise<IntegrationRun>;
  testConnection(id: string): Promise<{ ok: boolean; message: string; latencyMs: number; requestId: string }>;
  updateConfiguration(id: string, patch: Partial<Integration>): Promise<Integration>;
  listWebhooks(): Promise<WebhookDelivery[]>;
  resendWebhook(id: string): Promise<WebhookDelivery>;
}

export interface ImportService {
  history(): Promise<ImportRun[]>;
  preview(file: File): Promise<ImportPreview>;
  validate(preview: ImportPreview, mapping: ImportRun['mapping']): Promise<ImportRun>;
  commit(runId: string): Promise<ImportRun>;
}

/**
 * Control de PVP: politicas por SKU, conexiones con el sitio de cada
 * reseller y los precios publicados que se leen de ahi.
 */
export interface RetailPriceService {
  /** Politicas de PVP. Un PM ve solo las de sus marcas. */
  policies(filter: { brandId?: string; query?: string }, session: Session): Promise<RetailPolicy[]>;
  policyForProduct(productId: string): Promise<RetailPolicy | null>;
  upsertPolicy(
    input: { productId: string; pvp: string; tolerancePct: number; enforced: boolean; notes?: string | null },
    session: Session,
  ): Promise<RetailPolicy>;

  /** Conexiones de lectura. El cliente solo ve la suya. */
  feeds(session: Session): Promise<ResellerFeed[]>;
  feedForCustomer(customerId: string, session: Session): Promise<ResellerFeed | null>;
  saveFeed(
    input: { customerId: string; kind: ResellerFeed['kind']; url: string; matchBy: ResellerFeed['matchBy'] },
    session: Session,
  ): Promise<ResellerFeed>;
  /** Fuerza una lectura ahora, sin esperar a la corrida diaria. */
  runFeed(customerId: string, session: Session): Promise<ResellerFeed>;

  /** Precios publicados observados. El cliente solo ve los suyos. */
  observations(
    filter: { customerId?: string; brandId?: string; status?: RetailObservation['status']; query?: string },
    session: Session,
  ): Promise<RetailObservation[]>;
  /** El reseller marca que vio el aviso y lo va a corregir. */
  acknowledge(observationId: string, session: Session): Promise<RetailObservation>;
  summary(session: Session): Promise<RetailSummary>;
}

export interface NotificationService {
  list(session: Session): Promise<Notification[]>;
  markRead(id: string): Promise<Notification[]>;
  markAllRead(session: Session): Promise<Notification[]>;
}

/* ------------------------------------------------------------------ */

export interface ApiClient {
  catalog: CatalogService;
  pricing: PricingService;
  customers: CustomerService;
  orders: OrderService;
  specialPrice: SpecialPriceService;
  partner: PartnerService;
  rma: RmaService;
  pm: ProductManagerService;
  integrations: IntegrationService;
  imports: ImportService;
  retail: RetailPriceService;
  notifications: NotificationService;
  /** Identifica al adaptador activo, para mostrarlo en la UI. */
  readonly mode: 'mock' | 'api';
}

/* ------------------------------------------------------------------ */
/* errores                                                             */
/* ------------------------------------------------------------------ */

/** Error de dominio con el mismo shape que devolveria la API. */
export class ServiceError extends Error {
  code: string;
  status: number;
  details: { field: string; reason: string }[];
  requestId: string;

  constructor(
    code: string,
    message: string,
    status = 400,
    details: { field: string; reason: string }[] = [],
    requestId = 'req_demo_error',
  ) {
    super(message);
    this.name = 'ServiceError';
    this.code = code;
    this.status = status;
    this.details = details;
    this.requestId = requestId;
  }
}

export const ERROR_CODES = {
  NOT_FOUND: 'RESOURCE_NOT_FOUND',
  FORBIDDEN: 'FORBIDDEN',
  ORDER_VERSION_CONFLICT: 'ORDER_VERSION_CONFLICT',
  ORDER_NOT_EDITABLE: 'ORDER_NOT_EDITABLE',
  ORDER_CONDITION_NOT_MET: 'ORDER_CONDITION_NOT_MET',
  INSUFFICIENT_STOCK: 'INSUFFICIENT_STOCK',
  CREDIT_LIMIT_EXCEEDED: 'CREDIT_LIMIT_EXCEEDED',
  SERIAL_NOT_FOUND: 'SERIAL_NOT_FOUND',
  SERIAL_NOT_OWNED: 'SERIAL_NOT_OWNED',
  WARRANTY_EXPIRED: 'WARRANTY_EXPIRED',
  RMA_ALREADY_OPEN: 'RMA_ALREADY_OPEN',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INTEGRATION_ERROR: 'INTEGRATION_ERROR',
  INTERNAL: 'INTERNAL_ERROR',
  UPSTREAM_UNAVAILABLE: 'UPSTREAM_UNAVAILABLE',
  API_NOT_AVAILABLE: 'API_NOT_AVAILABLE',
} as const;
