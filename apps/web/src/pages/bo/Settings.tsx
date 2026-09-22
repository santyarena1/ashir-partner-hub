/**
 * Configuración del portal: usuarios, permisos, datos y panel de
 * escenarios de demostración.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Database,
  KeyRound,
  RotateCcw,
  Settings as SettingsIcon,
  ShieldCheck,
  Users,
} from 'lucide-react';
import type { DemoScenario, Role, Scope } from '@/types';
import { DATA_SOURCE_INFO, DATA_MODE, API_DOCS_ENABLED } from '@/services';
import {
  activeScenarios,
  clearScenarios,
  isScenarioOn,
  resetDemoState,
  toggleScenario,
} from '@/services/mock/store';
import { DEMO_SCENARIOS } from '@/mocks/fixtures/platform';
import { CATALOG_META } from '@/mocks/fixtures/catalog';
import { INTERNAL_USERS } from '@/mocks/fixtures/people';
import { useSession } from '@/app/session';
import { SCOPES_BY_ROLE, can } from '@/lib/rbac';
import { ROLE_LABEL } from '@/lib/labels';
import { useToast, ConfirmDialog } from '@/components/ui/overlays';
import { cn, fmtDateTime, fmtNumber } from '@/lib/utils';
import { Badge, Button, Card, CardHeader, Switch } from '@/components/ui/primitives';
import {
  Callout,
  DataRow,
  ForbiddenState,
  Mono,
  PageHeader,
  SectionTitle,
  StatGrid,
  StatTile,
} from '@/components/ui/data';

const ALL_SCOPES: Scope[] = [
  'catalog:read',
  'pricing:read',
  'pricing:manage',
  'orders:read',
  'orders:write',
  'orders:approve',
  'customers:read',
  'customers:write',
  'rma:read',
  'rma:write',
  'rma:manage',
  'pm:read',
  'pm:manage',
  'partner:read',
  'partner:manage',
  'imports:manage',
  'integrations:read',
  'integrations:manage',
  'cost:read',
  'margin:read',
  'audit:read',
];

const ROLES: Role[] = ['CLIENT', 'SALES', 'PM', 'RMA', 'ADMIN'];

export function BoSettings() {
  const { session } = useSession();
  const toast = useToast();
  const [resetOpen, setResetOpen] = useState(false);
  const [, forceRender] = useState(0);

  if (!can(session, 'integrations:manage')) {
    return (
      <Card>
        <ForbiddenState scope="integrations:manage" />
      </Card>
    );
  }

  const active = [...activeScenarios()];

  return (
    <div>
      <PageHeader
        title="Configuración"
        subtitle="Parámetros del prototipo, matriz de permisos y panel de escenarios para la demostración."
      />

      <StatGrid cols={4} className="mb-6">
        <StatTile
          label="Modo de datos"
          value={DATA_MODE === 'mock' ? 'Demostración' : 'API'}
          icon={<Database className="size-4" />}
          tone={DATA_MODE === 'mock' ? 'warn' : 'ok'}
        />
        <StatTile label="Productos importados" value={fmtNumber(CATALOG_META.productCount)} />
        <StatTile label="Usuarios de demo" value={INTERNAL_USERS.length} icon={<Users className="size-4" />} />
        <StatTile
          label="Escenarios activos"
          value={active.length}
          tone={active.length > 0 ? 'warn' : 'ok'}
          footer={active.length > 0 ? 'El comportamiento del portal está alterado' : 'Comportamiento normal'}
        />
      </StatGrid>

      {/* ---------------- escenarios de demo ---------------- */}
      <section className="mb-8">
        <SectionTitle
          title="Panel de escenarios de demostración"
          subtitle="Forzá errores y situaciones límite para mostrarlas durante la presentación"
          action={
            active.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  clearScenarios();
                  forceRender((n) => n + 1);
                  toast.success('Escenarios desactivados', 'El portal vuelve a su comportamiento normal.');
                }}
              >
                Desactivar todos
              </Button>
            )
          }
        />

        {active.length > 0 && (
          <Callout tone="warn" icon={<AlertTriangle className="size-4" />} className="mb-4" title="Hay escenarios activos">
            {active.map((code) => DEMO_SCENARIOS.find((s) => s.code === code)?.label).join(' · ')}. Acordate de
            desactivarlos antes de mostrar los recorridos normales.
          </Callout>
        )}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {DEMO_SCENARIOS.map((scenario) => (
            <Card key={scenario.code} className={cn('p-4', isScenarioOn(scenario.code) && 'border-warn-300 bg-warn-50/40')}>
              <Switch
                label={scenario.label}
                description={scenario.description}
                checked={isScenarioOn(scenario.code)}
                onChange={(next) => {
                  toggleScenario(scenario.code as DemoScenario, next);
                  forceRender((n) => n + 1);
                  toast.info(
                    next ? `Escenario «${scenario.label}» activado` : `Escenario «${scenario.label}» desactivado`,
                    next ? scenario.affects : undefined,
                  );
                }}
              />
              <p className="mt-2.5 border-t border-ink-100 pt-2 text-[11px] text-ink-400">Afecta: {scenario.affects}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* ---------------- permisos ---------------- */}
      <section className="mb-8">
        <SectionTitle
          title="Matriz de permisos"
          subtitle="Qué puede hacer cada rol. El rol Cliente nunca accede a costos ni márgenes."
        />
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12px]">
              <thead>
                <tr className="border-b border-ink-200 bg-ink-50">
                  <th className="px-4 py-2.5 font-medium whitespace-nowrap text-ink-500">Permiso</th>
                  {ROLES.map((role) => (
                    <th key={role} className="px-3 py-2.5 text-center font-medium whitespace-nowrap text-ink-500">
                      {ROLE_LABEL[role].split(' ')[0]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {ALL_SCOPES.map((scope) => {
                  const sensitive = scope === 'cost:read' || scope === 'margin:read';
                  return (
                    <tr key={scope} className={cn(sensitive && 'bg-bad-50/30')}>
                      <td className="px-4 py-2">
                        <Mono>{scope}</Mono>
                        {sensitive && (
                          <Badge tone="bad" size="sm" className="ml-2">
                            sensible
                          </Badge>
                        )}
                      </td>
                      {ROLES.map((role) => (
                        <td key={role} className="px-3 py-2 text-center">
                          {SCOPES_BY_ROLE[role].includes(scope) ? (
                            <span className="text-ok-600" title="Permitido">
                              ✓
                            </span>
                          ) : (
                            <span className="text-ink-300" title="Denegado">
                              —
                            </span>
                          )}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
        <Callout tone="tech" className="mt-3" icon={<ShieldCheck className="size-4" />}>
          Esta matriz está implementada en <Mono>src/lib/rbac.ts</Mono> y se aplica en el adaptador de datos: el rol
          Cliente recibe los productos con <Mono>cost</Mono> y <Mono>marginPct</Mono> en null, no simplemente ocultos en
          la interfaz.
        </Callout>
      </section>

      {/* ---------------- usuarios ---------------- */}
      <section className="mb-8">
        <SectionTitle title="Usuarios del prototipo" subtitle="Personas ficticias usadas por el selector de roles" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {INTERNAL_USERS.map((user) => (
            <Card key={user.id} className="p-4">
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-full bg-ashir-50 text-xs font-bold text-ashir-700">
                  {user.initials}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-ink-900">{user.name}</p>
                  <p className="truncate text-[11px] text-ink-400">{user.email}</p>
                </div>
              </div>
              <p className="mt-2.5 text-xs text-ink-600">{user.jobTitle}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge tone="neutral" size="sm">
                  {ROLE_LABEL[user.role]}
                </Badge>
                <Badge tone="tech" size="sm">
                  {user.scopes.length} permisos
                </Badge>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* ---------------- fuente de datos ---------------- */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Fuente de datos" icon={<Database className="size-4" />} />
          <div className="space-y-0.5 p-5">
            <DataRow label="Modo" value={<Badge tone={DATA_MODE === 'mock' ? 'warn' : 'ok'}>{DATA_SOURCE_INFO.label}</Badge>} />
            <DataRow label="Base de la API futura" value={<Mono>{DATA_SOURCE_INFO.baseUrl}</Mono>} />
            <DataRow label="Documentación API" value={API_DOCS_ENABLED ? 'Habilitada' : 'Deshabilitada'} />
            <DataRow label="Archivo de catálogo" value={CATALOG_META.source} />
            <DataRow label="Hoja" value={CATALOG_META.sheet} />
            <DataRow label="Importado" value={fmtDateTime(CATALOG_META.importedAt)} />
            <DataRow label="Productos" value={fmtNumber(CATALOG_META.productCount)} emphasis />
          </div>
          <p className="border-t border-ink-100 px-5 py-3 text-xs leading-relaxed text-ink-500">
            {DATA_SOURCE_INFO.description}
          </p>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Variables de entorno" icon={<KeyRound className="size-4" />} />
            <div className="space-y-2 p-5 font-mono text-[12px]">
              {[
                ['VITE_DATA_MODE', DATA_MODE],
                ['VITE_API_BASE_URL', DATA_SOURCE_INFO.baseUrl],
                ['VITE_API_DOCS_ENABLED', String(API_DOCS_ENABLED)],
              ].map(([key, value]) => (
                <div key={key} className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-ink-500">{key}</span>
                  <span className="text-ink-800">{value}</span>
                </div>
              ))}
            </div>
            <p className="border-t border-ink-100 px-5 py-3 text-xs leading-relaxed text-ink-500">
              El prototipo no contiene secretos ni credenciales. Cambiar a <Mono>api</Mono> sin una API publicada hace
              que las pantallas muestren un error explícito en lugar de datos inventados.
            </p>
          </Card>

          <Card className="border-bad-200">
            <CardHeader title="Restablecer la demostración" icon={<RotateCcw className="size-4" />} />
            <div className="p-5">
              <p className="text-[13px] leading-relaxed text-ink-600">
                Borra los pedidos, casos de RMA, solicitudes y notificaciones creados durante la sesión, y vuelve el
                prototipo a su estado inicial. Útil antes de empezar una presentación.
              </p>
              <Button variant="danger" className="mt-3 w-full" onClick={() => setResetOpen(true)}>
                Restablecer datos de demostración
              </Button>
            </div>
          </Card>

          <Link to="/bo/demo" className="block">
            <Button variant="outline" className="w-full" icon={<SettingsIcon className="size-4" />}>
              Ir al recorrido de demostración
            </Button>
          </Link>
        </div>
      </div>

      <ConfirmDialog
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title="Restablecer los datos de demostración"
        description="Se descartan todos los cambios hechos durante la sesión: pedidos creados, casos de RMA, decisiones de precio y notificaciones. El catálogo importado no se toca. La acción no se puede deshacer."
        confirmLabel="Restablecer"
        tone="danger"
        onConfirm={() => {
          resetDemoState();
          clearScenarios();
          setResetOpen(false);
          forceRender((n) => n + 1);
          toast.success('Demostración restablecida', 'El prototipo volvió a su estado inicial.');
        }}
      />
    </div>
  );
}
