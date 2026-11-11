import { memo, useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';

export interface GridItem {
  name: string;
}

interface Props {
  items: GridItem[];
  svgs: Record<string, string> | null;
  selected: string | null;
  onSelect: (name: string) => void;
  label: string;
}

const Cell = memo(function Cell({
  name, svg, selected, tabbable, onSelect, onFocusIndex, index,
}: {
  name: string;
  svg: string | undefined;
  selected: boolean;
  tabbable: boolean;
  onSelect: (name: string) => void;
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
        aria-pressed={selected}
        onClick={() => onSelect(name)}
        onFocus={() => onFocusIndex(index)}
        className={`group relative flex aspect-square w-full items-center justify-center rounded-xl text-ink transition-colors focus-visible:outline-offset-0 ${
          selected ? 'bg-brand-soft ring-1 ring-brand' : 'hover:bg-sunken'
        }`}
      >
        {svg ? (
          <span className="glyph size-6" dangerouslySetInnerHTML={{ __html: svg }} />
        ) : (
          <span className="size-6 animate-pulse rounded-md bg-sunken" />
        )}
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute inset-x-1 bottom-1.5 truncate text-center text-[11px] leading-4 text-muted transition-opacity ${
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
  const selectedIndex = selected ? items.findIndex((i) => i.name === selected) : -1;
  const [active, setActive] = useState(0);
  const activeIndex = selectedIndex >= 0 && active >= items.length ? selectedIndex : Math.min(active, Math.max(items.length - 1, 0));

  useEffect(() => {
    if (selectedIndex >= 0) setActive(selectedIndex);
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
      className="grid grid-cols-[repeat(auto-fill,minmax(64px,1fr))] gap-1 sm:grid-cols-[repeat(auto-fill,minmax(84px,1fr))]"
    >
      {items.map((item, index) => (
        <Cell
          key={item.name}
          name={item.name}
          index={index}
          svg={svgs?.[item.name]}
          selected={item.name === selected}
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
    </p>
  );
}
