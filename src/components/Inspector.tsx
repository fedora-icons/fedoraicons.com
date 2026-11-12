import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  compositionLabel, modifierFamily, STYLE_META, type IconEntry, type StyleId,
} from '../lib/catalog';
import { copyPng, copyText, downloadBlob, svgBlob, svgToPng } from '../lib/export';
import { reactSnippet } from '../lib/react-snippet';
import { resolveLook, strokeAdjustable, strokeOf, type Look } from '../lib/look';
import { BASE_STROKE, buildSvg, hasFilledDetails, hasModifierRole, hasSecondaryRole, isDuo } from '../lib/svg';
import { useTheme } from '../lib/theme';
import { CodeBlock } from './CodeBlock';
import { ColorField, CustomizeControls, Section } from './Customize';
import { ThemeToggle } from './ThemeToggle';
import { Button, IconButton, Segmented, UiIcon, useToast } from './ui';

const FEEDBACK_URL = 'https://github.com/fedora-icons/fedoraicons.com/issues/new';

const PNG_SCALES = [1, 2, 4] as const;

export interface InspectorProps {
  icon: IconEntry;
  style: StyleId;
  styles: readonly StyleId[];
  source: string | undefined;
  look: Look;
  onLookChange: (patch: Partial<Look>) => void;
  onStyleChange: (style: StyleId) => void;
  onSelectIcon: (name: string) => void;
  onClose: () => void;
  /** Brand assets: no React package, no duo controls, no stroke control. */
  kind?: 'core' | 'brand';
  headingId: string;
}

export function Inspector({
  icon, style, styles, source, look, onLookChange, onStyleChange, onSelectIcon, onClose, kind = 'core', headingId,
}: InspectorProps) {
  const toast = useToast();
  const { resolved: theme } = useTheme();
  const duo = isDuo(style);
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const r = resolveLook(look, theme);
  const size = look.size;
  const strokeWidth = strokeAdjustable(style, kind) ? strokeOf(look) : undefined;

  const [modifier, setModifier] = useState<string | null>(null);
  const [scale, setScale] = useState<(typeof PNG_SCALES)[number]>(2);
  const [busy, setBusy] = useState(false);

  const showSecondary = !!source && duo && hasSecondaryRole(source);
  const modifierDefault = source?.match(/var\(--fedora-modifier,\s*(#[0-9a-fA-F]{3,8})\)/)?.[1]?.toUpperCase() ?? null;
  const showModifier = !!source && hasModifierRole(source);
  const filledParts = useMemo(() => !!source && hasFilledDetails(source), [source]);

  const colors = useMemo(() => ({
    primary: duo ? r.duo.primary : r.mono,
    secondary: showSecondary ? r.duo.secondary : undefined,
    modifier: showModifier ? (modifier ?? modifierDefault ?? undefined) : undefined,
  }), [duo, r.duo.primary, r.duo.secondary, r.mono, showSecondary, showModifier, modifier, modifierDefault]);

  const build = (px: number, idPrefix?: string) => {
    if (!source) throw new Error('Icon artwork is still loading.');
    return buildSvg(source, { ...colors, size: px, idPrefix, strokeWidth });
  };

  const preview = useMemo(() => {
    if (!source) return null;
    try {
      return {
        large: buildSvg(source, { ...colors, size: 160, idPrefix: `${uid}-l`, strokeWidth }),
        native: buildSvg(source, { ...colors, size: 24, idPrefix: `${uid}-n`, strokeWidth }),
        actual: buildSvg(source, { ...colors, size: Math.min(size, 128), idPrefix: `${uid}-a`, strokeWidth }),
      };
    } catch {
      return null;
    }
  }, [source, colors, size, uid, strokeWidth]);

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

  const snippet = kind === 'core'
    ? reactSnippet(icon.name, style, {
      size,
      color: duo ? null : look.mono,
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
        <IconButton icon="x" label="Clear selection" onClick={onClose} className="-mr-2 -mt-1" />
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

      <CustomizeControls
        look={look}
        onChange={onLookChange}
        style={style}
        kind={kind}
        strokeFootnote={filledParts && strokeWidth !== undefined && strokeWidth !== BASE_STROKE && (
          <p className="mt-2 rounded-lg bg-sunken px-2.5 py-2 text-xs leading-relaxed text-muted">
            Parts of this icon are drawn as filled shapes, so they keep their drawn weight while its lines change.
          </p>
        )}
        footnote={(
          <>
            {style === 'duocolor' && !showSecondary && (
              <p className="text-xs leading-relaxed text-faint">This icon is a single contour, so it is primary-only by design.</p>
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
          </>
        )}
      />

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
          <p className="text-xs text-faint">Shift-click more icons in the grid to download several as a ZIP.</p>
        </div>
      </Section>

      {snippet && (
        <Section
          collapsible
          defaultOpen={false}
          title="React"
          aside={(
            <button type="button" className="text-xs font-medium text-brand hover:underline" onClick={() => run(() => copyText(snippet), 'React example copied')}>
              Copy
            </button>
          )}
        >
          <CodeBlock code={snippet} lang="tsx" />
          <p className="mt-2 text-xs leading-relaxed text-faint">
            {strokeWidth !== undefined && strokeWidth !== BASE_STROKE && (
              <><strong className="font-medium text-ink">The React package draws the standard {BASE_STROKE}px stroke at every size</strong>; use Download SVG to keep this {strokeWidth}px stroke. </>
            )}
            Install with <code className="font-mono text-ink">npm install @fedora-icons/react</code>. <a className="text-brand underline underline-offset-2" href="/docs#react">React docs</a>.
          </p>
        </Section>
      )}
      <div className="h-4" />
    </div>
  );
}

/**
 * Desktop: a persistent, collapsible side pane rendered into the layout's
 * pane slot (full height, beside the page). Mobile: a modal bottom sheet.
 */
export function SidePane({
  desktop, host, collapsed, onCollapsedChange, sheetOpen, onDismiss, headingId, focusKey, children,
}: {
  desktop: boolean;
  host: HTMLElement | null;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  /** Mobile only: whether the sheet is showing. */
  sheetOpen: boolean;
  /** Escape / backdrop: clear the selection or close the sheet. */
  onDismiss: () => void;
  headingId: string;
  /** Focus the pane heading whenever this changes to a non-null value. */
  focusKey: string | null;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (desktop || !dialog) return;
    if (sheetOpen && !dialog.open) dialog.showModal();
    if (!sheetOpen && dialog.open) dialog.close();
  }, [sheetOpen, desktop]);

  useEffect(() => {
    if (focusKey === null) return;
    requestAnimationFrame(() => document.getElementById(headingId)?.focus({ preventScroll: true }));
  }, [focusKey, headingId]);

  if (desktop) {
    if (!host) return null;
    return createPortal(
      <aside
        aria-label="Icon panel"
        onKeyDown={(e) => { if (e.key === 'Escape' && !collapsed) { e.stopPropagation(); onDismiss(); } }}
        className={`sticky top-0 flex h-dvh shrink-0 flex-col overflow-hidden border-l border-line bg-surface transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          collapsed ? 'w-14' : 'w-[380px]'
        }`}
      >
        <div className={`flex h-14 shrink-0 items-center border-b border-line px-2.5 ${collapsed ? 'justify-center' : ''}`}>
          <IconButton
            icon="layout-sidebar-right"
            label={collapsed ? 'Expand panel' : 'Collapse panel'}
            aria-expanded={!collapsed}
            aria-controls="side-pane-body"
            onClick={() => onCollapsedChange(!collapsed)}
          />
          {!collapsed && <ThemeToggle />}
          {!collapsed && (
            <a
              href={FEEDBACK_URL}
              target="_blank"
              rel="noreferrer"
              className="ml-auto inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium text-ink transition hover:bg-sunken"
            >
              <UiIcon name="message-smile-square" className="size-5" />
              Feedback
              <span className="sr-only"> (opens GitHub in a new tab)</span>
            </a>
          )}
        </div>
        {collapsed && (
          <div className="flex justify-center pt-2.5">
            <ThemeToggle />
          </div>
        )}
        <div
          id="side-pane-body"
          hidden={collapsed}
          className="min-h-0 w-[380px] flex-1 overflow-y-auto overscroll-contain"
        >
          {children}
        </div>
      </aside>,
      host,
    );
  }
  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={headingId}
      onCancel={(e) => { e.preventDefault(); onDismiss(); }}
      onClick={(e) => { if (e.target === dialogRef.current) onDismiss(); }}
      className="sheet m-0 mt-auto max-h-[88dvh] w-full max-w-none overflow-y-auto rounded-t-3xl border-t border-line bg-surface p-0 text-ink"
    >
      <div className="sticky top-0 z-10 flex justify-center bg-surface pb-1 pt-2" aria-hidden="true">
        <span className="h-1 w-10 rounded-full bg-line-strong" />
      </div>
      {sheetOpen && children}
    </dialog>
  );
}
