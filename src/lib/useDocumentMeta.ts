import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useI18n } from '../i18n';
import { pageFor, pageUrl } from './seo';

function setMeta(selector: string, value: string) {
  document.head.querySelector<HTMLMetaElement>(selector)?.setAttribute('content', value);
}

/**
 * Keep the document language, tab title, description, and canonical link in
 * step with the route. The static HTML for each page already carries the
 * full set (see postbuild); this covers client-side navigation and crawlers
 * that run JavaScript.
 */
export function useDocumentMeta() {
  const { pathname, search } = useLocation();
  const i18n = useI18n();
  useEffect(() => {
    document.documentElement.lang = i18n.config.code;
    document.documentElement.dir = i18n.dir;
  }, [i18n]);
  useEffect(() => {
    const page = pageFor(pathname, search, i18n);
    const url = pageUrl(page, i18n.config.code);
    document.title = page.title;
    setMeta('meta[name="description"]', page.description);
    setMeta('meta[property="og:title"]', page.title);
    setMeta('meta[property="og:description"]', page.description);
    setMeta('meta[property="og:url"]', url);
    setMeta('meta[name="twitter:title"]', page.title);
    setMeta('meta[name="twitter:description"]', page.description);
    const canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (canonical && !page.noindex) canonical.href = url;
  }, [pathname, search, i18n]);
}
