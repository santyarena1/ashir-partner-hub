/**
 * Derivaciones analiticas para el PM Cockpit y para calidad/RMA.
 *
 * Las series se calculan a partir del catalogo real y del set de pedidos y
 * RMAs, de modo que los numeros de una marca cierran entre pantallas: si el
 * dashboard dice 43 RMAs de MSI, el centro de RMA lista 43 casos de MSI.
 */
import type {
  CommercialSimulationInput,
  CommercialSimulationResult,
  PmBrandDashboard,
  RmaAnalytics,
  StockAgingBucket,
} from '@/types';
import { BRANDS, PRODUCTS, productBySku } from '@/mocks/fixtures/catalog';
import { ALL_ORDERS } from '@/mocks/fixtures/orders';
import { CUSTOMERS } from '@/mocks/fixtures/customers';
import { PRODUCT_MANAGERS } from '@/mocks/fixtures/people';
import { RMA_CASES } from '@/mocks/fixtures/rma';
import { RMA_LOTS } from '@/mocks/fixtures/serials';
import { RMA_PROBLEM, RMA_RESOLUTION } from '@/lib/labels';
import { addDays, betweenSeeded, money, monthLabel, num, seeded } from '@/lib/utils';

const NOW = new Date('2026-09-22T11:00:00-03:00');

/** Los 12 meses cerrados hacia atras, con etiqueta corta. */
function lastTwelveMonths(): { iso: string; label: string }[] {
  const out: { iso: string; label: string }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(NOW.getFullYear(), NOW.getMonth() - i, 1);
    out.push({ iso: d.toISOString(), label: monthLabel(d.toISOString()) });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* dashboard por marca                                                 */
/* ------------------------------------------------------------------ */

export function brandDashboard(brandId: string): PmBrandDashboard {
  const brand = BRANDS.find((b) => b.id === brandId) ?? BRANDS[0]!;
  const products = PRODUCTS.filter((p) => p.brandId === brand.id);
  const priced = products.filter((p) => p.listPrice);
  const pm = PRODUCT_MANAGERS.find((p) => p.id === brand.pmId) ?? PRODUCT_MANAGERS[0]!;
  const rnd = seeded(brand.id);

  /* --- ventas: escaladas por el peso real de la marca dentro del catalogo --- */
  const months = lastTwelveMonths();
  // Base mensual estable + estacionalidad suave, escalada por el tamaño real de la marca.
  const brandWeight = priced.reduce((acc, p) => acc + num(p.listPrice) * p.unitsSold12m, 0) / 12;

  const series = months.map((m, i) => {
    const seasonal = 0.82 + 0.36 * Math.sin((i / 11) * Math.PI * 1.2);
    const noise = 0.9 + seeded(brand.id + i)() * 0.22;
    const sales = Math.round((brandWeight / 1_000) * seasonal * noise);
    const avgPrice = priced.length ? brandWeight / Math.max(1, priced.reduce((a, p) => a + p.unitsSold12m, 0) / 12) : 1;
    const units = Math.max(1, Math.round(sales / Math.max(1, avgPrice / 40)));
    const marginPct = Number((17 + seeded(brand.id + 'm' + i)() * 9).toFixed(1));
    const stockValue = Math.round(sales * (1.6 + seeded(brand.id + 's' + i)() * 0.9));
    const coverageDays = Math.round(28 + seeded(brand.id + 'c' + i)() * 42);
    return { month: m.label, sales, units, marginPct, stockValue, coverageDays };
  });

  const current = series[series.length - 1]!;
  const previous = series[series.length - 2]!;
  const salesVsPrev = previous.sales > 0 ? ((current.sales - previous.sales) / previous.sales) * 100 : 0;
  const marginVsPrev = current.marginPct - previous.marginPct;

  const stockValue = priced.reduce((acc, p) => acc + num(p.listPrice) * p.stock, 0);
  const totalUnits = priced.reduce((acc, p) => acc + p.stock, 0);
  const monthlyUnits = Math.max(1, Math.round(priced.reduce((acc, p) => acc + p.unitsSold12m, 0) / 12));
  const coverageDays = Math.round((totalUnits / monthlyUnits) * 30);
  const turnover = (monthlyUnits * 12) / Math.max(1, totalUnits);

  /* --- clientes --- */
  const customersWithBrand = CUSTOMERS.filter((c) => c.topBrands.includes(brand.name));
  const sellIn = customersWithBrand.map((c, i) => ({
    customerId: c.id,
    customer: c.tradeName,
    amount: Math.round(current.sales * (0.28 - i * 0.03) * (1 + seeded(c.id + brand.id)() * 0.5)),
  }));
  const sellInTotal = Math.max(1, sellIn.reduce((acc, s) => acc + s.amount, 0));
  const sellInByCustomer = sellIn
    .map((s) => ({ ...s, sharePct: ((s.amount / sellInTotal) * 100).toFixed(1) }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8);

  /* --- mix de categorias --- */
  const mixMap = new Map<string, number>();
  for (const p of priced) {
    mixMap.set(p.category, (mixMap.get(p.category) ?? 0) + num(p.listPrice) * p.unitsSold12m);
  }
  const mixTotal = Math.max(1, [...mixMap.values()].reduce((a, b) => a + b, 0));
  const categoryMix = [...mixMap.entries()]
    .map(([category, amount]) => ({
      category,
      amount: Math.round(amount / 12),
      sharePct: ((amount / mixTotal) * 100).toFixed(1),
    }))
    .sort((a, b) => b.amount - a.amount);

  /* --- top SKUs --- */
  const topSkus = [...priced]
    .sort((a, b) => b.unitsSold12m * num(b.listPrice) - a.unitsSold12m * num(a.listPrice))
    .slice(0, 8)
    .map((p) => ({
      sku: p.sku,
      name: p.name,
      units: Math.round(p.unitsSold12m / 12),
      amount: Math.round((p.unitsSold12m / 12) * num(p.listPrice)),
      marginPct: (p.marginPct ?? 0).toFixed(1),
    }));

  /* --- stock aging --- */
  const stockAging = buildStockAging(brand.id, priced);

  /* --- productos sin movimiento --- */
  const stagnantProducts = [...priced]
    .filter((p) => p.stock > 0)
    .sort((a, b) => a.unitsSold12m - b.unitsSold12m)
    .slice(0, 6)
    .map((p) => ({
      sku: p.sku,
      name: p.name,
      stock: p.stock,
      daysWithoutSale: betweenSeeded(p.sku + 'dws', 45, 190),
      stockValue: Math.round(num(p.listPrice) * p.stock),
    }))
    .sort((a, b) => b.daysWithoutSale - a.daysWithoutSale);

  /* --- clientes que dejaron de comprar --- */
  const churningCustomers = CUSTOMERS.filter((c) => c.lastOrderAt && c.orderFrequencyDays > 0)
    .map((c) => ({
      customerId: c.id,
      customer: c.tradeName,
      lastOrderAt: c.lastOrderAt!,
      previous12m: Math.round(num(c.purchasesPrevious12m)),
      gapRatio:
        (NOW.getTime() - new Date(c.lastOrderAt!).getTime()) / 86_400_000 / Math.max(1, c.orderFrequencyDays),
    }))
    .filter((c) => c.gapRatio > 1.6)
    .sort((a, b) => b.gapRatio - a.gapRatio)
    .slice(0, 5)
    .map(({ gapRatio: _gap, ...rest }) => rest);

  /* --- proximos quiebres de stock --- */
  const upcomingStockouts = priced
    .filter((p) => p.stock > 0)
    .map((p) => {
      const dailyRate = p.unitsSold12m / 365;
      return {
        sku: p.sku,
        name: p.name,
        stock: p.stock,
        dailyRate: dailyRate.toFixed(2),
        daysLeft: Math.round(p.stock / Math.max(0.05, dailyRate)),
      };
    })
    .filter((p) => p.daysLeft < 30)
    .sort((a, b) => a.daysLeft - b.daysLeft)
    .slice(0, 6);

  /* --- RMA --- */
  const brandRmas = RMA_CASES.filter((r) => r.units.some((u) => u.brand === brand.name));
  const brandUnitsSold = priced.reduce((acc, p) => acc + p.unitsSold12m, 0);
  const rmaRate = brandUnitsSold > 0 ? (brandRmas.length / brandUnitsSold) * 100 : 0;

  const criticalSkus = priced.filter((p) => p.stock > 0 && p.stock <= 5).length;
  const monthlyTarget = num(pm.monthlyTarget) / Math.max(1, pm.brandIds.length);

  return {
    brandId: brand.id,
    brand: brand.name,
    color: brand.color,
    pm: pm.name,
    salesMonth: money(current.sales),
    salesMonthVsPrevPct: salesVsPrev.toFixed(1),
    grossMarginPct: current.marginPct.toFixed(1),
    grossMarginVsPrevPct: marginVsPrev.toFixed(1),
    stockValue: money(stockValue),
    turnover: turnover.toFixed(1),
    coverageDays,
    monthlyTarget: money(monthlyTarget),
    targetProgressPct: Math.min(140, Math.round((current.sales / Math.max(1, monthlyTarget)) * 100)),
    activeCustomers: customersWithBrand.length,
    activeCustomersVsPrev: Math.round(rnd() * 4) - 1,
    criticalSkus,
    rmaCount: brandRmas.length,
    rmaRatePct: rmaRate.toFixed(2),
    series,
    sellInByCustomer,
    categoryMix,
    topSkus,
    stagnantProducts,
    churningCustomers,
    upcomingStockouts,
    stockAging,
  };
}

function buildStockAging(brandId: string, products: typeof PRODUCTS): StockAgingBucket[] {
  const buckets: StockAgingBucket['bucket'][] = ['0-30', '31-60', '61-90', '91-120', '120+'];
  const result: StockAgingBucket[] = buckets.map((bucket) => ({ bucket, units: 0, value: 0, skus: [] }));

  for (const p of products) {
    if (p.stock <= 0 || !p.listPrice) continue;
    // La antiguedad se deriva de la rotacion: lo que menos rota, envejece mas.
    const dailyRate = p.unitsSold12m / 365;
    const days = Math.min(400, Math.round(p.stock / Math.max(0.05, dailyRate)));
    const idx = days <= 30 ? 0 : days <= 60 ? 1 : days <= 90 ? 2 : days <= 120 ? 3 : 4;
    const bucket = result[idx]!;
    bucket.units += p.stock;
    bucket.value += Math.round(num(p.listPrice) * p.stock);
    bucket.skus.push({ sku: p.sku, name: p.name, units: p.stock, days });
  }

  for (const bucket of result) {
    bucket.skus.sort((a, b) => b.units - a.units);
    bucket.skus = bucket.skus.slice(0, 10);
  }
  void brandId;
  return result;
}

/* ------------------------------------------------------------------ */
/* analytics de RMA por marca                                          */
/* ------------------------------------------------------------------ */

export function rmaAnalytics(brandId: string): RmaAnalytics {
  const brand = BRANDS.find((b) => b.id === brandId) ?? BRANDS[0]!;
  const products = PRODUCTS.filter((p) => p.brandId === brand.id);
  const cases = RMA_CASES.filter((r) => r.units.some((u) => u.brand === brand.name));
  const units = cases.flatMap((c) => c.units.filter((u) => u.brand === brand.name));
  const unitsSold = products.reduce((acc, p) => acc + p.unitsSold12m, 0);
  const rate = unitsSold > 0 ? (units.length / unitsSold) * 100 : 0;

  /* --- evolucion mensual --- */
  const months = lastTwelveMonths();
  const monthly = months.map((m, i) => {
    const sold = Math.round(unitsSold / 12 * (0.85 + seeded(brand.id + 'ms' + i)() * 0.3));
    const rmaInMonth = units.filter((u) => {
      const c = cases.find((x) => x.units.includes(u));
      if (!c) return false;
      const d = new Date(c.createdAt);
      return d.getMonth() === new Date(m.iso).getMonth() && d.getFullYear() === new Date(m.iso).getFullYear();
    }).length;
    return {
      month: m.label,
      sold,
      rma: rmaInMonth,
      ratePct: sold > 0 ? ((rmaInMonth / sold) * 100).toFixed(2) : '0.00',
    };
  });

  /* --- motivos --- */
  const reasonMap = new Map<string, number>();
  for (const u of units) {
    const label = RMA_PROBLEM[u.problemType];
    reasonMap.set(label, (reasonMap.get(label) ?? 0) + 1);
  }
  const reasonTotal = Math.max(1, units.length);
  const reasons = [...reasonMap.entries()]
    .map(([reason, count]) => ({ reason, count, pct: ((count / reasonTotal) * 100).toFixed(1) }))
    .sort((a, b) => b.count - a.count);

  /* --- top SKUs con alerta de tasa anomala --- */
  const skuMap = new Map<string, number>();
  for (const u of units) skuMap.set(u.sku, (skuMap.get(u.sku) ?? 0) + 1);

  const topSkus = [...skuMap.entries()]
    .map(([sku, rmaCount]) => {
      const product = productBySku(sku);
      const sold = product?.unitsSold12m ?? 1;
      const skuRate = (rmaCount / Math.max(1, sold)) * 100;
      const vsAvg = rate > 0 ? skuRate / rate : 1;
      return {
        sku,
        productName: product?.name ?? sku,
        sold,
        rma: rmaCount,
        ratePct: skuRate.toFixed(2),
        vsBrandAvg: `${vsAvg.toFixed(1)}×`,
        alert: vsAvg >= 2,
      };
    })
    .sort((a, b) => Number.parseFloat(b.ratePct) - Number.parseFloat(a.ratePct))
    .slice(0, 8);

  /* --- resultados --- */
  const outcomeMap = new Map<string, number>();
  for (const u of units) {
    if (!u.resolution) continue;
    const label = RMA_RESOLUTION[u.resolution.type].label;
    outcomeMap.set(label, (outcomeMap.get(label) ?? 0) + 1);
  }
  const outcomeTotal = Math.max(1, [...outcomeMap.values()].reduce((a, b) => a + b, 0));
  const outcomes = [...outcomeMap.entries()]
    .map(([outcome, count]) => ({ outcome, count, pct: ((count / outcomeTotal) * 100).toFixed(1) }))
    .sort((a, b) => b.count - a.count);

  /* --- tiempo de resolucion --- */
  const resolved = cases.filter((c) => c.closedAt);
  const avgResolutionDays = resolved.length
    ? resolved.reduce(
        (acc, c) => acc + (new Date(c.closedAt!).getTime() - new Date(c.createdAt).getTime()) / 86_400_000,
        0,
      ) / resolved.length
    : 0;

  return {
    brandId: brand.id,
    brand: brand.name,
    unitsSold,
    rmaCount: units.length,
    rmaRatePct: rate.toFixed(2),
    avgResolutionDays: Number(avgResolutionDays.toFixed(1)),
    awaitingManufacturer: cases.filter((c) => c.status === 'MANUFACTURER').length,
    monthly,
    reasons,
    topSkus,
    outcomes,
    lots: RMA_LOTS.filter((l) => l.brand === brand.name).map((l) => ({
      lotId: l.id,
      code: l.code,
      ratePct: l.rmaRatePct,
      incidentSuspected: l.incidentSuspected,
    })),
  };
}

/* ------------------------------------------------------------------ */
/* simulador comercial                                                 */
/* ------------------------------------------------------------------ */

export function commercialSimulation(input: CommercialSimulationInput): CommercialSimulationResult {
  const { cost, currentPrice, stock, fxRate, discountPct, expectedUnits } = input;
  const newPrice = Math.round(currentPrice * (1 - discountPct / 100) * 100) / 100;

  const marginUsd = newPrice - cost;
  const marginPct = newPrice > 0 ? (marginUsd / newPrice) * 100 : 0;
  const baseMarginUsd = currentPrice - cost;
  const baseMarginPct = currentPrice > 0 ? (baseMarginUsd / currentPrice) * 100 : 0;

  const revenueEstimate = newPrice * expectedUnits;
  const fullStockImpact = (currentPrice - newPrice) * stock;
  const stockSellThroughPct = stock > 0 ? Math.min(100, (expectedUnits / stock) * 100) : 0;

  const comparison = [
    { label: 'Precio unitario', base: currentPrice, scenario: newPrice, delta: newPrice - currentPrice, unit: 'USD' },
    { label: 'Margen unitario', base: baseMarginUsd, scenario: marginUsd, delta: marginUsd - baseMarginUsd, unit: 'USD' },
    { label: 'Margen %', base: baseMarginPct, scenario: marginPct, delta: marginPct - baseMarginPct, unit: '%' },
    {
      label: 'Facturación estimada',
      base: currentPrice * expectedUnits,
      scenario: revenueEstimate,
      delta: revenueEstimate - currentPrice * expectedUnits,
      unit: 'USD',
    },
    {
      label: 'Margen total del escenario',
      base: baseMarginUsd * expectedUnits,
      scenario: marginUsd * expectedUnits,
      delta: (marginUsd - baseMarginUsd) * expectedUnits,
      unit: 'USD',
    },
  ];

  // Sensibilidad: el costo de reposicion sigue al dolar, el precio de venta no.
  const fxSensitivity = [-15, -7.5, 0, 7.5, 15].map((deltaPct) => {
    const scenarioFx = Math.round(fxRate * (1 + deltaPct / 100));
    const adjustedCost = cost * (1 + deltaPct / 100);
    const m = newPrice - adjustedCost;
    return {
      fxRate: scenarioFx,
      marginPct: Number((newPrice > 0 ? (m / newPrice) * 100 : 0).toFixed(1)),
      marginUsd: Number(m.toFixed(2)),
    };
  });

  return {
    input,
    newPrice,
    marginPct: Number(marginPct.toFixed(1)),
    marginUsd: Number(marginUsd.toFixed(2)),
    baseMarginPct: Number(baseMarginPct.toFixed(1)),
    baseMarginUsd: Number(baseMarginUsd.toFixed(2)),
    revenueEstimate: Number(revenueEstimate.toFixed(2)),
    fullStockImpact: Number(fullStockImpact.toFixed(2)),
    stockSellThroughPct: Number(stockSellThroughPct.toFixed(1)),
    comparison,
    fxSensitivity,
  };
}

/* ------------------------------------------------------------------ */
/* metricas del backoffice                                             */
/* ------------------------------------------------------------------ */

export function backofficeOverview() {
  const active = ALL_ORDERS.filter((o) => !['DELIVERED', 'CANCELLED', 'DRAFT'].includes(o.status));
  const monthOrders = ALL_ORDERS.filter(
    (o) => new Date(o.createdAt).getMonth() === NOW.getMonth() && o.status !== 'CANCELLED',
  );
  const monthRevenue = monthOrders.reduce((acc, o) => acc + num(o.subtotal), 0);
  const prevMonthRevenue = monthRevenue * 0.88;

  const openRmas = RMA_CASES.filter((r) => !['CLOSED', 'REJECTED'].includes(r.status));
  const breached = RMA_CASES.filter((r) => r.sla.breached);

  const salesSeries = lastTwelveMonths().map((m, i) => ({
    month: m.label,
    revenue: Math.round((monthRevenue / 1.4) * (0.78 + Math.sin((i / 11) * Math.PI * 1.3) * 0.3 + seeded('bo' + i)() * 0.18)),
    orders: Math.round(22 + seeded('boo' + i)() * 18),
  }));

  return {
    monthRevenue: money(monthRevenue),
    monthRevenueVsPrevPct: (((monthRevenue - prevMonthRevenue) / Math.max(1, prevMonthRevenue)) * 100).toFixed(1),
    activeOrders: active.length,
    pendingApproval: ALL_ORDERS.filter((o) => o.status === 'PENDING_APPROVAL').length,
    openRmas: openRmas.length,
    breachedRmas: breached.length,
    activeCustomers: CUSTOMERS.filter((c) => c.status === 'ACTIVE').length,
    overdueCustomers: CUSTOMERS.filter((c) => num(c.account.overdue) > 0).length,
    criticalStock: PRODUCTS.filter((p) => p.listPrice && p.stock > 0 && p.stock <= 5).length,
    totalStockValue: money(PRODUCTS.reduce((acc, p) => acc + (p.listPrice ? num(p.listPrice) * p.stock : 0), 0)),
    salesSeries,
    ordersByStatus: Object.entries(
      ALL_ORDERS.reduce<Record<string, number>>((acc, o) => {
        acc[o.status] = (acc[o.status] ?? 0) + 1;
        return acc;
      }, {}),
    ).map(([status, count]) => ({ status, count })),
    topCustomers: [...CUSTOMERS]
      .sort((a, b) => num(b.purchases12m) - num(a.purchases12m))
      .slice(0, 6)
      .map((c) => ({ id: c.id, name: c.tradeName, amount: num(c.purchases12m), segment: c.segment })),
    brandShare: BRANDS.slice(0, 6).map((b) => {
      const value = PRODUCTS.filter((p) => p.brandId === b.id).reduce(
        (acc, p) => acc + (p.listPrice ? num(p.listPrice) * p.unitsSold12m : 0),
        0,
      );
      return { brand: b.name, value: Math.round(value / 12), color: b.color };
    }),
  };
}

/** Panel del ejecutivo comercial: su cartera. */
export function salesOverview(salesRepId: string) {
  const myCustomers = CUSTOMERS.filter((c) => c.salesRepId === salesRepId);
  const ids = new Set(myCustomers.map((c) => c.id));
  const myOrders = ALL_ORDERS.filter((o) => ids.has(o.customerId));

  return {
    customers: myCustomers,
    orders: myOrders,
    portfolio: money(myCustomers.reduce((acc, c) => acc + num(c.purchases12m), 0)),
    pendingApproval: myOrders.filter((o) => o.status === 'PENDING_APPROVAL' || o.status === 'SALES_REVIEW'),
    observed: myOrders.filter((o) => o.status === 'OBSERVED'),
    overdue: myCustomers.filter((c) => num(c.account.overdue) > 0),
    inactive: myCustomers.filter(
      (c) =>
        c.lastOrderAt &&
        (NOW.getTime() - new Date(c.lastOrderAt).getTime()) / 86_400_000 > c.orderFrequencyDays * 2,
    ),
    nextDue: myCustomers
      .filter((c) => c.account.nextDueDate)
      .sort((a, b) => new Date(a.account.nextDueDate!).getTime() - new Date(b.account.nextDueDate!).getTime())
      .slice(0, 5),
  };
}

export { addDays, betweenSeeded };
