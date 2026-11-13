import { useId, useState } from 'react';
import { copyPng, copyText, downloadBlob, svgBlob, svgToPng } from '../lib/export';
import { buildZip, type ZipEntry } from '../lib/zip';
import { Section } from './Customize';
import { Button, IconButton, UiIcon } from './ui';

export const EXPORT_SCALES = [0.5, 1, 1.5, 2, 3, 4] as const;
type Scale = (typeof EXPORT_SCALES)[number];
type Format = 'png' | 'svg';

export interface ExportRow {
  id: number;
  scale: Scale;
  format: Format;
  /** Appended to the file name. Empty means the default for the row. */
  suffix: string;
}

let nextId = 1;
const row = (format: Format, scale: Scale): ExportRow => ({ id: nextId++, format, scale, suffix: '' });

/** Export rows outlive the inspector, so switching icons keeps the setup (like Figma's export settings). */
let remembered: ExportRow[] = [row('svg', 1)];
export const resetExportRows = () => { remembered = [row('svg', 1)]; };

const scaleLabel = (s: number) => `${s}x`;
/** SVG is vector: it always exports at the chosen size, so its scale is fixed (as in Figma). */
const effectiveScale = (r: Pick<ExportRow, 'format' | 'scale'>) => (r.format === 'svg' ? 1 : r.scale);
const pxOf = (size: number, scale: number) => Math.round(size * scale);
export const defaultSuffix = (r: Pick<ExportRow, 'format' | 'scale'>, size: number) =>
  (r.format === 'png' ? `-${pxOf(size, r.scale)}px` : '');

const field = 'h-8 rounded-md border border-transparent bg-sunken px-2 text-sm text-ink transition-colors hover:border-line-strong disabled:text-faint disabled:hover:border-transparent';

type CopyKind = 'svg' | 'png' | 'name';
const COPY_KINDS: { value: CopyKind; label: string }[] = [
  { value: 'svg', label: 'SVG code' },
  { value: 'png', label: 'PNG image' },
  { value: 'name', label: 'Name' },
];
let rememberedCopy: { kind: CopyKind; scale: Scale } = { kind: 'svg', scale: 2 };

/**
 * Figma-style export: a list of scale × format rows, each with an optional
 * suffix, exported in one go (one file, or a ZIP for several). Copy follows
 * the same shape: pick what to copy, and the scale for images.
 */
export function ExportPanel({
  name, baseName, size, build, disabled, run,
}: {
  /** Icon name, for the button label and Copy name. */
  name: string;
  /** File name stem (icon, modifier, style). */
  baseName: string;
  size: number;
  /** Build the export SVG at a pixel size. */
  build: (px: number) => string;
  disabled: boolean;
  run: (action: () => Promise<void> | void, success: string) => Promise<void>;
}) {
  const uid = useId();
  const [rows, setRowsState] = useState<ExportRow[]>(remembered);
  const [openRow, setOpenRow] = useState<number | null>(null);
  const [copy, setCopyState] = useState(rememberedCopy);
  const setRows = (next: ExportRow[]) => { remembered = next; setRowsState(next); };
  const setCopy = (next: typeof copy) => { rememberedCopy = next; setCopyState(next); };
  const patch = (id: number, change: Partial<ExportRow>) => setRows(rows.map((r) => (r.id === id ? { ...r, ...change } : r)));

  const add = () => {
    const last = rows[rows.length - 1];
    // Like Figma: the next row steps up in scale.
    const scale = last ? (EXPORT_SCALES.find((s) => s > last.scale) ?? last.scale) : 1;
    setRows([...rows, row(last?.format ?? 'png', scale)]);
  };

  const fileName = (r: ExportRow) => `${baseName}${r.suffix || defaultSuffix(r, size)}.${r.format}`;

  const exportAll = () => run(async () => {
    const files: ZipEntry[] = [];
    const names = new Set<string>();
    for (const r of rows) {
      let fname = fileName(r);
      for (let n = 2; names.has(fname); n += 1) fname = fileName(r).replace(/(\.\w+)$/, `-${n}$1`);
      names.add(fname);
      const px = pxOf(size, effectiveScale(r));
      const svg = build(px);
      files.push({ name: fname, data: r.format === 'svg' ? svg : new Uint8Array(await (await svgToPng(svg, px)).arrayBuffer()) });
    }
    if (files.length === 1) {
      const [only] = files;
      downloadBlob(typeof only.data === 'string' ? svgBlob(only.data) : new Blob([only.data as Uint8Array<ArrayBuffer>], { type: 'image/png' }), only.name);
    } else {
      downloadBlob(await buildZip(files), `${baseName}.zip`);
    }
  }, rows.length === 1 ? `Downloaded ${fileName(rows[0])}` : `Downloaded ${rows.length} files as ${baseName}.zip`);

  const doCopy = () => {
    if (copy.kind === 'name') return run(() => copyText(name), `Copied “${name}”`);
    if (copy.kind === 'svg') return run(() => copyText(build(size)), 'SVG copied');
    const px = pxOf(size, copy.scale);
    return run(() => copyPng(Promise.resolve().then(() => svgToPng(build(px), px))), `Copied a ${px}px PNG`);
  };

  return (
    <Section
      title="Export"
      aside={<IconButton icon="plus" label="Add export setting" onClick={add} className="-mr-1.5 size-8" />}
    >
    <div className="space-y-3">
      <ul aria-label="Export settings" className="space-y-2">
        {rows.map((r, i) => {
          const svg = r.format === 'svg';
          const open = openRow === r.id;
          return (
            <li key={r.id}>
              <div className="flex items-center gap-1.5">
                <label className="sr-only" htmlFor={`${uid}-s${r.id}`}>Scale, row {i + 1}</label>
                <select
                  id={`${uid}-s${r.id}`}
                  value={effectiveScale(r)}
                  disabled={svg}
                  title={svg ? 'SVG is vector; it exports at the chosen size' : `${pxOf(size, effectiveScale(r))}px`}
                  onChange={(e) => patch(r.id, { scale: Number(e.target.value) as Scale })}
                  className={`${field} w-[76px]`}
                >
                  {EXPORT_SCALES.map((s) => <option key={s} value={s}>{scaleLabel(s)}</option>)}
                </select>
                <label className="sr-only" htmlFor={`${uid}-f${r.id}`}>Format, row {i + 1}</label>
                <select
                  id={`${uid}-f${r.id}`}
                  value={r.format}
                  onChange={(e) => patch(r.id, { format: e.target.value as Format })}
                  className={`${field} min-w-0 flex-1`}
                >
                  <option value="png">PNG</option>
                  <option value="svg">SVG</option>
                </select>
                <button
                  type="button"
                  aria-label={`Options, row ${i + 1}`}
                  title="Suffix"
                  aria-expanded={open}
                  aria-controls={`${uid}-o${r.id}`}
                  onClick={() => setOpenRow(open ? null : r.id)}
                  className={`inline-flex size-8 items-center justify-center rounded-md transition-colors hover:bg-sunken ${open ? 'bg-sunken' : ''}`}
                >
                  <UiIcon name="dots-horizontal" className="size-[18px]" />
                </button>
                <button
                  type="button"
                  aria-label={`Remove row ${i + 1}`}
                  title="Remove"
                  disabled={rows.length === 1}
                  onClick={() => setRows(rows.filter((x) => x.id !== r.id))}
                  className="inline-flex size-8 items-center justify-center rounded-md transition-colors hover:bg-sunken disabled:opacity-30 disabled:hover:bg-transparent"
                >
                  <UiIcon name="minus" className="size-[18px]" />
                </button>
              </div>
              {open && (
                <div id={`${uid}-o${r.id}`} className="mt-1.5 flex items-center gap-2 pl-0.5">
                  <label htmlFor={`${uid}-x${r.id}`} className="text-xs text-muted">Suffix</label>
                  <input
                    id={`${uid}-x${r.id}`}
                    value={r.suffix}
                    placeholder={defaultSuffix(r, size) || 'None'}
                    onChange={(e) => patch(r.id, { suffix: e.target.value.replace(/[\\/:*?"<>|]/g, '') })}
                    className={`${field} min-w-0 flex-1 font-mono text-xs`}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <Button variant="primary" icon="download" className="h-10 w-full" disabled={disabled} onClick={exportAll}>
        Export {name}{rows.length > 1 ? ` (${rows.length})` : ''}
      </Button>
      <p className="text-xs text-faint">
        {rows.length > 1 ? `Several files download as one ZIP. ` : ''}PNGs have transparent backgrounds.
      </p>

      <div className="border-t border-line pt-3">
        <h4 className="mb-2 text-xs text-muted">Copy</h4>
        <div className="flex items-center gap-1.5">
          <label className="sr-only" htmlFor={`${uid}-cs`}>Copy scale</label>
          <select
            id={`${uid}-cs`}
            value={copy.kind === 'png' ? copy.scale : 1}
            disabled={copy.kind !== 'png'}
            onChange={(e) => setCopy({ ...copy, scale: Number(e.target.value) as Scale })}
            className={`${field} w-[76px]`}
          >
            {EXPORT_SCALES.map((s) => <option key={s} value={s}>{scaleLabel(s)}</option>)}
          </select>
          <label className="sr-only" htmlFor={`${uid}-ck`}>Copy as</label>
          <select
            id={`${uid}-ck`}
            value={copy.kind}
            onChange={(e) => setCopy({ ...copy, kind: e.target.value as CopyKind })}
            className={`${field} min-w-0 flex-1`}
          >
            {COPY_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
          </select>
          <Button icon="copy" className="h-8 px-2.5" disabled={disabled && copy.kind !== 'name'} onClick={doCopy}>
            Copy
          </Button>
        </div>
      </div>
      <p className="text-xs text-faint">Shift-click more icons in the grid to download several as a ZIP.</p>
    </div>
    </Section>
  );
}
