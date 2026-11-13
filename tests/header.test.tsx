import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Layout } from '../src/components/Layout';
import { ToastProvider } from '../src/components/ui';
import { catalog, lock, resetStyleCache } from '../src/lib/catalog';
import { ThemeProvider } from '../src/lib/theme';
import { styleSvgs } from './helpers';

const license = readFileSync(join(__dirname, '../public/licenses/fedora-icons-LICENSE.txt'), 'utf8');
const fetchMock = vi.fn(async (url: string) => {
  if (url.endsWith('fedora-icons-LICENSE.txt')) return new Response(license, { status: 200 });
  const style = /icons\/(\w+)\.json/.exec(url)![1] as 'regular';
  return new Response(JSON.stringify(styleSvgs(style)), { status: 200 });
});

function renderAt(url: string) {
  return render(
    <ThemeProvider>
      <ToastProvider>
        <MemoryRouter initialEntries={[url]}>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<p>Home</p>} />
              <Route path="/docs" element={<h1>Documentation</h1>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </ThemeProvider>,
  );
}

beforeEach(() => { resetStyleCache(); fetchMock.mockClear(); vi.stubGlobal('fetch', fetchMock); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('Header actions', () => {
  it('links Get started and Figma in new tabs', () => {
    renderAt('/');
    const nav = screen.getByRole('navigation', { name: 'Main' });
    const start = within(nav).getByRole('link', { name: /Get started/ });
    expect(start.getAttribute('href')).toBe('https://github.com/fedora-icons/fedora-icons');
    expect(start.getAttribute('target')).toBe('_blank');
    const figma = within(nav).getByRole('link', { name: /^Figma/ });
    expect(figma.getAttribute('href')).toMatch(/^https:\/\/www\.figma\.com\/design\/5zcUV9E4Bu8FSssDfhyOWw\//);
    expect(figma.getAttribute('target')).toBe('_blank');
    expect(within(nav).queryByRole('link', { name: /Pricing/ })).toBeNull();
  });

  it('opens Docs from the header', async () => {
    const user = userEvent.setup();
    renderAt('/');
    await user.click(within(screen.getAllByRole('navigation', { name: 'Main' })[0]).getByRole('link', { name: 'Docs' }));
    expect(await screen.findByRole('heading', { name: 'Documentation' })).toBeTruthy();
  });

  it('Download builds a ZIP of every core icon in every style, plus the license', async () => {
    const user = userEvent.setup();
    let blob: Blob | null = null;
    let filename = '';
    vi.stubGlobal('URL', Object.assign(URL, {
      createObjectURL: (b: Blob) => { blob = b; return 'blob:test'; },
      revokeObjectURL: () => {},
    }));
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { filename = this.download; });
    renderAt('/');
    await user.click(within(screen.getByRole('navigation', { name: 'Main' })).getByRole('button', { name: 'Download' }));
    await screen.findByText(/^Downloaded fedora-icons-/);
    expect(filename).toBe(`fedora-icons-${lock.revision!.slice(0, 7)}.zip`);

    const { unzipSync, strFromU8 } = await import('fflate');
    const bytes = await new Promise<ArrayBuffer>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.readAsArrayBuffer(blob!);
    });
    const files = unzipSync(new Uint8Array(bytes));
    const names = Object.keys(files);
    expect(names.filter((n) => n.endsWith('.svg'))).toHaveLength(catalog.icons.length * catalog.styles.length);
    for (const folder of ['regular', 'solid', 'duocolor', 'duotone']) {
      expect(names).toContain(`${folder}/search.svg`);
    }
    // Files are the library's own artwork, untouched.
    expect(strFromU8(files['regular/search.svg'])).toBe(styleSvgs('regular').search);
    expect(strFromU8(files['LICENSE.txt'])).toBe(license);
    expect(names).toContain('README.txt');
  });
});
