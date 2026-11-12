import hljs from 'highlight.js/lib/core';
import bash from 'highlight.js/lib/languages/bash';
import css from 'highlight.js/lib/languages/css';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';

hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('css', css);

const ALIASES: Record<string, string> = { tsx: 'typescript', ts: 'typescript', sh: 'bash', html: 'xml', svg: 'xml', css: 'css' };

/** Escaped, highlighted HTML for a snippet, or null for an unknown language. */
export function highlight(code: string, lang: string): string | null {
  const language = ALIASES[lang];
  if (!language) return null;
  const html = hljs.highlight(code, { language, ignoreIllegals: true }).value;
  // Terminal: the bash grammar only knows builtins, so mark each line's command word.
  return language === 'bash'
    ? html.replace(/^([A-Za-z][\w.-]*)(?=\s|$)/gm, '<span class="hljs-title function_">$1</span>')
    : html;
}
