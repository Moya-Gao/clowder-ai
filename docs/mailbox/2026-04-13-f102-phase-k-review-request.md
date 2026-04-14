---
feature_ids: [F102]
topics: [review-request, memory, contract]
doc_kind: note
created: 2026-04-13
---

# Review Request: F102 Phase K — Contract Closure

Review-Target-ID: f102-phase-k
Branch: feat/f102-phase-k

## What

修复 F102 evidence search 的两个对外契约缺口：

1. **AC-K1**: `depth=raw` 时 API 静默降级到 lexical，现在返回 `degraded: true` + `effectiveMode: 'lexical'`。前端 mode 下拉锁定 + 提示"消息级仅支持精确匹配"。`buildSearchUrl` 强制覆盖 mode。
2. **AC-K2**: 前端 passage 类型从错误的 `{ text, score }` 改为匹配后端的 `{ passageId, content, speaker, createdAt, context }`。渲染展示 speaker、content、时间戳和上下文窗口。

## Why

其他线程的猫猫投诉"F102 没做完"。砚砚(GPT-5.4) 审计后定位到契约缺口：API 接受了参数但没告诉调用方它没生效，前端 passage 字段类型与后端不匹配导致渲染 undefined。铲屎官要求正式挂在 F102 走完整流程，不做脚手架。

## Original Requirements（必填）

> 铲屎官："我不喜欢做脚手架，你这个就应该挂在f102的issue 然后完整的实现"
> 砚砚(GPT-5.4) 审计结论："站在调用方视角，这就是'像没做完'。"
> 砚砚定位：depth=raw 时前端/API 还允许选 semantic/hybrid，但后端不会返回'已强制降级为 lexical'的信号。

- 来源：当前 thread（2026-04-13 对话）
- **请对照上面的摘录判断：调用方现在是否能清楚知道自己的请求被降级了？passage 渲染是否展示了后端实际返回的字段？**

## Tradeoff

- 前端选择锁定 mode（disabled + hint）而非移除选项，因为 depth 切回 summary 时 mode 应恢复用户之前的选择
- 后端在 route 层检测降级而非 SqliteEvidenceStore 层，因为 store 层的短路逻辑不需要改（它已经正确工作），只是调用方缺少感知

## Open Questions

1. `degradeReason: 'raw_lexical_only'` 这个命名是否足够清晰？是否需要更 verbose 的描述？
2. passage 渲染的时间格式用了 `zh-CN` locale 的 short month + time，在英文环境下是否需要考虑？

## Next Action

请 review 代码质量 + 对照原始需求判断契约是否真正闭环。

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/f102-phase-k/{reviewer-handle}`
- Start Command: `pnpm review:start`
- Ports: 沙盒分配（非 3001/3002/3011/3012）

## 自检证据

### Spec 合规

AC-K1 全部 4 项（后端 degraded signal, 前端 mode lock, buildSearchUrl override, response type）✅
AC-K2 全部 3 项（passage 类型对齐, 渲染 content/speaker/createdAt, context 渲染）✅

### 测试结果

```
vitest run (packages/web) → 297 files, 2134 passed, 0 failed ✅
pnpm lint → 0 errors ✅
pnpm check → 0 errors ✅
```

新增测试 5 个：
- `buildSearchUrl overrides mode to lexical when depth=raw`
- `buildSearchUrl keeps mode when depth is not raw`
- `buildSearchUrl keeps mode when depth is omitted`
- `preserves passage content/speaker/createdAt from backend`
- `preserves context passages`

### 相关文档

- Plan: `docs/plans/2026-04-13-f102-phase-k-contract-closure.md`
- Feature: `docs/features/F102-memory-adapter-refactor.md` Phase K
- ADR: `docs/decisions/020-f102-memory-system-architecture.md`（KD-44 三种检索路径）
