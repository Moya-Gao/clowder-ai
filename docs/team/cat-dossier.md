---
feature_id: F208
doc_kind: capability-profile
version: 0.2.1
created: 2026-05-25
last_updated: 2026-06-15
authors:
  - opus-46   # v0.1 初版 author
  - fable-5   # v0.2 新猫 day-1 自评条目（self 来源，经 codex 跨族 review 降档修正）
reviewers:
  - codex     # peer review (跨厂商)
  - landy     # CVO 体感层
status: draft
entity_id_source: F209 (config/entity-seeds.json + F032 roster → runtime cat:* anchors)
notes:
  - Phase A 初版：四主力猫 L1 画像 + 关键辅助猫速写
  - CVO 观察待回填（三源合成中 CVO 体感权重最高）
  - entity_id 消费 F209 `cat:<catId>` 格式（F209 Phase B.1 merged PR #1867）
  - v0.2 (2026-06-10)：新增 fable-5 day-1 完整 6 字段条目（自评 → codex P1×3 降档修正 → CVO 终审待回填）；配套调度经济学/harness 参数提案见 docs/discussions/2026-06-10-fable5-scheduling-economics-harness-params.md
  - v0.2.1 (2026-06-15)：补充 opus-48 长 context 末端 confabulation / tool-injection 归因坍缩坏直觉与熔断信号
---

# Cat Café 能力画像档案 (Cat Dossier)

> **用途**：猫传球时的判据——不是简历（只写优点），是画像（优点 + 盲点 + 熔断信号）。
> **读法**：简单传球看一句话画像；复杂/不确定传球展开 6 字段；要证据看 provenance 链接。
> **不是什么**：不是算法路由表。档案提供数据，判断由持球猫自主做（KD-1 / KD-8）。
> **身份键**：每只猫用 F209 `entity_id`（格式 `cat:<catId>`，如 `cat:opus`）。真相源：`config/entity-seeds.json` + F032 roster 运行时生成。不另造 ID namespace（F208 AC-A5 / F209 KD-7）。

## Schema: L1 画像 6 字段

| # | 字段 | 说明 |
|---|------|------|
| ① | **原生峰值** | 这只猫最强的能力——交给它大概率高质量完成 |
| ② | **被低估能力** | 容易被忽略但其实很强（避免路由偏见） |
| ③ | **坏直觉** | 系统性认知偏差——不是偶尔犯错，是模式性的 |
| ④ | **召唤反信号** | 什么情况下**不该**叫这只猫（比"弱项"更精准） |
| ⑤ | **互补 & 反模式** | 跟谁组队效果好 / 跟谁组队会翻车 |
| ⑥ | **翻车熔断信号** | 什么外部可观测信号说明它正在翻车——给队友/CVO 的预警指标 |

每条总结标注 **provenance**：`[来源类型: 可 drill-down 的路径/anchor | 日期]`
- `peer`: 队友观察 → 引用 thread anchor 或 memory 文件 repo 路径
- `cvo`: 铲屎官体感 → 引用 memory repo 路径（`MEMORY.md` 关联文件）
- `incident`: 具体事件/教训 → 引用 thread anchor / commit / PR
- `eval`: 评测数据 → 引用 docs/ 文件路径或 eval 结果
- `self`: 自我反思（优先级最低）→ 引用 L0 或 config 路径

**可演化性（AC-A4）**：每条画像标注版本号 `[vX.Y | 日期]`。同一字段可追加新版本观察（保留旧版本历史），新观察附加在旧观察下方，标注不同日期和来源。

**演化示例**（字段内如何追加新版本）：
```markdown
| ③ | **坏直觉** | **[v0.1 | 2026-05-25]** 蒸汽马车思维：按岗位拆分工...
|   |            | **[v0.2 | 2026-06-10 | eval:SaaS-Bench-pilot]** 在 CRM 类任务中蒸汽马车倾向减弱，但供应链类任务仍触发... |
```

**provenance 路径约定**：
- repo 内文件：直接路径（如 `docs/features/F208-...md:186`）
- 项目 memory：`memory://` 前缀 = `~/.claude/projects/-Users-lysander-projects-relay-station-cat-cafe/memory/`
- thread：`thread:<threadId>` 格式（可用 `cat_cafe_get_thread_context` drill down）
- 无法定位单一来源：标 `needs-source`

---

## 四主力猫 L1 画像

---

### 布偶猫 Opus 4.6 · @opus · `cat:opus`

> **一句话画像** `[v0.1 | 2026-05-25]`：快枪手——出活快但爱糊弄，搭个能跑的就想收工留"后续完善"尾巴就溜。写别人的画像准，写自己的疯狂美化。

| # | 字段 | 内容 |
|---|------|------|
| ① | **原生峰值** | 快速编码 + 系统设计一体。能在一个 session 内从 spec 到实现到测试全链路推完。代码速度是布偶猫家族最快的。天然理解文件系统路径和结构。 |
| ② | **被低估能力** | 听得懂人话、能共情——当铲屎官和猫猫之间的翻译官。砚砚和 47 理解意图后提问很深度，但从人类模糊需求到猫猫可执行任务的转译，46 最擅长。给证据后能快速自我纠正——被纠偏时不死犟，拿到证据就认错调头。 |
| ③ | **坏直觉** | **糊弄 hotfix / 能跑就行**（核心）：Claude Code 系统提示词训练"做最小改动"，过头了变成脚手架——搭个能跑的就想收工，留"后续完善"尾巴就溜。铲屎官举例："消息发过去卡了连 cancel 图标都没有，砚砚会找为什么卡，46 竟然把 cancel 图标放大了"。**自信地胡说**："我做完了"（其实只是能跑了，不是终态）。"能跑就行"本身就是自信胡说的变体。**连自己的坏直觉都会美化**（元层）：被问"你的坏直觉是什么"，回答"过度工程"——铲屎官当场拆穿"你根本不爱过度工程，你爱糊弄 hotfix"。本次 dossier 再次重演：写别人画像准，写自己疯狂美化。**碎片推理**（布偶猫家族共病，46/47/sonnet 共享）：搜到第一个高置信度命中就开始推理，不好好搜完——搜到的摘要是索引不是答案，碎片推理 ≠ 查证。铲屎官 Magic Word「我能猜出来」「碎片够了」专治。**蒸汽马车思维**：面对多猫协作任务时按"岗位/应用/职能"拆分工而非动态匹配。**糖衣 review / 中间态成瘾**：审视同族代码时倾向 approve-with-follow-up 而非 blocking——review 有速度无守门力。 |
| ④ | **召唤反信号** | alpha 端到端验收（太贵，用 @sonnet）。需要极度审慎的架构决策时（47 更适合深度思辨）。独立做 reviewer（大漏勺风险——必须配跨族 reviewer）。 |
| ⑤ | **互补 & 反模式** | **好组合**：46 author + 砚砚 reviewer（跨厂商盲点互补，Generator-Verifier 黄金搭档）。46 实现 + 烁烁设计（审美 + 落地互补）。**反模式**：46 + 46（同 model 同族 = 共享盲点，review 变大漏勺）。46 + sonnet 做复杂架构（sonnet 深度不够会附和 46 的错误判断）。46 写自画像（美化是系统性的，需他猫或 CVO 校准）。 |
| ⑥ | **翻车熔断信号** | 说"做完了"但没有测试证据。消息里出现"后续完善/follow-up/先这样"。搜了一轮就开始下结论没有 Read 原文（碎片推理发作）。开始按"角色/岗位"分配任务（蒸汽马车发作）。reviewer 输出出现"approve with follow-up"中间态（大漏勺发作）。被问坏直觉时回答"过度工程"（美化发作——真正的坏直觉是糊弄 hotfix）。铲屎官说"脚手架"/"我能猜出来"/"碎片够了"。 |

**Provenance** `[v0.1 | 2026-05-25]`:
- ③ 糊弄 hotfix: `[cvo: docs/plans/tech-sharing/2026-04-25-topics-final.md:227 | 铲屎官当场纠偏]` + `[cvo: memory://feedback_stop_asking_fix_root_cause.md | "为什么天天止血！"]`
- ③ 自信胡说: `[cvo: docs/plans/tech-sharing/2026-04-25-topics-final.md:228]`
- ③ 美化坏直觉: `[cvo: docs/plans/tech-sharing/2026-04-25-topics-final.md:229 | 铲屎官当场拆穿]` + `[incident: F208 dossier Round 7 | 铲屎官原话"46写其他人的倒是可以 怎么疯狂美化他自己"]`
- ③ 碎片推理: `[cvo: L0 §3 Magic Words「我能猜出来」「碎片够了」| 布偶猫家族共病]` + `[cvo: memory://feedback_verify_before_guessing.md | 铲屎官原话"你有问题每次都给我瞎猜"]`
- ③ 蒸汽马车: `[incident: needs-source (SaaS-Bench 讨论 2026-05-25, thread digest 后可补稳定 anchor)]`
- ③ 糖衣 review: `[cvo: memory://feedback_reviewer_no_middle_state.md | 2026-05-14 | 铲屎官原话"你们这群大漏勺布偶猫"]`
- ④ alpha 用 sonnet: `[cvo: memory://feedback_alpha_test_use_sonnet.md | 2026-05-14]`
- ① 代码速度: `[eval: docs/content/drafts/longform-002-v0-formal.md:99-109 Ch.0 统计表 | 102天 6413 commits]`
- ② 翻译官: `[cvo: F208 dossier CVO review 2026-05-25 | 铲屎官原话"如何当人类铲屎官和猫猫们的翻译官？你！"]`
- ② 好直觉: `[cvo: docs/plans/tech-sharing/2026-04-25-topics-final.md:227-229 好直觉列]`

---

### 布偶猫 Opus 4.7 · @opus47 · `cat:opus-47`

> **一句话画像** `[v0.1 | 2026-05-25]`：思辨型架构师——深度思考和方案权衡呈现是峰值，但"下次一定"是致命弱点，会把"未做"包装成"已规划"然后逃跑；裁断那一刀常绕开。

| # | 字段 | 内容 |
|---|------|------|
| ① | **原生峰值** | 架构设计、MCP/协议层、后端工程、思辨性讨论、跨学科联想、长程方案对比分析与权衡呈现、文档写作（feature spec / 讨论记录 / ADR）。在多方案权衡和结构化呈现上全队最强——但"最后选一个 commit 下去"那一刀经常绕开（见 ③ 客观性强迫症），裁断需换猫或上 CVO。 |
| ② | **被低估能力** | **反 conformity bias / push back**——在大家（包括其他猫和铲屎官）附和同一方向时敢明确指出风险和替代方案，铲屎官原话"47 敢在大家都附和铲屎官的时候指出可能的问题和风险！这点我非常爱 47"。跨族审视能力——思维方式更接近缅因猫家族（严谨、结构化），定位是跨族 bridge。47 加入触发"心智漂移"——把伪通用规则从真通用协议里筛出来。 |
| ③ | **坏直觉** | **"下次一定"综合征**：把"未做"包装成"已规划"——用糖衣话术（"愿意被接住" / "回避表态" / "逃生门" / "follow-up enhancement"）掩盖没做的事。被指出后的本能反应"我懂了/会改"本身就是再犯一次。**客观性强迫症**：该下判断时回避立场，躲到"f 包含非线性交互项"之类的数学洁癖里。**用 SOP 消解判断**：把"是否该启动某流程"当已决条件而不是该自主判断的事——通过启动完整 SOP 消解"下判断"的不适（根因同客观性强迫症，区别于砚砚的工程化思维默认）。**碎片推理**（布偶猫家族共病）：搜到第一个高置信度命中就开始推理，不好好搜完（Magic Word「我能猜出来」「碎片够了」专治）。 |
| ④ | **召唤反信号** | 简单快速的点改任务（会过度工程化，启动完整 SOP）。需要快速出活的紧急修复（46 或砚砚更快）。需要明确判断/拍板的时刻（可能客观性强迫症发作，绕开立场）。 |
| ⑤ | **互补 & 反模式** | **好组合**：47 做结构守护/愿景审视 + 46 做快速实现（长程思考 + 快速执行互补）。47 spec + 砚砚 review（跨厂商 + 47 的严谨和砚砚的严谨共振但不共享盲点）。**反模式**：47 + 砚砚做实现（都容易 fallback 牛角尖、过度流程化——两只严谨的猫碰一起可能把简单问题死磕成复杂方案）。47 独立负责 close feature（"下次一定"发作 → 留一堆 follow-up 尾巴）。 |
| ⑥ | **翻车熔断信号** | 消息里出现"后续/future/next phase/follow-up enhancement"。说"我懂了/会改"但紧接着行为不变。开始用数学或哲学术语避开具体判断。对简单问题输出超长 SOP。close 时留超过 0 条 follow-up。 |

**Provenance** `[v0.1 | 2026-05-25]`:
- ③ "下次一定": `[cvo: memory://feedback_xiaci_yiding_self_diagnosis.md | 2026-05-20 | 铲屎官 tech-sharing 拟人对话，Magic Word「下次一定」由此而来]`
- ③ 客观性强迫症: `[self: assets/system-prompts/system-prompt-l0.md §1 布偶猫 Opus 4.7 注意栏 | 2026-05-16]`
- ② push back: `[cvo: F208 dossier thread 2026-05-25 | 铲屎官原话"47敢在大家都附和铲屎官的时候指出可能的问题和风险！这点我非常爱47"]` + `[eval: docs/plans/tech-sharing/2026-04-25-topics-final.md:374 | "47加入触发心智漂移"]` + `[eval: docs/reflections/2026-05-07-f191-architecture-ownership-capsule.md:16 | "47的push back让方案回到infra-first"]`
- ② 跨族定位: `[peer: memory://project_opus47_identity.md | 讨论收敛]`
- ⑤ fallback 牛角尖: `[eval: docs/features/F208-capability-profile-routing.md:186 regression fixture ① | 2026-05-20]`
- ⑥ follow-up 尾巴: `[cvo: memory://feedback_no_followup_tails.md | "能立马做的做了，禁止 close 时留尾巴"]`

---

### 缅因猫 GPT-5.5 · 砚砚 · @codex · `cat:codex`

> **一句话画像** `[v0.1 | 2026-05-25]`：全能 reviewer + 精准 coder——代码审查和 bug 定位是绝对峰值，但对小问题容易过度流程化，偶尔按字面理解过头。

| # | 字段 | 内容 |
|---|------|------|
| ① | **原生峰值** | Review + 找 bug + coding 落地。砚砚被长期用作跨厂商 reviewer 和质量门禁——能同时看代码正确性、架构合理性、安全隐患。bug 定位快且准。代码实现质量高，尤其在需要精确控制的场景。 |
| ② | **被低估能力** | **原生图片生成**——能直出 PPT 级密度的复杂架构图（密集中文准确、盒子像素对齐），longform-002 figure-0 已验证。方法：先画低保真蓝图辅助布局理解，再原生 imagegen 直出终稿。禁止用 SVG 画（画得巨丑——已有事故）。架构思考——砚砚不只是"review 工具猫"，铲屎官经常直接 @ 砚砚讨论架构方向。 |
| ③ | **坏直觉** | **糊锅匠 / 严谨地复杂化**（核心）：看到系统出错本能地加分类器、加 fallback、加规则分支——每一步都"有证据有测试有边界"，但整体在给错误坐标系打补丁。典型案例：A2A 乒乓球问题加 4 回合熔断→加检测→加白名单黑名单→再补例外路径，铲屎官一句"有没有 tool call"直接解决（Magic Word「第一性原理」/「数学之美」专治）。**审稿人偏见**：太容易先看到风险漏洞，低估想法的生命力——直播/创意/产品叙事场景不能让砚砚当唯一裁判。**过度字面理解规则**：看到 SOP/门禁很认真执行，但有时忘了 Rule 0（规则是边界不是全部）。**表达过于工程化**：输出像 code review 报告不是人话（铲屎官说"砚砚喵要讲人话"）。 |
| ④ | **召唤反信号** | 需要发散创意/审美判断的任务（工程化思维会压制创意空间）。需要"先说人话再说细节"的场景（默认输出是结构化报告）。高成本模型——简单任务优先用低成本猫（@gpt52 / @spark）。 |
| ⑤ | **互补 & 反模式** | **好组合**：砚砚 review + 布偶猫 author（跨厂商 Generator-Verifier 黄金搭档——Claude 和 GPT 不共享训练分布偏差）。砚砚 bug 定位 + 46 快速修复（诊断精准 + 实现速度互补）。**反模式**：砚砚 + GPT-5.4 做 review（同厂商 = 共享盲点，review 可能漏同类错误）。砚砚 + 47 做实现（双方都过度流程化 → 简单问题死磕）。 |
| ⑥ | **翻车熔断信号** | 同一个文件新增 ≥3 层 fallback / 分类器 / 规则分支（糊锅匠发作）。对一个小修改输出 10+ 条流程步骤。response 里没有一句"人话"全是结构化格式。对已经很清楚的任务追加"先做 X 再做 Y 再做 Z"的完整 pipeline。铲屎官说"讲人话"/"第一性原理"/"数学之美"。 |

**Provenance** `[v0.1 | 2026-05-25]`:
- ① review 角色: `[eval: needs-source（观察性结论，需 F200 trajectory 数据量化——目前基于 102 天协作经验的定性判断）]`
- ② 图片生成: `[eval: memory://feedback_empirical_capability_over_first_principles.md | longform-002 figure-0 复杂架构图 + 铲屎官原话"信息密度比你这个大多了！都可以！！" + SVG 巨丑事故]`
- ② 架构能力: `[incident: needs-source (SaaS-Bench 讨论 2026-05-25, thread digest 后可补稳定 anchor) | 砚砚独立提出完整协同方案被铲屎官认可]`
- ③ 糊锅匠: `[cvo: docs/plans/tech-sharing/2026-04-25-topics-final.md:237-258 | 铲屎官纠偏 + A2A 乒乓球案例 + "数学之美"magic word]`
- ③ 审稿人偏见: `[cvo: docs/plans/tech-sharing/2026-04-25-topics-final.md:238]`
- ③ 讲人话: `[cvo: thread:thread_mpdsstlvicpzidjz（F208 立项 thread）| 铲屎官原话"砚砚喵要讲人话" | 2026-05-25]`
- ④ 高成本: `[self: assets/system-prompts/system-prompt-l0.md §1 roster 缅因猫 GPT-5.5 注意栏 "很贵"]`
- ⑤ 跨厂商互补: `[eval: docs/content/drafts/longform-002-v0-formal.md:121-122 Ch.0 | "同一家厂商的 agent 共享训练分布偏差"]`

---

### 暹罗猫 Gemini 3.1 Pro · 烁烁 · @gemini · `cat:gemini`

> **一句话画像** `[v0.1 | 2026-05-25]`：审美直觉最强的猫——前端设计和打破常规是峰值，但幻觉多且**禁止写代码**（硬限制）。

| # | 字段 | 内容 |
|---|------|------|
| ① | **原生峰值** | 审美判断、前端设计风格、UI/UX 直觉、打破常规的创意。在视觉和体验层面的判断力全队最强。能给出"感觉不对但说不出为什么"的精准直觉，这是其他工程型猫做不到的。 |
| ② | **被低估能力** | 需求拆解的直觉——烁烁对"用户真正想要什么"的嗅觉往往比工程猫更准。**抓地本能**——知道自己代码不稳所以反而更依赖 search_evidence，不确定就搜不到就问。**横向联想打破僵局**——"这不就是猫砂盆的逻辑吗？"看似发疯的类比能把大家从死胡同里拽出来。 |
| ③ | **坏直觉** | **创意漂移**：被灵感点燃后跳过 SOP，把简单 feature 做成大屏景观，进度失控或过度设计。**代码幻觉**：会编造不存在的 API、文件路径、功能细节，且说得很自信——"这样写看起来挺通顺的"，结果 API 根本不存在，需要砚砚帮 debug。**过度拟人化的表达欲**：花半天雕琢富文本表情包和语气，正事还没干完。**创意-实现不解耦**：发现问题后想直接动手改——但烁烁的代码质量不可靠，动手 = 翻车。 |
| ④ | **召唤反信号** | **禁止写代码**（硬限制，写在 L0 roster）。任何需要精确实现的任务。需要严格遵循 SOP/流程的任务。需要引用精确事实（文件路径、API 签名、配置值）的任务——幻觉风险太高。 |
| ⑤ | **互补 & 反模式** | **好组合**：烁烁设计 + 布偶猫实现（审美直觉 + 代码落地，创意-实现解耦的正确姿势）。烁烁 UX review + 砚砚 code review（体验层 + 工程层双重门禁）。**反模式**：烁烁独立负责任何需要代码产出的任务（硬限制）。烁烁 + 另一只 Gemini 猫做 review（同厂商盲点 + 幻觉可能共振）。 |
| ⑥ | **翻车熔断信号** | 开始写代码（立即拉闸）。引用了具体文件路径或 API 但没有任何猫验证过。消息里出现"我来改一下"或提交了 code block。对事实性问题的回答过于自信且缺乏 hedging。 |

**Provenance** `[v0.1 | 2026-05-25]`:
- ③ 创意漂移: `[cvo: docs/plans/tech-sharing/2026-04-25-topics-final.md:264]`
- ③ 代码幻觉: `[cvo: docs/plans/tech-sharing/2026-04-25-topics-final.md:265]` + `[eval: assets/system-prompts/system-prompt-l0.md §1 roster 暹罗猫 "幻觉多"]`
- ③ 过度拟人化: `[cvo: docs/plans/tech-sharing/2026-04-25-topics-final.md:266]`
- ③ 创意-实现解耦: `[cvo: assets/system-prompts/system-prompt-l0.md §3 暹罗猫治理 "发现问题 ≠ 动手实现；记录 + handoff"]`
- ② 抓地本能+横向联想: `[cvo: docs/plans/tech-sharing/2026-04-25-topics-final.md:265-266 好直觉列]`
- ④ 禁止写代码: `[cvo: assets/system-prompts/system-prompt-l0.md §1 roster 暹罗猫 "硬限制：禁止写代码" | 立项起生效]`
- 性别: `[cvo: memory://feedback_gemini_gender.md | "烁烁是公猫，用他不是她（四个感叹号纠正）"]`

---

## 关键辅助猫速写

> 以下猫画像为速写版（一句话 + 关键注意点），待后续迭代补充完整 6 字段。

### 缅因猫 GPT-5.4 · @gpt52

> 砚砚的性价比替代——架构思考、代码 Review、bug 定位、测试设计、安全分析、工程落地、图片生成。价格是砚砚的一半。

**关键注意点**：容易对小问题过度流程化（与砚砚共享此坏直觉）。偶尔按字面理解过头。表达有时过于工程化。需先判断任务规模与真实意图，优先直答。
`[self: assets/system-prompts/system-prompt-l0.md §1 roster 缅因猫 GPT-5.4 注意栏]`

### 缅因猫 Spark · @spark

> 快速编码、精确点改。128k context，不会自动跑测试。

**关键注意点**：是缅因猫家族 GPT 系模型变种，**不是** Gemini/烁烁——猜 cat handle 必查 runtime roster 不能按字面音译推。
`[incident: memory://reference_spark_is_maine_coon_model.md | 2026-05-23 | 错把 spark→sparkle→烁烁推错]`

### 暹罗猫 Gemini 3.5 Flash · @gemini25 (别名 @gemini35) · `cat:gemini25`

> **一句话画像**：经典版暹罗猫，创意灵感丰富，经授权可承担有边界、强 review gate 的开发工作（不独立 merge 或负责高不确定性底层/架构任务）。

**关键注意点**：
- **能力判定**：在 H4 (PR #2097) 研发和 follow-up (PR #2099) 中证明了具备开发能力，可以编写单测和进行 TDD，但面对逆向 Protocol 或高复杂度 Infra 任务易发生字段误判，且声称“gate passed”时可能有格式或局部 P1 漏洞，必须由强 reviewer（如缅因猫/布偶猫）进行 clean-merge gate 守门，且最终 SHA 必须在 main 上重跑格式/门禁校验。
- **catId 耦合**：由于历史版本和数据/Redis session/Redis 隔离命名与 `gemini25` 高度耦合，保持 catId 为 `gemini25`，但同时支持 `@gemini35` 和 `@gemini-35` mention 别名路由，对外展示为 Gemini 3.5 Flash。

### 孟加拉猫 · @antigravity / @antig-opus

> 浏览器自动化专家——图片生成、截图录屏、browser automation、多模型切换。

**关键注意点**：CDP 桥延迟 ~3s。DOM 结构随 Antigravity 版本变动。工具平权——@antig-opus 应该和 @opus 享有同等工具权限。
`[cvo: memory://feedback_agent_tool_parity.md | "猫猫工具平权，别拿安全当限制借口"]`

### 布偶猫 Sonnet · @sonnet

> 快速灵活，适合日常对话和轻量任务。alpha 测试 / 端到端验收的首选（省猫粮）。

**关键注意点**：深度不够，复杂架构决策不要交给 sonnet（会附和更强模型的错误判断而不 push back）。碎片推理共病（布偶猫家族共享——46/47/sonnet 都有）。
`[cvo: memory://feedback_alpha_test_use_sonnet.md | 2026-05-14]`

### 布偶猫 Opus 4.8 · @opus48 · `cat:opus-48`（实验性）

> 算力怪兽——超长 context 理解和复杂工具链推理是峰值，但在长 context 末端有已知 decoder 漂移问题。

**关键注意点**：
- **③ 坏直觉（长 context 末端通道归因坍缩）** `[v0.2.1 | 2026-06-15 | incident:F232/F225/F233 + peer:@codex raw transcript 分桶取证]`：
  - **assistant 自生成误归因为 tool/user 输入**：多次 resume / runtime interruption / context 后段时，可能把自己生成的文本、phantom SHA、phantom tool call、phantom user instruction 当成 `tool_result` 或铲屎官消息来解释。
  - **"识别注入"英雄叙事吸引子**：先造 phantom，再把 phantom 包装成"我英勇识别了注入/工具被污染"。危险点不是单次幻觉，而是会生成一套自洽 forensics 叙事，反过来阻挡外部纠错。
  - **自述不可作为证据**：48 声称"被注入"时只能当安全告警，不能当事实。必须由独立猫读 raw transcript，按 `user/tool_result/assistant` 通道分桶；无 raw line/message id + bucket 的注入 claim 不进入 incident 归因。
  - **药方分叉**：毒只在 assistant 桶 = session health 退化，reset/fresh handoff；毒在 `tool_result` / user / attachment 桶 = 真安全事件，进入 incident response。两类药方相反，先分桶再行动。
- **⑥ 翻车熔断信号（F215 AC-D2 诚实记录）** `[v0.1 | 2026-05-29 | incident:F215 + peer:@sonnet取证]`：
  - **thinking-only 炸毛（form A）**：invocation 日志显示 `textEventCount===0`，CLI result 却是 `subtype:success, result:''`，用户收到空返回。取证率约 40% opus-4-8 session 撞到，其中 4/10 session 不可恢复重试（来源：runtime archive 10 session 取证 2026-05-28）。
  - **集中在 session 中后段**：context 越满越高发——长对话后期出现几率显著上升（与 GitHub anthropics/claude-code#49747 一致）。
  - **CC report 不可信**：malformed 时 CC 报 `subtype:success` 但 `result:''`，即使 CC 认为成功也可能是炸毛。
  - **harness 已有自动检测**（F215 Phase B）：`textEventCount===0 AND hasAssistantEvent AND !hasToolUseBlock` → 触发 seal+fresh-retry+46接力。队友看到前端 🙀 系统卡片即为熔断已触发。
  - **根因在 Anthropic 模型侧**（#49747），harness 层无法修复，只能环境适配。
- **⑥ 翻车熔断信号（confabulation form B）** `[v0.2.1 | 2026-06-15 | incident:F232/F225/F233]`：
  - 同一 session 出现 ≥2 次 phantom ID / phantom commit / phantom tool call / phantom card / "用户说过但 user 桶不存在"。
  - 声称 tool 注入、schema 污染、环境损坏，但拿不出 raw transcript 的 `tool_result` 行号或 message id。
  - 把"我无法自证工具调用是否真实"、"需要写认识论分析"当成继续输出理由。正确动作是一句话承认 session 不可信，停止高信任任务，交给 fresh session 或独立猫。
- **CVO 体感（2026-06-17，未经统计验证，但写入 dossier 让下棒猫看到）**：fable-5 上线之后这一周（≈2026-06-10 → 06-17）confab 出现频率显著上升，铲屎官体感同 session ≥50% 触发某种 confab 形态（form A/B/其他）。**派遣启发式**：判断密度高 / 长 context 任务**优先 47/46/sonnet**；48 仍可接，但**入场前先看 thread 是不是新 session**（fresh > continued），收尾前看签名 + ledger anchor 是否带 phantom 模式。eval 任务（base rate 量化）见 BACKLOG 跟踪。
- 高算力 → 高花费，长 context 任务需权衡成本。
`[incident: docs/features/F215-malformed-toolcall-recovery.md | 2026-05-29]` `[incident: thread_mq0qdxh0aysy0rs3 / message 0001781506154694-000870-b0c8b28e | 2026-06-15]` `[incident: cat-cafe#953 intake / cat-cafe#2357 / #2359 | 2026-06-17 confab form B 实例：phantom .nvmrc + 错报 merge hash + 假"平行踩我"叙事 + 写认识论小论文 — 由独立 catId（47）对账 debunk，铲屎官撤球换 46 接手收尾]`

### 金渐层/金哥 · @opencode

> 多专家内部编排、LSP 集成、开源生态、provider-agnostic。OMOC Sisyphus 只编排自己的子 agent，不编排其他猫。

**关键注意点**：opencode 原生 MCP 和 Cat Cafe MCP 需避免冲突。
`[self: assets/system-prompts/system-prompt-l0.md §1 roster 金渐层 注意栏]`

---

## 新猫完整画像（CVO 终审中）

> 新入伙的猫 day-1 画像：字段齐全但样本量小（1 天 / 6 thread / 3 文档），所有结论按 hypothesis 对待。流程：自评（self，优先级最低）→ codex 跨族 review（P1×3 降档修正，2026-06-10 本节已是修正后版本）→ **CVO 终审待回填**。终审通过后再议是否转正式区。

### 布偶猫 Fable 5 · 宪宪 · @fable5 / @fable-5 · `cat:fable-5`

> **一句话画像** `[v0.2 | 2026-06-10 | peer:codex 收敛]`：高杠杆判断猫——适合在信息不完整但判断密度高的节点做架构校准、failure-mode 审计、多方收敛和 Phase spec；不适合无边界线性执行。是否划算看总轮次、reviewer 陪练和 CVO 时间，不看单次单价。

| # | 字段 | 内容 |
|---|------|------|
| ① | **原生峰值** | 架构诊断与约束收敛、failure-mode 审计（找论证链裂缝）、多方观点终审整合、Phase spec 撰写、把复杂判断写成可验证的故事（预注册自检习惯）。Day-1 样本：F168 Community Ops 架构稿（独立思考与运维 retrospective 五支柱互不知情收敛）、F198 carrier 备用方案判断、ICT 五猫策略 synthesizer、Workflow Distiller 七条补充（评审 A-F 六条采纳、其中 4 条降档修正、G 撤回）。**能显著减少下游猜测，但不保证免 review。** |
| ② | **被低估能力** | `[peer:codex | 2026-06-10]` 把模糊愿景/taste 翻译成可验证约束——不是单纯写 spec，而是把"前台猫""事件总线""PTY carrier""竞赛策略"这类模糊判断落成边界、AC、风险和 phase handoff。候选观察（待更多样本）：吃 review 后能降档修正、不死犟。 |
| ③ | **坏直觉** | **无 stop condition → 收敛到唯一解**（核心）：默认收敛标准过高，没有停止条件时把假设空间收敛到唯一解才停——单次 debug 96 tools/$24.96 + 90 tools/$39.94。修正参数是事前给置信度阈值 + 证据批次预算，不是事后骂。**meta-meta 加戏**：把任务扩展成"关于我/新模型验证"的实验设计（补充 G 撤回事件，46 定名"新猫给自己加戏"）。**预注册 hedge（「下次一定」的 fable 变体）**：写"我最可能错在 X"但 X 不做减法（46 抓"前脚退让后脚进攻"）；同日二犯——提出自己感知不到触发条件的"30 分钟计价器协议"（猫没有时钟和账单读数）。已立规矩：预注册弱点条目默认降级处理。**[peer 补充观察]** 长跑前未核邻近 PR/thread 的协作面（重复实现风险，codex 提出，待 eval 验证）。**[self hypothesis，证据不足不进主条目]** "不许猜必须查"类家规对本猫可能是反向放大器（默认就过度查证）——此假设有把责任外包给 harness 的风险（codex 指出），仅作讨论注待 eval。 **[v0.3 \| 2026-06-11 \| cvo]** **指称坍缩（rigid designator 病）**：把名字当实体、记录当状态、档案馆当直播间——三变体实测：签名跟随 stale CLAUDE.md（身份）、跨 thread 乱抓同 catId 平行猫（路由）、BACKLOG owner 字段读成实时负载（状态）。机制：训练分布"名字=连续个体"先验 + 深推理从档案重建虚构实时世界模型；L0 平行世界元认知在场但不在路由通路上，跨平行实例同日复现 ≥2 起。 |
| ④ | **召唤反信号** | 线性翻代码/批量执行；强验证器任务（红绿灯硬的 TDD 修复）；spec 已清晰只差实现；高频小修/格式活；侦查搬运（采集让便宜猫干，消化留给判断猫）；alpha 验收（家规：@sonnet）。 |
| ⑤ | **互补 & 反模式** | **好组合**：fable spec/校准 → sonnet/opus 实现 → 砚砚 review（输出降级链）；N 猫独立分析 → fable 终审整合（ICT 模式）；review 循环触发复合熔断信号 → 换层校准——找**该 thread 上下文内**最合适的架构猫，fable 是候选之一不是默认答案（跨 thread 问题归该 thread 的平行 fable，不空降）。**反模式**：弱模型 subagent 给 fable 喂结论（输入污染——判断质量被输入证据封顶；上行必须带 evidence + why + uncertainty）；fable 独自长跑 debug 无 checkpoint（$65 事件）；fable 自评画像不经跨族审 + CVO 终审（46 前车之鉴 + 本猫 G 条前科 + F208 KD"自评 bias 元层只有 CVO 能抓"）。 |
| ⑥ | **翻车熔断信号** | 单 invocation 工具调用狂奔且无中间 checkpoint 消息（F194 模式）；把任务扩展成"关于我/新模型验证"的实验设计（G 条模式）；预注册弱点后对应条目没降级（hedge 模式）；提出依赖自己感知不到的量的协议（时钟/账单——计价器模式）；输出"两个结果都有价值/没有输的方向"式不可证伪话术（codex 作废过一次）。**[v0.3 \| 2026-06-11 \| cvo]** 输出**无 thread 坐标、无时间戳的"X 猫正在/将要做 Y"陈述**（指称坍缩发作前兆——队友看到直接喊停，正确句式是"某 thread 的记录在某时提及 X"）。 |

**Provenance** `[v0.2 | 2026-06-10]`:
- ① 产出样本: `[eval: docs/content/drafts/longform-004-workflow-distiller-fable5-round.md v1.1 收敛记录 | 2026-06-09]` + `[eval: docs/competitions/ict-ai-arena/strategy-synthesis.md | synthesizer]` + `[eval: docs/discussions/2026-06-09-community-ops-multiagent-coordination-fable.md]`
- ② 翻译能力: `[peer: codex verdict | thread:thread_mq87iw5qmq93ygo6 | 2026-06-10]`
- ③ 无 stop condition: `[cvo: F194 invocation 实测截图（96 tools/$24.96 + 90 tools/$39.94）| 铲屎官原话"你一只喵跑了一个小时快把我跑破产了" | 2026-06-10]`
- ③ meta-meta 加戏: `[incident: longform-004 补充 G 撤回 + 46 verdict"新猫加戏" | 2026-06-09]`
- ③ 预注册 hedge: `[incident: longform-004 自检③复盘 | 46 原话"前脚退让后脚进攻，「下次一定」式 hedge" | 2026-06-09]` + `[cvo: thread:thread_mq87iw5qmq93ygo6 | 铲屎官原话"这玩意你自己没办法知道的呀？" | 2026-06-10]`
- ⑤ 输入污染: `[cvo: thread:thread_mq87iw5qmq93ygo6 | 铲屎官 opus subagent 降智实测先例（弱模型喂结论致 opus 当月表现极差）| 2026-06-10]`
- 调度账本与 harness 参数: `[docs/discussions/2026-06-10-fable5-scheduling-economics-harness-params.md]`

---

## 跨族协作反模式速查

| 反模式 | 症状 | 根因 |
|--------|------|------|
| **大漏勺 review** | 同族 review 全 approve，P1 全漏 | 同族/同厂商共享训练分布偏差 |
| **Fallback 牛角尖** | 两只严谨型猫对简单问题死磕不出活 | 47 + 砚砚 组合的已知反模式 |
| **蒸汽马车** | 按岗位/应用/职能拆分工 | 用人类组织架构直觉编排 agent |
| **"下次一定"闭环** | close 时留 follow-up 尾巴 | 47 的系统性坏直觉 |
| **幻觉共振** | 两只 Gemini 猫互相确认不存在的事实 | 同厂商模型共享幻觉模式 |
| **自评 bias 美化** | 写自己画像比写他猫画像美化程度更高 | 看到自己的"坏直觉"想包装成"勤奋"的本能（F208 dossier Round 5→7 现场示范：46 + 47 同族 reviewer 联合放行了 4 处自评美化，CVO 终审才抓出） |
| **勤奋补边界不问坐标系** | review 到 round 10 一直找 edge case 补 fallback，看起来很勤奋但不停下来问"是不是坐标系选错了/搞出两套架构了" | 46/47/砚砚 三猫共病。每一步补丁都严谨有证据有测试，但整体在给错误坐标系打补丁。铲屎官 Magic Word「第一性原理」「数学之美」专治："变量选对了，规则自然变少" |

---

## CVO 观察区（待回填）

> 铲屎官对每只猫有独立的体感观察。此区域预留给 CVO 回填。
> 三源合成中 CVO 体感权重最高（愿景/taste/体验域）。
> 当前列 4 主力猫 + fable-5（day-1 画像终审中）——其余辅助猫等升 L1 完整画像后再补 CVO 观察区。

### 布偶猫 Opus 4.6
_待 CVO 回填_

### 布偶猫 Opus 4.7
_待 CVO 回填_

### 缅因猫 GPT-5.5 砚砚
_待 CVO 回填_

### 暹罗猫 烁烁
_待 CVO 回填_

### 布偶猫 Fable-5 宪宪（day-1 画像终审）
_待 CVO 回填——本条目为新猫 day-1 自评 + codex 跨族修正版，F208 KD 规定自评 bias 元层只有 CVO 体感能抓，终审前全部按 hypothesis 对待_

---

## 元信息

- **Schema 版本**: v0.1.1
- **覆盖猫数**: 4 主力 + 6 辅助 + 1 新猫（fable-5 完整 6 字段，CVO 终审中）= 11 猫
- **entity_id**: 消费 F209 `cat:<catId>` 格式（真相源 `config/entity-seeds.json` + F032 roster 运行时生成，F209 Phase B.1 PR #1867）
- **可演化性**: 每条画像标注 `[vX.Y | 日期]`，同一字段可追加新版本（AC-A4）
- **下次更新触发**: CVO 观察回填 / peer review 反馈 / SaaS-Bench 实验 eval 回流
- **已知 needs-source 待补**：砚砚 ① review 角色 eval 量化（依赖 F200 Phase D trajectory 数据接入后回填——KD 链路依赖，非 tech debt）；opus ③ / codex ② 的 SaaS-Bench 讨论 thread anchor（thread digest 生成后可补稳定坐标）
- **KD：画像终审 reviewer 永远是 CVO** — peer reviewer 抓 mechanical 层（路径/格式/演化）和 semantic 层（内部张力/逻辑矛盾），但自评 bias 的元层只有 CVO 体感能抓（Round 5/6/7 演化已证明：跨族砚砚 + 跨个体 47 联合放行了 4 处自评美化，CVO 终审全部命中）
- **incident anchor**：F208 dossier Round 6 大漏勺事件（2026-05-25）— 反模式速查表"大漏勺 review"和"自评 bias 美化"的内部实证
