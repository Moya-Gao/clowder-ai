'use client';

/**
 * F229 PR-A2: conciergeStore — 猫猫球前台猫前端状态
 *
 * 核心设计（micro-spec §1）：
 *   ballState = 纯投影函数，永远不进 store（INV-2）
 *   所有可见状态由 projectBallState(inputs) 派生，零存储、零同步、零失同步
 *
 * 懒接线（INV-9）：
 *   idle 时只有一次 config GET；panel 展开才 GET /api/concierge/thread（懒创建）
 *   失败 → error 态 + 可手动重试，不自动重试风暴
 */

import type { ConciergeConfig } from '@cat-cafe/shared';
import { CONCIERGE_CONFIG_DEFAULTS } from '@cat-cafe/shared';
import { create } from 'zustand';
import { apiFetch } from '@/utils/api-client';

// ---------------------------------------------------------------------------
// 公共类型
// ---------------------------------------------------------------------------

/**
 * ConciergeInputs: projectBallState 的唯一输入。
 * 这些字段是 store 的实际状态（INV-2: ballState 自身绝不在此）。
 */
export interface ConciergeInputs {
  enabled: boolean;
  muted: boolean;
  /** concierge thread 最新 invocation 状态（chat-types:433 语义） */
  invocationStatus: 'idle' | 'pending' | 'in_progress' | 'error';
  /** 面板内未决确认卡（PR-A3 前恒 0） */
  pendingConfirmationCount: number;
  /** relay 已投递未回执数（PR-A3 前恒 0） */
  pendingRelayCount: number;
  /** found 未查看数；panel 打开并滚到底 → 清零 */
  unseenResultCount: number;
  panelOpen: boolean;
  inputFocused: boolean;
}

// ---------------------------------------------------------------------------
// projectBallState — 纯函数（INV-4，导出供测试直接 import）
// ---------------------------------------------------------------------------

/**
 * 球态投影函数。输入 ConciergeInputs，输出球状态或 'hidden'。
 *
 * 优先级全序（高到低）：
 *   hidden(disabled/muted) > error > needs-confirmation > thinking > handoff > listening > found > idle
 *
 * 无副作用，同 inputs 重复调用输出恒等（INV-4）。
 */
export function projectBallState(i: ConciergeInputs): import('@cat-cafe/shared').ConciergeBallState | 'hidden' {
  if (!i.enabled || i.muted) return 'hidden';
  if (i.invocationStatus === 'error') return 'error';
  if (i.pendingConfirmationCount > 0) return 'needs-confirmation';
  if (i.invocationStatus === 'pending' || i.invocationStatus === 'in_progress') return 'thinking';
  if (i.pendingRelayCount > 0) return 'handoff';
  if (i.panelOpen && i.inputFocused) return 'listening';
  if (i.unseenResultCount > 0) return 'found';
  return 'idle';
}

// ---------------------------------------------------------------------------
// Store 状态接口
// ---------------------------------------------------------------------------

interface ConciergeStoreState extends ConciergeInputs {
  // Config (loaded from /api/concierge/config)
  displayName: string;
  personaTone: string;
  dutyCatProfileId: string;
  proactivePolicy: 'ambient' | 'quiet-badge';
  skin: 'yarn-ball';

  // Thread
  threadId: string | null;

  // Load state
  configLoaded: boolean;
  configLoading: boolean;
  /** Set true when fetchConfig fails — lets ConciergeHost render with optimistic defaults
   *  instead of staying null forever (P2 R5: no dead state on network error). */
  configFailed: boolean;
  threadIdLoaded: boolean;
  threadIdLoading: boolean;

  // Actions
  /** Lazy-load config once (INV-9: only one GET at idle). No-op if already loading/loaded. */
  fetchConfig: () => Promise<void>;
  /** Lazy-load concierge threadId on first panel open (INV-9). */
  fetchThreadId: () => Promise<void>;
  /** Toggle muted with optimistic update + PUT /api/concierge/config (INV-8). */
  setMuted: (muted: boolean) => Promise<void>;
  /** Open/close panel; closing clears unseenResultCount (panel-open-scroll-to-bottom semantic). */
  setPanelOpen: (open: boolean) => void;
  setInputFocused: (focused: boolean) => void;
  setInvocationStatus: (status: ConciergeInputs['invocationStatus']) => void;
  /** Called when relay receipt arrives: pendingRelayCount-1, unseenResultCount+1. */
  onRelayReceived: () => void;
  /** Mark all results seen (panel opened + scrolled to bottom). */
  markResultsSeen: () => void;
  incrementPendingConfirmation: () => void;
  decrementPendingConfirmation: () => void;
  /** Called on concierge_teleport/concierge_go action — collapses panel (INV-7). */
  onNavigationAction: () => void;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

const DEFAULTS = CONCIERGE_CONFIG_DEFAULTS;

export const useConciergeStore = create<ConciergeStoreState>((set, get) => ({
  // ConciergeInputs
  enabled: true, // optimistic default; fetchConfig will correct if needed
  muted: false,
  invocationStatus: 'idle',
  pendingConfirmationCount: 0,
  pendingRelayCount: 0,
  unseenResultCount: 0,
  panelOpen: false,
  inputFocused: false,

  // Config
  displayName: DEFAULTS.displayName,
  personaTone: DEFAULTS.personaTone,
  dutyCatProfileId: '',
  proactivePolicy: DEFAULTS.proactivePolicy,
  skin: DEFAULTS.skin,

  // Thread
  threadId: null,

  // Load state
  configLoaded: false,
  configLoading: false,
  configFailed: false,
  threadIdLoaded: false,
  threadIdLoading: false,

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------

  fetchConfig: async () => {
    const { configLoaded, configLoading } = get();
    if (configLoaded || configLoading) return; // INV-9: only one GET
    set({ configLoading: true });
    try {
      const res = await apiFetch('/api/concierge/config');
      if (!res.ok) throw new Error(`config fetch failed: ${res.status}`);
      // P1-1: backend returns { config: ConciergeConfig } wrapper (concierge.ts:63)
      const { config }: { config: ConciergeConfig } = await res.json();
      set({
        enabled: config.enabled,
        muted: config.muted,
        displayName: config.displayName,
        personaTone: config.personaTone,
        dutyCatProfileId: config.dutyCatProfileId,
        proactivePolicy: config.proactivePolicy,
        skin: config.skin,
        configLoaded: true,
        configLoading: false,
      });
    } catch {
      // On failure: mark not loading + set configFailed so ConciergeHost can render
      // with optimistic defaults instead of staying null forever (P2 R5)
      set({ configLoading: false, configFailed: true });
    }
  },

  fetchThreadId: async () => {
    const { threadIdLoaded, threadIdLoading } = get();
    if (threadIdLoaded || threadIdLoading) return; // INV-9: lazy, no repeat
    set({ threadIdLoading: true });
    try {
      // P1 cloud: backend route is POST /api/concierge/thread (concierge.ts:101)
      // GET would fall into catch path → invocationStatus=error, threadId never set
      const res = await apiFetch('/api/concierge/thread', { method: 'POST' });
      if (!res.ok) throw new Error(`thread fetch failed: ${res.status}`);
      const data: { threadId: string } = await res.json();
      set({
        threadId: data.threadId,
        threadIdLoaded: true,
        threadIdLoading: false,
        // P2 cloud: clear error state on successful retry — without this, invocationStatus
        // stays 'error' from a prior failure even after the thread is successfully loaded,
        // keeping projectBallState stuck at 'error' indefinitely.
        invocationStatus: 'idle',
      });
    } catch {
      // INV-9: failure → error state, no auto-retry storm
      set({ invocationStatus: 'error', threadIdLoading: false });
    }
  },

  setMuted: async (muted: boolean) => {
    const prev = get().muted;
    // Optimistic update
    set({ muted });
    try {
      const res = await apiFetch('/api/concierge/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ muted }),
      });
      if (!res.ok) throw new Error(`muted PUT failed: ${res.status}`);
    } catch {
      // Revert on failure
      set({ muted: prev });
    }
  },

  setPanelOpen: (open: boolean) => {
    set({ panelOpen: open });
    if (open) {
      // When panel opens + (conceptually scrolled to bottom), clear unseen count
      set({ unseenResultCount: 0 });
    } else {
      // P2-B cloud: clear input focus on close — prevents stale 'listening' state
      // on reopen when blur handler didn't fire (unmounted component, cross-browser)
      set({ inputFocused: false });
    }
  },

  setInputFocused: (focused: boolean) => set({ inputFocused: focused }),

  setInvocationStatus: (status) => set({ invocationStatus: status }),

  onRelayReceived: () => {
    const { pendingRelayCount, unseenResultCount } = get();
    set({
      pendingRelayCount: Math.max(0, pendingRelayCount - 1),
      unseenResultCount: unseenResultCount + 1,
    });
  },

  markResultsSeen: () => set({ unseenResultCount: 0 }),

  incrementPendingConfirmation: () => set((s) => ({ pendingConfirmationCount: s.pendingConfirmationCount + 1 })),

  decrementPendingConfirmation: () =>
    set((s) => ({ pendingConfirmationCount: Math.max(0, s.pendingConfirmationCount - 1) })),

  onNavigationAction: () => {
    // INV-7: teleport/go action → collect panel so user's intent has transferred
    // P2-B cloud: also clear inputFocused — same stale-listening prevention as setPanelOpen(false)
    set({ panelOpen: false, inputFocused: false });
  },
}));
