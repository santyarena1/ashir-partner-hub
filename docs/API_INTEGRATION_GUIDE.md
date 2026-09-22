# Guía de integración — Ashir Partner Hub API

> **Estado: propuesta.** La API descrita en este documento **todavía no existe**.
> Es el contrato que proponemos implementar. El prototipo resuelve todas estas
> operaciones con un adaptador local; el "Try it" del Centro de Desarrolladores
> nunca sale a internet.

Este documento está pensado para el equipo que vaya a construir la API del lado
de Ashir y para los resellers que quieran conectar su propio sistema.

---

## 1. Para qué sirve esta API

El Partner Hub necesita hablar con tres mundos distintos:

1. **El sistema de gestión de Ashir** — clientes, stock, costos, facturación,
   cuenta corriente, números de serie.
2. **Los sistemas de los resellers** — e-commerce propios, ERPs chicos,
   planillas conectadas.
3. **Servicios auxiliares** — logística, notificaciones, portales de garantía
   de los fabricantes.

La API es el contrato de esas conversaciones. Su objetivo de diseño es que el
frontend nunca dependa de cómo esté implementado el sistema del otro lado.

```
Ashir Partner Hub
      ↓
Integration API  (contrato versionado /v1)
      ↓
Mock Adapter | REST Adapter | ERP Adapter
```

El portal habla **siempre** con la Integration API, nunca con la base de datos
del ERP. Si el ERP cambia, se reemplaza el adaptador.

---

## 2. Primeros pasos

### 2.1 Obtener credenciales

Ashir entrega un `client_id` y un `client_secret` por integración, con los
scopes acordados. Cada integración tiene sus propias credenciales para poder
revocarlas individualmente.

### 2.2 Obtener un token

```bash
curl -X POST "https://api.ashir.com.ar/oauth/token" \
  -H "Content-Type: application/json" \
  -d '{
    "grant_type": "client_credentials",
    "client_id": "'"$ASHIR_CLIENT_ID"'",
    "client_secret": "'"$ASHIR_CLIENT_SECRET"'",
    "scope": "catalog:read pricing:read orders:write"
  }'
```

El token vence a la hora. Renovarlo antes de que expire, no después de recibir
un 401.

### 2.3 Primera llamada

```bash
curl "https://api.ashir.com.ar/v1/products?brandId=brand_msi&inStock=true" \
  -H "Authorization: Bearer $ASHIR_TOKEN" \
  -H "X-Request-Id: req_$(uuidgen)"
```

---

## 3. Convenciones que conviene entender antes de escribir código

### 3.1 Los importes son objetos, no números

```jsonc
// ✅ Correcto
"listPrice": { "amount": "1195.48", "currency": "USD" }

// ❌ Lo que evitamos
"listPrice": 1195.48
```

`amount` es un **string**. Un `number` en JSON es un double IEEE-754 y
`0.1 + 0.2 !== 0.3`. En un sistema que multiplica precios por cantidades y
aplica descuentos encadenados, ese error se acumula. Parsear el string con una
librería decimal del lado del cliente.

### 3.2 Los ids son opacos

`prod_msvg5070tv3o` parece derivable del SKU, y hoy lo es. No lo asumas: el
formato puede cambiar. Si necesitás el SKU, leé el campo `sku`.

El **SKU sí es un identificador comercial estable**: es el código interno de
Ashir, el mismo que figura en la lista de distribuidor y en las facturas.

### 3.3 Fechas con zona horaria, siempre

```
2026-09-22T11:00:00-03:00   ✅
2026-09-22T11:00:00          ❌  ¿en qué zona?
2026-09-22                   ❌  ¿a qué hora vence la promoción?
```

### 3.4 Porcentajes con signo

Un descuento del 4% se expresa como `"-4.00"`, no como `4` ni `0.04`. El signo
evita ambigüedad cuando hay ajustes en ambos sentidos.

---

## 4. Idempotencia

Las operaciones de creación exigen el header `Idempotency-Key`:

- `POST /orders`
- `POST /special-price-requests`
- `POST /rma/cases`

```bash
curl -X POST "https://api.ashir.com.ar/v1/orders" \
  -H "Authorization: Bearer $ASHIR_TOKEN" \
  -H "Idempotency-Key: 9f1c2b04-5f3a-4a6f-9c1e-0b2d7e8a1234" \
  -H "Content-Type: application/json" \
  -d '{ "customerId": "cus_gaming_store", "items": [...] }'
```

**Por qué importa.** Si tu request sufre un timeout, no sabés si el pedido se
creó o no. Sin idempotencia tenés dos opciones malas: reintentar y arriesgar un
pedido duplicado, o no reintentar y arriesgar perderlo. Con la clave podés
reintentar sin miedo: la API devuelve el pedido ya creado.

Reglas:

- La clave la genera el cliente. Un UUID v4 por intención de negocio.
- Es válida por 24 horas.
- La misma clave con un cuerpo distinto devuelve `409 IDEMPOTENCY_KEY_REUSED`.

---

## 5. Concurrencia optimista en pedidos

Un pedido puede ser editado por el reseller desde el portal y por el ejecutivo
comercial desde el backoffice, al mismo tiempo. Sin control, el último en
guardar pisa al otro sin que nadie se entere.

```bash
# 1. Leer el pedido
GET /orders/ord_ash_24853
# → { "data": { "version": 7, ... } }

# 2. Editar enviando la versión leída
PATCH /orders/ord_ash_24853
{ "version": 7, "items": [ { "productId": "...", "quantity": 8 } ] }
```

Si alguien modificó el pedido entre el paso 1 y el 2:

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

**Qué hacer ante un 409:** releer el pedido, mostrarle al usuario qué cambió y
dejarlo decidir. No reintentar en ciclo con la versión nueva: eso es
exactamente lo que el control quería evitar.

El pedido publica en `allowedModifications` qué se puede cambiar en su estado
actual. Consultarlo antes de ofrecer la edición evita 409 evitables.

---

## 6. El precio es explicable, no un número

`POST /pricing/evaluate` no devuelve sólo el precio final:

```jsonc
{
  "data": {
    "basePrice": { "amount": "76.83", "currency": "USD" },
    "adjustments": [
      { "type": "PRICE_LIST",   "label": "LP-PLATINUM-02 · MSI", "percentage": "-5.00" },
      { "type": "PROMOTION",    "label": "MSI Septiembre",        "percentage": "-3.00" },
      { "type": "VOLUME_TIER",  "label": "Volumen · 10+ u.",      "percentage": "-4.00" }
    ],
    "finalUnitPrice": { "amount": "67.97", "currency": "USD" },
    "skippedConditions": [
      { "code": "VOL-GPU-26", "reason": "La categoría del producto es Motherboards" }
    ],
    "missedOpportunities": [
      { "message": "Agregando 15 unidades más pasás al escalón de 5,5%." }
    ]
  }
}
```

Tres cosas que vale la pena aprovechar:

- **`adjustments`**: mostrale al usuario de dónde sale su precio. Un reseller
  que entiende su descuento compra más y consulta menos.
- **`skippedConditions`**: la respuesta a "¿por qué no me hicieron el descuento
  de MSI?" está en el payload, no en una llamada al ejecutivo.
- **`missedOpportunities`**: convertí eso en un aviso en tu carrito. Es el
  mensaje que más aumenta el ticket promedio.

---

## 7. Privacidad en el lookup de serial

Esta es la regla que más atención requiere al implementar el adaptador.

```bash
POST /rma/serials/lookup
{ "serial": "9MSI5070X93821" }
```

**La cuenta se toma del token, nunca del cuerpo del request.** Un número de
serie por sí solo no autoriza a ver nada.

Si el serial pertenece a otro reseller, la respuesta **no incluye el objeto
`record`**:

```jsonc
{
  "data": {
    "status": "NOT_YOUR_ACCOUNT",
    "serial": "M4A7761200341",
    "record": null,
    "message": "El producto fue distribuido por Ashir, pero no encontramos una compra asociada a tu cuenta. Contactá a tu ejecutivo para revisar el caso."
  }
}
```

No se filtra la factura, ni la fecha, ni el precio, ni la razón social del
tercero. Confirmar que el producto es de Ashir es información inocua;
cualquier dato comercial no lo es.

> Un `record` filtrado acá le permitiría a un competidor mapear las compras de
> otro reseller probando seriales. El filtrado tiene que estar en el servidor,
> no en el frontend.

---

## 8. Manejo de errores

```ts
async function createOrder(payload: OrderPayload, attempt = 0) {
  try {
    return await ashir.post('/orders', payload, {
      idempotencyKey: payload.idempotencyKey,
    });
  } catch (error) {
    switch (error.code) {
      case 'ORDER_VERSION_CONFLICT':
        return reconcileAndRetry(payload);

      case 'INSUFFICIENT_STOCK':
        // Ofrecer un reemplazo en lugar de fallar el pedido completo.
        return suggestReplacement(error.details);

      case 'CREDIT_LIMIT_EXCEEDED':
        // El pedido se puede crear igual: queda pendiente de aprobación.
        return createPendingApproval(payload);

      case 'RATE_LIMITED':
      case 'UPSTREAM_UNAVAILABLE':
        if (attempt >= 4) throw error;
        await sleep(2 ** attempt * 1000);
        // El mismo Idempotency-Key evita duplicar.
        return createOrder(payload, attempt + 1);

      default:
        // Reportar el requestId al soporte de Ashir.
        throw error;
    }
  }
}
```

**Usá `code`, no `message`.** El código es estable entre versiones; el mensaje
está escrito para humanos y puede cambiar.

Ver [`ERROR_CODES.md`](./ERROR_CODES.md) para el catálogo completo.

---

## 9. Scopes y qué campos devuelve cada token

Los scopes no sólo habilitan operaciones: **determinan qué campos vienen en la
respuesta**.

| Campo | Requiere | Para un token de reseller |
|---|---|---|
| `product.cost` | `cost:read` | `null` |
| `product.marginPct` | `margin:read` | `null` |
| `specialPriceRequest.resultingMarginPct` | `margin:read` | `null` |
| `customer.internalNotes` | `customers:read` | ausente |

No existen `cost:read` ni `margin:read` para credenciales de reseller. El costo
y el margen de Ashir nunca salen hacia una integración de cliente.

---

## 10. Paginación

```
GET /products?page=1&pageSize=25
```

```jsonc
{
  "data": [ /* … */ ],
  "meta": { "page": 1, "pageSize": 25, "total": 245, "totalPages": 10 },
  "requestId": "req_demo_123"
}
```

`pageSize` máximo: 100. Para sincronizaciones completas conviene iterar por
páginas en lugar de pedir todo junto: mantiene la latencia estable y no
castiga el rate limit.

---

## 11. Trazabilidad

Cada respuesta incluye `requestId`. Guardalo en tus logs.

```
X-Request-Id: req_web_8f2a91bc
```

Si enviás tu propio `X-Request-Id`, la API lo propaga y lo devuelve. Eso
permite correlacionar un problema en tu sistema con la traza del lado de Ashir
sin adivinar.

Cuando reportes un incidente al soporte, el `requestId` es el dato que hace la
diferencia entre "no pudimos reproducirlo" y una respuesta concreta.

---

## 12. Checklist antes de salir a producción

- [ ] Las credenciales están en variables de entorno, no en el código.
- [ ] El token se renueva antes de vencer, no después de un 401.
- [ ] Toda creación envía `Idempotency-Key`.
- [ ] Las ediciones de pedido envían `version` y manejan el 409.
- [ ] Los reintentos usan backoff exponencial y respetan `Retry-After`.
- [ ] Los importes se parsean con una librería decimal, no con `parseFloat`.
- [ ] Los `requestId` quedan en los logs.
- [ ] La integración se probó primero contra sandbox.
- [ ] Los webhooks verifican la firma HMAC y el timestamp.
- [ ] El receptor de webhooks es idempotente por `eventId`.

---

## Documentos relacionados

- [`openapi.yaml`](./openapi.yaml) — especificación formal.
- [`ERP_ADAPTER_GUIDE.md`](./ERP_ADAPTER_GUIDE.md) — cómo conectar el sistema de gestión.
- [`WEBHOOKS.md`](./WEBHOOKS.md) — eventos, firma y reintentos.
- [`ERROR_CODES.md`](./ERROR_CODES.md) — catálogo de errores.
- [`examples/`](./examples/) — requests y responses de ejemplo.
