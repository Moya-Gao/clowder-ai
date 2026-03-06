'use client';

import { useCallback, useEffect, useState } from 'react';

// Dynamic import to avoid polluting test environment (esbuild-wasm checks TextEncoder at import time)
type EsbuildModule = typeof import('esbuild-wasm');
let esbuildReady: Promise<EsbuildModule> | null = null;

function ensureEsbuild(): Promise<EsbuildModule> {
  if (!esbuildReady) {
    esbuildReady = import('esbuild-wasm').then(async (mod) => {
      await mod.initialize({
        wasmURL: 'https://unpkg.com/esbuild-wasm@0.27.3/esbuild.wasm',
      }).catch((err) => {
        if (!String(err).includes('already')) throw err;
      });
      return mod;
    }).catch((err) => {
      esbuildReady = null;
      throw err;
    });
  }
  return esbuildReady;
}

interface JsxPreviewProps {
  code: string;
  filePath: string;
}

export function JsxPreview({ code, filePath }: JsxPreviewProps) {
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [building, setBuilding] = useState(false);

  const build = useCallback(async () => {
    setBuilding(true);
    setError(null);
    try {
      const mod = await ensureEsbuild();

      const isTs = filePath.endsWith('.tsx') || filePath.endsWith('.ts');
      const result = await mod.build({
        stdin: {
          contents: code,
          loader: isTs ? 'tsx' : 'jsx',
          resolveDir: '.',
        },
        bundle: false,
        write: false,
        format: 'esm',
        jsx: 'automatic',
        target: 'es2020',
      });

      let js = result.outputFiles?.[0]?.text ?? '';

      // Rewrite bare React imports to esm.sh URLs so Blob URL modules can resolve them.
      // Regexes anchored to line-start (multiline) to avoid mutating string literals —
      // esbuild ESM output always places import/export statements at column 0.
      const importMap: Record<string, string> = {
        'react': 'https://esm.sh/react@18?dev',
        'react/jsx-runtime': 'https://esm.sh/react@18/jsx-runtime?dev',
        'react/jsx-dev-runtime': 'https://esm.sh/react@18/jsx-dev-runtime?dev',
        'react-dom': 'https://esm.sh/react-dom@18?dev',
        'react-dom/client': 'https://esm.sh/react-dom@18/client?dev',
      };
      for (const [bare, url] of Object.entries(importMap)) {
        const escaped = bare.replace('/', '\\/');
        // Named/default imports: lines starting with import/export keyword containing `from "bare"`
        js = js.replace(new RegExp(`^((?:import|export)\\b.+\\bfrom\\s+)["']${escaped}["']`, 'gm'), `$1"${url}"`);
        // Side-effect imports: `import "react"` at line start (no from keyword)
        js = js.replace(new RegExp(`^(import\\s+)["']${escaped}["']`, 'gm'), `$1"${url}"`);
      }

      // Build an HTML document that renders the default export.
      // The bundled code goes in its own <script> so top-level import statements
      // remain at module scope (not inside a try block — that's a syntax error).
      // The render script imports React.createElement for proper component rendering
      // (direct Component() calls bypass hooks/lifecycle).
      const previewHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 16px; }
  </style>
</head>
<body>
  <div id="root"></div>
  <!-- Render script: loads bundled code as Blob URL module, uses createElement -->
  <script type="module">
    import { createElement } from 'https://esm.sh/react@18?dev';
    import { createRoot } from 'https://esm.sh/react-dom@18/client?dev';
    try {
      const code = ${JSON.stringify(js)};
      const blob = new Blob([code], { type: 'text/javascript' });
      const url = URL.createObjectURL(blob);
      const mod = await import(url);
      URL.revokeObjectURL(url);

      const Component = mod.default ?? mod.App ?? null;
      if (Component) {
        const root = createRoot(document.getElementById('root'));
        root.render(createElement(Component));
      } else {
        document.getElementById('root').innerHTML =
          '<p style="color:#888;font-size:13px">No default export or App component found to render.</p>';
      }
    } catch (err) {
      document.getElementById('root').innerHTML =
        '<pre style="color:#e53;font-size:12px;white-space:pre-wrap">' +
        err.message + '\\n' + (err.stack || '') + '</pre>';
    }
  </script>
</body>
</html>`;

      setHtml(previewHtml);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBuilding(false);
    }
  }, [code, filePath]);

  useEffect(() => {
    build();
  }, [build]);

  if (building) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#1E1E24] text-gray-400 text-xs">
        Bundling JSX/TSX...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 overflow-auto bg-[#1E1E24] p-4">
        <div className="text-red-400 text-xs font-mono whitespace-pre-wrap">
          <div className="font-semibold mb-2">Bundle Error</div>
          {error}
        </div>
      </div>
    );
  }

  if (!html) return null;

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="px-2 py-1 bg-blue-900/20 text-blue-400 text-[10px] border-b border-blue-900/30 flex-shrink-0">
        JSX Preview (esbuild-wasm) — imports beyond React may not resolve
      </div>
      <div className="flex-1 min-h-0 bg-white">
        <iframe
          srcDoc={html}
          sandbox="allow-scripts"
          title="JSX Preview"
          className="w-full h-full border-0"
        />
      </div>
    </div>
  );
}
