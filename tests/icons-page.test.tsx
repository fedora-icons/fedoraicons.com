import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { Layout } from '../src/components/Layout';
import { ToastProvider } from '../src/components/ui';
import { catalog, resetStyleCache } from '../src/lib/catalog';
import { ThemeProvider } from '../src/lib/theme';
import { IconsPage } from '../src/pages/IconsPage';
import { styleSvgs } from './helpers';

let location = '';
function Spy() {
  const l = useLocation();
  location = l.search;
  return null;
}

function renderAt(url: string) {
  return render(
    <ThemeProvider>
      <ToastProvider>
        <MemoryRouter initialEntries={[url]}>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<><IconsPage /><Spy /></>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </ThemeProvider>,
  );
}

/** Make `(min-width: 1024px)` match, so the persistent side pane renders. */
function useDesktop() {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('min-width: 1024px'), media: query, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {},
    addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  }));
}

const fetchMock = vi.fn(async (url: string) => {
  const style = /icons\/(\w+)\.json/.exec(url)![1] as 'regular';
  return new Response(JSON.stringify(styleSvgs(style)), { status: 200 });
});

beforeEach(() => {
  resetStyleCache();
  fetchMock.mockClear();
  vi.stubGlobal('fetch', fetchMock);
  // jsdom has no showModal; the mobile sheet uses it.
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) { this.removeAttribute('open'); };
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); localStorage.clear(); });

describe('Icons page', () => {
  it('shows the full catalog count from source data and loads only one style', async () => {
    renderAt('/');
    expect(screen.getByText(`${catalog.icons.length.toLocaleString('en-US')} icons`)).toBeTruthy();
    await screen.findAllByRole('button', { name: 'search' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toMatch(/regular\.json$/);
  });

  it('filters by search and writes the query to the URL', async () => {
    const user = userEvent.setup();
    renderAt('/');
    await user.type(screen.getByRole('searchbox', { name: 'Search icons' }), 'arrow');
    expect(location).toBe('?q=arrow');
    const grid = screen.getByRole('list', { name: 'Regular icons' });
    const count = within(grid).getAllByRole('listitem').length;
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThan(catalog.icons.length);
    expect(screen.getByText(new RegExp(`^${count} icons for “arrow”`))).toBeTruthy();
  });

  it('focuses search with "/" but not while typing in a field', async () => {
    const user = userEvent.setup();
    renderAt('/');
    const cell = (await screen.findAllByRole('button', { name: 'search' }))[0];
    cell.focus();
    await user.keyboard('/');
    const box = screen.getByRole('searchbox', { name: 'Search icons' });
    expect(document.activeElement).toBe(box);
    await user.keyboard('a/b');
    expect((box as HTMLInputElement).value).toBe('a/b');
  });

  it('shows a useful empty state', async () => {
    renderAt('/?q=zzzznothing');
    expect(screen.getByRole('heading', { name: /No icons match/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Clear search and filters' })).toBeTruthy();
  });

  it('restores style, category, and the selected icon from a shared URL', async () => {
    renderAt('/?category=Essentials&style=solid&icon=search');
    expect(await screen.findByRole('heading', { name: 'search', level: 2 })).toBeTruthy();
    expect(screen.getAllByRole('radio', { name: 'Solid', checked: true })).toHaveLength(2);
    expect((screen.getByLabelText('Category') as HTMLSelectElement).value).toBe('Essentials');
    expect(fetchMock.mock.calls[0][0]).toMatch(/filled\.json$/);
  });

  it('switching style updates the URL and fetches that style', async () => {
    const user = userEvent.setup();
    renderAt('/?icon=user-add');
    await screen.findByRole('heading', { name: 'user-add', level: 2 });
    const [toolbarStyle] = screen.getAllByRole('radiogroup', { name: 'Icon style' });
    await user.click(within(toolbarStyle).getByRole('radio', { name: 'Duotone' }));
    expect(location).toContain('style=duotone');
    expect(location).toContain('icon=user-add');
    await act(async () => {});
    expect(fetchMock.mock.calls.map((c) => c[0]).some((u) => /duotone\.json$/.test(u))).toBe(true);
  });

  it('offers only authored modifier compositions for a base icon', async () => {
    renderAt('/?icon=user');
    const select = (await screen.findByLabelText('Modifier')) as HTMLSelectElement;
    const options = Array.from(select.options).map((o) => o.value);
    const expected = catalog.icons.filter((i) => i.composition?.base === 'user').map((i) => i.name);
    expect(options).toEqual(['user', ...expected]);
  });

  it('keeps Docs and GitHub in the footer, not the header', () => {
    renderAt('/');
    const header = screen.getByRole('banner');
    expect(within(header).queryByRole('link', { name: /Docs|GitHub/ })).toBeNull();
    const footer = screen.getByRole('contentinfo');
    expect(within(footer).getByRole('link', { name: 'Docs' }).getAttribute('href')).toBe('/docs');
    expect(within(footer).getByRole('link', { name: /GitHub/ })).toBeTruthy();
  });

  it('offers Brands as the last style option and shows the empty state', async () => {
    const user = userEvent.setup();
    renderAt('/?q=arrow');
    const switcher = screen.getByRole('radiogroup', { name: 'Icon style' });
    const labels = within(switcher).getAllByRole('radio').map((r) => r.textContent);
    expect(labels).toEqual(['Regular', 'Solid', 'Duocolor', 'Duotone', 'Brands']);
    await user.click(within(switcher).getByRole('radio', { name: 'Brands' }));
    expect(location).toBe('?q=arrow&style=brands');
    expect(screen.getByRole('heading', { name: 'No brand icons are available yet' })).toBeTruthy();
    expect(screen.getByText('All brand icons belong to their respective owners.')).toBeTruthy();
    expect(screen.getByRole('searchbox', { name: 'Search brands' })).toBeTruthy();
  });
});

describe('Side pane (desktop)', () => {
  beforeEach(useDesktop);

  it('is open without a selection and customizes the whole grid', async () => {
    const user = userEvent.setup();
    renderAt('/');
    const pane = await screen.findByRole('complementary', { name: 'Icon panel' });
    expect(within(pane).getByRole('heading', { name: 'Customize' })).toBeTruthy();
    await screen.findAllByRole('button', { name: 'search' });
    const grid = screen.getByRole('list', { name: 'Regular icons' }).parentElement!;
    // Default: 64px with the automatic 0.85px stroke (0.85 / 1.25 = 0.68).
    expect(grid.style.getPropertyValue('--glyph-size')).toBe('64px');
    expect(grid.style.getPropertyValue('--stroke-scale')).toBe('0.68');
    expect(within(pane).getByText('Auto')).toBeTruthy();

    // Auto stroke follows the size.
    await user.click(within(pane).getByRole('button', { name: '24' }));
    expect(grid.style.getPropertyValue('--glyph-size')).toBe('24px');
    expect(grid.style.getPropertyValue('--stroke-scale')).toBe('1');

    // A manual stroke sticks across sizes until "Use auto".
    const slider = within(pane).getByRole('slider', { name: 'Stroke width' });
    fireEvent.change(slider, { target: { value: '2.5' } });
    expect(grid.style.getPropertyValue('--stroke-scale')).toBe('2');
    await user.click(within(pane).getByRole('button', { name: '32' }));
    expect(grid.style.getPropertyValue('--stroke-scale')).toBe('2');
    await user.click(within(pane).getByRole('button', { name: 'Use auto' }));
    expect(grid.style.getPropertyValue('--stroke-scale')).toBe('0.936');

    await user.click(within(pane).getByRole('button', { name: /Reset to defaults/ }));
    expect(grid.style.getPropertyValue('--stroke-scale')).toBe('0.68');
    expect(grid.style.getPropertyValue('--glyph-size')).toBe('64px');
  });

  it('has no stroke control for Solid', async () => {
    renderAt('/?style=solid');
    const pane = await screen.findByRole('complementary', { name: 'Icon panel' });
    expect(within(pane).queryByRole('slider', { name: 'Stroke width' })).toBeNull();
    expect(within(pane).getByText(/no stroke to adjust/)).toBeTruthy();
  });

  it('collapses, remembers it, and reopens when an icon is selected', async () => {
    const user = userEvent.setup();
    renderAt('/');
    const pane = await screen.findByRole('complementary', { name: 'Icon panel' });
    await user.click(within(pane).getByRole('button', { name: 'Collapse panel' }));
    expect(within(pane).getByRole('button', { name: 'Expand panel' }).getAttribute('aria-expanded')).toBe('false');
    expect(document.getElementById('side-pane-body')!.hidden).toBe(true);
    expect(localStorage.getItem('fedora-pane-collapsed')).toBe('1');

    await user.click((await screen.findAllByRole('button', { name: 'search' }))[0]);
    expect(document.getElementById('side-pane-body')!.hidden).toBe(false);
    expect(within(pane).getByRole('heading', { name: 'search', level: 2 })).toBeTruthy();

    await user.click(within(pane).getByRole('button', { name: 'Clear selection' }));
    expect(location).toBe('');
    expect(within(pane).getByRole('heading', { name: 'Customize' })).toBeTruthy();
  });

  it('carries the grid-wide stroke into the selected icon and its React note', async () => {
    const user = userEvent.setup();
    renderAt('/');
    const pane = await screen.findByRole('complementary', { name: 'Icon panel' });
    const slider = within(pane).getByRole('slider', { name: 'Stroke width' });
    fireEvent.change(slider, { target: { value: '2' } });
    await user.click((await screen.findAllByRole('button', { name: 'search' }))[0]);
    const preview = await within(pane).findByRole('img', { name: /search, Regular, scaled preview/ });
    expect(preview.innerHTML).toContain('stroke-width="2"');
    expect(within(pane).getByText(/React package draws the standard 1.25px stroke/)).toBeTruthy();
  });
});
