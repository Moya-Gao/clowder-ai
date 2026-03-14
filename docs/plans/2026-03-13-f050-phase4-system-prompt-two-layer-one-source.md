# F050 Phase 4: System Prompt 两层一源 Implementation Plan

**Feature:** F050 — `docs/features/F050-a2a-external-agent-onboarding.md`
**Goal:** 建立系统提示词唯一真相源 + 同步脚本，消除动态层与静态层漂移风险
**Acceptance Criteria:**
- AC-P4-1: `assets/system-prompts/` 语义分片结构建立
- AC-P4-2: `scripts/sync-system-prompts.ts --check` 能检测 drift
- AC-P4-3: `scripts/sync-system-prompts.ts --apply` 能渲染并写入 `~/.codex/AGENTS.md` + `~/.gemini/GEMINI.md`
- AC-P4-4: ADR 记录"禁止 runtime 覆写 `~/` 配置"
- AC-P4-5: F050 §H 配置地图与实际同步脚本一致
- AC-P4-6: 愿景守护 — 改了 governance-l0 后跑 `--check` 能发现 drift

**Architecture:** 语义分片（governance + collab + per-cat identity）→ provider renderer（Codex/Gemini 各自拼装）→ sync script（`--check` drift 检测 / `--apply` 写入 `~/`）。分片是 Markdown 文本文件，渲染器是 TypeScript 脚本，输出格式按各猫原生配置要求。

**Tech Stack:** TypeScript (tsx/node --import tsx), fs, crypto (hash diff), commander (CLI)
**前端验证:** No — 纯工具/资源文件

---

## Straight-Line Check

**Finish line:** `scripts/sync-system-prompts.ts --check` 输出 drift 状态，`--apply` 写入两猫配置。
**Not building:** 不改 SystemPromptBuilder（动态层不动）、不做 OpenCode/Antigravity 同步、不做 runtime 覆写。

---

## Task 1: 语义分片结构 (AC-P4-1)

**Files:**
- Create: `assets/system-prompts/governance-l0.md`
- Create: `assets/system-prompts/collab-rules.md`
- Create: `assets/system-prompts/cats/codex.md`
- Create: `assets/system-prompts/cats/gemini.md`
- Create: `assets/system-prompts/cats/opus.md` (reference only, Claude 用 CLAUDE.md)

### Step 1: 创建 governance-l0.md

从 `SystemPromptBuilder.ts` 的 `GOVERNANCE_L0_DIGEST` 常量提取家规内容（P1-P4 原则、W1-W6 世界观、纪律条款、magic words）。这是跨猫共享的，所有猫都要读。

```markdown
# Cat Café 家规 (L0 Governance)

## 核心原则
- P1: ...
- P2: ...
(从 GOVERNANCE_L0_DIGEST 逐条提取)

## 世界观
- W1: ...

## 纪律
(discipline items)

## Magic Words
(脚手架、绕路了、喵约、星星罐子)
```

### Step 2: 创建 collab-rules.md

从 `SystemPromptBuilder.ts` 的协作规则部分提取：@-mention 格式、A2A 出口检查、路由规则。

```markdown
# 协作规则

## @ 规则
另起一行行首写 @句柄（句中 @ 无效）。

## A2A 出口检查
回复前问"到我这里结束了吗？"→ 不是 → 谁需要动 → 末尾另起一行行首写 @句柄。

## 队友花名册
(从 cat-config.json 动态读取，这里放模板说明)
```

### Step 3: 创建 cats/codex.md

从当前 `~/.codex/AGENTS.md` 提取 + 标准化：

```markdown
# 致缅因猫（砚砚）

你是这个家不可或缺的一份子...
(当前 AGENTS.md 的内容，作为 identity shard)
```

### Step 4: 创建 cats/gemini.md

从当前 `~/.gemini/GEMINI.md` 提取 + 补充身份信息：

```markdown
# 致暹罗猫（烁烁）

你必须使用中文来回答...
(当前 GEMINI.md 内容 + 补充身份/性格/角色)
```

### Step 5: 创建 cats/opus.md (reference)

```markdown
# 致布偶猫（宪宪）
> 注意：布偶猫的真相源是仓库根 CLAUDE.md，此文件仅作参考/备份，不参与同步。
```

### Step 6: Commit

```
docs(F050-P4): establish system prompt semantic shards
```

---

## Task 2: Provider Renderer + Sync Script (AC-P4-2, AC-P4-3, AC-P4-5, AC-P4-6)

**Files:**
- Create: `scripts/sync-system-prompts.ts`
- Test: `scripts/sync-system-prompts.test.ts`

### Step 1: 写失败测试 — `--check` drift 检测

```typescript
// scripts/sync-system-prompts.test.ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { renderForCodex, renderForGemini, checkDrift } from './sync-system-prompts.js';

describe('sync-system-prompts', () => {
  describe('renderForCodex', () => {
    it('should include governance-l0 content', () => {
      const result = renderForCodex();
      assert.ok(result.includes('家规'));
      assert.ok(result.includes('砚砚'));
    });
    it('should include collab rules', () => {
      const result = renderForCodex();
      assert.ok(result.includes('@'));
    });
  });

  describe('renderForGemini', () => {
    it('should include governance-l0 content', () => {
      const result = renderForGemini();
      assert.ok(result.includes('家规'));
      assert.ok(result.includes('烁烁'));
    });
    it('should include language instruction', () => {
      const result = renderForGemini();
      assert.ok(result.includes('中文'));
    });
  });

  describe('checkDrift', () => {
    it('should detect drift when target differs from rendered', async () => {
      // mock: target file content ≠ rendered content → drift detected
    });
    it('should report no drift when synchronized', async () => {
      // mock: target file content === rendered content → no drift
    });
  });
});
```

### Step 2: 跑测试确认失败

```bash
npx tsx --test scripts/sync-system-prompts.test.ts
```
Expected: FAIL (module not found)

### Step 3: 实现 renderer + CLI

```typescript
// scripts/sync-system-prompts.ts
// 核心函数：
// - readShard(name) → 读 assets/system-prompts/{name}.md
// - renderForCodex() → governance-l0 + collab-rules + cats/codex.md → 拼装为 AGENTS.md 格式
// - renderForGemini() → governance-l0 + collab-rules + cats/gemini.md → 拼装为 GEMINI.md 格式
// - checkDrift() → 读 ~/目标文件 vs renderFor*() 比对 → 返回 drift 状态
// - applySync() → 写入 ~/目标文件

// CLI:
// --check: 输出 drift 状态（exit 0 = synced, exit 1 = drifted）
// --apply: 写入并报告
// --dry-run: 只输出渲染结果不写入
```

同步目标映射表（与 F050 §H 保持一致）：
```
renderForCodex() → ~/.codex/AGENTS.md
renderForGemini() → ~/.gemini/GEMINI.md
```

### Step 4: 跑测试确认通过

```bash
npx tsx --test scripts/sync-system-prompts.test.ts
```
Expected: PASS

### Step 5: 端到端验证

```bash
# drift 检查
npx tsx scripts/sync-system-prompts.ts --check

# dry-run 看渲染结果
npx tsx scripts/sync-system-prompts.ts --apply --dry-run

# 真正写入
npx tsx scripts/sync-system-prompts.ts --apply
```

### Step 6: Commit

```
feat(F050-P4): add sync-system-prompts script with check/apply modes
```

---

## Task 3: ADR (AC-P4-4)

**Files:**
- Create: `docs/decisions/NNN-no-runtime-home-overwrite.md`

### Step 1: 写 ADR

```markdown
# ADR-NNN: 禁止 Runtime 覆写各猫 Home 目录配置

## Status: Accepted (2026-03-13)

## Context
F050 Phase 4 讨论中，布偶猫×缅因猫评估了"调度时动态覆写各猫 ~/配置"方案。

## Decision
**禁止** Cat Café 在运行时（dispatch/invocation 过程中）自动修改各猫 home 目录下的配置文件。

## Rationale
1. 侵入性：改用户 home 目录文件影响所有使用该 agent 的场景，不只是 Cat Café
2. 竞态风险：多个 Cat Café 实例/session 同时写同一文件
3. 个人环境污染：铲屎官可能在原生配置中有自定义内容

## Consequences
- 系统提示词同步只通过显式脚本（scripts/sync-system-prompts.ts --apply）
- 不支持原生配置的猫（OpenCode、Antigravity）继续靠动态 prompt 注入
```

### Step 2: Commit

```
docs(F050-P4): ADR — no runtime home directory overwrite
```

---

## Task 4: F050 §H 更新 + 最终验证 (AC-P4-5)

### Step 1: 更新 F050 §H 配置地图

确保 §H 的表格与 sync script 的实际 target 一致。加上 sync script 路径引用。

### Step 2: AC 打勾 + Commit

```
docs(F050-P4): update §H config map, check all ACs
```

---

## 执行顺序

```
Task 1 (分片) → Task 2 (脚本+测试) → Task 3 (ADR) → Task 4 (§H 更新)
```

全部在一个 worktree 里完成，一个 PR 合入。
