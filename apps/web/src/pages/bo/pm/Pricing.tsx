/**
 * Pricing por marca: precio, costo, margen y posición frente al sugerido.
 */
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FlaskConical, Percent, Search } from 'lucide-react';
import type { Product } from '@/types';
import { api } from '@/services';
import { useSession } from '@/app/session';
import { useAsync, useDebounced } from '@/app/hooks';
import { PRODUCTS } from '@/mocks/fixtures/catalog';
import { can } from '@/lib/rbac';
import { cn, fmtMoney, fmtNumber, num } from '@/lib/utils';
import { Badge, Button, Card, Input, Select } from '@/components/ui/primitives';
import {
  Callout,
  DataTable,
  EmptyState,
  FilterBar,
  ForbiddenState,
  Mono,
  PageHeader,
  StatGrid,
  StatTile,
  type Column,
} from '@/components/ui/data';
import { ConditionSimulator } from '@/components/domain/condition-simulator';
import { brandColor } from '@/components/domain/common';

export function PmPricing() {
  const { session } = useSession();
  const [params, setParams] = useSearchParams();
  const [term, setTerm] = useState('');
  const debounced = useDebounced(term);
  const [marginFilter, setMarginFilter] = useState('');
  const [simulatorOpen, setSimulatorOpen] = useState(false);

  const brands = useAsync(() => api.pm.listBrandsForPm(session), [session.role, session.userId]);
  const brandId = params.get('brand') ?? brands.data?.[0]?.id ?? '';

  if (!can(session, 'margin:read')) {
    return (
      <Card>
        <ForbiddenState scope="margin:read" />
      </Card>
    );
  }

  const products = PRODUCTS.filter((p) => {
    if (brandId && p.brandId !== brandId) return false;
    if (!p.listPrice) return false;
    if (debounced) {
      const q = debounced.toLowerCase();
      if (!p.name.toLowerCase().includes(q) && !p.sku.toLowerCase().includes(q)) return false;
    }
    if (marginFilter === 'low' && (p.marginPct ?? 0) >= 12) return false;
    if (marginFilter === 'high' && (p.marginPct ?? 0) < 20) return false;
    return true;
  }).sort((a, b) => (a.marginPct ?? 0) - (b.marginPct ?? 0));

  const avgMargin =
    products.length > 0 ? products.reduce((a, p) => a + (p.marginPct ?? 0), 0) / products.length : 0;
  const lowMargin = products.filter((p) => (p.marginPct ?? 0) < 12);

  const columns: Column<Product>[] = [
    {
      key: 'product',
      header: 'Producto',
      cell: (p) => (
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium text-ink-900">{p.name}</p>
          <p className="mt-0.5 flex items-center gap-2 text-[11px] text-ink-400">
            <Mono>{p.sku}</Mono>
            <span>{p.category}</span>
          </p>
        </div>
      ),
    },
    {
      key: 'cost',
      header: 'Costo',
      align: 'right',
      cell: (p) => (
        <span className="tabular-nums text-ink-600">
          {fmtMoney(p.cost)}
          <span className="ml-1 text-[10px] text-ink-400">sim</span>
        </span>
      ),
      sortable: true,
      sortValue: (p) => num(p.cost),
    },
    {
      key: 'list',
      header: 'Precio distribuidor',
      align: 'right',
      cell: (p) => <span className="font-semibold tabular-nums text-ink-900">{fmtMoney(p.listPrice)}</span>,
      sortable: true,
      sortValue: (p) => num(p.listPrice),
    },
    {
      key: 'retail',
      header: 'Final sugerido',
      align: 'right',
      hideOnMobile: true,
      cell: (p) => <span className="tabular-nums text-ink-500">{fmtMoney(p.suggestedRetail)}</span>,
    },
    {
      key: 'spread',
      header: 'Spread retail',
      align: 'right',
      hideOnMobile: true,
      cell: (p) => {
        if (!p.suggestedRetail || !p.listPrice) return <span className="text-ink-400">—</span>;
        const spread = ((num(p.suggestedRetail) - num(p.listPrice)) / num(p.listPrice)) * 100;
        return <span className="tabular-nums text-ink-600">{spread.toFixed(1).replace('.', ',')}%</span>;
      },
    },
    {
      key: 'margin',
      header: 'Margen',
      align: 'right',
      cell: (p) => (
        <Badge tone={(p.marginPct ?? 0) < 12 ? 'bad' : (p.marginPct ?? 0) < 18 ? 'warn' : 'ok'} size="sm">
          {p.marginPct}%
        </Badge>
      ),
      sortable: true,
      sortValue: (p) => p.marginPct ?? 0,
    },
    {
      key: 'stock',
      header: 'Stock',
      align: 'right',
      hideOnMobile: true,
      cell: (p) => <span className="tabular-nums text-ink-600">{fmtNumber(p.stock)}</span>,
      sortable: true,
      sortValue: (p) => p.stock,
    },
    {
      key: 'action',
      header: '',
      align: 'right',
      width: '90px',
      cell: (p) => (
        <Link to={`/bo/pm/simulador?sku=${p.sku}`} className="text-[13px] font-medium text-ashir-600 hover:text-ashir-700">
          Simular
        </Link>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'PM Cockpit', href: '/bo/pm' }, { label: 'Pricing' }]}
        title="Pricing por marca"
        subtitle="Precio de distribuidor, costo, margen y posición frente al precio final sugerido."
        actions={
          <Button variant="outline" icon={<FlaskConical className="size-4" />} onClick={() => setSimulatorOpen(true)}>
            Simulador de condiciones
          </Button>
        }
      />

      <div className="no-scrollbar mb-6 flex gap-2 overflow-x-auto pb-1">
        {(brands.data ?? []).map((brand) => (
          <button
            key={brand.id}
            type="button"
            onClick={() => setParams({ brand: brand.id }, { replace: true })}
            className={cn(
              'flex shrink-0 items-center gap-2 rounded-lg border px-3.5 py-2 text-[13px] font-medium transition-colors',
              brand.id === brandId
                ? 'border-ashir-300 bg-ashir-50 text-ashir-800'
                : 'border-ink-200 bg-white text-ink-600 hover:border-ink-300 hover:bg-ink-50',
            )}
          >
            <span className="size-2.5 rounded-sm" style={{ background: brandColor(brand.name) }} aria-hidden />
            {brand.name}
          </button>
        ))}
      </div>

      <StatGrid cols={4} className="mb-6">
        <StatTile label="SKUs con precio" value={products.length} />
        <StatTile
          label="Margen promedio"
          value={`${avgMargin.toFixed(1).replace('.', ',')}%`}
          icon={<Percent className="size-4" />}
          tone={avgMargin < 14 ? 'warn' : 'ok'}
        />
        <StatTile
          label="Bajo el 12% de margen"
          value={lowMargin.length}
          tone={lowMargin.length > 0 ? 'bad' : 'ok'}
          footer="Candidatos a revisión de precio"
        />
        <StatTile
          label="Stock valorizado"
          value={fmtMoney(
            { amount: products.reduce((a, p) => a + num(p.listPrice) * p.stock, 0).toFixed(2), currency: 'USD' },
            { compact: true },
          )}
        />
      </StatGrid>

      {lowMargin.length > 0 && (
        <Callout tone="warn" className="mb-5" title={`${lowMargin.length} SKUs con margen bajo`}>
          Están por debajo del 12%. Revisá si el precio de lista sigue alineado al costo de reposición actual, sobre
          todo si el tipo de cambio se movió desde la última actualización.
        </Callout>
      )}

      <FilterBar>
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Buscar por nombre o SKU…"
          leading={<Search className="size-4" />}
          className="max-w-xs"
        />
        <Select value={marginFilter} onChange={(e) => setMarginFilter(e.target.value)} className="w-auto min-w-[170px]" aria-label="Margen">
          <option value="">Todos los márgenes</option>
          <option value="low">Margen bajo (&lt; 12%)</option>
          <option value="high">Margen alto (≥ 20%)</option>
        </Select>
      </FilterBar>

      <DataTable
        columns={columns}
        rows={products}
        rowKey={(p) => p.id}
        dense
        empty={<EmptyState title="No hay productos con estos filtros" icon={<Percent className="size-5" />} />}
      />

      <Callout tone="neutral" className="mt-5">
        El costo y el margen son valores simulados: el archivo de distribuidor de Ashir no contiene costos. El precio de
        distribuidor y el final sugerido sí son reales.
      </Callout>

      <ConditionSimulator open={simulatorOpen} onClose={() => setSimulatorOpen(false)} />
    </div>
  );
}
