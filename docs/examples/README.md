# Ejemplos de requests y responses

Payloads representativos del contrato propuesto. Los valores provienen del
dataset del prototipo, de modo que se pueden reproducir con el "Try it" del
Centro de Desarrolladores (`/docs`).

| Archivo | Operación |
|---|---|
| `products-list.json` | `GET /products?brandId=brand_msi&inStock=true` |
| `pricing-evaluate.json` | `POST /pricing/evaluate` |
| `order-create.json` | `POST /orders` |
| `order-version-conflict.json` | `PATCH /orders/{id}` que responde 409 |
| `serial-lookup-in-warranty.json` | `POST /rma/serials/lookup` — serial propio |
| `serial-lookup-other-account.json` | `POST /rma/serials/lookup` — serial de otro reseller |
| `rma-create.json` | `POST /rma/cases` |
| `webhook-rma-resolved.json` | Notificación `rma.resolved` |
| `integration-sync-failed.json` | `POST /integrations/{id}/sync` que falla |
