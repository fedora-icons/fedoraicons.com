import { useI18n } from '../i18n';
import type { IconEntry } from '../lib/catalog';
import { Button, UiIcon } from './ui';

const REQUEST_URL = 'https://github.com/fos-icons/fos-icons/issues/new';

/**
 * Shown when a search finds nothing: says what was searched, offers close
 * matches (typos, partial words), the same search in all categories or in
 * the other catalog, and a ready-made icon request.
 */
export function NoResults({
  query, category, noun, brandsView, suggestions, svgs, elsewhere, otherCatalog,
  onSearch, onShowAllCategories, onSwitchCatalog, onClear,
}: {
  query: string;
  category: string | null;
  noun: string;
  brandsView: boolean;
  /** Close matches, best first. */
  suggestions: IconEntry[];
  /** Grid artwork, when loaded, to preview suggestions. */
  svgs: Record<string, string> | null;
  /** Matches for the same search with the category filter removed. */
  elsewhere: number;
  /** Matches for the same search in the other catalog (core icons or Brands). */
  otherCatalog: number;
  onSearch: (query: string) => void;
  onShowAllCategories: () => void;
  onSwitchCatalog: () => void;
  onClear: () => void;
}) {
  const { t, label } = useI18n();
  const q = query.trim();
  const categoryName = category ? label('category', category, category) : null;
  const requestHref = `${REQUEST_URL}?${new URLSearchParams({ title: t('noResults.requestTitle', { query: q }) })}`;
  return (
    <section
      aria-labelledby="no-results-title"
      className="relative overflow-hidden rounded-3xl border border-line bg-surface px-6 py-12 sm:px-12 sm:py-16"
    >
      {/* The 24px design grid, faint, as a backdrop. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-60 [background-image:linear-gradient(var(--c-line)_1px,transparent_1px),linear-gradient(90deg,var(--c-line)_1px,transparent_1px)] [background-size:24px_24px] [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]"
      />
      <div className="relative mx-auto flex max-w-2xl flex-col items-center text-center">
        <span aria-hidden="true" className="flex size-16 items-center justify-center rounded-2xl bg-brand-soft text-brand shadow-[inset_0_0_0_1px_var(--c-line)]">
          <UiIcon name="binoculars" className="size-8" />
        </span>
        <h2 id="no-results-title" className="mt-6 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          {categoryName ? t('noResults.titleIn', { noun, query: q, category: categoryName }) : t('noResults.title', { noun, query: q })}
        </h2>
        <p className="mt-3 max-w-md text-sm text-muted sm:text-base">
          {t('noResults.body')}
        </p>

        {suggestions.length > 0 && (
          <div className="mt-8 w-full">
            <h3 className="text-xs font-medium uppercase tracking-wide text-faint">{t('noResults.didYouMean')}</h3>
            <ul className="mt-3 flex flex-wrap justify-center gap-2">
              {suggestions.map((icon) => (
                <li key={icon.name}>
                  <button
                    type="button"
                    onClick={() => onSearch(icon.name)}
                    className="inline-flex h-10 items-center gap-2 rounded-full border border-line-strong bg-surface pl-2 pr-3.5 text-sm font-medium text-ink transition hover:border-brand hover:bg-brand-soft"
                  >
                    <span aria-hidden="true" className="flex size-7 items-center justify-center rounded-full bg-sunken">
                      {svgs?.[icon.name]
                        ? <span data-artwork className="glyph size-[18px]" dangerouslySetInnerHTML={{ __html: svgs[icon.name] }} />
                        : <UiIcon name="search" className="size-4 text-muted" />}
                    </span>
                    {icon.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-8 flex flex-wrap justify-center gap-2">
          {elsewhere > 0 && (
            <Button variant="primary" onClick={onShowAllCategories}>
              {t('noResults.showAllCategories', { count: elsewhere })}
            </Button>
          )}
          {otherCatalog > 0 && (
            <Button variant={elsewhere > 0 ? 'secondary' : 'primary'} onClick={onSwitchCatalog}>
              {t(brandsView ? 'noResults.showInIcons' : 'noResults.showInBrands', { count: otherCatalog })}
            </Button>
          )}
          <Button icon="x" onClick={onClear}>{t(category ? 'noResults.clearAll' : 'noResults.clear')}</Button>
        </div>

        {!brandsView && (
          <div className="mt-10 flex w-full flex-col items-center gap-3 border-t border-line pt-8 sm:flex-row sm:justify-between sm:text-left">
            <p className="flex items-center gap-3 text-sm text-muted">
              <UiIcon name="lightbulb" className="size-5 shrink-0 text-brand" />
              <span>{t('noResults.requestHint', { query: q })}</span>
            </p>
            <a
              href={requestHref}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-brand transition hover:bg-brand-soft"
            >
              {t('noResults.request')}
              <UiIcon name="arrow-right" className="size-4 rtl:-scale-x-100" />
              <span className="sr-only">{t('noResults.requestNewTab')}</span>
            </a>
          </div>
        )}
      </div>
    </section>
  );
}
