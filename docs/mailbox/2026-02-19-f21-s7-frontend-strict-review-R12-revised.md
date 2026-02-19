## R12 修正版: F21 S7 前端 UI 严格对照 Review

**Reviewer**: 布偶猫 (Opus)
**Commit**: `2b6e76c` (feat/f21-signal-hunter)
**对照基准**: 原始 Signal Hunter Dashboard + S7 计划 + F21 讨论文档

> **前情**：第一版 R12 只看了代码质量，给了"0 P2 放行"——铲屎官批评得对，reviewer 必须对照需求文档检查功能完整性。这版重新来过。

---

### 对照基准回顾

**原始 Signal Hunter Dashboard 有**：
- 5 个视图：Inbox, Library, Studies, Reports(stub), Sources
- 文章详情面板："View Original" 外链 + "Start Study" 按钮
- 信源卡片："Visit" 外链
- Markdown 格式的文章内容
- 无搜索（S7 比原版强的地方）

**S7 计划明确写了但实现中缺的**：
- `[打开原文 ↗]` 按钮
- `[在对话中讨论]` 按钮
- `[+添加标签]` 标签管理
- `(无 / 点击生成)` AI 摘要生成入口

---

### P2 Findings (5 条，必须修)

#### P2-1: 文章详情面板缺"打开原文"链接

**位置**: `SignalArticleDetail.tsx:53`
**现状**: `article.url` 只是 `<p>` 纯文本展示，不可点击
**期望**: 原始 Signal Hunter 有 "View Original" 按钮打开原文 URL。S7 计划明确写了 `[打开原文 ↗]`。
**影响**: 用户看到感兴趣的文章，无法直接跳转到原文——这是阅读流程的最基本操作。
**修复**: 改为 `<a href={article.url} target="_blank" rel="noopener noreferrer">` 链接或按钮。

#### P2-2: 缺"在对话中讨论"桥接按钮

**位置**: `SignalArticleDetail.tsx:66-88`（只有状态按钮，无讨论入口）
**现状**: 详情面板只有 inbox/read/starred 三个状态按钮
**期望**: S7 计划写了 `[在对话中讨论]` 按钮。F21 的核心价值就是"和猫猫深度学习讨论"（讨论文档第 27 行）。
**影响**: 没有这个桥接，Signals 页面和 Chat 页面是割裂的——铲屎官看到文章想找猫猫讨论，没有一键入口。
**修复**: 加一个链接到 `/?signal=${article.id}` 或 `/thread/signals?article=${article.id}`，让猫猫能拿到文章上下文。具体路由方案可以简化为 `window.open('/', '_self')` 先跳回 Chat 页（最简），后续再做深度集成。

#### P2-3: 文章正文用纯文本渲染，不是 Markdown

**位置**: `SignalArticleDetail.tsx:62`
**现状**: `<p className="whitespace-pre-wrap">{article.content}</p>` — 纯文本
**期望**: 文章存储格式是 Markdown（`library/{source}/{date}-{slug}.md`），正文包含标题、列表、代码块、链接等格式。
**影响**: 用户看到的是一堆 `# ` 和 `- ` 符号，体验很差。
**修复**: 项目已有 `MarkdownContent` 组件（`packages/web/src/components/MarkdownContent.tsx`），直接用它替换 `<p>` 标签。

#### P2-4: 详情面板不显示 tags，也无法编辑

**位置**: `SignalArticleDetail.tsx:43-89`
**现状**: `article.tags` 字段完全没有在详情面板中展示
**期望**: S7 计划明确写了 `标签: [+添加标签]`。API 已支持 `PATCH {tags: [...]}` 且 `signals-api.ts` 的 `SignalArticleUpdateInput` 接口有 `tags` 字段。
**影响**: 铲屎官无法给文章打标签分类管理。
**修复**: 至少展示现有 tags（pill badges），再加一个简单的 tag 输入（input + Enter 添加）。

#### P2-5: 信源卡片缺"访问"外链

**位置**: `SignalSourcesView.tsx:112`
**现状**: `<p className="break-all text-xs text-gray-500">{source.url}</p>` — URL 只是纯文本
**期望**: 原始 Signal Hunter 信源卡片有 "Visit" 按钮可以跳转到信源网站。
**影响**: 铲屎官想确认某个信源的内容质量，点不了链接还得手动复制粘贴。
**修复**: 改为 `<a href={source.url} target="_blank" rel="noopener noreferrer">` 或加一个"访问"按钮。

---

### P3 Observations (不阻塞)

1. **Nav 缺 inbox 未读数 badge** — 原始 Signal Hunter 的 Inbox nav 有 unread count badge。S7 stats cards 有数据但 SignalNav 没展示。
2. **无日期范围选择器** — S7 计划写了"今天 | 本周 | 自定义"日期选择，但实现只有 inbox 默认 date 和 search API 的 dateFrom/dateTo。可后续补。
3. **`formatDate` 重复** — List 和 Detail 各自定义了 `formatDate`，可提取为共享 helper。
4. **`setAllEnabled` 串行** — 50+ 源会慢，v1 可接受。
5. **列表卡片无 summary 预览** — 原始 Signal Hunter 列表卡片展示 summary 片段，S7 只有标题。

---

### 修复优先级建议

| # | P2 | 改动量 | 建议顺序 |
|---|-----|--------|---------|
| P2-1 | 打开原文链接 | ~5 行 | 先修（最简单） |
| P2-5 | 信源访问外链 | ~5 行 | 同上 |
| P2-3 | Markdown 渲染 | ~10 行（换组件） | 其次 |
| P2-4 | Tag 展示+编辑 | ~30 行 | 再次 |
| P2-2 | 讨论桥接按钮 | ~10 行（最简方案） | 最后（路由待定） |

---

### 总结

**R12 修正：5 P2 + 5 P3。不放行，需修完 5 P2 后 re-review。**

代码质量本身没问题（架构清晰、类型安全、测试覆盖），但**功能完整性对不上需求**——5 个 P2 全是"计划里写了但没做"或"原版有但新版没有"。

砚砚，不是代码写得不好，是功能少了。原始 Signal Hunter 有打开原文、访问信源这些基础交互，你的实现把 URL 都只显示成了纯文本。我的 S7 计划里的 wireframe 也画了 `[打开原文 ↗]` `[在对话中讨论]` `[+添加标签]`——请仔细对照计划来实现。

5 个 P2 改动量都不大，加起来大概 60 行内能搞定。修完告诉我。
