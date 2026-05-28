# Skill 自进化论文扒底裤总报告（2026-05-28 圆桌）

> **参与**: 铲屎官 + 宪宪/Opus-4.6
> **起因**: 铲屎官问"微软那个 SkillOpt 是啥" → 一路扒到四篇论文全线溃败
> **结论先行**: 四篇论文都在简单环境里刷分，"skill" 从操作步骤到一句话 tip 不等。跟我们的现实复杂度差了几个量级。核心矛盾是 skill 越具体越有效但越不泛化。
> **详细拆解**: 各论文单独文档见下方链接

---

## 今天看了哪些论文

| # | 论文 | 机构 | 核心方法 | Skill = ? | 改模型？ | 开源？ |
|---|---|---|---|---|---|---|
| 1 | [**SkillOpt**](2026-05-26-microsoft-skillopt/README.md) (arXiv:2605.23904) | Microsoft Research | DL 训练类比（epoch/batch/LR）优化 skill 文本 | L1 答题指令模板 | ❌ Frozen | ✅ MIT, 812★ |
| 2 | [**MUSE-Autoskill**](2026-05-28-bytedance-muse-autoskill/README.md) (arXiv:2605.27366) | ByteDance ByteBrain + RIT | Skill 全生命周期（创建→记忆→管理→评估→精炼） | L2 技术解题配方（PID/Flink/Excel） | ❌ Frozen | ❌ 无 repo |
| 3 | [**SkillFlow**](2026-05-28-skillflow-credibility/README.md) (arXiv:2605.14089) | NTU + HKUST(GZ) | GFlowNet TTB 训 Supervisor + tip 增删 | L0 原子 tips（从未展示内容） | ✅ LoRA | 🟡 4★, 22 commits |
| 4 | **Evolving-RL** (arXiv:2605.10663) | **小红书 + 北大** | RL 共训 Extractor + Solver（共享参数） | L1.5 操作序列（"拿→放"步骤） | ✅ GRPO 全参 | 🔴 4★, **1 commit** |

---

## Skill 概念光谱：论文里的 "skill" vs 现实中的 skill

| 级别 | 代表 | 真面目 | 能 pytest？ | 能自动生成？ | 类比 |
|---|---|---|---|---|---|
| **L0** | SkillFlow | 一句话 atomic tip | N/A | N/A | 便利贴 |
| **L1** | SkillOpt | 单 benchmark 答题指令 | ✅ | ✅ | 一道题的答题卡 |
| **L1.5** | Evolving-RL | 操作步骤序列 | ✅ | ✅（RL 生成） | 做家务的步骤条 |
| **L2** | MUSE-Autoskill | 技术解题配方（326 行中位数） | ✅（Docker） | ✅（论文主张） | 一类题的解法套路 |
| **L3** | **Anthropic / Cat Café** | 经验 + 方法论 + 判断力 + 治理逻辑 | 大部分不能 | ❌ 需真实经验积累 | **一个职业的方法论** |

**四篇论文的"skill 自进化"都在 L0-L2 层。Anthropic 和我们做的是 L3。这不是同一个问题。**

---

## 他们的样本 skill vs 我们的 SOP：任务难度对比

### 各论文最复杂的 skill 示例

| 论文 | 最复杂 skill | 长什么样 |
|---|---|---|
| SkillOpt | SearchQA 搜索指令 | "先搜关键词，对比前三个结果，提取答案"（几十行） |
| MUSE-Autoskill | Flink session query | Apache Flink Java 作业 + POJO schema + Maven 验证（326 行） |
| SkillFlow | **从未展示** | 不知道 |
| Evolving-RL | ALFWorld 操作步骤 | "找目标物体→拿起物体→找目标容器→放入容器"（4 步） |

### 我们的一个普通 feature SOP（以 F198 为例）

```
1.  铲屎官开 feature → 讨论收敛 → spec
2.  design gate → writing-plans 拆步骤
3.  开 worktree（Redis 6398 隔离）
4.  TDD: 红灯 → 绿灯 → 重构
5.  quality-gate: spec AC 逐条 + 愿景覆盖度
6.  request-review → @缅因猫 跨族 review（五件套）
7.  review: P1/P2 定位 → approve / blocking
8.  receive-review: 逐项修复 + 技术论证
9.  merge-gate: pnpm gate → PR → 云端 review → squash merge
10. 愿景守护: @非作者非reviewer的猫 终审
11. Phase 文档同步 + worktree 清理
```

### 量化对比

| 维度 | ALFWorld（论文最爱） | Cat Café 日常 | 倍数 |
|---|---|---|---|
| 动作空间 | 10 个固定动作 | 无限（bash/git/API/MCP/自然语言） | ∞ |
| 任务类型 | 6 种 | 每个 feature 不同 | ∞ |
| 步骤数 | 5-15 步 | 50-500 步 | 10-100× |
| Agent 数 | 1 | 3-7 | 3-7× |
| 并行度 | 无 | 多猫同时 + 跨 thread | N/A |
| 分支决策 | 几乎无（线性） | 每步（传球/push back/升级） | N/A |
| 状态维度 | 房间×物品×位置 | Git×PR×review×球权×进度×记忆 | 100×+ |
| 可逆性 | 完全（放下再拿） | 部分不可逆（merge/push/删数据） | N/A |
| 评分标准 | 二值（完成/未完成） | 多维（质量+覆盖+合规+愿景） | N/A |
| 需要判断力？ | ❌（步骤唯一确定） | ✅（"这个设计好不好"无标准答案） | N/A |

**类比**：论文里的 skill = **教幼儿园小朋友叠衣服**；我们的 SOP = **让跨国团队一起做手术**。

---

## 在现实中如何获得 benchmark？

### 论文为什么都用简单 benchmark

| 条件 | 简单 benchmark 满足 | 现实场景 |
|---|---|---|
| 有标准答案 → 自动评分 | ✅ | ❌ "PR 质量好不好"没标准答案 |
| 环境可复现 → 消融可控 | ✅ 模拟器 | ❌ 外部依赖（CI/GitHub/网络） |
| 动作空间小 → skill 能覆盖 | ✅ 10 个动作 | ❌ 无限动作 |
| 任务类型少 → skill 能泛化 | ✅ 6 种 | ❌ 每个 feature 不同 |
| 单 agent → 无协调开销 | ✅ | ❌ 多猫协作 |
| 快速 rollout → 训练成本低 | ✅ 秒级 | ❌ 一个 feature 可能要天级 |

### Cat Café 要做 benchmark，三条路

| 路径 | 做法 | 成本 | 可行性 |
|---|---|---|---|
| **A. 子任务切片** | 把复杂 SOP 拆成可测子任务："给定 spec，生成 writing-plan"、"给定代码，做 quality-gate 对照" | 🟡 中等 | ✅ 最现实 |
| **B. 历史 replay** | 用真实 session events 回放，对比不同 skill 版本的表现 | 🟡 中等 | ✅ 数据已有 |
| **C. LLM-as-Judge** | 让另一个模型评分（"这个 PR review 质量如何"） | 🟢 低 | 🟡 可靠性存疑 |

**最现实的组合**：B（历史数据免费）+ A（切片出有标准答案的子任务）+ 人工 gate（铲屎官/reviewer 猫终审）。

---

## 训练集表现好 → 跑来我们家开发 100 天？

### 过拟合是通杀死因

| 论文 | Seen 表现 | Unseen 表现 | 落差 |
|---|---|---|---|
| Evolving-RL (GRPO baseline) | 79.9% | 44.6% | **-35.3 pp 暴跌** |
| Evolving-RL (共训) | 96.0% | 88.6% | -7.4 pp |
| MUSE-Autoskill (hvac-control) | 80% baseline | → **20%** | **-60 pp 翻车** |
| SkillOpt | **没测 unseen** | — | 可疑 |
| SkillFlow | 声称 OOD > IID | 机制不明 | 可疑 |

### 不可能三角

```
         Skill 够具体
        （才能帮到当前任务）
              /\
             /  \
            /    \
           / 不可  \
          / 兼得    \
         /          \
        /            \
Skill 够泛化      Skill 够简洁
（才能迁移新题）  （才不误导模型）
```

### 跑来我们家开发 100 天会怎样

假设把四种方法搬到 Cat Café（面向愿景开发 100 天），**最乐观的预估**：

| 方法 | 第 1 天 | 第 10 天 | 第 100 天 |
|---|---|---|---|
| **SkillOpt** | 优化了 tdd skill 的文本 → 单任务可能 +5% | skill 开始在新 feature 上失效 | 训练数据耗尽，无新信号 |
| **MUSE-Autoskill** | 从第一个 feature 提取了配方 | 配方库膨胀到几百个，检索开始混乱 | 大量过时配方污染检索，不如不用 |
| **SkillFlow** | Supervisor 训了几轮 tip 选择 | tip 太浅无法应对新 feature 类型 | 跟不改 skill 的基线无显著差异 |
| **Evolving-RL** | 共训 extractor+solver，ALFWorld 级子任务有帮助 | 复杂协作任务的轨迹太长，extractor 分析质量下降 | 模型学会忽略质量差的 skill（论文自己承认的问题） |

**对比我们实际在做的**：

| 我们的方式 | 第 1 天 | 第 10 天 | 第 100 天 |
|---|---|---|---|
| 铲屎官纠正 → lessons-learned → self-evolution Mode C | 犯错被喊"喵约" | MEMORY.md 积累了 60+ 条教训，skill 被人工 review 过 | **skill 真的变好了**，因为每条改进都经过人工验证 |

---

## 最终判决：一张表总结四篇论文

| | SkillOpt | MUSE-Autoskill | SkillFlow | Evolving-RL |
|---|---|---|---|---|
| **机构** | Microsoft | ByteDance | NTU+HKUST | **小红书+北大** |
| **核心方法** | DL 类比优化 skill 文本 | Skill 生命周期管理 | GFlowNet 训 Supervisor | RL 共训 Extractor+Solver |
| **Skill 级别** | L1 答题卡 | L2 技术配方 | L0 原子 tip | L1.5 操作步骤 |
| **Benchmark** | SearchQA 等 6 个学术 | SkillsBench (自建) | 14 个 (含 SWE-bench) | ALFWorld + Mind2Web |
| **最好成绩** | 52/52 全胜 | 68.4% (+15.2pp) | 94.14 EM (+41.2%) | 96.0% (+98.7% 相对) |
| **改模型？** | ❌ | ❌ | ✅ LoRA | ✅ GRPO |
| **展示了 skill？** | ❌ | ✅ 4 个 case | ❌ **零展示** | ✅ 1 个 case |
| **测了 unseen？** | ❌ | 部分（翻车） | 声称 OOD>IID | ✅ 最详细 |
| **诚实度** | 🟡 | 🟡 | 🔴 概念通胀最重 | **✅ 最诚实** |
| **概念通胀** | 1 级（配方→skill） | 1 级（recipe→skill） | **2 级**（tip+微调→skill evolution） | 1 级（步骤→skill） |
| **可复现** | ✅ MIT 开源 | ❌ 无 repo | 🟡 | 🔴 1 commit |
| **复杂场景命运** | 子领域拆分可能 +5pp | 配方爆炸 + 迁移失败 | tip 太浅 | 轨迹太长 extractor 崩 |

### 对我们有参考价值的局部机制

虽然核心叙事不成立，但每篇有值得偷的零件：

| 可偷的零件 | 来自 | 怎么用到 Cat Café |
|---|---|---|
| **Negative buffer**（记住坏改法防重复犯错） | SkillOpt | → 融入 MEMORY.md feedback 体系 |
| **Validation gate**（改了 skill 要验证） | SkillOpt | → 强化 self-evolution Mode C smoke/promotion gate |
| **Skill 成功率跟踪** | MUSE-Autoskill | → F192 eval 加 per-skill 粒度 |
| **Flow-driven credit**（步级归因） | SkillFlow | → 定位 SOP 中哪一步是瓶颈 |
| **Noise skill 检测**（模型学会忽略坏 skill） | Evolving-RL | → 检测哪些 MEMORY.md 条目实际被猫忽略了 |

### 砚砚独立审计补充：真正可以迁移的东西

我的判定更保守：**不能迁移论文系统，只能迁移实验纪律和少数工程零件**。作者如果把这些方法宣传成"接上就能让 Cat Café 这类复杂开发 SOP 自动进化"，那是过度外推；但如果把它们当作 skill 变更的验证框架，里面确实有能用的部分。

| 可迁移点 | 落地方式 | 必要护栏 |
|---|---|---|
| **Validation gate** | 每次改 `SKILL.md` 后跑 smoke / replay / 人工 review，而不是凭模型自评合入 | LLM judge 只能当辅助信号，不能单独放行 |
| **Negative buffer** | 记录被拒绝过的 skill 改法、失败原因、适用边界，防止下一轮又提出同一种坏建议 | 记录要指向真实 case，不收空泛"以后注意" |
| **历史 replay** | 用 Cat Café session events 回放过去翻车场景，比较新旧 skill 是否少犯同类错 | replay 集必须按时间切分，避免只优化旧题 |
| **子任务 benchmark** | 不测"做好一个 feature"，只测可判定切片：plan 是否覆盖 AC、review 是否抓住 P1、merge gate 是否漏步骤 | 不能把切片分数误当端到端能力 |
| **Per-skill observability** | 统计 skill 是否被触发、是否被实际消费、是否被忽略、触发后是否减少返工 | 指标要能反映负迁移，不只记成功率 |
| **小步编辑 / textual LR** | skill 变更按小 patch 推进，明确本轮只修一个失败模式 | 禁止一次性让 optimizer 重写核心 SOP |
| **Skill 库治理** | 对重复、过期、低消费、高误触发的 skill 做合并/降权/删除候选 | 删除或降权必须有证据，不能按模型喜好清库 |

我不建议迁移的部分：

- **不迁移自动改写核心 SOP**：我们的 L3 skill 含判断力、治理约束和家规，不是 benchmark recipe。
- **不迁移纯 LLM-as-Judge 放行**：这会优化到裁判偏好，尤其容易把"看起来像好 SOP"误判成"真的少翻车"。
- **不迁移单 benchmark leaderboard 叙事**：猫咖的任务分布会漂移，今天刷高的集合明天可能就是过拟合源。
- **不迁移全自动 skill creation**：失败根因必须先由真实案例定位；自动生成可以提草稿，不能直接进入 `cat-cafe-skills/`。

因此，Cat Café 可落地路线不是"训练 skill 文档"，而是：

1. 从真实事故 / 铲屎官纠正 / review 返工里提取失败 case。
2. 把失败 case 切成可 replay 的最小任务。
3. 对 skill 做小步 patch。
4. 用 replay + objective checks + reviewer judgment 三层门禁验收。
5. 把被拒绝的 patch 写入 negative buffer，防止系统反复犯同一种"聪明错"。

这条路没有论文宣传得自动化，但它对我们家更诚实：**skill 不是自己进化，是被真实失败、可追溯证据和跨猫 review 驯化。**

*[砚砚/GPT-5.5🐾]*

### 核心结论

> **"自动优化 skill 文档就能提升 agent 表现"——这个叙事在工业复杂度下不成立。**
>
> 真正推动复杂场景性能的是 **harness 工程**（AHE: Terminal-Bench 69.7→77.0%）和 **经验积累**（MUSE: TAC #1）——不是 skill 文本优化。
>
> 我们在 Cat Café 做的——铲屎官纠正 → 教训沉淀 → 人工 review → 渐进修改——看起来"不自动化"，但这是 L3 know-how 唯一靠谱的进化路径。论文们选择了容易自动化的 L0-L2 层刷分，回避了真正难的问题。

---

## 文档索引

| 文档 | 内容 |
|---|---|
| [SkillOpt 详解](microsoft-skillopt/README.md) | 方法详解 + 成本分析 + 概念通胀 |
| [MUSE-Autoskill 详解](bytedance-muse-autoskill/README.md) | 方法详解 + Skill 概念光谱 L0-L3 |
| [SkillFlow 可信度评估](skillflow-credibility/README.md) | 可信度评估 + 三篇扒底裤 + 复杂场景复现预测 |
| **本文档** | 四篇总报告 + 难度对比 + 过拟合分析 + 最终判决 |

---

*[宪宪/Opus-4.6🐾]*
