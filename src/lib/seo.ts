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

export const SHARE_IMAGE = {
  path: '/og-image.png',
  width: 1200,
  height: 630,
  alt: 'Fedora Icons: open-source icons in Regular, Solid, Duocolor, and Duotone, shown on a grid.',
};

const nf = new Intl.NumberFormat('en-US');
const list = (items: string[]) => new Intl.ListFormat('en', { type: 'conjunction' }).format(items);

export const facts = {
  icons: catalog.icons.length,
  styles: catalog.styles.map((s) => STYLE_META[s].label),
  categories: catalog.categories,
  modifiers: Object.keys(catalog.modifiers).length,
  brands: brands.approved.length,
  license: catalog.license,
};

export type PageId = 'home' | 'docs' | 'pricing' | 'brands' | 'not-found';

export interface PageMeta {
  id: PageId;
  /** Canonical path, without a trailing slash (except the root). */
  path: string;
  title: string;
  description: string;
  /** Keep out of search results (the 404 page). */
  noindex?: boolean;
}

const iconCount = nf.format(facts.icons);
const styleList = list(facts.styles);

export const PAGES: Record<PageId, PageMeta> = {
  home: {
    id: 'home',
    path: '/',
    title: 'Fedora Icons — Find the right icon, then ship it',
    description: `${iconCount} free, ${facts.license}-licensed SVG icons in ${styleList}. Search, recolor, and resize them, then export SVG or PNG, or use them in React and Figma.`,
  },
  docs: {
    id: 'docs',
    path: '/docs',
    title: 'Docs — Use Fedora Icons in SVG, React, and Figma',
    description: `How to use Fedora Icons: the four styles, SVG files, the React package, Figma, colors, sizes, ${facts.modifiers} modifiers, accessibility, licensing, and privacy.`,
  },
  pricing: {
    id: 'pricing',
    path: '/pricing',
    title: 'Pricing — Fedora Icons',
    description: `Fedora Icons is free today: all ${iconCount} core icons in ${styleList}, under the ${facts.license} license. Plans haven't been announced yet.`,
  },
  brands: {
    id: 'brands',
    path: '/brands',
    title: 'Brand icons — Fedora Icons',
    description: `${nf.format(facts.brands)} brand logos, including social networks, Google Chrome, and Microsoft Edge, Teams, and Windows, shown as their owners provide them. Not covered by the ${facts.license} license.`,
  },
  'not-found': {
    id: 'not-found',
    path: '/404',
    title: 'Page not found — Fedora Icons',
    description: 'That page does not exist. Browse Fedora Icons instead.',
    noindex: true,
  },
};

/** The metadata for a location in the app. */
export function pageFor(pathname: string, search = ''): PageMeta {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === '/') return new URLSearchParams(search).get('style') === 'brands' ? PAGES.brands : PAGES.home;
  if (path === '/docs') return PAGES.docs;
  if (path === '/pricing') return PAGES.pricing;
  if (path === '/brands') return PAGES.brands;
  return PAGES['not-found'];
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

/** schema.org structured data for a page, as one JSON-LD graph. */
export function structuredData(page: PageMeta): object {
  const url = absolute(page.path);
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
    inLanguage: 'en',
  };
  const graph: object[] = [
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      url: `${SITE_URL}/`,
      name: SITE_NAME,
      description: PAGES.home.description,
      publisher: { '@id': `${SITE_URL}/#organization` },
      inLanguage: 'en',
      potentialAction: {
        '@type': 'SearchAction',
        target: { '@type': 'EntryPoint', urlTemplate: `${SITE_URL}/?q={search_term_string}` },
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
      description: `${iconCount} open-source SVG icons on a 24px grid in ${styleList}, with ${facts.modifiers} reusable modifiers.`,
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
        { '@type': 'ListItem', position: 1, name: SITE_NAME, item: `${SITE_URL}/` },
        { '@type': 'ListItem', position: 2, name: page.title.split(' — ')[0], item: url },
      ],
    });
  }
  return { '@context': 'https://schema.org', '@graph': graph };
}

const escapeAttr = (value: string) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escapeText = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Every head tag that varies by page, for the static HTML. */
export function headTags(page: PageMeta): string {
  const url = absolute(page.path);
  const image = absolute(SHARE_IMAGE.path);
  const meta = (attr: 'name' | 'property', key: string, value: string) => `<meta ${attr}="${key}" content="${escapeAttr(value)}" />`;
  const json = JSON.stringify(structuredData(page)).replace(/</g, '\\u003c');
  return [
    `<title>${escapeText(page.title)}</title>`,
    meta('name', 'description', page.description),
    page.noindex ? meta('name', 'robots', 'noindex, follow') : meta('name', 'robots', 'index, follow, max-image-preview:large, max-snippet:-1'),
    page.noindex ? '' : `<link rel="canonical" href="${url}" />`,
    meta('property', 'og:type', 'website'),
    meta('property', 'og:site_name', SITE_NAME),
    meta('property', 'og:locale', 'en_US'),
    meta('property', 'og:title', page.title),
    meta('property', 'og:description', page.description),
    meta('property', 'og:url', url),
    meta('property', 'og:image', image),
    meta('property', 'og:image:type', 'image/png'),
    meta('property', 'og:image:width', String(SHARE_IMAGE.width)),
    meta('property', 'og:image:height', String(SHARE_IMAGE.height)),
    meta('property', 'og:image:alt', SHARE_IMAGE.alt),
    meta('name', 'twitter:card', 'summary_large_image'),
    meta('name', 'twitter:title', page.title),
    meta('name', 'twitter:description', page.description),
    meta('name', 'twitter:image', image),
    meta('name', 'twitter:image:alt', SHARE_IMAGE.alt),
    `<script type="application/ld+json">${json}</script>`,
  ].filter(Boolean).join('\n    ');
}
