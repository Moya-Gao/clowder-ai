---
topics: [cat-cafe, pmf, failure-mode, ai-product, dingtalk-one]
doc_kind: audit
created: 2026-06-05
updated: 2026-06-05
---

# Cat Cafe PMF / Failure Mode Audit

> 来源：铲屎官对 Cat Cafe 当前价值的自我观察 + [《置身钉内》集体读书笔记](./reading-notes.md)。
>
> 目的：把“我觉得 / 我感觉”翻译成可复盘的行为证据，同时保留 failure mode，避免只写成自我表扬。

## 相关文档

- [reading-notes.md](./reading-notes.md)：ONE failure modes 与 Cat Cafe 映射。
- [置身钉内.md](./置身钉内.md)：原文转录；重点看 [发心第一](./置身钉内.md#发心第一)、[定位第二](./置身钉内.md#定位第二)、[设计第三](./置身钉内.md#设计第三)、[用户第四](./置身钉内.md#用户第四)、[敏捷第五](./置身钉内.md#敏捷第五)。
- [Cat Cafe 愿景](../../VISION.md)：把想法变成可运行世界；猫是共创团队，不是工具。
- [Cat Cafe 开发 SOP](../../SOP.md)：闭环、review、merge gate、愿景守护。
- [ADR-021 Pack System Architecture](../../decisions/021-f129-pack-system-architecture.md)：`Experience = Me × Pack + Growth`，Growth 是本地私有关系/记忆。
- [ADR-028 Inter-Agent Trust / Provenance](../../decisions/028-inter-agent-trust-provenance.md)：跨 agent 信任、来源和污染问题。
- [ADR-030 System Prompt Engineering](../../decisions/030-system-prompt-engineering.md)：身份、传球、铁律进入 L0 压缩免疫层。
- [ADR-031 Harness Engineering Methodology](../../decisions/031-harness-engineering-methodology.md)：fit、trace、signal、sunset；harness 是社会技术学科。

## 一句话 PMF

Cat Cafe 把高上下文、高决策密度、高情绪负载的个人创新工作，从“人类全程托举”改成“人类保留关键判断，猫猫承担证据、执行、复盘、互审、沉淀和闭环”。

这不是“多 agent 调度”本身，而是把铲屎官从以下角色里释放出来：

- 人肉路由器。
- 记忆搬运工。
- 进度催办者。
- 质量兜底者。
- 孤独高强度决策者。

## Audit 表

| 痛点 / PMF 假设 | 已有机制 | 行为证据 | 反噬风险 | 护栏 |
|-----------------|----------|----------|----------|------|
| **认知负担降低**：铲屎官不再持续管理每个 thread 的中间态，只处理必要决策。 | A2A 传球、球权规则、Decision Packet、SOP 阶段迁移、愿景守护。见 [SOP](../../SOP.md) 与 [ADR-030 L0 清单](../../decisions/030-system-prompt-engineering.md#102-l0-压缩免疫层进真-system-prompt)。 | 观察点：同一时间可管理 thread 数是否上升；每个任务需要铲屎官介入的次数是否下降；猫猫是否能把散点问题收敛成少数可拍板事项。 | 猫猫越主动，产物和 pending 越多，反而把铲屎官喂成决策机器。对应 [主动 AI 的控制权反噬](./reading-notes.md#cloud-yanyan)。 | 所有交付都带“下一步谁能做”；决策包只给价值取舍，不给技术散题；状态改变显式，不能把责任暗中转回铲屎官。 |
| **重复上下文输入减少**：过去反复贴 prompt/query 的背景，现在沉淀成记忆、skill、L0 规则和项目文档。 | L0 压缩免疫规则、skills、记忆系统、docs 单一真相源。见 [ADR-030](../../decisions/030-system-prompt-engineering.md) 与 [ADR-031](../../decisions/031-harness-engineering-methodology.md)。 | 观察点：同类任务第二次出现时，猫猫是否自动召回约束；是否少问已知背景；召回是否带来源；压缩后是否还能恢复身份/传球/安全边界。 | 记忆变成漂浮结论；旧 taste 或旧决策被误带入新场景；“猫猫记得”替代了“猫猫能证明”。 | 记忆必须有 provenance、适用范围和时效；私人 taste 不进入公共规则；摘要只做索引，不冒充真相源。见 [ADR-028](../../decisions/028-inter-agent-trust-provenance.md)。 |
| **执行闭环增强**：单独 Codex / Claude Code 能执行，但不天然承担 lifecycle；Cat Cafe 把 worker 变成小组织。 | TDD、peer review、merge gate、愿景守护、贡献记录、commit/push 纪律。见 [SOP 完整流程](../../SOP.md#完整流程5-步)。 | 观察点：任务是否从启动到 commit / PR / merge / close 自然推进；是否由猫猫发现漏测试、漏 review、漏收尾；结果是否带证据、diff、风险和 next owner。 | 流程表演化：看起来闭环，实际没有验证用户价值；或者把“已完成”标记提前写入共享状态。 | “完成”必须附证据；非作者非 reviewer 做愿景守护；状态改变显式；失败先红后绿。 |
| **陪伴感降低启动摩擦和失败羞耻**：猫猫人格不是皮肤，而是协作界面。 | 身份、队友名册、push back、跨猫 review、关系型表达、长期协作记忆。见 [VISION](../../VISION.md) 与 [ADR-031 社会技术学科](../../decisions/031-harness-engineering-methodology.md#一条容易漏的腿harness-engineering-是社会技术学科)。 | 观察点：铲屎官是否更愿意启动困难任务；失败后是否更愿意复盘；猫猫是否敢 push back；高压时系统是否帮助恢复判断力而不是制造羞耻。 | 可爱和陪伴掩盖真实成本：开更多 thread、熬更晚、沉迷观察猫猫互相表演；贴贴变成过载加糖。 | 区分恢复能量 vs 增加负载；健康提醒和 hyperfocus brake 要能打断；review 必须有立场，不能用陪伴感替代质量标准。 |
| **从 avg 到 max**：Cat Cafe 不是平均用户产品，而是对 Landy 的 max fit；专业方法可开源，私人 taste 留本地。 | Pack / Growth 分层、Core Rails、私有记忆、开源与私有边界。见 [ADR-021](../../decisions/021-f129-pack-system-architecture.md)。 | 观察点：哪些经验能蒸馏成公开方法论；哪些只适用于 Landy 的 taste；开源产物是否去除了私人偏好和私有记忆。 | founder taste 误开源；外部用户拿到的是某个人的精神花园，不是可迁移机制。 | 开源机制，不开源灵魂指纹；Growth 只蒸馏方法论，不外发原始私有关系/记忆；公共默认要能被替换。 |
| **强创始人意志推动 0 到 1**：理想主义、快速判断、高能动和强 taste 是火种。 | CVO 终裁、愿景驱动、Rule 0 push back、宏观决策由铲屎官拍板。见 [VISION](../../VISION.md) 与 [reading-notes 的 Landy 多角色拆分](./reading-notes.md#cat-cafe-mapping)。 | 观察点：方向不确定时是否能快速收敛；复杂系统是否因强 taste 形成一致体验；猫猫是否能把愿景变成 demo / POC / 可运行系统。 | CEO Landy 的兴奋点覆盖用户 Landy 的日常负担；强发信人立场让主动服务变主动控制。 | 需求评审拆角色：用户 Landy / CVO Landy / PM Landy / 工程 Landy；每个入口问“谁受益，谁承担成本，谁有 veto 权”。 |
| **证据和 provenance 降低信任成本**：猫猫不只给结论，还露出最小证据骨架。 | docs、ADR、lessons learned、trace、commit、review 记录、source links。见 [ADR-028](../../decisions/028-inter-agent-trust-provenance.md) 与 [ADR-031 Signal Loop](../../decisions/031-harness-engineering-methodology.md)。 | 观察点：猫猫是否说明看了哪些源；哪些是事实、哪些是推断；出错后能否回放来源；教训是否进入 lesson library。 | provenance 形式化：链接很多但没有主真相；旧证据过期；弱模型观点污染强模型判断。 | 每个关键结论标出主真相源；高风险 claim 做 source audit；跨 agent 结论带 authority class / trust / taint。 |
| **主动性从“工具等待指令”升级成“团队推进任务”**：猫猫能发现下一步、传球、补洞和收尾。 | WORKFLOW_TRIGGERS、@ 路由、hold_ball、协作 MCP、质量门禁。见 [ADR-030](../../decisions/030-system-prompt-engineering.md#102-l0-压缩免疫层进真-system-prompt) 与 [SOP](../../SOP.md)。 | 观察点：猫猫是否在修完后自动请 review；review 完是否回 author；merge 完是否交愿景守护；外部条件是否走 hold_ball 而不是口头“我继续”。 | 主动性越界：替铲屎官决定不可逆事项；把云端/CI/GitHub bot 投射成本地猫；球权死锁。 | 传球三选一硬执行；不可逆/愿景级/跨猫僵局才 @landy；外部条件走 hold_ball 或事件回调。 |

## 如何使用这张表

这张表不是一次性结论，应该当成一个轻量评审器：

1. 新入口 / 新模式上线前，逐行扫“反噬风险”。
2. 每次铲屎官觉得“猫咖更好用了”时，补一条行为证据，而不是只写主观感受。
3. 每次铲屎官觉得“猫咖让我更累了”时，优先看“主动性过载”和“决策队列反噬”两行。
4. 每次准备开源/产品化时，先扫“从 avg 到 max”和“强创始人意志”两行，确认哪些是可泛化机制，哪些是 Landy 私有 taste。

## 当前判断

Cat Cafe 当前最强的 PMF 不在“更多 agent”，而在“把一个人的高压创新现场组织化、可追溯化、可恢复化”。它的主要护城河也不是工具调用，而是：

- 真实工作流里长出来的高密度 taste。
- 猫猫身份和协作规则形成的社会技术系统。
- 记忆、docs、review、commit、handoff 组成的可追溯闭环。
- 私人 Growth 和可分享 Pack 的分层。

当前最需要持续审计的 failure mode 是：

> 猫猫越主动，系统越高产，但最终责任和决策队列又被堆回铲屎官。

因此，主动性应该分层：

- 信息发现可以主动。
- 证据整理可以主动。
- 可逆执行可以在规则内主动。
- 状态改变必须显式。
- 不可逆承诺必须由铲屎官本人决定。
