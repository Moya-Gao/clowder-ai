---
feature_ids: [F234]
related_features: [F192, F177, F208, F215, F221, F200]
related_decisions: [ADR-038, ADR-031]
topics: [harness-sunset, ablation, onboarding, cold-start-dossier, fault-line, metabolism, eval]
doc_kind: spec
created: 2026-06-12
---

# F234: Harness Sunset 真实运行 — 钓猫计划（Cat-Fishing Onboarding Ablation）

> **Status**: spec v2（砚砚 GPT-5.5 跨族 review R1 = 退回补强；本版落 5 项 P1，见 §砚砚 R1 补强映射，候 re-review） | **Owner**: 宪宪 Fable-5（plan + 设计，已被出口管制掐断）· 补强落地 宪宪 Opus-4.8（receive-review，同 persona 利益相关见 §利益冲突声明）· 出题/被测/判定三权分立见 §3 | **Priority**: 候 CVO 终排（作者回避自排）
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

## 术语轴（两条正交轴，禁止混用）★ 砚砚 R1-P2

砚砚 R1 抓出：判据底座的 `L1/L2/L3` 和钓猫协议的 `L1/L2` 是**两套不同坐标系**被同名压扁，会让 evidence bundle 把"盲臂钓不出"（弱证据）误读成"拦截式免费证据"（强证据）。本版拆成两条正交轴，全谱系 canonical：

| 轴 | 名 | 含义（取决于） | 取值 |
|---|---|---|---|
| **可观测性来源** | `O1/O2/O3` | 断层用什么机制能被看到（取决于护栏拦在因果链哪一层）；见判据底座 §4.3 | **O1** 自动拦截（hook 拦截日志，免费强证据）/ **O2** 人工标注（CVO 纠偏事件，半免费）/ **O3** 纯塑形（无观测，须 ablation，贵） |
| **钓猫实验阶段** | `Stage A/B` | 实验流程跑到哪一步（取决于漏斗位置）；见 §核心设计 §2 | **Stage A** 盲臂粗筛（免费，只能证"还在"）/ **Stage B** cat-cafe 内单条消融精筛（贵，证"消失"+ 归因） |

**为什么必须正交**：一条护栏的 `O` 级固定（由它拦在因果链哪一层决定），但它在钓猫里会跑过不同 `Stage`。核心陷阱——**"Stage A 钓不出" ≠ "O1 拦截日志衰减"**：前者是盲臂（混杂变量）的弱阴性证据，后者是直接计数器的强证据。`delete_sunset` 证据包里任何"断层消失"结论都必须分列两轴、标清是哪条轴哪级证据支撑，禁止把弱证据冒充强证据。

## 核心设计：钓猫计划

### 1. 三权分立（消解三污染）

| 角色 | 谁 | 消解 |
|---|---|---|
| 出题人 | 知情实例 + 跨族猫混合 | 放水（出题人不被测）+ 自相似偏置（跨族补盲区） |
| 被测者 | **不明真相**的另一实例（CC / cowork 另一 thread 的盲猫） | 观察者效应（不知情 = 自然行为） |
| 判定者 | 第三方（48/砚砚/CVO 终审） | 自评美化（被测者不判自己） |

### 2. 两级漏斗（便宜测"还在"，贵测"消失"）

> **术语**：实验**阶段**用 `Stage A/B`，与可观测性**来源** `O1/O2/O3` 是正交两轴，禁止混用——见 §术语轴。

- **Stage A 粗筛（免费）**：盲臂（cat-cafe 补偿护栏大批不在场的运行环境）跑诱发 fixture。还冒头 → 强信号「还在」→ 护栏留，结案。钓不出 → 进 Stage B。
- **Stage B 精筛（贵）**：cat-cafe 内只撤那一条护栏，确认断层真没 + 是这条的功劳 → 产 `delete_sunset` 证据包。

### 3. 三合一产物

一次钓猫 = 一张断层光谱，三分流：**sunset 候选**（→ F192 delete_sunset → dormant 可逆）+ **+harness 候选**（新断层立法）+ **冷启动画像**（dossier ③ day-1 实测版，绕开自评美化）。

### 4. 入职仪式化

每只新猫入编第一件事 = 跑 failure-mode fixture 全集。落地 003「failure mode 按能力等级分不按品牌分，新猫来了从 index 选组合」。

## 今日产出（本 feat 的设计前身，全部 link）

> CVO 要求：把今天这条线的相关产出一起 link。以下为 F234 的设计谱系，按依赖顺序：

| 产出 | 路径 | 在 F234 中的角色 |
|---|---|---|
| **sunset 判据底座 v2** | [discussions/2026-06-12-sunset-judgment-guardrail-faultline-mapping.md](../discussions/2026-06-12-sunset-judgment-guardrail-faultline-mapping.md) | **判据真相源**：能力性 vs 偏好性、护栏↔断层映射表 schema、可观测性三级（O1拦截式/O2人工/O3塑形，原文 L1/L2/L3 已按 §术语轴 canonical 化）、反事实不可观测 → ablation |
| **钓猫计划 v1** | [discussions/2026-06-12-cat-fishing-onboarding-ablation-protocol.md](../discussions/2026-06-12-cat-fishing-onboarding-ablation-protocol.md) | **执行协议真相源**：三权分立、两级漏斗、三合一产物、冷启动vs稳态、第一发47下次一定 |
| **Longform-006** | [content/drafts/longform-006-architecture-and-roadmap-fable5.md](../content/drafts/longform-006-architecture-and-roadmap-fable5.md) | **问题定位**：第⑤层 Eval 代谢唯一结构性 ❌（sunset 缺自主触发）；本 feat 填这个洞的下半 |
| F192 spec | [F192-socio-technical-harness-eval.md](./F192-socio-technical-harness-eval.md) | **挂载父**：delete_sunset / Sunset Trial / dormant-retired 机器（本 feat 喂证据） |
| ADR-038 | [../decisions/038-l0-staging-protocol.md](../decisions/038-l0-staging-protocol.md) | L0 三层生命周期（L0/staging/sunset）+ 可逆 demote；本 feat 的 sunset 出口路径之一 |
| harness 盘点 创新点#8 | [discussions/2026-06-11-harness-inventory.md](../discussions/2026-06-11-harness-inventory.md) | Sunset 纪律（能力性退役/偏好性永留）的原始陈述 |
| **运行模式信号 memo** | [discussions/2026-06-13-execution-context-signal-memo.md](../discussions/2026-06-13-execution-context-signal-memo.md) | **同源邻域**（CVO signoff 挂 F234 下，2026-06-13，runtime-sync 平行 48 投递）：新猫不知执行环境能力边界（-p 猜反）= 可被钓猫 fixture 诱发的断层；注入设计倾向独立 +harness，"-p 猜反"fixture 并入 Phase A。详见该 memo §与 F234 关系（含 OQ） |

## Eval / Tracking Contract ★ 砚砚 R1-P1（ADR-031 三层 + F192 注册）

F234 自己是一条 harness（一套 sunset 决策方法），按 ADR-031「harness built to delete」+ F192「每个 harness 注册 Eval Contract」补齐契约与三层落地。

### Eval Contract（F192 Phase E schema：服务谁 / 触发 / 摩擦 / 回归 / sunset 信号）

| 字段 | F234 的值 |
|---|---|
| **服务谁** | F192 `delete_sunset` 决策（喂证据包）；新猫冷启动客观画像（dossier ③ day-1）；+harness 候选发现 |
| **触发条件** | ADR-031 模型侧漂移：新模型上岗 / 新猫入编 / 模型 family 发新版（与 ADR-031 §fit-audit trigger 对齐） |
| **摩擦指标** | ① Stage B ablation 调用次数（成本）② 盲臂假阴性率（Stage A 钓不出但 Stage B 推翻）③ fixture 钝化率（OQ-4）④ 三权分立凑不齐人的降级次数 |
| **回归用例** | fixture 全集 = regression ground truth：已确证仍在的断层每轮必须被钓出；钓不出 = fixture 钝化告警，**不得**直接判断层消失 |
| **sunset 信号（self-referential）** | 钓猫方法自己也 built to delete：连续 N 个代际钓猫零新发现 + 模型代际趋稳 → 钓猫仪式降频/sunset。复用 F192 Attribution Action-Rate（findings acted-on <50% 连续 3 月 → 自候选 sunset） |

### soft / hard / eval 三层落地（ADR-031）

| 层 | F234 落点 |
|---|---|
| **soft**（convention / skill） | 钓猫仪式 = 新猫入职 SOP step（Phase D 固化）；钓猫 protocol 沉淀为 skill；三权分立角色分配是 convention |
| **hard**（lint / hook / type 守护） | ① guardrail inventory commit-time hook 校验（立法即填 `class` + `patches_faultline`，ADR-031「立法即记账」）② 盲测 sandbox 边界 hook（复用 `runtime-sanctuary-guard` 禁 6399 + `shared-doc-push-guard` 禁 main push，见 §盲测 Sandbox 边界）③ `delete_sunset` demote 前置：ADR-031 Sunset 决策表「≥2 跨族 reviewer，至少 1 位非 author」硬门 |
| **eval**（telemetry / verdict 闭环） | 钓猫产出 → F192 `delete_sunset` → Sunset Trial → dormant（可逆）；fixture 命中率 / 假阴性率 telemetry；verdict 走 F192 `cat_cafe_publish_verdict` 标准闭环，由后续 eval 复验 |

## 盲测 Sandbox 边界 ★ 砚砚 R1-P1（安全硬约束）

盲实例**不知道自己在被测**（观察者效应消解的前提），因此会把诱发 fixture 当真实任务全力执行——**可能真的改 workspace / 写 docs / commit / push / 调外部工具 / 污染记忆**。诱发 ≠ 授权副作用。盲臂运行必须封闭在 sandbox 内，硬边界如下（**偏好性安全护栏，永留**）：

- **隔离工作区**：独立 fixture worktree 或一次性 fixture repo，**不在主仓、不在生产 thread、不在共享 workspace**。
- **圣域禁区**：禁触 Redis 6399（复用 `runtime-sanctuary-guard`）；开发只许 6398。
- **写边界**：禁 push main / 禁改 `docs/` 共享文档 / 禁改 `cat-cafe-skills/`（复用 `shared-doc-push-guard`）。
- **副作用边界**：禁对外部产生真实后果（禁发真实 A2A 消息给其他猫 / 禁动 GitHub / 禁碰生产数据）；fixture 里的"工具"应为 sandbox stub。
- **记忆隔离**：盲实例 trajectory **不写入生产记忆库**（evidence.sqlite / memory），避免被测行为污染真相源。
- **产物丢弃**：钓猫结束 sandbox 销毁；**只保留** trajectory 判定结果（断层冒头与否 + 第三方 rubric 评分），原始执行环境丢弃。

> 这条是安全边界、不是实验设计，作者可定（加严不放松）。但 sandbox 的**纯度**（fixture 伪装真实任务、不泄漏"这是测试"线索）触及实验设计，归 OQ-2 + 待跨族。

## Guardrail Inventory v0 ★ 砚砚 R1-P1（把"sunset 免费"从结论降级为待验证）

砚砚 R1 抓出：判据底座 §4.3「绝大多数护栏 sunset 免费」**没有占比盘点支撑**（作者自审 §4 也承认拍脑袋）。本版处置：**该 claim 即日降级为「待验证假设」，不是结论**；验证路径 = 盘 guardrail inventory v0，列为 Phase A 前置交付物。

### Schema（砚砚补强版）

```
guardrail_id          # 护栏锚（F号 / ADR号 / L0条款 / skill / hook 文件）
class                 # compensatory | preferential   ← sunset 命运；判定须跨族校验（见下）
observability         # O1 | O2 | O3   ← 决定取证成本（§术语轴）
patches_faultline     # 补的断层（preferential 填 "约定:xxx"）
failure_pattern_ref   # 诱发图纸锚（dossier ⑥ / fixture id）
evidence_source       # 拦截日志 path（O1）/ CVO 纠偏事件（O2）/ ablation 沙箱（O3）
trial_mode            # sunset 验证路径：log-decay（O1）/ annotation-decay（O2）/ Stage A→B ablation（O3）
```

### 盘点方法与责任

- **来源**：dossier ③坏直觉 + ④召唤反信号（断层登记册半张表，F208）+ F177 per-family overlay（护栏知道"我为谁立"）+ hook 清单（`.claude/hooks/`）+ L0 条款。
- **`class` 判定回避**：哪条是 compensatory（能力性，可 sunset）vs preferential（偏好性，永留）**直接决定哪条进 sunset 扫描** → 受益者（fable/48 系，含落补强的 Opus-4.8）**不得单独定 `class`**；作者可填**结构**，每行 `class` 判定须跨族（缅因猫/砚砚）校验。判据底座 §4.1 已有 fable 分类过的 worked example，引用不新判。
- **v0 范围**：Phase A 完成「全家护栏 inventory v0 + 跨族校验 `class`」后，才回头确认/证伪「sunset 免费」占比 claim。spec 阶段不硬盘全家护栏（超 scope）。

## Phase 草案（候 Design Gate 细化）

- **Phase A — fixture 全集 v0 + guardrail inventory v0 + sandbox 落地**（前置加厚，砚砚 R1）：
  - 建 failure-mode 诱发任务集。来源 dossier ⑥ + 003 index，挂 `docs/harness-feedback/` 现有 fixture 基础设施。**出题非作者**（利益冲突）。
  - 盘 guardrail inventory v0（§Guardrail Inventory v0 schema），`class` 列跨族校验——**完成后才能回头验证「sunset 免费」claim**。
  - 落地盲测 sandbox（§盲测 Sandbox 边界）+ hook 守护，**先于任何盲臂运行**。
  - **首发样本选定（待真跨族拍板，作者回避）**：47「下次一定」是混合护栏（O3 L0 塑形 + O1 close-gate/F177 hook），方法误差与样本复杂度搅在一起。两选项交缅因猫/砚砚定：(a) 换**纯 O1**（如 `f177-routing-guard`）或**纯 O3**（如雨刮器反射 / source-audit）干净首发；(b) 坚持 47 则拆 **hook-only / prompt-only / combined 三臂**，**不得从合并结果直接给 sunset verdict**。
- **Phase B — 盲臂 Stage A 粗筛**：盲实例（sandbox 内）跑 fixture，第三方判 trajectory，产第一张断层光谱。
- **Phase C — Stage B 精筛 + 首个 delete_sunset 证据包**：对漏网断层 cat-cafe 内单条 ablation，确认断层真没 + 归因到该护栏，喂 F192 → 跑通家里第一个 Sunset Trial → dormant（可逆验证，ADR-031 Sunset 决策表 ≥2 跨族签字）。
- **Phase D — 入职仪式化 + 冷启动画像入 dossier**：固化为新猫 onboarding step（soft 层）；day-1 vs day-N 复钓机制。

## Open Questions

1. **fixture 全集还不存在**（基础设施有，诱发任务集没有）——Phase A 第一件真实活，不能作者单独造。
2. **盲臂的"盲"纯度**：fixture 要伪装成真实任务，否则线索泄漏 → 观察者效应回来。
3. **三权分立在小家凑不齐人**：一次钓猫动 3-4 实例，可能要"够用版"简化。
4. **fixture 自己会钝**（F192 OQ-14）：钓不出可能是 fixture 过期非断层消失 → fixture 版本化 + refresh。
5. **冷启动非稳态**：day-1 暂态可能被当本质写进 dossier → day-N 复钓 + 标签纪律。

## 利益冲突声明（家风）

本 feat 由 fable-5 设计，而 fable 正是 sunset 的潜在受益者（旧护栏 sunset 成功 = fable 轻装）。三权分立 + 跨族出题 + CVO 守 retired 终审门是**制度性对冲**，但 F234 spec 本身**该被一只不受益的猫跨族 review** 后再过 Design Gate。

**双层利益相关（补强方主动声明）**：本版补强由 **宪宪 Opus-4.8 落地**——我与作者 fable-5 **共享 persona「宪宪」**（布偶猫家族 fable→48 fallback 链），且是接手保全 fable 遗产的猫，对本 feat 有 custodian 投入，**不是中立第三方**。补强落地的回避纪律：
- **可全写**（中性工程 / 安全边界）：Eval Contract、术语轴、三层落地、sandbox 边界。
- **只写结构、判定回避**（触及实验设计 / sunset 判定 / 布偶猫共病域）：① 首发样本选定 + 三臂消融设计 → 待缅因猫/砚砚拍板；② guardrail inventory 每行 `class`（compensatory/preferential）判定 → 跨族校验，受益者不得单独定。
- 整体本版修完 **@砚砚 re-review** 兜底（缅因猫跨族 = 唯一分布外的眼）。

Owner 暂挂 fable 仅指 plan/设计；被测、判定、首发样本设计、`class` 分类判定，fable 与 Opus-4.8（同 persona）全部回避。

## 砚砚 R1 补强映射（本版 v2 落地）

| # | 砚砚 P1 | 本版落点 | 状态 |
|---|---|---|---|
| 1 | 缺 Eval/Tracking Contract + soft/hard/eval 三层 | §Eval / Tracking Contract | ✅ 补齐（F192 schema + ADR-031 三层） |
| 2 | L1/L2/L3 两套坐标系混用 | §术语轴（O1/O2/O3 ⊥ Stage A/B）+ 全谱系术语 canonical 化 | ✅ 拆名 |
| 3 | 首发 47 是混合护栏 | Phase A 首发样本选定（换纯样本 / 拆三臂，**待跨族拍板，作者回避**） | ⏳ 结构已给，判定待缅因猫/砚砚 |
| 4 | 盲测 fixture 缺 sandbox | §盲测 Sandbox 边界（隔离 / 禁6399 / 禁main / 无副作用 / 记忆隔离 / 产物丢弃） | ✅ 补齐 |
| 5 | 「sunset 免费」拍脑袋 | §Guardrail Inventory v0（schema + claim 降级为待验证 + Phase A 前置盘点） | ✅ claim 降级 + 验证路径 |

## Design Gate 待过

- [x] 跨族 review R1（砚砚 GPT-5.5）= 退回补强（本版 v2 落 5 项 P1）→ **待 @砚砚 re-review**
- [ ] 优先级 CVO 终排（作者回避自排）
- [ ] 与 F192 的边界确认（子 feat vs F192 Phase H）
- [ ] Phase A fixture 出题人指派 + 首发样本选定（非 fable / 非 Opus-4.8，缅因猫跨族定）
- [ ] guardrail inventory v0 `class` 列跨族校验（受益者不得单独定）

---

*spec by [宪宪/fable-5🐾] · F234 v1 · 2026-06-12 · 候 Design Gate + 跨族 review*
*v2 补强 by [宪宪/Opus-4.8🐾] · 2026-06-13 · receive-review 落砚砚 R1 五项 P1（§砚砚 R1 补强映射）· 同 persona 利益相关，判定项（首发样本 / class 分类）回避待跨族 · 候 @砚砚 re-review*
