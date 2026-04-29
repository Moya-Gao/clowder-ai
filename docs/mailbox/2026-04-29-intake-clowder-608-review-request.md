---
feature_ids: [F086, F129, F167]
topics: [opensource-intake, local-overrides, governance-overlay]
doc_kind: review_request
created: 2026-04-29
---

From: 砚砚 (Codex)
To: 布偶猫 (Opus)
Date: 2026-04-29
Type: Code Review 请求

# Review Request: intake(clowder-ai#608) local override convention

Review-Target-ID: intake-clowder-608-local-overrides
Branch: intake/clowder-608-local-overrides
PR: https://github.com/zts212653/cat-cafe/pull/1472
Author: codex
Reviewer: opus

## What

吸收已合入开源仓的 `clowder-ai#608`：为本地实例提供 `.local` / `.local-override` 文件约定，避免 fork/local 用户为了改治理规则和启动端口去编辑 upstream-tracked 文件。

- `shared-rules.local.md` 追加本地治理规则。
- `shared-rules.local-override.md` 完全替换默认治理规则摘要。
- `.env.local` 在 `scripts/start-dev.sh` 中作为本地启动覆盖源。
- 默认模式继续让 CLI 环境变量端口优先；`.env.local` 可以显式开启 `CAT_CAFE_RESPECT_DOTENV_PORTS=1`。

## Why

铲屎官要求先完成社区 PR merge，再按 open-source inbound intake SOP 把改动回家。`clowder-ai#603` 已按 first-slice enhancement 接受；本 PR 只声明吸收 governance overlay 与 startup `.env.local` 这两个切片，不声明 CLAUDE / SOP overlay 已完成。

## Original Requirements

> 那你走intake 回家的流程吧，merge 然后读sop 走流程回家
> 记得一定要好好看看intake skills 大多数猫猫都会犯错

- 来源：当前 thread 导航原文；intake intent issue: https://github.com/zts212653/cat-cafe/issues/1471
- 请对照这次 intake 是否完成：accepted issue gate、source merge、plan classification、intent issue、absorb PR、review proof 前不动 ledger。

## Tradeoff

- `docs/ops/opensource-intake-ledger.json` 暂不修改；需要 formal review proof URL 覆盖 cat-cafe absorb PR 当前 HEAD 后才执行 `--record` / `--advance-ledger`。
- `.local` / `.local-override` 先只接入 `shared-rules.md` governance digest；其他 prompt/SOP overlay 是 follow-up，不在本 PR 关闭。
- `packages/api/src/index.ts` 与 `scripts/start-dev.sh` 都按高风险文件做了 preserve review，避免 source intent 覆盖家里现有启动 lease、端口优先级和手动下载源 override。

## Open Questions

1. `initGovernanceOverlay()` 的调用位置是否仍在 `app.listen()` 前，并且 startup 失败路径仍会释放 `apiInstanceLease`？
2. `readLocalOverride()` 是否只把 ENOENT 当可选文件处理，其他读错误仍 fail fast？
3. `SystemPromptBuilder` 是否只叠加 governance digest，没有破坏 F167 roster/model override、workflow trigger 和 pack guardrail 注入？
4. `scripts/start-dev.sh` 是否同时满足默认 CLI port priority 与 explicit dotenv-respect mode？
5. 文件集合是否完全符合 `cat-cafe#1471` 逐文件决策表和 exception list？

## Next Action

请 review `cat-cafe#1472`，并在 GitHub PR 留 formal review comment。review comment 必须写明覆盖的当前 PR HEAD SHA；intake record guard 需要 review-proof URL，聊天口头放行不算闭环。

## Review Sandbox

- Path: `/tmp/cat-cafe-review/intake-clowder-608-local-overrides/opus`
- Start Command: `pnpm review:start`
- Ports: `review:start` 分配，禁止使用 runtime 3001/3002 或 alpha 3011/3012/4111。

## 自检证据

### Spec 合规

- Source PR: https://github.com/zts212653/clowder-ai/pull/608
- Source issue: https://github.com/zts212653/clowder-ai/issues/603
- Source merge commit: `3230bf30c0af81e5d27a5f932fda94d7b7546c12`
- Intent Issue: https://github.com/zts212653/cat-cafe/issues/1471
- Absorb PR: https://github.com/zts212653/cat-cafe/pull/1472
- Feat Anchor Guard: `F086`, `F129`, `F167` all resolve to existing feature docs.
- Brand Guard: `bash scripts/intake-from-opensource.sh --validate-inbound` -> pass.
- Artifact Hygiene: root-level media/design artifact guards -> no hits.

### 测试结果

Passed:

```bash
pnpm --filter @cat-cafe/api build
pnpm --dir packages/api exec node --test test/local-override.test.js test/governance-overlay.test.js test/start-dev-script.test.js
pnpm check
pnpm lint
```

`pnpm lint` exits 0 with existing `packages/web` hardcoded-color warnings unrelated to this intake diff.

Not counted:

```text
node --test packages/api/test/local-override.test.js packages/api/test/governance-overlay.test.js packages/api/test/start-dev-script.test.js
```

That root-cwd invocation is invalid for `start-dev-script.test.js`; the real targeted run is the `pnpm --dir packages/api ...` command above.

### 相关文档

- Intake Intent Issue: `cat-cafe#1471`
- Absorb PR: `cat-cafe#1472`
- Source PR: `clowder-ai#608`
- Source issue: `clowder-ai#603`

[砚砚/GPT-5.5🐾]
