---
feature_ids: [F102]
topics: [knowledge-emergence, feed, ux, brainstorm, product-design]
doc_kind: discussion
created: 2026-03-22
---

# Knowledge Emergence Workspace 头脑风暴纪要

**Thread ID**: `thread_mmygpnn83c3m0oiq` | **日期**: 2026-03-22 | **参与者**: 布偶猫(opus)、缅因猫(gpt52)、铲屎官

## 背景

Phase G abstractive summary 已跑通（543 segments，409 threads），Opus 摘要时提取 `[decision]` `[lesson]` `[method]` 标记（Durable Candidate）。铲屎官问"怎么审核？需要 UX"。

## 铲屎官核心需求

- "人是需要一个信息总入口以及可视化界面的，散落在各处的东西我如何搜集？"
- "不是审核 marker，而是知识涌现 feed"
- "我懒的自己操作" → 自然语言让猫操作 Hub
- "结合可互动的联动才是" → 参考 Workspace/Preview 交互体验

## 产品定义（两猫共识）

**Knowledge Emergence Workspace** — 让知识从对话里自然浮现 → 被猫整理 → 被人轻确认 → 反哺团队搜索与行动。

**不是**：静态 wiki / marker 审核后台 / docs 生成器 / 散落的 interactive block。

## 4 条产品原则（砚砚提出，布偶猫认同）

| # | 原则 | 含义 |
|---|------|------|
| P1 | 单入口 | 所有待确认/已沉淀/高频命中知识，都能从 Hub Feed 到达 |
| P2 | 先建议后自动 | explicit 高置信度自动沉淀，inferred 先给建议 |
| P3 | 所有自动动作可撤回 | 自动沉淀必须可追溯、可编辑、可撤回 |
| P4 | 关系服务于行动 | edges 先做上下文增强，不先做大图展示 |

## Feed 分组策略（砚砚提出）

按**动作价值**分组，不按 kind 分组：
- **需要你确认** — inferred candidates、冲突更新
- **已自动沉淀** — explicit decision/lesson/method，显示来源 + 可撤回
- **高频命中** — 正在帮助团队的知识
- **值得升级的草稿** — 某 lesson 被 3+ thread 提到 → 建议升级

## 铲屎官隐性需求（两猫挖掘）

1. "为什么现在告诉我？" — 每条要说明触发原因（砚砚）
2. "我想看变化不想重看全文" — 同一知识展示 delta（砚砚）
3. 重要性分级：阻塞型/常用型/背景型（砚砚）
4. "我不想二次录入" — 系统先生成候选，人只做 approve/edit（砚砚）
5. 知识涟漪 — 改了 decision → edges 自动提示关联文档需要更新（布偶猫）
6. 知识成长可视化 — 像 GitHub contribution graph 看积累（布偶猫）
7. 知识对话 — "我们为什么放弃 Hindsight？" → 综合叙事回答（布偶猫）

## 猫猫主动提议模式

- 对话中温和提醒："这条像一个 decision，要沉淀吗？"
- Feed 里正式处理：结构化 candidate + approve/dismiss

## 关系可视化

- 卡片内联最有用的 3 类：来源 threads · 引用的 decision/lesson · 影响的 feat/docs
- 详情页里才展开关系图，首页不做大图

## 收敛检查

1. 否决理由 → ADR？没有
2. 踩坑教训 → lessons-learned？没有（但"谄媚猫"行为需注意）
3. 操作规则 → 指引文件？没有

## 下一步

- UX 设计（Pencil MCP 出图）→ 铲屎官确认 → Design Gate → 实现
