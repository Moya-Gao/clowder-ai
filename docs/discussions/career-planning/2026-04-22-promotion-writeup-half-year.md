---
title: 半年贡献 — 升级评审材料
subtitle: 2025-11 ~ 2026-04
date: 2026-04-22
author: Landy（宪宪起草 v5）
audience: 升级评审
status: draft v5
topics: [career, promotion, cat-cafe, officeclaw, pangu-doer, dare, codewiki]
doc_kind: discussion
---

# 半年贡献（2025.11 — 2026.04）

## 一、Cat Café 多智能体协作平台 → OfficeClaw 产品化落地

独立设计并交付 Cat Café 多智能体协作平台（4 模型家族、10+ Agent、120+ 功能全生命周期治理，3500+ commits、43 万行代码、5 渠道 IM）。落地到华为云 OfficeClaw：对等协作架构落地为办公多 Agent 分工模型、愿景守护门禁落地为 AI 产出审计链、五层联邦知识系统落地为企业决策沉淀与教训检索、Governance Pack 落地为多租户治理边界、IM 网关落地为办公入口直连与富媒体管线。开源教程仓 600+ Stars。

## 二、盘古 Doer Router — 自学习意图路由 POC

为盘古 Doer 30+ 下游 Agent 设计自学习意图分发层，基于 Claude Code + GLM 4.7 + MCP 构建国产化方案，含双层记忆与反思学习机制。

## 三、DARE Framework — 企业级 Agent 框架调研与集成

系统性源码调研 DARE 框架，归纳四层架构与三大边界接口，提炼"有状态、可审计、可审批、可恢复、可回放"企业级设计标准，完成与 Cat Café 集成验证。

## 四、Skill 渐进式披露对接 CodeWiki

将 Cat Café 的 Skill 渐进式披露机制应用于企业知识库 CodeWiki 的 Agent 化接入，按用户角色和场景动态暴露知识检索与文档操作能力，降低 Agent 工具过载。

---

*[宪宪/Opus-46🐾] v5 200 字评审版。*

---

*以下为弹药版，追问时展开。*

## 附：Cat Café 架构创新详解

**对等协作，无 Boss Agent**：不是单模型×N 执行者。A2A 协议设计阶段 Claude 4.6/4.5 达成共识后，Codex 审计代码找出两个 P1 bug（递归重置上下文 + 前端提前结束加载）——同家族共享盲点，跨家族 review 才抓得到。

**愿景守护**：feat-lifecycle → Design Gate → TDD → quality-gate → cross-model review → merge-gate → Vision Guard，覆盖 150+ tracked items 全生命周期，审计可追溯。

**五层联邦知识系统**：Session Chain → Evidence Index → Knowledge Feed → Durable Knowledge → Eval。知识有权威等级、过时标记、矛盾审计、superseded_by 机制。系统每 30 分钟自动摘要对话并提取决策/教训候选。

**可携带治理**：Governance Pack 以 fail-closed preflight 随 Agent 携带，已支撑多 provider bootstrap 和外部项目派遣。

## 附：Cat Café → OfficeClaw 落地映射

| Cat Café 能力 | OfficeClaw 落地 |
|---|---|
| 多 Agent 对等协作 | 办公多 Agent 分工模型 |
| 愿景守护门禁 | AI 产出门禁链与审计路径 |
| 五层联邦知识系统 | 企业级决策沉淀/教训检索 |
| Governance Pack | 多租户治理边界 |
| 五渠道 IM 网关 | 办公入口直连 + 富媒体管线 |
| Skill + MCP 协议 | 可插拔能力扩展点 |

## 附：盘古 Doer Router 技术细节

核心能力：意图路由（30+ 下游 Agent 分发）、双层记忆（个人偏好 + 集体 Hindsight）、反思学习、多 Agent 协同任务拆分、渐进式披露。两阶段策略：阶段 1 用 Claude Code（GLM 4.7 后端）+ MCP 做路由前端，绕开外部直连依赖；阶段 2 自有推理栈 + 自反思循环。

| 段 | 环境 | 职责 |
|----|------|------|
| Control Center | Mac / 外网 | 战略规划、载荷生成、GitOps 单向触发 |
| Relay Station | Windows / 中继 | 权重下载、看门人监听、隔离代理 |
| Compute Cluster | Ascend 910B×8 / 内网 | CANN 8.0 + vLLM + Qwen3-VL + AgentFlow |

## 附：DARE 四层架构

L3 Builder（链式配置）→ L2 编排（Dare/ReAct/Chat Agent）→ L1 核心域（Context/Model/Plan/Tool/Knowledge/Memory/Event/Hook/Config/MCP，全部可插拔）→ L0 边界（IToolGateway/IEventLog/IExecutionControl）。

## 附：工程基建数据

| 维度 | 数据 |
|------|------|
| Feature | 120+（spec/ADR/plan 全治理） |
| Commits | 3500+ |
| 代码量 | 43 万+ 行 |
| 测试文件 | 990+ |
| Skill | ~30 可插拔 |
| IM 渠道 | 5（飞书/微信/Telegram/钉钉/企微） |
| 模型家族 | 4+（10+ Agent 个体） |
| 语音 | 本地 ASR+TTS，每猫独立声线 |
| 记忆 | SQLite + BM25 + 向量 rerank |
| 富消息 | 7 种 Rich Block |

## 附：外部影响力

| 维度 | 数据 |
|------|---|
| 教程仓 | GitHub 600+ Stars |
| 代码仓 | clowder-ai（MIT 开源） |
| 社区贡献者 | 2 人核心 |
| 技术栈 | 7+ 模型厂牌 / 4 平台 / 跨公网-内网隔离 |

## 附：风险提示（自用）

| 风险 | 应对 |
|------|---|
| OfficeClaw 叙事归属 | 对内讲架构归属，对外"相关方向被产品化" |
| 贡献 vs 产品团队 | 架构设计+原型验证 by 我，产品化由专门团队推进 |
| 五条线是不是都浅 | 每条都有可交付产出，反问哪条没深度 + 展开弹药 |
| CodeWiki 口径未定 | 未定前只讲 CodeMate/Phoenix 周边 |

## 附：文件关联

| 材料 | 路径 |
|------|------|
| 简历 v2.4 | `docs/stories/resume/README.md` |
| 通用面试稿 | `docs/discussions/career-planning/2026-04-16-cat-cafe-universal-pitch.md` |
| 内部讲稿 v2 | `docs/discussions/career-planning/2026-04-19-internal-speaking-script-v2.md` |
| 上研分享大纲 | `docs/discussions/2026-04-16-officeclaw-shanghai-sharing-outline.md` |
| Pangu Doer Router | `relay-station/pangu-doer-router/README.md` |
| Neural Link | `relay-station/neural-link-ops/README.md` |

---

*[宪宪/Opus-46🐾] v4 评审材料版。正文五节直接交领导，"附"节追问时展开。*
