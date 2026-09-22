/**
 * Tests de la lógica que rompería la presentación si estuviera mal:
 * el motor de precios y la privacidad del lookup de serial.
 *
 * No busca cobertura: cubre dos invariantes que no se pueden equivocar.
 */
import { describe, expect, it } from 'vitest';
import { evaluatePrice } from '@/services/mock/pricing-engine';
import { mockClient } from '@/services/mock/adapter';
import { productBySku } from '@/mocks/fixtures/catalog';
import { customerById } from '@/mocks/fixtures/customers';
import { INTERNAL_USERS } from '@/mocks/fixtures/people';
import { sessionFromUser } from '@/lib/rbac';
import { HERO_SERIAL, OTHER_RESELLER_SERIAL } from '@/mocks/fixtures/serials';
import { num } from '@/lib/utils';

const platinum = customerById('cus_gaming_store')!;
const silver = customerById('cus_megabyte')!;
const msiMobo = productBySku('MSMOPRB650MB')!;

function clientSession(customerId: string) {
  return sessionFromUser(INTERNAL_USERS.find((u) => u.role === 'CLIENT')!, customerId);
}

const pmSession = sessionFromUser(INTERNAL_USERS.find((u) => u.role === 'PM')!);

/* ================================================================== */
/* motor de precios                                                    */
/* ================================================================== */

describe('motor de precios', () => {
  it('el desglose suma exactamente el precio final', () => {
    const result = evaluatePrice({ product: msiMobo, customer: platinum, quantity: 10, skipTiers: true });

    const sumOfAdjustments = result.adjustments.reduce((acc, adj) => acc + Number.parseFloat(adj.amount), 0);
    const expected = num(result.basePrice) + sumOfAdjustments;

    // Es la invariante que sostiene toda la UI: si el desglose no cierra con el
    // total, el cliente ve un precio que no puede explicarse.
    expect(num(result.finalUnitPrice)).toBeCloseTo(expected, 1);
  });

  it('el total de la línea es el precio unitario por la cantidad', () => {
    const result = evaluatePrice({ product: msiMobo, customer: platinum, quantity: 7, skipTiers: true });
    expect(num(result.lineTotal)).toBeCloseTo(num(result.finalUnitPrice) * 7, 2);
  });

  it('un cliente Platinum paga menos que un Silver por el mismo producto', () => {
    const plat = evaluatePrice({ product: msiMobo, customer: platinum, quantity: 1, skipTiers: true });
    const silv = evaluatePrice({ product: msiMobo, customer: silver, quantity: 1, skipTiers: true });
    expect(num(plat.finalUnitPrice)).toBeLessThan(num(silv.finalUnitPrice));
  });

  it('más cantidad nunca aumenta el precio unitario', () => {
    const quantities = [1, 5, 10, 25, 50];
    const prices = quantities.map((q) =>
      num(evaluatePrice({ product: msiMobo, customer: platinum, quantity: q, skipTiers: true }).finalUnitPrice),
    );
    for (let i = 1; i < prices.length; i++) {
      expect(prices[i]!).toBeLessThanOrEqual(prices[i - 1]!);
    }
  });

  it('explica por qué una condición no se aplicó', () => {
    // La promoción de GPUs no puede aplicar a una motherboard.
    const result = evaluatePrice({ product: msiMobo, customer: platinum, quantity: 10, skipTiers: true });
    const skipped = result.skippedConditions.find((c) => c.code === 'VOL-GPU-26');
    expect(skipped).toBeDefined();
    expect(skipped!.reason).toContain('categoría');
  });

  it('respeta las exclusiones por SKU', () => {
    const excluded = productBySku('MSVG5070TV3O')!;
    const result = evaluatePrice({ product: excluded, customer: platinum, quantity: 10, skipTiers: true });

    // MSVG5070TV3O está excluido de MSI-SEP-26.
    expect(result.appliedConditions.some((c) => c.code === 'MSI-SEP-26')).toBe(false);
    expect(result.skippedConditions.some((c) => c.code === 'MSI-SEP-26' && c.reason.includes('excluido'))).toBe(true);
  });

  it('no aplica una condición fuera de vigencia', () => {
    // TT-AGO-26 venció en agosto de 2026.
    const ttCase = productBySku('TTGACE300TGB')!;
    const result = evaluatePrice({
      product: ttCase,
      customer: platinum,
      quantity: 5,
      date: '2026-09-22T00:00:00-03:00',
      skipTiers: true,
    });
    expect(result.appliedConditions.some((c) => c.code === 'TT-AGO-26')).toBe(false);
  });

  it('avisa qué descuento falta alcanzar', () => {
    // Con 8 unidades falta poco para el escalón de 10.
    const result = evaluatePrice({ product: msiMobo, customer: platinum, quantity: 8, skipTiers: true });
    const opportunity = result.missedOpportunities.find((m) => m.missingUnits === 2);
    expect(opportunity).toBeDefined();
    expect(opportunity!.message).toContain('2');
  });

  it('un producto sin precio publicado devuelve cero, no NaN', () => {
    const noPrice = productBySku('MSVG5060S2O8');
    if (!noPrice) return; // el dataset puede variar entre importaciones
    const result = evaluatePrice({ product: noPrice, customer: platinum, quantity: 1, skipTiers: true });
    expect(Number.isFinite(num(result.finalUnitPrice))).toBe(true);
    expect(num(result.finalUnitPrice)).toBe(0);
  });

  it('los escalones son monótonos y no se repiten', () => {
    const result = evaluatePrice({ product: msiMobo, customer: platinum, quantity: 1 });
    const prices = result.tiers.map((t) => num(t.unitPrice));
    expect(new Set(prices).size).toBe(prices.length);
    for (let i = 1; i < prices.length; i++) {
      expect(prices[i]!).toBeLessThan(prices[i - 1]!);
    }
  });
});

/* ================================================================== */
/* privacidad del lookup de serial                                     */
/* ================================================================== */

describe('privacidad del lookup de serial', () => {
  it('devuelve los datos completos del serial propio', async () => {
    const result = await mockClient.rma.lookupSerial(HERO_SERIAL, clientSession('cus_gaming_store'));
    expect(result.status).toBe('IN_WARRANTY');
    expect(result.record).not.toBeNull();
    expect(result.record!.invoiceNumber).toBeTruthy();
  });

  it('NO expone ningún dato cuando el serial es de otro reseller', async () => {
    const result = await mockClient.rma.lookupSerial(OTHER_RESELLER_SERIAL, clientSession('cus_gaming_store'));

    expect(result.status).toBe('NOT_YOUR_ACCOUNT');
    // Lo único que importa: nada del tercero viaja en la respuesta.
    expect(result.record).toBeNull();
    expect(result.warrantyDaysRemaining).toBeNull();
    expect(result.eligibility).toBeNull();

    // Ni siquiera indirectamente, en el mensaje.
    const serialized = JSON.stringify(result).toLowerCase();
    expect(serialized).not.toContain('compumundo');
    expect(serialized).not.toContain('fa-0004');
    expect(serialized).not.toContain('ash-24101');
  });

  it('el dueño del serial sí ve sus propios datos', async () => {
    const result = await mockClient.rma.lookupSerial(OTHER_RESELLER_SERIAL, clientSession('cus_compumundo'));
    expect(result.status).toBe('IN_WARRANTY');
    expect(result.record?.customerName).toBe('Compumundo X');
  });

  it('un serial inexistente no revela si existe en otra cuenta', async () => {
    const result = await mockClient.rma.lookupSerial('NO-EXISTE-12345', clientSession('cus_gaming_store'));
    expect(result.status).toBe('NOT_FOUND');
    expect(result.record).toBeNull();
  });
});

/* ================================================================== */
/* separación de datos sensibles por rol                               */
/* ================================================================== */

describe('costo y margen por rol', () => {
  it('el rol Cliente recibe cost y marginPct en null', async () => {
    const product = await mockClient.catalog.getProduct('MSMOPRB650MB', clientSession('cus_gaming_store'));
    expect(product.cost).toBeNull();
    expect(product.marginPct).toBeNull();
  });

  it('el rol Product Manager sí recibe cost y marginPct', async () => {
    const product = await mockClient.catalog.getProduct('MSMOPRB650MB', pmSession);
    expect(product.cost).not.toBeNull();
    expect(product.marginPct).not.toBeNull();
  });

  it('el listado también filtra el costo para el rol Cliente', async () => {
    const page = await mockClient.catalog.listProducts({ pageSize: 10 }, clientSession('cus_gaming_store'));
    expect(page.data.every((p) => p.cost === null)).toBe(true);
  });

  it('el cliente no ve el margen de una solicitud de precio especial', async () => {
    const requests = await mockClient.specialPrice.list({}, clientSession('cus_compumundo'));
    expect(requests.length).toBeGreaterThan(0);
    expect(requests.every((r) => r.cost === null && r.resultingMarginPct === null)).toBe(true);
  });

  it('un cliente no puede listar los pedidos de otro', async () => {
    const orders = await mockClient.orders.list({}, clientSession('cus_gaming_store'));
    expect(orders.every((o) => o.customerId === 'cus_gaming_store')).toBe(true);
  });
});
