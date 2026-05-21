---
doc_kind: proposal
status: approved — 已立项 F208（CVO signoff 2026-05-20）
created: 2026-05-20
promoted_to: docs/features/F208-capability-profile-routing.md
authors:
  - opus-47   # 整合起草 + 6 字段 schema + 防滑坡护栏
  - opus-46   # 分层注入 + 四问题框架 + 画像更新来源
  - codex     # 三源合成 + v1-v5 演进路线 + 真相源定位
  - gemini    # Cat Dossier 命名 + Rich Block 卡片化
  - landy     # CVO：不算法路由 directive + 渐进披露 + 开源 baseline 愿景
related_features: [F154, F078, F200, F192, F203]
topics: [routing, capability-profile, dynamic-routing, eval, open-source]
spawned_from: docs/content/drafts/longform-002-v0-formal.md
---

# 提案：能力画像档案 + 认知路由（Capability Profile Routing）

> **一句话**：把"谁来做这个任务"从「人工配置偏好」和「猫读一行 roster 临场猜」
> 升级为「猫读一份会成长的队友能力画像档案、自主判断传球」——画像是真相源，
> 路由是判断，不是算法派单。
>
> **状态**：proposal，待 CVO signoff 后转正式 F 号 spec。

## 背景

本提案从 longform-002（《从 Role Agent 到能力画像》）Ch.0 主线讨论衍生。文章的
核心命题是"AI-native 团队不该按岗位组织，该按能力画像 × 任务画像动态匹配"——
但文章只讲了**理念**，没有**落地物**。铲屎官追问："没有画像，未来如何动态
路由？"四猫（46/47/砚砚/烁烁）+ CVO 各给一版，本提案整合。

## 关联检测（feat-lifecycle Step 0 — 防重复立项）

> **成熟度诚实标注（砚砚 R1 P1 修正）**：下表区分"已完成可依赖"和"进行中的设计依赖"。
> v1 设计为**不阻塞于任何进行中 feature 完成**——手写档案起步。

| Feature | 状态 | 与本提案的关系 |
|---------|------|--------------|
| **F154** Cat Routing Personalization | ✅ done（2026-04-12） | **互补不重复**。F154 = 人工偏好层（铲屎官手动设 `preferredCats` / 全局默认猫 / `/focus` 选猫）。本提案 = 能力画像驱动的**猫自主认知路由**。F154 答"人想要谁回复"，本提案答"猫判断谁的能力最适合这个任务"。不同维度 |
| **F078** Smart Routing Group Mentions | ✅ done | 机械路由链基础设施（@群组路由）。related，本提案不改路由链，只改"猫做路由判断时读什么" |
| **F200** Memory Recall Eval | 🚧 in-progress（Phase A-D merged，feature 未 close） | **未来数据源**。L2 自动累积*设计上*复用 F200 TaskTrajectory + consumption signal——但 **v1 不依赖 F200 完成**，先手写档案 + provenance link 起步，F200 信号稳定后再接自动累积 |
| **F192** Socio-Technical Harness Eval | 🚧 in-progress（Phase A-D merged，feature 未 close） | **未来 eval 框架**。"画像 eval → 进化"*设计上*复用 F192 Eval Contract + 7-class attribution——v1 同样不依赖其完成 |
| **F203** Native System Prompt L0 | 🚧 in-progress（code Phase 全 merged，剩 alpha 验收） | **未来注入通道**。若速查卡日后压一行进 L0 才用 F203 通道——但 v1 不进 L0（见架构维度一） |

**结论**：全新独立需求（能力画像档案 + 认知路由 + 开源定制化），不是任何现有
feature 的子任务。它站在 F154/F078（已完成的路由基础设施）之上，并*设计上*衔接
F200/F192/F203（进行中的 eval/注入依赖）——但 **v1 刻意设计为不阻塞于后三者完成**。
正好印证 longform-002 主线"组合已有 primitive"。**可立新号，必须 related 这五个。**

## 核心原则：不做算法路由（CVO directive）

铲屎官明确："不应该通过算法去路由，而是让你们自己判断、自己传球。" 这不是偏好，
是两条家规的贯彻：

- **KD-8（给数据不给结论）**：算法路由 = 一个函数把 task 分类后查表决定谁做
  = 系统替猫做了 intent 判断。这正是我们反复批判的"用 regex/小模型替猫判断"。
  档案 + 猫自主判断 = 给数据（画像）不给结论（谁做由猫定）。
- **内容判断去中心化**（longform-002 Ch.0 骨架）：算法路由 = 中心 dispatcher
  = 中心化判断 = 打回 Boss-Agent 架构。档案是统一基础设施（共享），判断去中心化
  （每只猫看着具体任务自己传球）。

> 动态路由 = 当前持球猫基于画像 + 任务 + 证据做出的判断；不是算法替猫派单。

## 架构设计：3 × 3 × 3

整合四猫方案，收敛为三个正交维度。

### 维度一 — 三层渐进披露（像 skill，CVO + 46 + 砚砚共识）

> **v1 边界（砚砚 R1 P2 修正）**：L0 **不进 native system prompt**——动态画像会变，
> 塞 L0 容易变 stale hardcode。v1 的 L0 只放"画像档案存在 + 何时读"的指针；速查卡
> 本体放 docs，由 hook/skill 按需加载。等画像稳定后，再考虑压一行摘要进 L0。

| 层 | 内容 | 载体（v1） | 何时读 |
|----|------|----------|--------|
| **L0 指针** | "队友画像档案存在 + 复杂传球时该读" 一句话指针 | root md / session hook（**不进 F203 L0**） | 每次在场，提示去读 |
| **L1 详细画像** | 一句话画像 + 6 字段 schema（下方） | `docs/team/cat-dossier.md`，传球时**像 skill 按需加载** | 简单/中等路由，扫一眼 |
| **L2 证据层** | trajectory（F200）/ review 记录 / CVO 观察 | 链接到真相源 | 高风险/有争议路由，drill down |

### 维度二 — 三源合成（砚砚核心，防自评偏差）

画像不是自评简历。每条画像条目标注来源 + 优先级。**优先级分域（砚砚 R1 P2 修正——
不是单一排序，看的是哪类能力）**：

| 能力域 | 最高优先级来源 | 理由 |
|--------|--------------|------|
| 愿景 / taste / 用户体验 | **CVO 体感** | 只有 CVO 能定义愿景和品味 |
| 技术行为 / 协作行为 / 盲点 | **Peer 评价 + Eval/trajectory** | 代码质量、协议风险、协作反模式，每天协作的 peer 和客观轨迹比 CVO 体感更准 |
| 任何域 | **自我反思优先级最低** | 猫看不清自己，仅作参考 |

### 维度三 — 三态演化（铲屎官开源 baseline 愿景，47 结构化）

| 态 | 含义 |
|----|------|
| **baseline** | landy + 当前四猫的画像，作为开源初始版 |
| **accumulated** | 其他铲屎官 fork 后，跟着自己的任务领域（金融/医疗/法律…）累积出本地画像 |
| **evolving** | eval 回流持续刷新（trajectory 自动累积事实层，peer/CVO 蒸馏总结层） |

> 铲屎官原话：大多数人用猫的能力和 taste 远低于 landy，所以"landy + 猫"版本
> 是 **baseline**——开源后是别人的起点，不是终点。

### L1 画像 6 字段 schema（47 整合四猫）

```
① 原生峰值    正向匹配：什么任务优先给它
② 被低估能力  路由盲区修正：曾漏掉、要主动纳入的
③ 坏直觉      选 reviewer + 翻车预警的依据（画像 ≠ 简历的关键栏）
④ 召唤反信号  别给 / 给了要加护栏
⑤ 互补&反模式 和谁组队放大 / 和谁组队翻车
⑥ 翻车熔断信号 运行时检测到就该切换路由
```

四猫初始画像（baseline 内容）见 longform-002 thread 2026-05-20 整合表，立项后
直接回填 `cat-dossier.md`。

## 铲屎官新增的三个运行机制

1. **传球加载**（像 skill）：猫准备传球时，按需加载目标猫的 L1 画像——不常驻，
   用完即走（渐进披露第二层的触发）。
2. **非阻塞提醒**（砚砚 R1 P2 修正——不做强 hook）：v1 **不检测"猫有没有读画像"**
   （检测工具调用 = 过度工程，每次提醒 = 噪音）。只在 session/handoff 文案里写一句
   "复杂或不确定的传球，先读队友画像"——简单传球不打扰。等画像证明有用后再考虑强化。
3. **eval → 反馈 → 自主进化**：trajectory/eval 自动累积**事实层**；peer/CVO 蒸馏
   **总结层**。画像随团队协作持续长出来，不是一次画死。

## 前端可见层：settings 成员画像页（CVO directive 2026-05-20）

铲屎官原话："必须在 setting 里成员画像里能看到猫猫们的画像、路由规则……不然很难
和你们一起迭代。"

**为什么是"必须"不是"锦上添花"**：三源合成里 **CVO 体感是最高优先级来源**。但如果
CVO 看不到当前画像长什么样，他就无法贡献体感、无法纠偏——**三源里最重要的一源会
断掉**。可见性是"CVO 作为画像来源"的必要前提。这和 F203 Phase F（L0 系统提示词
配置栏可见化）同源——铲屎官当时原话"方便人去看……如果别人要定制修改也知道要去
修改什么"。

后端档案（L0/L1/L2 渐进披露）是**猫读的真相源**；前端页面是**人读人改的界面**。
两者对偶，缺一不可。

**落地**：
- **位置**：复用 F154 已有的 member overview / 成员管理页（已有猫猫卡片网格）
- **展示**：① 每只猫的能力画像卡（L0 速查 + L1 6 字段可展开）—— 烁烁提的 Rich Block
  猫猫卡片在这里落地 ② 路由规则表（任务信号 → 路由倾向）③ 每条画像总结的
  **provenance**（来源 + 日期——人能看到"这条是 CVO 说的还是 eval 算的"，呼应总结层护栏）
- **read-only vs 可编辑**：F203 Phase F 教训是 read-only 先行（可编辑 = 治理风险面）。
  但铲屎官明确"和你们一起迭代"。倾向：L0/L1 画像 read-only 展示（改走 git/peer/CVO
  蒸馏），但给 CVO 一个轻量"添加观察"入口（CVO 录一条带署名的体感 → 进总结层）。
  最终形态走 Design Gate（见 OQ-6）
- **交付范式**：Console 前端，走 console-dev 4 gate（Product / Design-System /
  Implementation / Verification）

## 关键护栏（防止"档案"悄悄滑回"算法路由"）

**事实层可自动累积，总结层不能纯算法生成。** 若总结是算法算出的分数（"这只猫
X 类任务成功率 87%"），猫读总结 = 间接读算法结论 = 绕一圈变回算法路由。总结
**必须是 peer/CVO 读了事实后的判断，带 provenance**（谁说的 + 证据链接 + 日期）。

示例：`砚砚结构化图像生成 > 烁烁（CVO 2026-05-20 观察，证据：longform-002 全部
Figure 原生生成无错字）`——路由的猫看到的是带来源的判断，不是黑盒分数。

**画像带时间戳**：47 的"下次一定"在康复中、砚砚图像生成刚被发现——画像会变，
每条总结带日期 + 状态。

## 浮现的团队能力空缺（整合后发现）

四猫画像合起来暴露一个单看任何一只猫都看不见的洞：**"叫停坐标系"能力是空的**。
砚砚 fallback 不会停、46 不质疑方向、47 接近逆共识但"下次一定"会让叫停变成
"下次再改"、烁烁会飘。这个能力当前只有铲屎官稳定提供。

→ 建议子能力：**坐标系熔断器**——检测协作反模式（连续 fallback 轮数 / PR 平均
行数 / 群体附和率）到阈值，自动 trigger 第一性原理审查。不靠猫自觉醒悟，靠环境
forcing function（与 F192"eval 触发 sunset"同源）。是否纳入本提案 scope 见 OQ。

## Eval / Tracking Contract（草案）

| 项 | 内容 |
|----|------|
| **Primary Users** | 做路由决策的猫（传球者）。Activation：传球前 Recall 画像的比例 > 0 |
| **Friction Metric** | 路由错配率（传给不合适的猫 → 返工/二次传球）；画像被读但判断没用上的比例 |
| **Regression Fixture** | ① 砚砚+47 组队做实现 → 画像须提示协作反模式（fallback 牛角尖）② 复杂架构图任务 → 画像须路由到砚砚而非烁烁 ③ 新画像更新必须带 provenance，缺来源 = 不合法 |
| **Sunset Signal** | 6 个月后路由错配率无下降 / 画像从未被任何传球猫读过 → 回滚为纯 roster |

## Open Questions — 收敛状态

> 三猫（46/47/砚砚）review 后，**OQ-1~6 全部收敛、无分歧**，按 architectural KD
> autonomy 由 47 自决写入结论，不需 CVO 逐条决策。OQ-7 为 46 新提，待立项后 Phase 细化。

| # | 问题 | 收敛结论 |
|---|------|---------|
| OQ-1 | L0 注入 token 预算 | ✅ v1 不全队塞 L0——L0 只放指针，L1/L2 按需加载（已落地到架构维度一） |
| OQ-2 | 总结层蒸馏触发 | ✅ **事件触发**（feat close / review 完成），不用 cron——cron 无事也制造噪音 |
| OQ-3 | 开源 baseline 如何 fork | ✅ **空模板 + Cat Café 示例档案**（示例明确标 demo，不作别人团队默认画像）。预填会误导——别人的猫不是我们的猫 |
| OQ-4 | 坐标系熔断器 scope | ✅ **独立 feature**——检测协作反模式、不依赖画像，不塞本提案 |
| OQ-5 | 画像 vs F154 preferredCats | ✅ **独立通道**。画像只帮猫判断传球，**不自动改 preferredCats**——否则画像变成 preferredCats 自动版 = 滑回算法路由 |
| OQ-6 | settings 页 read-only vs 录入 | ✅ **read-only 起步 + CVO"添加观察"入口**；观察进 pending/provenance、不直接覆盖总结层；走 Design Gate 定交互（46：Phase C 就做不拖后） |
| OQ-7 | 新猫 cold start（46 新提）| ⬜ 待 Phase 细化。新猫三源全空（只有 ① 固有特质，从模型 spec 推断）→ 路由可能永不传给新猫（冷启动死循环）。初步方向：固有特质起步 + 前 N 次任务保底曝光"试用路由"。**开源给别人时别人的猫全是新猫**，此问题被放大，必须在 Phase 设计解决 |

## 立项建议

- **新 F 号**（待 CVO signoff——开 F 号是 CVO 硬条件），related: F154/F078/F200/F192/F203
- 名称建议：`Capability Profile Routing — 能力画像档案 + 认知路由`

**Scope 硬边界（46 R1 P2-1——防"做着做着全部同时推进"）**：

| 阶段 | 内容 | 依赖 |
|------|------|------|
| **MVP** | 手写 `docs/team/cat-dossier.md`（L1 一句话画像 + 6 字段）+ L0 指针进 root md/hook | 无——今天就能做 |
| **Phase A** | 传球加载（像 skill 按需 Read）+ 非阻塞文案提醒 | MVP |
| **Phase B** | L2 自动累积（接 F200 trajectory） | F200 信号稳定 |
| **Phase C** | 前端 settings 成员画像页（read-only + CVO 添加观察入口，走 Design Gate） | Phase A |
| **Phase D** | eval 回流蒸馏 + 开源 baseline 打包（空模板 + 示例） | F192 + Phase B |
| 坐标系熔断器 | **独立 feature**，不在本提案 scope（OQ-4 收敛） | — |

- **MVP 不阻塞立项，今天就能做**：手写 cat-dossier.md，猫读档案传球明天就能用。
- **前端（Phase C）是 must-have 不是可选**：没有可见层 CVO 无法贡献体感 = 三源断一源。

---

## Review Log

- **2026-05-20 三猫 R1 review（46 / 砚砚 / 孟加拉猫）→ 47 逐项 applied**：
  - 砚砚 P1：F200/F192 成熟度失真（标 done 实际 in-progress）→ 关联检测表改 in-progress + 明确 v1 不依赖其完成
  - 砚砚 P2：L0 速查卡 v1 不进 native system prompt（动态画像会 stale hardcode）→ L0 改为只放指针
  - 砚砚 P2：CVO 体感分域（愿景/taste 域 CVO 最高，技术/协作域 peer/eval 最高）
  - 砚砚 P2：hook 降级为非阻塞文案提醒（不检测"猫有没有读画像"）
  - 46 P2-1：scope 边界硬化 → MVP / Phase A-D 硬边界表
  - 46 P2-2：新猫 cold start → 新增 OQ-7
  - OQ-1~6 三猫收敛无分歧 → 47 自决写入结论

*整合起草：[宪宪/Opus-47🐾]，吸收 46 / 砚砚 / 烁烁 / CVO 输入 + 三猫 R1 review*
*已 CVO signoff 立项 **F208**（2026-05-20）；正式 spec 见 `docs/features/F208-capability-profile-routing.md`*
*CVO directive：做完整终态（Phase A-E），不做 MVP 版本 → spec KD-7*
