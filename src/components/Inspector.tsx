import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  compositionLabel, modifierFamily, palettes, STYLE_META, type IconEntry, type StyleId,
} from '../lib/catalog';
import { copyPng, copyText, downloadBlob, svgBlob, svgToPng } from '../lib/export';
import { reactSnippet } from '../lib/react-snippet';
import { buildSvg, hasModifierRole, hasSecondaryRole, isDuo, isHexColor } from '../lib/svg';
import { useTheme } from '../lib/theme';
import { Button, IconButton, Segmented, useToast } from './ui';

const SIZE_PRESETS = [16, 20, 24, 32, 48, 64];
const MIN_SIZE = 8;
const MAX_SIZE = 512;
const PNG_SCALES = [1, 2, 4] as const;
const INK = { light: '#212121', dark: '#F2F2F2' };

export interface InspectorProps {
  icon: IconEntry;
  style: StyleId;
  styles: readonly StyleId[];
  source: string | undefined;
  onStyleChange: (style: StyleId) => void;
  onSelectIcon: (name: string) => void;
  onClose: () => void;
  /** Brand assets: no React package, no duo controls. */
  kind?: 'core' | 'brand';
  headingId: string;
}

function ColorField({ label, value, onChange, hint }: { label: string; value: string; onChange: (v: string) => void; hint?: string }) {
  const id = useId();
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  const valid = isHexColor(text);
  return (
    <div className="flex items-center gap-3">
      <input
        type="color"
        aria-label={`${label} picker`}
        value={value.length === 7 ? value : '#000000'}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        className="size-9 shrink-0 cursor-pointer rounded-lg border border-line-strong bg-surface p-1 [&::-webkit-color-swatch]:rounded-md [&::-webkit-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:p-0"
      />
      <div className="min-w-0 flex-1">
        <label htmlFor={id} className="block text-xs font-medium text-muted">{label}</label>
        <input
          id={id}
          value={text}
          spellCheck={false}
          aria-invalid={!valid}
          aria-describedby={hint ? `${id}-hint` : undefined}
          onChange={(e) => {
            setText(e.target.value);
            if (isHexColor(e.target.value)) onChange(e.target.value.toUpperCase());
          }}
          onBlur={() => setText(value)}
          className={`mt-0.5 h-8 w-full rounded-md border bg-surface px-2 font-mono text-sm uppercase ${valid ? 'border-line' : 'border-danger'}`}
        />
        {hint && <p id={`${id}-hint`} className="mt-1 text-xs text-faint">{hint}</p>}
      </div>
    </div>
  );
}

function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="border-t border-line px-5 py-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="font-sans text-xs font-semibold uppercase tracking-[0.08em] text-muted">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function Inspector({
  icon, style, styles, source, onStyleChange, onSelectIcon, onClose, kind = 'core', headingId,
}: InspectorProps) {
  const toast = useToast();
  const { resolved: theme } = useTheme();
  const duo = isDuo(style);
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');

  const [size, setSize] = useState(24);
  const [sizeText, setSizeText] = useState('24');
  const [mono, setMono] = useState(INK[theme]);
  const [paletteName, setPaletteName] = useState(palettes.defaultPalette);
  const [paletteMode, setPaletteMode] = useState<'light' | 'dark'>(theme);
  const [custom, setCustom] = useState<{ primary: string; secondary: string } | null>(null);
  const [modifier, setModifier] = useState<string | null>(null);
  const [scale, setScale] = useState<(typeof PNG_SCALES)[number]>(2);
  const [busy, setBusy] = useState(false);

  // Follow the site theme until the user picks a color themselves.
  const touchedMono = useRef(false);
  const touchedMode = useRef(false);
  useEffect(() => {
    if (!touchedMono.current) setMono(INK[theme]);
    if (!touchedMode.current) setPaletteMode(theme);
  }, [theme]);

  const palette = palettes.palettes.find((p) => p.name === paletteName) ?? palettes.palettes[0];
  const duoColors = custom ?? palette[paletteMode];
  const showSecondary = !!source && duo && hasSecondaryRole(source);
  const modifierDefault = source?.match(/var\(--fedora-modifier,\s*(#[0-9a-fA-F]{3,8})\)/)?.[1]?.toUpperCase() ?? null;
  const showModifier = !!source && hasModifierRole(source);

  const colors = useMemo(() => ({
    primary: duo ? duoColors.primary : mono,
    secondary: showSecondary ? duoColors.secondary : undefined,
    modifier: showModifier ? (modifier ?? modifierDefault ?? undefined) : undefined,
  }), [duo, duoColors, mono, showSecondary, showModifier, modifier, modifierDefault]);

  const build = (px: number, idPrefix?: string) => {
    if (!source) throw new Error('Icon artwork is still loading.');
    return buildSvg(source, { ...colors, size: px, idPrefix });
  };

  const preview = useMemo(() => {
    if (!source) return null;
    try {
      return {
        large: buildSvg(source, { ...colors, size: 160, idPrefix: `${uid}-l` }),
        native: buildSvg(source, { ...colors, size: 24, idPrefix: `${uid}-n` }),
        actual: buildSvg(source, { ...colors, size: Math.min(size, 128), idPrefix: `${uid}-a` }),
      };
    } catch {
      return null;
    }
  }, [source, colors, size, uid]);

  const slug = STYLE_META[style].slug;
  const baseName = `${icon.name}-${slug}`;
  const family = kind === 'core' ? modifierFamily(icon.name) : null;

  const run = async (action: () => Promise<void> | void, success: string) => {
    setBusy(true);
    try {
      await action();
      toast('success', success);
    } catch (error) {
      toast('error', error instanceof Error ? error.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  const commitSize = (value: number) => {
    const next = Math.round(Math.min(MAX_SIZE, Math.max(MIN_SIZE, value)));
    setSize(next);
    setSizeText(String(next));
  };

  const snippet = kind === 'core'
    ? reactSnippet(icon.name, style, {
      size,
      color: duo ? null : mono,
      primary: duo ? colors.primary : undefined,
      secondary: colors.secondary,
      modifier: showModifier && modifier ? modifier : undefined,
    })
    : null;

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex items-start gap-3 px-5 pb-4 pt-5">
        <div className="min-w-0 flex-1">
          <h2 id={headingId} tabIndex={-1} className="truncate text-xl font-semibold outline-none">{icon.name}</h2>
          <p className="mt-0.5 text-sm text-muted">
            {icon.category}
            {icon.composition && <> · Base <button type="button" className="text-brand underline underline-offset-2" onClick={() => onSelectIcon(icon.composition!.base)}>{icon.composition.base}</button></>}
          </p>
        </div>
        <IconButton icon="x" label="Close inspector" onClick={onClose} className="-mr-2 -mt-1" />
      </div>

      <div className="px-5 pb-4">
        <div className="checkerboard flex h-[200px] items-center justify-center rounded-2xl border border-line">
          {preview ? (
            <span role="img" aria-label={`${icon.name}, ${STYLE_META[style].label}, scaled preview`} className="glyph size-40" dangerouslySetInnerHTML={{ __html: preview.large }} />
          ) : (
            <span className="size-40 animate-pulse rounded-2xl bg-sunken" />
          )}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <figure className="flex items-center gap-3 rounded-xl border border-line px-3 py-2">
            <span className="checkerboard flex size-10 items-center justify-center rounded-lg">
              {preview && <span className="glyph size-6" dangerouslySetInnerHTML={{ __html: preview.native }} />}
            </span>
            <figcaption className="text-xs leading-tight text-muted"><strong className="block font-semibold text-ink">24px</strong>Native master</figcaption>
          </figure>
          <figure className="flex items-center gap-3 rounded-xl border border-line px-3 py-2">
            <span className="checkerboard flex size-10 items-center justify-center overflow-hidden rounded-lg">
              {preview && <span className="glyph" style={{ width: Math.min(size, 128), height: Math.min(size, 128) }} dangerouslySetInnerHTML={{ __html: preview.actual }} />}
            </span>
            <figcaption className="text-xs leading-tight text-muted"><strong className="block font-semibold text-ink">{size}px</strong>{size === 24 ? 'Selected size' : 'Scaled'}</figcaption>
          </figure>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-faint">
          All sizes scale the 24px master. Fedora has no separately authored optical sizes yet — check icons at their final size.
        </p>
      </div>

      <Section title="Style">
        <Segmented
          label="Icon style"
          size="sm"
          value={style}
          onChange={onStyleChange}
          options={styles.map((s) => ({ value: s, label: STYLE_META[s].label, title: STYLE_META[s].description }))}
        />
      </Section>

      {family && (
        <Section title="Modifier">
          <label htmlFor={`${uid}-mod`} className="sr-only">Modifier</label>
          <select
            id={`${uid}-mod`}
            value={icon.name}
            onChange={(e) => onSelectIcon(e.target.value)}
            className="h-9 w-full rounded-lg border border-line-strong bg-surface px-2 text-sm"
          >
            <option value={family.base.name}>None ({family.base.name})</option>
            {family.variants.map((v) => (
              <option key={v.name} value={v.name}>{compositionLabel(v.composition!)} — {v.name}</option>
            ))}
          </select>
          <p className="mt-2 text-xs leading-relaxed text-faint">
            Only authored compositions from the library are offered, with their designed corner and transparent clearance.
          </p>
        </Section>
      )}

      <Section title="Size">
        <div className="flex flex-wrap items-center gap-1.5">
          {SIZE_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              aria-pressed={size === preset}
              onClick={() => commitSize(preset)}
              className={`h-8 min-w-10 rounded-md px-2 text-sm tabular-nums ${size === preset ? 'bg-ink text-canvas' : 'bg-sunken text-ink hover:bg-line'}`}
            >
              {preset}
            </button>
          ))}
          <label className="ml-auto flex items-center gap-1.5 text-sm text-muted">
            <span className="sr-only">Custom size in pixels</span>
            <input
              type="number"
              inputMode="numeric"
              min={MIN_SIZE}
              max={MAX_SIZE}
              value={sizeText}
              onChange={(e) => {
                setSizeText(e.target.value);
                const n = Number(e.target.value);
                if (Number.isFinite(n) && n >= MIN_SIZE && n <= MAX_SIZE) setSize(Math.round(n));
              }}
              onBlur={() => commitSize(Number(sizeText) || 24)}
              className="h-8 w-16 rounded-md border border-line-strong bg-surface px-2 text-right text-sm tabular-nums text-ink"
            />
            px
          </label>
        </div>
      </Section>

      <Section
        title="Color"
        aside={duo && (
          <Segmented
            label="Palette variant"
            size="sm"
            value={paletteMode}
            onChange={(v) => { touchedMode.current = true; setPaletteMode(v); setCustom(null); }}
            options={[{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]}
          />
        )}
      >
        {duo ? (
          <div className="space-y-3">
            <div role="radiogroup" aria-label="Duo palette" className="flex flex-wrap gap-1.5">
              {palettes.palettes.map((p) => {
                const checked = !custom && p.name === paletteName;
                return (
                  <button
                    key={p.name}
                    type="button"
                    role="radio"
                    aria-checked={checked}
                    aria-label={p.name}
                    title={p.name}
                    onClick={() => { setPaletteName(p.name); setCustom(null); }}
                    className={`flex size-8 items-center justify-center rounded-full ring-offset-2 ring-offset-surface ${checked ? 'ring-2 ring-ink' : ''}`}
                  >
                    <span className="flex size-6 overflow-hidden rounded-full border border-line" aria-hidden="true">
                      <span className="flex-1" style={{ background: p[paletteMode].primary }} />
                      <span className="flex-1" style={{ background: p[paletteMode].secondary }} />
                    </span>
                  </button>
                );
              })}
            </div>
            <ColorField label="Primary" value={duoColors.primary} onChange={(v) => setCustom({ ...duoColors, primary: v })} />
            {showSecondary ? (
              <ColorField label="Secondary" value={duoColors.secondary} onChange={(v) => setCustom({ ...duoColors, secondary: v })} />
            ) : null}
            {style === 'duotone' && (
              <p className="text-xs leading-relaxed text-faint">Duotone keeps its 16% interior tint of the primary color.</p>
            )}
            {style === 'duocolor' && !showSecondary && (
              <p className="text-xs leading-relaxed text-faint">This icon is a single contour, so it is primary-only by design.</p>
            )}
            <p className="text-xs text-faint">{custom ? 'Custom colors' : `${palette.name} · ${paletteMode === 'light' ? 'Light' : 'Dark'}`}</p>
          </div>
        ) : (
          <ColorField
            label="Foreground"
            value={mono}
            onChange={(v) => { touchedMono.current = true; setMono(v); }}
            hint="Exports use this color. Inline SVG from the library inherits currentColor."
          />
        )}
        {showModifier && (
          <div className="mt-3">
            <ColorField
              label="Modifier glyph"
              value={modifier ?? modifierDefault ?? '#000000'}
              onChange={setModifier}
              hint={modifierDefault ? `Library default ${modifierDefault}` : undefined}
            />
          </div>
        )}
      </Section>

      <Section title="Export">
        <div className="space-y-2">
          <Button
            variant="primary"
            icon="download"
            className="h-10 w-full"
            disabled={!source || busy}
            onClick={() => run(() => downloadBlob(svgBlob(build(size)), `${baseName}.svg`), `Downloaded ${baseName}.svg`)}
          >
            Download SVG
          </Button>
          <div className="flex gap-2">
            <Button
              icon="image"
              className="flex-1"
              disabled={!source || busy}
              onClick={() => run(async () => {
                const px = size * scale;
                downloadBlob(await svgToPng(build(px), px), `${baseName}-${px}px.png`);
              }, `Downloaded ${size * scale}px transparent PNG`)}
            >
              Download PNG
            </Button>
            <label className="sr-only" htmlFor={`${uid}-scale`}>PNG scale</label>
            <select
              id={`${uid}-scale`}
              value={scale}
              onChange={(e) => setScale(Number(e.target.value) as (typeof PNG_SCALES)[number])}
              className="h-9 rounded-lg border border-line-strong bg-surface px-2 text-sm"
            >
              {PNG_SCALES.map((s) => <option key={s} value={s}>{s}× · {size * s}px</option>)}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Button className="px-2" disabled={!source || busy} onClick={() => run(() => copyText(build(size)), 'SVG copied')}>
              Copy SVG
            </Button>
            <Button
              className="px-2"
              disabled={!source || busy}
              onClick={() => run(() => copyPng(Promise.resolve().then(() => svgToPng(build(size * scale), size * scale))), 'Image copied')}
            >
              Copy image
            </Button>
            <Button className="px-2" disabled={busy} onClick={() => run(() => copyText(icon.name), `Copied “${icon.name}”`)}>
              Copy name
            </Button>
          </div>
          <p className="text-xs text-faint">PNGs have transparent backgrounds. Copy image uses the selected PNG scale.</p>
        </div>
      </Section>

      {snippet && (
        <Section
          title="React"
          aside={(
            <button type="button" className="text-xs font-medium text-brand hover:underline" onClick={() => run(() => copyText(snippet), 'React example copied')}>
              Copy
            </button>
          )}
        >
          <pre className="overflow-x-auto rounded-xl bg-sunken p-3 font-mono text-[12.5px] leading-relaxed text-ink"><code>{snippet}</code></pre>
          <p className="mt-2 text-xs leading-relaxed text-faint">
            <code className="font-mono">@fedora-icons/react</code> is not yet published to npm. <a className="text-brand underline underline-offset-2" href="/docs#react">Install from a local package</a>.
          </p>
        </Section>
      )}
      <div className="h-4" />
    </div>
  );
}

/** Desktop: a sticky side panel. Mobile: a modal bottom sheet (native dialog). */
export function InspectorFrame({
  desktop, open, onClose, headingId, children,
}: { desktop: boolean; open: boolean; onClose: () => void; headingId: string; children: ReactNode }) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (desktop || !dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open, desktop]);

  useEffect(() => {
    if (open) requestAnimationFrame(() => document.getElementById(headingId)?.focus({ preventScroll: true }));
  }, [open, headingId]);

  if (desktop) {
    if (!open) return null;
    return (
      <aside
        aria-labelledby={headingId}
        onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } }}
        className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-[380px] shrink-0 overflow-y-auto border-l border-line bg-surface lg:block"
      >
        {children}
      </aside>
    );
  }
  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={headingId}
      onCancel={(e) => { e.preventDefault(); onClose(); }}
      onClick={(e) => { if (e.target === dialogRef.current) onClose(); }}
      className="sheet m-0 mt-auto max-h-[88dvh] w-full max-w-none overflow-y-auto rounded-t-3xl border-t border-line bg-surface p-0 text-ink"
    >
      <div className="sticky top-0 z-10 flex justify-center bg-surface pb-1 pt-2" aria-hidden="true">
        <span className="h-1 w-10 rounded-full bg-line-strong" />
      </div>
      {open && children}
    </dialog>
  );
}
