// jsdom lacks matchMedia; the app reads it for theme and layout.
if (!window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: false, media: query, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {},
    addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  }) as MediaQueryList;
}

// Page tests reach any cell right away; tests/icon-grid.test.tsx covers progressive mounting.
import { setProgressiveGrid } from '../src/components/IconGrid';
setProgressiveGrid(false);
