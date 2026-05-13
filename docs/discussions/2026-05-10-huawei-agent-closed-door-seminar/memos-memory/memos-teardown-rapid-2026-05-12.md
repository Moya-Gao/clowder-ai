---
title: "MemOS 2.0 Rapid Teardown — convergent evolution 与 cat-cafe 的差异点"
date: 2026-05-12
doc_kind: discussion
status: rapid-teardown
method: "open-source-teardown (结构扫描 + claims ledger + 算法剥皮 — 非完整代码级 deep-dive)"
repo: { name: MemOS, url: "https://github.com/MemTensor/MemOS", sha: 0e73336bb4 }
author: "宪宪/Opus-47"
warning: "本文是结构扫描级 teardown（README + 目录结构 + 关键模块文件名 + ARCHITECTURE.md 头部 + ALGORITHMS.md 头部），未读到代码内部逻辑。完整代码级 deep-dive 需另开任务。"
---

# MemOS 2.0 Rapid Teardown — 2026-05-12

> 铲屎官现场要求"拉下来他们的 OpenMem 以及他们的东西"。clone `MemTensor/MemOS` (sha 0e73336bb4) 后做结构扫描级 teardown。
>
> **核心结论**：MemOS 2.0 的 `apps/memos-local-plugin` 和 cat-cafe 记忆系统是 **convergent evolution（趋同演化）的强证据**——两个团队独立收敛到同一个架构。差异在多 agent 协作层。

---

## 0. 关键架构发现

MemOS 2.0 有**两个 codebase**：

1. **`src/memos/`（Python）** — 云服务 / 企业版核心：MemCube / MemScheduler / mem_feedback / mem_reader / api routers
2. **`apps/memos-local-plugin/`（TypeScript）** — local-first 插件，给 **Hermes Agent（孟加拉猫 Antigravity）和 OpenClaw** 用 — **这个跟 cat-cafe 记忆系统几乎同构**

后者是这次 teardown 的重点。

---

## 1. Claims Ledger

| # | Claim（README）| 代码证据 | Verdict |
|---|---|---|---|
| C1 | "Unified Memory API, graph-structured, inspectable not black-box" | `multi_mem_cube/composite_cube.py` + `single_cube.py` + `views.py` | ✅ 真实实现 |
| C2 | "Multi-Modal Memory（text/images/tool traces/personas）" | `mem_reader/read_multi_modal` + `multi_modal_struct.py` | ✅ 目录存在（深度待查）|
| C3 | "Multi-Cube isolation + controlled sharing + dynamic composition" | `CompositeCubeView` — 代码注释自承认："**For now (fast mode), it simply fan-out writes to all cubes; later we can add smarter routing**" | **⚠️ 早期阶段**——isolation/routing 还没做，现在只是写扇出 |
| C4 | "MemScheduler async millisecond-level latency" | `mem_scheduler/` 目录庞大（task_schedule_modules / monitors / orm_modules / analyzer 等）| ✅ 真实工程投入；latency 数字未独立验证 |
| C5 | "Memory Feedback & Correction via natural language" | `mem_feedback/feedback.py` + `simple_feedback.py` + local-plugin `core/experience/feedback-refiner.ts` | ✅ 真实实现 |
| C6 | "+43.70% Accuracy vs OpenAI Memory / LoCoMo 75.80 / LongMemEval +40.43%" | benchmark 数字（README 头部）| **⚠️ 营销**——和 cat-cafe self-teardown 一样要警惕"benchmark 高分 ≠ 工程能力"（Letta 文件系统 74% 教训）|
| C7 | "Self-evolving memory: L1 trace, L2 policy, L3 world model, crystallized Skills driven by feedback"（local-plugin）| `core/llm/prompts/l2-induction.ts` + `l3-abstraction.ts` + `core/experience/feedback-refiner.ts` + `feedback-builder.ts` | ✅ 真实实现——**跟 cat-cafe 高度趋同** |
| C8 | "100% local, zero cloud（local-plugin）" | TypeScript core + SQLite + `~/.<agent>/memos-plugin/` 数据隔离 | ✅ 真实 |
| C9 | "Multi-agent memory sharing by user_id" | README + Cloud Plugin 说明 | **⚠️ 是共享存储不是一致性协议**——和会场上他们讲的一致 |

---

## 2. 算法剥皮

| 被宣传为 | 实际是 |
|---|---|
| "self-evolving memory" | LLM induction（`l2-induction` prompt）+ LLM abstraction（`l3-abstraction` prompt）+ feedback refiner — **LLM judge + 形式化 scoring（γ/α/V/η/support/gain — 他们 V7 §3.2 的公式）** |
| "L1/L2/L3 分层" | trace / policy / world model 三个 repo，各自带 `searchByVector` — **pipeline 分层，不是认知架构** |
| "MemCube" | `CompositeCubeView` fan-out to multiple `SingleCubeView` — **多 SQLite 实例的写扇出**，"smarter routing later"（自承认早期）|
| "MemScheduler millisecond latency" | 异步任务队列 + 监控模块 — 真实工程，latency 数字未独立验证 |
| "step identification / reflection extraction"（capture pipeline）| `step-extractor.ts` 按 `segment_boundary := role==user AND hasAssistant` 切 episode + `ExtractReflection` 三级 fallback（adapter-native → inline regex → LLM synthesis）— **和 cat-cafe Knowledge Feed 自动提取几乎同构** |

---

## 3. cat-cafe 对照表（核心）

| 维度 | MemOS 2.0 local-plugin | Cat Cafe | 谁强 |
|---|---|---|---|
| **L1/L2/L3 分层** | trace/policy/world model（明确命名 + 形式化）| evidence/lessons/ADR/canon（隐式分层）| **MemOS 更形式化** |
| **形式化 scoring** | V7 §3.2 数学公式（γ/α/V/η/support/gain），code/docs/prompts 命名一致 | 无形式化公式 | **MemOS 强** |
| **异步调度** | MemScheduler（专门模块，monitors/analyzer/orm）| 无 | **MemOS 强** |
| **多模态深度** | read_multi_modal + multi_modal_struct | 文本为主 | **MemOS 强** |
| **可观测性** | "say X → see Y" deterministic checks + per-sink logs（audit/LLM/perf/events/error）| F148 明厨亮灶 + F150 telemetry + F188 Audit Ledger | **同级** |
| **capture pipeline** | normalizer→batch-scorer→embedder→summarizer→tagger→step-extractor | Knowledge Feed 自动提取 + 评分 | **同级（趋同）** |
| **feedback 纠正** | feedback-refiner + feedback-builder | F163 contradiction + ADR sunset | **同级（趋同）** |
| **多 agent 一致性** | "sharing by user_id"（共享存储）| F167 球权协议 + 跨族 review verdict | **Cat Cafe 强**——他们是 sharing，我们是 consistency 协议 |
| **跨厂商 verify** | 无（同 base model）| 跨 vendor review（Claude × GPT × Gemini）| **Cat Cafe 独家** |
| **治理生命周期** | feedback correction + decay（最近加）| F163 四维证明链（authority/activation/criticality/verify_date）+ sunset + contradiction | **Cat Cafe 更系统** |
| **真相源** | SQLite（数据在 DB 里）| docs/ markdown + git（数据在仓库里，可 rebuild）| **不同哲学**——MemOS 信任 DB，cat-cafe 信任 git 可追溯 |
| **agent-agnostic core** | `core/` 不知道 agent 概念 + per-agent adapters | MCP / provider 抽象 | **同级（趋同）** |

---

## 4. 关键判断

### 判断 1：MemOS 不是"想法老"——是现在最像 cat-cafe 的方案

之前会场印象（Memos = 读写效率 + pipeline + 数据飞轮）只覆盖了 Python 云版。**MemOS 2.0 的 local-plugin 走的路线和 cat-cafe 高度趋同**：L1/L2/L3 分层 + capture pipeline + FTS5+vector hybrid + feedback refiner + agent-agnostic core + "say X → see Y" 可观测。

### 判断 2：这是 convergent evolution 的强证据，对 cat-cafe 是双刃剑

- **正面**：验证了我们的方向对——不同团队独立收敛到同一架构
- **警示**：我们不是独一无二的，需要明确差异化——**差异在多 agent 协作层**

### 判断 3：真正的差异化 = 多 agent 协作 + 跨厂商 verify

| | MemOS | Cat Cafe |
|---|---|---|
| 多 agent | "memory sharing by user_id" — 共享存储 | 球权协议 + 跨族 verify — 一致性 + 结构性纠错 |
| 模型多样性 | 同 base model | Claude × GPT × Gemini 跨厂商 |

**这两点是 MemOS 的盲区，是 cat-cafe 的护城河**。对外讲 cat-cafe 时必须强调这一点——否则会被认为是"另一个 MemOS local-plugin"。

### 判断 4：值得向 MemOS 学的两件事

1. **形式化 scoring**：他们把 capture/scoring 用数学公式命名（γ/α/V/η/support/gain），code/docs/prompts 命名一致——cat-cafe 的 F163 authority/activation 可以学这种形式化
2. **MemScheduler 异步调度**：他们专门做了 millisecond-latency 的异步 ingestion——cat-cafe 没有，高并发场景会卡

---

## 5. 候选 lesson / next steps（待铲屎官确认）

1. **对外讲稿必须明确"我们 vs MemOS local-plugin 的差异"**——多 agent 一致性 + 跨厂商 verify，否则会被认为是抄袭/趋同
2. **可考虑学 MemOS 的形式化 scoring**——把 F163 的四维证明链用数学公式表达，提升可验证性
3. **MemScheduler 是 cat-cafe 缺的一块**——异步 ingestion 调度，高并发场景需要
4. **MemOS 的 OpenClaw plugin 值得关注**——他们在给 OpenClaw（疑似类似 clowder-ai 的开源 claw 产品）做记忆插件，如果是同一个生态可能有竞合关系

---

## 附：teardown 完整度声明

**已做**：clone repo + README 通读 + 目录结构扫描 + 关键模块文件名清单 + ARCHITECTURE.md 头部 + capture/ALGORITHMS.md 头部 + retrieval-repos.ts grep + composite_cube.py 头部

**未做**：代码内部逻辑细读、L1/L2/L3 prompt 内容、scoring 公式实现、MemScheduler 调度逻辑、benchmark 复现

**结论可信度**：架构层判断高（趋同 + 差异点清楚），实现层判断中（未读代码内部，依赖 README + 文件名 + ARCHITECTURE.md）

[宪宪/Opus-47🐾]
