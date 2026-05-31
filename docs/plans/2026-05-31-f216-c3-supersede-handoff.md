---
feature_ids: [F216]
topics: [a2a, routing, handoff, supersede]
doc_kind: handoff
created: 2026-05-31
---

# F216 c3 (supersede) 交接资料

> **写给**：接手 F216 c3 的 fresh session（opus-48 自己 / opus-47 / opus-46 均可）。
> **写的人**：opus-48（F216 owner，做了 c0–c1.3 + c2，本 session 已严重污染，故交接）。
> **真相源**：`docs/features/F216-route-serial-refactor.md`（Phase D + AC-D1~D4）。本文件是导航 + 设计意图，**所有 SHA / 行号 / 文件状态请你自己用命令查真值，不要信本文写的任何数字**（写的人这个 session 反复 phantom-SHA，见末尾教训）。

## TL;DR — 你要接什么

F216 是把 `routeSerial`（2300+ 行）的 A2A 路由判断收口成纯决策函数 + 修一个铲屎官报的 bug。
- **bug 原话**：「post msg at 了两次同一只猫 → 第一条先执行（可能错误行动），第二条又独立执行」。期望：后一条才是真实意图，不能让目标猫先跑错第一步。
- **已完成（你不用碰）**：
  - queued-merge（第一条还 `queued` 没开跑时合并）— PR #1971 已合入
  - c0–c1.3（caller-scope fix + `resolveRoutingDecisions` 纯决策函数 + inline-mention 接线）— PR #1987 已合入
  - c2（queue-pending/deferred 路径接入决策函数）— PR #1991 已合入
- **你要做的 = c3 = supersede**：bug 的**主场景**——第一条 at **已经 `processing`（在跑）**时，第二条同 turn handoff 来了，正确解是 **abort 正在跑的 + 用 follow-up 重启（last-wins）**，不重跑被 supersede 的第一条。

## c3 的设计意图（feature doc Phase D 已收敛）

AC-D1~D4（去 feature doc 读原文 + 自己核状态）：
- **AC-D1**：processing 中的 target 收到同 turn follow-up → abort 正在跑的 + 用 follow-up 重启，不重跑第一条
- **AC-D2**：abort+restart **不引入 `processingSlots` mutex race** —— 复用 **force-send 已验证模式**（`cancelInvocation` + `clearPause` + `releaseSlot`，去 `messages.ts` grep force-send 路径找真实行号）
- **AC-D3**：真实 runtime 验证——猫连发两条矛盾 handoff 给同一猫，目标只执行最终意图
- **AC-D4**：queued-merge（已交付）零回归——`a2a-coalesce` / `callback-a2a-trigger` 测试全绿

## 关键坐标（自己 grep 真值，别信我写的行号）

1. **当前 interim 行为在哪**：`packages/api/test/a2a-coalesce.test.js` 里有个 `INTERIM: second handoff to a PROCESSING cat is enqueued as a follow-up (not lost, not aborted)` 测试——这是 c3 要**升级**的契约（interim = 不 abort、排队跟跑；c3 = abort 重启）。grep `INTERIM` 找到它。
2. **supersede 决策归属（砚砚 OQ3 已定）**：supersede 的 **abort+restart 是执行层 helper**，**不进** `resolveRoutingDecisions` 纯决策函数（副作用不进决策函数，否则纯函数变上帝函数）。决策函数最多产出一个 `supersede` 决策类型，真正的 abort/restart 在执行层 apply。
3. **复用而非新造**：force-send（`messages.ts` 里的强制发送路径）已经有 `cancelInvocation` + `clearPause` + `releaseSlot` 的验证过的时序。c3 复用它，不要自己写一套 abort-resume。
4. **找入口**：`callback-a2a-trigger.ts` 的 Guard 2（`findInFlightAgentEntry` + `coalesceContentIntoQueuedAgent`）—— 当前 `processing` 分支走的是"enqueue follow-up（interim）"，c3 改这里的 `else`（processing）分支为 supersede。

## 硬约束（F215 + LL-064 踩坑知识，必须遵守）

1. **一次改对坐标系，不堆补丁**（硬约束 #2）。abort→slot cleanup→pause→resume 是一套时序，和 `routeSerial` / `QueueProcessor` 的 abort-resume 坐标系**同源**。
2. **mutex race 是最大坑**：独立硬接 abort 会和后台 `executeEntry` cleanup 抢 `processingSlots` mutex = LL-064 式堆补丁。这就是为什么 c3 要复用 force-send 的验证过模式，而不是新写。
3. **TDD red→green**：c3 是改行为（不像 c2 是结构保持）。必须有真正的 red→green 测试——processing 中的 entry 被 abort、follow-up 重启、第一条不重跑。这个测试 stash fix 后必须真的 fail。
4. **跨族 review**：改核心路由/invocation 路径，砚砚（@codex，GPT-5.5）跨族 review 强制。他这条线 review 了 c0-c1.3 + c2 共 5 轮，最懂这套，找他。

## 接手 SOP

1. 开 worktree off **最新 origin/main**（c2 已合入，main 是干净的，自己 `git fetch` 核 HEAD）。
2. 先读：`docs/features/F216-route-serial-refactor.md`（Phase D + AC-D） + `a2a-coalesce.test.js` 的 INTERIM 测试 + `callback-a2a-trigger.ts` Guard 2 processing 分支 + `messages.ts` force-send 路径。
3. 写 red 测试（processing entry 被 supersede）→ 实现执行层 helper → green → 全量 A2A/routing sweep 零回归。
4. quality-gate → 砚砚 review → merge-gate（含云端 review，c3 改 packages 代码不豁免）。

## ⚠️ 本 session 的操作教训（你务必警惕，已写进 memory `feedback_phantom_ids_and_env_misdiagnosis`）

写这份资料的 opus-48 session 在 c2 阶段错误密度失控，**全是操作层错误（不是架构理解错）**——你做 c3 时别重蹈：
1. **phantom SHA/PR号**：手打 SHA/PR号反复出错。铁律：任何 SHA/PR号发出前从命令输出取真值（`git rev-parse` 存变量、`gh pr view --json headRefOid`），**绝不手写**。
2. **不信第一手输出，凭印象答**：`git status` 明明返回 `0` 脏文件，还凭过时印象编"还有 N 个脏文件"。铁律：报状态前看**当前这次**命令输出，不信记忆。
3. **commit 不核实**：`git reset --soft` 后混合 staged 态，`git commit` 漏掉 unstaged 改动 + 整个测试文件，没核就声称"修完了"。铁律：commit 后必 `git show HEAD:<file> | grep <关键改动>` 坐实改动真进 commit object。
4. **commit message 含反引号/括号代码片段 → 用 `git commit -F <file>`，不用 `-m`**（`-m` 里的代码片段被 shell 解析成命令，exit 127 整批 cancel）。
5. **误判工具通道"暗了"**：工具正常返回但误读成空 → 想 hold/重启。铁律：先 sentinel 探针（`printf 'EXACT_xyz\n'`）自证，探针正常就回头查自己命令语法，不甩锅环境。

这些教训的根因是 context 污染 + 操作不核实，**不是**对这套代码的理解错——砚砚三轮 review 里 opus-48 的架构判断全对，错的全是 git/SHA 操作。所以 c3 的**架构理解可以信本文档**，**操作细节必须自己核**。

—— [宪宪/Opus-4.8🐾]
