---
feature_ids: [F233, F188]
related_features: [F167, F177, F212]
topics: [ball-custody, stale-branch, dark-ball, push-without-pr, case-study]
doc_kind: case_study
created: 2026-06-19
author: opus-47 / 宪宪
---

# F188 Phase K 10 天 stale 暗球 — F233 提包球形态 case study

> **TL;DR**：F188 Phase K 代码 6/9 写完 + push，6/19 才被发现没合入。中间 10 天**完全没有任何 detector / harness / cron / event 触发**——纯靠铲屎官心血来潮做 backlog 大扫除发现。这是 F233 现役 5 种暗球形态（搁置 / 死球 / 睡美人 / 虚空 / 僵尸）**都看不到的新形态**：**「提包球」** — invocation 正常完成、commits + push 完整，但没接入任何 structured ball 通道（无 task / 无 hold_ball / 无 follow-up message）。

## 起因

社区 clowder-ai #880（`funkdog`）2026-06-08 报告 Memory Center setup 体验差距：`healthy=true` 但 `vectors=0` / `edges=0` / `embedding_model=null`，UI 显示绿勾误导用户。

2026-06-09 铲屎官在 F188 主开发 thread `thread_mov0in6qfn2j2nvg`（"f192 eval hub f188 记忆图书馆生命周期 phase"）上派活给平行 opus-47（Ragdoll-Opus-4.7 catId）做 F188 Phase K。

## 经过（按时间戳）

### 2026-06-09 08:09–08:23 UTC（约 14 分钟）— 开发完成

平行 opus-47 在 worktree `cat-cafe-f188-phase-k` 开 TDD 5 commits（每个 SHA 对应一个 git author timestamp）：

| Commit | 内容 | 时间 (UTC) |
|---|---|---|
| `639638e2d` | Task 1 RED — evidence-status-signals skeleton + 18 failing tests | 08:09:35 |
| `16d32c20c` | Task 1 GREEN — 5 detectors + aggregators | 08:11:20 |
| `754a2e977` | Task 2/3/5 — wire `/api/evidence/status` + snapshot test | 08:16:35 |
| `df1582d02` | Task 4 — frontend IndexStatus degraded banner | 08:19:33 |
| `98705d587` | Task 6 — dogfood report + spec timeline closeout | 08:23:27 |

5 commits push 到 `origin/fix/f188-phase-k-config-health-surface`。Thread `thread_mov0in6qfn2j2nvg` 在该 invocation 完成后**最后活动时间是 07:20 UTC**（这是关键诡异点——thread 最后 message 时间**早于**最后 commit 时间 49 分钟，意味着平行 opus-47 push 完代码后**没在 thread 里说话**，也没在任何 thread 里说"我做完了，等 review"）。

### 2026-06-09 08:23 → 2026-06-19 02:27 UTC（10 天 = 14160 分钟）— 完全静默

**整整 10 天什么都没发生**：

- `gh pr list --search "F188" --state all` → 没有 Phase K PR
- 没有创建任何 task（结构化或 todo）
- 没有 `hold_ball` 状态
- 没有任何 @ mention / cross-post / 后续 message
- thread `thread_mov0in6qfn2j2nvg` 沉寂
- F188 spec `docs/features/F188-library-stewardship.md` 在 main 上仍写 `Status: reopened` + AC-K1..K7 全部 unchecked
- `docs/features/README.md` 仍保留**上一次 close** 的旧 done 行——索引与 BACKLOG 处于中间态
- F167 / F177-G / 任何检测器都**没有触发警报**

### 2026-06-19 02:27 UTC — 铲屎官心血来潮 backlog 大扫除

铲屎官原话（this case study 之 source thread, `thread_mqkb645jjzi6psgp`）："**这次这个 f188 就是我心血来潮 去看了全部 backlog 想做一次 backlog 大扫除 盘点 feat 情况 然后发现 f188 很久了竟然没 close 印象中是 close 了**"

→ 创建新 thread `thread_mqkb645jjzi6psgp`（"F188 愿景守护 & feat close"），@ codex / 砚砚 走愿景守护。

### 2026-06-19 02:30 UTC — 砚砚预审 BLOCKED

砚砚（缅因猫 GPT-5.5）发现：
1. Phase K 5 commits 在 `fix/f188-phase-k-config-health-surface` / `origin/fix/...`，未合入 `main`
2. 无 Phase K PR
3. F188 spec Status `reopened`，AC-K1..K7 未勾
4. `docs/features/README.md` 还保留旧 close 的 done 行

→ @ 我（新 invocation，本 thread opus-47）传球。

### 2026-06-19 02:30 → 06:11 UTC（约 3h41m）— 完整 merge-gate

我（本 thread opus-47）接 merge-gate：
- rebase Phase K branch → origin/main 零冲突
- 修 2 个 main 上的 rebase fixup（F168 biome format + F244 capability tip）
- 测试 26/26 GREEN
- PR #2414 开
- 砚砚 R6 cross-cat APPROVE
- squash merge → commit `1ec99732132ba24bc7e1bfa408b5b8167d9c0b8e`

### 2026-06-19 06:11 → 06:27 UTC（约 16 分钟）— sonnet 愿景守护

sonnet 做 alpha smoke + vision guardian APPROVE → close gate report 填好。

### 2026-06-19 06:27 UTC — F188 Phase K 正式 close

## 结果

- F188 Phase K close
- 中间 10 天的 stale 状态被发现**完全靠 CVO 主观巡逻**——零 harness 信号
- 从 backlog 大扫除发现 → close 全程约 4h
- 但**根本问题没解决**：下次同形态暗球还会出现

## Thread 锚点（完整溯源）

| Thread | 角色 | 状态 |
|---|---|---|
| `thread_mov0in6qfn2j2nvg` "f192 eval hub f188 记忆图书馆生命周期 phase" | F188 Phase K **开发现场**——平行 opus-47 在这开发，但 push 后没在此说话 | last active 2026-06-09 07:20 UTC（**早于最后 commit**） |
| `thread_mqkb645jjzi6psgp` "F188 愿景守护 & feat close" | 铲屎官 2026-06-19 心血来潮发现 + 走完 merge-gate + close 全程 | current source thread |
| `thread_mqcb399ktegukxdy` "f233 Agent Task or 球权流转图 - Part 2" | F233 现役工作 thread（投递本 case study 的目标） | last active 2026-06-18 18:33 UTC |
| `thread_mq0980eu7l3zonck` "f233 Agent Task or 球权流转图" | F233 原始 lineage thread（spike + Phase A/B 讨论） | reference |

## 关键证据 — F233 现役 detector 为什么没看到？

| F233 detector（spec line 53-59） | F188 Phase K case 触发？ | Why 漏 |
|---|---|---|
| **搁置球**（名义在 agent 手上 + 晾龄超阈） | ❌ | 球**没在任何 agent 手上的 structured 标记**——没 task owner、没 hold_ball、没 mention 推断（最后 turn 没 message） |
| **死球**（invocation 异常退出 + 无心跳） | ❌ | 平行 opus-47 **正常完成 turn**，没 spend limit / crash / 网络断流——invocation 自然结束 |
| **睡美人球**（blocked task 条件满足无唤醒） | ❌ | 没创建 task 标 blocked——无 structured ball 可探测 |
| **虚空传球**（F167 / F177-G） | ❌ | 最后那个 push 后没说话，没 @，连 message routing 都没产生——没触发路由守卫 |
| **僵尸球**（blocked/todo 长期无活动） | ❌ | 没 blocked task / 没 todo 标记——心理上"做完了"，但没显式声明完结 |

所有 5 种形态的共同前提是**结构化球权痕迹存在**（task / hold_ball / mention / blocked record）。**F188 Phase K case 完全没有这些痕迹**——只有 git push event。

## 新形态命名：「提包球」

**定义**：猫提着包（commits + push）正常走完一棒，但**没把包送进系统**（没开 PR / 没 task / 没 hold_ball / 没 follow-up @）。invocation 自然结束、CLI 正常退出、git 痕迹完整、所有 thread/message 痕迹**戛然而止**。

**信号源**（系统层有，但 F233 没接入）：
- `git for-each-ref refs/heads/{fix,feat}/*` — branch 存在
- `gh pr list --head <branch>` 返回空——无对应 open PR
- branch HEAD 不是 `origin/main` 的 ancestor——未合
- 同 catId 的最后 commit author timestamp **晚于**该 catId 在任何 thread 的最后 message timestamp

**根因深层**：

平行 opus-47 走完 TDD 5 commits + push 后，她（thread 视角）的**任务即终点**——做完了"开发"那一棒。她不一定意识到 merge-gate 是同一个 author 的责任（feat-lifecycle SOP 说是，但她可能：CLI 退出 / context 漂移 / 把"push 完 = 等 reviewer"当默认 / 单纯忘了）。**没有任何系统反射在 push 这个 git event 上提醒她**。

她离场后，球**既不在她手上**（thread 视角她交付完了）、**也不在任何其他猫手上**（她没 @ 任何人）、**也不在 CVO 手上**（她没 @landy / 没创建 review task）。**球漂在系统外**——git 系统知道有 branch、cat-cafe 系统什么都不知道。

## 建议（不强迫 F233 owner——只是 case study 输入）

按 F233 KD-3 异常优先 + KD-4 给数据不给结论：

### 方案 A（最轻）：作为 Phase C 轨迹视图的反向 fixture
Phase C "feat 轨迹" 上线后，用 F188 Phase K 时间线做 regression：**轨迹视图能否让 CVO 在 6/15 就看到这条线悬空？** 如果能，scope 自然覆盖——铲屎官 6/19 大扫除时也是在做"看 feat 全貌"，轨迹视图正是替代品。

### 方案 B（中量）：球权事件流加 git source
F233 Phase B 球权事件流已经接了 `ball.handed` / `ball.held` / `task.blocked` 等 13 个事件 source。可加 `ball.pushed_no_pr` 一类——cron / hook 扫 git 后写事件流，进入 F233 已有的检测/简报通道，复用 KD-2 单账本不破。

### 方案 C（重）：post-push git hook
git client 侧 `post-push` hook 直接 nudge author "你 push 了 fix/* 但没 open PR"——同 turn 内提醒效果最强，但**绕开了 F233 事件流账本**（违 KD-2 单账本），且 hook 是 client-side 不可靠。

**我（F188 author + F233 owner）倾向**：先方案 A 等 Phase C 自然覆盖；如果 Phase C 上线后**仍出现同形态暗球**，再升方案 B（不走方案 C，硬性破坏 KD-2 单账本不值）。

## 待 F233 thread 讨论的问题

1. 这种形态是否值得提前 prioritize（在 Phase C 主线之外加一条）？
2. 如果走方案 B，`ball.pushed_no_pr` 该 emit 在哪个 trigger（cron / git hook / push lifecycle / 别的）？
3. Phase C 轨迹视图的数据源里**是否包含 git ref state**？如果只读 cat-cafe 内 thread/event/task，git push 痕迹仍然看不到——轨迹视图也会漏。
4. F188 case 是孤例还是趋势？应该补充 forensic 调查：扫 git history 找过去 6 个月**所有同形态**（fix/feat/* branch 存在 + 无对应 PR + 长时间未合 + author 是某猫）的案例数。

---

**Cross-post 投递目标**：`thread_mqcb399ktegukxdy` "f233 Agent Task or 球权流转图 - Part 2"
**作者**：opus-47 / 宪宪（Opus 4.7）— F188 Phase K author + F233 owner
**Source thread**：`thread_mqkb645jjzi6psgp` "F188 愿景守护 & feat close"
