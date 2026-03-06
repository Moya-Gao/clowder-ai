import { css } from '@codemirror/lang-css';
import { html } from '@codemirror/lang-html';
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import { EditorState } from '@codemirror/state';
import { basicSetup, EditorView } from 'codemirror';
import { useEffect, useRef } from 'react';

const cafeTheme = EditorView.theme(
  {
    '&': { backgroundColor: '#1E1E24', color: '#FDF8F3' },
    '.cm-gutters': { backgroundColor: '#1E1E24', color: '#815B5B', borderRight: '1px solid #2a2a32' },
    '.cm-activeLineGutter': { backgroundColor: '#2a2a32' },
    '.cm-activeLine': { backgroundColor: 'rgba(155, 126, 189, 0.08)' },
    '.cm-cursor': { borderLeftColor: '#E29578' },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
      backgroundColor: 'rgba(155, 126, 189, 0.25) !important',
    },
    '.cm-line': { padding: '0 4px' },
  },
  { dark: true },
);

function getLanguageExtension(mime: string, path: string) {
  if (mime === 'text/typescript' || mime === 'text/tsx' || path.endsWith('.ts') || path.endsWith('.tsx'))
    return javascript({ typescript: true, jsx: path.endsWith('x') });
  if (mime === 'text/javascript' || mime === 'text/jsx' || path.endsWith('.js') || path.endsWith('.jsx'))
    return javascript({ jsx: path.endsWith('x') });
  if (mime === 'application/json' || path.endsWith('.json')) return json();
  if (mime === 'text/markdown' || path.endsWith('.md')) return markdown();
  if (mime === 'text/css' || path.endsWith('.css')) return css();
  if (mime === 'text/html' || path.endsWith('.html')) return html();
  return javascript({ typescript: true });
}

export function CodeViewer({
  content,
  mime,
  path,
  scrollToLine,
}: {
  content: string;
  mime: string;
  path: string;
  scrollToLine: number | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    viewRef.current?.destroy();

    const lang = getLanguageExtension(mime, path);
    const state = EditorState.create({
      doc: content,
      extensions: [basicSetup, lang, cafeTheme, EditorView.editable.of(false), EditorState.readOnly.of(true)],
    });

    const view = new EditorView({ state, parent: containerRef.current });
    viewRef.current = view;

    if (scrollToLine && scrollToLine > 0) {
      const line = Math.min(scrollToLine, view.state.doc.lines);
      const lineInfo = view.state.doc.line(line);
      view.dispatch({ effects: EditorView.scrollIntoView(lineInfo.from, { y: 'center' }) });
    }

    return () => {
      view.destroy();
    };
  }, [content, mime, path, scrollToLine]);

  return <div ref={containerRef} className="flex-1 overflow-auto text-sm" />;
}
