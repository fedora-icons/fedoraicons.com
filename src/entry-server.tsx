import { StrictMode } from 'react';
import { prerenderToNodeStream } from 'react-dom/static';
import { StaticRouter } from 'react-router';
import { AppShell } from './App';

export { headTags, pageFor, PAGES, facts, SITE_URL, SITE_NAME, absolute } from './lib/seo';
export { catalog } from './lib/catalog';
export { brands } from './lib/brands';
export { LIBRARY_URL, FIGMA_URL } from './lib/links';

/** Render a route to static HTML at build time, so crawlers that don't run JavaScript still read the page. */
export async function render(url: string): Promise<string> {
  const { prelude } = await prerenderToNodeStream(
    <StrictMode>
      <StaticRouter location={url}>
        <AppShell />
      </StaticRouter>
    </StrictMode>,
  );
  const chunks: Buffer[] = [];
  for await (const chunk of prelude) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}
