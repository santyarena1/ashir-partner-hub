/**
 * Detalle de una lista de precios: reglas, overrides, clientes asignados
 * y previsualización del precio resultante.
 */
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Building2, Calculator, Plus, Tag, Users } from 'lucide-react';
import type { PriceList } from '@/types';
import { api } from '@/services';
import { useAsync } from '@/app/hooks';
import { useToast } from '@/components/ui/overlays';
import { CUSTOMERS } from '@/mocks/fixtures/customers';
import { SELLABLE_PRODUCTS, productBySku } from '@/mocks/fixtures/catalog';
import { cn, fmtDate, fmtMoney, fmtNumber, num } from '@/lib/utils';
import { Badge, Button, Card, CardHeader, Input, Select, Skeleton } from '@/components/ui/primitives';
import {
  Callout,
  DataRow,
  DataTable,
  EmptyState,
  ErrorState,
  Mono,
  PageHeader,
  SectionTitle,
  type Column,
} from '@/components/ui/data';
import { SegmentBadge } from '@/components/domain/common';

export function BoPriceListDetail() {
  const { id = '' } = useParams();
  const toast = useToast();
  const [previewSku, setPreviewSku] = useState('');

  const list = useAsync(() => api.pricing.getPriceList(id), [id]);

  if (list.error) {
    return (
      <Card>
        <ErrorState title="No encontramos la lista" description={list.error.message} onRetry={list.refetch} />
      </Card>
    );
  }
  if (list.initialLoading || !list.data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-64 w-full rounded-card" />
      </div>
    );
  }

  const l = list.data;
  const customers = CUSTOMERS.filter((c) => c.priceListId === l.id);

  /* --- previsualización del precio resultante --- */
  const previewProduct = previewSku ? productBySku(previewSku) : undefined;
  const resolvedRule = previewProduct
    ? (l.rules.find((r) => r.scope === 'BRAND' && r.target === previewProduct.brand) ??
      l.rules.find((r) => r.scope === 'CATEGORY' && r.target === previewProduct.category) ??
      l.rules.find((r) => r.scope === 'ALL'))
    : undefined;
  const override = previewProduct ? l.overrides.find((o) => o.sku === previewProduct.sku) : undefined;
  const basePrice = previewProduct ? num(previewProduct.listPrice) : 0;
  const finalPrice = override
    ? num(override.price)
    : Math.round(basePrice * (1 + Number.parseFloat(resolvedRule?.adjustmentPct ?? l.baseAdjustmentPct) / 100) * 100) / 100;

  const ruleColumns: Column<PriceList['rules'][number]>[] = [
    {
      key: 'scope',
      header: 'Alcance',
      cell: (r) => (
        <Badge tone={r.scope === 'ALL' ? 'neutral' : r.scope === 'BRAND' ? 'brand' : 'tech'} size="sm">
          {r.scope === 'ALL' ? 'Todo el catálogo' : r.scope === 'BRAND' ? 'Marca' : 'Categoría'}
        </Badge>
      ),
    },
    { key: 'target', header: 'Objetivo', cell: (r) => <span className="font-medium text-ink-900">{r.target}</span> },
    {
      key: 'adjustment',
      header: 'Ajuste',
      align: 'right',
      cell: (r) => (
        <span className={cn('font-semibold tabular-nums', Number.parseFloat(r.adjustmentPct) < 0 ? 'text-ok-700' : 'text-ink-700')}>
          {Number.parseFloat(r.adjustmentPct).toFixed(2).replace('.', ',')}%
        </span>
      ),
    },
    {
      key: 'affected',
      header: 'SKUs alcanzados',
      align: 'right',
      hideOnMobile: true,
      cell: (r) => (
        <span className="tabular-nums text-ink-600">
          {r.scope === 'ALL'
            ? fmtNumber(SELLABLE_PRODUCTS.length)
            : fmtNumber(
                SELLABLE_PRODUCTS.filter((p) => (r.scope === 'BRAND' ? p.brand === r.target : p.category === r.target)).length,
              )}
        </span>
      ),
    },
  ];

  const overrideColumns: Column<PriceList['overrides'][number]>[] = [
    {
      key: 'sku',
      header: 'SKU',
      cell: (o) => {
        const product = productBySku(o.sku);
        return (
          <div className="min-w-0">
            <Mono>{o.sku}</Mono>
            {product && <p className="mt-0.5 truncate text-[11px] text-ink-400">{product.name}</p>}
          </div>
        );
      },
    },
    {
      key: 'base',
      header: 'Precio distribuidor',
      align: 'right',
      hideOnMobile: true,
      cell: (o) => {
        const product = productBySku(o.sku);
        return <span className="tabular-nums text-ink-500">{fmtMoney(product?.listPrice ?? null)}</span>;
      },
    },
    {
      key: 'price',
      header: 'Precio acordado',
      align: 'right',
      cell: (o) => <span className="font-semibold tabular-nums text-ink-900">{fmtMoney(o.price)}</span>,
    },
    {
      key: 'delta',
      header: 'Δ',
      align: 'right',
      cell: (o) => {
        const product = productBySku(o.sku);
        const base = num(product?.listPrice ?? null);
        if (base === 0) return <span className="text-ink-400">—</span>;
        const pct = ((num(o.price) - base) / base) * 100;
        return (
          <span className={cn('font-semibold tabular-nums', pct < 0 ? 'text-ok-700' : 'text-bad-600')}>
            {pct.toFixed(2).replace('.', ',')}%
          </span>
        );
      },
    },
    { key: 'note', header: 'Motivo', hideOnMobile: true, cell: (o) => <span className="text-xs text-ink-500">{o.note ?? '—'}</span> },
  ];

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'Listas de precios', href: '/bo/precios' }, { label: l.code }]}
        title={`${l.code} · ${l.name}`}
        subtitle={`Vigencia desde ${fmtDate(l.validFrom)}${l.validTo ? ` hasta ${fmtDate(l.validTo)}` : ' sin vencimiento'} · última actualización ${fmtDate(l.updatedAt)} por ${l.updatedBy}`}
        badge={
          <Badge tone={l.status === 'ACTIVE' ? 'ok' : l.status === 'DRAFT' ? 'warn' : 'neutral'} dot>
            {l.status === 'ACTIVE' ? 'Vigente' : l.status === 'DRAFT' ? 'Borrador' : 'Archivada'}
          </Badge>
        }
        actions={
          <>
            <Button variant="outline" onClick={() => toast.simulated('La asignación masiva de clientes')}>
              Asignar clientes
            </Button>
            <Button onClick={() => toast.simulated('La edición de la lista')}>Editar lista</Button>
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-5">
          <Card>
            <CardHeader
              title="Reglas porcentuales"
              subtitle="La regla más específica gana: producto → categoría → marca → todo el catálogo"
              icon={<Tag className="size-4" />}
              action={
                <Button size="sm" variant="outline" icon={<Plus className="size-3.5" />} onClick={() => toast.simulated('El alta de reglas')}>
                  Nueva regla
                </Button>
              }
            />
            <DataTable columns={ruleColumns} rows={l.rules} rowKey={(r) => r.id} dense className="rounded-none border-0" />
          </Card>

          <Card>
            <CardHeader
              title="Overrides por SKU"
              subtitle="Precios acordados que reemplazan cualquier regla de la lista"
              action={
                <Button size="sm" variant="outline" icon={<Plus className="size-3.5" />} onClick={() => toast.simulated('El alta de overrides')}>
                  Nuevo override
                </Button>
              }
            />
            {l.overrides.length === 0 ? (
              <EmptyState
                compact
                title="Sin overrides configurados"
                description="Todos los precios de esta lista se resuelven por regla porcentual."
                icon={<Tag className="size-5" />}
              />
            ) : (
              <DataTable
                columns={overrideColumns}
                rows={l.overrides}
                rowKey={(o) => o.sku}
                dense
                className="rounded-none border-0"
              />
            )}
          </Card>

          <Card>
            <CardHeader
              title="Clientes asignados"
              subtitle={`${customers.length} de ${l.customerCount} declarados`}
              icon={<Users className="size-4" />}
            />
            {customers.length === 0 ? (
              <EmptyState compact title="Sin clientes asignados" icon={<Building2 className="size-5" />} />
            ) : (
              <ul className="divide-y divide-ink-100">
                {customers.map((customer) => (
                  <li key={customer.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <Link
                        to={`/bo/clientes/${customer.id}`}
                        className="text-[13px] font-medium text-ashir-600 hover:text-ashir-700"
                      >
                        {customer.tradeName}
                      </Link>
                      <p className="text-[11px] text-ink-400">
                        {customer.code} · {customer.zone}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <SegmentBadge segment={customer.segment} size="sm" />
                      <span className="text-[13px] tabular-nums text-ink-600">
                        {fmtMoney(customer.purchases12m, { compact: true })}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        {/* ---------------- panel derecho ---------------- */}
        <div className="space-y-4">
          <Card>
            <CardHeader title="Configuración" />
            <div className="space-y-0.5 p-5">
              <DataRow label="Código" value={<Mono copy>{l.code}</Mono>} />
              <DataRow label="Segmento" value={l.segment ?? 'Personalizada'} />
              <DataRow
                label="Ajuste base"
                value={
                  <span className={Number.parseFloat(l.baseAdjustmentPct) < 0 ? 'font-semibold text-ok-700' : ''}>
                    {Number.parseFloat(l.baseAdjustmentPct).toFixed(2).replace('.', ',')}%
                  </span>
                }
                emphasis
              />
              <DataRow label="Moneda" value={l.currency} />
              <DataRow label="Tipo de cambio" value={`ARS ${fmtNumber(l.fxRate)}`} />
              <DataRow label="Reglas" value={l.rules.length} />
              <DataRow label="Overrides" value={l.overrides.length} />
              <DataRow label="Clientes" value={l.customerCount} />
            </div>
          </Card>

          <Card>
            <CardHeader title="Previsualizar precio" icon={<Calculator className="size-4" />} />
            <div className="p-5">
              <label htmlFor="preview-sku" className="mb-1.5 block text-[13px] font-medium text-ink-700">
                Elegí un SKU
              </label>
              <Select id="preview-sku" value={previewSku} onChange={(e) => setPreviewSku(e.target.value)}>
                <option value="">Seleccionar producto…</option>
                {SELLABLE_PRODUCTS.slice(0, 60).map((p) => (
                  <option key={p.sku} value={p.sku}>
                    {p.sku} · {p.name.slice(0, 40)}
                  </option>
                ))}
              </Select>

              {previewProduct && (
                <div className="mt-4 space-y-1.5 font-mono text-[12px]">
                  <div className="flex justify-between gap-3">
                    <span className="text-ink-500">Precio distribuidor</span>
                    <span className="tabular-nums text-ink-700">{fmtNumber(basePrice, 2)}</span>
                  </div>
                  {override ? (
                    <div className="flex justify-between gap-3">
                      <span className="min-w-0 truncate text-ink-500">Override acordado</span>
                      <span className="tabular-nums text-ashir-700">{fmtNumber(num(override.price), 2)}</span>
                    </div>
                  ) : (
                    <div className="flex justify-between gap-3">
                      <span className="min-w-0 truncate text-ink-500">
                        {resolvedRule?.scope === 'ALL' ? 'Ajuste base' : `Regla ${resolvedRule?.target ?? ''}`}
                      </span>
                      <span className="tabular-nums text-ok-700">
                        {Number.parseFloat(resolvedRule?.adjustmentPct ?? l.baseAdjustmentPct).toFixed(2).replace('.', ',')}%
                      </span>
                    </div>
                  )}
                  <div className="flex items-baseline justify-between gap-3 border-t border-ink-200 pt-2">
                    <span className="font-sans text-[13px] font-semibold text-ink-900">Precio de la lista</span>
                    <span className="font-sans text-base font-semibold tabular-nums text-ink-900">
                      {fmtMoney({ amount: finalPrice.toFixed(2), currency: 'USD' })}
                    </span>
                  </div>
                  <p className="font-sans text-[11px] text-ink-400">
                    Sobre este precio todavía actúan las condiciones comerciales y promociones vigentes.
                  </p>
                </div>
              )}

              {!previewProduct && (
                <div className="mt-3">
                  <Input placeholder="…o escribí un SKU" onBlur={(e) => setPreviewSku(e.target.value.toUpperCase())} className="font-mono" />
                </div>
              )}
            </div>
          </Card>

          <Callout tone="neutral">
            En el prototipo las listas son de sólo lectura. La estructura de datos ya soporta creación, duplicado,
            vigencias y asignación masiva de clientes.
          </Callout>

          <SectionTitle title="" className="sr-only" />
        </div>
      </div>
    </div>
  );
}
