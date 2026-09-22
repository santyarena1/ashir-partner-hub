/**
 * Estado mutable del adaptador mock.
 *
 * Los fixtures son inmutables; lo que el usuario modifica durante la demo
 * (pedidos, RMAs, solicitudes, notificaciones) vive aca y se persiste en
 * localStorage para que la presentacion sobreviva a un refresh.
 */
import type {
  CommercialCondition,
  DemoScenario,
  ImportRun,
  Integration,
  IntegrationRun,
  Notification,
  Order,
  RmaCase,
  SerialRecord,
  SpecialPriceRequest,
  WebhookDelivery,
} from '@/types';
import { ALL_ORDERS } from '@/mocks/fixtures/orders';
import { RMA_CASES } from '@/mocks/fixtures/rma';
import { SPECIAL_PRICE_REQUESTS } from '@/mocks/fixtures/commerce';
import { COMMERCIAL_CONDITIONS } from '@/mocks/fixtures/pricing';
import {
  IMPORT_RUNS,
  INTEGRATIONS,
  INTEGRATION_RUNS,
  NOTIFICATIONS,
  WEBHOOK_DELIVERIES,
} from '@/mocks/fixtures/platform';
import { SERIALS } from '@/mocks/fixtures/serials';

const STORAGE_KEY = 'ashir-partner-hub:demo-state:v1';
const SCENARIO_KEY = 'ashir-partner-hub:demo-scenarios:v1';

export interface DemoState {
  orders: Order[];
  rmaCases: RmaCase[];
  specialPriceRequests: SpecialPriceRequest[];
  conditions: CommercialCondition[];
  notifications: Notification[];
  integrations: Integration[];
  integrationRuns: IntegrationRun[];
  webhooks: WebhookDelivery[];
  imports: ImportRun[];
  serials: SerialRecord[];
  /** Puntos canjeados durante la demo, por cliente. */
  redeemedBenefits: Record<string, string[]>;
}

function pristine(): DemoState {
  return {
    orders: structuredClone(ALL_ORDERS),
    rmaCases: structuredClone(RMA_CASES),
    specialPriceRequests: structuredClone(SPECIAL_PRICE_REQUESTS),
    conditions: structuredClone(COMMERCIAL_CONDITIONS),
    notifications: structuredClone(NOTIFICATIONS),
    integrations: structuredClone(INTEGRATIONS),
    integrationRuns: structuredClone(INTEGRATION_RUNS),
    webhooks: structuredClone(WEBHOOK_DELIVERIES),
    imports: structuredClone(IMPORT_RUNS),
    serials: structuredClone(SERIALS),
    redeemedBenefits: {},
  };
}

/* ------------------------------------------------------------------ */
/* persistencia                                                        */
/* ------------------------------------------------------------------ */

function load(): DemoState {
  if (typeof window === 'undefined') return pristine();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return pristine();
    const parsed = JSON.parse(raw) as Partial<DemoState>;
    // Merge defensivo: si el fixture cambio de forma, se completa con lo nuevo.
    return { ...pristine(), ...parsed };
  } catch {
    return pristine();
  }
}

let state: DemoState = load();
const listeners = new Set<() => void>();

function persist() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Cuota llena o modo privado: la demo sigue funcionando en memoria.
  }
}

export function getState(): DemoState {
  return state;
}

export function mutate(fn: (draft: DemoState) => void) {
  fn(state);
  persist();
  listeners.forEach((l) => l());
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Vuelve el prototipo al estado inicial. Usado por el panel de demo. */
export function resetDemoState() {
  state = pristine();
  persist();
  listeners.forEach((l) => l());
}

/* ------------------------------------------------------------------ */
/* escenarios de demo                                                  */
/* ------------------------------------------------------------------ */

function loadScenarios(): Set<DemoScenario> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(SCENARIO_KEY);
    return new Set(raw ? (JSON.parse(raw) as DemoScenario[]) : []);
  } catch {
    return new Set();
  }
}

let scenarios = loadScenarios();
const scenarioListeners = new Set<() => void>();

export function activeScenarios(): Set<DemoScenario> {
  return scenarios;
}

export function isScenarioOn(code: DemoScenario): boolean {
  return scenarios.has(code);
}

export function toggleScenario(code: DemoScenario, on?: boolean) {
  const next = on ?? !scenarios.has(code);
  if (next) scenarios.add(code);
  else scenarios.delete(code);
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(SCENARIO_KEY, JSON.stringify([...scenarios]));
    } catch {
      /* ignorado */
    }
  }
  scenarioListeners.forEach((l) => l());
  listeners.forEach((l) => l());
}

export function clearScenarios() {
  scenarios = new Set();
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(SCENARIO_KEY);
    } catch {
      /* ignorado */
    }
  }
  scenarioListeners.forEach((l) => l());
  listeners.forEach((l) => l());
}

export function subscribeScenarios(listener: () => void): () => void {
  scenarioListeners.add(listener);
  return () => scenarioListeners.delete(listener);
}

/* ------------------------------------------------------------------ */
/* latencia simulada                                                   */
/* ------------------------------------------------------------------ */

const MIN_LATENCY = Number(import.meta.env.VITE_MOCK_LATENCY_MIN ?? 250);
const MAX_LATENCY = Number(import.meta.env.VITE_MOCK_LATENCY_MAX ?? 900);

/** Latencia variable, con un castigo extra si el escenario "API lenta" esta activo. */
export function latency(): Promise<void> {
  const base = MIN_LATENCY + Math.random() * (MAX_LATENCY - MIN_LATENCY);
  const penalty = isScenarioOn('SLOW_API') ? 2_500 : 0;
  return new Promise((resolve) => setTimeout(resolve, base + penalty));
}

/** Latencia corta para operaciones que deben sentirse inmediatas. */
export function fastLatency(): Promise<void> {
  const penalty = isScenarioOn('SLOW_API') ? 1_800 : 0;
  return new Promise((resolve) => setTimeout(resolve, 90 + Math.random() * 120 + penalty));
}
