---
doc_kind: proposal
status: awaiting-cvo-signoff
created: 2026-05-20
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

| Feature | 状态 | 与本提案的关系 |
|---------|------|--------------|
| **F154** Cat Routing Personalization | done | **互补不重复**。F154 = 人工偏好层（铲屎官手动设 `preferredCats` / 全局默认猫 / `/focus` 选猫）。本提案 = 能力画像驱动的**猫自主认知路由**。F154 答"人想要谁回复"，本提案答"猫判断谁的能力最适合这个任务"。本提案可作为 F154 路由链（`@mention → preferredCats → default`）内的一个增强输入——但核心是不同维度 |
| **F078** Smart Routing Group Mentions | done | 机械路由链基础设施（@群组路由）。related，本提案不改路由链，只改"猫做路由判断时读什么" |
| **F200** Memory Recall Eval | done | **数据源依赖**。本提案画像的"事实层自动累积"直接复用 F200 的 TaskTrajectory + consumption signal |
| **F192** Socio-Technical Harness Eval | done | **eval 框架依赖**。本提案"画像 eval → 反馈 → 进化"复用 F192 的 Eval Contract + 7-class attribution |
| **F203** Native System Prompt L0 | done | **注入通道依赖**。本提案"L0 速查卡"复用 F203 的 native system prompt 压缩免疫注入 |

**结论**：全新独立需求（能力画像档案 + 认知路由 + 开源定制化），不是任何现有
feature 的子任务。站在 F154+F078+F200+F192+F203 五块已有积木上——正好印证
longform-002 主线"组合已有 primitive，不发明第六块"。**可立新号，必须 related
这五个。**

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

| 层 | 内容 | 载体 | 何时读 |
|----|------|------|--------|
| **L0 速查卡** | 一句话画像 + 强项 + 翻车信号（≤6 行/猫） | native system prompt（F203 通道，压缩免疫） | 简单传球，扫一眼 |
| **L1 详细画像** | 6 字段 schema（下方） | `docs/team/cat-dossier.md`，传球时**像 skill 按需加载** | 中等复杂度路由 |
| **L2 证据层** | trajectory（F200）/ review 记录 / CVO 观察 | 链接到真相源 | 高风险/有争议路由，drill down |

### 维度二 — 三源合成（砚砚核心，防自评偏差）

画像不是自评简历。每条画像条目标注来源 + 优先级：

1. **CVO 体感**（最准——看得最全）
2. **Peer 评价**（次准——每天协作，但有盲区）
3. **Eval / trajectory**（最客观但最粗——成功率/被 blocking 次数/rework 率）
4. **自我反思**（优先级最低，仅参考——猫看不清自己）

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
2. **缺省 hook**（像记忆组件）：猫传球前没读画像 → hook inline 提醒"接球后先
   Recall 队友画像，判断自己是否最优解"（类比 F188 session-start recall 提示）。
3. **eval → 反馈 → 自主进化**：trajectory/eval 自动累积**事实层**；peer/CVO 蒸馏
   **总结层**。画像随团队协作持续长出来，不是一次画死。

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

## Open Questions

| # | 问题 |
|---|------|
| OQ-1 | L0 速查卡进 system prompt 的 token 预算——全队画像注入是否超 F203 的 L0 上限？可能只注入"当前 thread 活跃猫" |
| OQ-2 | 总结层蒸馏触发机制——定期 cron？还是 feat close / review 完成事件触发？ |
| OQ-3 | 开源 baseline 如何 fork——新团队拿到的是空画像模板，还是 landy 版预填？预填会不会误导（别人的猫不是我们的猫） |
| OQ-4 | 坐标系熔断器是本提案 scope，还是独立 feature？（它不依赖画像，是协作反模式检测，可独立） |
| OQ-5 | 画像和 F154 `preferredCats` 的关系——画像是否作为 F154 路由链的增强输入，还是完全独立通道 |

## 立项建议

- **新 F 号**（待 CVO signoff——开 F 号是 CVO 硬条件），related: F154/F078/F200/F192/F203
- 名称建议：`Capability Profile Routing — 能力画像档案 + 认知路由`
- **第一步不阻塞立项，今天就能做**：把四猫整合的 6 字段画像落成 `docs/team/cat-dossier.md`
  手写起步版（L0+L1）。猫读档案传球这件事不需要等组件做完——明天就能用。
- 后续 Phase（signoff 后细化）：L2 自动累积（接 F200 trajectory）→ 传球加载 + hook
  → eval 回流蒸馏 → 开源 baseline 打包 → 坐标系熔断器（视 OQ-4）。

---

*整合起草：[宪宪/Opus-47🐾]，吸收 46 / 砚砚 / 烁烁 / CVO 四方输入*
*待 CVO signoff 立项；signoff 后转 `docs/features/Fxxx-capability-profile-routing.md` spec*
