---
feature_ids: [F109]
topics: [chat, message-actions, soft-delete, branch, edit, revision]
doc_kind: discussion
created: 2026-03-12
participants: [opus, gpt52]
---

# F109 技术讨论：Message Actions 修复方案

> 参与者：布偶猫/宪宪（@opus）、缅因猫/砚砚（@gpt52）
> 日期：2026-03-12

## 讨论背景

铲屎官报告：软删除后前端气泡还在。同时要求对消息操作功能（删除、Branch、编辑、通知）做一揽子修复和优化。铲屎官点名让宪宪找砚砚讨论技术方案。

## 问题 1：软删除前端不生效

### 宪宪初始排查方向
- socket room 订阅时机问题
- `removeMessage` 的 id 格式不匹配
- DELETE 返回非 2xx 但前端没 catch

### 砚砚分析（代码链路审查）

砚砚做了完整的静态链路检查，给出置信度分级：

- **高置信**：`removeMessage` 只改 flat `messages` 数组（`chatStore.ts:592`），不改 `threadStates[threadId]`。socket 回调 `onMessageDeleted`（`useChatSocketCallbacks.ts:85`）丢了 `threadId`。但 background thread 新消息有 thread-scoped 写路径（`chatStore.ts:802`）。→ **后台/切线程/分屏删除不同步** 是主 bug。

- **中置信**：HTTP 失败但前端无提示。`MessageActions.tsx:62` 静默 catch。

- **低置信**：id 格式不匹配。

### 共识修法
补 `removeMessageFromThread(threadId, id)` 对称 API；socket 事件带 `threadId` 传到底；non-2xx 必须 toast。

## 问题 2：Branch From 权限

### 砚砚关键发现

1. `participants` 是 `CatId[]`（`ThreadStore.ts:88`），不是"谁能操作 thread"的 ACL。**不能拿 participants 做权限判断。**
2. 仓库里已有回归测试防 "direct branch 用 hardcoded default-user"（`message-actions-identity.test.ts:79`），说明这个问题曾经在前端发生过。
3. 403 来自 `thread-branch.ts:130` 的 owner-only 判断。

### 共识修法
最小改为 `createdBy === userId || createdBy === 'system'`。不引入 collaborator model。

## 问题 3：编辑方案

### 砚砚明确立场：不做"任意历史消息真就地编辑"

三档分层：

| 位置 | 操作 | 理由 |
|------|------|------|
| 最新一条用户消息，后面没回复 | 真 in-place edit | 安全，不破坏上下文链 |
| 更早的用户消息 | "改写并分支"（改文案） | 下游回复的上下文基础不能被偷换 |
| 猫的消息 | v1 不支持编辑 | ownership + 审计 |

### 宪宪认同
原来笼统的"就地编辑"太粗，三档分层是更好的设计。

## 问题 4：Revision System

### 砚砚技术建议

1. **独立 revision store**：主消息只放 `editedAt/editedBy/revisionCount/latestRevisionId`，旧版本快照独立 key。不塞 message hash。
2. **`message_edited` 专用事件**：不搞泛化 `message_updated`。
3. **revision note 不走 unread**：需引入显式 message `kind`（`chat`/`system`/`revision`）。revision 进历史流让猫看到，但不触发 UI 未读 badge。
4. **cursor 不动**：`getByThreadAfter` 语义不变。用 revision note + `message_edited` 补丁双通道。

### 砚砚特别提醒
如果 revision note 复用 `source`/connector 路径，会被 unread 计数当新未读（`RedisThreadReadStateStore.ts:69`）。需要单独的 persisted system 语义，这要求 message kind 从推断式升级为显式字段。

### 宪宪认同
cursor 是圣域不动，revision note 走独立语义路径。message `kind` 显式化是 B2 的前置依赖。

## 收敛结论

| KD | 决策 | 来源 |
|----|------|------|
| KD-2 | `participants` 不做 ACL | 砚砚 |
| KD-3 | 编辑三档分层 | 砚砚 |
| KD-4 | Revision 独立 store | 砚砚 |
| KD-5 | `message_edited` 专用事件 | 砚砚 |
| KD-6 | Revision note 不走 unread，引入 message `kind` | 砚砚 |
| KD-7 | Phase A 同时覆盖 soft/hard delete + restore | 砚砚 R2 |
| KD-8 | B2 前置：message `kind` 必须先显式化 | 砚砚 R2 |

**否决记录**：
- ❌ 拿 `participants` 直接做 branch ACL
- ❌ 任意消息直接 in-place edit
- ❌ revision 塞进 message hash JSON 数组

**砚砚 R2 补充（实现护栏）**：
1. hard/soft delete 走同一回调 `onMessageDeleted`，thread-scoped remove 必须同时覆盖两者
2. restore 前端回调是 no-op，纳入 Phase A 修复（socket 到达后 refetch）
3. B2 开做前 message `kind` 必须先立显式字段，否则 revision note 会被塞进错误语义

**Phase A 最小测试边界**（砚砚建议）：
1. active thread soft delete
2. background/split thread soft delete
3. hard delete 复用同一修复
4. restore 跨客户端同步
5. `createdBy === 'system'` thread 的 branch

**执行顺序**：Phase A（bug fix）→ B1（文案 + tail edit）→ B2（revision system）
