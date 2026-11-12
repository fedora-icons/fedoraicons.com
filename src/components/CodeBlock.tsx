import { useEffect, useState, type ReactNode } from 'react';

const LABELS: Record<string, string> = { tsx: 'TSX', ts: 'TypeScript', sh: 'Terminal', html: 'HTML', svg: 'SVG', css: 'CSS' };

/**
 * A dark code block with syntax colors. Plain text renders first; the
 * highlighter is loaded on demand and swaps in colored markup.
 */
export function CodeBlock({ code, lang, action, className = '' }: {
  code: string;
  lang: string;
  /** Optional control in the title bar, e.g. a Copy button. */
  action?: ReactNode;
  className?: string;
}) {
  const [html, setHtml] = useState<{ code: string; lang: string; value: string | null } | null>(null);
  useEffect(() => {
    let live = true;
    import('../lib/highlight').then(({ highlight }) => {
      if (live) setHtml({ code, lang, value: highlight(code, lang) });
    }, () => {});
    return () => { live = false; };
  }, [code, lang]);
  const colored = html && html.code === code && html.lang === lang ? html.value : null;
  const terminal = lang === 'sh';

  return (
    <div className={`code-block overflow-hidden rounded-xl ${className}`} data-lang={lang}>
      <div className="code-bar flex h-9 items-center gap-2 px-3 text-xs font-medium">
        {terminal && (
          <span aria-hidden="true" className="flex gap-1.5">
            <span className="size-2.5 rounded-full bg-[#ff5f57]" />
            <span className="size-2.5 rounded-full bg-[#febc2e]" />
            <span className="size-2.5 rounded-full bg-[#28c840]" />
          </span>
        )}
        <span>{LABELS[lang] ?? lang}</span>
        {action && <span className="ml-auto">{action}</span>}
      </div>
      <pre className="overflow-x-auto px-4 pb-4 pt-1 font-mono text-[13px] leading-relaxed">
        {colored !== null
          ? <code dangerouslySetInnerHTML={{ __html: colored }} />
          : <code>{code}</code>}
      </pre>
    </div>
  );
}
