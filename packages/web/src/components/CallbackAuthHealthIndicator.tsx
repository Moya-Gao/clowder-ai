'use client';

/**
 * F174 D2b-2 (rev) — system-level callback-auth health indicator.
 *
 * Replaces the rejected per-cat dot UX (PR #1403 → 铲屎官 alpha 反馈"莫名其妙的颜色"
 * because individual avatar dots lacked any affordance / mental model).
 * The right "实体层" host is the callback-auth subsystem itself, not each
 * individual cat — so this is a single icon in the top bar, with its own
 * legend (plug SVG = MCP callback connection), color-coded badge for 24h
 * failure count, click-to-jump to D2b-3 deep-dive.
 *
 *   No data / non-owner  → render nothing (zero pollution)
 *   24h 0 failures       → low-key gray plug icon (passive presence)
 *   24h N>0 failures     → amber (1-5) or red (6+) plug + N badge
 *   click                → openHub('observability', 'callback-auth')
 */

import { useCallbackAuthAggregate, useCallbackAuthAvailable } from '@/stores/callbackAuthStore';
import { useChatStore } from '@/stores/chatStore';
import { HubIcon } from './hub-icons';

const HEALTHY_COLOR = '#A89386'; // cafe-muted — present but quiet
const DEGRADED_COLOR = '#F59E0B'; // amber
const BROKEN_COLOR = '#EF4444'; // red

const DEGRADED_THRESHOLD = 1;
const BROKEN_THRESHOLD = 6;

function deriveLevel(total: number): { color: string; level: 'healthy' | 'degraded' | 'broken' } {
  if (total >= BROKEN_THRESHOLD) return { color: BROKEN_COLOR, level: 'broken' };
  if (total >= DEGRADED_THRESHOLD) return { color: DEGRADED_COLOR, level: 'degraded' };
  return { color: HEALTHY_COLOR, level: 'healthy' };
}

export function CallbackAuthHealthIndicator() {
  const aggregate = useCallbackAuthAggregate();
  const isAvailable = useCallbackAuthAvailable();
  const openHub = useChatStore((s) => s.openHub);

  // Non-owner / no data → render nothing (zero visual pollution).
  if (!isAvailable) return null;

  const total = aggregate.totalFailures24h;
  const { color, level } = deriveLevel(total);
  // 砚砚 P2 #1410: don't overclaim health from a failure-only counter (same trap
  // as cloud Codex P1 round 7 "absent ≠ healthy"). Stay factual: "无失败记录".
  const tooltip =
    total === 0
      ? 'MCP Callback Auth · 24h 无失败记录 — 点击查看详情'
      : `MCP Callback Auth · 24h ${total} 次失败 (${level === 'broken' ? '严重' : '降级'}) — 点击查看详情`;

  return (
    <button
      type="button"
      onClick={() => openHub('observability', 'callback-auth')}
      aria-label={tooltip}
      title={tooltip}
      data-testid="callback-auth-health-indicator"
      data-callback-auth-level={level}
      className="relative p-1 rounded-lg hover:bg-cocreator-light transition-colors"
    >
      <span style={{ color }} className="block">
        <HubIcon name="plug" className="w-5 h-5" />
      </span>
      {total > 0 && (
        <span
          data-testid="callback-auth-health-badge"
          className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold flex items-center justify-center"
          style={{ backgroundColor: color, color: '#FFFFFF' }}
        >
          {total > 99 ? '99+' : total}
        </span>
      )}
    </button>
  );
}
