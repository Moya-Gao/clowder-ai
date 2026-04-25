'use client';

/**
 * F174 D2b-1 — In-context callback auth failure renderer.
 *
 * "明厨亮灶" surface: when the server posts a card block tagged
 * `meta.kind = 'callback_auth_failure'`, render with amber styling +
 * structured reason badge / metadata / actions instead of the default
 * warning card. Per visual review by 烁烁 (gemini, 2026-04-25):
 *  - amber `#FED7AA` border, light-yellow `#FFFAEB` bg
 *  - reason chip (amber)
 *  - actions: 详情 (跳 HubObservabilityTab) / 重试 (todo) / 隐藏类似消息 (24h opt-out)
 */

import { useCallback, useState } from 'react';
import type { RichCardBlock } from '@/stores/chat-types';
import { apiFetch } from '@/utils/api-client';

const REASON_LABEL: Record<string, string> = {
  expired: 'expired · token 已过期',
  invalid_token: 'invalid_token · token 不匹配',
  unknown_invocation: 'unknown_invocation · 记录已清理',
  stale_invocation: 'stale_invocation · 已被新调用顶替',
  missing_creds: 'missing_creds · 凭证缺失',
};

interface CallbackAuthMeta {
  kind: 'callback_auth_failure';
  reason: string;
  tool: string;
  catId: string;
  // Cloud Codex P1 #1397: scope hide-similar per thread + user so a click here
  // doesn't suppress unrelated conversations.
  threadId: string;
  userId: string;
  failedAt: number;
  fallbackOk: boolean;
}

function formatRelative(failedAt: number): string {
  const deltaMs = Date.now() - failedAt;
  if (deltaMs < 60_000) return `${Math.max(1, Math.floor(deltaMs / 1000))}s 前`;
  if (deltaMs < 60 * 60_000) return `${Math.floor(deltaMs / 60_000)}min 前`;
  if (deltaMs < 24 * 60 * 60_000) return `${Math.floor(deltaMs / (60 * 60_000))}h 前`;
  return new Date(failedAt).toLocaleString();
}

export function CallbackAuthFailureBlock({ block }: { block: RichCardBlock }) {
  const meta = block.meta as CallbackAuthMeta | undefined;
  const [hidden, setHidden] = useState(false);
  const [hideError, setHideError] = useState<string | null>(null);
  const [hidePending, setHidePending] = useState(false);

  const handleHide = useCallback(async () => {
    if (!meta) return;
    setHidePending(true);
    setHideError(null);
    try {
      const res = await apiFetch('/api/debug/callback-auth/hide-similar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: meta.reason,
          tool: meta.tool,
          catId: meta.catId,
          threadId: meta.threadId,
          userId: meta.userId,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      setHidden(true);
    } catch (err) {
      setHideError(err instanceof Error ? err.message : '隐藏失败');
    } finally {
      setHidePending(false);
    }
  }, [meta]);

  if (!meta) {
    // Shouldn't happen — RichBlocks routes here only when meta.kind matches.
    // Defensive fallback so we never render an empty block.
    return (
      <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
        Callback auth failure (metadata missing)
      </div>
    );
  }

  return (
    <div
      className="rounded-lg border-2 px-4 py-3 text-xs"
      style={{ borderColor: '#FED7AA', backgroundColor: '#FFFAEB', color: '#5A4A40' }}
    >
      <div className="flex items-center gap-2">
        <span aria-hidden="true">🔌</span>
        <span className="font-bold tracking-wide" style={{ color: '#9A3412', letterSpacing: '0.08em' }}>
          CALLBACK AUTH FAILURE
        </span>
        <span className="flex-1" />
        {meta.fallbackOk && (
          <span
            className="rounded px-2 py-0.5 text-[10px] font-bold"
            style={{ backgroundColor: '#FED7AA', color: '#9A3412' }}
          >
            FALLBACK OK
          </span>
        )}
      </div>

      <div className="mt-2">
        <span className="rounded px-2 py-0.5 font-semibold" style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}>
          {REASON_LABEL[meta.reason] ?? meta.reason}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[11px]" style={{ color: '#5A4A40' }}>
        <span>
          <span style={{ color: '#A89386' }}>TOOL · </span>
          <span className="font-mono">{meta.tool}</span>
        </span>
        <span>
          <span style={{ color: '#A89386' }}>CAT · </span>
          <span className="font-mono">{meta.catId}</span>
        </span>
        <span>
          <span style={{ color: '#A89386' }}>WHEN · </span>
          <span className="font-mono">{formatRelative(meta.failedAt)}</span>
        </span>
      </div>

      {block.bodyMarkdown && (
        <div className="mt-2 text-[11px]" style={{ color: '#5A4A40' }}>
          {block.bodyMarkdown}
        </div>
      )}

      <div className="mt-3 flex items-center gap-2">
        {/*
         * 砚砚 P2 #1397: 详情/重试 are P0-on-failure actions — must not look
         * tappable when they're not wired. Render disabled with explicit
         * "(pending Dxx)" hint so the user understands the state without
         * trying and getting nothing back.
         */}
        <button
          type="button"
          disabled
          title="待 D2b-3 (HubObservabilityTab 子 tab) 落地后启用"
          className="rounded px-3 py-1 text-[11px] font-semibold border cursor-not-allowed opacity-50"
          style={{ backgroundColor: '#FFFFFF', color: '#9A3412', borderColor: '#FED7AA' }}
        >
          详情 (待 D2b-3)
        </button>
        <button
          type="button"
          disabled
          title="重试需要 callback-tools 编排，独立 feature 跟进"
          className="rounded px-3 py-1 text-[11px] font-semibold cursor-not-allowed opacity-50"
          style={{ backgroundColor: '#9A3412', color: '#FFFFFF' }}
        >
          重试 (跟进中)
        </button>
        <button
          type="button"
          disabled={hidden || hidePending}
          className="text-[11px] disabled:cursor-not-allowed"
          style={{ color: hidden ? '#16A34A' : '#A89386', textDecoration: hidden ? 'none' : 'underline' }}
          onClick={handleHide}
        >
          {hidden ? '已隐藏 24h' : hidePending ? '隐藏中…' : '隐藏类似消息'}
        </button>
      </div>

      {hideError && (
        <div className="mt-2 text-[11px]" style={{ color: '#DC2626' }}>
          {hideError}
        </div>
      )}
    </div>
  );
}
