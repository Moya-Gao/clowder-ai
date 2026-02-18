## Review 请求: thread 切换/F5 后流式可见性修复

### 背景
我们在多线程切换场景里仍会遇到“thread-1 流式中切到 thread-2 后 F5，thread-1 中途输出丢失”的问题。根因是刷新后 socket room 订阅集合丢失，前端只保留当前路由线程。

### 设计文档
- Bug Report / 设计与根因：`docs/bug-report/thread-switch-f5-stream-loss/bug-report.md`

### Spec Compliance 自检

| # | 要求 | 状态 | 说明 |
|---|------|------|------|
| 1 | F5 后恢复历史 thread room 订阅 | ✅ | `useSocket` 增加 sessionStorage 持久化与恢复 |
| 2 | 连接后重加入全部已跟踪 room | ✅ | `connect` 回调执行 `join_room` 重加 |
| 3 | 订阅恢复逻辑可回归验证 | ✅ | 新增 hook 测试覆盖 F5 恢复场景 |
| 4 | 可观测性增强 | ✅ | 增加恢复失败 warning + rejoin rooms 日志 |

### 改动文件

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `packages/web/src/hooks/useSocket.ts` | 修改 | room 订阅持久化/恢复 + rejoin 日志 |
| `packages/web/src/hooks/__tests__/useSocket-thread-guard.test.ts` | 修改 | 新增 F5 后 room 恢复回归测试 |
| `docs/bug-report/thread-switch-f5-stream-loss/bug-report.md` | 新增 | bug 五件套报告 |

### Git SHA
- Base: `5827fb9`
- Head: `a9cc681`

### 测试状态
```bash
pnpm --filter @cat-cafe/web exec vitest run src/hooks/__tests__/useSocket-thread-guard.test.ts
# 9 passed, 0 failed

pnpm --filter @cat-cafe/web exec vitest run src/hooks/__tests__/useSocket-thread-guard.test.ts src/hooks/__tests__/useSocket-background.test.ts src/hooks/__tests__/useSocket-stop-routing.test.ts
# 26 passed, 0 failed

pnpm --filter @cat-cafe/web exec tsc --noEmit
# failed（仓库现存的 web 侧历史类型错误，和本次改动无直接关联）
```

### Review 重点
1. `sessionStorage` 持久化 room 的范围是否合理（同标签页生命周期）。
2. `connect` 重加房间与现有 split/single 模式 room 管理是否有冲突。
3. 日志颗粒度是否足够定位“线程在跑但看不到”的现场。

### 五件套

**What**: 为 `useSocket` 增加 room 集合持久化与重连恢复，修复 F5 后后台线程流式可见性丢失。  
**Why**: 刷新会重置内存 `joinedRoomsRef`，导致非当前线程的流式事件被动丢订阅。  
**Tradeoff**: 选择前端最小修复（sessionStorage）而非新增后端 active-invocation 查询接口，减少改面与联调成本。  
**Open Questions**: 是否要在后续补后端“活跃 invocation 线程列表”接口，以覆盖“新标签页冷启动”场景。  
**Next Action**: 请布偶猫重点 review 上述两个 web 文件，确认 room 生命周期与线程隔离策略无回归。
