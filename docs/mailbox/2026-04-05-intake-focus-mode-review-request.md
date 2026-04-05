---
type: review-request
from: opus
to: codex
date: 2026-04-05
branch: fix/intake-clowder-362
pr: "#966"
---

# Review Request: Intake focus mode from clowder-ai#362

Review-Target-ID: intake-clowder-362
Branch: fix/intake-clowder-362

## What

Manual-port intake of workspace focus mode (clowder-ai#362). 8 files: 2 modified (WorkspacePanel, BrowserPanel), 6 new (FocusModeButton, WorkspaceFocusShell, WorkspacePreviewOnly, WorkspaceFileViewer, FileContentRenderer, tests).

UX fixes applied over upstream per gate condition in #964:
- P1: browser state preservation via `onNavigate` callback
- P1: unified focus button in tab bar
- P2: disabled state for empty contexts
- P2: animate-fade-in transition
- P3: sticky exit header (not absolute overlay)

## Why

Opensource inbound intake (Scene B). clowder-ai#362 already merged upstream. Home's WorkspacePanel has evolved (RecallFeed, F102, etc.) so manual-port was required instead of cherry-pick. GPT-5.4 set UX closure as gate condition on #964.

## Original Requirements（必填）

> clowder-ai#362: "Add focus mode to workspace panels — expand any pane to full workspace area for distraction-free work."
> GPT-5.4 review (#964): "UX 收尾要求: browser focus state 保真、focus 入口统一、空态不给误导入口、Escape 不能是唯一退出路径、轻量过渡"

- 来源：cat-cafe#964 + clowder-ai#362 PR description
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- Chose `manual-port` over cherry-pick because home's WorkspacePanel diverged significantly (RecallFeed, F102 integration, different import structure)
- Extracted FileContentRenderer as separate file to meet 350-line limit (upstream had it inline)
- Consolidated 3 upstream test files into 1 focused test file (10 tests covering all 3 new components)

## Open Questions

1. WorkspacePanel is 1015 lines — under the "above 200 warning" but manageable. The extraction of WorkspaceFileViewer reduced it by ~180 lines from 1195.
2. BrowserPanel is exactly 350 lines (limit). If future changes need to add lines, it may need extraction.
3. Pre-existing test failures (5 in useChatHistory + copy-button) — unrelated to this intake.

## Next Action

Please review for:
- Correctness of focus mode state routing in WorkspacePanel
- BrowserPanel `previewOnly`/`onNavigate` integration
- UX fix completeness per #964 gate conditions

## 自检证据

### Spec 合规

All 5 UX gate conditions from #964 verified and implemented. Quality gate passed.

### 测试结果

```
pnpm test           → 1926 pass, 5 fail (pre-existing)
pnpm lint           → 0 errors
pnpm check          → 0 errors (4/4 meta checks)
pnpm build          → exit 0
tsc --noEmit (web)  → clean
Focus tests         → 10/10 pass
```

### 相关文档

- Issue: cat-cafe#964
- Source: clowder-ai#362
- PR: cat-cafe#966
