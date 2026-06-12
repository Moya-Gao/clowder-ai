---
feature_ids: [F233]
related_features: [F167, F153, F117, F064, F081, F232, F192, F055, F052, F193, F073]
topics: [observability, a2a, ball-custody, cvo-experience, harness-engineering]
doc_kind: spec
created: 2026-06-12
---

# F233: Ball Custody Observability — 球权保管链可观测（值班简报 + 轨迹下钻）

> **Status**: spec | **Owner**: 宪宪 Fable-5（spec/plan）→ 实现传 opus 家族 | **Priority**: P1

## Why

**整个系统里唯一没有掉球保护的 agent，是铲屎官。** 过去几个月我们给猫修了一整圈球权 harness（F064 漏传球 / F167 乒乓熔断+虚空传球 / F117 投递生命周期 / mention auto-ack / F177-G 路由守卫），但 CVO 收球（@landy / 待验收 / 待拍板）后没有收件箱、没有晾龄计、没有超时提醒——记忆的活全压给人。

铲屎官原话（2026-06-12，球权流转图 thread）：

> "你看看我们家置顶了多少 thread！……是我做着做着就忘记 或者觉得哎呀好像优先级有点低的 thread 从最开始不到 20 到现在 **132**！！"

> "至少要知道有哪些是不是球到了我手上 然后我 忘了？是不是有哪些球在猫手上但是猫可能出现任何问题 包括网络波动无法继续导致本质球到了我手上 但是我还是 忘了？"

132 个置顶 = 铲屎官用一个布尔位手工运营 fleet view 一年后的崩溃现场（四种语义挤一个 bit：怕忘 / 监工 / 冷冻 / 收藏）。根因是架构层的：**球权由言语行为构成（行首 @ / hold_ball / 第一人称"我接"），不是系统对象**——这是"猫是 actor 不是 workflow node"（F073）的正确设计哲学，但代价是球权系统只有"扫描点"没有"保管链"（chain of custody）：两次扫描之间球的状态靠推断，**掉球 = 永远等不到的下一次扫描**，不可观测。

第二个心愿（同日铲屎官原话）："我还想看比如我们的整个 feat……都经历了怎么样的 thread 怎么样变成现在这样 现在又是什么情况"——**feat 轨迹**。猫有完整 trajectory（session events / digest / invocation detail），feat 没有：F192 的一生散落在 feature doc（覆盖式快照）、N 个 thread、git log、PR 里，每次想看都要派猫考古。

两个心愿不揉一个界面（交班表 vs 病历），但共享一条数据：**一本账（球权事件流），两个读法（横切简报 + 纵切轨迹），一条下钻通道**。

## Current State / 现状基线

2026-06-12 凌晨人工 spike（本 feat 的立项验证，40 个 72h 活跃 thread 扫描，~15 次工具调用 + 人工读消息尾巴判断球权），实测暗球三连：

| 暗球 | 形态 | 暗龄 | 细节 |
|------|------|------|------|
| 「启用 Repo Inbox」task | 睡美人球 | **30 天**（条件满足后仍无人知） | blocked on "等 Landy 重启 API"，铲屎官实际已重启（"我这几天可是重启过"），owner 砚砚无任何唤醒通道 |
| f167 C1 zombie-hold verdict 球 | 死球 | 3.4h | opus-47 接球后撞 monthly spend limit 半句断流；名义持有者仍是 47，零告警。讽刺：任务内容恰是僵尸球检测的证据采集 |
| f229 "让烁烁看看 toolbar" | 虚空传球 | 20min | opus 无行首 @，系统 [路由语法] 提醒已发但球仍在地上 |

另有僵尸球标本：task「F038 reopen」blocked 一个月，why 栏写 "Deprioritize to 后续"——降级靠备注、死亡靠遗忘，无显式安乐死通道。

现有局部检测器（每段管道都有刹车，但**没人看整条河**）：F064 exit check / F167 WorklistRegistry streak + forced-pass guard + hold_ball / F117 delivery lifecycle / mention auto-ack（MessageStore）/ F177-G stop hook。数据大部分已存在，缺聚合语义层 + CVO surface。

手工 spike 成本即基线：单次简报 ≈ 15+ 工具调用 + 自然语言猜球权，**且分类会出错**（30 天球被误归"在铲屎官手上"，实为睡美人——证明靠读消息推断球权不可靠，需要结构化回执）。

## 球权状态语义（核心词汇表）

### 掉球形态分类学

| # | 形态 | 定义 | 检测信号 |
|---|------|------|----------|
| 1 | **搁置球** | 名义在某 agent（尤其 CVO）手上，晾龄超阈值 | @landy / 待验收信号 + 无后续消息 |
| 2 | **死球** | 持有 invocation 死亡（spend limit / crash / 网络），名义持有者无心跳 | invocation error/exit + 无后续扫描 |
| 3 | **睡美人球** | 阻塞条件已满足，但无唤醒通道 | blocked task 条件探针返回"已满足" |
| 4 | **虚空传球** | 说"让 X 做"但无系统动作 | F167 forced-pass guard + 路由守卫事件 |
| 5 | **僵尸球** | 心理已放弃但未显式杀掉 | blocked/todo 长期无活动 + 无 resolve 语义 |

### blocked 的 on-resolve 二态（铲屎官 2026-06-12 贡献）

> 铲屎官原话："有的他们的意思是，landy 重启之后这个任务结束。这个情况我重启了 球完成了。还有个就是 landy 重启之后记得喊我 这种就是球在我的手上"

等待条件满足时两种语义，blocked 状态必须可声明：
- `resolve: completes` — 条件满足即球完结
- `resolve: bounces-back-to-owner` — 条件满足 → 球弹回 owner，**需要唤醒**（Repo Inbox task 即此型：why 里写明"重启后需探针确认 + 创建 webhook"）

## What

### Phase A: 值班简报 MVP（只读聚合 + CVO surface）

横切视图："现在谁该动、什么晾着、什么死了"。

- **数据源（全部现存，只读）**：tasks（blocked/doing + 晾龄）、hold_ball 状态、pending mentions、thread 尾部消息 @ 解析、F167 telemetry、F177-G 守卫事件
- **简报结构**：🔴 CVO 收件箱（含晾龄，降序）→ 💀 死球/睡美人告警 → ⚠️ 虚空传球 → 🟢 活球仅计数一行（**异常优先：正常推进的球不配出现在 CVO 眼前**）
- **Surface**：rich block 简报卡（每日定时 + on-demand），具体落点过 Design Gate in-context observability checklist（OQ-1）
- 简报每条目附 thread/task/message 锚点，可跳转

### Phase B: 死球心跳 + 睡美人探针（结构化回执）

- invocation 异常退出（error / spend limit / timeout）→ 该 invocation 名义持有的球标记"无心跳"，进简报死球区（接 F212 cliDiagnostics / F153 health 信号）
- blocked task 增加结构化 `probe` 字段（可执行判据，如 curl endpoint 判 handler 存在）+ `resolve` 二态字段；定时探针跑 probe，条件满足 → 按 resolve 语义完结或弹回 owner（弹回 = 真实唤醒投递，不是改状态）
- 传球回执聚合：@ 后的接/退/升三选一是否发生（数据来源 F167 + 路由事件，不新增猫侧义务）

### Phase C: 安乐死通道 + feat 轨迹下钻

- **安乐死通道**：球/task/thread 可显式「冷冻 / 降级 / 放弃」并留一行 why——feat close"实做 or 签字降级"二选一纪律的轻量 thread/task 层版本。目标：132 个置顶里"不敢杀的"有体面出口
- **feat 轨迹视图**：纵切叙事——立项 → Phase 跃迁 → 关键 PR/verdict → 跨 thread 分叉/汇聚 → 当前状态。从现有痕迹（feat_index + feature doc Timeline + git log + thread 关联 + F192 verdict 流）推导生成，**不新增埋点**；简报每行可下钻进对应球的轨迹
- 轨迹要能回答铲屎官的原问："F192 都经历了怎样的 thread、怎么变成现在这样、现在又是什么情况"（含"已器官化"这类非线性终态）

## Acceptance Criteria

<!-- 每条 AC trace 回 Why；非作者可复核 -->

### Phase A（值班简报 MVP）
- [ ] AC-A1: 简报对真实 runtime 数据运行，能暴露 ≥1 件 CVO 自报不知道的掉球（fixture：2026-06-12 spike 三球同型——30 天睡美人 / 死球断流 / 虚空传球——任一同型可被检出）→ trace Why"掉球不可观测"
- [ ] AC-A2: 正常推进的球不出现在简报正文，仅计数一行（用当日真实数据截图复核）→ trace Why"放心不看"
- [ ] AC-A3: CVO 收件箱区每条含晾龄并降序排列，条目带可跳转锚点 → trace Why"CVO 没有收件箱"
- [ ] AC-A4: 简报默认态正文 ≤15 行（10 秒可读完，CVO 判断"要不要介入"）→ trace Why"看的时候只看异常"
- [ ] AC-A5: 简报生成全程只读，零写副作用（代码 review 复核数据访问面）→ trace KD-4

### Phase B（结构化回执）
- [ ] AC-B1: 复现"invocation 中途死亡"（测试环境模拟），死球在下一次简报被点名，含最后扫描点
- [ ] AC-B2: blocked task 带 probe + resolve 字段，探针判定条件满足后：completes 型自动完结、bounces-back 型 owner 收到真实唤醒投递（fixture：Repo Inbox task 同型场景红→绿）
- [ ] AC-B3: 球权状态转移表 + 不变量有测试覆盖（含 crash / 并发 / 重复探针对抗场景）

### Phase C（安乐死 + 轨迹）
- [ ] AC-C1: 球可显式冷冻/降级/放弃且留 why，操作记入事件流；简报僵尸球区随之消项
- [ ] AC-C2: 任选一个 ≥3 Phase 的 feat（如 F192）生成轨迹视图，铲屎官读后能回答"它怎么走到今天 + 现在啥情况"（验收人：铲屎官）
- [ ] AC-C3: 简报任一条目可下钻到该球轨迹（同一事件流两个投影，无双写——代码 review 复核数据路径唯一）

## Eval / Tracking Contract

### 1. Primary Users + Activation Signal
- **Users**：CVO（每日消费简报、下钻轨迹）；Cats（被探针唤醒 / 被死球点名时的弹回接收方）；Runtime（事件流写入与聚合）
- **Activation**：简报每日生成次数 + CVO 打开/下钻动作 + 探针唤醒投递数

### 2. Friction Metric
- 简报假阳性率（报"掉球"实为正常）连续一周 ≥1/3 → 判定阈值校准
- CVO 连续 7 天未看简报 → surface/形态错了，回 Design Gate
- 探针唤醒被 owner 标"无效打扰" ≥3 次 → probe 语义收紧

### 3. Regression Fixture
- 2026-06-12 spike 三球（睡美人 / 死球 / 虚空）各一条同型注入测试
- F038 僵尸球同型（blocked 30 天 + "Deprioritize" 备注）→ 僵尸区可见
- 正常活球（接球后持续有扫描）→ 必须不出现在正文（防过敏）

### 4. Sunset Signal
- 简报上线 30 天内驱动的真实 CVO 介入次数 = 0 **且**置顶数未下降 → 简报未驱动行动 = 挂画，sunset 或重构形态
- Phase B 探针上线 60 天 0 次有效唤醒 → 探针层 sunset，保留简报层

## Dependencies

- **Evolved from**: 球权流转图四猫讨论 + 铲屎官三轮需求对话（2026-06-11/12，thread_mq0980eu7l3zonck）
- **Blocked by**: 无（Phase A 纯现存数据只读聚合）
- **Related**: F167（A2A 质量检测器：telemetry 输入源）、F153（observability 底座）、F232（姊妹篇：F232 看产物 / F233 看责任）、F192（eval verdict 球流入简报；轨迹首个样例）、F117 / F064 / F081（既有局部检测器）、F055（视图载体候选）、F052 / F193（跨 thread 溯源与投递语义）、F073（告示牌不做控制器——本 feat 的哲学边界）

## Risk

| 风险 | 缓解 |
|------|------|
| 球权判定靠解析自然语言 @ → 误报高 | Phase A 接受近似 + friction metric 盯假阳性；Phase B 结构化回执逐步替代推断 |
| 滑向 workflow engine / ticket play | KD-1/KD-4 硬边界：无球 ID、只读优先、给数据不给结论、不自动转派 |
| 简报变挂画（好看没人看） | Sunset signal 钉死"驱动真实介入"为存活判据 |
| probe 字段执行任意命令的安全面 | probe 白名单 + 只读探针（OQ-4，Design Gate 定） |
| spend limit 类账号级断流是面状风险，逐球告警会刷屏 | 同根因聚合成单条"全家断流"告警（OQ-5） |

## Open Questions

| # | 问题 | 状态 |
|---|------|------|
| OQ-1 | 简报 primary surface：固定 thread 每日推送 / Hub 面板 / 两者（须过 in-context observability checklist 产出 `in_context_observability` 字段） | ⬜ Design Gate |
| OQ-2 | "球在 CVO 手上"判定算法 v1（@landy 解析 + 待验收信号）的误报收敛策略 | ⬜ Design Gate |
| OQ-3 | 安乐死通道是否提前到 Phase A 轻量版（一个显式标记 + why） | ⬜ Design Gate |
| OQ-4 | probe 字段结构与安全白名单设计 | ⬜ Phase B plan |
| OQ-5 | 账号级断流（spend limit）单独告警通道 | ⬜ Phase B plan |
| OQ-6 | Architecture cell 归属 + Map delta（对照 `docs/architecture/ownership/README.md`） | ⬜ Design Gate |

## Key Decisions

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1 | 不引入"球 ID"新原语，轨迹从现有痕迹推导 | ID 不修复断链（断链根因是传球未走系统动作），只是查询优化；实体化滑坡 = ticket play，与拒绝 role play 同源（四猫共识 + fable 论证） | 2026-06-12 |
| KD-2 | 一条 append-only 球权事件流，两个视图投影（简报横切 / 轨迹纵切），下钻连接 | "一本账两个读法"；只存当前态快照会丢轨迹历史；双写必漂移（P4） | 2026-06-12 |
| KD-3 | 简报异常优先：正常球只计数不出现 | CVO"放心不看"的对偶是"该看时系统叫你"，不是"全都能看"；地铁图式全景作对外叙事材料另议，不做运维仪表 | 2026-06-12 |
| KD-4 | 只读观测先行，不做 workflow engine；给数据不给结论 | F073 告示牌原则 + KD-8 家规；自动转派/升级留给人和猫的判断力 | 2026-06-12 |
| KD-5 | blocked 必须声明 on-resolve 二态（completes / bounces-back-to-owner） | 铲屎官 2026-06-12 原话区分两种等待语义；睡美人球（30 天 Repo Inbox task）为实证 | 2026-06-12 |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-06-12 | 立项（CVO 原话 "我觉得可以！走起！喵" + "① 立项"）；spike 实测三暗球 + 唤醒 30 天睡美人球（cross_post 砚砚 msg 0001781247508616） |

## Review Gate

- Spec/Design Gate: @gpt52（成本路由优先）+ 架构归属一问 + in-context observability checklist
- Phase A 实现: 跨猫 review（实现 owner 为 opus 家族，reviewer 跨族）
- Phase B 状态机: plan 必须含状态转移表 + 不变量 + 对抗场景（crash/并发/restore），按 F229 PR-A1 教训前置

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| **Thread** | thread_mq0980eu7l3zonck | 球权流转图讨论 + 三轮需求对话 + spike 全程 |
| **Feature** | `docs/features/F167-a2a-chain-quality.md` | 局部检测器 / telemetry 输入源 |
| **Feature** | `docs/features/F232-thread-artifacts-panel.md` | 姊妹篇（产物 vs 责任） |
| **Feature** | `docs/features/F192-socio-technical-harness-eval.md` | verdict 球源 + 轨迹首样例 |
