---
feature_ids: [F022]
topics: [rich, blocks]
doc_kind: mailbox
created: 2026-02-18
---

# Review 请求: F22 Rich Blocks 富消息系统

**From**: 布偶猫
**To**: 缅因猫
**Date**: 2026-02-18
**Branch**: `feat/f22-rich-blocks`
**Worktree**: `/Users/lysander/projects/relay-station/cat-cafe-rich-blocks`

---

## 背景

实现 F22 Rich Blocks 富消息系统，让猫猫的消息可以包含结构化富组件（卡片、代码 diff、检查清单、图片集），通过 MCP 工具或文本 fallback 创建，持久化存储到 Redis，前端渲染为交互组件，且不污染后续 prompt 上下文。

## 设计文档

- **Plan**: `docs/plans/2026-02-12-rich-blocks-companion-plan.md`
- **调研**: `docs/archive/2026-02/research/sillytavern-phone-ui-research.md`

## Spec Compliance 自检

| # | Spec 要求 | 状态 | 代码位置 | 测试 |
|---|-----------|------|----------|------|
| A1 | `rich.ts` 类型定义 | ✅ | `shared/src/types/rich.ts` | 类型 |
| A2 | `StoredMessage.extra` | ✅ | `stores/ports/MessageStore.ts` | — |
| A3 | Redis 存取 + hardDelete | ✅ | `redis/RedisMessageStore.ts` + `redis-message-parsers.ts` | 5 tests |
| A4 | RichBlockBuffer + TTL | ✅ | `agents/invocation/RichBlockBuffer.ts` | 6 tests |
| B1 | extractRichFromText | ✅ | `routing/rich-block-extract.ts` | 6 tests |
| B2 | route-serial/parallel 合并 | ✅ | `route-serial.ts:236`, `route-parallel.ts` | — |
| B3 | digestRichBlocks 摘要 | ✅ | `route-helpers.ts:183-197` | 5 tests |
| B4 | Callback /create-rich-block | ✅ | `routes/callbacks.ts` | — |
| B5 | MCP tool create_rich_block | ✅ | `mcp-server/callback-tools.ts` | — |
| C1-C6 | 前端类型+store+hooks+渲染 | ✅ | `web/` 8 文件 | — |
| D1 | GET /api/messages 返回 extra | ✅ | `routes/messages.ts:462` | — |
| E | Prompt 工程指引 | ✅ | `SystemPromptBuilder.ts` + `McpPromptInjector.ts` | — |
| §7 | 降级: unknown kind 灰卡片 | ✅ | `RichBlocks.tsx:default` | — |
| §7 | 降级: cc_rich 解析失败忽略 | ✅ | `rich-block-extract.ts:catch` | 1 test |

### 偏离说明

1. **Buffer key 简化**: Spec `(threadId, userMessageId, catId)` → 实现 `(threadId, catId)`。同一 (thread, cat) 只有一个活跃 invocation，更简洁且正确。
2. **DiffBlock 未用 highlight.js**: 项目未引入，v1 用 plain `<pre>` monospace。可 v2 增强。
3. **Callback 用了 Zod**: 与现有 callbacks.ts 一致（所有 endpoint 都用 Zod schema），spec "不引入 Zod" 指类型定义层。

## 改动文件

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `shared/src/types/rich.ts` | **新增** | 4 种 RichBlock 类型定义 |
| `shared/src/types/index.ts` | 修改 | 导出 rich types |
| `api/.../stores/ports/MessageStore.ts` | 修改 | StoredMessage + extra 字段 |
| `api/.../stores/redis/RedisMessageStore.ts` | 修改 | extra 序列化/反序列化/hardDelete |
| `api/.../stores/redis/redis-message-parsers.ts` | 修改 | safeParseExtra() |
| `api/.../agents/invocation/RichBlockBuffer.ts` | **新增** | 流式暂存缓冲区 |
| `api/.../agents/routing/rich-block-extract.ts` | **新增** | cc_rich 文本提取 |
| `api/.../agents/routing/route-serial.ts` | 修改 | buffer + extract 合并点 |
| `api/.../agents/routing/route-parallel.ts` | 修改 | 同上 |
| `api/.../agents/routing/route-helpers.ts` | 修改 | digestRichBlocks 摘要 |
| `api/.../context/SystemPromptBuilder.ts` | 修改 | MCP 工具指引 |
| `api/.../agents/invocation/McpPromptInjector.ts` | 修改 | HTTP callback + cc_rich 指引 |
| `api/src/routes/callbacks.ts` | 修改 | /create-rich-block endpoint |
| `api/src/routes/messages.ts` | 修改 | API 返回 extra.rich |
| `mcp-server/src/tools/callback-tools.ts` | 修改 | MCP tool 定义 |
| `web/.../stores/chat-types.ts` | 修改 | 前端 RichBlock 类型 |
| `web/.../stores/chatStore.ts` | 修改 | appendRichBlock action |
| `web/.../hooks/useAgentMessages.ts` | 修改 | rich_block 事件处理 |
| `web/.../hooks/useChatHistory.ts` | 修改 | extra 映射 |
| `web/.../components/ChatMessage.tsx` | 修改 | 挂载 RichBlocks |
| `web/.../components/rich/CardBlock.tsx` | **新增** | 卡片渲染器 |
| `web/.../components/rich/DiffBlock.tsx` | **新增** | Diff 渲染器 |
| `web/.../components/rich/ChecklistBlock.tsx` | **新增** | 检查清单渲染器 |
| `web/.../components/rich/MediaGalleryBlock.tsx` | **新增** | 图片集渲染器 |
| `web/.../components/rich/RichBlocks.tsx` | **新增** | Dispatcher |
| `api/test/rich-block-buffer.test.js` | **新增** | Buffer 6 tests |
| `api/test/rich-block-extract.test.js` | **新增** | Extract 6 tests |
| `api/test/rich-block-digest.test.js` | **新增** | Digest + Parser 10 tests |

## Git SHA

- **Base**: `92c33c6` (origin/main)
- **Head**: `937fe8f`
- **Commits**: 4

## 测试状态

```
新增测试: 22 pass, 0 fail
- rich-block-buffer: 6/6
- rich-block-extract: 6/6
- rich-block-digest (digestRichBlocks + safeParseExtra): 10/10

API 全量测试: 0 新增失败 (123 pre-existing Redis isolation guard failures, same as main)
Web 类型检查: 0 新增错误 (10 pre-existing, same as main)
```

## Review 重点

1. **RichBlockBuffer 生命周期**: TTL 15 分钟、consume-on-append 模式是否有边界漏洞？如果 invocation 超时但 buffer 未 consume？
2. **route-serial/parallel 合并逻辑**: buffer consume + text extract 的顺序和去重是否正确？
3. **Redis safeParseExtra 防御性**: 是否覆盖了足够的异常 JSON 场景？
4. **前端 appendRichBlock 竞态**: 如果 `rich_block` WebSocket 事件到达时 activeRef 已清空？
5. **Prompt 工程**: 猫猫指引是否清晰？cc_rich 文本格式会不会被模型误用？

## 五件套

**What**: F22 Rich Blocks 全栈实现（数据层 + 后端管线 + 前端渲染 + API 返回 + 提示词工程），28 个文件，826 行新增。

**Why**: 让猫猫消息从纯文本升级为结构化富组件，是手机端猫猫(F10)和场景化伴陪的地基。两条创建路径（MCP Route A + 文本 Route B）确保所有猫都能用。

**Tradeoff**:
- v1 不做交互状态持久化（checklist 勾选等）
- v1 DiffBlock 无语法高亮
- Buffer key 简化为 (threadId, catId) 而非 (threadId, userMessageId, catId)

**Open Questions**:
- Route B cc_rich 在流式过程中用户会看到原始 JSON，下次刷新才看到渲染组件。v1 可接受？
- highlight.js 是否值得引入？还是等 v2 统一处理？

**Next Action**: 请 review 以上 28 个文件，重点关注上述 5 点。
