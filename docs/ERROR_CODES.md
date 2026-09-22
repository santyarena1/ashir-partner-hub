# Catálogo de errores

Todos los errores comparten la misma forma. El **`code` es estable** entre
versiones: usalo para la lógica de tu integración. El `message` está escrito
para humanos y puede cambiar.

```jsonc
{
  "error": {
    "code": "ORDER_CONDITION_NOT_MET",
    "message": "El pedido ya no cumple la condición comercial.",
    "details": [
      { "field": "items[2].quantity", "reason": "MINIMUM_QUANTITY_NOT_MET" }
    ]
  },
  "requestId": "req_demo_456"
}
```

`details` aparece cuando el error se puede atribuir a campos específicos. Es lo
que permite marcar el campo exacto en un formulario en lugar de mostrar un
cartel genérico.

---

## Autenticación y autorización

| Código | HTTP | Cuándo ocurre | Qué hacer |
|---|---|---|---|
| `UNAUTHENTICATED` | 401 | Falta el token, está vencido o es inválido. | Renovar el token. Si persiste, revisar las credenciales. |
| `FORBIDDEN` | 403 | El token no tiene el scope necesario. | Revisar los scopes solicitados al crear la credencial. |
| `RATE_LIMITED` | 429 | Se superó el límite de requests del período. | Respetar el header `Retry-After`. Considerar cachear lecturas. |

---

## Recursos

| Código | HTTP | Cuándo ocurre | Qué hacer |
|---|---|---|---|
| `RESOURCE_NOT_FOUND` | 404 | El recurso no existe o no es visible para el token. | Verificar el identificador. Un 404 también puede significar "existe pero no es tuyo". |
| `VALIDATION_ERROR` | 400 | El cuerpo del request no cumple el esquema. | Revisar `details` para el campo exacto. |
| `IDEMPOTENCY_KEY_REUSED` | 409 | Se reusó una `Idempotency-Key` con un cuerpo distinto. | Generar una clave nueva por cada intención de negocio distinta. |

---

## Pedidos

| Código | HTTP | Cuándo ocurre | Qué hacer |
|---|---|---|---|
| `ORDER_VERSION_CONFLICT` | 409 | El pedido fue modificado por otro proceso entre la lectura y la escritura. | Releer el pedido, mostrar al usuario qué cambió, reintentar con la versión nueva. **No reintentar automáticamente en ciclo.** |
| `ORDER_NOT_EDITABLE` | 409 | El estado del pedido no admite la modificación pedida. | Consultar `allowedModifications` antes de ofrecer la edición. |
| `ORDER_CONDITION_NOT_MET` | 400 | El pedido dejó de cumplir una condición comercial requerida. | Leer `details` para saber qué línea y qué requisito falla. Informar al usuario qué le falta. |
| `INSUFFICIENT_STOCK` | 409 | No hay stock suficiente para alguna línea. | Consultar disponibilidad y ofrecer un reemplazo en lugar de fallar el pedido completo. |
| `CREDIT_LIMIT_EXCEEDED` | 409 | El total supera el crédito disponible del cliente. | El pedido se puede crear igual: queda en `PENDING_APPROVAL`. No es un error terminal. |

### Ejemplo: conflicto de versión

```jsonc
{
  "error": {
    "code": "ORDER_VERSION_CONFLICT",
    "message": "El pedido fue modificado desde otra sesión.",
    "details": [{ "field": "version", "reason": "STALE_VERSION" }]
  },
  "requestId": "req_demo_789"
}
```

### Ejemplo: stock insuficiente

```jsonc
{
  "error": {
    "code": "INSUFFICIENT_STOCK",
    "message": "No hay stock suficiente para una de las líneas del pedido.",
    "details": [
      { "field": "items[1].quantity", "reason": "ONLY_4_AVAILABLE" }
    ]
  },
  "requestId": "req_demo_812"
}
```

---

## RMA y garantías

| Código | HTTP | Cuándo ocurre | Qué hacer |
|---|---|---|---|
| `SERIAL_NOT_FOUND` | 404 | El número de serie no existe en los registros de Ashir. | Verificar el serial impreso en el producto. Puede haber confusión entre 0 y O, o 1 y I. |
| `SERIAL_NOT_OWNED` | 403 | El serial pertenece a otra cuenta. | **No se devuelve ningún dato del tercero.** Escalar al ejecutivo comercial. |
| `WARRANTY_EXPIRED` | 409 | La garantía del producto venció. | Ofrecer revisión con cargo o consultar una excepción comercial. |
| `RMA_ALREADY_OPEN` | 409 | Ya existe un caso abierto para ese serial. | Consultar el caso existente en lugar de crear uno nuevo. La respuesta incluye su código. |
| `RMA_NOT_ELIGIBLE` | 409 | El producto quedó fuera de cobertura por una condición detectada. | Revisar el diagnóstico técnico y las condiciones marcadas. |

### Nota sobre `SERIAL_NOT_OWNED`

Este error nunca incluye datos del tercero. La respuesta es deliberadamente
pobre en información:

```jsonc
{
  "error": {
    "code": "SERIAL_NOT_OWNED",
    "message": "El producto fue distribuido por Ashir, pero no encontramos una compra asociada a tu cuenta. Contactá a tu ejecutivo para revisar el caso."
  },
  "requestId": "req_demo_c0ffee11"
}
```

Confirmar que el producto es de Ashir es inocuo. Revelar quién lo compró,
cuándo o a qué precio no lo es: permitiría mapear las compras de un competidor
probando seriales.

---

## Pricing

| Código | HTTP | Cuándo ocurre | Qué hacer |
|---|---|---|---|
| `PRICE_NOT_PUBLISHED` | 409 | El producto figura sin precio en la lista vigente. | Mostrar "a consultar" y ofrecer el contacto del ejecutivo. Es un estado normal, no un error del cliente. |
| `CONDITION_NOT_APPLICABLE` | 400 | Se intentó forzar una condición que no aplica al escenario. | Consultar `skippedConditions` de `/pricing/evaluate` para saber el motivo. |
| `SPECIAL_PRICE_EXPIRED` | 409 | El precio especial aprobado venció o agotó su cantidad. | Solicitar una renovación. |

---

## Integraciones y sistema

| Código | HTTP | Cuándo ocurre | Qué hacer |
|---|---|---|---|
| `UPSTREAM_UNAVAILABLE` | 503 | Un sistema del que depende la operación no responde. | Reintentar con backoff exponencial. Si es una lectura, considerar servir la última copia con su fecha. |
| `INTEGRATION_NOT_CONFIGURED` | 409 | El conector no tiene un adaptador definido. | Es el estado actual del ERP de Ashir. No es un fallo transitorio. |
| `INTERNAL_ERROR` | 500 | Error no previsto del servidor. | Reintentar una vez. Si persiste, reportar el `requestId` al soporte. |

---

## Errores de importación

Los errores de importación no son HTTP: vienen por fila en el resultado de la
validación, con su severidad.

| Código | Severidad | Significado |
|---|---|---|
| `REQUIRED_FIELD` | ERROR | Falta un campo obligatorio (SKU, descripción, precio o estado). |
| `DUPLICATE_SKU` | ERROR | El SKU aparece más de una vez en el mismo archivo. |
| `HEADER_NOT_FOUND` | ERROR | No se pudo detectar la fila de encabezados en la hoja. |
| `INVALID_NUMBER` | WARNING | El precio no es numérico; la fila se importa como "consultar". |
| `PRICE_NOT_PUBLISHED` | WARNING | El archivo trae `-` en el precio (típico de productos agotados). |
| `UNKNOWN_STATE` | WARNING | El estado no coincide con los conocidos; se importa como "En stock". |
| `UNMAPPED_SECTION` | WARNING | La sección del listado no tiene una categoría mapeada. |

Un `ERROR` bloquea la fila; un `WARNING` la importa con una decisión documentada.

---

## Estrategia de reintentos

```ts
const RETRYABLE = new Set([
  'RATE_LIMITED',
  'UPSTREAM_UNAVAILABLE',
  'INTERNAL_ERROR',
]);

async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 4): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (!RETRYABLE.has(error.code) || attempt >= maxAttempts - 1) throw error;

      // Respetar Retry-After si viene; si no, backoff exponencial con jitter.
      const wait = error.retryAfter
        ? error.retryAfter * 1000
        : 2 ** attempt * 1000 + Math.random() * 500;

      await sleep(wait);
    }
  }
}
```

**Nunca reintentar** automáticamente:

- `ORDER_VERSION_CONFLICT` — requiere resolver el conflicto, no insistir.
- `VALIDATION_ERROR` — el request está mal formado; reintentar no lo arregla.
- `FORBIDDEN` — falta un permiso; reintentar no lo otorga.
- Cualquier `4xx` que no sea `429`.

Y recordá: **si la operación lleva `Idempotency-Key`, el reintento es seguro.**
Sin ella, no lo es.

---

## Documentos relacionados

- [`API_INTEGRATION_GUIDE.md`](./API_INTEGRATION_GUIDE.md) — guía general.
- [`openapi.yaml`](./openapi.yaml) — especificación formal.
- [`WEBHOOKS.md`](./WEBHOOKS.md) — eventos y entrega.
