import { createContext, startTransition, useCallback, useContext, useLayoutEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import uiIcons from '../data/ui-icons.json';

export type UiIconName = keyof typeof uiIcons;

/** Interface glyphs are Fedora's own Regular icons from the synced library. */
export function UiIcon({ name, className = 'size-5' }: { name: UiIconName; className?: string }) {
  return <span aria-hidden="true" className={`glyph inline-block shrink-0 ${className}`} dangerouslySetInnerHTML={{ __html: uiIcons[name] }} />;
}

type Variant = 'primary' | 'secondary' | 'ghost';
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand text-brand-ink hover:brightness-110 active:brightness-95',
  secondary: 'bg-surface text-ink border border-line-strong hover:bg-sunken',
  ghost: 'text-ink hover:bg-sunken',
};

export function Button({
  variant = 'secondary', className = '', icon, children, ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; icon?: UiIconName }) {
  return (
    <button
      type="button"
      className={`inline-flex h-9 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
      {...props}
    >
      {icon && <UiIcon name={icon} className="size-[18px]" />}
      {children}
    </button>
  );
}

export function IconButton({ label, icon, className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; icon: UiIconName }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`inline-flex size-9 items-center justify-center rounded-lg text-ink transition hover:bg-sunken ${className}`}
      {...props}
    >
      <UiIcon name={icon} />
    </button>
  );
}

/** Accessible single-choice segmented control (radio group semantics). */
export function Segmented<T extends string>({
  label, value, options, onChange, size = 'md', fill = false,
}: {
  label: string;
  value: T;
  options: { value: T; label: string; title?: string }[];
  onChange: (value: T) => void;
  size?: 'sm' | 'md';
  /** Below the sm breakpoint, span the full width with equal options. */
  fill?: boolean;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const groupRef = useRef<HTMLDivElement>(null);
  // Show the new selection immediately; let the (possibly heavy) parent
  // update follow as a transition so the slide starts on the next frame.
  const [pending, setPending] = useState<T | null>(null);
  const [seenValue, setSeenValue] = useState(value);
  if (seenValue !== value) {
    // The committed value changed (our transition landed, or something else
    // such as Back/Forward changed it): it wins over any pending selection.
    setSeenValue(value);
    setPending(null);
  }
  const current = pending ?? value;
  const index = options.findIndex((o) => o.value === current);
  const select = (next: T) => {
    setPending(next);
    startTransition(() => onChange(next));
  };
  const [pill, setPill] = useState<{ left: number; width: number; animate: boolean } | null>(null);

  // Measure the active option so the highlight can slide between options.
  // Re-measure on resize (fonts loading, layout changes) without animating.
  useLayoutEffect(() => {
    const measure = (animate: boolean) => {
      const el = refs.current[index];
      if (!el) { setPill(null); return; }
      setPill((prev) => ({ left: el.offsetLeft, width: el.offsetWidth, animate: animate && prev !== null }));
    };
    measure(true);
    const group = groupRef.current;
    if (!group || typeof ResizeObserver === 'undefined') return;
    let lastWidth = group.offsetWidth;
    const observer = new ResizeObserver(() => {
      if (group.offsetWidth === lastWidth) return;
      lastWidth = group.offsetWidth;
      measure(false);
    });
    observer.observe(group);
    return () => observer.disconnect();
  }, [index]);

  const move = (next: number) => {
    const target = (next + options.length) % options.length;
    select(options[target].value);
    refs.current[target]?.focus();
  };
  return (
    <div ref={groupRef} role="radiogroup" aria-label={label} className={`relative rounded-lg border border-line bg-sunken p-0.5 ${fill ? 'flex w-full sm:inline-flex sm:w-auto' : 'inline-flex'}`}>
      {pill && (
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute inset-y-0.5 left-0 rounded-md bg-surface shadow-sm ring-1 ring-line ${
            pill.animate ? 'transition-[transform,width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]' : ''
          }`}
          style={{ width: pill.width, transform: `translateX(${pill.left}px)` }}
        />
      )}
      {options.map((option, i) => {
        const checked = option.value === current;
        return (
          <button
            key={option.value}
            ref={(el) => { refs.current[i] = el; }}
            type="button"
            role="radio"
            aria-checked={checked}
            title={option.title}
            tabIndex={checked || (index < 0 && i === 0) ? 0 : -1}
            onClick={() => select(option.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); move(i + 1); }
              if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); move(i - 1); }
            }}
            className={`relative z-10 rounded-md font-medium transition-colors duration-200 ${size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-8 px-3 text-sm'} ${fill ? 'max-sm:min-w-0 max-sm:flex-1 max-sm:px-1' : ''} ${
              checked ? `text-ink ${pill ? '' : 'bg-surface shadow-sm ring-1 ring-line'}` : 'text-muted hover:text-ink'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Toasts: honest, announced feedback for every action ---------- */

interface Toast { id: number; tone: 'success' | 'error'; message: string }
const ToastContext = createContext<(tone: Toast['tone'], message: string) => void>(() => {});
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const next = useRef(0);
  const push = useCallback((tone: Toast['tone'], message: string) => {
    const id = ++next.current;
    setToasts((list) => [...list.slice(-2), { id, tone, message }]);
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), tone === 'error' ? 7000 : 3200);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4" aria-live="polite" role="status">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="pointer-events-auto flex max-w-md items-center gap-2 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm text-ink shadow-lg"
          >
            <UiIcon name={toast.tone === 'success' ? 'check' : 'x-circle'} className={`size-[18px] ${toast.tone === 'success' ? 'text-success' : 'text-danger'}`} />
            <span>{toast.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function VisuallyHidden({ children }: { children: ReactNode }) {
  return <span className="sr-only">{children}</span>;
}
