// Turn the single-page build into crawlable static pages.
//
// Every route, in every language (src/i18n/config.ts), gets its own index.html with its real content prerendered
// (so search engines and AI crawlers that don't run JavaScript can read it),
// plus its own title, description, canonical link, Open Graph/Twitter share
// tags, and JSON-LD. 404.html serves the app for unknown paths. Also writes
// robots.txt, sitemap.xml, and llms.txt. The prerender bundle (dist-ssr/)
// is built by `vite build --ssr` and removed afterwards.
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const ssrDir = join(root, 'dist-ssr');
const server = await import(pathToFileURL(join(ssrDir, 'entry-server.js')).href);
const {
  PAGES, PAGE_IDS, pageMeta, pageUrl, headTags, facts, absolute, catalog, brands,
  SITE_NAME, LIBRARY_URL, FIGMA_URL, LOCALES, DEFAULT_LOCALE, localizePath, i18nFor,
} = server;

const template = readFileSync(join(dist, 'index.html'), 'utf8');
const META = /<!-- page-meta:start[^>]*-->[\s\S]*?<!-- page-meta:end -->/;
const ROOT = '<div id="root"></div>';
const HTML_TAG = /<html[^>]*>/;
if (!META.test(template) || !template.includes(ROOT)) throw new Error('index.html is missing the page-meta markers or #root');

// Fetch the Latin text fonts with the HTML instead of after the CSS parses.
const assets = readdirSync(join(dist, 'assets'));
const fontPreloads = ['funnel-display-latin-wght-normal', 'asta-sans-latin-wght-normal'].map((stem) => {
  const file = assets.find((f) => f.startsWith(`${stem}-`) && f.endsWith('.woff2'));
  if (!file) throw new Error(`Font not found in dist/assets: ${stem}`);
  return `<link rel="preload" href="/assets/${file}" as="font" type="font/woff2" crossorigin />`;
});
// The home grid's first artwork chunk, so icons paint without waiting for the app.
const homePreloads = [`<link rel="preload" href="/icons/${catalog.styles[0]}/0.json" as="fetch" crossorigin />`];

async function writePage(file, id, location, locale) {
  const i18n = await i18nFor(locale);
  const body = await server.render(localizePath(location, locale), locale);
  const preloads = [...fontPreloads, ...(id === 'home' ? homePreloads : [])];
  const html = template
    .replace(HTML_TAG, `<html lang="${i18n.config.code}" dir="${i18n.dir}">`)
    .replace(META, [headTags(pageMeta(id, i18n), i18n), ...preloads].join('\n    '))
    .replace(ROOT, `<div id="root">${body}</div>`);
  mkdirSync(dirname(join(dist, file)), { recursive: true });
  writeFileSync(join(dist, file), html);
}

// Every page in every language. Non-default languages live under /<locale>/;
// one 404.html serves every language (the app reads the language from the URL).
const ROUTES = [['home', '/'], ['docs', '/docs'], ['brands', '/?style=brands']];
let written = 0;
for (const { code } of LOCALES) {
  const prefix = code === DEFAULT_LOCALE ? '' : `${code}/`;
  for (const [id, location] of ROUTES) {
    await writePage(`${prefix}${id === 'home' ? '' : `${id}/`}index.html`, id, location, code);
    written += 1;
  }
}
await writePage('404.html', 'not-found', '/404', DEFAULT_LOCALE);
written += 1;

// Every page in every language, each listing its translations (hreflang).
const indexed = PAGE_IDS.map((id) => PAGES[id]).filter((page) => !page.noindex);
const urls = indexed.flatMap((page) => LOCALES.map(({ code }) => [
  '  <url>',
  `    <loc>${pageUrl(page, code)}</loc>`,
  ...LOCALES.map((alt) => `    <xhtml:link rel="alternate" hreflang="${alt.code}" href="${pageUrl(page, alt.code)}" />`),
  `    <xhtml:link rel="alternate" hreflang="x-default" href="${pageUrl(page, DEFAULT_LOCALE)}" />`,
  '  </url>',
].join('\n')));
writeFileSync(join(dist, 'sitemap.xml'), [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
  ...urls,
  '</urlset>',
  '',
].join('\n'));

// Search engines and AI assistants are welcome; everything here is public.
writeFileSync(join(dist, 'robots.txt'), [
  'User-agent: *',
  'Allow: /',
  '',
  `Sitemap: ${absolute('/sitemap.xml')}`,
  '',
].join('\n'));

// llms.txt (https://llmstxt.org): a plain summary for AI assistants and answer engines.
const nf = new Intl.NumberFormat('en-US');
const list = (items) => new Intl.ListFormat('en', { type: 'conjunction' }).format(items);
writeFileSync(join(dist, 'llms.txt'), [
  `# ${SITE_NAME}`,
  '',
  `> ${SITE_NAME} is a free, open-source icon library: ${nf.format(facts.icons)}+ SVG icons on a 24px grid in ${list(facts.styles)}, under the ${facts.license} license. ${absolute('/')} lets you search the icons, change their color, size, and stroke, and export SVG or PNG.`,
  '',
  'Key facts:',
  '',
  `- ${nf.format(facts.icons)} icons, each in ${facts.styles.length} styles: ${list(facts.styles)}.`,
  `- ${facts.license} licensed, free for personal and commercial use; keep the license notice when you redistribute the files.`,
  `- ${facts.modifiers} reusable modifiers (badges such as add, check, or lock) that can sit in a corner of any icon.`,
  `- ${nf.format(facts.brands)} brand logos (social networks, Google, Microsoft) are offered separately; they belong to their owners and are not covered by the ${facts.license} license.`,
  '- Available as SVG files, the `@fos-icons/react` and `@fos-icons/vue` npm packages, and a Figma library.',
  '',
  '## Use the icons',
  '',
  `- [Browse and export icons](${absolute('/')}): search by name, tag, or category; copy SVG, React code, or PNG; download one icon or a ZIP.`,
  `- [Docs](${absolute('/docs')}): styles, SVG, React, Figma, colors, sizes, modifiers, accessibility, licensing, and privacy.`,
  `- [Source library on GitHub](${LIBRARY_URL}): the canonical SVGs, manifest, and metadata.`,
  '- React: `npm install @fos-icons/react` ([npm](https://www.npmjs.com/package/@fos-icons/react))',
  '- Vue 3: `npm install @fos-icons/vue` ([npm](https://www.npmjs.com/package/@fos-icons/vue))',
  ...(FIGMA_URL ? [`- [Figma library](${FIGMA_URL})`] : []),
  '',
  '## Categories',
  '',
  ...catalog.categories.map((c) => `- ${c.name}: ${nf.format(c.count)} icons`),
  '',
  '## Optional',
  '',
  `- [Brand icons](${absolute('/brands')}): ${brands.approved.map((b) => b.name).join(', ')}.`,
  '',
].join('\n'));

// Web app manifest: makes the site installable (with public/sw.js).
writeFileSync(join(dist, 'manifest.webmanifest'), JSON.stringify({
  name: SITE_NAME,
  short_name: SITE_NAME,
  description: PAGES.home.description,
  id: '/',
  start_url: '/',
  scope: '/',
  display: 'standalone',
  display_override: ['window-controls-overlay', 'standalone'],
  background_color: '#fbfbfa',
  theme_color: '#fbfbfa',
  lang: 'en',
  dir: 'ltr',
  categories: ['design', 'developer', 'productivity', 'utilities'],
  icons: [
    { src: '/app/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: '/app/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: '/app/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
  ],
  shortcuts: [
    { name: 'Brand icons', url: '/?style=brands', icons: [{ src: '/app/icon-192.png', sizes: '192x192' }] },
    { name: 'Docs', url: '/docs', icons: [{ src: '/app/icon-192.png', sizes: '192x192' }] },
  ],
}, null, 2) + '\n');

// Version the service worker's caches by library revision and build, so a
// new snapshot or deploy never mixes with stale artwork.
const lock = JSON.parse(readFileSync(join(root, 'src/data/source-lock.json'), 'utf8'));
const entry = template.match(/assets\/index-([\w-]+)\.js/)?.[1] ?? 'dev';
const swPath = join(dist, 'sw.js');
writeFileSync(swPath, readFileSync(swPath, 'utf8').replace("const VERSION = 'v1';", `const VERSION = '${(lock.revision ?? 'local').slice(0, 7)}-${entry}';`));

rmSync(ssrDir, { recursive: true, force: true });
console.log(`Prerendered ${written} pages in ${LOCALES.length} language(s); wrote sitemap.xml (${urls.length} URLs), robots.txt, llms.txt, manifest.webmanifest, sw.js.`);
