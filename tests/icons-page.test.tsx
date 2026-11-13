import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { Layout } from '../src/components/Layout';
import { resetSectionState } from '../src/components/Customize';
import { resetExportRows } from '../src/components/ExportPanel';
import { ToastProvider } from '../src/components/ui';
import { catalog, resetStyleCache } from '../src/lib/catalog';
import { ThemeProvider } from '../src/lib/theme';
import { IconsPage } from '../src/pages/IconsPage';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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
  if (url.endsWith('modifiers.json')) {
    return new Response(readFileSync(join(__dirname, '../public/modifiers.json'), 'utf8'), { status: 200 });
  }
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
afterEach(() => { cleanup(); resetSectionState(); resetExportRows(); vi.unstubAllGlobals(); vi.restoreAllMocks(); localStorage.clear(); });

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

  it('links to the library versions of a base icon', async () => {
    renderAt('/?icon=user');
    // The grid makes label queries slow; find the select directly once modifiers load.
    const select = await vi.waitFor(() => {
      const label = Array.from(document.querySelectorAll('label')).find((l) => l.textContent === 'Library versions');
      if (!label) throw new Error('Modifiers not loaded yet');
      return document.getElementById(label.htmlFor) as HTMLSelectElement;
    }, { timeout: 8000 });
    const options = Array.from(select.options).map((o) => o.value);
    const expected = catalog.icons.filter((i) => i.composition?.base === 'user').map((i) => i.name);
    expect(options).toEqual(['', ...expected]);
  });

  it('previews any modifier on an icon, in the corners it supports', async () => {
    const user = userEvent.setup();
    renderAt('/?icon=agent');
    const preview = await screen.findByRole('img', { name: /agent, Regular, scaled preview/ });
    expect(preview.innerHTML).not.toContain('clip-path');

    await user.click(await screen.findByRole('tab', { name: 'Access' }, { timeout: 8000 }));
    await user.click(screen.getByRole('button', { name: /^Lock modifier/ }));
    expect(screen.getByRole('button', { name: /^Lock modifier/ }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Bottom right' }).getAttribute('aria-pressed')).toBe('true');
    expect(preview.innerHTML).toMatch(/x="12.75" y="12.75"/);
    expect(screen.getByText(/Preview, not a library icon/)).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Top left' }));
    expect(preview.innerHTML).toMatch(/x="1.25" y="1.25"/);

    // File-type and image-quality modifiers only apply to files, folders, and images.
    expect(screen.queryByRole('tab', { name: 'Files' })).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Quality' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'None' }));
    expect(preview.innerHTML).not.toContain('clip-path');
  });

  it('offers file-type labels on files, only in the corners they support', async () => {
    const user = userEvent.setup();
    renderAt('/?icon=file');
    await user.click(await screen.findByRole('tab', { name: 'Files' }, { timeout: 8000 }));
    await user.click(screen.getByRole('button', { name: /^PDF modifier/ }));
    const enabled = ['Top left', 'Top right', 'Bottom left', 'Bottom right']
      .filter((c) => !(screen.getByRole('button', { name: c }) as HTMLButtonElement).disabled);
    expect(enabled).toEqual(['Bottom left']);
  });

  it('exports through Figma-style scale and format rows', async () => {
    const user = userEvent.setup();
    renderAt('/?icon=search');
    const list = await screen.findByRole('list', { name: 'Export settings' });
    // The page grid is large; query inside the Export section only.
    const ex = within(list.closest('section')!);
    expect(within(list).getAllByRole('listitem')).toHaveLength(1);
    // SVG is vector, so its scale is fixed.
    expect((ex.getByLabelText('Scale, row 1') as HTMLSelectElement).disabled).toBe(true);
    expect((ex.getByRole('button', { name: 'Remove row 1' }) as HTMLButtonElement).disabled).toBe(true);
    expect(ex.getByRole('button', { name: /^Export search$/ })).toBeTruthy();

    await user.click(ex.getByRole('button', { name: 'Add export setting' }));
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    await user.selectOptions(ex.getByLabelText('Format, row 2'), 'png');
    const scale2 = ex.getByLabelText('Scale, row 2') as HTMLSelectElement;
    expect(scale2.disabled).toBe(false);
    expect(scale2.selectedOptions[0].textContent).toBe('1.5x');
    expect(ex.getByRole('button', { name: 'Export search (2)' })).toBeTruthy();

    await user.click(ex.getByRole('button', { name: 'Options, row 2' }));
    expect((ex.getByLabelText('Suffix') as HTMLInputElement).placeholder).toBe('-72px');

    await user.click(ex.getByRole('button', { name: 'Remove row 1' }));
    expect(within(list).getAllByRole('listitem')).toHaveLength(1);

    // Copy follows the same shape; scale only applies to images.
    const copyScale = ex.getByLabelText('Copy scale') as HTMLSelectElement;
    expect(copyScale.disabled).toBe(true);
    await user.selectOptions(ex.getByLabelText('Copy as'), 'png');
    expect(copyScale.disabled).toBe(false);
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
    // Default: 48px with the automatic 1px stroke (1 / 1.25 = 0.8).
    expect(grid.style.getPropertyValue('--glyph-size')).toBe('48px');
    expect(grid.style.getPropertyValue('--stroke-scale')).toBe('0.8');
    expect(within(pane).getByText('Auto')).toBeTruthy();

    // The slider covers what the grid previews; larger sizes go in the px field.
    expect(within(pane).getByRole('slider', { name: 'Size' }).getAttribute('max')).toBe('64');

    // Auto stroke follows the size.
    fireEvent.change(within(pane).getByRole('slider', { name: 'Size' }), { target: { value: '24' } });
    expect(grid.style.getPropertyValue('--glyph-size')).toBe('24px');
    expect(grid.style.getPropertyValue('--stroke-scale')).toBe('1');

    // A manual stroke sticks across sizes until "Use auto".
    const slider = within(pane).getByRole('slider', { name: 'Stroke width' });
    fireEvent.change(slider, { target: { value: '2.5' } });
    expect(grid.style.getPropertyValue('--stroke-scale')).toBe('2');
    fireEvent.change(within(pane).getByRole('slider', { name: 'Size' }), { target: { value: '32' } });
    expect(grid.style.getPropertyValue('--stroke-scale')).toBe('2');
    await user.click(within(pane).getByRole('button', { name: 'Use auto' }));
    expect(grid.style.getPropertyValue('--stroke-scale')).toBe('0.92');

    await user.click(within(pane).getByRole('button', { name: /Reset to defaults/ }));
    expect(grid.style.getPropertyValue('--stroke-scale')).toBe('0.8');
    expect(grid.style.getPropertyValue('--glyph-size')).toBe('48px');
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
    const feedback = within(pane).getByRole('link', { name: /Feedback/ });
    expect(feedback.getAttribute('href')).toBe('https://github.com/fedora-icons/fedoraicons.com/issues/new');
    await user.click(within(pane).getByRole('button', { name: 'Collapse panel' }));
    expect(within(pane).queryByRole('link', { name: /Feedback/ })).toBeNull();
    // The theme toggle sits beside the collapse button, and stays on the rail.
    expect(within(pane).getByRole('button', { name: /^Theme:/ })).toBeTruthy();
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
    await user.click(within(pane).getByRole('button', { name: 'React' }));
    expect(within(pane).getByText(/React package draws the standard 1.25px stroke/)).toBeTruthy();
  });
});

describe('Multi-select and ZIP export (desktop)', () => {
  beforeEach(useDesktop);

  it('Shift-click builds a set from the open icon, and removing back to one reopens it', async () => {
    const user = userEvent.setup();
    renderAt('/?icon=search');
    const pane = await screen.findByRole('complementary', { name: 'Icon panel' });
    await within(pane).findByRole('heading', { name: 'search', level: 2 });
    const [user1] = await screen.findAllByRole('button', { name: 'user' });
    await user.keyboard('{Shift>}');
    await user.click(user1);
    await user.keyboard('{/Shift}');

    expect(within(pane).getByRole('heading', { name: '2 icons selected' })).toBeTruthy();
    expect(location).toBe('');
    const grid = screen.getByRole('list', { name: 'Regular icons' });
    const pressed = within(grid).getAllByRole('button', { pressed: true }).map((b) => b.getAttribute('aria-label'));
    expect(pressed.sort()).toEqual(['search', 'user']);

    // The set's settings are the shared look.
    expect(within(pane).getByRole('slider', { name: 'Stroke width' })).toBeTruthy();

    await user.click(within(pane).getByRole('button', { name: 'Remove user from selection' }));
    expect(location).toBe('?icon=search');
    expect(within(pane).getByRole('heading', { name: 'search', level: 2 })).toBeTruthy();
  });

  it('Shift+Enter adds the focused icon from the keyboard', async () => {
    const user = userEvent.setup();
    renderAt('/?icon=search');
    const pane = await screen.findByRole('complementary', { name: 'Icon panel' });
    const [cell] = await screen.findAllByRole('button', { name: 'user' });
    cell.focus();
    await user.keyboard('{Shift>}{Enter}{/Shift}');
    expect(within(pane).getByRole('heading', { name: '2 icons selected' })).toBeTruthy();
  });

  it('downloads the set as a ZIP of SVGs that use the shared look', async () => {
    const user = userEvent.setup();
    let blob: Blob | null = null;
    vi.stubGlobal('URL', Object.assign(URL, {
      createObjectURL: (b: Blob) => { blob = b; return 'blob:test'; },
      revokeObjectURL: () => {},
    }));
    // jsdom cannot follow the download link; the blob above is what matters.
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    renderAt('/?icon=search');
    const pane = await screen.findByRole('complementary', { name: 'Icon panel' });
    const [userCell] = await screen.findAllByRole('button', { name: 'user' });
    await user.keyboard('{Shift>}');
    await user.click(userCell);
    await user.keyboard('{/Shift}');

    fireEvent.change(within(pane).getByRole('slider', { name: 'Stroke width' }), { target: { value: '2' } });
    fireEvent.change(within(pane).getByRole('slider', { name: 'Size' }), { target: { value: '32' } });
    await user.click(within(pane).getByRole('button', { name: 'Download 2 icons (.zip)' }));
    await screen.findByText(/Downloaded 2 icons as fedora-icons-regular-2-svg\.zip/);

    const { unzipSync, strFromU8 } = await import('fflate');
    const bytes = await new Promise<ArrayBuffer>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.readAsArrayBuffer(blob!);
    });
    const files = unzipSync(new Uint8Array(bytes));
    expect(Object.keys(files).sort()).toEqual(['search-regular.svg', 'user-regular.svg']);
    for (const bytes of Object.values(files)) {
      const svg = strFromU8(bytes);
      expect(svg).toContain('width="32"');
      expect(svg).toContain('stroke-width="2"');
      expect(svg).not.toContain('currentColor');
    }
  });
});

describe('Search tips', () => {
  it('rotate through tricks while idle and pause while the field is focused', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      renderAt('/');
      const tip = () => screen.getByTestId('search-tip').textContent;
      expect(tip()).toMatch(/^Search 1,252 icons/);
      await act(async () => { vi.advanceTimersByTime(4500); });
      expect(tip()).toMatch(/^Tip: /);
      const shown = tip();
      act(() => screen.getByRole('searchbox', { name: 'Search icons' }).focus());
      await act(async () => { vi.advanceTimersByTime(9000); });
      expect(tip()).toBe(shown);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('Inspector sections (desktop)', () => {
  beforeEach(useDesktop);

  it('keeps React usage collapsed until expanded, with Copy still available', async () => {
    const user = userEvent.setup();
    renderAt('/?icon=search');
    const pane = await screen.findByRole('complementary', { name: 'Icon panel' });
    const toggle = await within(pane).findByRole('button', { name: 'React' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(document.getElementById(toggle.getAttribute('aria-controls')!)!.hidden).toBe(true);
    expect(within(toggle.closest('section')!).getByRole('button', { name: 'Copy' })).toBeTruthy();
    await user.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    const code = pane.querySelector('.code-block code')!;
    expect(code.textContent).toMatch(/^import \{ SearchRegular \} from '@fedora-icons\/react';/);
    // Syntax colors arrive once the highlighter loads.
    await vi.waitFor(() => expect(pane.querySelector('.code-block .hljs-keyword')?.textContent).toBe('import'));
  });

  it('previews a duo palette variant by switching the whole site theme', async () => {
    const user = userEvent.setup();
    renderAt('/?style=duocolor');
    const pane = await screen.findByRole('complementary', { name: 'Icon panel' });
    const variant = within(pane).getByRole('radiogroup', { name: 'Palette variant' });
    await user.click(within(variant).getByRole('radio', { name: 'Dark' }));
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem('fedora-theme')).toBe('dark');
    await user.click(within(variant).getByRole('radio', { name: 'Light' }));
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('says when filled parts of an icon keep their weight as the stroke changes', async () => {
    renderAt('/?icon=cloud-moon');
    const pane = await screen.findByRole('complementary', { name: 'Icon panel' });
    // Default 48px Auto stroke is 1px, not the drawn 1.25px.
    expect(await within(pane).findByText(/drawn as filled shapes/)).toBeTruthy();
  });

  it('does not show that note for an icon made only of strokes', async () => {
    renderAt('/?icon=search');
    const pane = await screen.findByRole('complementary', { name: 'Icon panel' });
    await within(pane).findByRole('img', { name: /search, Regular/ });
    expect(within(pane).queryByText(/drawn as filled shapes/)).toBeNull();
  });
});
