# Bug Report: F069 未读 Badge 点不掉 + 消息气泡异常空白

## 1. 报告人

- **谁**：铲屎官 (Landy)
- **时间**：2026-03-07 01:00
- **发现方式**：Runtime 实际使用，发现 lesson-tutorial thread 的橙色未读 badge "20" 点击多次无法清除

## 2. 复现步骤

**Bug A: 未读 badge 点不掉**
- Thread: `lesson-tutorial`
- Badge: 橙色 20（hasUserMention = true）
- 操作：点击 thread 进入 → badge 不消失
- 期望：进入 thread 后 badge 清零
- 实际：badge 持续显示 20

**Bug B: 消息气泡异常空白**
- 截图显示：消息气泡左侧有明显空白/错位
- 第一张图中的两个消息块（布偶猫 23:29/23:30）左侧对齐异常

## 3. 根因分析

**Phase 1 完成** — 根因定位：

### Bug A: 未读 badge 点不掉 — 线程切换竞态
**症状**: PATCH `/api/threads/:id/read` 返回 400 "upToMessageId does not belong to this thread"
**证据**: DevTools Console 输出 400 error
**根因**: ChatContainer.tsx 中线程切换竞态条件
  - `threadId` prop 变化时，组件先渲染（messages 仍是旧线程的）
  - `setCurrentThread` 在 useEffect 中执行（渲染后）
  - ack useEffect 用新 threadId + 旧 lastMessageId → 400
  - 具体流程：render(threadId=B, messages=A) → lastMessageId=A's → effect fires PATCH /threads/B/read with A's msg → 400
**修复**: 添加 `storeThreadId !== threadId` 守卫
  - `storeThreadId` 通过 `useChatStore((s) => s.currentThreadId)` 获取
  - 渲染时 storeThreadId 还是旧值 → guard 跳过 → setCurrentThread 执行后 re-render → 此时一致 → ack 正常发送

### Bug B: 消息气泡异常空白
**推测**: 与 Bug C 同源 — 未注册的猫（sonnet/gpt52 等）无 catData → 无头像/无标题/默认样式
  - `ChatMessage.tsx:243`: `getCatById` 返回 undefined → catData 为空
  - `ChatMessage.tsx:360`: `{catData && <CatAvatar/>}` → 无头像
  - `ChatMessage.tsx:362`: `{catStyle && (...)}` → 无标题栏
  - Bug C 修复后（11 只猫全部注册），此问题应自动恢复
**验证**: 刷新前端确认布偶猫消息恢复正常头像和对齐

### Bug C: @ 弹窗猫猫列表不全
**症状**: 只显示 3 只猫（布偶/缅因/暹罗），缺失 8-9 个变体
**证据**: `GET /api/cats` 返回 200 但只有 3 只猫（opus/codex/gemini）
**根因**: cat-config-loader.ts Zod schema 缺少 'antigravity' provider + nickname 不接受 null
  - Line 58: `provider` enum 缺少 'antigravity'（bengal 品种的 provider）
  - Line 122: `nickname` 字段只允许 `string | undefined`，但 bengal 的 nickname 是 `null`
  - 导致 loadCatConfig() 抛异常 → fallback 到 CAT_CONFIGS（只有 3 只猫）
**修复**: ✅ 已修复
  - 添加 'antigravity' 到 provider enum
  - 改 `nickname: z.string().optional()` 为 `z.string().nullable().optional()`
  - Runtime API 已重启，现在返回全部 11 只猫

## 4. 修复方案

### Bug C: ✅ 已修复（2026-03-07 17:20）
- **修改文件**: `packages/api/src/config/cat-config-loader.ts`
- **变更**:
  - Line 58: `provider: z.enum(['anthropic', 'openai', 'google', 'dare', 'antigravity'])`
  - Line 122: `nickname: z.string().nullable().optional()`
- **生效**: Runtime API 已重启，`/api/cats` 现在返回 11 只猫

### Bug A: ✅ 已修复（线程切换竞态守卫）
- **修改文件**: `packages/web/src/components/ChatContainer.tsx`
- **变更**: 在 F069 ack useEffect 中添加 `storeThreadId !== threadId` 守卫
- **原理**: `useChatStore((s) => s.currentThreadId)` 在 setCurrentThread 执行前仍是旧值，效果上跳过首次渲染的脏数据

### Bug B: 可能由 Bug C 连带引发，待铲屎官视觉确认（pending verification）
- **代码分析**: `ChatMessage.tsx:243` — `getCatById(catId)` 对未注册猫返回 undefined
  - `ChatMessage.tsx:360`: `{catData && <CatAvatar/>}` → 未注册猫无头像
  - `ChatMessage.tsx:362`: `{catStyle && (...)}` → 未注册猫无标题栏/时间戳
  - 有头像和无头像的消息混排 → 视觉上"左侧对齐异常"
- **Bug C 修复后**: 11 只猫全部注册 → 所有消息都有 catData → 头像/标题正常
- **状态**: ⚠️ **Pending manual verification** — 代码分析强烈指向 Bug C 连带，但无法自动化视觉验证
- **如仍存在**: 则与 Bug C 无关，需单独排查 CSS/布局问题
- **注意**: 不宣称已修复，仅标记为"likely resolved by Bug C"

### Bug D: 冷启动所有 badge 重现（F5 刷新后）
- **症状**: 每次 F5 刷新或重启，所有已读 thread 的 badge 重新出现
- **根因**: Pre-F069 的 thread 没有 read cursor → `getUnreadSummaries()` 对无 cursor 的 thread 把全部消息计为 unread
- **修复**: `RedisThreadReadStateStore.getUnreadSummaries()` 添加冷启动守卫
  - 无 cursor → 返回 `{ unreadCount: 0, hasUserMention: false }`（视为已读）
  - 理由：Pre-F069 thread 从未有过 cursor，计为全部 unread 会导致每次刷新 badge 爆炸
- **迁移语义前提**:
  - Post-F069 的 thread 在用户首次访问时自动建立 cursor（ack 最新消息）
  - 只有在用户从未访问过且 cursor 不存在时才触发冷启动守卫
  - 这意味着：如果用户从未访问某个 thread，该 thread 的新消息不会产生 unread badge，直到用户第一次访问后建立 cursor
  - **Tradeoff**: 牺牲"从未访问的 thread 的历史消息 unread 通知"换取"不会每次刷新 badge 爆炸"

## 5. 验证方式

### Bug A
- **单元测试**: `packages/web/src/components/__tests__/chat-container-read-ack-race.test.ts`
  - ✅ 竞态窗口中不发送 ack（storeThreadId 滞后）
  - ✅ 一致状态下正常发送 ack

### Bug D
- **Redis 集成测试**: `packages/api/test/redis-read-state-store.test.js`
  - ✅ 无 cursor 视为已读（冷启动守卫）
  - ✅ 多 thread 混合 cursor 状态
  - ✅ 排除已删除消息
  - ✅ 排除用户自己的消息（catId=null）

### Bug B
- ⚠️ 需铲屎官刷新前端后目视确认

### Bug C
- ✅ 已在 main 修复（commit `d31f6dbe`），Runtime 已生效

---

**当前阶段**：Phase 4 — Bug A+C+D 已修复，Bug B pending manual verification
**Peer review**: 砚砚 (gpt52) 2026-03-07 02:04 — A pass, D accepted (需写迁移语义), B pending verification
