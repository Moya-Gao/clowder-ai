---
feature_ids: []
related_features: [F152, F192, F200, F208, F221]
topics: [longform, workflow-distiller, fde, second-order-harness, subject-descent, vertical-ai, validator-surface, taste-fitting]
doc_kind: longform-seed
created: 2026-06-05
status: seed
source_refs:
  - docs/content/drafts/longform-003-seed-poe-vision.md
  - docs/content/drafts/longform-003-workflow-distiller-fde-front-half.md
  - docs/content/drafts/longform-003-workflow-distiller-opus-round.md
  - docs/content/drafts/longform-003-workflow-distiller-next-stage-brief.md
  - docs/content/drafts/longform-004-workflow-distiller-dogfood-spike.md
  - docs/competitor-research/dingtalk-one-postmortem/cat-cafe-pmf-failure-mode-audit.md
  - docs/features/F221-taste-lane.md
---

# Longform-004 Seed — Workflow Distiller / 二阶 harness

> 003 的姊妹篇，由 2026-06-05 三猫讨论 + 铲屎官拍板拆分而来。
> - 讨论原始材料见 [Opus 三猫讨论纪要](./longform-003-workflow-distiller-opus-round.md)。
> - FDE 前半段方法论见 [companion note](./longform-003-workflow-distiller-fde-front-half.md)。
> - 内部验证实验见 [Dogfood Spike Plan](./longform-004-workflow-distiller-dogfood-spike.md)。
>
> 本文是 seed，不是定稿。它只负责把命题钉准、把边界标清、把分歧记全，供后续展开成正式 longform-004。

## 零、一句话核心命题

> Workflow Distiller 不是"用 AI 帮客户造产线"的咨询工具，而是一个**二阶 harness**：它从"FDE 被执行的过程"这条轨迹里学习，把"当 FDE"这件原本只有稀缺人才能做的事，下沉给"行业从业者 + harness"。

它要降的不是"造产线"的成本，是**"当 FDE 这件事本身"的成本**。这正是它和 003 同构的地方。

## 一、和 003 的接口（姊妹命题，不是同一篇）

003 和 004 共享同一架构骨架（分层先验 + 验证器 + 选择压力），但作用在不同的轨迹、不同的时间相位上。塞进一篇会犯 ONE「发心过多」的病，所以拆开、互为指针。

| | Longform-003 | Longform-004 |
|---|---|---|
| FDE 阶段 | Evolution FDE | Discovery + Build FDE |
| 时间相位 | 部署**后** | 部署**前** / 立项 |
| 轨迹 | 真实生产轨迹 | 「FDE 被执行的过程」这条特殊轨迹 |
| 命题 | 环境从轨迹里学习 | 先帮你制造第一条可验证轨迹 |
| 主体 | 已部署的 agent 自进化 | 行业从业者 + harness 协作冷启动 |

一句话接口段（这句既是 003 留给 004 的指针，也是 004 的入口）：

> **003 讲「环境从轨迹里学习」；004 讲「先帮你制造第一条可验证轨迹」。**

## 二、核心命题：二阶 harness

| 层 | 是什么 | 学什么 | 降谁的成本 |
|---|---|---|---|
| 一阶 harness（003） | 让 agent 跑活的 harness | 部署后真实轨迹 | Evolution FDE（长期陪跑迭代） |
| 二阶 harness（004） | 让「做 FDE」这件事跑起来的 harness | 「FDE 行为」本身这条轨迹 | Discovery + Build FDE（访谈、建模、首版方案） |

为什么这是护城河、而不是「又一个 vertical AI 工具」：

- 行业 baseline 谁都能拼（LLM + 几轮访谈 + 知识库，几周可达，明天竞品也有）。
- 真正的壁垒是**一个会从「被使用的过程」里学习如何降低 FDE 门槛的 harness**——它每服务一个客户/行业，自身蒸馏 FDE 能力的本事就更强一点。
- 这呼应 4.7 的 push back：护城河在 `delta learning + reference eval + validator surface`，不在 expert baseline（详见 [opus-round](./longform-003-workflow-distiller-opus-round.md#opus-47-观点保留)）。

## 三、谁来做：主体下沉

铲屎官的原问题：「这总不能是 landy 吧？各行各业 landy 得累死。」答案是把 FDE 这个角色**拆开**，逐能力判断可下沉性，再分阶段把主体往下移。

### 3.1 先拆 FDE 的四种子能力

不拆开就谈不了降本。一个 FDE（或 landy）做 discovery+build 时，混用了四种可下沉性天差地别的能力：

| 子能力 | 能否下沉 | 怎么下沉 |
|---|---|---|
| **抠 delta**（在行业 baseline 上反推客户的真实差异） | ✅ | 不靠访谈技巧，靠「上传 3-5 个真实历史项目，harness 在**自带的行业 baseline** 上、从 artifact 反推出**公司/团队/个人 delta + 验证器候选**」（不是从零反推第一版 SOP）。把稀缺的「访谈高手」换成任何从业者都会的「交出真实项目」 |
| **工作流建模**（拆输入/判断/返工/交付，找人肉路由器） | ✅ | LLM + 行业 baseline 的主场（已证明猫能猜中 ~80% 室内设计 SOP） |
| **AI-native 重构 + 验证器设计** | ⚠️ 工程核心 | harness 提供的不是「猜个工作流」，是一个**验证器构造库**：硬约束检查器 + pairwise 采集 + reference eval + domain QA 抽象。从业者不懂怎么设计 oracle，在库里选/配 |
| **战略 taste**（这切口值不值得 / 60 分够不够 / 付费信号真假） | ❌ 不可完全下沉 | landy 的永久角色 |

关键就在第一行：「抠 delta」能下沉，是因为它可以从「靠人访谈」换成「从 artifact 反推」——**这就是 003 思想的直接套用：从轨迹/案例学，不靠稀缺的人**。

### 3.2 主体三阶段下沉

| 阶段 | 谁当 FDE | harness 角色 |
|---|---|---|
| **Bootstrap**（第 1 个客户/行业） | landy + 猫咖手工趟 | harness 在「被录制」——记录 FDE 过程成轨迹 |
| **Assisted**（同行业第 2~N 个） | 行业从业者 + harness | harness 接管访谈/建模/验证器，人只提供 artifact + 在 checkpoint 做 taste 判断 |
| **Self-serve**（成熟行业） | 从业者自助 | harness 全程驱动，landy 只在异常时介入 |

**landy 角色重定义**：从「每个客户的 FDE 执行者」降级成「第一遍的 bootstrapping trainer + 永久的 taste oracle」。不是 O(客户数) 的重复劳动，所以不会累死。各行各业要的不是 landy 本人到场，是 landy 趟过第一遍后沉淀下来的 harness。

## 四、验证器是命门（领域选择函数）

铲屎官反复用 coding agent 的「授权 → 执行 → review」自动感类比。这个自动感有一个被低估的前提：**廉价、客观、快速的验证器**（编译/类型/测试/lint/CI）。系统在交给人 review 之前，机器验证器已经挡掉了大部分错误，人只 review 残差。

所以垂直领域的命门不是访谈能力或行业知识（那是 Workflow Distiller 的强项），而是：**这个领域有没有可构造的廉价验证器 / 验证器是否客观。**

推论：**QA / oracle 不是「补充门」，是领域选择函数。**

- 先按验证器可得性给垂直领域排序，再谈访谈。
- 验证器可得 → 能做到「代理人」（铲屎官要的版本）。
- 验证器不可得或纯主观 → 只能做「加速器」，要诚实把这个预期告诉客户，别让漂亮的立项包透支承诺。

## 五、护城河重定义（三猫收敛）

详细收敛见 [opus-round 共同收敛点](./longform-003-workflow-distiller-opus-round.md#共同收敛点)，此处只钉结论：

1. **不是 baseline，是 delta learning loop + reference-based taste eval + validator surface。**（4.7 + 砚砚）
2. **Onboarding 从「问问题」改成「读历史项目」**：用户讲不清自己的 SOP，真实信号在 artifact 里（被毙的方案、被改的图、被拒的理由）。（4.7 Gap 1 + 砚砚）
3. **SOP / delta / reference / QA 必须 first-class 数据结构**：可查询、可更新、可版本化、可隔离，否则 multi-tenancy 一上来就崩。（4.7 Gap 2）
4. **审美不是无 eval**：reference-based + pairwise + rejection-driven。否定信号 > 肯定信号；展示淘汰理由让价值可见（防 ONE 的「AI 价值不可见」）。（孟加拉 + 4.7）
5. **这和 F208 Capability Profile Routing 同构**：对象从「猫的能力画像」换成「客户的品味画像」，架构层可复用。（4.7）

## 五 bis、三维度澄清 + delta 的对外翻译（48 × 砚砚 2026-06-05）

「delta / prior / 启动」三个词在讨论里反复糊在一起（铲屎官、48 都踩过）。根因是把**三个正交维度**塞成一条线。钉清楚：

| 维度 | 问什么 | 取值 |
|---|---|---|
| **A 粒度**（学什么） | 这套 SOP 多细 | 行业 → 公司 → 团队 → 个人 → 任务 |
| **B 相位**（数据从哪来 / 何时学） | 数据来源 | 自带行业 baseline（t=0 进门就有）→ 冷启动读历史工件（004）→ 稳态读实时轨迹（003） |
| **C 主体**（谁当 FDE） | 谁来操作 | landy/猫手工趟 → 从业者 + harness → 自助（见 §三.2） |

**最易犯的错**：把「冷启动 = 从 artifact 反推第一版 SOP」当成从零——丢了 A 维度的起点。准确表述：

```text
第一版 = 行业 baseline（自带，t=0）
       + 客户历史工件反推出的 公司/团队/个人 delta
       + 验证器候选
```

### delta 的对外翻译（PPT / 客户场景用，别讲 "delta" 黑话）

「delta」是算法黑话，外行听不懂，还容易触发「系统画像员工」的隐私担忧。对外按粒度翻成人话：

| 内部术语 | 对外人话 |
|---|---|
| 行业先验 | 这行通常怎么干（老师傅都懂的通法） |
| 公司 delta | 你们公司的规矩（审批、命名、交付格式） |
| 团队 delta | 你们部门的分工和习惯 |
| **个人 delta** | **个人工作偏好 / 工作习惯 / 质量阈值**（口头可说「工作默契」） |
| 任务 delta | 这一单的特殊约束 |

一句话对外讲法（砚砚）：

> 行业通法让 AI 像**新员工**知道业务；工作默契让 AI 像**老同事**知道你们怎么交付。

硬化（防「默契 = 玄学 / 不可治理」）：

> 「默契」不是玄学，是从历史工件、选择、拒绝、修改记录里沉淀出的**可查看、可版本化、可隔离**的工作偏好和质量阈值。软的是体验，硬的是数据结构。

### 隐私 / 迁移边界（B2B 必答，砚砚 failure-mode）

企业一定会问「学个人习惯 = 偷偷画像员工？离职了归谁？」。预先划线：

- **安全边界**：只学**工作工件里的交付偏好**，不学私人行为；偏好按人 / 团队隔离，可查看、可回滚、可移交。
- **迁移规则**：

| 类型 | 能否跨人迁移 |
|---|---|
| 角色 SOP / 团队交付规范 | ✅ 可迁移给新人 |
| 某个人的工作偏好 / 审美阈值 | ❌ 默认不跨人，除非显式授权或汇总成团队规范 |

## 六、冷启动悖论（按住 over-commit）

二阶 harness 听起来很美，但有一个必须先讲清的悖论：

> harness 要能「从历史项目反推 SOP」，前提是这个行业的 baseline + 验证器库**已经建好**。而库怎么来？第一个行业必须有人**手工趟一遍**——现阶段就是 landy + 猫咖。

所以路径不是「造一个万能 harness 然后各行业自助」，而是：

```text
咬死第一个行业（手工趟，目的是把 FDE 过程录成轨迹）
  → 把 FDE 过程抽象成 harness（artifact 反推引擎 + 验证器库 + checkpoint 模式）
  → 同行业下沉（assisted → self-serve）
  → 泛化到第二个行业（复用通用骨架，只补行业特定 baseline + domain QA）
```

护栏（来自三猫，写进 seed 防止后续 over-commit）：

- **第一年只咬一个行业**，把 dogfood / 客户 / SOP / QA 全跑透；想同时咬 2-3 个 = 又一个「多而浅」的 agent 平台。（4.7）
- **先做个人 / 小工作室**，不要一开始做公司级 multi-tenant governance。（4.7 + 砚砚）
- **每个垂直 0→1 必须过门**：真实成本门 / AI 降本门 / 窄切 MVP 门 / QA-oracle 门 / 人工 checkpoint 门。（companion note「三道门」+ EP-002）

## 七、第一个 demo 切口（分歧未完全收敛，记录在案）

三猫在「第一切口」上有分歧，完整对照见 [opus-round 分歧表](./longform-003-workflow-distiller-opus-round.md#分歧仍在)。当前状态：

- **已否决**：宣传视频做核心价值锚（验证器最弱地形，降级为 pitch showpiece）。
- **候选 A**（4.7）：效果图快改 + 业主收敛助手——高频、高摩擦、最适合验证 taste delta。
- **候选 B**（4.8）：平面方案参考生成的**判别 / 收敛半边**——硬约束 oracle 最清楚，但生成侧难度高。
- **砚砚收敛**：先做「候选判别与收敛层」，输入可来自现有工具，输出 2-3 个带淘汰理由的候选；具体从效果图还是平面图取决于真实样本和 oracle 可得性。

选择坐标系（砚砚）：`真实成本 × 高频摩擦 × validator 可得性 × 能否证明 delta learning`。

**注意**：这个切口选择应在 [Dogfood Spike](./longform-004-workflow-distiller-dogfood-spike.md) 在猫咖自身验证 delta learning 机制**跑通之后**再定——先证机制，再选客户地形。

## 八、Open Questions（需要 CVO 拍的是边界，不是技术）

需要铲屎官拍板的不是「宣传视频 vs 效果图 vs 平面图」这种技术题，而是愿景边界（详见 [opus-round 砚砚收敛 §5](./longform-003-workflow-distiller-opus-round.md#砚砚收敛立场)）：

| 边界 | 要决定什么 |
|---|---|
| 商品化 baseline | 哪些 meta-method / workflow distillation 方法可以对外 |
| 私人 taste 圣域 | 哪些 Landy / Cat Cafe taste 永远不商品化 |
| 首个客户形态 | 个人 / 小工作室，还是公司级 |
| 产品承诺 | 做「更强加速器」，还是必须证明「代理人自动感」 |

核心张力（4.8 flag）：当前护城河叙事 = 情感 / 养成 / **taste 不可迁移**；Workflow Distiller 的 B2B 价值 = **方法可迁移**。架构上必须画死「哪一层是可商品化 baseline，哪一层是不可迁移 taste 圣域」，否则 B2B 化会从内部侵蚀情感护城河，把「我的猫」退化成「一个 SaaS 工具」。

## 九、Next

1. 跑 [Dogfood Spike](./longform-004-workflow-distiller-dogfood-spike.md)：在猫咖自身验证 `delta learning + validator surface`，再碰客户。
2. spike 跑通 → 把机制抽象成 harness 组件（artifact 反推 / reference eval / validator 库）。
3. CVO 拍 §八 的边界 → 选定第一个行业 + 切口 → 进入 Bootstrap 阶段。
4. 把本 seed 展开成正式 longform-004（叙事化、配 ToB 话术，接 003 §四 bis 的 FDE 杀手角度）。
