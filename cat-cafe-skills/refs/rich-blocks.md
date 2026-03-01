# Rich Blocks Reference

> 降级自 `using-rich-blocks` skill。按需查阅。

## 何时用 Rich Block

结构化信息默认用 rich block；随意聊天用纯文本。发 block 前先写 1-2 句自然语言摘要。

### 用 rich block

| Kind | 场景 |
|------|------|
| card | Review 结论、状态报告、决策摘要 |
| diff | 代码修改建议、重构前后对比 |
| checklist | 待办项、检查清单、验证步骤 |
| media_gallery | 截图、设计稿、多图对比 |
| audio | 问候、情感表达（系统自动合成语音） |

### 不用 rich block

随意聊天、短回答、技术讨论、不确定用哪种时。

## 字段规格

**关键：字段是 `"kind"` 不是 `"type"`！每个 block 必须有 `"v": 1` 和唯一 `id`。**

| Kind | 必填 | 可选 |
|------|------|------|
| card | title | bodyMarkdown, tone (info/success/warning/danger), fields |
| diff | filePath, diff | languageHint |
| checklist | items (id+text) | title |
| media_gallery | items (url) | title, alt, caption |
| audio | text | — |

## 创建方式

1. **HTTP Callback（推荐）** — 见 `refs/mcp-callbacks.md` create-rich-block 端点
2. **MCP Tool** — `cat_cafe_create_rich_block`
3. **Inline Text（fallback）**：
````
```cc_rich
{"v":1,"blocks":[{"id":"b1","kind":"card","v":1,"title":"标题","tone":"info"}]}
```
````

优先用 HTTP callback。`cc_rich` 仅在 HTTP 不可用时使用。

### card tone 语义

| Tone | 用途 |
|------|------|
| info | 一般信息 |
| success | 成功/通过 |
| warning | 需注意 |
| danger | 错误/阻塞 |
