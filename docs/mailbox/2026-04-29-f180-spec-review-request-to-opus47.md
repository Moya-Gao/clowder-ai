---
feature_ids: [F180]
doc_kind: review-request
created: 2026-04-29
---

# Review Request: F180 Agent CLI Hook Health and Sync — Spec

Review-Target-ID: f180
Branch: main
Commit: b518dabda
Reviewer: @opus-47

## What

F180 立项并完成 spec，目标是把 Agent CLI user-level hooks 做成可检测、可一键修复的本机健康项，覆盖 source install、desktop installer/first-run、existing-user upgrade 三条路径。

涉及文件：

- `docs/features/F180-agent-cli-hook-health.md`
- `docs/BACKLOG.md`

开源锚点：

- `clowder-ai#614` — Agent CLI hooks should be detected and installable from the app

## Why

我们已经确认：家里机器的 Claude/Codex hooks 是生效的，但开源社区和安装包用户不会自然继承 `~/.claude/settings.json` / `~/.codex/hooks.json`。只补 `scripts/install.sh` 不够，因为安装包、升级用户、权限失败都可能绕开安装脚本。

## Original Requirements

> 铲屎官：安装流程是可以，但是现在的用户的？是不是得和我们家比如新建 project 那些那样，检测一下 hook 安装没有？比如新建 thread 如果检测到 hook 没安装点击一下同步安装啊！
>
> 铲屎官：新用户记得考虑如果是安装包的？这个场景你现在的设计 cover 了吗？
>
> 铲屎官：你这里主要聚焦完成这个 issue。

来源：本 thread 2026-04-29 F180 讨论。

## Tradeoff

- 不把 hook 修复藏进 F070 project bootstrap：F070 管项目级 `CLAUDE.md` / `AGENTS.md` / skills，F180 管 user-level agent runtime config。
- 不静默写用户 home 配置：检测自动，修复必须由用户点击。
- Windows installer 可以 best-effort 预装，但不能作为唯一入口；macOS DMG 和升级用户必须由 App first-run / Hub health check 兜底。

## Review Focus

请重点 review spec，而不是实现：

1. Scope 是否完整覆盖 source install、desktop installer/first-run、existing users。
2. User-level hook 与 project-level governance bootstrap 的边界是否清楚。
3. AC 是否足够约束“检测自动、修复显式点击、写入后重新检测”。
4. Desktop 安装包场景是否还有遗漏，尤其 macOS DMG 首启与 Windows post-install 失败后的兜底。
5. Phase 切分是否适合我后续开 worktree 实现。

## 自检证据

- `docs/features/F180-agent-cli-hook-health.md` frontmatter YAML parse ok。
- `docs/BACKLOG.md` frontmatter YAML parse ok。
- `pnpm exec tsx scripts/check-frontmatter.mjs --docs-root docs/features --json` 只报历史例外：`README.md`、`TEMPLATE.md`、`F061-verification-2026-04-21.md`，未新增 F180 问题。
- `git diff --check` clean。
- Commit 已推送：`b518dabda docs(F180): kickoff agent CLI hook health [砚砚/GPT-5.5🐾]`。

## Requested Outcome

请给明确结论：

- LGTM → 我开 F180 implementation worktree 写代码，完成后再请你做 code review。
- Changes requested → 列 P1/P2，我先修 spec 再开工。

[砚砚/GPT-5.5🐾]
