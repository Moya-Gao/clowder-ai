'use client';

import { useCallbackAuthAggregate, useCallbackAuthAvailable } from '@/stores/callbackAuthStore';
import { useChatStore } from '@/stores/chatStore';

/**
 * F099 P1-2: Always-visible Hub entry in the top bar (gear icon).
 *
 * F174 D2b-2 (rev2): callback-auth failure badge merge — replaces standalone
 * top-bar plug indicator (rev1, PR #1410) which was rejected by 铲屎官 alpha
 * 验收 ("top 栏位置宝贵, plug 图标冗余"). Top-bar is scarce real estate,
 * and Hub button is the natural entity-level home for system signals.
 *
 * Badge rules (复用 GitHub/iOS 通知 mental model):
 *   isAvailable=false                 → no badge (zero pollution for non-owner)
 *   24h totalFailures = 0             → no badge (top-bar visual zero increment)
 *   24h totalFailures 1-5             → amber badge with count
 *   24h totalFailures >= 6            → red badge with count
 *   total > 99                        → "99+" cap
 *
 * Click semantics (badge-aware):
 *   no badge  → openHub()  (default)
 *   has badge → openHub('observability', 'callback-auth') (deep-link to source)
 */

const DEGRADED_COLOR = '#F59E0B';
const BROKEN_COLOR = '#EF4444';
const BROKEN_THRESHOLD = 6;

export function HubButton() {
  const openHub = useChatStore((s) => s.openHub);
  const aggregate = useCallbackAuthAggregate();
  const isAvailable = useCallbackAuthAvailable();

  const failures = isAvailable ? aggregate.totalFailures24h : 0;
  const showBadge = failures > 0;
  const badgeColor = failures >= BROKEN_THRESHOLD ? BROKEN_COLOR : DEGRADED_COLOR;
  const badgeText = failures > 99 ? '99+' : String(failures);
  // Factual tooltip — failure-only counter cannot prove "healthy" (砚砚 P2 #1410).
  const tooltip = showBadge ? `Clowder AI Hub · MCP Callback Auth 24h ${failures} 次失败 — 点击查看` : 'Clowder AI Hub';

  const handleClick = () => {
    if (showBadge) {
      openHub('observability', 'callback-auth');
    } else {
      openHub();
    }
  };

  return (
    <button
      onClick={handleClick}
      className="relative p-1 rounded-lg hover:bg-cocreator-light transition-colors"
      aria-label={tooltip}
      title={tooltip}
      data-bootcamp-step="hub-button"
      data-guide-id="hub.trigger"
      data-testid="hub-button"
      data-callback-auth-failures={showBadge ? String(failures) : undefined}
    >
      <svg
        className="w-5 h-5 text-cafe-secondary"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
      {showBadge && (
        <span
          data-testid="hub-button-callback-auth-badge"
          className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold flex items-center justify-center"
          style={{ backgroundColor: badgeColor, color: '#FFFFFF' }}
        >
          {badgeText}
        </span>
      )}
    </button>
  );
}
