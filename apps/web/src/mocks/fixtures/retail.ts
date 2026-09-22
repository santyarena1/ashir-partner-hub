/**
 * Control de PVP (precio de venta al publico).
 *
 * El Product Manager de cada marca fija un PVP por SKU. El sistema lee los
 * precios que cada reseller publica en su propio sitio —via feed XML, Google
 * Merchant, CSV o API— y los compara contra ese PVP una vez por dia.
 *
 * QUE ES REAL: los SKU, las marcas y el precio final sugerido salen de la
 * lista de distribuidor de Ashir (columna FINAL).
 * QUE ES SIMULADO: las politicas del PM, las conexiones de los resellers y
 * los precios observados. En produccion el feed lo publica cada reseller y
 * la lectura la hace un job diario.
 */
import type { FeedKind, Money, ResellerFeed, RetailObservation, RetailPolicy } from '@/types';
import { addDays, betweenSeeded, money, num, seeded } from '@/lib/utils';
import { PRODUCTS } from '@/mocks/fixtures/catalog';
import { CUSTOMERS } from '@/mocks/fixtures/customers';
import { personName } from '@/mocks/fixtures/people';

const NOW = new Date('2026-09-22T11:00:00-03:00').toISOString();

/** Ultima corrida del job que lee los feeds. */
export const LAST_FEED_RUN = addDays(NOW, -0.28);

/* ================================================================== */
/* politicas de PVP                                                    */
/* ================================================================== */

/**
 * No todos los productos tienen PVP: la politica se define sobre los que
 * le importan a la marca, que son los de mayor rotacion y los que se usan
 * como gancho de precio. Se toman los mas vendidos de cada marca.
 */
const POLICY_PRODUCTS = (() => {
  const byBrand = new Map<string, typeof PRODUCTS>();
  for (const p of PRODUCTS) {
    if (!p.listPrice || !p.suggestedRetail) continue;
    const list = byBrand.get(p.brandId) ?? [];
    list.push(p);
    byBrand.set(p.brandId, list);
  }
  const chosen: typeof PRODUCTS = [];
  for (const [, list] of byBrand) {
    list.sort((a, b) => b.unitsSold12m - a.unitsSold12m);
    chosen.push(...list.slice(0, 9));
  }
  return chosen;
})();

export const RETAIL_POLICIES: RetailPolicy[] = POLICY_PRODUCTS.map((product) => {
  const rnd = seeded(`pvp${product.sku}`);
  /* El PVP parte del precio final sugerido de la lista y el PM lo ajusta. */
  const base = num(product.suggestedRetail);
  const pvp = Math.round(base * (0.98 + rnd() * 0.1) * 100) / 100;
  const listPrice = num(product.listPrice);
  const resellerMarginPct = listPrice > 0 && pvp > 0 ? ((pvp - listPrice) / pvp) * 100 : null;

  /* MAP activo en los SKU que la marca quiere cuidar en gondola. */
  const enforced = betweenSeeded(`enf${product.sku}`, 0, 10) > 3;

  return {
    id: `rp_${product.sku.toLowerCase()}`,
    productId: product.id,
    sku: product.sku,
    productName: product.name,
    brandId: product.brandId,
    brand: product.brand,
    pvp: money(pvp),
    tolerancePct: enforced ? 3 : 8,
    enforced,
    resellerMarginPct: resellerMarginPct === null ? null : Math.round(resellerMarginPct * 10) / 10,
    updatedAt: addDays(NOW, -betweenSeeded(`upd${product.sku}`, 1, 60)),
    updatedBy: personName(product.pmId),
    source: 'PM',
    notes: enforced
      ? 'Precio mínimo anunciado acordado con la marca. Publicar por debajo requiere autorización.'
      : null,
  };
});

export function policyForProduct(productId: string): RetailPolicy | undefined {
  return RETAIL_POLICIES.find((p) => p.productId === productId);
}

export function policyBySku(sku: string): RetailPolicy | undefined {
  return RETAIL_POLICIES.find((p) => p.sku === sku);
}

/* ================================================================== */
/* conexiones con el sitio de cada reseller                            */
/* ================================================================== */

const FEED_KINDS: FeedKind[] = ['XML', 'GOOGLE_MERCHANT', 'CSV', 'API'];

const MONITORED = CUSTOMERS.filter((c) => c.status !== 'PROSPECT');

export const RESELLER_FEEDS: ResellerFeed[] = MONITORED.map((customer, i) => {
  const host = `${customer.tradeName.toLowerCase().replace(/[^a-z0-9]/g, '')}.com.ar`;
  const kind = FEED_KINDS[betweenSeeded(`fk${customer.id}`, 0, FEED_KINDS.length - 1)]!;
  const url =
    kind === 'GOOGLE_MERCHANT'
      ? `https://${host}/feeds/google-merchant.xml`
      : kind === 'CSV'
        ? `https://${host}/exports/precios.csv`
        : kind === 'API'
          ? `https://api.${host}/v1/products`
          : `https://${host}/feed/productos.xml`;

  /* Una conexion caida y una pendiente de alta, para mostrar los estados. */
  const status: ResellerFeed['status'] =
    i === 2 ? 'ERROR' : i === 5 ? 'PENDING' : i === 1 ? 'WARNING' : 'OK';
  const itemsFound = status === 'PENDING' ? 0 : betweenSeeded(`fi${customer.id}`, 180, 2400);
  const matchedSkus =
    status === 'PENDING' ? 0 : Math.round(itemsFound * (0.18 + seeded(`fm${customer.id}`)() * 0.35));

  return {
    id: `feed_${customer.id}`,
    customerId: customer.id,
    customerName: customer.tradeName,
    kind: status === 'PENDING' ? 'MANUAL' : kind,
    url: status === 'PENDING' ? '' : url,
    status,
    schedule: 'DAILY',
    lastRunAt: status === 'PENDING' ? null : LAST_FEED_RUN,
    nextRunAt: status === 'PENDING' ? null : addDays(LAST_FEED_RUN, 1),
    itemsFound,
    matchedSkus,
    matchBy: kind === 'API' ? 'SKU' : kind === 'GOOGLE_MERCHANT' ? 'EAN' : 'PART_NUMBER',
    message:
      status === 'ERROR'
        ? 'La URL responde 403 desde el 20/09. El reseller tiene que habilitar el acceso del lector de Ashir.'
        : status === 'WARNING'
          ? 'El feed no trae el precio final con IVA en 118 ítems: se usó el precio sin impuestos como aproximación.'
          : status === 'PENDING'
            ? 'Conexión no configurada. El reseller todavía no publicó un feed.'
            : null,
    createdAt: addDays(NOW, -betweenSeeded(`fc${customer.id}`, 40, 400)),
  };
});

export function feedForCustomer(customerId: string): ResellerFeed | undefined {
  return RESELLER_FEEDS.find((f) => f.customerId === customerId);
}

/* ================================================================== */
/* observaciones de precio publicado                                   */
/* ================================================================== */

function buildHistory(seed: string, price: number): { at: string; price: Money }[] {
  const rnd = seeded(`h${seed}`);
  return Array.from({ length: 14 }, (_, i) => {
    const drift = 1 + (rnd() - 0.45) * 0.06;
    return {
      at: addDays(NOW, -(13 - i)),
      price: money(Math.round(price * (i === 13 ? 1 : drift) * 100) / 100),
    };
  });
}

export const RETAIL_OBSERVATIONS: RetailObservation[] = RESELLER_FEEDS.filter(
  (f) => f.status !== 'PENDING',
).flatMap((feed) => {
  const customer = CUSTOMERS.find((c) => c.id === feed.customerId)!;

  /* Cada reseller publica solo una parte del catálogo con política. */
  return RETAIL_POLICIES.filter(
    (policy) => betweenSeeded(`lst${feed.customerId}${policy.sku}`, 0, 10) > 4,
  ).map((policy) => {
    const rnd = seeded(`obs${feed.customerId}${policy.sku}`);
    const roll = rnd();

    /*
     * ~22% publica por debajo del PVP, ~14% por encima, el resto en línea.
     * El desvío hacia abajo es más agresivo en los resellers grandes.
     */
    const aggressive = num(customer.purchases12m) > 400_000;
    let factor: number;
    if (roll < 0.22) factor = 1 - (aggressive ? 0.06 + rnd() * 0.16 : 0.04 + rnd() * 0.09);
    else if (roll < 0.36) factor = 1 + 0.03 + rnd() * 0.12;
    else factor = 1 + (rnd() - 0.5) * 0.02;

    const pvp = num(policy.pvp);
    const published = Math.round(pvp * factor * 100) / 100;
    const deviationPct = Math.round(((published - pvp) / pvp) * 1000) / 10;

    const status: RetailObservation['status'] =
      deviationPct < -policy.tolerancePct
        ? 'BELOW'
        : deviationPct > policy.tolerancePct
          ? 'ABOVE'
          : 'OK';

    return {
      id: `obs_${feed.customerId}_${policy.sku.toLowerCase()}`,
      customerId: customer.id,
      customerName: customer.tradeName,
      productId: policy.productId,
      sku: policy.sku,
      productName: policy.productName,
      brandId: policy.brandId,
      brand: policy.brand,
      observedAt: LAST_FEED_RUN,
      publishedPrice: money(published),
      pvp: policy.pvp,
      deviationPct,
      status,
      url: `${feed.url.replace(/\/[^/]*$/, '')}/producto/${policy.sku.toLowerCase()}`,
      enforced: policy.enforced,
      acknowledgedAt:
        status === 'BELOW' && betweenSeeded(`ack${feed.customerId}${policy.sku}`, 0, 10) > 7
          ? addDays(NOW, -1)
          : null,
      history: buildHistory(`${feed.customerId}${policy.sku}`, published),
    };
  });
});

export function observationsForCustomer(customerId: string): RetailObservation[] {
  return RETAIL_OBSERVATIONS.filter((o) => o.customerId === customerId);
}

/** Desvíos por debajo que el reseller todavía no marcó como vistos. */
export function openBreachesForCustomer(customerId: string): RetailObservation[] {
  return RETAIL_OBSERVATIONS.filter(
    (o) => o.customerId === customerId && o.status === 'BELOW' && !o.acknowledgedAt,
  );
}

/** Un PM sólo controla el PVP de sus propias marcas. */
export function observationsForBrands(brandIds: string[] | undefined): RetailObservation[] {
  if (!brandIds || brandIds.length === 0) return RETAIL_OBSERVATIONS;
  return RETAIL_OBSERVATIONS.filter((o) => brandIds.includes(o.brandId));
}
