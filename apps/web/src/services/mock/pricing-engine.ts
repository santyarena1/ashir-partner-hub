/**
 * Motor de precios y condiciones comerciales.
 *
 * Es la unica pieza del prototipo con logica de negocio real: todas las
 * pantallas que muestran un precio pasan por aca, de modo que el desglose
 * siempre coincide con el total. Devuelve el precio *explicado*, no un numero.
 *
 * Orden de evaluacion:
 *   1. precio de lista distribuidor (del Excel)
 *   2. lista de precios del cliente (ajuste base + regla por marca/categoria)
 *      u override puntual por SKU, que reemplaza todo lo anterior
 *   3. condiciones comerciales ordenadas por prioridad
 *      - una condicion no acumulable descarta las demas del mismo grupo
 *      - se respetan exclusiones, vigencia y limite de uso
 */
import type {
  CommercialCondition,
  ConditionSimulationResult,
  Customer,
  MissedOpportunity,
  Money,
  PaymentTerm,
  PriceAdjustment,
  PriceEvaluation,
  PriceList,
  PriceTier,
  Product,
} from '@/types';
import { COMMERCIAL_CONDITIONS, PRICE_LISTS } from '@/mocks/fixtures/pricing';
import { money, num } from '@/lib/utils';

export interface EvaluateInput {
  product: Product;
  customer: Customer;
  quantity: number;
  /** Fecha de evaluacion; por defecto ahora. */
  date?: string;
  /** Sobreescribe la condicion de pago del cliente (simulador). */
  paymentTerm?: PaymentTerm;
  /** Monto ya acumulado de la misma marca en el pedido, para condiciones por monto. */
  brandAmountInOrder?: number;
  /** Monto total del pedido, para condiciones por monto y flete. */
  orderAmount?: number;
  /**
   * Uso interno: los escalones se calculan llamando de nuevo al motor con
   * distintas cantidades. Esta bandera corta la recursión.
   */
  skipTiers?: boolean;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/* ------------------------------------------------------------------ */
/* helpers de vigencia y criterios                                     */
/* ------------------------------------------------------------------ */

function isActiveAt(condition: CommercialCondition, date: Date): boolean {
  if (condition.status === 'DRAFT' || condition.status === 'PAUSED') return false;
  const from = new Date(condition.validFrom).getTime();
  const to = new Date(condition.validTo).getTime();
  const t = date.getTime();
  return t >= from && t <= to;
}

function hasUsageLeft(condition: CommercialCondition): boolean {
  return condition.usageLimit === null || condition.usageCount < condition.usageLimit;
}

interface CriteriaContext {
  product: Product;
  customer: Customer;
  quantity: number;
  paymentTerm: PaymentTerm;
  brandAmount: number;
  orderAmount: number;
}

/**
 * Evalua un criterio. Devuelve `met` y, si no se cumple por poco,
 * datos para construir una oportunidad perdida.
 */
function evaluateCriterion(
  criterion: CommercialCondition['criteria'][number],
  ctx: CriteriaContext,
): { met: boolean; missingUnits?: number; missingAmount?: number; reason: string } {
  const { scope, operator, values } = criterion;
  const first = values[0] ?? '';

  switch (scope) {
    case 'BRAND': {
      const met = operator === 'IS_NOT' ? ctx.product.brand !== first : values.includes(ctx.product.brand);
      return { met, reason: met ? '' : `La marca del producto es ${ctx.product.brand}` };
    }
    case 'CATEGORY': {
      const met = operator === 'IS_NOT' ? ctx.product.category !== first : values.includes(ctx.product.category);
      return { met, reason: met ? '' : `La categoría del producto es ${ctx.product.category}` };
    }
    case 'SUBCATEGORY': {
      const met = values.includes(ctx.product.subcategory ?? '');
      return { met, reason: met ? '' : 'La subcategoría no coincide' };
    }
    case 'PRODUCT': {
      const met = values.includes(ctx.product.sku);
      return { met, reason: met ? '' : 'El SKU no está incluido en la condición' };
    }
    case 'CUSTOMER': {
      const met = values.includes(ctx.customer.id) || values.includes(ctx.customer.code);
      return { met, reason: met ? '' : 'La condición aplica a otros clientes' };
    }
    case 'SEGMENT': {
      const met = values.includes(ctx.customer.segment);
      return { met, reason: met ? '' : `El cliente es segmento ${ctx.customer.segment}` };
    }
    case 'PRICE_LIST': {
      const met = values.includes(ctx.customer.priceListId);
      return { met, reason: met ? '' : 'La lista asignada al cliente no coincide' };
    }
    case 'ZONE': {
      const met = values.includes(ctx.customer.zone);
      return { met, reason: met ? '' : `El cliente es zona ${ctx.customer.zone}` };
    }
    case 'PAYMENT': {
      const met = values.includes(ctx.paymentTerm);
      return { met, reason: met ? '' : 'La condición de pago del pedido no califica' };
    }
    case 'QUANTITY': {
      const min = Number.parseFloat(first);
      const met = operator === 'LTE' ? ctx.quantity <= min : ctx.quantity >= min;
      return {
        met,
        missingUnits: met ? undefined : Math.max(0, Math.ceil(min - ctx.quantity)),
        reason: met ? '' : `Requiere ${min} unidades y el pedido tiene ${ctx.quantity}`,
      };
    }
    case 'AMOUNT': {
      const min = Number.parseFloat(first);
      // Si la condicion es de marca, se mide contra el acumulado de esa marca.
      const relevant = ctx.brandAmount > 0 ? ctx.brandAmount : ctx.orderAmount;
      const met = relevant >= min;
      return {
        met,
        missingAmount: met ? undefined : round2(min - relevant),
        reason: met ? '' : `Requiere USD ${min} y el pedido acumula USD ${round2(relevant)}`,
      };
    }
    case 'DATE':
      return { met: true, reason: '' };
    default:
      return { met: false, reason: 'Criterio no soportado' };
  }
}

/* ------------------------------------------------------------------ */
/* lista de precios                                                    */
/* ------------------------------------------------------------------ */

interface ListResult {
  unitPrice: number;
  adjustment: PriceAdjustment | null;
  isOverride: boolean;
}

function applyPriceList(product: Product, list: PriceList | undefined, base: number): ListResult {
  if (!list) return { unitPrice: base, adjustment: null, isOverride: false };

  const override = list.overrides.find((o) => o.sku === product.sku);
  if (override) {
    const price = num(override.price);
    return {
      unitPrice: price,
      adjustment: {
        type: 'PRICE_LIST',
        label: `${list.code} · precio acordado`,
        percentage: base > 0 ? (((price - base) / base) * 100).toFixed(2) : null,
        amount: round2(price - base).toFixed(2),
        note: override.note,
      },
      isOverride: true,
    };
  }

  // La regla mas especifica gana: producto > categoria > marca > todo.
  const rule =
    list.rules.find((r) => r.scope === 'BRAND' && r.target === product.brand) ??
    list.rules.find((r) => r.scope === 'CATEGORY' && r.target === product.category) ??
    list.rules.find((r) => r.scope === 'ALL');

  const pct = Number.parseFloat(rule?.adjustmentPct ?? list.baseAdjustmentPct);
  if (!Number.isFinite(pct) || pct === 0) {
    return { unitPrice: base, adjustment: null, isOverride: false };
  }

  const delta = round2(base * (pct / 100));
  return {
    unitPrice: round2(base + delta),
    adjustment: {
      type: 'PRICE_LIST',
      label: `${list.code}${rule && rule.scope !== 'ALL' ? ` · ${rule.target}` : ''}`,
      percentage: pct.toFixed(2),
      amount: delta.toFixed(2),
      note: rule && rule.scope !== 'ALL' ? `Regla por ${rule.scope === 'BRAND' ? 'marca' : 'categoría'}` : undefined,
    },
    isOverride: false,
  };
}

/* ------------------------------------------------------------------ */
/* evaluacion principal                                               */
/* ------------------------------------------------------------------ */

/**
 * El motor devuelve el `PriceEvaluation` completo del contrato: además del
 * precio final incluye qué condiciones se aplicaron, cuáles no y por qué.
 */
export type EvaluationDetail = PriceEvaluation;

/**
 * Evalúa el precio y devuelve el resultado más favorable para el cliente.
 *
 * Una condición no acumulable descarta a las de menor prioridad, y eso puede
 * dar un precio PEOR que la combinación de condiciones acumulables. Ejemplo
 * real del dataset: con 25 unidades, "MSI Septiembre" (-3%, exclusiva) bloquea
 * "Volumen 25+" (-5,5%) más "Pronto pago" (-1,5%). Aplicarla a ciegas haría que
 * subir la cantidad aumente el precio unitario.
 *
 * Por eso se evalúan los dos escenarios —con y sin condiciones exclusivas— y se
 * conserva el que le conviene al cliente. Es lo que hace cualquier motor de
 * pricing serio, y evita que el portal muestre un precio que sube al comprar más.
 */
export function evaluatePrice(input: EvaluateInput): EvaluationDetail {
  const withExclusive = evaluateScenario(input, true);

  // Si ninguna condición exclusiva participó, no hay nada que comparar.
  if (!withExclusive.usedExclusive) return withExclusive.result;

  const withoutExclusive = evaluateScenario(input, false);
  const better =
    num(withoutExclusive.result.finalUnitPrice) < num(withExclusive.result.finalUnitPrice)
      ? withoutExclusive
      : withExclusive;

  // La condición descartada se reporta con su motivo, para que el desglose
  // siga explicando por qué no se aplicó.
  if (better === withoutExclusive) {
    const discarded = withExclusive.result.appliedConditions.filter(
      (c) => !withoutExclusive.result.appliedConditions.some((k) => k.conditionId === c.conditionId),
    );
    better.result.skippedConditions = [
      ...better.result.skippedConditions.filter((c) => !discarded.some((d) => d.conditionId === c.conditionId)),
      ...discarded.map((c) => ({
        conditionId: c.conditionId,
        code: c.code,
        name: c.name,
        reason: 'No se aplicó porque las condiciones acumulables dan un precio mejor para el cliente',
      })),
    ];
  }

  return better.result;
}

function evaluateScenario(
  input: EvaluateInput,
  allowExclusive: boolean,
): { result: EvaluationDetail; usedExclusive: boolean } {
  const { product, customer, quantity } = input;
  const date = new Date(input.date ?? Date.now());
  const paymentTerm = input.paymentTerm ?? customer.paymentTerm;
  const list = PRICE_LISTS.find((l) => l.id === customer.priceListId);

  const base = product.listPrice ? num(product.listPrice) : 0;
  const adjustments: PriceAdjustment[] = [];
  const applied: EvaluationDetail['appliedConditions'] = [];
  const skipped: EvaluationDetail['skippedConditions'] = [];
  const missed: MissedOpportunity[] = [];
  const requiresApproval: EvaluationDetail['requiresApproval'] = [];

  /* --- 1. lista del cliente --- */
  const listResult = applyPriceList(product, list, base);
  let unitPrice = listResult.unitPrice;
  if (listResult.adjustment) adjustments.push(listResult.adjustment);

  /* --- 2. condiciones comerciales --- */
  const ctx: CriteriaContext = {
    product,
    customer,
    quantity,
    paymentTerm,
    brandAmount: input.brandAmountInOrder ?? unitPrice * quantity,
    orderAmount: input.orderAmount ?? unitPrice * quantity,
  };

  const candidates = [...COMMERCIAL_CONDITIONS].sort((a, b) => a.priority - b.priority);
  let exclusiveApplied = false;
  let usedExclusive = false;
  let bonusUnits = 0;
  let freeFreight = false;
  let pointsMultiplier = 1;

  for (const condition of candidates) {
    // Escenario "sin exclusivas": se saltean las condiciones no acumulables
    // que otorgan descuento, para poder comparar contra la suma de acumulables.
    if (
      !allowExclusive &&
      !condition.stackable &&
      condition.actions.some((a) => a.type === 'DISCOUNT_PCT' || a.type === 'TIERED_PRICE' || a.type === 'FIXED_PRICE')
    ) {
      continue;
    }

    if (!isActiveAt(condition, date)) {
      if (condition.status === 'SCHEDULED') {
        skipped.push({
          conditionId: condition.id,
          code: condition.code,
          name: condition.name,
          reason: `Programada: vigente desde ${new Date(condition.validFrom).toLocaleDateString('es-AR')}`,
        });
      }
      continue;
    }

    if (condition.exclusions.includes(product.sku)) {
      skipped.push({
        conditionId: condition.id,
        code: condition.code,
        name: condition.name,
        reason: `El SKU ${product.sku} está excluido de la condición`,
      });
      continue;
    }

    if (!hasUsageLeft(condition)) {
      skipped.push({
        conditionId: condition.id,
        code: condition.code,
        name: condition.name,
        reason: `Límite de uso alcanzado (${condition.usageCount}/${condition.usageLimit})`,
      });
      continue;
    }

    /* --- criterios --- */
    const results = condition.criteria.map((c) => ({ criterion: c, ...evaluateCriterion(c, ctx) }));
    const unmet = results.filter((r) => !r.met);

    if (unmet.length > 0) {
      // Solo se ofrece como oportunidad si lo unico que falta es cantidad o monto.
      const onlyQuantitative = unmet.every(
        (r) => r.criterion.scope === 'QUANTITY' || r.criterion.scope === 'AMOUNT',
      );
      const discountPct = condition.actions.find((a) => a.type === 'DISCOUNT_PCT')?.value
        ?? condition.actions.find((a) => a.type === 'TIERED_PRICE')?.tiers?.[0]?.discountPct;

      if (onlyQuantitative && discountPct) {
        const qtyGap = unmet.find((r) => r.criterion.scope === 'QUANTITY')?.missingUnits;
        const amtGap = unmet.find((r) => r.criterion.scope === 'AMOUNT')?.missingAmount;
        missed.push({
          conditionId: condition.id,
          label: condition.name,
          message: qtyGap
            ? `Agregando ${qtyGap} ${qtyGap === 1 ? 'unidad más' : 'unidades más'} de este SKU alcanzás el descuento de ${condition.name} del ${discountPct}%.`
            : `Sumando USD ${amtGap} de ${condition.name} alcanzás un ${discountPct}% adicional.`,
          potentialPct: discountPct,
          missingUnits: qtyGap,
          missingAmount: amtGap !== undefined ? money(amtGap) : undefined,
        });
      }

      skipped.push({
        conditionId: condition.id,
        code: condition.code,
        name: condition.name,
        reason: unmet[0]!.reason || 'No cumple los criterios',
      });
      continue;
    }

    /* --- una condicion no acumulable bloquea el resto de descuentos --- */
    if (exclusiveApplied && condition.actions.some((a) => a.type === 'DISCOUNT_PCT' || a.type === 'TIERED_PRICE')) {
      skipped.push({
        conditionId: condition.id,
        code: condition.code,
        name: condition.name,
        reason: 'Ya se aplicó una condición no acumulable de mayor prioridad',
      });
      continue;
    }

    /* --- acciones --- */
    let effect = '';
    for (const action of condition.actions) {
      switch (action.type) {
        case 'DISCOUNT_PCT': {
          const pct = Number.parseFloat(action.value);
          const delta = round2(-unitPrice * (pct / 100));
          unitPrice = round2(unitPrice + delta);
          adjustments.push({
            type: condition.kind === 'PROMOTION' ? 'PROMOTION' : 'CUSTOMER_DISCOUNT',
            conditionId: condition.id,
            label: condition.name,
            percentage: (-pct).toFixed(2),
            amount: delta.toFixed(2),
            note: condition.stackable ? undefined : 'No acumulable con otras promociones',
          });
          effect = `-${pct}%`;
          break;
        }
        case 'TIERED_PRICE': {
          const tier = [...(action.tiers ?? [])]
            .sort((a, b) => b.minQty - a.minQty)
            .find((t) => quantity >= t.minQty);
          if (!tier) break;
          const pct = Number.parseFloat(tier.discountPct);
          const delta = round2(-unitPrice * (pct / 100));
          unitPrice = round2(unitPrice + delta);
          adjustments.push({
            type: 'VOLUME_TIER',
            conditionId: condition.id,
            label: `${condition.name} · ${tier.minQty}+ unidades`,
            percentage: (-pct).toFixed(2),
            amount: delta.toFixed(2),
          });
          effect = `-${pct}% por ${tier.minQty}+ u.`;

          // Si hay un escalon superior cerca, ofrecerlo.
          const nextTier = [...(action.tiers ?? [])]
            .sort((a, b) => a.minQty - b.minQty)
            .find((t) => t.minQty > quantity);
          if (nextTier) {
            missed.push({
              conditionId: condition.id,
              label: `${condition.name} · escalón ${nextTier.minQty}+`,
              message: `Agregando ${nextTier.minQty - quantity} ${nextTier.minQty - quantity === 1 ? 'unidad' : 'unidades'} más pasás al escalón de ${nextTier.discountPct}%.`,
              potentialPct: nextTier.discountPct,
              missingUnits: nextTier.minQty - quantity,
            });
          }
          break;
        }
        case 'BONUS_UNITS': {
          const per = Number.parseFloat(condition.criteria.find((c) => c.scope === 'QUANTITY')?.values[0] ?? '10');
          const granted = Math.floor(quantity / per) * Number.parseFloat(action.value);
          if (granted > 0) {
            bonusUnits += granted;
            effect = `+${granted} u. bonificadas`;
          }
          break;
        }
        case 'FREE_FREIGHT':
          freeFreight = true;
          effect = 'Envío bonificado';
          break;
        case 'POINTS_MULTIPLIER':
          pointsMultiplier = Math.max(pointsMultiplier, Number.parseFloat(action.value));
          effect = `Puntos x${action.value}`;
          break;
        case 'STOCK_PRIORITY':
          effect = 'Prioridad de stock';
          break;
        case 'FIXED_PRICE': {
          const fixed = Number.parseFloat(action.value);
          const delta = round2(fixed - unitPrice);
          unitPrice = fixed;
          adjustments.push({
            type: 'PROMOTION',
            conditionId: condition.id,
            label: `${condition.name} · precio fijo`,
            percentage: null,
            amount: delta.toFixed(2),
          });
          effect = `Precio fijo USD ${fixed}`;
          break;
        }
      }
    }

    if (effect) {
      applied.push({ conditionId: condition.id, code: condition.code, name: condition.name, effect });
      if (condition.requiresApproval) {
        requiresApproval.push({ conditionId: condition.id, label: condition.name });
      }
      if (!condition.stackable) {
        exclusiveApplied = true;
        usedExclusive = true;
      }
    }
  }

  /* --- 3. resultado --- */
  const finalUnit = Math.max(0, round2(unitPrice));
  const totalDiscountPct = base > 0 ? (((finalUnit - base) / base) * 100) : 0;

  return {
    usedExclusive,
    result: {
      productId: product.id,
      sku: product.sku,
      quantity,
      basePrice: money(base),
      adjustments,
      finalUnitPrice: money(finalUnit),
      lineTotal: money(round2(finalUnit * quantity)),
      totalDiscountPct: totalDiscountPct.toFixed(2),
      validUntil: endOfMonthIso(date),
      missedOpportunities: dedupeMissed(missed),
      tiers: input.skipTiers ? [] : buildTiers(product, customer, date, paymentTerm),
      explanation: buildExplanation(base, adjustments, finalUnit),
      appliedConditions: applied,
      skippedConditions: skipped,
      bonusUnits,
      freeFreight,
      pointsMultiplier,
      requiresApproval,
    },
  };
}

function dedupeMissed(missed: MissedOpportunity[]): MissedOpportunity[] {
  const seen = new Set<string>();
  return missed.filter((m) => {
    const key = `${m.conditionId}:${m.potentialPct}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function endOfMonthIso(date: Date): string {
  const d = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);
  return d.toISOString();
}

function buildExplanation(base: number, adjustments: PriceAdjustment[], final: number): string {
  if (adjustments.length === 0) {
    return base > 0
      ? 'Se aplica el precio de lista distribuidor sin ajustes adicionales.'
      : 'El producto no tiene precio publicado: requiere consulta al ejecutivo.';
  }
  const parts = adjustments.map((a) =>
    a.percentage ? `${a.label} (${a.percentage}%)` : `${a.label} (USD ${a.amount})`,
  );
  return `Partiendo de USD ${base.toFixed(2)} se aplican ${parts.join(', ')}, resultando en USD ${final.toFixed(2)} por unidad.`;
}

/** Escalones de precio visibles en la ficha de producto. */
function buildTiers(
  product: Product,
  customer: Customer,
  date: Date,
  paymentTerm: PaymentTerm,
): PriceTier[] {
  if (!product.listPrice) return [];
  const breakpoints = [1, 5, 10, 25, 50];
  const tiers: PriceTier[] = [];

  for (let i = 0; i < breakpoints.length; i++) {
    const qty = breakpoints[i]!;
    const evaluation = evaluatePrice({
      product,
      customer,
      quantity: qty,
      date: date.toISOString(),
      paymentTerm,
      skipTiers: true,
    });
    const base = num(product.listPrice);
    const unit = num(evaluation.finalUnitPrice);
    tiers.push({
      minQty: qty,
      maxQty: breakpoints[i + 1] ? breakpoints[i + 1]! - 1 : null,
      discountPct: base > 0 ? (((unit - base) / base) * 100).toFixed(2) : '0.00',
      unitPrice: money(unit),
    });
  }

  // Dejar solo escalones que realmente cambian el precio.
  return tiers.filter((t, i) => i === 0 || t.unitPrice.amount !== tiers[i - 1]!.unitPrice.amount);
}

/* ------------------------------------------------------------------ */
/* simulador de condiciones (backoffice)                               */
/* ------------------------------------------------------------------ */

export function simulateCondition(
  product: Product,
  customer: Customer,
  quantity: number,
  date: string,
  paymentTerm: PaymentTerm,
): ConditionSimulationResult {
  const evaluation = evaluatePrice({ product, customer, quantity, date, paymentTerm });
  return {
    evaluation,
    appliedConditions: evaluation.appliedConditions,
    skippedConditions: evaluation.skippedConditions,
  };
}

/* ------------------------------------------------------------------ */
/* utilidades para el carrito                                          */
/* ------------------------------------------------------------------ */

export function vatFor(product: Product, netAmount: Money): Money {
  return money(round2(num(netAmount) * product.vatRate), netAmount.currency);
}

/** Flete estimado segun zona, cuando ninguna condicion lo bonifica. */
export function estimateFreight(customer: Customer, orderAmount: number): Money {
  if (customer.zone === 'CABA' && orderAmount >= 599) return money(0);
  if (customer.zone === 'AMBA' && orderAmount >= 999) return money(0);
  const table: Record<string, number> = {
    CABA: 18,
    AMBA: 26,
    'Interior Norte': 52,
    'Interior Sur': 64,
  };
  return money(table[customer.zone] ?? 45);
}
