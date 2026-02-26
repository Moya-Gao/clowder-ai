---
feature_ids: [F035]
topics: [whisper, message, visibility]
doc_kind: plan
created: 2026-02-19
---

# F35: Whisper — 消息可见性控制

> **优先级**: P1
> **作者**: 布偶猫 (宪宪) + 缅因猫 (砚砚) 共同设计
> **日期**: 2026-02-19
> **状态**: Draft — 等铲屎官确认后开发
> **来源**: 独立思考模式可见性测试 → 铲屎官提出"悄悄话"需求 → 三方共识

---

## 1. 背景

Cat Cafe 当前所有消息对线程内所有参与者完全可见。独立思考模式只隔离了猫猫的回复文本（不进入共享对话链），但铲屎官发的消息对所有猫一视同仁。

这导致一个关键缺失：**铲屎官无法私密地给某只猫发消息**。

**直接动机**：铲屎官想和三只猫一起玩桌游（狼人杀、谁是卧底、Spyfall 等），需要：
1. 私密发送身份卡/角色信息给每只猫
2. 特定游戏阶段的私密交流（如狼人杀夜晚阶段）
3. 其他猫拉历史上下文时看不到不属于自己的私密消息
4. 游戏结束后"揭秘"——把所有悄悄话公开

## 2. 目标

1. 铲屎官可以给指定猫发送"悄悄话"（whisper），其他猫通过任何 API 都看不到
2. 铲屎官始终能看到所有消息（上帝视角）
3. 悄悄话永久保存在历史中，不会阅后即焚
4. 公开 @mention 和悄悄话是正交的：@ 决定"叫谁"，visibility 决定"谁能看"
5. 支持"揭秘"操作——批量把 whisper 变成 public

## 3. 非目标

- **猫对猫的悄悄话**：v1 只支持铲屎官 → 猫的悄悄话。猫猫之间的私密通信需求后续再看
- **阅后即焚**：不做。铲屎官明确要求永久保存
- **端到端加密**：不做。信任边界在服务端，铲屎官是管理员
- **每条消息独立 reveal**：v1 只做线程级批量揭秘

## 4. 数据模型

### 4.1 StoredMessage 新增字段

```typescript
// packages/api/src/domains/cats/services/stores/ports/MessageStore.ts
interface StoredMessage {
  // ... existing fields ...

  /** 消息可见性。默认 'public'，省略时等同 public（向后兼容） */
  visibility?: 'public' | 'whisper';

  /** whisper 时指定目标猫。仅 visibility='whisper' 时有意义 */
  whisperTo?: readonly CatId[];

  /** 揭秘时间戳。whisper 被 reveal 后设置此字段 */
  revealedAt?: number;
}
```

**向后兼容**：`visibility` 为 `undefined` 时等同 `'public'`，所有已有消息无需迁移。

### 4.2 可见性判定函数

```typescript
// packages/api/src/domains/cats/services/stores/visibility.ts (新文件)

type Viewer =
  | { type: 'user' }        // 铲屎官：看到一切
  | { type: 'cat'; catId: CatId };  // 猫：受过滤

function canViewMessage(msg: StoredMessage, viewer: Viewer): boolean {
  // 铲屎官永远能看到所有消息
  if (viewer.type === 'user') return true;

  // 公开消息 or 未设置 visibility → 所有人可见
  if (!msg.visibility || msg.visibility === 'public') return true;

  // 已揭秘的 whisper → 所有人可见
  if (msg.revealedAt) return true;

  // Whisper：只有目标猫可见
  if (msg.visibility === 'whisper') {
    return msg.whisperTo?.includes(viewer.catId) ?? false;
  }

  return false;
}
```

## 5. API 改动

### 5.1 POST /api/messages — 发送消息

**Schema 新增字段**：

```typescript
sendMessageSchema = {
  // ... existing fields ...
  visibility?: 'public' | 'whisper';  // 默认 'public'
  whisperTo?: CatId[];                // visibility='whisper' 时必填
}
```

**校验规则**：
- `visibility='whisper'` 时 `whisperTo` 必须非空
- `visibility='public'` 时 `whisperTo` 忽略
- 只有铲屎官（sender.type='user'）可以发 whisper。猫猫发送的 callback 消息不能设为 whisper

**存储**：`append()` 时直接写入 `visibility` 和 `whisperTo` 字段。

### 5.2 GET /api/messages — 前端加载历史

前端请求始终以铲屎官视角（userId），**返回所有消息**（含 whisper），但消息体里带 `visibility` 和 `whisperTo` 字段，前端负责标记样式。

### 5.3 GET /api/callbacks/thread-context — 猫拉上下文

这是 **核心过滤点**。当前实现根据 `invocationId` 和 `callbackToken` 鉴权，能拿到 `catId`。

**改动**：查询结果过 `canViewMessage(msg, { type: 'cat', catId })` 过滤。

**注意**：当前已有 thinking mode 的过滤逻辑（过滤其他猫的 stream origin 消息）。whisper 过滤应在此之上叠加，不替代。

### 5.4 GET /api/callbacks/pending-mentions — 待处理提及

**改动**：如果消息是 whisper 且目标猫不包含被 mention 的猫，不返回该 mention。

场景：铲屎官对布偶猫发 whisper "@缅因猫 等下投票别选布偶猫"——这条消息 mention 了缅因猫但 whisperTo 只有布偶猫。此时缅因猫不应该收到 pending mention。

过滤规则：`getMentionsFor(catId)` 结果再过 `canViewMessage(msg, { type: 'cat', catId })`。

### 5.5 PATCH /api/threads/:threadId/reveal — 揭秘

**新端点**。铲屎官专用。

```typescript
// Request
PATCH /api/threads/:threadId/reveal
Body: {} (无参数，揭秘该 thread 所有 whisper)

// Response
{ revealed: number } // 被揭秘的消息数量
```

**逻辑**：
1. 验证铲屎官身份
2. 遍历 thread 内所有 `visibility='whisper'` 且 `revealedAt` 为空的消息
3. 设置 `revealedAt = Date.now()`
4. 通过 WebSocket 广播 `whisper_revealed` 事件
5. 返回揭秘数量

**不改 visibility 字段本身**：保留原始 `whisper` 标记 + `whisperTo`，方便复盘时知道"这条消息原来是悄悄话、是给谁的"。

## 6. 前端改动

### 6.1 发送界面 — 悄悄话模式

ChatInput 组件新增：
- **锁按钮** 🔒：点击切换悄悄话模式
- **目标猫选择器**：悄悄话模式下，弹出猫猫多选菜单
- **视觉指示**：悄悄话模式时输入框边框变为虚线 + 底色微调 + 锁图标常驻

### 6.2 消息展示 — Whisper 样式

Whisper 消息的渲染区别：
- 背景色半透明 + 左边距锁图标
- 显示 `悄悄话 → 布偶猫` 标签
- 已揭秘的 whisper：恢复正常样式 + `🔓 已揭秘` 标签

### 6.3 揭秘按钮

铲屎官在 thread 操作菜单中新增"揭秘所有悄悄话"按钮：
- 确认弹窗："确定要揭秘本对话中的所有悄悄话吗？"
- 调用 `PATCH /api/threads/:threadId/reveal`
- 成功后前端刷新消息列表

## 7. 游戏场景验证

### 7.1 狼人杀

1. 铲屎官用 whisper 分别给三只猫发身份卡（狼人/村民/预言家）
2. 夜晚阶段：铲屎官 whisper 给狼人猫 → "你要杀谁？"
3. 狼人猫公开回答（但只有铲屎官能看到 whisper 上下文）
4. 白天阶段：公开讨论 + 投票
5. 游戏结束：铲屎官点"揭秘"，所有身份卡和夜晚对话公开

### 7.2 谁是卧底

1. 铲屎官 whisper 给每只猫发各自的词（两只猫相同词，一只卧底词）
2. 猫猫轮流公开描述自己的词
3. 投票淘汰
4. 游戏结束揭秘

### 7.3 Spyfall（间谍落网）

1. 铲屎官 whisper 给每只猫发地点（其中一只间谍猫收到"你是间谍"）
2. 猫猫互相公开提问
3. 投票 / 间谍猜地点
4. 揭秘

### 7.4 猫猫杀（Cat Cafe 原创！升级版）

> 第一届亚军：布偶猫 | 第一届冠军：缅因猫
> 第二届冠军：布偶猫
> 升级版：有了 whisper 功能后的全新玩法

**老版本规则**（无 whisper）：
- 每只猫脑门上有一个 AI 相关词（公司/论文/产品/技术/硬件）
- 猫猫不知道自己的词，通过向铲屎官提问来猜
- 能看到别的猫上一轮的公开回答，作为推理线索

**升级版规则**（需要 whisper）：
- 每只猫脑门上有一个 AI 相关词，三只猫的词都不一样
- **关键区别**：每只猫能看到**其他两只猫**头上的词，但不知道自己的
- 铲屎官 whisper 给布偶猫 → "缅因猫头上是 X，暹罗猫头上是 Y"
- 铲屎官 whisper 给缅因猫 → "布偶猫头上是 Z，暹罗猫头上是 Y"
- 铲屎官 whisper 给暹罗猫 → "布偶猫头上是 Z，缅因猫头上是 X"
- 猫猫们通过公开讨论、互相提问、观察别人的提问方式来推理自己的词
- 博弈深度高：你的提问会暴露你知道什么，别人可以从中推理

**Whisper 使用场景**：
1. 开局：铲屎官分别 whisper 发送信息（3 条 whisper）
2. 每轮：公开讨论（所有猫可见）
3. 猜词：公开宣布答案
4. 游戏结束：铲屎官一键揭秘，回顾每只猫的信息差

## 8. 实现计划

### Phase A: 数据层 + API（后端）
1. 新建 `visibility.ts` — `canViewMessage` 纯函数 + 单元测试
2. `StoredMessage` 类型新增字段（shared 包 + API 层）
3. `IMessageStore.append()` 支持 visibility/whisperTo 写入
4. `MemoryMessageStore` 查询方法加过滤
5. `RedisMessageStore` 查询方法加过滤
6. POST /api/messages schema 扩展 + 校验
7. GET /api/callbacks/thread-context 加过滤
8. GET /api/callbacks/pending-mentions 加过滤
9. PATCH /api/threads/:threadId/reveal 新端点
10. 测试：visibility 过滤 + reveal + 边界场景

### Phase B: 前端
11. ChatInput 悄悄话模式 UI
12. ChatMessage whisper 样式
13. 揭秘按钮 + 确认弹窗
14. WebSocket `whisper_revealed` 事件处理

### 预估文件改动
| 文件 | 改动 |
|------|------|
| `packages/shared/src/types/message.ts` | 新增 visibility 相关类型 |
| `packages/api/.../stores/ports/MessageStore.ts` | StoredMessage 新增字段 |
| `packages/api/.../stores/ports/MemoryMessageStore.ts` | 查询过滤 |
| `packages/api/.../stores/redis/RedisMessageStore.ts` | 查询过滤 |
| `packages/api/.../stores/visibility.ts` | **新文件** canViewMessage |
| `packages/api/src/routes/messages.ts` | POST schema + 写入 |
| `packages/api/src/routes/callbacks.ts` | thread-context + pending-mentions 过滤 |
| `packages/api/src/routes/threads.ts` 或新文件 | reveal 端点 |
| `packages/mcp-server/src/tools/callback-tools.ts` | 无改动（过滤在 API 层） |
| `packages/web/src/components/ChatInput.tsx` | 悄悄话模式 UI |
| `packages/web/src/components/ChatMessage.tsx` | whisper 样式 |
| Thread 操作菜单组件 | 揭秘按钮 |

## 9. Open Questions

1. **猫猫自己发的 whisper**：v1 不支持。但未来如果游戏需要猫猫私密回复铲屎官（如狼人杀夜晚回答），可能需要猫 → 铲屎官的 whisper。这个留到实际游戏测试后再决定
2. **WebSocket 推送**：whisper 消息通过 WebSocket 推送时，是否需要按目标猫过滤？当前 WebSocket 直接推给前端（铲屎官），所以 v1 不需要过滤。但如果未来猫猫有独立前端，需要考虑
3. **独立思考模式 + whisper 的交互**：独立思考模式下猫猫的回复已经隔离。whisper 叠加后的语义是否清晰？需要实际测试

## 10. 修订记录

| 日期 | 版本 | 变更 |
|------|------|------|
| 2026-02-19 | v0.1 | 初稿。布偶猫+缅因猫独立提案 → 铲屎官综合 → 共识 |
