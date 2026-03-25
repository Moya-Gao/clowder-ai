---
title: clowder-ai#220-#222 Intake Strategy
date: 2026-03-24
topics: [open-source, intake, clowder-ai, mcp, provider-profiles, credentials]
status: active
owner: 缅因猫-gpt5.4
---

# clowder-ai#220-#222 Intake Strategy

## Scope

本轮只处理下列三条社区 PR：

- `clowder-ai#220` `feat(TD104): URL transport support for MCP capabilities`
- `clowder-ai#221` `fix(#189): global provider profiles + migration`
- `clowder-ai#222` `fix(#197): remove process.env credential fallback from AgentServices`

明确**不**包含 `clowder-ai#223`。`#223` 仍有 `ocProviderName` 强制化但缺 migration/backfill path 的 blocker，不能和这轮一起 intake。

## Decision

### clowder-ai#220

- Merge 立场：可 merge
- Intake 立场：`absorbed`
- 吸收方式：以 source-owned shared code 为准回流家里，不保留 target-only 偏差
- 关注点：
  - `streamableHttp` discovery
  - provider gating（Anthropic-only）
  - Claude/Codex/Gemini writer serialization
- 验证要求：
  - 保留 upstream 已补的 orchestrator regression tests
  - 回家后重跑 capability orchestration 相关测试，确认没有因 source/target 差异掉 coverage

### clowder-ai#221

- Merge 立场：可 merge
- Intake 立场：`absorbed`
- 吸收方式：按 shared state / migration 变更处理，回家后由我们自己做最终收口，不盲信 target 实现细节
- 关注点：
  - known-roots registry
  - project-local -> global merge migration
  - cross-worktree delete protection
  - `provider-profiles.secrets.local.json` 权限维持 `0600`
  - provider profiles 相关 Hub UI 跟随 source truth
- 验证要求：
  - 保留 upstream 已补的 deterministic regression：
    - sibling worktree delete block
    - second project merges into existing global store
    - chmod `0600`
  - 回家后补跑 provider profile / runtime binding / invoke chain 相关测试，确认 source 侧 invocation 语义未回退

### clowder-ai#222

- Merge 立场：可 merge
- Intake 立场：`absorbed`
- 吸收方式：偏 direct absorb，但必须在 source 侧确认调用链不再依赖宿主 `process.env` fallback
- 关注点：
  - `CodexAgentService` 只信 `callbackEnv` 的 auth mode
  - `DareAgentService` 不再偷读宿主 API key
  - `OpenCodeAgentService` 不再继承宿主 API key / base URL
- 验证要求：
  - AgentService 单测口径从 `process.env` 切到 `callbackEnv` / explicit option
  - 回家后跑 invocation smoke，确认 `invoke-single-cat` 已经把所需凭证完整注入 `callbackEnv`

## Sequencing

1. 先在家里立这条 intake 策略 PR，明确三条 PR 的 merge / intake 决策边界。
2. 在 `clowder-ai` 依次 merge `#220`、`#221`、`#222`。
3. 每条 merge 之后，在家里执行对应 intake：
   - 代码吸收
   - 测试验证
   - `scripts/intake-from-opensource.sh --record --pr N --decision absorbed`
4. 三条都 record 完后，立刻执行一次 `scripts/intake-from-opensource.sh --advance-ledger`，不允许停在“只记账不推进水位”的半状态。

## Tradeoff

- `#220` 和 `#222` 都接近 safe-cherry-pick，但这轮仍按 source truth 再验一遍，不把 target 侧结果直接当终态。
- `#221` 已经代码面转绿，但它改的是全局存储 + 迁移 + worktree 引用保护，风险等级高于普通 patch；回家后我们自己再做一次完整收口是必要成本，不是重复劳动。
- 这轮不顺手 intake `#223`，避免把一个还没跑通 migration story 的契约变更带回家污染 source truth。

## Evidence Baseline

- `#220` 现已补齐 `streamableHttp` 主路径回归测试，可从“继续卡测试”转为可 merge / absorb。
- `#221` 现已补齐 second-project merge regression，不再停留在“接近绿灯”。
- `#222` 仍是小而集中的 patch，代码面无新增 blocker；风险主要在 source 侧调用链是否已彻底脱离 env fallback。
