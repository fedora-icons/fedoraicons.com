import type { StyleId } from './catalog';
import { isDuo } from './svg';

/** Mirrors the naming rule in fedora-icons/react-fedora scripts/build.mjs. */
export function componentName(name: string, style: StyleId): string {
  const pascal = name.split('-').map((part) => part[0].toUpperCase() + part.slice(1)).join('');
  return `${/^\d/.test(pascal) ? 'Icon' : ''}${pascal}${style[0].toUpperCase()}${style.slice(1)}`;
}

export interface SnippetOptions {
  size: number;
  /** Regular/Solid color, or `null` to inherit `currentColor`. */
  color: string | null;
  primary?: string;
  secondary?: string;
  modifier?: string;
}

/** Usage example using only props the React package documents. */
export function reactSnippet(name: string, style: StyleId, options: SnippetOptions): string {
  const component = componentName(name, style);
  const props: string[] = [];
  if (options.size !== 24) props.push(`size={${options.size}}`);
  if (isDuo(style)) {
    if (options.primary) props.push(`primaryColor="${options.primary}"`);
    if (options.secondary && style === 'duocolor') props.push(`secondaryColor="${options.secondary}"`);
  } else if (options.color) {
    props.push(`color="${options.color}"`);
  }
  if (options.modifier) props.push(`modifierColor="${options.modifier}"`);
  const attrs = props.length ? ` ${props.join(' ')}` : '';
  return `import { ${component} } from '@fedora-icons/react';\n\n<${component}${attrs} />`;
}
