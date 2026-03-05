# F062 Ragdoll Provider Profile Hub Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use parallel-execution skill (Mode C) to implement this plan task-by-task.

**Goal:** 在 Cat Cafe Hub 内提供布偶猫账号 profile 管理（订阅/API key），并让调用链按 active profile 生效。

**Architecture:** 后端新增 provider profile 存储层（meta/secrets 分离）与 CRUD/activate/test API；调用链在 `invoke-single-cat` 注入 profile runtime env；`ClaudeAgentService` 负责把 profile env 映射到 CLI 子进程。前端新增 Hub tab 管理 profile 与切换/测试。

**Tech Stack:** Fastify + Zod + Node fs/promises + React/Next + Vitest + Node test

---

### Task 1: Provider Profile Store（meta/secrets 分层）

**Files:**
- Create: `packages/api/src/config/provider-profiles.ts`
- Test: `packages/api/test/provider-profiles-store.test.js`

**Step 1: Write failing tests**

- 读取空目录时自动提供默认 `subscription` profile
- 创建 `api_key` profile 后：
  - meta 文件不含明文 key
  - secrets 文件含 key
- 激活 profile 后 active 指针正确
- 删除 active profile 时自动回退默认 profile

**Step 2: Run tests to verify they fail**

Run:
```bash
pnpm --filter @cat-cafe/api test -- test/provider-profiles-store.test.js
```

**Step 3: Implement minimal store**

- `readProviderProfiles(projectRoot)`
- `createProviderProfile(...)`
- `updateProviderProfile(...)`
- `deleteProviderProfile(...)`
- `activateProviderProfile(...)`
- `resolveAnthropicRuntimeProfile(projectRoot)`

**Step 4: Run tests to green**

Run:
```bash
pnpm --filter @cat-cafe/api test -- test/provider-profiles-store.test.js
```

### Task 2: Provider Profile API Route（CRUD + activate + test）

**Files:**
- Create: `packages/api/src/routes/provider-profiles.ts`
- Modify: `packages/api/src/routes/index.ts`
- Modify: `packages/api/src/index.ts`
- Test: `packages/api/test/provider-profiles-route.test.js`

**Step 1: Write failing route tests**

- `GET /api/provider-profiles` 返回脱敏列表
- `POST` 创建 profile 成功
- `POST /:id/activate` 切换 active 成功
- `POST /:id/test` 对 `api_key` 走 Anthropic models 探测（mock fetch）
- 无 identity header 返回 401

**Step 2: Run tests to verify fail**

Run:
```bash
pnpm --filter @cat-cafe/api test -- test/provider-profiles-route.test.js
```

**Step 3: Implement route and register**

- query 支持 `projectPath`（沿用 `validateProjectPath`）
- body 使用 zod 校验
- 响应只返回 `hasApiKey`/掩码信息

**Step 4: Run tests to green**

Run:
```bash
pnpm --filter @cat-cafe/api test -- test/provider-profiles-route.test.js
```

### Task 3: Invocation Runtime 注入 profile env

**Files:**
- Modify: `packages/api/src/domains/cats/services/agents/invocation/invoke-single-cat.ts`
- Modify: `packages/api/src/domains/cats/services/agents/providers/ClaudeAgentService.ts`
- Test: `packages/api/test/claude-agent-service.test.js`

**Step 1: Write failing provider runtime tests**

- `CAT_CAFE_ANTHROPIC_PROFILE_MODE=api_key` 时，spawn env 包含 `ANTHROPIC_API_KEY/ANTHROPIC_BASE_URL`
- `subscription` 时，spawn env 显式清理 `ANTHROPIC_*`（防止继承污染）

**Step 2: Run tests to fail**

Run:
```bash
pnpm --filter @cat-cafe/api test -- test/claude-agent-service.test.js
```

**Step 3: Implement runtime wiring**

- `invoke-single-cat` 按 `workingDirectory` 解析项目 profile
- profile 信息写入 callback env（内部字段）
- `ClaudeAgentService` 映射/清理目标 env，再调用 `spawnCli`

**Step 4: Run targeted tests**

Run:
```bash
pnpm --filter @cat-cafe/api test -- test/provider-profiles-store.test.js test/provider-profiles-route.test.js test/claude-agent-service.test.js
```

### Task 4: Hub UI（配置中枢操作面板）

**Files:**
- Create: `packages/web/src/components/HubProviderProfilesTab.tsx`
- Modify: `packages/web/src/components/CatCafeHub.tsx`
- Test: `packages/web/src/components/__tests__/cat-cafe-hub-provider-profiles-tab.test.ts`

**Step 1: Write failing web test**

- Hub 出现“账号配置”tab
- tab 中能渲染 provider profile 列表（mock api）

**Step 2: Run test to fail**

Run:
```bash
pnpm --filter @cat-cafe/web test -- --run src/components/__tests__/cat-cafe-hub-provider-profiles-tab.test.ts
```

**Step 3: Implement UI**

- 列表：name/mode/baseUrl/hasApiKey/active
- 操作：新增、激活、测试、删除
- 错误反馈：tab 内联错误提示

**Step 4: Run tests**

Run:
```bash
pnpm --filter @cat-cafe/web test -- --run src/components/__tests__/cat-cafe-hub-provider-profiles-tab.test.ts src/components/__tests__/cat-cafe-hub-quota-tab.test.ts
```

### Task 5: Quality Check + Docs Sync

**Files:**
- Modify: `docs/features/F062-ragdoll-provider-profile-hub.md`

**Step 1: Run targeted checks**

```bash
pnpm --filter @cat-cafe/api test -- test/provider-profiles-store.test.js test/provider-profiles-route.test.js test/claude-agent-service.test.js
pnpm --filter @cat-cafe/web test -- --run src/components/__tests__/cat-cafe-hub-provider-profiles-tab.test.ts src/components/__tests__/cat-cafe-hub-quota-tab.test.ts
pnpm --filter @cat-cafe/api lint
pnpm --filter @cat-cafe/web lint
```

**Step 2: Update feature checklist status**

- AC 和需求点状态改为完成项

**Step 3: Prepare review packet**

- 变更摘要
- 风险与回滚点
- 测试命令与结果
