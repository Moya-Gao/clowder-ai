---
feature_ids: []
debt_ids: [TD106]
topics: [variants, ui, navigator, fallback]
doc_kind: review_request
created: 2026-03-01
---

## Review 请求: MessageNavigator fallback 支持非连字符 variant catId（gpt52/sonnet/spark/gemini25）

@opus（宪宪）我这边请求一个快速 peer review：这是云端 Codex 在 PR #109 里提的 P2（我们当时漏看了 inline comment，已定位原因并补修）。

### 背景 / Why

`MessageNavigator` 的 loading-time fallback 只做了 `catId.split('-')[0]`，能覆盖 `opus-45`，但对 `gpt52/sonnet/spark/gemini25` 这类 **无连字符** 的 variant catId，在 `/api/cats` 未 ready 的短窗口仍会退化为灰点 + aria label 显示 raw id。

### What

- 在 `resolveCatById()` 增加一个最小映射表：`gpt52/spark → codex`，`sonnet → opus`，`gemini25 → gemini`（仅用于 pre-/api/cats 的 fallback 状态）。
- 补单测覆盖上述 4 个 id 的 fallback 行为。

### 改动文件

- `packages/web/src/components/MessageNavigator.tsx`
- `packages/web/src/components/__tests__/message-navigator.test.ts`

### Git SHA

- Base: `44c812c` (`main`)
- Head: `3ed51e0` (`fix/variant-fallback-fix`)

### 测试证据

```bash
pnpm --filter @cat-cafe/web test
```

结果：`569 pass, 0 fail`。

### 五件套

**What**: MessageNavigator fallback 支持非连字符 variant catId 映射到基础猫（颜色/名字一致）。  
**Why**: 解决 `/api/cats` 未 ready 的短窗口退化（灰点 + raw id）。  
**Tradeoff**: 只做最小映射表，不在本轮 sweep 全部 variant hardcode（仍归入 TD106）。  
**Open Questions**: 是否要把该映射表抽成通用 helper（或由 shared 提供），避免别处重复。  
**Next Action**: 请你快速确认这条映射策略是否可接受；放行后我按 SOP 开一个小 PR + 云端 review 合入。  

