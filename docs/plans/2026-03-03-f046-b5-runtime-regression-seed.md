---
feature_ids: [F046]
topics: [anti-drift, regression, tests]
doc_kind: plan
created: 2026-03-03
---

# F046 B5 Runtime Regression Seed Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use parallel-execution skill (Mode C) to implement this plan task-by-task.

**Goal:** 建立 F046 B5 的第一批运行时守护回归（3 条核心对话场景），把“回归验证能力”从 0 提升到 1。

**Architecture:** 不改路由主逻辑，先新增一组“跨猫对话场景”回归测试，聚焦已经上线且高风险的行为（A2A handoff、debug/play 隔离、review 无效标记传递）。同时更新 F046 spec，记录 B5 seed 已落地但未达到 ≥10 条门槛。

**Tech Stack:** Node.js test runner, Fastify/API routing test helpers, TypeScript build pipeline.

---

### Task 1: 新增 F046 B5 场景回归测试文件（3 场景）

**Files:**
- Create: `packages/api/test/f046-b5-runtime-regression-seed.test.js`
- Reference: `packages/api/test/route-strategies.test.js`
- Reference: `packages/api/test/route-serial-review-identity-propagation.test.js`

**Step 1: 写 3 条场景测试（先红）**

场景清单：
1. `debug` 模式下，A2A 下游猫能看到上游文本上下文；
2. `play` 模式下，A2A 下游猫看不到上游文本上下文（思考隔离）；
3. 同族 review identity check 失败时，`⚠️ Review 无效` 标记会传递给下游猫（debug 链路可见）。

**Step 2: 运行测试确认失败原因可解释**

Run:
```bash
pnpm --filter @cat-cafe/api run build
node --test packages/api/test/f046-b5-runtime-regression-seed.test.js
```

Expected:
- 首轮应至少有 1 条失败（缺 helper / 断言不满足）；
- 失败是行为断言失败，不是 import/路径错误。

**Step 3: 最小实现修复到绿**

仅修复测试辅助函数/夹具，不改业务行为（除非测试暴露真实回归）。

**Step 4: 复跑测试确认全绿**

Run:
```bash
node --test packages/api/test/f046-b5-runtime-regression-seed.test.js
```

Expected: PASS（3/3）

**Step 5: 回归防线**

Run:
```bash
node --test packages/api/test/route-strategies.test.js packages/api/test/route-serial-review-identity-propagation.test.js
```

Expected: PASS，确保未破坏既有场景。

---

### Task 2: 更新 F046 spec 的 B5 进度记录（不提前勾满 AC）

**Files:**
- Modify: `docs/features/F046-anti-drift-protocol.md`

**Step 1: 补 Timeline**

新增一条 timeline：
- “B5 seed：3 条运行时对话场景回归已落地（列出测试文件）”

**Step 2: 补 Test Evidence**

在 Test Evidence 增加 B5 seed 的命令与通过结果记录。

**Step 3: AC 保持真实状态**

- `≥10 条对话场景回归测试就位（B5）` 继续保持未勾选；
- 增加注记“seed 3 条已落地，持续扩到 10 条”。

---

### Task 3: 本轮门禁与提交

**Files:**
- Modify/Create from Task 1/2 only

**Step 1: 最小门禁**

Run:
```bash
pnpm --filter @cat-cafe/api run build
node --test \
  packages/api/test/f046-b5-runtime-regression-seed.test.js \
  packages/api/test/route-strategies.test.js \
  packages/api/test/route-serial-review-identity-propagation.test.js
```

**Step 2: 提交**

```bash
git add packages/api/test/f046-b5-runtime-regression-seed.test.js docs/features/F046-anti-drift-protocol.md
git commit -m "test(f046): seed B5 runtime dialogue regression scenarios"
```

**Step 3: 请求 code review**

新行 `@gpt52` + commit/PR 链接 + 1-3 review 重点（仅一次请求，避免重复噪音）。

