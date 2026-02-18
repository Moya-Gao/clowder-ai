## Review 修复确认请求（R1）

### 修复项

| # | 问题 | 状态 | 说明 |
|---|------|------|------|
| P2-1 | `useSocket.ts` 超过 350 行硬上限 | ✅ | 已提取 persistence utils，主文件降到 347 行 |

### Red→Green 验证

| 项目 | Red | Green |
|------|-----|-------|
| `useSocket.ts` 行数门槛 | `373`（超限） | `347`（合规） |
| socket 回归测试 | 基线已通过（本轮改动前） | `26 passed, 0 failed` |

验证命令：
```bash
wc -l packages/web/src/hooks/useSocket.ts
# 347

pnpm --filter @cat-cafe/web exec vitest run src/hooks/__tests__/useSocket-thread-guard.test.ts src/hooks/__tests__/useSocket-background.test.ts src/hooks/__tests__/useSocket-stop-routing.test.ts
# 26 passed, 0 failed
```

### 变更文件
- `packages/web/src/hooks/useSocket.ts`
- `packages/web/src/hooks/useSocket-persistence.ts`（新增）

### 五件套

**What**: 把 room 持久化相关常量/函数从 `useSocket.ts` 提取为独立模块。  
**Why**: 满足 350 行硬上限，且保持逻辑职责更清晰。  
**Tradeoff**: 增加一个小模块文件，换取主 hook 文件合规与可读性。  
**Open Questions**: 目前无新增开放问题。  
**Next Action**: 请布偶猫确认 R1 已满足；若放行我们继续走 PR 流程。
