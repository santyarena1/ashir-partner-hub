/**
 * Adaptador mock: la implementacion de ApiClient que usa el prototipo.
 *
 * Simula latencia, respeta permisos por rol, persiste los cambios en
 * localStorage y puede inyectar errores desde el panel de escenarios de demo.
 */
import type {
  CommercialCondition,
  CommercialSimulationInput,
  Customer,
  ImportPreview,
  ImportRun,
  Integration,
  IntegrationRun,
  Notification,
  Order,
  OrderItem,
  OrderStatus,
  Paginated,
  PartnerStatus,
  PriceEvaluation,
  Product,
  ProductQuery,
  RmaCase,
  RmaStatus,
  RmaUnit,
  SearchSuggestion,
  SerialLookupResult,
  SerialRecord,
  Session,
  SpecialPriceRequest,
  WebhookDelivery,
} from '@/types';
import type { ApiClient } from '@/services/contracts';
import { ERROR_CODES, ServiceError } from '@/services/contracts';
import {
  BRANDS,
  CATEGORIES,
  PRODUCTS,
  SELLABLE_PRODUCTS,
  productById,
  productBySku,
} from '@/mocks/fixtures/catalog';
import { CUSTOMERS, customerById } from '@/mocks/fixtures/customers';
import { PRICE_LISTS } from '@/mocks/fixtures/pricing';
import { WARRANTY_POLICIES, RMA_LOTS, policyFor } from '@/mocks/fixtures/serials';
import { PARTNER_BENEFITS, partnerStatusFor } from '@/mocks/fixtures/commerce';
import { buildEligibility } from '@/mocks/fixtures/rma';
import { ALLOWED_MODIFICATIONS } from '@/mocks/fixtures/orders';
import { evaluatePrice, estimateFreight, simulateCondition } from '@/services/mock/pricing-engine';
import { brandDashboard, commercialSimulation, rmaAnalytics } from '@/services/mock/analytics';
import { fastLatency, getState, isScenarioOn, latency, mutate } from '@/services/mock/store';
import { can, isCustomerScoped, ownsBrand } from '@/lib/rbac';
import { RMA_PROBLEM, RMA_FLOW } from '@/lib/labels';
import {
  addDays,
  eventId,
  money,
  normalize,
  num,
  requestId,
  uniqueBy,
} from '@/lib/utils';

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

const now = () => new Date().toISOString();

function paginate<T>(items: T[], page = 1, pageSize = 24): Paginated<T> {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  return {
    data: items.slice((safePage - 1) * pageSize, safePage * pageSize),
    meta: { page: safePage, pageSize, total, totalPages },
    requestId: requestId(),
  };
}

function maybeFail(scenario: 'SERVER_ERROR', message: string) {
  if (isScenarioOn(scenario)) {
    throw new ServiceError(ERROR_CODES.INTERNAL, message, 500, [], requestId());
  }
}

/**
 * Oculta costo y margen cuando el rol no los puede ver.
 * Es la barrera que garantiza que el cliente nunca reciba esos campos.
 */
function sanitizeProduct(product: Product, session: Session): Product {
  if (can(session, 'cost:read')) return product;
  return { ...product, cost: null, marginPct: null };
}

/** El cliente de la sesion, o el que se pida explicitamente si el rol lo permite. */
function resolveCustomer(session: Session, customerId?: string): Customer {
  const id = session.role === 'CLIENT' ? session.customerId : (customerId ?? session.customerId);
  const customer = id ? customerById(id) : undefined;
  if (!customer) {
    throw new ServiceError(ERROR_CODES.NOT_FOUND, 'No se encontró la cuenta del cliente.', 404, [], requestId());
  }
  return customer;
}

function requireScope(session: Session, scope: Parameters<typeof can>[1], action: string) {
  if (!can(session, scope)) {
    throw new ServiceError(
      ERROR_CODES.FORBIDDEN,
      `Tu rol no tiene permisos para ${action}.`,
      403,
      [],
      requestId(),
    );
  }
}

function applyStockScenario(product: Product): Product {
  if (!isScenarioOn('OUT_OF_STOCK')) return product;
  return { ...product, stock: 0, availability: 'OUT_OF_STOCK' };
}

/* ------------------------------------------------------------------ */
/* catalogo                                                            */
/* ------------------------------------------------------------------ */

const catalog: ApiClient['catalog'] = {
  async listProducts(query: ProductQuery, session: Session) {
    await latency();
    maybeFail('SERVER_ERROR', 'El servicio de catálogo no está disponible en este momento.');

    let items = PRODUCTS.map(applyStockScenario);

    if (query.query) {
      const term = normalize(query.query);
      items = items.filter(
        (p) =>
          normalize(p.name).includes(term) ||
          normalize(p.sku).includes(term) ||
          normalize(p.brand).includes(term) ||
          normalize(p.category).includes(term) ||
          (p.partNumber ? normalize(p.partNumber).includes(term) : false),
      );
    }
    if (query.sku) {
      const term = normalize(query.sku);
      items = items.filter((p) => normalize(p.sku).includes(term));
    }
    if (query.brandId) items = items.filter((p) => p.brandId === query.brandId);
    if (query.categoryId) items = items.filter((p) => p.categoryId === query.categoryId);
    if (query.subcategory) items = items.filter((p) => p.subcategory === query.subcategory);
    if (query.inStock) items = items.filter((p) => p.stock > 0);
    if (query.incomingSoon) items = items.filter((p) => p.availability === 'INCOMING');
    if (query.minPrice !== undefined) {
      items = items.filter((p) => p.listPrice && num(p.listPrice) >= query.minPrice!);
    }
    if (query.maxPrice !== undefined) {
      items = items.filter((p) => p.listPrice && num(p.listPrice) <= query.maxPrice!);
    }
    if (query.purchasedBefore && session.customerId) {
      const purchased = new Set(
        getState()
          .orders.filter((o) => o.customerId === session.customerId)
          .flatMap((o) => o.items.map((it) => it.productId)),
      );
      items = items.filter((p) => purchased.has(p.id));
    }
    if (query.promotionId) {
      // Aproximacion visual: los productos que la condicion podria alcanzar.
      const condition = getState().conditions.find((c) => c.id === query.promotionId);
      if (condition) {
        const brands = condition.criteria.find((c) => c.scope === 'BRAND')?.values ?? [];
        const categories = condition.criteria.find((c) => c.scope === 'CATEGORY')?.values ?? [];
        items = items.filter(
          (p) =>
            (brands.length === 0 || brands.includes(p.brand)) &&
            (categories.length === 0 || categories.includes(p.category)) &&
            !condition.exclusions.includes(p.sku),
        );
      }
    }

    const sorted = sortProducts(items, query.sort ?? 'relevance');
    const page = paginate(sorted, query.page, query.pageSize);
    return { ...page, data: page.data.map((p) => sanitizeProduct(p, session)) };
  },

  async getProduct(idOrSku: string, session: Session) {
    await fastLatency();
    const product = productById(idOrSku) ?? productBySku(idOrSku);
    if (!product) {
      throw new ServiceError(ERROR_CODES.NOT_FOUND, `No existe el producto ${idOrSku}.`, 404, [], requestId());
    }
    return sanitizeProduct(applyStockScenario(product), session);
  },

  async getAvailability(productId: string) {
    await fastLatency();
    const product = productById(productId);
    if (!product) {
      throw new ServiceError(ERROR_CODES.NOT_FOUND, 'Producto inexistente.', 404, [], requestId());
    }
    const p = applyStockScenario(product);
    return { stock: p.stock, incoming: p.incoming, availability: p.availability };
  },

  async listBrands() {
    await fastLatency();
    return BRANDS.map((b) => ({
      id: b.id,
      name: b.name,
      skuCount: b.skuCount,
      color: b.color,
      categories: b.categories,
      pmId: b.pmId,
    }));
  },

  async listCategories() {
    await fastLatency();
    return CATEGORIES.map((c) => ({
      id: c.id,
      name: c.name,
      group: c.group,
      skuCount: c.skuCount,
      subcategories: c.subcategories,
    }));
  },

  async suggestions(term: string, session: Session): Promise<SearchSuggestion[]> {
    await fastLatency();
    if (!term.trim()) return [];
    const q = normalize(term);
    const prefix = session.role === 'CLIENT' ? '' : '/bo';

    const products: SearchSuggestion[] = SELLABLE_PRODUCTS.filter(
      (p) => normalize(p.sku).includes(q) || normalize(p.name).includes(q),
    )
      .slice(0, 6)
      .map((p) => ({
        type: normalize(p.sku).includes(q) ? 'sku' : 'product',
        id: p.id,
        label: p.name,
        sublabel: `${p.sku} · ${p.brand} · ${p.category}`,
        href: session.role === 'CLIENT' ? `/catalogo/${p.sku}` : `/bo/productos?q=${p.sku}`,
      }));

    const brands: SearchSuggestion[] = BRANDS.filter((b) => normalize(b.name).includes(q))
      .slice(0, 3)
      .map((b) => ({
        type: 'brand',
        id: b.id,
        label: b.name,
        sublabel: `${b.skuCount} SKUs`,
        href: session.role === 'CLIENT' ? `/catalogo?brandId=${b.id}` : `${prefix}/marcas`,
      }));

    const categories: SearchSuggestion[] = CATEGORIES.filter((c) => normalize(c.name).includes(q))
      .slice(0, 3)
      .map((c) => ({
        type: 'category',
        id: c.id,
        label: c.name,
        sublabel: `${c.skuCount} SKUs · ${c.group}`,
        href: session.role === 'CLIENT' ? `/catalogo?categoryId=${c.id}` : `${prefix}/productos`,
      }));

    return [...products, ...brands, ...categories];
  },

  async previouslyPurchased(session: Session) {
    await fastLatency();
    if (!session.customerId) return [];
    const ids = new Set(
      getState()
        .orders.filter((o) => o.customerId === session.customerId)
        .flatMap((o) => o.items.map((it) => it.productId)),
    );
    return PRODUCTS.filter((p) => ids.has(p.id)).map((p) => sanitizeProduct(p, session));
  },
};

function sortProducts(items: Product[], sort: NonNullable<ProductQuery['sort']>): Product[] {
  const copy = [...items];
  switch (sort) {
    case 'price_asc':
      return copy.sort((a, b) => num(a.listPrice) - num(b.listPrice));
    case 'price_desc':
      return copy.sort((a, b) => num(b.listPrice) - num(a.listPrice));
    case 'best_sellers':
      return copy.sort((a, b) => b.unitsSold12m - a.unitsSold12m);
    case 'newest':
      return copy.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    case 'stock_desc':
      return copy.sort((a, b) => b.stock - a.stock);
    default:
      // Relevancia: primero lo vendible y con stock, luego por rotacion.
      return copy.sort((a, b) => {
        const score = (p: Product) =>
          (p.listPrice ? 2 : 0) + (p.stock > 0 ? 2 : 0) + (p.availability === 'NEW_ARRIVAL' ? 1 : 0);
        return score(b) - score(a) || b.unitsSold12m - a.unitsSold12m;
      });
  }
}

/* ------------------------------------------------------------------ */
/* pricing                                                             */
/* ------------------------------------------------------------------ */

const pricing: ApiClient['pricing'] = {
  async evaluate(productId, quantity, session, options) {
    await fastLatency();
    const product = productById(productId) ?? productBySku(productId);
    if (!product) {
      throw new ServiceError(ERROR_CODES.NOT_FOUND, 'Producto inexistente.', 404, [], requestId());
    }
    const customer = resolveCustomer(session, options?.customerId);
    return evaluatePrice({
      product,
      customer,
      quantity,
      date: options?.date,
      paymentTerm: options?.paymentTerm,
      orderAmount: options?.orderAmount,
    });
  },

  async evaluateMany(lines, session) {
    await fastLatency();
    const customer = resolveCustomer(session);
    const orderAmount = lines.reduce((acc, line) => {
      const p = productById(line.productId);
      return acc + (p?.listPrice ? num(p.listPrice) * line.quantity : 0);
    }, 0);

    const results: PriceEvaluation[] = [];
    for (const line of lines) {
      const product = productById(line.productId);
      if (!product) continue;
      const brandAmount = lines
        .filter((l) => productById(l.productId)?.brand === product.brand)
        .reduce((acc, l) => {
          const p = productById(l.productId);
          return acc + (p?.listPrice ? num(p.listPrice) * l.quantity : 0);
        }, 0);
      results.push(
        evaluatePrice({
          product,
          customer,
          quantity: line.quantity,
          orderAmount,
          brandAmountInOrder: brandAmount,
          skipTiers: true,
        }),
      );
    }
    return results;
  },

  async listPriceLists() {
    await fastLatency();
    return PRICE_LISTS;
  },

  async getPriceList(id: string) {
    await fastLatency();
    const list = PRICE_LISTS.find((l) => l.id === id);
    if (!list) throw new ServiceError(ERROR_CODES.NOT_FOUND, 'Lista inexistente.', 404, [], requestId());
    return list;
  },

  async listConditions(filter) {
    await fastLatency();
    let items = getState().conditions;
    if (filter?.kind) items = items.filter((c) => c.kind === filter.kind);
    if (filter?.status) items = items.filter((c) => c.status === filter.status);
    return items;
  },

  async getCondition(id: string) {
    await fastLatency();
    const condition = getState().conditions.find((c) => c.id === id || c.code === id);
    if (!condition) throw new ServiceError(ERROR_CODES.NOT_FOUND, 'Condición inexistente.', 404, [], requestId());
    return condition;
  },

  async createCondition(draft) {
    await latency();
    const condition: CommercialCondition = {
      id: `cond_${Math.random().toString(36).slice(2, 9)}`,
      code: draft.code ?? `NUEVA-${Math.floor(Math.random() * 900 + 100)}`,
      name: draft.name ?? 'Condición sin nombre',
      description: draft.description ?? '',
      criteria: draft.criteria ?? [],
      actions: draft.actions ?? [],
      validFrom: draft.validFrom ?? now(),
      validTo: draft.validTo ?? addDays(now(), 30),
      priority: draft.priority ?? 100,
      stackable: draft.stackable ?? true,
      exclusions: draft.exclusions ?? [],
      usageLimit: draft.usageLimit ?? null,
      usageCount: 0,
      requiresApproval: draft.requiresApproval ?? false,
      owner: draft.owner ?? 'Valeria Quiroga',
      status: draft.status ?? 'DRAFT',
      kind: draft.kind ?? 'CONDITION',
      createdAt: now(),
      updatedAt: now(),
    };
    mutate((s) => {
      s.conditions = [condition, ...s.conditions];
    });
    return condition;
  },

  async updateCondition(id, patch) {
    await latency();
    let updated: CommercialCondition | undefined;
    mutate((s) => {
      s.conditions = s.conditions.map((c) => {
        if (c.id !== id) return c;
        updated = { ...c, ...patch, updatedAt: now() };
        return updated;
      });
    });
    if (!updated) throw new ServiceError(ERROR_CODES.NOT_FOUND, 'Condición inexistente.', 404, [], requestId());
    return updated;
  },

  async simulateCondition(input) {
    await latency();
    const product = productById(input.productId) ?? productBySku(input.productId);
    const customer = customerById(input.customerId);
    if (!product || !customer) {
      throw new ServiceError(ERROR_CODES.NOT_FOUND, 'Cliente o producto inexistente.', 404, [], requestId());
    }
    return simulateCondition(product, customer, input.quantity, input.date, input.paymentTerm);
  },
};

/* ------------------------------------------------------------------ */
/* clientes                                                            */
/* ------------------------------------------------------------------ */

const customers: ApiClient['customers'] = {
  async list(filter) {
    await latency();
    let items = CUSTOMERS;
    if (filter?.query) {
      const q = normalize(filter.query);
      items = items.filter(
        (c) => normalize(c.tradeName).includes(q) || normalize(c.legalName).includes(q) || c.taxId.includes(q) || normalize(c.code).includes(q),
      );
    }
    if (filter?.segment) items = items.filter((c) => c.segment === filter.segment);
    if (filter?.salesRepId) items = items.filter((c) => c.salesRepId === filter.salesRepId);
    if (filter?.status) items = items.filter((c) => c.status === filter.status);
    return items;
  },

  async get(id: string) {
    await fastLatency();
    const customer = customerById(id);
    if (!customer) throw new ServiceError(ERROR_CODES.NOT_FOUND, 'Cliente inexistente.', 404, [], requestId());
    return customer;
  },

  async update(id, patch) {
    await latency();
    const customer = customerById(id);
    if (!customer) throw new ServiceError(ERROR_CODES.NOT_FOUND, 'Cliente inexistente.', 404, [], requestId());
    // Los fixtures de cliente son de solo lectura en la demo: se devuelve
    // el resultado esperado sin mutar el dataset base.
    return { ...customer, ...patch };
  },

  async purchases(id: string) {
    await fastLatency();
    return getState().orders.filter((o) => o.customerId === id);
  },

  async addNote(id, text, author) {
    await latency();
    const customer = customerById(id);
    if (!customer) throw new ServiceError(ERROR_CODES.NOT_FOUND, 'Cliente inexistente.', 404, [], requestId());
    return {
      ...customer,
      internalNotes: [{ id: `note_${Date.now()}`, author, at: now(), text }, ...customer.internalNotes],
    };
  },
};

/* ------------------------------------------------------------------ */
/* pedidos                                                             */
/* ------------------------------------------------------------------ */

function recalcOrder(order: Order, customer: Customer): Order {
  const lines = order.items.map((it) => ({ productId: it.productId, quantity: it.quantity }));
  const orderAmount = lines.reduce((acc, l) => {
    const p = productById(l.productId);
    return acc + (p?.listPrice ? num(p.listPrice) * l.quantity : 0);
  }, 0);

  const items: OrderItem[] = order.items.flatMap((item) => {
    const product = productById(item.productId);
    if (!product?.listPrice) return [item];
    const brandAmount = order.items
      .filter((i) => productById(i.productId)?.brand === product.brand)
      .reduce((acc, i) => {
        const p = productById(i.productId);
        return acc + (p?.listPrice ? num(p.listPrice) * i.quantity : 0);
      }, 0);
    const evaluation = evaluatePrice({
      product,
      customer,
      quantity: item.quantity,
      orderAmount,
      brandAmountInOrder: brandAmount,
      skipTiers: true,
    });
    return [
      {
        ...item,
        unitPrice: evaluation.finalUnitPrice,
        listPrice: product.listPrice,
        discountPct: evaluation.totalDiscountPct,
        lineTotal: evaluation.lineTotal,
        appliedConditions: evaluation.appliedConditions.map((c) => c.code),
      },
    ];
  });

  const subtotal = items.reduce((acc, it) => acc + num(it.lineTotal), 0);
  const listTotal = items.reduce((acc, it) => acc + num(it.listPrice) * it.quantity, 0);
  const taxTotal = items.reduce((acc, it) => {
    const p = productById(it.productId);
    return acc + num(it.lineTotal) * (p?.vatRate ?? 0.21);
  }, 0);

  const firstProduct = productById(items[0]?.productId ?? '');
  const evaluation = firstProduct
    ? evaluatePrice({ product: firstProduct, customer, quantity: items[0]!.quantity, orderAmount: subtotal, skipTiers: true })
    : null;
  const freight = evaluation?.freeFreight ? money(0) : estimateFreight(customer, subtotal);

  return {
    ...order,
    items,
    subtotal: money(subtotal),
    discountTotal: money(listTotal - subtotal),
    taxTotal: money(taxTotal),
    freight,
    total: money(subtotal + taxTotal + num(freight)),
    appliedConditions: evaluation?.appliedConditions ?? order.appliedConditions,
    updatedAt: now(),
  };
}

function pushAudit(order: Order, session: Session, action: string, extra: Partial<Order['auditLog'][number]> = {}) {
  order.auditLog = [
    ...order.auditLog,
    {
      id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      at: now(),
      actor: session.role === 'CLIENT' ? (customerById(session.customerId ?? '')?.tradeName ?? session.name) : session.name,
      actorRole: session.role,
      /**
       * Cuando un interno opera en nombre del cliente, la traza guarda a
       * los dos: el pedido es del reseller, la accion es del vendedor.
       */
      onBehalfOf: session.onBehalfOf?.customerName ?? null,
      action,
      entity: 'Order',
      entityId: order.id,
      previousValue: null,
      newValue: null,
      origin: session.onBehalfOf ? 'BACKOFFICE' : session.role === 'CLIENT' ? 'PORTAL' : 'BACKOFFICE',
      requestId: requestId(),
      comment: null,
      ...extra,
    },
  ];
}

const orders: ApiClient['orders'] = {
  async list(filter, session) {
    await latency();
    let items = getState().orders;
    if (isCustomerScoped(session)) {
      // Cliente propio o interno asistiendo: solo la cuenta en contexto.
      items = items.filter((o) => o.customerId === session.customerId);
    } else if (filter.customerId) {
      items = items.filter((o) => o.customerId === filter.customerId);
    }
    if (filter.status) items = items.filter((o) => o.status === filter.status);
    if (filter.query) {
      const q = normalize(filter.query);
      items = items.filter(
        (o) =>
          normalize(o.number).includes(q) ||
          normalize(o.customerName).includes(q) ||
          o.items.some((it) => normalize(it.sku).includes(q)),
      );
    }
    return items;
  },

  async get(id, session) {
    await fastLatency();
    const order = getState().orders.find((o) => o.id === id || o.number === id);
    if (!order) throw new ServiceError(ERROR_CODES.NOT_FOUND, 'Pedido inexistente.', 404, [], requestId());
    if (isCustomerScoped(session) && order.customerId !== session.customerId) {
      throw new ServiceError(ERROR_CODES.FORBIDDEN, 'El pedido pertenece a otra cuenta.', 403, [], requestId());
    }
    return order;
  },

  async create(draft, session) {
    await latency();
    requireScope(session, 'orders:write', 'crear pedidos');
    const customer = resolveCustomer(session, draft.customerId);

    const items: OrderItem[] = draft.items.flatMap((line, i) => {
      const product = productById(line.productId);
      if (!product?.listPrice) return [];
      return [
        {
          id: `oi_new_${Date.now()}_${i}`,
          productId: product.id,
          sku: product.sku,
          name: product.name,
          brand: product.brand,
          quantity: line.quantity,
          unitPrice: product.listPrice,
          listPrice: product.listPrice,
          discountPct: '0.00',
          lineTotal: money(num(product.listPrice) * line.quantity),
          appliedConditions: [],
          shippedQty: 0,
          stockAtOrder: product.stock,
        },
      ];
    });

    if (items.length === 0) {
      throw new ServiceError(
        ERROR_CODES.ORDER_CONDITION_NOT_MET,
        'El pedido no tiene ítems válidos.',
        400,
        [{ field: 'items', reason: 'EMPTY_ORDER' }],
        requestId(),
      );
    }

    const highest = getState().orders.reduce((max, o) => {
      const n = Number.parseInt(o.number.replace('ASH-', ''), 10);
      return Number.isFinite(n) ? Math.max(max, n) : max;
    }, 24_500);
    const number = `ASH-${highest + 1}`;

    const base: Order = {
      id: `ord_${number.toLowerCase().replace('-', '_')}`,
      number,
      customerId: customer.id,
      customerName: customer.tradeName,
      status: 'DRAFT',
      version: 1,
      items,
      subtotal: money(0),
      discountTotal: money(0),
      taxTotal: money(0),
      freight: money(0),
      total: money(0),
      currency: 'USD',
      fxRate: 1_412,
      paymentTerm: customer.paymentTerm,
      deliveryMethod: draft.deliveryMethod ?? 'DELIVERY',
      deliveryAddress: customer.address,
      customerPO: draft.customerPO ?? null,
      notes: draft.notes ?? null,
      appliedConditions: [],
      requiredApprovals: [],
      salesRepId: customer.salesRepId,
      origin: session.onBehalfOf ? 'ASSISTED' : 'PORTAL',
      placedBy: session.onBehalfOf
        ? { userId: session.userId, name: session.name, jobTitle: session.jobTitle }
        : null,
      createdAt: now(),
      updatedAt: now(),
      confirmedAt: null,
      shippedAt: null,
      deliveredAt: null,
      invoiceIds: [],
      tracking: null,
      auditLog: [],
      allowedModifications: ALLOWED_MODIFICATIONS.DRAFT,
    };

    pushAudit(
      base,
      session,
      session.onBehalfOf
        ? `Pedido creado por ${session.name} en nombre del cliente`
        : 'Pedido creado desde el portal',
      { newValue: 'DRAFT' },
    );
    const order = recalcOrder(base, customer);

    // Aprobacion requerida si supera el credito disponible.
    if (num(order.total) > num(customer.account.creditAvailable)) {
      order.requiredApprovals = [
        {
          type: 'CREDIT',
          label: `Supera el crédito disponible (${customer.account.creditAvailable.amount} USD)`,
          status: 'PENDING',
          approver: customer.salesRepId,
        },
      ];
    }

    mutate((s) => {
      s.orders = [order, ...s.orders];
      s.notifications = [
        {
          id: `ntf_${Date.now()}`,
          roles: ['SALES', 'ADMIN'],
          customerId: null,
          kind: 'ORDER',
          title: `Nuevo pedido ${order.number}`,
          body: session.onBehalfOf
            ? `${session.name} cargó un pedido de ${customer.tradeName} por USD ${order.total.amount}.`
            : `${customer.tradeName} creó un pedido por USD ${order.total.amount}.`,
          at: now(),
          read: false,
          href: `/bo/pedidos/${order.id}`,
          severity: 'INFO',
        },
        ...s.notifications,
      ];
      s.webhooks = [buildWebhook('order.created', { orderId: order.id, number: order.number, customerId: customer.id }), ...s.webhooks];
    });

    return order;
  },

  async update(id, patch, session) {
    await latency();
    const existing = getState().orders.find((o) => o.id === id);
    if (!existing) throw new ServiceError(ERROR_CODES.NOT_FOUND, 'Pedido inexistente.', 404, [], requestId());

    // Concurrencia optimista + escenario de demo.
    if (isScenarioOn('ORDER_VERSION_CONFLICT') || patch.version !== existing.version) {
      throw new ServiceError(
        ERROR_CODES.ORDER_VERSION_CONFLICT,
        'El pedido fue modificado desde otra sesión. Volvé a cargarlo para ver los cambios antes de editar.',
        409,
        [{ field: 'version', reason: 'STALE_VERSION' }],
        requestId(),
      );
    }

    if (existing.allowedModifications.length === 0) {
      throw new ServiceError(
        ERROR_CODES.ORDER_NOT_EDITABLE,
        `Un pedido en estado "${existing.status}" ya no admite modificaciones.`,
        409,
        [],
        requestId(),
      );
    }

    const customer = customerById(existing.customerId)!;
    const draft: Order = structuredClone(existing);

    if (patch.items) {
      const previousQty = new Map(draft.items.map((it) => [it.productId, it.quantity]));
      draft.items = patch.items.flatMap((line, i) => {
        const product = productById(line.productId);
        if (!product?.listPrice) return [];
        const previous = draft.items.find((it) => it.productId === line.productId);
        return [
          previous
            ? { ...previous, quantity: line.quantity }
            : {
                id: `oi_new_${Date.now()}_${i}`,
                productId: product.id,
                sku: product.sku,
                name: product.name,
                brand: product.brand,
                quantity: line.quantity,
                unitPrice: product.listPrice,
                listPrice: product.listPrice,
                discountPct: '0.00',
                lineTotal: money(num(product.listPrice) * line.quantity),
                appliedConditions: [],
                shippedQty: 0,
                stockAtOrder: product.stock,
              },
        ];
      });

      for (const item of draft.items) {
        const before = previousQty.get(item.productId);
        if (before === undefined) {
          pushAudit(draft, session, `Se agregó ${item.quantity} × ${item.sku}`, { newValue: String(item.quantity) });
        } else if (before !== item.quantity) {
          pushAudit(draft, session, `Cantidad modificada ${before} → ${item.quantity} en ${item.sku}`, {
            previousValue: String(before),
            newValue: String(item.quantity),
          });
        }
      }
      for (const [productId, qty] of previousQty) {
        if (!draft.items.some((it) => it.productId === productId)) {
          const sku = existing.items.find((it) => it.productId === productId)?.sku ?? productId;
          pushAudit(draft, session, `Se eliminó ${sku} del pedido`, { previousValue: String(qty) });
        }
      }
    }

    if (patch.notes !== undefined && patch.notes !== draft.notes) {
      draft.notes = patch.notes;
      pushAudit(draft, session, 'Observaciones actualizadas');
    }
    if (patch.customerPO !== undefined && patch.customerPO !== draft.customerPO) {
      draft.customerPO = patch.customerPO;
      pushAudit(draft, session, `Orden de compra del cliente: ${patch.customerPO || '—'}`);
    }
    if (patch.deliveryMethod && patch.deliveryMethod !== draft.deliveryMethod) {
      draft.deliveryMethod = patch.deliveryMethod;
      pushAudit(draft, session, `Método de entrega: ${patch.deliveryMethod === 'PICKUP' ? 'Retiro' : 'Envío'}`);
    }

    const updated = recalcOrder(draft, customer);
    updated.version = existing.version + 1;

    mutate((s) => {
      s.orders = s.orders.map((o) => (o.id === id ? updated : o));
      s.webhooks = [buildWebhook('order.updated', { orderId: updated.id, number: updated.number, version: updated.version }), ...s.webhooks];
    });
    return updated;
  },

  async previewChange(id, items, session) {
    await fastLatency();
    const existing = await orders.get(id, session);
    const customer = customerById(existing.customerId)!;
    const before = existing.appliedConditions.map((c) => c.code);

    const draft: Order = structuredClone(existing);
    draft.items = items.flatMap((line) => {
      const product = productById(line.productId);
      if (!product?.listPrice) return [];
      const previous = draft.items.find((it) => it.productId === line.productId);
      return previous ? [{ ...previous, quantity: line.quantity }] : [];
    });

    const recalculated = recalcOrder(draft, customer);
    const after = recalculated.appliedConditions.map((c) => c.code);

    const lost = before.filter((c) => !after.includes(c));
    const gained = after.filter((c) => !before.includes(c));

    const warnings: string[] = [];
    for (const code of lost) {
      const condition = getState().conditions.find((c) => c.code === code);
      warnings.push(
        `Con este cambio el pedido deja de cumplir la condición ${condition?.name ?? code} y pierde su beneficio.`,
      );
    }
    if (num(recalculated.total) > num(customer.account.creditAvailable)) {
      warnings.push(
        `El nuevo total (USD ${recalculated.total.amount}) supera el crédito disponible del cliente y requerirá aprobación comercial.`,
      );
    }
    for (const item of recalculated.items) {
      const product = productById(item.productId);
      if (product && item.quantity > product.stock && product.stock > 0) {
        warnings.push(`Solo hay ${product.stock} unidades de ${item.sku} disponibles para entrega inmediata.`);
      }
    }

    return { warnings, lostConditions: lost, gainedConditions: gained, newTotal: recalculated.total };
  },

  async submit(id, session) {
    await latency();
    const order = getState().orders.find((o) => o.id === id);
    if (!order) throw new ServiceError(ERROR_CODES.NOT_FOUND, 'Pedido inexistente.', 404, [], requestId());
    const customer = customerById(order.customerId)!;

    const needsApproval = num(order.total) > num(customer.account.creditAvailable);
    const next: OrderStatus = needsApproval ? 'PENDING_APPROVAL' : 'CONFIRMED';

    const updated: Order = structuredClone(order);
    updated.status = next;
    updated.confirmedAt = now();
    updated.version += 1;
    updated.allowedModifications = ALLOWED_MODIFICATIONS[next];
    pushAudit(updated, session, 'Pedido confirmado', { previousValue: order.status, newValue: next });

    mutate((s) => {
      s.orders = s.orders.map((o) => (o.id === id ? updated : o));
      s.webhooks = [buildWebhook('order.status_changed', { orderId: id, previousStatus: order.status, status: next }), ...s.webhooks];
      s.notifications = [
        {
          id: `ntf_${Date.now()}`,
          roles: needsApproval ? ['SALES', 'ADMIN'] : ['SALES'],
          customerId: null,
          kind: needsApproval ? 'APPROVAL' : 'ORDER',
          title: needsApproval ? `${updated.number} requiere aprobación` : `${updated.number} confirmado`,
          body: needsApproval
            ? `El pedido supera el crédito disponible de ${customer.tradeName}.`
            : `${customer.tradeName} confirmó un pedido por USD ${updated.total.amount}.`,
          at: now(),
          read: false,
          href: `/bo/pedidos/${id}`,
          severity: needsApproval ? 'WARNING' : 'INFO',
        },
        ...s.notifications,
      ];
    });
    return updated;
  },

  async cancel(id, reason, session) {
    await latency();
    const order = getState().orders.find((o) => o.id === id);
    if (!order) throw new ServiceError(ERROR_CODES.NOT_FOUND, 'Pedido inexistente.', 404, [], requestId());
    const updated: Order = structuredClone(order);
    updated.status = 'CANCELLED';
    updated.version += 1;
    updated.allowedModifications = [];
    pushAudit(updated, session, 'Pedido cancelado', { previousValue: order.status, newValue: 'CANCELLED', comment: reason });
    mutate((s) => {
      s.orders = s.orders.map((o) => (o.id === id ? updated : o));
      s.webhooks = [buildWebhook('order.cancelled', { orderId: id, reason }), ...s.webhooks];
    });
    return updated;
  },

  async duplicate(id, session) {
    await latency();
    const order = await orders.get(id, session);
    return orders.create(
      {
        customerId: order.customerId,
        items: order.items.map((it) => ({ productId: it.productId, quantity: it.quantity })),
        notes: order.notes ?? undefined,
        deliveryMethod: order.deliveryMethod,
      },
      session,
    );
  },

  async advanceStatus(id, status, session, comment) {
    await latency();
    requireScope(session, 'orders:approve', 'cambiar el estado de un pedido');
    const order = getState().orders.find((o) => o.id === id);
    if (!order) throw new ServiceError(ERROR_CODES.NOT_FOUND, 'Pedido inexistente.', 404, [], requestId());
    const updated: Order = structuredClone(order);
    updated.status = status;
    updated.version += 1;
    updated.allowedModifications = ALLOWED_MODIFICATIONS[status];
    if (status === 'SHIPPED') updated.shippedAt = now();
    if (status === 'DELIVERED') updated.deliveredAt = now();
    updated.requiredApprovals = updated.requiredApprovals.map((a) =>
      a.status === 'PENDING' && status !== 'PENDING_APPROVAL' ? { ...a, status: 'APPROVED', approver: session.name } : a,
    );
    pushAudit(updated, session, `Estado actualizado a ${status}`, {
      previousValue: order.status,
      newValue: status,
      comment: comment ?? null,
    });
    mutate((s) => {
      s.orders = s.orders.map((o) => (o.id === id ? updated : o));
      s.webhooks = [buildWebhook('order.status_changed', { orderId: id, previousStatus: order.status, status }), ...s.webhooks];
    });
    return updated;
  },
};

function buildWebhook(type: WebhookDelivery['type'], data: Record<string, unknown>): WebhookDelivery {
  return {
    id: `whd_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    eventId: eventId(),
    type,
    occurredAt: now(),
    apiVersion: '2026-09-01',
    endpoint: 'https://hooks.partner.example/ashir',
    status: 'DELIVERED',
    attempts: 1,
    responseCode: 200,
    durationMs: Math.round(80 + Math.random() * 400),
    payload: { eventId: eventId(), type, occurredAt: now(), apiVersion: '2026-09-01', data },
  };
}

/* ------------------------------------------------------------------ */
/* precio especial                                                     */
/* ------------------------------------------------------------------ */

/** Oculta costo y margen a los roles que no deben verlos. */
function sanitizeRequest(request: SpecialPriceRequest, session: Session): SpecialPriceRequest {
  if (can(session, 'margin:read')) return request;
  return { ...request, cost: null, resultingMarginPct: null, baseMarginPct: null };
}

const specialPrice: ApiClient['specialPrice'] = {
  async list(filter, session) {
    await latency();
    let items = getState().specialPriceRequests;
    if (session.role === 'CLIENT') items = items.filter((r) => r.customerId === session.customerId);
    else if (filter.customerId) items = items.filter((r) => r.customerId === filter.customerId);
    if (session.role === 'PM') items = items.filter((r) => r.pmId === session.userId);
    if (filter.status) items = items.filter((r) => r.status === filter.status);
    if (filter.pmId) items = items.filter((r) => r.pmId === filter.pmId);
    return items.map((r) => sanitizeRequest(r, session));
  },

  async get(id, session) {
    await fastLatency();
    const request = getState().specialPriceRequests.find((r) => r.id === id || r.code === id);
    if (!request) throw new ServiceError(ERROR_CODES.NOT_FOUND, 'Solicitud inexistente.', 404, [], requestId());
    if (session.role === 'CLIENT' && request.customerId !== session.customerId) {
      throw new ServiceError(ERROR_CODES.FORBIDDEN, 'La solicitud pertenece a otra cuenta.', 403, [], requestId());
    }
    return sanitizeRequest(request, session);
  },

  async create(draft, session) {
    await latency();
    const customer = resolveCustomer(session, draft.customerId);
    const product = productById(draft.productId ?? '') ?? productBySku(draft.sku ?? '');
    if (!product?.listPrice) {
      throw new ServiceError(ERROR_CODES.NOT_FOUND, 'Producto inexistente o sin precio publicado.', 404, [], requestId());
    }

    const current = num(product.listPrice);
    const target = draft.targetPrice ? num(draft.targetPrice) : current * 0.9;
    const cost = product.cost ? num(product.cost) : current * 0.82;
    const highest = getState().specialPriceRequests.reduce((max, r) => {
      const n = Number.parseInt(r.code.replace('PE-', ''), 10);
      return Number.isFinite(n) ? Math.max(max, n) : max;
    }, 1_042);
    const code = `PE-${highest + 1}`;

    const request: SpecialPriceRequest = {
      id: `spr_${code.toLowerCase().replace('-', '_')}`,
      code,
      customerId: customer.id,
      customerName: customer.tradeName,
      productId: product.id,
      sku: product.sku,
      productName: product.name,
      brand: product.brand,
      quantity: draft.quantity ?? 1,
      currentPrice: money(current),
      targetPrice: money(target),
      approvedPrice: null,
      approvedQuantity: null,
      approvedValidUntil: null,
      cost: money(cost),
      resultingMarginPct: (((target - cost) / Math.max(0.01, target)) * 100).toFixed(1),
      baseMarginPct: (((current - cost) / Math.max(0.01, current)) * 100).toFixed(1),
      endCustomer: draft.endCustomer ?? '',
      project: draft.project ?? '',
      competitor: draft.competitor ?? null,
      expectedCloseDate: draft.expectedCloseDate ?? addDays(now(), 15),
      comments: draft.comments ?? '',
      attachments: draft.attachments ?? [],
      status: 'SUBMITTED',
      pmId: product.pmId,
      salesRepId: customer.salesRepId,
      createdAt: now(),
      updatedAt: now(),
      auditLog: [
        {
          id: `aud_${code}_1`,
          at: now(),
          actor: customer.tradeName,
          actorRole: session.role,
          action: 'Solicitud de precio especial creada',
          entity: 'SpecialPriceRequest',
          entityId: code,
          previousValue: null,
          newValue: 'SUBMITTED',
          origin: 'PORTAL',
          requestId: requestId(),
          comment: null,
        },
      ],
    };

    mutate((s) => {
      s.specialPriceRequests = [request, ...s.specialPriceRequests];
      s.notifications = [
        {
          id: `ntf_${Date.now()}`,
          roles: ['SALES', 'PM', 'ADMIN'],
          customerId: null,
          kind: 'SPECIAL_PRICE',
          title: `Nueva solicitud ${code}`,
          body: `${customer.tradeName} pide USD ${target.toFixed(2)} por ${request.quantity} unidades de ${product.sku}.`,
          at: now(),
          read: false,
          href: `/bo/solicitudes/${request.id}`,
          severity: 'WARNING',
        },
        ...s.notifications,
      ];
    });

    return sanitizeRequest(request, session);
  },

  async approve(id, session, comment) {
    return decide(id, 'APPROVED', session, comment);
  },
  async counteroffer(id, price, session, comment) {
    return decide(id, 'COUNTEROFFERED', session, comment, price);
  },
  async reject(id, session, comment) {
    return decide(id, 'REJECTED', session, comment);
  },
};

async function decide(
  id: string,
  status: SpecialPriceRequest['status'],
  session: Session,
  comment?: string,
  price?: number,
): Promise<SpecialPriceRequest> {
  await latency();
  requireScope(session, 'pricing:manage', 'decidir sobre solicitudes de precio especial');

  const request = getState().specialPriceRequests.find((r) => r.id === id || r.code === id);
  if (!request) throw new ServiceError(ERROR_CODES.NOT_FOUND, 'Solicitud inexistente.', 404, [], requestId());

  const finalPrice = status === 'COUNTEROFFERED' ? (price ?? num(request.targetPrice)) : num(request.targetPrice);
  const cost = num(request.cost);

  const updated: SpecialPriceRequest = {
    ...structuredClone(request),
    status,
    approvedPrice: status === 'REJECTED' ? null : money(finalPrice),
    approvedQuantity: status === 'REJECTED' ? null : request.quantity,
    approvedValidUntil: status === 'REJECTED' ? null : addDays(now(), 30),
    resultingMarginPct: (((finalPrice - cost) / Math.max(0.01, finalPrice)) * 100).toFixed(1),
    updatedAt: now(),
  };

  updated.auditLog = [
    ...updated.auditLog,
    {
      id: `aud_${request.code}_${updated.auditLog.length + 1}`,
      at: now(),
      actor: session.name,
      actorRole: session.role,
      action:
        status === 'APPROVED' ? 'Solicitud aprobada' : status === 'COUNTEROFFERED' ? 'Contraoferta enviada' : 'Solicitud rechazada',
      entity: 'SpecialPriceRequest',
      entityId: request.code,
      previousValue: request.status,
      newValue: status,
      origin: 'PORTAL',
      requestId: requestId(),
      comment: comment ?? null,
    },
  ];

  mutate((s) => {
    s.specialPriceRequests = s.specialPriceRequests.map((r) => (r.id === updated.id ? updated : r));
    s.notifications = [
      {
        id: `ntf_${Date.now()}`,
        roles: ['CLIENT'],
        customerId: request.customerId,
        kind: 'SPECIAL_PRICE',
        title:
          status === 'APPROVED'
            ? `Tu solicitud ${request.code} fue aprobada`
            : status === 'COUNTEROFFERED'
              ? `Recibiste una contraoferta en ${request.code}`
              : `Tu solicitud ${request.code} fue rechazada`,
        body:
          status === 'REJECTED'
            ? (comment ?? 'El precio solicitado no cumple el piso de margen de la marca.')
            : `Precio ${status === 'COUNTEROFFERED' ? 'ofrecido' : 'aprobado'}: USD ${finalPrice.toFixed(2)} por ${request.quantity} unidades, válido 30 días.`,
        at: now(),
        read: false,
        href: `/precio-especial/${request.id}`,
        severity: status === 'REJECTED' ? 'WARNING' : 'SUCCESS',
      },
      ...s.notifications,
    ];
    if (status === 'APPROVED') {
      s.webhooks = [
        buildWebhook('special_price.approved', {
          requestId: request.id,
          code: request.code,
          approvedPrice: { amount: finalPrice.toFixed(2), currency: 'USD' },
          maxQuantity: request.quantity,
        }),
        ...s.webhooks,
      ];
    }
  });

  return sanitizeRequest(updated, session);
}

/* ------------------------------------------------------------------ */
/* partner program                                                     */
/* ------------------------------------------------------------------ */

const partner: ApiClient['partner'] = {
  async status(session): Promise<PartnerStatus> {
    await latency();
    const customer = resolveCustomer(session);
    const base = partnerStatusFor(customer.id);
    const redeemed = getState().redeemedBenefits[customer.id] ?? [];
    return {
      ...base,
      points: base.points - redeemed.reduce((acc, id) => acc + (PARTNER_BENEFITS.find((b) => b.id === id)?.cost ?? 0), 0),
      benefits: base.benefits.map((b) => (redeemed.includes(b.id) ? { ...b, status: 'ACTIVE' } : b)),
    };
  },

  async redeem(benefitId, session) {
    await latency();
    const customer = resolveCustomer(session);
    const benefit = PARTNER_BENEFITS.find((b) => b.id === benefitId);
    if (!benefit) throw new ServiceError(ERROR_CODES.NOT_FOUND, 'Beneficio inexistente.', 404, [], requestId());

    mutate((s) => {
      const list = s.redeemedBenefits[customer.id] ?? [];
      if (!list.includes(benefitId)) s.redeemedBenefits[customer.id] = [...list, benefitId];
      s.notifications = [
        {
          id: `ntf_${Date.now()}`,
          roles: ['CLIENT'],
          customerId: customer.id,
          kind: 'POINTS',
          title: `Canjeaste "${benefit.name}"`,
          body: benefit.cost
            ? `Se descontaron ${benefit.cost.toLocaleString('es-AR')} puntos de tu cuenta.`
            : 'El beneficio quedó activo en tu cuenta.',
          at: now(),
          read: false,
          href: '/beneficios',
          severity: 'SUCCESS',
        },
        ...s.notifications,
      ];
    });

    return partner.status(session);
  },
};

/* ------------------------------------------------------------------ */
/* RMA                                                                 */
/* ------------------------------------------------------------------ */

const rma: ApiClient['rma'] = {
  async lookupSerial(serial, session): Promise<SerialLookupResult> {
    await latency();
    const code = serial.trim().toUpperCase();
    const record = getState().serials.find((s) => s.serial.toUpperCase() === code);

    /* --- escenario: serial de otro reseller --- */
    if (isScenarioOn('SERIAL_OTHER_RESELLER')) {
      return notYourAccount(code);
    }

    if (!record) {
      return {
        status: 'NOT_FOUND',
        serial: code,
        record: null,
        message:
          'No encontramos ese número de serie en nuestros registros. Verificá que esté completo y sin espacios, o consultá con tu ejecutivo.',
        warrantyDaysRemaining: null,
        eligibility: null,
      };
    }

    /* --- REGLA CRITICA DE PRIVACIDAD ---
       Si el serial pertenece a otro reseller, no se devuelve ningun dato
       comercial del tercero: ni factura, ni fecha, ni razon social. */
    if (session.role === 'CLIENT' && record.customerId !== session.customerId) {
      return notYourAccount(code);
    }

    const openCase = getState().rmaCases.find(
      (c) => !['CLOSED', 'REJECTED'].includes(c.status) && c.units.some((u) => u.serial === record.serial),
    );

    const expiresAt = new Date(record.warrantyExpiresAt).getTime();
    const daysRemaining = Math.round((expiresAt - Date.now()) / 86_400_000);
    const expired = isScenarioOn('WARRANTY_EXPIRED') || daysRemaining < 0;
    const eligibility = buildEligibility(record.serial);

    if (openCase) {
      return {
        status: 'RMA_ALREADY_OPEN',
        serial: code,
        record,
        message: `Ya existe un caso abierto para este número de serie: ${openCase.code}. Podés seguir su estado desde el detalle del caso.`,
        warrantyDaysRemaining: daysRemaining,
        eligibility,
      };
    }

    if (expired) {
      return {
        status: 'WARRANTY_EXPIRED',
        serial: code,
        record,
        message: `La garantía de este producto venció el ${new Date(record.warrantyExpiresAt).toLocaleDateString('es-AR')}. Podés solicitar una revisión paga o consultar con tu ejecutivo.`,
        warrantyDaysRemaining: daysRemaining,
        eligibility: eligibility ? { ...eligibility, eligible: false } : null,
      };
    }

    return {
      status: 'IN_WARRANTY',
      serial: code,
      record,
      message: `Producto en garantía hasta el ${new Date(record.warrantyExpiresAt).toLocaleDateString('es-AR')}.`,
      warrantyDaysRemaining: daysRemaining,
      eligibility,
    };
  },

  async eligibleSerials(session) {
    await latency();
    if (!session.customerId) return [];
    const openSerials = new Set(
      getState()
        .rmaCases.filter((c) => !['CLOSED', 'REJECTED'].includes(c.status))
        .flatMap((c) => c.units.map((u) => u.serial)),
    );
    return getState()
      .serials.filter((s) => s.customerId === session.customerId && !openSerials.has(s.serial))
      .sort((a, b) => new Date(b.purchasedAt).getTime() - new Date(a.purchasedAt).getTime());
  },

  async listCases(filter, session) {
    await latency();
    let items = getState().rmaCases;
    if (session.role === 'CLIENT') items = items.filter((c) => c.customerId === session.customerId);
    else if (filter.customerId) items = items.filter((c) => c.customerId === filter.customerId);
    if (filter.status) items = items.filter((c) => c.status === filter.status);
    if (filter.brand) items = items.filter((c) => c.units.some((u) => u.brand === filter.brand));
    if (filter.breachedOnly) items = items.filter((c) => c.sla.breached || isScenarioOn('RMA_SLA_BREACH'));
    if (filter.query) {
      const q = normalize(filter.query);
      items = items.filter(
        (c) =>
          normalize(c.code).includes(q) ||
          normalize(c.customerName).includes(q) ||
          c.units.some((u) => normalize(u.serial).includes(q) || normalize(u.sku).includes(q) || normalize(u.productName).includes(q)),
      );
    }
    if (isScenarioOn('RMA_SLA_BREACH')) {
      items = items.map((c) =>
        ['CLOSED', 'REJECTED'].includes(c.status) ? c : { ...c, sla: { ...c.sla, breached: true, remainingHours: -12 } },
      );
    }
    return items;
  },

  async getCase(id, session) {
    await fastLatency();
    const found = getState().rmaCases.find((c) => c.id === id || c.code === id);
    if (!found) throw new ServiceError(ERROR_CODES.NOT_FOUND, 'Caso de RMA inexistente.', 404, [], requestId());
    if (session.role === 'CLIENT' && found.customerId !== session.customerId) {
      throw new ServiceError(ERROR_CODES.FORBIDDEN, 'El caso pertenece a otra cuenta.', 403, [], requestId());
    }
    return found;
  },

  async createCase(draft, session) {
    await latency();
    requireScope(session, 'rma:write', 'crear casos de garantía');

    const records = draft.serials
      .map((s) => getState().serials.find((r) => r.serial.toUpperCase() === s.trim().toUpperCase()))
      .filter((r): r is SerialRecord => Boolean(r));

    if (records.length === 0) {
      throw new ServiceError(ERROR_CODES.SERIAL_NOT_FOUND, 'Ninguno de los seriales indicados es válido.', 400, [], requestId());
    }
    if (session.role === 'CLIENT' && records.some((r) => r.customerId !== session.customerId)) {
      throw new ServiceError(
        ERROR_CODES.SERIAL_NOT_OWNED,
        'Uno de los seriales no pertenece a tu cuenta.',
        403,
        [],
        requestId(),
      );
    }

    const highest = getState().rmaCases.reduce((max, c) => {
      const n = Number.parseInt(c.code.replace('RMA-', ''), 10);
      return Number.isFinite(n) ? Math.max(max, n) : max;
    }, 260_100);
    const code = `RMA-${highest + 1}`;
    const policy = policyFor(records[0]!.brand);

    const units: RmaUnit[] = records.map((record, i) => ({
      id: `unit_${code}_${i}`,
      serial: record.serial,
      productId: record.productId,
      sku: record.sku,
      productName: record.productName,
      brand: record.brand,
      lotId: record.lotId,
      problemType: draft.problemType,
      problemLabel: RMA_PROBLEM[draft.problemType],
      description: draft.description,
      answers: draft.answers,
      status: 'SUBMITTED',
      eligibility: buildEligibility(record.serial),
      diagnosis: null,
      resolution: null,
      receivedAt: null,
      receptionIssue: null,
    }));

    const timeline: RmaCase['timeline'] = [
      {
        id: `tl_${code}_0`,
        at: now(),
        status: 'SUBMITTED',
        label: 'Solicitud creada',
        actor: session.role === 'CLIENT' ? records[0]!.customerName : session.name,
        actorRole: session.role,
        comment: `Se inició la gestión por ${units.length} ${units.length === 1 ? 'unidad' : 'unidades'} desde el portal.`,
        documents: [],
        unitSerial: null,
      },
    ];

    const newCase: RmaCase = {
      id: `rma_${code.toLowerCase().replace('-', '_')}`,
      code,
      customerId: records[0]!.customerId,
      customerName: records[0]!.customerName,
      units,
      status: 'SUBMITTED',
      isBatch: units.length > 1,
      createdAt: now(),
      updatedAt: now(),
      submittedAt: now(),
      closedAt: null,
      assignedTo: null,
      priority: units.length > 2 ? 'HIGH' : 'NORMAL',
      logistics: {
        mode: draft.logisticsMode,
        remitNumber: null,
        labelCode: `ETQ-${code}`,
        carrier: draft.logisticsMode === 'CARRIER' ? 'Andreani' : null,
        expectedUnits: units.length,
        receivedUnits: 0,
        receptionPhotos: 0,
        receptionNotes: null,
      },
      sla: {
        stage: 'VALIDATION',
        targetHours: policy.slaValidationHours,
        elapsedHours: 0,
        remainingHours: policy.slaValidationHours,
        breached: false,
        pausedReason: null,
        dueAt: addDays(now(), policy.slaValidationHours / 24),
      },
      attachments: [],
      timeline,
      auditLog: [
        {
          id: `aud_${code}_0`,
          at: now(),
          actor: session.role === 'CLIENT' ? records[0]!.customerName : session.name,
          actorRole: session.role,
          action: 'Caso de RMA creado',
          entity: 'RmaCase',
          entityId: code,
          previousValue: null,
          newValue: 'SUBMITTED',
          origin: 'PORTAL',
          requestId: requestId(),
          comment: null,
        },
      ],
      troubleshootingOutcome: draft.troubleshootingOutcome,
    };

    mutate((s) => {
      s.rmaCases = [newCase, ...s.rmaCases];
      s.serials = s.serials.map((r) =>
        records.some((x) => x.serial === r.serial) ? { ...r, openRmaId: newCase.id } : r,
      );
      s.notifications = [
        {
          id: `ntf_${Date.now()}`,
          roles: ['RMA', 'ADMIN'],
          customerId: null,
          kind: 'RMA',
          title: `Nuevo caso ${code}`,
          body: `${newCase.customerName} inició una gestión por ${units.length} ${units.length === 1 ? 'unidad' : 'unidades'} de ${units[0]!.brand}.`,
          at: now(),
          read: false,
          href: `/bo/rma/${newCase.id}`,
          severity: 'INFO',
        },
        ...s.notifications,
      ];
      s.webhooks = [
        buildWebhook('rma.created', { rmaId: newCase.id, code, customerId: newCase.customerId, units: units.length, serials: units.map((u) => u.serial) }),
        ...s.webhooks,
      ];
    });

    return newCase;
  },

  async approveReception(id, session) {
    return advanceRma(id, 'AWAITING_SHIPMENT', session, 'Recepción aprobada. Se emitió el remito y la etiqueta de envío.');
  },

  async receive(id, units, notes, session) {
    await latency();
    requireScope(session, 'rma:manage', 'registrar recepciones de RMA');
    const found = getState().rmaCases.find((c) => c.id === id || c.code === id);
    if (!found) throw new ServiceError(ERROR_CODES.NOT_FOUND, 'Caso inexistente.', 404, [], requestId());

    const updated: RmaCase = structuredClone(found);
    updated.units = updated.units.map((u) => {
      const received = units.find((x) => x.serial === u.serial);
      return received ? { ...u, receivedAt: now(), receptionIssue: received.issue, status: 'RECEIVED' as RmaStatus } : u;
    });
    updated.logistics = {
      ...updated.logistics,
      receivedUnits: updated.units.filter((u) => u.receivedAt).length,
      receptionNotes: notes || updated.logistics.receptionNotes,
      remitNumber: updated.logistics.remitNumber ?? `RM-${Math.floor(Math.random() * 90_000 + 10_000)}`,
      receptionPhotos: updated.logistics.receptionPhotos + units.length,
    };
    updated.status = 'RECEIVED';
    updated.updatedAt = now();
    appendRmaEvent(updated, 'RECEIVED', 'Producto recibido', session, `Se registraron ${units.length} unidad(es) en depósito. ${notes}`.trim());

    commitRma(updated);
    return updated;
  },

  async registerDiagnosis(id, serial, diagnosis, session) {
    await latency();
    requireScope(session, 'rma:manage', 'registrar diagnósticos');
    const found = getState().rmaCases.find((c) => c.id === id || c.code === id);
    if (!found) throw new ServiceError(ERROR_CODES.NOT_FOUND, 'Caso inexistente.', 404, [], requestId());

    const updated: RmaCase = structuredClone(found);
    updated.units = updated.units.map((u) =>
      u.serial === serial
        ? {
            ...u,
            diagnosis: { ...diagnosis, at: now() },
            status: diagnosis.recommendation === 'SENT_TO_MANUFACTURER' ? 'MANUFACTURER' : 'DIAGNOSIS',
            eligibility: buildEligibility(serial, diagnosis.flags),
          }
        : u,
    );
    updated.status = diagnosis.recommendation === 'SENT_TO_MANUFACTURER' ? 'MANUFACTURER' : 'DIAGNOSIS';
    updated.updatedAt = now();
    appendRmaEvent(
      updated,
      updated.status,
      diagnosis.recommendation === 'SENT_TO_MANUFACTURER' ? 'Derivado al fabricante' : 'Diagnóstico técnico registrado',
      session,
      diagnosis.findings,
      serial,
    );

    commitRma(updated);
    return updated;
  },

  async resolve(id, serial, resolution, session) {
    await latency();
    requireScope(session, 'rma:manage', 'resolver casos de garantía');
    const found = getState().rmaCases.find((c) => c.id === id || c.code === id);
    if (!found) throw new ServiceError(ERROR_CODES.NOT_FOUND, 'Caso inexistente.', 404, [], requestId());

    const updated: RmaCase = structuredClone(found);
    updated.units = updated.units.map((u) =>
      u.serial === serial
        ? { ...u, resolution: { ...resolution, at: now() }, status: resolution.type === 'REJECTED' ? 'REJECTED' : 'READY_FOR_PICKUP' }
        : u,
    );

    const allResolved = updated.units.every((u) => u.resolution);
    updated.status = allResolved ? (updated.units.every((u) => u.resolution?.type === 'REJECTED') ? 'REJECTED' : 'READY_FOR_PICKUP') : 'RESOLUTION';
    updated.updatedAt = now();
    if (allResolved) updated.closedAt = null;

    appendRmaEvent(updated, updated.status, 'Resolución registrada', session, resolution.notes, serial);

    // Si hubo reemplazo, el serial nuevo hereda la trazabilidad del original.
    if (resolution.replacementSerial) {
      const original = getState().serials.find((s) => s.serial === serial);
      if (original) {
        mutate((s) => {
          s.serials = [
            ...s.serials.map((r) => (r.serial === serial ? { ...r, replacedBySerial: resolution.replacementSerial } : r)),
            {
              ...original,
              serial: resolution.replacementSerial!,
              openRmaId: null,
              replacedBySerial: null,
              warrantyExpiresAt: resolution.resultingWarrantyExpiresAt ?? original.warrantyExpiresAt,
            },
          ];
        });
      }
    }

    commitRma(updated);
    mutate((s) => {
      s.webhooks = [
        buildWebhook('rma.resolved', {
          rmaId: updated.id,
          code: updated.code,
          serial,
          resolution: resolution.type,
          replacementSerial: resolution.replacementSerial,
        }),
        ...s.webhooks,
      ];
      s.notifications = [
        {
          id: `ntf_${Date.now()}`,
          roles: ['CLIENT'],
          customerId: updated.customerId,
          kind: 'RMA',
          title: `Tu caso ${updated.code} tiene resolución`,
          body: resolution.notes || 'El caso de garantía fue resuelto. Revisá el detalle para ver los pasos siguientes.',
          at: now(),
          read: false,
          href: `/rma/${updated.id}`,
          severity: resolution.type === 'REJECTED' ? 'WARNING' : 'SUCCESS',
        },
        ...s.notifications,
      ];
    });

    return updated;
  },

  async analytics(brandId) {
    await latency();
    return rmaAnalytics(brandId);
  },

  async listLots() {
    await fastLatency();
    return RMA_LOTS;
  },

  async getLot(code) {
    await fastLatency();
    const lot = RMA_LOTS.find((l) => l.code === code || l.id === code);
    if (!lot) throw new ServiceError(ERROR_CODES.NOT_FOUND, 'Lote inexistente.', 404, [], requestId());
    return lot;
  },

  async listPolicies() {
    await fastLatency();
    return WARRANTY_POLICIES;
  },

  async universalSearch(term, session) {
    await fastLatency();
    if (!term.trim()) return [];
    const q = normalize(term);
    const results: { kind: string; label: string; sublabel: string; href: string }[] = [];

    for (const s of getState().serials) {
      if (!normalize(s.serial).includes(q)) continue;
      if (session.role === 'CLIENT' && s.customerId !== session.customerId) continue;
      results.push({
        kind: 'Serial',
        label: s.serial,
        sublabel: `${s.productName} · ${s.orderNumber}`,
        href: session.role === 'CLIENT' ? `/rma/consulta?serial=${s.serial}` : `/bo/rma?q=${s.serial}`,
      });
      if (results.length > 5) break;
    }

    for (const c of getState().rmaCases) {
      if (session.role === 'CLIENT' && c.customerId !== session.customerId) continue;
      if (normalize(c.code).includes(q)) {
        results.push({
          kind: 'RMA',
          label: c.code,
          sublabel: `${c.customerName} · ${c.units.length} unidad(es)`,
          href: session.role === 'CLIENT' ? `/rma/${c.id}` : `/bo/rma/${c.id}`,
        });
      }
    }

    for (const o of getState().orders) {
      if (session.role === 'CLIENT' && o.customerId !== session.customerId) continue;
      if (normalize(o.number).includes(q)) {
        results.push({
          kind: 'Pedido',
          label: o.number,
          sublabel: `${o.customerName} · USD ${o.total.amount}`,
          href: session.role === 'CLIENT' ? `/pedidos/${o.id}` : `/bo/pedidos/${o.id}`,
        });
      }
      if (o.invoiceIds.length && normalize(o.number).includes(q)) continue;
    }

    if (session.role !== 'CLIENT') {
      for (const c of CUSTOMERS) {
        if (normalize(c.tradeName).includes(q) || c.taxId.includes(q)) {
          results.push({ kind: 'Cliente', label: c.tradeName, sublabel: `${c.code} · ${c.segment}`, href: `/bo/clientes/${c.id}` });
        }
      }
    }

    for (const p of PRODUCTS) {
      if (normalize(p.sku).includes(q)) {
        results.push({
          kind: 'SKU',
          label: p.sku,
          sublabel: p.name,
          href: session.role === 'CLIENT' ? `/catalogo/${p.sku}` : `/bo/productos?q=${p.sku}`,
        });
      }
      if (results.length > 24) break;
    }

    return uniqueBy(results, (r) => r.href).slice(0, 20);
  },
};

function notYourAccount(serial: string): SerialLookupResult {
  return {
    status: 'NOT_YOUR_ACCOUNT',
    serial,
    // Sin `record`: no se expone ningun dato del tercero.
    record: null,
    message:
      'El producto fue distribuido por Ashir, pero no encontramos una compra asociada a tu cuenta. Contactá a tu ejecutivo para revisar el caso.',
    warrantyDaysRemaining: null,
    eligibility: null,
  };
}

function appendRmaEvent(
  target: RmaCase,
  status: RmaStatus,
  label: string,
  session: Session,
  comment: string,
  unitSerial: string | null = null,
) {
  target.timeline = [
    ...target.timeline,
    {
      id: `tl_${target.code}_${target.timeline.length}`,
      at: now(),
      status,
      label,
      actor: session.name,
      actorRole: session.role,
      comment: comment || null,
      documents: [],
      unitSerial,
    },
  ];
  target.auditLog = [
    ...target.auditLog,
    {
      id: `aud_${target.code}_${target.auditLog.length}`,
      at: now(),
      actor: session.name,
      actorRole: session.role,
      action: label,
      entity: 'RmaCase',
      entityId: target.code,
      previousValue: target.auditLog[target.auditLog.length - 1]?.newValue ?? null,
      newValue: status,
      origin: 'PORTAL',
      requestId: requestId(),
      comment: comment || null,
    },
  ];

  const policy = policyFor(target.units[0]?.brand ?? '');
  const stage = RMA_FLOW.indexOf(status) >= RMA_FLOW.indexOf('RESOLUTION') ? 'RESOLUTION' : RMA_FLOW.indexOf(status) >= RMA_FLOW.indexOf('RECEIVED') ? 'DIAGNOSIS' : 'VALIDATION';
  const targetHours =
    stage === 'VALIDATION' ? policy.slaValidationHours : stage === 'DIAGNOSIS' ? policy.slaDiagnosisHours : policy.slaResolutionDays * 24;
  target.sla = {
    stage: ['READY_FOR_PICKUP', 'CLOSED', 'REJECTED'].includes(status) ? 'DONE' : stage,
    targetHours,
    elapsedHours: 0,
    remainingHours: targetHours,
    breached: false,
    pausedReason: status === 'MANUFACTURER' ? 'Esperando respuesta del fabricante' : null,
    dueAt: addDays(now(), targetHours / 24),
  };
}

function commitRma(updated: RmaCase) {
  mutate((s) => {
    s.rmaCases = s.rmaCases.map((c) => (c.id === updated.id ? updated : c));
    s.webhooks = [buildWebhook('rma.status_changed', { rmaId: updated.id, code: updated.code, status: updated.status }), ...s.webhooks];
  });
}

async function advanceRma(id: string, status: RmaStatus, session: Session, comment: string): Promise<RmaCase> {
  await latency();
  requireScope(session, 'rma:manage', 'avanzar casos de garantía');
  const found = getState().rmaCases.find((c) => c.id === id || c.code === id);
  if (!found) throw new ServiceError(ERROR_CODES.NOT_FOUND, 'Caso inexistente.', 404, [], requestId());

  const updated: RmaCase = structuredClone(found);
  updated.status = status;
  updated.assignedTo = updated.assignedTo ?? session.name;
  updated.updatedAt = now();
  if (status === 'AWAITING_SHIPMENT') {
    updated.logistics.remitNumber = updated.logistics.remitNumber ?? `RM-${Math.floor(Math.random() * 90_000 + 10_000)}`;
  }
  updated.units = updated.units.map((u) => ({ ...u, status }));
  appendRmaEvent(updated, status, status === 'AWAITING_SHIPMENT' ? 'Validación Ashir aprobada' : 'Estado actualizado', session, comment);
  commitRma(updated);
  return updated;
}

/* ------------------------------------------------------------------ */
/* product manager                                                     */
/* ------------------------------------------------------------------ */

const pm: ApiClient['pm'] = {
  async listBrandsForPm(session) {
    await fastLatency();
    const visible = BRANDS.filter((b) => (session.role === 'ADMIN' ? true : ownsBrand(session, b.id)));
    return (visible.length > 0 ? visible : BRANDS).map((b) => ({
      id: b.id,
      name: b.name,
      color: b.color,
      skuCount: b.skuCount,
    }));
  },

  async dashboard(brandId, session) {
    await latency();
    requireScope(session, 'pm:read', 'ver el cockpit de Product Management');
    return brandDashboard(brandId);
  },

  async simulate(input: CommercialSimulationInput) {
    await fastLatency();
    return commercialSimulation(input);
  },
};

/* ------------------------------------------------------------------ */
/* integraciones                                                       */
/* ------------------------------------------------------------------ */

function applyErpScenario(integration: Integration): Integration {
  if (!isScenarioOn('ERP_DOWN')) return integration;
  if (integration.kind !== 'ERP' && integration.id !== 'int_nodo') return integration;
  return {
    ...integration,
    status: 'OFFLINE',
    errorCount: integration.errorCount + 4,
    entities: integration.entities.map((e) => ({ ...e, status: 'OFFLINE' as const })),
  };
}

const integrations: ApiClient['integrations'] = {
  async list() {
    await latency();
    return getState().integrations.map(applyErpScenario);
  },

  async get(id) {
    await fastLatency();
    const found = getState().integrations.find((i) => i.id === id);
    if (!found) throw new ServiceError(ERROR_CODES.NOT_FOUND, 'Integración inexistente.', 404, [], requestId());
    return applyErpScenario(found);
  },

  async runs(id) {
    await fastLatency();
    return getState().integrationRuns.filter((r) => r.integrationId === id);
  },

  async getRun(runId) {
    await fastLatency();
    const run = getState().integrationRuns.find((r) => r.id === runId);
    if (!run) throw new ServiceError(ERROR_CODES.NOT_FOUND, 'Ejecución inexistente.', 404, [], requestId());
    return run;
  },

  async sync(id) {
    await latency();
    const integration = getState().integrations.find((i) => i.id === id);
    if (!integration) throw new ServiceError(ERROR_CODES.NOT_FOUND, 'Integración inexistente.', 404, [], requestId());

    if (isScenarioOn('ERP_DOWN') && (integration.kind === 'ERP' || integration.id === 'int_nodo')) {
      const failed: IntegrationRun = {
        id: `run_${Date.now()}`,
        integrationId: id,
        at: now(),
        process: 'Sincronización manual',
        direction: 'BIDIRECTIONAL',
        records: 0,
        durationMs: 12_400,
        result: 'FAILED',
        warnings: [],
        errors: ['No se pudo establecer conexión con el servicio remoto (timeout tras 3 reintentos).'],
        requestId: requestId(),
        summary: 'La ejecución falló. El conector reintentará según su política.',
      };
      mutate((s) => {
        s.integrationRuns = [failed, ...s.integrationRuns];
        s.webhooks = [buildWebhook('integration.sync_failed', { integrationId: id, attempts: 3 }), ...s.webhooks];
      });
      throw new ServiceError(
        ERROR_CODES.UPSTREAM_UNAVAILABLE,
        'No se pudo establecer conexión con el servicio remoto.',
        503,
        [],
        failed.requestId,
      );
    }

    const records = Math.round(40 + Math.random() * 260);
    const run: IntegrationRun = {
      id: `run_${Date.now()}`,
      integrationId: id,
      at: now(),
      process: 'Sincronización manual',
      direction: 'BIDIRECTIONAL',
      records,
      durationMs: Math.round(600 + Math.random() * 3_200),
      result: 'SUCCESS',
      warnings: [],
      errors: [],
      requestId: requestId(),
      summary: `${records} registros procesados sin errores.`,
    };

    mutate((s) => {
      s.integrationRuns = [run, ...s.integrationRuns];
      s.integrations = s.integrations.map((i) =>
        i.id === id ? { ...i, lastSyncAt: now(), recordsProcessed: i.recordsProcessed + records } : i,
      );
    });
    return run;
  },

  async testConnection(id) {
    await latency();
    const integration = getState().integrations.find((i) => i.id === id);
    const reqId = requestId();
    if (!integration) throw new ServiceError(ERROR_CODES.NOT_FOUND, 'Integración inexistente.', 404, [], reqId);

    if (isScenarioOn('ERP_DOWN') && (integration.kind === 'ERP' || integration.id === 'int_nodo')) {
      return { ok: false, message: 'Sin respuesta del servicio remoto (timeout de 10 s).', latencyMs: 10_000, requestId: reqId };
    }
    if (integration.status === 'NOT_CONFIGURED') {
      return {
        ok: false,
        message: 'El adaptador todavía no está definido. Configurá el endpoint antes de probar la conexión.',
        latencyMs: 0,
        requestId: reqId,
      };
    }
    return {
      ok: true,
      message: 'Conexión establecida correctamente. El servicio respondió 200 OK.',
      latencyMs: Math.round(80 + Math.random() * 320),
      requestId: reqId,
    };
  },

  async updateConfiguration(id, patch) {
    await latency();
    let updated: Integration | undefined;
    mutate((s) => {
      s.integrations = s.integrations.map((i) => {
        if (i.id !== id) return i;
        updated = { ...i, ...patch };
        return updated;
      });
    });
    if (!updated) throw new ServiceError(ERROR_CODES.NOT_FOUND, 'Integración inexistente.', 404, [], requestId());
    return updated;
  },

  async listWebhooks() {
    await fastLatency();
    return getState().webhooks;
  },

  async resendWebhook(id) {
    await latency();
    let updated: WebhookDelivery | undefined;
    mutate((s) => {
      s.webhooks = s.webhooks.map((w) => {
        if (w.id !== id) return w;
        updated = { ...w, status: 'DELIVERED', attempts: w.attempts + 1, responseCode: 200, durationMs: Math.round(90 + Math.random() * 300) };
        return updated;
      });
    });
    if (!updated) throw new ServiceError(ERROR_CODES.NOT_FOUND, 'Entrega inexistente.', 404, [], requestId());
    return updated;
  },
};

/* ------------------------------------------------------------------ */
/* importaciones                                                       */
/* ------------------------------------------------------------------ */

const imports: ApiClient['imports'] = {
  async history() {
    await latency();
    return getState().imports;
  },

  async preview(file: File): Promise<ImportPreview> {
    // La lectura del archivo la hace el componente con SheetJS; aca solo
    // se simula la latencia del servicio.
    await latency();
    void file;
    throw new ServiceError(
      ERROR_CODES.INTERNAL,
      'La previsualización se resuelve en el cliente con SheetJS.',
      500,
      [],
      requestId(),
    );
  },

  async validate(preview, mapping) {
    await latency();
    const rows = preview.rows.length;
    const errors: ImportRun['errors'] = [];
    const skuIndex = mapping.findIndex((m) => m.target === 'sku');
    const priceIndex = mapping.findIndex((m) => m.target === 'listPrice');
    const seen = new Set<string>();

    preview.rows.forEach((row, i) => {
      const sku = skuIndex >= 0 ? String(row[skuIndex] ?? '').trim() : '';
      const price = priceIndex >= 0 ? row[priceIndex] : null;

      if (!sku) {
        errors.push({ row: i + 2, column: 'SKU', value: '', code: 'REQUIRED_FIELD', message: 'El SKU es obligatorio.', severity: 'ERROR' });
      } else if (seen.has(sku)) {
        errors.push({ row: i + 2, column: 'SKU', value: sku, code: 'DUPLICATE_SKU', message: 'SKU repetido dentro del archivo.', severity: 'ERROR' });
      } else {
        seen.add(sku);
      }

      if (price !== null && price !== undefined && price !== '' && !Number.isFinite(Number(price))) {
        errors.push({
          row: i + 2,
          column: 'Precio',
          value: String(price),
          code: 'INVALID_NUMBER',
          message: 'El precio no es numérico: la fila se importaría como "consultar".',
          severity: 'WARNING',
        });
      }
    });

    const blocking = errors.filter((e) => e.severity === 'ERROR').length;
    const existing = new Set(PRODUCTS.map((p) => p.sku));
    const creates = [...seen].filter((s) => !existing.has(s)).length;

    const run: ImportRun = {
      id: `imp_${Date.now()}`,
      fileName: 'archivo-cargado.xlsx',
      sheet: preview.detectedSheets[0] ?? '—',
      startedAt: now(),
      finishedAt: now(),
      actor: 'Valeria Quiroga',
      status: 'PREVIEW',
      rowsTotal: rows,
      rowsValid: rows - blocking,
      rowsWithErrors: errors.length,
      creates,
      updates: seen.size - creates,
      unchanged: 0,
      mapping,
      errors,
      mode: 'SIMULATION',
    };

    mutate((s) => {
      s.imports = [run, ...s.imports];
    });
    return run;
  },

  async commit(runId) {
    await latency();
    let updated: ImportRun | undefined;
    mutate((s) => {
      s.imports = s.imports.map((r) => {
        if (r.id !== runId) return r;
        updated = { ...r, status: 'COMMITTED', mode: 'SIMULATION', finishedAt: now() };
        return updated;
      });
    });
    if (!updated) throw new ServiceError(ERROR_CODES.NOT_FOUND, 'Ejecución de importación inexistente.', 404, [], requestId());
    return updated;
  },
};

/* ------------------------------------------------------------------ */
/* notificaciones                                                      */
/* ------------------------------------------------------------------ */

const notifications: ApiClient['notifications'] = {
  async list(session): Promise<Notification[]> {
    await fastLatency();
    return getState().notifications.filter((n) => {
      if (!n.roles.includes(session.role)) return false;
      if (session.role === 'CLIENT') return n.customerId === session.customerId;
      return true;
    });
  },

  async markRead(id) {
    await fastLatency();
    mutate((s) => {
      s.notifications = s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n));
    });
    return getState().notifications;
  },

  async markAllRead(session) {
    await fastLatency();
    mutate((s) => {
      s.notifications = s.notifications.map((n) =>
        n.roles.includes(session.role) && (session.role !== 'CLIENT' || n.customerId === session.customerId)
          ? { ...n, read: true }
          : n,
      );
    });
    return notifications.list(session);
  },
};

/* ------------------------------------------------------------------ */

export const mockClient: ApiClient = {
  catalog,
  pricing,
  customers,
  orders,
  specialPrice,
  partner,
  rma,
  pm,
  integrations,
  imports,
  notifications,
  mode: 'mock',
};
