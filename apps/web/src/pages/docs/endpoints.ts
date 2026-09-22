/**
 * Catálogo de endpoints del Centro de Desarrolladores.
 *
 * Los que tienen `tryIt` se pueden ejecutar contra el adaptador mock local:
 * nunca contra una API productiva, porque todavía no existe.
 */
import type { Scope } from '@/types';

export interface EndpointParam {
  name: string;
  in: 'path' | 'query' | 'body' | 'header';
  type: string;
  required?: boolean;
  description: string;
  example?: string;
}

export interface EndpointDoc {
  id: string;
  section: string;
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  summary: string;
  description: string;
  scopes: Scope[];
  params: EndpointParam[];
  requestBody?: unknown;
  responseExample: unknown;
  errors: { code: string; status: number; description: string }[];
  /** Identificador de la operación ejecutable contra el mock. */
  tryIt?: 'products' | 'product' | 'pricing' | 'orders' | 'order' | 'serial' | 'rmaCases' | 'rmaCase' | 'pmDashboard' | 'integrations' | 'integrationRuns';
  /** Cuando es true, el endpoint se documenta como alcance futuro. */
  future?: boolean;
}

const STD_ERRORS = [
  { code: 'UNAUTHENTICATED', status: 401, description: 'Falta el token o está vencido.' },
  { code: 'FORBIDDEN', status: 403, description: 'El scope del token no alcanza para esta operación.' },
  { code: 'RATE_LIMITED', status: 429, description: 'Se superó el límite de requests del período.' },
];

export const SECTIONS = [
  { id: 'introduccion', label: 'Introducción' },
  { id: 'inicio-rapido', label: 'Inicio rápido' },
  { id: 'autenticacion', label: 'Autenticación' },
  { id: 'ambientes', label: 'Ambientes' },
  { id: 'convenciones', label: 'Convenciones' },
  { id: 'catalogo', label: 'Catálogo' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'clientes', label: 'Clientes' },
  { id: 'pedidos', label: 'Pedidos' },
  { id: 'rma', label: 'RMA' },
  { id: 'beneficios', label: 'Beneficios' },
  { id: 'pm', label: 'Product Management' },
  { id: 'sincronizacion', label: 'Sincronización ERP' },
  { id: 'webhooks', label: 'Webhooks' },
  { id: 'errores', label: 'Errores' },
  { id: 'changelog', label: 'Changelog' },
] as const;

export const ENDPOINTS: EndpointDoc[] = [
  /* ---------------- catálogo ---------------- */
  {
    id: 'list-products',
    section: 'catalogo',
    method: 'GET',
    path: '/products',
    summary: 'Listar productos',
    description:
      'Devuelve el catálogo paginado con filtros por texto, marca, categoría, stock, promoción y rango de precio. El precio devuelto ya considera la lista del cliente del token.',
    scopes: ['catalog:read'],
    params: [
      { name: 'query', in: 'query', type: 'string', description: 'Busca en nombre, SKU, part number, marca y categoría.', example: 'rtx 5070' },
      { name: 'sku', in: 'query', type: 'string', description: 'Coincidencia parcial por código interno.', example: 'MSVG' },
      { name: 'brandId', in: 'query', type: 'string', description: 'Id opaco de la marca.', example: 'brand_msi' },
      { name: 'categoryId', in: 'query', type: 'string', description: 'Id opaco de la categoría.', example: 'cat_gpus' },
      { name: 'inStock', in: 'query', type: 'boolean', description: 'Solo productos con stock disponible.' },
      { name: 'promotionId', in: 'query', type: 'string', description: 'Productos alcanzados por una promoción.' },
      { name: 'minPrice', in: 'query', type: 'number', description: 'Precio mínimo en USD.' },
      { name: 'maxPrice', in: 'query', type: 'number', description: 'Precio máximo en USD.' },
      { name: 'sort', in: 'query', type: 'string', description: 'relevance | price_asc | price_desc | best_sellers | newest | stock_desc', example: 'best_sellers' },
      { name: 'page', in: 'query', type: 'integer', description: 'Página, base 1.', example: '1' },
      { name: 'pageSize', in: 'query', type: 'integer', description: 'Tamaño de página, máximo 100.', example: '24' },
    ],
    responseExample: {
      data: [
        {
          id: 'prod_msvg5070tv3o',
          sku: 'MSVG5070TV3O',
          partNumber: 'V513-644R',
          name: 'MSI GEFORCE RTX 5070 Ti VENTUS 3X 16G OC',
          brand: 'MSI',
          category: 'GPUs',
          listPrice: { amount: '1195.48', currency: 'USD' },
          vatRate: 0.21,
          stock: 12,
          availability: 'IN_STOCK',
          warrantyMonths: 36,
        },
      ],
      meta: { page: 1, pageSize: 24, total: 245, totalPages: 11 },
      requestId: 'req_demo_8f2a91bc',
    },
    errors: STD_ERRORS,
    tryIt: 'products',
  },
  {
    id: 'get-product',
    section: 'catalogo',
    method: 'GET',
    path: '/products/{productId}',
    summary: 'Detalle de producto',
    description: 'Ficha completa del producto. Los campos `cost` y `marginPct` solo se devuelven a tokens con scope `cost:read`.',
    scopes: ['catalog:read'],
    params: [{ name: 'productId', in: 'path', type: 'string', required: true, description: 'Id opaco o SKU del producto.', example: 'MSVG5070TV3O' }],
    responseExample: {
      data: {
        id: 'prod_msvg5070tv3o',
        sku: 'MSVG5070TV3O',
        name: 'MSI GEFORCE RTX 5070 Ti VENTUS 3X 16G OC',
        brand: 'MSI',
        category: 'GPUs',
        listPrice: { amount: '1195.48', currency: 'USD' },
        suggestedRetail: { amount: '1446.53', currency: 'USD' },
        stock: 12,
        availability: 'IN_STOCK',
        specs: ['16GB GDDR7', 'PCIe 5.0', 'TRIPLE FAN'],
        warrantyMonths: 36,
      },
      requestId: 'req_demo_44c1ed09',
    },
    errors: [...STD_ERRORS, { code: 'RESOURCE_NOT_FOUND', status: 404, description: 'No existe un producto con ese id o SKU.' }],
    tryIt: 'product',
  },
  {
    id: 'availability',
    section: 'catalogo',
    method: 'GET',
    path: '/products/{productId}/availability',
    summary: 'Disponibilidad de un producto',
    description: 'Stock actual y próximo ingreso previsto. Pensado para consultas frecuentes desde un e-commerce del reseller.',
    scopes: ['catalog:read'],
    params: [{ name: 'productId', in: 'path', type: 'string', required: true, description: 'Id del producto.' }],
    responseExample: {
      data: { productId: 'prod_msvg5070tv3o', stock: 12, availability: 'IN_STOCK', incoming: null },
      requestId: 'req_demo_2b71fa30',
    },
    errors: [...STD_ERRORS, { code: 'RESOURCE_NOT_FOUND', status: 404, description: 'Producto inexistente.' }],
  },
  {
    id: 'brands',
    section: 'catalogo',
    method: 'GET',
    path: '/brands',
    summary: 'Listar marcas',
    description: 'Marcas representadas con su cantidad de SKUs y las categorías en las que participan.',
    scopes: ['catalog:read'],
    params: [],
    responseExample: {
      data: [{ id: 'brand_thermaltake', name: 'THERMALTAKE', skuCount: 61, categories: ['Gabinetes', 'Refrigeración', 'Fuentes'] }],
      requestId: 'req_demo_91ab0c22',
    },
    errors: STD_ERRORS,
  },

  /* ---------------- pricing ---------------- */
  {
    id: 'evaluate-pricing',
    section: 'pricing',
    method: 'POST',
    path: '/pricing/evaluate',
    summary: 'Evaluar precio',
    description:
      'Devuelve el precio **explicado**: precio base, cada ajuste aplicado con su origen, el precio final y qué condiciones no se aplicaron y por qué. Es el endpoint que usa todo el portal.',
    scopes: ['pricing:read'],
    params: [
      { name: 'productId', in: 'body', type: 'string', required: true, description: 'Id o SKU del producto.' },
      { name: 'quantity', in: 'body', type: 'integer', required: true, description: 'Cantidad a cotizar.' },
      { name: 'paymentTerm', in: 'body', type: 'string', description: 'Condición de pago a simular.' },
      { name: 'date', in: 'body', type: 'string', description: 'Fecha ISO 8601 de evaluación. Por defecto, ahora.' },
    ],
    requestBody: { productId: 'prod_msmoprb650mb', quantity: 10, paymentTerm: 'TRANSFER_7' },
    responseExample: {
      data: {
        productId: 'prod_msmoprb650mb',
        sku: 'MSMOPRB650MB',
        quantity: 10,
        basePrice: { amount: '76.83', currency: 'USD' },
        adjustments: [
          { type: 'PRICE_LIST', label: 'LP-PLATINUM-02 · MSI', percentage: '-5.00', amount: '-3.84' },
          { type: 'PROMOTION', label: 'MSI Septiembre', percentage: '-3.00', amount: '-2.19' },
          { type: 'VOLUME_TIER', label: 'Volumen general por unidad · 10+ unidades', percentage: '-4.00', amount: '-2.83' },
        ],
        finalUnitPrice: { amount: '67.97', currency: 'USD' },
        lineTotal: { amount: '679.70', currency: 'USD' },
        totalDiscountPct: '-11.53',
        validUntil: '2026-09-30T23:59:59-03:00',
        explanation: 'Partiendo de USD 76.83 se aplican…',
      },
      requestId: 'req_demo_7c19ba4f',
    },
    errors: [...STD_ERRORS, { code: 'RESOURCE_NOT_FOUND', status: 404, description: 'Producto inexistente.' }],
    tryIt: 'pricing',
  },
  {
    id: 'price-lists',
    section: 'pricing',
    method: 'GET',
    path: '/price-lists',
    summary: 'Listar listas de precios',
    description: 'Listas configuradas con su ajuste base, reglas por marca o categoría y overrides por SKU.',
    scopes: ['pricing:read'],
    params: [],
    responseExample: {
      data: [{ id: 'pl_platinum_02', code: 'LP-PLATINUM-02', segment: 'PLATINUM', baseAdjustmentPct: '-4.00', customerCount: 4 }],
      requestId: 'req_demo_1f87ca02',
    },
    errors: STD_ERRORS,
  },
  {
    id: 'simulate-condition',
    section: 'pricing',
    method: 'POST',
    path: '/commercial-conditions/{conditionId}/simulate',
    summary: 'Simular una condición comercial',
    description: 'Evalúa un escenario completo (cliente, producto, cantidad, fecha, pago) y devuelve qué condiciones aplicarían y cuáles no.',
    scopes: ['pricing:manage'],
    params: [{ name: 'conditionId', in: 'path', type: 'string', required: true, description: 'Id de la condición a simular.' }],
    requestBody: { customerId: 'cus_gaming_store', productId: 'prod_msmoprb650mb', quantity: 10, date: '2026-09-22T00:00:00-03:00', paymentTerm: 'TRANSFER_7' },
    responseExample: {
      data: {
        appliedConditions: [{ conditionId: 'cond_msi_sept', code: 'MSI-SEP-26', effect: '-3%' }],
        skippedConditions: [{ conditionId: 'cond_volumen_gpu', code: 'VOL-GPU-26', reason: 'La categoría del producto es Motherboards' }],
      },
      requestId: 'req_demo_55ea31b0',
    },
    errors: STD_ERRORS,
    future: true,
  },

  /* ---------------- pedidos ---------------- */
  {
    id: 'list-orders',
    section: 'pedidos',
    method: 'GET',
    path: '/orders',
    summary: 'Listar pedidos',
    description: 'Pedidos visibles para el token. Un token de reseller solo ve los suyos.',
    scopes: ['orders:read'],
    params: [
      { name: 'status', in: 'query', type: 'string', description: 'Filtra por estado del pedido.', example: 'PICKING' },
      { name: 'customerId', in: 'query', type: 'string', description: 'Solo para tokens internos.' },
      { name: 'page', in: 'query', type: 'integer', description: 'Página, base 1.' },
    ],
    responseExample: {
      data: [
        {
          id: 'ord_ash_24853',
          number: 'ASH-24853',
          status: 'DELIVERED',
          version: 8,
          total: { amount: '7842.16', currency: 'USD' },
          createdAt: '2026-03-14T10:22:00-03:00',
        },
      ],
      meta: { page: 1, pageSize: 25, total: 35, totalPages: 2 },
      requestId: 'req_demo_6d0e41ab',
    },
    errors: STD_ERRORS,
    tryIt: 'orders',
  },
  {
    id: 'create-order',
    section: 'pedidos',
    method: 'POST',
    path: '/orders',
    summary: 'Crear pedido',
    description:
      'Crea un pedido en estado borrador. Requiere `Idempotency-Key`: reenviar el mismo key devuelve el pedido ya creado en lugar de duplicarlo.',
    scopes: ['orders:write'],
    params: [
      { name: 'Idempotency-Key', in: 'header', type: 'string', required: true, description: 'Clave única de la operación, generada por el cliente.' },
      { name: 'customerId', in: 'body', type: 'string', required: true, description: 'Cuenta del reseller.' },
      { name: 'items', in: 'body', type: 'array', required: true, description: 'Líneas del pedido: productId y quantity.' },
      { name: 'customerPO', in: 'body', type: 'string', description: 'Orden de compra del cliente.' },
    ],
    requestBody: {
      customerId: 'cus_gaming_store',
      items: [
        { productId: 'prod_msmoprb650mb', quantity: 10 },
        { productId: 'prod_ttgace300tgb', quantity: 12 },
      ],
      customerPO: 'OC-2291',
      notes: 'Entregar por la mañana.',
    },
    responseExample: {
      data: { id: 'ord_ash_24890', number: 'ASH-24890', status: 'DRAFT', version: 1, total: { amount: '1908.44', currency: 'USD' } },
      requestId: 'req_demo_0a7bd913',
    },
    errors: [
      ...STD_ERRORS,
      { code: 'ORDER_CONDITION_NOT_MET', status: 400, description: 'El pedido no cumple una condición requerida.' },
      { code: 'INSUFFICIENT_STOCK', status: 409, description: 'No hay stock suficiente para alguna línea.' },
      { code: 'CREDIT_LIMIT_EXCEEDED', status: 409, description: 'El total supera el crédito disponible del cliente.' },
    ],
  },
  {
    id: 'update-order',
    section: 'pedidos',
    method: 'PATCH',
    path: '/orders/{orderId}',
    summary: 'Modificar pedido',
    description:
      'Modifica ítems, cantidades u observaciones. Usa concurrencia optimista: hay que enviar la `version` que se leyó. Si el pedido cambió en otra sesión, responde 409.',
    scopes: ['orders:write'],
    params: [
      { name: 'orderId', in: 'path', type: 'string', required: true, description: 'Id del pedido.' },
      { name: 'If-Match', in: 'header', type: 'string', description: 'Alternativa a `version` en el cuerpo.' },
      { name: 'version', in: 'body', type: 'integer', required: true, description: 'Versión leída del pedido.' },
      { name: 'items', in: 'body', type: 'array', description: 'Nuevo set completo de líneas.' },
    ],
    requestBody: { version: 7, items: [{ productId: 'prod_msmoprb650mb', quantity: 8 }] },
    responseExample: {
      data: { id: 'ord_ash_24853', number: 'ASH-24853', version: 8, total: { amount: '6120.44', currency: 'USD' } },
      requestId: 'req_demo_3e91c7da',
    },
    errors: [
      ...STD_ERRORS,
      { code: 'ORDER_VERSION_CONFLICT', status: 409, description: 'El pedido fue modificado por otro proceso.' },
      { code: 'ORDER_NOT_EDITABLE', status: 409, description: 'El estado del pedido no admite modificaciones.' },
    ],
  },
  {
    id: 'order-audit',
    section: 'pedidos',
    method: 'GET',
    path: '/orders/{orderId}/audit-log',
    summary: 'Historial del pedido',
    description: 'Registro inmutable de cambios: cada evento agrega una entrada, nunca reemplaza la anterior.',
    scopes: ['orders:read'],
    params: [{ name: 'orderId', in: 'path', type: 'string', required: true, description: 'Id del pedido.' }],
    responseExample: {
      data: [
        { id: 'aud_hero3', at: '2026-03-14T11:31:00-03:00', actor: 'Martín Rodríguez', actorRole: 'SALES', action: 'Comercial modificó cantidad 5 → 10', origin: 'PORTAL', requestId: 'req_demo_aa11' },
      ],
      requestId: 'req_demo_9c02fe17',
    },
    errors: STD_ERRORS,
    tryIt: 'order',
  },

  /* ---------------- RMA ---------------- */
  {
    id: 'serial-lookup',
    section: 'rma',
    method: 'POST',
    path: '/rma/serials/lookup',
    summary: 'Buscar por número de serie',
    description:
      'Recupera producto, pedido, factura y garantía de un serial. **La cuenta se toma del token, nunca del cuerpo**: si el serial pertenece a otro reseller, la respuesta no incluye ningún dato comercial del tercero.',
    scopes: ['rma:read'],
    params: [{ name: 'serial', in: 'body', type: 'string', required: true, description: 'Número de serie impreso en el producto.', example: '9MSI5070X93821' }],
    requestBody: { serial: '9MSI5070X93821' },
    responseExample: {
      data: {
        status: 'IN_WARRANTY',
        serial: '9MSI5070X93821',
        record: {
          sku: 'MSVG5070TV3O',
          productName: 'MSI GEFORCE RTX 5070 Ti VENTUS 3X 16G OC',
          orderNumber: 'ASH-24853',
          invoiceNumber: 'FA-0004-00012831',
          purchasedAt: '2026-03-17T11:40:00-03:00',
          warrantyMonths: 36,
          warrantyExpiresAt: '2029-03-17T11:40:00-03:00',
          lotId: 'LOTE-MSI-260326-A',
        },
        warrantyDaysRemaining: 906,
      },
      requestId: 'req_demo_b4710d28',
    },
    errors: [
      ...STD_ERRORS,
      { code: 'SERIAL_NOT_FOUND', status: 404, description: 'El serial no existe en los registros de Ashir.' },
      { code: 'SERIAL_NOT_OWNED', status: 403, description: 'El serial pertenece a otra cuenta: no se devuelven datos del tercero.' },
    ],
    tryIt: 'serial',
  },
  {
    id: 'list-rma',
    section: 'rma',
    method: 'GET',
    path: '/rma/cases',
    summary: 'Listar casos de garantía',
    description: 'Casos visibles para el token, con su etapa, unidades y estado de SLA.',
    scopes: ['rma:read'],
    params: [
      { name: 'status', in: 'query', type: 'string', description: 'Filtra por etapa del caso.' },
      { name: 'breachedOnly', in: 'query', type: 'boolean', description: 'Solo casos fuera de SLA.' },
    ],
    responseExample: {
      data: [
        {
          id: 'rma_rma_260194',
          code: 'RMA-260194',
          status: 'DIAGNOSIS',
          isBatch: true,
          units: 4,
          sla: { stage: 'DIAGNOSIS', targetHours: 72, remainingHours: 18, breached: false },
        },
      ],
      meta: { page: 1, pageSize: 25, total: 28, totalPages: 2 },
      requestId: 'req_demo_e21c0b7a',
    },
    errors: STD_ERRORS,
    tryIt: 'rmaCases',
  },
  {
    id: 'create-rma',
    section: 'rma',
    method: 'POST',
    path: '/rma/cases',
    summary: 'Crear caso de garantía',
    description:
      'Crea una gestión con uno o varios seriales bajo una misma logística. Requiere `Idempotency-Key`. Todos los seriales deben pertenecer a la cuenta del token.',
    scopes: ['rma:write'],
    params: [
      { name: 'Idempotency-Key', in: 'header', type: 'string', required: true, description: 'Clave única de la operación.' },
      { name: 'serials', in: 'body', type: 'array', required: true, description: 'Seriales a gestionar.' },
      { name: 'problemType', in: 'body', type: 'string', required: true, description: 'NO_POWER | NO_VIDEO | INTERMITTENT | …' },
      { name: 'description', in: 'body', type: 'string', required: true, description: 'Descripción del problema.' },
    ],
    requestBody: {
      serials: ['9MSI5070X93821'],
      problemType: 'NO_VIDEO',
      description: 'El equipo enciende pero no da imagen. Probado con dos monitores y tres cables.',
      answers: [{ question: '¿Fue probada en otro equipo?', answer: 'Sí' }],
      logisticsMode: 'CARRIER',
    },
    responseExample: {
      data: { id: 'rma_rma_260201', code: 'RMA-260201', status: 'SUBMITTED', units: 1, sla: { stage: 'VALIDATION', targetHours: 24 } },
      requestId: 'req_demo_77ad2e51',
    },
    errors: [
      ...STD_ERRORS,
      { code: 'SERIAL_NOT_FOUND', status: 400, description: 'Alguno de los seriales no existe.' },
      { code: 'SERIAL_NOT_OWNED', status: 403, description: 'Alguno de los seriales pertenece a otra cuenta.' },
      { code: 'RMA_ALREADY_OPEN', status: 409, description: 'Ya existe un caso abierto para ese serial.' },
    ],
  },
  {
    id: 'rma-timeline',
    section: 'rma',
    method: 'GET',
    path: '/rma/cases/{rmaId}/timeline',
    summary: 'Timeline del caso',
    description: 'Eventos del caso con fecha, responsable, comentario y documentos asociados.',
    scopes: ['rma:read'],
    params: [{ name: 'rmaId', in: 'path', type: 'string', required: true, description: 'Id o código del caso.', example: 'RMA-260194' }],
    responseExample: {
      data: [
        { id: 'tl_1', at: '2026-09-13T10:00:00-03:00', status: 'SUBMITTED', label: 'Solicitud creada', actor: 'Gaming Store', actorRole: 'CLIENT' },
        { id: 'tl_2', at: '2026-09-14T09:12:00-03:00', status: 'ASHIR_VALIDATION', label: 'Validación Ashir', actor: 'Javier Ocampo', actorRole: 'RMA' },
      ],
      requestId: 'req_demo_31fa0e8c',
    },
    errors: [...STD_ERRORS, { code: 'RESOURCE_NOT_FOUND', status: 404, description: 'Caso inexistente.' }],
    tryIt: 'rmaCase',
  },
  {
    id: 'rma-analytics',
    section: 'rma',
    method: 'GET',
    path: '/rma/analytics',
    summary: 'Analytics de calidad',
    description: 'Tasa de RMA por marca, motivos, evolución mensual, SKUs con desvío y lotes sospechosos.',
    scopes: ['pm:read'],
    params: [{ name: 'brandId', in: 'query', type: 'string', required: true, description: 'Marca a analizar.', example: 'brand_msi' }],
    responseExample: {
      data: {
        brand: 'MSI',
        unitsSold: 31_204,
        rmaCount: 43,
        rmaRatePct: '0.14',
        topSkus: [{ sku: 'MSMOPRB650MB', ratePct: '0.34', vsBrandAvg: '2.4×', alert: true }],
      },
      requestId: 'req_demo_5b9c1a70',
    },
    errors: STD_ERRORS,
  },

  /* ---------------- PM ---------------- */
  {
    id: 'pm-dashboard',
    section: 'pm',
    method: 'GET',
    path: '/pm/brands/{brandId}/dashboard',
    summary: 'Dashboard de marca',
    description: 'Ventas, margen, stock valorizado, cobertura, objetivo, mix de categorías, top SKUs y stock aging.',
    scopes: ['pm:read'],
    params: [{ name: 'brandId', in: 'path', type: 'string', required: true, description: 'Id de la marca.', example: 'brand_msi' }],
    responseExample: {
      data: {
        brand: 'MSI',
        salesMonth: { amount: '184320.00', currency: 'USD' },
        salesMonthVsPrevPct: '8.4',
        grossMarginPct: '19.7',
        stockValue: { amount: '412880.00', currency: 'USD' },
        coverageDays: 47,
        targetProgressPct: 88,
      },
      requestId: 'req_demo_c8014fa2',
    },
    errors: STD_ERRORS,
    tryIt: 'pmDashboard',
  },
  {
    id: 'pm-simulation',
    section: 'pm',
    method: 'POST',
    path: '/pm/commercial-simulations',
    summary: 'Simulación comercial',
    description: 'Calcula el impacto de un descuento sobre margen, facturación y stock, con sensibilidad al tipo de cambio.',
    scopes: ['pm:manage'],
    params: [],
    requestBody: { productId: 'prod_msvg5070tv3o', discountPct: 8, expectedUnits: 40, fxRate: 1412 },
    responseExample: {
      data: { newPrice: 1099.84, marginPct: 12.4, marginUsd: 136.38, revenueEstimate: 43_993.6, fullStockImpact: -1148.0 },
      requestId: 'req_demo_af23d190',
    },
    errors: STD_ERRORS,
    future: true,
  },

  /* ---------------- integraciones ---------------- */
  {
    id: 'list-integrations',
    section: 'sincronizacion',
    method: 'GET',
    path: '/integrations',
    summary: 'Listar integraciones',
    description: 'Estado de cada conector, entidades habilitadas, última ejecución y errores acumulados.',
    scopes: ['integrations:read'],
    params: [],
    responseExample: {
      data: [
        { id: 'int_erp', name: 'ERP Ashir', status: 'NOT_CONFIGURED', adapter: 'Pendiente de definición', lastSyncAt: null },
        { id: 'int_nodo', name: 'NODO', status: 'OPERATIONAL', adapter: 'nodo-connector v1 (demo)', recordsProcessed: 247 },
      ],
      requestId: 'req_demo_d51b03ca',
    },
    errors: STD_ERRORS,
    tryIt: 'integrations',
  },
  {
    id: 'integration-runs',
    section: 'sincronizacion',
    method: 'GET',
    path: '/integrations/{integrationId}/runs',
    summary: 'Ejecuciones de un conector',
    description: 'Historial de sincronizaciones con registros procesados, duración, advertencias y request id.',
    scopes: ['integrations:read'],
    params: [{ name: 'integrationId', in: 'path', type: 'string', required: true, description: 'Id del conector.', example: 'int_nodo' }],
    responseExample: {
      data: [
        { id: 'run_0', process: 'Stock', direction: 'OUTBOUND', records: 214, result: 'SUCCESS', durationMs: 2140, requestId: 'req_demo_aa01' },
      ],
      requestId: 'req_demo_e7a2c130',
    },
    errors: STD_ERRORS,
    tryIt: 'integrationRuns',
  },
  {
    id: 'integration-sync',
    section: 'sincronizacion',
    method: 'POST',
    path: '/integrations/{integrationId}/sync',
    summary: 'Disparar sincronización',
    description: 'Ejecuta una sincronización manual de las entidades habilitadas del conector.',
    scopes: ['integrations:manage'],
    params: [{ name: 'integrationId', in: 'path', type: 'string', required: true, description: 'Id del conector.' }],
    requestBody: { entities: ['products', 'stock', 'prices'] },
    responseExample: {
      data: { runId: 'run_1758561234', records: 214, result: 'SUCCESS', durationMs: 2140 },
      requestId: 'req_demo_f0b1e2d3',
    },
    errors: [...STD_ERRORS, { code: 'UPSTREAM_UNAVAILABLE', status: 503, description: 'El servicio remoto no responde.' }],
  },

  /* ---------------- clientes y beneficios ---------------- */
  {
    id: 'list-customers',
    section: 'clientes',
    method: 'GET',
    path: '/customers',
    summary: 'Listar clientes',
    description: 'Resellers habilitados con su segmento, lista asignada, condición de pago y cuenta corriente.',
    scopes: ['customers:read'],
    params: [
      { name: 'query', in: 'query', type: 'string', description: 'Busca por razón social, nombre comercial, código o CUIT.' },
      { name: 'segment', in: 'query', type: 'string', description: 'SILVER | GOLD | PLATINUM' },
    ],
    responseExample: {
      data: [{ id: 'cus_gaming_store', code: 'C-10428', tradeName: 'Gaming Store', segment: 'PLATINUM', priceListId: 'pl_platinum_02' }],
      meta: { page: 1, pageSize: 25, total: 16, totalPages: 1 },
      requestId: 'req_demo_6ac91f23',
    },
    errors: STD_ERRORS,
    future: true,
  },
  {
    id: 'partner-status',
    section: 'beneficios',
    method: 'GET',
    path: '/partner-program/status',
    summary: 'Estado del programa',
    description: 'Nivel, puntos, progreso al siguiente nivel, beneficios activos y misiones en curso.',
    scopes: ['partner:read'],
    params: [],
    responseExample: {
      data: {
        tier: 'PLATINUM',
        points: 52_350,
        pointsExpiringSoon: { points: 4188, expiresAt: '2026-10-31T23:59:59-03:00' },
        tierProgress: { current: 'PLATINUM', next: null, progressPct: 100 },
      },
      requestId: 'req_demo_9de41a05',
    },
    errors: STD_ERRORS,
    future: true,
  },
];

/** Endpoints listados como inventario futuro, sin detalle completo. */
export const FUTURE_CATALOG: { section: string; entries: string[] }[] = [
  { section: 'Identidad y sesión', entries: ['GET /me', 'GET /me/permissions'] },
  { section: 'Catálogo', entries: ['GET /categories', 'GET /search/suggestions'] },
  {
    section: 'Pricing y condiciones',
    entries: [
      'GET /price-lists/{priceListId}',
      'GET /commercial-conditions',
      'POST /commercial-conditions',
      'PATCH /commercial-conditions/{conditionId}',
    ],
  },
  {
    section: 'Clientes',
    entries: [
      'GET /customers/{customerId}',
      'GET /customers/{customerId}/account',
      'GET /customers/{customerId}/purchases',
      'PATCH /customers/{customerId}',
    ],
  },
  {
    section: 'Pedidos',
    entries: [
      'GET /orders/{orderId}',
      'POST /orders/{orderId}/submit',
      'POST /orders/{orderId}/cancel',
      'POST /orders/{orderId}/duplicate',
      'GET /orders/{orderId}/documents',
    ],
  },
  {
    section: 'Precio especial',
    entries: [
      'GET /special-price-requests',
      'POST /special-price-requests',
      'GET /special-price-requests/{requestId}',
      'POST /special-price-requests/{requestId}/approve',
      'POST /special-price-requests/{requestId}/counteroffer',
      'POST /special-price-requests/{requestId}/reject',
    ],
  },
  {
    section: 'Beneficios',
    entries: [
      'GET /partner-program/missions',
      'GET /partner-program/points/ledger',
      'POST /partner-program/benefits/{benefitId}/redeem',
    ],
  },
  {
    section: 'RMA',
    entries: [
      'POST /rma/eligibility/evaluate',
      'GET /rma/cases/{rmaId}',
      'PATCH /rma/cases/{rmaId}',
      'POST /rma/cases/{rmaId}/attachments',
      'POST /rma/cases/{rmaId}/submit',
      'POST /rma/cases/{rmaId}/approve-reception',
      'POST /rma/cases/{rmaId}/receive',
      'POST /rma/cases/{rmaId}/diagnosis',
      'POST /rma/cases/{rmaId}/resolution',
      'GET /rma/cases/{rmaId}/shipping-label',
      'POST /rma/batches',
      'GET /rma/lots/{lotId}',
    ],
  },
  {
    section: 'Product Management',
    entries: [
      'GET /pm/brands',
      'GET /pm/brands/{brandId}/stock-aging',
      'GET /pm/brands/{brandId}/customers',
      'GET /pm/brands/{brandId}/rma-analytics',
    ],
  },
  {
    section: 'Importaciones e integraciones',
    entries: [
      'GET /integrations/{integrationId}',
      'GET /integrations/{integrationId}/runs/{runId}',
      'POST /imports/products/validate',
      'POST /imports/products/preview',
      'POST /imports/products/commit',
      'GET /imports/{importId}',
    ],
  },
];

export const ERROR_CATALOG = [
  { code: 'UNAUTHENTICATED', status: 401, description: 'Falta el token, está vencido o es inválido.', action: 'Renovar el token con el flujo de client credentials.' },
  { code: 'FORBIDDEN', status: 403, description: 'El token no tiene el scope necesario.', action: 'Revisar los scopes solicitados al crear la credencial.' },
  { code: 'RESOURCE_NOT_FOUND', status: 404, description: 'El recurso no existe o no es visible para el token.', action: 'Verificar el identificador y los permisos de la cuenta.' },
  { code: 'ORDER_VERSION_CONFLICT', status: 409, description: 'El pedido fue modificado por otro proceso.', action: 'Releer el pedido, resolver el conflicto y reintentar con la nueva versión.' },
  { code: 'ORDER_NOT_EDITABLE', status: 409, description: 'El estado del pedido no admite el cambio pedido.', action: 'Consultar `allowedModifications` antes de editar.' },
  { code: 'ORDER_CONDITION_NOT_MET', status: 400, description: 'El pedido dejó de cumplir una condición comercial.', action: 'Revisar `details` para saber qué línea y qué requisito falla.' },
  { code: 'INSUFFICIENT_STOCK', status: 409, description: 'No hay stock suficiente para alguna línea.', action: 'Consultar disponibilidad y ofrecer un reemplazo.' },
  { code: 'CREDIT_LIMIT_EXCEEDED', status: 409, description: 'El pedido supera el crédito disponible del cliente.', action: 'Solicitar aprobación comercial o reducir el pedido.' },
  { code: 'SERIAL_NOT_FOUND', status: 404, description: 'El número de serie no existe en los registros.', action: 'Verificar el serial impreso en el producto.' },
  { code: 'SERIAL_NOT_OWNED', status: 403, description: 'El serial pertenece a otra cuenta.', action: 'No se devuelven datos del tercero. Escalar al ejecutivo comercial.' },
  { code: 'WARRANTY_EXPIRED', status: 409, description: 'La garantía del producto venció.', action: 'Ofrecer revisión con cargo o excepción comercial.' },
  { code: 'RMA_ALREADY_OPEN', status: 409, description: 'Ya existe un caso abierto para ese serial.', action: 'Consultar el caso existente en lugar de crear uno nuevo.' },
  { code: 'UPSTREAM_UNAVAILABLE', status: 503, description: 'Un sistema del que depende la operación no responde.', action: 'Reintentar con backoff exponencial.' },
  { code: 'RATE_LIMITED', status: 429, description: 'Se superó el límite de requests.', action: 'Respetar el header `Retry-After`.' },
  { code: 'INTERNAL_ERROR', status: 500, description: 'Error no previsto del servidor.', action: 'Reportar el `requestId` al soporte de Ashir.' },
];

export const CHANGELOG = [
  {
    version: '2026-09-01',
    current: true,
    changes: [
      'Primera versión del contrato con catálogo, pricing explicable, pedidos, RMA 360 y sincronización.',
      'Se agrega `Idempotency-Key` obligatorio en creación de pedidos, solicitudes y casos de RMA.',
      'Se agrega concurrencia optimista con `version` en la edición de pedidos.',
      'El lookup de serial pasa a tomar la cuenta del token en lugar del cuerpo del request.',
    ],
  },
  {
    version: '2026-06-15',
    current: false,
    changes: [
      'Borrador interno del contrato previo a la revisión de seguridad.',
      'Los importes pasan de `number` a objeto `{ amount, currency }` para evitar ambigüedad de floats.',
    ],
  },
];
