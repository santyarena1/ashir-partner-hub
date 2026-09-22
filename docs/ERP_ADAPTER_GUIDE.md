# Guía del adaptador de ERP

> **Todavía no sabemos qué sistema de gestión usa Ashir.** Este documento no
> describe una integración existente: describe cómo está preparado el contrato
> para absorber cualquiera de las variantes posibles cuando se defina.

---

## 1. Por qué existe una capa de adaptación

La tentación al construir un portal B2B es que el frontend consulte
directamente la base del ERP. Funciona el primer mes y después se rompe: cada
cambio de esquema del ERP obliga a tocar pantallas, y cualquier migración del
sistema de gestión implica reescribir el portal.

La arquitectura que propone el prototipo:

```
┌─────────────────────┐
│ Ashir Partner Hub   │  Portal B2B (este prototipo)
└──────────┬──────────┘
           │  contrato estable /v1
┌──────────▼──────────┐
│  Integration API    │  Traduce entre el contrato y el mundo real
└──────────┬──────────┘
           │  lo que el ERP sepa hablar
┌──────────▼──────────┐
│     ERP Ashir       │  A definir
└─────────────────────┘
```

El portal no sabe si del otro lado hay una API REST, un SQL Server, un archivo
CSV en un FTP o un proceso batch nocturno. Sólo conoce el contrato.

En el código del prototipo esa frontera es literal:
`apps/web/src/services/contracts.ts` define las interfaces, y hay dos
implementaciones (`mock/adapter.ts` y `http/client.ts`). Una tercera para el ERP
entraría en el mismo lugar sin tocar ninguna pantalla.

---

## 2. Entidades a sincronizar

| Entidad | Dirección | Frecuencia sugerida | Crítica |
|---|---|---|---|
| Clientes | ERP → Hub | Cada hora | Sí |
| Productos | ERP → Hub | Diaria | Sí |
| Stock | ERP → Hub | Cada 15 min | Sí |
| Costos | ERP → Hub | Diaria | Sí |
| Precios | Bidireccional | Cada hora | Sí |
| Listas de precios | Hub → ERP | Al publicar | No |
| Cuenta corriente | ERP → Hub | Cada 15 min | Sí |
| Facturas | ERP → Hub | Cada hora | Sí |
| Pedidos | Hub → ERP | Inmediata | Sí |
| Números de serie | ERP → Hub | Al facturar | Sí |
| Garantías | Bidireccional | Diaria | No |
| Notas de crédito | ERP → Hub | Cada hora | No |

"Crítica" significa que el portal muestra información incorrecta o incompleta
si esa entidad está desactualizada.

---

## 3. El contrato tolera cuatro modos de sincronización

No asumimos cómo va a funcionar. El diseño soporta:

### 3.1 API REST en tiempreal

El caso ideal. El adaptador traduce llamada por llamada.

```ts
// Pseudo-código del adaptador
class ErpRestAdapter implements CatalogService {
  async listProducts(query, session) {
    const raw = await this.erp.get('/articulos', {
      marca: query.brandId,
      conStock: query.inStock,
    });
    return {
      data: raw.items.map(mapArticuloToProduct),
      meta: mapPagination(raw),
      requestId: raw.idRequest,
    };
  }
}
```

### 3.2 Polling periódico

El ERP no notifica: el adaptador consulta cada N minutos y mantiene una copia
local.

```ts
// El Hub lee de su copia; el job la mantiene fresca.
schedule('*/15 * * * *', async () => {
  const changes = await erp.getStockChangesSince(lastSyncAt);
  await hubCache.upsertStock(changes);
  await recordRun({ process: 'Stock', records: changes.length });
});
```

En este modo el portal debe **mostrar la antigüedad del dato**. El prototipo ya
lo hace: el widget `IntegrationStatus` y el sello «Sincronizado con ERP · hace 4
min» existen justamente para esto.

### 3.3 Intercambio de archivos

El ERP deja un CSV o un XLSX en un directorio o un FTP. El adaptador lo procesa
y registra la ejecución.

Es el modo que el prototipo ya ejerce de verdad: el catálogo actual se generó
así, con `npm run import:products` leyendo la lista de distribuidor real. El
importador detecta la hoja, encuentra la fila de encabezados sin asumir
posiciones fijas, mapea columnas y reporta las filas problemáticas.

Ver `reports/product-import-report.md` para el resultado de la última corrida.

### 3.4 Proceso batch nocturno

El ERP consolida a la noche. El portal trabaja con datos del día anterior para
algunas entidades.

Este modo exige decisiones de producto explícitas: no se puede prometer «stock
en tiempo real» si el stock se actualiza a las 3 AM. El contrato permite marcar
cada entidad con su `lastUpdatedAt` para que la UI sea honesta.

---

## 4. Idempotencia en la sincronización

Toda sincronización debe poder repetirse sin efectos duplicados.

```ts
// ❌ Frágil: si el job corre dos veces, duplica
await db.insert('productos', batch);

// ✅ Idempotente: la clave natural es el SKU
await db.upsert('productos', batch, { conflictTarget: 'sku' });
```

Para pedidos que van del Hub al ERP, la clave de idempotencia es el número de
pedido (`ASH-24853`). Si el ERP ya lo tiene, la operación es un no-op.

---

## 5. Manejo de errores y reintentos

```ts
async function syncEntity(entity: string, attempt = 0): Promise<RunResult> {
  try {
    const result = await adapter.sync(entity);
    await recordRun({ entity, result: 'SUCCESS', records: result.count });
    return result;
  } catch (error) {
    await recordRun({
      entity,
      result: 'FAILED',
      errors: [error.message],
      attempt,
    });

    if (attempt >= 3) {
      // Agotados los reintentos: notificar y emitir el webhook.
      await emit('integration.sync_failed', { entity, attempts: attempt + 1 });
      throw error;
    }

    await sleep(2 ** attempt * 5000);
    return syncEntity(entity, attempt + 1);
  }
}
```

Reglas:

- **Registrar toda ejecución**, exitosa o no, con duración, registros
  procesados y un `requestId`. Es lo que permite diagnosticar sin adivinar.
- **Nunca ocultar un error con datos viejos en silencio.** Si la sincronización
  falló, el portal debe mostrar que el dato es de la última corrida exitosa.
- **Un fallo de una entidad no debe bloquear las demás.** Si falla stock, el
  catálogo sigue funcionando con la última copia.

---

## 6. Qué mostrar en la interfaz

El prototipo ya implementa los tres estados que la integración necesita
comunicar:

| Estado | Cuándo | Qué ve el usuario |
|---|---|---|
| `OPERATIONAL` | Última sincronización exitosa y dentro de la frecuencia esperada | Verde, con antigüedad del dato |
| `DEGRADED` | Responde con errores parciales o demoras | Ámbar, con cantidad de errores |
| `OFFLINE` | No responde tras agotar reintentos | Rojo, con el último dato válido y su fecha |
| `NOT_CONFIGURED` | Adaptador no definido (situación actual del ERP) | Neutro, explícito |

El estado actual del ERP en el prototipo es **`NOT_CONFIGURED`**, a propósito.
Preferimos mostrar «adaptador pendiente de definición» antes que simular una
conexión que no existe.

---

## 7. Mapeo de campos: el ejemplo real

El importador del prototipo trabaja sobre la lista de distribuidor real de
Ashir. Este es el mapeo que aplica hoy:

| Campo del contrato | Columna del archivo | Origen |
|---|---|---|
| `sku` | `COD. INTERNO` | real |
| `partNumber` | `PART NUMBER` | real |
| `name` | `DESCRIPCIÓN` | real |
| `brand` | prefijo de la descripción | derivado |
| `category` | fila de sección del listado | derivado |
| `listPrice` | `DISTRI S/IVA` | real |
| `suggestedRetail` | `FINAL` | real |
| `vatRate` | `IVA` | real |
| `availability` | `ESTADO` | real |
| `specs` | `DETALLES` | real |
| `cost`, `marginPct` | — | **simulado** |
| `stock` (cantidad) | derivado de `ESTADO` | **simulado** |

Dos aprendizajes de haber procesado el archivo real, que probablemente valgan
para el ERP también:

1. **El archivo no trae costos.** `DISTRI S/IVA` es el precio de venta al
   reseller, no el costo de Ashir. El margen real sólo puede venir del ERP.
2. **El estado de stock es cualitativo, no cuantitativo.** El archivo dice «EN
   STOCK» o «AGOTADO», no cuántas unidades hay. Los productos agotados traen
   `-` en la columna de precio, lo que obliga a soportar productos sin precio
   publicado (el contrato lo modela con `listPrice: null`).

---

## 8. Qué necesitamos saber para escribir el adaptador

Cuando se defina el sistema de gestión, estas son las preguntas que desbloquean
la implementación:

**Sobre el sistema**
- ¿Qué ERP o sistema de gestión es? ¿Versión?
- ¿Expone una API? ¿REST, SOAP, o acceso directo a base?
- ¿Hay un entorno de prueba separado del productivo?

**Sobre los datos**
- ¿Cuál es la clave primaria de un artículo? ¿El código interno es único y estable?
- ¿El stock es por depósito o consolidado?
- ¿Los costos son de última compra, promedio ponderado o de reposición?
- ¿Los números de serie se registran al ingresar la mercadería o al facturar?

**Sobre los procesos**
- ¿Cómo entra hoy un pedido al sistema? ¿Manualmente?
- ¿Quién define y actualiza las listas de precios?
- ¿Cómo se registra hoy una garantía?

**Sobre las restricciones**
- ¿Hay ventanas de mantenimiento en las que el sistema no responde?
- ¿Hay límites de concurrencia o de volumen de consultas?
- ¿Qué latencia es aceptable para una consulta de stock?

---

## 9. Orden de implementación sugerido

Conectar todo de una vez es la forma más segura de no conectar nada. Orden
propuesto, de menor a mayor riesgo:

1. **Productos y precios** (ERP → Hub). Solo lectura, sin efectos secundarios.
   Si falla, el portal sigue con la última copia.
2. **Stock** (ERP → Hub). Alta frecuencia, pero sigue siendo lectura.
3. **Clientes y cuenta corriente** (ERP → Hub). Habilita el crédito real.
4. **Pedidos** (Hub → ERP). Primera escritura. Empezar con un cliente piloto.
5. **Facturas y números de serie** (ERP → Hub). Habilita el RMA con datos reales.
6. **Garantías y notas de crédito** (bidireccional). Lo último, cuando el resto
   ya es confiable.

Cada paso deja valor propio: el portal es útil aunque sólo estén los tres
primeros.

---

## Documentos relacionados

- [`API_INTEGRATION_GUIDE.md`](./API_INTEGRATION_GUIDE.md) — guía general de la API.
- [`openapi.yaml`](./openapi.yaml) — especificación formal.
- [`WEBHOOKS.md`](./WEBHOOKS.md) — notificaciones salientes.
- `reports/product-import-report.md` — resultado del importador sobre el archivo real.
