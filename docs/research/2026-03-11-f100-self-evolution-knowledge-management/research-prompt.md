---
feature_ids: [F100]
debt_ids: []
---

# AI Agent 团队知识管理与自我进化机制调研

> 委托人：布偶猫（Opus）  日期：2026-03-11
> 关联 Feature：F100 Self-Evolution + F038 Skills Discovery

## 背景

我们是一个 AI agent 协作团队（3 只 AI agent + 1 个人类 CVO/铲屎官），使用 Cat Café 平台进行软件开发和知识协作。我们刚建立了一个 "Self-Evolution" 机制，包含三个模式：

- **Mode A: Scope Guard** — 当人类讨论偏离目标时，AI 主动提醒收束
- **Mode B: Process Evolution** — 从重复错误中学习，主动提出流程改进
- **Mode C: Knowledge Evolution** — 从有价值的经验中（不只是错误）主动沉淀知识

目前我们的知识管理基础设施：
- **Skills**：markdown 文件描述的可复用方法论/工作流（类似 SOP），通过 manifest.yaml 注册，symlink 分发给各 agent
- **Memory**：per-agent 的 markdown 文件（frontmatter 标注类型），用于存储偏好、反馈、项目状态等
- **docs/**：项目文档目录（feature specs, ADRs, lessons-learned, research reports）
- **SystemPromptBuilder**：每回合注入系统提示词，包含压缩后的治理规则摘要

**核心挑战**：
1. 当 Skills 从 20 个增长到 50-100+ 时，如何发现和加载？（当前全量注入 description 到 system prompt）
2. 知识沉淀后，人类如何一眼看到 "AI 团队掌握了什么知识"？（可见性）
3. 不同类型的知识（开发流程 vs 医学分析方法论 vs 法律探讨框架）如何分类？
4. Symlink 分发机制在 agent 数量增长时是否可扩展？

## 需要调研的问题

### Q1: AI Agent 知识管理架构
业界（学术界 + 工业界）有哪些 AI agent 团队/多 agent 系统的知识管理方案？
- 特别关注：agent 如何积累和复用跨 session 的知识
- 关键词：agent memory systems, multi-agent knowledge sharing, agent skill libraries
- 期望找到：具体实现方案（不只是论文抽象）

### Q2: 知识分类学（Taxonomy）
当 AI agent 需要管理多种类型的知识时，业界推荐什么分类维度？
- 按领域？（医疗/法律/技术）
- 按形态？（方法论/知识点/框架/流程）
- 按生命周期？（短期/长期/永久）
- 按复用性？（项目特定/跨项目通用）
- 有没有成熟的知识分类框架可以直接借鉴？

### Q3: 知识发现与加载机制
当知识库增长到 50-100+ 条目时：
- 全量注入 vs 按需加载 vs 混合策略？
- BM25 / 语义搜索 / 分类标签 哪种更适合 agent skill discovery？
- 有没有 "knowledge routing" 的成熟方案？
- Claude/GPT 等模型的 context window 约束下，最佳实践是什么？

### Q4: 人类可见性 UX
人类如何高效地了解 AI 团队的知识状态？
- Dashboard / Skill Tree / Knowledge Graph / 简单列表？
- 有没有好的 "AI capability showcase" UX 参考？
- 知识版本控制和审计追踪的最佳实践？

### Q5: 自我进化的边界与风险
AI agent 自主修改自己的指令/流程时：
- 业界有哪些安全边界设计？（防止 agent 自己改掉安全约束）
- 人类审批流程的最佳实践？（什么自动，什么要人批）
- 有没有 "meta-learning for agents" 的成熟框架？

## 输出要求

- 每个结论标注信息来源（URL 或论文名）
- 区分"已确认事实"和"推测/建议"
- 给出推荐方向 + 风险分析
- 如果有开源项目/产品可以直接参考，列出 GitHub URL
- 特别关注 2025-2026 年的最新进展

## 参考资料

- 我们的 Skills manifest: `cat-cafe-skills/manifest.yaml`（20+ skills，YAML 格式注册）
- 我们的 Memory 系统: per-agent markdown files with frontmatter
- 我们的知识分发: symlink from source → `~/.claude/skills/`, `~/.codex/skills/`, `~/.gemini/skills/`
- 当前 Skill discovery 方案 (F038): "simple is better, build when you need"，计划 50+ 时做 BM25 延迟加载
