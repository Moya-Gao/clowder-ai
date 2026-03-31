# F127 Structured Effort Editor Implementation Plan

**Feature:** F127 — [docs/features/F127-cat-instance-management.md](/Users/lysander/projects/relay-station/cat-cafe-f127-effort-editor/docs/features/F127-cat-instance-management.md)
**Goal:** 为 F127 补齐 provider-aware `cli.effort` 的完整编辑链路：Hub 结构化编辑、`/api/cats` 持久化到 runtime catalog、对新 invocation 生效，且不再依赖手写 raw `cliConfigArgs` 来设置 effort。
**Acceptance Criteria:**
- Claude 可选 `low / medium / high / max`
- Codex 可选 `low / medium / high / xhigh`
- Hub 使用结构化 effort 字段，不再靠手写 raw args 传 `model_reasoning_effort`
- 保存后写入 runtime catalog 的 `variant.cli.effort`
- 新 invocation 读取新值；旧 session 不做强制热切
- 非法 provider/effort 组合在 API 层被拒绝
**Architecture:** 以 `CatVariant.cli.effort` 作为唯一真相源。Hub 只按 provider 渲染合法选项并发送结构化字段；`/api/cats` 校验 + 持久化到 runtime catalog；CLI provider 读取 `getCatEffort()`，新 invocation 自动吃到更新值。
**Tech Stack:** React, TypeScript, Zod, Fastify, runtime cat catalog, Vitest + Node test runner
**前端验证:** Yes — 需要 Hub editor 测试覆盖 provider 切换、合法选项渲染、保存 payload

---

### Task 1: Define terminal schema for structured effort

**Files:**
- Modify: `packages/web/src/components/hub-cat-editor.model.ts`
- Modify: `packages/web/src/hooks/useCatData.ts`
- Modify: `packages/api/src/routes/cats.ts`
- Modify: `packages/api/src/config/runtime-cat-catalog.ts`

**Step 1: Write the failing tests**

- Web: `packages/web/src/components/__tests__/hub-cat-editor.test.tsx`
  - assert form state can round-trip `cliEffort`
  - assert payload includes `cli.effort`
- API: `packages/api/test/cats-routes-runtime-crud.test.js`
  - assert POST/PATCH accept valid effort and reject invalid provider/effort combinations

**Step 2: Run tests to verify they fail**

Run:
- `pnpm --filter @cat-cafe/web test -- --runInBand packages/web/src/components/__tests__/hub-cat-editor.test.tsx`
- `pnpm --filter @cat-cafe/api test packages/api/test/cats-routes-runtime-crud.test.js`

Expected:
- web test fails because `cliEffort` field/payload does not exist
- api test fails because `cli.effort` is not accepted in `/api/cats`

**Step 3: Write minimal implementation**

- Add form state field for `cliEffort`
- Add `CatData.cli.effort` support
- Extend create/update schemas to accept `cli.effort`
- Extend runtime cat input/update to persist `variant.cli.effort`

**Step 4: Run tests to verify they pass**

- Re-run the two targeted suites

### Task 2: Replace raw effort editing with provider-aware Hub controls

**Files:**
- Modify: `packages/web/src/components/hub-cat-editor-advanced.tsx`
- Modify: `packages/web/src/components/hub-cat-editor.payload.ts`
- Modify: `packages/web/src/components/__tests__/hub-cat-editor.test.tsx`

**Step 1: Write the failing UI tests**

- assert Claude editor shows `low/medium/high/max`
- assert Codex editor shows `low/medium/high/xhigh`
- assert OpenCode does not show the effort select
- assert saving Codex no longer needs raw `cliConfigArgs` for effort

**Step 2: Run tests to verify they fail**

Run:
- `pnpm --filter @cat-cafe/web test -- --runInBand packages/web/src/components/__tests__/hub-cat-editor.test.tsx`

Expected:
- missing select / payload assertions fail

**Step 3: Write minimal implementation**

- Add provider-aware option tables
- Render structured `SelectField` only for anthropic/openai
- Keep `cliConfigArgs` editor for non-effort raw args, but remove effort guidance from placeholder/help text
- Build payload so `cli.effort` is sent only when present

**Step 4: Run tests to verify they pass**

- Re-run the same web suite

### Task 3: Lock runtime behavior and invalid-combination guards

**Files:**
- Modify: `packages/api/src/config/cat-config-loader.ts`
- Modify: `packages/api/src/routes/cats.ts`
- Modify: `packages/api/test/cats-routes-runtime-crud.test.js`
- Create or modify: `packages/api/test/config/cat-config-effort.test.js`

**Step 1: Write the failing backend tests**

- valid defaults remain provider-aware when `cli.effort` absent
- explicit persisted effort wins when legal
- `openai + max` rejected
- `anthropic + xhigh` rejected
- unknown/empty config fallback never leaks illegal effort to Codex path

**Step 2: Run tests to verify they fail**

Run:
- `pnpm --filter @cat-cafe/api test packages/api/test/cats-routes-runtime-crud.test.js`
- `pnpm --filter @cat-cafe/api test packages/api/test/config/cat-config-effort.test.js`

**Step 3: Write minimal implementation**

- centralize valid effort matrix for anthropic/openai
- validate requested effort in route layer before persistence
- harden `getCatEffort()` fallback so Codex never receives `max`

**Step 4: Run tests to verify they pass**

- Re-run both backend suites

### Task 4: Track the gap in F127 and open the upstream issue

**Files:**
- Modify: `docs/features/F127-cat-instance-management.md`

**Step 1: Add the residual + tracking link**

- add a new residual entry for structured provider-aware effort editing
- note F136 as dependency only

**Step 2: Open community issue in `zts212653/clowder-ai`**

- issue title should call out F127 residual and structured effort editor
- body should include scope, legal option matrix, and non-goals

**Step 3: Verify traceability**

- F127 spec references the issue
- issue body references F127 as source feature

### Task 5: Final verification

**Files:**
- No new files expected

**Step 1: Run targeted suites**

- `pnpm --filter @cat-cafe/web test -- --runInBand packages/web/src/components/__tests__/hub-cat-editor.test.tsx`
- `pnpm --filter @cat-cafe/api test packages/api/test/cats-routes-runtime-crud.test.js`
- `pnpm --filter @cat-cafe/api test packages/api/test/config/cat-config-effort.test.js`

**Step 2: Run one integration spot-check**

- verify `GET /api/cats` returns persisted `cli.effort`
- verify new invocation path still derives provider-specific CLI flag from `getCatEffort()`

**Step 3: Prepare handoff**

- summarize changed files
- call out residual risks
- request review from `@opus`
