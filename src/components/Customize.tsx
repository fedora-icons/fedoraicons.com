import { useI18n } from '../i18n';
import { useEffect, useId, useState, type ReactNode } from 'react';
import { palettes, type StyleId } from '../lib/catalog';
import {
  autoStroke, DEFAULT_LOOK, GRID_MAX_SIZE, isCustomized, MAX_SIZE, MIN_SIZE, resolveLook, SIZE_SLIDER_MAX, SIZE_SLIDER_MIN, SIZE_STEP, STROKE_MAX, STROKE_MIN, STROKE_STEP,
  strokeAdjustable, strokeOf, type Look,
} from '../lib/look';
import { BASE_STROKE, isDuo, isHexColor } from '../lib/svg';
import { useTheme } from '../lib/theme';
import { IconButton, Segmented, UiIcon } from './ui';

export function ColorField({ label, value, onChange, hint }: { label: string; value: string; onChange: (v: string) => void; hint?: string }) {
  const id = useId();
  const { t } = useI18n();
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  const valid = isHexColor(text);
  return (
    <div className="flex items-center gap-3">
      <input
        type="color"
        aria-label={t('customize.colorInput', { label })}
        value={value.length === 7 ? value : '#000000'}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        className="size-9 shrink-0 cursor-pointer rounded-lg border border-line-strong bg-surface p-1 [&::-webkit-color-swatch]:rounded-md [&::-webkit-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:p-0"
      />
      <div className="min-w-0 flex-1">
        <label htmlFor={id} className="block text-xs font-medium text-muted">{label}</label>
        <input
          id={id}
          value={text}
          spellCheck={false}
          aria-invalid={!valid}
          aria-describedby={hint ? `${id}-hint` : undefined}
          onChange={(e) => {
            setText(e.target.value);
            if (isHexColor(e.target.value)) onChange(e.target.value.toUpperCase());
          }}
          onBlur={() => setText(value)}
          className={`mt-0.5 h-8 w-full rounded-md border bg-surface px-2 font-mono text-sm uppercase ${valid ? 'border-line' : 'border-danger'}`}
        />
        {hint && <p id={`${id}-hint`} className="mt-1 text-xs text-faint">{hint}</p>}
      </div>
    </div>
  );
}

/** Open/closed state per section title, kept while the page is open, so it survives switching icons. */
const sectionOpen = new Map<string, boolean>();
export const resetSectionState = () => sectionOpen.clear();

export function Section({
  title, children, aside, collapsible = true, defaultOpen = true,
}: {
  title: string;
  children: ReactNode;
  aside?: ReactNode;
  /** Render the title as a disclosure button that shows or hides the body. */
  collapsible?: boolean;
  defaultOpen?: boolean;
}) {
  const [open, setOpenState] = useState(() => sectionOpen.get(title) ?? defaultOpen);
  const setOpen = (update: (o: boolean) => boolean) => setOpenState((o) => {
    const next = update(o);
    sectionOpen.set(title, next);
    return next;
  });
  const bodyId = useId();
  const heading = 'font-sans text-xs font-semibold uppercase tracking-[0.08em] text-muted';
  const expanded = !collapsible || open;
  return (
    <section className="border-t border-line px-5 py-4">
      <div className={`flex min-h-7 items-center justify-between gap-2 ${expanded ? 'mb-3' : ''}`}>
        {collapsible ? (
          <h3 className={heading}>
            <button
              type="button"
              aria-expanded={open}
              aria-controls={bodyId}
              onClick={() => setOpen((o) => !o)}
              className="-mx-1 inline-flex items-center gap-1.5 rounded px-1 uppercase hover:text-ink"
            >
              <UiIcon name="chevron-down" className={`size-3.5 transition-transform duration-200 ${open ? '' : '-rotate-90'}`} />
              {title}
            </button>
          </h3>
        ) : (
          <h3 className={heading}>{title}</h3>
        )}
        {aside}
      </div>
      <div id={bodyId} hidden={!expanded}>
        {children}
      </div>
    </section>
  );
}

const fmtStroke = (w: number) => `${Number(w.toFixed(2))}px`;

/** Size, stroke, and color: shared by the grid-wide panel and the inspector. */
export function CustomizeControls({
  look, onChange, style, kind = 'core', footnote, strokeFootnote,
}: {
  look: Look;
  onChange: (patch: Partial<Look>) => void;
  style: StyleId;
  kind?: 'core' | 'brand';
  /** Extra color notes that only make sense for one icon (e.g. single contour). */
  footnote?: ReactNode;
  /** Stroke notes that only make sense for one icon (e.g. filled parts). */
  strokeFootnote?: ReactNode;
}) {
  const { resolved: theme, setPreference } = useTheme();
  const { t } = useI18n();
  const uid = useId();
  const duo = isDuo(style);
  const r = resolveLook(look, theme);
  const [sizeText, setSizeText] = useState(String(look.size));
  useEffect(() => setSizeText(String(look.size)), [look.size]);

  const commitSize = (value: number) => {
    const next = Math.round(Math.min(MAX_SIZE, Math.max(MIN_SIZE, value)));
    onChange({ size: next });
    setSizeText(String(next));
  };
  const canStroke = strokeAdjustable(style, kind);
  const stroke = strokeOf(look);

  return (
    <>
      <Section
        title={t('customize.size')}
        aside={(
          <label className="flex items-center gap-1.5 text-xs text-muted">
            <span className="sr-only">{t('customize.sizeCustom')}</span>
            <input
              type="number"
              inputMode="numeric"
              min={MIN_SIZE}
              max={MAX_SIZE}
              value={sizeText}
              onChange={(e) => {
                setSizeText(e.target.value);
                const n = Number(e.target.value);
                if (Number.isFinite(n) && n >= MIN_SIZE && n <= MAX_SIZE) onChange({ size: Math.round(n) });
              }}
              onBlur={() => commitSize(Number(sizeText) || DEFAULT_LOOK.size)}
              className="h-7 w-14 rounded-md border border-line-strong bg-surface px-2 text-right font-mono text-xs tabular-nums text-ink"
            />
            {t('customize.px')}
          </label>
        )}
      >
        <label htmlFor={`${uid}-size`} className="sr-only">{t('customize.size')}</label>
        <input
          id={`${uid}-size`}
          type="range"
          min={SIZE_SLIDER_MIN}
          max={SIZE_SLIDER_MAX}
          step={SIZE_STEP}
          value={Math.min(SIZE_SLIDER_MAX, Math.max(SIZE_SLIDER_MIN, look.size))}
          aria-valuetext={t('customize.pxValue', { value: look.size })}
          onChange={(e) => commitSize(Number(e.target.value))}
          className="range w-full"
        />
        <div className="mt-1 flex justify-between text-[11px] tabular-nums text-faint" aria-hidden="true">
          <span>{t('customize.pxValue', { value: SIZE_SLIDER_MIN })}</span>
          <span>{t('customize.pxValue', { value: SIZE_SLIDER_MAX })}</span>
        </div>
        {look.size > GRID_MAX_SIZE && (
          <p className="mt-2 text-xs leading-relaxed text-faint">{t('customize.gridLimit', { max: GRID_MAX_SIZE, size: look.size })}</p>
        )}
      </Section>

      <Section
        title={t('customize.stroke')}
        aside={canStroke && (
          <span className="flex items-center gap-2 text-xs">
            {look.strokeWidth === null ? (
              <span className="rounded bg-sunken px-1.5 py-0.5 font-medium text-muted">{t('customize.strokeAuto')}</span>
            ) : (
              <button type="button" onClick={() => onChange({ strokeWidth: null })} className="font-medium text-brand hover:underline">
                {t('customize.strokeUseAuto')}
              </button>
            )}
            <span className="font-mono tabular-nums text-ink">{fmtStroke(stroke)}</span>
          </span>
        )}
      >
        {canStroke ? (
          <>
            <label htmlFor={`${uid}-stroke`} className="sr-only">{t('customize.stroke')}</label>
            <input
              id={`${uid}-stroke`}
              type="range"
              min={STROKE_MIN}
              max={STROKE_MAX}
              step={STROKE_STEP}
              value={stroke}
              aria-valuetext={look.strokeWidth === null ? t('customize.strokeAutoValue', { value: fmtStroke(stroke) }) : fmtStroke(stroke)}
              onChange={(e) => onChange({ strokeWidth: Number(e.target.value) })}
              className="range w-full"
            />
            <div className="mt-1 flex justify-between text-[11px] tabular-nums text-faint" aria-hidden="true">
              <span>{fmtStroke(STROKE_MIN)}</span>
              <span>{fmtStroke(STROKE_MAX)}</span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-faint">
              {look.strokeWidth === null
                ? t('customize.strokeAutoHelp', { base: fmtStroke(BASE_STROKE), large: fmtStroke(autoStroke(64)) })
                : t('customize.strokeFixedHelp')}
            </p>
            {strokeFootnote}
          </>
        ) : (
          <p className="text-xs leading-relaxed text-faint">
            {kind === 'brand' ? t('customize.strokeBrand') : t('customize.strokeSolid')}
          </p>
        )}
      </Section>

      <Section
        title={t('customize.color')}
        aside={duo && (
          <Segmented
            label={t('customize.paletteVariant')}
            size="sm"
            value={r.mode}
            // The variant is previewed on the matching background: switch the site theme.
            onChange={(v) => { setPreference(v); onChange({ custom: null }); }}
            options={[{ value: 'light', label: t('theme.light') }, { value: 'dark', label: t('theme.dark') }]}
          />
        )}
      >
        {duo ? (
          <div className="space-y-3">
            <div role="radiogroup" aria-label={t('customize.duoPalette')} className="flex flex-wrap gap-1.5">
              {palettes.palettes.map((p) => {
                const checked = !look.custom && p.name === r.palette.name;
                return (
                  <button
                    key={p.name}
                    type="button"
                    role="radio"
                    aria-checked={checked}
                    aria-label={p.name}
                    title={p.name}
                    onClick={() => onChange({ paletteName: p.name, custom: null })}
                    className={`flex size-8 items-center justify-center rounded-full ring-offset-2 ring-offset-surface ${checked ? 'ring-2 ring-ink' : ''}`}
                  >
                    <span className="flex size-6 overflow-hidden rounded-full border border-line" aria-hidden="true">
                      <span className="flex-1" style={{ background: p[r.mode].primary }} />
                      <span className="flex-1" style={{ background: p[r.mode].secondary }} />
                    </span>
                  </button>
                );
              })}
            </div>
            <ColorField label={t('customize.primary')} value={r.duo.primary} onChange={(v) => onChange({ custom: { ...r.duo, primary: v } })} />
            {style === 'duocolor' && (
              <ColorField label={t('customize.secondary')} value={r.duo.secondary} onChange={(v) => onChange({ custom: { ...r.duo, secondary: v } })} />
            )}
            {style === 'duotone' && (
              <p className="text-xs leading-relaxed text-faint">{t('customize.duotoneTint')}</p>
            )}
            {footnote}
            <p className="text-xs text-faint">
              {t('customize.paletteNote', { current: look.custom ? t('customize.customColors') : t('customize.paletteMode', { palette: r.palette.name, mode: t(`theme.${r.mode}`) }) })}
            </p>
          </div>
        ) : (
          <>
            <ColorField
              label={t('customize.foreground')}
              value={r.mono}
              onChange={(v) => onChange({ mono: v })}
              hint={look.mono ? undefined : t('customize.followTheme')}
            />
            {footnote}
          </>
        )}
      </Section>
    </>
  );
}

/** The pane's content when no icon is selected. */
export function CustomizePanel({
  look, onChange, onReset, onClose, style, kind, headingId,
}: {
  look: Look;
  onChange: (patch: Partial<Look>) => void;
  onReset: () => void;
  /** Mobile sheet only. */
  onClose?: () => void;
  style: StyleId;
  kind: 'core' | 'brand';
  headingId: string;
}) {
  const { t } = useI18n();
  return (
    <div className="flex min-h-full flex-col">
      <div className="flex items-start gap-3 px-5 pb-4 pt-5">
        <div className="min-w-0 flex-1">
          <h2 id={headingId} tabIndex={-1} className="text-xl font-semibold outline-none">{t('customize.title')}</h2>
          <p className="mt-1 text-sm text-muted">
            {t('customize.intro')}
          </p>
        </div>
        {onClose && <IconButton icon="x" label={t('customize.close')} onClick={onClose} className="-mr-2 -mt-1" />}
      </div>
      <CustomizeControls look={look} onChange={onChange} style={style} kind={kind} />
      <div className="border-t border-line px-5 py-4">
        <button
          type="button"
          disabled={!isCustomized(look)}
          onClick={onReset}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline disabled:cursor-not-allowed disabled:text-faint disabled:no-underline"
        >
          <UiIcon name="undo" className="size-4" />
          {t('customize.reset')}
        </button>
      </div>
    </div>
  );
}
