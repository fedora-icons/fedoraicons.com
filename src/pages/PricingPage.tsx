import { LocalLink, useI18n } from '../i18n';
import { catalog } from '../lib/catalog';
import { CONTAINER } from '../lib/layout';
import { LIBRARY_URL } from '../lib/links';

/** Placeholder until pricing is decided. States only what is true today. */
export default function PricingPage() {
  const { t, list } = useI18n();
  const styles = list(catalog.styles.map((s) => t(`style.${s}`)));
  return (
    <div className={`${CONTAINER} pb-24 pt-12 sm:pt-16`}>
      <div className="max-w-2xl">
        <p className="text-sm font-medium text-brand">{t('pricing.eyebrow')}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{t('pricing.title')}</h1>
        <p className="mt-4 text-base text-muted">
          {t('pricing.body', { count: catalog.icons.length, styles, license: catalog.license })}
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <LocalLink to="/" className="inline-flex h-10 items-center rounded-lg bg-brand px-4 text-sm font-medium text-brand-ink transition hover:brightness-110">
            {t('pricing.browse')}
          </LocalLink>
          <a href={LIBRARY_URL} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center rounded-lg border border-line-strong bg-surface px-4 text-sm font-medium text-ink transition hover:bg-sunken">
            {t('pricing.github')}<span className="sr-only">{t('site.newTab')}</span>
          </a>
        </div>
      </div>
    </div>
  );
}
