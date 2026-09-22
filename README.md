# ASHIR PARTNER HUB

Prototipo comercial de alta fidelidad del portal B2B de **Ashir Technology Corp**:
marketplace mayorista para resellers, gestión de pedidos, motor de pricing,
programa de beneficios, RMA 360° y centro de integraciones.

Está pensado para una **reunión de presentación**: permite recorrer de punta a
punta los flujos que importan, con datos coherentes entre pantallas y con el
catálogo real de Ashir.

---

## Arrancar

```bash
npm install
npm run dev          # http://localhost:5173
```

Otros comandos:

```bash
npm run build        # build de producción
npm run preview      # servir el build
npm run typecheck    # TypeScript estricto
npm test             # tests de pricing y privacidad
npm run lint
npm run import:products   # reprocesar el Excel de productos
```

No requiere backend, base de datos ni variables de entorno: por defecto arranca
en modo demostración con un adaptador de datos local.

---

## Modo demostración

Todo el portal está rotulado como **«Modo demostración»** de forma permanente.
Ningún dato simulado se presenta como información productiva.

Configuración en `apps/web/.env` (opcional, hay defaults):

```env
VITE_DATA_MODE=mock                                   # mock | api
VITE_API_BASE_URL=https://api.example.ashir.com.ar/v1
VITE_API_DOCS_ENABLED=true
VITE_MOCK_LATENCY_MIN=250
VITE_MOCK_LATENCY_MAX=900
```

Con `VITE_DATA_MODE=api` el portal usa el adaptador REST, que **falla con un
mensaje explícito**: la API de Ashir todavía no existe. Es a propósito —
preferimos un error claro antes que datos inventados presentados como reales.

---

## Qué es real y qué es simulado

Esta distinción es la más importante del prototipo.

### Real (viene del archivo de Ashir)

El catálogo completo se importó de la **lista de distribuidor real**:

| Dato | Fuente |
|---|---|
| **245 SKUs** | `COD. INTERNO` |
| Part numbers | `PART NUMBER` |
| Descripciones y especificaciones | `DESCRIPCIÓN`, `DETALLES` |
| **10 marcas** — ASUS, MSI, Thermaltake, ADATA, Evolabs, Aureox, AMD, Acer… | prefijo de la descripción |
| **11 categorías** — GPUs, Motherboards, Fuentes, Gabinetes, Refrigeración, Memorias, SSD, Monitores, Procesadores, Periféricos, Sillas | secciones del listado |
| Precios de distribuidor en USD sin IVA | `DISTRI S/IVA` |
| Precio final sugerido | `FINAL` |
| Alícuotas de IVA (21% y 10,5%) | `IVA` |
| Estado de stock | `ESTADO` |

### Implementado de verdad (lógica funcionando)

- **Motor de precios y condiciones comerciales** — `services/mock/pricing-engine.ts`.
  Todas las pantallas que muestran un precio pasan por él, así que el desglose
  siempre coincide con el total. Incluye comparación entre condiciones
  exclusivas y acumulables para no empeorar nunca el precio del cliente.
- **Separación de permisos por rol** — el rol Cliente recibe `cost` y
  `marginPct` en `null` desde el adaptador, no simplemente ocultos en la UI.
- **Validación de propiedad del serial** — la cuenta se resuelve de la sesión;
  un serial de otro reseller no devuelve ningún dato del tercero.
- **Concurrencia optimista en pedidos** — versión, conflicto 409 y
  previsualización del impacto de un cambio antes de aplicarlo.
- **Importador de Excel** — lee el archivo en el navegador, detecta la hoja y
  los encabezados, mapea columnas, valida y reporta por fila.

### Simulado (datos de demostración)

Costos, márgenes, cantidades de stock, series de venta de 12 meses, clientes,
pedidos históricos, casos de RMA, lotes, puntos y notificaciones.

Se generan con un PRNG determinista sembrado por SKU, así que **no cambian entre
recargas** y los números cierran entre pantallas. El archivo de distribuidor no
contiene costos ni cantidades: `DISTRI S/IVA` es el precio de venta al reseller,
no el costo de Ashir.

### Dependiente del ERP (fuera de alcance hoy)

Cuenta corriente, facturación, stock real, costos, números de serie y notas de
crédito. **No sabemos qué sistema de gestión usa Ashir**, por lo que el ERP
figura explícitamente como `No configurado · adaptador pendiente de definición`.

---

## El Excel de productos

El catálogo actual ya está importado y commiteado. Para regenerarlo:

```bash
# Colocar el archivo acá
data/import/ashir-productos.xlsx      # también acepta .xls o .csv

npm run import:products
```

El importador:

- Detecta la hoja y la fila de encabezados sin asumir posiciones fijas.
- Mapea columnas por nombre, tolerando variaciones.
- Deriva marca y categoría de la estructura del listado.
- Conserva los productos sin precio publicado (los `AGOTADO` traen `-`) como
  «a consultar», en lugar de descartarlos.
- **No modifica el archivo original.**

Salidas:

```
apps/web/src/mocks/generated/products.json
apps/web/src/mocks/generated/brands.json
apps/web/src/mocks/generated/categories.json
apps/web/src/mocks/generated/meta.json
reports/product-import-report.md        ← mapeo aplicado y observaciones
```

El reporte documenta qué campo salió de qué columna y qué se simuló.

---

## Recorrer la demo

El selector **«Ver plataforma como»** (arriba a la derecha) cambia el rol. Cada
rol tiene su propio menú, tablero, permisos y lenguaje:

| Rol | Ve |
|---|---|
| **Cliente / Reseller** | Marketplace, pedidos, beneficios y garantías de su cuenta |
| **Comercial** | Cartera de clientes, aprobaciones y condiciones |
| **Product Manager** | Cockpit por marca: ventas, margen, stock, calidad, pricing |
| **RMA / Técnico** | Centro de garantías: recepción, diagnóstico, resolución |
| **Administrador** | Vista integral, integraciones, importaciones, configuración |

### Recorrido guiado

Como Administrador, **`/bo/demo`** tiene cinco escenarios con el rol de cada
paso y el enlace directo a la pantalla:

- **A — Compra B2B** · precio personalizado y descuentos por alcanzar
- **B — Precio especial** · el reseller pide, el PM decide viendo el margen
- **C — RMA 360** · serial → validación → recepción → diagnóstico → resolución
- **D — Incidencia de lote** · de una tasa anómala al escalamiento al fabricante
- **E — Integración** · ERP, NODO, simulación de error y contrato de API

### Datos clave para la reunión

| | |
|---|---|
| Cliente protagonista | Gaming Store SRL · Platinum · lista `LP-PLATINUM-02` |
| Pedido | `ASH-24853` → factura `FA-0004-00012831` |
| Serial en garantía | `9MSI5070X93821` |
| Serial de **otro** reseller | `M4A7761200341` (probar la regla de privacidad) |
| Serial con garantía vencida | `TT2201884431` |
| Lote con incidencia | `LOTE-MSI-260326-A` |
| Solicitud de precio | `PE-1042` · Compumundo X · 80 unidades |
| RMA múltiple | `RMA-260194` · 4 unidades del mismo lote |
| RMA fuera de SLA | `RMA-260181` |

### Panel de escenarios de error

En **`/bo/configuracion`** se pueden forzar situaciones límite para mostrarlas:
API lenta, error 500, sin stock, conflicto de versión de pedido, serial de otro
reseller, garantía vencida, RMA fuera de SLA e integración ERP caída.

Ahí mismo está **«Restablecer datos de demostración»**, útil antes de empezar
una presentación.

---

## Estructura

```
apps/web/src/
  app/              layouts, router, sesión, carrito, hooks
  components/
    ui/             design system (primitivas, overlays, tablas, gráficos)
    domain/         componentes de negocio compartidos
  pages/
    client/         portal del reseller
    bo/             backoffice (pedidos, clientes, pricing, PM, RMA, plataforma)
    docs/           Centro de Desarrolladores
  services/
    contracts.ts    interfaces de la capa de datos
    mock/           adaptador local, motor de precios, analytics
    http/            adaptador REST (placeholder de la API futura)
  mocks/
    fixtures/       datos de demostración
    generated/      salida del importador de Excel
  lib/              utilidades, etiquetas, RBAC
  types/            contratos de dominio

docs/               openapi.yaml y guías de integración
data/import/        Excel de productos
scripts/            importador y generador de ejemplos
reports/            reporte de la última importación
```

La capa de datos mantiene una frontera explícita:

```
UI → hooks → Domain Services → ApiClient → Mock | REST | ERP
```

Ninguna pantalla importa fixtures de datos mutables directamente: todo pasa por
`services/`. Eso es lo que permite reemplazar el adaptador sin tocar la UI.

---

## Documentación de la API

El **Centro de Desarrolladores** vive dentro de la app, en **`/docs`**: incluye
autenticación, ambientes, convenciones, errores, webhooks, changelog y un
**«Try it»** que ejecuta los endpoints contra el adaptador local.

Entregables técnicos:

| Archivo | Contenido |
|---|---|
| [`docs/openapi.yaml`](docs/openapi.yaml) | Especificación OpenAPI 3.1 con 20 endpoints, schemas y webhooks |
| [`docs/API_INTEGRATION_GUIDE.md`](docs/API_INTEGRATION_GUIDE.md) | Guía de integración: idempotencia, concurrencia, scopes |
| [`docs/ERP_ADAPTER_GUIDE.md`](docs/ERP_ADAPTER_GUIDE.md) | Cómo conectar el sistema de gestión cuando se defina |
| [`docs/WEBHOOKS.md`](docs/WEBHOOKS.md) | Eventos, firma HMAC, reintentos, idempotencia del receptor |
| [`docs/ERROR_CODES.md`](docs/ERROR_CODES.md) | Catálogo de errores con acción recomendada |
| [`docs/examples/`](docs/examples/) | Requests y responses reproducibles |

---

## Stack

React 19 · TypeScript estricto · Vite · React Router · Tailwind CSS v4 ·
Recharts · Lucide · SheetJS (carga diferida) · Vitest

Monorepo con workspaces de npm: `apps/web` es la aplicación; `docs`, `data`,
`scripts` y `reports` viven en la raíz.

---

## Tests

```bash
npm test
```

19 tests sobre las dos piezas que romperían la presentación si estuvieran mal:

- **Motor de precios** — que el desglose sume el total, que más cantidad nunca
  suba el precio unitario, que un Platinum pague menos que un Silver, que las
  exclusiones y vigencias se respeten.
- **Privacidad y permisos** — que un serial de otro reseller no filtre ningún
  dato, que el rol Cliente reciba costo y margen en `null`, que un cliente no
  pueda listar los pedidos de otro.

Los tests encontraron tres bugs reales durante el desarrollo, entre ellos que
una promoción exclusiva podía hacer *subir* el precio unitario al aumentar la
cantidad. Están corregidos.

---

## Accesibilidad y responsive

- Contraste AA, navegación por teclado, foco visible y `aria-label` en controles.
- Los estados no dependen sólo del color: siempre hay texto o icono.
- Se respeta `prefers-reduced-motion`.
- Desktop prioritario en el backoffice; el marketplace funciona en desktop,
  tablet y mobile, con tablas que se vuelven tarjetas en pantallas chicas.

---

## Limitaciones conscientes

- **No hay autenticación.** El selector de roles es una herramienta de demo.
- **No hay base de datos.** Los cambios se persisten en `localStorage`.
- **No hay integración productiva.** Ningún request sale a internet.
- **No hay imágenes de producto.** El archivo de distribuidor no las incluye;
  en lugar de inventar URLs se usa un tile con la marca y la categoría.
- **No hay secretos ni credenciales** en el repositorio.

---

*Prototipo de presentación. No es un sistema productivo.*
