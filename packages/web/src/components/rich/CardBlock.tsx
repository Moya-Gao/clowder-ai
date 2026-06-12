'use client';

import { useCallback, useState } from 'react';
import { MarkdownContent } from '@/components/MarkdownContent';
import type { RichCardBlock } from '@/stores/chat-types';
import { useChatStore } from '@/stores/chatStore';
import { useConciergeStore } from '@/stores/conciergeStore';
import { apiFetch } from '@/utils/api-client';
import { scrollToMessage } from '@/utils/scrollToMessage';
import { kickTeleportResolve, planTeleport } from '@/utils/teleport';

const TONE_STYLES: Record<string, string> = {
  info: 'border-l-conn-blue-ring bg-conn-blue-bg ',
  success: 'border-l-conn-green-ring bg-conn-green-bg ',
  warning: 'border-l-yellow-400 bg-[var(--semantic-warning-surface)] ',
  danger: 'border-l-conn-red-ring bg-conn-red-bg ',
};

export function CardBlock({ block, messageId }: { block: RichCardBlock; messageId?: string }) {
  const toneStyle = TONE_STYLES[block.tone ?? 'info'] ?? TONE_STYLES.info;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedAction, setCopiedAction] = useState<string | null>(null);

  const copyToClipboard = useCallback(async (payload?: Record<string, unknown>) => {
    const text = typeof payload?.text === 'string' ? payload.text : '';
    if (!text) {
      setError('没有可复制的内容');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await navigator.clipboard.writeText(text);
      setCopiedAction('copy-to-clipboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : '复制失败');
    } finally {
      setLoading(false);
    }
  }, []);

  const resynthesizeTts = useCallback(
    async (payload?: Record<string, unknown>) => {
      if (!messageId) {
        return;
      }
      if (!payload) {
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const res = await apiFetch('/api/tts/resynthesize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: payload.text, catId: payload.catId }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
        }

        const data = (await res.json()) as { audioUrl: string; durationSec?: number };

        // Replace this card with an audio block
        useChatStore.getState().updateRichBlock(messageId, block.id, {
          kind: 'audio',
          title: undefined,
          bodyMarkdown: undefined,
          tone: undefined,
          fields: undefined,
          actions: undefined,
          url: data.audioUrl,
          text: payload.text as string,
          durationSec: data.durationSec,
          mimeType: 'audio/wav',
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : '重新合成失败');
      } finally {
        setLoading(false);
      }
    },
    [messageId, block.id],
  );

  // ---------------------------------------------------------------------------
  // F229 PR-A3b: Concierge card action handlers (§1a/§1b/§2)
  // ---------------------------------------------------------------------------

  const handleConciergeTeleport = useCallback((payload?: Record<string, unknown>) => {
    const threadId = typeof payload?.threadId === 'string' ? payload.threadId : '';
    const messageId = typeof payload?.messageId === 'string' ? payload.messageId : undefined;
    if (!threadId) return;

    // INV-7: collapse surface so user's intent has transferred
    useConciergeStore.getState().onNavigationAction();

    const currentThreadId = useChatStore.getState().currentThreadId;
    if (messageId) {
      const plan = planTeleport({ threadId, messageId, currentThreadId });
      if (plan.scrollNow) {
        // Same thread: bubble already collapsed (onNavigationAction above),
        // scroll underlying chat to target + kick resolver for out-of-window targets.
        // Matches useTeleport.ts same-thread path (cloud review P2 fix).
        scrollToMessage(plan.scrollNow);
        kickTeleportResolve();
      } else if (plan.navigateTo) {
        window.location.href = `/?threadId=${plan.navigateTo}`;
      }
    } else {
      // No messageId — just navigate to thread
      window.location.href = `/?threadId=${threadId}`;
    }
  }, []);

  const handleConciergeGo = useCallback((payload?: Record<string, unknown>) => {
    const targetThreadId = typeof payload?.targetThreadId === 'string' ? payload.targetThreadId : '';
    if (!targetThreadId) return;

    // INV-7: collapse surface
    useConciergeStore.getState().onNavigationAction();
    window.location.href = `/?threadId=${targetThreadId}`;
  }, []);

  const handleConciergeRelay = useCallback(
    async (payload?: Record<string, unknown>) => {
      if (!payload) return;
      // Cloud R4 P1: one-shot guard — prevent duplicate relay dispatch on double-click.
      // After first success, copiedAction is 'concierge_relay'; early-return blocks re-post.
      if (copiedAction === 'concierge_relay') return;
      const targetThreadId = typeof payload.targetThreadId === 'string' ? payload.targetThreadId : '';
      const targetCats = Array.isArray(payload.targetCats) ? (payload.targetCats as string[]) : [];
      const originalText = typeof payload.originalText === 'string' ? payload.originalText : '';
      const sourceMessageId = typeof payload.sourceMessageId === 'string' ? payload.sourceMessageId : '';

      // INV-E1: all required fields present
      if (!targetThreadId || targetCats.length === 0 || !originalText || !sourceMessageId) {
        setError('传话参数不完整');
        return;
      }

      setLoading(true);
      setError(null);
      const store = useConciergeStore.getState();

      // R-review P1 fix: increment pendingRelayCount BEFORE dispatch → ball enters handoff
      store.onRelayDispatching();

      try {
        const conciergeThreadId = store.threadId;
        if (!conciergeThreadId) {
          throw new Error('Concierge thread not initialized');
        }

        const res = await apiFetch('/api/concierge/relay', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targetThreadId, targetCats, originalText, sourceMessageId, conciergeThreadId }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
        }

        // Relay dispatched successfully → exit handoff → idle (NOT found).
        // Spec §0: found badge waits for target cat's actual cross_post reply
        // message arriving in concierge thread, not dispatch ACK.
        store.onRelayDispatched();
        // Mark this card as completed
        setCopiedAction('concierge_relay');
      } catch (err) {
        // Dispatch failed → revert handoff without adding unseen
        useConciergeStore.getState().onRelayFailed();
        setError(err instanceof Error ? err.message : '传话失败');
      } finally {
        setLoading(false);
      }
    },
    [copiedAction],
  );

  const handleConciergePeek = useCallback(
    async (payload?: Record<string, unknown>) => {
      const threadId = typeof payload?.threadId === 'string' ? payload.threadId : '';
      const msgId = typeof payload?.messageId === 'string' ? payload.messageId : '';
      if (!threadId || !msgId) return;

      setLoading(true);
      setError(null);

      try {
        const res = await apiFetch(`/api/concierge/peek?threadId=${threadId}&messageId=${msgId}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = (await res.json()) as {
          window: Array<{ id: string; content: string; catId: string | null; userId: string; isTarget: boolean }>;
        };

        // Update the card's bodyMarkdown to show the peeked content inline
        if (messageId) {
          const peekContent = data.window
            .map((m) => {
              const prefix = m.isTarget ? '**→ ' : '  ';
              const sender = m.catId ? `🐱 ${m.catId}` : `👤 ${m.userId}`;
              const suffix = m.isTarget ? ' ←**' : '';
              return `${prefix}${sender}: ${m.content?.slice(0, 200) ?? ''}${suffix}`;
            })
            .join('\n\n');

          useChatStore.getState().updateRichBlock(messageId, block.id, {
            ...block,
            bodyMarkdown: peekContent,
            actions: block.actions?.filter((a) => a.action !== 'concierge_peek'),
          });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '查看失败');
      } finally {
        setLoading(false);
      }
    },
    [messageId, block],
  );

  const handleAction = useCallback(
    async (action: string, payload?: Record<string, unknown>) => {
      if (action === 'copy-to-clipboard') {
        await copyToClipboard(payload);
        return;
      }
      if (action === 'tts-resynthesize') {
        await resynthesizeTts(payload);
        return;
      }
      // F229 PR-A3b: Concierge card actions (§2 CardBlock:90 registration point)
      if (action === 'concierge_teleport') {
        handleConciergeTeleport(payload);
        return;
      }
      if (action === 'concierge_go') {
        handleConciergeGo(payload);
        return;
      }
      if (action === 'concierge_relay') {
        await handleConciergeRelay(payload);
        return;
      }
      if (action === 'concierge_peek') {
        await handleConciergePeek(payload);
        return;
      }
      // Defense-in-depth (F225 dogfood): a card whose action this build doesn't handle — e.g. a stale
      // browser bundle rendering a newer `handoff:approve` card via this generic renderer instead of
      // the dedicated one — would silently no-op. Warn so the dead button self-diagnoses (→ refresh).
      console.warn(
        `[CardBlock] unhandled card action "${action}" — the app bundle may be stale; hard-refresh (Cmd+Shift+R).`,
      );
    },
    [
      copyToClipboard,
      resynthesizeTts,
      handleConciergeTeleport,
      handleConciergeGo,
      handleConciergeRelay,
      handleConciergePeek,
    ],
  );

  return (
    <div className={`border-l-4 rounded-r-lg p-3 ${toneStyle}`}>
      <div className="font-medium text-sm">{block.title}</div>
      {block.bodyMarkdown && (
        <div className="mt-1 text-xs text-cafe-secondary [&_.markdown-content]:text-xs [&_p]:mb-1 [&_p:last-child]:mb-0">
          <MarkdownContent content={block.bodyMarkdown} className="!text-xs" disableCommandPrefix />
        </div>
      )}
      {block.fields && block.fields.length > 0 && (
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1">
          {block.fields.map((f, i) => (
            <div key={`${f.label}:${f.value}:${i}`} className="text-xs">
              <span className="text-cafe-secondary">{f.label}:</span>{' '}
              <span className="font-mono break-all">{f.value}</span>
            </div>
          ))}
        </div>
      )}
      {block.actions && block.actions.length > 0 && (
        <div className="mt-2 flex gap-2">
          {block.actions.map((a, i) => (
            <button
              key={`${a.action}:${a.label}:${i}`}
              type="button"
              disabled={loading || (a.action === 'concierge_relay' && copiedAction === 'concierge_relay')}
              onClick={() => handleAction(a.action, a.payload)}
              className="text-xs px-2 py-1 rounded bg-[var(--semantic-warning-surface)] hover:bg-[var(--semantic-warning-surface)] text-conn-amber-text border border-conn-amber-ring disabled:opacity-50 transition-colors"
            >
              {loading
                ? a.action === 'tts-resynthesize'
                  ? '合成中...'
                  : '处理中...'
                : copiedAction === a.action
                  ? '已复制'
                  : a.label}
            </button>
          ))}
        </div>
      )}
      {error && <div className="mt-1 text-xs text-conn-red-text">{error}</div>}
    </div>
  );
}
