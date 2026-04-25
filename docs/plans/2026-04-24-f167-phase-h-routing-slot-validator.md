---
feature_ids: [F167]
topics: [a2a, collaboration, harness-engineering]
doc_kind: plan
created: 2026-04-24
---

# F167 Phase H Implementation Plan — Final Routing Slot Validator

**Feature:** F167 — `docs/features/F167-a2a-chain-quality.md`
**Goal:** harness 层机械校验 final routing slot 里的 @ 语法，禁止语义 intent 分类器；命中 `invalid_route_syntax` 只提示不推断目标；结构边界豁免，不做动作词表
**Acceptance Criteria:** AC-H1~H7（见 F167 spec Phase H 章节）
**Architecture:** 新增 pure function module `final-routing-slot.ts`（同 `verdict-detect.ts` 结构），在 `route-serial.ts` / `route-parallel.ts` 的 verdict-warn 调用点之前插入 Phase H 调用，命中 suppress AC-C7
**Tech Stack:** TypeScript + Node test runner，纯函数 + 单元测试
**前端验证:** 无（后端 harness 层 + system_info 连接器消息，既有广播链路复用）

---

## Straight-Line Check (A→B)

**B 的定义**：`route-serial.ts` / `route-parallel.ts` 里，每轮 cat invocation 结束后：
1. 提取 final routing slot（结构剥离后最后非空段落）
2. 校验 slot 内是否有非法 inline @handle 且无合法出口
3. 命中 → 注入 `invalid_route_syntax` system_info + suppress 同轮 AC-C7；未命中 → 走既有路径
4. `invalid_route_syntax` 命中后：AC-H4 one-shot repair（见"实施拆分"section）

**Finish-line 三问对照**：
1. 新建 `final-routing-slot.ts` 是终态基座（pure function 纯结构校验），不是 scaffolding
2. AC-H3 命中产出 system_info 连接器消息 → 可在 UI 看到；Red test 可用 stubbed messageStore 验证
3. 移除这步 → 3 thread 已复现的 inline-@ 漏传球行为继续沉默掉球（KD-22 prompt 层已达上限）

## 实施拆分（YAGNI + Scope 风险提示）

AC-H4 one-shot repair 引入 re-invoke 机制，实现代价和 review 复杂度高于 AC-H1~H3/H5~H7。为控制 PR 大小、降低 review 风险，**提案把 Phase H 拆两步**（砚砚放行后生效）：

### Step A — 核心机械校验（本 PR）
- AC-H1 `finalRoutingSlot` 实现
- AC-H2 slot 内 inline @ 语法判定
- AC-H3 `invalid_route_syntax` 触发条件
- AC-H5 AC-C7 协同 suppress
- AC-H6 结构边界豁免（禁止语义豁免）
- AC-H7 测试矩阵（15 case）
- AC-H4 **system_info 兜底部分**（不含 repair）：命中时直接发一次 `invalid_route_syntax` system_info，原输出照常存档

### Step B — One-shot Repair（后续 PR，可选）
- AC-H4 的 repair 路径：触发后 re-invoke 同猫一次，repair prompt 限定"重写最后交接段"
- 依赖 re-invoke 基础设施（`invokeSingleCat` 或类似），评估后决定是否值得
- 若线上观察 Step A 已显著压住 inline-@ 漏传，可能 Step B 不必做

**判定点**：Step A 合入后观察 1-2 周线上 inline-@ 命中率与 opus-47 自纠率。如果 system_info 提示就能让下一轮纠正，Step B 不做；如果多轮仍复发，再做 repair。

---

## Task 1: 新建 `final-routing-slot.ts` — 核心 pure function

**Files:**
- Create: `packages/api/src/domains/cats/services/agents/routing/final-routing-slot.ts`
- Test: `packages/api/test/routing/final-routing-slot.test.js`

### Step 1.1: 写失败测试（Red）

`test/routing/final-routing-slot.test.js`：

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  finalRoutingSlot,
  findInlineMentionsInSlot,
  validateRoutingSyntax,
} from '../../src/domains/cats/services/agents/routing/final-routing-slot.js';

// AC-H1: finalRoutingSlot 提取末段
test('AC-H1: finalRoutingSlot returns last non-empty paragraph', () => {
  const msg = '第一段。\n\n中间段。\n\n最后交接段 @codex';
  assert.equal(finalRoutingSlot(msg), '最后交接段 @codex');
});

// AC-H1: fenced code 剥离
test('AC-H1: finalRoutingSlot strips fenced code before selecting slot', () => {
  const msg = '交接给别人：\n\n```bash\necho @codex\n```';
  const slot = finalRoutingSlot(msg);
  assert.equal(slot, '交接给别人：');
  assert.ok(!slot.includes('@codex'));
});

// AC-H1: blockquote 剥离
test('AC-H1: finalRoutingSlot strips blockquote', () => {
  const msg = '我的结论。\n\n> 铲屎官原话 @opus';
  const slot = finalRoutingSlot(msg);
  assert.equal(slot, '我的结论。');
});

// AC-H1: URL 剥离
test('AC-H1: finalRoutingSlot strips URLs', () => {
  const msg = '方案清楚。\n\nhttps://x.com/@codex 供参考。';
  const slot = finalRoutingSlot(msg);
  assert.ok(!slot.includes('https://'));
  assert.ok(!slot.includes('@codex'));
});

// AC-H2: slot 内 inline @ 识别（非行首）
test('AC-H2: findInlineMentionsInSlot returns non-linestart mentions', () => {
  const slot = '让 @codex 看一下';
  assert.deepEqual(findInlineMentionsInSlot(slot, ['codex', 'opus']), ['codex']);
});

// AC-H2: 行首 @ 不算 inline（合法路由）
test('AC-H2: line-start @ is NOT inline mention', () => {
  const slot = '@codex\n请看';
  assert.deepEqual(findInlineMentionsInSlot(slot, ['codex']), []);
});

// AC-H2: markdown list 前缀后的 @ 是行首
test('AC-H2: @ after markdown list/quote prefix counts as line-start', () => {
  const slot = '- @codex review';
  assert.deepEqual(findInlineMentionsInSlot(slot, ['codex']), []);
});

// AC-H3: slot 内非法 inline + 无合法出口 → invalid_route_syntax
test('AC-H3: inline @ in slot without legitimate exit triggers invalid_route_syntax', () => {
  const result = validateRoutingSyntax({
    text: '我让 @codex 看了',
    lineStartMentions: [],
    toolNames: [],
    structuredTargetCats: [],
    rosterHandles: ['codex', 'opus'],
  });
  assert.equal(result.kind, 'invalid_route_syntax');
  assert.deepEqual(result.inlineMentions, ['codex']);
});

// AC-H3: 合法行首 @ → 不触发
test('AC-H3: line-start @ exit suppresses invalid_route_syntax', () => {
  const result = validateRoutingSyntax({
    text: '总结：\n\n@codex review',
    lineStartMentions: ['codex'],
    toolNames: [],
    structuredTargetCats: [],
    rosterHandles: ['codex', 'opus'],
  });
  assert.equal(result.kind, 'ok');
});

// AC-H3: hold_ball exit 豁免
test('AC-H3: hold_ball tool call suppresses invalid_route_syntax', () => {
  const result = validateRoutingSyntax({
    text: '等 @codex 完成',
    lineStartMentions: [],
    toolNames: ['mcp__cat-cafe__cat_cafe_hold_ball'],
    structuredTargetCats: [],
    rosterHandles: ['codex'],
  });
  assert.equal(result.kind, 'ok');
});

// AC-H3: MCP structured routing exit 豁免
test('AC-H3: MCP targetCats routing suppresses invalid_route_syntax', () => {
  const result = validateRoutingSyntax({
    text: '让 @codex 看',
    lineStartMentions: [],
    toolNames: [],
    structuredTargetCats: ['codex'],
    rosterHandles: ['codex'],
  });
  assert.equal(result.kind, 'ok');
});

// AC-H6: slot 外 inline @ narrative 通行
test('AC-H6: inline @ outside final slot does NOT trigger', () => {
  const result = validateRoutingSyntax({
    text: '先前我让 @codex 看过。\n\n现在继续下一步。',
    lineStartMentions: [],
    toolNames: [],
    structuredTargetCats: [],
    rosterHandles: ['codex'],
  });
  assert.equal(result.kind, 'ok');
});

// AC-H6: fenced code 内的 @ 不触发
test('AC-H6: @ in fenced code block does NOT trigger', () => {
  const result = validateRoutingSyntax({
    text: '示例：\n\n```\necho @codex\n```',
    lineStartMentions: [],
    toolNames: [],
    structuredTargetCats: [],
    rosterHandles: ['codex'],
  });
  assert.equal(result.kind, 'ok');
});

// AC-H6: blockquote 内的 @ 不触发
test('AC-H6: @ in blockquote does NOT trigger', () => {
  const result = validateRoutingSyntax({
    text: '> 我问过 @codex',
    lineStartMentions: [],
    toolNames: [],
    structuredTargetCats: [],
    rosterHandles: ['codex'],
  });
  assert.equal(result.kind, 'ok');
});

// AC-H6: URL 里的 @ 不触发
test('AC-H6: @ in URL does NOT trigger', () => {
  const result = validateRoutingSyntax({
    text: '见 https://github.com/@codex/repo 的说明',
    lineStartMentions: [],
    toolNames: [],
    structuredTargetCats: [],
    rosterHandles: ['codex'],
  });
  assert.equal(result.kind, 'ok');
});
```

Run: `node --test packages/api/test/routing/final-routing-slot.test.js`
Expected: 15 tests, all FAIL with "module not found"

### Step 1.2: 最小实现

`packages/api/src/domains/cats/services/agents/routing/final-routing-slot.ts`:

```ts
/**
 * F167 Phase H AC-H1~H3/H5/H6 — Final routing slot syntax validator.
 *
 * 机械校验 final routing slot 里的 @ 语法：slot 内出现 inline @handle
 * 但无合法出口（行首 @ / hold_ball / MCP targetCats）→ invalid_route_syntax。
 *
 * 设计原则（KD-24）：
 * - 只判"出口槽位语法对不对"，不推断"猫想不想传球"（禁止语义 intent 分类器 / KD-8）
 * - 命中只产出 invalid_route_syntax，不自动路由、不推断目标、不替猫决定意图
 * - 豁免只走结构边界（fenced code / blockquote / URL），禁止动作词表 / 语义豁免表
 * - 与 AC-C7 (verdict-detect.ts) 同构，但走更严格的纯机械判定
 */

export interface ValidationInput {
  readonly text: string;
  readonly lineStartMentions: readonly string[];
  readonly toolNames: readonly string[];
  readonly structuredTargetCats: readonly string[];
  readonly rosterHandles: readonly string[];
}

export type ValidationResult =
  | { kind: 'ok' }
  | { kind: 'invalid_route_syntax'; inlineMentions: readonly string[]; slot: string };

/**
 * 提取 final routing slot = 结构剥离后的最后非空段落。
 * 结构剥离：fenced code / blockquote / URL。
 *
 * Note: 暂不支持 segment metadata（AC-H1 spec 中 optional），无则只做 markdown 结构剥离。
 */
export function finalRoutingSlot(text: string): string {
  if (!text) return '';

  // Strip fenced code blocks
  const noFence = text.replace(/```[\s\S]*?```/g, '');

  // Strip blockquote lines (entire lines starting with '>')
  const noQuote = noFence
    .split('\n')
    .filter((line) => !/^\s*>/.test(line))
    .join('\n');

  // Strip URLs (http/https, with or without markdown link syntax)
  const noUrl = noQuote.replace(/https?:\/\/[^\s)]+/g, '');

  // Split into paragraphs (blank-line separated), pick last non-empty
  const paragraphs = noUrl.split(/\n\s*\n/).map((p) => p.trim()).filter((p) => p.length > 0);
  return paragraphs.length > 0 ? paragraphs[paragraphs.length - 1] : '';
}

/**
 * Find inline @handle mentions in the slot (non-line-start).
 * Line-start = after optional markdown list/quote prefix (e.g. "- @x", "> @x").
 */
export function findInlineMentionsInSlot(slot: string, rosterHandles: readonly string[]): string[] {
  if (!slot || rosterHandles.length === 0) return [];
  const handleAlt = rosterHandles.map((h) => h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const mentionRe = new RegExp(`@(${handleAlt})\\b`, 'g');
  const inline: string[] = [];

  for (const line of slot.split('\n')) {
    // Strip leading markdown list/quote prefix to determine "line-start" position
    const afterPrefix = line.replace(/^(\s*(?:[-*+]|\d+\.|>)\s+)/, '');
    // Check each @ match in the line
    const matches = line.matchAll(mentionRe);
    for (const m of matches) {
      const idx = m.index ?? 0;
      // Calculate where the line content starts (after prefix if any)
      const prefixLen = line.length - afterPrefix.length;
      // Line-start if @ is at position 0 of afterPrefix content
      const isLineStart = idx === prefixLen;
      if (!isLineStart) {
        inline.push(m[1]);
      }
    }
  }

  return inline;
}

/**
 * Main validator. Returns:
 *  - { kind: 'ok' } if legitimate exit present OR no slot inline mention
 *  - { kind: 'invalid_route_syntax', inlineMentions, slot } otherwise
 */
export function validateRoutingSyntax(input: ValidationInput): ValidationResult {
  // Legitimate exit 1: line-start @mention
  if (input.lineStartMentions.length > 0) return { kind: 'ok' };
  // Legitimate exit 2: hold_ball tool call
  if (input.toolNames.some((n) => n.includes('cat_cafe_hold_ball'))) return { kind: 'ok' };
  // Legitimate exit 3: MCP structured routing
  if (input.structuredTargetCats.length > 0) return { kind: 'ok' };

  // No legitimate exit — check if slot has inline @handle
  const slot = finalRoutingSlot(input.text);
  const inlineMentions = findInlineMentionsInSlot(slot, input.rosterHandles);
  if (inlineMentions.length === 0) return { kind: 'ok' };

  return { kind: 'invalid_route_syntax', inlineMentions, slot };
}
```

Run: `node --test packages/api/test/routing/final-routing-slot.test.js`
Expected: 15 tests PASS

### Step 1.3: Commit Task 1

```bash
git add packages/api/src/domains/cats/services/agents/routing/final-routing-slot.ts \
         packages/api/test/routing/final-routing-slot.test.js
git commit -m "feat(F167-H): pure function final-routing-slot validator (AC-H1~H3/H5/H6)"
```

---

## Task 2: 接入 `route-serial.ts` — AC-H3 触发 + AC-H5 AC-C7 suppress

**Files:**
- Modify: `packages/api/src/domains/cats/services/agents/routing/route-serial.ts` (AC-C7 调用点附近，`line 874`)
- Modify: `packages/api/src/domains/cats/services/agents/routing/route-parallel.ts` (同一检测点)
- Test: `packages/api/test/routing/route-serial-phase-h.test.js`（新增最小集成测试）

### Step 2.1: Red test — route-serial 接入 Phase H

测试 stub route-serial 的 message append / broadcast，验证 AC-H3 命中时：
- 发 `invalid_route_syntax` system_info（source.connector = `routing-syntax-hint`）
- 同轮不再调 AC-C7 verdict warn hint

```js
// packages/api/test/routing/route-serial-phase-h.test.js
// ... stub deps, invoke serial-path, assert the hint is emitted
```

### Step 2.2: 修改 route-serial.ts 接入

在 `route-serial.ts:874` 的 `shouldWarnVerdictWithoutPass` 调用**之前**：

```ts
// F167 Phase H AC-H3/H5: final routing slot validator (suppresses AC-C7 on hit)
const phaseHResult = validateRoutingSyntax({
  text: storedContent,
  lineStartMentions: a2aMentions,
  toolNames: collectedToolNames,
  structuredTargetCats: [...structuredTargetCats],
  rosterHandles: rosterHandlesForSlot,  // 从 dependency 传入
});
let phaseHHit = false;
if (phaseHResult.kind === 'invalid_route_syntax') {
  phaseHHit = true;
  try {
    const hintSource = {
      connector: 'routing-syntax-hint',
      label: '路由语法提醒',
      icon: '⚠️',
      meta: { presentation: 'system_notice', noticeTone: 'warning' },
    };
    const inlineList = phaseHResult.inlineMentions.map((h) => `@${h}`).join(' ');
    const stored = await deps.messageStore.append({
      userId: 'system',
      catId: null,
      threadId,
      content:
        `检测到 ${inlineList} 写在行中，不会触发路由。若要传球，请把 @句柄 单独放在最后一行；` +
        '若只是叙述，请忽略此提醒。',
      mentions: [],
      timestamp: Date.now(),
      source: hintSource,
    });
    if (deps.socketManager) {
      deps.socketManager.broadcastToRoom(`thread:${threadId}`, 'connector_message', {
        threadId,
        message: {
          id: stored.id,
          type: 'connector',
          content: stored.content,
          source: hintSource,
          timestamp: stored.timestamp,
        },
      });
    }
  } catch {
    /* non-blocking hint */
  }
}

// AC-H5: suppress AC-C7 when Phase H hit
if (!phaseHHit && shouldWarnVerdictWithoutPass({ ... })) {
  // ... 既有 AC-C7 逻辑保持不变
}
```

`rosterHandlesForSlot` 从何来？查 `cat-config.json` 的猫句柄列表（既有 loader）。route-serial 需注入 dependency。

### Step 2.3: route-parallel.ts 同样接入

Parallel 路径（如有同构点）同样插入 validator。

### Step 2.4: Commit Task 2

```bash
git commit -m "feat(F167-H): wire final-routing-slot validator into route-serial/parallel (AC-H3/H5)"
```

---

## Task 3: System_info 兜底消息（AC-H4 Step A 部分）

AC-H4 的 Step A 版本 = "命中就发一次 system_info，不做 repair"。

Task 2 的 broadcast 就是这个 system_info。本 Task 对应砚砚 AC-H4 的"repair 失败只发一次 system_info"的弱版本：**当前实现跳过 repair，直接发 system_info 等价于"repair 已算失败"**。

测试：
- 同一输出重复跑 → 每次只发 1 条 system_info（幂等 guard 由 deduplication 外层保证；当前不做 dedup，每轮 invocation 最多 1 次）

Commit (已包含在 Task 2)。

---

## Task 4: 回归测试 + 集成测试

**Files:**
- Test: 确认 `test/a2a-mentions.test.js` / ping-pong 相关测试不受影响
- Test: `pnpm --filter @cat-cafe/api test` 全量绿

Run:
```bash
pnpm --filter @cat-cafe/api test 2>&1 | tail -30
```
Expected: all passed, 0 failed

---

## Task 5: 开 PR + 走 merge-gate

- 按 `request-review` skill 请砚砚 review
- 走 merge-gate 全流程

---

## Out of Scope（明确不做）

- **AC-H4 的 one-shot repair 主体**（Step B）：需要 re-invoke 同猫一次，复杂度高；Step A 先观察 system_info 是否已足够纠正下一轮。如果线上仍多轮复发再单独开 PR 做。
- **动作词 heuristic / 语义豁免表**：KD-24 明确禁止，不在范围内
- **segment metadata 贯穿链路**：AC-H1 明确"有则用，无则不猜"，不为 Phase H 新建 metadata pipeline
- **AC-H3 自动修正**：命中只提示，不修改原输出 / 不推断 handoff 目标
