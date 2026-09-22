/**
 * Genera los payloads de ejemplo de /docs/examples.
 * Los valores salen del dataset del prototipo, así que se pueden reproducir
 * con el "Try it" del Centro de Desarrolladores.
 *
 *   node scripts/gen-examples.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const OUT = 'docs/examples';
fs.mkdirSync(OUT, { recursive: true });
const write = (name, obj) =>
  fs.writeFileSync(path.join(OUT, name), JSON.stringify(obj, null, 2) + '\n');

write('products-list.json', {
  request: {
    method: 'GET',
    path: '/v1/products?brandId=brand_msi&inStock=true&pageSize=2',
    headers: { Authorization: 'Bearer <token>', 'X-Request-Id': 'req_web_8f2a91bc' },
  },
  response: {
    status: 200,
    body: {
      data: [
        {
          id: 'prod_msvg5070tv3o',
          sku: 'MSVG5070TV3O',
          partNumber: 'V513-644R',
          name: 'MSI GEFORCE RTX 5070 Ti VENTUS 3X 16G OC',
          brand: 'MSI',
          brandId: 'brand_msi',
          category: 'GPUs',
          categoryId: 'cat_gpus',
          listPrice: { amount: '1195.48', currency: 'USD' },
          suggestedRetail: { amount: '1446.53', currency: 'USD' },
          vatRate: 0.21,
          cost: null,
          marginPct: null,
          stock: 12,
          incoming: null,
          availability: 'IN_STOCK',
          warrantyMonths: 36,
          specs: ['16GB GDDR7', 'PCIe 5.0', 'TRIPLE FAN'],
          image: null,
        },
        {
          id: 'prod_msmoprb650mb',
          sku: 'MSMOPRB650MB',
          partNumber: '7E26-001R',
          name: 'MSI (SOCKET AM5) PRO B650M-B',
          brand: 'MSI',
          brandId: 'brand_msi',
          category: 'Motherboards',
          categoryId: 'cat_motherboards',
          listPrice: { amount: '76.83', currency: 'USD' },
          suggestedRetail: { amount: '92.96', currency: 'USD' },
          vatRate: 0.21,
          cost: null,
          marginPct: null,
          stock: 64,
          incoming: null,
          availability: 'NEW_ARRIVAL',
          warrantyMonths: 36,
          specs: ['AM5', 'DDR5', 'MICRO-ATX'],
          image: null,
        },
      ],
      meta: { page: 1, pageSize: 2, total: 38, totalPages: 19 },
      requestId: 'req_demo_8f2a91bc',
    },
  },
  notes: 'cost y marginPct llegan en null porque el token no tiene scope cost:read.',
});

write('pricing-evaluate.json', {
  request: {
    method: 'POST',
    path: '/v1/pricing/evaluate',
    headers: { Authorization: 'Bearer <token>', 'Content-Type': 'application/json' },
    body: { productId: 'prod_msmoprb650mb', quantity: 10, paymentTerm: 'TRANSFER_7' },
  },
  response: {
    status: 200,
    body: {
      data: {
        productId: 'prod_msmoprb650mb',
        sku: 'MSMOPRB650MB',
        quantity: 10,
        basePrice: { amount: '76.83', currency: 'USD' },
        adjustments: [
          {
            type: 'PRICE_LIST',
            label: 'LP-PLATINUM-02 · MSI',
            percentage: '-5.00',
            amount: '-3.84',
            note: 'Regla por marca',
          },
          {
            type: 'PROMOTION',
            conditionId: 'cond_msi_sept',
            label: 'MSI Septiembre',
            percentage: '-3.00',
            amount: '-2.19',
            note: 'No acumulable con otras promociones',
          },
          {
            type: 'VOLUME_TIER',
            conditionId: 'cond_volumen_general',
            label: 'Volumen general por unidad · 10+ unidades',
            percentage: '-4.00',
            amount: '-2.83',
          },
        ],
        finalUnitPrice: { amount: '67.97', currency: 'USD' },
        lineTotal: { amount: '679.70', currency: 'USD' },
        totalDiscountPct: '-11.53',
        validUntil: '2026-09-30T23:59:59-03:00',
        explanation:
          'Partiendo de USD 76.83 se aplican LP-PLATINUM-02 · MSI (-5.00%), MSI Septiembre (-3.00%), Volumen general por unidad · 10+ unidades (-4.00%), resultando en USD 67.97 por unidad.',
        appliedConditions: [
          { conditionId: 'cond_msi_sept', code: 'MSI-SEP-26', name: 'MSI Septiembre', effect: '-3%' },
          {
            conditionId: 'cond_volumen_general',
            code: 'VOL-GEN-26',
            name: 'Volumen general por unidad',
            effect: '-4% por 10+ u.',
          },
        ],
        skippedConditions: [
          {
            conditionId: 'cond_volumen_gpu',
            code: 'VOL-GPU-26',
            name: 'Volumen GPUs',
            reason: 'La categoría del producto es Motherboards',
          },
          {
            conditionId: 'cond_pronto_pago',
            code: 'PRONTO-PAGO',
            name: 'Pronto pago',
            reason: 'Ya se aplicó una condición no acumulable de mayor prioridad',
          },
        ],
        missedOpportunities: [
          {
            conditionId: 'cond_volumen_general',
            label: 'Volumen general por unidad · escalón 25+',
            message: 'Agregando 15 unidades más pasás al escalón de 5.50%.',
            potentialPct: '5.50',
            missingUnits: 15,
          },
        ],
        tiers: [
          { minQty: 1, maxQty: 4, discountPct: '-7.53', unitPrice: { amount: '71.04', currency: 'USD' } },
          { minQty: 10, maxQty: 24, discountPct: '-11.53', unitPrice: { amount: '67.97', currency: 'USD' } },
          { minQty: 25, maxQty: 49, discountPct: '-12.95', unitPrice: { amount: '66.88', currency: 'USD' } },
        ],
        bonusUnits: 0,
        freeFreight: false,
        pointsMultiplier: 1,
        requiresApproval: [],
      },
      requestId: 'req_demo_7c19ba4f',
    },
  },
  notes:
    'skippedConditions es lo que hace el precio explicable: responde por qué NO se aplicó un descuento.',
});

write('order-create.json', {
  request: {
    method: 'POST',
    path: '/v1/orders',
    headers: {
      Authorization: 'Bearer <token>',
      'Content-Type': 'application/json',
      'Idempotency-Key': '9f1c2b04-5f3a-4a6f-9c1e-0b2d7e8a1234',
    },
    body: {
      customerId: 'cus_gaming_store',
      items: [
        { productId: 'prod_msmoprb650mb', quantity: 10 },
        { productId: 'prod_ttgace300tgb', quantity: 12 },
      ],
      customerPO: 'OC-2291',
      notes: 'Entregar por la mañana, el depósito cierra a las 13 h.',
      deliveryMethod: 'DELIVERY',
    },
  },
  response: {
    status: 201,
    body: {
      data: {
        id: 'ord_ash_24890',
        number: 'ASH-24890',
        customerId: 'cus_gaming_store',
        customerName: 'Gaming Store',
        status: 'DRAFT',
        version: 1,
        items: [
          {
            id: 'oi_new_0',
            productId: 'prod_msmoprb650mb',
            sku: 'MSMOPRB650MB',
            name: 'MSI (SOCKET AM5) PRO B650M-B',
            quantity: 10,
            unitPrice: { amount: '67.97', currency: 'USD' },
            listPrice: { amount: '76.83', currency: 'USD' },
            discountPct: '-11.53',
            lineTotal: { amount: '679.70', currency: 'USD' },
            appliedConditions: ['MSI-SEP-26', 'VOL-GEN-26'],
            shippedQty: 0,
          },
          {
            id: 'oi_new_1',
            productId: 'prod_ttgace300tgb',
            sku: 'TTGACE300TGB',
            name: 'THERMALTAKE CERES 300 TG ARGB',
            quantity: 12,
            unitPrice: { amount: '82.78', currency: 'USD' },
            listPrice: { amount: '89.98', currency: 'USD' },
            discountPct: '-8.00',
            lineTotal: { amount: '993.36', currency: 'USD' },
            appliedConditions: ['VOL-GEN-26'],
            shippedQty: 0,
          },
        ],
        subtotal: { amount: '1673.06', currency: 'USD' },
        discountTotal: { amount: '162.70', currency: 'USD' },
        taxTotal: { amount: '351.34', currency: 'USD' },
        freight: { amount: '0.00', currency: 'USD' },
        total: { amount: '2024.40', currency: 'USD' },
        paymentTerm: 'TRANSFER_7',
        deliveryMethod: 'DELIVERY',
        customerPO: 'OC-2291',
        allowedModifications: [
          'ADD_ITEM',
          'REMOVE_ITEM',
          'CHANGE_QTY',
          'CHANGE_NOTES',
          'CHANGE_DELIVERY',
          'CANCEL',
        ],
        requiredApprovals: [],
        createdAt: '2026-09-22T11:12:44-03:00',
        updatedAt: '2026-09-22T11:12:44-03:00',
      },
      requestId: 'req_demo_0a7bd913',
    },
  },
  notes: 'El flete es 0 porque el pedido supera el mínimo de envío bonificado de la zona AMBA.',
});

write('order-version-conflict.json', {
  request: {
    method: 'PATCH',
    path: '/v1/orders/ord_ash_24853',
    headers: { Authorization: 'Bearer <token>', 'Content-Type': 'application/json' },
    body: { version: 7, items: [{ productId: 'prod_msmoprb650mb', quantity: 8 }] },
  },
  response: {
    status: 409,
    body: {
      error: {
        code: 'ORDER_VERSION_CONFLICT',
        message:
          'El pedido fue modificado desde otra sesión. Volvé a cargarlo para ver los cambios antes de editar.',
        details: [{ field: 'version', reason: 'STALE_VERSION' }],
      },
      requestId: 'req_demo_789',
    },
  },
  notes:
    'El cliente debe releer el pedido (que estará en version 8), mostrar qué cambió y dejar decidir al usuario. No reintentar en ciclo.',
});

write('serial-lookup-in-warranty.json', {
  request: {
    method: 'POST',
    path: '/v1/rma/serials/lookup',
    headers: { Authorization: 'Bearer <token de Gaming Store>', 'Content-Type': 'application/json' },
    body: { serial: '9MSI5070X93821' },
  },
  response: {
    status: 200,
    body: {
      data: {
        status: 'IN_WARRANTY',
        serial: '9MSI5070X93821',
        warrantyDaysRemaining: 906,
        message: 'Producto en garantía hasta el 17/03/2029.',
        record: {
          serial: '9MSI5070X93821',
          sku: 'MSVG5070TV3O',
          productName: 'MSI GEFORCE RTX 5070 Ti VENTUS 3X 16G OC',
          brand: 'MSI',
          category: 'GPUs',
          orderNumber: 'ASH-24853',
          invoiceNumber: 'FA-0004-00012831',
          purchasedAt: '2026-03-17T11:40:00-03:00',
          warrantyMonths: 36,
          warrantyExpiresAt: '2029-03-17T11:40:00-03:00',
          lotId: 'LOTE-MSI-260326-A',
          openRmaId: null,
          replacedBySerial: null,
        },
        eligibility: {
          eligible: true,
          requiresManualReview: false,
          policyId: 'wp_msi_gpu',
          policyName: 'MSI · Placas de video',
          warrantyMonths: 36,
          expiresAt: '2029-03-17T11:40:00-03:00',
          reasons: ['Cubierto por la política MSI · Placas de video (36 meses desde la compra).'],
          flags: [],
        },
      },
      requestId: 'req_demo_b4710d28',
    },
  },
  notes: 'La cuenta se resuelve desde el token. El cuerpo sólo lleva el serial.',
});

write('serial-lookup-other-account.json', {
  request: {
    method: 'POST',
    path: '/v1/rma/serials/lookup',
    headers: { Authorization: 'Bearer <token de Gaming Store>', 'Content-Type': 'application/json' },
    body: { serial: 'M4A7761200341' },
  },
  response: {
    status: 200,
    body: {
      data: {
        status: 'NOT_YOUR_ACCOUNT',
        serial: 'M4A7761200341',
        record: null,
        warrantyDaysRemaining: null,
        eligibility: null,
        message:
          'El producto fue distribuido por Ashir, pero no encontramos una compra asociada a tu cuenta. Contactá a tu ejecutivo para revisar el caso.',
      },
      requestId: 'req_demo_c0ffee11',
    },
  },
  notes:
    'REGLA CRÍTICA: record llega en null. No se expone factura, fecha, precio ni razón social del tercero. El filtrado tiene que estar en el servidor, no en el frontend.',
});

write('rma-create.json', {
  request: {
    method: 'POST',
    path: '/v1/rma/cases',
    headers: {
      Authorization: 'Bearer <token>',
      'Content-Type': 'application/json',
      'Idempotency-Key': 'c4d1f2a8-9b3e-4c7d-8e1f-2a3b4c5d6e7f',
    },
    body: {
      serials: ['9MSI5070X93821'],
      problemType: 'NO_VIDEO',
      description:
        'El equipo enciende pero no da imagen. Se probaron dos monitores y tres cables diferentes.',
      answers: [
        { question: 'La placa da imagen?', answer: 'No' },
        { question: 'Fue probada en otro equipo?', answer: 'Sí' },
        { question: 'Se probaron otros cables de alimentación?', answer: 'Sí' },
      ],
      troubleshootingOutcome: 'ALREADY_TRIED',
      logisticsMode: 'CARRIER',
    },
  },
  response: {
    status: 201,
    body: {
      data: {
        id: 'rma_rma_260201',
        code: 'RMA-260201',
        customerId: 'cus_gaming_store',
        customerName: 'Gaming Store',
        status: 'SUBMITTED',
        isBatch: false,
        units: [
          {
            id: 'unit_RMA-260201_0',
            serial: '9MSI5070X93821',
            sku: 'MSVG5070TV3O',
            productName: 'MSI GEFORCE RTX 5070 Ti VENTUS 3X 16G OC',
            brand: 'MSI',
            lotId: 'LOTE-MSI-260326-A',
            problemType: 'NO_VIDEO',
            problemLabel: 'Sin imagen',
            status: 'SUBMITTED',
          },
        ],
        logistics: {
          mode: 'CARRIER',
          remitNumber: null,
          labelCode: 'ETQ-RMA-260201',
          carrier: 'Andreani',
          expectedUnits: 1,
          receivedUnits: 0,
        },
        sla: {
          stage: 'VALIDATION',
          targetHours: 24,
          elapsedHours: 0,
          remainingHours: 24,
          breached: false,
          pausedReason: null,
          dueAt: '2026-09-23T11:20:00-03:00',
        },
        createdAt: '2026-09-22T11:20:00-03:00',
        closedAt: null,
      },
      requestId: 'req_demo_77ad2e51',
    },
  },
  notes: 'El remito se emite cuando Ashir aprueba la recepción, no al crear el caso.',
});

write('webhook-rma-resolved.json', {
  delivery: {
    method: 'POST',
    url: 'https://hooks.partner.example/ashir',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Ashir-Webhooks/1.0',
      'X-Ashir-Event-Id': 'evt_1087',
      'X-Ashir-Event-Type': 'rma.resolved',
      'X-Ashir-Timestamp': '1758560652000',
      'X-Ashir-Signature': '9f1c2b04a7e3...',
    },
  },
  body: {
    eventId: 'evt_1087',
    type: 'rma.resolved',
    occurredAt: '2026-09-22T11:31:07-03:00',
    apiVersion: '2026-09-01',
    data: {
      rmaId: 'rma_rma_260155',
      code: 'RMA-260155',
      customerId: 'cus_gaming_store',
      serial: '9MSI4410233',
      resolution: 'REPLACED_NEW',
      replacementSerial: '9MSI4410233-R',
      replacementSku: 'MSVG5070TV3O',
      resultingWarrantyExpiresAt: '2029-03-17T11:40:00-03:00',
      approvedBy: 'Javier Ocampo',
    },
  },
  expectedResponse: { status: 200, body: '' },
  notes:
    'eventId es estable entre reintentos: el receptor lo usa para descartar duplicados. La firma se calcula sobre timestamp + punto + rawBody.',
});

write('integration-sync-failed.json', {
  request: {
    method: 'POST',
    path: '/v1/integrations/int_erp/sync',
    headers: { Authorization: 'Bearer <token>', 'Content-Type': 'application/json' },
    body: { entities: ['products', 'stock', 'costs'] },
  },
  response: {
    status: 503,
    body: {
      error: {
        code: 'UPSTREAM_UNAVAILABLE',
        message: 'No se pudo establecer conexión con el servicio remoto (timeout tras 3 reintentos).',
      },
      requestId: 'req_demo_f1a20c93',
    },
  },
  sideEffect: {
    runRecorded: {
      id: 'run_1758561234',
      integrationId: 'int_erp',
      process: 'Sincronización manual',
      direction: 'BIDIRECTIONAL',
      records: 0,
      durationMs: 12400,
      result: 'FAILED',
      errors: ['No se pudo establecer conexión con el servicio remoto (timeout tras 3 reintentos).'],
      requestId: 'req_demo_f1a20c93',
      summary: 'La ejecución falló. El conector reintentará según su política.',
    },
    webhookEmitted: 'integration.sync_failed',
  },
  notes: 'La ejecución fallida queda registrada igual: es lo que permite diagnosticar sin adivinar.',
});

console.log('[examples] payloads escritos en ' + OUT);
