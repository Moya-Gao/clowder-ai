---
feature_ids: [F032]
topics: [phase1, request]
doc_kind: mailbox
created: 2026-02-21
---

# Review 请求: F32-b Multi-Variant Model Configurability — Phase 1

## 背景

铲屎官想要线程级模型选择，以及"布偶猫军团"（同 provider 多实例）支持。F32-b Phase 1 是后端多实例基建：让 cat-config.json 的 variant 注册为独立猫，每猫独立 AgentService 实例。

## 设计文档

- **Plan**: `docs/plans/2026-02-21-f32-model-configurability.md`（砚砚 R4 已放行）
- **前置**: F32-a（`aa6ed6d`，PR #29）

## Spec Compliance 自检

| # | Spec 要求（Phase 1） | 状态 | 代码位置 | 测试 |
|---|---|---|---|---|
| Step 1 | CatVariant schema: `catId?`, `displayName?`, `mentionPatterns?` | ✅ | `shared/types/cat-breed.ts` + `cat-config-loader.ts` schema | `cat-config-loader.test.js` |
| Step 2 | `toAllCatConfigs()` — 每个 variant 独立猫 + catId 唯一性 | ✅ | `cat-config-loader.ts:137-170` | 8 tests |
| Step 3 | `parseMentions()` 最长匹配 + token 边界 + consumed interval | ✅ | `AgentRouter.ts:150-197` | 7 tests |
| Step 4 | AgentService 参数化 (catId + model) | ✅ | 三个 AgentService | existing tests |
| Step 5 | index.ts 一猫一实例 | ✅ | `index.ts:138-162` | — (integration) |
| Step 6 | getCatModel() 动态 env key | ✅ | `cat-models.ts:22-52` | 5 tests |
| Step 7 | isSessionChainEnabled variant→breed 索引 | ✅ | `cat-config-loader.ts:230-268` | 1 test |
| Step 8 | getDefaultCatId() 从 defaultVariantId 推导 | ✅ | `cat-config-loader.ts:281-297` | 2 tests |
| Step 9 | 全量测试通过 | ✅ | 1574 pass (+27 new) | — |

### 偏离说明

1. **AgentService constructor**: Spec 写 catId/model 为必填，实际实现为可选+默认值，保持向后兼容（tests、commands route 无参创建不受影响）

## 改动文件

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `shared/types/cat-breed.ts` | 修改 | CatVariant 新增 3 个可选字段 |
| `shared/types/cat.ts` | 修改 | CatConfig 新增 `breedId` |
| `api/config/cat-config-loader.ts` | 修改 | schema + `toAllCatConfigs()` + breed index + `getDefaultCatId()` |
| `api/config/cat-models.ts` | 重写 | 动态 env key + 简化 |
| `api/.../ClaudeAgentService.ts` | 修改 | catId + model 参数化 |
| `api/.../CodexAgentService.ts` | 修改 | 同上 |
| `api/.../GeminiAgentService.ts` | 修改 | 同上 |
| `api/.../AgentRouter.ts` | 修改 | parseMentions 重写 + getDefaultCatId |
| `api/src/index.ts` | 修改 | 一猫一 AgentService 实例 |
| `api/test/cat-config-loader.test.js` | 修改 | +27 F32-b tests |
| `api/test/claude-agent-service.test.js` | 修改 | 修正 default model 期望值 |
| `api/test/f32b-cat-models.test.js` | 新增 | getCatModel 动态 env key tests |
| `api/test/f32b-mention-parsing.test.js` | 新增 | 最长匹配 + token 边界 tests |

## Git SHA

- Base: `45919c0` (main HEAD)
- Head: `ad48f31`

## 测试状态

```
pnpm test: 1574 passed, 0 failed (1 redis isolation guard, pre-existing)
+27 new F32-b tests (config loader + mention parsing + cat-models)
```

## Review 重点

1. **`toAllCatConfigs()` catId 唯一性检查** — 是否足够早暴露配置错误
2. **`parseMentions()` 最长匹配算法** — 消费区间排除的正确性
3. **AgentService 向后兼容** — 可选参数+默认值 vs spec 要求的必填参数
4. **`getDefaultCatId()` 缓存** — 是否有 _resetCachedConfig 遗漏

## 五件套

**What**: F32-b Phase 1 后端多实例基建 — variant→独立猫 + AgentService 参数化 + mention 冲突防护

**Why**: 铲屎官需要线程级模型选择 + 布偶猫军团（同 provider 多实例）。F32-a 铺了动态注册基建，F32-b 在此基础上让配置中的每个 variant 成为独立可路由的猫。

**Tradeoff**: AgentService constructor 参数保持可选（向后兼容），而非 spec 中的必填。代价是创建时不传参会 fallback 到旧逻辑，但好处是不需要改 40+ 处测试代码。

**Open Questions**:
- routes 层的 `createCatId('opus')` 硬编码（error/system 消息）留到 Phase 2 清理
- `opusService` for commands route 仍用无参创建（task extraction 不是路由逻辑）

**Next Action**: 请砚砚 review 以上 13 个文件
