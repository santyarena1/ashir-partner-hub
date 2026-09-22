/**
 * Adaptador REST para la API futura de Ashir.
 *
 * ESTADO: placeholder. No existe todavia un backend publicado, por lo que
 * este adaptador no esta implementado: unicamente centraliza el fetch y la
 * forma de los requests para que, cuando exista la API, alcance con
 * completar los metodos sin tocar ninguna pantalla.
 *
 * Se activa con VITE_DATA_MODE=api. Si se activa sin API disponible, cada
 * llamada falla con un mensaje claro en lugar de devolver datos inventados.
 */
import type { ApiClient } from '@/services/contracts';
import { ERROR_CODES, ServiceError } from '@/services/contracts';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'https://api.example.ashir.com.ar/v1';

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  /** Requerido por la API en creaciones (pedidos, solicitudes, RMA). */
  idempotencyKey?: string;
  /** Concurrencia optimista en edicion de pedidos. */
  ifMatch?: string;
  signal?: AbortSignal;
}

/**
 * Unico punto de salida HTTP del prototipo.
 *
 * Cuando exista la API real, aca se agregan el token de sesion y el manejo
 * de refresh. Hoy no se envia ninguna credencial porque no hay ninguna.
 */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, idempotencyKey, ifMatch, signal } = options;

  const url = new URL(`${API_BASE_URL}${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-Request-Id': `req_web_${Math.random().toString(36).slice(2, 12)}`,
  };
  if (body) headers['Content-Type'] = 'application/json';
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  if (ifMatch) headers['If-Match'] = ifMatch;

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch {
    throw new ServiceError(
      ERROR_CODES.API_NOT_AVAILABLE,
      `No se pudo alcanzar ${API_BASE_URL}. El modo API está activo pero todavía no existe una API de Ashir publicada. Volvé a VITE_DATA_MODE=mock para usar la demo.`,
      503,
    );
  }

  const payload = (await response.json().catch(() => null)) as
    | { data?: T; error?: { code: string; message: string; details?: { field: string; reason: string }[] }; requestId?: string }
    | null;

  if (!response.ok) {
    throw new ServiceError(
      payload?.error?.code ?? ERROR_CODES.INTERNAL,
      payload?.error?.message ?? `La API respondió ${response.status}.`,
      response.status,
      payload?.error?.details ?? [],
      payload?.requestId ?? 'req_unknown',
    );
  }

  return (payload?.data ?? (payload as unknown)) as T;
}

/* ------------------------------------------------------------------ */

function notImplemented(resource: string): never {
  throw new ServiceError(
    ERROR_CODES.API_NOT_AVAILABLE,
    `El adaptador REST para "${resource}" todavía no está implementado: la API de Ashir no existe aún. ` +
      `La estructura del request está documentada en /docs/openapi.yaml y en el Centro de Desarrolladores.`,
    501,
  );
}

/**
 * Cada metodo declara la llamada HTTP que haria, para que el contrato quede
 * documentado en el codigo, y luego lanza `notImplemented`.
 */
export const httpClient: ApiClient = {
  mode: 'api',
  catalog: {
    listProducts: () => notImplemented('GET /products'),
    getProduct: () => notImplemented('GET /products/{productId}'),
    getAvailability: () => notImplemented('GET /products/{productId}/availability'),
    listBrands: () => notImplemented('GET /brands'),
    listCategories: () => notImplemented('GET /categories'),
    suggestions: () => notImplemented('GET /search/suggestions'),
    previouslyPurchased: () => notImplemented('GET /customers/{customerId}/purchases'),
  },
  pricing: {
    evaluate: () => notImplemented('POST /pricing/evaluate'),
    evaluateMany: () => notImplemented('POST /pricing/evaluate'),
    listPriceLists: () => notImplemented('GET /price-lists'),
    getPriceList: () => notImplemented('GET /price-lists/{priceListId}'),
    listConditions: () => notImplemented('GET /commercial-conditions'),
    getCondition: () => notImplemented('GET /commercial-conditions/{conditionId}'),
    createCondition: () => notImplemented('POST /commercial-conditions'),
    updateCondition: () => notImplemented('PATCH /commercial-conditions/{conditionId}'),
    simulateCondition: () => notImplemented('POST /commercial-conditions/{conditionId}/simulate'),
  },
  customers: {
    list: () => notImplemented('GET /customers'),
    get: () => notImplemented('GET /customers/{customerId}'),
    update: () => notImplemented('PATCH /customers/{customerId}'),
    purchases: () => notImplemented('GET /customers/{customerId}/purchases'),
    addNote: () => notImplemented('PATCH /customers/{customerId}'),
  },
  orders: {
    list: () => notImplemented('GET /orders'),
    get: () => notImplemented('GET /orders/{orderId}'),
    create: () => notImplemented('POST /orders'),
    update: () => notImplemented('PATCH /orders/{orderId}'),
    submit: () => notImplemented('POST /orders/{orderId}/submit'),
    cancel: () => notImplemented('POST /orders/{orderId}/cancel'),
    duplicate: () => notImplemented('POST /orders/{orderId}/duplicate'),
    advanceStatus: () => notImplemented('PATCH /orders/{orderId}'),
    previewChange: () => notImplemented('POST /pricing/evaluate'),
  },
  specialPrice: {
    list: () => notImplemented('GET /special-price-requests'),
    get: () => notImplemented('GET /special-price-requests/{requestId}'),
    create: () => notImplemented('POST /special-price-requests'),
    approve: () => notImplemented('POST /special-price-requests/{requestId}/approve'),
    counteroffer: () => notImplemented('POST /special-price-requests/{requestId}/counteroffer'),
    reject: () => notImplemented('POST /special-price-requests/{requestId}/reject'),
  },
  partner: {
    status: () => notImplemented('GET /partner-program/status'),
    redeem: () => notImplemented('POST /partner-program/benefits/{benefitId}/redeem'),
  },
  rma: {
    lookupSerial: () => notImplemented('POST /rma/serials/lookup'),
    eligibleSerials: () => notImplemented('GET /customers/{customerId}/purchases'),
    listCases: () => notImplemented('GET /rma/cases'),
    getCase: () => notImplemented('GET /rma/cases/{rmaId}'),
    createCase: () => notImplemented('POST /rma/cases'),
    approveReception: () => notImplemented('POST /rma/cases/{rmaId}/approve-reception'),
    receive: () => notImplemented('POST /rma/cases/{rmaId}/receive'),
    registerDiagnosis: () => notImplemented('POST /rma/cases/{rmaId}/diagnosis'),
    resolve: () => notImplemented('POST /rma/cases/{rmaId}/resolution'),
    analytics: () => notImplemented('GET /rma/analytics'),
    listLots: () => notImplemented('GET /rma/lots'),
    getLot: () => notImplemented('GET /rma/lots/{lotId}'),
    listPolicies: () => notImplemented('GET /rma/policies'),
    universalSearch: () => notImplemented('GET /search/suggestions'),
  },
  pm: {
    listBrandsForPm: () => notImplemented('GET /pm/brands'),
    dashboard: () => notImplemented('GET /pm/brands/{brandId}/dashboard'),
    simulate: () => notImplemented('POST /pm/commercial-simulations'),
  },
  integrations: {
    list: () => notImplemented('GET /integrations'),
    get: () => notImplemented('GET /integrations/{integrationId}'),
    runs: () => notImplemented('GET /integrations/{integrationId}/runs'),
    getRun: () => notImplemented('GET /integrations/{integrationId}/runs/{runId}'),
    sync: () => notImplemented('POST /integrations/{integrationId}/sync'),
    testConnection: () => notImplemented('POST /integrations/nodo/test-connection'),
    updateConfiguration: () => notImplemented('PATCH /integrations/nodo/configuration'),
    listWebhooks: () => notImplemented('GET /webhooks/deliveries'),
    resendWebhook: () => notImplemented('POST /webhooks/deliveries/{deliveryId}/resend'),
  },
  imports: {
    history: () => notImplemented('GET /imports'),
    preview: () => notImplemented('POST /imports/products/preview'),
    validate: () => notImplemented('POST /imports/products/validate'),
    commit: () => notImplemented('POST /imports/products/commit'),
  },
  notifications: {
    list: () => notImplemented('GET /notifications'),
    markRead: () => notImplemented('PATCH /notifications/{notificationId}'),
    markAllRead: () => notImplemented('POST /notifications/read-all'),
  },
};
