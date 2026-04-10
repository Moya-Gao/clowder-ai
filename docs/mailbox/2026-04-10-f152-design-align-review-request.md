# Review Request: F152 Phase B — 前端组件设计稿对齐

## What

对齐 4 个 Bootstrap 前端组件到 `designs/F152-expedition-bootstrap.pen` 设计稿（Phase B 已合入 PR #1067，此 PR 修复 12 处设计偏差）：

- **BootstrapPromptCard**: 补 3 条信息 bullets（扫描范围/预计耗时/数据安全）、按钮顺序、文案
- **BootstrapProgressPill**: 阶段标签替代百分比显示、step 3 "建立索引"→"构建索引"
- **BootstrapSummaryCard**: 重写——tier 覆盖标签、3 CTA 按钮（关闭/搜索知识/前往记忆中心）、耗时展示
- **BootstrapAutoNotice**: 新增——amber 自动串联通知（新项目治理完成后）
- **durationMs 管线**: useIndexState → ChatContainer → Orchestrator → SummaryCard

## Why

铲屎官审核时发现 Phase B 前端实现与 .pen 设计稿存在多处偏差，要求修复对齐。

## Original Requirements（必填）

> 铲屎官（2026-04-10）："我和你打赌5包猫粮！"（挑战 UI 是否匹配设计稿）
> 铲屎官（2026-04-10）："你可以把你的缺失哈哈哈 写清楚？然后继续开worktree？颜色这个是设计稿没同步 这个没问题"

- 来源：当前会话（2026-04-10 铲屎官 review Phase B PR #1067 后）
- **请对照 `designs/F152-expedition-bootstrap.pen` 的 5 个组件截图判断实现是否对齐**
- **KD-16**: 配色差异（.pen 紫色 vs 实现 coral）是有意的，铲屎官拍板实现正确

## Tradeoff

- SummaryCard 完全重写（从 tech stack/dir/module 展示改为简洁的 tier 覆盖标签 + CTA 按钮），旧结构全部移除
- AutoNotice 是纯展示组件，无交互逻辑（auto-start 由 Orchestrator useEffect 驱动）

## Open Questions

1. **请用 Playwright/Chrome 打开 dev server 实测前端渲染**（KD-17 要求浏览器验证，不能只看代码）
2. SummaryCard 的 CTA 按钮目前只有 `关闭` 有 onClick handler，`搜索知识` 和 `前往记忆中心` 待后续 Phase 接入——这是否需要 placeholder handler 或 disabled 状态？

## Next Action

请 Review 代码 + 启动 dev server 截图验证前端组件渲染效果。

Review-Target-ID: f152-design-align
Branch: feat/f152-design-align

## 自检证据

### Spec 合规

12 处设计偏差全部修复，逐项对照 .pen 设计稿通过（详见 quality-gate report）。
相关 AC: B8（PromptCard）、B9（AutoNotice）、B10（ProgressPill）、B11（SummaryCard）。

### 测试结果

```
pnpm test (web)   → 278 files, 1980 tests, 0 failed ✅
pnpm lint         → 0 errors ✅
pnpm check        → 0 errors ✅ (biome format + lint)
pnpm build        → exit 0 ✅
```

### 根目录工件闸门

```
git status --short | rg media → 无 ✅
git diff --name-only origin/main...HEAD | rg media → 无 ✅
```

### 相关文档

- Feature: `docs/features/F152-expedition-memory.md`
- Design: `designs/F152-expedition-bootstrap.pen`
- Phase B PR: #1067 (merged)
