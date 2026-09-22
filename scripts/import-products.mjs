/**
 * Importador del Excel real de Ashir -> JSON normalizado para el mockup.
 *
 *   node scripts/import-products.mjs [ruta.xlsx]
 *
 * Lee /data/import/ashir-productos.xlsx (o el primer .xlsx/.xls/.csv de /data/import)
 * y escribe src/mocks/generated/{products,brands,categories,meta}.json
 * + reports/product-import-report.md
 *
 * NO modifica el Excel original.
 */
import XLSX from 'xlsx';
import fs from 'node:fs';
import path from 'node:path';

const IMPORT_DIR = 'data/import';
const OUT_DIR = 'apps/web/src/mocks/generated';
const REPORT = 'reports/product-import-report.md';

/* ------------------------------------------------------------------ */
/* utilidades                                                          */
/* ------------------------------------------------------------------ */

/** PRNG determinista por SKU: los datos simulados no cambian entre corridas. */
function seeded(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h ^= h << 13; h ^= h >>> 17; h ^= h << 5;
    return ((h >>> 0) % 100000) / 100000;
  };
}
const between = (rnd, a, b) => a + Math.floor(rnd() * (b - a + 1));
const slug = (s) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/* ------------------------------------------------------------------ */
/* taxonomia: el Excel trae secciones, las mapeamos a categorias       */
/* ------------------------------------------------------------------ */

const CATEGORY_MAP = {
  'FUENTES DE ALIMENTACIÓN (PSU)': { name: 'Fuentes', group: 'Componentes', warranty: 36 },
  'GABINETES': { name: 'Gabinetes', group: 'Componentes', warranty: 12 },
  'MICROPROCESADORES (CPU)': { name: 'Procesadores', group: 'Componentes', warranty: 36 },
  'REFRIGERACIÓN (CPU COOLERS / WATERCOOLERS / FANS)': { name: 'Refrigeración', group: 'Componentes', warranty: 24 },
  'MOTHERBOARDS': { name: 'Motherboards', group: 'Componentes', warranty: 36 },
  'PLACAS DE VIDEO (VGA)': { name: 'GPUs', group: 'Componentes', warranty: 36 },
  'MEMORIA RAM DDR4': { name: 'Memorias', group: 'Componentes', sub: 'DDR4', warranty: 60 },
  'MEMORIA RAM DDR5': { name: 'Memorias', group: 'Componentes', sub: 'DDR5', warranty: 60 },
  'DISCOS DE ESTADO SÓLIDO (SSD / M.2)': { name: 'SSD', group: 'Almacenamiento', warranty: 60 },
  'DISCOS RÍGIDOS (HDD)': { name: 'HDD', group: 'Almacenamiento', warranty: 24 },
  'SILLAS GAMER / ESCRITORIOS': { name: 'Sillas gamer', group: 'Mobiliario', warranty: 12 },
  'MONITORES (IMPUESTOS INTERNOS INCLUÍDOS)': { name: 'Monitores', group: 'Visualización', warranty: 36 },
  'PERIFÉRICOS GAMER': { name: 'Periféricos', group: 'Periféricos', warranty: 12 },
};

/** Marcas conocidas del rubro. Se detectan por prefijo de la descripcion. */
const KNOWN_BRANDS = [
  'THERMALTAKE', 'TTESPORTS', 'ASUS', 'MSI', 'EVOLABS', 'ADATA', 'AUREOX',
  'AMD', 'INTEL', 'SEAGATE', 'WESTERN DIGITAL', 'ACER', 'WICGTYP', 'KINGSTON',
  'XPG', 'GIGABYTE', 'CORSAIR', 'LOGITECH', 'REDRAGON', 'VIEWSONIC',
];

const BRAND_META = {
  THERMALTAKE: { pm: 'pm_lucia', color: '#d32027' },
  TTESPORTS: { pm: 'pm_lucia', color: '#d32027' },
  ASUS: { pm: 'pm_martin', color: '#00539b' },
  MSI: { pm: 'pm_diego', color: '#c8102e' },
  ADATA: { pm: 'pm_carla', color: '#e11d48' },
  XPG: { pm: 'pm_carla', color: '#e11d48' },
  EVOLABS: { pm: 'pm_lucia', color: '#f97316' },
  AUREOX: { pm: 'pm_carla', color: '#22c55e' },
  AMD: { pm: 'pm_diego', color: '#ed1c24' },
  ACER: { pm: 'pm_martin', color: '#83b81a' },
};

/** Estado del Excel -> disponibilidad del portal. */
const STATE_MAP = {
  'EN STOCK': 'IN_STOCK',
  'NUEVO INGRESO': 'NEW_ARRIVAL',
  'PRÓXIMAMENTE': 'INCOMING',
  'AGOTADO': 'OUT_OF_STOCK',
};

/* ------------------------------------------------------------------ */
/* lectura                                                             */
/* ------------------------------------------------------------------ */

function resolveSource(argPath) {
  if (argPath) return argPath;
  const preferred = path.join(IMPORT_DIR, 'ashir-productos.xlsx');
  if (fs.existsSync(preferred)) return preferred;
  if (!fs.existsSync(IMPORT_DIR)) return null;
  const candidate = fs
    .readdirSync(IMPORT_DIR)
    .filter((f) => /\.(xlsx|xlsm|xls|csv)$/i.test(f) && !f.startsWith('~$'))
    .sort()[0];
  return candidate ? path.join(IMPORT_DIR, candidate) : null;
}

/** Encuentra la hoja y la fila de encabezados sin asumir posiciones fijas. */
function locateHeader(wb) {
  const wanted = ['COD', 'DESCRIPCI'];
  for (const sheetName of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], {
      header: 1, raw: true, defval: null,
    });
    for (let i = 0; i < Math.min(rows.length, 25); i++) {
      const cells = (rows[i] || []).map((c) => String(c ?? '').toUpperCase());
      if (wanted.every((w) => cells.some((c) => c.includes(w)))) {
        return { sheetName, rows, headerIndex: i, header: cells };
      }
    }
  }
  return null;
}

function columnIndexes(header) {
  const find = (...needles) =>
    header.findIndex((h) => needles.some((n) => h.includes(n)));
  const exact = (...needles) =>
    header.findIndex((h) => needles.some((n) => h.trim() === n));
  return {
    sku: find('COD. INTERNO', 'COD INTERNO', 'CODIGO', 'CÓDIGO', 'COD'),
    partNumber: find('PART NUMBER', 'PARTNUMBER', 'EAN', 'UPC'),
    description: find('DESCRIPCI'),
    distPrice: find('DISTRI', 'DISTRIBUIDOR'),
    finalPrice: find('FINAL'),
    // "IVA" aparece tambien dentro de "DISTRI S/IVA": priorizar coincidencia exacta.
    vat: exact('IVA', 'ALICUOTA IVA') !== -1 ? exact('IVA', 'ALICUOTA IVA') : find('IVA'),
    state: find('ESTADO'),
    details: find('DETALLE'),
  };
}

/* ------------------------------------------------------------------ */
/* transformacion                                                      */
/* ------------------------------------------------------------------ */

function detectBrand(description) {
  const upper = description.toUpperCase();
  const hit = KNOWN_BRANDS.find((b) => upper.startsWith(b + ' ') || upper === b);
  if (hit) return hit;
  return upper.split(/\s+/)[0] || 'SIN MARCA';
}

function cleanName(raw) {
  return String(raw)
    .replace(/¡[^!]*!/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function extractTags(raw) {
  const tags = [];
  const upper = String(raw).toUpperCase();
  if (upper.includes('LIQUIDAC')) tags.push('LIQUIDACION');
  if (upper.includes('OFERTA')) tags.push('OFERTA');
  if (upper.includes('PROMO')) tags.push('PROMO');
  return tags;
}

function parseSpecs(details) {
  if (!details) return [];
  return String(details)
    .split(/\s+-\s+|\s+\/\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 1)
    .slice(0, 10);
}

function main() {
  const source = resolveSource(process.argv[2]);
  const problems = [];

  if (!source) {
    console.error(
      '[import] No se encontro ningun archivo en /' + IMPORT_DIR +
      '. Colocá el Excel como ' + IMPORT_DIR + '/ashir-productos.xlsx y volvé a ejecutar.',
    );
    process.exit(1);
  }

  const wb = XLSX.readFile(source);
  const located = locateHeader(wb);
  if (!located) {
    console.error('[import] No se pudo detectar la fila de encabezados.');
    process.exit(1);
  }
  const { sheetName, rows, headerIndex, header } = located;
  const col = columnIndexes(header);

  const products = [];
  const brands = new Map();
  const categories = new Map();
  const sectionsFound = [];
  const seenSku = new Set();
  let currentSection = null;
  let skipped = 0;

  for (let i = headerIndex + 1; i < rows.length; i++) {
    const row = rows[i] || [];
    const filled = row.filter((c) => c !== null && c !== '').length;

    // Fila de seccion: una sola celda con texto -> titulo de categoria.
    if (filled === 1 && typeof row[0] === 'string') {
      currentSection = row[0].trim();
      sectionsFound.push(currentSection);
      continue;
    }

    const sku = row[col.sku] == null ? '' : String(row[col.sku]).trim();
    const description = row[col.description] == null ? '' : String(row[col.description]).trim();
    const rawPrice = row[col.distPrice];
    const distPrice = Number(rawPrice);
    // Los productos AGOTADO traen "-" en las columnas de precio: se conservan
    // en el catalogo sin precio publicado (estado "Consultar disponibilidad").
    const hasPrice = Number.isFinite(distPrice) && distPrice > 0;

    if (!sku || !description) { skipped++; continue; }
    if (!hasPrice) {
      problems.push({
        row: i + 1,
        sku,
        issue: 'Sin precio publicado en el archivo (valor "' + String(rawPrice ?? '') + '") - se importa como "consultar"',
      });
    }
    if (seenSku.has(sku)) {
      problems.push({ row: i + 1, sku, issue: 'SKU duplicado - se conserva la primera aparicion' });
      skipped++;
      continue;
    }
    seenSku.add(sku);

    const rnd = seeded(sku);
    const brandName = detectBrand(description);
    const catCfg = CATEGORY_MAP[currentSection] || {
      name: currentSection ? cleanName(currentSection) : 'Sin categoría',
      group: 'Otros',
      warranty: 12,
    };
    if (!CATEGORY_MAP[currentSection] && currentSection) {
      problems.push({ row: i + 1, sku, issue: 'Seccion sin mapeo explicito: "' + currentSection + '"' });
    }

    const rawState = String(row[col.state] ?? '').trim().toUpperCase();
    const availability = STATE_MAP[rawState] || 'IN_STOCK';
    if (rawState && !STATE_MAP[rawState]) {
      problems.push({ row: i + 1, sku, issue: 'Estado desconocido: "' + rawState + '"' });
    }

    // --- stock: el Excel solo trae un estado cualitativo, la cantidad es DEMO ---
    let stock = 0;
    let incoming = null;
    if (availability === 'IN_STOCK') stock = between(rnd, 3, 180);
    else if (availability === 'NEW_ARRIVAL') stock = between(rnd, 60, 320);
    else if (availability === 'INCOMING') {
      incoming = { units: between(rnd, 40, 400), etaDays: between(rnd, 9, 45) };
    }

    // --- costo: NO viene en el Excel (DISTRI es precio de venta a reseller) ---
    const marginPct = between(rnd, 9, 26);
    const cost = hasPrice ? Number((distPrice * (1 - marginPct / 100)).toFixed(2)) : null;

    const vat = Number(row[col.vat]);
    const finalPrice = Number(row[col.finalPrice]);
    const details = row[col.details] == null ? '' : String(row[col.details]).trim();

    products.push({
      id: 'prod_' + slug(sku),
      sku,
      partNumber: row[col.partNumber] == null ? null : String(row[col.partNumber]).trim() || null,
      name: cleanName(description),
      brand: brandName,
      brandId: 'brand_' + slug(brandName),
      category: catCfg.name,
      categoryId: 'cat_' + slug(catCfg.name),
      categoryGroup: catCfg.group,
      subcategory: catCfg.sub ?? null,
      sourceSection: currentSection,
      tags: extractTags(description),
      // precios reales del archivo
      listPrice: hasPrice ? { amount: distPrice.toFixed(2), currency: 'USD' } : null,
      suggestedRetail: Number.isFinite(finalPrice)
        ? { amount: finalPrice.toFixed(2), currency: 'USD' }
        : null,
      vatRate: Number.isFinite(vat) ? vat : 0.21,
      // datos de demo, explicitamente marcados
      cost: cost === null ? null : { amount: cost.toFixed(2), currency: 'USD', simulated: true },
      marginPct: cost === null ? null : marginPct,
      stock,
      incoming,
      availability,
      rawState: rawState || null,
      warrantyMonths: catCfg.warranty,
      specs: parseSpecs(details),
      description: details || null,
      image: null, // el Excel no trae URLs de imagen: la UI usa un tile de marca
      pmId: BRAND_META[brandName]?.pm ?? 'pm_martin',
      active: availability !== 'OUT_OF_STOCK',
      unitsSold12m: between(rnd, 12, 1400),
      createdAt: new Date(2026, between(rnd, 0, 8), between(rnd, 1, 27)).toISOString(),
      dataSource: 'excel',
    });

    const b = brands.get(brandName) ?? {
      id: 'brand_' + slug(brandName),
      name: brandName,
      pmId: BRAND_META[brandName]?.pm ?? 'pm_martin',
      color: BRAND_META[brandName]?.color ?? '#475569',
      skuCount: 0,
      categories: new Set(),
    };
    b.skuCount++;
    b.categories.add(catCfg.name);
    brands.set(brandName, b);

    const c = categories.get(catCfg.name) ?? {
      id: 'cat_' + slug(catCfg.name),
      name: catCfg.name,
      group: catCfg.group,
      subcategories: new Set(),
      skuCount: 0,
    };
    c.skuCount++;
    if (catCfg.sub) c.subcategories.add(catCfg.sub);
    categories.set(catCfg.name, c);
  }

  const brandsOut = [...brands.values()]
    .map((b) => ({ ...b, categories: [...b.categories] }))
    .sort((a, b) => b.skuCount - a.skuCount);
  const categoriesOut = [...categories.values()]
    .map((c) => ({ ...c, subcategories: [...c.subcategories] }))
    .sort((a, b) => b.skuCount - a.skuCount);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(path.dirname(REPORT), { recursive: true });
  const write = (file, data) =>
    fs.writeFileSync(path.join(OUT_DIR, file), JSON.stringify(data, null, 2) + '\n');

  write('products.json', products);
  write('brands.json', brandsOut);
  write('categories.json', categoriesOut);
  write('meta.json', {
    source: path.basename(source),
    sheet: sheetName,
    importedAt: new Date().toISOString(),
    productCount: products.length,
    brandCount: brandsOut.length,
    categoryCount: categoriesOut.length,
    skippedRows: skipped,
    problemCount: problems.length,
    simulatedFields: ['cost', 'marginPct', 'stock', 'incoming', 'unitsSold12m', 'createdAt', 'image'],
    realFields: ['sku', 'partNumber', 'name', 'brand', 'category', 'listPrice', 'suggestedRetail', 'vatRate', 'availability', 'specs'],
  });

  /* ------------------------------ reporte ------------------------------ */
  const byState = products.reduce((acc, p) => {
    acc[p.availability] = (acc[p.availability] ?? 0) + 1;
    return acc;
  }, {});

  const problemTable = problems.length === 0
    ? '_Sin observaciones._'
    : ['| Fila | SKU | Observación |', '|---:|---|---|']
        .concat(problems.slice(0, 60).map((p) => '| ' + p.row + ' | ' + (p.sku || '—') + ' | ' + p.issue + ' |'))
        .join('\n')
      + (problems.length > 60 ? '\n\n_(+' + (problems.length - 60) + ' observaciones adicionales)_' : '');

  const md = [
    '# Reporte de importación de productos',
    '',
    '- **Archivo origen:** `' + path.basename(source) + '`',
    '- **Hoja utilizada:** `' + sheetName + '` (encabezados detectados en la fila ' + (headerIndex + 1) + ')',
    '- **Fecha de importación:** ' + new Date().toISOString(),
    '- **Filas válidas:** ' + products.length,
    '- **Filas ignoradas:** ' + skipped + ' (títulos de sección, filas vacías, duplicados o sin precio)',
    '- **Marcas:** ' + brandsOut.length,
    '- **Categorías:** ' + categoriesOut.length,
    '- **Observaciones:** ' + problems.length,
    '',
    '## Mapeo aplicado',
    '',
    '| Campo del sistema | Columna del Excel | Origen |',
    '|---|---|---|',
    '| `sku` | COD. INTERNO | real |',
    '| `partNumber` | PART NUMBER | real |',
    '| `name` | DESCRIPCIÓN (sin marcadores promocionales) | real |',
    '| `brand` | derivada del prefijo de DESCRIPCIÓN | derivada |',
    '| `category` | fila de sección del listado | derivada |',
    '| `listPrice` | DISTRI S/IVA (USD) | real |',
    '| `suggestedRetail` | FINAL | real |',
    '| `vatRate` | IVA | real |',
    '| `availability` | ESTADO | real |',
    '| `specs` / `description` | DETALLES | real |',
    '| `cost`, `marginPct` | — | **simulado (demo)** |',
    '| `stock`, `incoming` | derivado cualitativamente de ESTADO | **cantidad simulada (demo)** |',
    '| `unitsSold12m`, `createdAt` | — | **simulado (demo)** |',
    '| `image` | no existe en el archivo | sin dato — la UI usa un tile de marca |',
    '',
    '> El Excel no contiene costos ni cantidades de stock. `cost` y `stock` se generan con un',
    '> PRNG determinista sembrado con el SKU (estables entre corridas) y quedan marcados como',
    '> simulados. El portal no los presenta nunca como información productiva.',
    '',
    '## Distribución por estado',
    '',
    Object.entries(byState).map(([k, v]) => '- `' + k + '`: ' + v).join('\n'),
    '',
    '## Marcas detectadas',
    '',
    '| Marca | SKUs | Categorías |',
    '|---|---:|---|',
    brandsOut.map((b) => '| ' + b.name + ' | ' + b.skuCount + ' | ' + b.categories.join(', ') + ' |').join('\n'),
    '',
    '## Categorías detectadas',
    '',
    '| Categoría | Grupo | SKUs |',
    '|---|---|---:|',
    categoriesOut.map((c) => '| ' + c.name + ' | ' + c.group + ' | ' + c.skuCount + ' |').join('\n'),
    '',
    '## Secciones leídas del archivo',
    '',
    sectionsFound.map((s) => '- ' + s).join('\n'),
    '',
    '## Observaciones por fila',
    '',
    problemTable,
    '',
  ].join('\n');

  fs.writeFileSync(REPORT, md);

  console.log('[import] ' + products.length + ' productos · ' + brandsOut.length + ' marcas · ' + categoriesOut.length + ' categorías');
  console.log('[import] ' + skipped + ' filas ignoradas · ' + problems.length + ' observaciones');
  console.log('[import] -> ' + OUT_DIR + '/  y  ' + REPORT);
}

main();
