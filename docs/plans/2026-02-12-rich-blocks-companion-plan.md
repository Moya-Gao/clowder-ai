# F22: Rich Blocks 富消息系统

> 作者：宪宪（架构）+ 砚砚（调研 + v0.2 设计）
> 日期：2026-02-12
> 状态：📋 计划完成，待铲屎官确认优先级
> 调研报告：[sillytavern-phone-ui-research.md](../research/sillytavern-phone-ui-research.md)

---

## 0. 一句话

让猫猫的消息不只是文本——可以包含代码 diff 卡片、操作按钮、图片轮播、清单等富组件，持久化存储，刷新可恢复，且不污染后续 prompt 上下文。

## 1. 动机

### 现状
猫猫回复只有纯文本 / Markdown / 图片 / tool_use 四种内容类型。

### 期望
- **协作开发**：DiffCard（代码变更预览）、ReviewActions（审批按钮）、TestRunCard（测试结果）
- **陪看电影**：ScreenshotCarousel（截图轮播）、VoiceNote（语音吐槽）
- **陪读书**：QuoteCard（引用段落）、Checklist（重点清单）
- **日常**：InfoCard（推荐/提醒）、MoodTag（心情标签）

### 为什么现在做
这是 [F10 手机端猫猫](../BACKLOG.md) 和陪伴系统的地基。没有富消息，手机上的猫猫只是一个文字聊天框。

### 灵感来源
SillyTavern Phone-UI 扩展证明了"结构化输出 → 组件渲染 → 持久化恢复 → 上下文清洁"的管线模式在生产环境可行。详见 [调研报告](../research/sillytavern-phone-ui-research.md)。

---

## 2. 架构决策

### 2.1 富块存在哪里？→ `StoredMessage.extra.rich`

**不用 `contentBlocks`** — 那是 LLM 原始输出的结构化表示（text/image/code/tool_call）。富块是**派生的交互组件**，语义不同。

```
content: "我看了这段代码，给你一个 diff 预览。"     ← 人类可读文本
contentBlocks: [{type:'text', text:'...'}]           ← LLM 原始输出（已有）
extra.rich: { v:1, blocks: [RichDiffBlock] }         ← 富组件（新增）
```

### 2.2 富块怎么产生？→ MCP 工具优先，文本 fallback

| 路线 | 适用猫 | 机制 |
|------|--------|------|
| **A（主线）** | Opus（有 MCP） | 猫调用 `cat_cafe_create_rich_block` MCP 工具 → callback → RichBlockBuffer → 落库时合并 |
| **B（fallback）** | Codex/Gemini | 猫在文本中输出 ` ```cc_rich {...} ``` ` → route-strategies 提取 → 合并到 extra.rich |

### 2.3 Group Chat？→ 已有 orchestrator

不需要新建多猫协调系统。`AgentRouter` + `route-strategies.ts` + per-cat budgets + A2A 已经解决。富块只需要挂在现有管线上。

---

## 3. 数据模型

### 3.1 新类型（放 `packages/shared/src/types/rich.ts`）

```ts
export type RichBlockKind = 'card' | 'diff' | 'checklist' | 'media_gallery';

export interface RichBlockBase {
  id: string;           // message-local stable id (e.g. "b1")
  kind: RichBlockKind;
  v: 1;                 // schema version
}

export interface RichCardBlock extends RichBlockBase {
  kind: 'card';
  title: string;
  bodyMarkdown?: string;
  tone?: 'info' | 'success' | 'warning' | 'danger';
  fields?: Array<{ label: string; value: string }>;
}

export interface RichDiffBlock extends RichBlockBase {
  kind: 'diff';
  filePath: string;
  diff: string;          // unified diff text
  languageHint?: string;
}

export interface RichChecklistBlock extends RichBlockBase {
  kind: 'checklist';
  title?: string;
  items: Array<{ id: string; text: string; checked?: boolean }>;
}

export interface RichMediaGalleryBlock extends RichBlockBase {
  kind: 'media_gallery';
  title?: string;
  items: Array<{ url: string; alt?: string; caption?: string }>;
}

export type RichBlock =
  | RichCardBlock
  | RichDiffBlock
  | RichChecklistBlock
  | RichMediaGalleryBlock;

export interface RichMessageExtra {
  v: 1;
  blocks: RichBlock[];
}
```

### 3.2 StoredMessage 扩展

`packages/api/src/domains/cats/services/MessageStore.ts`:

```ts
export interface StoredMessage {
  // ... 现有字段不变 ...
  extra?: {
    rich?: RichMessageExtra;
    // 未来: reactions, deviceMeta 等
  };
}
```

### 3.3 Redis 存储

`RedisMessageStore` 的 Hash 增加 `extra` 字段（JSON 字符串），`hydrate` 时 `safeParseExtra()`，`hardDelete` 时清空。

---

## 4. 后端管线

### 4.1 MCP 工具（路线 A 主线）

**新增工具**：`packages/mcp-server/src/tools/callback-tools.ts`

```ts
// cat_cafe_create_rich_block
// input: { block: RichBlock }
// handler: callbackPost('/api/callbacks/create-rich-block', ...)
```

沿用现有 `sendCallbackRequest(..., { enableOutbox: true })` 模式。

**新增 callback 端点**：`packages/api/src/routes/callbacks.ts`

```
POST /api/callbacks/create-rich-block
  → verify(invocationId, callbackToken)
  → richBlockBuffer.add(threadId, userMessageId, catId, block)
  → websocket 广播 system_info { type: 'rich_block', block }
```

### 4.2 RichBlockBuffer（内存暂存）

**为什么需要**：猫在流式过程中通过 MCP 创建富块，但此时 cat message 还没有 `StoredMessage.id`。Buffer 按 invocation 维度暂存，done 后合并。

```
packages/api/src/domains/cats/services/RichBlockBuffer.ts

- add(threadId, userMessageId, catId, block)
- consume(threadId, userMessageId, catId): RichBlock[]
- 内部 Map，key = `${threadId}:${userMessageId}:${catId}`
- TTL 15 分钟自动清理
```

### 4.3 route-strategies 合并点

在 `routeSerial()` 和 `routeParallel()` 的 sanitize→append 管线中，**append 之前**插入：

```ts
// route-strategies.ts, routeSerial() ~line 356
const storedContent = sanitizeInjectedContent(textContent);

// ---- 新增：富块合并 ----
const bufferedBlocks = deps.richBlockBuffer.consume(threadId, currentUserMessageId, catId);
const extractedBlocks = extractRichFromText(storedContent); // fallback 提取
const richBlocks = [...bufferedBlocks, ...extractedBlocks.blocks];
const cleanContent = extractedBlocks.cleanText; // 剥离 cc_rich 后的文本

await deps.messageStore.append({
  userId, catId, threadId,
  content: cleanContent,
  mentions: a2aMentions,
  timestamp: Date.now(),
  ...(firstMetadata ? { metadata: firstMetadata } : {}),
  ...(richBlocks.length > 0 ? { extra: { rich: { v: 1, blocks: richBlocks } } } : {}),
});
```

### 4.4 文本提取（路线 B fallback）

```ts
// 新增: packages/api/src/domains/cats/services/rich-block-extract.ts

const CC_RICH_RE = /```cc_rich\s*\n([\s\S]*?)\n```/g;

export function extractRichFromText(text: string): {
  cleanText: string;
  blocks: RichBlock[];
} {
  const blocks: RichBlock[] = [];
  const cleanText = text.replace(CC_RICH_RE, (_match, json) => {
    try {
      const parsed = JSON.parse(json);
      if (parsed?.v === 1 && Array.isArray(parsed.blocks)) {
        blocks.push(...parsed.blocks);
      }
    } catch { /* 解析失败忽略，降级为纯文本 */ }
    return '';
  }).trimEnd();
  return { cleanText, blocks };
}
```

---

## 5. Prompt 清洁器（Phone-UI 经验里最值钱的部分）

> **不清洁，上下文会发霉。** —— 砚砚 v0.1

### 5.1 问题

假设宪宪回复了一条消息，`extra.rich` 里有个 DiffCard（200 行 diff）。用户接着问问题，`route-strategies` 组装历史消息给猫：

- 如果 `extra.rich` 的 JSON 原样带进 prompt → **浪费 token + 模型可能重复输出**
- 如果完全不提 → **猫不知道自己之前画过 diff**

### 5.2 方案：摘要替换

在 `route-strategies.ts` 的 `assembleIncrementalContext()` 中（~line 167，现有 sanitize 位置），对历史消息增加一步富块摘要：

```ts
// route-strategies.ts, assembleIncrementalContext()
function digestRichBlocks(msg: StoredMessage): string {
  if (!msg.extra?.rich?.blocks?.length) return msg.content;

  const digests = msg.extra.rich.blocks.map(b => {
    switch (b.kind) {
      case 'card':    return `[卡片: ${b.title}]`;
      case 'diff':    return `[代码 diff: ${b.filePath}]`;
      case 'checklist': return `[清单: ${b.title ?? b.items.length + ' 项'}]`;
      case 'media_gallery': return `[图片: ${b.items.length} 张]`;
      default:        return `[富块: ${(b as RichBlockBase).kind}]`;
    }
  });

  return msg.content + '\n' + digests.join(' ');
}

// 在 formatMessage 时使用 digestRichBlocks 替代原始 content
```

### 5.3 效果

模型看到的历史消息：
```
宪宪: 我看了这段代码，给你一个 diff 预览。
[代码 diff: route-strategies.ts]
```

而不是 200 行 JSON。猫知道自己画过 diff，但不浪费 token。

---

## 6. 前端渲染

### 6.1 类型扩展

`packages/web/src/stores/chat-types.ts`：

```ts
interface ChatMessage {
  // ... 现有字段 ...
  extra?: { rich?: RichMessageExtra };
}
```

`useChatHistory.ts` 映射时带上 `extra`。

### 6.2 Store 增加 appendRichBlock

`chatStore.ts`，复用 `appendToolEvent` 的模式：

```ts
appendRichBlock: (messageId, block) => set((state) => {
  const messages = state.messages.map(m => {
    if (m.id !== messageId) return m;
    const rich = m.extra?.rich ?? { v: 1, blocks: [] };
    return {
      ...m,
      extra: { ...m.extra, rich: { ...rich, blocks: [...rich.blocks, block] } }
    };
  });
  return { messages };
}),
```

### 6.3 useAgentMessages 处理 system_info

在 `system_info` JSON parse 分支增加：

```ts
if (parsed?.type === 'rich_block') {
  const activeMsg = activeRefs.current.get(msg.catId);
  if (activeMsg) {
    appendRichBlock(activeMsg.id, parsed.block);
  }
  consumed = true;
}
```

### 6.4 ChatMessage.tsx 渲染

在现有消息内容（Markdown / contentBlocks）**下方**，增加富块渲染区：

```tsx
// ChatMessage.tsx, cat message 渲染区域末尾
{message.extra?.rich?.blocks && (
  <RichBlocks blocks={message.extra.rich.blocks} />
)}
```

### 6.5 组件注册表

```
packages/web/src/components/rich/
├── RichBlocks.tsx          # 遍历 blocks，按 kind dispatch
├── CardBlock.tsx           # tone 色条 + title + body + fields
├── DiffBlock.tsx           # 代码 diff 高亮（复用 highlight.js）
├── ChecklistBlock.tsx      # 勾选列表（v1 只读，v2 可交互）
└── MediaGalleryBlock.tsx   # 图片网格 / 轮播
```

`RichBlocks.tsx` 核心：

```tsx
const RENDERERS: Record<RichBlockKind, (b: RichBlock) => JSX.Element> = {
  card:           (b) => <CardBlock block={b as RichCardBlock} />,
  diff:           (b) => <DiffBlock block={b as RichDiffBlock} />,
  checklist:      (b) => <ChecklistBlock block={b as RichChecklistBlock} />,
  media_gallery:  (b) => <MediaGalleryBlock block={b as RichMediaGalleryBlock} />,
};

export function RichBlocks({ blocks }: { blocks: RichBlock[] }) {
  return (
    <div className="mt-2 space-y-2">
      {blocks.map(b => RENDERERS[b.kind]?.(b) ?? (
        <div key={b.id} className="text-xs text-gray-400">
          未知富块类型: {b.kind}
        </div>
      ))}
    </div>
  );
}
```

**安全红线**：富块只认 JSON + 受控 React 组件渲染，永不渲染模型提供的 raw HTML。

---

## 7. 降级策略

| 场景 | 行为 |
|------|------|
| `cc_rich` JSON 解析失败 | 忽略富块，只显示正文 |
| 未知 `kind` | 显示灰卡片"未知富块类型: xxx" |
| MCP callback 超时 | 富块进 outbox 重试，不阻塞消息落库 |
| 前端版本旧，不认识新 kind | 灰卡片降级，不影响正文 |

---

## 8. 实施步骤（按依赖顺序）

### Phase A: 数据层（地基）

| # | 改什么 | 在哪 | 大小 |
|---|--------|------|------|
| A1 | 新增 `rich.ts` 类型定义 + 导出 | `packages/shared/src/types/` | S |
| A2 | `StoredMessage` 增加 `extra` 字段 | `MessageStore.ts` | S |
| A3 | `RedisMessageStore` 支持 `extra` 存取 + hardDelete 清空 | `RedisMessageStore.ts` | M |
| A4 | `RichBlockBuffer` 内存版 + TTL | 新文件 `RichBlockBuffer.ts` | M |

### Phase B: 后端管线

| # | 改什么 | 在哪 | 大小 |
|---|--------|------|------|
| B1 | `extractRichFromText()` 提取 + 剥离 | 新文件 `rich-block-extract.ts` | S |
| B2 | route-strategies 合并点（buffer consume + extract + append） | `route-strategies.ts` ~L356, ~L601 | M |
| B3 | **Prompt 清洁器** `digestRichBlocks()` | `route-strategies.ts` assembleIncrementalContext | M |
| B4 | callback 端点 `/create-rich-block` | `callbacks.ts` | M |
| B5 | MCP 工具 `cat_cafe_create_rich_block` | `callback-tools.ts` | S |

### Phase C: 前端

| # | 改什么 | 在哪 | 大小 |
|---|--------|------|------|
| C1 | `ChatMessage` 类型加 `extra.rich` | `chat-types.ts` | S |
| C2 | store `appendRichBlock` 方法 | `chatStore.ts` | S |
| C3 | `useAgentMessages` 处理 `rich_block` | `useAgentMessages.ts` | S |
| C4 | `useChatHistory` 映射 extra | `useChatHistory.ts` | S |
| C5 | `RichBlocks` + 4 个 renderer 组件 | 新目录 `components/rich/` | M |
| C6 | `ChatMessage.tsx` 挂载 `<RichBlocks>` | `ChatMessage.tsx` | S |

### Phase D: API 返回

| # | 改什么 | 在哪 | 大小 |
|---|--------|------|------|
| D1 | `GET /api/messages` 返回 extra | `messages.ts` TimelineItem 映射 | S |

---

## 9. 这个 feat 之后能解锁什么

```
F22 Rich Blocks (本计划)
  │
  ├─→ F10 手机端猫猫（富消息 + PWA 适配 = 手机上的猫猫有内容可看）
  │
  ├─→ 场景 persona preset（写代码 → 陪看电影，猫猫切换状态）
  │
  ├─→ 猫猫主动找你（推送 + 富消息卡片 = 不只是文字通知）
  │
  └─→ 开发工具增强（DiffCard + ReviewActions = 代码协作可视化）
```

---

## 10. 刻意不做的事（v1 边界）

- **不做第三方插件系统**：富块 renderer 是内部注册表，不开放
- **不做富块交互状态持久化**：Checklist 勾选、Carousel 翻页等 v2 再做
- **不做 E2EE**：数据结构预留空间，但不现在实现
- **不做模型输出格式强制**：MCP 工具是主线，文本标签只是 fallback
- **不引入 Zod**：TypeScript 类型 + 运行时 safeParse 守卫
- **不新建 package**：类型放 `@cat-cafe/shared`
