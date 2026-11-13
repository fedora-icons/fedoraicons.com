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
    expect(document.querySelector('.code-block[data-lang="sh"]')?.textContent).toMatch(/^Terminal/);
  });

  it('documents what the site stores in a Privacy section', () => {
    render(<ToastProvider><MemoryRouter><DocsPage /></MemoryRouter></ToastProvider>);
    const nav = screen.getByRole('navigation', { name: 'Documentation' });
    expect(within(nav).getByRole('link', { name: 'Privacy' }).getAttribute('href')).toBe('#privacy');
    const section = document.getElementById('privacy')!;
    expect(section.textContent).toMatch(/no cookies/);
    expect(section.textContent).toContain('fedora-theme');
    expect(section.textContent).toContain('fedora-pane-collapsed');
  });
});
