import { createContext, useContext } from 'react';

/** One container for header, page content, and footer so their edges align. */
export const CONTAINER = 'mx-auto w-full max-w-[1280px] px-4 sm:px-6';

/** The layout's full-height slot beside the main column, for a page's side pane. */
export const PaneHostContext = createContext<HTMLElement | null>(null);
export const usePaneHost = () => useContext(PaneHostContext);

/** A slot in the site header (md and up) between the logo and the actions, for a page's own controls. */
export const HeaderSlotContext = createContext<HTMLElement | null>(null);
export const useHeaderSlot = () => useContext(HeaderSlotContext);
