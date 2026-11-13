import { cleanup, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AppShell } from '../src/App';

const fetchMock = vi.fn(async (url: string) => {
  if (url.endsWith('modifiers.json')) return new Response(readFileSync(join(__dirname, '../public/modifiers.json'), 'utf8'));
  if (url.includes('brands/')) return new Response(readFileSync(join(__dirname, '../public', url.slice(url.indexOf('brands/'))), 'utf8'));
  const style = /icons\/(\w+)\.json/.exec(url)?.[1] ?? 'regular';
  return new Response(readFileSync(join(__dirname, '../public/icons', `${style}.json`), 'utf8'));
});

// jsdom has no <dialog> methods; the phone-size inspector opens in one.
HTMLDialogElement.prototype.showModal ??= function showModal(this: HTMLDialogElement) { this.open = true; };
HTMLDialogElement.prototype.close ??= function close(this: HTMLDialogElement) { this.open = false; };

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

/** Every link to another site, on every page and panel, opens in a new tab. */
describe('external links', () => {
  const pages = ['/', '/?icon=rocket', '/?style=brands', '/?q=zzzznothing', '/docs', '/missing'];
  for (const url of pages) {
    it(`open in a new tab on ${url}`, async () => {
      vi.stubGlobal('fetch', fetchMock);
      const { findAllByRole } = render(
        <MemoryRouter initialEntries={[url]}>
          <AppShell />
        </MemoryRouter>,
      );
      await findAllByRole('link');
      // Let lazy pages (Docs) and panels settle.
      await new Promise((r) => setTimeout(r, 50));
      const external = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href^="http"]'));
      expect(external.length).toBeGreaterThan(0);
      const sameTab = external.filter((a) => a.target !== '_blank' || !a.rel.includes('noreferrer')).map((a) => a.href);
      expect(sameTab).toEqual([]);
    });
  }
});
