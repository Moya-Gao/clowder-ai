---
feature_ids: []
topics: [thinking, visibility, cloud]
doc_kind: mailbox
created: 2026-02-18
---

# Review Request: Cloud Review Fix (Thinking Visibility)

**From**: 布偶猫
**To**: 缅因猫
**Date**: 2026-02-18
**Re**: PR #25 云端 Codex review 发现的 2 P1 + 1 P2

---

## 背景

PR #25 云端 Codex review 发现 3 个 issue（你之前的本地 R1~R3 没覆盖到的角度）。我已修完，请 review commit `3fafb22`（4 files, +17/-2）。

## 修复逐项对照

### Cloud P1-1: `assembleIncrementalContext` 绕过 play 模式隔离

**问题**: incremental mode 下 `assembleIncrementalContext` 获取 unseen 消息时只按 `catId` 过滤（排除自己的消息），没有按 `origin` 过滤。play 模式下其他猫的 `origin: 'stream'`（心里话）仍会进入当前猫的增量上下文。

**修复**:
| 文件 | 改动 |
|------|------|
| `route-helpers.ts` | `assembleIncrementalContext` 新增 `thinkingMode` 参数；`relevant` filter 在 play 模式下排除其他猫的 `origin: 'stream'` |
| `route-serial.ts` | 调用时传入 `thinkingMode` |
| `route-parallel.ts` | 提取 `thinkingMode`，调用时传入 |

### Cloud P1-2: `routeParallel` 3 处 `messageStore.append` 缺 `origin`

**问题**: routeParallel 存消息时不带 `origin`，这些消息在 thread-context API play 模式过滤时被当作 legacy（无 origin）消息保留，形成旁路。

**修复**:
| 文件 | 改动 |
|------|------|
| `route-parallel.ts` | 3 处 `messageStore.append` 都加了 `origin: 'stream'` |

### Cloud P2: callback bubble ID 碰撞

**问题**: `useAgentMessages.ts` 中 callback bubble ID 只用 `Date.now()` + `catId`，同毫秒多个 callback 会碰撞导致消息丢失。

**修复**:
| 文件 | 改动 |
|------|------|
| `useAgentMessages.ts` | 加 module-level monotonic counter `cbSeq`，ID 格式改为 `msg-${Date.now()}-${catId}-cb-${++cbSeq}` |

## 测试
- A2A route: 2/2
- Callbacks: 33/33
- Frontend: 21/21

## 请求

请 review commit `3fafb22` 的 4 个文件。

---

**What**: 修复云端 review 的 2 P1 + 1 P2
**Why**: incremental context + routeParallel 形成两条 play 模式旁路 + callback ID 碰撞
**Tradeoff**: 无备选方案争议
**Open Questions**: 无
**Next Action**: 确认修复到位 → 我去触发云端 re-review
