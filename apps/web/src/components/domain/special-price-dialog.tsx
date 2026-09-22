/**
 * Solicitud de precio especial / Deal Registration.
 * Se abre desde la ficha de producto, el carrito o un pedido.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Paperclip, Tag } from 'lucide-react';
import type { Product } from '@/types';
import { api } from '@/services';
import { useSession } from '@/app/session';
import { useAction } from '@/app/hooks';
import { useToast, Dialog } from '@/components/ui/overlays';
import { addDays, fmtMoney, money, num } from '@/lib/utils';
import { Button, Field, Input, Select, Textarea } from '@/components/ui/primitives';
import { Callout } from '@/components/ui/data';

export function SpecialPriceDialog({
  open,
  onClose,
  product,
  defaultQuantity = 1,
}: {
  open: boolean;
  onClose: () => void;
  product: Product;
  defaultQuantity?: number;
}) {
  const { session } = useSession();
  const toast = useToast();
  const navigate = useNavigate();

  const [quantity, setQuantity] = useState(Math.max(defaultQuantity, 10));
  const [targetPrice, setTargetPrice] = useState(
    product.listPrice ? (num(product.listPrice) * 0.9).toFixed(2) : '0',
  );
  const [endCustomer, setEndCustomer] = useState('');
  const [project, setProject] = useState('');
  const [competitor, setCompetitor] = useState('');
  const [closeDate, setCloseDate] = useState(addDays(new Date().toISOString(), 15).slice(0, 10));
  const [comments, setComments] = useState('');
  const [attached, setAttached] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const create = useAction(async () => {
    const validation: Record<string, string> = {};
    if (!endCustomer.trim()) validation.endCustomer = 'Indicá el cliente final o el proyecto al que apunta el precio.';
    if (quantity < 1) validation.quantity = 'La cantidad debe ser mayor a cero.';
    const target = Number.parseFloat(targetPrice);
    if (!Number.isFinite(target) || target <= 0) validation.targetPrice = 'Ingresá un precio objetivo válido.';
    if (product.listPrice && target >= num(product.listPrice)) {
      validation.targetPrice = 'El precio objetivo debería ser menor a tu precio actual.';
    }
    setErrors(validation);
    if (Object.keys(validation).length > 0) throw new Error('validation');

    return api.specialPrice.create(
      {
        productId: product.id,
        sku: product.sku,
        quantity,
        targetPrice: money(target),
        endCustomer,
        project,
        competitor: competitor || null,
        expectedCloseDate: new Date(closeDate).toISOString(),
        comments,
        attachments: attached ? [{ name: attached, size: '820 KB', type: 'application/pdf' }] : [],
      },
      session,
    );
  });

  const discountPct = product.listPrice
    ? ((Number.parseFloat(targetPrice) - num(product.listPrice)) / num(product.listPrice)) * 100
    : 0;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Solicitar precio especial"
      description="La solicitud pasa por tu ejecutivo y por el Product Manager de la marca. Vas a recibir una notificación con la decisión."
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={create.pending}>
            Cancelar
          </Button>
          <Button
            loading={create.pending}
            icon={<Tag className="size-4" />}
            onClick={async () => {
              const result = await create.run();
              if (result) {
                toast.success(`Solicitud ${result.code} enviada`, 'Tu ejecutivo y el PM de la marca ya recibieron el pedido.');
                onClose();
                navigate(`/precio-especial/${result.id}`);
              }
            }}
          >
            Enviar solicitud
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-ink-200 bg-ink-50 p-3.5">
          <p className="text-[13px] font-semibold text-ink-900">{product.name}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-ink-500">
            <code className="font-mono">{product.sku}</code>
            <span>{product.brand}</span>
            <span>{product.category}</span>
            <span>
              Tu precio actual: <span className="font-semibold text-ink-800">{fmtMoney(product.listPrice)}</span>
            </span>
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Cantidad" required error={errors.quantity} htmlFor="spr-qty">
            <Input
              id="spr-qty"
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Number.parseInt(e.target.value, 10) || 1))}
              invalid={Boolean(errors.quantity)}
            />
          </Field>
          <Field
            label="Precio objetivo (USD, unitario)"
            required
            error={errors.targetPrice}
            hint={
              Number.isFinite(discountPct) && discountPct < 0
                ? `Equivale a un ${Math.abs(discountPct).toFixed(1).replace('.', ',')}% por debajo de tu precio actual.`
                : undefined
            }
            htmlFor="spr-price"
          >
            <Input
              id="spr-price"
              type="number"
              step="0.01"
              min={0}
              value={targetPrice}
              onChange={(e) => setTargetPrice(e.target.value)}
              invalid={Boolean(errors.targetPrice)}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Cliente final" required error={errors.endCustomer} htmlFor="spr-end">
            <Input
              id="spr-end"
              value={endCustomer}
              onChange={(e) => setEndCustomer(e.target.value)}
              placeholder="Municipalidad, empresa o institución"
              invalid={Boolean(errors.endCustomer)}
            />
          </Field>
          <Field label="Proyecto" htmlFor="spr-project">
            <Input
              id="spr-project"
              value={project}
              onChange={(e) => setProject(e.target.value)}
              placeholder="Renovación de parque de PCs, laboratorio, etc."
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Competencia" hint="Opcional: ayuda al PM a evaluar el caso." htmlFor="spr-comp">
            <Select id="spr-comp" value={competitor} onChange={(e) => setCompetitor(e.target.value)}>
              <option value="">Sin competencia identificada</option>
              <option value="Air Computers">Air Computers</option>
              <option value="Invid">Invid</option>
              <option value="Grupo Núcleo">Grupo Núcleo</option>
              <option value="New Bytes">New Bytes</option>
              <option value="Otro">Otro</option>
            </Select>
          </Field>
          <Field label="Fecha estimada de cierre" htmlFor="spr-date">
            <Input id="spr-date" type="date" value={closeDate} onChange={(e) => setCloseDate(e.target.value)} />
          </Field>
        </div>

        <Field label="Comentarios" hint="Contexto del negocio: plazos, volumen recurrente, condiciones del cliente final." htmlFor="spr-comments">
          <Textarea
            id="spr-comments"
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            placeholder="El cliente final pidió tres cotizaciones y define esta semana…"
          />
        </Field>

        <Field label="Archivo adjunto" hint="Pliego, cotización de la competencia o especificación técnica.">
          <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-dashed border-ink-300 px-3.5 py-3 text-[13px] text-ink-600 transition-colors hover:border-ashir-400 hover:bg-ashir-50/40">
            <Paperclip className="size-4 shrink-0 text-ink-400" aria-hidden />
            <span className="min-w-0 flex-1 truncate">{attached ?? 'Seleccionar archivo (PDF, imagen o planilla)'}</span>
            <input
              type="file"
              className="hidden"
              onChange={(e) => setAttached(e.target.files?.[0]?.name ?? null)}
            />
          </label>
        </Field>

        <Callout tone="tech">
          El precio aprobado va a tener una vigencia y una cantidad máxima. Toda la decisión queda auditada: quién
          la pidió, quién la revisó y con qué margen resultante se aprobó.
        </Callout>
      </div>
    </Dialog>
  );
}
