import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { LocalLink, useI18n } from '../i18n';
import markRegular from '../brand/mark-regular.svg?raw';
import { CONTAINER, HeaderSlotContext, PaneHostContext } from '../lib/layout';
import { LIBRARY_URL, NPM_URL } from '../lib/links';
import { useDocumentMeta } from '../lib/useDocumentMeta';
import { HeaderActions } from './HeaderActions';
import { LanguageMenu } from './LanguageMenu';
import { ThemeToggle } from './ThemeToggle';
import { UiIcon } from './ui';

const footerLink = 'inline-flex items-center gap-1 rounded text-muted underline-offset-2 transition hover:text-ink hover:underline';

export function Layout() {
  const [paneHost, setPaneHost] = useState<HTMLElement | null>(null);
  const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null);
  useDocumentMeta();
  const { t } = useI18n();
  const { pathname } = useLocation();
  return (
    <PaneHostContext.Provider value={paneHost}>
    <HeaderSlotContext.Provider value={headerSlot}>
      <div className="flex min-h-dvh">
        <div className="flex min-w-0 flex-1 flex-col">
          <a href="#main" className="sr-only z-50 rounded-lg bg-surface px-3 py-2 focus:not-sr-only focus:fixed focus:left-3 focus:top-3">
            {t('site.skipToContent')}
          </a>
          <header className="border-b border-line">
            <div className={`${CONTAINER} flex h-14 items-center gap-2`}>
              <LocalLink to="/" className="flex shrink-0 items-center gap-2 rounded-lg pr-1 text-ink" aria-label={t('site.home')}>
                <span className="glyph size-7 text-ink" aria-hidden="true" dangerouslySetInnerHTML={{ __html: markRegular }} />
                <span className="whitespace-nowrap font-display text-[20px] font-semibold tracking-tight">{t('site.name')}</span>
              </LocalLink>
              <div ref={setHeaderSlot} className="hidden min-w-0 flex-1 justify-center px-6 empty:hidden md:flex" />
              <div className="ml-auto flex items-center gap-2 md:gap-5">
                <HeaderActions />
                {/* With the desktop side pane open, the toggle lives in the pane's bar. */}
                <ThemeToggle className="-mr-2 [:root:has(#side-pane-body)_&]:hidden" />
              </div>
            </div>
          </header>
          <main id="main" tabIndex={-1} className="flex-1 outline-none">
            {/* Re-keyed per page so moving between pages eases in (see .route-enter). */}
            <div key={pathname} className="route-enter page-enter">
              <Outlet />
            </div>
          </main>
          <footer className="border-t border-line">
            <div className={`${CONTAINER} flex flex-col gap-3 py-6 text-sm text-muted md:flex-row md:items-center md:justify-between`}>
              <nav aria-label={t('footer.nav')} className="flex flex-wrap items-center gap-x-5 gap-y-2">
                <LocalLink to="/docs#privacy" className={footerLink}>{t('footer.privacy')}</LocalLink>
                <LocalLink to="/docs#licensing" className={footerLink}>{t('footer.license')}</LocalLink>
                <LanguageMenu />
              </nav>
              <nav aria-label={t('footer.elsewhere')} className="flex items-center gap-3">
                <a href={LIBRARY_URL} target="_blank" rel="noreferrer" className={footerLink}>
                  {t('footer.github')} <UiIcon name="link-external" className="size-3.5" />
                  <span className="sr-only">{t('site.newTab')}</span>
                </a>
                <span aria-hidden="true" className="text-line-strong">|</span>
                <a href={NPM_URL} target="_blank" rel="noreferrer" className={footerLink}>
                  {t('footer.npm')} <UiIcon name="link-external" className="size-3.5" />
                  <span className="sr-only">{t('site.newTab')}</span>
                </a>
              </nav>
            </div>
          </footer>
        </div>
        <div ref={setPaneHost} className="hidden shrink-0 lg:block" />
      </div>
    </HeaderSlotContext.Provider>
    </PaneHostContext.Provider>
  );
}
