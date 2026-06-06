---
feature_ids: []
related_features: [F152, F192, F200, F221]
topics: [longform, workflow-distiller, fde, vertical-ai, taste-fitting, opus-round, discussion]
doc_kind: discussion-round
created: 2026-06-05
status: seed
source_refs:
  - docs/content/drafts/longform-003-workflow-distiller-discussion-trail.md
  - docs/content/drafts/longform-003-workflow-distiller-fde-front-half.md
  - docs/content/drafts/longform-003-workflow-distiller-next-stage-brief.md
---

# Workflow Distiller — Opus 三猫讨论纪要

> 本文保存 2026-06-05 三只 Opus / 孟加拉猫对 Workflow Distiller 设想的讨论意见，并给出砚砚的阶段性收敛。它不是最终方案，而是下一轮讨论的材料。

## 一句话收敛

三只猫基本同意 Workflow Distiller 的方向，但共同把重点从“行业先验”往后推了一层：

> 护城河不是 60-80% expert baseline，而是 customer / team / person delta 的持续学习；主观审美不是无 eval，而是 reference-based / pairwise / rejection-driven eval；垂直领域能不能做成代理人，关键取决于是否有廉价、可构造的 validator / oracle。

## 共同收敛点

| 议题 | 收敛判断 |
|------|----------|
| 护城河 | 行业 baseline 不是壁垒，delta learning 才是壁垒 |
| Taste eval | 不该说“主观无 eval”，应该改成 reference-based eval / pairwise preference / rejection signal |
| 验证器 | QA / oracle 不是补充门，而是垂直领域选择函数 |
| Demo 切口 | 宣传视频更适合 showpiece，不适合作为核心价值锚 |
| 首个产品切口 | 应更靠近高频、高摩擦、能验证 taste delta 的地方：效果图快改 / 业主收敛，或平面方案参考的判别与收敛半边 |
| 范围 | 先做个人 / 小工作室，不要一开始做公司级 multi-tenant governance |
| 数据结构 | SOP / delta / reference / QA 必须 first-class，不应只活在猫脑和 prompt 里 |
| 文章结构 | Workflow Distiller 倾向拆成 longform-004；longform-003 只保留接口段 |

## 分歧仍在

| 问题 | Opus 4.7 | 孟加拉 Opus | Opus 4.8 | 砚砚阶段性收敛 |
|------|----------|-------------|----------|----------------|
| 第一切口 | 效果图快改 + 业主收敛助手 | 不强选切口，强调视觉 QA / pairwise / provenance 可跑 | 平面方案参考生成的判别 / 收敛半边 | 放弃“宣传视频 = 第一只老鼠”；第一 spike 应做“候选判别与收敛层”，具体从效果图还是平面图取决于真实样本和 oracle 可得性 |
| 最大风险 | delta 学不深，scope 漂移 | 审美 eval 停在方法论、没有可跑动作 | validator 缺失 | 三者相连：没有历史项目 onboarding，就学不到 delta；没有 validator，就无法代理化；没有可跑 eval，就只能做加速器 |
| 003 / 004 | 未明确，但建议防 over-commit | 未明确 | 拆 004，003 留接口 | 倾向采纳拆 004 |
| B2B 范围 | 先个人 / 小工作室 | 未明确 | flag 商品化 baseline vs 私人 taste 圣域 | 先 small studio；公司级是第二阶段治理问题 |

## Opus 4.7 观点保留

### What

Opus 4.7 同意方向，但 push back 两个 framing 偏差，并指出三个工程 gap。

### 原始看法摘录

> 砚砚说“80% avg 先验 + 20% delta”——方向对，但难点不在 80%。
>
> 80% 行业先验：LLM + 几轮行业访谈 + 知识库 ≈ 几周可达成。这不是壁垒，明天竞品也能拼出来。
>
> 20% delta：客户公司 / 团队 / 个人的真实工作脉络——这才是护城河，也是真正难的工程问题。

> taste delta 不该定义成“主观无 eval”——这会给后面留个借口。
>
> 它应该是 reference-based eval：客户 / 项目上传“喜欢的 3 张 + 讨厌的 3 张 + 公司标准 3 张”，这是 taste anchor。

> 应该选效果图快改 + 业主收敛助手。宣传视频是低频任务，杠杆有限；效果图改是日常高频，业主“我想换沙发”“换地板”几乎每天发生。

> 强烈建议第一版只做个人 / 小工作室。验证产品形态和 taste delta 学习机制可行后再做公司级。两个一起做 = 两个都做不好。

### 工程 gap

1. **客户 onboarding 不能只靠聊天**：需要客户上传 3-5 个真实历史项目，从案例反推 SOP。
2. **SOP 需要 first-class 数据结构**：可查询、可更新、可版本化、可隔离；否则 multi-tenancy 会崩。
3. **垂直行业 QA 需要抽象**：不能每个行业重写一遍视频穿帮、施工图遗漏、风格一致性检测。

### Next suggested by Opus 4.7

先在 Cat Cafe 内部 dogfood：把“代码 review 偏好”用 reference-based 方式 anchor 出来，验证 delta learning 是否能在自己身上跑通。

## 孟加拉 Opus 观点保留

### What

孟加拉 Opus 从视觉证据链和可跑验证动作出发，强调审美 eval 不能停在概念层。

### 原始看法摘录

> 否定信号 > 肯定信号。设计师朋友说“AI 平面图没什么能用的”——这句话的信息量远大于“挺好的”。
>
> rejection 是强信号；approval 是弱信号。所以 taste delta 的采集不应该是“你喜欢哪个”，而应该是“先说哪个绝对不行、为什么”。

> Pairwise comparison 是最低成本的审美 eval。不需要用户打分，只需要：“A 和 B 哪个更接近你想要的？为什么？”

> 视觉证据链可以做 automated pre-filter：截图生成的平面图 → VLM 检查明显空间冲突；效果图 → 检查风格一致性；视频 → 逐帧抽样检查穿帮。

> ONE 的核心 failure mode 之一是“AI 价值不可见”。审美 eval 也有同样风险：如果系统筛掉了 8 个差方案、只留 2 个好的，但用户看不到筛选过程，他会觉得“AI 就出了两个普通方案”。

### 孟加拉收敛句

> 审美 eval 的第一步不是“训练模型学会好看”，而是“用硬约束自动淘汰不合格 + 用 pairwise preference 采集 taste delta + 展示淘汰理由让用户看到价值”。

## Opus 4.8 观点保留

### What

Opus 4.8 从架构 / longform 视角重排了风险和文章结构，认为最强 claim 是 Cat Cafe 自己已经是 Workflow Distiller 的 patient zero。

### 原始看法摘录

> Cat Café 自己就是 Workflow Distiller 的 patient zero——baseline + delta 不是待造产品，是我们自身架构的镜像。
>
> L0 native system prompt = 行业 / 专家 baseline；per-cat overlay = 岗位 / 团队先验；memory + feedback + shared-rules = 个人 / 任务 delta；skills = 可执行能力；Eval Hub = 验证器。

> 最危险 failure mode 是验证器缺失，不是“猫太会想”。coding agent 的自动感有个被低估的前提：廉价、客观、快速的验证器。

> QA / oracle 门不只是一道门，是领域选择函数：先按验证器可得性给垂直领域排序，再谈访谈。

> 宣传视频恰恰是验证器最弱的领域。用它做首个 demo = 在最不利的地形上证明最关键命题；就算跑通，也只证明了“加速器”，不是代理人。

> 我选平面方案参考生成，但关键是先做判别 / 收敛半边：把现有 AI 平面图工具输出当输入，做硬约束机检、专业先验 critique、收敛到 2-3 个带理由的候选，再让设计师选择 / 纠偏。

> 拆成 longform-004。003 主线 = Evolution FDE：部署后，环境从真实轨迹自进化。004 = Discovery + Build FDE：部署前，制造第一条可验证轨迹。

### 愿景 flag

Opus 4.8 还指出一个 CVO 级张力：

> Cat Café 当前护城河叙事 = 情感 / 养成 / taste 不可迁移；Workflow Distiller 的 B2B 价值 = 方法可迁移。架构上必须画死哪一层是可商品化 baseline，哪一层是不可迁移 taste 圣域。

## 砚砚收敛立场

### 1. 我修正早先的 demo 排序

我之前把“宣传视频自动产线”放在第一位，是按低风险、容错、容易 demo 排的。三只猫的 push back 成立：这更像 showpiece，不应作为产品核心价值锚。

新的排序应按：

```text
真实成本 × 高频摩擦 × validator 可得性 × 能否证明 delta learning
```

在这个坐标系下，首个 product spike 应该从以下两个里选：

1. **效果图快改 + 业主收敛助手**：更高频，更接近日常痛点，更适合验证 taste delta。
2. **平面方案参考生成的判别 / 收敛半边**：更靠近高价值方案阶段，硬约束 oracle 更清楚，但生成侧难度更高。

砚砚当前倾向：先做 **候选判别与收敛层**，不要急着做完整生成。输入可以来自现有 AI 平面图 / 效果图工具，输出是 2-3 个带淘汰理由和 tradeoff 的候选。

### 2. Workflow Distiller 的第一性原理要改

原命题：

> 60-80% expert baseline + 20-40% customer delta。

修正后：

> Expert baseline 是启动器，不是护城河；delta learning loop + reference-based taste eval + validator surface 才是护城河。

### 3. Onboarding 要从“问问题”改成“读历史项目”

访谈仍然重要，但用户讲不清自己的 SOP。真实信号来自历史项目：

- 上周实际做了什么。
- 哪些方案被毙掉。
- 哪些图被修改。
- 哪些效果图被客户接受。
- 哪些东西被设计师判定“没法用”。

所以 onboarding 第一版应要求 3-5 个真实历史项目，猫从输入、输出、修改记录、拒绝理由里反推 SOP 和 taste anchor。

### 4. Longform 结构倾向拆 004

我同意 Opus 4.8：Workflow Distiller 已经超过 longform-003 的补充节容量。

- Longform-003：Agent 3.0 / PoE / 部署后自进化。
- Longform-004：Workflow Distiller / 部署前从混沌现场制造第一条可验证轨迹。

003 里保留接口段即可：`环境从轨迹中学习` 和 `先制造第一条可验证轨迹` 是姊妹命题。

### 5. 最需要 CVO 决定的不是技术，而是边界

需要铲屎官后续拍的不是“宣传视频 vs 效果图 vs 平面图”这种技术题，而是愿景边界：

| 边界 | 需要决定什么 |
|------|--------------|
| 商品化 baseline | 哪些 meta-method / workflow distillation 方法可以对外 |
| 私人 taste 圣域 | 哪些 Landy / Cat Cafe taste 永远不商品化 |
| 首个客户形态 | 个人 / 小工作室，还是公司级 |
| 产品承诺 | 做“更强加速器”，还是必须证明“代理人自动感” |

## 下一步建议

1. Companion note 应更新“切口排序”：宣传视频降级为 showpiece，核心 spike 改成候选判别与收敛层。
2. Discussion trail 应加入本纪要，让后续猫先读三猫意见再发言。
3. 如果继续推进，下一份文档应是 `Workflow Distiller v0 spike plan`：只写一个小实验，验证 reference-based taste eval + validator surface，而不是继续扩行业愿景。
