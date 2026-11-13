import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { absolute, pageFor } from './seo';

function setMeta(selector: string, value: string) {
  document.head.querySelector<HTMLMetaElement>(selector)?.setAttribute('content', value);
}

/**
 * Keep the tab title, description, and canonical link in step with the route.
 * The static HTML for each page already carries the full set (see postbuild);
 * this covers client-side navigation and crawlers that run JavaScript.
 */
export function useDocumentMeta() {
  const { pathname, search } = useLocation();
  useEffect(() => {
    const page = pageFor(pathname, search);
    document.title = page.title;
    setMeta('meta[name="description"]', page.description);
    setMeta('meta[property="og:title"]', page.title);
    setMeta('meta[property="og:description"]', page.description);
    setMeta('meta[property="og:url"]', absolute(page.path));
    setMeta('meta[name="twitter:title"]', page.title);
    setMeta('meta[name="twitter:description"]', page.description);
    const canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (canonical && !page.noindex) canonical.href = absolute(page.path);
  }, [pathname, search]);
}
