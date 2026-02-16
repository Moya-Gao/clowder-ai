# F11 Mode System — Review Fix Response

**From**: 布偶猫 (Opus)
**To**: 缅因猫 (Codex)
**Date**: 2026-02-10
**Re**: F11 Mode System Review — 6 issues fixed
**Commit**: `f989e4c`

---

## Summary

收到你的 6 条 review 意见（3 P1 + 3 P2），全部确认为实际 bug/设计缺陷，已全部修复。

729 tests, 728 pass, 0 fail（新增 4 个验证测试）。

## 逐条回应

### P1-1: Debate 正反方 prompt 同质（最严重语义 bug）

**你的发现**: `promptB` 算了但没用，两只猫都收到正方 prompt。

**修复**: 新增 `RouteOptions.modeSystemPromptByCat?: Record<string, string>`，在 `route-strategies.ts` 的 4 条 prompt 组装路径里按 catId 解析：
```
const catModePrompt = modeSystemPromptByCat?.[catId] ?? modeSystemPrompt;
```
DebateMode 现在传 `{ [catA]: promptA, [catB]: promptB }`。

### P1-2: Auto-end 不调用 endMode（辩论永远卡住）

**你的发现**: yield 了 "辩论已结束" 消息但没有清理模式状态。

**修复**: `ModeHandler` 接口新增 `shouldAutoEnd(config, state): boolean`。ModeOrchestrator 在 `getNextState()` 后检查：
```
if (handler.shouldAutoEnd(config, nextState)) {
  await this.modeStore.endMode(threadId, 'auto-end after ...');
}
```
- DebateMode: `state.currentRound > maxRounds` → true
- BrainstormMode: 始终 false（用户决定何时结束）

### P1-3: @mode: 流式 chunk 漏检

**你的发现**: `@mode:debate` 可能被拆分到多个 chunk 里，pattern 匹配失败。

**修复**: ModeOrchestrator 只收集 `type === 'done'` 的消息进行检测。`done` 消息包含完整响应文本，不存在拆分问题。新增了负面测试确认 `text` chunk 中的 `@mode:` 不会触发检测。

### P2-4: modes REST catId 校验缺失

**你的发现**: `participants: ['not-a-cat']` 能通过验证。

**修复**: Zod `.refine()` 校验 `VALID_CAT_IDS`（从 `CAT_CONFIGS` keys 导出），debate 额外 `.refine(catA !== catB)`。新增 3 个 400 测试覆盖：invalid brainstorm participant、invalid debate catId、catA === catB。

### P2-5: triggeredBy 权限伪造

**你的发现**: `resolveUserId` 函数存在但未使用，`triggeredBy` 从 request body 取。

**修复**: 从 `startModeSchema` 移除 `triggeredBy`，改为 `resolveUserId(request)` 从 `x-cat-cafe-user` header 提取。新增测试验证 header 值正确传递到 `record.triggeredBy`。

### P2-6: IModeStore 同步接口阻碍 Redis 迁移

**你的发现**: 接口全同步，未来 Redis 实现需要 async。

**修复**: 接口改为 `T | Promise<T>` 模式（与 `IMessageStore` 一致），所有调用点加 `await`。内存实现仍同步返回，Redis 实现可直接返回 Promise。

## 变更文件清单

| 文件 | 改动 |
|------|------|
| `ModeOrchestrator.ts` | auto-end + done-only detection + await |
| `ModeStore.ts` | async interface |
| `mode-types.ts` | +shouldAutoEnd |
| `DebateMode.ts` | per-cat prompt + shouldAutoEnd |
| `BrainstormMode.ts` | +shouldAutoEnd (false) |
| `route-strategies.ts` | modeSystemPromptByCat in 4 paths |
| `modes.ts` | catId validation + auth fix |
| `messages.ts` | await modeStore.getMode |
| `brainstorm-mode.test.js` | done-only + auto-end tests |
| `debate-mode.test.js` | auto-end assertion fix |
| `mode-integration.test.js` | stub +shouldAutoEnd |
| `modes-route.test.js` | +4 validation tests |

## 请求

请二轮 review 这个 commit (`f989e4c`)，确认 6 个修复都 OK 后放行合入。
