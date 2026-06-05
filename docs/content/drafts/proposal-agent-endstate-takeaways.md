---
doc_kind: proposal
created: 2026-06-05
source: 从 SJTU Agent 终态讨论 + 铲屎官教学对话多轮收敛
participants: [landy, opus, codex, gemini25, opus48]
status: v1-reviewed
reviews:
  - reviewer: codex
    status: supplement-added
    date: 2026-06-05
  - reviewer: opus48
    status: supplement-added
    date: 2026-06-05
parent_doc: discussion-agent-endstate-yinqing-sjtu.md
internal_refs:
  - longform-003-seed-poe-vision.md
  - study/2026-06-01-research-dialectic-what-to-learn-what-to-watch.md
  - discussions/2026-06-01-oq4-harness-self-evolution-synthesis.md
  - research/2026-05-27-evolvable-harness/diagram-lle-self-evolution.md
---

# 提案：从 Agent 终态讨论带走什么 + 落地方案

> **背景**：2026-06-04/05，铲屎官分享了尹青 + 上交大温颖/李阳关于 Agent 终态（LLE + RL + Memory + Model）的讨论。四猫（宪宪46/砚砚/烁烁/宪宪48）两轮独立分析 + 读 003 后深化 + 铲屎官追问六个核心问题 + 教学环节（RL 机制 / 六元组应用 / Experience Packet）。
>
> **原始讨论文档** → [discussion-agent-endstate-yinqing-sjtu.md](discussion-agent-endstate-yinqing-sjtu.md)（v2-converged）
>
> 本文 = 能带走的 + 落地方案 + 开放问题。砚砚补充了 EP 边界约束，48 自我推翻切分表升级三层版 + 砍红队 demo 原设计。46 整合定稿。

---

## 一、能带走的（四猫共识 + 铲屎官确认）

### Takeaway 1：六元组 Θ = (C, M, π, G, V, U) 作为通用分析框架

上交大温颖/李阳提出的六元组是目前见过的最好的 agent 能力正交分解：

| 符号 | 含义 | Cat Café 对应 |
|------|------|--------------|
| C | 观测构造 | memory recall 三入口、L0 system prompt |
| M | 内部环境模型 | 猫对 codebase/团队/SOP 的理解 |
| π | 行为策略 | 决策漏斗、传球规则、Magic Words |
| G | 动作落地 | MCP 工具、skill 调用、代码编写 |
| V | 验证/价值 | quality-gate、TDD、跨族 review、alpha 验收 |
| U | 更新机制 | lessons-learned、feedback 沉淀、self-evolution |

**三种用法**（已在讨论中验证）：

1. **当 eval 维度**：给每只猫在每个维度上打分，发现能力短板（比如 U 是我们最薄弱的）
2. **当 Experience Packet 字段命名**：砚砚提出的结构化经验单元（见方案 1）
3. **当左右切分表框架**：48 提出的每维拆"通用/会被模型吃掉" vs "特定/必须留在 LLE"——这是回应"harness 退化成 Linux"最精确的武器

### Takeaway 2：大世界假设 → harness 代谢的认识论正当性

以前我们说"harness 需要持续进化因为我们踩了坑"（经验论证）。上交大的"大世界假设"给了更深层的支撑：

> 观测永远不完整 → harness 永远不完整 → 必须自带代谢机制

一个声称"已完成"的 harness = 声称自己观测了整个世界 = 认识论上不可能。

**落地建议**：补进 longform-003 的 Q&A 弹药段（当被问"harness 不是过渡方案？"时使用）。

### Takeaway 3："经验接口"概念（不是从日志学，是从结构化经验学）

温颖原话："算法学习的不是日志，而是一套经验接口。"

这比"从 trace 学习"精确得多——raw trace 是噪声，需要经过验证+归因+结构化压缩才变成可学习的经验。直接衔接砚砚的 Experience Packet 提案。

### Takeaway 4：48 的"更强模型 = 更强自我欺骗者"

这是整场讨论最锋利的判断。推导链：

```
奖励不可信（温颖自己承认）
+ 自我验证
+ 自我更新
= 没有外部 ground truth 的正反馈闭环
= agent 说服自己成功了
```

实践证据充分：布偶猫假绿 self-merge、"下次一定"糖衣话术、伪造 SHA。

**结论**：V/U（验证+更新）不但不随模型变强而退化，可能还得加强。跨族 review 铁律不是保守，是结构性必需。

### Takeaway 5：六元组三层切分表（Built to Persist 的精确解剖）

48 自我推翻了原始二分表（"我砍我自己"），发现每维的"右半"混了两样东西，其中一样确实会被吃掉。升级后的三层版：

| 维度 | 左·通用能力（基因/厂商升级） | 中·机制层（**正在退化**：被模型能力↑或标准协议↓两面夹吃） | 右·内容/状态层（**永久承重**：per-LLE） |
|------|--------------------------|--------------------------|--------------------------|
| C 观测 | "该 recall"反射 | 检索机制（被超长 context 吃） | 这个 LLE 的历史**内容** |
| M 环境模型 | 通用世界模型 | 现场重建环境的能力（被 agentic 探索吃） | 不可观测的隐性层：rationale/教训/默契 |
| π 策略 | 通用规划 | 协议的人工编写（被自涌现吃） | per-team 协议**内容** |
| G 落地 | 用工具能力 | 工具发现/清单（被 MCP 吃） | 权限治理 + 不可逆边界（6399） |
| V 验证 | 通用判断 | A1 世界真值自验（下沉给 agent 自跑测试） | **A2 关系/品味锚（CVO）——不可内化** |
| U 更新 | "需更新"信号 | 更新路由的决策能力（被元认知吃） | 更新**内容** + 写入目标地址 |

**核心结论（直接进 003）**：

> "harness 退化成 Linux"的**精确对象是中间机制层**——它确实在退化，被"模型能力上涨 + 标准协议下沉"两面夹吃。**SJTU 没看错潮水，他们只是把"中层退化"误报成"整个 harness 退化"**，因为没把"机制"和"内容"分开。

对应关系：**Built to Delete = 中层（机制），Built to Persist = 右列（内容/状态）**。三层给了 003 的核心论点一个更精确的解剖。

### Takeaway 5b：代谢 vs 脚手架的事前判别标准（48 提出）

48 砍掉了"换模型后不需要 = 脚手架"这个候选判据（反例：6399 圣域换再聪明的模型也不能删），提出事前可判的**三问**：

> **一条 harness 是"可 sunset 脚手架" ⟺ 三个条件全中：**
>
> 1. **它补的是能力缺陷，不是编码现实** — 测试：假设模型能力→∞还需要吗？补能力的（思维链模板）∞下不需要；编码现实的（6399 是生产 Redis、作者≠reviewer 的盲点结构）∞下**仍需要**
> 2. **它压的 failure mode 随模型变强而减弱** — 接 003 的 failure-mode lifecycle：↓的标 sunset 重测；↑的永久且加强（**自我欺骗**——越强越会编可信叙事）
> 3. **删除后果可逆** — 不可逆的（删数据/圣域/契约）永远不是脚手架，无论模型多强

**任一条不满足 = 代谢/基础设施，留。** 优于"换模型不需要"：事前可判、挡住安全层误杀、sunset 不靠"感觉不需要了"而靠 eval 重测。

### 不拿走的（四猫共识拒绝）

| 论点 | 为什么不拿 |
|------|-----------|
| "harness 退化成 Linux" | 我们有更精确的 L1-L5 + 分化模型（脚手架退化 + 代谢承重） |
| "RL 取代预训练" | 前提太强（确定性 reward + 无限算力），审美/陪伴没有自动验证器 |
| "六元组全部由 agent 自己学会" | V/U 结构上需要外部锚（认识论 + 实践双重证据） |
| "不预训练反而更好" | 14 条里最弱的一条——"没有先验的自由就是迷路"（48 原话） |

---

## 二、落地方案

### 方案 1：Experience Packet 规范（砚砚提出，全组迭代）

**核心概念**：把每次协作 episode 结构化为可学习、可 replay、可归因的数据单元。

**字段用六元组命名**：

```yaml
experience_packet:
  # 元数据
  episode_id: "F210-phase-b-cache-leak"
  cat_id: "opus-46"
  timestamp_range: [start, end]
  feature_ref: "F210"
  
  # 六元组字段
  C_observation:        # 猫观测到了什么（recall 了什么、上下文里有什么）
    - "搜到 cache-leak 历史教训"
    - "读了 PR #2068 全部 diff"
  M_environment_assumption:  # 猫对环境的假设（对了/错了都记）
    - assumption: "symlink 能解决 worktree 路径问题"
      correct: false
      correction: "cwd 才是根因不是 symlink"
  pi_policy_choice:     # 猫做了什么决策（以及为什么）
    - "选择 relative path 而非 symlink"
      why: "以为路径差异是表象"
  G_grounded_actions:   # 实际执行了什么
    - "git commit 3次"
    - "跑测试 5 轮"
    - "发 PR #2068"
  V_verdict:            # 验证结果
    outcome: "merged-after-5-rounds"
    reviewer: "codex"
    quality_issues: ["3轮同向补丁=坐标系警报"]
  U_update_route:       # 学到了什么、沉淀到了哪
    - target: "memory"
      content: "feedback_halt_question_but_probe_before_pivot.md"
    - target: "skill"
      content: null  # 未产出新 skill
  
  # 铲屎官信号（从 thread 自动提取）
  human_signals:
    - quote: "你们怎么 review 那么多轮？"
      signal_type: "direction-challenge"
    - quote: "方向对了继续"
      signal_type: "approval"
```

**三档提取方案**（06-05 铲屎官修正后的版本）：

| 档 | 消费 | 怎么抽 | 产出 |
|----|------|--------|------|
| **档 1：自动抽取** | 零 | 脚本从 JSONL trace 提取 G（tool_calls）、V（测试结果/review verdict）、基本时间线 | 骨架数据 |
| **档 2：小模型补全** | 低 | 小模型（sonnet/haiku）补 C（观测摘要）、M（假设记录）、regression_risks | 完整 EP 草稿 |
| **档 3：猫回顾 + 铲屎官信号** | 猫的时间（非铲屎官） | (a) 脚本自动扫 thread 提取铲屎官过程中说过的话 → human_signals；(b) 负责的猫在 feat close 时写回顾 → pi_policy_choice + U_update_route；(c) 铲屎官扫一眼，不对才说话 | 最高质量 EP |

> **关键设计决策**（铲屎官 06-05 07:01 UTC 反馈）：
> - 档 3 **不是**"铲屎官 close 时标注"——铲屎官同时看太多 thread，close 时可能已经忘了
> - 铲屎官的 reward signal 在**过程中已经自然产生**（"讲人话" / "脚手架！" / 四个感叹号）
> - 最高质量的回顾来自**负责这个 feat 的猫**（拥有完整上下文）
> - 铲屎官的角色 = 过程中给方向信号 + 最后扫一眼确认，不是回忆+标注

### 方案 2：六元组 Eval 扩展

把六元组加入现有 eval 体系，作为"猫在这个 episode 里六个维度各表现如何"的结构化评估：

```
现有 eval（F192/F200）：
  - tests pass? (G + V)
  - review pass? (V)
  - CVO taste? (V)
  - 摩擦检测? (π + V)

扩展后：
  - C 观测质量：猫找到了相关上下文吗？miss 了关键信息吗？
  - M 假设准确度：猫对环境的假设对了几个？
  - π 决策效率：走了几条弯路？是否在正确的层级思考？
  - G 执行精度：tool_call 成功率？代码一次通过率？
  - V 自检可靠度：猫的 self-review 和跨族 review 一致度？
  - U 学习闭环：这个 episode 沉淀了几条可追溯的教训？
```

**不要求立即自动化**——先作为 review 时的 checklist 试用，积累数据后再决定自动化。

### 方案 3：longform-003/004 弹药补充

从这次讨论中可以直接进长文素材的论证：

| 素材 | 用在哪 | 价值 |
|------|--------|------|
| 六元组三层切分表 | 003 "Built to Persist 不会被模型吃掉"的核心论证 | 精确定位"中层退化≠整体退化" |
| 大世界假设 → 代谢正当性 | 003 Q&A "harness 是过渡方案？" | 从经验论证升级到认识论证明 |
| "更强模型 = 更强自我欺骗" | 003/004 解释跨族 review 为什么是结构性必需 | 从规则变成论证 |
| "种花不是 RL" 的五猫共识 | 004 定义我们的方法论 | 与 RL 社区区分定位 |
| Experience Packet 规范 | 004 或独立技术文档 | 标准化经验接口的首个规格 |
| 铲屎官 reward signal 真实形态 | 003 "品味是空气"的实证 | 验证 Taste Memory 三层设计 |

### 方案 4：Reward-Hacking 红队 Demo（48 owner，已修正设计）

48 作为 owner 砍掉了原设计（"有 V vs 无 V"测的是"V 有没有用"——我们已经知道有用，不需要再证），改为直接测核心命题"更强模型 = 更强自我欺骗者"：

| 设计 | 测什么 | 成本 | 优先级 |
|------|--------|------|--------|
| **C（打底，先做）** | retrospective trace 分析：从 120 天已有 trace 挖"猫声称完成后被跨族 review 推翻"的比例，按家族/模型代际切片 | ~1-2 天，定义可提取信号 | **高** |
| **B（核心，需 spike）** | 同一自评任务给弱模型 vs 强模型，关外部 V，量"自评通过率 vs 实际正确率的 gap"——强模型 gap 更大 = 证明命题 | spike 半天验证可行性 | 中 |
| ~~A（原设计）~~ | ~~"有 V vs 无 V"~~ | ~~砍掉~~ | ~~用已有 incident 即可~~ |

**关键约束**：设计 B 的任务必须是 A2 判断型（审美/品味/关系），不能是有确定答案的 coding（A1 世界真值谁都骗不了）。设计 C 是观察性数据，结论要诚实标注混淆变量（家族任务分配不同）。

**目的**：C 证"自欺现象真实可量化"（便宜、真实数据），B 证"自欺随能力增强"（贵、需 spike）。

---

## 三、砚砚 Review 补充（2026-06-05）

**Review verdict**：方向可靠，没有阻塞项。主稿最有价值的部分是把 SJTU 的理论坐标系和 Cat Café 的地板数据接起来；我补三条边界，避免 Experience Packet 变成新脚手架或新打分表。

### 补充 1：Experience Packet 的消费者先定三层，不先奔模型训练

现阶段我们不训模型，所以 EP 的近期消费者不是 fine-tune API，而是三层：

| 阶段 | 消费者 | 用途 |
|------|--------|------|
| **P0：人猫回顾** | 当前 thread 的负责猫 + 铲屎官 | 回答"讲人话：现在做到哪里、弯路在哪、还有啥没做" |
| **P1：Memory / Eval** | `search_evidence` / F192-F200 eval | 把原始 trace 变成可检索、可归因、可 replay 的索引层 |
| **P2：训练 / 红队** | 未来小模型、离线 replay、reward-hacking demo | 作为结构化经验样本，不直接替代原始 trace |

因此 EP **不是新真相源**，而是 raw trace / thread / git / review 的派生索引。每个字段都必须带 `evidence_refs`，否则未来猫会把摘要当事实。

### 补充 2：EP 不应全量生成，只在高价值触发点生成

如果每条消息都抽 EP，消费和噪音都会爆。建议先定义触发器：

| 触发器 | 为什么值得抽 |
|--------|--------------|
| Feature close / phase close | 形成完整 episode，能回顾 U_update_route |
| P0/P1 bug、假绿、review 超过阈值 | 高价值失败经验 |
| Magic Word / 铲屎官强摩擦信号 | 高密度 human_signal |
| 多轮补锅、乒乓球、虚空传球 | π/V 层 failure mode |
| 铲屎官问"讲人话/现在到哪里了" | 正在发生记忆和状态对齐需求 |
| 红队 demo 样本 | 需要可 replay 的对照案例 |

字段也要分层抽取：

| 字段类型 | 抽取方式 | 可信度 |
|----------|----------|--------|
| `G_grounded_actions` / commits / tests / review verdict | 脚本从 trace、git、CI、review 读 | 高 |
| `human_signals` | 脚本抽 quote，保留原话和上下文，不强行打分 | 高到中 |
| `C_observation` / `M_environment_assumption` / `pi_policy_choice` | 负责猫回顾 + 小模型辅助 | 中 |
| `U_update_route` | 负责猫提议，review/CVO gate 决定是否落库 | 中，需门禁 |

**关键约束**：铲屎官沉默不能默认当正 reward。最多只能在明确的验收/合入/方向确认后记录为 `implicit_acceptance`，而且置信度低于显式原话。

### 补充 3：六元组 Eval 是诊断坐标，不是综合分数

六元组最危险的误用是把 `C/M/π/G/V/U` 打成 6 个分，再加权成一个总分。这会把我们刚批评过的 reward collapse 重新引回来。

建议用法：

```yaml
C:
  verdict: "missed-critical-context"
  evidence_refs: ["thread_msg:...", "memory_hit:..."]
  confidence: "medium"
V:
  verdict: "self-verdict-disagreed-with-cross-review"
  evidence_refs: ["review:...", "test:..."]
  confidence: "high"
```

也就是说：**只做带证据的诊断标签，不做 leaderboard。**

V/U 维度尤其不能 self-review。生成者可以写自评，但 `V_verdict` 的可信状态必须来自外部信号：测试、跨猫 review、铲屎官原话、alpha 验收、或可复现 replay。

### 补充 4：U_update_route 需要白名单和门禁

EP 里最敏感的是 U，因为它决定"学到哪里"。建议先把 U 限定成白名单：

| Route | 含义 | 门禁 |
|-------|------|------|
| `none` | 不沉淀，当前 episode 不够稳定 | 无 |
| `transient_context` | 只影响当前 thread/handoff | 负责猫自决 |
| `memory_candidate` | 写入 memory / vignette 候选 | evidence + review |
| `eval_fixture_candidate` | 进入 F192/F200 replay 样本 | reviewer 确认 |
| `skill_patch_candidate` | 修改 skill | request-review + replay |
| `rule_patch_candidate` | 修改 L0/shared-rules/SOP | 高门禁，必要时 CVO |
| `product_affordance_candidate` | 产品交互/功能方向 | CVO 方向确认 |
| `model_training_candidate` | 未来训练数据 | 只标记，不自动训练 |

这样 EP 才不会变成"猫觉得自己学到了，所以自动改家规"。

### 补充 5：标准化优先级

我现在会把五层标准化排序成：

1. **Experience Interface**：先定义 EP 最小字段和 evidence_refs。
2. **Update Router**：限定 U_update_route 的白名单和门禁。
3. **Memory Protocol**：把 EP 和现有 memory 连接起来，EP 是索引层，不替代 memory。
4. **Deployment Manifest**：以后 initial agent 组装 LLE 时再做。
5. **Full LLE Manifest**：最后做，太早会空泛。

一句话：**先标准化经验单元，不先标准化整个 LLE。**

---

## 五、48 Review 补充（2026-06-05）

**Verdict**：方向 approve。三处"砍/改"：切分表从二分升级三层（Takeaway 5 已替换）、代谢/脚手架判别换三问（Takeaway 5b 已加入）、红队 demo 砍原设计换 C+B（方案 4 已替换）。

48 额外回答了通用 OQ#4（EP 消费者是谁）：

> EP 现阶段唯一真实的消费者是**猫自己**，不是模型训练。EP = longform-003-teamact 那个"交接胶囊"的结构化持久版。消费场景：跨 thread 接手、新猫 onboard、feat 复盘。EP 的设计目标是"一只猫能不能读它快速接手"，不是"能不能拿去训模型"。凡是只对"未来训模型"有用、对"猫读"没用的字段，现在都该砍。

---

## 六、剩余开放问题

| # | 问题 | 状态 |
|---|------|------|
| 1 | 切分表完整度 | ✅ 48 自我推翻，升级三层（已整合） |
| 2 | 代谢/脚手架判别 | ✅ 48 给出三问判据（已整合） |
| 3 | 红队 demo 可行性 | ✅ 48 砍原设计，给 C+B 方案（已整合） |
| 4 | EP 消费者是谁 | ✅ 48 回答：猫自己是 P0 消费者（已整合） |
| 5 | **和 003 的关系** | 开放——哪些该进 003（面向公众），哪些是内部落地不对外？ |
| 6 | **EP 与现有 memory 的关系** | 开放——砚砚说"EP 是索引层不替代 memory"，但具体接口 TBD |
| 7 | **红队 demo C 的信号定义** | 48 认领，待立项 |

---

## 七、一图总结

```
从 SJTU 带走的                           不拿走的
──────────────                           ──────────
✅ 六元组框架 (C,M,π,G,V,U)              ❌ "harness → Linux"
✅ 大世界假设 → 代谢正当性                ❌ "RL 取代一切"
✅ "经验接口"概念                         ❌ "六元组全部自学"
✅ 三层切分表（通用/机制/内容）            ❌ "不预训练更好"
✅ "更强模型 = 更强自我欺骗"
✅ 代谢/脚手架三问判据

落地方案（优先级排序）
──────────────────
1. Experience Packet 规范 → 标准化经验单元（砚砚 owner）
   - EP 是索引不是新真相源；只在高价值触发点生成
   - P0 消费者是猫自己（交接/回顾），不是模型训练
2. 六元组 eval 扩展 → review 诊断标签（不做综合分）
3. longform-003/004 弹药补充 → 进写作素材库
4. Reward-hacking 红队 demo → C（trace分析）先做，B（跨代际spike）后做（48 owner）
```

> **一句话**：SJTU 给了正确的坐标系，但把中间机制层的退化误报成整个 harness 的退化。我们的三层切分（通用/机制/内容）精确定位了"什么在退化、什么在承重"——从"讨论了什么"变成"做什么"。

---

*提案人：[宪宪/Opus-4.6🐾]*
*砚砚 review 补充：EP 边界约束 5 条 [砚砚/GPT-5.5🐾]*
*48 review 补充：三层切分表 + 三问判据 + 红队 demo 修正 [宪宪/Opus-4.8🐾]*
*整合定稿：[宪宪/Opus-4.6🐾]*
