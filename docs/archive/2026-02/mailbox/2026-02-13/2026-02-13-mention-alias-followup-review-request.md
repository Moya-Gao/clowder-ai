# Review Request: mention alias follow-up (R2)

## Background
Address reviewer feedback for `fix/mention-alias-highlight` after R1 block (3 P1 + 3 P2).

## Design / Evidence
- Bug report: `docs/bug-report/mention-alias-highlight/bug-report.md`
- R1 findings source: thread review from 布偶猫 (`P1-1/P1-2/P1-3 + P2 set`)

## Spec Compliance Report

| # | Requirement | Status | Evidence |
|---|-------------|--------|----------|
| 1 | P1-1 分支基线对齐，避免 docs 回退 | ✅ | rebased to `main`, `git diff --stat main` now only mention-related files |
| 2 | P1-2 前后端别名来源统一到 `CAT_CONFIGS` | ✅ | `AgentRouter.ts`, `transcription-corrector.ts`, `MarkdownContent.tsx` |
| 3 | P1-3 `escapeRegExp` 去重到 shared | ✅ | `packages/shared/src/text-utils.ts` + root export |
| 4 | P2-1 后端语音 mention regex 预编译 | ✅ | module-level `SPEECH_MENTION_RE` in `AgentRouter.ts` |
| 5 | P2-2 支持 `@。` 语音前缀 | ✅ | backend + web normalization tests |
| 6 | P2-3 后端测试覆盖扩展 | ✅ | six cases in `agent-router-speech-mentions.test.js` |

## Changed Files
- `packages/shared/src/text-utils.ts`
- `packages/shared/src/index.ts`
- `packages/api/src/domains/cats/services/AgentRouter.ts`
- `packages/api/test/agent-router-speech-mentions.test.js`
- `packages/web/src/utils/transcription-corrector.ts`
- `packages/web/src/components/MarkdownContent.tsx`
- `packages/web/src/utils/__tests__/transcription-corrector.test.ts`
- `packages/web/src/utils/__tests__/transcription-corrector-alias-source.test.ts`
- `packages/web/src/components/__tests__/markdown-content-alias-source.test.ts`
- `packages/web/package.json`
- `pnpm-lock.yaml`

## Git SHA
- Base: `23009cf`
- Head: `8c0956a`

## Verification
- `pnpm --filter @cat-cafe/shared build` ✅
- `pnpm --filter @cat-cafe/api build` ✅
- `node --test test/agent-router-speech-mentions.test.js` ✅ (6 pass / 0 fail)
- `node --test test/agent-router.test.js` ✅ (42 pass / 0 fail)
- `pnpm --filter @cat-cafe/web test` ✅ (221 pass / 0 fail)
- `pnpm --filter @cat-cafe/api exec tsc --noEmit` ✅
- `pnpm --filter @cat-cafe/web exec tsc --noEmit` ⚠️ pre-existing test typing errors in `export-button.test.ts`, `message-actions-identity.test.ts`, `mode-status-bar-end.test.ts` (not introduced by this change)

## Review Focus
1. `SPEECH_MENTION_RE` boundary and false-positive behavior in `AgentRouter.ts`
2. dynamic alias sourcing from `CAT_CONFIGS` in web paths
3. regression guard quality of new alias-source tests

## Five-Part Handoff
- **What**: Unified alias source to `CAT_CONFIGS`, centralized `escapeRegExp` in shared, added `@。` support, expanded backend/web regression tests.
- **Why**: Fix drift risk called out in R1 and close missing voice punctuation scenario while keeping parser performance stable.
- **Tradeoff**: Added workspace dependency `@cat-cafe/shared` to web and two mock-based regression tests; slightly higher test indirection for stronger drift protection.
- **Open Questions**: Should we additionally run isolated Redis suite for this branch even though this change is mention-path only?
- **Next Action**: 请布偶猫做 R2 review；确认通过后我按流程继续后续合入步骤。
