/**
 * Administración del programa Ashir Partner.
 */
import { Link } from 'react-router-dom';
import { Award, Gift, Star, Target, Users } from 'lucide-react';
import type { Customer } from '@/types';
import { api } from '@/services';
import { useAsync } from '@/app/hooks';
import { useToast } from '@/components/ui/overlays';
import { PARTNER_BENEFITS, TIER_REQUIREMENT, partnerStatusFor } from '@/mocks/fixtures/commerce';
import { CHART_COLORS } from '@/lib/labels';
import { cn, fmtMoney, fmtNumber, num } from '@/lib/utils';
import { Badge, Button, Card, CardHeader, ProgressBar } from '@/components/ui/primitives';
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
import { Donut, ChartFrame, Bars } from '@/components/ui/charts';
import { SegmentBadge } from '@/components/domain/common';

export function BoPartner() {
  const toast = useToast();
  const customers = useAsync(() => api.customers.list({}), []);

  const list = (customers.data ?? []).filter((c) => c.status !== 'PROSPECT');
  const totalPoints = list.reduce((a, c) => a + c.points, 0);
  const byTier = (['PLATINUM', 'GOLD', 'SILVER'] as const).map((tier) => ({
    tier,
    count: list.filter((c) => c.partnerTier === tier).length,
    points: list.filter((c) => c.partnerTier === tier).reduce((a, c) => a + c.points, 0),
  }));

  const columns: Column<Customer>[] = [
    {
      key: 'customer',
      header: 'Cliente',
      cell: (c) => (
        <div className="min-w-0">
          <Link to={`/bo/clientes/${c.id}`} className="truncate text-[13px] font-semibold text-ashir-600 hover:text-ashir-700">
            {c.tradeName}
          </Link>
          <p className="text-[11px] text-ink-400">{c.code}</p>
        </div>
      ),
    },
    { key: 'tier', header: 'Nivel', cell: (c) => <SegmentBadge segment={c.partnerTier} size="sm" /> },
    {
      key: 'points',
      header: 'Puntos',
      align: 'right',
      cell: (c) => <span className="font-semibold tabular-nums text-ink-900">{fmtNumber(c.points)}</span>,
      sortable: true,
      sortValue: (c) => c.points,
    },
    {
      key: 'purchases',
      header: 'Compras 12 m',
      align: 'right',
      cell: (c) => <span className="tabular-nums text-ink-700">{fmtMoney(c.purchases12m, { compact: true })}</span>,
      sortable: true,
      sortValue: (c) => num(c.purchases12m),
    },
    {
      key: 'progress',
      header: 'Progreso al siguiente nivel',
      cell: (c) => {
        const status = partnerStatusFor(c.id);
        if (!status.tierProgress.next) {
          return (
            <Badge tone="plat" size="sm">
              Nivel máximo
            </Badge>
          );
        }
        return (
          <div className="min-w-[140px]">
            <ProgressBar value={status.tierProgress.progressPct} tone="plat" />
            <p className="mt-1 text-[11px] tabular-nums text-ink-500">
              {status.tierProgress.progressPct}% hacia {status.tierProgress.next}
            </p>
          </div>
        );
      },
    },
    {
      key: 'benefits',
      header: 'Beneficios activos',
      align: 'right',
      hideOnMobile: true,
      cell: (c) => {
        const status = partnerStatusFor(c.id);
        return <span className="tabular-nums text-ink-600">{status.benefits.filter((b) => b.status === 'ACTIVE').length}</span>;
      },
    },
  ];

  return (
    <div>
      <PageHeader
        title="Programa Ashir Partner"
        subtitle="Niveles, puntos y beneficios de los resellers. Toda acreditación o canje tiene regla, vigencia y auditoría."
        actions={
          <Button variant="outline" onClick={() => toast.simulated('La configuración del programa')}>
            Configurar programa
          </Button>
        }
      />

      <StatGrid cols={5} className="mb-6">
        <StatTile label="Clientes en el programa" value={list.length} icon={<Users className="size-4" />} />
        <StatTile label="Puntos en circulación" value={fmtNumber(totalPoints)} icon={<Star className="size-4" />} tone="plat" />
        <StatTile label="Beneficios disponibles" value={PARTNER_BENEFITS.length} icon={<Gift className="size-4" />} />
        <StatTile
          label="Clientes Platinum"
          value={byTier[0]!.count}
          icon={<Award className="size-4" />}
          footer={`${byTier[1]!.count} Gold · ${byTier[2]!.count} Silver`}
        />
        <StatTile
          label="Compras del programa"
          value={fmtMoney({ amount: list.reduce((a, c) => a + num(c.purchases12m), 0).toFixed(2), currency: 'USD' }, { compact: true })}
          icon={<Target className="size-4" />}
        />
      </StatGrid>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <ChartFrame title="Distribución por nivel" subtitle="Cantidad de clientes en cada segmento" height={240}>
          <Donut
            data={byTier.map((t) => ({ tier: t.tier, count: t.count }))}
            nameKey="tier"
            valueKey="count"
            colors={[CHART_COLORS[3]!, CHART_COLORS[4]!, CHART_COLORS[5]!]}
            formatter={(v) => `${v} clientes`}
          />
        </ChartFrame>
        <ChartFrame title="Puntos acumulados por nivel" height={240}>
          <Bars
            data={byTier.map((t) => ({ tier: t.tier, points: t.points }))}
            xKey="tier"
            yKey="points"
            colorByIndex={(_, i) => [CHART_COLORS[3]!, CHART_COLORS[4]!, CHART_COLORS[5]!][i]!}
            formatter={(v) => `${fmtNumber(v)} puntos`}
          />
        </ChartFrame>
      </div>

      <SectionTitle title="Clientes del programa" subtitle="Nivel actual, puntos y progreso del período" />
      <DataTable
        columns={columns}
        rows={list}
        rowKey={(c) => c.id}
        loading={customers.initialLoading}
        dense
        empty={<EmptyState title="Sin clientes en el programa" icon={<Award className="size-5" />} />}
      />

      {/* ---------- catálogo de beneficios ---------- */}
      <section className="mt-8">
        <SectionTitle title="Catálogo de beneficios" subtitle="Reglas, costo en puntos y nivel requerido" />
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-ink-200 bg-ink-50">
                  <th className="px-5 py-2 font-medium text-ink-500">Beneficio</th>
                  <th className="px-5 py-2 font-medium text-ink-500">Categoría</th>
                  <th className="px-5 py-2 font-medium text-ink-500">Nivel requerido</th>
                  <th className="px-5 py-2 text-right font-medium text-ink-500">Costo</th>
                  <th className="px-5 py-2 font-medium text-ink-500">Reglas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {PARTNER_BENEFITS.map((benefit) => (
                  <tr key={benefit.id}>
                    <td className="px-5 py-2.5">
                      <p className="font-medium text-ink-900">{benefit.name}</p>
                      <p className="mt-0.5 max-w-sm text-[11px] text-ink-500">{benefit.description}</p>
                    </td>
                    <td className="px-5 py-2.5 text-xs text-ink-600">
                      {benefit.category === 'COMMERCIAL'
                        ? 'Comercial'
                        : benefit.category === 'LOGISTICS'
                          ? 'Logística'
                          : benefit.category === 'MARKETING'
                            ? 'Marketing'
                            : benefit.category === 'TRAINING'
                              ? 'Capacitación'
                              : benefit.category === 'STOCK'
                                ? 'Stock'
                                : 'Atención'}
                    </td>
                    <td className="px-5 py-2.5">
                      <SegmentBadge segment={benefit.requiredTier} size="sm" />
                    </td>
                    <td className="px-5 py-2.5 text-right tabular-nums text-ink-700">
                      {benefit.cost === null ? <span className="text-ok-700">Automático</span> : `${fmtNumber(benefit.cost)} pts`}
                    </td>
                    <td className="max-w-xs px-5 py-2.5 text-xs text-ink-500">{benefit.rules}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      {/* ---------- reglas de niveles ---------- */}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Umbrales de nivel" subtitle="Compras acumuladas en 12 meses" />
          <ul className="divide-y divide-ink-100 px-5">
            {(['SILVER', 'GOLD', 'PLATINUM'] as const).map((tier) => (
              <li key={tier} className="flex items-center justify-between gap-3 py-3">
                <div className="flex items-center gap-2.5">
                  <SegmentBadge segment={tier} size="sm" />
                  <span className="text-[13px] text-ink-600">
                    {list.filter((c) => c.partnerTier === tier).length} clientes
                  </span>
                </div>
                <span className="text-[13px] font-semibold tabular-nums text-ink-800">
                  {TIER_REQUIREMENT[tier] === 0
                    ? 'Sin mínimo'
                    : fmtMoney({ amount: String(TIER_REQUIREMENT[tier]), currency: 'USD' })}
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader title="Reglas de acumulación" />
          <ul className="space-y-2 px-5 py-4 text-[13px] leading-relaxed text-ink-600">
            {[
              '1 punto cada USD 0,20 facturado y cobrado.',
              'Multiplicadores por promoción de marca (hasta x3).',
              'Puntos fijos al completar misiones dentro del período.',
              'Los puntos vencen a los 12 meses de acreditados.',
              'Las notas de crédito descuentan los puntos del comprobante original.',
              'Todo movimiento queda registrado con su regla, su referencia y su responsable.',
            ].map((rule) => (
              <li key={rule} className="flex gap-2">
                <span className={cn('mt-1.5 size-1.5 shrink-0 rounded-full bg-plat-500')} aria-hidden />
                {rule}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Callout tone="neutral" className="mt-6">
        Los umbrales y las reglas de esta pantalla son ilustrativos. En producción los definiría la política comercial
        de Ashir y se evaluarían contra la facturación real del ERP.
      </Callout>
    </div>
  );
}
