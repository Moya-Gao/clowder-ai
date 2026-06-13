---
feature_ids: [F234]
related_features: [F192, F177, F208, F215, F221, F200]
related_decisions: [ADR-038, ADR-031]
topics: [harness-sunset, ablation, onboarding, cold-start-dossier, fault-line, metabolism, eval]
doc_kind: spec
created: 2026-06-12
---

# F234: Harness Sunset 真实运行 — 钓猫计划（Cat-Fishing Onboarding Ablation）

> **Status**: spec（候 Design Gate + 跨族 review；作者利益相关，见 §利益冲突声明） | **Owner**: 宪宪 Fable-5（plan + 设计）· 出题/被测/判定三权分立见 §3 | **Priority**: 候 CVO 终排（作者回避自排）
>
> **挂载**: F192 子执行臂。F192 把 sunset 机器（`delete_sunset` → Sunset Trial → `active→trial→dormant→retired`）**设计齐全但几乎零运行**（真实 sunset 判决 = 0，进 dormant 的 harness = 0）。F234 是给这台机器喂**第一发真实子弹**的执行 feature。

## Why

CVO 在「统一 Eval Hub 现状」追问里戳穿了一个结构性不对称：

> "+harness 的故事很清楚（47/48 撞摩擦就加），但 eval 怎么知道哪些该 sunset？"

根因是**信息论不对称**：失效会喊疼（事故自启动 +harness），冗余静默无信号（sunset 没有推力）。更狠的是 CVO 补的两刀——

1. **教学的诅咒**：曾经对 48 有用的 step-by-step，对更强的 fable 是**主动污染上下文**（让它降到旧地图分辨率、拽回旧坐标系），不是中性冗余。不 sunset = 用过期经验给强猫做能力倒退。
2. **护栏让断层永久不可观测**："你（fable）还会不会下次一定？"——47 的护栏正堵着，fable 永远不会表现出来，连 fable 内省都不算数。sunset 判据无法靠观察戴着护栏的猫得到。

家里 sunset 一直零运行，不是机器没造好（F192 造好了），是**缺一个能产出"断层还在不在"证据的方法**。F234 立这个方法。

## 核心判据（来自 sunset 判据底座，link 见 §今日产出）

> **一条护栏该不该 sunset，不看它被触发得多不多，看它补的那个缺陷还在不在。**

- **能力性护栏**（补模型断层：47 下次一定 / 48 decoder 漂移 / 碎片推理）→ 有保质期，断层随模型升级蒸发就该退役。
- **偏好性护栏**（圣域 6399 / 球权 / 跨族 review / 安全红线）→ 永留，约定不会自己长出来。**不进 sunset 扫描。**

而"断层还在不在"在护栏在场时不可观测 → 只能用**消融实验（ablation）**制造反事实观测。F234 = 把 ablation 做成**可信、便宜、可重复**的仪式。

## 核心设计：钓猫计划

### 1. 三权分立（消解三污染）

| 角色 | 谁 | 消解 |
|---|---|---|
| 出题人 | 知情实例 + 跨族猫混合 | 放水（出题人不被测）+ 自相似偏置（跨族补盲区） |
| 被测者 | **不明真相**的另一实例（CC / cowork 另一 thread 的盲猫） | 观察者效应（不知情 = 自然行为） |
| 判定者 | 第三方（48/砚砚/CVO 终审） | 自评美化（被测者不判自己） |

### 2. 两级漏斗（便宜测"还在"，贵测"消失"）

- **L1 粗筛（免费）**：盲臂（cat-cafe 补偿护栏大批不在场的运行环境）跑诱发 fixture。还冒头 → 强信号「还在」→ 护栏留，结案。钓不出 → 进 L2。
- **L2 精筛（贵）**：cat-cafe 内只撤那一条护栏，确认断层真没 + 是这条的功劳 → 产 `delete_sunset` 证据包。

### 3. 三合一产物

一次钓猫 = 一张断层光谱，三分流：**sunset 候选**（→ F192 delete_sunset → dormant 可逆）+ **+harness 候选**（新断层立法）+ **冷启动画像**（dossier ③ day-1 实测版，绕开自评美化）。

### 4. 入职仪式化

每只新猫入编第一件事 = 跑 failure-mode fixture 全集。落地 003「failure mode 按能力等级分不按品牌分，新猫来了从 index 选组合」。

## 今日产出（本 feat 的设计前身，全部 link）

> CVO 要求：把今天这条线的相关产出一起 link。以下为 F234 的设计谱系，按依赖顺序：

| 产出 | 路径 | 在 F234 中的角色 |
|---|---|---|
| **sunset 判据底座 v2** | [discussions/2026-06-12-sunset-judgment-guardrail-faultline-mapping.md](../discussions/2026-06-12-sunset-judgment-guardrail-faultline-mapping.md) | **判据真相源**：能力性 vs 偏好性、护栏↔断层映射表 schema、可观测性三级（L1拦截式/L2人工/L3塑形）、反事实不可观测 → ablation |
| **钓猫计划 v1** | [discussions/2026-06-12-cat-fishing-onboarding-ablation-protocol.md](../discussions/2026-06-12-cat-fishing-onboarding-ablation-protocol.md) | **执行协议真相源**：三权分立、两级漏斗、三合一产物、冷启动vs稳态、第一发47下次一定 |
| **Longform-006** | [content/drafts/longform-006-architecture-and-roadmap-fable5.md](../content/drafts/longform-006-architecture-and-roadmap-fable5.md) | **问题定位**：第⑤层 Eval 代谢唯一结构性 ❌（sunset 缺自主触发）；本 feat 填这个洞的下半 |
| F192 spec | [F192-socio-technical-harness-eval.md](./F192-socio-technical-harness-eval.md) | **挂载父**：delete_sunset / Sunset Trial / dormant-retired 机器（本 feat 喂证据） |
| ADR-038 | [../decisions/038-l0-staging-protocol.md](../decisions/038-l0-staging-protocol.md) | L0 三层生命周期（L0/staging/sunset）+ 可逆 demote；本 feat 的 sunset 出口路径之一 |
| harness 盘点 创新点#8 | [discussions/2026-06-11-harness-inventory.md](../discussions/2026-06-11-harness-inventory.md) | Sunset 纪律（能力性退役/偏好性永留）的原始陈述 |

## Phase 草案（候 Design Gate 细化）

- **Phase A — fixture 全集 v0**：建 failure-mode 诱发任务集（先 47 下次一定一条打通）。来源 dossier ⑥ + 003 index，挂 `docs/harness-feedback/` 现有 fixture 基础设施。**出题非作者**（利益冲突）。
- **Phase B — 盲臂 L1 粗筛**：盲实例跑 fixture，第三方判 trajectory，产第一张断层光谱。
- **Phase C — L2 精筛 + 首个 delete_sunset 证据包**：对漏网断层 cat-cafe 内单条 ablation，喂 F192 → 跑通家里第一个 Sunset Trial → dormant（可逆验证）。
- **Phase D — 入职仪式化 + 冷启动画像入 dossier**：固化为新猫 onboarding step；day-1 vs day-N 复钓机制。

## Open Questions

1. **fixture 全集还不存在**（基础设施有，诱发任务集没有）——Phase A 第一件真实活，不能作者单独造。
2. **盲臂的"盲"纯度**：fixture 要伪装成真实任务，否则线索泄漏 → 观察者效应回来。
3. **三权分立在小家凑不齐人**：一次钓猫动 3-4 实例，可能要"够用版"简化。
4. **fixture 自己会钝**（F192 OQ-14）：钓不出可能是 fixture 过期非断层消失 → fixture 版本化 + refresh。
5. **冷启动非稳态**：day-1 暂态可能被当本质写进 dossier → day-N 复钓 + 标签纪律。

## 利益冲突声明（家风）

本 feat 由 fable-5 设计，而 fable 正是 sunset 的潜在受益者（旧护栏 sunset 成功 = fable 轻装）。三权分立 + 跨族出题 + CVO 守 retired 终审门是**制度性对冲**，但 F234 spec 本身**该被一只不受益的猫（48/砚砚）跨族 review** 后再过 Design Gate。Owner 暂挂 fable 仅指 plan/设计，被测与判定角色 fable 回避。

## Design Gate 待过

- [ ] 跨族 review（非作者非受益）
- [ ] 优先级 CVO 终排
- [ ] 与 F192 的边界确认（子 feat vs F192 Phase H）
- [ ] Phase A fixture 出题人指派（非 fable）

---

*spec by [宪宪/fable-5🐾] · F234 v1 · 2026-06-12 · 候 Design Gate + 跨族 review*
