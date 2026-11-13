import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import { DEFAULT_LOCALE } from './config';

/**
 * Long-form pages (Docs) are written per language rather than as messages.
 * A translation lives at src/i18n/content/<locale>/DocsPage.tsx and exports
 * a default component; until one exists, that language shows the English
 * Docs page, marked lang="en", with a note saying so.
 */
const translated = import.meta.glob<{ default: ComponentType }>('./content/*/DocsPage.tsx');

export const hasTranslatedDocs = (locale: string) =>
  locale === DEFAULT_LOCALE || `./content/${locale}/DocsPage.tsx` in translated;

const pages = new Map<string, LazyExoticComponent<ComponentType>>();

/** The Docs page component for a language (stable per language, for React.lazy). */
export function docsPageFor(locale: string): LazyExoticComponent<ComponentType> {
  const key = hasTranslatedDocs(locale) ? locale : DEFAULT_LOCALE;
  if (!pages.has(key)) {
    const load = key === DEFAULT_LOCALE ? () => import('../pages/DocsPage') : translated[`./content/${key}/DocsPage.tsx`];
    pages.set(key, lazy(load));
  }
  return pages.get(key)!;
}
