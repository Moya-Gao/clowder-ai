---
feature_ids: [F063]
related_features: [F060, F058]
topics: [hub, ux, workspace, file-browser, code-preview, collaboration]
doc_kind: spec
created: 2026-03-05
---

# F063: Hub Workspace Explorer — 铲屎官不用打开 IDE 也可以和猫猫们优雅协作

> **Status**: spec
> **Owner**: 布偶猫 (Opus 4.6, Leader)
> **Created**: 2026-03-05

## Why

铲屎官和猫猫是**共创伙伴**，但目前协作时铲屎官被挡在 IDE 门外：

1. 猫猫说"看 `codex-event-transform.ts:172`"→ 铲屎官要切 WebStorm、搜文件、找行号、读不是自己写的代码
2. 猫猫改了 spec/提示词模板 → 铲屎官要去 IDE 翻文件才能看到内容
3. 遇到反复出现的系统问题需要铲屎官协助梳理时 → "所有和提示词注入有关的代码在哪？"要猫猫回答或自己搜关键词
4. 审计日志/session 事件目前只能在 VSCode 里看，铲屎官帮忙定位问题需要在 IDE 和 Hub 之间反复切换

**核心判断**：Claude.ai 的 Project Context + Artifacts 能力证明了"在对话旁边直接操作文件和预览"是可行的。以前做这个要人类开发一个月，现在猫猫一天就能做——**没有理由先做临时方案再做正式方案**（铲屎官原话："绕路了"）。

## What

### Phase 1: Workspace File Explorer（P0）

在 Hub 侧边栏或面板中展示当前仓库的文件系统：

1. **文件树浏览**
   - 当前猫猫所在仓库的目录树（如 `cat-cafe/`、`dare-framework/`）
   - 展开/折叠目录，点击查看文件内容
   - 文件图标按类型区分（.ts/.md/.json/.png 等）

2. **文件内容查看**
   - 代码文件：语法高亮 + 行号
   - Markdown 文件：渲染后展示（或 raw + rendered 双模式）
   - 图片文件：直接预览
   - 大文件：按需加载（只加载可视区域）

3. **搜索**
   - 全文搜索：输关键词 → 搜遍仓库 → 返回匹配文件+行号+上下文
   - 文件名搜索：快速定位（fuzzy match）
   - 铲屎官的典型用法："所有和提示词注入有关的代码" → 搜 `system prompt` / `SystemPromptBuilder` → 直接看结果

4. **猫猫联动**
   - 猫猫提到文件路径/行号时 → Hub 自动识别 → 点击跳转到文件内容面板
   - 猫猫发 `diff` rich block → 点击可在文件面板中查看完整文件上下文
   - 铲屎官在文件面板中选中代码 → 可直接引用到对话中问猫猫

### Phase 2: Code Preview & Rendering（P0-P1，与 Phase 1 不冲突就并行）

在 Hub 中直接渲染前端代码预览：

1. **HTML/JSX 预览**
   - 猫猫输出的 React/HTML 组件 → 在 Hub 内 iframe sandbox 渲染
   - 类似 Claude.ai Artifacts 的实时预览能力
   - 支持 Tailwind CSS（我们的设计系统基础）

2. **设计稿预览**
   - `.pen` 文件 → 调用 Pencil MCP 渲染预览
   - 图片文件 → 直接展示
   - SVG → 直接渲染

3. **Diff 可视化**
   - 文件变更的 side-by-side 或 unified diff 视图
   - 比 rich block 里的纯文本 diff 更易读

### Phase 3: Runtime & Audit Explorer（P1）

运行时数据的查看能力：

1. **Session 事件查看器**
   - 当前已在 VSCode 中以"109 条事件 · 24 个日志文件"方式查看
   - Hub 内提供同等查看体验 + 过滤/搜索
   - 和对话上下文联动（"这个 session 出了什么问题？"→ 直接看事件）

2. **日志浏览**
   - API 日志、agent 日志按时间线展示
   - 铲屎官协助定位问题时不需要切到 VSCode

3. **上传文件管理**
   - runtime 的 uploads 目录浏览
   - 图片预览、文件下载

## Technical Direction（待讨论）

### 后端：文件系统 API

需要在 API 层新增文件系统相关端点：

```
GET /api/workspace/tree?path={dir}&depth={n}    — 目录树
GET /api/workspace/file?path={filePath}          — 文件内容
GET /api/workspace/search?q={keyword}&type=content|filename  — 搜索
```

**安全边界**：
- 只暴露猫猫当前 worktree / 仓库目录，不暴露系统文件
- 路径 traversal 防护（`../` 等）
- 大文件限制（>1MB 按需分页）
- 敏感文件过滤（`.env`、credentials 等）

### 前端：布局方案

几种可能的 UX 布局（**需要烁烁参与讨论**）：

| 方案 | 描述 | 优劣 |
|------|------|------|
| **侧边栏** | 类似 Claude.ai，对话左侧+文件右侧 | 标准模式，空间分配固定 |
| **可拖拽面板** | 文件面板可拖拽、resize、最小化 | 灵活但复杂 |
| **Tab 切换** | 对话和文件浏览器作为 Tab 切换 | 简单但不能同时看 |
| **弹出窗口** | 点击文件链接 → 弹出 modal 查看 | 最简单但体验碎片化 |

### 前端预览：技术选型

| 方案 | 描述 | 优劣 |
|------|------|------|
| **iframe sandbox** | 将 HTML/JSX 编译后注入 iframe | 安全隔离好，标准做法 |
| **Monaco Editor + Preview** | 编辑器 + 旁边预览 | 功能强大但重 |
| **Sandpack (CodeSandbox)** | React 专用的浏览器内编译+预览 | 开箱即用，但依赖重 |

## Acceptance Criteria

- [ ] AC-1: 铲屎官在 Hub 中可浏览当前仓库目录树（至少 3 层深度）
- [ ] AC-2: 点击文件可查看内容（代码文件有语法高亮+行号）
- [ ] AC-3: 全文搜索可搜到文件内容并展示匹配上下文
- [ ] AC-4: 猫猫消息中的文件路径可点击跳转到文件查看
- [ ] AC-5: HTML/React 组件可在 Hub 内预览渲染效果（Phase 2）
- [ ] AC-6: 文件查看面板和对话面板可同时可见（50:50 分栏）
- [ ] AC-7: 路径安全（不能访问仓库外的系统文件）
- [ ] AC-8: 图片文件可直接预览
- [ ] AC-9: 铲屎官可在 Hub 内编辑文件，猫猫可直接 commit 编辑结果
- [ ] AC-10: 文件系统感知 worktree（显示猫猫当前 worktree 的文件，而非只有 main）
- [ ] AC-11: 顶栏有切换按钮，点击后聊天窗口缩小 + 右侧文件面板展开

## 需求点 Checklist

| ID | 需求点（铲屎官原话/转述） | AC 编号 | 验证方式 | 状态 |
|----|---------------------------|---------|----------|------|
| R1 | "我得打开 vscode 或者 webstorm 然后搜索你说的文件" | AC-1, AC-2 | manual: Hub 内查看文件 | [ ] |
| R2 | "所有和提示词注入有关的代码？我就得想好久得搜什么关键字" | AC-3 | manual: Hub 内全文搜索 | [ ] |
| R3 | "猫猫提到了个文件，此时我翻半天，还得找行号" | AC-4 | manual: 点击文件路径跳转 | [ ] |
| R4 | "claude ai 里面前端他们也能帮你直接打开文件系统 html jsx 直接展示" | AC-5 | manual: Hub 内渲染预览 | [ ] |
| R5 | "如果定位问题遇到困难铲屎官一起帮忙会很有用" | AC-1, AC-2, AC-3 | manual: 铲屎官在 Hub 内查看代码协助排查 | [ ] |
| R6 | "审计日志...事实上确实很多时候需要协助查看" | — (Phase 3) | Phase 3 实现后验证 | [ ] |
| R7 | "文件系统指的是你们的运行仓库的文件" | AC-7 | test: 仅暴露仓库内文件 | [ ] |
| R8 | "这个是我们非常重要的一环体验？如何 ux 如何布局？" | AC-6, AC-11 | visual: 烁烁 review 布局 | [ ] |
| R9 | "聊天窗口变小 文件系统右边代替状态栏出来 五五开" | AC-6, AC-11 | manual: 顶栏按钮切换分栏 | [ ] |
| R10 | "如果是可以编辑的话 那有什么我帮你们编辑 复制进来" | AC-9 | manual: 铲屎官编辑+猫猫 commit | [ ] |
| R11 | "咱项目是有 worktree 的！所以这点也得考虑" | AC-10 | manual: 切换查看不同 worktree | [ ] |

### 覆盖检查
- [x] 每个需求点都能映射到至少一个 AC
- [x] 每个 AC 都有验证方式
- [ ] 前端需求已准备需求→证据映射表（若适用）— Phase 2 时补充

## Links

- **Related**: [F060 output_image 富文本渲染](F060-output-image-rich-block.md) — 图片展示能力是基础
- **Related**: [F058 Mission Control 增强](F058-mission-control-enhancements.md) — 运行时状态查看有重叠
- **Inspiration**: Claude.ai Project Context + Artifacts 体验

## Key Decisions

| 决策 | 选项 | 结论 | 决策者 |
|------|------|------|--------|
| 文件浏览 vs 前端预览优先级 | 分开做 / 一起做 | **不冲突就一起做，冲突则文件先行** | 铲屎官 (2026-03-05) |
| 方案选择 | A 猫猫主动发 / B 侧边栏 / C 完整 Project | **直接做 B/C，不做临时方案 A** | 铲屎官 (2026-03-05) |
| 文件系统范围 | 仓库文件 / 仓库+runtime | **仓库文件为主，runtime 辅助** | 铲屎官 (2026-03-05) |
| 布局方案 | 侧边栏 / Tab / Modal / 可拖拽 | **顶栏按钮切换，右侧文件系统取代状态栏，聊天:文件 = 50:50** | 铲屎官 (2026-03-05) |
| 文件编辑能力 | 只读 / 可编辑 | **可编辑** — 铲屎官帮忙编辑后猫猫可直接 commit | 铲屎官 (2026-03-05) |
| Worktree 感知 | 忽略 / 感知 | **必须感知 worktree** — 猫猫可能在不同 worktree 工作，文件系统需显示对应 worktree 的文件 | 铲屎官 (2026-03-05) |
| 参考实现 | 自研 / 参考现有 | **参考 Claude.ai Project + Codex 布局**，取其精华 | 铲屎官 (2026-03-05) |

## Dependencies

- **Related**: F060（图片渲染能力）
- **Related**: F058（运行时状态展示）
- **UX Design**: 需要暹罗猫参与布局讨论

## Risk

| 风险 | 影响 | 缓解 |
|------|------|------|
| 文件系统 API 路径遍历漏洞 | 安全隐患 | 白名单 + 路径规范化 + 砚砚安全 review |
| 大仓库文件树加载慢 | 体验差 | 懒加载 + 深度限制 + 缓存 |
| 前端预览的代码注入风险 | XSS | iframe sandbox + CSP 策略 |
| 布局影响现有聊天体验 | 回归 | 渐进式：先做可收起的侧边栏 |

## Open Questions

1. ~~布局方案？~~ → **已拍板**: 顶栏按钮切换，右侧文件面板取代状态栏，50:50 分栏
2. ~~文件编辑能力？~~ → **已拍板**: 可编辑，铲屎官编辑后猫猫可 commit
3. ~~Worktree 感知？~~ → **已拍板**: 必须感知，显示猫猫当前 worktree
4. 前端预览的技术选型：iframe sandbox vs Sandpack vs 其他？
5. 文件搜索用什么后端？直接 `grep -r` 还是建索引？
6. 猫猫消息中的文件路径自动识别：regex 够用还是需要更智能的方案？
7. 文件编辑的冲突处理：猫猫和铲屎官同时编辑同一文件怎么办？
8. Worktree 切换 UI：怎么让铲屎官知道当前看的是哪个 worktree？dropdown？标签？

## Review Gate

- **Self-check**: `quality-gate`
- **Reviewer**: 跨 family（缅因猫关注安全，暹罗猫关注 UX）
- **Cloud review**: 合入前必须

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-03-05 | 铲屎官提出痛点："打开 vscode 搜文件太痛了" |
| 2026-03-05 | 确认方向：直接做 B/C 方案，不做临时方案 A |
| 2026-03-05 | 铲屎官拍板布局：顶栏按钮 + 右侧文件面板 + 50:50 分栏 |
| 2026-03-05 | 铲屎官拍板：可编辑 + 必须感知 worktree |
| 2026-03-05 | 愿景口号：**铲屎官不用打开 IDE 也可以和猫猫们优雅协作** |
| 2026-03-05 | F063 立项，@ 烁烁(UX) + 砚砚(安全) 参与讨论 |
