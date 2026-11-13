import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IconGrid, setProgressiveGrid } from '../src/components/IconGrid';

const items = Array.from({ length: 300 }, (_, i) => ({ name: `icon-${String(i).padStart(3, '0')}` }));

/** A stand-in IntersectionObserver that reports whatever the test says is in view. */
class FakeObserver {
  static all: FakeObserver[] = [];
  targets = new Set<Element>();
  constructor(public callback: IntersectionObserverCallback) { FakeObserver.all.push(this); }
  observe(target: Element) { this.targets.add(target); }
  unobserve(target: Element) { this.targets.delete(target); }
  disconnect() { this.targets.clear(); }
  static reveal(target: Element) {
    for (const o of FakeObserver.all) {
      if (o.targets.has(target)) o.callback([{ target, isIntersecting: true } as IntersectionObserverEntry], o as unknown as IntersectionObserver);
    }
  }
}

describe('progressive grid', () => {
  beforeEach(() => { setProgressiveGrid(true); FakeObserver.all = []; vi.stubGlobal('IntersectionObserver', FakeObserver); });
  afterEach(() => { cleanup(); setProgressiveGrid(false); vi.unstubAllGlobals(); });

  const sentinel = () => document.querySelector('ul > li[aria-hidden="true"]');

  it('mounts a screenful first, then more as the end comes into view', () => {
    render(<IconGrid items={items} svgs={null} selected={new Set()} onSelect={() => {}} label="Icons" />);
    expect(screen.getAllByRole('button')).toHaveLength(96);
    act(() => FakeObserver.reveal(sentinel()!));
    expect(screen.getAllByRole('button')).toHaveLength(192);
    act(() => FakeObserver.reveal(sentinel()!));
    act(() => FakeObserver.reveal(sentinel()!));
    expect(screen.getAllByRole('button')).toHaveLength(300);
    expect(sentinel()).toBeNull();
  });

  it('asks for artwork only for cells near the viewport', () => {
    const onNeed = vi.fn();
    const raf = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => { cb(0); return 0; });
    render(<IconGrid items={items} svgs={null} selected={new Set()} onSelect={() => {}} label="Icons" onNeed={onNeed} />);
    act(() => FakeObserver.reveal(screen.getByRole('button', { name: 'icon-005' }).closest('li')!));
    expect(onNeed).toHaveBeenCalledWith(['icon-005']);
    raf.mockRestore();
  });

  it('mounts everything at once when the selection is further down', () => {
    render(<IconGrid items={items} svgs={null} selected={new Set(['icon-250'])} onSelect={() => {}} label="Icons" />);
    expect(screen.getByRole('button', { name: 'icon-250' })).toBeTruthy();
  });
});
