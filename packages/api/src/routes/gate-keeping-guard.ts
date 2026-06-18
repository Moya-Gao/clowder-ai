/**
 * F167 trigger-time gate-keeping thread guard.
 *
 * Root cause: opensource-ops SKILL.md 文字层 100%「守门 thread 不修 bug / 不替下游
 * hold」但 trigger-time 0 enforcement → 同 session 同天 2 只猫连续在守门 thread
 * 误挂 PR tracking + hold_ball（双 owner，球权死锁）。
 *
 * Guard 行为：当 thread.threadKind === 'gate-keeping' 时，hard-block 三个端点
 * (`register_pr_tracking` / `register_issue_tracking` / `hold_ball`)。猫必须先把球
 * 分发出去（cross_post / propose_thread / 留 needs-info）再到下游 thread 调这些工具
 * —— 下游 thread 的 threadKind 不是 'gate-keeping'，guard 自然不触发，根本不需要
 * 任何 override 通道。
 *
 * Design note (R1 review with @gpt52 P1)：早期设计有 override 字面量
 * 'i-am-the-downstream-owner' 让"自认下游 owner"的猫绕过 guard，但所有三个端点都把
 * 状态绑到「当前 invocation 的 threadId」(record.threadId)；在守门 thread 内传
 * override 等于恢复 dual-owner 死锁本身，在真正的下游 thread 内 guard 根本不触发。
 * override 只是个无意义且危险的逃生门，整体删除。
 *
 * Fail-open 原则：threadStore.get 抛错（Redis 抖动 / store 未注入）→ 不阻塞生产。
 */

import type { IThreadStore } from '../domains/cats/services/stores/ports/ThreadStore.js';
import { CALLBACK_TOOL, STATUS } from '../infrastructure/telemetry/genai-semconv.js';
import { gateKeepingHarnessAttemptCount } from '../infrastructure/telemetry/instruments.js';

/**
 * Minimal counter shape — accepts whatever instruments.ts exposes (lazy
 * OpenTelemetry counter). Kept structural so test stubs can inject a fake.
 *
 * Attribute keys map to the F152 metric-allowlist:
 *   tool → CALLBACK_TOOL ('callback.tool')
 *   outcome → STATUS ('status')
 */
export interface GateKeepingMetricCounter {
  add(value: number, attributes: Record<string, string>): void;
}

export type GateKeepingTool = 'register_pr_tracking' | 'register_issue_tracking' | 'hold_ball';

export type GateKeepingOutcome = 'pass' | 'blocked' | 'guard_skipped';

function metricAttributes(tool: GateKeepingTool, outcome: GateKeepingOutcome): Record<string, string> {
  return { [CALLBACK_TOOL]: tool, [STATUS]: outcome };
}

export interface GateKeepingGuardResult {
  outcome: GateKeepingOutcome;
  /** 当 outcome === 'blocked' 时填充：路由层应 return 这个 body + status 400。 */
  blockedResponse?: {
    error: 'gate_keeping_thread_default_blocked';
    reason: string;
    remediation: string;
    threadKind: 'gate-keeping';
    tool: GateKeepingTool;
  };
}

export interface CheckGateKeepingInput {
  threadStore: Pick<IThreadStore, 'get'> | undefined;
  threadId: string;
  tool: GateKeepingTool;
  /** 可选 telemetry counter；caller 不传默认用 registered counter。 */
  metric?: GateKeepingMetricCounter;
  /** 可选 logger（warn 级，用于 guard_skipped）。 */
  log?: { warn: (obj: Record<string, unknown>, msg: string) => void };
  /** 透传 telemetry 上下文（catId / 端点参数），用于 log。 */
  context?: Record<string, unknown>;
}

const REMEDIATION_PR =
  '请先 cross_post_message 到 PR 的负责 thread 或 propose_thread 开新 thread 把球分发，再在下游 thread 调本工具。守门 thread 没有 override 通道。';
const REMEDIATION_ISSUE =
  '请先 cross_post_message 到 issue 的负责 thread 或 propose_thread 开新 thread 把球分发，再在下游 thread 调本工具。守门 thread 没有 override 通道。';
const REMEDIATION_HOLD =
  '请先 cross_post_message / propose_thread 把球完整分发给下游 thread，让下游 thread 自己 hold；守门 thread 不替下游 hold（opensource-ops SKILL Common Mistakes #8）。';

const REASON_PR =
  '守门 thread 默认不挂 PR tracking——把球 cross_post 或 propose_thread 给下游 owner（opensource-ops SKILL 红线）';
const REASON_ISSUE =
  '守门 thread 默认不挂 issue tracking——把球 cross_post 或 propose_thread 给下游 owner（opensource-ops SKILL 红线）';
const REASON_HOLD =
  '守门 thread 默认不挂 hold_ball——已 cross_post / propose 分发后不再替下游 hold（opensource-ops SKILL Common Mistakes #8）';

function reasonFor(tool: GateKeepingTool): string {
  switch (tool) {
    case 'register_pr_tracking':
      return REASON_PR;
    case 'register_issue_tracking':
      return REASON_ISSUE;
    case 'hold_ball':
      return REASON_HOLD;
  }
}

function remediationFor(tool: GateKeepingTool): string {
  switch (tool) {
    case 'register_pr_tracking':
      return REMEDIATION_PR;
    case 'register_issue_tracking':
      return REMEDIATION_ISSUE;
    case 'hold_ball':
      return REMEDIATION_HOLD;
  }
}

/**
 * Trigger-time guard. Returns:
 *   - `pass` — non-gate-keeping thread; let caller proceed
 *   - `blocked` — gate-keeping thread; caller MUST return blockedResponse + 400
 *   - `guard_skipped` — threadStore missing or get() threw; fail-open (telemetry counted)
 *
 * INV-G1 (mutual exclusion): threadKind union ensures concierge XOR gate-keeping XOR undefined.
 * INV-G7 (fail-open): never block on infra flakiness.
 */
export async function checkGateKeepingGuard(input: CheckGateKeepingInput): Promise<GateKeepingGuardResult> {
  const { threadStore, threadId, tool, log, context = {} } = input;
  // Default to the registered counter; callers may inject a stub for testing.
  const metric: GateKeepingMetricCounter = input.metric ?? gateKeepingHarnessAttemptCount;

  if (!threadStore) {
    metric.add(1, metricAttributes(tool, 'guard_skipped'));
    log?.warn({ threadId, tool, ...context }, 'F167 gate-keeping guard skipped: threadStore not configured');
    return { outcome: 'guard_skipped' };
  }

  let threadKind: string | undefined;
  try {
    const thread = await threadStore.get(threadId);
    threadKind = thread?.threadKind;
  } catch (err) {
    metric.add(1, metricAttributes(tool, 'guard_skipped'));
    log?.warn(
      { threadId, tool, err, ...context },
      'F167 gate-keeping guard skipped: threadStore.get failed (fail-open)',
    );
    return { outcome: 'guard_skipped' };
  }

  if (threadKind !== 'gate-keeping') {
    return { outcome: 'pass' };
  }

  metric.add(1, metricAttributes(tool, 'blocked'));
  return {
    outcome: 'blocked',
    blockedResponse: {
      error: 'gate_keeping_thread_default_blocked',
      reason: reasonFor(tool),
      remediation: remediationFor(tool),
      threadKind: 'gate-keeping',
      tool,
    },
  };
}
