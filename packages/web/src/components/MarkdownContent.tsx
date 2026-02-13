'use client';

import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Children, type ReactNode } from 'react';
import { CAT_CONFIGS, escapeRegExp } from '@cat-cafe/shared';

/* ── @mention highlighting ─────────────────────────────────── */
const MENTION_TO_CAT: Record<string, 'opus' | 'codex' | 'gemini'> = Object.fromEntries(
  Object.entries(CAT_CONFIGS).flatMap(([catId, config]) =>
    config.mentionPatterns.map((pattern) => [pattern.replace(/^@/, '').toLowerCase(), catId]),
  ),
) as Record<string, 'opus' | 'codex' | 'gemini'>;

const mentionAliases = Object.keys(MENTION_TO_CAT).sort((a, b) => b.length - a.length);
const mentionAliasPattern = mentionAliases.map(escapeRegExp).join('|');
const MENTION_RE = new RegExp(`@(${mentionAliasPattern})(?=$|\\s|[，。！？、,.:：;；])`, 'gi');

const MENTION_COLOR: Record<string, string> = {
  opus: 'text-opus-primary',
  codex: 'text-codex-primary',
  gemini: 'text-gemini-primary',
};

function highlightMentions(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let lastIdx = 0;
  let m: RegExpExecArray | null;

  MENTION_RE.lastIndex = 0;
  while ((m = MENTION_RE.exec(text)) !== null) {
    if (m.index > lastIdx) parts.push(text.slice(lastIdx, m.index));
    const cat = MENTION_TO_CAT[m[1].toLowerCase()] ?? 'opus';
    parts.push(
      <span key={`m${m.index}`} className={`font-semibold ${MENTION_COLOR[cat]}`}>{m[0]}</span>,
    );
    lastIdx = MENTION_RE.lastIndex;
  }
  if (lastIdx < text.length) parts.push(text.slice(lastIdx));
  return parts;
}

/** Process immediate string children → highlight @mentions */
function withMentions(children: ReactNode): ReactNode {
  return Children.map(children, (child) =>
    typeof child === 'string' ? <>{highlightMentions(child)}</> : child,
  );
}

/* ── Markdown component overrides ──────────────────────────── */
const mdComponents: Components = {
  p:  ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{withMentions(children)}</p>,
  strong: ({ children }) => <strong className="font-semibold">{withMentions(children)}</strong>,
  em: ({ children }) => <em>{withMentions(children)}</em>,
  del: ({ children }) => <del className="opacity-60">{withMentions(children)}</del>,

  h1: ({ children }) => <h1 className="text-lg font-bold mb-2 mt-3 first:mt-0">{withMentions(children)}</h1>,
  h2: ({ children }) => <h2 className="text-base font-bold mb-2 mt-3 first:mt-0">{withMentions(children)}</h2>,
  h3: ({ children }) => <h3 className="text-sm font-bold mb-1 mt-2 first:mt-0">{withMentions(children)}</h3>,

  ul: ({ children }) => <ul className="list-disc pl-5 mb-2 space-y-0.5">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-5 mb-2 space-y-0.5">{children}</ol>,
  li: ({ children }) => <li>{withMentions(children)}</li>,

  blockquote: ({ children }) => (
    <blockquote className="border-l-[3px] border-gray-300 pl-3 my-2 italic opacity-80">{children}</blockquote>
  ),
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline break-all">
      {withMentions(children)}
    </a>
  ),
  hr: () => <hr className="my-3 border-gray-200" />,

  /* Code blocks: pre overrides child code styles via arbitrary variant */
  pre: ({ children }) => (
    <pre className="bg-gray-900 text-gray-100 rounded-lg p-3 my-2 overflow-x-auto text-xs leading-5 font-mono [&>code]:bg-transparent [&>code]:p-0 [&>code]:text-inherit [&>code]:text-xs">
      {children}
    </pre>
  ),
  code: ({ className, children }) => (
    <code className={`${className ?? ''} bg-gray-200/50 rounded px-1 py-0.5 text-[0.85em] font-mono`}>
      {children}
    </code>
  ),

  /* Tables (GFM) */
  table: ({ children }) => (
    <div className="overflow-x-auto my-2">
      <table className="min-w-full text-sm border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-gray-50">{children}</thead>,
  th: ({ children }) => (
    <th className="border border-gray-300 px-2 py-1 text-left font-semibold text-xs">{withMentions(children)}</th>
  ),
  td: ({ children }) => (
    <td className="border border-gray-300 px-2 py-1">{withMentions(children)}</td>
  ),
};

/* ── Exported component ────────────────────────────────────── */
interface Props {
  content: string;
  className?: string;
}

export function MarkdownContent({ content, className }: Props) {
  const cmdMatch = /^(\/\w+)/.exec(content);
  const md = cmdMatch ? content.slice(cmdMatch[1].length) : content;

  return (
    <div className={`markdown-content text-sm ${className ?? ''}`}>
      {cmdMatch && <span className="font-semibold text-indigo-500">{cmdMatch[1]}</span>}
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
        {md}
      </ReactMarkdown>
    </div>
  );
}
