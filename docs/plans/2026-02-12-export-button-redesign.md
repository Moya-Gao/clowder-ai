# F17b: 导出按钮重新设计 + 文本下载

> 日期：2026-02-12
> 来源：铲屎官反馈 — 长截图导出按钮太丑，和我们的风格不符合
> 铲屎官对齐：✅ 2026-02-12 讨论确认

## 背景

当前 `ExportImageButton` 的问题：
1. **蓝色 `bg-blue-500`** — Tailwind 默认蓝，不属于我们猫猫配色系统
2. **实心填充按钮** — header 其他按钮都是 ghost 幽灵风格 (`p-1 rounded-lg hover:bg-owner-light`)
3. **emoji `📸`** — header 其他图标都是 SVG（PawIcon、hamburger、status panel），用 emoji 不协调
4. **文字标签外露** — header 其他按钮都是 icon-only + tooltip，只有这个露着文字

## 设计方案（铲屎官确认）

### S1: 统一按钮为 icon-only 下载按钮

**视觉**：
- icon-only 幽灵按钮，和 sidebar toggle / status panel toggle **完全一致**的风格
- `p-1 rounded-lg hover:bg-owner-light transition-colors`
- 常态 `text-gray-500`，hover 时 `text-gray-700`
- 画一个 **下载/导出 SVG icon**（`DownloadIcon`），遵循 `currentColor` + `className` 的项目惯例
- Loading 状态用已有的 `LoadingIcon`（`animate-spin`）
- 保留 `title="导出对话"` tooltip

### S2: 点击后弹出格式选择

点击下载按钮后，弹出一个小型下拉菜单（dropdown），提供格式选择：

| 选项 | 格式 | 后端 API | 说明 |
|------|------|----------|------|
| 导出长图 (PNG) | `.png` | `POST /api/threads/:id/export-image` | 已有 — Puppeteer 截图 |
| 下载聊天记录 (Markdown) | `.md` | `GET /api/export/thread/:id?format=md` | 已有 — 文本导出 |
| 下载聊天记录 (TXT) | `.txt` | `GET /api/export/thread/:id?format=txt` | **新增** — 纯文本版 |

### S3: 后端新增 `format=txt` 支持

在 `export.ts` 中新增 `formatThreadAsText()` — 与 Markdown 版本类似但去掉 Markdown 语法标记，
更适合复制粘贴或纯文本阅读。

## 不做的事情

- 不改 `ImageExporter.ts` / Puppeteer 逻辑（那部分工作正常）
- 不做 PDF 导出（当前没需求）
- 不改后端 API 路径结构

## 文件变更预估

| 文件 | 变更 |
|------|------|
| `packages/web/src/components/ExportImageButton.tsx` | 重写 → `ExportButton.tsx`（icon-only + dropdown） |
| `packages/web/src/components/icons/DownloadIcon.tsx` | **新增** — SVG 下载图标 |
| `packages/web/src/components/ChatContainer.tsx` | 更新 import |
| `packages/api/src/routes/export.ts` | 新增 `format=txt` 分支 + `formatThreadAsText()` |
| `packages/api/test/export-route.test.js` | 新增 txt 格式测试 |

## 验收标准

1. 下载按钮在 header 中视觉上和 sidebar/status panel toggle 一致
2. 点击弹出下拉菜单，3 个选项
3. PNG 导出功能不变
4. MD 下载功能不变
5. 新增 TXT 下载，内容正确
6. Loading 状态正确（导出中显示 spinner，菜单关闭）
7. 后端测试覆盖 txt 格式
