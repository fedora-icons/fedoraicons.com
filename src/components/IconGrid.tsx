import { memo, useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';

export interface GridItem {
  name: string;
}

interface Props {
  items: GridItem[];
  svgs: Record<string, string> | null;
  /** Every selected icon (one for the inspector, several for a set). */
  selected: ReadonlySet<string>;
  /** `additive`: Shift/⌘/Ctrl was held, so toggle this icon in the set. */
  onSelect: (name: string, additive: boolean) => void;
  label: string;
}

const Cell = memo(function Cell({
  name, svg, selected, tabbable, onSelect, onFocusIndex, index,
}: {
  name: string;
  svg: string | undefined;
  selected: boolean;
  tabbable: boolean;
  onSelect: (name: string, additive: boolean) => void;
  onFocusIndex: (index: number) => void;
  index: number;
}) {
  return (
    <li className="icon-cell">
      <button
        type="button"
        data-icon={name}
        data-index={index}
        tabIndex={tabbable ? 0 : -1}
        aria-label={name}
        title={name.length > 22 ? name : undefined}
        aria-pressed={selected}
        onClick={(e) => onSelect(name, e.shiftKey || e.metaKey || e.ctrlKey)}
        // Shift-click would otherwise extend a text selection across the grid.
        onMouseDown={(e) => { if (e.shiftKey) e.preventDefault(); }}
        onKeyDown={(e) => {
          if (e.shiftKey && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            onSelect(name, true);
          }
        }}
        onFocus={() => onFocusIndex(index)}
        className={`group relative flex aspect-square sm:min-h-[var(--cell-min-h,0px)] w-full items-center justify-center rounded-xl text-ink transition-colors focus-visible:outline-offset-[-2px] ${
          selected ? 'bg-brand-soft ring-1 ring-inset ring-brand' : 'hover:bg-sunken'
        }`}
      >
        {svg ? (
          <span
            className={`glyph size-[min(var(--glyph-size,24px),40px)] transition-transform sm:size-[var(--glyph-size,24px)] duration-200 ${selected ? '-translate-y-[var(--glyph-lift,6px)]' : 'group-hover:-translate-y-[var(--glyph-lift,6px)] group-focus-visible:-translate-y-[var(--glyph-lift,6px)]'}`}
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        ) : (
          <span className="size-[min(var(--glyph-size,24px),40px)] animate-pulse rounded-md bg-sunken sm:size-[var(--glyph-size,24px)]" />
        )}
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute inset-x-1 bottom-1.5 line-clamp-2 text-center text-[11px] leading-[14px] text-muted [overflow-wrap:anywhere] transition-opacity ${
            selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100'
          }`}
        >
          {name}
        </span>
      </button>
    </li>
  );
});

/**
 * Dense, keyboard-navigable icon grid. The grid is one tab stop; arrow keys,
 * Home/End, and PageUp/PageDown move between icons; Enter/Space opens one.
 */
export function IconGrid({ items, svgs, selected, onSelect, label }: Props) {
  const listRef = useRef<HTMLUListElement>(null);
  const selectedIndex = selected.size ? items.findIndex((i) => selected.has(i.name)) : -1;
  const [active, setActive] = useState(0);
  const activeIndex = selectedIndex >= 0 && active >= items.length ? selectedIndex : Math.min(active, Math.max(items.length - 1, 0));

  // Follow the selection (e.g. from a shared URL), but never pull the roving
  // focus away from the cell someone is working from inside the grid.
  useEffect(() => {
    if (selectedIndex >= 0 && !listRef.current?.contains(document.activeElement)) setActive(selectedIndex);
  }, [selectedIndex]);

  const columns = () => {
    const list = listRef.current;
    if (!list || !list.children.length) return 1;
    const top = (list.children[0] as HTMLElement).offsetTop;
    let count = 0;
    for (const child of Array.from(list.children)) {
      if ((child as HTMLElement).offsetTop !== top) break;
      count += 1;
    }
    return Math.max(count, 1);
  };

  const focusIndex = (index: number) => {
    const clamped = Math.max(0, Math.min(items.length - 1, index));
    setActive(clamped);
    const button = listRef.current?.querySelector<HTMLButtonElement>(`button[data-index="${clamped}"]`);
    button?.focus();
    button?.scrollIntoView({ block: 'nearest' });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    const cols = columns();
    const map: Record<string, number> = {
      ArrowRight: activeIndex + 1,
      ArrowLeft: activeIndex - 1,
      ArrowDown: activeIndex + cols,
      ArrowUp: activeIndex - cols,
      Home: event.ctrlKey ? 0 : activeIndex - (activeIndex % cols),
      End: event.ctrlKey ? items.length - 1 : activeIndex - (activeIndex % cols) + cols - 1,
      PageDown: activeIndex + cols * 4,
      PageUp: activeIndex - cols * 4,
    };
    if (event.key in map) {
      event.preventDefault();
      focusIndex(map[event.key]);
    }
  };

  const onFocusIndex = useCallback((index: number) => setActive(index), []);

  return (
    <ul
      ref={listRef}
      aria-label={label}
      aria-describedby="grid-help"
      onKeyDown={onKeyDown}
      className="grid grid-cols-[repeat(auto-fill,minmax(64px,1fr))] gap-1 sm:grid-cols-[repeat(auto-fill,minmax(max(96px,calc((100%-28px)/8)),1fr))]"
    >
      {items.map((item, index) => (
        <Cell
          key={item.name}
          name={item.name}
          index={index}
          svg={svgs?.[item.name]}
          selected={selected.has(item.name)}
          tabbable={index === activeIndex}
          onSelect={onSelect}
          onFocusIndex={onFocusIndex}
        />
      ))}
    </ul>
  );
}

export function GridHelp() {
  return (
    <p id="grid-help" className="sr-only">
      Use arrow keys to move between icons and Enter to open the inspector.
      Shift plus Enter, or Shift-click, adds or removes an icon from a set you can download as a ZIP.
    </p>
  );
}
