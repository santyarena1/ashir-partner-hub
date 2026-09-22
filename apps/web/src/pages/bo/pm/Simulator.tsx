/**
 * Simulador comercial del PM.
 *
 * Responde la pregunta concreta: si bajo el precio un X%, ¿qué pasa con el
 * margen, con la facturación y con el stock completo? Incluye sensibilidad
 * al tipo de cambio, que es el riesgo real de un importador.
 */
import { useEffect, useState } from 'react';
import { FlaskConical, TrendingDown, TrendingUp } from 'lucide-react';
import type { CommercialSimulationResult } from '@/types';
import { api } from '@/services';
import { useSession } from '@/app/session';
import { useAction } from '@/app/hooks';
import { SELLABLE_PRODUCTS, productBySku } from '@/mocks/fixtures/catalog';
import { FX_RATE_USD_ARS } from '@/mocks/fixtures/pricing';
import { can } from '@/lib/rbac';
import { CHART_COLORS } from '@/lib/labels';
import { cn, fmtMoney, fmtNumber, num } from '@/lib/utils';
import { Button, Card, CardHeader, Field, Input, Select, Skeleton } from '@/components/ui/primitives';
import { Callout, DataRow, ForbiddenState, PageHeader, StatGrid, StatTile } from '@/components/ui/data';
import { Bars, ChartFrame } from '@/components/ui/charts';

export function PmSimulator() {
  const { session } = useSession();
  const [sku, setSku] = useState('MSVG5070TV3O');
  const [discountPct, setDiscountPct] = useState(8);
  const [expectedUnits, setExpectedUnits] = useState(40);
  const [fxRate, setFxRate] = useState(FX_RATE_USD_ARS);
  const [result, setResult] = useState<CommercialSimulationResult | null>(null);

  const product = productBySku(sku);

  const simulate = useAction(async () => {
    if (!product?.listPrice || !product.cost) throw new Error('El producto no tiene precio o costo cargado.');
    const output = await api.pm.simulate({
      productId: product.id,
      cost: num(product.cost),
      currentPrice: num(product.listPrice),
      stock: product.stock,
      fxRate,
      discountPct,
      expectedUnits,
    });
    setResult(output);
    return output;
  });

  useEffect(() => {
    void simulate.run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sku, discountPct, expectedUnits, fxRate]);

  if (!can(session, 'margin:read')) {
    return (
      <Card>
        <ForbiddenState scope="margin:read" />
      </Card>
    );
  }

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'PM Cockpit', href: '/bo/pm' }, { label: 'Simulador comercial' }]}
        title="Simulador comercial"
        subtitle="Evaluá el impacto de un descuento sobre el margen, la facturación y el stock antes de lanzar una promoción."
      />

      <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        {/* ---------------- parámetros ---------------- */}
        <div className="space-y-4">
          <Card>
            <CardHeader title="Parámetros" icon={<FlaskConical className="size-4" />} />
            <div className="space-y-4 p-5">
              <Field label="Producto" htmlFor="sim-product">
                <Select id="sim-product" value={sku} onChange={(e) => setSku(e.target.value)}>
                  {SELLABLE_PRODUCTS.filter((p) => p.cost)
                    .slice(0, 100)
                    .map((p) => (
                      <option key={p.sku} value={p.sku}>
                        {p.sku} · {p.name.slice(0, 34)}
                      </option>
                    ))}
                </Select>
              </Field>

              {product && (
                <div className="space-y-0.5 rounded-lg bg-ink-50 px-3.5 py-3">
                  <DataRow label="Precio de lista" value={fmtMoney(product.listPrice)} />
                  <DataRow
                    label="Costo simulado"
                    value={
                      <span>
                        {fmtMoney(product.cost)}
                        <span className="ml-1 text-[10px] text-ink-400">sim</span>
                      </span>
                    }
                  />
                  <DataRow label="Margen actual" value={`${product.marginPct}%`} emphasis />
                  <DataRow label="Stock disponible" value={fmtNumber(product.stock)} />
                  <DataRow label="Vendidas 12 m" value={fmtNumber(product.unitsSold12m)} />
                </div>
              )}

              <Field
                label={`Descuento propuesto: ${discountPct}%`}
                hint="Sobre el precio de lista actual"
                htmlFor="sim-discount"
              >
                <input
                  id="sim-discount"
                  type="range"
                  min={0}
                  max={30}
                  step={0.5}
                  value={discountPct}
                  onChange={(e) => setDiscountPct(Number.parseFloat(e.target.value))}
                  className="w-full accent-ashir-600"
                />
              </Field>

              <Field label="Unidades esperadas" hint="Cuántas unidades creés que se venden con ese precio." htmlFor="sim-units">
                <Input
                  id="sim-units"
                  type="number"
                  min={1}
                  value={expectedUnits}
                  onChange={(e) => setExpectedUnits(Math.max(1, Number.parseInt(e.target.value, 10) || 1))}
                />
              </Field>

              <Field label="Tipo de cambio (ARS/USD)" hint="Afecta el costo de reposición." htmlFor="sim-fx">
                <Input
                  id="sim-fx"
                  type="number"
                  min={1}
                  step={1}
                  value={fxRate}
                  onChange={(e) => setFxRate(Number.parseInt(e.target.value, 10) || FX_RATE_USD_ARS)}
                />
              </Field>

              <Button className="w-full" loading={simulate.pending} onClick={() => void simulate.run()}>
                Recalcular escenario
              </Button>
            </div>
          </Card>

          <Callout tone="neutral">
            El costo usado es simulado: el archivo de distribuidor no lo incluye. En producción se tomaría del ERP,
            junto con el costo de reposición real.
          </Callout>
        </div>

        {/* ---------------- resultados ---------------- */}
        <div className="min-w-0 space-y-5">
          {simulate.pending && !result ? (
            <>
              <Skeleton className="h-28 w-full rounded-card" />
              <Skeleton className="h-64 w-full rounded-card" />
            </>
          ) : simulate.error ? (
            <Callout tone="bad" title="No pudimos simular">
              {simulate.error.message}
            </Callout>
          ) : result ? (
            <>
              <StatGrid cols={4}>
                <StatTile
                  label="Precio nuevo"
                  value={fmtMoney({ amount: result.newPrice.toFixed(2), currency: 'USD' })}
                  tone="brand"
                  footer={`Antes ${fmtMoney({ amount: result.input.currentPrice.toFixed(2), currency: 'USD' })}`}
                />
                <StatTile
                  label="Margen resultante"
                  value={`${result.marginPct.toFixed(1).replace('.', ',')}%`}
                  delta={result.marginPct - result.baseMarginPct}
                  deltaLabel="vs. escenario base"
                  tone={result.marginPct < 8 ? 'bad' : result.marginPct < 14 ? 'warn' : 'ok'}
                />
                <StatTile
                  label="Margen por unidad"
                  value={fmtMoney({ amount: result.marginUsd.toFixed(2), currency: 'USD' })}
                  footer={`Base ${fmtMoney({ amount: result.baseMarginUsd.toFixed(2), currency: 'USD' })}`}
                />
                <StatTile
                  label="Facturación estimada"
                  value={fmtMoney({ amount: result.revenueEstimate.toFixed(2), currency: 'USD' }, { compact: true })}
                  footer={`Por ${fmtNumber(result.input.expectedUnits)} unidades`}
                />
              </StatGrid>

              {result.marginPct < 8 && (
                <Callout tone="bad" icon={<TrendingDown className="size-4" />} title="Margen por debajo del piso">
                  Con un {discountPct}% de descuento el margen cae al {result.marginPct.toFixed(1).replace('.', ',')}%.
                  Considerá un descuento menor o compensarlo con volumen.
                </Callout>
              )}

              {/* --- comparación escenario base vs. propuesto --- */}
              <Card>
                <CardHeader
                  title="Escenario base vs. propuesto"
                  subtitle={`Con ${fmtNumber(result.input.expectedUnits)} unidades esperadas`}
                />
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[13px]">
                    <thead>
                      <tr className="border-b border-ink-200 bg-ink-50">
                        <th className="px-5 py-2 font-medium text-ink-500">Indicador</th>
                        <th className="px-5 py-2 text-right font-medium text-ink-500">Base</th>
                        <th className="px-5 py-2 text-right font-medium text-ink-500">Escenario</th>
                        <th className="px-5 py-2 text-right font-medium text-ink-500">Diferencia</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink-100">
                      {result.comparison.map((row) => (
                        <tr key={row.label}>
                          <td className="px-5 py-2.5 font-medium text-ink-800">{row.label}</td>
                          <td className="px-5 py-2.5 text-right tabular-nums text-ink-600">
                            {row.unit === '%' ? `${row.base.toFixed(1).replace('.', ',')}%` : fmtNumber(row.base, 2)}
                          </td>
                          <td className="px-5 py-2.5 text-right font-semibold tabular-nums text-ink-900">
                            {row.unit === '%' ? `${row.scenario.toFixed(1).replace('.', ',')}%` : fmtNumber(row.scenario, 2)}
                          </td>
                          <td
                            className={cn(
                              'px-5 py-2.5 text-right font-semibold tabular-nums',
                              row.delta > 0 ? 'text-ok-700' : row.delta < 0 ? 'text-bad-600' : 'text-ink-400',
                            )}
                          >
                            {row.delta === 0
                              ? '—'
                              : `${row.delta > 0 ? '+' : ''}${row.unit === '%' ? `${row.delta.toFixed(1).replace('.', ',')}pp` : fmtNumber(row.delta, 2)}`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              {/* --- impacto sobre el stock completo --- */}
              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader title="Impacto sobre el stock completo" icon={<TrendingUp className="size-4" />} />
                  <div className="space-y-0.5 p-5">
                    <DataRow label="Stock disponible" value={`${fmtNumber(result.input.stock)} unidades`} />
                    <DataRow
                      label="Resignación si se vende todo el stock"
                      value={
                        <span className="font-semibold text-bad-600">
                          {fmtMoney({ amount: result.fullStockImpact.toFixed(2), currency: 'USD' })}
                        </span>
                      }
                      emphasis
                    />
                    <DataRow
                      label="Sell-through del escenario"
                      value={`${result.stockSellThroughPct.toFixed(1).replace('.', ',')}% del stock`}
                    />
                    <DataRow
                      label="Unidades restantes"
                      value={fmtNumber(Math.max(0, result.input.stock - result.input.expectedUnits))}
                    />
                  </div>
                  <p className="border-t border-ink-100 px-5 py-3 text-xs leading-relaxed text-ink-500">
                    La «resignación» es la diferencia de facturación si el descuento se aplicara a todas las unidades en
                    stock, no sólo a las que esperás vender en la promoción.
                  </p>
                </Card>

                <ChartFrame
                  title="Sensibilidad al tipo de cambio"
                  subtitle="El costo de reposición sigue al dólar; el precio de venta no"
                  height={240}
                >
                  <Bars
                    data={result.fxSensitivity.map((s) => ({
                      label: `ARS ${fmtNumber(s.fxRate)}`,
                      margin: s.marginPct,
                    }))}
                    xKey="label"
                    yKey="margin"
                    colorByIndex={(row) =>
                      (row as { margin: number }).margin < 8
                        ? '#d92d20'
                        : (row as { margin: number }).margin < 14
                          ? '#f79009'
                          : CHART_COLORS[2]!
                    }
                    formatter={(v) => `${v.toFixed(1)}% de margen`}
                  />
                </ChartFrame>
              </div>

              <Card>
                <CardHeader title="Detalle de sensibilidad" subtitle="Margen resultante según variación del dólar" />
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[13px]">
                    <thead>
                      <tr className="border-b border-ink-200 bg-ink-50">
                        <th className="px-5 py-2 font-medium text-ink-500">Tipo de cambio</th>
                        <th className="px-5 py-2 text-right font-medium text-ink-500">Variación</th>
                        <th className="px-5 py-2 text-right font-medium text-ink-500">Margen %</th>
                        <th className="px-5 py-2 text-right font-medium text-ink-500">Margen por unidad</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink-100">
                      {result.fxSensitivity.map((row) => {
                        const variation = ((row.fxRate - fxRate) / fxRate) * 100;
                        return (
                          <tr key={row.fxRate} className={cn(Math.abs(variation) < 0.5 && 'bg-ashir-50/50')}>
                            <td className="px-5 py-2.5 font-medium tabular-nums text-ink-800">ARS {fmtNumber(row.fxRate)}</td>
                            <td className="px-5 py-2.5 text-right tabular-nums text-ink-500">
                              {variation === 0 ? 'actual' : `${variation > 0 ? '+' : ''}${variation.toFixed(1).replace('.', ',')}%`}
                            </td>
                            <td
                              className={cn(
                                'px-5 py-2.5 text-right font-semibold tabular-nums',
                                row.marginPct < 8 ? 'text-bad-600' : row.marginPct < 14 ? 'text-warn-700' : 'text-ok-700',
                              )}
                            >
                              {row.marginPct.toFixed(1).replace('.', ',')}%
                            </td>
                            <td className="px-5 py-2.5 text-right tabular-nums text-ink-700">
                              {fmtMoney({ amount: row.marginUsd.toFixed(2), currency: 'USD' })}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
