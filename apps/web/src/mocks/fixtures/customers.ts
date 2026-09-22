/**
 * Clientes/resellers de la demo. La cadena coherente arranca aca:
 * Gaming Store SRL -> lista LP-PLATINUM-02 -> pedido ASH-24853 -> ...
 *
 * Datos simulados. Los CUIT son ficticios.
 */
import type { Customer, CustomerSegment, Invoice, PaymentTerm } from '@/types';
import { addDays, betweenSeeded, money } from '@/lib/utils';

const NOW = new Date('2026-09-22T11:00:00-03:00').toISOString();

interface Seed {
  id: string;
  code: string;
  legalName: string;
  tradeName: string;
  taxId: string;
  segment: CustomerSegment;
  status: Customer['status'];
  salesRepId: string;
  priceListId: string;
  paymentTerm: PaymentTerm;
  zone: string;
  city: string;
  province: string;
  creditLimit: number;
  creditUsed: number;
  overdue: number;
  purchases12m: number;
  prev12m: number;
  points: number;
  topBrands: string[];
  freqDays: number;
  lastOrderDays: number;
}

const SEEDS: Seed[] = [
  {
    id: 'cus_gaming_store', code: 'C-10428',
    legalName: 'Gaming Store SRL', tradeName: 'Gaming Store',
    taxId: '30-71284455-9', segment: 'PLATINUM', status: 'ACTIVE',
    salesRepId: 'usr_martin', priceListId: 'pl_platinum_02', paymentTerm: 'TRANSFER_7',
    zone: 'AMBA', city: 'Vicente López', province: 'Buenos Aires',
    creditLimit: 24_700, creditUsed: 6_250, overdue: 0,
    purchases12m: 286_400, prev12m: 231_900, points: 52_350,
    topBrands: ['MSI', 'ASUS', 'THERMALTAKE'], freqDays: 11, lastOrderDays: 3,
  },
  {
    id: 'cus_compumundo', code: 'C-10112',
    legalName: 'Compumundo X SA', tradeName: 'Compumundo X',
    taxId: '30-70994102-4', segment: 'PLATINUM', status: 'ACTIVE',
    salesRepId: 'usr_sofia', priceListId: 'pl_platinum_02', paymentTerm: 'CHECK_30',
    zone: 'CABA', city: 'Ciudad Autónoma de Buenos Aires', province: 'CABA',
    creditLimit: 68_000, creditUsed: 41_380, overdue: 0,
    purchases12m: 742_100, prev12m: 688_400, points: 118_900,
    topBrands: ['ASUS', 'MSI', 'ADATA'], freqDays: 6, lastOrderDays: 1,
  },
  {
    id: 'cus_nodotech', code: 'C-10577',
    legalName: 'Nodo Tech Distribuciones SRL', tradeName: 'Nodo Tech',
    taxId: '30-71655028-1', segment: 'GOLD', status: 'ACTIVE',
    salesRepId: 'usr_martin', priceListId: 'pl_gold_01', paymentTerm: 'TRANSFER_15',
    zone: 'AMBA', city: 'San Martín', province: 'Buenos Aires',
    creditLimit: 32_000, creditUsed: 18_940, overdue: 0,
    purchases12m: 341_700, prev12m: 298_200, points: 61_400,
    topBrands: ['THERMALTAKE', 'EVOLABS', 'ADATA'], freqDays: 9, lastOrderDays: 5,
  },
  {
    id: 'cus_bitcenter', code: 'C-10233',
    legalName: 'Bit Center Argentina SA', tradeName: 'Bit Center',
    taxId: '30-70551338-7', segment: 'GOLD', status: 'ACTIVE',
    salesRepId: 'usr_pablo', priceListId: 'pl_gold_01', paymentTerm: 'CREDIT_45',
    zone: 'Interior Norte', city: 'Córdoba', province: 'Córdoba',
    creditLimit: 45_000, creditUsed: 38_720, overdue: 4_180,
    purchases12m: 402_300, prev12m: 455_900, points: 74_200,
    topBrands: ['ASUS', 'AMD', 'MSI'], freqDays: 8, lastOrderDays: 12,
  },
  {
    id: 'cus_infotec_sur', code: 'C-10891',
    legalName: 'Infotec Sur SRL', tradeName: 'Infotec Sur',
    taxId: '30-71802214-3', segment: 'GOLD', status: 'ACTIVE',
    salesRepId: 'usr_rocio', priceListId: 'pl_gold_01', paymentTerm: 'TRANSFER_15',
    zone: 'Interior Sur', city: 'Neuquén', province: 'Neuquén',
    creditLimit: 28_000, creditUsed: 9_640, overdue: 0,
    purchases12m: 214_800, prev12m: 178_300, points: 38_900,
    topBrands: ['EVOLABS', 'AUREOX', 'THERMALTAKE'], freqDays: 14, lastOrderDays: 7,
  },
  {
    id: 'cus_megabyte', code: 'C-10045',
    legalName: 'Megabyte Insumos SRL', tradeName: 'Megabyte',
    taxId: '30-70118844-2', segment: 'SILVER', status: 'ACTIVE',
    salesRepId: 'usr_sofia', priceListId: 'pl_lista_b', paymentTerm: 'CASH',
    zone: 'CABA', city: 'Ciudad Autónoma de Buenos Aires', province: 'CABA',
    creditLimit: 9_000, creditUsed: 2_140, overdue: 0,
    purchases12m: 87_600, prev12m: 91_200, points: 14_300,
    topBrands: ['AUREOX', 'EVOLABS'], freqDays: 22, lastOrderDays: 18,
  },
  {
    id: 'cus_hardzone', code: 'C-10664',
    legalName: 'Hard Zone Computación SRL', tradeName: 'Hard Zone',
    taxId: '30-71499307-5', segment: 'GOLD', status: 'ACTIVE',
    salesRepId: 'usr_pablo', priceListId: 'pl_gold_01', paymentTerm: 'CHECK_30',
    zone: 'Interior Norte', city: 'Rosario', province: 'Santa Fe',
    creditLimit: 36_000, creditUsed: 21_500, overdue: 0,
    purchases12m: 318_400, prev12m: 289_700, points: 55_100,
    topBrands: ['MSI', 'THERMALTAKE', 'ADATA'], freqDays: 10, lastOrderDays: 4,
  },
  {
    id: 'cus_pcfactory', code: 'C-10309',
    legalName: 'PC Factory Distribuciones SA', tradeName: 'PC Factory',
    taxId: '30-71022956-8', segment: 'PLATINUM', status: 'ACTIVE',
    salesRepId: 'usr_martin', priceListId: 'pl_platinum_02', paymentTerm: 'TRANSFER_7',
    zone: 'AMBA', city: 'Quilmes', province: 'Buenos Aires',
    creditLimit: 55_000, creditUsed: 12_300, overdue: 0,
    purchases12m: 596_200, prev12m: 512_400, points: 96_800,
    topBrands: ['ASUS', 'ADATA', 'MSI'], freqDays: 7, lastOrderDays: 2,
  },
  {
    id: 'cus_ciberplaza', code: 'C-10756',
    legalName: 'Ciberplaza SRL', tradeName: 'Ciberplaza',
    taxId: '30-71577441-0', segment: 'SILVER', status: 'ON_HOLD',
    salesRepId: 'usr_rocio', priceListId: 'pl_lista_b', paymentTerm: 'CASH',
    zone: 'Interior Sur', city: 'Bahía Blanca', province: 'Buenos Aires',
    creditLimit: 12_000, creditUsed: 11_880, overdue: 6_740,
    purchases12m: 64_900, prev12m: 118_600, points: 9_200,
    topBrands: ['AUREOX', 'EVOLABS'], freqDays: 30, lastOrderDays: 47,
  },
  {
    id: 'cus_techpoint', code: 'C-10488',
    legalName: 'Tech Point Mayorista SRL', tradeName: 'Tech Point',
    taxId: '30-71341902-6', segment: 'GOLD', status: 'ACTIVE',
    salesRepId: 'usr_sofia', priceListId: 'pl_gold_01', paymentTerm: 'TRANSFER_15',
    zone: 'CABA', city: 'Ciudad Autónoma de Buenos Aires', province: 'CABA',
    creditLimit: 30_000, creditUsed: 16_720, overdue: 0,
    purchases12m: 275_300, prev12m: 268_100, points: 47_600,
    topBrands: ['THERMALTAKE', 'MSI', 'ASUS'], freqDays: 12, lastOrderDays: 6,
  },
  {
    id: 'cus_digitalhouse', code: 'C-10921',
    legalName: 'Digital House Componentes SRL', tradeName: 'Digital House',
    taxId: '30-71866104-9', segment: 'SILVER', status: 'ACTIVE',
    salesRepId: 'usr_pablo', priceListId: 'pl_lista_a', paymentTerm: 'CASH',
    zone: 'Interior Norte', city: 'Salta', province: 'Salta',
    creditLimit: 8_500, creditUsed: 1_020, overdue: 0,
    purchases12m: 52_400, prev12m: 31_800, points: 7_900,
    topBrands: ['EVOLABS', 'AUREOX', 'ADATA'], freqDays: 26, lastOrderDays: 9,
  },
  {
    id: 'cus_gamerzone', code: 'C-11002',
    legalName: 'Gamer Zone Retail SRL', tradeName: 'Gamer Zone',
    taxId: '30-71921188-4', segment: 'SILVER', status: 'PROSPECT',
    salesRepId: 'usr_rocio', priceListId: 'pl_lista_a', paymentTerm: 'CASH',
    zone: 'Interior Sur', city: 'Mar del Plata', province: 'Buenos Aires',
    creditLimit: 5_000, creditUsed: 0, overdue: 0,
    purchases12m: 0, prev12m: 0, points: 0,
    topBrands: [], freqDays: 0, lastOrderDays: -1,
  },
  {
    id: 'cus_insumosdelsur', code: 'C-10602',
    legalName: 'Insumos del Sur SA', tradeName: 'Insumos del Sur',
    taxId: '30-71452083-2', segment: 'GOLD', status: 'ACTIVE',
    salesRepId: 'usr_rocio', priceListId: 'pl_gold_01', paymentTerm: 'CREDIT_45',
    zone: 'Interior Sur', city: 'Comodoro Rivadavia', province: 'Chubut',
    creditLimit: 26_000, creditUsed: 22_910, overdue: 0,
    purchases12m: 198_700, prev12m: 205_400, points: 34_100,
    topBrands: ['ADATA', 'THERMALTAKE', 'AUREOX'], freqDays: 16, lastOrderDays: 11,
  },
  {
    id: 'cus_redcomputacion', code: 'C-10177',
    legalName: 'Red Computación SRL', tradeName: 'Red Computación',
    taxId: '30-70832291-7', segment: 'PLATINUM', status: 'ACTIVE',
    salesRepId: 'usr_martin', priceListId: 'pl_custom_rc', paymentTerm: 'TRANSFER_7',
    zone: 'AMBA', city: 'Morón', province: 'Buenos Aires',
    creditLimit: 62_000, creditUsed: 28_400, overdue: 0,
    purchases12m: 668_900, prev12m: 601_200, points: 104_300,
    topBrands: ['MSI', 'ASUS', 'AMD'], freqDays: 5, lastOrderDays: 1,
  },
  {
    id: 'cus_nortecomputacion', code: 'C-10845',
    legalName: 'Norte Computación SRL', tradeName: 'Norte Computación',
    taxId: '30-71744920-5', segment: 'SILVER', status: 'ACTIVE',
    salesRepId: 'usr_pablo', priceListId: 'pl_lista_b', paymentTerm: 'CASH',
    zone: 'Interior Norte', city: 'San Miguel de Tucumán', province: 'Tucumán',
    creditLimit: 11_000, creditUsed: 4_360, overdue: 0,
    purchases12m: 96_800, prev12m: 78_400, points: 16_700,
    topBrands: ['AUREOX', 'EVOLABS', 'ADATA'], freqDays: 19, lastOrderDays: 8,
  },
  {
    id: 'cus_setupstore', code: 'C-10983',
    legalName: 'Setup Store SRL', tradeName: 'Setup Store',
    taxId: '30-71898332-1', segment: 'GOLD', status: 'ACTIVE',
    salesRepId: 'usr_sofia', priceListId: 'pl_gold_01', paymentTerm: 'TRANSFER_7',
    zone: 'CABA', city: 'Ciudad Autónoma de Buenos Aires', province: 'CABA',
    creditLimit: 22_000, creditUsed: 7_980, overdue: 0,
    purchases12m: 187_200, prev12m: 122_600, points: 31_800,
    topBrands: ['THERMALTAKE', 'TTESPORTS', 'EVOLABS'], freqDays: 13, lastOrderDays: 3,
  },
];

const DOC_SETS: Customer['documents'][] = [
  [
    { name: 'Constancia de inscripción AFIP', status: 'OK', expiresAt: null },
    { name: 'Certificado de exención IIBB', status: 'OK', expiresAt: '2026-12-31T00:00:00-03:00' },
  ],
  [
    { name: 'Constancia de inscripción AFIP', status: 'OK', expiresAt: null },
    { name: 'Certificado de exención IIBB', status: 'EXPIRING', expiresAt: '2026-10-15T00:00:00-03:00' },
  ],
  [
    { name: 'Constancia de inscripción AFIP', status: 'OK', expiresAt: null },
    { name: 'Convenio multilateral', status: 'MISSING', expiresAt: null },
  ],
];

function buildInvoices(seed: Seed): Invoice[] {
  if (seed.purchases12m === 0) return [];
  const count = betweenSeeded(seed.id + 'inv', 3, 6);
  const invoices: Invoice[] = [];
  for (let i = 0; i < count; i++) {
    const issued = addDays(NOW, -(i * 14 + betweenSeeded(seed.id + i, 2, 9)));
    const dueDays = seed.paymentTerm === 'CASH' ? 0 : seed.paymentTerm === 'TRANSFER_7' ? 7 : seed.paymentTerm === 'TRANSFER_15' ? 15 : seed.paymentTerm === 'CHECK_30' ? 30 : 45;
    const due = addDays(issued, dueDays);
    const total = betweenSeeded(seed.id + 'amt' + i, 1_800, 26_000);
    const overdueNow = new Date(due).getTime() < Date.now();
    invoices.push({
      id: `inv_${seed.id}_${i}`,
      number: `FA-0004-${String(12_500 + betweenSeeded(seed.id + i, 1, 400) + i).padStart(8, '0')}`,
      orderId: null,
      issuedAt: issued,
      dueAt: due,
      total: money(total),
      status: i === 0 && seed.overdue > 0 ? 'OVERDUE' : overdueNow ? 'PAID' : i === 0 ? 'PENDING' : 'PAID',
    });
  }
  return invoices;
}

export const CUSTOMERS: Customer[] = SEEDS.map((seed, idx) => {
  const invoices = buildInvoices(seed);
  const pending = invoices.filter((i) => i.status === 'PENDING' || i.status === 'OVERDUE');
  const next = pending[0] ?? null;
  return {
    id: seed.id,
    code: seed.code,
    legalName: seed.legalName,
    tradeName: seed.tradeName,
    taxId: seed.taxId,
    segment: seed.segment,
    status: seed.status,
    salesRepId: seed.salesRepId,
    priceListId: seed.priceListId,
    paymentTerm: seed.paymentTerm,
    zone: seed.zone,
    city: seed.city,
    province: seed.province,
    address: `${['Av. Mitre', 'Calle Alsina', 'Av. Rivadavia', 'Bv. San Juan', 'Av. Colón'][idx % 5]} ${betweenSeeded(seed.id, 120, 4800)}, ${seed.city}`,
    email: `compras@${seed.tradeName.toLowerCase().replace(/[^a-z]/g, '')}.com.ar`,
    phone: `+54 9 11 ${betweenSeeded(seed.id + 'ph', 4000, 6999)}-${betweenSeeded(seed.id + 'ph2', 1000, 9999)}`,
    account: {
      creditLimit: money(seed.creditLimit),
      creditUsed: money(seed.creditUsed),
      creditAvailable: money(seed.creditLimit - seed.creditUsed),
      balance: money(seed.creditUsed),
      overdue: money(seed.overdue),
      nextDueDate: next?.dueAt ?? null,
      nextDueAmount: next ? next.total : null,
      invoices,
    },
    topBrands: seed.topBrands,
    lastOrderAt: seed.lastOrderDays < 0 ? null : addDays(NOW, -seed.lastOrderDays),
    orderFrequencyDays: seed.freqDays,
    purchases12m: money(seed.purchases12m),
    purchasesPrevious12m: money(seed.prev12m),
    partnerTier: seed.segment,
    points: seed.points,
    createdAt: addDays(NOW, -betweenSeeded(seed.id + 'cr', 400, 2400)),
    internalNotes:
      seed.status === 'ON_HOLD'
        ? [
            {
              id: `note_${seed.id}_1`,
              author: 'Rocío Alcaraz',
              at: addDays(NOW, -6),
              text: 'Cuenta en observación por deuda vencida. No liberar pedidos sin pago previo.',
            },
          ]
        : seed.id === 'cus_gaming_store'
          ? [
              {
                id: 'note_gs_1',
                author: 'Martín Rodríguez',
                at: addDays(NOW, -21),
                text: 'Está armando una segunda sucursal en Olivos. Interesado en monitores y sillas para exhibición.',
              },
              {
                id: 'note_gs_2',
                author: 'Martín Rodríguez',
                at: addDays(NOW, -4),
                text: 'Pidió cotización por 80 unidades de motherboards MSI para un proyecto corporativo.',
              },
            ]
          : [],
    documents: DOC_SETS[idx % DOC_SETS.length]!,
  };
});

export const DEMO_CUSTOMER_ID = 'cus_gaming_store';

export function customerById(id: string): Customer | undefined {
  return CUSTOMERS.find((c) => c.id === id);
}
