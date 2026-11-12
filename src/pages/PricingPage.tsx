import { Link } from 'react-router-dom';
import { catalog, STYLE_META } from '../lib/catalog';
import { CONTAINER } from '../lib/layout';
import { LIBRARY_URL } from '../lib/links';

const nf = new Intl.NumberFormat('en-US');

/** Placeholder until pricing is decided. States only what is true today. */
export default function PricingPage() {
  const styles = new Intl.ListFormat('en', { type: 'conjunction' }).format(catalog.styles.map((s) => STYLE_META[s].label));
  return (
    <div className={`${CONTAINER} pb-24 pt-12 sm:pt-16`}>
      <div className="max-w-2xl">
        <p className="text-sm font-medium text-brand">Pricing</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Pricing is coming soon.</h1>
        <p className="mt-4 text-base text-muted">
          Plans haven't been announced yet. Everything on this site is free today: all{' '}
          {nf.format(catalog.icons.length)} core icons in {styles}, under the {catalog.license} license.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/" className="inline-flex h-10 items-center rounded-lg bg-brand px-4 text-sm font-medium text-brand-ink transition hover:brightness-110">
            Browse the free icons
          </Link>
          <a href={LIBRARY_URL} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center rounded-lg border border-line-strong bg-surface px-4 text-sm font-medium text-ink transition hover:bg-sunken">
            View on GitHub<span className="sr-only"> (opens in a new tab)</span>
          </a>
        </div>
      </div>
    </div>
  );
}
