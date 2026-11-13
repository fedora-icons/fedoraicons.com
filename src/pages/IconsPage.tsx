import { useI18n } from '../i18n';
import { errorText } from '../i18n/errors';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CustomizePanel } from '../components/Customize';
import { GridHelp, IconGrid } from '../components/IconGrid';
import { Inspector, SidePane } from '../components/Inspector';
import { NoResults } from '../components/NoResults';
import { SelectionPanel } from '../components/SelectionPanel';
import { Button, Segmented, UiIcon } from '../components/ui';
import { availableBrandStyles, brandCategories, brandEntries, hasBrandStyle, loadBrands } from '../lib/brands';
import { catalog, chunksFor, iconsByName, loadIconChunk, loadStyle, type StyleId } from '../lib/catalog';
import { CONTAINER, usePaneHost } from '../lib/layout';
import { DEFAULT_LOOK, gridVars, type Look } from '../lib/look';
import { createIndex, search, suggest } from '../lib/search';
import { prepareGridSvg } from '../lib/svg';
import { useMediaQuery, useTheme } from '../lib/theme';
import {
  parseState, serializeState, type CatalogState, type UrlStateConfig, type View,
} from '../lib/url-state';

const coreIndex = createIndex(catalog.icons);
const brandIndex = createIndex(brandEntries);
const brandsByName = new Map(brandEntries.map((b) => [b.name, b]));
const config: UrlStateConfig = {
  styles: catalog.styles,
  core: { categories: catalog.categories.map((c) => c.name), icons: new Set(iconsByName.keys()) },
  brands: { categories: brandCategories.map((c) => c.name), icons: new Set(brandsByName.keys()) },
};
const COLLAPSE_KEY = 'fedora-pane-collapsed';

/** Search ghost text: the prompt first, then rotating tips for every trick. */
const DESKTOP_TIPS = ['icons.tip.multi', 'icons.tip.slash', 'icons.tip.arrows', 'icons.tip.pane', 'icons.tip.esc', 'icons.tip.share'] as const;
const MOBILE_TIPS = ['icons.tip.customize', 'icons.tip.category', 'icons.tip.shareShort'] as const;

/** Focus the search box with "/" unless the user is typing somewhere. */
export function useSlashToFocus(ref: React.RefObject<HTMLInputElement | null>) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('input, textarea, select, [contenteditable="true"], dialog[open]')) return;
      if (document.querySelector('dialog[open]')) return;
      event.preventDefault();
      ref.current?.focus();
      ref.current?.select();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ref]);
}

const TIP_INTERVAL_MS = 4500;

/**
 * Ghost text that rotates through tips while the field is empty and not
 * focused. The first entry is the plain search prompt. Tips are visual
 * hints only; the field's accessible name comes from `label`.
 */
function useRotatingTip(tips: string[], paused: boolean) {
  const [index, setIndex] = useState(0);
  const count = tips.length;
  useEffect(() => {
    if (paused || count < 2) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % count), TIP_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [paused, count]);
  return { tip: tips[index % Math.max(count, 1)] ?? '', index };
}

export function SearchField({
  value, onChange, inputRef, tips, label,
}: { value: string; onChange: (v: string) => void; inputRef: React.RefObject<HTMLInputElement | null>; tips: string[]; label: string }) {
  const [focused, setFocused] = useState(false);
  const { t } = useI18n();
  const { tip, index } = useRotatingTip(tips, focused || !!value);
  return (
    <div className="relative">
      <UiIcon name="search" className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-faint" />
      <input
        ref={inputRef}
        type="search"
        aria-label={label}
        value={value}
        autoComplete="off"
        spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={(e) => { if (e.key === 'Escape' && value) { e.preventDefault(); onChange(''); } }}
        className="h-12 w-full rounded-2xl border border-line-strong bg-surface pl-12 pr-24 text-base text-ink shadow-[0_1px_2px_rgb(0_0_0/0.04)] outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/15 [&::-webkit-search-cancel-button]:hidden"
      />
      {!value && (
        <span
          key={index}
          aria-hidden="true"
          data-testid="search-tip"
          className="search-tip pointer-events-none absolute inset-y-0 left-12 right-24 flex items-center truncate text-base text-faint"
        >
          <span className="truncate">{tip}</span>
        </span>
      )}
      <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-1">
        {value ? (
          <button type="button" aria-label={t('icons.clearSearch')} onClick={() => { onChange(''); inputRef.current?.focus(); }} className="inline-flex size-8 items-center justify-center rounded-lg text-muted hover:bg-sunken hover:text-ink">
            <UiIcon name="x" className="size-[18px]" />
          </button>
        ) : (
          <kbd aria-hidden="true" className="hidden rounded-md border border-line bg-sunken px-1.5 py-0.5 text-xs text-muted sm:inline">/</kbd>
        )}
      </div>
    </div>
  );
}

function readCollapsed() {
  try { return localStorage.getItem(COLLAPSE_KEY) === '1'; } catch { return false; }
}

function BrandsEmpty() {
  const { t, path } = useI18n();
  return (
    <section aria-labelledby="brands-empty" className="rounded-2xl border border-dashed border-line-strong px-6 py-14 text-center">
      <h2 id="brands-empty" className="text-lg font-semibold">{t('brands.emptyTitle')}</h2>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-muted">
        {t('brands.emptyBody')}
      </p>
      <p className="mt-5 text-sm">
        <a className="text-brand underline underline-offset-2" href="https://github.com/fedora-icons/fedora-icons/blob/main/BRANDS.md">
          {t('brands.policy')}
        </a>
        <span className="mx-2 text-faint">·</span>
        <a className="text-brand underline underline-offset-2" href={path('/docs#licensing')}>{t('brands.licensing')}</a>
      </p>
    </section>
  );
}

export function IconsPage() {
  const i18n = useI18n();
  const { t, rich, label, list } = i18n;
  const [params, setParams] = useSearchParams();
  const state = useMemo(() => parseState(params.toString(), config), [params]);
  const [svgs, setSvgs] = useState<Record<string, Record<string, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [look, setLook] = useState<Look>(DEFAULT_LOOK);
  const [collapsed, setCollapsedState] = useState(readCollapsed);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  /** Two or more icons picked with Shift/⌘/Ctrl-click: a set to customize and download together. */
  const [multi, setMulti] = useState<string[]>([]);
  const searchRef = useRef<HTMLInputElement>(null);
  const desktop = useMediaQuery('(min-width: 1024px)');
  const paneHost = usePaneHost();
  const { resolved: theme } = useTheme();
  useSlashToFocus(searchRef);

  const brandsView = state.style === 'brands';
  const kind = brandsView ? 'brand' as const : 'core' as const;
  /** A shared Solid link falls back to Regular while no brand ships Solid. */
  const brandStyle = availableBrandStyles.includes(state.brandStyle) ? state.brandStyle : availableBrandStyles[0] ?? 'regular';
  /** The artwork style actually drawn: a core style, or Regular/Solid within Brands. */
  const drawStyle: StyleId = brandsView ? brandStyle : state.style as StyleId;
  const svgKey = brandsView ? `brands:${brandStyle}` : drawStyle;

  const update = useCallback((patch: Partial<CatalogState>, replace = false) => {
    setParams(serializeState({ ...state, ...patch }, config), { replace, preventScrollReset: true });
  }, [setParams, state]);

  const setCollapsed = useCallback((next: boolean) => {
    setCollapsedState(next);
    try { localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0'); } catch { /* per-viewer convenience only */ }
  }, []);
  const changeLook = useCallback((patch: Partial<Look>) => setLook((l) => ({ ...l, ...patch })), []);

  // Brand marks are shown as provided, so dark ones get a light backing tile
  // in the dark theme (grid, side pane, and sheet) rather than being recolored.
  useEffect(() => {
    document.documentElement.toggleAttribute('data-brand-marks', brandsView);
    return () => document.documentElement.removeAttribute('data-brand-marks');
  }, [brandsView]);

  // Core artwork loads in chunks as icons near the viewport (see IconGrid's
  // onNeed); brands are few and load at once. Without IntersectionObserver
  // (old browsers, tests) the whole style loads in one request instead.
  const lazyArtwork = !brandsView && typeof IntersectionObserver !== 'undefined';
  const mergedChunks = useRef(new Set<string>());
  const need = useCallback((names: Iterable<string>) => {
    if (!lazyArtwork) return;
    for (const chunk of chunksFor(names)) {
      const key = `${drawStyle}/${chunk}`;
      if (mergedChunks.current.has(key)) continue;
      loadIconChunk(drawStyle, chunk)
        .then((data) => {
          if (mergedChunks.current.has(key)) return;
          mergedChunks.current.add(key);
          setSvgs((s) => ({ ...s, [drawStyle]: { ...s[drawStyle], ...data } }));
        })
        .catch((e: unknown) => setError(errorText(e, i18n, 'icons.loadError')));
    }
  }, [lazyArtwork, drawStyle, attempt, i18n]); // eslint-disable-line react-hooks/exhaustive-deps -- a retry re-asks for what's in view

  useEffect(() => {
    if (lazyArtwork || (brandsView && brandEntries.length === 0)) return;
    let cancelled = false;
    setError(null);
    (brandsView ? loadBrands(brandStyle) : loadStyle(drawStyle))
      .then((data) => { if (!cancelled) setSvgs((s) => ({ ...s, [svgKey]: data })); })
      .catch((e: unknown) => { if (!cancelled) setError(errorText(e, i18n, 'icons.loadError')); });
    return () => { cancelled = true; };
  }, [lazyArtwork, brandsView, brandStyle, drawStyle, svgKey, attempt, i18n]);

  // A retry clears the failed chunks so the grid asks for them again.
  useEffect(() => { if (attempt) setError(null); }, [attempt]);

  const index = brandsView ? brandIndex : coreIndex;
  const results = useMemo(() => {
    const found = search(index, state.q, state.category);
    return brandsView ? found.filter((e) => hasBrandStyle(e.name, brandStyle)) : found;
  }, [index, state.q, state.category, brandsView, brandStyle]);
  const elsewhere = useMemo(
    () => (state.category && state.q && results.length === 0 ? search(index, state.q).length : 0),
    [index, state.q, state.category, results.length],
  );
  const noResults = !!state.q.trim() && results.length === 0;
  const suggestions = useMemo(() => (noResults ? suggest(index, state.q) : []), [noResults, index, state.q]);
  const otherCatalog = useMemo(
    () => (noResults ? search(brandsView ? coreIndex : brandIndex, state.q).length : 0),
    [noResults, brandsView, state.q],
  );

  const selected = state.icon ? (brandsView ? brandsByName.get(state.icon) : iconsByName.get(state.icon)) ?? null : null;
  // The pane and selection need their artwork even when scrolled out of view.
  useEffect(() => { need([...multi, ...(selected ? [selected.name] : [])]); }, [need, multi, selected]);
  const styleSvgs = svgs[svgKey] ?? null;
  const gridSvgs = useMemo(
    () => (styleSvgs ? Object.fromEntries(Object.entries(styleSvgs).map(([k, v]) => [k, prepareGridSvg(v)])) : null),
    [styleSvgs],
  );

  const multiActive = multi.length >= 2;
  const selectedSet = useMemo(
    () => new Set(multiActive ? multi : state.icon ? [state.icon] : []),
    [multiActive, multi, state.icon],
  );

  // A single icon chosen any other way (Back, a link, the modifier menu) ends a set.
  useEffect(() => {
    if (state.icon) setMulti([]);
  }, [state.icon]);

  // Selecting always reveals the pane.
  useEffect(() => {
    if ((selected || multiActive) && collapsed && desktop) setCollapsed(false);
  }, [selected, multiActive, collapsed, desktop, setCollapsed]);

  /**
   * Plain click opens one icon (or closes it again). Shift/⌘/Ctrl-click
   * toggles an icon in the set; the set starts from the open icon.
   */
  const select = useCallback((name: string, additive: boolean) => {
    if (!additive) {
      setMulti([]);
      update({ icon: !multiActive && name === state.icon ? null : name });
      return;
    }
    const base = multiActive ? multi : state.icon ? [state.icon] : [];
    const next = base.includes(name) ? base.filter((n) => n !== name) : [...base, name];
    if (next.length >= 2) {
      setMulti(next);
      if (state.icon) update({ icon: null });
    } else {
      setMulti([]);
      update({ icon: next[0] ?? null });
    }
  }, [multi, multiActive, state.icon, update]);

  const close = useCallback(() => {
    const name = state.icon;
    update({ icon: null });
    requestAnimationFrame(() => {
      const cell = Array.from(document.querySelectorAll<HTMLButtonElement>('button[data-icon]')).find((b) => b.dataset.icon === name);
      (cell ?? searchRef.current)?.focus();
    });
  }, [state.icon, update]);

  const categories = brandsView ? brandCategories : catalog.categories;
  const counted = t(brandsView ? 'icons.brandCount' : 'icons.count', { count: results.length });
  const query = state.q.trim();
  const categoryName = state.category ? label('category', state.category, state.category) : '';
  const summary = query && categoryName ? t('icons.summaryForIn', { results: counted, query, category: categoryName })
    : query ? t('icons.summaryFor', { results: counted, query })
      : categoryName ? t('icons.summaryIn', { results: counted, category: categoryName })
        : counted;
  const viewOptions: { value: View; label: string; title?: string }[] = [
    ...catalog.styles.map((s) => ({ value: s as View, label: t(`style.${s}`), title: t(`style.${s}.description`) })),
    { value: 'brands', label: t('style.brands'), title: t('style.brands.description') },
  ];
  const tips = brandsView
    ? [t('icons.searchBrands')]
    : [t(desktop ? 'icons.tip.search' : 'icons.tip.searchShort', { count: catalog.icons.length }), ...(desktop ? DESKTOP_TIPS : MOBILE_TIPS).map((k) => t(k))];
  const total = catalog.icons.length;

  return (
    <div className={`${CONTAINER} pb-16 pt-8 sm:pt-12`}>
      <div className="mb-5 max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {rich('icons.headline', { em: (text) => <span className="text-brand">{text}</span> })}
        </h1>
        <p className="mt-2 text-base text-muted">
          {t('icons.intro', { count: total, styles: list(catalog.styles.map((s) => t(`style.${s}`))) })}
        </p>
      </div>

      <div className="sticky top-0 z-20 -mx-4 bg-canvas/90 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-canvas/75 sm:-mx-6 sm:px-6">
        <SearchField
          inputRef={searchRef}
          label={brandsView ? t('icons.searchBrands') : t('icons.searchIcons')}
          tips={tips}
          value={state.q}
          onChange={(q) => update({ q }, true)}
        />
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Segmented
          fill
          label={t('icons.styleSwitcher')}
          value={state.style}
          onChange={(style) => {
            if ((style === 'brands') === brandsView) {
              update({ style });
              return;
            }
            // Core icons and brands are different catalogs: drop what does not carry over.
            setMulti([]);
            update({ style, category: null, icon: null });
          }}
          options={viewOptions}
        />
        {brandsView && availableBrandStyles.length > 1 && (
          <Segmented
            label={t('icons.brandStyle')}
            value={brandStyle}
            onChange={(brandStyle) => update({ brandStyle })}
            options={availableBrandStyles.map((s) => ({ value: s, label: t(`style.${s}`) }))}
          />
        )}
        {(!brandsView || brandEntries.length > 0) && (
          <p className="sr-only" aria-live="polite" aria-atomic="true">{summary}</p>
        )}
        <div className="ml-auto flex items-center gap-3">
          {!desktop && (
            <Button icon="settings-sliders" onClick={() => setCustomizeOpen(true)}>{t('icons.customize')}</Button>
          )}
          {(!brandsView || brandEntries.length > 0) && (
            <div className="relative">
              <label htmlFor="category" className="sr-only">{t('icons.category')}</label>
              <select
                id="category"
                value={state.category ?? ''}
                onChange={(e) => update({ category: e.target.value || null })}
                className="h-9 appearance-none rounded-lg border border-line-strong bg-surface pl-3 pr-9 text-sm font-medium text-ink"
              >
                <option value="">{t('icons.allCategories')}</option>
                {categories.map((c) => (
                  <option key={c.name} value={c.name}>{t('icons.categoryOption', { name: label('category', c.name, c.name), count: c.count })}</option>
                ))}
              </select>
              <UiIcon name="chevron-down" className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
            </div>
          )}
        </div>
      </div>

      {brandsView && (
        <p className="mt-4 inline-flex items-center gap-2 rounded-lg bg-sunken px-3 py-1.5 text-sm font-medium text-ink">
          <UiIcon name="info-circle" className="size-4 text-muted" />
          {t('icons.brandDisclaimer')}
        </p>
      )}

      <div className="mt-6">
        <GridHelp />
        {brandsView && brandEntries.length === 0 ? (
          <BrandsEmpty />
        ) : error ? (
          <div role="alert" className="rounded-2xl border border-line bg-surface p-8 text-center">
            <p className="font-medium">{error}</p>
            <Button className="mt-4" onClick={() => setAttempt((a) => a + 1)}>{t('icons.tryAgain')}</Button>
          </div>
        ) : results.length ? (
          <div style={gridVars(look, drawStyle, theme, kind) as CSSProperties}>
            <IconGrid
              label={brandsView ? t('icons.brandGridLabel') : t('icons.gridLabel', { style: t(`style.${drawStyle}`) })}
              items={results}
              svgs={gridSvgs}
              selected={selectedSet}
              onSelect={select}
              onNeed={lazyArtwork ? need : undefined}
            />
          </div>
        ) : (
          <NoResults
            query={state.q}
            category={state.category}
            noun={t(brandsView ? 'noResults.nounBrands' : 'noResults.nounIcons')}
            brandsView={brandsView}
            suggestions={suggestions}
            svgs={gridSvgs}
            elsewhere={elsewhere}
            otherCatalog={otherCatalog}
            onSearch={(q) => update({ q, category: null })}
            onShowAllCategories={() => update({ category: null })}
            onSwitchCatalog={() => { setMulti([]); update({ style: brandsView ? catalog.styles[0] : 'brands', category: null, icon: null }); }}
            onClear={() => { update({ q: '', category: null }); searchRef.current?.focus(); }}
          />
        )}
      </div>

      <SidePane
        desktop={desktop}
        host={paneHost}
        collapsed={collapsed}
        onCollapsedChange={setCollapsed}
        sheetOpen={multiActive || !!selected || customizeOpen}
        onDismiss={() => (multiActive ? setMulti([]) : selected ? close() : setCustomizeOpen(false))}
        headingId="pane-heading"
        focusKey={selected?.name ?? null}
      >
        {multiActive ? (
          <SelectionPanel
            names={multi}
            style={drawStyle}
            kind={kind}
            svgs={styleSvgs}
            look={look}
            onLookChange={changeLook}
            onRemove={(name) => select(name, true)}
            onClear={() => setMulti([])}
            headingId="pane-heading"
          />
        ) : selected ? (
          <Inspector
            key={`${kind}:${selected.name}`}
            kind={kind}
            icon={selected}
            style={drawStyle}
            styles={brandsView ? availableBrandStyles.filter((s) => hasBrandStyle(selected.name, s)) : catalog.styles}
            source={styleSvgs?.[selected.name]}
            look={look}
            onLookChange={changeLook}
            onStyleChange={(style) => update(brandsView ? { brandStyle: style as 'regular' | 'filled' } : { style })}
            onSelectIcon={(icon) => update({ icon })}
            onClose={close}
            headingId="pane-heading"
          />
        ) : (
          <CustomizePanel
            look={look}
            onChange={changeLook}
            onReset={() => setLook(DEFAULT_LOOK)}
            onClose={desktop ? undefined : () => setCustomizeOpen(false)}
            style={drawStyle}
            kind={kind}
            headingId="pane-heading"
          />
        )}
      </SidePane>
    </div>
  );
}
