import { useLocation } from 'react-router-dom';
import { LOCALES, localizePath, splitLocale, useI18n } from '../i18n';
import { UiIcon } from './ui';

/**
 * Switches to the same page in another language. Hidden while the site has
 * one language. A full page load picks up that language's prerendered page
 * and messages; search, filters, and the selected icon carry over.
 */
export function LanguageMenu() {
  const { t, config } = useI18n();
  const { pathname, search, hash } = useLocation();
  if (LOCALES.length < 2) return null;
  const { path } = splitLocale(pathname);
  return (
    <span className="relative inline-flex items-center">
      <UiIcon name="globe" className="pointer-events-none absolute left-2 size-4" />
      <select
        aria-label={t('footer.language')}
        value={config.code}
        onChange={(e) => window.location.assign(`${localizePath(path, e.target.value)}${search}${hash}`)}
        className="h-8 appearance-none rounded-md bg-transparent pl-7 pr-2 text-sm text-muted transition hover:text-ink"
      >
        {LOCALES.map((l) => <option key={l.code} value={l.code} lang={l.code}>{l.label}</option>)}
      </select>
    </span>
  );
}
