import { useI18n } from '../i18n';
import { useTheme, type ThemePreference } from '../lib/theme';
import { UiIcon, type UiIconName } from './ui';

const THEME_ORDER: ThemePreference[] = ['system', 'light', 'dark'];
const THEME_ICONS: Record<ThemePreference, UiIconName> = { system: 'monitor', light: 'sun', dark: 'moon' };

export function ThemeToggle({ className = '' }: { className?: string }) {
  const { preference, setPreference } = useTheme();
  const { t } = useI18n();
  const next = THEME_ORDER[(THEME_ORDER.indexOf(preference) + 1) % THEME_ORDER.length];
  const label = t('theme.toggle', { current: t(`theme.${preference}`), next: t(`theme.${next}`) });
  return (
    <button
      type="button"
      onClick={() => setPreference(next)}
      aria-label={label}
      title={label}
      className={`inline-flex size-9 items-center justify-center rounded-lg text-ink transition hover:bg-sunken ${className}`}
    >
      <UiIcon name={THEME_ICONS[preference]} />
    </button>
  );
}
