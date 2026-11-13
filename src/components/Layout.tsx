import { useState } from 'react';
import { Link, Outlet } from 'react-router-dom';
import markRegular from '../brand/mark-regular.svg?raw';
import { lock } from '../lib/catalog';
import { CONTAINER, PaneHostContext } from '../lib/layout';
import { LIBRARY_URL } from '../lib/links';
import { HeaderActions } from './HeaderActions';
import { ThemeToggle } from './ThemeToggle';
import { UiIcon } from './ui';

const footerLink = 'inline-flex items-center gap-1 rounded text-muted underline-offset-2 transition hover:text-ink hover:underline';

export function Layout() {
  const [paneHost, setPaneHost] = useState<HTMLElement | null>(null);
  return (
    <PaneHostContext.Provider value={paneHost}>
      <div className="flex min-h-dvh">
        <div className="flex min-w-0 flex-1 flex-col">
          <a href="#main" className="sr-only z-50 rounded-lg bg-surface px-3 py-2 focus:not-sr-only focus:fixed focus:left-3 focus:top-3">
            Skip to content
          </a>
          <header className="border-b border-line">
            <div className={`${CONTAINER} flex h-14 items-center gap-2`}>
              <Link to="/" className="flex shrink-0 items-center gap-2 rounded-lg pr-1 text-ink" aria-label="Fedora Icons home">
                <span className="glyph size-7 text-ink" aria-hidden="true" dangerouslySetInnerHTML={{ __html: markRegular }} />
                <span className="whitespace-nowrap font-display text-[20px] font-semibold tracking-tight">Fedora Icons</span>
              </Link>
              <div className="ml-auto flex items-center gap-2 md:gap-5">
                <HeaderActions />
                {/* With the desktop side pane open, the toggle lives in the pane's bar. */}
                <ThemeToggle className="-mr-2 [:root:has(#side-pane-body)_&]:hidden" />
              </div>
            </div>
          </header>
          <main id="main" tabIndex={-1} className="flex-1 outline-none">
            <Outlet />
          </main>
          <footer className="border-t border-line">
            <div className={`${CONTAINER} flex flex-col gap-3 py-6 text-sm text-muted md:flex-row md:items-center md:justify-between`}>
              <nav aria-label="Footer" className="flex flex-wrap items-center gap-x-5 gap-y-2">
                <Link to="/docs" className={footerLink}>
                  <UiIcon name="book-open" className="size-4" /> Docs
                </Link>
                <Link to="/docs#privacy" className={footerLink}>Privacy</Link>
                <a href={LIBRARY_URL} className={footerLink}>
                  GitHub <UiIcon name="link-external" className="size-3.5" />
                </a>
                <span>
                  Core icons are <a className="underline underline-offset-2 hover:text-ink" href="/licenses/fedora-icons-LICENSE.txt">MIT licensed</a>.
                  {' '}Brand icons are licensed separately.
                </span>
              </nav>
              <p className="font-mono text-xs text-faint">
                Library {lock.revision ? lock.revision.slice(0, 7) : 'unknown'}{lock.dirty ? ' + local changes' : ''}
              </p>
            </div>
          </footer>
        </div>
        <div ref={setPaneHost} className="hidden shrink-0 lg:block" />
      </div>
    </PaneHostContext.Provider>
  );
}
