import { describe, expect, it } from 'vitest';
import { componentName, reactSnippet } from '../src/lib/react-snippet';

describe('React snippet', () => {
  it('follows the package naming rule', () => {
    expect(componentName('fuel-pump', 'regular')).toBe('FuelPumpRegular');
    expect(componentName('camera', 'filled')).toBe('CameraFilled');
    expect(componentName('4k', 'duotone')).toBe('Icon4kDuotone');
  });

  it('uses documented props only', () => {
    expect(reactSnippet('camera', 'regular', { size: 24, color: null })).toBe(
      "import { CameraRegular } from '@fedora-icons/react';\n\n<CameraRegular />",
    );
    const duo = reactSnippet('user-add', 'duocolor', { size: 32, color: null, primary: '#111111', secondary: '#222222', modifier: '#333333' });
    expect(duo).toContain('<UserAddDuocolor size={32} primaryColor="#111111" secondaryColor="#222222" modifierColor="#333333" />');
    expect(reactSnippet('camera', 'duotone', { size: 24, color: null, primary: '#111111', secondary: '#222222' })).not.toContain('secondaryColor');
  });
});
