/**
 * Quick Order: carga masiva de pedido.
 *
 * Pegar SKU + cantidad, agregar filas a mano o importar CSV/XLSX.
 * Valida cada SKU, informa faltantes de stock y propone reemplazos.
 */
import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardPaste,
  FileSpreadsheet,
  Plus,
  ShoppingCart,
  Trash2,
  Upload,
  XCircle,
} from 'lucide-react';
import type { PriceEvaluation, Product } from '@/types';
import { api } from '@/services';
import { useSession } from '@/app/session';
import { useAction } from '@/app/hooks';
import { useCart } from '@/app/cart';
import { useToast } from '@/components/ui/overlays';
import { productBySku, replacementsFor } from '@/mocks/fixtures/catalog';
import { cn, fmtMoney, fmtNumber, num } from '@/lib/utils';
import { Badge, Button, Card, CardHeader, Input, Tabs, TabsContent, TabsList, TabsTrigger, Textarea } from '@/components/ui/primitives';
import { Callout, DataTable, EmptyState, PageHeader, type Column } from '@/components/ui/data';

type LineStatus = 'OK' | 'LOW_STOCK' | 'NO_STOCK' | 'NO_PRICE' | 'NOT_FOUND';

interface QuickLine {
  id: string;
  rawSku: string;
  quantity: number;
  product: Product | null;
  evaluation: PriceEvaluation | null;
  status: LineStatus;
  message: string;
}

const EXAMPLE = `MSVG5070TV3O    4
MSMOPRB650MB   10
TTGACE300TGB   12
ADRAD16G4320    6`;

export function QuickOrder() {
  const { session } = useSession();
  const cart = useCart();
  const toast = useToast();
  const [tab, setTab] = useState('paste');
  const [pasted, setPasted] = useState('');
  const [lines, setLines] = useState<QuickLine[]>([]);
  const [manualSku, setManualSku] = useState('');
  const [manualQty, setManualQty] = useState(1);
  const fileRef = useRef<HTMLInputElement>(null);

  /* ---------------- resolución de líneas ---------------- */

  const resolve = useAction(async (entries: { sku: string; quantity: number }[]) => {
    const resolved: QuickLine[] = [];

    for (const [index, entry] of entries.entries()) {
      const product = productBySku(entry.sku);
      const id = `ql_${Date.now()}_${index}`;

      if (!product) {
        resolved.push({
          id,
          rawSku: entry.sku,
          quantity: entry.quantity,
          product: null,
          evaluation: null,
          status: 'NOT_FOUND',
          message: 'No existe en el catálogo. Verificá el código interno.',
        });
        continue;
      }

      if (!product.listPrice) {
        resolved.push({
          id,
          rawSku: entry.sku,
          quantity: entry.quantity,
          product,
          evaluation: null,
          status: 'NO_PRICE',
          message: 'Sin precio publicado: requiere consulta al ejecutivo.',
        });
        continue;
      }

      const evaluation = await api.pricing.evaluate(product.id, entry.quantity, session);
      let status: LineStatus = 'OK';
      let message = '';

      if (product.stock === 0) {
        status = 'NO_STOCK';
        message = product.incoming
          ? `Sin stock. Próximo ingreso de ${fmtNumber(product.incoming.units)} unidades en ${product.incoming.etaDays} días.`
          : 'Sin stock disponible.';
      } else if (entry.quantity > product.stock) {
        status = 'LOW_STOCK';
        message = `Solo hay ${product.stock} unidades. Las ${entry.quantity - product.stock} restantes quedan pendientes.`;
      }

      resolved.push({ id, rawSku: entry.sku, quantity: entry.quantity, product, evaluation, status, message });
    }

    setLines((prev) => [...prev, ...resolved]);
    return resolved;
  });

  const parsePasted = () => {
    const entries = pasted
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const parts = line.split(/[\s,;\t]+/).filter(Boolean);
        const sku = parts[0] ?? '';
        const quantity = Math.max(1, Number.parseInt(parts[1] ?? '1', 10) || 1);
        return { sku, quantity };
      })
      .filter((e) => e.sku);

    if (entries.length === 0) {
      toast.warning('No encontramos líneas válidas', 'Cada renglón debe tener un SKU y, opcionalmente, una cantidad.');
      return;
    }
    void resolve.run(entries);
    setPasted('');
  };

  const handleFile = async (file: File) => {
    try {
      // SheetJS pesa ~900 kB: se carga solo cuando el usuario importa una planilla.
      const XLSX = await import('xlsx');
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer);
      const sheet = workbook.Sheets[workbook.SheetNames[0]!];
      if (!sheet) throw new Error('El archivo no tiene hojas legibles.');

      const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, { header: 1, defval: null });
      const entries: { sku: string; quantity: number }[] = [];

      for (const row of rows) {
        if (!row || row.length === 0) continue;
        const first = String(row[0] ?? '').trim();
        if (!first) continue;
        // Ignora encabezados típicos.
        if (/^(sku|codigo|código|cod|producto|item)/i.test(first)) continue;
        const quantity = Math.max(1, Number.parseInt(String(row[1] ?? '1'), 10) || 1);
        entries.push({ sku: first, quantity });
      }

      if (entries.length === 0) {
        toast.warning('No pudimos leer líneas del archivo', 'Se espera una columna con el SKU y otra con la cantidad.');
        return;
      }
      await resolve.run(entries);
      toast.success(`${entries.length} líneas leídas de ${file.name}`);
    } catch (error) {
      toast.error('No pudimos leer el archivo', error instanceof Error ? error.message : undefined);
    }
  };

  /* ---------------- totales ---------------- */

  const summary = useMemo(() => {
    const valid = lines.filter((l) => l.status === 'OK' || l.status === 'LOW_STOCK');
    const subtotal = valid.reduce((acc, l) => acc + num(l.evaluation?.lineTotal), 0);
    return {
      valid: valid.length,
      issues: lines.filter((l) => l.status === 'NOT_FOUND' || l.status === 'NO_PRICE' || l.status === 'NO_STOCK').length,
      units: valid.reduce((acc, l) => acc + l.quantity, 0),
      subtotal,
    };
  }, [lines]);

  const columns: Column<QuickLine>[] = [
    {
      key: 'status',
      header: '',
      width: '40px',
      cell: (line) =>
        line.status === 'OK' ? (
          <CheckCircle2 className="size-4 text-ok-500" aria-label="Válido" />
        ) : line.status === 'LOW_STOCK' ? (
          <AlertTriangle className="size-4 text-warn-500" aria-label="Stock parcial" />
        ) : (
          <XCircle className="size-4 text-bad-500" aria-label="Con problema" />
        ),
    },
    {
      key: 'sku',
      header: 'SKU',
      cell: (line) => (
        <div className="min-w-0">
          <code className="font-mono text-[12px] font-medium text-ink-900">{line.rawSku}</code>
          {line.product ? (
            <p className="mt-0.5 truncate text-xs text-ink-500">
              {line.product.brand} · {line.product.name}
            </p>
          ) : (
            <p className="mt-0.5 text-xs text-bad-600">Código no reconocido</p>
          )}
        </div>
      ),
    },
    {
      key: 'qty',
      header: 'Cantidad',
      align: 'right',
      width: '110px',
      cell: (line) => (
        <Input
          type="number"
          min={1}
          value={line.quantity}
          onChange={async (e) => {
            const quantity = Math.max(1, Number.parseInt(e.target.value, 10) || 1);
            setLines((prev) => prev.map((l) => (l.id === line.id ? { ...l, quantity } : l)));
            if (line.product?.listPrice) {
              const evaluation = await api.pricing.evaluate(line.product.id, quantity, session);
              setLines((prev) =>
                prev.map((l) =>
                  l.id === line.id
                    ? {
                        ...l,
                        evaluation,
                        status: quantity > l.product!.stock && l.product!.stock > 0 ? 'LOW_STOCK' : l.product!.stock === 0 ? 'NO_STOCK' : 'OK',
                        message:
                          quantity > l.product!.stock && l.product!.stock > 0
                            ? `Solo hay ${l.product!.stock} unidades. Las ${quantity - l.product!.stock} restantes quedan pendientes.`
                            : '',
                      }
                    : l,
                ),
              );
            }
          }}
          className="h-8 w-[84px] text-right text-[13px]"
          aria-label={`Cantidad de ${line.rawSku}`}
        />
      ),
    },
    {
      key: 'stock',
      header: 'Stock',
      align: 'right',
      hideOnMobile: true,
      cell: (line) =>
        line.product ? (
          <span className={cn('tabular-nums', line.product.stock === 0 ? 'text-bad-600' : line.product.stock <= 8 ? 'text-warn-700' : 'text-ink-600')}>
            {fmtNumber(line.product.stock)}
          </span>
        ) : (
          <span className="text-ink-400">—</span>
        ),
    },
    {
      key: 'price',
      header: 'Tu precio',
      align: 'right',
      cell: (line) =>
        line.evaluation ? (
          <div>
            <p className="font-semibold tabular-nums text-ink-900">{fmtMoney(line.evaluation.finalUnitPrice)}</p>
            {Number.parseFloat(line.evaluation.totalDiscountPct) < -0.01 && (
              <p className="text-[11px] text-ok-700">{Number.parseFloat(line.evaluation.totalDiscountPct).toFixed(1).replace('.', ',')}%</p>
            )}
          </div>
        ) : (
          <span className="text-ink-400">—</span>
        ),
    },
    {
      key: 'total',
      header: 'Subtotal',
      align: 'right',
      cell: (line) =>
        line.evaluation ? (
          <span className="font-semibold tabular-nums text-ink-900">{fmtMoney(line.evaluation.lineTotal)}</span>
        ) : (
          <span className="text-ink-400">—</span>
        ),
    },
    {
      key: 'remove',
      header: '',
      width: '44px',
      cell: (line) => (
        <button
          type="button"
          onClick={() => setLines((prev) => prev.filter((l) => l.id !== line.id))}
          className="rounded p-1 text-ink-400 transition-colors hover:bg-bad-50 hover:text-bad-600"
          aria-label={`Quitar ${line.rawSku}`}
        >
          <Trash2 className="size-3.5" aria-hidden />
        </button>
      ),
    },
  ];

  const problemLines = lines.filter((l) => l.status !== 'OK');

  return (
    <div>
      <PageHeader
        title="Compra rápida"
        subtitle="Cargá un pedido completo pegando tu lista, tipeando códigos o importando una planilla. Validamos SKU, stock y precio antes de pasarlo al carrito."
        actions={
          lines.length > 0 && (
            <Button variant="ghost" icon={<Trash2 className="size-4" />} onClick={() => setLines([])}>
              Limpiar todo
            </Button>
          )
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-5">
          <Card>
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="px-2">
                <TabsTrigger value="paste">Pegar lista</TabsTrigger>
                <TabsTrigger value="manual">Agregar por código</TabsTrigger>
                <TabsTrigger value="file">Importar planilla</TabsTrigger>
              </TabsList>

              <TabsContent value="paste" className="p-5">
                <Textarea
                  value={pasted}
                  onChange={(e) => setPasted(e.target.value)}
                  rows={7}
                  placeholder={EXAMPLE}
                  className="font-mono text-[12px]"
                  aria-label="Lista de SKU y cantidades"
                />
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button icon={<ClipboardPaste className="size-4" />} onClick={parsePasted} loading={resolve.pending}>
                    Validar líneas
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setPasted(EXAMPLE)}>
                    Usar ejemplo
                  </Button>
                  <p className="text-xs text-ink-500">
                    Un SKU por renglón. La cantidad puede separarse con espacio, tabulación, coma o punto y coma.
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="manual" className="p-5">
                <form
                  className="flex flex-wrap items-end gap-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!manualSku.trim()) return;
                    void resolve.run([{ sku: manualSku.trim(), quantity: manualQty }]);
                    setManualSku('');
                    setManualQty(1);
                  }}
                >
                  <div className="min-w-[200px] flex-1">
                    <label htmlFor="qo-sku" className="mb-1.5 block text-[13px] font-medium text-ink-700">
                      Código interno (SKU)
                    </label>
                    <Input
                      id="qo-sku"
                      value={manualSku}
                      onChange={(e) => setManualSku(e.target.value.toUpperCase())}
                      placeholder="MSVG5070TV3O"
                      className="font-mono"
                    />
                  </div>
                  <div className="w-28">
                    <label htmlFor="qo-qty" className="mb-1.5 block text-[13px] font-medium text-ink-700">
                      Cantidad
                    </label>
                    <Input
                      id="qo-qty"
                      type="number"
                      min={1}
                      value={manualQty}
                      onChange={(e) => setManualQty(Math.max(1, Number.parseInt(e.target.value, 10) || 1))}
                    />
                  </div>
                  <Button type="submit" icon={<Plus className="size-4" />} loading={resolve.pending}>
                    Agregar fila
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="file" className="p-5">
                <label
                  className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-ink-200 px-6 py-10 text-center transition-colors hover:border-ashir-400 hover:bg-ashir-50/40"
                  onDrop={(e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files[0];
                    if (file) void handleFile(file);
                  }}
                  onDragOver={(e) => e.preventDefault()}
                >
                  <Upload className="size-6 text-ink-400" aria-hidden />
                  <span className="text-[13px] font-semibold text-ink-800">
                    Arrastrá tu planilla o hacé clic para elegirla
                  </span>
                  <span className="text-xs text-ink-500">
                    Formatos .xlsx, .xls o .csv · primera columna SKU, segunda columna cantidad
                  </span>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void handleFile(file);
                      e.target.value = '';
                    }}
                  />
                </label>
                <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-500">
                  <FileSpreadsheet className="size-3.5" aria-hidden />
                  El archivo se procesa en tu navegador: no se envía a ningún servidor.
                </p>
              </TabsContent>
            </Tabs>
          </Card>

          {/* --- líneas resueltas --- */}
          {lines.length === 0 ? (
            <Card>
              <EmptyState
                title="Todavía no cargaste líneas"
                description="Pegá tu lista de compra habitual y validamos SKU por SKU contra el catálogo y el stock real."
                icon={<ShoppingCart className="size-5" />}
              />
            </Card>
          ) : (
            <DataTable
              columns={columns}
              rows={lines}
              rowKey={(l) => l.id}
              dense
              footer={
                <tr>
                  <td colSpan={5} className="px-4 py-2.5 text-right text-[13px] text-ink-600">
                    Subtotal de {summary.valid} líneas válidas ({fmtNumber(summary.units)} unidades)
                  </td>
                  <td className="px-4 py-2.5 text-right text-[13px] font-semibold tabular-nums text-ink-900">
                    {fmtMoney({ amount: summary.subtotal.toFixed(2), currency: 'USD' })}
                  </td>
                  <td />
                </tr>
              }
            />
          )}

          {/* --- problemas y reemplazos --- */}
          {problemLines.length > 0 && (
            <Card>
              <CardHeader
                title={`${problemLines.length} línea(s) necesitan atención`}
                subtitle="Códigos inexistentes, sin precio publicado o sin stock suficiente"
                icon={<AlertTriangle className="size-4" />}
              />
              <ul className="divide-y divide-ink-100">
                {problemLines.map((line) => {
                  const replacements = line.product ? replacementsFor(line.product) : [];
                  return (
                    <li key={line.id} className="px-5 py-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="flex flex-wrap items-center gap-2 text-[13px] font-semibold text-ink-900">
                            <code className="font-mono">{line.rawSku}</code>
                            <Badge tone={line.status === 'LOW_STOCK' ? 'warn' : 'bad'} size="sm">
                              {line.status === 'NOT_FOUND'
                                ? 'No encontrado'
                                : line.status === 'NO_PRICE'
                                  ? 'Sin precio'
                                  : line.status === 'NO_STOCK'
                                    ? 'Sin stock'
                                    : 'Stock parcial'}
                            </Badge>
                          </p>
                          <p className="mt-1 text-[13px] text-ink-500">{line.message}</p>
                        </div>
                      </div>

                      {replacements.length > 0 && (
                        <div className="mt-3 rounded-lg bg-ink-50 p-3">
                          <p className="text-[11px] font-semibold tracking-wide text-ink-500 uppercase">
                            Reemplazos sugeridos en {line.product?.category}
                          </p>
                          <ul className="mt-2 space-y-1.5">
                            {replacements.map((candidate) => (
                              <li key={candidate.id} className="flex flex-wrap items-center justify-between gap-2">
                                <Link
                                  to={`/catalogo/${candidate.sku}`}
                                  className="min-w-0 flex-1 truncate text-[13px] text-ashir-600 hover:text-ashir-700"
                                >
                                  {candidate.name}
                                </Link>
                                <span className="shrink-0 text-xs tabular-nums text-ink-500">
                                  {fmtMoney(candidate.listPrice)} · {candidate.stock} u.
                                </span>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    void resolve.run([{ sku: candidate.sku, quantity: line.quantity }]);
                                    setLines((prev) => prev.filter((l) => l.id !== line.id));
                                  }}
                                >
                                  Reemplazar
                                </Button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
        </div>

        {/* ---------------- resumen ---------------- */}
        <div className="lg:sticky lg:top-32 lg:self-start">
          <Card>
            <CardHeader title="Resumen" subtitle="Antes de pasar al carrito" />
            <div className="space-y-2.5 p-5">
              <div className="flex justify-between text-[13px]">
                <span className="text-ink-500">Líneas válidas</span>
                <span className="font-semibold tabular-nums text-ink-900">{summary.valid}</span>
              </div>
              <div className="flex justify-between text-[13px]">
                <span className="text-ink-500">Líneas con problemas</span>
                <span className={cn('font-semibold tabular-nums', summary.issues > 0 ? 'text-bad-600' : 'text-ink-900')}>
                  {summary.issues}
                </span>
              </div>
              <div className="flex justify-between text-[13px]">
                <span className="text-ink-500">Unidades</span>
                <span className="font-semibold tabular-nums text-ink-900">{fmtNumber(summary.units)}</span>
              </div>
              <div className="flex justify-between border-t border-ink-100 pt-2.5 text-[15px]">
                <span className="font-medium text-ink-700">Subtotal</span>
                <span className="font-semibold tabular-nums text-ink-900">
                  {fmtMoney({ amount: summary.subtotal.toFixed(2), currency: 'USD' })}
                </span>
              </div>
              <p className="text-[11px] text-ink-400">Precios en USD sin IVA, con tu lista y condiciones aplicadas.</p>

              <Button
                className="mt-2 w-full"
                size="lg"
                icon={<ShoppingCart className="size-4" />}
                disabled={summary.valid === 0}
                onClick={() => {
                  let added = 0;
                  for (const line of lines) {
                    if (line.status === 'NOT_FOUND' || line.status === 'NO_PRICE') continue;
                    const result = cart.add(line.product!.id, line.quantity);
                    if (result.ok) added++;
                  }
                  toast.success('Líneas agregadas al pedido', `${added} SKUs pasaron al carrito.`);
                  setLines([]);
                }}
              >
                Agregar todo al pedido
              </Button>
              <Link to="/carrito" className="block">
                <Button variant="outline" className="w-full">
                  Ir al pedido en armado
                </Button>
              </Link>
            </div>
          </Card>

          <Callout tone="tech" className="mt-4">
            El validador usa los códigos internos de la lista de distribuidor de Ashir. Si tu sistema maneja otros
            códigos, la API futura permite mapearlos por part number o EAN.
          </Callout>
        </div>
      </div>
    </div>
  );
}
