---
feature_ids: [F043]
topics: [mcp, feat-index, callbacks]
doc_kind: plan
created: 2026-03-02
---

# F043 Phase A: feat_index Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use parallel-execution skill (Mode C) to implement this plan task-by-task.

**Goal:** 交付 F043 P1 `feat_index`，让猫可以按 `featId`/`query` 查询 Feature→Thread 索引，补齐跨 thread 协作发现入口。

**Architecture:** 在 callback auth 体系上新增真实 HTTP endpoint `/api/callbacks/feat-index`，MCP 侧新增 `cat_cafe_feat_index` 直连该 endpoint。数据源采用分层真相源：`docs/features/*.md` frontmatter 为主，`docs/BACKLOG.md` 为补充；冲突时以 feature 文档为准。Phase A 的 `threadIds` 固定返回空数组 `[]`（等待 thread metadata 反查基建）。

**Tech Stack:** Fastify + Zod（API）、Node fs/yaml（文档解析）、MCP callback tools、Node test。

---

## 已拍板契约（@opus）

1. 真相源优先级
- Primary: `docs/features/*.md` frontmatter
- Secondary: `docs/BACKLOG.md`
- 冲突时：feature 文档覆盖 backlog 索引

2. 查询契约
- `featId`: 规范化后精确匹配（case-insensitive）
- `query`: 对 `featId + name + status` 做 case-insensitive substring 匹配

3. 返回字段边界
- `keyDecisions`: 若 frontmatter 存在则原样返回，否则 `undefined`
- `threadIds`: Phase A 固定 `[]`
- `limit`: 默认 20，最大 100

4. 命名与路径
- MCP tool: `cat_cafe_feat_index`
- HTTP endpoint: `/api/callbacks/feat-index`（真实 endpoint）
- `McpPromptInjector` 只列真实 HTTP endpoint

---

### Task 1: API route + parser（Red → Green）

**Files:**
- Modify: `packages/api/src/routes/callbacks.ts`
- Create: `packages/api/src/routes/feat-index-doc-import.ts`
- Test: `packages/api/test/callback-routes.test.js`

**Step 1: Write failing tests**
- 在 callback-routes 测试中新增：
  - `GET /api/callbacks/feat-index` 默认返回（limit=20）
  - `featId` 精确匹配（`f043` 命中 `F043`，`F04` 不命中）
  - `query` 模糊匹配（匹配 `featId/name/status`）
  - `limit` 上限校验（>100 返回 400）
  - callback auth 失败返回 401
- 构造最小 fixture（mock parser 返回结果），断言 response 结构含：`featId/name/status/threadIds/keyDecisions`。

**Step 2: Run tests to verify RED**
- Run: `node --test packages/api/test/callback-routes.test.js`
- Expected: FAIL（route 未实现）

**Step 3: Minimal implementation**
- `callbacks.ts`:
  - 新增 `featIndexQuerySchema`：`limit?`（1~100 default 20）、`featId?`、`query?`
  - 新增 `GET /api/callbacks/feat-index`
  - `registry.verify` 鉴权后读取 feat index 数据
- `feat-index-doc-import.ts`:
  - 读取 monorepo 下 `docs/features/*.md` + `docs/BACKLOG.md`
  - 解析 frontmatter 字段：`feature_ids`、`title/name`、`status`、`keyDecisions`
  - 统一生成 `FeatEntry[]`
  - 应用查询规则（featId exact + query substring）
  - 返回时固定 `threadIds: []`

**Step 4: Run tests to verify GREEN**
- Run: `node --test packages/api/test/callback-routes.test.js`
- Expected: PASS

**Step 5: Commit**
```bash
git add packages/api/src/routes/callbacks.ts \
  packages/api/src/routes/feat-index-doc-import.ts \
  packages/api/test/callback-routes.test.js
git commit -m "feat(F043): add feat-index callback endpoint"
```

---

### Task 2: MCP tool 注册与透传（Red → Green）

**Files:**
- Modify: `packages/mcp-server/src/tools/callback-tools.ts`
- Modify: `packages/mcp-server/src/index.ts`
- Test: `packages/mcp-server/test/callback-tools.test.js`
- Test: `packages/mcp-server/test/tool-registration.test.js`

**Step 1: Write failing tests**
- `tool-registration` 里期待 `cat_cafe_feat_index`
- `callback-tools` 里断言 handler 访问 `/api/callbacks/feat-index` 并透传 `limit/featId/query`

**Step 2: Run tests to verify RED**
- Run: `node --test packages/mcp-server/test/callback-tools.test.js packages/mcp-server/test/tool-registration.test.js`
- Expected: FAIL（tool 未注册）

**Step 3: Minimal implementation**
- 新增 schema：`featIndexInputSchema`
- 新增 handler：`handleFeatIndex`
- 注册 `cat_cafe_feat_index`

**Step 4: Run tests to verify GREEN**
- 同 Step 2

**Step 5: Commit**
```bash
git add packages/mcp-server/src/tools/callback-tools.ts \
  packages/mcp-server/src/index.ts \
  packages/mcp-server/test/callback-tools.test.js \
  packages/mcp-server/test/tool-registration.test.js
git commit -m "feat(F043): register cat_cafe_feat_index MCP tool"
```

---

### Task 3: Prompt + docs + spec 对齐（Red → Green）

**Files:**
- Modify: `packages/api/src/domains/cats/services/agents/invocation/McpPromptInjector.ts`
- Modify: `packages/api/test/mcp-prompt-injector.test.js`
- Modify: `cat-cafe-skills/refs/mcp-callbacks.md`
- Modify: `docs/features/F043-mcp-unification.md`

**Step 1: Write/adjust failing assertions**
- `mcp-prompt-injector.test.js` 断言新增 `feat-index`
- 继续保证 prompt `<700 chars`

**Step 2: Minimal implementation**
- `McpPromptInjector` HTTP 工具列表加入 `feat-index`
- `mcp-callbacks.md` 增加 `/api/callbacks/feat-index` 参数与示例
- F043 spec：
  - 增加 `feat_index` 契约落盘（featId exact / query fuzzy / threadIds []）
  - Timeline 记录 `list_threads` 已合入（PR #156 / `2d36c89f`）与本期 `feat_index` 进展

**Step 3: Run tests to verify GREEN**
- Run: `node --test packages/api/test/mcp-prompt-injector.test.js packages/api/test/system-prompt-builder.test.js`

**Step 4: Commit**
```bash
git add packages/api/src/domains/cats/services/agents/invocation/McpPromptInjector.ts \
  packages/api/test/mcp-prompt-injector.test.js \
  cat-cafe-skills/refs/mcp-callbacks.md \
  docs/features/F043-mcp-unification.md
git commit -m "docs(F043): align feat-index prompt/docs/spec"
```

---

## Full Verification Gate

1. `pnpm --filter @cat-cafe/api run build`
2. `pnpm --filter @cat-cafe/mcp-server run build`
3. `node --test packages/api/test/callback-routes.test.js`
4. `node --test packages/mcp-server/test/callback-tools.test.js packages/mcp-server/test/tool-registration.test.js`
5. `node --test packages/api/test/mcp-prompt-injector.test.js packages/api/test/system-prompt-builder.test.js`

---

## 风险与边界

- Phase A `threadIds: []` 是显式降级；不做 feature↔thread 反查猜测。
- 文档解析必须容错（frontmatter 缺失、字段不完整、大小写差异），不能因为单个 feature 文档异常导致整个 endpoint 500。
- 不引入全文索引与缓存层；先交付正确性，性能优化在 Phase B。
