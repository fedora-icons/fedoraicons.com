import { StrictMode } from 'react';
import { prerenderToNodeStream } from 'react-dom/static';
import { StaticRouter } from 'react-router';
import { AppShell } from './App';
import { createI18n, DEFAULT_LOCALE, loadMessages } from './i18n';

export { headTags, pageFor, pageMeta, pageUrl, PAGES, PAGE_IDS, facts, SITE_URL, SITE_NAME, absolute } from './lib/seo';
export { DEFAULT_LOCALE, LOCALES, localizePath } from './i18n';

/** A language's translator, with its messages loaded (for the build). */
export async function i18nFor(locale: string) {
  return createI18n(locale, await loadMessages(locale));
}
export { catalog } from './lib/catalog';
export { brands } from './lib/brands';
export { LIBRARY_URL, FIGMA_URL } from './lib/links';

/** Render a route to static HTML at build time, so crawlers that don't run JavaScript still read the page. */
export async function render(url: string, locale: string = DEFAULT_LOCALE): Promise<string> {
  const messages = await loadMessages(locale);
  const { prelude } = await prerenderToNodeStream(
    <StrictMode>
      <StaticRouter location={url}>
        <AppShell locale={locale} messages={messages} />
      </StaticRouter>
    </StrictMode>,
  );
  const chunks: Buffer[] = [];
  for await (const chunk of prelude) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}
