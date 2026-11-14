import { useI18n } from '../i18n';
import { errorText, LocalizedError } from '../i18n/errors';
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  compositionLabel, modifierFamily, STYLE_META, type IconEntry, type StyleId,
} from '../lib/catalog';
import { copyText } from '../lib/export';
import { reactSnippet } from '../lib/react-snippet';
import { resolveLook, strokeAdjustable, strokeOf, type Look } from '../lib/look';
import { BASE_STROKE, buildSvg, hasFilledDetails, hasModifierRole, hasSecondaryRole, isDuo } from '../lib/svg';
import { PANE_WIDTH, usePaneWidth } from '../lib/pane-width';
import { useMediaQuery, useTheme } from '../lib/theme';
import { CodeBlock } from './CodeBlock';
import { ExportPanel } from './ExportPanel';
import { ModifierPicker, useModifiers, type ModifierChoice } from './ModifierPicker';
import { composeSvg, initialCorner, modifiersFor, type Corner } from '../lib/modifiers';
import { ColorField, CustomizeControls, Section, SizeControl } from './Customize';
import { ThemeToggle } from './ThemeToggle';
import { IconButton, Segmented, UiIcon, useToast } from './ui';

const FEEDBACK_URL = 'https://github.com/fos-icons/fosicons.com/issues/new';


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
  /** The modifier being tried (from the URL), by library name; its corner, or null for the default. */
  badgeRequest?: { name: string; corner: Corner | null } | null;
  /** Called when the user picks or clears a modifier, or moves it. */
  onBadgeChange?: (choice: { name: string; corner: Corner } | null) => void;
}

/** Largest size the inspector's scaled sample shows at 1:1; bigger sizes show at this size. */
const SAMPLE_MAX = 64;

export function Inspector({
  icon, style, styles, source: librarySource, look, onLookChange, onStyleChange, onSelectIcon, onClose, kind = 'core', headingId,
  badgeRequest = null, onBadgeChange,
}: InspectorProps) {
  const toast = useToast();
  const i18n = useI18n();
  const { t, rich, label, path } = i18n;
  const { resolved: theme } = useTheme();
  const duo = isDuo(style);
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const r = resolveLook(look, theme);
  const size = look.size;
  const desktop = useMediaQuery('(min-width: 1024px)');
  /** The "scaled" sample shows the icon at its real size, up to SAMPLE_MAX; its box is at least 40px. */
  const sampleSize = Math.min(size, SAMPLE_MAX);
  const sampleBox = Math.max(40, sampleSize);
  const strokeWidth = strokeAdjustable(style, kind) ? strokeOf(look) : undefined;

  const [modifier, setModifier] = useState<string | null>(null);
  const canTryModifiers = kind === 'core' && !icon.composition;
  const modifiers = useModifiers(canTryModifiers && !!librarySource);
  /** The modifier on the icon: the URL's request, once the library list has loaded and allows it here. */
  const badge = useMemo<ModifierChoice | null>(() => {
    if (!canTryModifiers || !badgeRequest || !modifiers.list) return null;
    const found = modifiersFor(icon.name, modifiers.list).find((m) => m.name === badgeRequest.name);
    if (!found) return null;
    const corner = badgeRequest.corner && found.positions[badgeRequest.corner] ? badgeRequest.corner : initialCorner(found);
    return { modifier: found, corner };
  }, [canTryModifiers, badgeRequest, modifiers.list, icon.name]);
  const setBadge = (choice: ModifierChoice | null) => onBadgeChange?.(choice && { name: choice.modifier.name, corner: choice.corner });
  const composed = useMemo(() => {
    if (!badge || !librarySource) return { svg: librarySource, error: null };
    try {
      return { svg: composeSvg(librarySource, badge.modifier, badge.corner, style), error: null };
    } catch (e) {
      return { svg: librarySource, error: errorText(e, i18n, 'error.compose') };
    }
  }, [badge, librarySource, style, i18n]);
  /** The artwork every preview and export uses: the library icon, plus any modifier being tried. */
  const source = composed.svg;
  const [busy, setBusy] = useState(false);

  const showSecondary = !!source && duo && hasSecondaryRole(source);
  const modifierDefault = source?.match(/var\(--fos-modifier,\s*(#[0-9a-fA-F]{3,8})\)/)?.[1]?.toUpperCase() ?? null;
  const showModifier = !!source && hasModifierRole(source);
  const filledParts = useMemo(() => !!source && hasFilledDetails(source), [source]);

  const colors = useMemo(() => ({
    primary: duo ? r.duo.primary : r.mono,
    secondary: showSecondary ? r.duo.secondary : undefined,
    modifier: showModifier ? (modifier ?? modifierDefault ?? undefined) : undefined,
  }), [duo, r.duo.primary, r.duo.secondary, r.mono, showSecondary, showModifier, modifier, modifierDefault]);

  const build = (px: number, idPrefix?: string) => {
    if (!source) throw new LocalizedError('error.loadingArtwork');
    return buildSvg(source, { ...colors, size: px, idPrefix, strokeWidth });
  };

  const stickySentinel = useRef<HTMLDivElement>(null);
  const [samplesStuck, setSamplesStuck] = useState(false);
  useEffect(() => {
    const sentinel = stickySentinel.current;
    if (!sentinel || typeof IntersectionObserver === 'undefined') return;
    // Observe against the pane's own scroll area (or the mobile sheet).
    const root = sentinel.closest('#side-pane-body, dialog');
    const observer = new IntersectionObserver(
      ([entry]) => setSamplesStuck(!entry.isIntersecting && entry.boundingClientRect.top < (entry.rootBounds?.top ?? 0) + 1),
      { root },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  const preview = useMemo(() => {
    if (!source) return null;
    try {
      return {
        large: buildSvg(source, { ...colors, size: 160, idPrefix: `${uid}-l`, strokeWidth }),
        native: buildSvg(source, { ...colors, size: 24, idPrefix: `${uid}-n`, strokeWidth }),
        actual: buildSvg(source, { ...colors, size: Math.min(size, SAMPLE_MAX), idPrefix: `${uid}-a`, strokeWidth }),
      };
    } catch {
      return null;
    }
  }, [source, colors, size, uid, strokeWidth]);

  const slug = STYLE_META[style].slug;
  const baseName = badge ? `${icon.name}-${badge.modifier.name}-${badge.corner}-${slug}` : `${icon.name}-${slug}`;
  const family = kind === 'core' ? modifierFamily(icon.name) : null;
  /** Modifiers the library authored on this base, by corner (single-modifier compositions). */
  const authored = useMemo(() => {
    const map = new Map<string, Set<Corner>>();
    const names = new Map<string, string>();
    for (const v of family?.variants ?? []) {
      const mods = v.composition!.modifiers;
      if (mods.length !== 1) continue;
      if (!map.has(mods[0].name)) map.set(mods[0].name, new Set());
      map.get(mods[0].name)!.add(mods[0].position as Corner);
      names.set(`${mods[0].name}:${mods[0].position}`, v.name);
    }
    return { map, names };
  }, [family]);
  const authoredMatch = badge ? authored.names.get(`${badge.modifier.name}:${badge.corner}`) : undefined;

  const run = async (action: () => Promise<void> | void, success: string) => {
    setBusy(true);
    try {
      await action();
      toast('success', success);
    } catch (error) {
      toast('error', errorText(error, i18n));
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
            {label('category', icon.category, icon.category)}
            {icon.composition && <> · {t('inspector.base')} <button type="button" className="text-brand underline underline-offset-2" onClick={() => onSelectIcon(icon.composition!.base)}>{icon.composition.base}</button></>}
          </p>
        </div>
        <IconButton icon="x" label={t('inspector.clear')} onClick={onClose} className="-mr-2 -mt-1" />
      </div>

      <div className="px-5 pb-2">
        <div className="checkerboard flex h-[200px] items-center justify-center rounded-2xl border border-line">
          {preview ? (
            <span role="img" aria-label={t('inspector.preview', { name: icon.name, style: t(`style.${style}`) })} data-artwork className="glyph size-40" dangerouslySetInnerHTML={{ __html: preview.large }} />
          ) : (
            <span className="size-40 animate-pulse rounded-2xl bg-sunken" />
          )}
        </div>
      </div>
      <div ref={stickySentinel} aria-hidden="true" />
      {/* Stays in view while the controls below scroll, so changes stay visible. */}
      <div
        className={`sticky top-0 z-10 bg-surface px-5 pb-4 transition-shadow [dialog_&]:top-4 ${
          samplesStuck ? 'shadow-[0_8px_12px_-10px_rgb(0_0_0/0.25)]' : ''
        }`}
      >
        <div className="grid grid-cols-2 gap-2 pt-1">
          <figure className="flex items-center gap-3 rounded-xl border border-line px-3 py-2">
            <span className="checkerboard flex size-10 items-center justify-center rounded-lg">
              {preview && <span data-artwork className="glyph size-6" dangerouslySetInnerHTML={{ __html: preview.native }} />}
            </span>
            <figcaption className="text-xs leading-tight text-muted"><strong className="block font-semibold text-ink">{t('customize.pxValue', { value: 24 })}</strong>{t('inspector.native')}</figcaption>
          </figure>
          <figure className="flex items-center gap-3 rounded-xl border border-line px-3 py-2">
            {/* Grows with the size (up to SAMPLE_MAX) so size changes, and the badge with them, are visible. */}
            <span className="checkerboard flex shrink-0 items-center justify-center overflow-hidden rounded-lg" style={{ width: sampleBox, height: sampleBox }}>
              {preview && <span data-artwork className="glyph" style={{ width: sampleSize, height: sampleSize }} dangerouslySetInnerHTML={{ __html: preview.actual }} />}
            </span>
            <figcaption className="text-xs leading-tight text-muted"><strong className="block font-semibold text-ink">{t('customize.pxValue', { value: size })}</strong>{size === 24 ? t('inspector.selectedSize') : t('inspector.scaled')}</figcaption>
          </figure>
        </div>
      </div>

      <SizeControl look={look} onChange={onLookChange} />

      {kind === 'core' && (
        <Section title={t('inspector.modifier')}>
          {icon.composition ? (
            <p className="text-sm leading-relaxed text-muted">
              {t('inspector.libraryIcon', { composition: compositionLabel(icon.composition) })}{' '}
              <button type="button" className="text-brand underline underline-offset-2" onClick={() => onSelectIcon(icon.composition!.base)}>
                {t('inspector.tryOthers', { base: icon.composition.base })}
              </button>
            </p>
          ) : modifiers.error ? (
            <p className="text-sm text-danger">{modifiers.error}</p>
          ) : !modifiers.list ? (
            <div className="h-24 animate-pulse rounded-xl bg-sunken" />
          ) : (
            <>
              <ModifierPicker modifiers={modifiersFor(icon.name, modifiers.list)} value={badge} onChange={setBadge} authored={authored.map} />
              <div aria-live="polite" className="mt-3 text-xs leading-relaxed text-faint">
                {composed.error ? (
                  <p className="text-danger">{composed.error}</p>
                ) : badge && authoredMatch ? (
                  <p>
                    {rich('inspector.authoredMatch', {
                      link: (text) => <button type="button" className="text-brand underline underline-offset-2" onClick={() => onSelectIcon(authoredMatch)}>{text}</button>,
                    }, { name: authoredMatch })}
                  </p>
                ) : badge ? (
                  <p>
                    {t('inspector.previewNote', { modifier: label('modifier', badge.modifier.name, badge.modifier.label), corner: t(`corner.${badge.corner}.inline`) })}
                    {authored.map.size > 0 && t('inspector.dotted')}
                  </p>
                ) : (
                  <p>
                    {t('inspector.pickModifier')}
                    {authored.map.size > 0 && t('inspector.dotted')}
                  </p>
                )}
              </div>
              {family && (
                <div className="mt-3">
                  <label htmlFor={`${uid}-mod`} className="mb-1 block text-xs text-muted">{t('inspector.libraryVersions')}</label>
                  <select
                    id={`${uid}-mod`}
                    value=""
                    onChange={(e) => e.target.value && onSelectIcon(e.target.value)}
                    className="h-9 w-full rounded-lg border border-line-strong bg-surface px-2 text-sm"
                  >
                    <option value="">{t('inspector.openVersion')}</option>
                    {family.variants.map((v) => (
                      <option key={v.name} value={v.name}>{compositionLabel(v.composition!)} — {v.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}
        </Section>
      )}

      {/* On desktop the grid's own style switcher sits beside the pane; the phone sheet covers it. */}
      {!desktop && (
        <Section title={t('inspector.style')}>
          <Segmented
            label={t('icons.styleSwitcher')}
            size="sm"
            value={style}
            onChange={onStyleChange}
            options={styles.map((s) => ({ value: s, label: t(`style.${s}`), title: t(`style.${s}.description`) }))}
          />
        </Section>
      )}

      <CustomizeControls
        look={look}
        onChange={onLookChange}
        showSize={false}
        style={style}
        kind={kind}
        strokeFootnote={filledParts && strokeWidth !== undefined && strokeWidth !== BASE_STROKE && (
          <p className="mt-2 rounded-lg bg-sunken px-2.5 py-2 text-xs leading-relaxed text-muted">
            {t('inspector.filledParts')}
          </p>
        )}
        footnote={(
          <>
            {style === 'duocolor' && !showSecondary && (
              <p className="text-xs leading-relaxed text-faint">{t('inspector.singleContour')}</p>
            )}
            {showModifier && (
              <div className="mt-3">
                <ColorField
                  label={t('inspector.modifierGlyph')}
                  value={modifier ?? modifierDefault ?? '#000000'}
                  onChange={setModifier}
                  hint={modifierDefault ? t('inspector.libraryDefault', { color: modifierDefault }) : undefined}
                />
              </div>
            )}
          </>
        )}
      />

      <ExportPanel
        name={icon.name}
        baseName={baseName}
        size={size}
        build={(px) => build(px)}
        disabled={!source || busy}
        run={run}
      />

      {snippet && (
        <Section
          collapsible
          defaultOpen={false}
          title={t('inspector.react')}
          aside={(
            <button type="button" className="text-xs font-medium text-brand hover:underline" onClick={() => run(() => copyText(snippet), t('inspector.reactCopied'))}>
              {t('inspector.copy')}
            </button>
          )}
        >
          <CodeBlock code={snippet} lang="tsx" />
          <p className="mt-2 text-xs leading-relaxed text-faint">
            {strokeWidth !== undefined && strokeWidth !== BASE_STROKE && (
              rich('inspector.reactStroke', { strong: (text) => <strong className="font-medium text-ink">{text}</strong> }, { base: BASE_STROKE, value: strokeWidth })
            )}
            {badge && rich('inspector.reactModifier', { strong: (text) => <strong className="font-medium text-ink">{text}</strong> }, { name: icon.name, modifier: label('modifier', badge.modifier.name, badge.modifier.label) })}
            {rich('inspector.reactInstall', {
              code: (text) => <code className="font-mono text-ink">{text}</code>,
              link: (text) => <a className="text-brand underline underline-offset-2" href={path('/docs#react')}>{text}</a>,
            })}
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
  const { t } = useI18n();
  const [width, setWidth] = usePaneWidth();
  const [resizing, setResizing] = useState(false);

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
        aria-label={t('pane.label')}
        onKeyDown={(e) => { if (e.key === 'Escape' && !collapsed) { e.stopPropagation(); onDismiss(); } }}
        style={{ width: collapsed ? undefined : width }}
        className={`sticky top-0 flex h-dvh shrink-0 flex-col overflow-hidden border-l border-line bg-surface ${
          resizing ? '' : 'transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]'
        } ${collapsed ? 'w-14' : ''}`}
      >
        {!collapsed && (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label={t('pane.resize')}
            aria-controls="side-pane-body"
            aria-valuemin={PANE_WIDTH.min}
            aria-valuemax={PANE_WIDTH.max}
            aria-valuenow={width}
            aria-valuetext={t('customize.pxValue', { value: width })}
            title={t('pane.resizeHint')}
            tabIndex={0}
            onPointerDown={(e) => {
              if (e.button !== 0) return;
              e.preventDefault();
              const startX = e.clientX;
              const startWidth = width;
              const handle = e.currentTarget;
              handle.setPointerCapture(e.pointerId);
              setResizing(true);
              // The pane sits on the right, so dragging left widens it.
              const move = (ev: PointerEvent) => setWidth(startWidth + (startX - ev.clientX), false);
              const end = (ev: PointerEvent) => {
                setWidth(startWidth + (startX - ev.clientX));
                setResizing(false);
                handle.removeEventListener('pointermove', move);
                handle.removeEventListener('pointerup', end);
                handle.removeEventListener('pointercancel', end);
              };
              handle.addEventListener('pointermove', move);
              handle.addEventListener('pointerup', end);
              handle.addEventListener('pointercancel', end);
            }}
            onDoubleClick={() => setWidth(PANE_WIDTH.default)}
            onKeyDown={(e) => {
              const next = e.key === 'ArrowLeft' ? width + PANE_WIDTH.step
                : e.key === 'ArrowRight' ? width - PANE_WIDTH.step
                  : e.key === 'Home' ? PANE_WIDTH.min
                    : e.key === 'End' ? PANE_WIDTH.max
                      : e.key === 'Enter' ? PANE_WIDTH.default : null;
              if (next === null) return;
              e.preventDefault();
              setWidth(next);
            }}
            className="group absolute inset-y-0 left-0 z-20 w-2 -translate-x-1/2 cursor-col-resize touch-none outline-none"
          >
            <span className={`absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 transition-colors group-hover:bg-brand group-focus-visible:bg-brand ${resizing ? 'bg-brand' : ''}`} />
          </div>
        )}
        <div className={`flex h-[57px] shrink-0 items-center border-b border-line px-2.5 ${collapsed ? 'justify-center' : ''}`}>
          <IconButton
            icon="layout-sidebar-right"
            label={collapsed ? t('pane.expand') : t('pane.collapse')}
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
              {t('pane.feedback')}
              <span className="sr-only">{t('pane.feedbackNewTab')}</span>
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
          style={{ width }}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
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
