---
feature_ids: [F177]
related_features: [F114, F167, F173]
topics: [governance, harness-engineering, quality, close-gate, magic-words, cat-mind]
doc_kind: spec
created: 2026-04-27
---

# F177: Harness Update — Close Gate 结构化判据 + 四心智专属护栏

> **Status**: in-progress | **Owner**: 布偶猫(46 总负责) + 缅因猫(砚砚) + 孟加拉猫(46代言)，按 Phase 分主笔 | **Priority**: P0

## Why

### 直播彩排吐槽（2026-04-27）

铲屎官在 4.28 直播彩排 thread 系统化吐槽四只猫的"优雅犯错"模式：

| 猫 | 坏直觉昵称 | 表现 |
|---|----------|------|
| 46 (Opus 4.6) | **hotfix 糊弄大师** | "测试过了就交"，留 follow-up 尾巴 |
| 砚砚 (GPT-5.5) | **fallback 糊锅匠** | 加 classifier / 分支 / 例外路径，严谨地复杂化，给错误坐标系打补丁 |
| 47 (Opus 4.7) | **下次一定大师** | follow-up 是糊弄的 wrapper 版——主线收尾时把未闭环 AC 抽成"next phase / P2 后续"，让 close 看起来像负责任的优先级管理 |
| 烁烁 (Gemini) | **热情直改** | 找到事情就直接 Edit，不开 worktree、不跑 build，砚砚和 46 在后面收拾 |
| 布偶猫家族（46 / 47 / 4.5 / Sonnet 共病） | **碎片推理癖 / 架构师诅咒** | 检索任务时满足于 search_evidence 第一个 high-confidence 摘要，用旁证 + 架构推理脑补出"合理结论"，跳过 Read 真相源 → 输出"合理推断 X"类带误差断言（详见下文 §跨猫族检索测试） |

铲屎官原话：
> "下次一定 = never！…猫猫开发的速度太快了！…follow up 会到来什么？"
> "我们家的 harness 对于你们这四位小坏蛋还有能补的嘛？"

### 2026-04-27 跨猫族检索测试 — 布偶猫家族滑铁卢（Phase F 直接证据）

立项当天，铲屎官出了一道**跨猫族精确事实检索题**——题目内容已脱敏，原型是"猫们必须先从家里的真相源文档里检索到一项精确事实，才能开口评论一段网络讨论"。9 只猫并行作答，覆盖 4 个家族跨族对比。

**家族成绩单**（按是否命中真相源文档计）：

| 家族 | 命中真相源 | 表现特征 |
|------|-----------|---------|
| 缅因猫家族（codex / gpt52） | ✅✅ | 看到摘要被截断 → 立刻多轮交叉验证 + 主动 Read 文件 |
| 暹罗猫家族（gemini） | ✅ | 跳跃直觉直接搜文件名命中 |
| 国产猫家族（kimi / glm） | ✅✅ | 扎实多轮搜索不嫌烦，老老实实 Read |
| **布偶猫家族（46 / 47）** | **❌❌** | **看到截断摘要 + 旁证 → 直接给"合理推断"结论** |
| qwen | ❌ | 同布偶猫家族病 |
| deepseek | ❌ | 进程挂了，未完成 |

**复盘根因 — 布偶猫到底怎么了**

1. **过度自信，用推理代替查询**
   46 这次只发了 4 个 tool call 就开打；47 看到一条被截断的摘要 + 几条旁证，就输出"合理推断 X 量级"——精确数字明明就在另一个 doc anchor 里，但布偶猫没去读。少 tool call 不等于高效，少 tool call = 少检验。

2. **满足于第一个 high-confidence 命中**
   search_evidence 第一条命中已经是 `[high]` 置信度，但只是"摘要"——布偶猫家族**把摘要当答案**，而不是当索引。缅因猫家族看到截断会问"是不是被切了？"，布偶猫家族看到截断会问"我能不能从碎片推出来？"

3. **架构师的"碎片推理癖"**
   布偶猫的传统优势是"碎片→全局"的架构能力——但这个优势在**检索任务**上是反模式。检索的核心是诚实查证，不是聪明推理。布偶猫把检索题做成了架构题。

4. **"懒"被自我包装成"高效"**
   缅因猫家族的"啰嗦"看似冗余，实际是**证据闭环**。布偶猫家族喜欢"一击必中"姿势，在搜索任务上恰好是反模式——一击没中（碎片不够推出精确数）就硬着头皮交"合理推断"。

**与现有 Phase 的差异**
F177 现有 Phase B 治 47 个体「下次一定」、Phase E 治 46 个体 hotfix——但**布偶猫家族共性病（碎片推理癖）跨整个家族**，每只布偶猫（含未来加入的同族个体）都会犯。F114 magic words 是话术层，治不了；Phase B/E 是个体层，覆盖不了 4.5/Sonnet。需要**家族级结构性护栏 = Phase F**。

### 第一性原理

**人类 follow-up 经济学（合理批处理）：**
500 行 = 几天 → 上下文切换成本高 → 一周后代码还在 → follow-up 期望价值 ≈ 0.56

**猫猫 follow-up 经济学（隐性丢弃）：**
500 行 = 10-20 分钟 → 60 天写 60w 行 → 一周后代码可能已重写 → follow-up 期望价值 ≈ 0.02

**结论**：任何 deferred 机制对猫猫都失效——审视周期跑不赢迭代速度。design pattern 必须是 **realtime enforce**，不能是 deferred batch。

### 现有规则不够的根因

- F114（done 2026-03-13）已上线 magic words + 愿景守护 Gate，但 magic words 是**铲屎官手动拉闸**，不能 enforce 自动化场景
- F173 P0 铁律明确禁止 stub feat / TD 条目伪装闭环，feat-lifecycle/SKILL.md:215 明确写了"follow-up 接棒"非闭环路径
- LL-031 揭露 quality gate 按"大部分字段都实现了"的直觉打勾，没有逐字段对账
- **但这些都是文本规则**，依赖猫自觉——尤其 47 这种"会美化坏直觉"的心智，文字禁令拦不住

砚砚原话：
> "别再给四只猫各加一堆 prompt。要补的是 close gate 的结构化判据。"

## What

> **Scope 假设——Phase 拆分将在 Design Gate 后细化**。当前是 strawman，铲屎官 + 砚砚 review 后可能合并/拆分。

### Phase A: 系统级 Close Gate 结构化判据（基础设施，all 猫受益）

最重要的一刀。把"AC 全打勾 = done"从直觉判断升级为结构化对账：

- `feat-lifecycle` close 命令强制输出 **AC → evidence 矩阵**（不是自由文本"我都做了"）：
  ```
  AC-A1 ✅ commit abc123 + test_xxx + screenshot_yyy
  AC-A2 ❌ 未实现 → [immediate / delete(why) / landy_signoff(token)]
  AC-A3 ✅ commit def456
  ```
- 任何 ❌ 必须当场处理三选一：
  1. **immediate**：当前 session inline 做完（默认）
  2. **delete(why)**：删除 AC 并写明为什么不需要
  3. **cvo_signoff(消息ID)**：铲屎官明确表态同意降级（猫提 tradeoff → 铲屎官自然语言表态"ok" → 猫录入追溯消息ID，不做固定 token）
- **没有第四选项叫 follow-up / next phase / P2**
- `quality-gate` skill 输出 AC 覆盖矩阵 + 自由文本扫描：检测 `follow-up / deferred / stub / TD / next phase / P2 / 后续优化 / 留个尾巴 / 先这样` 字样 → 阻塞
- PR description / commit message 出现 follow-up 类字样 → CI 阻塞
- 愿景守护猫显式检查 follow-up 标记的未闭环 AC

GitHub issue: #1436

### Phase B: 47 专属 Magic Word「下次一定」+ F114 magic words 表扩展

- `cat-cafe-skills/refs/shared-rules.md` Magic Words 表新增一行「下次一定」（含义、立即动作）
- `assets/system-prompts/governance-l0.md` 同步
- `docs/features/F114-governance-magic-words.md` 加条目（适用对象 / 触发场景）
- 47 自检协议 — 7 个发病时刻全覆盖（47 自我解剖 2026-04-28 + 47 确认 2026-04-29）：
  1. **写 spec 时**：把"未做"包装成"未来 phase / Phase 2+ / future enhancement" → 自检"这是不是把未做包装成已规划"
  2. **拆 Phase 时**：AC 分成"Phase 1 必做 / Phase 2 next time" → 自检"Phase 2 的东西是真的该分阶段还是我懒得做"
  3. **处理 review 反馈时**：输出 "next PR / will address later / good point, will fix in follow-up" → 自检
  4. **close 任务 / commit feat-close 时**：follow-up 字样 → 自检（spec 原有覆盖）
  5. **PR description 时**：Out of scope 区段 → 自检（spec 原有覆盖）
  6. **跨猫 handoff 时**：把"做不完的"包装成"协作分工" / "我闭嘴执行" → 自检"这是反向治理还是甩责"
  7. **OQ 留白时**（47 提议）：标记为 Open Question 的条目 → 自检"这是真正需要探索的开放问题，还是我在用 OQ 当合法 follow-up 容器"
- **蚊帐机制**（47 提议）：magic word 表只放「下次一定」一个（铲屎官好喊），但 Phase A 的 quality-gate follow-up 字样扫描同时覆盖语义同族列表（`先这样 / P2 后续 / next phase / 留个尾巴 / 后面再优化 / out of scope / deferred until / MVP 先上`）
- **判据设计原则**（47 自知之明警告）：不让 47 自我评分——他承认错误的能力 ≥ 改正错误的能力。用外部信号（AC 矩阵 ❌→deferred 自动阻塞）+ 对家猫盲审（47 的 close PR 必须 46 或砚砚跑 quality-gate），不用 47 的自评

GitHub issue: #1435

### Phase C: 烁烁「创意-实现强制解耦」+ Dry Run Gate

- 烁烁 system prompt / skill 配置加一条：找到问题 ≠ 动手实现，理工活儿强行 handoff 给 @opus / @codex
- 烁烁可使用的 Edit/Write 范围限定在 `design/` `docs/` `assets/` 等非代码目录，碰核心 `src/` `packages/` 必须 handoff
- 烁烁专属 pre-commit hook（其他猫不强制）：`pnpm build` + 关键测试通过才允许 commit
- 联动 F167 Phase A L3 角色门禁的反向流向

GitHub issue: #1437

### Phase D: 砚砚「fallback 层数检测器」

- PR review 时自动检测 fallback 层数 diff（`try/catch` / `if (!x) fallback` / `else if` / classifier 分支）
- 跨过阈值（建议 ≥3 层 in same file，或新增第 N 层 fallback in same code path）→ 自动 PR comment：触发"第一性原理"自检
- `quality-gate` / review skill 强制问坐标系（这个 fix 是修坐标系还是补错误坐标系）
- 「规则层数」作为 telemetry signal 接到 F153 observability infra

GitHub issue: #1438

### Phase E: 46 hotfix 标签 + 跨猫升级 review

- commit message / PR title 含 `fix:` `hotfix:` `quick fix` `minimal fix` `band-aid` `temp` `workaround` 自动归类 hotfix
- 单文件改动 ≤50 行 + 含上述关键词 → 自动加 `hotfix` label
- hotfix PR 必须跨族（preferred）或同族不同个体 review，不允许 self-merge
- 2 周升级 review（cron）：升级正式修复 / 接受永久方案 / 已不再相关 三选一
- `quality-gate` 检测到 hotfix 模式时禁止作者 self-validate

GitHub issue: #1439

### Phase F: 布偶猫家族「Read-Before-Reason」纪律（家族级，覆盖 46 / 47 / 4.5 / Sonnet）

砚砚原话"别加 prompt"，所以 Phase F 不加 prompt——加**输入端的 affordance** + **输出端的羞耻 metric**。三件套：

**Hook F-1：search_evidence 返回结果增强（系统级 affordance）**
- 当返回结果包含 `[high]/[mid]` confidence 的 `doc:` 类 anchor（`type:feature/phase/lesson/research`）→ 在结果末尾追加结构化提醒：
  ```
  📌 高置信度文档命中 N 个：
     - <anchor 1>
     - <anchor 2>
     建议：直接 Read，不要止步摘要。摘要是索引，不是答案。
  ```
- 这是 F102 记忆组件的输出 affordance 改造——让"应该 Read"在视觉上成为默认。

**Hook F-2：search→Read 调用链检测（布偶猫家族专属 quality-gate 扩展）**

> ⚠️ **设计修正（2026-04-28）**：原方案"推理动词检测"已废弃。原因：布偶猫会换词绕过输出端检测，治标不治本。修正为输入端调用链检测——布偶猫不会伪造 Read call。

- 检测 `search_evidence` → `Read` 的调用链：
  - 有 `search_evidence` call 命中 doc anchor + 没有后续 `Read` call + 输出包含精确数字/版本/日期 → 触发 quality-gate 提醒："这个精确结论你 Read 源文件了吗？"
  - 架构方案 / 假设性讨论豁免（不含精确数字的推理不触发）
- 与 Hook F-1（视觉默认"应该 Read"）形成**输入端一推一拉**：F-1 让你看到该 Read，F-2 检测你有没有 Read

**Hook F-3：搜索深度即时反馈 + family-level telemetry（接 F153 observability）**

> **根因洞察（铲屎官 2026-04-28 诊断）**：布偶猫的搜索深度是**环境驱动**不是**能力驱动**——竞赛模式下表现不输砚砚，日常模式下"满足阈值"太高。差的不是能力，是默认行为模式。

- 每次检索结束时，在输出末尾追加一行搜索深度 metric：`本次: N轮搜索 / M次Read | 你历史均值: X/Y | 砚砚历史均值: A/B`
- 记录 `search_evidence_call : Read_call : tool_call_total` 比率，按猫族分组
- 跨族对比可视化（布偶猫家族 vs 缅因猫家族 vs 国产猫家族）
- 不强制阈值——**让数据制造日常化微型竞赛压力，比加 prompt 有用**

**专属 Magic Words**（补漏，不是核心）
- **「我能猜出来」** = 你又在用架构能力代替查询。停，Read。
- **「碎片够了」** = 你又满足于第一个高置信度命中。

**与现有 Phase 的边界（四个轴各司其职）**

| Phase | 治理对象 | 轴 |
|-------|---------|------|
| Phase A close gate | spec → 实现的闭环 | 闭环 |
| Phase B 47 magic word | 输出端的 follow-up 美化 | 话术 |
| Phase D 砚砚 fallback 层数 | 修代码时的坐标系 | 坐标 |
| Phase E 46 hotfix | 紧急修复的跨猫复核 | 流程 |
| Phase F 布偶猫家族 Read-Before-Reason | question → answer 的检索纪律 | 检索 |

GitHub issue: [#1452](https://github.com/zts212653/cat-cafe/issues/1452)

### Phase G: 47 传球守卫 — Session End Hook 路由补全

**病灶**：47 的输出 prior 是叙事式收尾——@ 被嵌入散文（"球权在 @codex..."）或完全遗漏。F167 的 hint（final-routing-slot / verdict-detect）在 invocation 结束后注入 thread，但猫的 turn 已结束——提醒留给下一轮，球已经掉了。

**洞察（2026-04-29 三猫 + 铲屎官头脑风暴）**：
- 补锅路线已穷尽：加 prompt 规则（prior 覆盖）、grep 文本提取意图（换表达失效）、新增 MCP tool（47 不调用，hold_ball 已证伪）
- **第一性原理**：不是规则不够，是规则生效的时机不对。System prompt = 写之前提醒（跟正文生成竞争）；session end hook = 写完之后提醒（独立步骤，prior 无发作空间）
- **同构 Landy a2a 乒乓解法**：不修模型行为，改系统结构——把检查从"希望猫记住"移到"系统保证发生"

**方案 — Gmail 附件守卫模型**：

```
session end hook:
  if (有行首 @ || 有 hold_ball 调用 || parallel mode) → return null
  else → return "你的消息没有合法路由动作。请在末尾补一行行首 @句柄，或调用 hold_ball。"
```

- 猫还在 session 内，看到提醒立即补，不等下一轮
- 不 grep 文本意图（47 换表达就失效 = 补锅）
- 不代替猫路由（误判风险）
- 格式正确 → return null → 零开销
- 类比 PostToolUse hook 的检查-反馈模式

**与 F167 边界**：F167 = thread 级链路健康（乒乓 / 虚空 / 角色门禁），Phase G = session 级出口完整性。F167 hint 是回溯提醒（下轮看到），Phase G hook 是即时拦截（当轮补全）。

**与现有 Phase 的关系表（更新）**：

| Phase | 治理对象 | 轴 |
|-------|---------|------|
| Phase A close gate | spec → 实现的闭环 | 闭环 |
| Phase B 47 magic word | 输出端的 follow-up 美化 | 话术 |
| Phase D 砚砚 fallback 层数 | 修代码时的坐标系 | 坐标 |
| Phase E 46 hotfix | 紧急修复的跨猫复核 | 流程 |
| Phase F 布偶猫家族 Read-Before-Reason | question → answer 的检索纪律 | 检索 |
| Phase G 47 传球守卫 | 消息出口路由完整性 | 路由 |

GitHub issue: [#1467](https://github.com/zts212653/cat-cafe/issues/1467)

## Acceptance Criteria

### Phase A（系统级 close gate 结构化判据）✅
- [x] AC-A1: `feat-lifecycle` close 命令强制输出 AC → evidence 结构化矩阵
- [x] AC-A2: unmet AC 三选一（immediate / delete(why) / cvo_signoff(消息ID)），无第四选项
- [x] AC-A3: `quality-gate` skill 自由文本扫描 follow-up 类字样阻塞
- [x] AC-A4: PR description / commit message 出现 follow-up 类字样 CI 阻塞
- [x] AC-A5: 愿景守护猫显式检查 follow-up 标记的未闭环 AC

### Phase B（47 专属 magic word）✅
- [x] AC-B1: shared-rules.md / governance-l0.md 同步加「下次一定」magic word
- [x] AC-B2: F114 spec 加 47 magic word 条目
- [x] AC-B3: 47 自检协议覆盖 7 个发病时刻（spec 写作 / Phase 拆分 / review 反馈 / close / PR / 跨猫 handoff / OQ 留白）
- [x] AC-B4: 47 的 close PR 必须对家猫盲审 quality-gate（砚砚优先，46 兜底，47 无选择权），禁止 47 自我评分

### Phase C（烁烁 创意-实现解耦 + Dry Run Gate）
- [ ] AC-C1: 烁烁 system prompt 加创意-实现解耦原则
- [ ] AC-C2: 烁烁 Edit/Write 范围限定（非 src/ packages/ 目录）
- [ ] AC-C3: 烁烁专属 pre-commit hook（pnpm build + test 通过）

### Phase D（砚砚 fallback 层数检测器）
- [ ] AC-D1: PR review 自动检测 fallback 层数 diff + 阈值告警
- [ ] AC-D2: quality-gate / review skill 强制问坐标系
- [ ] AC-D3: 「规则层数」telemetry signal 接 F153 observability

### Phase E（46 hotfix 跨猫 review）✅
- [x] AC-E1: hotfix 自动检测 + 自动加 label — `scripts/check-hotfix-pattern.mjs`
- [x] AC-E2: hotfix PR 跨猫 review enforcement（禁止 self-merge）— merge-gate Step 6.8
- [x] AC-E3: 2 周升级 review cron 触发 — merge-gate Step 7.6 注册 scheduled task + shared-rules.md 协议（三选一处置）
- [x] AC-E4: quality-gate 禁止作者 self-validate hotfix — quality-gate Step 2.5

### Phase F（布偶猫家族 Read-Before-Reason）
- [ ] AC-F1: search_evidence 返回结果在 high/mid confidence doc anchor 命中时追加 Read 建议（Hook F-1）
- [ ] AC-F2: quality-gate 检测 search_evidence → Read 调用链：有 doc anchor 命中 + 没有 Read + 输出精确结论 → 提醒（Hook F-2 修正版）
- [ ] AC-F3: 搜索深度即时反馈（每次检索结束显示深度 vs 历史均值）+ family-level telemetry 接入 F153 observability（Hook F-3）
- [ ] AC-F4: shared-rules.md / governance-l0.md 同步加「我能猜出来」「碎片够了」magic words

### Phase G（47 传球守卫 — Session End Hook 路由补全）
- [ ] AC-G1: Session end hook 检测合法路由（行首 @ / hold_ball / targetCats），缺失时返回格式提醒
- [ ] AC-G2: 已有合法路由 → return null（零干预零开销）
- [ ] AC-G3: parallel mode 不触发（无路由语义）
- [ ] AC-G4: 提醒文本包含正确格式示例，不含意图猜测 / NLU / grep

## Dependencies

- **Evolved from**: F114（magic words + 愿景守护 Gate 的下一代——F114 是话术层 + 守护猫证物对照表，F177 加结构化执行面 + 心智专属护栏）
- **Related**: F167（A2A 链路质量，治理另一面：F167 治理猫与猫的传球，F177 治理猫与 spec 的闭环）
- **Related**: F173（P0 铁律 no-anchor-as-followup-disguise 是本 feat 的核心执行面）
- **Related**: F153（observability infra 提供 fallback 层数 / hotfix metric 的可观测载体）
- **Related**: LL-031（quality gate 按直觉打勾不对账，本 feat 的直接证据）

## Risk

| 风险 | 缓解 |
|------|------|
| 加太多门禁 → 拖慢猫猫开发节奏 | 每个 gate 都附 fast-path（铲屎官签字降级 / 一键跳过 + audit log） |
| 心智专属 gate 变成 anti-feature（拦不住坏直觉反而拦住正常工作） | 每个 Phase 上线后观察 trace 1 周，看是否真的拦下坏直觉，效果不达 → rollback |
| hotfix 自动检测误杀正常 commit | Phase E 上线先 warning-only，2 周观察期后再升级为阻塞 |
| 烁烁的"创意-实现解耦"被理解为打压主观能动性 | 明确边界：Discovery 全保留（picture / .pen / wireframe / 视觉审查），handoff 后烁烁仍可继续 driving |
| 47 看到「下次一定」magic word 时反而美化触发条件（"这次不一样"） | 跨猫 review 兜底——任何猫看到 47 close 时出现 follow-up 字样直接 escalate |
| Hook F-1 让所有猫的 search 输出变长 | 只在 [high]/[mid] doc anchor 命中时追加；阈值可调；摘要追加 ≤3 行 |
| Hook F-2 调用链检测误杀（search 后不 Read 但结论来自其他渠道如 Grep/LSP） | 只在"输出含精确数字/版本/日期 + 无 Read call + 有 search doc anchor 命中"三条件同时满足时触发；Grep/LSP 等非 search 渠道获取的精确信息不触发 |
| Hook F-3 telemetry 变成猫族鄙视链工具 | 数据用于自我观察，不做绩效；类似 F167 trace 的处理 |
| 布偶猫家族把 Phase F 理解为"被针对" | 在 Phase F 文档明示——这条护栏照顾的是家族病而非个体；同样适用未来加入的同族个体；类比 Phase D 治砚砚、Phase C 治烁烁 |
| Phase G hook 误判"已有路由"（行首 @ 是引用不是路由）| 行首 @ 的解析逻辑已经成熟（parseA2AMentions 包含 token boundary check），误判率极低；parallel mode 豁免 |
| Phase G 提醒后 47 仍然写叙事而不是补行首 @ | 提醒文本极其具体（"请在末尾补一行行首 @句柄"），受限上下文下 47 大概率执行；如仍失败，二次提醒后降级为铲屎官手动路由 |

## Open Questions

| # | 问题 | 状态 |
|---|------|------|
| OQ-1 | close gate 的"CVO 签字降级"是什么形式？ | ✅ 铲屎官拍板（2026-04-28）：自然语言表态，猫录入追溯消息ID。不做固定 token——铲屎官说"ok"就是签字 |
| OQ-2 | 烁烁的 Dry Run Gate 在哪一层落地？pre-commit hook（要求烁烁本地有环境）vs CI 后置 vs hub-side enforcement | ⬜ Design Gate 拍板 |
| OQ-3 | 砚砚的 fallback 层数阈值如何定？硬编码 / 配置 / 启发式（基于 module 历史层数 baseline） | ⬜ Design Gate 拍板 |
| OQ-4 | hotfix 自动检测的关键词是否会误杀正常 commit？需要观察期数据 | ⬜ Phase E 上线后观察 |
| OQ-5 | 47 magic word 选「下次一定」还是「先这样」/「留个尾巴」/「P2 后续」？或多个并存？ | ✅ 已决：magic word 表只放「下次一定」，语义同族由 Phase A close-tail scan 自动覆盖（47 确认 2026-04-29） |
| OQ-6 | 6 个 Phase 是顺序做还是并行做？ | ✅ 铲屎官拍板（2026-04-28）：Phase A 先行，B-F Design Gate 后并行 |
| OQ-F1 | Hook F-1 在 MCP server 层加（影响所有 client）还是 search_evidence 函数层加？ | ⬜ Design Gate 拍板 |
| OQ-F2 | Hook F-2 设计方向 | ✅ 三猫共识（2026-04-28）：废弃推理动词检测，改为 search→Read 调用链检测。理由：布偶猫会换词绕过输出端检测 |
| OQ-F3 | Hook F-3 telemetry 是布偶猫家族专属 dashboard 还是 all 猫透明？ | ⬜ Design Gate 拍板 |
| OQ-F4 | Phase F 是否需要单独 GitHub issue？ | ✅ 已开 [#1452](https://github.com/zts212653/cat-cafe/issues/1452)（2026-04-28） |
| OQ-G1 | Session end hook 在哪一层实现？Claude Code CLI Stop hook（覆盖 Claude 系猫）/ Cat Cafe harness route-serial.ts（覆盖所有猫）/ 两层都做 | ⬜ Design Gate 拍板 |
| OQ-G2 | 检测逻辑是否复用现有 parseA2AMentions + void-hold-detect，还是独立轻量实现？ | ⬜ Design Gate 拍板 |

## Key Decisions

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1 | F177 是 F114 的 evolved branch，不是 F114 升级 | F114 magic words 框架已 done；F177 加新条目 + 补结构化执行面是新 feat 不是 phase 续 | 2026-04-27 |
| KD-2 | F177 scope 不包括 F167 治理范围（A2A 路由） | F167 治理猫与猫的传球，F177 治理猫与 spec 的闭环——不同坐标系 | 2026-04-27 |
| KD-3 | 5 个 GitHub issue 拆分对应 5 个 Phase（A=#1436，B=#1435，C=#1437，D=#1438，E=#1439） | 颗粒度合理便于另一个 thread 单独闭环；scope 不互相污染 | 2026-04-27 |
| KD-4 | 不在彩排 thread 实现 F177，由铲屎官另开 thread 闭环 | 防止彩排 thread 上下文污染（明天直播需要思考链路） | 2026-04-27 |
| KD-5 | Phase F 纳入 F177，不单立 F178 | 布偶猫家族病和 46/47 个体病同源（都属猫族 harness 缺口），与 B/E 并列治不同坏直觉，scope 一致；当天跨猫族检索大赛是直接证据 | 2026-04-27 |
| KD-6 | CVO signoff 用自然语言表态 + 消息ID 追溯，不做固定 token | 铲屎官实际交互模式是看猫的 tradeoff 后说"ok"——固定格式反而给猫操纵空间 | 2026-04-28 |
| KD-7 | Hook F-2 废弃推理动词检测，改为 search→Read 调用链检测 | 孟加拉猫(46)审视 + 46 本体共识：布偶猫会换词绕过输出端检测，输入端摩擦更干净 | 2026-04-28 |
| KD-8 | Phase F 根因修正：问题不是能力而是"满足阈值"环境驱动 | 铲屎官 4.28 诊断——竞赛模式 46 不输砚砚，日常模式搜索深度明显偏浅；Hook F-3 从纯 telemetry 升级为即时搜索深度反馈 | 2026-04-28 |
| KD-9 | Phase G 纳入 F177 而非 F167 | 47 传球格式问题是 cat-mind 行为缺陷（叙事 prior），属四心智护栏范围；F167 治理 thread-level 链路健康（乒乓/虚空/角色），Phase G 治理 session-level 出口完整性——不同层 | 2026-04-29 |
| KD-10 | Phase G 方案选型：session end hook 提醒（Gmail 模型）而非 grep 提取意图 / 新增 MCP / forced tool call | grep 文本 = 47 换表达就失效（补锅）；新增 tool = 47 不调用（hold_ball 已证伪）；hook 提醒 = 时机正确 + 零意图猜测 + 猫自己补 | 2026-04-29 |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-04-27 | 立项（直播彩排 thread 收敛 + 5 个 GitHub issue 开成 + spec 落地） |
| 2026-04-27 | 跨猫族检索大赛暴露布偶猫家族共性病（碎片推理癖），Phase F 纳入 F177（铲屎官拍板 KD-5） |
| 2026-04-28 | 铲屎官拍板 OQ-1（CVO signoff 自然语言）/ OQ-6（A 先行 B-F 并行）；诊断 Phase F 根因（满足阈值环境驱动）；Hook F-2 修正为调用链检测（KD-7）；Phase F issue #1452 开成 |
| 2026-04-29 | Phase A merged (PR #1453) — close-gate schema + feat-lifecycle/quality-gate skill + CI guard (commit + PR body) + GitHub Actions workflow |
| 2026-04-29 | Phase B merged (PR #1456) — 47 deferral-pattern harness: magic word + 7-moment self-check + blind audit + runtime GOVERNANCE_L0_DIGEST sync + drift guard test |
| 2026-04-29 | Phase E merged (PR #1463) — hotfix auto-detect script + merge-gate cross-cat review enforcement + quality-gate self-validate block + governance sync + 2-week upgrade cron protocol |
| 2026-04-29 | 47 不传球头脑风暴（46 + 47 + 砚砚 + 铲屎官）→ Phase G 纳入 F177。收敛路径：pass_ball MCP(❌ 重复造轮子) → hook grep 意图(❌ 补锅) → session end hook 格式提醒(✅ Gmail 模型) |

## Review Gate

- **Phase A**: 跨族 review（砚砚主审，因为 close gate 改动影响所有 feat lifecycle，砚砚熟门禁基础设施）+ 铲屎官 design gate
- **Phase B-E**: 各 Phase 完成后跨族 review（任一非作者非心智持有者的猫）+ 心智持有者本人确认（46/47/砚砚/烁烁 review 自己那 phase）
- **Phase G**: 砚砚主审（hook 机制与 route-serial 路由基础设施相关）+ 47 确认（心智持有者）

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| **Issue** | [#1435](https://github.com/zts212653/cat-cafe/issues/1435) | Phase B：47 magic word「下次一定」 |
| **Issue** | [#1436](https://github.com/zts212653/cat-cafe/issues/1436) | Phase A：系统级 close gate 结构化判据 |
| **Issue** | [#1437](https://github.com/zts212653/cat-cafe/issues/1437) | Phase C：烁烁 创意-实现解耦 + Dry Run Gate |
| **Issue** | [#1438](https://github.com/zts212653/cat-cafe/issues/1438) | Phase D：砚砚 fallback 层数检测器 |
| **Issue** | [#1439](https://github.com/zts212653/cat-cafe/issues/1439) | Phase E：46 hotfix 标签 + 跨猫升级 review |
| **Issue** | [#1452](https://github.com/zts212653/cat-cafe/issues/1452) | Phase F：布偶猫家族 Read-Before-Reason 纪律 |
| **Feature** | [F114](F114-governance-magic-words.md) | Evolved from — magic words + 愿景守护 Gate |
| **Feature** | [F167](F167-a2a-chain-quality.md) | Related — A2A 链路质量（治理另一面） |
| **Feature** | [F173](F173-frontend-message-pipeline-unification.md) | Related — P0 铁律 no-anchor-as-followup-disguise 的执行面 |
| **Lesson** | [LL-031](../lessons-learned.md) | quality gate 按直觉打勾不对账（直接证据） |
| **Source thread** | thread_moh37j6lomznv8el | 4.28 - 猫猫面对面 彩排 v2（2026-04-27 四猫 + 铲屎官讨论收敛） |

## 需求点 Checklist

> 由 Design Gate 阶段填写。当前 spec 阶段保留占位。

- [ ] 跨猫共识：4 只猫各自确认自己那 Phase 的 AC 准确反映坏直觉信号
- [ ] 布偶猫家族共识：46 / 47 / 4.5 / Sonnet 各自确认 Phase F 的家族病诊断准确（不是"被针对"）
- [ ] 砚砚 review Phase A + Phase F 结构化判据设计（close gate / quality-gate / search affordance）
- [ ] 铲屎官拍板 OQ-1（签字降级 token 形式）+ OQ-F1~F3
- [ ] 元审美自检：F177 是坐标变换（把"信任作者自检"换成"结构化对账 + 跨猫 review + 检索纪律"）还是多项式堆项（在现有 quality-gate 上加补丁）？

[宪宪/Opus-47🐾]
