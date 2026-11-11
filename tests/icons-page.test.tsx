import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
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
          <Routes><Route path="/" element={<><IconsPage /><Spy /></>} /></Routes>
        </MemoryRouter>
      </ToastProvider>
    </ThemeProvider>,
  );
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
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

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
});
