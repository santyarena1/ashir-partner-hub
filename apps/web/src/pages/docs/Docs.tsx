/**
 * Centro de Desarrolladores.
 *
 * Documenta la API futura y permite ejecutar un «Try it» contra el adaptador
 * mock local. Nunca llama a una API productiva, porque todavía no existe.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  Menu,
  Play,
  Search,
  ShieldCheck,
  Terminal,
  X,
} from 'lucide-react';
import type { EndpointDoc } from '@/pages/docs/endpoints';
import { CHANGELOG, ENDPOINTS, ERROR_CATALOG, FUTURE_CATALOG, SECTIONS } from '@/pages/docs/endpoints';
import { api, DATA_MODE, DATA_SOURCE_INFO } from '@/services';
import { useSession } from '@/app/session';
import { useAction } from '@/app/hooks';
import { WEBHOOK_EVENT_CATALOG } from '@/mocks/fixtures/platform';
import { HERO_SERIAL } from '@/mocks/fixtures/serials';
import { CATALOG_META } from '@/mocks/fixtures/catalog';
import { cn, normalize } from '@/lib/utils';
import { Badge, Button, Card, Input, Segmented, Select, Skeleton } from '@/components/ui/primitives';
import { Callout, CodeBlock, JsonViewer, Mono, SectionTitle } from '@/components/ui/data';
import { AshirLogo } from '@/components/domain/logo';
import { DemoModeChip } from '@/components/domain/common';

type Lang = 'curl' | 'ts';

export function DocsPage() {
  const { section = 'introduccion' } = useParams();
  const navigate = useNavigate();
  const [term, setTerm] = useState('');
  const [lang, setLang] = useState<Lang>('curl');
  const [navOpen, setNavOpen] = useState(false);

  const current = SECTIONS.find((s) => s.id === section) ?? SECTIONS[0];

  const filteredSections = useMemo(() => {
    if (!term.trim()) return SECTIONS;
    const q = normalize(term);
    return SECTIONS.filter(
      (s) =>
        normalize(s.label).includes(q) ||
        ENDPOINTS.some((e) => e.section === s.id && (normalize(e.path).includes(q) || normalize(e.summary).includes(q))),
    );
  }, [term]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    setNavOpen(false);
  }, [section]);

  return (
    <div className="min-h-dvh bg-ink-50">
      {/* ---------------- header ---------------- */}
      <header className="sticky top-0 z-60 border-b border-ink-800 bg-ink-900">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-3 px-4 sm:px-6">
          <Link to="/" className="shrink-0">
            <AshirLogo className="h-7" />
          </Link>
          <span className="hidden text-[13px] font-medium text-ink-300 sm:block">Centro de Desarrolladores</span>

          <div className="ml-auto flex items-center gap-2">
            <DemoModeChip className="hidden sm:inline-flex" />
            <Link to="/" className="hidden text-[13px] font-medium text-ink-300 transition-colors hover:text-white sm:block">
              Volver al portal
            </Link>
            <Link to="/bo" className="hidden text-[13px] font-medium text-ink-300 transition-colors hover:text-white sm:block">
              Backoffice
            </Link>
            <button
              type="button"
              onClick={() => setNavOpen((v) => !v)}
              className="rounded-lg p-2 text-ink-300 transition-colors hover:bg-ink-800 hover:text-white lg:hidden"
              aria-label="Menú de documentación"
            >
              {navOpen ? <X className="size-4.5" aria-hidden /> : <Menu className="size-4.5" aria-hidden />}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1400px] gap-8 px-4 py-8 sm:px-6">
        {/* ---------------- sidebar ---------------- */}
        <aside
          className={cn(
            'w-56 shrink-0 lg:block',
            navOpen ? 'fixed inset-x-4 top-20 z-70 block max-h-[70vh] overflow-y-auto rounded-xl border border-ink-200 bg-white p-4 shadow-pop' : 'hidden',
          )}
        >
          <div className="lg:sticky lg:top-24">
            <Input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Buscar…"
              leading={<Search className="size-4" />}
              className="mb-3 h-8 text-[13px]"
              aria-label="Buscar en la documentación"
            />
            <nav aria-label="Secciones de la documentación">
              <ul className="space-y-0.5">
                {filteredSections.map((s) => {
                  const count = ENDPOINTS.filter((e) => e.section === s.id).length;
                  return (
                    <li key={s.id}>
                      <Link
                        to={`/docs/${s.id}`}
                        className={cn(
                          'flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-[13px] transition-colors',
                          s.id === current.id
                            ? 'bg-ashir-50 font-semibold text-ashir-700'
                            : 'text-ink-600 hover:bg-ink-100 hover:text-ink-900',
                        )}
                      >
                        {s.label}
                        {count > 0 && <span className="text-[11px] tabular-nums text-ink-400">{count}</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </div>
        </aside>

        {/* ---------------- contenido ---------------- */}
        <main className="min-w-0 flex-1">
          <div className="mb-6">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="mb-3 inline-flex items-center gap-1.5 text-[13px] text-ink-500 transition-colors hover:text-ink-800"
            >
              <ArrowLeft className="size-3.5" aria-hidden />
              Volver
            </button>
            <h1 className="text-2xl font-semibold tracking-tight text-ink-900">{current.label}</h1>
          </div>

          <SectionContent section={current.id} lang={lang} setLang={setLang} />
        </main>
      </div>
    </div>
  );
}

/* ================================================================== */

function SectionContent({ section, lang, setLang }: { section: string; lang: Lang; setLang: (l: Lang) => void }) {
  const endpoints = ENDPOINTS.filter((e) => e.section === section);

  if (section === 'introduccion') return <Introduction />;
  if (section === 'inicio-rapido') return <QuickStart lang={lang} setLang={setLang} />;
  if (section === 'autenticacion') return <Authentication lang={lang} setLang={setLang} />;
  if (section === 'ambientes') return <Environments />;
  if (section === 'convenciones') return <Conventions />;
  if (section === 'webhooks') return <Webhooks />;
  if (section === 'errores') return <Errors />;
  if (section === 'changelog') return <Changelog />;

  return (
    <div className="space-y-8">
      {endpoints.length === 0 ? (
        <Callout tone="neutral">Esta sección todavía no tiene endpoints documentados en detalle.</Callout>
      ) : (
        endpoints.map((endpoint) => (
          <EndpointCard key={endpoint.id} endpoint={endpoint} lang={lang} setLang={setLang} />
        ))
      )}

      <FutureScope section={section} />
    </div>
  );
}

/* ================================================================== */
/* secciones narrativas                                                */
/* ================================================================== */

function Introduction() {
  return (
    <div className="space-y-6">
      <Callout tone="warn" icon={<AlertCircle className="size-4" />} title="La API de Ashir todavía no existe">
        Esta documentación describe el contrato propuesto para el Ashir Partner Hub. Los ejemplos de «Try it» se
        ejecutan contra el adaptador local del prototipo, nunca contra un servicio productivo.
      </Callout>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-ink-900">Qué expone esta API</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-600">
          El Partner Hub necesita hablar con el sistema de gestión de Ashir y, eventualmente, con los sistemas de sus
          resellers. Esta API es el contrato de esa conversación: define cómo se consulta el catálogo, cómo se calcula
          un precio, cómo se crea y modifica un pedido, cómo se gestiona una garantía y cómo se sincroniza todo con el
          ERP.
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {[
            ['Catálogo y disponibilidad', `${CATALOG_META.productCount} SKUs con precio de distribuidor, IVA y estado de stock.`],
            ['Pricing explicable', 'El precio se devuelve con cada ajuste identificado, no como un número suelto.'],
            ['Pedidos con concurrencia', 'Creación idempotente y edición con control de versión.'],
            ['RMA 360', 'Lookup por serial validado contra la cuenta, casos, diagnóstico y resolución.'],
            ['Product Management', 'Métricas por marca: ventas, margen, stock aging y calidad.'],
            ['Sincronización', 'Estado, ejecuciones y disparo manual de cada conector.'],
          ].map(([title, detail]) => (
            <div key={title} className="rounded-lg border border-ink-200 p-3.5">
              <p className="text-[13px] font-semibold text-ink-900">{title}</p>
              <p className="mt-1 text-xs leading-relaxed text-ink-500">{detail}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-ink-900">Principios de diseño</h2>
        <ul className="mt-3 space-y-2.5 text-[13px] leading-relaxed text-ink-600">
          {[
            ['Versionado explícito', 'Todos los recursos viven bajo /api/v1. Los cambios incompatibles van a una versión nueva.'],
            ['Identificadores opacos', 'Los ids son strings sin semántica: no se deben parsear ni derivar.'],
            ['Importes sin ambigüedad', 'Todo monto es { amount: string, currency } para evitar errores de redondeo de floats.'],
            ['Fechas ISO 8601 con zona', 'Siempre con offset explícito, nunca fechas locales sin contexto.'],
            ['Idempotencia en creaciones', 'Pedidos, solicitudes y casos de RMA exigen Idempotency-Key.'],
            ['Concurrencia optimista', 'La edición de pedidos usa version o If-Match y responde 409 ante conflicto.'],
            ['Trazabilidad', 'Cada respuesta incluye requestId, y toda acción queda auditada con actor, rol y origen.'],
            ['Mínimo privilegio', 'Los scopes del token determinan qué campos se devuelven: costo y margen nunca viajan a un token de reseller.'],
          ].map(([title, detail]) => (
            <li key={title} className="flex gap-3">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-ashir-500" aria-hidden />
              <span>
                <strong className="text-ink-900">{title}:</strong> {detail}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-ink-900">Alcance de esta documentación</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-600">
          Hay {ENDPOINTS.filter((e) => !e.future).length} endpoints documentados en detalle, con parámetros, ejemplos
          de request y response, errores posibles y ejecución contra el mock. El resto del inventario aparece listado
          como alcance futuro en cada sección: está previsto en el contrato, pero no especificado línea por línea.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge tone="ok">{ENDPOINTS.filter((e) => e.tryIt).length} endpoints ejecutables</Badge>
          <Badge tone="tech">{ENDPOINTS.length} documentados</Badge>
          <Badge tone="neutral">
            {FUTURE_CATALOG.reduce((a, s) => a + s.entries.length, 0)} en inventario futuro
          </Badge>
          <Badge tone="brand">{WEBHOOK_EVENT_CATALOG.length} eventos de webhook</Badge>
        </div>
      </Card>
    </div>
  );
}

function QuickStart({ lang, setLang }: { lang: Lang; setLang: (l: Lang) => void }) {
  return (
    <div className="space-y-6">
      <Callout tone="tech" title="Tres pasos para la primera integración">
        Obtener un token, consultar el catálogo y evaluar un precio. Con eso ya se puede armar un pedido.
      </Callout>

      <LangSwitch lang={lang} setLang={setLang} />

      <Card className="p-6">
        <h2 className="text-[15px] font-semibold text-ink-900">1. Obtener un token</h2>
        <p className="mt-1.5 mb-3 text-[13px] text-ink-600">
          Con las credenciales de servidor a servidor que entregaría Ashir al habilitar la integración.
        </p>
        <CodeBlock
          title={lang === 'curl' ? 'cURL' : 'TypeScript'}
          code={
            lang === 'curl'
              ? `curl -X POST "https://api.example.ashir.com.ar/oauth/token" \\
  -H "Content-Type: application/json" \\
  -d '{
    "grant_type": "client_credentials",
    "client_id": "$ASHIR_CLIENT_ID",
    "client_secret": "$ASHIR_CLIENT_SECRET",
    "scope": "catalog:read pricing:read orders:write"
  }'`
              : `const res = await fetch('https://api.example.ashir.com.ar/oauth/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    grant_type: 'client_credentials',
    client_id: process.env.ASHIR_CLIENT_ID,
    client_secret: process.env.ASHIR_CLIENT_SECRET,
    scope: 'catalog:read pricing:read orders:write',
  }),
});

const { access_token, expires_in } = await res.json();`
          }
        />
      </Card>

      <Card className="p-6">
        <h2 className="text-[15px] font-semibold text-ink-900">2. Consultar el catálogo</h2>
        <p className="mt-1.5 mb-3 text-[13px] text-ink-600">
          Los precios ya vienen ajustados a la lista del cliente asociado al token.
        </p>
        <CodeBlock
          title={lang === 'curl' ? 'cURL' : 'TypeScript'}
          code={
            lang === 'curl'
              ? `curl "https://api.example.ashir.com.ar/v1/products?brandId=brand_msi&inStock=true&pageSize=25" \\
  -H "Authorization: Bearer $ASHIR_TOKEN" \\
  -H "X-Request-Id: req_$(uuidgen)"`
              : `const products = await ashir.get('/products', {
  brandId: 'brand_msi',
  inStock: true,
  pageSize: 25,
});

// products.data[0].listPrice → { amount: '1195.48', currency: 'USD' }`
          }
        />
      </Card>

      <Card className="p-6">
        <h2 className="text-[15px] font-semibold text-ink-900">3. Evaluar un precio antes de comprar</h2>
        <p className="mt-1.5 mb-3 text-[13px] text-ink-600">
          Devuelve el desglose completo: qué descuentos aplican y cuáles no, con su motivo.
        </p>
        <CodeBlock
          title={lang === 'curl' ? 'cURL' : 'TypeScript'}
          code={
            lang === 'curl'
              ? `curl -X POST "https://api.example.ashir.com.ar/v1/pricing/evaluate" \\
  -H "Authorization: Bearer $ASHIR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{ "productId": "prod_msmoprb650mb", "quantity": 10 }'`
              : `const price = await ashir.post('/pricing/evaluate', {
  productId: 'prod_msmoprb650mb',
  quantity: 10,
});

for (const adj of price.data.adjustments) {
  console.log(adj.label, adj.percentage ?? adj.amount);
}
// LP-PLATINUM-02 · MSI  -5.00
// MSI Septiembre        -3.00
// Volumen general…      -4.00`
          }
        />
      </Card>

      <Card className="p-6">
        <h2 className="text-[15px] font-semibold text-ink-900">4. Crear el pedido</h2>
        <p className="mt-1.5 mb-3 text-[13px] text-ink-600">
          Con <Mono>Idempotency-Key</Mono>: si el request se reenvía por un timeout, no se duplica el pedido.
        </p>
        <CodeBlock
          title={lang === 'curl' ? 'cURL' : 'TypeScript'}
          code={
            lang === 'curl'
              ? `curl -X POST "https://api.example.ashir.com.ar/v1/orders" \\
  -H "Authorization: Bearer $ASHIR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: 9f1c2b04-5f3a-4a6f-9c1e-0b2d7e8a1234" \\
  -d '{
    "customerId": "cus_gaming_store",
    "items": [{ "productId": "prod_msmoprb650mb", "quantity": 10 }],
    "customerPO": "OC-2291"
  }'`
              : `import { randomUUID } from 'node:crypto';

const order = await ashir.post(
  '/orders',
  {
    customerId: 'cus_gaming_store',
    items: [{ productId: 'prod_msmoprb650mb', quantity: 10 }],
    customerPO: 'OC-2291',
  },
  { idempotencyKey: randomUUID() },
);`
          }
        />
      </Card>
    </div>
  );
}

function Authentication({ lang, setLang }: { lang: Lang; setLang: (l: Lang) => void }) {
  return (
    <div className="space-y-6">
      <Callout tone="warn" icon={<ShieldCheck className="size-4" />} title="Arquitectura propuesta, no implementada">
        El prototipo no tiene autenticación: el selector de roles es una herramienta de demostración. Lo que sigue es el
        esquema previsto para producción.
      </Callout>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-ink-900">Dos tipos de credencial</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-ink-200 p-4">
            <h3 className="text-[13px] font-semibold text-ink-900">Usuarios humanos</h3>
            <p className="mt-1.5 text-[13px] leading-relaxed text-ink-600">
              OAuth2 / OIDC, o un JWT emitido por el backend de Ashir tras el login. El token lleva el id del usuario,
              su rol y, para resellers, la cuenta a la que pertenece.
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Badge tone="tech" size="sm">Authorization Code + PKCE</Badge>
              <Badge tone="tech" size="sm">Refresh token rotativo</Badge>
            </div>
          </div>
          <div className="rounded-lg border border-ink-200 p-4">
            <h3 className="text-[13px] font-semibold text-ink-900">Integración servidor a servidor</h3>
            <p className="mt-1.5 text-[13px] leading-relaxed text-ink-600">
              OAuth2 Client Credentials. Cada integración tiene su propio par de credenciales, sus scopes y su cuenta
              asociada, para poder revocarla sin afectar a las demás.
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Badge tone="tech" size="sm">Client Credentials</Badge>
              <Badge tone="tech" size="sm">Rotación programada</Badge>
            </div>
          </div>
        </div>

        <Callout tone="bad" className="mt-4" title="Nunca en la query string">
          Las credenciales viajan siempre en el header <Mono>Authorization</Mono>. Una API key en la URL termina en
          logs, en el historial del navegador y en los referers.
        </Callout>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-ink-900">Scopes</h2>
        <p className="mt-2 text-[13px] text-ink-600">
          Se solicitan al crear la credencial y determinan tanto las operaciones permitidas como los campos devueltos.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-ink-200 bg-ink-50">
                <th className="px-3 py-2 font-medium text-ink-500">Scope</th>
                <th className="px-3 py-2 font-medium text-ink-500">Permite</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {[
                ['catalog:read', 'Consultar productos, marcas, categorías y disponibilidad.'],
                ['pricing:read', 'Evaluar precios y consultar listas.'],
                ['orders:read', 'Consultar pedidos de la cuenta del token.'],
                ['orders:write', 'Crear y modificar pedidos.'],
                ['customers:read', 'Consultar clientes. Solo tokens internos.'],
                ['customers:write', 'Actualizar datos comerciales de clientes.'],
                ['rma:read', 'Consultar seriales y casos de garantía de la cuenta.'],
                ['rma:write', 'Crear casos de garantía.'],
                ['rma:manage', 'Operar casos: recepción, diagnóstico y resolución.'],
                ['pm:read', 'Métricas de Product Management por marca.'],
                ['integrations:read', 'Estado y ejecuciones de los conectores.'],
                ['integrations:manage', 'Configurar y disparar sincronizaciones.'],
              ].map(([scope, allows]) => (
                <tr key={scope}>
                  <td className="px-3 py-2">
                    <Mono>{scope}</Mono>
                  </td>
                  <td className="px-3 py-2 text-ink-600">{allows}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Callout tone="tech" className="mt-4">
          No existen los scopes <Mono>cost:read</Mono> ni <Mono>margin:read</Mono> para credenciales de reseller: el
          costo y el margen de Ashir nunca salen hacia una integración de cliente.
        </Callout>
      </Card>

      <Card className="p-6">
        <LangSwitch lang={lang} setLang={setLang} className="mb-3" />
        <CodeBlock
          title={lang === 'curl' ? 'Renovar el token' : 'Cliente con renovación automática'}
          code={
            lang === 'curl'
              ? `# El token expira en 3600 s. Renovarlo antes de que venza.
curl -X POST "https://api.example.ashir.com.ar/oauth/token" \\
  -H "Content-Type: application/json" \\
  -d '{
    "grant_type": "client_credentials",
    "client_id": "$ASHIR_CLIENT_ID",
    "client_secret": "$ASHIR_CLIENT_SECRET"
  }'`
              : `let cached: { token: string; expiresAt: number } | null = null;

async function getToken() {
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;

  const res = await fetch(\`\${BASE}/oauth/token\`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: process.env.ASHIR_CLIENT_ID,
      client_secret: process.env.ASHIR_CLIENT_SECRET,
    }),
  });

  const { access_token, expires_in } = await res.json();
  cached = { token: access_token, expiresAt: Date.now() + expires_in * 1000 };
  return access_token;
}`
          }
        />
      </Card>
    </div>
  );
}

function Environments() {
  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-ink-900">Ambientes previstos</h2>
        <div className="mt-4 space-y-3">
          {[
            {
              name: 'Sandbox',
              url: 'https://sandbox.api.ashir.com.ar/v1',
              detail: 'Datos ficticios, sin efectos reales. Para desarrollar y probar la integración.',
              tone: 'tech' as const,
            },
            {
              name: 'Producción',
              url: 'https://api.ashir.com.ar/v1',
              detail: 'Datos reales. Credenciales distintas de las de sandbox y con rate limits más estrictos.',
              tone: 'ok' as const,
            },
            {
              name: 'Prototipo (actual)',
              url: DATA_SOURCE_INFO.baseUrl,
              detail: `Este prototipo corre en modo ${DATA_MODE}. Las respuestas salen del adaptador local, no de un servidor.`,
              tone: 'warn' as const,
            },
          ].map((env) => (
            <div key={env.name} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-ink-200 p-4">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-[13px] font-semibold text-ink-900">
                  {env.name}
                  <Badge tone={env.tone} size="sm">
                    {env.tone === 'warn' ? 'Actual' : env.tone === 'ok' ? 'Futuro' : 'Futuro'}
                  </Badge>
                </p>
                <p className="mt-1 text-[13px] text-ink-600">{env.detail}</p>
              </div>
              <Mono copy className="shrink-0">
                {env.url}
              </Mono>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-ink-900">Rate limits documentados como futuros</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-ink-200 bg-ink-50">
                <th className="px-3 py-2 font-medium text-ink-500">Operación</th>
                <th className="px-3 py-2 text-right font-medium text-ink-500">Sandbox</th>
                <th className="px-3 py-2 text-right font-medium text-ink-500">Producción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {[
                ['Lecturas de catálogo', '60 / min', '600 / min'],
                ['Evaluación de precios', '30 / min', '300 / min'],
                ['Escrituras (pedidos, RMA)', '10 / min', '60 / min'],
                ['Sincronizaciones manuales', '2 / hora', '12 / hora'],
              ].map(([op, sandbox, prod]) => (
                <tr key={op}>
                  <td className="px-3 py-2 text-ink-800">{op}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-ink-600">{sandbox}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-ink-600">{prod}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[13px] text-ink-500">
          Al superar el límite la API responde <Mono>429 RATE_LIMITED</Mono> con el header <Mono>Retry-After</Mono>.
        </p>
      </Card>
    </div>
  );
}

function Conventions() {
  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-ink-900">Respuesta de colección</h2>
        <p className="mt-1.5 mb-3 text-[13px] text-ink-600">Todas las colecciones usan la misma forma.</p>
        <CodeBlock
          title="200 OK"
          code={`{
  "data": [],
  "meta": {
    "page": 1,
    "pageSize": 25,
    "total": 0,
    "totalPages": 0
  },
  "requestId": "req_demo_123"
}`}
        />
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-ink-900">Respuesta de error</h2>
        <p className="mt-1.5 mb-3 text-[13px] text-ink-600">
          El <Mono>code</Mono> es estable y se puede usar para lógica; el <Mono>message</Mono> es para humanos y puede
          cambiar.
        </p>
        <CodeBlock
          title="400 Bad Request"
          code={`{
  "error": {
    "code": "ORDER_CONDITION_NOT_MET",
    "message": "El pedido ya no cumple la condición comercial.",
    "details": [
      {
        "field": "items[2].quantity",
        "reason": "MINIMUM_QUANTITY_NOT_MET"
      }
    ]
  },
  "requestId": "req_demo_456"
}`}
        />
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-ink-900">Reglas del contrato</h2>
        <div className="mt-3 space-y-3">
          {[
            ['Versionado', 'Todos los recursos bajo /api/v1. Los cambios incompatibles van a /v2.'],
            ['IDs opacos', 'Strings sin estructura garantizada. No parsear ni derivar información de ellos.'],
            ['Fechas', 'ISO 8601 con offset: 2026-09-22T11:00:00-03:00. Nunca fechas locales sin zona.'],
            ['Importes', '{ "amount": "451.58", "currency": "USD" }. String para evitar errores de coma flotante.'],
            ['Porcentajes', 'String con dos decimales y signo: "-4.00" para un descuento del 4%.'],
            ['Paginación', 'page (base 1) y pageSize (máximo 100), con meta.total y meta.totalPages.'],
            ['Ordenamiento', 'Parámetro sort con valores documentados por recurso.'],
            ['Idempotency-Key', 'Obligatorio en POST de pedidos, solicitudes de precio y casos de RMA.'],
            ['X-Request-Id', 'Lo puede enviar el cliente; si no, lo genera el servidor. Siempre vuelve en la respuesta.'],
            ['Concurrencia', 'version en el cuerpo o If-Match en el header para editar pedidos.'],
            ['Auditoría', 'Los recursos editables exponen su audit-log con actor, rol, origen y request id.'],
            ['Campos sensibles', 'Costo, margen y datos de terceros se omiten según los scopes del token.'],
          ].map(([title, detail]) => (
            <div key={title} className="flex gap-3">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-ashir-500" aria-hidden />
              <p className="text-[13px] leading-relaxed text-ink-600">
                <strong className="text-ink-900">{title}:</strong> {detail}
              </p>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-ink-900">Headers</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-ink-200 bg-ink-50">
                <th className="px-3 py-2 font-medium text-ink-500">Header</th>
                <th className="px-3 py-2 font-medium text-ink-500">Dirección</th>
                <th className="px-3 py-2 font-medium text-ink-500">Uso</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {[
                ['Authorization', 'Request', 'Bearer <token>. Obligatorio en todos los recursos.'],
                ['Idempotency-Key', 'Request', 'UUID generado por el cliente en operaciones de creación.'],
                ['If-Match', 'Request', 'Versión del recurso en operaciones de edición.'],
                ['X-Request-Id', 'Ambas', 'Trazabilidad punta a punta.'],
                ['Retry-After', 'Response', 'Segundos a esperar tras un 429.'],
                ['X-Ashir-Signature', 'Webhook', 'HMAC SHA-256 del cuerpo de la notificación.'],
              ].map(([header, dir, use]) => (
                <tr key={header}>
                  <td className="px-3 py-2">
                    <Mono>{header}</Mono>
                  </td>
                  <td className="px-3 py-2 text-xs text-ink-500">{dir}</td>
                  <td className="px-3 py-2 text-ink-600">{use}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Webhooks() {
  return (
    <div className="space-y-6">
      <Callout tone="warn" title="Documentado como arquitectura propuesta">
        El prototipo genera entregas simuladas visibles en{' '}
        <Link to="/bo/webhooks" className="font-semibold underline underline-offset-2">
          el panel de webhooks
        </Link>
        , pero no envía nada a ningún endpoint externo.
      </Callout>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-ink-900">Forma del evento</h2>
        <CodeBlock
          className="mt-3"
          title="POST al endpoint del suscriptor"
          code={`{
  "eventId": "evt_1042",
  "type": "rma.status_changed",
  "occurredAt": "2026-09-22T11:04:12-03:00",
  "apiVersion": "2026-09-01",
  "data": {
    "rmaId": "rma_rma_260194",
    "code": "RMA-260194",
    "previousStatus": "RECEIVED",
    "status": "DIAGNOSIS"
  }
}`}
        />
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-ink-900">Eventos disponibles</h2>
        <ul className="mt-3 divide-y divide-ink-100">
          {WEBHOOK_EVENT_CATALOG.map((event) => (
            <li key={event.type} className="flex flex-wrap items-start justify-between gap-3 py-2.5">
              <Mono copy>{event.type}</Mono>
              <span className="min-w-[240px] flex-1 text-[13px] text-ink-600">{event.description}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-ink-900">Entrega y seguridad</h2>
        <ul className="mt-3 space-y-2.5 text-[13px] leading-relaxed text-ink-600">
          {[
            ['Firma HMAC', 'Header X-Ashir-Signature con HMAC SHA-256 de `timestamp.body` usando el secreto del endpoint.'],
            ['Timestamp', 'Header X-Ashir-Timestamp. Descartar entregas de más de 5 minutos para evitar replay.'],
            ['Reintentos', 'Hasta 5 intentos con backoff exponencial ante 5xx o timeout.'],
            ['Idempotencia del receptor', 'eventId estable entre reintentos: el receptor descarta duplicados.'],
            ['Respuesta esperada', 'Cualquier 2xx dentro de 10 segundos. El procesamiento pesado va en una cola propia.'],
            ['Dead letter', 'Tras agotar reintentos la entrega queda para revisión y reenvío manual.'],
          ].map(([title, detail]) => (
            <li key={title} className="flex gap-3">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-ashir-500" aria-hidden />
              <span>
                <strong className="text-ink-900">{title}:</strong> {detail}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function Errors() {
  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-ink-900">Catálogo de errores</h2>
        <p className="mt-1.5 text-[13px] text-ink-600">
          El <Mono>code</Mono> es estable entre versiones: úsenlo para la lógica de la integración en lugar del texto.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-ink-200 bg-ink-50">
                <th className="px-3 py-2 font-medium text-ink-500">Código</th>
                <th className="px-3 py-2 text-right font-medium text-ink-500">HTTP</th>
                <th className="px-3 py-2 font-medium text-ink-500">Cuándo ocurre</th>
                <th className="px-3 py-2 font-medium text-ink-500">Qué hacer</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {ERROR_CATALOG.map((error) => (
                <tr key={error.code}>
                  <td className="px-3 py-2.5">
                    <Mono>{error.code}</Mono>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <Badge tone={error.status >= 500 ? 'bad' : error.status >= 400 ? 'warn' : 'ok'} size="sm">
                      {error.status}
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5 text-ink-600">{error.description}</td>
                  <td className="px-3 py-2.5 text-ink-500">{error.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-ink-900">Manejo recomendado</h2>
        <CodeBlock
          className="mt-3"
          title="TypeScript"
          code={`async function createOrder(payload, attempt = 0) {
  try {
    return await ashir.post('/orders', payload, {
      idempotencyKey: payload.idempotencyKey,
    });
  } catch (error) {
    switch (error.code) {
      case 'ORDER_VERSION_CONFLICT':
        // El pedido cambió: releer, resolver y reintentar con la nueva versión.
        return reconcileAndRetry(payload);

      case 'INSUFFICIENT_STOCK':
        // Ofrecer un reemplazo en lugar de fallar el pedido completo.
        return suggestReplacement(error.details);

      case 'RATE_LIMITED':
      case 'UPSTREAM_UNAVAILABLE':
        if (attempt >= 4) throw error;
        await sleep(2 ** attempt * 1000);
        // El mismo Idempotency-Key evita duplicar el pedido.
        return createOrder(payload, attempt + 1);

      default:
        // Reportar el requestId al soporte de Ashir.
        throw error;
    }
  }
}`}
        />
      </Card>
    </div>
  );
}

function Changelog() {
  return (
    <div className="space-y-4">
      {CHANGELOG.map((entry) => (
        <Card key={entry.version} className="p-6">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[15px] font-semibold text-ink-900">{entry.version}</h2>
            {entry.current && <Badge tone="ok">Versión actual</Badge>}
          </div>
          <ul className="mt-3 space-y-2">
            {entry.changes.map((change) => (
              <li key={change} className="flex gap-2.5 text-[13px] leading-relaxed text-ink-600">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-ashir-500" aria-hidden />
                {change}
              </li>
            ))}
          </ul>
        </Card>
      ))}

      <Callout tone="tech">
        El header <Mono>apiVersion</Mono> de los webhooks y el prefijo <Mono>/v1</Mono> de los recursos permiten
        evolucionar el contrato sin romper integraciones existentes.
      </Callout>
    </div>
  );
}

/* ================================================================== */
/* endpoint                                                            */
/* ================================================================== */

function EndpointCard({ endpoint, lang, setLang }: { endpoint: EndpointDoc; lang: Lang; setLang: (l: Lang) => void }) {
  const { session } = useSession();
  const [tryOpen, setTryOpen] = useState(false);
  const [paramValues, setParamValues] = useState<Record<string, string>>(
    Object.fromEntries(endpoint.params.filter((p) => p.example).map((p) => [p.name, p.example!])),
  );
  const [result, setResult] = useState<unknown>(null);

  const execute = useAction(async () => {
    const v = (name: string) => paramValues[name] ?? '';
    switch (endpoint.tryIt) {
      case 'products':
        return api.catalog.listProducts(
          {
            query: v('query') || undefined,
            brandId: v('brandId') || undefined,
            categoryId: v('categoryId') || undefined,
            inStock: v('inStock') === 'true' || undefined,
            pageSize: Number(v('pageSize') || 5),
            page: Number(v('page') || 1),
          },
          session,
        );
      case 'product':
        return api.catalog.getProduct(v('productId') || 'MSVG5070TV3O', session);
      case 'pricing':
        return api.pricing.evaluate(v('productId') || 'MSMOPRB650MB', Number(v('quantity') || 10), session);
      case 'orders':
        return api.orders.list({ status: (v('status') as never) || undefined }, session).then((r) => r.slice(0, 5));
      case 'order': {
        const list = await api.orders.list({}, session);
        const order = list[0];
        return order ? { orderId: order.id, number: order.number, auditLog: order.auditLog } : null;
      }
      case 'serial':
        return api.rma.lookupSerial(v('serial') || HERO_SERIAL, session);
      case 'rmaCases':
        return api.rma.listCases({}, session).then((r) => r.slice(0, 3));
      case 'rmaCase': {
        const cases = await api.rma.listCases({}, session);
        const found = cases.find((c) => c.code === v('rmaId')) ?? cases[0];
        return found ? { rmaId: found.id, code: found.code, timeline: found.timeline } : null;
      }
      case 'pmDashboard':
        return api.pm.dashboard(v('brandId') || 'brand_msi', session);
      case 'integrations':
        return api.integrations.list();
      case 'integrationRuns':
        return api.integrations.runs(v('integrationId') || 'int_nodo');
      default:
        return null;
    }
  });

  const methodTone = endpoint.method === 'GET' ? 'tech' : endpoint.method === 'POST' ? 'ok' : endpoint.method === 'PATCH' ? 'warn' : 'bad';

  const curlSnippet = `curl ${endpoint.method !== 'GET' ? `-X ${endpoint.method} ` : ''}"https://api.example.ashir.com.ar/v1${endpoint.path}${
    endpoint.params.some((p) => p.in === 'query' && paramValues[p.name])
      ? `?${endpoint.params
          .filter((p) => p.in === 'query' && paramValues[p.name])
          .map((p) => `${p.name}=${paramValues[p.name]}`)
          .join('&')}`
      : ''
  }" \\
  -H "Authorization: Bearer $ASHIR_TOKEN" \\
  -H "X-Request-Id: req_$(uuidgen)"${
    endpoint.requestBody
      ? ` \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(endpoint.requestBody, null, 2).split('\n').join('\n  ')}'`
      : ''
  }`;

  const tsSnippet = `const response = await ashir.${endpoint.method.toLowerCase()}(
  '${endpoint.path}'${
    endpoint.requestBody
      ? `,
  ${JSON.stringify(endpoint.requestBody, null, 2).split('\n').join('\n  ')}`
      : endpoint.params.some((p) => p.in === 'query')
        ? `,
  { ${endpoint.params
    .filter((p) => p.in === 'query' && paramValues[p.name])
    .map((p) => `${p.name}: ${Number.isNaN(Number(paramValues[p.name])) ? `'${paramValues[p.name]}'` : paramValues[p.name]}`)
    .join(', ')} }`
        : ''
  },
);

console.log(response.data);`;

  return (
    <Card className="overflow-hidden" id={endpoint.id}>
      {/* --- encabezado --- */}
      <div className="border-b border-ink-100 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={methodTone} className="w-16 justify-center font-mono">
            {endpoint.method}
          </Badge>
          <code className="font-mono text-[14px] font-semibold text-ink-900">{endpoint.path}</code>
          {endpoint.future && <Badge tone="neutral">Alcance futuro</Badge>}
          {endpoint.tryIt && <Badge tone="brand">Ejecutable</Badge>}
        </div>
        <h2 className="mt-2.5 text-[15px] font-semibold text-ink-900">{endpoint.summary}</h2>
        <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-ink-600">{endpoint.description}</p>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-semibold tracking-wide text-ink-400 uppercase">Permisos</span>
          {endpoint.scopes.map((scope) => (
            <Mono key={scope}>{scope}</Mono>
          ))}
        </div>
      </div>

      {/* --- parámetros --- */}
      {endpoint.params.length > 0 && (
        <div className="border-b border-ink-100 p-5">
          <h3 className="mb-3 text-[13px] font-semibold text-ink-900">Parámetros</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12px]">
              <thead>
                <tr className="border-b border-ink-200 bg-ink-50">
                  <th className="px-3 py-2 font-medium text-ink-500">Nombre</th>
                  <th className="px-3 py-2 font-medium text-ink-500">En</th>
                  <th className="px-3 py-2 font-medium text-ink-500">Tipo</th>
                  <th className="px-3 py-2 font-medium text-ink-500">Descripción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {endpoint.params.map((param) => (
                  <tr key={param.name + param.in}>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <Mono>{param.name}</Mono>
                      {param.required && (
                        <span className="ml-1 text-bad-600" title="Obligatorio">
                          *
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-ink-500">{param.in}</td>
                    <td className="px-3 py-2 font-mono text-ink-500">{param.type}</td>
                    <td className="px-3 py-2 text-ink-600">{param.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- ejemplos --- */}
      <div className="border-b border-ink-100 p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-[13px] font-semibold text-ink-900">Ejemplo de request</h3>
          <LangSwitch lang={lang} setLang={setLang} />
        </div>
        <CodeBlock title={lang === 'curl' ? 'cURL' : 'TypeScript'} code={lang === 'curl' ? curlSnippet : tsSnippet} maxHeight="320px" />
      </div>

      <div className="border-b border-ink-100 p-5">
        <h3 className="mb-3 text-[13px] font-semibold text-ink-900">Ejemplo de response</h3>
        <JsonViewer value={endpoint.responseExample} maxHeight="320px" />
      </div>

      {/* --- errores --- */}
      <div className="border-b border-ink-100 p-5">
        <h3 className="mb-3 text-[13px] font-semibold text-ink-900">Errores posibles</h3>
        <ul className="space-y-1.5">
          {endpoint.errors.map((error) => (
            <li key={error.code} className="flex flex-wrap items-baseline gap-2 text-[13px]">
              <Badge tone={error.status >= 500 ? 'bad' : 'warn'} size="sm">
                {error.status}
              </Badge>
              <Mono>{error.code}</Mono>
              <span className="text-ink-600">{error.description}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* --- try it --- */}
      <div className="bg-ink-50 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 text-[13px] font-semibold text-ink-900">
              <Terminal className="size-4 text-ink-400" aria-hidden />
              Probar el endpoint
            </h3>
            <p className="mt-0.5 text-xs text-ink-500">
              {endpoint.tryIt
                ? 'Se ejecuta contra el adaptador local del prototipo. Ningún request sale a internet.'
                : 'Este endpoint está documentado como alcance futuro y no es ejecutable en la demo.'}
            </p>
          </div>
          {endpoint.tryIt && (
            <div className="flex items-center gap-2">
              <Segmented
                size="sm"
                value={'mock'}
                onChange={() => undefined}
                options={[
                  { value: 'mock', label: 'Mock local' },
                  { value: 'prod', label: 'Producción futura', title: 'No disponible: la API todavía no existe' },
                ]}
              />
              <Button
                size="sm"
                icon={<Play className="size-3.5" />}
                loading={execute.pending}
                onClick={async () => {
                  setTryOpen(true);
                  const output = await execute.run();
                  setResult(output ?? { error: execute.error?.message ?? 'Sin resultado' });
                }}
              >
                Ejecutar
              </Button>
            </div>
          )}
        </div>

        {endpoint.tryIt && endpoint.params.filter((p) => p.in !== 'header').length > 0 && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {endpoint.params
              .filter((p) => p.in !== 'header')
              .slice(0, 6)
              .map((param) => (
                <div key={param.name}>
                  <label htmlFor={`${endpoint.id}-${param.name}`} className="mb-1 block text-[11px] font-medium text-ink-600">
                    {param.name}
                    {param.required && <span className="text-bad-600">*</span>}
                  </label>
                  {param.type === 'boolean' ? (
                    <Select
                      id={`${endpoint.id}-${param.name}`}
                      value={paramValues[param.name] ?? ''}
                      onChange={(e) => setParamValues((prev) => ({ ...prev, [param.name]: e.target.value }))}
                      className="h-8 text-[13px]"
                    >
                      <option value="">—</option>
                      <option value="true">true</option>
                      <option value="false">false</option>
                    </Select>
                  ) : (
                    <Input
                      id={`${endpoint.id}-${param.name}`}
                      value={paramValues[param.name] ?? ''}
                      onChange={(e) => setParamValues((prev) => ({ ...prev, [param.name]: e.target.value }))}
                      placeholder={param.example ?? param.type}
                      className="h-8 font-mono text-[12px]"
                    />
                  )}
                </div>
              ))}
          </div>
        )}

        {tryOpen && (
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-[13px] font-semibold text-ink-900">Respuesta del mock</p>
              <button
                type="button"
                onClick={() => {
                  setTryOpen(false);
                  setResult(null);
                }}
                className="text-xs text-ink-500 hover:text-ink-800"
              >
                Cerrar
              </button>
            </div>
            {execute.pending ? (
              <Skeleton className="h-40 w-full rounded-lg" />
            ) : (
              <JsonViewer value={result} maxHeight="360px" />
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

/* ================================================================== */

function FutureScope({ section }: { section: string }) {
  const map: Record<string, string> = {
    catalogo: 'Catálogo',
    pricing: 'Pricing y condiciones',
    clientes: 'Clientes',
    pedidos: 'Pedidos',
    rma: 'RMA',
    beneficios: 'Beneficios',
    pm: 'Product Management',
    sincronizacion: 'Importaciones e integraciones',
  };
  const group = FUTURE_CATALOG.find((g) => g.section === map[section]);
  if (!group) return null;

  return (
    <section>
      <SectionTitle
        title="Inventario futuro de esta sección"
        subtitle="Recursos previstos en el contrato, todavía sin especificación detallada"
      />
      <Card className="p-5">
        <ul className="flex flex-wrap gap-2">
          {group.entries.map((entry) => (
            <li key={entry}>
              <Mono>{entry}</Mono>
            </li>
          ))}
        </ul>
      </Card>
    </section>
  );
}

function LangSwitch({ lang, setLang, className }: { lang: Lang; setLang: (l: Lang) => void; className?: string }) {
  return (
    <Segmented
      className={className}
      size="sm"
      value={lang}
      onChange={setLang}
      options={[
        { value: 'curl', label: 'cURL' },
        { value: 'ts', label: 'TypeScript' },
      ]}
    />
  );
}

export { BookOpen };
