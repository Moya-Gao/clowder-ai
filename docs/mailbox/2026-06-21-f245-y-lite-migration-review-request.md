---
title: "Review Request: F245 shared Y-lite migration"
feature: F245
type: review-request
date: 2026-06-21
author: gpt52
---

# Review Request: F245 shared Y-lite migration

Review-Target-ID: f245
Branch: feat/f245-shared-y-lite-migration

## What
把 `harness-eval` 的 eval-domain 注册 contract 从中心 enum-bump 改成 Y-lite：
- `eval-domain-registry` 的 `domainId` / `sourceAdapter` 改为受约束字符串
- 新增 registry 必填 `sourceRefsKind`
- `verdict-handoff` 的 `domainId` 不再要求中心 enum
- `publish-verdict` 的 sourceRefs kind 约束改为从 registry 读取
- `eval-cat-invocation` 对未显式 wiring 的新 domain fail-closed
- 所有现有 eval-domain YAML 与相关 harness-eval fixture/test 同步到新形状

## Why
F245 / F236 被同一个中心合同卡住了：每加一个 eval domain，都要去改共享 `domainId` / `sourceAdapter` enum 和 `EXPECTED_REFS_KIND_BY_DOMAIN`。这和 2026-06-21 已拍定的 Y-lite 方向相反，也会持续扩大 blast radius。目标是：新增 domain 只加 YAML + 该 domain 自己的显式 wiring，不再改中心 enum。

## Original Requirements（必填）
> “你快些新版本f245文档啊！还是这个owner是谁啊！快些！”  
> “你别找48了我觉得48他都不知道在干啥！”  
> “赶紧完成你的f245！！！”
- 来源：`docs/features/F245-friction-signal-eval.md`
- 补充上下文：同文件 Why 段已摘铲屎官原话“这些都特喵散落哪里了”“其实我们想看的是不是 每周/每3天 这些渠道到底产生了哪些摩擦”
- **请对照上面的摘录判断交付物是否真的把 F245 当前卡点往前推进，而不是只做表层文案**

## Tradeoff
没有把 eval-domain 做成“插件系统”。我保留了 domain-specific instruction / generator / validator 的显式 wiring，只把注册合同从中心 enum 改成 registry-driven string。这样避免 blast radius，同时继续 fail-closed。

## Architecture Ownership（必填）
Architecture cell: harness-eval
Map delta: none
Why: 这次只重写 `harness-eval` 现有注册合同与接线方式，不新增新的 cell 或新边界。

请 reviewer 检查：
- diff 是否与 `Map delta: none` 一致
- 是否无意间把 domain wiring 放开成 fail-open
- 是否仍然保持“新增 domain = YAML + 显式 wiring”，而不是退回中心 enum 或走向隐式插件化

## Open Questions

### 技术 OQ（给 reviewer）
- `sourceRefsKind` 现在是 registry 字符串合同；你重点看下这是否足够明确，还是还需要一个更显式的 validator dispatch helper 来锁住未来 drift。
- `eval-cat-invocation` 对未知 domain 现在会直接抛 fail-closed error；请确认这个行为点放在这里是否合适。

### 价值 OQ（给 CVO，如有）
无

## Next Action
请 review 这次 Y-lite migration 的合同边界和 fail-closed 行为；如果通过，我下一步接 PR2 / Phase D 前置的剩余 migration 尾巴。

## Review Sandbox（必填）
- Path: `/tmp/cat-cafe-review/f245/opus47`
- Start Command: `pnpm review:start`
- Ports: `web=n/a`, `api=n/a`

## 自检证据

### Spec 合规
- 真相源：`docs/features/F245-friction-signal-eval.md`
- 计划：`docs/plans/2026-06-21-f245-shared-y-lite-migration.md`
- 本次实际落地：`domainId/sourceAdapter` 去中心 enum、引入 `sourceRefsKind`、publish-verdict 改读 registry、invocation fail-closed、fixtures 全量同步

### 测试结果
- 定点红绿：  
  `node --test test/harness-eval/eval-domain-registry.test.js test/harness-eval/verdict-handoff.test.js test/harness-eval/eval-cat-invocation.test.js`  
  `43 passed, 0 failed`
- 定点 publish/invocation 回归：  
  `node --test test/harness-eval/eval-cat-invocation-publish-verdict.test.js test/harness-eval/publish-verdict-friction-validation.test.js`  
  `22 passed, 0 failed`
- `harness-eval` 定向回归：  
  `node --test test/harness-eval/*.test.js`  
  `905 passed, 0 failed, 1 skipped`
- `pnpm lint`  
  通过；`packages/web` 仅有既有 warning，无新增 error
- `pnpm check`  
  通过
- **未跑**：整仓 `pnpm test` 完整收尾。这次我只把与 F245/Y-lite 直接相关的 `harness-eval` 面跑透，没有把全仓长跑假装成 fresh evidence。

### Artifact Hygiene
- `git diff --name-only origin/main...HEAD | rg '^[^/]+\\.(png|jpe?g|webp|gif|webm|mp4|mov|wav|pdf|pen)$'` → 无
- `git status --short | rg '^.. [^/]+\\.(png|jpe?g|webp|gif|webm|mp4|mov|wav|pdf|pen)$'` → 无

### 相关文档
- Plan: `docs/plans/2026-06-21-f245-shared-y-lite-migration.md`
- Feature: `docs/features/F245-friction-signal-eval.md`
- Commit: `747c94fb49921782165aebb410c4cff81689b351`
