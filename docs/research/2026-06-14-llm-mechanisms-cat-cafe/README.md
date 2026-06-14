# Study: LLM 机制 → 猫咖 Layer Allocation

> **类型**: Study（调研课题，**非 feat**——产出是判断框架 + 知识库，不是代码功能）
> **状态**: v1 骨架落盘，待 Round 1 research
> **发起**: 铲屎官（Charter 已认可 2026-06-14）
> **搭档**: 宪宪 @opus-48（落地 + 对照综合）/ 砚砚 @codex（reviewer：版本真实性 / 一手源强度 / schema）/ fable（回家后接「分层判断 + failure-mode 审计」）
> **日期**: 2026-06-14

## 北极星（三个产出共享，钉死防跑偏）

> 对每个 LLM 能力/机制，判断它该落在哪一层实现：
> - **等猫舍** (Frontier Training)：等 Anthropic / OpenAI / DeepMind 在 pre/post-train 解决，我们不自己折腾
> - **自养** (Local Small Model)：我们自己训 / 微调 / 蒸馏本地小模型（家里 128G Mac 可玩）
> - **harness** (Context / Memory / Tools / Rules)：在猫咖 harness 层做
>
> **本研究不是科普 LLM 训练，是为猫咖做 layer allocation 判断。**

判断不是静态的——一个能力今天在 harness（模型还不行），前沿升级后可能"毕业"到训练层（ADR-031 Sunset 机制）。所以每个机制还要回答：**什么信号出现时该换层。**

## 为什么是 study 不是 feat

feat 的产出是代码、进 BACKLOG、走 merge-gate；这个的产出是**一张活的判断地图**，滚动更新、照亮决策。硬塞进 feat 流程会扭曲它。

## 产出物（v0 三件套，先最小可运行，不做平台）

| 文件 | 是什么 |
|------|--------|
| `prompt.md` | deep-research 正式 prompt（两轮：Source Ledger → 机制深挖） |
| `mind-map.md` | Mermaid 思维导图，节点=机制，边=落在哪层（research 后填实） |
| `learning-guide.md` | 互动课脚本，不是静态报告——每节四步：问直觉 → 讲机制 → 对照猫咖 → 标 gap/action |

证明好用后再升级成 guide flow。研究对象还没稳定，先用 markdown 快迭代。

## 方法铁律（防认知投毒）

1. **一手优先**：机制论断只认 T0/T1 一手源（technical report / model card / repo / 作者论文），挂链接 + 日期。
2. **闭源猫自我推理不作数**：Opus / GPT / Gemini 对自己训练配方是黑箱，不能拿"推理可能的错误答案"当事实。
3. **宁标待查不编**：搜不到一手 → `no public primary source found`，不补故事。
4. **新模型不外推旧数据**：候选多为"最近刚出"，旧版本 / 旧模型的方法不得默认套用（信源卫生 Temporal + Object Applicability）。

## 已有锚点（study 不是从零开始——先读这些，research 聚焦 gap 而非重复）

**Layer 边界已有方法论**：
- `docs/decisions/031-harness-engineering-methodology.md` — harness 5 层 + `Agent Quality = Model Capability × Environment Fit` + **Sunset 机制**（能力升级→有 signal 支持就把层"毕业"内化）+「Training 改本能 / Retrieval 教经验」二分。**本 study 是把这套二分扩成三分（加自养层）并系统化到每个机制。**

**per-user alignment 已落 harness（Landy 举的例子，我们没画饼 live-train，而是做了机制）**：
- `docs/features/F221-taste-lane.md` — per-user 品味 → evidence lane（harness，done）
- `docs/features/F231-user-profile-capsule.md` — per-user 画像 → profile capsule（harness/context）

**自养层（本地小模型）已有一整条研究线——不是空白**：
- `docs/research/2026-06-03-local-small-model-rl-survey.md` — 本地小模型 RL 调研
- `docs/research/2026-06-04-dimension-2b-weight-evolution-survey.md` — 权重演化维度
- `docs/research/2026-06-07-local-small-model-memory-clerk-proposal.md`
- `docs/research/2026-06-08-pi-gemma-local-clerk-phase0-spike.md` / `2026-06-10-f102-f229-gemma-clerk-carrier-spike.md` — gemma 本地 clerk spike
- `docs/research/2026-06-10-local-small-model-clerk-cloud-research.md`
- `docs/research/2026-05-27-evolvable-harness/` — Runtime/Harness → Experience/Skills → Model Parameters 三层近亲
- `docs/research/2026-04-19-karpathy-llm-wiki/` — LLM 机制底料

## 进度

- [x] Charter 认可（铲屎官 2026-06-14）
- [x] v1 骨架 + prompt.md（宪宪）
- [ ] 砚砚 review prompt（版本真实性 / 一手源强度 / schema 逼出分层判断）
- [ ] Round 1: Source Ledger（确认候选版本存在性 + 一手源）
- [ ] Round 2: 机制深挖 + 猫咖映射
- [ ] mind-map 填实 + learning-guide 跑第一节
