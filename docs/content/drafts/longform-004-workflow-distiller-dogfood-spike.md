---
feature_ids: []
related_features: [F192, F208, F221]
topics: [workflow-distiller, dogfood, spike, delta-learning, reference-eval, validator-surface, taste-fitting]
doc_kind: spike-plan
created: 2026-06-05
status: seed
source_refs:
  - docs/content/drafts/longform-004-seed-workflow-distiller.md
  - docs/content/drafts/longform-003-workflow-distiller-opus-round.md
  - docs/features/F208-capability-profile-routing.md
  - docs/features/F221-taste-lane.md
---

# Workflow Distiller v0 — Dogfood Spike Plan

> 配套 [Longform-004 Seed](./longform-004-seed-workflow-distiller.md)。
> 目的：在碰任何外部客户**之前**，先在猫咖自身把 Workflow Distiller 的核心机制证伪/证成一次。
> 这是一个**封闭、可证伪的小实验**，不是产品，不是行业愿景的延伸。

## 0. 为什么要先做这个 spike

004 seed 的整条逻辑（二阶 harness、主体下沉、护城河 = delta learning）都站在一个假设上。如果这个假设在我们**最有利的地形**都不成立，那去做室内设计客户就是白做。所以先验证机制，再选客户。

## 1. 要证伪的假设（H）

> **H**：harness 能把一个 agent 本来做不好的、依赖个人 taste 的判断，通过 reference-based delta learning 提升到「可用」水平——且这个过程**不需要 taste 的拥有者全程在场**（只需要他留下的历史 artifact + 少量 checkpoint）。

H 为真 → 主体下沉成立（从业者 + harness 能替代「全程在场的 FDE」）。
H 为假 → 二阶 harness 命题在最有利地形就崩，必须回炉，**且省下了一整个客户项目的成本**。

## 2. 为什么选「猫咖自身」做地形

这正好是 004 seed §四「验证器是命门」的活体演示——我们故意挑验证器最可得的地形开第一枪：

| 地形要素 | 猫咖自身 | 室内设计客户 |
|---|---|---|
| 验证器 / ground truth | ✅ 宪宪的历史 review 判断是现成 ground truth | ❌ 审美主观，oracle 要现造 |
| artifact 齐全度 | ✅ PR / review comments / mailbox / commit 全在 | ⚠️ 要客户主动交历史项目 |
| 与客户场景同构 | ✅ 宪宪 review 偏好 = 客户 taste delta | — |
| 反馈闭环成本 | ✅ 内部，零外部协调 | ❌ 高 |

## 3. 切口：宪宪 code review 偏好的 reference-based anchoring

**同构映射**（为什么这个 dogfood 能代表客户场景）：

| 客户场景 | 猫咖 dogfood |
|---|---|
| 客户的 taste delta（什么叫「有创意 / 可用」） | 宪宪的 review 偏好（什么该 approve / 该 blocking） |
| harness 学客户 taste | harness 学宪宪 review 偏好 |
| 客户在 checkpoint 纠偏 | 宪宪历史实际判断当 ground truth |

接 4.7 在 [opus-round](./longform-003-workflow-distiller-opus-round.md#next-suggested-by-opus-47) 的提议，并接到 F208 Capability Profile Routing 同构架构。

## 4. 实验设计（两臂对照）

```text
              待 review 的代码样本（N 个，含历史已知宪宪判断）
                              │
            ┌─────────────────┴─────────────────┐
            ▼                                     ▼
   [Baseline 臂]                          [Treatment 臂]
   裸 agent，不知宪宪口味                 delta-aligned agent
   只给通用 review 指令                   喂入 reference anchor 集
            │                                     │
            └─────────────────┬─────────────────┘
                              ▼
              对齐 ground truth（宪宪历史实际判断）程度
                  → hit-rate / pairwise 胜率
```

- **Reference anchor 集**：从宪宪历史 review 提取
  - 喜欢（approve / 「这样写对」）
  - 讨厌（blocking / push back / 「这样要打回」）
  - 标准（反复出现的 review 口味，如「改返回值结构先 grep 消费方」「verify 用项目工具链不用 npx」）
- **Baseline 臂**：裸 agent，只给通用「review 这段代码」指令，不喂 anchor。**必须断记忆/检索沙箱**（白名单制）——agent 默认能 search memory / 读 repo（MEMORY.md、历史 review 全在里面），不隔离则 baseline 不"裸"，两臂差异被稀释（内效度 blocking，2026-06-09 砚砚裁定）。
- **Treatment 臂**：同一 agent，喂入 reference anchor 集（reference-based delta）。anchor 集与 test 集**文件级**严格分离。
- **Ground truth**：宪宪本人对这批代码的历史实际判断（approve / blocking + 理由）。
- **Eval**：
  - 主指标：treatment vs baseline 对齐 ground truth 的 hit-rate 差。
  - 辅指标：pairwise——「baseline 输出 vs treatment 输出，哪个更像宪宪会说的」，盲评（孟加拉的 pairwise 思路）。
  - rejection 优先：重点看「该 blocking 的有没有 blocking」（否定信号 > 肯定信号）。

## 5. 成功 / 失败判据（必须预注册，先写死再跑）

| 结果 | 判据 | 含义 |
|---|---|---|
| ✅ 成功 | treatment 的 ground-truth hit-rate 显著 > baseline（阈值跑前定，建议 holdout 上 ≥ 明显可感差距） | 机制可行 → 可进入选客户地形 |
| ❌ 失败 | 两臂无显著差异 | 机制不成立 → 在内部就发现，回炉，**不去客户那白做** |
| ⚠️ 部分 | 只在某类 review 上有效（如硬规则有效、taste 判断无效） | 界定了 harness 能下沉的能力边界（正是 seed §三 想知道的） |

**预注册纪律**：阈值、holdout 划分、指标定义在跑实验**之前**写死，避免事后挑数据自我说服（防 EP-002 过早收敛 + 防「猫太会想」）。

### 5 bis. 跑前 Blocking 清单 + 结论边界（2026-06-09，fable-5 round 补充 A + 砚砚裁定）

跑第一轮**之前**必须满足（内效度 blocking，缺一不跑）：

1. **Baseline 臂记忆/检索沙箱**（见 §4）。
2. **Holdout 文件级分离**：anchor 集与 test 集零重叠，划分先写死。
3. **经济学指标预注册**（secondary）：① treatment 臂每次对齐判断的 token 成本；② 等效人工 checkpoint 分钟数——FDE 杀手叙事的「人天变算力」ratio 从第一个实验开始记账。
4. **结论边界写死**：本 spike 的 ground truth 是宪宪历史 review（LLM taste），两臂差异证明的是**机制存在性**，存在自相似偏置（Claude 系 agent 对齐 Claude 系判断天然更易）——**不得外推到"人类客户 taste 可迁移"**。

**外推前必补（预注册 follow-up，不阻塞第一轮）**：landy-taste 臂——用铲屎官 feedback 语料（memory `feedback_*` 全集 + 纠偏原话）当人类 taste 金标：盲化场景让 agent 预测「铲屎官会不会 push back、push back 什么」。gold 标注需清洗 + 盲化，不当「零采集成本」全盘放行（砚砚校准）。该臂同时验证 F192 L3 想测的「记忆是否真在塑形行为」。

## 6. Scope 护栏（按住 over-build）

这是一个**机制验证 spike**，不是产品。明确**不做**：

- ❌ 不做 multi-tenant / 权限 / 隔离
- ❌ 不做 UI
- ❌ 不碰任何外部客户 / 室内设计数据
- ❌ 不做完整 taste 数据结构持久化（那是机制证成**之后**的工程）
- ✅ 只回答一个问题：reference-based delta learning 在有 ground truth 的地形上，到底有没有用

## 7. 所需输入 / 数据

- 宪宪历史 review 语料：PR inline comments、聊天 review、`docs/mailbox/` review 信、commit body 的 Why。
- 一批待 review 代码样本：最好是**有历史已知宪宪判断**的真实 PR（这样 ground truth 免费），划 holdout。
- 跑两臂的执行环境：可用 Workflow 编排（baseline 臂 / treatment 臂各一组 agent）。

## 8. 风险与缓解

| 风险 | 缓解 |
|---|---|
| Ground truth 噪声（宪宪自己前后不一致） | 取多样本、标注一致性；不一致样本单独归类 |
| Reference 集太小 / 过拟合 | holdout 上评；reference 与 test 严格分离 |
| 「显著」是错觉（样本太少） | 预注册最小样本量；pairwise 盲评做交叉验证 |
| 把「agent 会复读 anchor 原文」当成「学会了」 | test 样本要求泛化判断，不能是 anchor 里出现过的 case |
| Ground truth 是 LLM taste → 自相似偏置（Claude 对齐 Claude 偏易），外推性受限 | 结论边界写死为「机制存在性」（§5 bis #4）；外推前必补 landy-taste 人类金标臂（§5 bis follow-up） |
| Baseline 臂不"裸"（默认可 search memory / 读历史 review） | 记忆/检索白名单沙箱（§4），跑前验证 baseline 臂确实摸不到 anchor 同源语料 |

## 9. Next（spike 之后，按结果分叉）

- **成功** → 把机制抽象成 harness 组件：artifact 反推 → reference anchor 提取 → delta-aligned 生成 → validator 比对。再回 004 seed §七 选第一个行业/切口。
- **失败 / 部分** → 回 004 seed §二，修正二阶 harness 命题或缩小可下沉能力声明；记录到 EP / lessons。
- 无论成败 → 这次 spike 本身就是一条「FDE 被执行的过程」轨迹，是二阶 harness 要学的第一个样本。
