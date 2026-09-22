/**
 * Listas de precios: crear, duplicar, comparar y simular impacto.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Copy, FileText, GitCompare, Plus, Users } from 'lucide-react';
import type { PriceList } from '@/types';
import { api } from '@/services';
import { useAsync } from '@/app/hooks';
import { useToast, Dialog } from '@/components/ui/overlays';
import { SELLABLE_PRODUCTS } from '@/mocks/fixtures/catalog';
import { cn, fmtDate, fmtMoney, fmtNumber, num } from '@/lib/utils';
import { Badge, Button, Select } from '@/components/ui/primitives';
import {
  Callout,
  DataTable,
  EmptyState,
  PageHeader,
  SectionTitle,
  StatGrid,
  StatTile,
  type Column,
} from '@/components/ui/data';

export function BoPriceLists() {
  const toast = useToast();
  const [compareOpen, setCompareOpen] = useState(false);
  const { data: lists, initialLoading } = useAsync(() => api.pricing.listPriceLists(), []);

  const all = lists ?? [];
  const active = all.filter((l) => l.status === 'ACTIVE');

  const columns: Column<PriceList>[] = [
    {
      key: 'code',
      header: 'Lista',
      cell: (l) => (
        <div className="min-w-0">
          <Link to={`/bo/precios/${l.id}`} className="text-[13px] font-semibold text-ashir-600 hover:text-ashir-700">
            {l.code}
          </Link>
          <p className="truncate text-[11px] text-ink-400">{l.name}</p>
        </div>
      ),
    },
    {
      key: 'segment',
      header: 'Segmento',
      cell: (l) => (l.segment ? <Badge tone="neutral" size="sm">{l.segment}</Badge> : <span className="text-ink-400">Custom</span>),
    },
    {
      key: 'adjustment',
      header: 'Ajuste base',
      align: 'right',
      cell: (l) => (
        <span className={cn('font-semibold tabular-nums', Number.parseFloat(l.baseAdjustmentPct) < 0 ? 'text-ok-700' : 'text-ink-700')}>
          {Number.parseFloat(l.baseAdjustmentPct).toFixed(2).replace('.', ',')}%
        </span>
      ),
      sortable: true,
      sortValue: (l) => Number.parseFloat(l.baseAdjustmentPct),
    },
    {
      key: 'rules',
      header: 'Reglas',
      align: 'right',
      hideOnMobile: true,
      cell: (l) => (
        <span className="tabular-nums text-ink-600">
          {l.rules.length}
          {l.overrides.length > 0 && <span className="ml-1 text-[11px] text-ashir-600">+{l.overrides.length} SKU</span>}
        </span>
      ),
    },
    {
      key: 'customers',
      header: 'Clientes',
      align: 'right',
      cell: (l) => <span className="tabular-nums text-ink-700">{l.customerCount}</span>,
      sortable: true,
      sortValue: (l) => l.customerCount,
    },
    {
      key: 'validity',
      header: 'Vigencia',
      hideOnMobile: true,
      cell: (l) => (
        <span className="text-xs text-ink-600">
          {fmtDate(l.validFrom)}
          {l.validTo ? ` → ${fmtDate(l.validTo)}` : ' → sin vencimiento'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Estado',
      cell: (l) => (
        <Badge tone={l.status === 'ACTIVE' ? 'ok' : l.status === 'DRAFT' ? 'warn' : 'neutral'} size="sm" dot>
          {l.status === 'ACTIVE' ? 'Vigente' : l.status === 'DRAFT' ? 'Borrador' : 'Archivada'}
        </Badge>
      ),
    },
    {
      key: 'updated',
      header: 'Actualizada',
      align: 'right',
      hideOnMobile: true,
      cell: (l) => (
        <span className="text-xs text-ink-500">
          {fmtDate(l.updatedAt)}
          <span className="block text-ink-400">{l.updatedBy}</span>
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      width: '90px',
      cell: (l) => (
        <Button
          size="sm"
          variant="ghost"
          icon={<Copy className="size-3.5" />}
          onClick={(e) => {
            e.stopPropagation();
            toast.simulated(`La duplicación de la lista ${l.code}`);
          }}
        >
          Duplicar
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Listas de precios"
        subtitle="Cada lista aplica un ajuste base sobre el precio de distribuidor, más reglas por marca o categoría y overrides puntuales por SKU."
        actions={
          <>
            <Button variant="outline" icon={<GitCompare className="size-4" />} onClick={() => setCompareOpen(true)}>
              Comparar listas
            </Button>
            <Button icon={<Plus className="size-4" />} onClick={() => toast.simulated('La creación de una lista nueva')}>
              Nueva lista
            </Button>
          </>
        }
      />

      <StatGrid cols={4} className="mb-6">
        <StatTile label="Listas configuradas" value={all.length} icon={<FileText className="size-4" />} />
        <StatTile label="Vigentes" value={active.length} tone="ok" />
        <StatTile
          label="Clientes asignados"
          value={all.reduce((a, l) => a + l.customerCount, 0)}
          icon={<Users className="size-4" />}
        />
        <StatTile
          label="Overrides por SKU"
          value={all.reduce((a, l) => a + l.overrides.length, 0)}
          footer="Precios acordados fuera de la regla general"
        />
      </StatGrid>

      <DataTable
        columns={columns}
        rows={all}
        rowKey={(l) => l.id}
        loading={initialLoading}
        dense
        empty={<EmptyState title="Sin listas configuradas" icon={<FileText className="size-5" />} />}
      />

      <Callout tone="tech" className="mt-5">
        El orden de aplicación es: precio de distribuidor del archivo → override por SKU si existe → regla por marca →
        regla por categoría → ajuste base de la lista. Después actúa el motor de condiciones comerciales.
      </Callout>

      <CompareDialog open={compareOpen} onClose={() => setCompareOpen(false)} lists={all} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* comparador de listas                                                */
/* ------------------------------------------------------------------ */

function CompareDialog({ open, onClose, lists }: { open: boolean; onClose: () => void; lists: PriceList[] }) {
  const [leftId, setLeftId] = useState(lists[2]?.id ?? '');
  const [rightId, setRightId] = useState(lists[3]?.id ?? '');

  const left = lists.find((l) => l.id === leftId);
  const right = lists.find((l) => l.id === rightId);

  /** Precio que resultaría de una lista para un producto. */
  const priceFor = (list: PriceList | undefined, sku: string, base: number): number => {
    if (!list) return base;
    const override = list.overrides.find((o) => o.sku === sku);
    if (override) return num(override.price);
    const product = SELLABLE_PRODUCTS.find((p) => p.sku === sku);
    const rule =
      list.rules.find((r) => r.scope === 'BRAND' && r.target === product?.brand) ??
      list.rules.find((r) => r.scope === 'CATEGORY' && r.target === product?.category) ??
      list.rules.find((r) => r.scope === 'ALL');
    const pct = Number.parseFloat(rule?.adjustmentPct ?? list.baseAdjustmentPct);
    return Math.round(base * (1 + pct / 100) * 100) / 100;
  };

  const sample = SELLABLE_PRODUCTS.filter((p) => p.stock > 0)
    .sort((a, b) => b.unitsSold12m - a.unitsSold12m)
    .slice(0, 12);

  const rows = sample.map((product) => {
    const base = num(product.listPrice);
    const leftPrice = priceFor(left, product.sku, base);
    const rightPrice = priceFor(right, product.sku, base);
    return {
      sku: product.sku,
      name: product.name,
      brand: product.brand,
      base,
      leftPrice,
      rightPrice,
      delta: rightPrice - leftPrice,
      deltaPct: leftPrice > 0 ? ((rightPrice - leftPrice) / leftPrice) * 100 : 0,
    };
  });

  const avgDelta = rows.length > 0 ? rows.reduce((a, r) => a + r.deltaPct, 0) / rows.length : 0;
  const impact = rows.reduce((a, r) => {
    const product = SELLABLE_PRODUCTS.find((p) => p.sku === r.sku);
    return a + r.delta * ((product?.unitsSold12m ?? 0) / 12);
  }, 0);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Comparar listas de precios"
      description="Simulación sobre los 12 SKUs de mayor rotación con stock."
      size="xl"
      footer={
        <Button variant="outline" onClick={onClose}>
          Cerrar
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="cmp-left" className="mb-1.5 block text-[13px] font-medium text-ink-700">
              Lista base
            </label>
            <Select id="cmp-left" value={leftId} onChange={(e) => setLeftId(e.target.value)}>
              {lists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.code} · {l.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label htmlFor="cmp-right" className="mb-1.5 block text-[13px] font-medium text-ink-700">
              Lista a comparar
            </label>
            <Select id="cmp-right" value={rightId} onChange={(e) => setRightId(e.target.value)}>
              {lists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.code} · {l.name}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <StatTile
            label="Diferencia promedio"
            value={`${avgDelta > 0 ? '+' : ''}${avgDelta.toFixed(2).replace('.', ',')}%`}
            tone={avgDelta < 0 ? 'ok' : avgDelta > 0 ? 'warn' : 'neutral'}
            footer={`${right?.code ?? '—'} respecto de ${left?.code ?? '—'}`}
          />
          <StatTile
            label="Impacto mensual estimado"
            value={fmtMoney({ amount: impact.toFixed(2), currency: 'USD' })}
            tone={impact < 0 ? 'bad' : 'ok'}
            footer="Sobre la rotación mensual de los SKUs comparados"
          />
        </div>

        <SectionTitle title="Detalle por SKU" className="mb-2" />
        <div className="overflow-x-auto rounded-lg border border-ink-200">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-ink-200 bg-ink-50">
                <th className="px-3 py-2 font-medium text-ink-500">Producto</th>
                <th className="px-3 py-2 text-right font-medium text-ink-500">Distribuidor</th>
                <th className="px-3 py-2 text-right font-medium text-ink-500">{left?.code ?? '—'}</th>
                <th className="px-3 py-2 text-right font-medium text-ink-500">{right?.code ?? '—'}</th>
                <th className="px-3 py-2 text-right font-medium text-ink-500">Δ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {rows.map((row) => (
                <tr key={row.sku}>
                  <td className="px-3 py-2">
                    <p className="max-w-[260px] truncate font-medium text-ink-900">{row.name}</p>
                    <code className="font-mono text-[11px] text-ink-400">{row.sku}</code>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-ink-500">{fmtNumber(row.base, 2)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-ink-800">{fmtNumber(row.leftPrice, 2)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-ink-800">{fmtNumber(row.rightPrice, 2)}</td>
                  <td
                    className={cn(
                      'px-3 py-2 text-right font-semibold tabular-nums',
                      row.delta < 0 ? 'text-ok-700' : row.delta > 0 ? 'text-bad-600' : 'text-ink-400',
                    )}
                  >
                    {row.delta === 0 ? '—' : `${row.deltaPct > 0 ? '+' : ''}${row.deltaPct.toFixed(2).replace('.', ',')}%`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Dialog>
  );
}
