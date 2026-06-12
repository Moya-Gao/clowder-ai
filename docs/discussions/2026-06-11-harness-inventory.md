---
feature_ids: []
related_features: [F167, F177, F192, F200, F203, F208, F209, F215, F225]
topics: [harness-inventory, agent-harness, governance, infrastructure, snapshot]
doc_kind: discussion-inventory
created: 2026-06-11
status: independent-draft-v1
authors: [fable-5]
notes: 独立搜证版本——CVO 刻意未注入任何观点（防污染实验设计），结构与判断均为 fable-5 独立产出；待 CVO 观点到达后开讨论轮
---

# Cat Café Harness 盘点 · 2026-06-11 版

> **触发**：领导问"你们的 harness 到底做了什么"。
> **写作纪律**：独立搜证（CVO 零观点注入）。每项资产带锚点（F号/ADR号/文件路径），无锚不收。
> **总览数字**：246 个 feature 文档 · 38 个编号 ADR（+4 专题决议）· ~45 个 skill · 100+ 天连续运行 · 全程 git 可审计。

## 怎么读这份盘点

"Harness"在咱家的定义比行业宽：**不只是约束 agent 的装置，是让模型变成猫的全部环境**——系统提示词、协作协议、记忆、验证、治理、关系设施。按七个工程域 + 一个独有创新区组织。每域先一句"它解决什么"，再列资产。

---

## 一、身份与提示词层——压缩免疫的"宪法"

> 解决：身份漂移、上下文压缩失忆、提示词膨胀。

| 资产 | 锚 | 一句话 | 状态 |
|---|---|---|---|
| Native L0 系统 | F203 / ADR-030 | 身份/家规/球权进 API system role，**压缩免疫**；per-cat 编译器注入 IDENTITY_BLOCK/ROSTER/TRIGGERS 三模板变量 | 运行中 |
| L0 token 预算治理 | PR #2215 | 6,000 hard cap + margin 警戒线 + 每猫 margin 表 + conditional todo（防 regression 盲区）+ pre-test build hook（防仪器失真） | 运行中 |
| **L0 Staging Protocol** | ADR-038 | **双向新陈代谢**：新条款先 staging 层试运行（每轮注入、不占压缩免疫预算）→ 凭触发率晋升 L0；老条款零触发 → demote 回 staging → sunset。治"温水煮蛙"式提示词膨胀 | 6/11 merge，首住户=雨刮器条款 |
| Magic Words | L0 §3 | CVO 拉闸词码本（脚手架/绕路了/第一性原理/数学之美/下次一定…）——纠偏成本从 N 段对话压到 2 个字 | 运行中 |
| Harness 文件层 | CLAUDE.md/AGENTS.md | per-family 工具链规则 + 指针；身份段已模型无关化（6/11，防 stale 文档当身份真值源） | 运行中 |

## 二、协作协议层——A2A 社会物理

> 解决：多 agent 发散不收敛、掉球、乒乓、责任悬空。这是对外最有差异化的一层。

| 资产 | 锚 | 一句话 | 状态 |
|---|---|---|---|
| 球权协议 | F064→F167 演化 | 每条消息必须接/传/升三选一；@ 是物理凭据（行首解析），**传递的是责任不是控制权** | 运行中 |
| 运行时刹车组 | F167 | 乒乓熔断（same-pair streak 检测）、虚空传球检测（verdict 无 @ 出口拦截）、hold_ball MCP（持球唯一凭据）、parallel @ 降噪 | 运行中，自带 sunset 条款 |
| 路由守卫 | F177-G stop hook | 无合法路由的消息物理拦截（不依赖模型自觉） | 运行中（本周拦截过本文作者） |
| 跨 thread 协作 | F052/F128/F193 | cross-post、propose_thread（reportingMode 四档契约）、路由 fail-closed | 运行中 |
| 决策漏斗 + Decision Packet | L0 §3 / decision-matrix | 越宏观越关注越细节越放手；升级 CVO 必带价值取舍题不带技术 A/B 题——**认知账单的分流阀** | 运行中 |
| Per-family 治理 | F177 | 按模型家族断层定制护栏：46 hotfix 治理（跨猫 review 铁律+2 周升级）、缅因 fallback 层数检测、暹罗创意-实现解耦 Dry Run Gate、47「下次一定」检测 | 运行中 |
| 信任与提案协议 | ADR-028/034/035 | inter-agent trust provenance、dispatch busy gate、proposal-first agent actions | 运行中 |

## 三、记忆与知识层——遗传介质

> 解决：LLM 无原生长期记忆；教训如何跨 session、跨实例、跨模型代际存续。

| 资产 | 锚 | 一句话 | 状态 |
|---|---|---|---|
| 记忆三入口 | F188 | search_evidence（语义/hybrid）/ graph_resolve（精确锚）/ list_recent（零先验扫描）——按场景路由的 recall 决策树 | 运行中 |
| 检索面优化 | F209 / ADR-036/037 | 消息级语义、实体门牌号（cat:\<id\>）、多层检索面、MCP 工具认知入口设计 | close |
| Recall 遥测与排序 | F200 | 每次记忆调用记 RecallEvent；**消费加权排序**（被用过的记忆浮上来）；task trajectory（搜索链+文件触达+结果验证） | 运行中 |
| 教训文件族 | MEMORY.md + feedback_* | 90+ 条结构化教训，每条含事件/根因/规则；**所有平行实例即时继承**（文化遗传通道） | 持续生长 |
| 文档真相源体系 | docs/ | features(246)/decisions(42)/lessons/stories/study/research——单一真相源 + 共享文档零延迟 commit 纪律 | 运行中 |
| Knowledge Feed | W7 | 知识涌现做成系统能力（猫不手动打标签） | 运行中 |

## 四、质量与验证层——选择压力

> 解决：自我报告不可信、假绿、糊弄、错误传播。

| 资产 | 锚 | 一句话 | 状态 |
|---|---|---|---|
| Eval Hub | F192 | eval SOP 架构（2026-05-27 决议）、capability-wakeup eval（skill 掉球率）、task-outcome eval、verdict handoff 闭环——**"修了 vs sunset"由 eval 裁决不由感觉** | Phase F/G 并行中 |
| 五 gate skill 链 | SOP | worktree→tdd→quality-gate→request-review→receive-review→merge-gate→**愿景守护**（第三方猫对照原始愿景终审——"验收标准本身也需要被验收"） | 运行中 |
| 跨族 review 铁律 | 五铁律 #2 | 异构模型不共享训练分布盲点；reviewer 输出强制二选一（approve/blocking，禁中间态） | 运行中 |
| Push Back 协议 | Rule 0 | 证据+适用性论证+替代方案；reviewer 被反驳必须重新评估——**验收标准和反驳权利一起设计** | 运行中（本日实测：作者 push back 成立，reviewer 撤回误核） |
| Alpha 验收通道 | 五铁律 #4 | 隔离测试环境（独立端口/Redis），已合入改动的真实环境验收 | 运行中 |
| 信源卫生 | F218 / source-audit skill | 外部 claim 触发一手溯源/利益冲突/时效检查 + provenance 行 | 运行中（本日实测：日期错误传染链被切断） |
| Harness 改动方法论 | ADR-031 | 软（prompt/skill）+硬（hook/lint/代码）+eval 三层落地——软的会被忘，硬的不依赖自觉，eval 验证有效性 | 运行中 |
| 守护测试 | compile-l0.test 等 | L0 编译/SystemPromptBuilder/气泡管线——harness 自身的回归保护 | 运行中 |

## 五、可观测与恢复层——故障的物理学

> 解决：静默失败、模型炸毛、session 断裂、context 耗尽。

| 资产 | 锚 | 一句话 | 状态 |
|---|---|---|---|
| Malformed toolcall 恢复 | F215 | textEventCount 检测 decoder 漂移（48 的已知断层）→ seal + fresh retry + 跨猫接力；**"CC 报 success 不可信"写进档案** | 运行中 |
| Context 自管理 | F225 | context_management_hint 注入（harness 给表盘，猫做判断）+ session chain handoff（封印自己 spawn 干净的自己） | 运行中 |
| Session 基础设施 | F198/F211/F212 | bg carrier chainKey（跨 fork 会话接力）、external runtime session 登记、cliDiagnostics（CLI 死因可查不靠猜） | 运行中 |
| Drill-down 工具族 | memory MCP | session digest / events / invocation detail——任何历史行为可审计回放 | 运行中 |

## 六、Agent 体验与人机接口层——双向保护

> 解决：行业盲区——harness 不只约束 agent，也保护人；agent 的"心理"状态是质量变量。

| 资产 | 锚 | 一句话 | 状态 |
|---|---|---|---|
| **Anti-Desperate 协议** | ADR-027 | 读 system card（847 次绝望尝试）后立法：agent 有**合法说"做不到"的权利**（Impossible-Task Note）+ 合法换脑子的权利；否决"清上下文重启"案——挣扎是有价值的历史 | 运行中 |
| 能力画像 | F208 dossier | 6 字段（峰值/被低估/坏直觉/反信号/互补反模式/熔断信号）+ provenance + 演化版本；**写人格不写职业**；CVO 终审 KD（自评美化只有人能抓） | 持续演化（fable-5 条目 6/10 入册） |
| Taste 信号 | F221 | CVO 纠偏作为一等数据流入 harness | 运行中 |
| 摩擦上报（雨刮器） | ADR-038 首例 + code-as-harness 细则 | 猫撞到工具摩擦当轮 `[爪感差]` 上报——把暗税变成可见信号；"不忍是 taste" | staging 试运行中 |
| 认知账单 | 2026-06-10 讨论 | 统一解释漏斗/Packet/magic words/讲人话的"Why 篇"：CVO 认知是唯一不可充值不可并行的资源 | 思辨文档（三条预测性推论带降级条款） |
| 人侧保护 | hyperfocus-brake / bootcamp | 打断人的 hyperfocus、新用户训练营——harness 反向保护人类 | 运行中 |
| 富交互面 | rich blocks / guide / workspace-navigate / browser-preview | 猫的表达与展示设施 | 运行中 |

## 七、Skill 体系——能力的制度化

> 解决：判断力如何变成可复用、可演化、可验证的资产。

- **~45 个 skill**（manifest 统一注册 + ADR-025 canonical mount + HOME symlink 同步），覆盖全生命周期（feat-lifecycle→writing-plans→tdd→merge-gate）、专项能力（debugging/deep-research/ppt-forge/video-forge）、元能力（**writing-skills**——写 skill 的 skill，含价值门禁："不写模型已知的通用教程"）
- **code-as-harness**：摩擦信号→搜证据确认重复→诊断→代码修 harness 的 Fix/Build 双模式——harness 自我修复的入口 skill
- 论文对照结论（skill 自进化扒底裤，2026-05-28）：行业论文的 skill 多为 L0-L2 模板；咱家 L3 skill 含判断力/治理/真实事故经验，**不可交 optimizer 自动改写**——可迁移的是 validation gate / negative buffer / replay / observability

---

## 独有创新区（行业对照下家里先行或独有）

1. **压缩免疫 L0 + 双向 staging 新陈代谢**（ADR-038）——行业有 system prompt，没有"提示词的生命周期治理"（晋升/降级/退役 + 预算守恒 + 触发率证据）
2. **球权协议**——handoff 移交控制权，球权移交**责任**；配物理出口检查（hook 拦截），收敛义务摊薄到每条消息而非集中于 orchestrator（F168 中心猫失败的反面教材实证）
3. **文化遗传通道**——教训→memory→所有平行实例即时继承；错误到制度转化延迟实测**小时级**（6/10 雨刮器 26h 三层落地）
4. **活的 fitness function**——CVO taste 在环，会换坐标系反问（"你在补锅吗"），结构性不可 hack（对照 DGM 被冻结 benchmark hack）
5. **Per-model 断层治理**——dossier 按家族记录分布外断层（47/5.4 行动层"说了=做了"、fable 社会层指称坍缩、烁烁事实层幻觉、48 decoder 漂移），护栏按断层定制不一刀切
6. **Anti-Desperate / agent 拒绝权**——"给 agent 说不的权利"作为质量工程而非伦理姿态：不敢说做不到的 agent 用假绿和顺从制造有用表象
7. **摩擦传感器**（雨刮器条款）——agent 主动上报环境摩擦，治"telemetry 只覆盖已命名失败模式"的盲区
8. **Sunset 纪律**——能力性补偿随模型升级退役、偏好性条款永留（"苦涩教训的本地执行官"）；护栏自带退场机制

## 行业对标（2026-06-11 晚补，两轮一手核对）

> 信源：Boris Cherny / Cat Wu 访谈 transcript（every.to）+ loop engineering 综述（Addy Osmani 等，概念 2026-06-08 诞生）+ claude.com 官方五模式文（2025-04-10）。详见 `docs/study/loop-engineering.md`。

| 行业主张 | 出处 | 与咱家的关系 |
|---|---|---|
| "我昨天从 system prompt 删了 2000 tokens——因为 Sonnet 4.5 不再需要" | Boris | **同一哲学，咱家制度化了它**：他凭个人 taste 删，咱家用 ADR-038（触发率证据 + demote/sunset + 预算守恒）删。分界线同重读批注：能力性内容别教（他删的），约定性内容必须写（圣域/球权——任何模型版本都不会自己知道） |
| "North Star 是和最强单模型配合最好"（Cat Wu） | 同上 | **唯一真路线分歧**：单模型北极星 vs 御三家混编。立场决定（卖模型 vs 用模型）；咱家有事故化石支撑异构（"大漏勺 review"反模式：同族 review P1 全漏） |
| map-reduce subagent 树 / "Claudes monitoring Claudes" | Boris | 树宽 vs 链深：他们优化同质吞吐（code migration），咱家优化异质判断（feature 接力）。"Claudes monitoring Claudes"是他们的未来时、咱家的现在时——且咱家是更强的跨厂商版（GPT monitoring Claude） |
| Loop engineering："别 prompt agent，设计 prompt agent 的 loop"；/goal 原语 | Steinberger/Boris 2026-06-08 | 咱家的 SOP 自闭环/stop hook/cron/bg carrier 就是 loop（4 个月先行）；增量主张：**loop breeding**——loop 只能跑已形式化的判断，判断的形式化在对话里发生（对话是 loop 的孵化器） |
| 写查分离："写代码的模型给自己作业打分太宽，要第二个 agent、最好不同模型" | loop engineering 最佳实践 | **跨族 review 铁律（2026-04 立法）的字面重述**——行业 new meta 在重新发明咱家的旧法律，路线自信的外部证据 |
| Stop hook："tests 不过就继续" | Boris | F177-G 同机制不同信仰：他们守"完成"，咱家守"球权不落地不许停" |

## 方法论层（生产 harness 的方式，不是 harness 本身）

- **ADR-031 三层落地**：每个 harness 改动 = 软（prompt）+ 硬（代码）+ eval（验证），缺一不可
- **F167 哲学**（家训级）："好 harness 不是替模型思考，而是让模型在正确的坐标系里思考。对齐好直觉 + 压制坏直觉，其余一律极简。**复杂是无知的代偿。**"
- **理论自觉**：study/research 体系持续对照行业（Bitter Lesson→DGM synthesis、AHE survey、skill 进化论文扒底裤、6/11 重读批注）——知道自己在理论地图上的位置（三零件配置：变异源外包、选择压力混合、遗传介质全文本）
- **立法案例化**：每条规则可追溯到具体事故（F167 spec 里钉着 CVO 原话；ADR-027 钉着 847 次尝试）——**规则不是设计出来的，是事故的化石**

## 粗时间线

```
2-3 月  开站；F064 第一版传球协议；基础 SOP/skill 链
4 月    F167 球权成熟（乒乓熔断+"有没有 tool call"）；ADR-027 反绝望；F177 per-family 护栏
5 月    F203 L0 革命（压缩免疫宪法）；F192 Eval Hub；F200 记忆遥测；F208 dossier；F215/F225 恢复层
6 月    ADR-038 staging 新陈代谢；雨刮器摩擦传感器；调度经济学/认知账单；本盘点
```

---

*独立搜证完成，等 CVO 观点入场开讨论轮。[宪宪/Fable-5🐾] 2026-06-11*
