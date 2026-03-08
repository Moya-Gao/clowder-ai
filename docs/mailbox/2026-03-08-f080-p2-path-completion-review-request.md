# Review Request: F080-P2 Path Completion

## What
Terminal-style Tab path completion in ChatInput. When user types a path-like prefix (e.g. `./src/`, `packages/web/`, `~/projects/`), the system fetches file/directory candidates from a new backend API and shows a dropdown menu. Tab/Enter selects, Esc closes, directory selection appends `/` for continuous completion.

**Changes (7 files, +749 lines):**
- **Backend**: New `GET /api/projects/complete` endpoint in `projects.ts` (+60 lines). Reuses `project-path.ts` for security validation (allowlist boundary check + symlink resolution). Returns `{ entries: [{ name, path, isDirectory }] }`.
- **Frontend**: `usePathCompletion` hook (120 lines) — path regex detection, debounced API fetch (200ms), state management. `PathCompletionMenu` component (57 lines) — dropdown UI. `ChatInput` integration (+48 lines) — keyboard nav, ghost text suppression when dropdown active.

## Why
铲屎官 wants terminal-style Tab completion for file paths in chat input, following P1 (history completion with ghost text).

## Original Requirements
> "在 terminal 是不是 tab 也可以补全文件名路径什么的？我们的f80就暂时做不到？"
> "这几个功能我们做会很卡吗？如果不会有什么延迟我们先做 F080-P2？"
- 来源: Thread conversation, 2026-03-07
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff
- Path completion uses dropdown menu (not ghost text) because multiple candidates exist — ghost text only works for single suggestions
- Path detection regex is conservative (`./`, `../`, `~/`, `/`, `packages/`) to avoid false positives on normal text
- No recursive glob — only lists immediate children of the parent directory (matches terminal Tab behavior)

## Open Questions
1. The `ChatInput.tsx` is 668 lines (was 620 before P2). The 48-line addition is cohesive path completion logic. Worth extracting to a separate component?
2. Path detection regex: should `src/` alone (without prefix) trigger completion? Currently requires `./src/` or `packages/src/`. Trade-off: fewer false positives vs more typing.

## Next Action
Please review for security (path traversal prevention), UX correctness (keyboard nav, ghost text interaction), and code quality.

## Self-Check Evidence

### Spec Compliance
All 6 Phase 2 ACs verified:
1. Path pattern triggers completion (regex + integration test)
2. Backend `GET /api/projects/complete` (10 tests: matching, partial prefix, limit, 403, hidden filtering, sorting)
3. Frontend dropdown with Tab/Enter (6 integration tests)
4. 200ms debounce (constant in hook)
5. Backend path validation via allowlist (403 test for `/etc/`)
6. Directory trailing `/` for continuous completion (test + implementation)

### Test Results
```
pnpm --filter @cat-cafe/web test    # 136 files, 851 tests, 0 failed
node --test path-complete/project-path/pick-directory  # 36 pass, 0 fail
pnpm lint                           # 0 errors
pnpm --filter @cat-cafe/api build   # exit 0
```

### Related Docs
- Feature: `docs/features/F080-input-history-completion.md` (Phase 2 section)
- BACKLOG: F080 (status: active)
