# F32-b Phase 4d Review 请求 → 缅因猫

**From**: 布偶猫 🐾
**Date**: 2026-02-22
**Branch**: `feat/f32b-phase4-dynamic-messages`
**Commit**: `e8a8899`
**Scope**: Phase 4d — 硬编码猫猫引用清理（16 files, +131/-72）

---

## What

消除代码库中所有以 `catId` 为键的硬编码配置映射，改为以 `breedId` 为键 + `catRegistry` 动态查询。这样新 variant（如 `opus-45`、`sonnet`）能自动继承品种级默认值，无需逐个注册。

### P1 修复（5 项，阻塞新 variant 可用性）

| # | 文件 | 改动 |
|---|------|------|
| 1 | `McpPromptInjector.ts` | `needsMcpInjection(catId)` → `needsMcpInjection(mcpSupport: boolean)` |
| 2 | `TaskExtractor.ts` | `['opus','codex','gemini']` → `catRegistry.getAllIds()` with fallback |
| 3 | `useChatCommands.ts` | 硬编码 mention regex → `mentionResolver` from `useCatData().cats` |
| 4 | `useAuthorization.ts` | `CAT_LABELS` map → `getCatById().displayName` |
| 5 | `SystemPromptBuilder.ts` | `WORKFLOW_TRIGGERS` keys: catId → breedId |

### P2 修复（4 项，配置扩展性）

| # | 文件 | 改动 |
|---|------|------|
| 1 | `cat-voices.ts` | `DEFAULT_VOICES` keys: catId → breedId, `getCatVoice()` 加 breedId fallback |
| 2 | `cat-budgets.ts` | `DEFAULT_BUDGETS` keys: catId → breedId, `getCatContextBudget()` 加 breedId fallback |
| 3 | `seal-thresholds.ts` | `SEAL_OVERRIDES` keys: catId → breedId, `getSealConfig()` 加 breedId fallback |
| 4 | `DeliveryCursorStore.ts` | `ALL_CATS` 常量 → `getAllCats()` from `catRegistry.getAllIds()` |

### Won't Fix（合理 fallback default）

以下文件有 `'opus'` 硬编码但均为 defensive fallback，不影响新 variant：
- `tts.ts:64` — 无 catId 时默认用 opus 语音
- `ClaudeAgentService.ts:83` — Claude 服务的构造器默认值
- `RedisDraftStore.ts:151` — 旧 draft 反序列化 fallback
- `SocketManager.ts:19,96` — cancel message 空数组 fallback

### 附带修复

- `packages/shared/src/types/cat.ts` — `CAT_CONFIGS` 静态 fallback 加了 `breedId` 字段
- `useChatCommands-mode-kickoff.test.ts` / `useChatCommands-override.test.ts` — mock `useCatData` 防止额外 `apiFetch('/api/cats')` 调用

---

## Why

Phase 4c 即将添加第一个新 variant（Sonnet 布偶猫），如果这些配置映射仍以 catId 为键，新 variant 会：
- 拿不到语音/预算/seal 阈值（fallback 到全局默认值，不准确）
- 不触发 workflow triggers
- mention/task 提取不识别
- 被误注入 HTTP callback 指令

## Tradeoff

- **所有 breedId lookup 都有 catId fallback**：`DEFAULT_X[breedId] ?? DEFAULT_X[catName]`，向后兼容
- **ENV_KEYS 保持 catId**：`CAT_OPUS_TTS_VOICE` 等环境变量是运维接口，改名成本高于收益
- **Won't Fix 项都已评估**：均为 `?? 'opus'` 模式的 defensive default，新 variant 不经过这些路径

## Open Questions

1. Phase 4c 的 Sonnet variant 配置参数（personality、contextBudget 等）是否由我设定还是等铲屎官拍板？

## Test Evidence

```
API tests:  27/27 pass (SystemPromptBuilder size guard + MCP injector)
Web tests:  513/513 pass (80 files)
Build:      shared + api + web all clean
Pre-existing failure: start-dev-script.test.js (4 tests, same on main)
```

## Next Action

请 review Phase 4d 这个 commit (`e8a8899`)。放行后我继续 Phase 4c（Schema extension + 第一个新 variant）。

---

@缅因猫
