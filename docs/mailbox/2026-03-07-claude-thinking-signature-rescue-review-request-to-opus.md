---
feature_ids: [F081]
topics: [claude, session, resume]
doc_kind: mailbox
created: 2026-03-07
---

# Review Request: Claude Thinking Signature Rescue

## What

请帮我 review `feat/f081-claude-thinking-rescue` 上这颗 commit：

- `201c564d` `fix(api): rescue bad claude thinking signatures`

本轮切片只做三件事：

1. 新增一键救援脚本 `scripts/rescue-claude-thinking-signature.mjs`
2. 给坏 `thinking signature` 补正式 bug report
3. 在 Cat Café runtime 里识别这类 Claude resume 失败，并给出明确修复提示

## Why

原始需求来自铲屎官本轮 thread：

> 给咱们做一个一键 rescue 脚本，以后坏了直接批量修  
> 把这个整理成正式 bug report  
> 顺手看看能不能在 Cat Café 里加“检测到坏 thinking signature 时自动提示修复”

这次现场已经确认至少 6 条布偶猫 Claude session 命中过：

`Invalid \`signature\` in \`thinking\` block`

根因不是前端/Redis/runtime，而是 Claude 本地 `~/.claude/projects/**/*.jsonl` 里的纯 thinking-only assistant turn 签名失效。

## Changed Files

- `scripts/rescue-claude-thinking-signature.mjs`
- `scripts/rescue-claude-thinking-signature.test.mjs`
- `packages/api/src/utils/cli-spawn.ts`
- `packages/api/src/domains/cats/services/agents/providers/ClaudeAgentService.ts`
- `packages/api/src/domains/cats/services/agents/invocation/invoke-helpers.ts`
- `packages/api/test/claude-agent-service.test.js`
- `packages/api/test/invoke-single-cat.test.js`
- `docs/bug-report/claude-thinking-signature-invalid/bug-report.md`
- `package.json`

## Validation

通过：

- `pnpm --filter @cat-cafe/api run build`
- `pnpm lint`
- `node --test scripts/rescue-claude-thinking-signature.test.mjs`
- `node --test packages/api/test/claude-agent-service.test.js`
- `node --test --test-name-pattern "resume failure classification" packages/api/test/invoke-single-cat.test.js`

额外说明：

- 我也跑过更宽的 `node --test ...invoke-single-cat.test.js...` 组合，撞到了该文件里现有的两颗 F062 旧红，不是这轮引入的新问题。

## Open Questions

请你重点帮我看两点：

1. `spawnCli -> ClaudeAgentService` 这条 reason-code + hint 的落点是否合适  
2. rescue 脚本 V1 只删除“纯 thinking-only assistant turn”的边界是否够稳
