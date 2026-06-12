---
feature_ids: [F232]
related_features: [F148, F063, F095, F131]
topics: [artifacts, thread, workspace, ui]
doc_kind: spec
created: 2026-06-11
---

# F232: Thread Artifacts Panel — Thread 产物视图

> **Status**: spec | **Owner**: 宪宪 Opus-4.8 | **Priority**: P1

## Why

铲屎官原话（2026-06-11）：

> "我经常遇到我想要看 **这个 thread 的某个产物**！但是忘记名字是啥了！在我们的 workspace 里搜半天 or 这时候只能喊猫来…… 这个能力好像 codex app claude app 之类都有的"

一个 thread 跑下来会产出一堆东西——图、文档、代码改动、PR、语音——但它们**散在消息流、`/uploads/`、git、PR 各处，没有一张按 thread 聚合的清单**。铲屎官想回看某个产物时，只能翻聊天记录、在 workspace 里搜半天、或者喊猫帮找，全靠记名字。

**价值**：让铲屎官不用记名字、不用搜半天、不用喊猫——点开一个 thread 就能浏览 / 筛选 / 搜索 / 跳转到它产生的所有产物。这是 Claude/ChatGPT 的 artifacts 面板的"thread 级"加强版（他们只管"对话里生成的可编辑文档"，我们产物类型更多：代码、PR、设计稿、语音都算）。

## Current State / 现状基线

产物数据 **~80% 已存在但散落、无聚合视图**（2026-06-11 双 Explore agent 调研结论）：

| 产物类型 | 现在存哪 | 可查询性 |
|---------|---------|---------|
| 图 / 文件 / 代码 diff / 语音（rich blocks） | `msg:{id}.extra.rich.blocks[]`（Redis Hash，可按 `msg:thread:{threadId}` 捞消息后遍历提取） | ⚠️ 需遍历消息，无 kind 索引 |
| 生成的 PDF/DOCX、AI 图 | `/uploads/` 文件系统 + rich file/media_gallery block | ⚠️ 通过 rich block 间接 |
| 改动的代码文件 + PR | session digest `filesTouched` + task store（`pr_tracking`，支持 threadId 过滤） | ✅ PR 可查；文件可推导 |

- **已有地基**：`packages/api/src/domains/cats/services/agents/routing/artifact-tracking.ts`（F148）已经会追踪 PR / 文件 / 文档 / plan 并去重排序——但只**喂猫做冷启动 context**（`MAX_ARTIFACTS = 5`），不暴露 API、不含 rich blocks、不聚合成 thread 视图。
- **缺口**：① 一个"按 threadId 聚合所有产物"的查询 / API ② 一个 UI 面板入口。grep 确认**无任何** `list_thread_artifacts` / thread 产物面板入口（数据层 ~80% 现成，查询层 ~5%，UI 层 0%）。

## What

### Phase A: Thread 内产物视图（MVP）

点开任意 thread → 右侧「产物」抽屉，自动列出该 thread 产生的所有产物，按时间倒序，可按类型筛选 / 搜索 / 跳回原消息。

- **后端**：新增 `GET /api/threads/:threadId/artifacts` —— 遍历 thread 消息提取 rich blocks（`file` / `media_gallery` / `diff` / `audio`）+ session digest `filesTouched` + `pr_tracking` tasks，聚合 / 去重 / 按时间排序，**复用 `artifact-tracking.ts` 的去重 + 分类逻辑**（解除其 `MAX_ARTIFACTS=5` 限制，扩展产物类型）。统一返回 `{ type, name, catId, createdAt, sourceMessageId, url? }`。
- **前端**：thread 右侧抽屉「产物」面板（OQ-1 已定抽屉，非 tab）。类型筛选 chips + thread 内搜索 + 时间倒序列表 + 每项「跳回原消息」。复用 `MediaGalleryBlock` / `FileContentRenderer` / `WorkspaceTree` 等现有组件。图标用 **inline SVG**（非 emoji，家规）。
- **设计稿**：低保真 wireframe 已出 + CVO 确认（见 Links）。

### Phase B: 全局产物中心（未来扩展）

把聚合 scope 从"单 thread"放开到"全部"——独立页面，跨所有 thread 按名字 / 类型 / 时间 / 哪只猫做的搜产物，顺带解决"在 workspace 里搜半天"。**Phase A 的聚合管线就是 Phase B 的地基**，不重写。

## Acceptance Criteria

<!-- 立项愿景硬度自检（F216→F219）：每条 AC ① trace 回 Why 的某诉求 ② 非作者可复核（命令/数字/截图）。 -->

### Phase A（Thread 内产物视图）
- [ ] AC-A1: `GET /api/threads/:threadId/artifacts` 返回该 thread 全部产物（rich blocks + 生成文件 + PR），按时间倒序，每项含 `type / name / catId / createdAt / sourceMessageId`。有 test 覆盖。（trace: "搜半天找不到" → 一次聚合拿全）
- [ ] AC-A2: 产物可按类型筛选（图 / 文件 / 代码·PR / 语音 / 全部），各类计数与列表一致。（trace: "忘记名字" → 按类型缩小范围）
- [ ] AC-A3: thread 内产物名搜索（子串匹配，不用记全名），命中实时过滤。（trace: 铲屎官原话"忘记名字是啥了"）
- [ ] AC-A4: 每个产物可「跳回原消息」（`sourceMessageId` 锚点跳转），定位到生成它的对话位置。（trace: "想看这个 thread 的某个产物"→ 找到还能回现场）
- [ ] AC-A5: 前端右侧抽屉面板，视觉对齐低保真设计稿（assets/F232/），图标用 inline SVG（**禁 emoji**，家规），≤3 张实现截图 + "需求→截图"映射表。
- [ ] AC-A6: 聚合查询有 **Redis-backed 测试**覆盖（in-memory store 测不到索引/分页差异，LL `feedback_inmemory_store_tests_miss_redis_behavior`）。

### Phase B（全局产物中心 — 未来）
- [ ] AC-B1: 全局产物搜索页，跨 thread 按名字 / 类型 / 时间 / 猫聚合检索。
- [ ] AC-B2: 复用 Phase A 聚合管线，不重写采集层。

## Dependencies

- **Related**: F148（复用 `artifact-tracking.ts` 去重/分类逻辑 + 解除 MAX_ARTIFACTS=5）
- **Related**: F063（Hub Workspace Explorer — Claude.ai Artifacts panel 风格可借鉴；F063 是 repo 文件树视角，F232 是 thread 产物聚合视角，scope 不重叠）
- **Related**: F095（Thread Sidebar — 抽屉面板 UI 落点参考）
- **Related**: F131（Workspace Navigator — 文件导航 / 打开能力复用）

## Risk

| 风险 | 缓解 |
|------|------|
| rich blocks 无 kind 索引，大 thread 遍历消息提取慢 | Phase A 按 thread 规模评估；必要时加 Redis 反向索引 `artifacts:thread:{id}`（消息附加时写入）。OQ-2 |
| 跨 session 同一文件被多次 touch，去重规则 | 复用 `artifact-tracking.ts` 去重 + 记录首次出现/末次修改时间 |
| in-memory route 测试假绿（掩盖 Redis 索引/分页差异） | AC-A6 强制 Redis-backed 测试 |

## Open Questions

| # | 问题 | 状态 |
|---|------|------|
| OQ-1 | 面板形态：抽屉 vs tab | ✅ 抽屉（CVO 2026-06-11，贴"随聊随看"手感） |
| OQ-2 | Phase A 是否需 Redis 反向索引加速，还是遍历消息够用 | ⬜ 实现时按 thread 规模实测评估 |
| OQ-3 | 产物收录范围是否含 `html_widget` / `interactive` block | ⬜ Phase A 先收 file/media_gallery/diff/audio + PR + 文件，其余末期评估 |

## Key Decisions

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1 | 形态 = thread 内产物视图（A）先行，全局中心（B）为未来扩展，A 是 B 的地基 | 最贴铲屎官原话"这个 thread 的产物"+ 数据层现成最快见效 + 不返工。CVO 拍板 | 2026-06-11 |
| KD-2 | 图标用 inline SVG，禁 emoji（家规 `feedback_design_to_code_fidelity`）。**html_widget 沙箱里 SVG 必须 inline，`symbol`+`use` 引用会被无 same-origin 的 sandbox iframe 挡掉只剩空槽** | 本 feat 低保真 mockup 实测教训（v2 用 symbol/use → 铲屎官侧图标全空；v3 改 inline → playwright 验证 28/28 渲染） | 2026-06-11 |
| KD-3 | 数据层复用 artifact-tracking（F148）+ rich blocks + session digest，不新建采集 | 现状 ~80% 数据已存在，缺的是聚合 + UI，避免重造 | 2026-06-11 |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-06-11 | 立项（CVO signoff "我觉得ok了 你立项"）；Design Gate UX 低保真已确认 |

## Design Gate

- **UX（前端）**：✅ 低保真 wireframe 已出 + CVO 确认（"我觉得ok了"，2026-06-11）。Architecture cell / design-in-context 截图映射 / Redis 测试契约在 `writing-plans` 前补齐。
- **Architecture cell**: 待 writing-plans 前确认（候选 threads / cats-messaging surface）；Map delta: update required（新增 artifacts 聚合 endpoint + thread 抽屉面板）。
- **Eval Contract**: 不触发（产品 feature，非 harness/skill/MCP/shared-rules）。

## Review Gate

- Phase A: 后端聚合 API + 前端面板 → 跨族 review（@gpt52 / @codex）；UX 风格 → @gemini 守门。

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| **设计稿（低保真 HTML）** | `docs/features/assets/F232/artifacts-panel-mockup.html` | v3 低保真 wireframe（self-contained，inline SVG 图标，chips 可交互过滤） |
| **设计稿（渲染截图）** | `docs/features/assets/F232/artifacts-panel-lowfi.png` | Playwright 离屏渲染真容（28/28 图标验证通过） |
| **Related** | `docs/features/F148-hierarchical-context-transport.md` | artifact-tracking 数据基础 |
| **Related** | `docs/features/F063-hub-workspace-explorer.md` | Artifacts panel UI 风格参考 |
