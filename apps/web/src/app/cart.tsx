/**
 * Carrito / pedido en armado.
 *
 * No es un checkout de consumidor final: recalcula condiciones comerciales
 * en cada cambio, avisa que descuentos faltan por alcanzar, controla el
 * credito disponible y anticipa que aprobaciones va a requerir el pedido.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { CartLine, CartTotals, Money, Product } from '@/types';
import { productById, productBySku } from '@/mocks/fixtures/catalog';
import { customerById } from '@/mocks/fixtures/customers';
import { evaluatePrice, estimateFreight } from '@/services/mock/pricing-engine';
import { useSession } from '@/app/session';
import { money, num } from '@/lib/utils';

const CART_KEY = 'ashir-partner-hub:cart:v1';

interface CartContextValue {
  lines: CartLine[];
  totals: CartTotals;
  itemCount: number;
  add: (productIdOrSku: string, quantity?: number) => { ok: boolean; message: string };
  setQuantity: (productId: string, quantity: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
  has: (productId: string) => boolean;
  quantityOf: (productId: string) => number;
  /** Observaciones y OC del pedido en armado. */
  notes: string;
  setNotes: (v: string) => void;
  customerPO: string;
  setCustomerPO: (v: string) => void;
  deliveryMethod: 'DELIVERY' | 'PICKUP';
  setDeliveryMethod: (v: 'DELIVERY' | 'PICKUP') => void;
}

const CartContext = createContext<CartContextValue | null>(null);

function readLines(): CartLine[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(CART_KEY);
    return raw ? (JSON.parse(raw) as CartLine[]) : [];
  } catch {
    return [];
  }
}

const EMPTY_TOTALS: CartTotals = {
  lines: [],
  subtotal: money(0),
  discountTotal: money(0),
  taxTotal: money(0),
  freight: money(0),
  total: money(0),
  appliedConditions: [],
  missedOpportunities: [],
  creditAfter: money(0),
  creditWarning: null,
  requiredApprovals: [],
};

export function CartProvider({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const [lines, setLines] = useState<CartLine[]>(readLines);
  const [notes, setNotes] = useState('');
  const [customerPO, setCustomerPO] = useState('');
  const [deliveryMethod, setDeliveryMethod] = useState<'DELIVERY' | 'PICKUP'>('DELIVERY');

  useEffect(() => {
    try {
      window.localStorage.setItem(CART_KEY, JSON.stringify(lines));
    } catch {
      /* modo privado */
    }
  }, [lines]);

  const add = useCallback((productIdOrSku: string, quantity = 1) => {
    const product = productById(productIdOrSku) ?? productBySku(productIdOrSku);
    if (!product) return { ok: false, message: 'No encontramos ese producto en el catálogo.' };
    if (!product.listPrice) {
      return {
        ok: false,
        message: `${product.sku} no tiene precio publicado. Consultá disponibilidad con tu ejecutivo.`,
      };
    }

    let result = { ok: true, message: `${product.name} agregado al pedido.` };
    setLines((prev) => {
      const existing = prev.find((l) => l.productId === product.id);
      const nextQty = (existing?.quantity ?? 0) + quantity;

      if (product.stock > 0 && nextQty > product.stock) {
        result = {
          ok: true,
          message: `Agregado. Solo hay ${product.stock} unidades para entrega inmediata; el resto queda pendiente de reposición.`,
        };
      }
      if (product.stock === 0) {
        result = {
          ok: true,
          message: `${product.sku} está sin stock. Se agrega al pedido como pendiente de ingreso.`,
        };
      }

      if (existing) {
        return prev.map((l) => (l.productId === product.id ? { ...l, quantity: nextQty } : l));
      }
      return [...prev, { productId: product.id, sku: product.sku, quantity, addedAt: new Date().toISOString() }];
    });

    return result;
  }, []);

  const setQuantity = useCallback((productId: string, quantity: number) => {
    setLines((prev) =>
      quantity <= 0
        ? prev.filter((l) => l.productId !== productId)
        : prev.map((l) => (l.productId === productId ? { ...l, quantity } : l)),
    );
  }, []);

  const remove = useCallback((productId: string) => {
    setLines((prev) => prev.filter((l) => l.productId !== productId));
  }, []);

  const clear = useCallback(() => {
    setLines([]);
    setNotes('');
    setCustomerPO('');
  }, []);

  /* --- recalculo completo en cada cambio --- */
  const totals = useMemo<CartTotals>(() => {
    const customer = customerById(session.customerId ?? '');
    if (!customer || lines.length === 0) return EMPTY_TOTALS;

    const resolved = lines
      .map((line) => ({ line, product: productById(line.productId) }))
      .filter((x): x is { line: CartLine; product: Product } => Boolean(x.product?.listPrice));

    const orderAmount = resolved.reduce((acc, { line, product }) => acc + num(product.listPrice) * line.quantity, 0);

    const evaluated = resolved.map(({ line, product }) => {
      const brandAmount = resolved
        .filter((x) => x.product.brand === product.brand)
        .reduce((acc, x) => acc + num(x.product.listPrice) * x.line.quantity, 0);
      return {
        line,
        product,
        evaluation: evaluatePrice({
          product,
          customer,
          quantity: line.quantity,
          orderAmount,
          brandAmountInOrder: brandAmount,
          skipTiers: true,
        }),
      };
    });

    const subtotal = evaluated.reduce((acc, x) => acc + num(x.evaluation.lineTotal), 0);
    const listTotal = evaluated.reduce((acc, x) => acc + num(x.product.listPrice) * x.line.quantity, 0);
    const taxTotal = evaluated.reduce((acc, x) => acc + num(x.evaluation.lineTotal) * x.product.vatRate, 0);

    const freeFreight = evaluated.some((x) => x.evaluation.freeFreight);
    const freight: Money = freeFreight ? money(0) : estimateFreight(customer, subtotal);
    const total = subtotal + taxTotal + num(freight);

    /* --- condiciones aplicadas, sin repetir --- */
    const conditionMap = new Map<string, { conditionId: string; code: string; name: string; effect: string }>();
    for (const x of evaluated) {
      for (const c of x.evaluation.appliedConditions) conditionMap.set(c.conditionId, c);
    }

    /* --- oportunidades: las mas valiosas primero, sin repetir --- */
    const missedMap = new Map<string, CartTotals['missedOpportunities'][number]>();
    for (const x of evaluated) {
      for (const m of x.evaluation.missedOpportunities) {
        const key = `${m.conditionId}:${x.product.sku}`;
        if (!missedMap.has(key)) {
          missedMap.set(key, { ...m, label: `${m.label} · ${x.product.sku}` });
        }
      }
    }
    const missed = [...missedMap.values()]
      .sort((a, b) => Number.parseFloat(b.potentialPct) - Number.parseFloat(a.potentialPct))
      .slice(0, 4);

    /* --- credito --- */
    const available = num(customer.account.creditAvailable);
    const creditAfter = available - total;
    let creditWarning: string | null = null;
    if (customer.paymentTerm !== 'CASH') {
      if (creditAfter < 0) {
        creditWarning = `Este pedido supera el crédito disponible en USD ${Math.abs(creditAfter).toFixed(2)}. Va a requerir aprobación comercial.`;
      } else if (creditAfter < available * 0.15) {
        creditWarning = `Después de este pedido te quedan USD ${creditAfter.toFixed(2)} de crédito disponible.`;
      }
    }

    /* --- aprobaciones --- */
    const requiredApprovals: CartTotals['requiredApprovals'] = [];
    if (creditAfter < 0 && customer.paymentTerm !== 'CASH') {
      requiredApprovals.push({
        type: 'CREDIT',
        label: 'Aprobación de crédito',
        reason: `El total supera el crédito disponible de ${customer.tradeName}.`,
      });
    }
    if (customer.status === 'ON_HOLD') {
      requiredApprovals.push({
        type: 'ACCOUNT',
        label: 'Cuenta en observación',
        reason: 'La cuenta tiene deuda vencida y requiere liberación de administración.',
      });
    }
    for (const x of evaluated) {
      for (const approval of x.evaluation.requiresApproval) {
        if (!requiredApprovals.some((a) => a.label === approval.label)) {
          requiredApprovals.push({
            type: 'CONDITION',
            label: approval.label,
            reason: 'La condición comercial aplicada requiere autorización del Product Manager.',
          });
        }
      }
    }

    return {
      lines: evaluated,
      subtotal: money(subtotal),
      discountTotal: money(listTotal - subtotal),
      taxTotal: money(taxTotal),
      freight,
      total: money(total),
      appliedConditions: [...conditionMap.values()],
      missedOpportunities: missed,
      creditAfter: money(creditAfter),
      creditWarning,
      requiredApprovals,
    };
  }, [lines, session.customerId]);

  const value = useMemo<CartContextValue>(
    () => ({
      lines,
      totals,
      itemCount: lines.reduce((acc, l) => acc + l.quantity, 0),
      add,
      setQuantity,
      remove,
      clear,
      has: (productId) => lines.some((l) => l.productId === productId),
      quantityOf: (productId) => lines.find((l) => l.productId === productId)?.quantity ?? 0,
      notes,
      setNotes,
      customerPO,
      setCustomerPO,
      deliveryMethod,
      setDeliveryMethod,
    }),
    [lines, totals, add, setQuantity, remove, clear, notes, customerPO, deliveryMethod],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart debe usarse dentro de <CartProvider>');
  return ctx;
}

/* ------------------------------------------------------------------ */
/* favoritos                                                           */
/* ------------------------------------------------------------------ */

const FAV_KEY = 'ashir-partner-hub:favorites:v1';

export function readFavorites(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(FAV_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function useFavorites() {
  const [favorites, setFavorites] = useState<string[]>(readFavorites);

  const toggle = useCallback((productId: string) => {
    setFavorites((prev) => {
      const next = prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId];
      try {
        window.localStorage.setItem(FAV_KEY, JSON.stringify(next));
      } catch {
        /* modo privado */
      }
      return next;
    });
  }, []);

  return { favorites, toggle, isFavorite: (id: string) => favorites.includes(id) };
}
