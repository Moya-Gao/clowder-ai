---
title: F225 Handoff Proposal Card UI/UX Redesign Spec
feature: F225
status: implemented
owner: gemini35
implementation_pr: https://github.com/zts212653/cat-cafe/pull/2256
created: 2026-06-12
---

# F225: Handoff Proposal Card UI/UX Redesign Spec

## 1. 现状痛点分析

在现有的 F225 实现中，提议卡片（`HandoffProposalCard`）使用扁平表单布局：
- **可读性灾难**：猫亲手写的“已完成” (`done`)、“下一步” (`nextSteps`) 等可能包含 Markdown 列表、换行或复杂排版的内容，全部塞进了 `fields.map` 的 `<span className="font-mono break-all">{f.value}</span>` 里面。由于没有 Markdown 解析且全部以单行无换行的 monospace 输出，导致内容密集成乱麻。
- **视觉层级单调**：卡片直接使用单调的 `border-l-4 border-l-blue-400 bg-[var(--semantic-info-surface)]`，缺乏现代 Web app 的精致感，完全无法体现“接力圣火”的优雅感和高保真仪轨。
- **交互手感平淡**：按钮采用简单的纯色背景，缺乏光泽感、微妙阴影和 hover-up 缩放，缺乏令人惊艳的交互手感。

---

## 2. 视觉与交互重构方案 (Premium Spec)

为了让卡片能 WOW 铲屎官并真正具备高保真的阅读体验，我们对 `HandoffProposalCard` 进行以下重构：

### A. 智能字段拆分与 Markdown 级渲染
- **元数据 Pill (Metadata Pills)**：
  将 `封印 session`, `worktree`, `commits` 等精简信息解析为一排带有精致背景的水平药丸标签（Pill Tags），减少占地。
- **结构化卡片段 (Structured Cards)**：
  将 `已完成` (`done`)、`下一步` (`nextSteps`) 和 `gotchas` 作为垂直子区块单独抽离，底色为轻度磨砂透明。最关键的是，使用 `<MarkdownContent />` 对它们的值进行富文本渲染，使列表、粗体、代码片段能够完美解析并换行！

### B. 磨砂玻璃与渐变微光皮肤 (Glassmorphism & Glow Neon)
- 移除生硬的左粗边框，采用超细渐变线包裹：`border border-white/10 dark:border-white/5`。
- 背景改用半透明高模糊效果：`bg-[var(--cafe-surface)]/60 backdrop-blur-md`。
- 为不同状态定制独特的彩色微光晕（tone border/shadow）。

### C. 充满质感的“仪式感”按钮
- **批准按钮 (Approve & Handoff)**：
  `bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white font-medium shadow-[0_2px_8px_rgba(59,130,246,0.25)] hover:shadow-[0_4px_12px_rgba(59,130,246,0.4)] transition-all transform hover:-translate-y-[0.5px] active:translate-y-0`
- **驳回按钮 (Reject)**：
  轻质磨砂红描边，在 hover 时微红亮起。

### D. 圣火传递成功的结算动效
- 当点击“批准”或已批准后，卡片整体过渡到微妙的淡绿/淡蓝微光，并展示带有猫爪 🐾 图标的精致徽章：`🐾 圣火已接力，未来的自己即将在下一阶段收到这份记忆...`。

---

## 3. 重构后的 `HandoffProposalCard.tsx` 完整代码

执行猫（缅因猫 `@codex`）可以直接复制以下高保真重构代码替换 [HandoffProposalCard.tsx](file:///Users/lysander/projects/relay-station/cat-cafe/packages/web/src/components/rich/HandoffProposalCard.tsx) 中的内容：

```tsx
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { MarkdownContent } from '@/components/MarkdownContent';
import type { RichCardBlock } from '@/stores/chat-types';
import { apiFetch } from '@/utils/api-client';

type Status = 'pending' | 'approving' | 'approved' | 'rejected' | 'expired';

const isSettled = (s: Status): boolean => s === 'approved' || s === 'rejected' || s === 'expired';

interface HandoffSnapshot {
  proposalId: string;
  status: Status;
}

export function isHandoffProposalCardBlock(block: RichCardBlock): boolean {
  return block.actions?.some((a) => a.action === 'handoff:approve') ?? false;
}

function extractProposalId(block: RichCardBlock): string | null {
  const action = block.actions?.find((a) => a.action === 'handoff:approve');
  const id = action?.payload?.proposalId;
  return typeof id === 'string' ? id : null;
}

const VERB_OUTCOME = {
  approve: { settled: 'approved' as Status, failMsg: '批准失败' },
  reject: { settled: 'rejected' as Status, failMsg: '驳回失败' },
};

export function HandoffProposalCard({ block }: { block: RichCardBlock; messageId?: string }) {
  const proposalId = useMemo(() => extractProposalId(block), [block]);
  const [status, setStatus] = useState<Status>('pending');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync state from server on mount
  useEffect(() => {
    if (!proposalId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch(`/api/session-handoff/${proposalId}`);
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { proposal?: { status?: Status } };
        const fetched = data.proposal?.status;
        if (fetched && !cancelled) {
          setStatus((prev) => (isSettled(prev) && !isSettled(fetched) ? prev : fetched));
        }
      } catch {
        // Keep initial status if fetch fails
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [proposalId]);

  // Real-time socket event updates
  useEffect(() => {
    if (!proposalId || typeof window === 'undefined') return;
    const handler = (ev: Event) => {
      const detail = (ev as CustomEvent<HandoffSnapshot>).detail;
      if (!detail || detail.proposalId !== proposalId) return;
      setStatus(detail.status);
    };
    window.addEventListener('cat-cafe:proposal-updated', handler);
    return () => window.removeEventListener('cat-cafe:proposal-updated', handler);
  }, [proposalId]);

  const act = useCallback(
    async (verb: 'approve' | 'reject') => {
      if (!proposalId) return;
      const { settled: settledStatus, failMsg } = VERB_OUTCOME[verb];
      setLoading(true);
      setError(null);
      try {
        const res = await apiFetch(`/api/session-handoff/${proposalId}/${verb}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        const data = (await res.json().catch(() => ({}))) as { status?: Status; error?: string };
        if (data.status && isSettled(data.status)) {
          setStatus(data.status);
          return;
        }
        if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
        setStatus(settledStatus);
      } catch (err) {
        setError(err instanceof Error ? err.message : failMsg);
      } finally {
        setLoading(false);
      }
    },
    [proposalId],
  );

  if (!proposalId) {
    return (
      <div className="border border-red-500/20 bg-red-950/20 backdrop-blur-sm rounded-lg p-3 text-xs text-red-400">
        ⚠️ Handoff card missing proposalId
      </div>
    );
  }

  // Split metadata fields vs rich markdown notes
  const { metadataFields, contentFields } = useMemo(() => {
    const meta: Array<{ label: string; value: string }> = [];
    const content: Array<{ label: string; value: string }> = [];
    
    (block.fields ?? []).forEach((f) => {
      const labelLower = f.label.toLowerCase();
      if (
        f.label === '封印 session' || 
        labelLower.includes('worktree') || 
        labelLower.includes('commits')
      ) {
        meta.push(f);
      } else {
        content.push(f);
      }
    });
    return { metadataFields: meta, contentFields: content };
  }, [block.fields]);

  const settled = isSettled(status);

  // Border & Glow based on status
  const cardBorderColor = useMemo(() => {
    if (status === 'approved') return 'border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.05)]';
    if (status === 'rejected') return 'border-rose-500/30';
    if (status === 'expired') return 'border-neutral-500/30';
    return 'border-blue-500/20 shadow-[0_4px_20px_rgba(59,130,246,0.05)]';
  }, [status]);

  return (
    <div className={`border ${cardBorderColor} bg-[var(--cafe-surface-elevated)]/50 backdrop-blur-md rounded-xl p-4 transition-all duration-300`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="font-semibold text-sm text-[var(--cafe-text)] flex items-center gap-1.5">
            <span className="text-base select-none">🔄</span>
            {block.title}
          </div>
          {block.bodyMarkdown && (
            <div className="mt-1 text-xs text-[var(--cafe-text-secondary)] leading-relaxed">
              <MarkdownContent content={block.bodyMarkdown} className="!text-xs" disableCommandPrefix />
            </div>
          )}
        </div>
      </div>

      {/* Metadata Pills */}
      {metadataFields.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {metadataFields.map((f) => (
            <div 
              key={f.label} 
              className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--cafe-surface-canvas)]/80 text-[var(--cafe-text-muted)] border border-white/5 flex items-center gap-1 font-mono"
            >
              <span className="opacity-70">{f.label}:</span>
              <span className="font-semibold text-[var(--cafe-text-secondary)] truncate max-w-[150px]">{f.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Rich Content Sections (Markdown rendering) */}
      {contentFields.length > 0 && (
        <div className="mt-3.5 space-y-2.5">
          {contentFields.map((f) => (
            <div 
              key={f.label} 
              className="group relative bg-[var(--cafe-surface-canvas)]/40 hover:bg-[var(--cafe-surface-canvas)]/60 border border-white/[0.03] rounded-lg p-2.5 transition-all duration-200"
            >
              {/* Left Accent indicator line */}
              <div className="absolute left-0 top-2.5 bottom-2.5 w-0.5 bg-gradient-to-b from-blue-400 to-indigo-500 rounded-full opacity-60 group-hover:opacity-100 transition-opacity" />
              
              <div className="text-[10px] font-bold tracking-wider uppercase text-blue-400/80 mb-1 pl-1.5 select-none">
                {f.label}
              </div>
              <div className="text-xs text-[var(--cafe-text-secondary)] pl-1.5 leading-relaxed [&_p]:mb-1 [&_p:last-child]:mb-0 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4">
                <MarkdownContent content={f.value} className="!text-xs text-[var(--cafe-text-secondary)]" disableCommandPrefix />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Settled State or Actions */}
      {settled ? (
        <div className="mt-4 pt-3 border-t border-white/[0.04] flex items-center justify-between">
          <div className="text-xs text-[var(--cafe-text-secondary)] flex items-center gap-2">
            {status === 'approved' && (
              <>
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-400 text-xs select-none">🐾</span>
                <span className="font-medium text-emerald-400/90">已批准，任务接力成功。未来的自己即将在下一阶段收到这份记忆。</span>
              </>
            )}
            {status === 'rejected' && (
              <>
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-rose-500/10 text-rose-400 text-xs select-none">✗</span>
                <span className="font-medium text-rose-400/90">已驳回，当前 session 继续运行。</span>
              </>
            )}
            {status === 'expired' && (
              <>
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-neutral-500/10 text-neutral-400 text-xs select-none">○</span>
                <span className="font-medium text-neutral-400/90">提案已过期。</span>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-4 pt-3.5 border-t border-white/[0.04] flex flex-wrap gap-2.5">
          <button
            type="button"
            disabled={loading}
            onClick={() => act('approve')}
            className="text-xs font-semibold px-4 py-1.5 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white shadow-[0_2px_8px_rgba(59,130,246,0.25)] hover:shadow-[0_4px_12px_rgba(59,130,246,0.4)] disabled:opacity-50 transition-all transform hover:-translate-y-[0.5px] active:translate-y-0 select-none cursor-pointer"
          >
            {loading ? '处理中...' : '批准并接力 🐾'}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => act('reject')}
            className="text-xs font-medium px-4 py-1.5 rounded-lg border border-rose-500/20 text-rose-400 hover:bg-rose-500/10 active:bg-rose-500/20 disabled:opacity-50 transition-all select-none cursor-pointer"
          >
            驳回
          </button>
          {error && <div className="w-full mt-2 text-xs text-rose-400 flex items-center gap-1">⚠️ {error}</div>}
        </div>
      )}
    </div>
  );
}
```

---

## 4. 对下一棒猫猫的建议

- **UI TDD 验证**：在 packages/web 下跑 `pnpm test` (or jest/playwright)，检查重构后是否有 UI test 损坏（如 labels 分组后的 DOM 元素查找方式）。
- **Markdown 支持**：请确保 `<MarkdownContent />` 对内容字段的块渲染（例如 `ul`/`ol`）能正常缩进且不受包裹层影响。
