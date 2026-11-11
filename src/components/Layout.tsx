import { NavLink, Outlet, Link } from 'react-router-dom';
import markRegular from '../brand/mark-regular.svg?raw';
import { lock } from '../lib/catalog';
import { useTheme, type ThemePreference } from '../lib/theme';
import { UiIcon, type UiIconName } from './ui';

const THEME_ORDER: ThemePreference[] = ['system', 'light', 'dark'];
const THEME_META: Record<ThemePreference, { icon: UiIconName; label: string }> = {
  system: { icon: 'monitor', label: 'System' },
  light: { icon: 'sun', label: 'Light' },
  dark: { icon: 'moon', label: 'Dark' },
};

function ThemeToggle() {
  const { preference, setPreference } = useTheme();
  const next = THEME_ORDER[(THEME_ORDER.indexOf(preference) + 1) % THEME_ORDER.length];
  const label = `Theme: ${THEME_META[preference].label}. Switch to ${THEME_META[next].label}.`;
  return (
    <button
      type="button"
      onClick={() => setPreference(next)}
      aria-label={label}
      title={label}
      className="inline-flex size-9 items-center justify-center rounded-lg text-ink transition hover:bg-sunken"
    >
      <UiIcon name={THEME_META[preference].icon} />
    </button>
  );
}

const navClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-lg px-2.5 py-1.5 text-sm font-medium transition ${isActive ? 'bg-sunken text-ink' : 'text-muted hover:text-ink'}`;

export function Layout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="sr-only z-50 rounded-lg bg-surface px-3 py-2 focus:not-sr-only focus:fixed focus:left-3 focus:top-3">
        Skip to content
      </a>
      <header className="sticky top-0 z-30 border-b border-line bg-canvas/85 backdrop-blur supports-[backdrop-filter]:bg-canvas/75">
        <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-2 px-4 sm:px-6">
          <Link to="/" className="mr-1 flex shrink-0 items-center gap-2 rounded-lg pr-1 text-ink sm:mr-2" aria-label="Fedora Icons home">
            <span className="glyph size-7 text-brand" aria-hidden="true" dangerouslySetInnerHTML={{ __html: markRegular }} />
            <span className="hidden whitespace-nowrap font-display text-[17px] font-semibold tracking-tight min-[420px]:inline">Fedora Icons</span>
          </Link>
          <nav aria-label="Primary" className="flex items-center gap-0.5">
            <NavLink to="/" end className={navClass}>Icons</NavLink>
            <NavLink to="/brands" className={navClass}>Brands</NavLink>
            <NavLink to="/docs" className={navClass}>Docs</NavLink>
          </nav>
          <div className="ml-auto flex items-center gap-1">
            <a
              href="https://github.com/fedora-icons/fedora-icons"
              className="hidden items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-muted transition hover:text-ink sm:inline-flex"
            >
              GitHub <UiIcon name="link-external" className="size-4" />
            </a>
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main id="main" tabIndex={-1} className="flex-1 outline-none">
        <Outlet />
      </main>
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-2 px-4 py-6 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>
            Core icons are{' '}
            <a className="underline underline-offset-2 hover:text-ink" href="/licenses/fedora-icons-LICENSE.txt">MIT licensed</a>.
            Brand icons are licensed separately.
          </p>
          <p className="font-mono text-xs text-faint">
            Library {lock.revision ? lock.revision.slice(0, 7) : 'unknown'}{lock.dirty ? ' + local changes' : ''}
          </p>
        </div>
      </footer>
    </div>
  );
}
