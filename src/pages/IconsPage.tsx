import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { GridHelp, IconGrid } from '../components/IconGrid';
import { Inspector, InspectorFrame } from '../components/Inspector';
import { Button, Segmented, UiIcon } from '../components/ui';
import { catalog, iconsByName, loadStyle, STYLE_META, type StyleId } from '../lib/catalog';
import { createIndex, search } from '../lib/search';
import { useMediaQuery } from '../lib/theme';
import { parseState, serializeState, type CatalogState } from '../lib/url-state';

const index = createIndex(catalog.icons);
const config = {
  styles: catalog.styles,
  categories: catalog.categories.map((c) => c.name),
  icons: new Set(iconsByName.keys()),
};
const nf = new Intl.NumberFormat('en-US');

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

export function SearchField({
  value, onChange, inputRef, placeholder, label,
}: { value: string; onChange: (v: string) => void; inputRef: React.RefObject<HTMLInputElement | null>; placeholder: string; label: string }) {
  return (
    <div className="relative">
      <UiIcon name="search" className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-faint" />
      <input
        ref={inputRef}
        type="search"
        aria-label={label}
        placeholder={placeholder}
        value={value}
        autoComplete="off"
        spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Escape' && value) { e.preventDefault(); onChange(''); } }}
        className="h-12 w-full rounded-2xl border border-line-strong bg-surface pl-12 pr-24 text-base text-ink shadow-[0_1px_2px_rgb(0_0_0/0.04)] outline-none transition placeholder:text-faint focus:border-brand focus:ring-4 focus:ring-brand/15 [&::-webkit-search-cancel-button]:hidden"
      />
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

export function IconsPage() {
  const [params, setParams] = useSearchParams();
  const state = useMemo(() => parseState(params.toString(), config), [params]);
  const [svgs, setSvgs] = useState<Partial<Record<StyleId, Record<string, string>>>>({});
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const desktop = useMediaQuery('(min-width: 1024px)');
  useSlashToFocus(searchRef);

  const update = useCallback((patch: Partial<CatalogState>, replace = false) => {
    setParams(serializeState({ ...state, ...patch }, config), { replace, preventScrollReset: true });
  }, [setParams, state]);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    loadStyle(state.style)
      .then((data) => { if (!cancelled) setSvgs((s) => ({ ...s, [state.style]: data })); })
      .catch((e: unknown) => { if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load icons.'); });
    return () => { cancelled = true; };
  }, [state.style, attempt]);

  const results = useMemo(() => search(index, state.q, state.category), [state.q, state.category]);
  const elsewhere = useMemo(
    () => (state.category && state.q && results.length === 0 ? search(index, state.q).length : 0),
    [state.q, state.category, results.length],
  );

  const selected = state.icon ? iconsByName.get(state.icon) ?? null : null;
  const styleSvgs = svgs[state.style] ?? null;

  const close = useCallback(() => {
    const name = state.icon;
    update({ icon: null });
    requestAnimationFrame(() => {
      const cell = document.querySelector<HTMLButtonElement>(`button[data-icon="${CSS.escape(name ?? '')}"]`);
      (cell ?? searchRef.current)?.focus();
    });
  }, [state.icon, update]);

  const summary = state.q || state.category
    ? `${nf.format(results.length)} ${results.length === 1 ? 'icon' : 'icons'}${state.q ? ` for “${state.q.trim()}”` : ''}${state.category ? ` in ${state.category}` : ''}`
    : `${nf.format(results.length)} icons`;

  return (
    <div className="flex">
      <div className="min-w-0 flex-1">
        <div className="mx-auto max-w-[1100px] px-4 pb-16 pt-8 sm:px-6 sm:pt-12">
          <div className="mb-6 max-w-2xl">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Find the right icon, then ship it.</h1>
            <p className="mt-2 text-base text-muted">
              {nf.format(catalog.icons.length)} open-source icons in {catalog.styles.length} styles, drawn on a {catalog.grid}px grid with {catalog.strokeWidth}px strokes.
            </p>
          </div>

          <SearchField
            inputRef={searchRef}
            label="Search icons"
            placeholder={desktop ? `Search ${nf.format(catalog.icons.length)} icons by name, synonym, or category` : `Search ${nf.format(catalog.icons.length)} icons`}
            value={state.q}
            onChange={(q) => update({ q }, true)}
          />

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Segmented
              label="Icon style"
              value={state.style}
              onChange={(style) => update({ style })}
              options={catalog.styles.map((s) => ({ value: s, label: STYLE_META[s].label, title: STYLE_META[s].description }))}
            />
            <div className="relative">
              <label htmlFor="category" className="sr-only">Category</label>
              <select
                id="category"
                value={state.category ?? ''}
                onChange={(e) => update({ category: e.target.value || null })}
                className="h-9 appearance-none rounded-lg border border-line-strong bg-surface pl-3 pr-9 text-sm font-medium text-ink"
              >
                <option value="">All categories</option>
                {catalog.categories.map((c) => (
                  <option key={c.name} value={c.name}>{c.name} ({c.count})</option>
                ))}
              </select>
              <UiIcon name="chevron-down" className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
            </div>
            <p className="ml-auto text-sm text-muted" aria-live="polite" aria-atomic="true">{summary}</p>
          </div>

          <div className="mt-6">
            <GridHelp />
            {error ? (
              <div role="alert" className="rounded-2xl border border-line bg-surface p-8 text-center">
                <p className="font-medium">{error}</p>
                <Button className="mt-4" onClick={() => setAttempt((a) => a + 1)}>Try again</Button>
              </div>
            ) : results.length ? (
              <IconGrid
                label={`${STYLE_META[state.style].label} icons`}
                items={results}
                svgs={styleSvgs}
                selected={state.icon}
                onSelect={(icon) => update({ icon: icon === state.icon ? null : icon })}
              />
            ) : (
              <div className="rounded-2xl border border-dashed border-line-strong px-6 py-14 text-center">
                <h2 className="text-lg font-semibold">No icons match “{state.q.trim()}”{state.category ? ` in ${state.category}` : ''}</h2>
                <p className="mx-auto mt-2 max-w-md text-sm text-muted">
                  Try a broader word or a synonym — search covers names, aliases, tags, and categories.
                </p>
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  {elsewhere > 0 && (
                    <Button variant="primary" onClick={() => update({ category: null })}>
                      Show {elsewhere} in all categories
                    </Button>
                  )}
                  <Button onClick={() => { update({ q: '', category: null }); searchRef.current?.focus(); }}>Clear search and filters</Button>
                </div>
                <p className="mt-6 text-sm text-muted">
                  Missing an icon? <a className="text-brand underline underline-offset-2" href="https://github.com/fedora-icons/fedora-icons/issues">Request it on GitHub</a>.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <InspectorFrame desktop={desktop} open={!!selected} onClose={close} headingId="inspector-heading">
        {selected && (
          <Inspector
            icon={selected}
            style={state.style}
            styles={catalog.styles}
            source={styleSvgs?.[selected.name]}
            onStyleChange={(style) => update({ style })}
            onSelectIcon={(icon) => update({ icon })}
            onClose={close}
            headingId="inspector-heading"
          />
        )}
      </InspectorFrame>
    </div>
  );
}
