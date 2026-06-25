---
title: "Review Request: Remove DARE agent provider entirely"
date: 2026-06-25
kind: review-request
review_target_id: remove-dare-provider
---
# Review Request: Remove DARE agent provider entirely

Review-Target-ID: remove-dare-provider
Branch: fix/remove-dare-provider

## What

Complete removal of DARE (狸花猫/dragon-li) agent provider — 109 files changed, ~8000 lines deleted across:
- DareAgentService + dare-event-transform (provider implementation, 2 files)
- 7 DARE-dedicated test files (smoke, L1, unit, helpers)
- dragon-li breed definition from cat-template.json
- dare entries from 32 source files: account-resolver, catalog-accounts, env-registry, invoke-single-cat, client-detection, route configs, all UI components, color tokens
- dare avatars, F135 feature doc, plans, mailbox, discussions (6 docs + 3 directories)
- Updated 42 test files: removed dare-specific test cases, fixed count assertions, replaced dare fixture catIds with valid alternatives

## Why

DARE CLI integration was experimental (F050/F135), never reached production adoption, and has not been maintained. CVO explicitly authorized removal. Dead code removal reduces cognitive load and test surface.

## Original Requirements（必填）

> dare这个都能删了，这个东西我们已经不需要了 也没维护
- 来源：铲屎官直接指示（通过 @opus47 在 thread_mqn23ux9aff4yhuy 转达）
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

Full deletion vs deprecation-mark: chose full deletion because CVO explicitly said "都能删了" and the code has zero production users. Deprecation would leave dead code indefinitely.

## Architecture Ownership（必填）

Architecture cell: agent-providers (DareAgentService was one of many providers)
Map delta: none (deleting a provider does not change architecture boundaries)
Why: Pure deletion, no new abstractions or routing changes

请 reviewer 检查：
- diff 是否与 `Map delta` 一致
- 是否新建了并行 `Store` / `Queue` / `Router` / `Adapter` / `Dispatcher` / `Binding`
- 若修改 `docs/architecture/ownership/cells/*.md`，是否确实改变了 owner / boundary / extension point / canonical anchor

## Open Questions

### 技术 OQ（给 reviewer）

1. **Count assertion updates**: client-detection count 6→5, game-thread catIds 需 7 个 actor 改为加了 'kimi'。是否正确？
2. **Fixture replacements**: route-strategies 的 `offeredBy: 'dare'` 改为 `offeredBy: 'gemini'`，game tests 的 dare player 改为 kimi/sonnet/opus。替代选择是否合理？
3. **use-collapse-state.test.ts**: 保留了 `/proj/dare` 路径字符串（非 DARE-agent 引用，仅测试路径名）。是否同意保留？

### 价值 OQ（给 CVO，如有）

无 — CVO 已明确授权删除。

## Next Action

请 reviewer 验证：
1. 零残留 dare 引用（`grep -rn '\bdare\b' packages/ scripts/ --include='*.ts' --include='*.js' | grep -v node_modules | grep -v dist | grep -v __tests__`）
2. Build 通过 (`pnpm --filter @cat-cafe/api run build`)
3. 关键测试 pass（`pnpm --dir packages/api exec node --import ./test/helpers/setup-cat-registry.js --test --test-timeout=60000 test/cat-catalog-store.test.js test/client-detection.test.js test/game-thread.test.js test/env-map.test.js`）
4. 删除范围合理（不多删、不少删）

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/remove-dare-provider/gpt52`
- Start Command: N/A — 无前端 UI 改动需运行验证，纯删除 + build/test 验证
- Ports: N/A

## 自检证据

### Spec 合规

CVO 原话 "dare这个都能删了" → 全删 → 对照通过。

### 测试结果

```
pnpm --filter @cat-cafe/shared build    # ✅ 
pnpm --filter @cat-cafe/api build       # ✅ (tsc clean)
pnpm biome check                        # ✅ (0 errors in our diff)

# DARE-adjacent tests (12 test files, 440 tests):
# 434 passed, 6 failed (all 6 pre-existing on main — verified by running same tests on main)
# Pre-existing failures: route-strategies thread-scoped, cats-routes-runtime-crud workspace, 
#   client-detection (2), game-thread god-view → ALL verified failing on main too
```

### 相关文档

- Feature: F135-dare-ootb (deleted in this PR)
- Feature: F050-a2a-external-agent-onboarding (historical reference, not deleted)

如果判断错了我最可能错在：
1. 某个 test fixture replacement（dare→kimi/gemini/opus）引入了语义上不等价的行为
2. color-audit-report.json 编辑可能有 JSON 语法残留
3. 遗漏了某个不含 `dare` 关键字但依赖 dare provider 存在的隐式引用

[宪宪/Opus 4.6🐾]
