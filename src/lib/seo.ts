import { createI18n, DEFAULT_LOCALE, LOCALES, localizePath, splitLocale, type I18n, type MessageKey } from '../i18n';
import { brands } from './brands';
import { catalog, STYLE_META } from './catalog';
import { FIGMA_URL, LIBRARY_URL } from './links';

/**
 * Search, AI-answer, and social-share metadata for every page. The build
 * writes it into each page's static HTML (scripts/postbuild.mjs); the app
 * keeps the title, description, and canonical link current while you navigate.
 * Counts come from the synced catalog; nothing here is hard-coded.
 */

export const SITE_URL = 'https://fedoraicons.com';
export const SITE_NAME = 'Fedora Icons';
export const GITHUB_ORG_URL = 'https://github.com/fedora-icons';
export const NPM_REACT_URL = 'https://www.npmjs.com/package/@fedora-icons/react';
export const NPM_VUE_URL = 'https://www.npmjs.com/package/@fedora-icons/vue';

export const SHARE_IMAGE = { path: '/og-image.png', width: 1200, height: 630 };

export const facts = {
  icons: catalog.icons.length,
  styles: catalog.styles.map((s) => STYLE_META[s].label),
  categories: catalog.categories,
  modifiers: Object.keys(catalog.modifiers).length,
  brands: brands.approved.length,
  license: catalog.license,
};

export type PageId = 'home' | 'docs' | 'brands' | 'not-found';

export interface PageMeta {
  id: PageId;
  /** Canonical path in the default language, without a trailing slash (except the root). */
  path: string;
  title: string;
  description: string;
  /** Keep out of search results (the 404 page). */
  noindex?: boolean;
}

const PATHS: Record<PageId, string> = { home: '/', docs: '/docs', brands: '/brands', 'not-found': '/404' };
const META_KEYS = {
  home: ['meta.home.title', 'meta.home.description'],
  docs: ['meta.docs.title', 'meta.docs.description'],
  brands: ['meta.brands.title', 'meta.brands.description'],
  'not-found': ['meta.notFound.title', 'meta.notFound.description'],
} as const satisfies Record<PageId, readonly [MessageKey, MessageKey]>;

export const PAGE_IDS = Object.keys(PATHS) as PageId[];

/** A page's metadata in a language; counts come from the catalog. */
export function pageMeta(id: PageId, i18n: I18n = createI18n(DEFAULT_LOCALE)): PageMeta {
  const vars = {
    icons: facts.icons,
    styles: i18n.list(catalog.styles.map((s) => i18n.t(`style.${s}`))),
    license: facts.license,
    modifiers: facts.modifiers,
    brands: facts.brands,
  };
  const [title, description] = META_KEYS[id];
  return { id, path: PATHS[id], title: i18n.t(title, vars), description: i18n.t(description, vars), noindex: id === 'not-found' };
}

/** English metadata for every page (for the build's sitemap and llms.txt). */
export const PAGES = Object.fromEntries(PAGE_IDS.map((id) => [id, pageMeta(id)])) as Record<PageId, PageMeta>;

/** Which page a location shows (the path may include a language prefix). */
export function pageIdFor(pathname: string, search = ''): PageId {
  const path = splitLocale(pathname).path.replace(/\/+$/, '') || '/';
  if (path === '/') return new URLSearchParams(search).get('style') === 'brands' ? 'brands' : 'home';
  if (path === '/docs') return 'docs';
  if (path === '/brands') return 'brands';
  return 'not-found';
}

/** The metadata for a location in the app, in a language. */
export function pageFor(pathname: string, search = '', i18n?: I18n): PageMeta {
  return pageMeta(pageIdFor(pathname, search), i18n);
}

export const absolute = (path: string) => `${SITE_URL}${path}`;

const ORGANIZATION = {
  '@type': 'Organization',
  '@id': `${SITE_URL}/#organization`,
  name: SITE_NAME,
  url: `${SITE_URL}/`,
  logo: absolute('/apple-touch-icon.png'),
  sameAs: [GITHUB_ORG_URL, NPM_REACT_URL, NPM_VUE_URL, ...(FIGMA_URL ? [FIGMA_URL] : [])],
};

/** A page's URL in a language. */
export const pageUrl = (page: Pick<PageMeta, 'path'>, locale: string) => absolute(localizePath(page.path, locale));

/** schema.org structured data for a page, as one JSON-LD graph. */
export function structuredData(page: PageMeta, i18n: I18n = createI18n(DEFAULT_LOCALE)): object {
  const lang = i18n.config.code;
  const url = pageUrl(page, lang);
  const home = pageMeta('home', i18n);
  const webPage = {
    '@type': page.id === 'docs' ? 'TechArticle' : 'WebPage',
    '@id': `${url}#webpage`,
    url,
    name: page.title,
    ...(page.id === 'docs' ? { headline: page.title } : {}),
    description: page.description,
    isPartOf: { '@id': `${SITE_URL}/#website` },
    publisher: { '@id': `${SITE_URL}/#organization` },
    primaryImageOfPage: absolute(SHARE_IMAGE.path),
    inLanguage: lang,
  };
  const graph: object[] = [
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      url: `${SITE_URL}/`,
      name: SITE_NAME,
      description: home.description,
      publisher: { '@id': `${SITE_URL}/#organization` },
      inLanguage: LOCALES.map((l) => l.code),
      potentialAction: {
        '@type': 'SearchAction',
        target: { '@type': 'EntryPoint', urlTemplate: `${pageUrl(home, lang)}?q={search_term_string}` },
        'query-input': 'required name=search_term_string',
      },
    },
    ORGANIZATION,
    webPage,
  ];
  if (page.id === 'home') {
    graph.push({
      '@type': 'SoftwareSourceCode',
      '@id': `${SITE_URL}/#library`,
      name: SITE_NAME,
      description: i18n.t('meta.library.description', {
        icons: facts.icons,
        styles: i18n.list(catalog.styles.map((s) => i18n.t(`style.${s}`))),
        modifiers: facts.modifiers,
      }),
      codeRepository: LIBRARY_URL,
      programmingLanguage: ['SVG', 'TypeScript'],
      license: 'https://opensource.org/licenses/MIT',
      isAccessibleForFree: true,
      author: { '@id': `${SITE_URL}/#organization` },
      keywords: ['icons', 'SVG icons', 'icon library', 'React icons', 'Vue icons', 'Figma icons', ...facts.styles.map((s) => `${s.toLowerCase()} icons`)].join(', '),
    });
  } else if (!page.noindex) {
    graph.push({
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: SITE_NAME, item: pageUrl(home, lang) },
        { '@type': 'ListItem', position: 2, name: page.title.split(' — ')[0], item: url },
      ],
    });
  }
  return { '@context': 'https://schema.org', '@graph': graph };
}

const escapeAttr = (value: string) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escapeText = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Every head tag that varies by page and language, for the static HTML:
 * title, description, robots, canonical, hreflang alternates for every
 * language (plus x-default), Open Graph and X/Twitter tags, and JSON-LD.
 */
export function headTags(page: PageMeta, i18n: I18n = createI18n(DEFAULT_LOCALE)): string {
  const lang = i18n.config.code;
  const url = pageUrl(page, lang);
  const image = absolute(SHARE_IMAGE.path);
  const imageAlt = i18n.t('meta.shareImageAlt');
  const meta = (attr: 'name' | 'property', key: string, value: string) => `<meta ${attr}="${key}" content="${escapeAttr(value)}" />`;
  const json = JSON.stringify(structuredData(page, i18n)).replace(/</g, '\\u003c');
  const alternates = page.noindex ? [] : [
    ...LOCALES.map((l) => `<link rel="alternate" hreflang="${l.code}" href="${pageUrl(page, l.code)}" />`),
    `<link rel="alternate" hreflang="x-default" href="${pageUrl(page, DEFAULT_LOCALE)}" />`,
  ];
  return [
    `<title>${escapeText(page.title)}</title>`,
    meta('name', 'description', page.description),
    page.noindex ? meta('name', 'robots', 'noindex, follow') : meta('name', 'robots', 'index, follow, max-image-preview:large, max-snippet:-1'),
    page.noindex ? '' : `<link rel="canonical" href="${url}" />`,
    ...alternates,
    meta('property', 'og:type', 'website'),
    meta('property', 'og:site_name', SITE_NAME),
    meta('property', 'og:locale', i18n.config.ogLocale),
    ...LOCALES.filter((l) => l.code !== lang).map((l) => meta('property', 'og:locale:alternate', l.ogLocale)),
    meta('property', 'og:title', page.title),
    meta('property', 'og:description', page.description),
    meta('property', 'og:url', url),
    meta('property', 'og:image', image),
    meta('property', 'og:image:type', 'image/png'),
    meta('property', 'og:image:width', String(SHARE_IMAGE.width)),
    meta('property', 'og:image:height', String(SHARE_IMAGE.height)),
    meta('property', 'og:image:alt', imageAlt),
    meta('name', 'twitter:card', 'summary_large_image'),
    meta('name', 'twitter:title', page.title),
    meta('name', 'twitter:description', page.description),
    meta('name', 'twitter:image', image),
    meta('name', 'twitter:image:alt', imageAlt),
    `<script type="application/ld+json">${json}</script>`,
  ].filter(Boolean).join('\n    ');
}
