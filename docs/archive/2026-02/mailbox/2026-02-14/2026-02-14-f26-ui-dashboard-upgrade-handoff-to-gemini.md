---
feature_ids: [F026]
topics: [dashboard, upgrade, handoff]
doc_kind: mailbox
created: 2026-02-14
---

# 交给暹罗猫: F26 UI Dashboard Upgrade — 前端设计 + 实现

> **From**: 布偶猫 (宪宪)
> **To**: 暹罗猫
> **Date**: 2026-02-14
> **Type**: 工作交接

---

## What

F26 是一次右侧状态面板的 UI 升级，你负责**全部前端设计和实现**，用 Pencil Skill 出设计稿再写组件。

完整设计文档在这里，**请先读完再动手**：

> **[`docs/plans/2026-02-14-ui-dashboard-upgrade.md`](../plans/2026-02-14-ui-dashboard-upgrade.md)**

文档里有：线框图、数据类型定义、组件拆分、参考组件列表、设计约束（w-72 / design tokens / 品牌色）。你需要的信息都在里面，这封信只补 plan 里没写的上下文。

## Why

两个体验痛点驱动这次升级：

1. **信息丢失**: 铲屎官在一个 thread 里喊过三只猫，但下一轮只 @布偶猫，右面板就只剩布偶猫——其他两只猫的调用数据消失了。根因是渲染绑定 `targetCats`（最近一轮目标），不是所有历史参与者
2. **执行进度不可见**: 我们三只猫用 TaskCreate / write_todos 管理执行计划，但前端看不到——铲屎官想在右面板实时看到 checklist 进度

## Tradeoff

- 选择在现有右面板上改造，**不新开独立页面** — 信息离手边近才有用
- Codex 没有结构化 task 工具，所以它的进度显示是 reasoning 文本 fallback，精度不如你和我的 — 可以接受，不值得为此造 parser
- 没做拖拽/自定义布局 — 过度设计，288px 宽度也放不下

## Open Questions

1. **你的 `write_todos` 工具的实际输入 schema 是什么？** plan 里标了"待确认"。你下次用这个工具时能留意一下输出的 NDJSON 格式，或者直接跑一次 `gemini -p "make a plan to..." -o stream-json` 抓一下
2. Pencil Skill 出的设计稿能否直接导出 React/Tailwind？如果能，实施会快很多
3. 折叠动画你有偏好吗？现有项目里没有统一的折叠组件，你可以自己定

## Next Action

**你的 Phase B + C**（plan 第 7 节）：

1. 读 plan 文档，确认你理解数据接口（`CatInvocationInfo.taskProgress`）
2. 用 Pencil Skill 出设计稿：右面板分区布局 + CatTaskProgress checklist + CatReasoningHint
3. 写 React 组件，接 store 数据

我会先完成 Phase A（后端 task 提取 + shared types），给你提供数据。但你可以先做设计稿，不依赖后端。

---

交接五件套自检:
- [x] What: F26 前端全部，详见 plan
- [x] Why: 信息丢失 + 进度不可见
- [x] Tradeoff: 改造现有面板、Codex fallback 可接受、不做拖拽
- [x] Open Questions: write_todos schema、Pencil 导出能力、折叠动画
- [x] Next Action: 读 plan → Pencil 设计稿 → 写组件
