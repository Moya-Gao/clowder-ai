/**
 * F194 Phase Z4 — AC-Z10/AC-Z11: live event placeholder id ≡ hydrate canonical id.
 *
 * 铲屎官 alpha 实测 2026-05-10 02:30：F5 后气泡正常，F5 前 thinking/web/rich 多余气泡。
 * 砚砚 root cause: live event 创建的 placeholder 用非 deterministic id
 * `bg-think-${Date.now()}-...`，但 hydrate 后 server canonical id 是
 * `msg-{turnInvocationId}-{catId}` (deriveBubbleId 公式)。两者不一致 →
 * live UI 同时显示 placeholder + canonical bubble；F5 后只剩 canonical，所以"修好了"。
 *
 * Z4 fix: bg path 三处 placeholder (web_search:505 / rich_block:571 / thinking:681)
 * 改用 `deriveBubbleId(turnInvocationId ?? invocationId, catId, fallback)`。
 *
 * RED before fix: dispatch thinking event before text chunk → placeholder id 不是
 * deterministic format → subsequent text chunk 命中不上同一 bubble → 分裂。
 * GREEN after fix: placeholder id 直接是 `msg-{turn}-{cat}` → 后续 chunk + hydrate
 * 都命中同一 bubble → 单一 bubble，live ≡ hydrate canonical。
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { configureDebug } from '@/debug/invocationEventDebug';
import { useChatStore } from '@/stores/chatStore';
import { useToastStore } from '@/stores/toastStore';
import { resetSharedReplacedInvocations } from '../shared-replaced-invocations';
import { type BackgroundAgentMessage, handleBackgroundAgentMessage } from '../useAgentMessages';

let testBgSeq = 0;
const testBgStreamRefs = new Map<string, { id: string; threadId: string; catId: string }>();
const testBgFinalizedRefs = new Map<string, string>();

function dispatchBg(msg: BackgroundAgentMessage) {
  handleBackgroundAgentMessage(msg, {
    store: useChatStore.getState(),
    bgStreamRefs: testBgStreamRefs,
    finalizedBgRefs: testBgFinalizedRefs,
    nextBgSeq: () => testBgSeq++,
    addToast: () => {},
    clearDoneTimeout: () => {},
  });
}

describe('F194 Phase Z4 — live event placeholder id ≡ hydrate canonical id', () => {
  beforeEach(() => {
    configureDebug({ enabled: false });
    useChatStore.setState({
      messages: [],
      isLoading: false,
      isLoadingHistory: false,
      hasMore: true,
      hasActiveInvocation: false,
      intentMode: null,
      targetCats: [],
      catStatuses: {},
      catInvocations: {},
      activeInvocations: {},
      currentGame: null,
      threadStates: {},
      viewMode: 'single',
      splitPaneThreadIds: [],
      splitPaneTargetId: null,
      currentThreadId: 'thread-active',
      currentProjectPath: 'default',
      threads: [],
      isLoadingThreads: false,
    });
    useToastStore.setState({ toasts: [] });
    testBgSeq = 0;
    testBgStreamRefs.clear();
    testBgFinalizedRefs.clear();
    resetSharedReplacedInvocations();
  });

  it('thinking placeholder uses deterministic id (msg-{turn}-{cat}) when invocationId is bound', () => {
    // Pre-condition: catInvocations binds {invocationId, turnInvocationId} for opus
    // (set by invocation_created broadcast before stream chunks arrive).
    useChatStore.setState({
      threadStates: {
        'thread-bg': {
          messages: [],
          targetCats: [],
          catStatuses: {},
          catInvocations: {
            opus: {
              invocationId: 'P-Z4',
              turnInvocationId: 'T-Z4',
              startedAt: Date.now(),
            },
          },
          activeInvocations: {},
          intentMode: null,
          isLoading: false,
          isLoadingHistory: false,
          hasMore: true,
          hasActiveInvocation: false,
          currentGame: null,
          unreadCount: 0,
          hasUserMention: false,
          lastActivity: Date.now(),
          queue: [],
          queuePaused: false,
          queueFull: false,
          workspaceWorktreeId: null,
          workspaceOpenTabs: [],
          workspaceOpenFilePath: null,
          workspaceOpenFileLine: null,
        },
      },
    });

    // Dispatch thinking event BEFORE any text/tool chunk (this is the placeholder branch).
    dispatchBg({
      type: 'system_info',
      catId: 'opus',
      threadId: 'thread-bg',
      content: JSON.stringify({ type: 'thinking', text: 'reasoning step 1' }),
      timestamp: Date.now(),
    });

    const ts = useChatStore.getState().getThreadState('thread-bg');
    expect(ts.messages.length).toBe(1);
    // GREEN after Z4: placeholder id is deterministic deriveBubbleId output.
    // RED before Z4: id was `bg-think-${Date.now()}-opus-{seq}` non-deterministic.
    expect(ts.messages[0]?.id).toBe('msg-T-Z4-opus');
    expect(ts.messages[0]?.thinking).toContain('reasoning step 1');
  });

  it('subsequent text chunk converges onto same bubble id (live ≡ hydrate canonical)', () => {
    useChatStore.setState({
      threadStates: {
        'thread-bg': {
          messages: [],
          targetCats: [],
          catStatuses: {},
          catInvocations: {
            opus: {
              invocationId: 'P-Z4b',
              turnInvocationId: 'T-Z4b',
              startedAt: Date.now(),
            },
          },
          activeInvocations: {},
          intentMode: null,
          isLoading: false,
          isLoadingHistory: false,
          hasMore: true,
          hasActiveInvocation: false,
          currentGame: null,
          unreadCount: 0,
          hasUserMention: false,
          lastActivity: Date.now(),
          queue: [],
          queuePaused: false,
          queueFull: false,
          workspaceWorktreeId: null,
          workspaceOpenTabs: [],
          workspaceOpenFilePath: null,
          workspaceOpenFileLine: null,
        },
      },
    });

    // 1. thinking placeholder
    dispatchBg({
      type: 'system_info',
      catId: 'opus',
      threadId: 'thread-bg',
      content: JSON.stringify({ type: 'thinking', text: 'thinking before text' }),
      timestamp: Date.now(),
    });
    // 2. then text chunk on the SAME turn — should land in same bubble
    dispatchBg({
      type: 'text',
      catId: 'opus',
      threadId: 'thread-bg',
      content: 'first text after thinking',
      invocationId: 'P-Z4b',
      turnInvocationId: 'T-Z4b',
      timestamp: Date.now() + 50,
    });

    const ts = useChatStore.getState().getThreadState('thread-bg');
    // GREEN: single bubble at deterministic id, both thinking + content present.
    // RED: 2 bubbles — placeholder at bg-think-... + new bubble at msg-T-Z4b-opus.
    const opusBubbles = ts.messages.filter((m) => m.type === 'assistant' && m.catId === 'opus');
    expect(opusBubbles.length).toBe(1);
    expect(opusBubbles[0]?.id).toBe('msg-T-Z4b-opus');
    expect(opusBubbles[0]?.thinking).toContain('thinking before text');
    expect(opusBubbles[0]?.content).toContain('first text after thinking');
  });

  it('web_search placeholder also uses deterministic id when invocation bound', () => {
    useChatStore.setState({
      threadStates: {
        'thread-bg': {
          messages: [],
          targetCats: [],
          catStatuses: {},
          catInvocations: {
            opus: {
              invocationId: 'P-Z4c',
              turnInvocationId: 'T-Z4c',
              startedAt: Date.now(),
            },
          },
          activeInvocations: {},
          intentMode: null,
          isLoading: false,
          isLoadingHistory: false,
          hasMore: true,
          hasActiveInvocation: false,
          currentGame: null,
          unreadCount: 0,
          hasUserMention: false,
          lastActivity: Date.now(),
          queue: [],
          queuePaused: false,
          queueFull: false,
          workspaceWorktreeId: null,
          workspaceOpenTabs: [],
          workspaceOpenFilePath: null,
          workspaceOpenFileLine: null,
        },
      },
    });

    dispatchBg({
      type: 'system_info',
      catId: 'opus',
      threadId: 'thread-bg',
      content: JSON.stringify({ type: 'web_search', count: 3 }),
      timestamp: Date.now(),
    });

    const ts = useChatStore.getState().getThreadState('thread-bg');
    expect(ts.messages.length).toBe(1);
    expect(ts.messages[0]?.id).toBe('msg-T-Z4c-opus');
  });

  it('race window: system_info before invocation_created → fallback id, then invocation_created RENAMES placeholder to deterministic id (砚砚 R review P1#3)', () => {
    // No catInvocations binding for opus — invocation_created hasn't arrived yet.
    dispatchBg({
      type: 'system_info',
      catId: 'opus',
      threadId: 'thread-bg',
      content: JSON.stringify({ type: 'thinking', text: 'pre-invocation thinking' }),
      timestamp: Date.now(),
    });

    let ts = useChatStore.getState().getThreadState('thread-bg');
    expect(ts.messages.length).toBe(1);
    // Fallback path: id starts with `bg-think-` (non-deterministic, race-only).
    expect(ts.messages[0]?.id).toMatch(/^bg-think-/);

    // NOW invocation_created arrives — placeholder MUST be renamed to deterministic id
    // so subsequent canonical hydrate (`msg-{turn}-{cat}`) hits same bubble (no split).
    dispatchBg({
      type: 'system_info',
      catId: 'opus',
      threadId: 'thread-bg',
      content: JSON.stringify({ type: 'invocation_created', catId: 'opus', invocationId: 'inner-T-RACE' }),
      invocationId: 'P-RACE',
      turnInvocationId: 'T-RACE',
      timestamp: Date.now() + 50,
    });

    ts = useChatStore.getState().getThreadState('thread-bg');
    // GREEN after R review fix: placeholder renamed to msg-T-RACE-opus.
    // RED before fix: placeholder stayed at bg-think-* → live ≠ hydrate.
    expect(ts.messages.length).toBe(1);
    expect(ts.messages[0]?.id).toBe('msg-T-RACE-opus');
    expect(ts.messages[0]?.thinking).toContain('pre-invocation thinking');
    expect(ts.messages[0]?.extra?.stream?.invocationId).toBe('P-RACE');
    expect(ts.messages[0]?.extra?.stream?.turnInvocationId).toBe('T-RACE');
  });

  it('event uses msg.invocationId / turnInvocationId over stale store catInvocations (砚砚 R review P1#2)', () => {
    // Setup: store has stale catInvocations from previous turn (opus turn 1).
    useChatStore.setState({
      threadStates: {
        'thread-bg': {
          messages: [],
          targetCats: [],
          catStatuses: {},
          catInvocations: {
            opus: {
              invocationId: 'P-STALE',
              turnInvocationId: 'T-STALE-PREV',
              startedAt: Date.now() - 10000,
            },
          },
          activeInvocations: {},
          intentMode: null,
          isLoading: false,
          isLoadingHistory: false,
          hasMore: true,
          hasActiveInvocation: false,
          currentGame: null,
          unreadCount: 0,
          hasUserMention: false,
          lastActivity: Date.now(),
          queue: [],
          queuePaused: false,
          queueFull: false,
          workspaceWorktreeId: null,
          workspaceOpenTabs: [],
          workspaceOpenFilePath: null,
          workspaceOpenFileLine: null,
        },
      },
    });

    // Live event for opus turn 3 arrives with FRESH ids (different from stale store).
    dispatchBg({
      type: 'system_info',
      catId: 'opus',
      threadId: 'thread-bg',
      content: JSON.stringify({ type: 'thinking', text: 'turn 3 thinking' }),
      invocationId: 'P-FRESH',
      turnInvocationId: 'T-FRESH-NEW',
      timestamp: Date.now(),
    });

    const ts = useChatStore.getState().getThreadState('thread-bg');
    expect(ts.messages.length).toBe(1);
    // GREEN after R review fix: msg.* takes priority → bubble id uses fresh T-FRESH-NEW.
    // RED before fix: store.catInvocations[opus] won → bubble id uses stale T-STALE-PREV
    // → opus turn 1 + turn 3 collide on same bubble id (the "第一个第三个 opus 合并" bug).
    expect(ts.messages[0]?.id).toBe('msg-T-FRESH-NEW-opus');
  });

  it('stale store turnInvocationId is NOT used when msg lacks turn (砚砚 R2 P1)', () => {
    // 砚砚 R2 P1 scenario:
    //   1. opus turn 1 done → markInvocationComplete leaves store as
    //      { invocationId: undefined, turnInvocationId: T1 } (R3 fix clears both, but
    //      this test exercises the safe-fallback gate as defense in depth).
    //   2. opus turn 3 system_info arrives with parent only (msg.invocationId=P, no turn).
    //   3. WITHOUT R3 gate: turnInvocationId = msg.turnInvocationId ?? store.turnInvocationId = T1
    //      → derive msg-T1-opus → collide with turn 1 bubble id → merge.
    //   4. WITH R3 gate: store.invocationId (undefined) !== resolved parent (P) → reject store
    //      turn → use parent fallback → derive msg-P-opus (different from msg-T1-opus).
    useChatStore.setState({
      threadStates: {
        'thread-bg': {
          messages: [],
          targetCats: [],
          catStatuses: {},
          catInvocations: {
            opus: {
              // Stale state: invocationId cleared but turnInvocationId leaked from prev turn.
              invocationId: undefined,
              turnInvocationId: 'T1-STALE',
              startedAt: Date.now() - 5000,
            },
          },
          activeInvocations: {},
          intentMode: null,
          isLoading: false,
          isLoadingHistory: false,
          hasMore: true,
          hasActiveInvocation: false,
          currentGame: null,
          unreadCount: 0,
          hasUserMention: false,
          lastActivity: Date.now(),
          queue: [],
          queuePaused: false,
          queueFull: false,
          workspaceWorktreeId: null,
          workspaceOpenTabs: [],
          workspaceOpenFilePath: null,
          workspaceOpenFileLine: null,
        },
      },
    });

    // Turn 3 thinking with parent only (no turn — race window before invocation_created).
    dispatchBg({
      type: 'system_info',
      catId: 'opus',
      threadId: 'thread-bg',
      content: JSON.stringify({ type: 'thinking', text: 'turn 3 thinking pre-invocation' }),
      invocationId: 'P-NEW',
      // turnInvocationId intentionally absent
      timestamp: Date.now(),
    });

    const ts = useChatStore.getState().getThreadState('thread-bg');
    expect(ts.messages.length).toBe(1);
    // GREEN after R3: bubble id derived from parent (P-NEW), NOT stale T1.
    // RED before R3: bubble id was msg-T1-STALE-opus → would collide with prev turn 1.
    expect(ts.messages[0]?.id).toBe('msg-P-NEW-opus');
    expect(ts.messages[0]?.id).not.toBe('msg-T1-STALE-opus');
  });

  it('full chain replay: opus turn1 → codex → opus turn3 with a2a_handoff produces 3 distinct bubbles (砚砚 R review P1#4)', () => {
    // AC-Z10 invariant: live event replay produces same bubble identity set as
    // post-hydrate canonical state. opus turn1 + codex + opus turn3 must yield
    // 3 distinct bubbles with deterministic ids (no merge, no split, no extra placeholders).
    const baseTime = Date.now();

    // Turn 1: opus
    dispatchBg({
      type: 'system_info',
      catId: 'opus',
      threadId: 'thread-bg',
      content: JSON.stringify({ type: 'invocation_created', catId: 'opus', invocationId: 'inner-T1' }),
      invocationId: 'P-CHAIN',
      turnInvocationId: 'T1',
      timestamp: baseTime,
    });
    dispatchBg({
      type: 'system_info',
      catId: 'opus',
      threadId: 'thread-bg',
      content: JSON.stringify({ type: 'thinking', text: 'opus turn1 thinking' }),
      invocationId: 'P-CHAIN',
      turnInvocationId: 'T1',
      timestamp: baseTime + 10,
    });
    dispatchBg({
      type: 'text',
      catId: 'opus',
      threadId: 'thread-bg',
      content: 'opus turn1 reply',
      invocationId: 'P-CHAIN',
      turnInvocationId: 'T1',
      timestamp: baseTime + 20,
    });
    dispatchBg({
      type: 'done',
      catId: 'opus',
      threadId: 'thread-bg',
      invocationId: 'P-CHAIN',
      turnInvocationId: 'T1',
      timestamp: baseTime + 30,
    });

    // Turn 2: codex (via a2a_handoff)
    dispatchBg({
      type: 'system_info',
      catId: 'codex',
      threadId: 'thread-bg',
      content: JSON.stringify({ type: 'invocation_created', catId: 'codex', invocationId: 'inner-T2' }),
      invocationId: 'P-CHAIN',
      turnInvocationId: 'T2',
      timestamp: baseTime + 40,
    });
    dispatchBg({
      type: 'text',
      catId: 'codex',
      threadId: 'thread-bg',
      content: 'codex turn2 reply',
      invocationId: 'P-CHAIN',
      turnInvocationId: 'T2',
      timestamp: baseTime + 50,
    });
    dispatchBg({
      type: 'done',
      catId: 'codex',
      threadId: 'thread-bg',
      invocationId: 'P-CHAIN',
      turnInvocationId: 'T2',
      timestamp: baseTime + 60,
    });

    // Turn 3: opus again (same parent chain, different turn)
    dispatchBg({
      type: 'system_info',
      catId: 'opus',
      threadId: 'thread-bg',
      content: JSON.stringify({ type: 'invocation_created', catId: 'opus', invocationId: 'inner-T3' }),
      invocationId: 'P-CHAIN',
      turnInvocationId: 'T3',
      timestamp: baseTime + 70,
    });
    dispatchBg({
      type: 'system_info',
      catId: 'opus',
      threadId: 'thread-bg',
      content: JSON.stringify({ type: 'thinking', text: 'opus turn3 thinking' }),
      invocationId: 'P-CHAIN',
      turnInvocationId: 'T3',
      timestamp: baseTime + 80,
    });
    dispatchBg({
      type: 'text',
      catId: 'opus',
      threadId: 'thread-bg',
      content: 'opus turn3 reply',
      invocationId: 'P-CHAIN',
      turnInvocationId: 'T3',
      timestamp: baseTime + 90,
    });

    const ts = useChatStore.getState().getThreadState('thread-bg');
    const bubbles = ts.messages.filter((m) => m.type === 'assistant');
    // GREEN: 3 distinct bubbles with deterministic ids matching post-hydrate canonical.
    // RED before Z4: opus turn3 thinking placeholder might land at bg-think-* OR stale T1
    // → 4+ bubbles, or merge with turn1 → 2 bubbles. Both fail live ≡ hydrate invariant.
    expect(bubbles.length).toBe(3);
    const ids = bubbles.map((b) => b.id);
    expect(ids).toEqual(['msg-T1-opus', 'msg-T2-codex', 'msg-T3-opus']);
    expect(bubbles[0]?.content).toContain('turn1 reply');
    expect(bubbles[0]?.thinking).toContain('turn1 thinking');
    expect(bubbles[1]?.content).toContain('turn2 reply');
    expect(bubbles[2]?.content).toContain('turn3 reply');
    expect(bubbles[2]?.thinking).toContain('turn3 thinking');
  });
});
