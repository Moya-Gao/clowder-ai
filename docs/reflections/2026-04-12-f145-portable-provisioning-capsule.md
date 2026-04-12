---
capsule_id: "F145-FINAL-2026-04-12"
context: "F145 愿景守护与 feature close"
feature_ids: [F145]
doc_kind: capsule
created: 2026-04-12
---

## What Worked
- 用 resolver-backed 声明式能力替代机器态绝对路径，先把 Pencil 这条最真实的痛点链路打通。
- Phase C/D/E 把同一套 portable 思路延伸到 ACP：内置 cat-cafe MCP 自动 provision、stale override 自动清理、用户项目 `.mcp.json` per-invoke merge。
- `requires_mcp` + `pnpm mcp:doctor` 把“能不能用”从隐性状态变成一条命令可验证的 readiness 报告。

## What Failed
- 最后一个 phase 合入后，spec 仍停在 `in-progress`，`BACKLOG.md` 和 `docs/features/README.md` 也没有同步收口，真相源漂移了。
- 中途多次把 F149 的 ACP runtime/watchdog 问题和 F145 的 portable provisioning 问题缠在一起，增加了 completion 判断噪音。

## Trigger Missed
- Phase merge 的 Step 7.5 只覆盖 phase 级同步，不等于 feature completion；最后一棒没有立刻补 `feat-lifecycle` completion。
- 一度把 AC 打勾当成 close 依据，而不是先回到铲屎官原始痛点核对“新机器 / 社区项目”两条主诉求是否真的被解决。

## Doc Links
- [F145 spec](../features/F145-mcp-portable-provisioning.md)
- [F041 capability dashboard](../features/F041-capability-dashboard.md)
- [F149 ACP runtime operations](../features/F149-acp-runtime-operations.md)

## Rule Update Target
- `cat-cafe-skills/feat-lifecycle/SKILL.md` §Completion：补一条显式提醒——“最后一个 phase merged 不等于 feature done；必须在同一轮同步 Status/Completed、BACKLOG 移除、features/README completed table。”
