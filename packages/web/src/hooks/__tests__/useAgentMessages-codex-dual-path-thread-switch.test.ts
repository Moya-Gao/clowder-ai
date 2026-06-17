import { describe, expect, it } from 'vitest';
import { getActiveBubble } from '@/hooks/thread-runtime-ledger';
import { getThreadRuntimeLedger } from '@/hooks/thread-runtime-singleton';
import { useChatStore } from '@/stores/chatStore';
import { installActiveHarness, threadCodexStreamBubbles } from './useAgentMessages-codex-tool-text-convergence.helpers';

/**
 * F194 dual-path thread-switch regression — codex live bubble split (saga round 17 root cause).
 *
 * Real operator devtools sample (2026-06-17): a single codex A2A reply in thread Y
 * split into TWO bubbles because the operator's `currentThreadId` switched away
 * (Y → X) mid-reply. `handleAgentMessage` reads `currentThreadId` fresh per
 * message: events while viewing Y take the ACTIVE path; events after switching
 * away take the BACKGROUND path. codex tool/work-log events carry NO
 * `msg.turnInvocationId` (only `invocation_created` does), so the two paths
 * resolve the bubble's turn id from DIFFERENT sources:
 *   - active path binds the bubble to the live turn and records it in the
 *     per-thread runtime ledger keyed (threadId, codex).
 *   - background path `ensureBackgroundAssistantMessage` resolves the turn from
 *     `getThreadState(threadId).catInvocations[codex].turnInvocationId` ONLY. After
 *     the reply finalizes and a NEW codex invocation context lands a DIFFERENT
 *     (shadow) turn there, the late tool events derive a DIFFERENT bubble id →
 *     a second, empty work-log-only bubble → SPLIT.
 *
 * Reproduced end-state matches the real sample exactly:
 *   bubble A (active): id `msg-<persistedTurn>-codex`, the reply text, finalized.
 *   bubble B (background): id `msg-<shadowTurn>-codex`, EMPTY content, tool events,
 *     still streaming.
 * Both live in threadStates[Y].messages. F5 re-projects from the single persisted
 * record → self-heals to one, proving it is a live-reducer-only split.
 *
 * Z3 redline: the fix only aligns the fallback SOURCE when msg.turnInvocationId is
 * ABSENT (codex tool events). Genuinely different invocation_created turns keep
 * distinct ledger bubbles → distinct turns → stay separate.
 */
const THREAD_Y = 'thread-1'; // the reply thread (active harness default current thread)
const THREAD_X = 'thread-other'; // the thread the operator switches to mid-reply

const PARENT = 'ff1d8e85-50e8-4355-bb5f-b830f4bd59d5'; // shared parent invocationId (real sample)
const TURN = '1ba442cb-persisted'; // active/persisted turn id (matches the persisted record)
const SHADOW = 'ac378b26-shadow'; // live-only shadow turn that contaminated catInvocations

function toolY(ts: number, command: string, turn?: string) {
  return {
    type: 'tool_use' as const,
    catId: 'codex' as const,
    threadId: THREAD_Y,
    toolName: 'shell',
    toolInput: { command },
    invocationId: PARENT,
    ...(turn ? { turnInvocationId: turn } : {}),
    timestamp: ts,
  };
}

function textY(content: string, ts: number, turn?: string) {
  return {
    type: 'text' as const,
    catId: 'codex' as const,
    threadId: THREAD_Y,
    content,
    origin: 'stream' as const,
    invocationId: PARENT,
    ...(turn ? { turnInvocationId: turn } : {}),
    timestamp: ts,
  };
}

/** Contaminate thread Y's per-thread catInvocations with a turn id (mimics a new codex invocation context). */
function setThreadYTurn(turn: string) {
  const state = useChatStore.getState();
  useChatStore.setState({
    threadStates: {
      ...state.threadStates,
      [THREAD_Y]: {
        ...state.getThreadState(THREAD_Y),
        catInvocations: { codex: { invocationId: PARENT, turnInvocationId: turn } },
      },
    },
  });
}

describe('Codex dual-path thread switch — one reply must stay ONE bubble', () => {
  const harness = installActiveHarness();

  it('[mid-reply thread switch] active bubble + post-finalize background tool events converge to ONE bubble', () => {
    // Live turn context for thread Y: catInvocations binds codex to PARENT/TURN.
    useChatStore.setState({
      catInvocations: { codex: { invocationId: PARENT, turnInvocationId: TURN } },
    });

    harness.render();

    // ── Phase 1: operator is VIEWING thread Y (active path) ──
    // codex streams text + a tool batch; active path binds them to TURN and records
    // the bound bubble in the per-thread runtime ledger keyed (Y, codex).
    harness.send(textY('我来查 OKF，不靠记忆猜。这里是这次回复的正文……', 1100, TURN));
    harness.send(toolY(1200, 'rg -n "OKF" packages/', TURN));

    expect(threadCodexStreamBubbles(THREAD_Y)).toHaveLength(1);
    expect(getActiveBubble(getThreadRuntimeLedger(), THREAD_Y, 'codex')).toMatchObject({
      messageId: `msg-${TURN}-codex`,
    });

    // ── Phase 2: operator SWITCHES away to thread X (mid codex reply) ──
    useChatStore.getState().setCurrentThread(THREAD_X);
    expect(useChatStore.getState().currentThreadId).toBe(THREAD_X);

    // ── Phase 3: the rest of the reply streams + finalizes via the BACKGROUND path ──
    // A trailing stream chunk binds the background ref to the existing bubble, then
    // `done` finalizes it (streaming=false). Crucially, the active runtime ledger for
    // Y still holds the bound bubble — the active deleteActive only ever clears the
    // CURRENT thread's (now X) ledger.
    harness.send(textY(' 继续补充结论。', 1230, TURN));
    harness.send({
      type: 'done' as const,
      catId: 'codex' as const,
      threadId: THREAD_Y,
      invocationId: PARENT,
      turnInvocationId: TURN,
      timestamp: 1250,
    });
    expect(getActiveBubble(getThreadRuntimeLedger(), THREAD_Y, 'codex')).toMatchObject({
      messageId: `msg-${TURN}-codex`,
    });

    // ── Phase 4: a NEW codex invocation context contaminates Y's per-thread turn ──
    // The background path reads getThreadState(Y).catInvocations — now a DIFFERENT
    // (shadow) turn, exactly the live-only id the real sample's split bubble carried.
    setThreadYTurn(SHADOW);

    // ── Phase 5: late tool events for the SAME Y reply arrive (background path) ──
    // codex tool events carry NO turnInvocationId. The background path must recover
    // the bound turn from the Y ledger; if it falls back to the per-thread shadow
    // turn instead, it derives msg-<SHADOW>-codex → a second, empty work-log bubble.
    harness.send(toolY(1300, "sed -n '1,220p' packages/web/foo.ts"));
    harness.send(toolY(1400, 'rg -n "split" packages/web/'));

    // The same codex reply must remain ONE bubble in thread Y, not split into a
    // separate shadow-turn work-log bubble.
    const bubblesY = threadCodexStreamBubbles(THREAD_Y);
    expect(bubblesY.map((m) => m.id)).not.toContain(`msg-${SHADOW}-codex`);
    expect(bubblesY).toHaveLength(1);
    expect(bubblesY[0]!.content).toContain('我来查 OKF');
    expect(bubblesY[0]!.toolEvents?.length ?? 0).toBeGreaterThan(0);
  });

  it('[Z3 redline] genuinely different turns (each with its own invocation_created) stay SEPARATE', () => {
    // Two distinct codex turns on the SAME parent chain in thread Y. Each turn
    // carries its OWN explicit turnInvocationId on its events (real backend stamps
    // turn ids on text/invocation_created). The ledger-fallback fix must NOT
    // collapse them: distinct turns → distinct bound ledger bubbles → 2 bubbles.
    const TURN_A = '1ba442cb-turn-a';
    const TURN_B = '7c91ddee-turn-b';

    useChatStore.setState({
      catInvocations: { codex: { invocationId: PARENT, turnInvocationId: TURN_A } },
    });

    harness.render();

    // Turn A streams + finalizes while viewing Y (active path), bound to TURN_A.
    harness.send(textY('第一轮回复正文。', 1100, TURN_A));
    harness.send(toolY(1200, 'rg -n "first" packages/', TURN_A));
    harness.send({
      type: 'done' as const,
      catId: 'codex' as const,
      threadId: THREAD_Y,
      invocationId: PARENT,
      turnInvocationId: TURN_A,
      timestamp: 1250,
    });

    // A genuinely new turn B starts on the same parent — catInvocations advances.
    useChatStore.setState({
      catInvocations: { codex: { invocationId: PARENT, turnInvocationId: TURN_B } },
    });

    // Operator switches away; turn B's events arrive on the background path. Its
    // tool events carry TURN_B explicitly (msg.turnInvocationId wins — the fix's
    // ledger fallback only applies when the turn is ABSENT). Turn B must seed its
    // OWN bubble, NOT merge into turn A's finalized bubble.
    useChatStore.getState().setCurrentThread(THREAD_X);
    harness.send(toolY(1300, 'rg -n "second" packages/', TURN_B));
    harness.send(textY('第二轮回复正文。', 1400, TURN_B));

    const bubblesY = threadCodexStreamBubbles(THREAD_Y);
    expect(bubblesY).toHaveLength(2);
    const turnIds = bubblesY.map((m) => m.extra?.stream?.turnInvocationId).sort();
    expect(turnIds).toEqual([TURN_A, TURN_B].sort());
  });
});
