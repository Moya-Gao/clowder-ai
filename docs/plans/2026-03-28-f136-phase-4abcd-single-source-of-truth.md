---
feature_ids: [F136, F062, F127]
doc_kind: plan
created: 2026-03-28
---

# F136 Phase 4a–4d: 单一配置真相源 — Provider Profiles 收编

> **Decision**: 2026-03-28 铲屎官 + @opus + @codex 收敛
> **Spec**: `docs/features/F136-unified-config-hot-reload.md`

## 愿景

用户面对一份配置域（`cat-config`），运行时落盘 `.cat-cafe/cat-catalog.json`，
`cat-config.yaml.example` 只做模板不参与运行时。
凭证在一个全局钥匙串（`~/.cat-cafe/credentials.json`，accountRef 全局唯一）。
没有第二个配置真相源，没有"两边打架"的校验层。

**实施约束**：4a + 4b 在同一 worktree 连续实施、同一 PR 合入，避免半新半旧双轨（HC-5）。

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
// ~/.cat-cafe/credentials.json（对象结构钥匙串，零元信息，不进 git）
// HC-1: 必须是对象结构，支持 oauth token 的 TTL + refresh
{
  "claude": { "apiKey": "sk-ant-api-xxx" },
  "codex": { "apiKey": "sk-xxx" },
  "my-glm": { "apiKey": "glm-xxx" },
  "my-oauth": { "accessToken": "...", "refreshToken": "...", "expiresAt": 1234567890 }
}
```

**HC-2: 运行时唯一写源 = `cat-catalog.json`**
- `cat-config.yaml.example` 只做模板（进 git）
- 首次启动时 seed 数据写入 `.cat-cafe/cat-catalog.json`（含 accounts 区）
- Hub CRUD（猫 + 账户）统一写 `cat-catalog.json` → 发 ConfigChangeEvent
- 和 F127 现有模式一致，不引入 cat-config vs cat-catalog 新双源

## 现状问题（代码证据）

| 问题 | 证据文件 | 行为 |
|------|----------|------|
| 双真相源打架 | `config/provider-binding-compat.ts` | 运行时校验 cat-config 的 provider 与 profile 的 client 一致 |
| 凭证三入口 | `.env`, `provider-profiles.secrets.local.json`, `POST /api/config/secrets` | 用户不知道在哪配 API key |
| env 旁路 | `domains/cats/services/game/LlmAIProvider.ts` | 直读 `process.env.ANTHROPIC_API_KEY`，绕过 profile |
| 元信息重叠 | `provider-profiles.types.ts` vs `cat-breed.ts` | provider/model 信息在两处 |

## 实施步骤

### Phase 4a — 新 schema + 读写层 + 迁移器

**目标**：`cat-catalog.json` 支持 `accounts` 区（HC-2：唯一运行时写源）；旧 `provider-profiles.json` 一次性迁入。

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
   - 确保 `cat-config-loader.ts` 和 `cat-catalog-store.ts` 能读写 `accounts` 区
   - HC-2：accounts 写入 `cat-catalog.json`，`cat-config.yaml.example` 只做模板示例

2. **新建 `credentials.ts` 读写层**
   - 路径：`~/.cat-cafe/credentials.json`（全局，HC-5：accountRef 是全局唯一命名空间）
   - 格式（HC-1）：`Record<string, CredentialEntry>`
     ```typescript
     interface CredentialEntry {
       apiKey?: string
       accessToken?: string
       refreshToken?: string
       expiresAt?: number  // epoch ms
     }
     ```
   - 权限：0o600（同现有 secrets 文件）
   - 接口：`readCredentials()`, `writeCredential(ref, entry)`, `deleteCredential(ref)`, `hasCredential(ref)`

3. **迁移器 `migrateProviderProfilesToAccounts()`**
   - 读 `~/.cat-cafe/provider-profiles.json`（v3 格式）
   - 将每个 `ProviderProfileMeta` → `AccountConfig`，写入 cat-config.accounts
   - 将每个 secrets entry → `credentials.json`
   - 保留 `bootstrapBindings` 语义：client 默认账户 → 对应 accountRef
   - 迁移完成后写标记文件，防止重复迁移
   - **不删旧文件**（留一版本兼容窗口）
   - HC-3 迁移规则：
     - 触发：首次启动检测到旧 `provider-profiles.json` 或 `.env` 有 `*_API_KEY`
     - 导入成功后不自动清理 `.env`（打印迁移报告，用户手动确认后清理）
     - 版本门槛：N+1 = hard warning，N+2 = 删 fallback
     - 可验证：`pnpm check:legacy-credentials` 脚本检测旧路径残留

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

4. **测试 + HC-4 量化退出条件**
   - `grep -r 'process\.env\.\w*API_KEY\|process\.env\.\w*SECRET'` 业务链路零命中（test/mock 除外）
   - `pnpm check:legacy-credentials` 绿（检测旧路径残留）
   - 兼容导入测试全绿（旧格式 → 新格式端到端）
   - Provider 热更新回归通过（改 credentials → 猫 rebind 验证）
   - 全量 `pnpm gate` 通过

**AC**: `provider-profiles.json` 不再被任何代码读取；`provider-binding-compat.ts` 已删除；HC-4 全部量化条件满足。

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
