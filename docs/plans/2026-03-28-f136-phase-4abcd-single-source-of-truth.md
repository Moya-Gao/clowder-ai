---
feature_ids: [F136, F062, F127]
doc_kind: plan
created: 2026-03-28
---

# F136 Phase 4a–4d: 单一配置真相源 — Provider Profiles 收编

> **Decision**: 2026-03-28 铲屎官 + @opus + @codex 收敛
> **Spec**: `docs/features/F136-unified-config-hot-reload.md`

## 愿景

用户在一个地方配置所有猫的 provider/model/账户信息（`cat-config.yaml`），
凭证在一个钥匙串（`~/.cat-cafe/credentials.json`）。
没有第二个配置真相源，没有"两边打架"的校验层。

## 终态结构

```yaml
# cat-config.yaml（唯一配置真相源 — .example 进 git，实际文件不进 git）
accounts:
  claude:
    authType: oauth
    protocol: anthropic
    models: [claude-opus-4-6, claude-sonnet-4-6, claude-haiku-4-5]
  codex:
    authType: oauth
    protocol: openai
    models: [gpt-5.4, gpt-5.3-codex]
  my-glm:
    authType: api_key
    protocol: openai
    baseUrl: https://open.bigmodel.cn/api/paas/v4
    models: [glm-5]

cats:
  opus:
    provider: anthropic
    defaultModel: claude-opus-4-6
    accountRef: claude
    # ... personality, strengths, etc.
  codex:
    provider: openai
    defaultModel: gpt-5.3-codex
    accountRef: codex
```

```json
// ~/.cat-cafe/credentials.json（纯钥匙串，零元信息，不进 git）
{
  "claude": "sk-ant-api-xxx",
  "codex": "sk-xxx",
  "my-glm": "glm-xxx"
}
```

## 现状问题（代码证据）

| 问题 | 证据文件 | 行为 |
|------|----------|------|
| 双真相源打架 | `config/provider-binding-compat.ts` | 运行时校验 cat-config 的 provider 与 profile 的 client 一致 |
| 凭证三入口 | `.env`, `provider-profiles.secrets.local.json`, `POST /api/config/secrets` | 用户不知道在哪配 API key |
| env 旁路 | `domains/cats/services/game/LlmAIProvider.ts` | 直读 `process.env.ANTHROPIC_API_KEY`，绕过 profile |
| 元信息重叠 | `provider-profiles.types.ts` vs `cat-breed.ts` | provider/model 信息在两处 |

## 实施步骤

### Phase 4a — 新 schema + 读写层 + 迁移器

**目标**：`cat-config.yaml` 支持 `accounts` 区；旧 `provider-profiles.json` 一次性迁入。

**Tasks**:

1. **扩展 cat-config schema**
   - 在 `packages/shared/src/types/cat-breed.ts` 新增 `AccountConfig` 接口：
     ```typescript
     interface AccountConfig {
       authType: 'oauth' | 'api_key'
       protocol: 'anthropic' | 'openai' | 'google'
       baseUrl?: string
       models?: string[]
       displayName?: string
     }
     ```
   - 在 `CatCafeConfig`（或顶层 config 类型）加 `accounts: Record<string, AccountConfig>`
   - 确保 `cat-config-loader.ts` 能读写 `accounts` 区

2. **新建 `credentials.ts` 读写层**
   - 路径：`~/.cat-cafe/credentials.json`（复用 `provider-profiles-root.ts` 的全局目录解析）
   - 格式：`Record<string, string>`（accountRef → apiKey）
   - 权限：0o600（同现有 secrets 文件）
   - 接口：`readCredentials()`, `writeCredential(ref, key)`, `deleteCredential(ref)`, `hasCredential(ref)`

3. **迁移器 `migrateProviderProfilesToAccounts()`**
   - 读 `~/.cat-cafe/provider-profiles.json`（v3 格式）
   - 将每个 `ProviderProfileMeta` → `AccountConfig`，写入 cat-config.accounts
   - 将每个 secrets entry → `credentials.json`
   - 保留 `bootstrapBindings` 语义：client 默认账户 → 对应 accountRef
   - 迁移完成后写标记文件，防止重复迁移
   - **不删旧文件**（留一版本兼容窗口）

4. **测试**
   - 迁移器：旧格式 → 新格式的端到端测试
   - credentials 读写：权限、原子写入、并发安全
   - cat-config-loader：accounts 区的 schema 校验

**AC**: `cat-config.yaml` 有 `accounts` 区，`credentials.json` 可读写，迁移器能转换现有数据。

---

### Phase 4b — 统一运行时读取

**目标**：所有调用链走 `cat-config.accounts + credentials.json`，禁止新代码直读 `*_API_KEY`。

**Tasks**:

1. **改写 `resolveRuntimeProviderProfile` 链**
   - 当前：`cat-account-binding.ts` → `provider-profiles.ts`（读全局 JSON）
   - 终态：`cat-account-binding.ts` → `cat-config.accounts` + `credentials.ts`
   - 关键函数：`resolveRuntimeProviderProfileForClient()`, `resolveRuntimeProviderProfileById()`
   - 保持 `RuntimeProviderProfile` 输出接口不变（对调用方透明）

2. **修复 env 旁路**
   - `LlmAIProvider.ts`：改为走 `cat-config.accounts + credentials`
   - grep `process.env.*API_KEY` / `process.env.*SECRET`，逐一改为走新链路
   - `.env` 的 `*_API_KEY` 降级为 legacy fallback（credentials.json 无值时读 env）

3. **更新 `invoke-single-cat.ts` 的 callbackEnv 注入**
   - 数据来源从 `provider-profiles.ts` 切到 `credentials.ts`
   - `effectiveProtocol` 从 `cat-config.accounts[ref].protocol` 读取

4. **更新 API 路由 `routes/provider-profiles.ts`**
   - GET：从 `cat-config.accounts` + `credentials.json` 读取
   - POST/PATCH/DELETE：写入 `cat-config.accounts` + `credentials.json`
   - 发射 ConfigChangeEvent（`source: 'accounts'`）

5. **更新 Hub UI**
   - `HubProviderProfilesTab.tsx` + 相关组件：适配新 API 响应格式
   - Hub Env 面板：对 `*_API_KEY` 显示 deprecated 提示

6. **测试**
   - invoke-single-cat 端到端：确保 API key 正确注入
   - LlmAIProvider：用新链路，env fallback 验证
   - API 路由：CRUD 操作走新存储

**AC**: 所有 LLM 调用链走 `cat-config.accounts + credentials.json`，无代码直读 provider-profiles.json。

---

### Phase 4c — Provider 热更新

**目标**：账户配置改了（credentials / account 元信息），即时生效，不用重启。

**Tasks**:

1. **新建 `AccountBindingSubscriber`**
   - 监听 `source: 'accounts'` 的 ConfigChangeEvent
   - 按 `changedKeys`（accountRef）精准 rebind 受影响的猫
   - 照 CatCatalogSubscriber 模式：返回 Promise，serialized chain

2. **在 index.ts 注册 subscriber**
   - `syncAgentRegistry` 之后注册
   - shutdown 时 unsubscribe

3. **测试**
   - subscriber 单测：事件触发 → rebind
   - P1 覆盖：await 语义 + 并发序列化

**AC**: Hub 改了账户配置或 API key，不用重启 API 即生效。

---

### Phase 4d — 下线旧层

**目标**：删除旧 provider-profiles 基础设施。

**Tasks**:

1. **删除文件**
   - `config/provider-profiles.ts`（旧 store）
   - `config/provider-profiles.types.ts`（旧类型）
   - `config/provider-binding-compat.ts`（双源校验层）
   - `config/provider-profiles-root.ts`（旧路径解析 — credentials.ts 已替代）

2. **清理引用**
   - grep 所有 `provider-profiles` import，确认已切到新链路
   - 删除 `bootstrapBindings` 概念（已被 cat-config.accounts 替代）

3. **Legacy env 导入提示**
   - 启动时检测 `.env` 有 `ANTHROPIC_API_KEY` 等 → 打印一次性导入提示
   - 提供 `pnpm migrate:credentials` 脚本：读 `.env` → 写 `credentials.json`
   - 一版本后可选删除 fallback

4. **测试**
   - 确认 `provider-binding-compat.ts` 相关测试已迁移或删除
   - 全量 `pnpm gate` 通过

**AC**: `provider-profiles.json` 不再被任何代码读取；`provider-binding-compat.ts` 已删除。

## 风险

| 风险 | 缓解 |
|------|------|
| 迁移丢数据 | 迁移器写标记不删旧文件；提供回滚脚本 |
| 多项目共享账户 | `credentials.json` 仍在全局 `~/.cat-cafe/`，多项目共享 |
| Hub UI 大改 | 4b 阶段保持 API 接口兼容，前端渐进适配 |
| env fallback 链路遗漏 | 4d 前全量 grep `process.env.*API_KEY` 确认清零 |

## 验收场景

铲屎官验收：**在 Hub 里给 Claude Code 配一个 GLM-5**

1. 在 `cat-config.yaml` 的 `accounts` 区加 `my-glm`（protocol: openai, baseUrl: ...）
2. 在 `~/.cat-cafe/credentials.json` 加 API key
3. 给某只猫 `accountRef: my-glm`
4. 不重启，立即生效

只改一个配置文件 + 一个钥匙串，没有第二个地方要同步。
