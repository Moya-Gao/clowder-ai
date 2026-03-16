---
doc_kind: review-request
feature_ids: [F121]
created: 2026-03-16
---

# Review Request: F121 response-text @mention 路径缺失 auto-replyTo

## What

修复 response-text @mention 路径（CLI 输出中直接 @猫名）不设置 `a2aTriggerMessageId` 的 bug。

变更文件：
- `route-serial.ts`: 捕获 `messageStore.append()` 返回的 `storedMsg.id`，在 response-text @mention 路径设置 `worklistEntry.a2aTriggerMessageId`
- `worklist-registry-f121.test.js`: 新增 response-text 路径测试

## Why

PR #487 修复了 worklist path 的 auto-replyTo，但只覆盖了 **post_message MCP 路径**（经 `callback-a2a-trigger.ts` → `pushToWorklist`）。铲屎官 alpha 测试发现：猫在 CLI 输出中直接 @mention 其他猫时，被调用的猫回复仍然没有 ReplyPill。

根因：`route-serial.ts` L645-662 处理 response-text @mentions 时直接操作 worklist 数组和 `a2aFrom` Map，但**从未设置 `a2aTriggerMessageId`**。

## Original Requirements（必填）

> 铲屎官（04:48）：不对 没同步runtime 但是同步了alpha alpha != runtime 所以你还有bug
> 铲屎官（04:51）：我知道了，如果用 post message @ 是可以的，有这个显示。但是如果它是直接在 CLI 里面输出 @ 的名字， 没有调任何 post message，也没有调任何的 A to A MCP，它是没有显示的。
- 来源：当前对话（2026-03-16 alpha 测试反馈）
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

无替代方案。两条路径（post_message vs response-text）最终都需要设置 `a2aTriggerMessageId`，只是设置的位置不同。

## Open Questions

1. response-text 路径中，`storedMsgId` 只在 `messageStore.append` 成功后才有值（失败时为 `undefined`）。这意味着 append 失败的降级场景下不会设置 triggerMessageId — 这是合理的（没有存储的消息 = 没有可引用的 replyTo 目标）。请确认这个行为是否 OK。

## Next Action

请 review 并放行。

## 自检证据

### Spec 合规
- 两条 @mention 路径现在都设置 a2aTriggerMessageId ✅
- 只改了 route-serial.ts（+4 行源码）+ 1 个测试文件 ✅
- Biome check 通过 ✅

### 测试结果
```
node --test worklist-registry-f121.test.js auto-reply-to-worklist.test.js auto-reply-to.test.js
# 10 passed, 0 failed
```

### 相关文档
- Feature: F121 (docs/features/F121-community-frontend-ux-triage.md)
- 前序 PR: #485 (auto-fill 基础), #487 (worklist path fix)
- Branch: `feat/replyto-response-text`
