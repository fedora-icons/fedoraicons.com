import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UiIcon, type UiIconName } from '../components/ui';
import { catalog } from '../lib/catalog';
import { CONTAINER } from '../lib/layout';

const nf = new Intl.NumberFormat('en-US');

/** The tiles around the gap: real library glyphs, one slot left empty. */
const TILES: (UiIconName | null)[] = [
  'compass', 'map', 'route', 'search',
  'book-open', null, 'sparkles', 'home',
  'palette', 'binoculars', 'lightbulb', 'link',
];

/** Largest categories first, as places to start. */
const POPULAR = [...catalog.categories].sort((a, b) => b.count - a.count).slice(0, 8);

export default function NotFoundPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const q = query.trim();
    navigate(q ? `/?${new URLSearchParams({ q })}` : '/');
  };

  return (
    <div className={`${CONTAINER} pb-24 pt-12 sm:pt-20`}>
      <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full bg-brand-soft px-3 py-1 text-sm font-medium text-brand">
            <span className="font-mono">404</span>
            <span aria-hidden="true">·</span>
            Page not found
          </p>
          <h1 className="mt-5 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
            This page went <span className="text-brand">off the grid</span>.
          </h1>
          <p className="mt-4 max-w-lg text-base text-muted sm:text-lg">
            The link may be old or mistyped. All {nf.format(catalog.icons.length)} icons are still here. Search for one, or pick a place to start.
          </p>

          <form role="search" onSubmit={submit} className="mt-8 flex max-w-lg gap-2">
            <label htmlFor="not-found-search" className="sr-only">Search icons</label>
            <div className="relative flex-1">
              <UiIcon name="search" className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-muted" />
              <input
                id="not-found-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search icons, e.g. arrow, calendar"
                className="h-11 w-full rounded-xl border border-line-strong bg-surface pl-11 pr-3 text-base text-ink outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/15"
              />
            </div>
            <button type="submit" className="h-11 rounded-xl bg-brand px-4 text-sm font-medium text-brand-ink transition hover:brightness-110">
              Search
            </button>
          </form>

          <nav aria-label="Places to go" className="mt-6 flex flex-wrap gap-2">
            <Link to="/" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-3 text-sm font-medium text-ink transition hover:bg-sunken">
              <UiIcon name="home" className="size-4" /> Browse all icons
            </Link>
            <Link to="/docs" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-3 text-sm font-medium text-ink transition hover:bg-sunken">
              <UiIcon name="book-open" className="size-4" /> Read the docs
            </Link>
            <Link to="/?style=brands" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-3 text-sm font-medium text-ink transition hover:bg-sunken">
              <UiIcon name="sparkles" className="size-4" /> Brand icons
            </Link>
          </nav>
        </div>

        {/* A 4×3 board of icon tiles with one tile missing: the page that isn't there. */}
        <div aria-hidden="true" className="relative mx-auto w-full max-w-md">
          <div className="absolute -inset-6 rounded-[2rem] [background-image:linear-gradient(var(--c-line)_1px,transparent_1px),linear-gradient(90deg,var(--c-line)_1px,transparent_1px)] [background-size:24px_24px] [mask-image:radial-gradient(closest-side,black,transparent)]" />
          <div className="relative grid grid-cols-4 gap-3">
            {TILES.map((name, i) => (name ? (
              <div key={name} className="flex aspect-square items-center justify-center rounded-2xl border border-line bg-surface text-ink shadow-[0_1px_2px_rgb(0_0_0/0.04)]" style={{ opacity: 0.55 + ((i * 7) % 5) * 0.1 }}>
                <UiIcon name={name} className="size-7 sm:size-8" />
              </div>
            ) : (
              <div key="gap" className="flex aspect-square items-center justify-center rounded-2xl border-2 border-dashed border-brand/60 bg-brand-soft">
                <span className="font-mono text-lg font-semibold text-brand sm:text-xl">404</span>
              </div>
            )))}
          </div>
        </div>
      </div>

      <section aria-labelledby="popular-categories" className="mt-16 border-t border-line pt-10">
        <h2 id="popular-categories" className="text-sm font-medium text-muted">Popular categories</h2>
        <ul className="mt-4 flex flex-wrap gap-2">
          {POPULAR.map((c) => (
            <li key={c.name}>
              <Link
                to={`/?${new URLSearchParams({ category: c.name })}`}
                className="inline-flex h-9 items-center gap-2 rounded-full border border-line bg-surface px-3.5 text-sm text-ink transition hover:border-brand hover:bg-brand-soft"
              >
                {c.name}
                <span className="text-xs tabular-nums text-faint">{nf.format(c.count)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
