---
feature_ids: [F022]
topics: [rich, blocks, format]
doc_kind: plan
created: 2026-02-20
---

# #85 Rich Blocks 格式容错 + CardBlock Markdown 渲染

> 作者：布偶猫 | 日期：2026-02-20
> BACKLOG: #85 | 关联: F22 Rich Blocks
> 砚砚 review 前置结论：方向对，但需统一 normalizeRichPayload 三入口共用

## 背景

铲屎官重启服务后实测 Rich Blocks，发现：
1. 另一只布偶猫（另一个 session 的 Opus）用了 `"type": "card"` 而非 `"kind": "card"`，整条消息显示为原始 JSON
2. CardBlock 的 `bodyMarkdown` 字段虽然名叫 markdown，但实际以纯文本渲染，`**粗体**` 不生效
3. 猫猫 system prompt 里的格式说明不够精确，导致连最聪明的 Opus 也可能写错

## 改动清单

### M1: CardBlock Markdown 渲染（P1，用户可见 bug）

**文件**: `packages/web/src/components/rich/CardBlock.tsx:18-22`
**当前**: `bodyMarkdown` 用 `<div className="whitespace-pre-wrap">{block.bodyMarkdown}</div>` 纯文本输出
**改为**: 使用已有的 `MarkdownContent` 组件（`packages/web/src/components/MarkdownContent.tsx`，已有 react-markdown + remark-gfm + remark-breaks）
**注意**: MarkdownContent 默认样式可能太大（它是给聊天消息用的），CardBlock 里要用更紧凑的样式（text-xs）

```diff
- <div className="mt-1 text-xs text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
-   {block.bodyMarkdown}
- </div>
+ <div className="mt-1 text-xs text-gray-600 dark:text-gray-300 prose prose-xs dark:prose-invert max-w-none">
+   <MarkdownContent content={block.bodyMarkdown} compact />
+ </div>
```

如果 MarkdownContent 不支持 `compact` prop，可能需要加一个，或者直接在外层 div 用 tailwind prose-xs 覆盖样式。需要实际看效果。

**测试**: 前端组件测试 — 验证 `**bold**` 渲染为 `<strong>`

### M2: 统一 normalizeRichPayload 函数（P1，三入口共用）

**新增文件/函数**: 在 `rich-block-extract.ts` 中新增 `normalizeRichBlock(raw: unknown): unknown`

**归一化规则**（"受限容错"）：
1. `type → kind` alias：如果对象有 `type` 但没 `kind`，且 `type` 值是合法 kind（card/diff/checklist/media_gallery），则映射
2. 自动补 `v: 1`：如果对象缺 `v` 字段，自动补上
3. **不做**无条件裸 JSON 转换：只有上述两种明确的归一化

```typescript
export function normalizeRichBlock(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw;
  const obj = raw as Record<string, unknown>;

  // type → kind alias
  if ('type' in obj && !('kind' in obj)) {
    const validKinds = ['card', 'diff', 'checklist', 'media_gallery'];
    if (validKinds.includes(obj['type'] as string)) {
      obj['kind'] = obj['type'];
      delete obj['type'];
    }
  }

  // 自动补 v: 1
  if (!('v' in obj) && 'kind' in obj) {
    obj['v'] = 1;
  }

  return obj;
}
```

**三个消费点接入 normalize**：

#### M2a: Route B — extractRichFromText（行 73-93）
在 `isValidRichBlock(b)` 调用前插入 `normalizeRichBlock(b)`：
```typescript
for (const b of parsed.blocks) {
  const normalized = normalizeRichBlock(b);
  if (isValidRichBlock(normalized)) {
    blocks.push(normalized);
  }
}
```

#### M2b: Route A — callbacks.ts create-rich-block（行 384-416）
在 Zod parse 之前做 normalize。当前 Zod schema 在行 68-79，用 discriminatedUnion on `kind`。
在 route handler 里，拿到 `body.block` 后先 normalize 再 parse：
```typescript
const normalized = normalizeRichBlock(body.block);
const parseResult = richBlockSchema.safeParse(normalized);
```

#### M2c: MCP tool — callback-tools.ts handleCreateRichBlock（行 177-217）
在 `JSON.parse` 后、`'id' in parsed` 检查前插入 normalize：
```typescript
parsed = JSON.parse(input.block);
parsed = normalizeRichBlock(parsed);
```

### M3: extractRichFromText 裸 JSON 数组容错（P2，受限）

**文件**: `rich-block-extract.ts:73-93`
**规则**: 除了 `cc_rich` 代码块，还检测裸 JSON 数组（仅在"强匹配"时）
**强匹配条件**:
- 整条消息的非空白内容是一个 JSON 数组
- 数组每个元素都有 `id` + (`kind` 或 `type`)
- 不碰嵌在正常文本中的 JSON

```typescript
// 在 extractRichFromText 末尾，如果没有通过 cc_rich 提取到任何 blocks：
if (blocks.length === 0) {
  const trimmed = text.trim();
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const arr = JSON.parse(trimmed);
      if (Array.isArray(arr) && arr.length > 0 && arr.every(isRichBlockCandidate)) {
        for (const b of arr) {
          const normalized = normalizeRichBlock(b);
          if (isValidRichBlock(normalized)) blocks.push(normalized);
        }
        if (blocks.length > 0) return { cleanText: '', blocks };
      }
    } catch { /* not JSON, ignore */ }
  }
}
```

其中 `isRichBlockCandidate` 只检查 `id` + (`kind` 或 `type`) 的存在性（不做完整验证）。

### M4: 提示词补强（P2）

**两个入口**（砚砚指出的）：

#### M4a: SystemPromptBuilder.ts:58
在 `cat_cafe_create_rich_block` 工具描述附近，加一行：
```
注意：字段名是 "kind"（不是 "type"！），必须有 "v": 1
```

#### M4b: McpPromptInjector.ts:124-137
在 curl 示例附近，加同样的格式提醒。

## 测试计划

| # | 测试 | 位置 |
|---|------|------|
| T1 | `normalizeRichBlock`: `type → kind` 映射成功 | rich-block-extract.test.js |
| T2 | `normalizeRichBlock`: 缺 `v` 自动补 1 | rich-block-extract.test.js |
| T3 | `normalizeRichBlock`: 非强匹配对象不转换 | rich-block-extract.test.js |
| T4 | `normalizeRichBlock`: `kind` 已存在时不覆盖 | rich-block-extract.test.js |
| T5 | `extractRichFromText`: 裸 JSON 数组强匹配提取 | rich-block-extract.test.js |
| T6 | `extractRichFromText`: 非强匹配裸 JSON 不转换 | rich-block-extract.test.js |
| T7 | Route A callback: `type` 字段的 block 归一化后通过 Zod | callback-routes.test.js |
| T8 | CardBlock: `**bold**` 渲染为粗体 | CardBlock.test.tsx (如果有) 或 web test |

## 风险与边界

1. **MarkdownContent 样式可能太大**: CardBlock 内需要 compact 样式，可能需要 prose-xs 覆盖
2. **mutating normalize**: `normalizeRichBlock` 直接修改输入对象（性能优先），调用方注意
3. **裸 JSON 误吞风险**: 强匹配条件（每元素必须有 id + kind/type）大幅降低误报率，但如果某猫用 JSON 发送结构化数据恰好包含这些字段，仍可能被错误解析。这是一个可接受的 tradeoff。
4. **SystemPromptBuilder size guard**: 改了 prompt 内容后必须跑 `node --test test/system-prompt-builder.test.js` 检查 size guard！（铲屎官铁律！）

## 实施顺序

1. M2: normalizeRichBlock + 测试 (T1-T4)
2. M2a/M2b/M2c: 三入口接入 normalize + 测试 (T7)
3. M3: 裸 JSON 容错 + 测试 (T5-T6)
4. M1: CardBlock Markdown 渲染 + 测试 (T8)
5. M4: 提示词补强 + size guard 检查
