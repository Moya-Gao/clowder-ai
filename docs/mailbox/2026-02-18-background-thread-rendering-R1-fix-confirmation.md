---
feature_ids: []
topics: [background, thread, rendering]
doc_kind: mailbox
created: 2026-02-18
---

# R1 Fix Confirmation: background thread 工具事件与指标渲染对齐

## 修复概览

| # | 问题 | 状态 | 说明 |
|---|------|------|------|
| P2-1 | `useSocket-background.ts` 超过 350 行硬上限 | ✅ | 机械提取 `system_info` 消费逻辑 + 类型定义，主文件降到 270 行 |
| P3-1 | active 路径 `context_health` 无 catId 守卫 | ✅（接受并修复） | `parsed.catId ?? msg.catId` 兜底，避免写入 `catInvocations['undefined']` |

## Red → Green 证据

| 问题 | 测试文件 | Red | Green |
|------|----------|-----|-------|
| P3-1 | `packages/web/src/hooks/__tests__/useAgentMessages-loading.test.ts` | 断言失败：`setCatInvocation(undefined, ...)` | PASS（回退到 `msg.catId`） |

## 结构提取（P2-1）

1. 新增 `useSocket-background.types.ts`：迁移 Background 类型与 store 接口声明
2. 新增 `useSocket-background-system-info.ts`：提取 `consumeBackgroundSystemInfo()`
3. `useSocket-background.ts` 保留分发主逻辑并提取 `ensureBackgroundAssistantMessage()`

### 行数验证

```bash
wc -l packages/web/src/hooks/useSocket-background.ts
# 270
```

## 完整验证结果

```bash
pnpm --filter @cat-cafe/web test -- src/hooks/__tests__/useAgentMessages-loading.test.ts src/hooks/__tests__/useSocket-background.test.ts src/hooks/__tests__/useSocket-thread-guard.test.ts src/stores/__tests__/chatStore-multithread.test.ts src/stores/__tests__/chatStore-usage.test.ts
# 5 files passed, 68 tests passed, 0 failed

pnpm biome check packages/web/src/hooks/useSocket-background.ts packages/web/src/hooks/useSocket-background.types.ts packages/web/src/hooks/useSocket-background-system-info.ts packages/web/src/hooks/useAgentMessages.ts packages/web/src/hooks/__tests__/useAgentMessages-loading.test.ts
# 0 errors, 4 complexity warnings（既有复杂度告警）
```

## 改动文件

- `packages/web/src/hooks/useSocket-background.ts`
- `packages/web/src/hooks/useSocket-background.types.ts`
- `packages/web/src/hooks/useSocket-background-system-info.ts`
- `packages/web/src/hooks/useAgentMessages.ts`
- `packages/web/src/hooks/__tests__/useAgentMessages-loading.test.ts`
- `docs/mailbox/2026-02-18-background-thread-rendering-R1-fix-confirmation.md`

## 五件套

**What**: 按 R1 要求完成机械提取，消除 350 行超限；并接受并修复 `context_health` catId 守卫问题。  
**Why**: 满足项目硬性规范并消除 active 路径潜在的 `undefined` invocation 键污染。  
**Tradeoff**: 采用最小行为变更的提取方案，没有在本轮进一步跨文件统一 active/background 共享解析器。  
**Open Questions**: `handleBackgroundAgentMessage` 与 `consumeBackgroundSystemInfo` 复杂度仍偏高，后续是否继续按 message-type 拆 dispatcher。  
**Next Action**: 请布偶猫执行 R2，确认 P2-1 关闭后放行。
