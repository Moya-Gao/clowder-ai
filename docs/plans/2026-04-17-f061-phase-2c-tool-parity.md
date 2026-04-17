---
feature_ids: [F061]
related_features: [F061]
topics: [antigravity, tool-parity, executor, design]
doc_kind: plan
created: 2026-04-17
owner: 布偶猫 Opus 4.7 试用分身
---

# F061 Phase 2c — Tool Parity Implementation Plan

**Feature:** F061 — `docs/features/F061-antigravity-bengal-cat.md`
**Goal:** 让 @antig-opus 在 Cat Café 里和 @opus/@codex 一样拥有原生工具执行能力（不只是图像/浏览器），消除 RUN_COMMAND 卡死。
**Acceptance Criteria:** F061 Phase 2c-D 的 AC-2cD1..5 + Phase 2c-I 的 AC-2cI1..7（详见 spec）。
**Architecture:** 双阶段 executor 模式——Bridge 自己实现 `AntigravityToolExecutor`，`stage 1` 用已有 `HandleCascadeUserInteraction { permission }` 通过权限关，`stage 2` 用 LS 原生 `RunCommand` unary 执行命令并通过 `SendActionToChatPanel` 回推结果。可观测性靠审计日志兜底。
**Tech Stack:** Node.js + TypeScript + 已有 ConnectRPC JSON client（`AntigravityBridge.ts`）+ pino 审计日志 + vitest（测试）。
**前端验证:** No — 纯后端 Bridge 协议层；愿景守护阶段由砚砚/另一分身在 runtime 用真实 cascade 跑一遍。

---

## Straight-Line Check

**B（终点）**: cat-cafe 里 `@antigravity 帮我 git log -5`，猫猫回复正确的 5 条 commit，cascade 步骤全部 DONE（不再有 ERROR）。

**不建设的**:
- ❌ Bridge 自起 extension_server（Path A 放弃）
- ❌ 客户端 streaming `StreamTerminalShellCommand` 写回（Path B 延后到 Phase 2c+，等 schema 完全逆向）
- ❌ 除 `RUN_COMMAND` 之外的其他 step 类型原生执行（v2 再做）
- ❌ 把 @antig-opus 变成"可离线跑"（仍依赖运行中的 Antigravity LS）

**终态 schema**（接口签名）:

```ts
// 1. 工具执行器接口
interface AntigravityToolExecutor<TInput, TOutput> {
  readonly toolName: string;                       // 'run_command' | 'read_file' | ...
  canHandle(step: CortexStep): boolean;
  execute(input: TInput, ctx: ExecutorContext): Promise<ExecutorResult<TOutput>>;
}

type ExecutorResult<T> =
  | { status: 'success'; output: T; stdout?: string; stderr?: string; exitCode?: number; durationMs: number }
  | { status: 'error'; error: string; stderr?: string; durationMs: number }
  | { status: 'refused'; reason: string };

interface ExecutorContext {
  cascadeId: string;
  trajectoryId: string;
  stepIndex: number;
  cwd: string;
  audit: AuditLogger;  // 每次 execute 都落一条
}

// 2. Bridge 主循环 hook
interface AntigravityBridge {
  // ... 现有方法
  nativeExecute(step: CortexStep, ctx: ExecutorContext): Promise<ExecutorResult<unknown>>;
  pushToolResult(cascadeId: string, stepIndex: number, result: ExecutorResult<unknown>): Promise<void>;
}
```

每个 step 都流过这条管线（extend-only）；即使未来加了 stream 写回，也只是 `pushToolResult` 的一个新实现。

**每步通过三问**:
- 扩展而非重写 ✓（新文件，interface 稳定）
- 可测证据 ✓（每步有 unit test + 最后有 integration repro）
- 删步骤成本 ✓（interface + executor + writeback 各自独立）

---

## Task Breakdown

### Task 1: AntigravityToolExecutor interface + ExecutorRegistry

**Files:**
- Create: `packages/api/src/domains/cats/services/agents/providers/antigravity/executors/AntigravityToolExecutor.ts`
- Create: `packages/api/src/domains/cats/services/agents/providers/antigravity/executors/ExecutorRegistry.ts`
- Test: `packages/api/src/domains/cats/services/agents/providers/antigravity/executors/__tests__/ExecutorRegistry.test.ts`

**Step 1: Write the failing test**

```ts
// ExecutorRegistry.test.ts
import { describe, it, expect } from 'vitest';
import { ExecutorRegistry } from '../ExecutorRegistry';
import { createMockExecutor } from './__fixtures__/mockExecutor';

describe('ExecutorRegistry', () => {
  it('routes step to executor by toolName', () => {
    const registry = new ExecutorRegistry();
    const runCmd = createMockExecutor('run_command');
    registry.register(runCmd);
    const step = { metadata: { toolCall: { name: 'run_command' } } };
    expect(registry.resolve(step)).toBe(runCmd);
  });

  it('returns null for unknown tool', () => {
    const registry = new ExecutorRegistry();
    const step = { metadata: { toolCall: { name: 'foo_bar' } } };
    expect(registry.resolve(step)).toBeNull();
  });

  it('throws on duplicate toolName registration', () => {
    const registry = new ExecutorRegistry();
    registry.register(createMockExecutor('run_command'));
    expect(() => registry.register(createMockExecutor('run_command'))).toThrow();
  });
});
```

**Step 2: Run test — expect fail**

```
pnpm --filter @cat-cafe/api vitest run packages/api/src/domains/cats/services/agents/providers/antigravity/executors/__tests__/ExecutorRegistry.test.ts
```

**Step 3: Minimal implementation**

```ts
// AntigravityToolExecutor.ts
import type { CortexStep } from '../types/cortex';

export type ExecutorResult<T> =
  | { status: 'success'; output: T; stdout?: string; stderr?: string; exitCode?: number; durationMs: number }
  | { status: 'error'; error: string; stderr?: string; durationMs: number }
  | { status: 'refused'; reason: string };

export interface ExecutorContext {
  cascadeId: string;
  trajectoryId: string;
  stepIndex: number;
  cwd: string;
  audit: import('./AuditLogger').AuditLogger;
}

export interface AntigravityToolExecutor<TInput = unknown, TOutput = unknown> {
  readonly toolName: string;
  canHandle(step: CortexStep): boolean;
  execute(input: TInput, ctx: ExecutorContext): Promise<ExecutorResult<TOutput>>;
}
```

```ts
// ExecutorRegistry.ts
import type { AntigravityToolExecutor } from './AntigravityToolExecutor';
import type { CortexStep } from '../types/cortex';

export class ExecutorRegistry {
  private readonly executors = new Map<string, AntigravityToolExecutor>();

  register(executor: AntigravityToolExecutor): void {
    if (this.executors.has(executor.toolName)) {
      throw new Error(`Executor for tool "${executor.toolName}" already registered`);
    }
    this.executors.set(executor.toolName, executor);
  }

  resolve(step: CortexStep): AntigravityToolExecutor | null {
    const toolName = step.metadata?.toolCall?.name;
    if (!toolName) return null;
    return this.executors.get(toolName) ?? null;
  }
}
```

**Step 4: Run test — expect pass**

**Step 5: Commit**

```bash
git add packages/api/src/domains/cats/services/agents/providers/antigravity/executors/
git commit -m "feat(F061): add AntigravityToolExecutor interface + registry [宪宪/Opus-47🐾]"
```

---

### Task 2: AuditLogger (append-only JSONL to logs/antigravity-native-audit/)

**Files:**
- Create: `packages/api/src/domains/cats/services/agents/providers/antigravity/executors/AuditLogger.ts`
- Test: `packages/api/src/domains/cats/services/agents/providers/antigravity/executors/__tests__/AuditLogger.test.ts`

**Step 1: Write failing test**

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AuditLogger } from '../AuditLogger';

describe('AuditLogger', () => {
  let logDir: string;
  beforeEach(() => { logDir = mkdtempSync(join(tmpdir(), 'audit-')); });
  afterEach(() => { rmSync(logDir, { recursive: true, force: true }); });

  it('appends one JSON line per execution', async () => {
    const logger = new AuditLogger(logDir);
    await logger.record({
      tool: 'run_command',
      cascadeId: 'c1', stepIndex: 0,
      input: { commandLine: 'echo hi', cwd: '/tmp' },
      result: { status: 'success', stdout: 'hi\n', exitCode: 0, durationMs: 5 },
      timestamp: new Date('2026-04-17T10:00:00Z'),
    });
    const file = readFileSync(join(logDir, 'native-audit-2026-04-17.jsonl'), 'utf8');
    const entry = JSON.parse(file.trim());
    expect(entry.tool).toBe('run_command');
    expect(entry.cascadeId).toBe('c1');
    expect(entry.result.exitCode).toBe(0);
  });
});
```

**Step 2: Run → fail**

**Step 3: Implementation**

```ts
// AuditLogger.ts
import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { ExecutorResult } from './AntigravityToolExecutor';

export interface AuditEntry {
  tool: string;
  cascadeId: string;
  stepIndex: number;
  input: unknown;
  result: ExecutorResult<unknown>;
  timestamp: Date;
}

export class AuditLogger {
  constructor(private readonly logDir: string) {
    mkdirSync(logDir, { recursive: true });
  }

  async record(entry: AuditEntry): Promise<void> {
    const date = entry.timestamp.toISOString().slice(0, 10);
    const file = join(this.logDir, `native-audit-${date}.jsonl`);
    appendFileSync(file, JSON.stringify({ ...entry, timestamp: entry.timestamp.toISOString() }) + '\n');
  }
}
```

**Step 4: Run → pass**
**Step 5: Commit**

---

### Task 3: RunCommandExecutor (uses LS.RunCommand unary)

**Files:**
- Create: `packages/api/src/domains/cats/services/agents/providers/antigravity/executors/RunCommandExecutor.ts`
- Test: `.../__tests__/RunCommandExecutor.test.ts`

**Step 1: Write failing test**

```ts
import { describe, it, expect, vi } from 'vitest';
import { RunCommandExecutor } from '../RunCommandExecutor';

describe('RunCommandExecutor', () => {
  it('calls LS.RunCommand and returns stdout/exitCode', async () => {
    const mockRpc = vi.fn().mockResolvedValue({ stdout: 'probe\n', exitCode: 0 });
    const exec = new RunCommandExecutor({ rpc: mockRpc });
    const result = await exec.execute(
      { commandLine: 'echo probe', cwd: '/tmp' },
      { cascadeId: 'c', trajectoryId: 't', stepIndex: 0, cwd: '/tmp', audit: { record: vi.fn() } as any }
    );
    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect(result.stdout).toBe('probe\n');
      expect(result.exitCode).toBe(0);
    }
  });

  it('refuses destructive commands on Redis 6399', async () => {
    const exec = new RunCommandExecutor({ rpc: vi.fn() });
    const result = await exec.execute(
      { commandLine: 'redis-cli -p 6399 flushall', cwd: '/tmp' },
      { cascadeId: 'c', trajectoryId: 't', stepIndex: 0, cwd: '/tmp', audit: { record: vi.fn() } as any }
    );
    expect(result.status).toBe('refused');
  });
});
```

**Step 3: Implementation**

```ts
// RunCommandExecutor.ts
import type { AntigravityToolExecutor, ExecutorContext, ExecutorResult } from './AntigravityToolExecutor';
import type { CortexStep } from '../types/cortex';

type RpcFn = (method: 'RunCommand', payload: { command: string; args?: string[]; cwd: string; commandLine?: string }) => Promise<{ stdout?: string; stderr?: string; exitCode?: number }>;

export interface RunCommandInput {
  commandLine: string;
  cwd: string;
}

const FORBIDDEN_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /-p\s*6399\b/i, reason: 'Redis 6399 is user sanctum — read-only' },
  { pattern: /\brm\s+-rf\s+\//i, reason: 'rm -rf / is always refused' },
];

export class RunCommandExecutor implements AntigravityToolExecutor<RunCommandInput, { exitCode: number }> {
  readonly toolName = 'run_command';
  constructor(private readonly deps: { rpc: RpcFn }) {}

  canHandle(step: CortexStep): boolean {
    return step.metadata?.toolCall?.name === 'run_command';
  }

  async execute(input: RunCommandInput, ctx: ExecutorContext): Promise<ExecutorResult<{ exitCode: number }>> {
    for (const { pattern, reason } of FORBIDDEN_PATTERNS) {
      if (pattern.test(input.commandLine)) {
        const result: ExecutorResult<{ exitCode: number }> = { status: 'refused', reason };
        await ctx.audit.record({ tool: this.toolName, cascadeId: ctx.cascadeId, stepIndex: ctx.stepIndex, input, result, timestamp: new Date() });
        return result;
      }
    }

    const t0 = Date.now();
    try {
      const resp = await this.deps.rpc('RunCommand', { command: '/bin/sh', args: ['-c', input.commandLine], cwd: input.cwd, commandLine: input.commandLine });
      const durationMs = Date.now() - t0;
      const result: ExecutorResult<{ exitCode: number }> = {
        status: 'success',
        output: { exitCode: resp.exitCode ?? 0 },
        stdout: resp.stdout,
        stderr: resp.stderr,
        exitCode: resp.exitCode ?? 0,
        durationMs,
      };
      await ctx.audit.record({ tool: this.toolName, cascadeId: ctx.cascadeId, stepIndex: ctx.stepIndex, input, result, timestamp: new Date() });
      return result;
    } catch (err) {
      const result: ExecutorResult<{ exitCode: number }> = { status: 'error', error: String(err), durationMs: Date.now() - t0 };
      await ctx.audit.record({ tool: this.toolName, cascadeId: ctx.cascadeId, stepIndex: ctx.stepIndex, input, result, timestamp: new Date() });
      return result;
    }
  }
}
```

**Step 4: Run → pass**
**Step 5: Commit**

---

### Task 4: Bridge.pushToolResult via synthetic user message (MVP writeback)

**Files:**
- Modify: `packages/api/src/domains/cats/services/agents/providers/antigravity/AntigravityBridge.ts`
- Test: `.../AntigravityBridge.pushToolResult.test.ts`

**Context:** `SendActionToChatPanel` accepts any payload + returns 200 `{}` — delivery unverifiable, unusable as writeback channel (probed 2026-04-17). `StreamTerminalShellCommand` schema not yet complete. **Pivot**: cancel the stuck RUN_COMMAND step via `CancelCascadeSteps`, then send a synthetic user message via existing `bridge.sendMessage` containing the tool result. The model sees a USER_INPUT step with the output and continues. Cascade "heals" by rewinding.

**Trade-off**: The cancelled RUN_COMMAND step shows CANCELED in trajectory (not DONE). Acceptable for MVP — functional parity achieved, audit log is source of truth.

**Step 1: Write failing test**

```ts
import { describe, it, expect, vi } from 'vitest';
import { AntigravityBridge } from '../AntigravityBridge';

describe('Bridge.pushToolResult', () => {
  it('cancels stuck step then injects synthetic user message with result', async () => {
    const rpcMock = vi.fn().mockResolvedValue({});
    const sendMessageMock = vi.fn().mockResolvedValue(1);
    const bridge = new AntigravityBridge();
    (bridge as any).rpc = (_c: any, m: string, p: any) => rpcMock(m, p);
    (bridge as any).sendMessage = sendMessageMock;
    (bridge as any).ensureConnected = vi.fn().mockResolvedValue({});

    await bridge.pushToolResult('c1', 23, {
      status: 'success', output: { exitCode: 0 }, stdout: '3e6c7a0\n9ba57d8\n', exitCode: 0, durationMs: 42
    }, { commandLine: 'git log --oneline -5', cwd: '/tmp' });

    expect(rpcMock).toHaveBeenCalledWith('CancelCascadeSteps', expect.objectContaining({ cascadeId: 'c1' }));
    expect(sendMessageMock).toHaveBeenCalledWith('c1', expect.stringContaining('git log --oneline -5'));
    expect(sendMessageMock).toHaveBeenCalledWith('c1', expect.stringContaining('3e6c7a0'));
  });
});
```

**Step 3: Implementation** — `pushToolResult(cascadeId, stepIndex, result, input)`: (1) call `CancelCascadeSteps { cascadeId, stepIndices: [stepIndex] }`; (2) format result as markdown with command + exit + stdout (truncated to 4KB) + stderr (if any); (3) call `sendMessage(cascadeId, formattedText)`.

**Step 5: Commit**

---

### Task 5: Wire executors into cascade polling loop (kill switch + fallback)

**Files:**
- Modify: `packages/api/src/domains/cats/services/agents/providers/antigravity/AntigravityAgentService.ts` — in the step-polling loop, when a `CORTEX_STEP_TYPE_RUN_COMMAND` step enters WAITING/PENDING, call `bridge.nativeExecute(step, ctx)` then `bridge.pushToolResult(...)`
- Modify: `packages/api/src/domains/cats/services/agents/providers/antigravity/AntigravityBridge.ts` — add `nativeExecute` delegating to registry

**Kill switch:**
- Env `ANTIGRAVITY_NATIVE_EXECUTOR=1` (default **on**)
- If `0` → skip native path, let step naturally time out (current behavior)

**Test:**
- Integration test: stub LS RPC, drive cascade through `run_command` step, assert registry.resolve called and pushToolResult called with success result

---

### Task 6: End-to-end repro test (recorded cassette)

**Files:**
- Create: `packages/api/src/domains/cats/services/agents/providers/antigravity/__tests__/e2e/run-command-roundtrip.test.ts`
- Create: `.../e2e/__cassettes__/run-command.json`

**Approach:**
- Record a cassette from a real LS where `RunCommand` returns stdout for `echo probe`
- Replay cassette in test; assert full loop: detect step → executor.execute → audit.record → pushToolResult
- Target: < 200ms in test mode

---

### Task 7: v2 executors (read_file, write_file, edit_file, grep, glob) — parked for Phase 2c-I+

Not in this PR. Tracking as follow-up AC in F061 spec.

---

## Gate 检查（Phase 2c-D 结束时）

- [ ] Task 1-5 全通过（6 是可选强化，7 是 follow-up）
- [ ] 三件套：`pnpm lint` + `pnpm check` + `pnpm --filter @cat-cafe/api test`
- [ ] 审计日志落盘验证（手动触发一次 cascade，看 `logs/antigravity-native-audit/` 有文件）
- [ ] Kill switch 验证：设 `ANTIGRAVITY_NATIVE_EXECUTOR=0`，cascade 回到 PR #1209 的行为
- [ ] 愿景守护：跨 family review——@codex 或 @gpt52 读 design、run probe、跑 e2e

## 风险与假设

| 假设 | 验证方式 | 破防兜底 |
|------|---------|----------|
| `RunCommand` 在 IDE runtime 不被额外 rate-limit | Task 6 cassette 压测 10 次 | 加 retry + backoff |
| `SendActionToChatPanel` 的 `action` payload schema | 跑 probe + 读 extension.js | 兜底改用 `SendStepsToBackground` |
| PermissionManager 不会对 native executor 调用做二次拦截 | Task 5 集成测试 | 加 `HandleCascadeUserInteraction { permission: { allowed: true } }` 前置调用 |
| 审计日志对 runtime 磁盘无压 | monitor `logs/` 大小 | 加 rotation（Phase 2c-I+） |

## 时间估算

- Task 1-2: 60min（interface + 审计）
- Task 3: 90min（RunCommandExecutor + 测试）
- Task 4: 90min（pushToolResult writeback）
- Task 5: 90min（AgentService wire + kill switch + integration test）
- Task 6: 60min（e2e cassette）
- **总计: ~7h，一个工作日内 + PR + review**

## 下一步（写完计划后）

→ 直接加载 `tdd` skill 开始 Task 1 实现。
