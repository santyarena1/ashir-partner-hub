# Webhooks

> **Estado: arquitectura propuesta.** El prototipo genera entregas simuladas
> visibles en `/bo/webhooks`, pero no envía nada a ningún endpoint externo.

Los webhooks permiten que un sistema externo reaccione a lo que pasa en el
Partner Hub sin hacer polling: cuando un pedido cambia de estado o un caso de
garantía se resuelve, Ashir hace un POST al endpoint registrado.

---

## 1. Catálogo de eventos

| Evento | Cuándo se emite |
|---|---|
| `order.created` | Se creó un pedido, en borrador o confirmado. |
| `order.updated` | Cambiaron los ítems, las cantidades o las condiciones. |
| `order.status_changed` | El pedido avanzó en el flujo comercial o logístico. |
| `order.cancelled` | El pedido fue cancelado por el cliente o por Ashir. |
| `special_price.approved` | Una solicitud de precio especial fue aprobada. |
| `rma.created` | Un reseller inició un caso de garantía. |
| `rma.status_changed` | El caso avanzó de etapa. |
| `rma.resolved` | El caso llegó a una resolución final. |
| `customer.updated` | Cambiaron datos comerciales, lista o condición de pago. |
| `product.stock_changed` | Cambió la disponibilidad de un SKU. |
| `price_list.updated` | Se publicó una nueva versión de una lista de precios. |
| `integration.sync_failed` | Una sincronización falló tras agotar los reintentos. |

---

## 2. Forma del evento

Todos los eventos comparten la misma estructura:

```jsonc
{
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
}
```

- **`eventId`** es estable entre reintentos. Es la clave de idempotencia del
  receptor.
- **`type`** determina la forma de `data`.
- **`occurredAt`** es cuándo pasó el hecho, no cuándo se envió la notificación.
  Pueden diferir si hubo reintentos.
- **`apiVersion`** permite evolucionar el payload sin romper suscriptores
  viejos.

### Headers

```
Content-Type: application/json
User-Agent: Ashir-Webhooks/1.0
X-Ashir-Event-Id: evt_1042
X-Ashir-Event-Type: rma.status_changed
X-Ashir-Timestamp: 1758560652000
X-Ashir-Signature: 9f1c2b04...
```

---

## 3. Verificación de la firma

La firma es un HMAC SHA-256 de `timestamp.body` con el secreto del endpoint.

```ts
import crypto from 'node:crypto';

export function verifyAshirWebhook(req: Request, secret: string): boolean {
  const signature = req.headers['x-ashir-signature'] as string;
  const timestamp = req.headers['x-ashir-timestamp'] as string;

  if (!signature || !timestamp) return false;

  // Descarta entregas de más de 5 minutos: evita ataques de repetición
  // con una notificación capturada.
  if (Math.abs(Date.now() - Number(timestamp)) > 300_000) return false;

  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${req.rawBody}`)
    .digest('hex');

  // Comparación en tiempo constante: un `===` filtra información por timing.
  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expected, 'hex'),
  );
}
```

**Tres detalles que suelen fallar al implementar esto:**

1. **Usar el cuerpo crudo, no el parseado.** `JSON.stringify(req.body)` no
   reproduce byte a byte lo que se firmó: cambia el orden de las claves y el
   espaciado. Hay que guardar el raw body antes de parsear.
2. **Verificar el timestamp.** Sin eso, una notificación capturada se puede
   reenviar indefinidamente y la firma va a seguir siendo válida.
3. **Comparar en tiempo constante.** Una comparación con `===` corta en el
   primer byte distinto y permite deducir la firma correcta midiendo tiempos.

---

## 4. Entrega y reintentos

| Aspecto | Comportamiento |
|---|---|
| Timeout | 10 segundos |
| Respuesta esperada | Cualquier `2xx` |
| Reintentos | Hasta 5, con backoff exponencial |
| Intervalos | 30 s, 2 min, 10 min, 1 h, 6 h |
| Reintenta ante | Timeout, `5xx`, error de red |
| No reintenta ante | `4xx` distinto de `429` |
| Dead letter | Tras agotar reintentos, queda para reenvío manual |

Un `4xx` se interpreta como "el receptor rechazó el evento a propósito" y no se
reintenta. Si tu endpoint no puede procesar el evento por un problema temporal
propio, devolvé `503`, no `400`.

---

## 5. Idempotencia del receptor

**El mismo evento puede llegar más de una vez.** Es una garantía *at-least-once*,
no *exactly-once*: si tu endpoint respondió 200 pero la respuesta se perdió en
la red, Ashir va a reintentar.

```ts
app.post('/webhooks/ashir', async (req, res) => {
  if (!verifyAshirWebhook(req, process.env.ASHIR_WEBHOOK_SECRET!)) {
    return res.status(401).end();
  }

  const event = req.body;

  // Idempotencia: si ya lo procesamos, responder 200 sin reprocesar.
  const seen = await db.webhookEvents.findUnique({
    where: { eventId: event.eventId },
  });
  if (seen) return res.status(200).end();

  // Responder rápido y procesar en una cola: el timeout es de 10 s.
  await db.webhookEvents.create({
    data: { eventId: event.eventId, type: event.type, payload: event },
  });
  await queue.enqueue('process-ashir-event', event);

  res.status(200).end();
});
```

El patrón importante es **responder rápido y procesar aparte**. Si el
procesamiento tarda más de 10 segundos, Ashir va a considerar la entrega fallida
y reintentar, generando trabajo duplicado.

---

## 6. Orden de los eventos

**Los eventos no están garantizados en orden.** Un `order.status_changed` a
`SHIPPED` puede llegar antes que el `DELIVERED` que lo precede, si el primero
necesitó reintentos.

Dos formas de manejarlo:

```ts
// Opción A: usar occurredAt para descartar eventos viejos.
if (event.occurredAt < localOrder.updatedAt) return; // ya tenemos algo más nuevo

// Opción B: tratar el evento como un disparador, no como la fuente de verdad.
// Al recibirlo, consultar el recurso completo.
const order = await ashir.get(`/orders/${event.data.orderId}`);
await sync(order);
```

La opción B es más robusta y la recomendada para entidades con estado.

---

## 7. Configuración

Al registrar un endpoint se define:

- **URL** — HTTPS obligatorio.
- **Eventos suscritos** — sólo los que se vayan a usar.
- **Secreto** — para la firma HMAC. Se muestra una sola vez.
- **Ambiente** — sandbox o producción, con secretos distintos.

Buenas prácticas:

- Suscribirse sólo a lo necesario. Menos eventos, menos ruido y menos superficie
  de error.
- Rotar el secreto periódicamente. Durante la rotación, aceptar ambos.
- Registrar un endpoint distinto para sandbox: mezclarlos genera datos de prueba
  en producción.

---

## 8. Probarlo en el prototipo

El prototipo tiene un panel de webhooks en `/bo/webhooks` (rol Administrador)
que muestra:

- Log de entregas con estado, intentos, código de respuesta y duración.
- Payload completo de cada evento.
- Reenvío manual de las entregas fallidas o en dead letter.
- El catálogo de eventos con su descripción.

Las entregas se generan de verdad cuando se opera el portal: crear un pedido,
aprobar un precio especial o resolver un RMA agregan entradas al log. Lo que no
ocurre es el POST a un endpoint externo.

---

## Documentos relacionados

- [`API_INTEGRATION_GUIDE.md`](./API_INTEGRATION_GUIDE.md) — guía general.
- [`openapi.yaml`](./openapi.yaml) — sección `webhooks` de la especificación.
- [`ERROR_CODES.md`](./ERROR_CODES.md) — catálogo de errores.
