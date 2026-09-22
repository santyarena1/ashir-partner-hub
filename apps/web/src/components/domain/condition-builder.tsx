/**
 * Constructor visual de condiciones comerciales.
 *
 * Arma criterios (cuándo aplica) y acciones (qué hace) sin escribir reglas
 * a mano, y muestra en lenguaje natural lo que la condición va a hacer.
 */
import { useState } from 'react';
import { ArrowRight, Plus, Trash2 } from 'lucide-react';
import type {
  CommercialCondition,
  ConditionAction,
  ConditionActionType,
  ConditionCriterion,
  ConditionScope,
} from '@/types';
import { api } from '@/services';
import { useAction } from '@/app/hooks';
import { Dialog } from '@/components/ui/overlays';
import { BRANDS, CATEGORIES } from '@/mocks/fixtures/catalog';
import { CUSTOMERS } from '@/mocks/fixtures/customers';
import { PRICE_LISTS } from '@/mocks/fixtures/pricing';
import { CONDITION_ACTION, CONDITION_SCOPE, OPERATOR_LABEL, PAYMENT_TERM } from '@/lib/labels';
import { addDays } from '@/lib/utils';
import { Badge, Button, Checkbox, Field, Input, Segmented, Select, Textarea } from '@/components/ui/primitives';
import { Callout } from '@/components/ui/data';

/** Qué operadores tienen sentido para cada alcance. */
const OPERATORS_BY_SCOPE: Record<ConditionScope, ConditionCriterion['operator'][]> = {
  BRAND: ['IS', 'IN', 'IS_NOT'],
  CATEGORY: ['IS', 'IN', 'IS_NOT'],
  SUBCATEGORY: ['IS', 'IN'],
  PRODUCT: ['IS', 'IN', 'IS_NOT'],
  CUSTOMER: ['IS', 'IN'],
  SEGMENT: ['IS', 'IN'],
  PRICE_LIST: ['IS', 'IN'],
  ZONE: ['IS', 'IN'],
  QUANTITY: ['GTE', 'LTE', 'BETWEEN'],
  AMOUNT: ['GTE', 'LTE'],
  PAYMENT: ['IN', 'IS'],
  DATE: ['BETWEEN'],
};

const ZONES = ['CABA', 'AMBA', 'Interior Norte', 'Interior Sur'];
const SEGMENTS = ['SILVER', 'GOLD', 'PLATINUM'];

function optionsFor(scope: ConditionScope): { value: string; label: string }[] {
  switch (scope) {
    case 'BRAND':
      return BRANDS.map((b) => ({ value: b.name, label: `${b.name} (${b.skuCount} SKUs)` }));
    case 'CATEGORY':
      return CATEGORIES.map((c) => ({ value: c.name, label: `${c.name} (${c.skuCount})` }));
    case 'SUBCATEGORY':
      return CATEGORIES.flatMap((c) => c.subcategories).map((s) => ({ value: s, label: s }));
    case 'CUSTOMER':
      return CUSTOMERS.map((c) => ({ value: c.id, label: c.tradeName }));
    case 'SEGMENT':
      return SEGMENTS.map((s) => ({ value: s, label: s }));
    case 'PRICE_LIST':
      return PRICE_LISTS.map((l) => ({ value: l.id, label: l.code }));
    case 'ZONE':
      return ZONES.map((z) => ({ value: z, label: z }));
    case 'PAYMENT':
      return (Object.keys(PAYMENT_TERM) as (keyof typeof PAYMENT_TERM)[]).map((k) => ({
        value: k,
        label: PAYMENT_TERM[k].label,
      }));
    default:
      return [];
  }
}

export function ConditionBuilderDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (condition: CommercialCondition) => void;
}) {
  const [kind, setKind] = useState<'CONDITION' | 'PROMOTION'>('PROMOTION');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [criteria, setCriteria] = useState<ConditionCriterion[]>([
    { scope: 'BRAND', operator: 'IS', values: ['MSI'], label: 'Marca es MSI' },
  ]);
  const [actions, setActions] = useState<ConditionAction[]>([
    { type: 'DISCOUNT_PCT', value: '3.00', label: 'Descuento adicional 3%' },
  ]);
  const [validFrom, setValidFrom] = useState(new Date().toISOString().slice(0, 10));
  const [validTo, setValidTo] = useState(addDays(new Date().toISOString(), 30).slice(0, 10));
  const [priority, setPriority] = useState(20);
  const [stackable, setStackable] = useState(true);
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [usageLimit, setUsageLimit] = useState('');
  const [exclusions, setExclusions] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const create = useAction(async () => {
    const validation: Record<string, string> = {};
    if (!name.trim()) validation.name = 'Ponele un nombre reconocible para el equipo comercial.';
    if (criteria.length === 0) validation.criteria = 'Agregá al menos un criterio.';
    if (actions.length === 0) validation.actions = 'Agregá al menos una acción.';
    setErrors(validation);
    if (Object.keys(validation).length > 0) throw new Error('validation');

    return api.pricing.createCondition({
      name,
      code: code || name.toUpperCase().replace(/\s+/g, '-').slice(0, 14),
      description,
      criteria,
      actions,
      validFrom: new Date(validFrom).toISOString(),
      validTo: new Date(`${validTo}T23:59:59`).toISOString(),
      priority,
      stackable,
      requiresApproval,
      usageLimit: usageLimit ? Number.parseInt(usageLimit, 10) : null,
      exclusions: exclusions
        .split(/[\s,;]+/)
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean),
      kind,
      status: 'DRAFT',
    });
  });

  const updateCriterion = (index: number, patch: Partial<ConditionCriterion>) => {
    setCriteria((prev) =>
      prev.map((criterion, i) => {
        if (i !== index) return criterion;
        const next = { ...criterion, ...patch };
        // El label se regenera para que la vista previa sea legible.
        next.label = `${CONDITION_SCOPE[next.scope]} ${OPERATOR_LABEL[next.operator] ?? next.operator} ${next.values.join(', ')}`;
        return next;
      }),
    );
  };

  /** Resumen en lenguaje natural de lo que hace la condición. */
  const plainLanguage = () => {
    const when = criteria
      .map((c) => `${CONDITION_SCOPE[c.scope].toLowerCase()} ${OPERATOR_LABEL[c.operator] ?? c.operator} ${c.values.join(' o ')}`)
      .join(' y ');
    const then = actions.map((a) => a.label.toLowerCase()).join(' y ');
    return `Cuando ${when || '…'}, entonces ${then || '…'}.`;
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Nueva condición comercial"
      description="Definí cuándo aplica y qué hace. Se crea en estado borrador: no afecta ningún precio hasta que la actives."
      size="xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={create.pending}>
            Cancelar
          </Button>
          <Button
            loading={create.pending}
            onClick={async () => {
              const result = await create.run();
              if (result) {
                onCreated(result);
                onClose();
              }
            }}
          >
            Crear condición
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {/* ---------- identificación ---------- */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tipo">
            <Segmented
              value={kind}
              onChange={setKind}
              options={[
                { value: 'PROMOTION', label: 'Promoción' },
                { value: 'CONDITION', label: 'Condición permanente' },
              ]}
            />
          </Field>
          <Field label="Prioridad" hint="Menor número = se evalúa primero." htmlFor="cb-priority">
            <Input
              id="cb-priority"
              type="number"
              min={1}
              max={999}
              value={priority}
              onChange={(e) => setPriority(Number.parseInt(e.target.value, 10) || 20)}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre" required error={errors.name} htmlFor="cb-name">
            <Input
              id="cb-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="MSI Octubre"
              invalid={Boolean(errors.name)}
            />
          </Field>
          <Field label="Código" hint="Se genera del nombre si lo dejás vacío." htmlFor="cb-code">
            <Input
              id="cb-code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="MSI-OCT-26"
              className="font-mono"
            />
          </Field>
        </div>

        <Field label="Descripción" htmlFor="cb-desc">
          <Textarea
            id="cb-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="Descuento adicional sobre marca MSI para clientes Gold y Platinum con compra mínima…"
          />
        </Field>

        {/* ---------- criterios ---------- */}
        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <h3 className="text-[13px] font-semibold text-ink-900">Aplica cuando</h3>
            <Button
              size="sm"
              variant="outline"
              icon={<Plus className="size-3.5" />}
              onClick={() =>
                setCriteria((prev) => [
                  ...prev,
                  { scope: 'QUANTITY', operator: 'GTE', values: ['10'], label: 'Cantidad ≥ 10' },
                ])
              }
            >
              Agregar criterio
            </Button>
          </div>
          {errors.criteria && <p className="mb-2 text-xs font-medium text-bad-600">{errors.criteria}</p>}

          <ul className="space-y-2">
            {criteria.map((criterion, index) => {
              const options = optionsFor(criterion.scope);
              const numeric = ['QUANTITY', 'AMOUNT'].includes(criterion.scope);
              return (
                <li key={index} className="flex flex-wrap items-start gap-2 rounded-lg border border-ink-200 bg-ink-50 p-2.5">
                  <Select
                    value={criterion.scope}
                    onChange={(e) => {
                      const scope = e.target.value as ConditionScope;
                      const operator = OPERATORS_BY_SCOPE[scope][0]!;
                      const defaults = optionsFor(scope);
                      updateCriterion(index, {
                        scope,
                        operator,
                        values: defaults.length > 0 ? [defaults[0]!.value] : ['10'],
                      });
                    }}
                    className="h-8 w-auto min-w-[140px] text-[13px]"
                    aria-label="Alcance del criterio"
                  >
                    {(Object.keys(CONDITION_SCOPE) as ConditionScope[]).map((scope) => (
                      <option key={scope} value={scope}>
                        {CONDITION_SCOPE[scope]}
                      </option>
                    ))}
                  </Select>

                  <Select
                    value={criterion.operator}
                    onChange={(e) => updateCriterion(index, { operator: e.target.value as ConditionCriterion['operator'] })}
                    className="h-8 w-auto min-w-[90px] text-[13px]"
                    aria-label="Operador"
                  >
                    {OPERATORS_BY_SCOPE[criterion.scope].map((op) => (
                      <option key={op} value={op}>
                        {OPERATOR_LABEL[op] ?? op}
                      </option>
                    ))}
                  </Select>

                  {numeric ? (
                    <Input
                      type="number"
                      min={0}
                      value={criterion.values[0] ?? ''}
                      onChange={(e) => updateCriterion(index, { values: [e.target.value] })}
                      className="h-8 w-28 text-[13px]"
                      aria-label="Valor"
                    />
                  ) : (
                    <Select
                      value={criterion.values[0] ?? ''}
                      onChange={(e) => updateCriterion(index, { values: [e.target.value] })}
                      className="h-8 w-auto min-w-[160px] text-[13px]"
                      aria-label="Valor"
                    >
                      {options.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </Select>
                  )}

                  <button
                    type="button"
                    onClick={() => setCriteria((prev) => prev.filter((_, i) => i !== index))}
                    className="ml-auto rounded p-1.5 text-ink-400 transition-colors hover:bg-bad-50 hover:text-bad-600"
                    aria-label="Quitar criterio"
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* ---------- acciones ---------- */}
        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <h3 className="text-[13px] font-semibold text-ink-900">Entonces</h3>
            <Button
              size="sm"
              variant="outline"
              icon={<Plus className="size-3.5" />}
              onClick={() =>
                setActions((prev) => [...prev, { type: 'FREE_FREIGHT', value: '100', label: 'Envío bonificado 100%' }])
              }
            >
              Agregar acción
            </Button>
          </div>
          {errors.actions && <p className="mb-2 text-xs font-medium text-bad-600">{errors.actions}</p>}

          <ul className="space-y-2">
            {actions.map((action, index) => (
              <li key={index} className="flex flex-wrap items-center gap-2 rounded-lg border border-ashir-200 bg-ashir-50/60 p-2.5">
                <Select
                  value={action.type}
                  onChange={(e) => {
                    const type = e.target.value as ConditionActionType;
                    setActions((prev) =>
                      prev.map((a, i) =>
                        i === index
                          ? {
                              type,
                              value: type === 'BONUS_UNITS' ? '1' : type === 'POINTS_MULTIPLIER' ? '2' : '3.00',
                              label: CONDITION_ACTION[type],
                            }
                          : a,
                      ),
                    );
                  }}
                  className="h-8 w-auto min-w-[190px] text-[13px]"
                  aria-label="Tipo de acción"
                >
                  {(Object.keys(CONDITION_ACTION) as ConditionActionType[]).map((type) => (
                    <option key={type} value={type}>
                      {CONDITION_ACTION[type]}
                    </option>
                  ))}
                </Select>

                {!['FREE_FREIGHT', 'STOCK_PRIORITY', 'TIERED_PRICE'].includes(action.type) && (
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    value={action.value}
                    onChange={(e) =>
                      setActions((prev) =>
                        prev.map((a, i) =>
                          i === index
                            ? {
                                ...a,
                                value: e.target.value,
                                label: `${CONDITION_ACTION[a.type]} ${e.target.value}${a.type === 'DISCOUNT_PCT' ? '%' : ''}`,
                              }
                            : a,
                        ),
                      )
                    }
                    className="h-8 w-24 text-[13px]"
                    aria-label="Valor de la acción"
                  />
                )}

                <span className="text-xs text-ink-500">{action.label}</span>

                <button
                  type="button"
                  onClick={() => setActions((prev) => prev.filter((_, i) => i !== index))}
                  className="ml-auto rounded p-1.5 text-ink-400 transition-colors hover:bg-bad-50 hover:text-bad-600"
                  aria-label="Quitar acción"
                >
                  <Trash2 className="size-3.5" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* ---------- propiedades ---------- */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Vigente desde" htmlFor="cb-from">
            <Input id="cb-from" type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
          </Field>
          <Field label="Vigente hasta" htmlFor="cb-to">
            <Input id="cb-to" type="date" value={validTo} onChange={(e) => setValidTo(e.target.value)} />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Límite de usos" hint="Vacío = sin límite." htmlFor="cb-limit">
            <Input
              id="cb-limit"
              type="number"
              min={1}
              value={usageLimit}
              onChange={(e) => setUsageLimit(e.target.value)}
              placeholder="Sin límite"
            />
          </Field>
          <Field label="SKUs excluidos" hint="Separados por coma o espacio." htmlFor="cb-excl">
            <Input
              id="cb-excl"
              value={exclusions}
              onChange={(e) => setExclusions(e.target.value)}
              placeholder="MSVG5070TV3O"
              className="font-mono"
            />
          </Field>
        </div>

        <div className="space-y-2.5 rounded-lg border border-ink-200 p-3.5">
          <Checkbox
            label="Acumulable con otras condiciones"
            description="Si se desactiva, esta condición descarta los descuentos de menor prioridad."
            checked={stackable}
            onChange={(e) => setStackable(e.target.checked)}
          />
          <Checkbox
            label="Requiere aprobación"
            description="Los pedidos que la apliquen quedan pendientes de autorización del Product Manager."
            checked={requiresApproval}
            onChange={(e) => setRequiresApproval(e.target.checked)}
          />
        </div>

        {/* ---------- vista previa ---------- */}
        <Callout tone="tech" title="Vista previa de la regla">
          <p className="leading-relaxed">{plainLanguage()}</p>
          <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
            <Badge tone="neutral" size="sm">
              Prioridad {priority}
            </Badge>
            <ArrowRight className="size-3" aria-hidden />
            <Badge tone={stackable ? 'ok' : 'warn'} size="sm">
              {stackable ? 'Acumulable' : 'Exclusiva'}
            </Badge>
            {requiresApproval && (
              <Badge tone="warn" size="sm">
                Requiere aprobación
              </Badge>
            )}
          </p>
        </Callout>
      </div>
    </Dialog>
  );
}
