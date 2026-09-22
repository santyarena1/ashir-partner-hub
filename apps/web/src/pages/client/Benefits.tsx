/**
 * Programa Ashir Partner: nivel, puntos, beneficios, misiones y movimientos.
 * Cada beneficio tiene reglas, vigencia y trazabilidad.
 */
import { useState } from 'react';
import {
  Award,
  BookOpen,
  Boxes,
  Clock,
  Gift,
  Headset,
  Megaphone,
  Star,
  Truck,
  TrendingUp,
} from 'lucide-react';
import type { PartnerBenefit } from '@/types';
import { api } from '@/services';
import { useSession } from '@/app/session';
import { useAsync, useAction } from '@/app/hooks';
import { useToast, ConfirmDialog } from '@/components/ui/overlays';
import { cn, fmtDate, fmtMoney, fmtNumber, fmtRelative } from '@/lib/utils';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  ProgressBar,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/primitives';
import { Callout, DataTable, EmptyState, ErrorState, PageHeader, StatGrid, StatTile, type Column } from '@/components/ui/data';
import type { PointsLedgerEntry } from '@/types';

const CATEGORY_ICON: Record<PartnerBenefit['category'], typeof Gift> = {
  COMMERCIAL: TrendingUp,
  LOGISTICS: Truck,
  MARKETING: Megaphone,
  TRAINING: BookOpen,
  STOCK: Boxes,
  SUPPORT: Headset,
};

const CATEGORY_LABEL: Record<PartnerBenefit['category'], string> = {
  COMMERCIAL: 'Comercial',
  LOGISTICS: 'Logística',
  MARKETING: 'Marketing',
  TRAINING: 'Capacitación',
  STOCK: 'Stock',
  SUPPORT: 'Atención',
};

const TIER_STYLE = {
  SILVER: 'from-ink-400 to-ink-600',
  GOLD: 'from-warn-400 to-warn-600',
  PLATINUM: 'from-plat-400 to-plat-600',
} as const;

export function BenefitsPage() {
  const { session } = useSession();
  const toast = useToast();
  const [tab, setTab] = useState('benefits');
  const [redeeming, setRedeeming] = useState<PartnerBenefit | null>(null);

  const partner = useAsync(() => api.partner.status(session), [session.customerId]);
  const redeem = useAction((benefitId: string) => api.partner.redeem(benefitId, session));

  if (partner.error) {
    return (
      <Card>
        <ErrorState description={partner.error.message} onRetry={partner.refetch} />
      </Card>
    );
  }

  if (partner.initialLoading || !partner.data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-40 w-full rounded-card" />
        <Skeleton className="h-64 w-full rounded-card" />
      </div>
    );
  }

  const p = partner.data;
  const progress = p.tierProgress;

  const ledgerColumns: Column<PointsLedgerEntry>[] = [
    {
      key: 'at',
      header: 'Fecha',
      cell: (entry) => <span className="text-ink-600">{fmtDate(entry.at)}</span>,
      sortable: true,
      sortValue: (e) => new Date(e.at).getTime(),
    },
    {
      key: 'reason',
      header: 'Movimiento',
      cell: (entry) => (
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium text-ink-900">{entry.reason}</p>
          <p className="mt-0.5 text-[11px] text-ink-400">
            {entry.rule ?? (entry.type === 'EXPIRED' ? 'Vigencia de 12 meses desde la acreditación' : 'Movimiento manual')}
            {entry.reference && <> · ref. {entry.reference}</>}
          </p>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Tipo',
      hideOnMobile: true,
      cell: (entry) => (
        <Badge
          tone={entry.type === 'EARNED' ? 'ok' : entry.type === 'REDEEMED' ? 'tech' : entry.type === 'EXPIRED' ? 'neutral' : 'warn'}
          size="sm"
        >
          {entry.type === 'EARNED' ? 'Acreditación' : entry.type === 'REDEEMED' ? 'Canje' : entry.type === 'EXPIRED' ? 'Vencimiento' : 'Ajuste'}
        </Badge>
      ),
    },
    {
      key: 'actor',
      header: 'Registrado por',
      hideOnMobile: true,
      cell: (entry) => <span className="text-xs text-ink-500">{entry.actor}</span>,
    },
    {
      key: 'points',
      header: 'Puntos',
      align: 'right',
      cell: (entry) => (
        <span className={cn('font-semibold tabular-nums', entry.points > 0 ? 'text-ok-700' : 'text-bad-600')}>
          {entry.points > 0 ? '+' : ''}
          {fmtNumber(entry.points)}
        </span>
      ),
      sortable: true,
      sortValue: (e) => e.points,
    },
    {
      key: 'balance',
      header: 'Saldo',
      align: 'right',
      hideOnMobile: true,
      cell: (entry) => <span className="tabular-nums text-ink-600">{fmtNumber(entry.balance)}</span>,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Ashir Partner"
        subtitle="Tu nivel define condiciones comerciales, prioridad de stock y beneficios. Los puntos se acreditan por compra facturada y por misiones cumplidas."
      />

      {/* ---------- nivel y progreso ---------- */}
      <Card className="mb-6 overflow-hidden">
        <div className={cn('bg-linear-to-r px-5 py-6 text-white sm:px-7', TIER_STYLE[p.tier])}>
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="flex items-center gap-2 text-xs font-semibold tracking-wider uppercase opacity-90">
                <Award className="size-4" aria-hidden />
                Nivel actual
              </p>
              <p className="mt-1 text-3xl font-bold tracking-tight">{p.tier}</p>
              <p className="mt-1 text-[13px] opacity-90">
                {fmtNumber(p.points)} puntos disponibles
              </p>
            </div>
            <div className="min-w-[260px] flex-1">
              {progress.next ? (
                <>
                  <div className="flex items-baseline justify-between gap-3 text-[13px]">
                    <span className="opacity-90">Progreso hacia {progress.next}</span>
                    <span className="font-semibold tabular-nums">{progress.progressPct}%</span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/25">
                    <div className="h-full rounded-full bg-white transition-[width] duration-700" style={{ width: `${progress.progressPct}%` }} />
                  </div>
                  <p className="mt-1.5 text-xs opacity-90 tabular-nums">
                    {fmtMoney(progress.achieved)} de {fmtMoney(progress.required)} · el período cierra el{' '}
                    {fmtDate(progress.periodEndsAt)}
                  </p>
                </>
              ) : (
                <p className="text-[13px] opacity-90">
                  Alcanzaste el nivel máximo del programa. Mantenelo facturando{' '}
                  {fmtMoney(progress.required)} en el período; hoy acumulás {fmtMoney(progress.achieved)}.
                </p>
              )}
            </div>
          </div>
        </div>
      </Card>

      <StatGrid cols={4} className="mb-6">
        <StatTile label="Puntos disponibles" value={fmtNumber(p.points)} icon={<Star className="size-4" />} tone="plat" />
        <StatTile
          label="Puntos por vencer"
          value={fmtNumber(p.pointsExpiringSoon.points)}
          icon={<Clock className="size-4" />}
          tone="warn"
          footer={`Vencen el ${fmtDate(p.pointsExpiringSoon.expiresAt)} · ${fmtRelative(p.pointsExpiringSoon.expiresAt)}`}
        />
        <StatTile
          label="Beneficios activos"
          value={p.benefits.filter((b) => b.status === 'ACTIVE').length}
          icon={<Gift className="size-4" />}
          tone="ok"
        />
        <StatTile
          label="Misiones en curso"
          value={p.missions.filter((m) => m.status === 'IN_PROGRESS').length}
          icon={<TrendingUp className="size-4" />}
          footer={`${p.missions.filter((m) => m.status === 'COMPLETED').length} cumplidas este período`}
        />
      </StatGrid>

      {p.pointsExpiringSoon.points > 0 && (
        <Callout tone="warn" icon={<Clock className="size-4" />} className="mb-6" title="Tenés puntos por vencer">
          {fmtNumber(p.pointsExpiringSoon.points)} puntos vencen el {fmtDate(p.pointsExpiringSoon.expiresAt)}. Podés
          usarlos en cualquier beneficio disponible de tu nivel.
        </Callout>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="benefits" count={p.benefits.length}>
            Beneficios
          </TabsTrigger>
          <TabsTrigger value="missions" count={p.missions.length}>
            Misiones
          </TabsTrigger>
          <TabsTrigger value="ledger" count={p.ledger.length}>
            Movimientos
          </TabsTrigger>
          <TabsTrigger value="rules">Reglas del programa</TabsTrigger>
        </TabsList>

        {/* ---------- beneficios ---------- */}
        <TabsContent value="benefits">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {p.benefits.map((benefit) => {
              const Icon = CATEGORY_ICON[benefit.category];
              const locked = benefit.status === 'LOCKED';
              const active = benefit.status === 'ACTIVE';
              const affordable = benefit.cost === null || p.points >= benefit.cost;

              return (
                <Card key={benefit.id} className={cn('flex flex-col p-4', locked && 'opacity-70')}>
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className={cn(
                        'flex size-8 items-center justify-center rounded-lg',
                        active ? 'bg-ok-50 text-ok-600' : locked ? 'bg-ink-100 text-ink-400' : 'bg-ashir-50 text-ashir-600',
                      )}
                    >
                      <Icon className="size-4" aria-hidden />
                    </span>
                    {active ? (
                      <Badge tone="ok" dot size="sm">
                        Activo
                      </Badge>
                    ) : locked ? (
                      <Badge tone="neutral" size="sm">
                        Requiere {benefit.requiredTier}
                      </Badge>
                    ) : (
                      <Badge tone="brand" size="sm">
                        Disponible
                      </Badge>
                    )}
                  </div>

                  <h3 className="mt-3 text-[13px] font-semibold text-ink-900">{benefit.name}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-ink-500">{benefit.description}</p>

                  <p className="mt-2 text-[11px] text-ink-400">
                    {CATEGORY_LABEL[benefit.category]} · {benefit.rules}
                  </p>

                  {benefit.validUntil && active && (
                    <p className="mt-1.5 text-[11px] font-medium text-ok-700">
                      Vigente hasta el {fmtDate(benefit.validUntil)}
                    </p>
                  )}

                  <div className="mt-auto flex items-center justify-between gap-2 border-t border-ink-100 pt-3">
                    <span className="text-[13px] font-semibold tabular-nums text-ink-800">
                      {benefit.cost === null ? 'Sin costo en puntos' : `${fmtNumber(benefit.cost)} pts`}
                    </span>
                    {!active && !locked && benefit.cost !== null && (
                      <Button size="sm" variant="outline" disabled={!affordable} onClick={() => setRedeeming(benefit)}>
                        {affordable ? 'Canjear' : 'Puntos insuficientes'}
                      </Button>
                    )}
                    {!active && !locked && benefit.cost === null && (
                      <Badge tone="ok" size="sm">
                        Automático
                      </Badge>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* ---------- misiones ---------- */}
        <TabsContent value="missions">
          <div className="grid gap-3 sm:grid-cols-2">
            {p.missions.map((mission) => (
              <Card key={mission.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-[13px] font-semibold text-ink-900">{mission.name}</h3>
                    <p className="mt-1 text-xs leading-relaxed text-ink-500">{mission.description}</p>
                  </div>
                  {mission.status === 'COMPLETED' ? (
                    <Badge tone="ok" size="sm">
                      Cumplida
                    </Badge>
                  ) : (
                    <Badge tone="brand" size="sm">
                      En curso
                    </Badge>
                  )}
                </div>

                <div className="mt-3">
                  <ProgressBar
                    value={(mission.progress / mission.target) * 100}
                    tone={mission.status === 'COMPLETED' ? 'ok' : 'brand'}
                    height="lg"
                  />
                  <div className="mt-1.5 flex items-baseline justify-between gap-3 text-xs tabular-nums">
                    <span className="text-ink-600">
                      {mission.unit === 'USD'
                        ? `${fmtMoney({ amount: String(mission.progress), currency: 'USD' })} de ${fmtMoney({ amount: String(mission.target), currency: 'USD' })}`
                        : `${fmtNumber(mission.progress)} de ${fmtNumber(mission.target)} ${
                            mission.unit === 'CATEGORIES' ? 'categorías' : mission.unit === 'ORDERS' ? 'pedidos' : 'unidades'
                          }`}
                    </span>
                    <span className="text-ink-400">Cierra el {fmtDate(mission.endsAt)}</span>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-ink-100 pt-3">
                  <span className="text-xs text-ink-500">{mission.reward}</span>
                  {mission.brand && (
                    <Badge tone="neutral" size="sm">
                      {mission.brand}
                    </Badge>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ---------- movimientos ---------- */}
        <TabsContent value="ledger">
          <DataTable
            columns={ledgerColumns}
            rows={p.ledger}
            rowKey={(e) => e.id}
            dense
            empty={<EmptyState title="Sin movimientos registrados" icon={<Star className="size-5" />} />}
            mobileCard={(entry) => (
              <div>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[13px] font-medium text-ink-900">{entry.reason}</p>
                  <span className={cn('shrink-0 text-[13px] font-semibold tabular-nums', entry.points > 0 ? 'text-ok-700' : 'text-bad-600')}>
                    {entry.points > 0 ? '+' : ''}
                    {fmtNumber(entry.points)}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-ink-500">{fmtDate(entry.at)}</p>
              </div>
            )}
          />
        </TabsContent>

        {/* ---------- reglas ---------- */}
        <TabsContent value="rules">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader title="Cómo se acumulan los puntos" />
              <ul className="divide-y divide-ink-100 px-5">
                {[
                  ['Compra facturada', '1 punto cada USD 0,20 facturado y cobrado'],
                  ['Multiplicadores de marca', 'Algunas promociones duplican o triplican los puntos de ciertas categorías'],
                  ['Misiones comerciales', 'Puntos fijos al cumplir el objetivo dentro del período'],
                  ['Pronto pago', 'Bonificación adicional al pagar contado o dentro de 7 días'],
                  ['Vigencia', 'Los puntos vencen a los 12 meses de acreditados'],
                  ['Notas de crédito', 'Descuentan los puntos acreditados por el comprobante original'],
                ].map(([title, detail]) => (
                  <li key={title} className="py-3">
                    <p className="text-[13px] font-semibold text-ink-900">{title}</p>
                    <p className="mt-0.5 text-[13px] text-ink-500">{detail}</p>
                  </li>
                ))}
              </ul>
            </Card>

            <Card>
              <CardHeader title="Requisitos de cada nivel" subtitle="Compras acumuladas en el período de 12 meses" />
              <ul className="divide-y divide-ink-100 px-5">
                {(['SILVER', 'GOLD', 'PLATINUM'] as const).map((tier) => (
                  <li key={tier} className="flex items-center justify-between gap-3 py-3">
                    <div>
                      <p className="flex items-center gap-2 text-[13px] font-semibold text-ink-900">
                        {tier}
                        {tier === p.tier && (
                          <Badge tone="brand" size="sm">
                            Tu nivel
                          </Badge>
                        )}
                      </p>
                      <p className="mt-0.5 text-xs text-ink-500">
                        {tier === 'SILVER'
                          ? 'Acceso al programa, capacitaciones y envío bonificado'
                          : tier === 'GOLD'
                            ? 'Suma atención prioritaria, material POP y RMA express'
                            : 'Suma prioridad de stock, acceso anticipado y fondos de marketing'}
                      </p>
                    </div>
                    <span className="shrink-0 text-[13px] font-semibold tabular-nums text-ink-700">
                      {tier === 'SILVER' ? '—' : tier === 'GOLD' ? 'USD 180.000' : 'USD 480.000'}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="border-t border-ink-100 px-5 py-3 text-xs text-ink-500">
                Los umbrales de la demo son ilustrativos. En producción los definiría la política comercial de Ashir y
                se evaluarían contra la facturación real del ERP.
              </p>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={Boolean(redeeming)}
        onClose={() => setRedeeming(null)}
        title={`Canjear «${redeeming?.name ?? ''}»`}
        description={
          <>
            <p>{redeeming?.description}</p>
            <p className="mt-2 text-ink-800">
              Se descuentan <strong>{redeeming?.cost ? fmtNumber(redeeming.cost) : 0} puntos</strong> de tu cuenta. El
              canje queda registrado en el historial de movimientos con fecha, regla aplicada y responsable.
            </p>
            <p className="mt-2 text-xs text-ink-500">{redeeming?.rules}</p>
          </>
        }
        confirmLabel="Confirmar canje"
        loading={redeem.pending}
        onConfirm={async () => {
          if (!redeeming) return;
          const result = await redeem.run(redeeming.id);
          setRedeeming(null);
          if (result) toast.success('Beneficio activado', `«${redeeming.name}» quedó activo en tu cuenta.`);
          else if (redeem.error) toast.error('No pudimos procesar el canje', redeem.error.message);
        }}
      />
    </div>
  );
}
