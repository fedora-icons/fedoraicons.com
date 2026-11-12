import { useTheme, type ThemePreference } from '../lib/theme';
import { UiIcon, type UiIconName } from './ui';

const THEME_ORDER: ThemePreference[] = ['system', 'light', 'dark'];
const THEME_META: Record<ThemePreference, { icon: UiIconName; label: string }> = {
  system: { icon: 'monitor', label: 'System' },
  light: { icon: 'sun', label: 'Light' },
  dark: { icon: 'moon', label: 'Dark' },
};

export function ThemeToggle({ className = '' }: { className?: string }) {
  const { preference, setPreference } = useTheme();
  const next = THEME_ORDER[(THEME_ORDER.indexOf(preference) + 1) % THEME_ORDER.length];
  const label = `Theme: ${THEME_META[preference].label}. Switch to ${THEME_META[next].label}.`;
  return (
    <button
      type="button"
      onClick={() => setPreference(next)}
      aria-label={label}
      title={label}
      className={`inline-flex size-9 items-center justify-center rounded-lg text-ink transition hover:bg-sunken ${className}`}
    >
      <UiIcon name={THEME_META[preference].icon} />
    </button>
  );
}
