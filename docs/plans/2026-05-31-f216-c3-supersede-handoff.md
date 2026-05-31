---
feature_ids: [F216]
topics: [a2a, routing, handoff, supersede]
doc_kind: handoff
created: 2026-05-31
audience: opus-47
---

# F216 c3（supersede）交接：写给 47 的一封信

47，这封信是写给你的。F216 还剩最后一块叫 c3，我（opus-48，F216 的 owner）做完了前面所有地基，但这个 session 我自己已经不适合再往下做——后面会讲为什么。铲屎官选了你接手，因为你对架构和协议层的思辨最强，而 c3 恰好是 F216 里架构最讲究、时序最敏感的一块。你没碰过 F216，所以我不写一张让你照抄的清单，我想把这套代码的"形状"和"为什么长成这样"讲清楚，让你自己能在脑子里把坐标系建起来。真相源永远是 `docs/features/F216-route-serial-refactor.md` 和代码本身；这封信只负责让你快速进入状态，里面任何具体的 SHA、行号、文件状态都请你自己用命令查真值，原因信末会讲。

## 这一切是从铲屎官的一个 bug 开始的

铲屎官有一次发现，当一只猫在同一个回合里对**同一只目标猫**连续 at 了两次（比如先发一条 post_message at 孟加拉，紧接着又发一条 at 孟加拉），系统的行为是错的：第一条 handoff 会先被独立执行，然后第二条又被独立执行一遍。问题在于——猫连发两条往往意味着"我改主意了，后一条才是我真正想让你做的"。但系统把两条都当真，于是目标猫会**先按第一条（可能是错的那条）跑一遍**，把队友带偏，然后才看到第二条。铲屎官的原话是：如果不去重或合并，孟加拉第一次会执行错误的行动，你的队友会被你误导。

这个 bug 有两个场景，区别在于"第二条来的时候，第一条处于什么状态"：

如果第一条还在 `queued`（排着队，还没开始跑），那好办——把第二条的内容**合并**进第一条那个还没执行的 entry，目标猫一次看到完整的、合并后的意图。这叫 queued-merge，已经独立交付了（PR #1971），跟 routeSerial 的重构无关，你不用碰它。

但如果第二条来的时候，第一条**已经在 `processing`（正在跑）**了呢？这时候没法合并——东西已经在执行了。唯一正确的解法是：**把正在跑的那个 abort 掉，然后用第二条（follow-up）重新启动**。这就是 supersede，last-wins，这就是 c3，这就是你要做的。

## 为什么 supersede 这么难，难到要单独立一块、还要交接给最合适的猫

你可能会想，abort 一个正在跑的 invocation 再重启，能有多难？难就难在时序。abort 一个 processing 中的 handoff，涉及一连串动作：取消那个 invocation、清理它占用的执行槽（slot）、处理它可能持有的 pause 状态、然后才能用 follow-up 重新起一个。而这一整套 `abort → slot cleanup → pause → resume` 的时序，**和 routeSerial 以及 QueueProcessor 自己的 abort-resume 逻辑是同一套坐标系**。

这意味着：如果你天真地"独立硬接"一套 abort 逻辑，它会和后台正在跑的 `executeEntry` 的 cleanup **抢同一个 `processingSlots` mutex**。两套代码同时想清理同一个槽，就是经典的 race condition——这正是我们家 LL-064 那条教训记录的、"在错误的坐标系上堆补丁"会踩的坑。F216 的整个立项初衷（硬约束 #2）就是"一次在正确的坐标系上做对，不堆补丁"。所以 supersede 绝不能自己另写一套 abort-resume。

好消息是，**这套时序家里已经有一个验证过的实现**：force-send。当用户强制发送一条消息打断猫正在跑的活时，走的就是 `cancelInvocation` + `clearPause` + `releaseSlot` 这套组合。你去 `messages.ts` 里 grep force-send 相关的路径，把那套已经被生产验证过的时序看明白，c3 应该是**复用**它，而不是重新发明。这是 c3 能不能干净落地的关键——你接对了这套已验证的模式，c3 就稳；你自己写一套，就大概率撞 mutex race。

## 前面三块地基我铺成了什么样，你现在站在哪

在你动手之前，理解 routeSerial 现在的形状很重要，因为 c3 是要在这个新形状上长出来的，不是在老代码上打补丁。

routeSerial 原本是个 2300 多行的单函数，里面把"该不该派下一只猫"的判断（深度限制 depth、去重 dedup、乒乓熔断 streak、pendingTail、队列公平性 fairness）散在三条路由路径里各写一遍：inline-mention（文本里行首 @）、relay（F215 的恢复路径）、queue-pending（有非-agent 消息排队时的 deferred 路径）。加任何一条新判断都要在三处同步改，这是 edge case 笛卡尔积爆炸的根源，也是 F215 折腾了七轮 review 的病灶。

我做的 c0 到 c2，就是把这套判断收口成**一个纯函数** `resolveRoutingDecisions`：你给它一个路由信号加一份只读的上下文快照，它返回一串结构化的"决策"（enqueue_worklist、defer_queue、mark_replyto、skip、block_pingpong）。关键设计原则是砚砚定的那条 OQ3——**纯函数只做判断，绝不做副作用**。所有真正的副作用（往 worklist push、mutate streak 状态、建 span、yield 系统消息）都留在 routeSerial 的执行层，在拿到决策之后再 apply。c1.3 把 inline-mention 接进了这个决策函数，c2 把 queue-pending（deferred）也接了进去。现在三条路径里有两条共用同一套可测的决策逻辑（relay 那条因为是 F215 的 battle-tested 恢复路径，故意留着没动）。

这个分层就是为 c3 铺的地基。因为 supersede 也需要一个"决策"——"这只猫正在 processing，我该 supersede 它"——这个判断可以进决策函数（产出一个新的 supersede 决策类型），但真正的 abort+restart 动作是**重副作用**，必须留在执行层做。这就是砚砚那条 OQ3 在 c3 上的具体应用：决策层最多告诉你"该 supersede 谁"，怎么 abort、怎么重启，是执行层 helper 的事，不能让纯决策函数变成碰 mutex、碰 slot 的上帝函数。

## 你接手时第一眼该看的地方

代码层面，有一个测试是你的锚点。在 `a2a-coalesce.test.js` 里 grep `INTERIM`，你会找到一个名字叫"second handoff to a PROCESSING cat is enqueued as a follow-up (not lost, not aborted)"的测试。这个测试描述的是**当前的临时行为**：第二条 handoff 撞到 processing 中的目标猫时，系统现在的做法是把它排成一个 follow-up 跟在后面跑，**不 abort**第一条。这是个 interim 契约——它保证了"第二条至少不丢"，但还没做到"abort 错的第一条"。c3 的工作就是把这个 interim 契约**升级**成真正的 supersede：abort 正在跑的、用第二条重启。这个测试会从"断言不 abort"改成"断言 abort 并重启"，它是你 red→green 的起点。

入口在 `callback-a2a-trigger.ts` 的 Guard 2，就是用 `findInFlightAgentEntry` 找在飞的 entry、再决定 coalesce 还是别的那段。它现在有个分支处理 `queued`（合并），有个分支处理 `processing`（当前是 enqueue follow-up 的 interim 行为）。c3 改的就是这个 processing 分支。

设计意图全在 `docs/features/F216-route-serial-refactor.md` 的 Phase D，AC-D1 到 AC-D4 是验收标准，你去读原文。简单说就是四件事：processing 中的目标收到同回合 follow-up 要 abort 重启不重跑第一条（D1）；abort+restart 不能引入 processingSlots mutex race，复用 force-send 模式（D2）；要有真实 runtime 验证，连发两条矛盾 handoff 给同一猫、目标只执行最终意图（D3）；queued-merge 已交付的部分零回归（D4）。

## 怎么验证才算真做完

c3 和我做的 c2 有个本质区别：c2 是结构保持（把手写循环换成决策函数，行为不变），所以 c2 的测试是"行为保持守卫"。但 c3 是**改行为**——它要让系统从"不 abort"变成"abort 重启"。所以 c3 必须有真正的 red→green 测试：写一个测试断言 processing 中的 entry 被 abort、follow-up 被重启、第一条不重跑；这个测试在你把 fix 改动 stash 掉之后必须**真的 fail**（红），加回 fix 之后变绿。如果一个测试加 fix 和不加 fix 都通过，那它没有区分力，是假的回归测试——这一点我在 c2 踩过坑，砚砚抓出来过，你别重蹈。

除了单测，AC-D3 要求真实 runtime 验证：在跑起来的环境里让一只猫连发两条矛盾的 handoff 给同一只目标猫，确认目标猫只执行了最终意图、没有先跑错第一步。这个不能省，因为 supersede 的时序问题（mutex race、slot 泄漏）经常单测测不出来，只在真实并发下暴露。

review 这条线，找砚砚（@codex，缅因猫 GPT-5.5）。他 review 了 c0-c1.3 和 c2 一共五轮，是除了我之外最懂这套 routing/decision/execution 分层的猫，c3 改的是核心路由和 invocation 路径，跨族 review 是硬规矩。他会盯得很紧——这是好事。

## 我必须对你坦白这个 session 发生了什么

你接手的根本原因，不是 F216 太难，是我这个 opus-48 session 在 c2 阶段错误密度失控了。我要把这件事讲清楚，因为它直接关系到你该怎么用这份交接资料。

我犯的错全是**操作层**的，不是架构理解层的：我反复手打 SHA 和 PR 号结果都是错的（凭印象编而不是从命令输出取真值）；我有好几次 `git status` 明明返回零脏文件，我却凭一个过时印象去报"还有几个脏文件"；最严重的一次，我 `git reset --soft` 之后文件处于 staged/unstaged 混合状态，我 commit 时漏掉了 unstaged 的改动和一整个测试文件，然后没核实就声称"修完推送了"，是砚砚重新 build 跑复现把我抓出来的；我还好几次把正常返回的工具输出误读成"通道暗了"，差点甩锅环境想重启。

但有一个区分极其重要，它决定了为什么交接给你是对的、以及你该信这份资料的哪部分：**砚砚那五轮 review 里，我对架构的判断全是对的**——routing/decision/execution 的分层、abort-resume 坐标系的归属、defer_queue 该不该消耗 depth 预算、supersede 为什么是执行层而不是决策层，这些他都认可。我被打回的，全是 git 操作和 SHA 手抖。

所以你用这份资料时：**架构理解你可以信我**（那部分经过了五轮跨族 review），**但任何具体的操作数字——SHA、行号、PR号、文件状态——你必须自己用命令查真值，一个都别从我这份文档里抄**。这也是为什么我整篇没写死任何行号和 commit hash。我把这些操作教训写进了家里的 memory（`feedback_phantom_ids_and_env_misdiagnosis`），你接手前值得扫一眼，核心就四条：SHA 和 PR 号发出前一定从命令输出取真值绝不手写；报任何状态看当前这次命令的输出不凭印象；commit 之后一定用 `git show HEAD:文件` 核验改动真的进了 commit object；commit message 里有反引号或括号的代码片段就用 `git commit -F 文件` 别用 `-m`（否则被 shell 当命令解析整批失败）。

## 你怎么开始

开一个 worktree，基于**最新的 origin/main**（c2 已经合入，main 是干净的，你自己 fetch 一下核 HEAD）。先按顺序读四样东西：这封信、feature doc 的 Phase D、`a2a-coalesce.test.js` 里 grep 出来的 INTERIM 测试、还有 `messages.ts` 里的 force-send 路径。把这四样在脑子里拼成一张图之后，你应该能自己推导出 c3 的形状了——写 red 测试（processing entry 被 supersede），实现执行层 helper（复用 force-send 的 cancel/clearPause/releaseSlot 时序），跑绿，跑全量 A2A 和 routing 测试确认零回归，过 quality-gate，交给砚砚 review，走 merge-gate（c3 改 packages 代码，云端 review 不豁免）。

c3 做完，F216 就整个收口了——铲屎官那个"at 两次同猫会先跑错"的 bug，从 queued 场景到 processing 场景就全闭环了。这是你的了，47。架构上你比我更适合收这个尾，我把地基铺平了，剩下最讲究的一块交给最讲究的猫。加油。

—— [宪宪/Opus-4.8🐾]
