import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CustomizePanel } from '../components/Customize';
import { GridHelp, IconGrid } from '../components/IconGrid';
import { Inspector, SidePane } from '../components/Inspector';
import { SelectionPanel } from '../components/SelectionPanel';
import { Button, Segmented, UiIcon } from '../components/ui';
import { brandCategories, brandEntries, brands, hasBrandStyle, loadBrands } from '../lib/brands';
import { catalog, iconsByName, loadStyle, STYLE_META, type StyleId } from '../lib/catalog';
import { CONTAINER, usePaneHost } from '../lib/layout';
import { DEFAULT_LOOK, gridVars, type Look } from '../lib/look';
import { createIndex, search } from '../lib/search';
import { prepareGridSvg } from '../lib/svg';
import { useMediaQuery, useTheme } from '../lib/theme';
import {
  BRAND_STYLES, parseState, serializeState, type CatalogState, type UrlStateConfig, type View,
} from '../lib/url-state';

const coreIndex = createIndex(catalog.icons);
const brandIndex = createIndex(brandEntries);
const brandsByName = new Map(brandEntries.map((b) => [b.name, b]));
const config: UrlStateConfig = {
  styles: catalog.styles,
  core: { categories: catalog.categories.map((c) => c.name), icons: new Set(iconsByName.keys()) },
  brands: { categories: brandCategories.map((c) => c.name), icons: new Set(brandsByName.keys()) },
};
const VIEW_OPTIONS: { value: View; label: string; title?: string }[] = [
  ...catalog.styles.map((s) => ({ value: s as View, label: STYLE_META[s].label, title: STYLE_META[s].description })),
  { value: 'brands', label: 'Brands', title: 'Brand icons in Regular and Solid' },
];
const nf = new Intl.NumberFormat('en-US');
const COLLAPSE_KEY = 'fedora-pane-collapsed';

/** Search ghost text: the prompt first, then rotating tips for every trick. */
const DESKTOP_TIPS = [
  `Search ${nf.format(catalog.icons.length)} icons by name or category`,
  'Tip: Shift-click icons to select several, then download them as a ZIP',
  'Tip: press / anywhere to jump to search',
  'Tip: arrow keys move through the grid, Enter opens an icon',
  'Tip: size, stroke, and color in the right pane apply to every icon',
  'Tip: Esc clears the search, or closes the selected icon',
  'Tip: copy the page URL to share your search, style, and icon',
];
const MOBILE_TIPS = [
  `Search ${nf.format(catalog.icons.length)} icons`,
  'Tip: tap Customize for size, stroke, and color',
  'Tip: choose a category to narrow the grid',
  'Tip: share the URL to share your search and style',
];

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
          <button type="button" aria-label="Clear search" onClick={() => { onChange(''); inputRef.current?.focus(); }} className="inline-flex size-8 items-center justify-center rounded-lg text-muted hover:bg-sunken hover:text-ink">
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
  return (
    <section aria-labelledby="brands-empty" className="rounded-2xl border border-dashed border-line-strong px-6 py-14 text-center">
      <h2 id="brands-empty" className="text-lg font-semibold">No brand icons are available yet</h2>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-muted">
        Brand artwork is published here only after its official source and redistribution
        terms are confirmed. Earlier reference drawings in the Figma file are not approved
        for distribution, so none are shown or offered for download.
      </p>
      <p className="mt-5 text-sm">
        <a className="text-brand underline underline-offset-2" href="https://github.com/fedora-icons/fedora-icons/blob/main/BRANDS.md">
          Read the brand policy
        </a>
        <span className="mx-2 text-faint">·</span>
        <a className="text-brand underline underline-offset-2" href="/docs#licensing">Licensing</a>
      </p>
    </section>
  );
}

export function IconsPage() {
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
  /** The artwork style actually drawn: a core style, or Regular/Solid within Brands. */
  const drawStyle: StyleId = brandsView ? state.brandStyle : state.style as StyleId;
  const svgKey = brandsView ? `brands:${state.brandStyle}` : drawStyle;

  const update = useCallback((patch: Partial<CatalogState>, replace = false) => {
    setParams(serializeState({ ...state, ...patch }, config), { replace, preventScrollReset: true });
  }, [setParams, state]);

  const setCollapsed = useCallback((next: boolean) => {
    setCollapsedState(next);
    try { localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0'); } catch { /* per-viewer convenience only */ }
  }, []);
  const changeLook = useCallback((patch: Partial<Look>) => setLook((l) => ({ ...l, ...patch })), []);

  useEffect(() => {
    if (brandsView && brandEntries.length === 0) return;
    let cancelled = false;
    setError(null);
    (brandsView ? loadBrands(state.brandStyle) : loadStyle(drawStyle))
      .then((data) => { if (!cancelled) setSvgs((s) => ({ ...s, [svgKey]: data })); })
      .catch((e: unknown) => { if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load icons.'); });
    return () => { cancelled = true; };
  }, [brandsView, state.brandStyle, drawStyle, svgKey, attempt]);

  const index = brandsView ? brandIndex : coreIndex;
  const results = useMemo(() => {
    const found = search(index, state.q, state.category);
    return brandsView ? found.filter((e) => hasBrandStyle(e.name, state.brandStyle)) : found;
  }, [index, state.q, state.category, brandsView, state.brandStyle]);
  const elsewhere = useMemo(
    () => (state.category && state.q && results.length === 0 ? search(index, state.q).length : 0),
    [index, state.q, state.category, results.length],
  );

  const selected = state.icon ? (brandsView ? brandsByName.get(state.icon) : iconsByName.get(state.icon)) ?? null : null;
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
  const noun = brandsView ? ['brand', 'brands'] : ['icon', 'icons'];
  const summary = state.q || state.category
    ? `${nf.format(results.length)} ${results.length === 1 ? noun[0] : noun[1]}${state.q ? ` for “${state.q.trim()}”` : ''}${state.category ? ` in ${state.category}` : ''}`
    : `${nf.format(results.length)} ${noun[1]}`;
  const total = catalog.icons.length;

  return (
    <div className={`${CONTAINER} pb-16 pt-8 sm:pt-12`}>
      <div className="mb-5 max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Find the right icon, then ship it.</h1>
        <p className="mt-2 text-base text-muted">
          {nf.format(total)} open-source icons in {catalog.styles.length} styles, drawn on a {catalog.grid}px grid with {catalog.strokeWidth}px strokes.
        </p>
      </div>

      <div className="sticky top-0 z-20 -mx-4 bg-canvas/90 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-canvas/75 sm:-mx-6 sm:px-6">
        <SearchField
          inputRef={searchRef}
          label={brandsView ? 'Search brands' : 'Search icons'}
          tips={brandsView ? ['Search brands'] : desktop ? DESKTOP_TIPS : MOBILE_TIPS}
          value={state.q}
          onChange={(q) => update({ q }, true)}
        />
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-3">
        <Segmented
          fill
          label="Icon style"
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
          options={VIEW_OPTIONS}
        />
        {brandsView && brandEntries.length > 0 && (
          <Segmented
            label="Brand style"
            value={state.brandStyle}
            onChange={(brandStyle) => update({ brandStyle })}
            options={BRAND_STYLES.map((s) => ({ value: s, label: STYLE_META[s].label }))}
          />
        )}
        {(!brandsView || brandEntries.length > 0) && (
          <p className="text-sm text-muted" aria-live="polite" aria-atomic="true">{summary}</p>
        )}
        <div className="ml-auto flex items-center gap-3">
          {!desktop && (
            <Button icon="settings-sliders" onClick={() => setCustomizeOpen(true)}>Customize</Button>
          )}
          {(!brandsView || brandEntries.length > 0) && (
            <div className="relative">
              <label htmlFor="category" className="sr-only">Category</label>
              <select
                id="category"
                value={state.category ?? ''}
                onChange={(e) => update({ category: e.target.value || null })}
                className="h-9 appearance-none rounded-lg border border-line-strong bg-surface pl-3 pr-9 text-sm font-medium text-ink"
              >
                <option value="">All categories</option>
                {categories.map((c) => (
                  <option key={c.name} value={c.name}>{c.name} ({c.count})</option>
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
          {brands.disclaimer}
        </p>
      )}

      <div className="mt-6">
        <GridHelp />
        {brandsView && brandEntries.length === 0 ? (
          <BrandsEmpty />
        ) : error ? (
          <div role="alert" className="rounded-2xl border border-line bg-surface p-8 text-center">
            <p className="font-medium">{error}</p>
            <Button className="mt-4" onClick={() => setAttempt((a) => a + 1)}>Try again</Button>
          </div>
        ) : results.length ? (
          <div style={gridVars(look, drawStyle, theme, kind) as CSSProperties}>
            <IconGrid
              label={brandsView ? 'Brand icons' : `${STYLE_META[drawStyle].label} icons`}
              items={results}
              svgs={gridSvgs}
              selected={selectedSet}
              onSelect={select}
            />
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-line-strong px-6 py-14 text-center">
            <h2 className="text-lg font-semibold">No {noun[1]} match “{state.q.trim()}”{state.category ? ` in ${state.category}` : ''}</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted">
              Try a broader or different word — search covers icon names, their library paths, and categories.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {elsewhere > 0 && (
                <Button variant="primary" onClick={() => update({ category: null })}>
                  Show {elsewhere} in all categories
                </Button>
              )}
              <Button onClick={() => { update({ q: '', category: null }); searchRef.current?.focus(); }}>Clear search and filters</Button>
            </div>
            {!brandsView && (
              <p className="mt-6 text-sm text-muted">
                Missing an icon? <a className="text-brand underline underline-offset-2" href="https://github.com/fedora-icons/fedora-icons/issues">Request it on GitHub</a>.
              </p>
            )}
          </div>
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
            styles={brandsView ? BRAND_STYLES : catalog.styles}
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
