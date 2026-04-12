# Review Request: fix(F152) — BootstrapSummaryCard 显示 kindCoverage 替代 tierCoverage

Review-Target-ID: fix-kind-coverage
Branch: fix/kind-coverage

## What
BootstrapSummaryCard 从显示 `tierCoverage`（provenance 信任层级: authoritative/derived/soft_clue）改为显示 `kindCoverage`（F102 内容类型维度: 决策/阶段/功能/教训/调研/知识/讨论/提交）。

核心变更：
1. `ExpeditionBootstrapService.ts`: ProjectSummary 新增 `kindCoverage` 字段 + BootstrapDeps 新增 `getKindCoverage` 可选回调
2. `index.ts`: wiring — SQL `GROUP BY kind` 查询 + `mapKindToSourceType` 映射后返回
3. `BootstrapSummaryCard.tsx`: 复用 `SOURCE_TYPE_LABELS`/`SOURCE_TYPE_COLORS`（来自 EvidenceSearch）
4. `useIndexState.ts`: 前端 ProjectSummary 类型同步
5. 3 个新测试 + 1 个更新测试

## Why
铲屎官发现 card 只显示 2 个分类（"444 Plans / 56 Specs"），你分析后确认：card 错误地把 provenance tier（搜索排名用）当成内容类型展示。应该用 F102 的 kind→sourceType 维度。

## Original Requirements（必填）
> [04:08 铲屎官] @gpt52 你们上个pr就是修f152和f102不同步的问题。你们看f102有哪些tag 你们是不是应该显示哪些的啊？

> [砚砚约束] (1) 不删 tierCoverage — 搜索排名仍需要; (2) 新增 kindCoverage 字段; (3) kind→sourceType 映射后再喂 UI; (4) 测试验证无 authoritative/derived 标签泄露到显示层

- 来源：thread 对话（2026-04-12 04:08）
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff
- 选择在 index.ts wiring 层做 `mapKindToSourceType` 映射（而非前端做），保持前端只消费 sourceType 维度
- `tierCoverage` 保留在 summary 中但 card 不再展示——搜索排名组件可继续使用

## Open Questions
1. 你之前给的约束是否都满足？特别是"kindCoverage 不影响 docsIndexed"
2. SQL 查询 `WHERE kind IS NOT NULL GROUP BY kind` 是否需要额外过滤（如排除 archive）

## Next Action
请 review 代码 + 验证约束满足。

## Review Sandbox（必填）
- Path: `/tmp/cat-cafe-review/fix-kind-coverage/gpt52`
- Start Command: `pnpm review:start`
- Ports: `web=3201`, `api=3202`

## 自检证据

### Spec 合规
- 愿景覆盖: 4/4 项通过
- tierCoverage 未删除 ✅
- kindCoverage 新增 + fallback {} ✅
- kind→sourceType 映射 ✅
- tier 标签不泄露到显示层（测试验证）✅

### 测试结果
```
node --test test/memory/expedition-bootstrap-service.test.js → 25/25 pass, 0 fail ✅
pnpm --filter @cat-cafe/web test → 285 files, 2034 tests pass, 0 fail ✅
pnpm lint → 0 errors ✅
pnpm check → 0 errors ✅
pnpm -r --if-present run build → exit 0 ✅
```

### Artifact Hygiene
根目录工件闸门: 工作树 CLEAN + 已提交差异 CLEAN ✅

### 设计稿对照
glob `designs/**/*152*` + `designs/**/*bootstrap*`: 无匹配
⚠️ 有 UI 改动但无 .pen 设计稿，跳过对照

### 相关文档
- Feature: F152 expedition-memory
- 上一个 PR: #1088（tier 分类器对齐）
