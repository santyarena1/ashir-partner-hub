/**
 * Catalogo del prototipo.
 *
 * Los tres JSON provienen del Excel real de Ashir procesado por
 * `npm run import:products`. Ver reports/product-import-report.md para el
 * mapeo y para el detalle de que campos son reales y cuales simulados.
 */
import rawProducts from '@/mocks/generated/products.json';
import rawBrands from '@/mocks/generated/brands.json';
import rawCategories from '@/mocks/generated/categories.json';
import rawMeta from '@/mocks/generated/meta.json';
import type { Brand, Category, Product } from '@/types';

export const PRODUCTS = rawProducts as unknown as Product[];
export const BRANDS = rawBrands as unknown as Brand[];
export const CATEGORIES = rawCategories as unknown as Category[];

export interface CatalogMeta {
  source: string;
  sheet: string;
  importedAt: string;
  productCount: number;
  brandCount: number;
  categoryCount: number;
  skippedRows: number;
  problemCount: number;
  simulatedFields: string[];
  realFields: string[];
}

export const CATALOG_META = rawMeta as CatalogMeta;

const BY_ID = new Map(PRODUCTS.map((p) => [p.id, p]));
const BY_SKU = new Map(PRODUCTS.map((p) => [p.sku.toUpperCase(), p]));

export function productById(id: string): Product | undefined {
  return BY_ID.get(id);
}

export function productBySku(sku: string): Product | undefined {
  return BY_SKU.get(sku.trim().toUpperCase());
}

export function brandById(id: string): Brand | undefined {
  return BRANDS.find((b) => b.id === id);
}

export function brandByName(name: string): Brand | undefined {
  return BRANDS.find((b) => b.name === name);
}

export function categoryById(id: string): Category | undefined {
  return CATEGORIES.find((c) => c.id === id);
}

/** Productos con precio publicado: los unicos vendibles online. */
export const SELLABLE_PRODUCTS = PRODUCTS.filter((p) => p.listPrice !== null);

/** Productos destacados por categoria, para las secciones del dashboard. */
export function featuredByCategory(categoryName: string, limit = 4): Product[] {
  return SELLABLE_PRODUCTS.filter((p) => p.category === categoryName && p.stock > 0)
    .sort((a, b) => b.unitsSold12m - a.unitsSold12m)
    .slice(0, limit);
}

export function topSellers(limit = 8): Product[] {
  return [...SELLABLE_PRODUCTS]
    .filter((p) => p.stock > 0)
    .sort((a, b) => b.unitsSold12m - a.unitsSold12m)
    .slice(0, limit);
}

export function newArrivals(limit = 8): Product[] {
  return SELLABLE_PRODUCTS.filter((p) => p.availability === 'NEW_ARRIVAL').slice(0, limit);
}

export function incomingProducts(limit = 12): Product[] {
  return PRODUCTS.filter((p) => p.availability === 'INCOMING').slice(0, limit);
}

export function lowStock(threshold = 8): Product[] {
  return SELLABLE_PRODUCTS.filter((p) => p.stock > 0 && p.stock <= threshold);
}

export function productsByBrand(brandId: string): Product[] {
  return PRODUCTS.filter((p) => p.brandId === brandId);
}

export function productsByPm(pmId: string): Product[] {
  return PRODUCTS.filter((p) => p.pmId === pmId);
}

/** Relacionados: misma categoria, distinta referencia, con stock. */
export function relatedProducts(product: Product, limit = 4): Product[] {
  const sameCategory = SELLABLE_PRODUCTS.filter(
    (p) => p.categoryId === product.categoryId && p.id !== product.id && p.stock > 0,
  );
  const sameBrandFirst = [
    ...sameCategory.filter((p) => p.brandId === product.brandId),
    ...sameCategory.filter((p) => p.brandId !== product.brandId),
  ];
  return sameBrandFirst.slice(0, limit);
}

/** Reemplazos sugeridos para un SKU sin stock (Quick Order). */
export function replacementsFor(product: Product, limit = 3): Product[] {
  const base = product.listPrice ? Number.parseFloat(product.listPrice.amount) : 0;
  return SELLABLE_PRODUCTS.filter((p) => p.categoryId === product.categoryId && p.stock > 0 && p.id !== product.id)
    .sort((a, b) => {
      const da = Math.abs(Number.parseFloat(a.listPrice!.amount) - base);
      const db = Math.abs(Number.parseFloat(b.listPrice!.amount) - base);
      return da - db;
    })
    .slice(0, limit);
}

export const CATEGORY_NAMES = CATEGORIES.map((c) => c.name);
export const BRAND_NAMES = BRANDS.map((b) => b.name);
