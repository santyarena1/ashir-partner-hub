/**
 * Usuarios internos, Product Managers y el selector de roles de la demo.
 * Datos simulados: ninguna persona real de Ashir.
 */
import type { InternalUser, ProductManager, Role } from '@/types';
import { SCOPES_BY_ROLE } from '@/lib/rbac';
import { money } from '@/lib/utils';

export const INTERNAL_USERS: InternalUser[] = [
  {
    id: 'usr_cliente',
    name: 'Nicolás Ferreyra',
    email: 'compras@gamingstore.com.ar',
    initials: 'NF',
    role: 'CLIENT',
    jobTitle: 'Compras · Gaming Store SRL',
    scopes: SCOPES_BY_ROLE.CLIENT,
  },
  {
    id: 'usr_martin',
    name: 'Martín Rodríguez',
    email: 'mrodriguez@ashir.demo',
    initials: 'MR',
    role: 'SALES',
    jobTitle: 'Ejecutivo comercial · Zona AMBA',
    scopes: SCOPES_BY_ROLE.SALES,
  },
  {
    id: 'pm_diego',
    name: 'Diego Sanabria',
    email: 'dsanabria@ashir.demo',
    initials: 'DS',
    role: 'PM',
    jobTitle: 'Product Manager · MSI / AMD',
    scopes: SCOPES_BY_ROLE.PM,
    brandIds: ['brand_msi', 'brand_amd'],
  },
  {
    id: 'usr_tecnico',
    name: 'Javier Ocampo',
    email: 'jocampo@ashir.demo',
    initials: 'JO',
    role: 'RMA',
    jobTitle: 'Técnico responsable de RMA',
    scopes: SCOPES_BY_ROLE.RMA,
  },
  {
    id: 'usr_admin',
    name: 'Valeria Quiroga',
    email: 'vquiroga@ashir.demo',
    initials: 'VQ',
    role: 'ADMIN',
    jobTitle: 'Administración · Vista integral',
    scopes: SCOPES_BY_ROLE.ADMIN,
  },
];

/** Usuario por defecto de cada rol en el selector "Ver plataforma como". */
export const DEFAULT_USER_BY_ROLE: Record<Role, string> = {
  CLIENT: 'usr_cliente',
  SALES: 'usr_martin',
  PM: 'pm_diego',
  RMA: 'usr_tecnico',
  ADMIN: 'usr_admin',
};

export const PRODUCT_MANAGERS: ProductManager[] = [
  {
    id: 'pm_diego',
    name: 'Diego Sanabria',
    email: 'dsanabria@ashir.demo',
    initials: 'DS',
    brandIds: ['brand_msi', 'brand_amd'],
    brands: ['MSI', 'AMD'],
    monthlyTarget: money(420_000),
  },
  {
    id: 'pm_martin',
    name: 'Florencia Bravo',
    email: 'fbravo@ashir.demo',
    initials: 'FB',
    brandIds: ['brand_asus', 'brand_acer'],
    brands: ['ASUS', 'ACER'],
    monthlyTarget: money(510_000),
  },
  {
    id: 'pm_lucia',
    name: 'Lucía Heredia',
    email: 'lheredia@ashir.demo',
    initials: 'LH',
    brandIds: ['brand_thermaltake', 'brand_ttesports', 'brand_evolabs'],
    brands: ['THERMALTAKE', 'TTESPORTS', 'EVOLABS'],
    monthlyTarget: money(365_000),
  },
  {
    id: 'pm_carla',
    name: 'Carla Benítez',
    email: 'cbenitez@ashir.demo',
    initials: 'CB',
    brandIds: ['brand_adata', 'brand_aureox', 'brand_xpg', 'brand_wicgtyp'],
    brands: ['ADATA', 'AUREOX', 'XPG'],
    monthlyTarget: money(240_000),
  },
];

export const SALES_REPS = [
  { id: 'usr_martin', name: 'Martín Rodríguez', initials: 'MR', zone: 'AMBA' },
  { id: 'usr_sofia', name: 'Sofía Maidana', initials: 'SM', zone: 'CABA' },
  { id: 'usr_pablo', name: 'Pablo Ledesma', initials: 'PL', zone: 'Interior Norte' },
  { id: 'usr_rocio', name: 'Rocío Alcaraz', initials: 'RA', zone: 'Interior Sur' },
];

export const RMA_TECHNICIANS = [
  { id: 'usr_tecnico', name: 'Javier Ocampo', initials: 'JO' },
  { id: 'usr_tec2', name: 'Andrés Villalba', initials: 'AV' },
  { id: 'usr_tec3', name: 'Mariela Sosa', initials: 'MS' },
];

export function personName(id: string | null | undefined): string {
  if (!id) return '—';
  const all = [
    ...INTERNAL_USERS.map((u) => ({ id: u.id, name: u.name })),
    ...PRODUCT_MANAGERS.map((p) => ({ id: p.id, name: p.name })),
    ...SALES_REPS,
    ...RMA_TECHNICIANS,
  ];
  return all.find((p) => p.id === id)?.name ?? id;
}

export function pmById(id: string): ProductManager | undefined {
  return PRODUCT_MANAGERS.find((p) => p.id === id);
}

/**
 * Cargo de una persona interna. Los ejecutivos comerciales que no son
 * usuarios de la demo comparten el mismo puesto.
 */
export function personJobTitle(id: string | null | undefined): string {
  if (!id) return '—';
  const internal = INTERNAL_USERS.find((u) => u.id === id);
  if (internal) return internal.jobTitle;
  if (PRODUCT_MANAGERS.some((p) => p.id === id)) return 'Product Manager';
  if (RMA_TECHNICIANS.some((t) => t.id === id)) return 'Técnico de RMA';
  return 'Ejecutivo comercial';
}
