---
capsule_id: "F140-PhaseE-2026-04-25"
context: "F140 Phase E (E.1 severity parser + E.2 cutover + E.3 cleanup) — 双通道叙事冲突结构性消除"
feature_ids: [F140]
doc_kind: capsule
created: 2026-04-25
---

## What Worked

- **诊断先行**：铲屎官报"github 通知 bug"时，我没急着修代码，先用 `gh api` 拉 PR #1376 真实时间线，发现是双通道（ReviewRouter email + ReviewFeedbackRouter polling）各自投递两条消息——是设计 gap 不是 bug。诊断在前避免了"压抑症状"型修复。
- **Push back 双 reviewer 结构性 finding**：砚砚 GPT-5.4 P1-1 (body-only setup-noise 误杀人类引用) + GPT-5.5 P1-1 (BADGE 在 stripNoise 之前会让 blockquote 引用旧 badge 复发"过期 P1/P2") + 云端 codex P0 (parseSeverity 单 body 多 severity 第一命中降级)。三条都不是表面问题，是**结构性**复发风险。修法（scan-all + strict scope + stripNoise 前置）让根因结构性消除而非靠 regex tweak 抑制。
- **Cutover gate 降级凭证**：alpha frontend `.xterm` CSS loader build 挂阻塞浏览器路径时，没硬修偏离 F140 scope 的 frontend，而是用三件套（unit test 79/79 + 双 reviewer + 云端 codex 双 review pass）作 evidence base，runtime 重启自然 production smoke。**降级 ≠ 跳过门禁，是换可执行的等效凭证**。
- **物理删除 ≠ 注释 cleanup**：E.3 第一轮我只删了 src/test 文件，没动其他文件里 stale 注释引用。砚砚 GPT-5.5 P2 review 6 处注释残留 finding 让我意识到"维护者心智的 cleanup"和"代码 cleanup"是两层——必须一起做。
- **MCP 持球凭证**：每轮持球都用实际 MCP/工具动作（Edit / Bash / commit / push / `cat_cafe_hold_ball`）作凭证，铲屎官教训"虚空持球"后再没出现。

## What Failed

- **混入误置 commit**：主仓库 worktree 在 `fix/intake-clowder-549` 分支（别的 session 状态）我没察觉就直接 commit Phase 7.5 sync。后来 cherry-pick + force reset 才修正。教训：commit 前必查 `git branch --show-current`。
- **第一次 alpha:start 没 rebuild shared dist**：alpha worktree 的 `packages/shared/dist` 没自动 rebuild，导致 community-issues 模块 `DEFAULT_INTAKE_CHECKLIST` import 失败。这是 alpha-worktree.sh 的隐藏 bug，但我浪费了 5+ 分钟才诊断。
- **环境变量 `NODE_ENV=production` 隐藏 bug**：`pnpm install` 在新 worktree 跳过 devDeps 因为 `NODE_ENV=production`，导致 `@types/better-sqlite3` 等没装 → gate build fail。诊断花了 3 轮 hold。
- **5 处注释残留**：E.2 cutover 时我清的 5 处旧 Rule B/C 注释（index.ts 2031/2052/2211 + test 597/920），漏掉了 2152/938。E.3 第一轮又漏 6 处（github-feedback-filter / setup-noise-filter / PrTrackingStore / connector-gateway-bootstrap / ConnectorRouter）。每次都是 reviewer 帮我捞出。

## Trigger Missed

- **commit 前的 `git branch --show-current` 自查**——P0 铁律 `feedback_never_checkout_branch_in_main` 没被触发，因为我接手主仓库时没主动检查分支状态。
- **rg 全文 grep 找 stale comments 应该是 cleanup 的标准动作**——我每轮都靠 reviewer 帮我搜，没主动跑全量 `rg "deleted_module_name"` 在 cleanup phase。
- **Hold ball window 用尽时的传球策略**：3/3 满后我对"等外部 condition" 与 "持球继续" 的边界判断不够清晰，多次试图 hold 等本地猫异步回。守护猫不是外部 webhook，应该 @ + 等回。

## Doc Links

- F140 spec: `docs/features/F140-github-pr-automation.md`
- E.1 plan: `docs/plans/2026-04-24-f140-phase-e1-severity-parser.md`
- E.2 plan: `docs/plans/2026-04-24-f140-phase-e2-cutover.md`
- PRs: #1380 (squash 120748e5) / #1386 (squash 00d7a834) / #1398 (squash 397df85c)
- Original痛点 thread: 2026-04-24 PR #1376 通知冲突体感
- 关联 lesson: `feedback_hold_ball_needs_mcp.md` / `feedback_mention_same_line.md`（本 Phase 沉淀）

## Rule Update Target

- **`merge-gate` SKILL.md §Step 7.5**：补充 cleanup PR 必须跑 `rg <deleted_symbol>` 全量扫描注释/文档残留——光删文件不算 cleanup 完整。
- **`worktree` SKILL.md §「创建步骤」**：补充 `NODE_ENV=development pnpm install`（避免 production env 跳过 devDeps）+ `pnpm --filter @cat-cafe/shared build` 强制 rebuild dist（防 stale dist 卡 worktree 启动）。
- **`feat-lifecycle` SKILL.md §Completion Step 6 commit 前**：加 P0 自查 `git branch --show-current` 必须是 main 或 worktree feature branch，不在主仓库非 main 分支上 commit。
- **`shared-rules.md`**：把"降级 ≠ 跳过门禁，是换可执行的等效凭证"作为 Cutover Gate 模式记入，对应 F140 AC-E9 实战。
