/**
 * Recorrido de demostración.
 *
 * Cinco escenarios guiados, con el rol que hay que usar en cada paso,
 * el enlace directo a la pantalla y los datos exactos que aparecen.
 */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  Circle,
  Play,
  RotateCcw,
  ShoppingCart,
  Sparkles,
  Tag,
  TrendingDown,
  Plug,
  Wrench,
} from 'lucide-react';
import type { Role } from '@/types';
import { useSession } from '@/app/session';
import { useToast } from '@/components/ui/overlays';
import { usePersistentState } from '@/app/hooks';
import { resetDemoState, clearScenarios } from '@/services/mock/store';
import { HERO_SERIAL, OTHER_RESELLER_SERIAL, EXPIRED_WARRANTY_SERIAL, HERO_LOT_CODE } from '@/mocks/fixtures/serials';
import { HERO_ORDER } from '@/mocks/fixtures/orders';
import { HERO_REQUEST_ID } from '@/mocks/fixtures/commerce';
import { CATALOG_META } from '@/mocks/fixtures/catalog';
import { ROLE_LABEL } from '@/lib/labels';
import { ROLE_HOME } from '@/components/domain/role-switcher';
import { cn, fmtNumber } from '@/lib/utils';
import { Badge, Button, Card, CardHeader } from '@/components/ui/primitives';
import { Callout, Mono, PageHeader, SectionTitle, StatGrid, StatTile } from '@/components/ui/data';

interface Step {
  role: Role;
  title: string;
  detail: string;
  href?: string;
  hint?: string;
}

interface Scenario {
  id: string;
  code: string;
  title: string;
  pitch: string;
  minutes: number;
  icon: typeof ShoppingCart;
  steps: Step[];
}

const SCENARIOS: Scenario[] = [
  {
    id: 'a',
    code: 'Escenario A',
    title: 'Compra B2B con precio personalizado',
    pitch:
      'Muestra el marketplace mayorista: el reseller ve su precio, no el de lista; el sistema le dice qué descuento le falta alcanzar y por qué.',
    minutes: 4,
    icon: ShoppingCart,
    steps: [
      { role: 'CLIENT', title: 'Entrar como Gaming Store', detail: 'Elegí el rol Cliente en el selector «Ver plataforma como». El tablero muestra crédito, puntos y pedidos en curso.', href: '/' },
      { role: 'CLIENT', title: 'Buscar una motherboard MSI', detail: 'Abrí el catálogo y filtrá por marca MSI. Cambiá entre vista grilla y tabla compacta.', href: '/catalogo?brandId=brand_msi' },
      { role: 'CLIENT', title: 'Abrir la ficha y ver el desglose de precio', detail: 'La columna derecha muestra: precio de lista, descuento de la lista Platinum, promoción vigente y el precio final. No es un número suelto: cada componente está explicado.', href: '/catalogo/MSMOPRB650MB' },
      { role: 'CLIENT', title: 'Subir la cantidad a 10 unidades', detail: 'El precio baja por el escalón de volumen. Si ponés 8, el sistema avisa cuántas unidades faltan para el siguiente descuento.' },
      { role: 'CLIENT', title: 'Agregar al pedido y revisar el carrito', detail: 'El carrito recalcula condiciones, muestra el crédito que queda disponible y advierte si el pedido va a requerir aprobación.', href: '/carrito' },
      { role: 'CLIENT', title: 'Confirmar el pedido', detail: 'Queda confirmado o pendiente de aprobación según el crédito. El historial registra quién lo creó y cuándo.', href: '/pedidos' },
    ],
  },
  {
    id: 'b',
    code: 'Escenario B',
    title: 'Precio especial: del pedido a la decisión del PM',
    pitch:
      'El caso que hoy se resuelve por WhatsApp: un reseller pide precio por volumen y el Product Manager decide viendo el margen resultante.',
    minutes: 5,
    icon: Tag,
    steps: [
      { role: 'CLIENT', title: 'Ver la solicitud PE-1042', detail: 'Compumundo X pide USD 142 por 80 unidades de una motherboard MSI para una licitación municipal.', href: `/precio-especial/${HERO_REQUEST_ID}` },
      { role: 'PM', title: 'Cambiar al rol Product Manager', detail: 'El menú cambia por completo: aparece el cockpit de marca, pricing, stock y calidad.', href: '/bo/solicitudes' },
      { role: 'PM', title: 'Abrir la solicitud y revisar el margen', detail: 'La pantalla muestra el margen resultante, el margen base y cuatro escenarios de precio con su margen asociado. El cliente nunca ve estos números.', href: `/bo/solicitudes/${HERO_REQUEST_ID}` },
      { role: 'PM', title: 'Contraofertar', detail: 'Usá «Contraofertar»: la app propone un precio que deja el margen en 12% y te deja ajustarlo. El comentario queda auditado.' },
      { role: 'CLIENT', title: 'Volver a Cliente y ver la respuesta', detail: 'La notificación llega al portal del reseller con el precio ofrecido, la cantidad máxima y la vigencia.', href: '/precio-especial' },
    ],
  },
  {
    id: 'c',
    code: 'Escenario C',
    title: 'RMA 360: del serial a la resolución',
    pitch:
      'El módulo más profundo. Un serial devuelve producto, pedido, factura y garantía; el caso recorre validación, recepción, diagnóstico y resolución con SLA.',
    minutes: 7,
    icon: Wrench,
    steps: [
      { role: 'CLIENT', title: 'Consultar el serial 9MSI5070X93821', detail: 'Sin cargar nada más, el portal recupera producto, pedido ASH-24853, factura, fecha de compra y garantía de 36 meses.', href: `/rma/consulta?serial=${HERO_SERIAL}`, hint: `Serial de la demo: ${HERO_SERIAL}` },
      { role: 'CLIENT', title: 'Probar la regla de privacidad', detail: `Consultá ${OTHER_RESELLER_SERIAL}: pertenece a otro reseller. El portal no muestra factura, fecha, precio ni razón social del tercero.`, href: `/rma/consulta?serial=${OTHER_RESELLER_SERIAL}`, hint: 'Es la regla crítica del módulo' },
      { role: 'CLIENT', title: 'Iniciar la gestión de garantía', detail: 'Cuatro pasos: unidades, troubleshooting previo (que no bloquea), problema con preguntas por categoría y evidencia, y logística.', href: `/rma/nuevo?serial=${HERO_SERIAL}` },
      { role: 'RMA', title: 'Cambiar al rol RMA / Técnico', detail: 'El backoffice de garantías muestra el centro de casos con vista tabla y Kanban, y el control de SLA por etapa.', href: '/bo/rma' },
      { role: 'RMA', title: 'Aprobar la recepción', detail: 'Al aprobar se emite el remito y la etiqueta con el código del caso. El cliente ve la etiqueta en su portal.' },
      { role: 'RMA', title: 'Registrar la recepción', detail: 'Escaneá el código, verificá los seriales y registrá discrepancias: faltante, serial incorrecto o daño visible.', href: '/bo/rma/recepcion' },
      { role: 'RMA', title: 'Cargar el diagnóstico', detail: 'Resultado, código de falla, pruebas realizadas y condiciones detectadas. Marcar daño físico no rechaza: genera revisión manual.' },
      { role: 'RMA', title: 'Resolver con reemplazo', detail: 'El serial nuevo hereda la trazabilidad del original. La resolución y la garantía resultante quedan en el timeline.' },
      { role: 'CLIENT', title: 'Volver a Cliente y ver el timeline completo', detail: 'Cada evento con fecha, responsable, comentario y documentos.', href: '/rma' },
    ],
  },
  {
    id: 'd',
    code: 'Escenario D',
    title: 'El PM detecta un problema de lote',
    pitch:
      'De un dato agregado a una acción concreta: una tasa de RMA anómala lleva al lote, a los seriales afectados y al escalamiento al fabricante.',
    minutes: 4,
    icon: TrendingDown,
    steps: [
      { role: 'PM', title: 'Abrir Calidad / RMA de MSI', detail: 'La pantalla marca los SKUs con tasa de RMA dos veces superior al promedio de la marca.', href: '/bo/rma/analytics?brand=brand_msi' },
      { role: 'PM', title: 'Detectar el SKU con tasa anormal', detail: 'La alerta explica el desvío en lenguaje de negocio, no en porcentajes sueltos.' },
      { role: 'PM', title: 'Abrir el lote', detail: `${HERO_LOT_CODE} concentra los casos: unidades importadas, vendidas, tasa del lote contra el promedio de la marca y motivos comunes.`, href: `/bo/rma/lotes/${HERO_LOT_CODE}` },
      { role: 'PM', title: 'Ver los seriales afectados', detail: 'Cada serial linkea a su caso. Desde acá se puede avisar a los resellers que compraron unidades del lote.' },
      { role: 'PM', title: 'Accionar', detail: 'Escalar al fabricante o crear una promoción para mover el remanente. Ambas acciones salen de la misma pantalla.' },
    ],
  },
  {
    id: 'e',
    code: 'Escenario E',
    title: 'Integración y contrato de API',
    pitch:
      'Cómo se conectaría gradualmente el sistema de gestión de Ashir, y qué pasa cuando algo falla.',
    minutes: 5,
    icon: Plug,
    steps: [
      { role: 'ADMIN', title: 'Ver el centro de integraciones', detail: 'El ERP figura explícitamente como «No configurado · adaptador pendiente de definición». No inventamos una conexión que no existe.', href: '/bo/integraciones' },
      { role: 'ADMIN', title: 'Abrir NODO', detail: 'Conector propuesto: entidades sincronizables, dirección de cada flujo, frecuencia, credenciales enmascaradas y prueba de conexión.', href: '/bo/integraciones/nodo' },
      { role: 'ADMIN', title: 'Simular un error', detail: 'Activá el escenario «Integración ERP caída» en Configuración y volvé a sincronizar: la ejecución falla con su request id.', href: '/bo/configuracion', hint: 'Acordate de desactivarlo después' },
      { role: 'ADMIN', title: 'Ver el log y el request id', detail: 'Cada ejecución guarda duración, registros procesados, advertencias, errores y un request id trazable.' },
      { role: 'ADMIN', title: 'Reintentar', detail: 'Desactivá el escenario y sincronizá de nuevo: la ejecución vuelve a ser exitosa.' },
      { role: 'ADMIN', title: 'Abrir la documentación de la API', detail: 'El Centro de Desarrolladores documenta autenticación, convenciones, errores, webhooks e idempotencia, y permite ejecutar un «Try it» contra el mock local.', href: '/docs' },
    ],
  },
];

export function BoDemoScript() {
  const { setRole } = useSession();
  const navigate = useNavigate();
  const toast = useToast();
  const [done, setDone] = usePersistentState<string[]>('ashir-partner-hub:demo-progress:v1', []);
  const [openScenario, setOpenScenario] = useState<string>('a');

  const totalSteps = SCENARIOS.reduce((a, s) => a + s.steps.length, 0);
  const totalMinutes = SCENARIOS.reduce((a, s) => a + s.minutes, 0);

  const toggleStep = (key: string) => {
    setDone((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const goToStep = (step: Step) => {
    setRole(step.role);
    navigate(step.href ?? ROLE_HOME[step.role]);
  };

  return (
    <div>
      <PageHeader
        title="Recorrido de demostración"
        subtitle="Cinco escenarios pensados para una reunión comercial. Cada paso indica con qué rol se ve y abre la pantalla exacta."
        actions={
          <>
            <Button
              variant="outline"
              icon={<RotateCcw className="size-4" />}
              onClick={() => {
                resetDemoState();
                clearScenarios();
                setDone([]);
                toast.success('Demostración reiniciada', 'Datos y progreso del recorrido restablecidos.');
              }}
            >
              Reiniciar demo
            </Button>
            <Button
              icon={<Play className="size-4" />}
              onClick={() => {
                setOpenScenario('a');
                goToStep(SCENARIOS[0]!.steps[0]!);
              }}
            >
              Empezar el recorrido
            </Button>
          </>
        }
      />

      <StatGrid cols={4} className="mb-6">
        <StatTile label="Escenarios" value={SCENARIOS.length} icon={<Sparkles className="size-4" />} />
        <StatTile label="Pasos" value={totalSteps} footer={`${done.length} completados`} />
        <StatTile label="Duración estimada" value={`${totalMinutes} min`} tone="tech" />
        <StatTile
          label="Catálogo de la demo"
          value={fmtNumber(CATALOG_META.productCount)}
          footer="SKUs reales de la lista de distribuidor"
        />
      </StatGrid>

      <Callout tone="tech" className="mb-6" title="Antes de empezar">
        Verificá que no haya escenarios de error activos en{' '}
        <Link to="/bo/configuracion" className="font-semibold underline underline-offset-2">
          Configuración
        </Link>
        , salvo que los vayas a mostrar a propósito. Si venís de otra prueba, usá «Reiniciar demo» para volver al estado
        inicial.
      </Callout>

      {/* ---------------- escenarios ---------------- */}
      <div className="space-y-4">
        {SCENARIOS.map((scenario) => {
          const Icon = scenario.icon;
          const isOpen = openScenario === scenario.id;
          const completed = scenario.steps.filter((_, i) => done.includes(`${scenario.id}-${i}`)).length;

          return (
            <Card key={scenario.id} className={cn(isOpen && 'ring-1 ring-ashir-200')}>
              <button
                type="button"
                onClick={() => setOpenScenario(isOpen ? '' : scenario.id)}
                className="flex w-full items-start gap-4 p-5 text-left"
              >
                <span
                  className={cn(
                    'flex size-10 shrink-0 items-center justify-center rounded-xl',
                    completed === scenario.steps.length ? 'bg-ok-50 text-ok-600' : 'bg-ashir-50 text-ashir-600',
                  )}
                >
                  <Icon className="size-5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="neutral" size="sm">
                      {scenario.code}
                    </Badge>
                    <h2 className="text-[15px] font-semibold text-ink-900">{scenario.title}</h2>
                    <Badge tone="tech" size="sm">
                      {scenario.minutes} min
                    </Badge>
                    {completed === scenario.steps.length && (
                      <Badge tone="ok" size="sm">
                        Completado
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1.5 max-w-3xl text-[13px] leading-relaxed text-ink-500">{scenario.pitch}</p>
                  <p className="mt-2 text-[11px] text-ink-400">
                    {completed} de {scenario.steps.length} pasos · roles:{' '}
                    {[...new Set(scenario.steps.map((s) => ROLE_LABEL[s.role].split(' ')[0]))].join(' → ')}
                  </p>
                </div>
                <ArrowRight className={cn('mt-1 size-4 shrink-0 text-ink-300 transition-transform', isOpen && 'rotate-90')} aria-hidden />
              </button>

              {isOpen && (
                <ol className="animate-fade-in divide-y divide-ink-100 border-t border-ink-100">
                  {scenario.steps.map((step, index) => {
                    const key = `${scenario.id}-${index}`;
                    const isDone = done.includes(key);
                    return (
                      <li key={key} className="flex flex-wrap items-start gap-3 px-5 py-3.5">
                        <button
                          type="button"
                          onClick={() => toggleStep(key)}
                          className="mt-0.5 shrink-0"
                          aria-label={isDone ? 'Marcar como pendiente' : 'Marcar como hecho'}
                        >
                          {isDone ? (
                            <CheckCircle2 className="size-5 text-ok-500" aria-hidden />
                          ) : (
                            <Circle className="size-5 text-ink-300" aria-hidden />
                          )}
                        </button>

                        <div className="min-w-0 flex-1">
                          <p className={cn('flex flex-wrap items-center gap-2 text-[13px] font-semibold', isDone ? 'text-ink-400 line-through' : 'text-ink-900')}>
                            <span className="text-ink-400">{index + 1}.</span>
                            {step.title}
                            <Badge tone="neutral" size="sm">
                              {ROLE_LABEL[step.role].split(' ')[0]}
                            </Badge>
                          </p>
                          <p className="mt-1 text-[13px] leading-relaxed text-ink-600">{step.detail}</p>
                          {step.hint && (
                            <p className="mt-1 text-[11px] text-ashir-600">
                              <Sparkles className="mr-1 inline size-3" aria-hidden />
                              {step.hint}
                            </p>
                          )}
                        </div>

                        <Button size="sm" variant="outline" className="shrink-0" onClick={() => goToStep(step)}>
                          Ir al paso
                        </Button>
                      </li>
                    );
                  })}
                </ol>
              )}
            </Card>
          );
        })}
      </div>

      {/* ---------------- datos clave ---------------- */}
      <section className="mt-8">
        <SectionTitle title="Datos clave de la demostración" subtitle="Para tenerlos a mano durante la reunión" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title="Identificadores de la cadena coherente" />
            <div className="space-y-2.5 p-5 text-[13px]">
              {[
                ['Cliente protagonista', 'Gaming Store SRL · segmento Platinum'],
                ['Lista de precios', 'LP-PLATINUM-02'],
                ['Pedido', HERO_ORDER.number],
                ['Factura', 'FA-0004-00012831'],
                ['Serial en garantía', HERO_SERIAL],
                ['Serial de otro reseller', OTHER_RESELLER_SERIAL],
                ['Serial con garantía vencida', EXPIRED_WARRANTY_SERIAL],
                ['Lote con incidencia', HERO_LOT_CODE],
                ['Solicitud de precio', 'PE-1042 · Compumundo X · 80 unidades'],
                ['RMA múltiple', 'RMA-260194 · 4 unidades del mismo lote'],
                ['RMA fuera de SLA', 'RMA-260181'],
              ].map(([label, value]) => (
                <div key={label} className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-ink-500">{label}</span>
                  <Mono copy>{value!}</Mono>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="Qué decir sobre el alcance" subtitle="Para responder la pregunta inevitable" />
            <div className="space-y-3 p-5 text-[13px] leading-relaxed text-ink-600">
              <p>
                <strong className="text-ink-900">Lo que es real:</strong> el catálogo completo (
                {fmtNumber(CATALOG_META.productCount)} SKUs), con marcas, categorías, precios de distribuidor, IVA y
                estado de stock tal como figuran en la lista vigente de Ashir.
              </p>
              <p>
                <strong className="text-ink-900">Lo que está implementado de verdad:</strong> el motor de precios y
                condiciones comerciales, la separación de permisos por rol, la validación de propiedad del serial y toda
                la navegación entre módulos.
              </p>
              <p>
                <strong className="text-ink-900">Lo que es simulado:</strong> costos, márgenes, cantidades de stock,
                series de venta, clientes, pedidos históricos y casos de RMA. Sirven para que la historia cierre, no
                para tomar decisiones.
              </p>
              <p>
                <strong className="text-ink-900">Lo que depende del ERP:</strong> cuenta corriente, facturación,
                stock real, costos, números de serie y notas de crédito. El contrato de integración ya está diseñado;
                el adaptador se escribe cuando se conozca el sistema.
              </p>
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
}
