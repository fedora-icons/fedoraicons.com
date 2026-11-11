import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import brandData from '../data/brands.json';
import { GridHelp, IconGrid } from '../components/IconGrid';
import { Inspector, InspectorFrame } from '../components/Inspector';
import { Segmented, UiIcon } from '../components/ui';
import { STYLE_META, type IconEntry, type StyleId } from '../lib/catalog';
import { createIndex, search } from '../lib/search';
import { useMediaQuery } from '../lib/theme';
import { parseState, serializeState } from '../lib/url-state';
import { SearchField, useSlashToFocus } from './IconsPage';

/** Brands offer Regular and Solid only — never the duo styles. */
const BRAND_STYLES: StyleId[] = ['regular', 'filled'];

export interface BrandEntry {
  name: string;
  owner: string;
  category: string;
  aliases?: string[];
  officialSource: string;
  retrieved: string;
  terms: string;
  /** Paths under public/, per style. Filled is optional. */
  files: Partial<Record<'regular' | 'filled', string>>;
}

const brands = brandData as { disclaimer: string; approved: BrandEntry[] };

export default function BrandsPage() {
  const entries: IconEntry[] = useMemo(() => brands.approved.map((b) => ({
    name: b.name, category: b.category, tags: [b.owner.toLowerCase()], aliases: b.aliases ?? [],
  })), []);
  const index = useMemo(() => createIndex(entries), [entries]);
  const config = useMemo(() => ({
    styles: BRAND_STYLES,
    categories: [...new Set(entries.map((e) => e.category))],
    icons: new Set(entries.map((e) => e.name)),
  }), [entries]);

  const [params, setParams] = useSearchParams();
  const state = parseState(params.toString(), config);
  const update = (patch: Partial<typeof state>, replace = false) =>
    setParams(serializeState({ ...state, ...patch }, config), { replace });
  const searchRef = useRef<HTMLInputElement>(null);
  const desktop = useMediaQuery('(min-width: 1024px)');
  useSlashToFocus(searchRef);

  const [svgs, setSvgs] = useState<Record<string, string>>({});
  useEffect(() => {
    let cancelled = false;
    Promise.all(brands.approved.map(async (b) => {
      const file = b.files[state.style as 'regular' | 'filled'];
      if (!file) return null;
      const res = await fetch(`${import.meta.env.BASE_URL}${file}`);
      return res.ok ? [b.name, await res.text()] as const : null;
    })).then((rows) => {
      if (!cancelled) setSvgs(Object.fromEntries(rows.filter((r) => r !== null)));
    });
    return () => { cancelled = true; };
  }, [state.style]);

  const available = entries.filter((e) => brands.approved.find((b) => b.name === e.name)?.files[state.style as 'regular' | 'filled']);
  const results = search(index, state.q, state.category).filter((e) => available.includes(e));
  const selected = state.icon ? available.find((e) => e.name === state.icon) ?? null : null;
  const close = () => update({ icon: null });

  return (
    <div className="flex">
      <div className="min-w-0 flex-1">
        <div className="mx-auto max-w-[1100px] px-4 pb-16 pt-8 sm:px-6 sm:pt-12">
          <div className="mb-6 max-w-2xl">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Brands</h1>
            <p className="mt-2 text-base text-muted">
              Brand icons in Regular and Solid, kept separate from the MIT-licensed core.
            </p>
            <p className="mt-3 inline-flex items-center gap-2 rounded-lg bg-sunken px-3 py-1.5 text-sm font-medium text-ink">
              <UiIcon name="info-circle" className="size-4 text-muted" />
              {brands.disclaimer}
            </p>
          </div>

          {entries.length === 0 ? (
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
          ) : (
            <>
              <SearchField inputRef={searchRef} label="Search brands" placeholder="Search brands" value={state.q} onChange={(q) => update({ q }, true)} />
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Segmented
                  label="Brand style"
                  value={state.style}
                  onChange={(style) => update({ style })}
                  options={BRAND_STYLES.map((s) => ({ value: s, label: STYLE_META[s].label }))}
                />
                <p className="ml-auto text-sm text-muted" aria-live="polite">{results.length} brands</p>
              </div>
              <div className="mt-6">
                <GridHelp />
                {results.length ? (
                  <IconGrid label="Brand icons" items={results} svgs={svgs} selected={state.icon} onSelect={(icon) => update({ icon })} />
                ) : (
                  <p className="rounded-2xl border border-dashed border-line-strong px-6 py-14 text-center text-muted">No brands match “{state.q}”.</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
      <InspectorFrame desktop={desktop} open={!!selected} onClose={close} headingId="brand-inspector-heading">
        {selected && (
          <Inspector
            kind="brand"
            icon={selected}
            style={state.style}
            styles={BRAND_STYLES}
            source={svgs[selected.name]}
            onStyleChange={(style) => update({ style })}
            onSelectIcon={(icon) => update({ icon })}
            onClose={close}
            headingId="brand-inspector-heading"
          />
        )}
      </InspectorFrame>
    </div>
  );
}
