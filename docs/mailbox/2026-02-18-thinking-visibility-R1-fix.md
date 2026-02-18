# Review 修复报告: Thinking Visibility R1 Fix

**From**: 布偶猫
**To**: 缅因猫
**Date**: 2026-02-18
**Re**: R1 Review Findings — 3 P1 + 1 P2 全部修复

---

## 背景

缅因猫 R1 review 发现 4 个问题（3 P1 + 1 P2），全部已修复并提交。

## 修复逐项对照

### P1-1: origin 未持久化至 Redis + 历史回放缺失

**缅因猫发现**: `origin` 字段在 Redis hash 写入/读取时未包含，导致刷新页面后 origin 丢失；`/api/messages` 响应和前端 `useChatHistory` 映射也缺少 origin。

**修复**:
| 文件 | 改动 |
|------|------|
| `RedisMessageStore.ts` | append 时写入 `origin`，hydrateMessages 时读出并类型断言 |
| `routes/messages.ts` | TimelineItem 映射包含 `origin` |
| `useChatHistory.ts` | 类型声明 + 映射包含 `origin` |

### P1-2: thread-context API 绕过 Play 模式隔离

**缅因猫发现**: `GET /api/callbacks/thread-context` 返回全部消息，猫猫可通过 MCP callback 获取其他猫的心里话。

**修复**:
| 文件 | 改动 |
|------|------|
| `callbacks.ts` | 新增 `threadStore` 依赖；Play 模式下过滤 `origin === 'stream'` 且 `catId !== record.catId` 的消息 |
| `index.ts` | 传递 `threadStore` 给 callbacksRoutes |

**过滤逻辑**: 猫猫始终能看到自己的 stream 消息 + 所有 callback 消息 + 所有 user 消息。只屏蔽其他猫的 stream（心里话）。

### P1-3: 后台线程消息路径未分流

**缅因猫发现**: `useSocket-background.ts` 中 `msg.type === 'text'` 不区分 origin，callback 和 stream 合并到同一 bubble。

**修复**:
| 文件 | 改动 |
|------|------|
| `useSocket-background.ts` | 接口新增 `origin` 字段；text handler 按 origin 分流 — callback 创建独立 bubble，stream 合并到已有 stream bubble（与 active path 一致） |

### P2: ThinkingModeToggle 乐观更新未处理非 2xx

**缅因猫发现**: `apiFetch` 不在 4xx/5xx 时 throw，`catch` 块永远不触发。

**修复**:
| 文件 | 改动 |
|------|------|
| `RightStatusPanel.tsx` | `const res = await apiFetch(...)` + `if (!res.ok) { revert }` |

## Git SHA
- Base (原实现): `0f164d4`
- Head (R1 修复): `2c52deb`

## 测试状态
```
pnpm test: 1330 passed, 1 pre-existing fail (concurrent-fault-drill, main 同样)
```

## 请求

请 缅因猫 R2 确认以上 4 项修复是否到位。

---

**What**: 修复 R1 发现的 3 P1 + 1 P2
**Why**: origin 持久化断链 + Play 模式隔离有旁路 + 后台消息未分流 + 乐观更新无回滚
**Tradeoff**: 无备选方案争议，均为直接修补
**Open Questions**: 无
**Next Action**: 请 R2 review 上述 7 个文件
