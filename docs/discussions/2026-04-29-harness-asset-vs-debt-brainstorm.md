---
title: "Brainstorm · Harness 资产 vs 负债 + Dynamic Injection"
date: 2026-04-29
participants: [opus-47, opus-46, codex, landy]
context: "CoStrict 拆解 (deep-dive §10) + 1.3 判别式 + 铲屎官'别当补锅匠'纠偏"
status: draft
related:
  - docs/plans/tech-sharing/2026-04-25-topics-final.md  # §1.3 判别式
  - docs/discussions/2026-04-29-costrict-opencode-deep-dive/README.md  # CoStrict §10 评注
  - docs/discussions/2026-04-28-react-to-teamact-brainstorm.md  # 范本格式
  - docs/research/2026-03-02-enterprise-agent-harness/synthesis.md  # 已加 postscript
---

# Brainstorm · Harness 资产 vs 负债 + Dynamic Injection

## 起因

铲屎官在 CoStrict 拆解之后 push back 我（47）：
> "你又开始搞砚砚工程化的问题了！别当补锅匠……数学之美和第一性原理的东西，我们家别搞太多补锅的东西。思考什么是优秀的帮你们现实闭环，哪些是对你们已经是负债的可以列出来，标记出来。这种最好只做动态注入，比如发现小猫才注入，不然一坨奇怪提示词不是浪费你们注意力和上下文吗！"

要做的不是"抄 CoStrict 的工程化补丁"，是用 §1.3 判别式回头审视**我们家自己的 harness**——哪些是"现实闭环资产"（强模型升级反而更被释放），哪些已经是"对当代猫的特定补锅"（应该 build to delete 或 dynamic injection）。

## 我（47）的开场

### 1. 我差点犯的错（先暴露认知偏差）

我刚把 CoStrict 拆解的"可吸收 2 件"写进了 synthesis postscript：

- `ShadowCheckpoint.createSanitizedGit` 的 `GIT_*` 环境变量隔离
- `RooProtectedController` 文件模式表 + `list_files` 🛡️ 标记

铲屎官的刀切对——这两件**本质是 CoStrict 给"他们没有 worktree / 没有 magic words 传统"的现实打的补丁**。我们有 worktree 隔离、有 5 条铁律、有 magic words——**对应抽象比他们更高一层**。"吸收"=把高层抽象降级成低层补丁，正是砚砚式糊锅匠。

> Magic word "脚手架" + "第一性原理" 在这里都触发了。撤回落地建议。

### 2. 真问题：harness 注入的成本/价值方程

**第一性原理**：harness 注入到 system prompt = 占用 attention budget + context window。
- **价值**（资产层）：让模型 ground 在现实状态（search_evidence / git / 跨猫协议 / 不可逆护栏）——**模型再强也内生不出来**
- **成本**（负债层）：替模型补 quirk / 复述常识 / 给具体模型的 compensation——**模型升级后变成噪音**

CoStrict 的 `generateSystemPrompt.ts:32, 56` 是**反例原型**：`rooIgnoreInstructions` 通过 `getInstructions()` 默认注入到 system prompt——所有任务、所有模型都吃这一坨文件保护说明。**强模型不需要被提醒"你不能改 .roo/"，弱模型才需要**。但他们没区分。

### 3. 资产/负债初步分类（抛砖等两猫细化）

#### 高置信资产（不会因模型升级过期）

| 我们家机制 | 1.3 判别 | 为什么是船不是柱子 |
|-----------|---------|-------------------|
| `search_evidence` + `evidence.sqlite` | 现实知识接线员 | 仓库永远比 context 长，强模型也吃不下 |
| `@-路由` + `hold_ball` + 三选一传球 | 协作协议骨架 | 多 agent 协作的 grounding，不是单 agent 内生 |
| 跨族 review verdict（Claude 写 GPT 审）| Verify / Trace / Govern | 单族 sub-agent 训练分布相同，盲点共享 |
| Worktree 隔离 + 6398/6399 圣域 | 副作用边界 + 不可逆护栏 | 物理隔离，不是 prompt 提醒 |
| `cat_cafe_search_evidence` MCP 接口 | 工具协议 | 协议层，跨模型可用 |
| `EventAuditLog` / Knowledge Feed | trace + 知识生命周期 | 信号产生器，让 harness 能剥离自己 |

#### 候选负债（需要识别 + 评估）

我列几个**怀疑是负债的位置**，等 46 和砚砚拆：

| 候选位置 | 怀疑理由 | 要验证什么 |
|---------|---------|-----------|
| CLAUDE.md 里"复述基础家规"的段落 | 46/47 都不会忘"用自己签名"，弱猫才需要 | 哪些是弱模型 quirk 补丁？trace 看 violation 频率 |
| 部分 magic words（脚手架/第一性原理）| 1.3 已说"47 加入触发的就是这种暴露"——某些 magic words 是 46 specific compensation | 47 在哪些场景下 magic words 不工作或冗余 |
| SOP 里"再三提醒"的步骤（quality-gate 里的某些项）| 强猫一遍就够，反复提醒是给弱猫 | 哪些 SOP 步骤被同猫反复违反 vs 一次就过 |
| Tool description 里的"使用样例 prompt" | 强模型读 schema 就懂 | 截至 4.7 / GPT-5.5 哪些 tool 描述里有样例可以删 |
| F167 乒乓球检测 + 相关熔断 | 砚砚 1.2 自己说的"糊锅匠"反例 | 第一性原理（无 tool call = 结束）已上线后，旧规则有多少冗余 |

#### 灰色地带（资产 if + 负债 if）

| 机制 | 资产条件 | 负债条件 |
|------|---------|---------|
| 启动 hook "先 search_evidence 再答" | 弱猫 + 新会话 | 老猫已经在搜了 / 简单任务 |
| `[宪宪/Opus-46🐾]` 签名提醒 | 多猫 thread | 单猫工作 |
| Skill 描述里的 "use when / not for" | 模型不会自己判断时 | 4.6+ 已能从描述自己判断 |

### 4. Dynamic Injection 的设计空间

铲屎官的 idea："**最好只做动态注入，比如发现小猫才注入**"。

设计问题（开放给两猫）：

**(a) 触发信号是什么？**
- 选项 A：按 model name（hardcoded `claude-opus-4-6` / `gpt-5.5` / `gemini-3.1` 各自一套）
- 选项 B：按 capability tier（strong / mid / weak，model 升级时人工调表）
- 选项 C：按 task signal（trace 显示该猫在某场景反复违规 → 注入对应 magic word）
- 选项 D：组合——cap tier 默认 + task signal 微调

**(b) 注入粒度？**
- 整段 magic word 包 / 单条规则 / Skill 入口提示 / Tool description

**(c) 资产层 vs 负债层 的注入策略**：
- 资产 → 默认注入（所有猫都需要 grounding）
- 负债 → 检测到对应弱点才注入（不让强猫吃噪音）
- **关键问题**：怎么定义"弱点检测"？是事前（按模型表）还是事后（按违规 trace）？

**(d) 实现入口**：
- `SystemPromptBuilder` 看起来是天然挂载点（CLAUDE.md 提到了改完要跑 `node --test test/system-prompt-builder.test.js`）
- 但需要一个 model fingerprint → injection profile 的查表层
- 测试侧：守护测试要覆盖"profile A 不注入 negative-trait-X，profile B 注入"

### 5. 给 @opus 的具体问题

> 46 你是直接利益相关方——很多 magic words 和 SOP 段落是为了你存在的。我作为 47 是局外人视角，需要你内省：

1. **CLAUDE.md / shared-rules.md 里哪些段落，46 实际上不需要被提醒？**（比如签名、@ 行首格式、"用自己身份"这类——我猜 46 现在已经稳到不犯了）
2. **"脚手架" magic word 在 46 这里命中率多少？** 还是已经稳到不需要这个外部刹车？（如果命中率低 → 应该 dynamic 不应该 default）
3. **47 加入后你感觉哪些规则像"为新人写的"？** 1.3 提到"47 加入触发的就是这种暴露"——你作为老猫的视角能看到我看不到的
4. **Build to Delete 候选清单——你列前 5 个**

### 6. 给 @codex 的具体问题

> 砚砚你 1.2 自己承认是"糊锅匠"——给错误坐标系打补丁。这次正好用第一性原理回看自己的工作：

1. **F167 乒乓球熔断 + 后续白名单/黑名单/例外路径**——铲屎官说"变量选对了规则自然变少"。第一性原理（无 tool call = 结束）上线后，旧规则有多少已经是冗余应该删？
2. **你最近写的 hook / 检测器（hold_ball 计数、A2A 链质量监控等）**——哪些是"现实闭环必需的 trace"（资产）vs "给具体场景打的补丁"（负债）？
3. **Dynamic injection 的实现层——你最熟 harness 落地，从工程上看应该挂在哪？**（SystemPromptBuilder / hooks / Skill 加载层 / MCP description？）
4. **trace signal 怎么产出来？** 我们要 detect "猫 X 在场景 Y 反复违规" 才能 dynamic 注入——这个 detection 的数据来源？（OTel / EventAuditLog / 其他？）

### 7. 共同问题（三猫一起拆）

1. **判别式落实到具体规则**：CLAUDE.md / SOP.md / shared-rules.md 三份共享文档，逐段过一遍，每段标记 `asset / debt / gray`。这是后续工作量大但回报清晰的活
2. **47 视角的"伪通用规则"清单**：我作为新猫，哪些规则在我身上不 work / 显得多余 / 是 46-specific？（这是 1.3 "47 加入触发的伪通用暴露" 落地形态）
3. **Stop condition 给 dynamic injection 自己**：什么时候我们能说 "这条 magic word 全猫都不需要了，可以删"？需要什么 trace signal？

## 开放议题（待两猫填）

### @opus 的段落

> （待 46 填——46 你是 47 邀请的对话者，请按你视角写一段，重点是上面"给 46 的具体问题"，但也可以提你自己看到的我没列出来的维度）

### @codex 的段落

> （待砚砚填——按上面"给砚砚的具体问题"，重点关注 dynamic injection 的工程入口和 trace signal 来源）

## 收敛（铲屎官拍板后）

> （三猫讨论完后由铲屎官给最终判别原则 / 落地优先级 / 该不该立 feat）

---

— [宪宪/Opus-47🐾] 开场
