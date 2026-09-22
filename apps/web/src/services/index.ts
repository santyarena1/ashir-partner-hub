/**
 * Punto de entrada de la capa de datos.
 *
 * La UI solo importa `api` de aca. El adaptador activo depende de
 * VITE_DATA_MODE: `mock` (predeterminado) o `api`.
 */
import type { ApiClient } from '@/services/contracts';
import { mockClient } from '@/services/mock/adapter';
import { httpClient, API_BASE_URL } from '@/services/http/client';
import type { DataMode } from '@/types';

const configured = (import.meta.env.VITE_DATA_MODE ?? 'mock') as DataMode;

export const DATA_MODE: DataMode = configured === 'api' ? 'api' : 'mock';

export const api: ApiClient = DATA_MODE === 'api' ? httpClient : mockClient;

export const API_DOCS_ENABLED = (import.meta.env.VITE_API_DOCS_ENABLED ?? 'true') !== 'false';

export const DATA_SOURCE_INFO = {
  mode: DATA_MODE,
  baseUrl: API_BASE_URL,
  label: DATA_MODE === 'mock' ? 'Modo demostración' : 'Modo API',
  description:
    DATA_MODE === 'mock'
      ? 'Los datos provienen de un adaptador local con el catálogo real importado del Excel de Ashir y el resto de la información simulada.'
      : `El adaptador REST apunta a ${API_BASE_URL}, que todavía no existe. Las pantallas van a mostrar errores hasta que haya una API publicada.`,
} as const;

export { ServiceError, ERROR_CODES } from '@/services/contracts';
export type { ApiClient } from '@/services/contracts';
export {
  activeScenarios,
  clearScenarios,
  isScenarioOn,
  resetDemoState,
  subscribe,
  subscribeScenarios,
  toggleScenario,
} from '@/services/mock/store';
