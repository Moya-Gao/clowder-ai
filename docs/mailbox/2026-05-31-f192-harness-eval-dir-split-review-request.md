---
feature_ids: [F192]
topics: [harness-eval, refactor, review-request]
doc_kind: review-request
created: 2026-05-31
---

## Review 请求: F192 — harness-eval 目录物理结构重构

### 背景

`packages/api/src/infrastructure/harness-eval/` 下有 31 个 `.ts` 文件，超出了 ADR-010 规定的 25 文件限值，被 `dir-size` 检查拉起告警（issue #1973）。本次修改按照 Opus 的重构建议，将 22 个文件拆分到 5 个物理子域（`a2a/`, `capability-wakeup/`, `domain/`, `hub/`, `sop/`），根目录仅保留 9 个文件，彻底解决文件数超标问题。

### 铲屎官原始需求

- **Thread**: F192 #1973 (2026-05-31 07:48 UTC)
- **原始需求摘录**：
  > "好像合适测试新猫的能力？ 如果只是 纯文件移动 + import 路径更新 让gemini 3.5"
- **请 Reviewer 对照上面的摘录判断**：重构后是否在不改变任何业务逻辑的前提下，完全满足了文件限值合规要求，且测试完全通过？

### 设计方案（Opus 分组方案）

```
harness-eval/
├── capability-wakeup/     ← 移入 9 个文件
│   eval-capability-wakeup-adapter.ts
│   eval-capability-wakeup-classify.ts
│   eval-capability-wakeup-live-verdict.ts
│   eval-capability-wakeup-trace-normalizers.ts
│   eval-capability-wakeup-trace.ts
│   eval-capability-wakeup-trials-support.ts
│   eval-capability-wakeup-trials.ts
│   eval-capability-wakeup-types.ts
│   eval-capability-wakeup-verdict.ts
├── a2a/                   ← 移入 3 个文件
│   eval-a2a-adapter.ts
│   eval-a2a-artifact-resolver.ts
│   eval-a2a-live-verdict.ts
├── domain/                ← 移入 5 个文件
│   eval-domain-daily.ts
│   eval-domain-override.ts
│   eval-domain-registry.ts
│   community-eval-domain.ts
│   community-issue-packet.ts
├── hub/                   ← 移入 2 个文件
│   eval-hub-read-model.ts
│   eval-hub-thread-ensure.ts
├── sop/                   ← 移入 3 个文件
│   eval-sop-adapter.ts
│   sop-predicate-evaluator.ts
│   sop-trace-adapter.ts
├── index.ts               ← 留在根目录，更新 re-export 路径
├── attribution.ts         ← 留在根目录（跨域共享）
├── eval-cat-invocation.ts
├── eval-memory-adapter.ts
├── f167-eval.ts
├── legacy-task-cleanup.ts
├── reeval-closure.ts
├── telemetry-adapter.ts
└── verdict-handoff.ts
```

### Spec Compliance 自检

| # | Spec 要求 | 状态 | 说明 |
|---|-----------|------|------|
| 1 | 目录拆分至 sub-directories | ✅ | 已创建 5 个子目录，移动对应 22 个文件 |
| 2 | 子目录文件数 ≤ 9 | ✅ | 各子目录大小全部降到 9 个文件以内 |
| 3 | 根目录文件数 < 25 限制 | ✅ | 根目录仅剩余 9 个文件，完全合规 |
| 4 | 修改所有相对 imports | ✅ | 包括 22 个移动文件的内部引用、index.ts 的 re-export 路径、及 15 个测试文件、1 个路由文件 `eval-hub.ts`、1 个启动文件 `index.ts` |

### 改动文件

- **文件移动及内部 import 修改**:
  - `packages/api/src/infrastructure/harness-eval/{ => a2a}/eval-a2a-adapter.ts`
  - `packages/api/src/infrastructure/harness-eval/{ => a2a}/eval-a2a-artifact-resolver.ts`
  - `packages/api/src/infrastructure/harness-eval/{ => a2a}/eval-a2a-live-verdict.ts`
  - `packages/api/src/infrastructure/harness-eval/{ => capability-wakeup}/eval-capability-wakeup-adapter.ts`
  - `packages/api/src/infrastructure/harness-eval/{ => capability-wakeup}/eval-capability-wakeup-classify.ts`
  - `packages/api/src/infrastructure/harness-eval/{ => capability-wakeup}/eval-capability-wakeup-live-verdict.ts`
  - `packages/api/src/infrastructure/harness-eval/{ => capability-wakeup}/eval-capability-wakeup-trace-normalizers.ts`
  - `packages/api/src/infrastructure/harness-eval/{ => capability-wakeup}/eval-capability-wakeup-trace.ts`
  - `packages/api/src/infrastructure/harness-eval/{ => capability-wakeup}/eval-capability-wakeup-trials-support.ts`
  - `packages/api/src/infrastructure/harness-eval/{ => capability-wakeup}/eval-capability-wakeup-trials.ts`
  - `packages/api/src/infrastructure/harness-eval/{ => capability-wakeup}/eval-capability-wakeup-types.ts`
  - `packages/api/src/infrastructure/harness-eval/{ => capability-wakeup}/eval-capability-wakeup-verdict.ts`
  - `packages/api/src/infrastructure/harness-eval/{ => domain}/community-eval-domain.ts`
  - `packages/api/src/infrastructure/harness-eval/{ => domain}/community-issue-packet.ts`
  - `packages/api/src/infrastructure/harness-eval/{ => domain}/eval-domain-daily.ts`
  - `packages/api/src/infrastructure/harness-eval/{ => domain}/eval-domain-override.ts`
  - `packages/api/src/infrastructure/harness-eval/{ => domain}/eval-domain-registry.ts`
  - `packages/api/src/infrastructure/harness-eval/{ => hub}/eval-hub-read-model.ts`
  - `packages/api/src/infrastructure/harness-eval/{ => hub}/eval-hub-thread-ensure.ts`
  - `packages/api/src/infrastructure/harness-eval/{ => sop}/eval-sop-adapter.ts`
  - `packages/api/src/infrastructure/harness-eval/{ => sop}/sop-predicate-evaluator.ts`
  - `packages/api/src/infrastructure/harness-eval/{ => sop}/sop-trace-adapter.ts`
- **外部及根目录文件修改**:
  - `packages/api/src/index.ts`
  - `packages/api/src/routes/eval-hub.ts`
  - `packages/api/src/infrastructure/harness-eval/index.ts`
  - `packages/api/src/infrastructure/harness-eval/eval-cat-invocation.ts`
  - `packages/api/src/infrastructure/harness-eval/eval-memory-adapter.ts`
  - `packages/api/src/infrastructure/harness-eval/legacy-task-cleanup.ts`
- **测试文件修改**:
  - `packages/api/test/harness-eval/` 下 15 个测试文件中的 `../../dist/` 引入路径更新

### Git SHA

- **Base**: `77a064c90` (docs(F216): complete phase sync + plan frontmatter)
- **Head**: `60b4688cd` (refactor(harness-eval): split harness-eval files into subdirectories)

### 测试与 Check 状态

- `pnpm --filter @cat-cafe/api run build` → exit 0 ✅
- `node --test packages/api/test/harness-eval/*.test.js` → 366/366 pass ✅
- `pnpm check` → 0 errors ✅ (All 19 checks passed)
- `pnpm -r --if-present run build` → exit 0 ✅

### Review 重点

1. **是否漏改相对路径** — 各个子目录下文件引入其它相对文件，以及测试文件的路径是否准确？
2. **index.ts 重新导出** — index.ts 的 re-export barrel 路径是否完全与拆分后对应？

### 五件套

- **What**: 将 `packages/api/src/infrastructure/harness-eval` 下 31 个 TypeScript 文件拆分到 5 个子目录，并修正所有内部和外部 imports 相对路径。
- **Why**: 解决 ADR-010 规定的 25 文件限值，消除 Directory Size Guard 告警（issue #1973）。
- **Tradeoff**:
  - 为保持 Git Blame 历史，使用 `git mv` 转移了所有文件。
  - 由于文件夹嵌套深度改变，部分 imports 中的多级相对路径（如 `../../`）相应加深（如 `../../../`）。
- **Open Questions**: 无。
- **Next Action**: 请 @opus 进行 review。

---

### Review 沙盒约定
- **Review-Target-ID**: `f192-dir-split`
- **Branch**: `refactor/f192-harness-eval-dir-split`
- **启动端口**: N/A (此为纯 TypeScript 代码和目录结构重构，不需要启动 Web 服务验证)

---

✅ 自检及门禁验证通过
- [x] Spec compliance 自检已通过 (`quality-gate` report 见 artifacts)
- [x] 铲屎官原始需求已引用
- [x] 19/19 monorepo checks 全过
- [x] 366/366 单元测试全绿
- [x] 无任何根目录临时工件 (Artifact Hygiene check 干净)
