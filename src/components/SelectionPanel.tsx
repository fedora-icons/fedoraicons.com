import { useI18n } from '../i18n';
import { errorText } from '../i18n/errors';
import { useMemo, useState } from 'react';
import { STYLE_META, type StyleId } from '../lib/catalog';
import { copyText, downloadBlob, svgToPng } from '../lib/export';
import { exportColors, strokeAdjustable, strokeOf, type Look } from '../lib/look';
import { buildSvg } from '../lib/svg';
import { useTheme } from '../lib/theme';
import { buildZip, type ZipEntry } from '../lib/zip';
import { CustomizeControls, Section } from './Customize';
import { Button, IconButton, Segmented, UiIcon, useToast } from './ui';

const PNG_SCALES = [1, 2, 4] as const;
type Format = 'svg' | 'png';

/** The pane when several icons are selected: one look, applied to all of them. */
export function SelectionPanel({
  names, style, kind, svgs, look, onLookChange, onRemove, onClear, headingId,
}: {
  names: string[];
  style: StyleId;
  kind: 'core' | 'brand';
  /** Source artwork for the current style, or null while it loads. */
  svgs: Record<string, string> | null;
  look: Look;
  onLookChange: (patch: Partial<Look>) => void;
  onRemove: (name: string) => void;
  onClear: () => void;
  headingId: string;
}) {
  const toast = useToast();
  const i18n = useI18n();
  const { t } = i18n;
  const { resolved: theme } = useTheme();
  const [format, setFormat] = useState<Format>('svg');
  const [scale, setScale] = useState<(typeof PNG_SCALES)[number]>(2);
  const [busy, setBusy] = useState(false);
  const strokeWidth = strokeAdjustable(style, kind) ? strokeOf(look) : undefined;
  const slug = STYLE_META[style].slug;
  const ready = !!svgs && names.every((n) => svgs[n]);

  const build = (name: string, px: number, idPrefix?: string) => {
    const source = svgs?.[name];
    if (!source) throw new Error(`${name} is still loading.`);
    return buildSvg(source, { ...exportColors(source, style, look, theme), size: px, strokeWidth, idPrefix });
  };

  const thumbs = useMemo(() => names.map((name, i) => {
    const source = svgs?.[name];
    if (!source) return null;
    try {
      return buildSvg(source, { ...exportColors(source, style, look, theme), size: 24, strokeWidth, idPrefix: `sel${i}` });
    } catch {
      return null;
    }
  }), [names, svgs, look, theme, style, strokeWidth]);

  const download = async () => {
    setBusy(true);
    try {
      const px = format === 'png' ? look.size * scale : look.size;
      const entries: ZipEntry[] = [];
      for (const name of names) {
        const svg = build(name, px);
        if (format === 'svg') {
          entries.push({ name: `${name}-${slug}.svg`, data: svg });
        } else {
          const png = await svgToPng(svg, px);
          entries.push({ name: `${name}-${slug}-${px}px.png`, data: new Uint8Array(await png.arrayBuffer()) });
        }
      }
      const zipName = `fedora-icons-${kind === 'brand' ? 'brands-' : ''}${slug}-${names.length}-${format}.zip`;
      downloadBlob(await buildZip(entries), zipName);
      toast('success', i18n.t('selection.downloaded', { count: names.length, file: zipName }));
    } catch (error) {
      toast('error', errorText(error, i18n, 'error.zip'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex items-start gap-3 px-5 pb-4 pt-5">
        <div className="min-w-0 flex-1">
          <h2 id={headingId} tabIndex={-1} className="text-xl font-semibold outline-none">
            {t('selection.title', { count: names.length })}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {t('selection.intro', { style: t(`style.${style}`) })}
          </p>
        </div>
        <IconButton icon="x" label={t('inspector.clear')} onClick={onClear} className="-mr-2 -mt-1" />
      </div>

      <div className="px-5 pb-4">
        <ul aria-label={t('selection.list')} className="grid max-h-[176px] grid-cols-5 gap-1.5 overflow-y-auto rounded-2xl border border-line p-1.5">
          {names.map((name, i) => (
            <li key={name}>
              <button
                type="button"
                title={name}
                aria-label={t('selection.remove', { name })}
                onClick={() => onRemove(name)}
                className="group relative flex aspect-square w-full items-center justify-center rounded-xl bg-sunken text-ink transition-colors hover:bg-line"
              >
                {thumbs?.[i] ? (
                  <span data-artwork className="glyph size-6" dangerouslySetInnerHTML={{ __html: thumbs[i]! }} />
                ) : (
                  <span className="size-6 animate-pulse rounded-md bg-line" />
                )}
                <span className="absolute right-0.5 top-0.5 flex size-4 items-center justify-center rounded-full bg-ink text-canvas opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden="true">
                  <UiIcon name="x" className="size-3" />
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <CustomizeControls look={look} onChange={onLookChange} style={style} kind={kind} />

      <Section title={t('export.title')}>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Segmented
              label={t('selection.zipFormat')}
              size="sm"
              value={format}
              onChange={setFormat}
              options={[{ value: 'svg', label: 'SVG' }, { value: 'png', label: 'PNG' }]}
            />
            {format === 'png' && (
              <>
                <label className="sr-only" htmlFor="zip-scale">{t('selection.pngScale')}</label>
                <select
                  id="zip-scale"
                  value={scale}
                  onChange={(e) => setScale(Number(e.target.value) as (typeof PNG_SCALES)[number])}
                  className="h-8 rounded-lg border border-line-strong bg-surface px-2 text-sm"
                >
                  {PNG_SCALES.map((s) => <option key={s} value={s}>{s}× · {t('customize.pxValue', { value: look.size * s })}</option>)}
                </select>
              </>
            )}
          </div>
          <Button variant="primary" icon="download" className="h-10 w-full" disabled={!ready || busy} onClick={download}>
            {busy ? t('selection.building') : t('selection.download', { count: names.length })}
          </Button>
          <Button
            icon="copy"
            className="w-full"
            disabled={busy}
            onClick={() => copyText(names.join('\n')).then(
              () => toast('success', t('selection.copiedNames', { count: names.length })),
              (e: unknown) => toast('error', errorText(e, i18n, 'error.copy')),
            )}
          >
            {t('selection.copyNames')}
          </Button>
          <p className="text-xs leading-relaxed text-faint">
            {format === 'png' ? t('selection.notePng') : t('selection.noteSvg')}
          </p>
        </div>
      </Section>
      <div className="h-4" />
    </div>
  );
}
