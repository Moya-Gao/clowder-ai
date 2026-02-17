# Hindsight Config Control Plane Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将长期记忆（Hindsight）从“代码内隐式默认值”升级为“可见、可调、可审计”的配置控制面，支撑三猫与铲屎官协同调优决策。  

**Architecture:** 以 `ConfigRegistry + ConfigStore` 为单一运行时配置入口，新增 Hindsight 参数 schema 与校验层；API 路由读取统一配置对象，Web 配置查看器展示并热更新可安全调整项。Codex 执行模型与 retain/reflect profile 配置显式化，消除“显示值 vs 实际执行值”漂移风险。  

**Tech Stack:** Fastify, TypeScript, Zod, Node test runner, React + Next.js, existing `/api/config` hot-reload flow.

## Scope And Non-Goals

- In Scope:
  - Hindsight recall/retain/reflect 关键参数可视化与可配置
  - Codex 执行模型显式配置并落地到 CLI 实参
  - `/api/config` 提供长期记忆完整快照与热更新入口
  - 最小可用 UI（系统配置里可见、可改、可回滚）
  - 审计记录（谁改了什么、何时改）
- Out of Scope:
  - 多 bank 架构切换（继续保持 `cat-cafe-shared`）
  - 新增独立 Hindsight 管理后台
  - 引入复杂策略引擎（本期先做可配参数，不做自动策略）

## Task 1: Define Runtime Hindsight Config Schema

**Files:**
- Create: `packages/api/src/config/hindsight-runtime-config.ts`
- Modify: `packages/api/src/config/ConfigRegistry.ts`
- Test: `packages/api/test/config-registry.test.js`

**Step 1: Write failing tests for new config snapshot shape**

- 在 `config-registry.test.js` 增加断言，期望 `snapshot.hindsight` 包含：
  - `recallDefaults.budget/tagsMatch/limit`
  - `retainProfile.narrativeFactRequired/minUsefulHorizonDays`
  - `reflectProfile.dispositionMode`
  - `modelProfiles.retain/reflect`（字符串模型名）

**Step 2: Run tests to verify RED**

Run:
```bash
pnpm --filter @cat-cafe/shared run build
pnpm --filter @cat-cafe/api run build
cd packages/api && node --test test/config-registry.test.js
```

Expected: 新断言失败（字段不存在或值不匹配）。

**Step 3: Implement minimal schema + parser**

- 新建 `hindsight-runtime-config.ts`，集中处理：
  - 默认值
  - env 覆盖（仅白名单键）
  - 枚举值归一化（budget/tagsMatch/dispositionMode）
- `ConfigRegistry` 改为调用该 parser，替换内联硬编码。

**Step 4: Re-run tests to verify GREEN**

Run:
```bash
pnpm --filter @cat-cafe/shared run build
pnpm --filter @cat-cafe/api run build
cd packages/api && node --test test/config-registry.test.js
```

Expected: PASS。

**Step 5: Commit**

```bash
git add packages/api/src/config/hindsight-runtime-config.ts packages/api/src/config/ConfigRegistry.ts packages/api/test/config-registry.test.js
git commit -m "feat(config): centralize hindsight runtime schema [缅因猫🐾]" -m "Why: 长期记忆参数需从硬编码升级为统一配置源，避免调优和观测分裂。"
```

## Task 2: Make Hindsight Keys Hot-Updatable Safely

**Files:**
- Modify: `packages/api/src/config/ConfigStore.ts`
- Modify: `packages/api/src/routes/config.ts`
- Test: `packages/api/test/config-hotreload.test.js`

**Step 1: Write failing tests for hot-update allowlist**

- 增加测试覆盖以下键可热更新：
  - `hindsight.recallDefaults.budget`
  - `hindsight.recallDefaults.tagsMatch`
  - `hindsight.recallDefaults.limit`
  - `hindsight.reflectProfile.dispositionMode`
  - `hindsight.modelProfiles.retain`
  - `hindsight.modelProfiles.reflect`

**Step 2: Run tests to verify RED**

Run:
```bash
pnpm --filter @cat-cafe/shared run build
pnpm --filter @cat-cafe/api run build
cd packages/api && node --test test/config-hotreload.test.js
```

Expected: FAIL（当前 key 不在 allowlist）。

**Step 3: Implement allowlist + validation**

- 在 `ConfigStore.ts` 扩展 `UPDATABLE_KEYS`。
- 对枚举和数值范围加最小校验（例如 `limit` 1..20）。
- `config.ts` 保留统一 PATCH 接口，拒绝非法值并返回 400。

**Step 4: Re-run tests to verify GREEN**

Run same command as Step 2.

Expected: PASS。

**Step 5: Commit**

```bash
git add packages/api/src/config/ConfigStore.ts packages/api/src/routes/config.ts packages/api/test/config-hotreload.test.js
git commit -m "feat(config): enable hot-update for hindsight controls [缅因猫🐾]" -m "Why: 需要在线调优长期记忆参数并可快速回滚。"
```

## Task 3: Wire Routes To Runtime Hindsight Config

**Files:**
- Modify: `packages/api/src/routes/evidence.ts`
- Modify: `packages/api/src/routes/reflect.ts`
- Modify: `packages/api/src/routes/callback-memory-routes.ts`
- Modify: `packages/api/src/index.ts`
- Test: `packages/api/test/evidence-route.test.js`
- Test: `packages/api/test/reflect-route.test.js`
- Test: `packages/api/test/callback-routes.test.js`

**Step 1: Write failing tests for route-level config usage**

- 断言 route 不再硬编码默认值，而是读取 runtime config：
  - recall 默认 budget/tagsMatch/limit 可被覆盖
  - reflect disposition mode 通过 config 暴露给 response metadata（或日志）
  - callback-memory routes 使用同一组 recall 默认值

**Step 2: Run tests to verify RED**

Run:
```bash
pnpm --filter @cat-cafe/shared run build
pnpm --filter @cat-cafe/api run build
cd packages/api && node --test test/evidence-route.test.js test/reflect-route.test.js test/callback-routes.test.js
```

Expected: FAIL（仍是硬编码行为）。

**Step 3: Implement runtime config injection**

- 在 `index.ts` 构建单例 config accessor（按请求读取最新值）。
- route options 添加 `hindsightRuntimeConfig` 依赖。
- 删除 route 层重复默认值，统一由 config 解析器提供。

**Step 4: Re-run tests to verify GREEN**

Run same command as Step 2.

Expected: PASS。

**Step 5: Commit**

```bash
git add packages/api/src/routes/evidence.ts packages/api/src/routes/reflect.ts packages/api/src/routes/callback-memory-routes.ts packages/api/src/index.ts packages/api/test/evidence-route.test.js packages/api/test/reflect-route.test.js packages/api/test/callback-routes.test.js
git commit -m "refactor(api): route memory behavior from runtime config [缅因猫🐾]" -m "Why: recall/reflect/retain 参数必须统一受控，避免多处默认值漂移。"
```

## Task 4: Make Codex Execution Model Explicit

**Files:**
- Modify: `packages/api/src/domains/cats/services/CodexAgentService.ts`
- Modify: `packages/api/src/config/cat-models.ts` (if needed for normalization)
- Test: `packages/api/test/codex-agent-service.test.js`

**Step 1: Write failing tests for explicit model args**

- 断言 `codex exec` 参数包含 `--model <resolved-model>`。
- 断言 `CAT_CODEX_MODEL` 覆盖后，CLI 实参同步变化。
- 保留 OAuth env 删除语义测试不回归。

**Step 2: Run tests to verify RED**

Run:
```bash
pnpm --filter @cat-cafe/shared run build
pnpm --filter @cat-cafe/api run build
cd packages/api && node --test test/codex-agent-service.test.js
```

Expected: FAIL（当前 args 不含 `--model`）。

**Step 3: Implement explicit model arg pass-through**

- 在 `CodexAgentService` 创建/恢复命令路径中增加模型参数（确保 resume/new session 行为一致）。
- 保持 sandbox/approval/auth 逻辑不变。

**Step 4: Re-run tests to verify GREEN**

Run same command as Step 2.

Expected: PASS。

**Step 5: Commit**

```bash
git add packages/api/src/domains/cats/services/CodexAgentService.ts packages/api/test/codex-agent-service.test.js
git commit -m "fix(codex): pass explicit model to cli invocation [缅因猫🐾]" -m "Why: 消除配置展示模型与CLI实际执行模型可能不一致的风险。"
```

## Task 5: Surface Long-Term Memory Controls In Web Config Viewer

**Files:**
- Modify: `packages/web/src/components/config-viewer-tabs.tsx`
- Modify: `packages/web/src/components/__tests__/cat-config-viewer.test.ts`
- Optional Modify: `packages/web/src/hooks/useChatCommands.ts`

**Step 1: Write failing UI tests**

- 断言系统配置页显示新的长期记忆区块：
  - recallDefaults
  - retainProfile
  - reflectProfile
  - modelProfiles
- 断言显示当前值和字段说明（避免“看不懂怎么调”）。

**Step 2: Run tests to verify RED**

Run:
```bash
pnpm --filter @cat-cafe/web run test -- src/components/__tests__/cat-config-viewer.test.ts
```

Expected: FAIL（字段未渲染）。

**Step 3: Implement minimal UI**

- 在“系统配置”中新增“长期记忆配置”卡片。
- 先做只读 + 当前值可见；编辑入口可复用现有 PATCH 机制。
- 可选：增加“推荐值”提示（来自 Phase 5.1 文档）。

**Step 4: Re-run tests to verify GREEN**

Run same command as Step 2.

Expected: PASS。

**Step 5: Commit**

```bash
git add packages/web/src/components/config-viewer-tabs.tsx packages/web/src/components/__tests__/cat-config-viewer.test.ts
git commit -m "feat(web): expose long-term memory controls in config viewer [缅因猫🐾]" -m "Why: 参数可见性是协同调优前提，减少口头决策与配置黑箱。"
```

## Task 6: Add Change Audit + Ops Docs

**Files:**
- Modify: `packages/api/src/routes/config.ts`
- Modify: `packages/api/src/domains/cats/services/EventAuditLog.ts` (if needed)
- Create: `docs/operations/hindsight-config-tuning-playbook.md`
- Modify: `docs/phases/phase-5.1-memory-operation-profiles.md`
- Modify: `docs/BACKLOG.md` (only if deferred items remain)

**Step 1: Write failing test for config change auditing**

- 断言 PATCH `hindsight.*` 成功后产生审计事件（key、old/new、operator、timestamp）。

**Step 2: Run tests to verify RED**

Run:
```bash
pnpm --filter @cat-cafe/shared run build
pnpm --filter @cat-cafe/api run build
cd packages/api && node --test test/audit-routes.test.js test/config-hotreload.test.js
```

Expected: FAIL（无事件或字段不全）。

**Step 3: Implement audit + docs**

- PATCH 成功后写入审计日志。
- 新增操作手册，定义：
  - 何时调 recall/retain/reflect
  - 调参前后观察指标
  - 回滚路径
  - 风险边界（例如 budget 放大导致延迟上升）

**Step 4: Re-run tests to verify GREEN**

Run same command as Step 2.

Expected: PASS。

**Step 5: Commit**

```bash
git add packages/api/src/routes/config.ts packages/api/src/domains/cats/services/EventAuditLog.ts docs/operations/hindsight-config-tuning-playbook.md docs/phases/phase-5.1-memory-operation-profiles.md packages/api/test/audit-routes.test.js packages/api/test/config-hotreload.test.js
git commit -m "feat(governance): audit and playbook for hindsight tuning [缅因猫🐾]" -m "Why: 参数调优必须可追踪、可回滚、可复盘。"
```

## Integration Verification (Final Gate)

Run:
```bash
pnpm --filter @cat-cafe/shared run build
pnpm --filter @cat-cafe/api run build
pnpm --filter @cat-cafe/mcp-server run build
pnpm --filter @cat-cafe/web run build
cd packages/api && node --test test/config-registry.test.js test/config-hotreload.test.js test/hindsight-client.test.js test/evidence-route.test.js test/reflect-route.test.js test/callback-routes.test.js test/codex-agent-service.test.js
```

Manual checks:
- `GET /api/config` 能看到完整 `hindsight` 参数集合。
- PATCH 一个 `hindsight.*` 键，立即生效且有审计记录。
- 触发一次 `cat_cafe_reflect_callback` / `cat_cafe_retain_memory_callback`，确认行为按新配置执行。

## Decision Notes (For Cross-Cat Collaboration)

**What:** 做“长期记忆配置控制面”，不只显示配置，还要支持安全热更新与审计。  
**Why:** 现在调优主要靠文档和口头同步，缺乏可见性与可验证性；会影响三猫共同决策效率。  
**Tradeoff:** 增加配置复杂度与验证成本，但换来可观测、可回滚、可复盘的治理能力。  
**Open Questions:**  
- retain/reflect 的模型 profile 是走 Cat Cafe 侧配置，还是完全交给 Hindsight 服务配置？  
- 首版是否允许在线改模型名，还是先只读展示 + 灰度开放？  
- 是否需要按线程/项目覆盖（当前建议先全局）。  
**Next Action:** 先执行 Task 1-2 做“可见 + 可改 + 可校验”闭环，再决定是否推进 Task 4（Codex 显式模型）与 Task 5（UI 可编辑）。

