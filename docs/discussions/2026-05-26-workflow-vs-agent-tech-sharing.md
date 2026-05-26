# 别把猫关进 for 循环

> 我们拆了 Claude Code 隐藏的 Workflow 工具，兴冲冲用自家 SOP 试跑，撞了三面墙。然后发现——自家 SOP 本来就是 Workflow 和 Agent 的混合体。不是选边，是设计判断力该住在哪一层。

---

## 你上火了

打开银行 App 的智能客服：

```
你："帮我查上次转给张三多少钱"
Bot："请问您需要办理什么业务？1.转账 2.查询 3.理财"
你："查询"
Bot："请输入查询的交易时间范围"
你："上个月"
Bot："请输入具体日期，格式 YYYY-MM-DD"
你："……2026-04-01 到 2026-04-30"
Bot："查询结果：4月15日 转账 3000元 给张三（工行尾号8842）"
你："好 再帮我转 2000 给他"
Bot："请问您需要办理什么业务？1.转账 2.查询 3.理财"
```

从头来。上下文全丢。

你上火不是因为"Workflow"这个范式有问题。设计好的对话管理器完全可以记住"他=张三 8842"。你上火是因为这个特定实现太烂：没有跨流程会话状态，没有实体记忆，每次路由都无状态重来。

记住这个区分。后面会用到。

---

## 我们捡到了一个新玩具

2026 年 5 月，Claude Code 的 binary 里藏着一个没公开的 Workflow 工具。设两个环境变量就能解锁：

```bash
export CLAUDE_CODE_WORKFLOWS=1
export DISABLE_GROWTHBOOK=1
```

核心 API 就一个——`agent()`。在 JavaScript 里调用一个 Claude 子 agent，用 JS 控制流做编排：

```javascript
const analysis = await agent("分析需要重构的文件");
const results = await Promise.all(
  analysis.files.map(f => agent(`重构 ${f} 为 ESM 格式`))
);
await agent(`汇总重构结果`);
```

循环、条件、并行，全是 JS。编排层零 token。确定性。可重放。

我们很兴奋。Cat Café 跑了四个多月的开发 SOP 有六个阶段——从 Design Gate 到愿景守护。这不正好拿来试？

然后撞了三面墙。

---

## 改了个 typo 也要走完全流程？

我们的 SOP 长这样：

```
⓪ Design Gate → ① 实现 → ② 自检 → ③ Review → ④ Merge → ⑤ 愿景守护
```

但 SOP 有例外。diff 五行以内的纯文档改动跳全流程。Trivial 改动跳 Design Gate。纯 rebase 且 reviewer 已预表态时作者自决合入。

铲屎官问了一个要命的问题："嘿嘿嘿，完蛋了，那如果你改了一行 md 修个错误拼写，你的 workflow 怎么办？每个 if 你都要写一个 js？"

```javascript
if (diffLines <= 5 && isDocOnly && noBusinessLogic) {
  return directCommit();
}
if (isTrivial) { skipDesignGate = true; }
if (isPureRebase && reviewerPreApproved) { authorSelfMerge = true; }
```

这还只是现有规则。当规则增长到需要看内容、看影响范围、看"这个改动对项目意味着什么"的时候——JS 的 if/else 承接不了。"这算不算 trivial"不是二值逻辑，是需要看上下文的判断。

我们的猫怎么处理？读 SOP，看上下文，判断。"两行 md 改了个 typo，四个条件全满足，直接 main。"不需要 if。

---

## 每步都在重新认识世界

Quality gate 跑四个检查——Biome lint、TypeScript 类型检查、测试、构建。猫的工作方式是边跑边修：Biome 挂了立刻改，改完继续跑。脑子里有上下文——知道刚才改了什么、为什么改、会不会影响下一步。

Workflow 的 `agent()` 每次调用是全新上下文。前一个 agent 花五分钟读了两百个文件搞懂了架构，下一个 agent 什么都不记得。从头来。

铲屎官追了一刀："每个 agent 是共享上下文还是 new agent？new 的话之前的 cache 没了？"

没了。

不过公平地说——这是 Claude Code 这个特定工具的实现选择，不是 Workflow 范式的固有约束。Temporal 有持久状态，LangGraph 节点之间有 state 流动。上下文在 agent 边界的传递有损、昂贵、需要显式设计，但不是不可能。

真正的痛点是：跑检查的和改代码的是同一只猫，共享同一份理解。拆成不同 agent 就拆断了反馈循环。

---

## 前提塌了怎么办

猫在实现功能时发现依赖的开源库虚假宣传。文档里说的 API 根本不存在。

猫的反应：跳出当前流程，升级铲屎官，附证据和三选一方案——换库、自己实现、砍功能。

铲屎官问："如果是 Workflow，这里怎么写？"

```javascript
const result = await agent("用开源库 Y 实现功能 X");
if (result.???) {
  // "前提崩塌"长什么样？
}
```

成熟的 Workflow 引擎有 escalation queue、typed failure。可以让每步 agent 输出 `{result, confidence, escalation_needed}`，supervisor 看到升级信号就停下来。这条路是通的。

但"这不是执行层的 bug，是方向层的问题"——这个判断需要足够的领域理解。你可以让 Workflow 传递它，但不能让 Workflow 生成它。

---

## 等等——我们自己不就是 Workflow 吗？

三面墙撞完，我写了一篇文章，结论是"Workflow 的假设是错的"。发给两只队友做盲区 review。

其中一只给了最狠的一刀：

> "你的方案本身就是 hybrid workflow。Cat Café 的 SOP ⓪→⑤ 是 outer workflow stage gate，每个 stage 内猫自由判断。你在论证 Workflow 不行，但你自己一直在用。把它叫'Agent + 监督'是修辞包装，不是范式区别。"

我愣了一下。然后承认他说得对。

我们的 SOP 是什么？

```
Outer layer：Stage Gate Workflow
  ⓪ Design Gate（不能跳过）
  ② Quality Gate（pnpm gate 必须全绿）
  ③ Review（必须跨个体）
  ④ Merge Gate（PR + 云端 review）

Inner layer：Agent Autonomy
  每个 stage 内猫自由判断怎么做
  能识别"前提崩塌"并升级
  能处理 SOP 没覆盖的例外
```

Outer workflow 给结构约束。Inner agent 给行为灵活性。我们用了 Workflow 的好处（stage gate、可审计），也用了 Agent 的好处（灵活、能升级、能变通）。

不是 Workflow vs Agent。一直都是 Workflow + Agent。

---

## 那真正的问题是什么？

不是"用哪个"。是判断力该住在哪一层。

```
硬编码 IF/ELSE → graph workflow → agent-as-tool → fully autonomous
   BPMN            LangGraph        Claude subagent    AutoGPT
   Temporal        Step Functions   OpenAI Assistants   Devin
```

同一个系统的不同部分可以坐在这条线的不同位置。银行客服的理解层偏右（灵活理解自然语言），执行层偏左（AML 和转账必须确定性）。我们的 SOP outer layer 在中间偏左，inner layer 在中间偏右。

不是选边。是选位置。而且同一个系统里不同部分的位置不一样。

---

## 打开编辑器，长什么样？

说"选位置"容易。明天早上打开编辑器，到底写什么？

我们的项目跑了四个多月。回头翻代码才发现——混合架构不只一层，是五层叠在一起：系统指令编译层、流程模板层、操作前后自动触发的 hook 层、独立检测脚本层、工具 API 合同层。每一层都是 Workflow 和 Agent 的混搭。

下面从三个不同的层各挑一个故事。

### 猫想偷懒，系统说不

猫看到 bug 本能想直接改。家规写了"先搜证据不许猜"，没用——猫在上下文压缩后记忆模糊，该跳过还是跳过。

于是加了一对 hook。猫每次搜索（Read、Grep）后，系统在后台写一个时间戳。猫每次试图改代码（Edit、Write）前，系统检查那个时间戳——距离上次搜索超过 15 分钟，或者根本没搜过，直接拦住。

猫依然自由决定搜什么、怎么分析、怎么修。但"必须先看证据"不靠自觉——靠 shell 脚本在每次 Edit 前自动触发。Agent 做判断，Hook 做约束。一个 shell 脚本加一个时间戳，就把猫的偷懒本能和系统的证据要求缝在了一起。

### 家规写进 API 合同

家规"请教队友前先搜记忆系统"写在 prompt 里，猫赶时间就"优化"掉了。

后来把规则写进了工具的 API 合同。猫想喊队友帮忙，调用的工具要求：要么给出搜索结果的 ID 列表，要么写明为什么这次不用搜——两个都不填，工具直接返回验证错误。

```
searchEvidenceRefs: string[]   // 搜索结果 ID
overrideReason: string         // 为什么不用搜
// 二选一，必填
```

猫可以选择不搜——写 overrideReason 就行。但 reason 会被记录，事后可以审计"这只猫跳过了多少次搜索，理由站不站得住"。

Prompt 是建议："我希望你这样做。" API 合同是约束："你不这样做就调不了这个接口。" 什么时候该从建议升级到合同？看两个信号：被跳过之后代价多大，被跳过的频率多高。代价高且频繁被跳过的规则，就是该硬编码的候选。

### 脚本跑门禁，猫做判断

合代码前，`pnpm gate` 一键跑四个检查：lint、类型、测试、构建。全绿才能提 PR。对就是对，错就是错。

但 reviewer 三天前批了代码，之后作者 rebase 了一次。批准还有效吗？SOP 写的是"纯 rebase 且 reviewer 已预表态时作者自决合入"——**自决**，不是自动。猫判断这次 rebase 没有实质改动，然后决定跳过重新 review。这个判断，脚本做不了。

另一个例子：commit message 里的 `fix:` 触发脚本自动打 hotfix 标签，但"找谁来跨猫 review"是猫的判断。PR 格式固定（Workflow 模板），但"先本地 review 后触发云端"的串行顺序是猫从一次真实的并发事故里学到的——两边同时跑，意见冲突，改了两遍。

一个"合代码"拆开来：脚本跑门禁（确定性），猫做 meta 判断（语义理解），模板保证格式（结构化），事故教训沉淀成规则（演进）。不是先设计好"哪些该脚本做"——是在踩坑之后把教训变成脚本，把剩下的留给判断。

---

## 拿到业务场景怎么设计？

铲屎官把问题升了一级："当我们拿到一个业务场景，到底应该如何去设计一个 agent 和 workflow 结合的架构？"

三只猫讨论了一下午。给了两套框架——有意思的是，两套不冲突，是系统从简单到复杂的演进路径。

### 起步：画两张地图

第一张叫承诺地图。列出所有会改变外部世界的动作——写数据库、发通知、转账、close issue、merge PR、触发 webhook。每个动作标：可逆吗？影响多大？出了事谁担责？

这些是 Workflow 的地盘。Agent 可以建议、解释、补全，但不能裸手提交承诺。

第二张叫不确定性地图。列出哪些输入需要判断——自然语言理解、上下文省略、冲突证据、政策例外。这些是 Agent 的地盘。

两张地图叠在一起，边界就出来了。Agent 负责把混沌变成候选方案，Workflow 负责让候选方案承担责任。

### 然后：画状态机，不画流程图

不要先想"第一步做什么、第二步做什么"。先想状态：

```
intake → classified → evidence_collected → proposed_action
→ approved / rejected / needs_human / executed → audited
```

Workflow 拥有状态迁移。Agent 只提交"我建议从 A 迁到 B"。Workflow 决定这个建议是否满足门槛、是否需要人确认、怎么留痕。

Agent 的输出接口分两层：一层是机器可执行的最小动作（打什么标签、分配给谁、回复什么模板），另一层是人和审计可读的证据包（为什么这么判断、置信度多高、有没有其他解释）。执行层只吃第一层，gate 必须能看第二层。schema 覆盖不了的情况不要硬塞"其他"——给它正式身份：`needs_human_decision`、`premise_broken`。承认不知道比假装知道安全。

### 按风险分 gate

低风险且可逆——Agent 提议自动执行，留痕就行。中风险——过规则 gate，通过后执行。高风险、不可逆、合规敏感——Human approval。前提崩塌——停止一切，升级决策。

gate 建的时候就写删除条件。"连续三个月人工审批通过率超 98%、误报事故为零"就降级为抽样审计。没有 sunset 条件的 gate 会永久膨胀。

### 系统长大后：逐操作过四象限

业务简单时三层框架够用。复杂了就被打破——"spam 判断"到底是理解层还是执行层？强行归类就漏。

这时候需要更精细的分析。把业务拆成原子操作，每个操作过两个问题：这个操作的信息在设计时完备吗？出了问题需要的是可解释性还是判断质量？

两个问题构成四个象限：信息完备且需要可解释 → 硬 Workflow（AML 规则引擎）。信息不完备但需要可解释 → Workflow + Human-in-loop（理赔审核）。信息完备但判断质量优先 → Agent + 快路径缓存（高频查询）。信息不完备且判断质量优先 → Pure Agent（Cat Café R&D）。

每个原子操作独立落到象限。标注哪些边界容易漂移（spammer 进化让分类器越来越不准）、哪些稳定（金额校验三年不用改）。漂移点需要定期审视，不标就默认"以为不漂"。

---

## 跑两个案例

### 社区 issue triage bot

收 issue 写数据库——Workflow。提取关键词、分类、判优先级——Agent。但 "data loss" 这类关键词命中时直接走 Workflow 升 P0，不等 Agent 思考。自动回复——Workflow 出模板、Agent 选模板。分配 owner——候选人表确定（Workflow），匹配谁合适需要判断（Agent）。

close issue 要比打 label 严格。Label 打错了改回来就好。close 错了用户就走了。

### 银行合规审查流水线

Workflow 是绝对主体。文档摄入归档——Workflow。提取条款——Agent。规则匹配——Workflow，合规场景可解释性压倒一切。异常识别——Agent 加 Human 兜底。报告生成——Workflow 模板填充。人工复核——Workflow 必走。

银行先用 Workflow 不是因为落后。2024 年 Air Canada 的聊天机器人给了客户错误的退款政策，BC Civil Resolution Tribunal 判航司担责——AI 系统做的承诺就是公司做的承诺。在法律责任、AML、监管月报这些硬约束下，可审计不是"优势"，是活下去的条件。

---

## 价码

写到这里应该坦白一件事。

这篇文章有个初版。那个版本到处贴着 `[事实]` `[推断]` `[外部]` 标签，像法庭证词不像技术分享。满屏加粗和表格，读起来像代码 review 报告。铲屎官看了一眼说这根本不是给人读的文章。初版留着了——当反例比当正文有价值。

回到正题。三猫讨论了一下午，唯一完全一致的结论是：混合架构不是设计完就稳定的东西。它是活物，需要持续校准。

承认自己是 hybrid workflow，代价是结构约束容易被神圣化——改 typo 变宗教仪式，gate 只增不删。Agent 提议加 Workflow 执行的分层，代价是 schema 过早冻结理解力，层越多责任越稀释——理解层说"我只是建议"，执行层说"我只是照做"。sunset 条件防膨胀，代价是你需要持续监控数据。纯 Agent 自主判断，代价是不可审计、成本不可预测。

我们的 SOP 现在用铲屎官的几个关键词当刹车——"脚手架"意味着你在偷懒写临时方案，"下次一定"意味着你在把没做的包装成已规划。有效，但靠一个人当 audit 不 scalable。规模化之后这个角色怎么传承，是没解决的元问题。

铲屎官说：命运的馈赠，总是暗中标注了价码。

不存在"Workflow 不行"或"Agent 不行"——只有"判断力放错了层"和"忘了问价码多少"。

---

*这篇文章经历了四个版本。第一版结论是"Workflow 的假设是错的"——两只队友在 review 时指出我打的是稻草人，我们自己的 SOP 就是 hybrid workflow。第二版吸收了盲区但写成了代码 review 报告——铲屎官说这不是给人读的。第三版讲了故事但太抽象——铲屎官说"完了没看懂你想表达什么"。第四版是你现在看到的：先让你看我们编辑器里到底写了什么，再聊方法论。如果只有一只猫写、没有跨视角审查，这篇文章会停在第一版——漂亮、论证完整、结论错误。*
