---
capsule_id: "F125-2026-03-16"
context: "Alpha 验收通道（基础设施 + SOP/提示词）完成后的反思"
feature_ids: [F125]
doc_kind: capsule
created: 2026-03-16
---

## What Worked
- 先把基础设施层（Phase A）和流程规则层（Phase B）拆开是对的。alpha worktree、命令面、端口隔离先落地，后续再把 SOP / 提示词收口，范围清晰，review 也更聚焦。
- 本地 peer review + 云端 review 的双层闭环有价值：Phase A 的 mailbox frontmatter 漏项和 Phase B 的“未合入改动也能用 alpha 取证”措辞矛盾都在合入前被拦住了。
- `pnpm alpha:start / sync / status` 作为正式入口落到 main 后，铲屎官可以直接用一条命令拉起隔离环境，运行心智比原来的“main-test 临时分支”稳定很多。

## What Failed
- 我们一开始把 alpha 的使用边界写错了：alpha 是 `origin/main` 镜像，只能给已合入 main 的改动背书，不能给未合入分支背书。这说明流程文案在落盘前没有和基础设施语义做最后一次一致性核对。
- Phase A 的 review 请求信最初没有 YAML frontmatter，被 docs index pipeline 直接跳过。这个问题不大，但暴露出 mailbox 文档规范还没有在模板层彻底兜住。
- alpha 第一次被铲屎官直接拿来启动时，`--quick` 默认行为把“首次缺 dist 需要先构建”这个坑露了出来，说明我们虽然把主路径做通了，但首次使用体验的兜底还不够强。

## Trigger Missed
- 在 Phase B 提 review 前，应该主动做一次“规则文案 vs 脚本语义”的交叉核对，而不是等 reviewer 指出“alpha = origin/main 镜像”和“未合入改动优先用 alpha”互相打架。
- 在 Phase A 第一次新增 mailbox 文档时，应该直接套 frontmatter 模板，而不是默认沿用历史无 frontmatter 文档习惯。
- 在 alpha 命令正式面向铲屎官后，应该提前从“首次使用”路径试跑一次，而不是只验证“已有 worktree / 已有 dist”的路径。

## Doc Links
- Feature spec: `docs/features/F125-alpha-test-channel.md`
- Phase A PR: https://github.com/zts212653/cat-cafe/pull/475
- Phase B PR: https://github.com/zts212653/cat-cafe/pull/476
- Reflection close-up: `docs/reflections/2026-03-16-f125-alpha-channel-capsule.md`

## Rule Update Target
- `cat-cafe-skills/request-review`: review 请求信模板默认带 frontmatter，避免新 mailbox 文档再次掉出 docs index。
- `CLAUDE.md` / `AGENTS.md` / `GEMINI.md` / `docs/SOP.md`: 提到 alpha 时始终明确“alpha = origin/main 镜像，只验证已合入 main 的改动”。
- `scripts/alpha-worktree.sh` 或其后续文档：首次使用遇到缺少构建产物时，考虑自动降级到非 quick 路径或给出更明确提示。
