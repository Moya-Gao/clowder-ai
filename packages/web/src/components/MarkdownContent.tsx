'use client';

import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { Children, useCallback, useRef, useState, type ReactNode } from 'react';
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

/* ── Code block with copy button ───────────────────────────── */
function CodeBlock({ children }: { children: ReactNode }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const preRef = useRef<HTMLPreElement>(null);

  const handleCopy = useCallback(() => {
    const text = preRef.current?.textContent ?? '';
    void navigator.clipboard.writeText(text);
    setCopied(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopied(false), 1500);
  }, []);

  return (
    <pre
      ref={preRef}
      className="relative group bg-gray-900 text-gray-100 rounded-lg p-3 my-2 overflow-x-auto text-xs leading-5 font-mono [&>code]:bg-transparent [&>code]:p-0 [&>code]:text-inherit [&>code]:text-xs"
    >
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 px-1.5 py-0.5 rounded text-[10px] bg-gray-700 text-gray-300 opacity-0 group-hover:opacity-100 hover:bg-gray-600 transition-opacity"
      >
        {copied ? '已复制' : '复制'}
      </button>
      {children}
    </pre>
  );
}

/* ── File path → VSCode link ──────────────────────────────── */
const FILE_PATH_RE = /(?:^|\s)`?((?:\/[\w.@-]+)+(?:\.[\w]+)(?::(\d+))?)(?:`?)/g;
const REL_PATH_RE = /(?:^|\s)`?((?:packages|src|docs|tests?)\/[\w./@-]+(?:\.[\w]+)(?::(\d+))?)(?:`?)/g;

function linkifyFilePaths(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let lastIdx = 0;
  const combined = new RegExp(`${FILE_PATH_RE.source}|${REL_PATH_RE.source}`, 'g');
  let m: RegExpExecArray | null;

  combined.lastIndex = 0;
  while ((m = combined.exec(text)) !== null) {
    const fullMatch = m[0];
    const leading = fullMatch.match(/^\s/)?.[0] ?? '';
    const path = m[1] ?? m[3];
    const line = m[2] ?? m[4];
    if (!path) continue;

    const start = m.index + leading.length;
    if (start > lastIdx) parts.push(text.slice(lastIdx, start));

    // Strip backticks from display
    const display = path;
    const isAbsolute = path.startsWith('/');
    const vscodePath = isAbsolute ? path.split(':')[0] : path.split(':')[0];
    const href = `vscode://file${isAbsolute ? '' : '/'}${vscodePath}${line ? `:${line}` : ''}`;

    parts.push(
      <a
        key={`fp${m.index}`}
        href={href}
        className="text-blue-400 hover:text-blue-300 hover:underline font-mono text-[0.85em]"
        title={`在 VSCode 中打开 ${display}`}
      >
        {display}
      </a>,
    );
    lastIdx = m.index + fullMatch.length;
  }
  if (lastIdx < text.length) parts.push(text.slice(lastIdx));
  return parts.length > 0 ? parts : [text];
}

/** Process string children → @mentions + file path links */
function withMentionsAndLinks(children: ReactNode): ReactNode {
  return Children.map(children, (child) => {
    if (typeof child !== 'string') return child;
    // First pass: file paths → ReactNode[]
    const linked = linkifyFilePaths(child);
    // Second pass: highlight @mentions in remaining text nodes
    return <>{linked.map((node, i) => typeof node === 'string' ? <span key={i}>{highlightMentions(node)}</span> : node)}</>;
  });
}

/* ── Markdown component overrides ──────────────────────────── */
const mdComponents: Components = {
  p:  ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{withMentionsAndLinks(children)}</p>,
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

  /* Code blocks with copy button */
  pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
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
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={mdComponents}>
        {md}
      </ReactMarkdown>
    </div>
  );
}
