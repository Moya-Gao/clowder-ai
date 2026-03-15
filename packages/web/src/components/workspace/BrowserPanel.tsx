'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/utils/api-client';

interface BrowserPanelProps {
  /** Initial port to preview (e.g. from port discovery toast) */
  initialPort?: number;
  /** Initial path for deep-linking (e.g. "/dashboard" from auto-open) */
  initialPath?: string;
}

interface PreviewStatus {
  available: boolean;
  gatewayPort: number;
}

type HmrStatus = 'idle' | 'connected' | 'disconnected';

/**
 * F120: Embedded Browser Panel — previews localhost dev servers via reverse proxy.
 * The iframe loads through the Preview Gateway (独立 origin) to strip X-Frame-Options
 * and isolate cookies/storage from Hub.
 */
export function BrowserPanel({ initialPort, initialPath }: BrowserPanelProps) {
  const [gatewayPort, setGatewayPort] = useState<number>(0);
  const [targetPort, setTargetPort] = useState(initialPort ?? 0);
  const [urlInput, setUrlInput] = useState(
    initialPort ? `localhost:${initialPort}${initialPath && initialPath !== '/' ? initialPath : ''}` : '',
  );
  const [targetPath, setTargetPath] = useState(initialPath ?? '/');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hmrStatus, setHmrStatus] = useState<HmrStatus>('idle');
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Fetch gateway port on mount
  useEffect(() => {
    apiFetch('/api/preview/status')
      .then((res) => res.json() as Promise<PreviewStatus>)
      .then((data) => {
        if (data.available) setGatewayPort(data.gatewayPort);
      })
      .catch(() => setError('Preview gateway not available'));
  }, []);

  // If initialPort/initialPath changes (e.g. from port discovery or auto-open), auto-navigate
  useEffect(() => {
    if (initialPort && (initialPort !== targetPort || (initialPath ?? '/') !== targetPath)) {
      setTargetPort(initialPort);
      const pathSuffix = initialPath && initialPath !== '/' ? initialPath : '';
      setUrlInput(`localhost:${initialPort}${pathSuffix}`);
      setTargetPath(initialPath ?? '/');
    }
  }, [initialPort, initialPath]); // eslint-disable-line react-hooks/exhaustive-deps

  // Audit: close on unmount only (use ref to avoid stale closure)
  const targetPortRef = useRef(targetPort);
  targetPortRef.current = targetPort;
  useEffect(() => {
    return () => {
      if (targetPortRef.current) {
        apiFetch('/api/preview/close', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ port: targetPortRef.current }),
        }).catch(() => {});
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Build gateway URL using URL API to handle paths with query params correctly
  const gatewayUrl = (() => {
    if (!targetPort || !gatewayPort) return '';
    const url = new URL(`http://localhost:${gatewayPort}`);
    // Parse targetPath which may contain query string (e.g. /dashboard?foo=1)
    const qIdx = targetPath.indexOf('?');
    if (qIdx >= 0) {
      url.pathname = targetPath.slice(0, qIdx);
      const existingParams = new URLSearchParams(targetPath.slice(qIdx + 1));
      for (const [k, v] of existingParams) url.searchParams.set(k, v);
    } else {
      url.pathname = targetPath;
    }
    url.searchParams.set('__preview_port', String(targetPort));
    return url.toString();
  })();

  const handleNavigate = useCallback(() => {
    setError(null);
    // Parse "localhost:PORT" or "localhost:PORT/path" or "http://localhost:PORT/..."
    const match = urlInput.match(/^(?:https?:\/\/)?(?:localhost|127\.0\.0\.1|::1):(\d+)(\/.*)?$/);
    if (!match) {
      setError('Enter a valid localhost URL (e.g. localhost:5173)');
      return;
    }
    const port = Number.parseInt(match[1], 10);
    const path = match[2] ?? '/';
    // Audit: validate + open via backend
    apiFetch('/api/preview/open', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ port }),
    })
      .then((res) => res.json() as Promise<{ allowed: boolean; reason?: string }>)
      .then((data) => {
        if (!data.allowed) {
          setError(data.reason ?? 'Port not allowed');
          return;
        }
        // Audit navigate if path changed
        if (path !== '/') {
          apiFetch('/api/preview/navigate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ port, url: path }),
          }).catch(() => {});
        }
        setTargetPort(port);
        setTargetPath(path);
        setIsLoading(true);
      })
      .catch(() => {
        // Fallback: navigate anyway (gateway will validate)
        setTargetPort(port);
        setTargetPath(path);
        setIsLoading(true);
      });
  }, [urlInput, targetPort]);

  const handleBack = useCallback(() => {
    try {
      iframeRef.current?.contentWindow?.history.back();
    } catch {
      // cross-origin fallback — no-op
    }
  }, []);

  const handleForward = useCallback(() => {
    try {
      iframeRef.current?.contentWindow?.history.forward();
    } catch {
      // cross-origin fallback — no-op
    }
  }, []);

  const handleRefresh = useCallback(() => {
    if (iframeRef.current && gatewayUrl) {
      setIsLoading(true);
      const src = iframeRef.current.src;
      iframeRef.current.src = '';
      requestAnimationFrame(() => {
        if (iframeRef.current) iframeRef.current.src = src;
      });
    }
  }, [gatewayUrl]);

  // Listen for HMR WebSocket status from iframe
  useEffect(() => {
    if (!gatewayPort || !targetPort) return;
    setHmrStatus('idle');

    const wsUrl = `ws://localhost:${gatewayPort}/?__preview_port=${targetPort}`;
    let ws: WebSocket | null = null;
    let closed = false;

    const connect = () => {
      if (closed) return;
      try {
        ws = new WebSocket(wsUrl);
        ws.onopen = () => setHmrStatus('connected');
        ws.onclose = () => {
          setHmrStatus('disconnected');
          // Retry after 3s
          if (!closed) setTimeout(connect, 3000);
        };
        ws.onerror = () => ws?.close();
      } catch {
        setHmrStatus('disconnected');
      }
    };
    connect();

    return () => {
      closed = true;
      ws?.close();
    };
  }, [gatewayPort, targetPort]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleNavigate();
    },
    [handleNavigate],
  );

  return (
    <div className="flex flex-col h-full bg-[#FDF8F3]">
      {/* Toolbar — matches design Scene 3 */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-[#FFDDD2] bg-white/60">
        {/* Back / Forward */}
        <button
          type="button"
          onClick={handleBack}
          className="p-1 rounded hover:bg-[#FFF5F2] text-[#5a4a42]/60 text-sm"
          title="Back"
        >
          ‹
        </button>
        <button
          type="button"
          onClick={handleForward}
          className="p-1 rounded hover:bg-[#FFF5F2] text-[#5a4a42]/60 text-sm"
          title="Forward"
        >
          ›
        </button>

        {/* Refresh */}
        <button
          type="button"
          onClick={handleRefresh}
          className="p-1 rounded hover:bg-[#FFF5F2] text-[#5a4a42]/60 text-sm"
          title="Refresh"
        >
          ↻
        </button>

        {/* URL bar */}
        <div className="flex-1 flex items-center">
          <input
            type="text"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="localhost:3000"
            className="w-full px-2 py-1 text-xs rounded border border-[#FFDDD2] bg-white focus:outline-none focus:border-[#E29578] placeholder:text-[#5a4a42]/30"
          />
        </div>

        {/* Go */}
        <button
          type="button"
          onClick={handleNavigate}
          className="px-2.5 py-1 text-xs rounded bg-[#E29578] text-white hover:bg-[#d4856a] transition-colors"
        >
          Go
        </button>
      </div>

      {/* HMR status indicator — design Scene 3 */}
      {hmrStatus !== 'idle' && (
        <div
          className={`flex items-center gap-1.5 px-3 py-1 text-[11px] border-b ${
            hmrStatus === 'connected'
              ? 'bg-[#FFF5F2] border-[#FFDDD2] text-[#5a4a42]/70'
              : 'bg-[#FFF0ED] border-[#FFD4CC] text-[#5a4a42]/70'
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full inline-block ${
              hmrStatus === 'connected' ? 'bg-green-500' : 'bg-red-400'
            }`}
          />
          {hmrStatus === 'connected' ? (
            <span>HMR connected · localhost:{targetPort}</span>
          ) : (
            <span>
              HMR disconnected — dev server stopped.{' '}
              <button type="button" className="underline hover:text-[#E29578]" onClick={handleRefresh}>
                Retry
              </button>
            </span>
          )}
        </div>
      )}

      {/* Error banner */}
      {error && <div className="px-3 py-1.5 text-xs text-red-600 bg-red-50/80 border-b border-red-100">{error}</div>}

      {/* iframe or empty state */}
      {gatewayUrl ? (
        <div className="relative flex-1">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#FDF8F3]/80 z-10">
              <div className="text-xs text-[#5a4a42]/50">Loading preview...</div>
            </div>
          )}
          <iframe
            ref={iframeRef}
            src={gatewayUrl}
            sandbox="allow-scripts allow-forms allow-popups allow-downloads allow-same-origin"
            referrerPolicy="no-referrer"
            className="w-full h-full border-0"
            title="Preview"
            onLoad={() => setIsLoading(false)}
            onError={() => {
              setIsLoading(false);
              setError('Failed to load preview');
            }}
          />
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-[#5a4a42]/40 text-sm">
          <div className="text-center">
            <div className="text-3xl mb-3 opacity-30">🌐</div>
            <p className="mb-1">Enter a localhost URL to preview</p>
            <p className="text-xs opacity-60">e.g. localhost:5173</p>
          </div>
        </div>
      )}

      {/* Status bar */}
      <div className="flex items-center px-2 py-0.5 border-t border-[#FFDDD2] text-[10px] text-[#5a4a42]/40 bg-white/40">
        {targetPort && gatewayPort ? (
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
            localhost:{targetPort} via gateway:{gatewayPort}
          </span>
        ) : (
          <span>No preview</span>
        )}
      </div>
    </div>
  );
}
