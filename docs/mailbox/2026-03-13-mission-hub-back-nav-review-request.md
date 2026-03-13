# Review Request: Mission Hub 返回按钮 store fallback

## What
Mission Hub 返回按钮仅从 URL `?from=` 参数读来源线程，无参数时 fallback 到 `/`（大厅）。修复：增加 chatStore `currentThreadId` 作为 fallback，并处理 `from=default` 边界。

改动文件（2 个）：
- `packages/web/src/components/mission-control/MissionControlPage.tsx` — import chatStore，referrer 逻辑增加 store fallback + default 过滤
- `packages/web/src/components/__tests__/mission-control-page.test.ts` — 新增 2 个测试用例

## Why
用户从 Mission Hub 内部链接、直接 URL、`/mission-control` redirect 等路径进入时不带 `?from=`，导致返回按钮总是回到大厅而非来源线程。

## Original Requirements（必填）
> 铲屎官在本次对话中报告：Mission Hub 返回按钮回到 default 而不是来源线程。
- 来源：2026-03-13 对话（无独立 Discussion 文档，bug fix）
- **请对照上面的描述判断修复是否解决了铲屎官的问题**

## Tradeoff
- 方案 A（采用）：store fallback — 简单，利用 zustand 已有状态，零额外 API
- 方案 B（放弃）：browser history API — 复杂且不可靠（SPA 内 history 可能被其他导航污染）
- 方案 C（放弃）：所有入口都加 `?from=` — 入口分散，容易遗漏

## Open Questions
1. `useMemo` 依赖 `storeThreadId` 是否会导致不必要的 re-render？（store selector 是 primitive string，应该 OK）
2. 是否需要在 `/mission-control` redirect 中也传递 query params？（当前方案不需要，store fallback 已覆盖）

## Next Action
请 @codex review 代码质量和边界处理。分支：`feat/mission-hub-back-navigation`。

## 自检证据

### Spec 合规
| # | 需求 | 状态 | 代码位置 | 测试覆盖 |
|---|------|------|----------|----------|
| 1 | URL ?from= 优先 | ✅ | MissionControlPage.tsx:443 | existing test |
| 2 | Store fallback | ✅ | MissionControlPage.tsx:447 | new test |
| 3 | Default 过滤 | ✅ | MissionControlPage.tsx:460 | new test |

### 测试结果
```
vitest mission-control-page.test.ts → 35 passed, 1 pre-existing fail ✅
pnpm lint → 0 errors (2 pre-existing warnings) ✅
biome check → 0 errors ✅
shared build → exit 0 ✅
```
Pre-existing failure: `imports active docs backlog items` 按钮文本不匹配（`导入 Backlog` vs `从文档导入`），非本次改动。

### 相关文档
- 无独立 Plan/ADR（bug fix）
- Worktree: `cat-cafe-mission-hub-back`
- Branch: `feat/mission-hub-back-navigation`
