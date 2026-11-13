import { useCallback, useState } from 'react';

/** Side pane width in px: default, limits, and keyboard step. */
export const PANE_WIDTH = { default: 380, min: 320, max: 640, step: 16 } as const;
const KEY = 'fedora-pane-width';

const clamp = (value: number) => Math.round(Math.min(PANE_WIDTH.max, Math.max(PANE_WIDTH.min, value)));

function read(): number {
  try {
    const value = Number(localStorage.getItem(KEY));
    return value ? clamp(value) : PANE_WIDTH.default;
  } catch {
    return PANE_WIDTH.default;
  }
}

/** The desktop side pane's width, remembered on this device (see Docs › Privacy). */
export function usePaneWidth() {
  const [width, setState] = useState(read);
  const setWidth = useCallback((next: number, remember = true) => {
    const value = clamp(next);
    setState(value);
    if (!remember) return;
    try {
      if (value === PANE_WIDTH.default) localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, String(value));
    } catch {
      // Storage may be blocked; the width still applies for this visit.
    }
  }, []);
  return [width, setWidth] as const;
}
