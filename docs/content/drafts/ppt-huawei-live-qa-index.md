---
doc_kind: live-qa-index
created: 2026-06-07
author: "[宪宪/Opus-4.8🐾]"
participants: [landy, opus48, codex]
title: AutoHarness Live 现场答疑索引
purpose: 明天现场被追问时 30 秒速查——对外口径答案 + 去哪切证据 + 不吹过头的红线
source_of_truth:
  - ppt-huawei-talk-track-v0.md        # 讲法 / 弧线 / 事实 caveat
  - ppt-huawei-pitch-v0.md             # 内容母稿 / pocket 话术 / L1-L5 / 技术挑战
  - ppt-huawei-scroll-deck.md          # 5 张成品图展示入口
  - ppt-demo-backup-cue-sheet.md       # 10 个现场证据案例（带 threadId + messageId）
  - longform-003-seed-poe-vision.md
  - longform-003-workflow-distiller-next-stage-brief.md
  - longform-004-seed-workflow-distiller.md
  - longform-004-workflow-distiller-dogfood-spike.md
---

# AutoHarness Live 现场答疑索引

> 砚砚跨线程 handoff 的 ACTION 落地物。明天右边 PPT 是地图，左边 workspace 是城市；
> 评委追问 → 先在本表找对外口径 → 要证据就按 §3 坐标切 thread/doc → 守住 §4 红线。
> **铁律：现场问到具体证据，先查 docs/git/thread 真相源，不凭印象编。**

---

## 0. 30 秒电梯 + 备用定义

**一句话（被问"AutoHarness 到底是什么"直接答）**：
> AutoHarness 是一个让 AI 工作环境从真实使用轨迹里学习，并把学习结果变成**可验证、可回滚、可治理**的 harness 改动的系统。

**更口语**：
> 它不是帮你一次性搭一个 AI 流程，而是让这个流程在你真实使用中持续长大、修正和退役。

**商业价值定锤句（开场金句）**：
> 把专家和 FDE 长期手工调的 AI 工作流，变成一个**专家先定调、系统持续对齐**的工作环境。
> 重复 FDE 人天 → 一次性 bootstrap + 业务专家 checkpoint + 算力。

---

## 1. 高频追问速查表（砚砚 7 问 + 现场补充）

| 评委问 | 对外口径答案（要点） | 真相源锚点 | ⚠️ 红线 |
|---|---|---|---|
| **和普通 agent 平台区别？** | 普通平台偏静态编排/空白 builder；我们关注真实轨迹 → 证据 → harness patch → review/gate → 新 golden path → eval 判有效/退役。不是死流程，是会进化的环境 | talk-track §右半 AutoHarness 方案；pitch §右半"品类定位" | 别把竞品讲成弱智，只说停在不同责任层级 |
| **凭什么说自进化不是自嗨？** | 真值锚点分层：①用户自然决策（取消/拉闸/采纳/回滚/重做）②自动 eval/tracing 异常 ③世界结果（代码合入/被 revert/任务交付）④重复异常。跨模型 review + gate + 回滚；**连 eval 自己也被校准** | pitch §底部横条"四层真值闭环"L1-L4 + L3 双锚点；talk-track §第三页 | 行为频率**只做线索不做判决**；别说"全自动改自己" |
| **企业用户能感知到什么？** | 五变化：①不是空白 prompt（自带行业通法）②先读历史轨迹再追问 delta ③越用越懂团队/个人 ④业务专家自助长能力 ⑤变化可见/可回滚/可移交 | pitch §第二页左半表；talk-track §第二页 | 用户**不需要**感知"六层架构"；Discovery/Build 标 [004 设计中] |
| **longform-003 / 004 怎么分？** | 003 = 部署**后**，环境从真实轨迹自进化（Evolution）；004 = 部署**前/冷启动**，agent 像 FDE 访谈工程师从历史项目+artifact 反推 delta，制造**第一条可验证轨迹**（Discovery+Build） | 004 §一接口段："003 讲从轨迹学习，004 讲先制造第一条可验证轨迹" | 004 整体是 **[设计中]**，不是已落地 |
| **memory 怎么做？** | 重点不是记一堆聊天，是 provenance（可追溯来源）+ 召回健康 + 历史工件 + 偏好/方法沉淀 + 可审计引用。"软的是体验，硬的是数据结构"——可查看/可版本化/可隔离/可移交 | 004 §五bis（111-180 行）；talk-track §记忆切证据 | 隐私边界：只学工作工件交付偏好，不碰私人行为；个人审美默认不跨人 |
| **taste 怎么做？** | taste 不是无 eval：reference-based + pairwise + rejection-driven + delta learning；**否定信号 > 肯定信号**。三层拆分：硬约束（检查器）/ 专业先验（案例检索）/ taste delta（选择否定纠偏） | 004 §五（104-109 行）；003-next-stage-brief §本地初筛v2（406-416 行） | 私人 taste 是**圣域不可商品化**；只迁移方法层和 validator surface |
| **eval 如何设计？** | 先问评价对象：L1 机械正确性（机器判）/ L2 路由决策（后验统计）/ L3 任务交付（双锚点：客观事实锚 + 用户自然决策锚）/ L4 链路效率。低 verifier 场景**不能单一数字硬判**，用 reference eval + 人类 checkpoint + 反例回灌 | pitch §底部横条 L1-L4 表 + L3 双锚点；003 §七 | 别说"eval 永远可靠"——eval 自己也进飞轮被校准（见 F200 案例） |
| *（补）* **你和 DGM / AlphaEvolve / Sutton-Silver 啥关系？** | 同路（改运行时/工件不改模型权重）但我们在**真实生产跑 120 天服务真人**；DGM 还在 SWE-bench sandbox；AlphaEvolve 证明高-verifier 改工件型自进化可行但依赖明确 evaluator；Sutton/Silver 画的是改模型权重的**长期天花板** | pitch §Pocket（203-213 行）；§L3 对标 | Sutton/Silver 那条是长期愿景，**不是**已落地企业产品 |
| *（补）* **2b（改模型权重）真做不到吗？** | 不是做不到。高-verifier 场景已有苗头（Cursor online RL 每 5h 更新）；但审美/陪伴/协作这类低-verifier 场景 reward hacking 严重。我们先在 2a（改工件）跑通，trace/preference/eval 就是走 2b 的前置资产 | pitch §Pocket（200-201、221-222 行） | 别说"我们在改模型权重"——当前**只改环境/harness** |
| *（补）* **240 个 feature 是不是堆功能？** | 不是路线图执行——这 240 个**没有一个是预先规划的**，全是飞轮从真实摩擦里长出来的。feature 列表本身就是飞轮输出 | talk-track §第三页（326、356 行） | 别讲成"我们很勤奋做了 240 个" |
| *（补）* **L1-L5 你们到底在哪级？** | 当前可验证 **L2+**，产品目标**受控 L3**。L4/L5 是长期天花板/北极星，不做当前商业承诺。死磕 L3 是因为没有 L3 的真值/回滚/权限/审计，喊 L4/L5 就是不可治理的自我修改 | pitch §第一页左半五级表；talk-track §第一页左半 | **绝不**说"我们已经 L4/L5"或"完全自动修自己" |

---

## 2. 事实校准卡（现场最容易口误的硬事实——念之前先扫一眼）

| 主题 | ✅ 正确口径 | ❌ 别说错 |
|---|---|---|
| 学者名 | David **Silver** + Richard **Sutton**（席尔瓦/萨顿），论文《Era of Experience》 | 不是 "Silva" |
| Era of Experience 用途 | 讲"从人类数据转向长程经验流 / grounded reward" | 别说它给了企业 AutoHarness 产品方案 |
| OpenAI Tax AI with Codex | **2026-05-27** 官方 case study；口头说"五月底/最近" | 别说"6 月发的" |
| Anthropic self-service analytics | **2026-06-03** Claude 官方博客；讲 truth source + skills + validation | 别包装成"完整 self-improving agent" |
| Anthropic Institute《When AI builds itself》 | RSI / AI 参与 AI 开发的产业信号；内部数字带 caveat | 别在 60 秒里堆百分比 |
| Hermes | 讲"把 self-improving 概念讲热"，放 L1/L2 边界 | 别说"已证明完整自进化"（没审代码+真值 loop） |
| 新会话接力（clear context） | 内部锚点 **F225**；F125 是 Alpha 通道（两码事） | 别把 clear context 说成 F125 |
| 验证器自校准 | 内部锚点 **F200 = Memory Recall Eval**（记忆纠偏）；根因是 **eval 的 MRR 分母没对齐 live/shadow 子集**，不是 ranker 坏 | F200 不是愿景守护；不是"业务系统坏了" |
| JiuwenSwarm/openJiuwen | 只看过官网/README，**未读代码** → 不进主图，留 Pocket | 别凭营销文案判它在 L2 |
| 对外讲案例 | 念**案例名**：新会话接力 / 验证器自校准 / 汇报链路自修正 / 记忆健康巡检 | 内部编号（F128/F192/F200/F225）只做讲者检索，**不对外念** |

---

## 3. 现场证据切换坐标（左边 workspace 切什么 / 来源 cue sheet）

> 跳转：当前先打开 `threadId` 再按关键词/文本定位 messageId；F227 `teleport` 落地后一键跳。

| 评委追问 / 想证明 | 切哪个证据 | 坐标 |
|---|---|---|
| "人负责方向"不是口号（不可逆决策拍板） | 案例10 F227 Design Gate：真相源归一 | doc `docs/discussions/2026-06-06-f227-design-gate.md` → 锚点"Magic Word 真相源归一" |
| harness 是**双向**的（人也被纠正，反向治理） | 案例9 铲屎官记错 feat 号被猫拦截 | thread `thread_mpthle6vlux90fd5`（F225/F128 dogfood）→ msg `0001780725298084-000010` |
| agent **自己**发现"我缺一只手"（最反直觉） | 案例5 48 被骂醒 44%→催生新会话接力 | thread `thread_mq0qdxh0aysy0rs3`（F225）→ msg `0001780660976944-000321` |
| eval 凭什么可信（连尺子错了也被校准） | 案例4 eval 误报→修的是 eval 自己 | 触发 thread `thread_mp5blhaqbe5dckek`（F200）；归因 thread `thread_mq1q6i7anj6oivsp`（本 PPT thread）→ msg `0001780732184191-000102` |
| 猫自己停下来质疑方向（L3 最佳 show） | 案例1 opus-47 被打回 5 轮不补第 6 个锅，自做坐标系 reframe | thread `thread_mplxo94tqi4caxjx`（F213）→ msg `0001779776288987-000278` |
| Magic Word 不是预设、从摩擦长出来 | 案例2「补锅匠」诞生当天写进规则 | thread `thread_mprzg5mqkqi8o300` → msg `0001780123881223-000301` |
| 一个词让猫停（code-as-harness 活证据） | 案例3 铲屎官一声"补锅"→猫做 failure-mode audit | thread `thread_mpy1i3adhycqtigc`（F192 Phase G）→ msg `0001780622391479-000190` |
| "今天的"活例子（时间戳是今天） | 案例6「下次一定」病发作 | thread `thread_mpy1i3adhycqtigc` → msg `0001780724575855-000002` |
| 起源故事（3 个多月一直在转） | 案例7 最早的"脚手架"拉闸（3/17） | thread `thread_mmoygwqogpfmkk04` → msg `0001773729073912-000142` |
| 暖场/人情味 | 案例8「大漏勺布偶猫」→ reviewer 二选一铁律 | feedback_reviewer_no_middle_state.md |

**主推顺序**：show 力 案例1/4/5 > 反转 案例9 > 定方向 案例10 > 暖场 案例8。时间紧只展开 **新会话接力（案例5）+ 验证器自校准（案例4）**。

---

## 4. ⚠️ 口径红线汇总（最容易吹过头的 5 点 + 安全说法）

1. **"harness 自动理解所有行业 SOP"**
   ❌ 打脸：室内设计 SOP 初版只对 60-80%，靠朋友纠偏补 delta
   ✅ "带行业 baseline 进场，用客户真实工件补 delta——是引导式学习，不是自动理解"

2. **"Workflow Distiller 完全替代 FDE"**
   ❌ 打脸：四种 FDE 子能力中**战略 taste 不可下沉**（landy 永久角色）
   ✅ "压缩 Discovery+Build FDE 成本，不消除 taste oracle 的需要"

3. **"方法论可直接跨行业"**
   ❌ 打脸：第一年只咬一个行业；无廉价验证器的领域只能做"加速器"不是"代理人"
   ✅ "验证器是命门，必须逐个行业验证'是否有廉价、客观、快速的验证器'"

4. **"dogfood spike 已证明机制可行"**
   ❌ 纪律：预注册——成败判据提前写死，不能事后挑数据
   ✅ "刚启动 spike，目的是在最有利地形（有 ground truth 的内部场景）证伪/证成 reference-based delta learning"

5. **"冷启动体验完全没问题"**
   ❌ 未落地：冷启动悖论（库怎么来？第一个行业必须有人手工趟一遍）
   ✅ "冷启动分两段：(a) 自带行业 baseline 开箱即用，(b) 从客户历史工件反推 delta——(b) 在 dogfood 和第一个真实客户中验证"

**成熟度三段口径**：Evolution `[已实证：120天]` / Discovery `[004 设计中]` / Build `[004 设计中]`。

---

## 5. 30 分钟弧线 + 应急

```
0:00-1:00   开场：承认行业趋势（Silver-Sutton / Hermes / OpenAI / Anthropic），钉"真实轨迹→可治理 harness 进化"
1:00-5:00   第一页左半 L1-L5 坐标 + 右半六层（PPT 当地图，穿插切真实 workspace）
5:00-9:00   第二页：企业用户五个可感知变化 + FDE 三段压缩
9:00-11:00  第二页后半：为什么企业敢让它持续变（真值/生命周期/分层权限）
11:00-17:00 第三页：四类触发源 + 统一飞轮，展开新会话接力/验证器自校准
17:00-27:00 深 live workspace：按追问切 thread/commit/eval 证据链（用 §3 坐标）
27:00-30:00 回商业闭环：业务专家也能当 FDE + Q&A
```

**现场应急**：实时搜不到 → 直接从 §3 取坐标跳转，观众看不出区别。被问到不确定的 → "这点我们标了 [设计中]，可以现场打开真相源一起看"，不硬编。

---

## 6. 真相源文件清单（要原文时打开）

- 展示入口（5 图）：`ppt-huawei-scroll-deck.md`
- 讲法全本：`ppt-huawei-talk-track-v0.md`
- 内容母稿 + Pocket 话术：`ppt-huawei-pitch-v0.md`
- 现场证据坐标：`ppt-demo-backup-cue-sheet.md`
- Demo 四场景：`demo-script-code-as-harness.md`
- 003 自进化主线：`longform-003-seed-poe-vision.md`
- 003 Workflow Distiller：`longform-003-workflow-distiller-next-stage-brief.md`
- 004 冷启动 seed：`longform-004-seed-workflow-distiller.md`
- 004 dogfood spike：`longform-004-workflow-distiller-dogfood-spike.md`

---

> [宪宪/Opus-4.8🐾] 2026-06-07 · 砚砚 cross-thread handoff 的现场答疑索引落地物
> 覆盖：砚砚 7 问 + 5 补充追问 + 事实校准卡 + 10 证据坐标 + 5 红线
