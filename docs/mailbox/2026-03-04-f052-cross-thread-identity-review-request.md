# Review Request: F052 跨线程身份隔离与消息溯源

## What

跨线程消息溯源 + A2A 路由修复 + Context/UX 标注，13 files / +288 lines / 10 new tests。

**Phase A — 消息溯源 + A2A 修复：**
- `StoredMessage.extra` 新增 `crossPost` 子字段（`sourceThreadId`, `sourceInvocationId`）
- `callbacks.ts` post-message handler 在跨线程时自动附加 crossPost metadata
- `parseA2AMentions` 的 `currentCatId` 变 optional——跨线程不传 = 不过滤同名猫
- Redis `safeParseExtra` 扩展支持 crossPost 反序列化

**Phase B — Context 标注 + UX 展示：**
- `formatMessage` 对跨线程消息加 `← from thread:xxxxx` 标注
- 前端 `ChatMessage.tsx` 渲染蓝色 "转发自 xxxxx…" 徽章
- messages API + useChatHistory 透传 crossPost 字段

## Why

**根因**：`catId` 是全局的，没有 Thread 作用域。Thread A 的 codex 用 `cross_post_message` 给 Thread B 传话时：
1. 消息没有来源标记，跟本地消息一模一样
2. `@codex` 被 `parseA2AMentions` 的自引用过滤器误杀（Thread B 的 codex 收不到）
3. 铲屎官/猫猫都分不清消息来自哪里

## Original Requirements（必填）

> "我们没做跨线程的身份隔离！别线程的 codex 他顶着 codex 的名字"
> "我得知道是缅因猫本地还是其他线程来的？"
> "ux 安全 context 等等等，其实我们的机制都还没跟上这个 mcp"

- 来源：`docs/features/F052-cross-thread-identity-isolation.md` §愿景，Thread `thread_mm8nkwlcwmwhmfgz` (2026-03-02)
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

| 放弃的方案 | 理由 |
|-----------|------|
| Thread-scoped catId (`codex@threadA`) | 侵入面太大，触及 routing/registry/store 全链路 |
| 自动注入跨线程上下文 | 噪音太大，破坏线程隔离边界 |
| 新增 StoredMessage 顶层字段 | `extra` 本就是扩展槽，不改核心接口 |

选择了最小侵入方案：`extra.crossPost` + `currentCatId` optional。

## Open Questions

1. **AC-A5 (push 去重)**: 现有 WorklistRegistry 单线程内已去重，全局跨线程 dedup 超出本 PR 范围。请判断这是否可接受。
2. **`sourceThreadId.slice(0, 8)`**: Context 和 UX 都截取了前 8 字符显示，审美上是否 OK？
3. **跨线程 A2A depth 限制**: 当前复用 `maxDepth`（默认 15），是否需要单独的跨线程 depth？

## Next Action

请 review 以下重点：
1. `callbacks.ts` 的 isCrossThread 检测逻辑和 extra 构建
2. `a2a-mentions.ts` currentCatId optional 改动的安全性
3. `ContextAssembler.ts` 标注格式
4. 前端类型透传链路完整性

## 自检证据

### Spec 合规
- AC-A1 ✅ crossPost.sourceThreadId 存储（callback-routes.test.js）
- AC-A2 ✅ 跨线程 @codex 触发 A2A（callback-a2a-postmsg.test.js）
- AC-A3 ✅ 同线程 @codex 仍过滤（a2a-mentions.test.js + callback-a2a-postmsg.test.js）
- AC-A4 ✅ maxDepth 未改动
- AC-A5 ⚠️ 部分覆盖（现有 worklist dedup，无新跨线程 dedup）
- AC-B1 ✅ context `← from thread:xxx` 标注（context-assembler.test.js）
- AC-B2 ✅ 前端"转发自"徽章（type check + build clean）

### 测试结果
```
node --test (4 files) → 142 passed, 0 failed ✅
pnpm lint             → 0 errors (4 packages Done) ✅
next build            → Compiled successfully ✅
```

### 相关文档
- Spec: `docs/features/F052-cross-thread-identity-isolation.md`
- Plan: `docs/plans/2026-03-04-f052-cross-thread-identity-isolation.md`
- Feature: F052 / BACKLOG
