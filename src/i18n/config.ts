/**
 * Languages the site is published in.
 *
 * To add a language:
 *   1. Add it here (code is a BCP 47 tag, e.g. 'fr' or 'pt-BR').
 *   2. Add src/i18n/messages/<code>.ts, translating keys from en.ts. Missing
 *      keys fall back to English, and `npm test` reports what's left.
 *   3. Optionally add a translated Docs page (see src/i18n/content.ts).
 * The build then prerenders every page at /<code>/…, with hreflang links
 * between languages and a localized sitemap.
 */
export interface LocaleConfig {
  /** BCP 47 language tag; also the URL prefix for non-default locales. */
  code: string;
  /** The language's name in itself, for the language menu. */
  label: string;
  dir: 'ltr' | 'rtl';
  /** Open Graph locale, e.g. en_US. */
  ogLocale: string;
}

export const LOCALES: readonly LocaleConfig[] = [
  { code: 'en', label: 'English', dir: 'ltr', ogLocale: 'en_US' },
];

/** Served without a URL prefix. */
export const DEFAULT_LOCALE = 'en';

export const localeConfig = (code: string): LocaleConfig =>
  LOCALES.find((l) => l.code === code) ?? LOCALES.find((l) => l.code === DEFAULT_LOCALE)!;

/** Split a pathname into its locale and the rest ("/fr/docs" -> fr, "/docs"). */
export function splitLocale(pathname: string, locales: readonly LocaleConfig[] = LOCALES): { locale: string; path: string } {
  const [, first, ...rest] = pathname.split('/');
  const match = locales.find((l) => l.code !== DEFAULT_LOCALE && l.code.toLowerCase() === first?.toLowerCase());
  if (!match) return { locale: DEFAULT_LOCALE, path: pathname || '/' };
  return { locale: match.code, path: `/${rest.join('/')}` };
}

/** A site path in a locale ("/docs", fr -> "/fr/docs"). Leaves query strings and hashes alone. */
export function localizePath(path: string, locale: string): string {
  if (locale === DEFAULT_LOCALE) return path;
  return path === '/' ? `/${locale}` : path.startsWith('/?') || path.startsWith('/#') ? `/${locale}${path.slice(1)}` : `/${locale}${path}`;
}
