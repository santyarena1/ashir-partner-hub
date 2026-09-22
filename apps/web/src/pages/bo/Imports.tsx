/**
 * Centro de importaciones de productos.
 *
 * El archivo se lee en el navegador con SheetJS: elegir hoja, ver primeras
 * filas, mapear columnas, validar y simular la importación.
 */
import { useRef, useState } from 'react';
import type { WorkBook } from 'xlsx';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  History,
  Import,
  Upload,
  XCircle,
} from 'lucide-react';
import type { ImportPreview, ImportRun } from '@/types';
import { api } from '@/services';
import { useSession } from '@/app/session';
import { useAction, useAsync } from '@/app/hooks';
import { useToast } from '@/components/ui/overlays';
import { CATALOG_META } from '@/mocks/fixtures/catalog';
import { can } from '@/lib/rbac';
import { cn, downloadTextFile, fmtDateTime, fmtNumber } from '@/lib/utils';
import { Badge, Button, Card, CardHeader, Select, Skeleton } from '@/components/ui/primitives';
import {
  Callout,
  DataTable,
  EmptyState,
  ForbiddenState,
  Mono,
  PageHeader,
  SectionTitle,
  StatGrid,
  StatTile,
  Stepper,
  type Column,
} from '@/components/ui/data';

/** Campos del sistema a los que se puede mapear una columna del archivo. */
const TARGET_FIELDS = [
  { value: '', label: 'No importar' },
  { value: 'sku', label: 'SKU / Código interno', required: true },
  { value: 'partNumber', label: 'Part number' },
  { value: 'name', label: 'Descripción', required: true },
  { value: 'brand', label: 'Marca' },
  { value: 'category', label: 'Categoría' },
  { value: 'listPrice', label: 'Precio distribuidor', required: true },
  { value: 'suggestedRetail', label: 'Precio final sugerido' },
  { value: 'vatRate', label: 'Alícuota de IVA' },
  { value: 'availability', label: 'Estado / disponibilidad', required: true },
  { value: 'stock', label: 'Stock' },
  { value: 'cost', label: 'Costo' },
  { value: 'warrantyMonths', label: 'Garantía (meses)' },
  { value: 'ean', label: 'EAN / UPC' },
  { value: 'imageUrl', label: 'URL de imagen' },
  { value: 'description', label: 'Detalles' },
] as const;

const STEPS = [{ label: 'Archivo' }, { label: 'Mapeo' }, { label: 'Validación' }, { label: 'Resultado' }];

/** Sugerencia automática de mapeo a partir del encabezado. */
function suggestTarget(header: string): string {
  const h = header.toUpperCase();
  if (h.includes('COD')) return 'sku';
  if (h.includes('PART')) return 'partNumber';
  if (h.includes('DESCRIPCI')) return 'name';
  if (h.includes('DISTRI')) return 'listPrice';
  if (h === 'FINAL' || h.includes('PUBLICO')) return 'suggestedRetail';
  if (h.trim() === 'IVA') return 'vatRate';
  if (h.includes('ESTADO')) return 'availability';
  if (h.includes('DETALLE')) return 'description';
  if (h.includes('MARCA')) return 'brand';
  if (h.includes('CATEGOR')) return 'category';
  if (h.includes('STOCK')) return 'stock';
  if (h.includes('COSTO')) return 'cost';
  if (h.includes('EAN') || h.includes('UPC')) return 'ean';
  return '';
}

export function BoImports() {
  const { session } = useSession();
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [fileName, setFileName] = useState('');
  const [sheets, setSheets] = useState<string[]>([]);
  const [sheet, setSheet] = useState('');
  const [workbook, setWorkbook] = useState<WorkBook | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [mapping, setMapping] = useState<ImportRun['mapping']>([]);
  const [run, setRun] = useState<ImportRun | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const history = useAsync(() => api.imports.history(), []);
  const validate = useAction(() => api.imports.validate(preview!, mapping));
  const commit = useAction((runId: string) => api.imports.commit(runId));

  if (!can(session, 'imports:manage')) {
    return (
      <Card>
        <ForbiddenState scope="imports:manage" />
      </Card>
    );
  }

  /* ---------------- lectura del archivo ---------------- */

  const readFile = async (file: File) => {
    try {
      // SheetJS pesa ~900 kB: se carga solo cuando el usuario sube un archivo.
      const XLSX = await import('xlsx');
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer);
      setWorkbook(wb);
      setSheets(wb.SheetNames);
      setFileName(file.name);
      await selectSheet(wb, wb.SheetNames[0]!);
      setStep(1);
      toast.success(`${file.name} cargado`, `${wb.SheetNames.length} hoja(s) detectadas.`);
    } catch (error) {
      toast.error('No pudimos leer el archivo', error instanceof Error ? error.message : undefined);
    }
  };

  const selectSheet = async (wb: WorkBook, name: string) => {
    setSheet(name);
    const ws = wb.Sheets[name];
    if (!ws) return;
    const XLSX = await import('xlsx');
    const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(ws, { header: 1, defval: null });

    // Detecta la fila de encabezados: la primera con al menos 3 celdas de texto.
    let headerIndex = 0;
    for (let i = 0; i < Math.min(rows.length, 25); i++) {
      const filled = (rows[i] ?? []).filter((c) => typeof c === 'string' && c.trim().length > 1).length;
      if (filled >= 3) {
        headerIndex = i;
        break;
      }
    }

    const headers = (rows[headerIndex] ?? []).map((c, i) => String(c ?? `Columna ${i + 1}`));
    const dataRows = rows.slice(headerIndex + 1, headerIndex + 21);

    const nextPreview: ImportPreview = {
      headers,
      rows: dataRows,
      detectedSheets: wb.SheetNames,
      suggestedMapping: headers.map((h) => ({ source: h, target: suggestTarget(h), confidence: suggestTarget(h) ? 0.9 : 0 })),
    };

    setPreview(nextPreview);
    setMapping(
      headers.map((h) => {
        const target = suggestTarget(h);
        return {
          source: h,
          target,
          required: Boolean(TARGET_FIELDS.find((f) => f.value === target && 'required' in f && f.required)),
        };
      }),
    );
  };

  const historyColumns: Column<ImportRun>[] = [
    {
      key: 'file',
      header: 'Archivo',
      cell: (r) => (
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium text-ink-900">{r.fileName}</p>
          <p className="text-[11px] text-ink-400">
            Hoja {r.sheet} · {r.actor}
          </p>
        </div>
      ),
    },
    {
      key: 'date',
      header: 'Fecha',
      cell: (r) => <span className="text-xs text-ink-600">{fmtDateTime(r.startedAt)}</span>,
      sortable: true,
      sortValue: (r) => new Date(r.startedAt).getTime(),
    },
    {
      key: 'rows',
      header: 'Filas',
      align: 'right',
      cell: (r) => (
        <span className="tabular-nums text-ink-600">
          {fmtNumber(r.rowsValid)} / {fmtNumber(r.rowsTotal)}
        </span>
      ),
    },
    {
      key: 'changes',
      header: 'Altas / actualizaciones',
      align: 'right',
      hideOnMobile: true,
      cell: (r) => (
        <span className="tabular-nums text-ink-600">
          <span className="font-medium text-ok-700">{fmtNumber(r.creates)}</span> / {fmtNumber(r.updates)}
        </span>
      ),
    },
    {
      key: 'errors',
      header: 'Observaciones',
      align: 'right',
      cell: (r) => (
        <span className={cn('tabular-nums', r.rowsWithErrors > 0 ? 'text-warn-700' : 'text-ink-400')}>
          {r.rowsWithErrors > 0 ? fmtNumber(r.rowsWithErrors) : '—'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Estado',
      cell: (r) => (
        <Badge
          tone={r.status === 'COMMITTED' ? 'ok' : r.status === 'FAILED' ? 'bad' : r.status === 'PREVIEW' ? 'tech' : 'warn'}
          size="sm"
          dot
        >
          {r.status === 'COMMITTED' ? 'Aplicada' : r.status === 'FAILED' ? 'Fallida' : r.status === 'PREVIEW' ? 'Previsualizada' : r.status}
        </Badge>
      ),
    },
  ];

  const requiredMissing = ['sku', 'name', 'listPrice', 'availability'].filter(
    (field) => !mapping.some((m) => m.target === field),
  );

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'Configuración' }, { label: 'Importaciones' }]}
        title="Importación de productos"
        subtitle="Cargá la lista de distribuidor, mapeá las columnas y validá antes de aplicar. El archivo se procesa en el navegador."
      />

      <Callout tone="warn" className="mb-6" title="Importación simulada">
        En el prototipo la importación valida y previsualiza de verdad, pero no escribe en ningún sistema: la carga
        real dependería del ERP de Ashir, todavía no definido.
      </Callout>

      <StatGrid cols={4} className="mb-6">
        <StatTile
          label="Catálogo vigente"
          value={fmtNumber(CATALOG_META.productCount)}
          icon={<FileSpreadsheet className="size-4" />}
          footer={`Desde «${CATALOG_META.source}»`}
        />
        <StatTile label="Marcas" value={CATALOG_META.brandCount} />
        <StatTile label="Categorías" value={CATALOG_META.categoryCount} />
        <StatTile
          label="Observaciones del último archivo"
          value={CATALOG_META.problemCount}
          tone={CATALOG_META.problemCount > 0 ? 'warn' : 'ok'}
        />
      </StatGrid>

      <Card className="mb-5 p-5">
        <Stepper steps={STEPS} currentIndex={step} />
      </Card>

      {/* ---------------- paso 1: archivo ---------------- */}
      {step === 0 && (
        <Card>
          <CardHeader title="Seleccioná el archivo" icon={<Upload className="size-4" />} />
          <div className="p-5">
            <label
              className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-ink-200 px-6 py-14 text-center transition-colors hover:border-ashir-400 hover:bg-ashir-50/40"
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files[0];
                if (file) void readFile(file);
              }}
              onDragOver={(e) => e.preventDefault()}
            >
              <Upload className="size-7 text-ink-400" aria-hidden />
              <span className="text-[15px] font-semibold text-ink-800">Arrastrá el archivo o hacé clic para elegirlo</span>
              <span className="text-[13px] text-ink-500">Formatos .xlsx, .xls o .csv · hasta 10 MB</span>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void readFile(file);
                  e.target.value = '';
                }}
              />
            </label>
          </div>
        </Card>
      )}

      {/* ---------------- paso 2: mapeo ---------------- */}
      {step === 1 && preview && (
        <div className="space-y-5">
          <Card>
            <CardHeader
              title="Hoja y previsualización"
              subtitle={`${fileName} · ${preview.rows.length} filas de muestra`}
              action={
                sheets.length > 1 && (
                  <Select
                    value={sheet}
                    onChange={(e) => workbook && void selectSheet(workbook, e.target.value)}
                    className="h-8 w-auto text-[13px]"
                    aria-label="Hoja"
                  >
                    {sheets.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </Select>
                )
              }
            />
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[12px]">
                <thead>
                  <tr className="border-b border-ink-200 bg-ink-50">
                    {preview.headers.map((h, i) => (
                      <th key={`${h}-${i}`} className="px-3 py-2 font-medium whitespace-nowrap text-ink-500">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {preview.rows.slice(0, 8).map((row, i) => (
                    <tr key={i}>
                      {preview.headers.map((_, j) => (
                        <td key={j} className="max-w-[220px] truncate px-3 py-1.5 text-ink-700">
                          {row[j] === null || row[j] === undefined ? <span className="text-ink-300">—</span> : String(row[j])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Mapeo de columnas"
              subtitle="Asociá cada columna del archivo a un campo del sistema. Marcamos con ✓ los campos obligatorios."
            />
            <ul className="divide-y divide-ink-100">
              {mapping.map((m, index) => (
                <li key={`${m.source}-${index}`} className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <div className="min-w-[180px] flex-1">
                    <p className="text-[13px] font-medium text-ink-900">{m.source}</p>
                    <p className="truncate text-[11px] text-ink-400">
                      ej.: {preview.rows[0]?.[index] !== null && preview.rows[0]?.[index] !== undefined ? String(preview.rows[0]![index]) : '—'}
                    </p>
                  </div>
                  <ArrowRight className="size-4 shrink-0 text-ink-300" aria-hidden />
                  <Select
                    value={m.target}
                    onChange={(e) => {
                      const target = e.target.value;
                      setMapping((prev) =>
                        prev.map((item, i) =>
                          i === index
                            ? {
                                ...item,
                                target,
                                required: Boolean(TARGET_FIELDS.find((f) => f.value === target && 'required' in f && f.required)),
                              }
                            : item,
                        ),
                      );
                    }}
                    className="h-8 w-auto min-w-[220px] text-[13px]"
                    aria-label={`Campo destino de ${m.source}`}
                  >
                    {TARGET_FIELDS.map((f) => (
                      <option key={f.value} value={f.value}>
                        {'required' in f && f.required ? `✓ ${f.label}` : f.label}
                      </option>
                    ))}
                  </Select>
                </li>
              ))}
            </ul>
          </Card>

          {requiredMissing.length > 0 && (
            <Callout tone="warn" icon={<AlertTriangle className="size-4" />} title="Faltan campos obligatorios">
              Todavía no asignaste: {requiredMissing.join(', ')}. Sin ellos la validación va a marcar todas las filas
              como incompletas.
            </Callout>
          )}

          <div className="flex flex-wrap justify-between gap-3">
            <Button variant="outline" onClick={() => setStep(0)}>
              Elegir otro archivo
            </Button>
            <Button
              loading={validate.pending}
              iconRight={<ArrowRight className="size-4" />}
              onClick={async () => {
                const result = await validate.run();
                if (result) {
                  setRun({ ...result, fileName, sheet });
                  setStep(2);
                }
              }}
            >
              Validar archivo
            </Button>
          </div>
        </div>
      )}

      {/* ---------------- paso 3: validación ---------------- */}
      {step === 2 && run && (
        <div className="space-y-5">
          <StatGrid cols={5}>
            <StatTile label="Filas leídas" value={fmtNumber(run.rowsTotal)} />
            <StatTile label="Válidas" value={fmtNumber(run.rowsValid)} tone="ok" />
            <StatTile
              label="Con observaciones"
              value={fmtNumber(run.rowsWithErrors)}
              tone={run.rowsWithErrors > 0 ? 'warn' : 'ok'}
            />
            <StatTile label="Altas previstas" value={fmtNumber(run.creates)} tone="tech" />
            <StatTile label="Actualizaciones" value={fmtNumber(run.updates)} />
          </StatGrid>

          <Card>
            <CardHeader
              title="Observaciones por fila"
              subtitle={`${run.errors.length} incidencias detectadas`}
              action={
                run.errors.length > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    icon={<Download className="size-3.5" />}
                    onClick={() =>
                      downloadTextFile(
                        `observaciones-${fileName.replace(/\.\w+$/, '')}.csv`,
                        ['fila,columna,valor,codigo,severidad,mensaje']
                          .concat(
                            run.errors.map((e) => `${e.row},"${e.column}","${e.value}",${e.code},${e.severity},"${e.message}"`),
                          )
                          .join('\n'),
                        'text/csv',
                      )
                    }
                  >
                    Descargar reporte
                  </Button>
                )
              }
            />
            {run.errors.length === 0 ? (
              <EmptyState
                compact
                title="Sin observaciones"
                description="Todas las filas se pueden importar tal como están."
                icon={<CheckCircle2 className="size-5" />}
              />
            ) : (
              <div className="max-h-[360px] overflow-y-auto">
                <ul className="divide-y divide-ink-100">
                  {run.errors.slice(0, 80).map((error, i) => (
                    <li key={i} className="flex items-start gap-3 px-5 py-2.5">
                      {error.severity === 'ERROR' ? (
                        <XCircle className="mt-0.5 size-4 shrink-0 text-bad-500" aria-hidden />
                      ) : (
                        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warn-500" aria-hidden />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-2 text-[13px] text-ink-800">
                          <span className="font-medium">Fila {error.row}</span>
                          <Mono>{error.column}</Mono>
                          <Badge tone={error.severity === 'ERROR' ? 'bad' : 'warn'} size="sm">
                            {error.code}
                          </Badge>
                        </p>
                        <p className="mt-0.5 text-xs text-ink-500">{error.message}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>

          <div className="flex flex-wrap justify-between gap-3">
            <Button variant="outline" onClick={() => setStep(1)}>
              Volver al mapeo
            </Button>
            <Button
              loading={commit.pending}
              disabled={run.rowsValid === 0}
              onClick={async () => {
                const result = await commit.run(run.id);
                if (result) {
                  setRun(result);
                  setStep(3);
                  history.refetch();
                  toast.success('Importación simulada', 'En el prototipo no se escribe en el catálogo real.');
                }
              }}
            >
              Simular importación
            </Button>
          </div>
        </div>
      )}

      {/* ---------------- paso 4: resultado ---------------- */}
      {step === 3 && run && (
        <div className="space-y-5">
          <Card className="border-ok-200">
            <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-ok-50 text-ok-600">
                <CheckCircle2 className="size-6" aria-hidden />
              </span>
              <h2 className="text-lg font-semibold text-ink-900">Importación simulada correctamente</h2>
              <p className="max-w-lg text-[13px] leading-relaxed text-ink-500">
                Se procesaron {fmtNumber(run.rowsValid)} filas válidas de {fmtNumber(run.rowsTotal)}:{' '}
                {fmtNumber(run.creates)} altas y {fmtNumber(run.updates)} actualizaciones. En producción este paso
                escribiría en el ERP o en el maestro de productos de Ashir.
              </p>
              <div className="mt-2 flex flex-wrap justify-center gap-2">
                <Button
                  onClick={() => {
                    setStep(0);
                    setRun(null);
                    setPreview(null);
                    setFileName('');
                  }}
                >
                  Importar otro archivo
                </Button>
                <Button variant="outline" onClick={() => setStep(2)}>
                  Ver observaciones
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ---------------- historial ---------------- */}
      <section className="mt-8">
        <SectionTitle
          title="Historial de importaciones"
          subtitle="Cada ejecución queda registrada con su archivo, su mapeo y sus observaciones"
          action={<History className="size-4 text-ink-400" />}
        />
        {history.initialLoading ? (
          <Skeleton className="h-48 w-full rounded-card" />
        ) : (
          <DataTable
            columns={historyColumns}
            rows={history.data ?? []}
            rowKey={(r) => r.id}
            dense
            empty={<EmptyState title="Sin importaciones registradas" icon={<Import className="size-5" />} />}
          />
        )}
      </section>

      <Card className="mt-6">
        <CardHeader title="Mapeo aplicado al catálogo vigente" />
        <div className="px-5 py-4">
          <p className="mb-3 text-[13px] leading-relaxed text-ink-600">
            El catálogo actual se generó con <Mono>npm run import:products</Mono> a partir de{' '}
            <Mono>{CATALOG_META.source}</Mono>. Estos campos provienen del archivo real:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {CATALOG_META.realFields.map((field) => (
              <Badge key={field} tone="ok" size="sm">
                {field}
              </Badge>
            ))}
          </div>
          <p className="mt-3 mb-2 text-[13px] text-ink-600">Y estos son simulados para la demostración:</p>
          <div className="flex flex-wrap gap-1.5">
            {CATALOG_META.simulatedFields.map((field) => (
              <Badge key={field} tone="warn" size="sm">
                {field}
              </Badge>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}
