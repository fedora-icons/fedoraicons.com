import { useI18n } from '../i18n';
import { errorText } from '../i18n/errors';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  CORNERS, initialCorner, loadModifiers, MODIFIER_GROUPS, modifierTileSvg,
  type Corner, type ModifierAsset,
} from '../lib/modifiers';

export interface ModifierChoice {
  modifier: ModifierAsset;
  corner: Corner;
}

/** Load the library's modifiers once the picker is shown. */
export function useModifiers(enabled: boolean) {
  const i18n = useI18n();
  const [state, setState] = useState<{ list: ModifierAsset[] | null; error: string | null }>({ list: null, error: null });
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    loadModifiers().then(
      (list) => { if (live) setState({ list, error: null }); },
      (e: unknown) => { if (live) setState({ list: null, error: errorText(e, i18n, 'error.loadModifiers') }); },
    );
    return () => { live = false; };
  }, [enabled]); // eslint-disable-line react-hooks/exhaustive-deps -- the message language is fixed per page load
  return state;
}

const tile = 'relative flex size-9 items-center justify-center rounded-lg border text-ink transition-colors';

export function ModifierPicker({
  modifiers, value, onChange, authored,
}: {
  modifiers: ModifierAsset[];
  value: ModifierChoice | null;
  onChange: (value: ModifierChoice | null) => void;
  /** Modifier names the library has authored for this icon, by corner. */
  authored: Map<string, Set<Corner>>;
}) {
  const cornerLabel = useId();
  const { t, label } = useI18n();
  const baseId = useId();
  const tiles = useMemo(() => new Map(modifiers.map((m) => [m.name, modifierTileSvg(m)])), [modifiers]);
  const groups: { id: string; label: string; tab: string; items: ModifierAsset[] }[] = MODIFIER_GROUPS
    .map((g) => ({ ...g, label: t(`modifiers.group.${g.id}`), tab: t(`modifiers.group.${g.id}.tab`), items: modifiers.filter((m) => m.group === g.id) }))
    .filter((g) => g.items.length);
  const ungrouped = modifiers.filter((m) => !MODIFIER_GROUPS.some((g) => g.id === m.group));
  if (ungrouped.length) groups.push({ id: 'other', label: t('modifiers.group.other'), tab: t('modifiers.group.other.tab'), items: ungrouped });
  const [tab, setTab] = useState(() => groups.find((g) => g.items.some((m) => m.name === value?.modifier.name))?.id ?? groups[0]?.id);
  const current = groups.find((g) => g.id === tab) ?? groups[0];
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const onTabKey = (e: React.KeyboardEvent, i: number) => {
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    const to = e.key === 'Home' ? 0 : e.key === 'End' ? groups.length - 1 : step ? (i + step + groups.length) % groups.length : -1;
    if (to < 0) return;
    e.preventDefault();
    setTab(groups[to].id);
    tabRefs.current[to]?.focus();
  };

  const pick = (m: ModifierAsset) => {
    if (value?.modifier.name === m.name) return onChange(null);
    const keep = value && m.positions[value.corner] ? value.corner : initialCorner(m);
    onChange({ modifier: m, corner: keep });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          aria-pressed={!value}
          onClick={() => onChange(null)}
          className={`h-8 rounded-lg border px-3 text-sm font-medium transition-colors ${
            !value ? 'border-ink bg-ink text-canvas' : 'border-line-strong hover:bg-sunken'
          }`}
        >
          {t('modifiers.none')}
        </button>
        <div className="flex items-center gap-2">
          <span id={cornerLabel} className="text-xs text-muted">{t('modifiers.corner')}</span>
          <div role="group" aria-labelledby={cornerLabel} className="grid grid-cols-2 gap-1">
            {CORNERS.map((corner) => {
              const allowed = !!value?.modifier.positions[corner];
              const active = value?.corner === corner;
              const [v, h] = corner.split('-');
              return (
                <button
                  key={corner}
                  type="button"
                  aria-label={t(`corner.${corner}`)}
                  title={allowed || !value ? t(`corner.${corner}`) : t('modifiers.onlySits', {
                    modifier: label('modifier', value.modifier.name, value.modifier.label),
                    corners: (Object.keys(value.modifier.positions) as Corner[]).map((c) => t(`corner.${c}.inline`)).join(', '),
                  })}
                  aria-pressed={active}
                  disabled={!allowed}
                  onClick={() => value && onChange({ ...value, corner })}
                  className={`flex size-6 rounded-md border p-1 transition-colors disabled:opacity-35 ${
                    v === 'top' ? 'items-start' : 'items-end'
                  } ${h === 'left' ? 'justify-start' : 'justify-end'} ${
                    active ? 'border-brand bg-brand-soft' : 'border-line-strong enabled:hover:bg-sunken'
                  }`}
                >
                  <span className={`size-2 rounded-[3px] ${active ? 'bg-brand' : 'bg-faint'}`} />
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div>
        <div role="tablist" aria-label={t('modifiers.categories')} className="flex gap-1 border-b border-line">
          {groups.map((group, i) => {
            const selected = group.id === current.id;
            const holdsChoice = group.items.some((m) => m.name === value?.modifier.name);
            return (
              <button
                key={group.id}
                ref={(el) => { tabRefs.current[i] = el; }}
                type="button"
                role="tab"
                id={`${baseId}-tab-${group.id}`}
                aria-selected={selected}
                aria-controls={`${baseId}-panel`}
                tabIndex={selected ? 0 : -1}
                title={group.label}
                onClick={() => setTab(group.id)}
                onKeyDown={(e) => onTabKey(e, i)}
                className={`-mb-px inline-flex items-center gap-1 border-b-2 px-2 pb-2 pt-1 text-xs font-medium transition-colors ${
                  selected ? 'border-ink text-ink' : 'border-transparent text-muted hover:text-ink'
                }`}
              >
                {group.tab}
                {holdsChoice && <span aria-hidden="true" className="size-1.5 rounded-full bg-brand" />}
              </button>
            );
          })}
        </div>
        <ul
          id={`${baseId}-panel`}
          role="tabpanel"
          aria-labelledby={`${baseId}-tab-${current.id}`}
          className="mt-2.5 grid grid-cols-8 gap-1"
        >
          {current.items.map((m) => {
            const active = value?.modifier.name === m.name;
            const hasAuthored = authored.has(m.name);
            return (
              <li key={m.name}>
                <button
                  type="button"
                  aria-pressed={active}
                  aria-label={t(hasAuthored ? 'modifiers.tileAuthored' : 'modifiers.tile', { label: label('modifier', m.name, m.label) })}
                  title={label('modifier', m.name, m.label)}
                  onClick={() => pick(m)}
                  className={`${tile} ${active ? 'border-brand bg-brand-soft' : 'border-transparent bg-sunken hover:border-line-strong'}`}
                >
                  <span className="glyph flex h-4 w-5 items-center justify-center [&>svg]:max-h-full [&>svg]:max-w-full" dangerouslySetInnerHTML={{ __html: tiles.get(m.name)! }} />
                  {hasAuthored && <span aria-hidden="true" className="absolute right-1 top-1 size-1.5 rounded-full bg-brand" />}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
