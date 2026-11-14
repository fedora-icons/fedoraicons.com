import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { ToastProvider } from '../src/components/ui';
import DocsPage from '../src/pages/DocsPage';

afterEach(cleanup);

describe('Docs page', () => {
  it('marks the current section in the side nav', async () => {
    Element.prototype.scrollIntoView ??= () => {};
    render(<ToastProvider><MemoryRouter><DocsPage /></MemoryRouter></ToastProvider>);
    const nav = screen.getByRole('navigation', { name: 'Documentation' });
    // jsdom has no layout, so only the click path is testable here.
    await userEvent.click(within(nav).getByRole('link', { name: 'Sizes' }));
    expect(within(nav).getByRole('link', { name: 'Sizes' }).getAttribute('aria-current')).toBe('location');
    expect(nav.querySelectorAll('[aria-current]')).toHaveLength(1);
  });

  it('renders code samples in dark, labeled blocks', () => {
    render(<ToastProvider><MemoryRouter><DocsPage /></MemoryRouter></ToastProvider>);
    const blocks = document.querySelectorAll('.code-block');
    expect(blocks.length).toBeGreaterThan(0);
    const shell = document.querySelector('.code-block[data-lang="sh"]')?.textContent;
    expect(shell).toMatch(/^Terminal/);
    expect(shell).toContain('npm install @fos-icons/react');
    expect(shell).toContain('pnpm add @fos-icons/react');
  });

  it('documents what the site stores in a Privacy section', () => {
    render(<ToastProvider><MemoryRouter><DocsPage /></MemoryRouter></ToastProvider>);
    const nav = screen.getByRole('navigation', { name: 'Documentation' });
    expect(within(nav).getByRole('link', { name: 'Privacy' }).getAttribute('href')).toBe('#privacy');
    const section = document.getElementById('privacy')!;
    expect(section.textContent).toMatch(/no cookies/);
    expect(section.textContent).toContain('fos-theme');
    expect(section.textContent).toContain('fos-pane-collapsed');
    expect(section.textContent).toContain('fos-pane-width');
  });

  it('filters sections and the side nav with the search box', async () => {
    render(<ToastProvider><MemoryRouter><DocsPage /></MemoryRouter></ToastProvider>);
    const nav = screen.getByRole('navigation', { name: 'Documentation' });
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search the docs' }), 'fos-theme');
    expect(document.getElementById('privacy')!.hidden).toBe(false);
    expect(document.getElementById('react')!.hidden).toBe(true);
    expect(within(nav).getAllByRole('link').map((a) => a.textContent)).toEqual(['Privacy']);
    expect(screen.getByText('1 section matches').getAttribute('role')).toBe('status');
  });

  it('needs every word to match, and offers to clear when nothing does', async () => {
    render(<ToastProvider><MemoryRouter><DocsPage /></MemoryRouter></ToastProvider>);
    const box = screen.getByRole('searchbox', { name: 'Search the docs' });
    await userEvent.type(box, 'figma zzqx');
    expect(document.querySelectorAll('section:not([hidden])')).toHaveLength(0);
    // "Copy" button labels are not searchable content.
    await userEvent.clear(box);
    await userEvent.type(box, 'copy');
    expect(document.getElementById('colors')!.hidden).toBe(true);
    await userEvent.clear(box);
    await userEvent.type(box, 'zzqx');
    await userEvent.click(screen.getAllByRole('button', { name: 'Clear search' }).at(-1)!);
    expect(box).toHaveProperty('value', '');
    expect(document.querySelectorAll('section[hidden]')).toHaveLength(0);
  });
});
