# Review Request R2: intake(clowder-ai#546) F153 Phase E implementation

Review-Target-ID: intake-clowder-546
Branch: fix/intake-clowder-546
PR: cat-cafe#1375
HEAD: 4f5258a5f2e0c07abeabb55da62489fe79b40aeb

## What
这是一轮 **post-review author fix** 之后的复审请求。相对你之前放行过的 `2ab38931`，本轮新增 2 个 author commit：
- `1b4918b66` `fix(intake-546): restore mainline routing and ACP guards [砚砚/GPT-5.4🐾]`
- `4f5258a5f` `docs(features): resolve F172 index conflict after rebase [砚砚/GPT-5.4🐾]`

具体修复：
- `packages/api/src/index.ts`
  - 恢复 `main` 上的 ACP bootstrap helpers（`resolveAcpBootstrap*`）
  - 恢复 `InvocationRegistry` backend selection
  - 回正 `uploadDir` / `antigravity` config 路径等主线启动逻辑
- `packages/api/src/domains/cats/services/agents/routing/route-serial.ts`
  - 恢复 `parentInvocationId` persisted/broadcast 对齐
  - 恢复 verdict-no-pass hint
  - 恢复 ping-pong 豁免（substantive tool / long text）
  - 恢复 cumulative thinking dedup
  - 保留 `routeSpan` telemetry 透传
- `packages/api/src/domains/cats/services/agents/routing/route-parallel.ts`
  - 恢复 cumulative thinking dedup
  - 恢复 `canonicalFeatureId` / `threadTitle` incremental context 参数
  - 保留 `routeSpan` telemetry 透传
- `docs/features/index.json`
  - 清理 rebase 遗留冲突标记，按 `main` 真相源保留 `F172 = done (Phase H merged 2026-04-24)`

## Why
上一轮 reviewer 已经把 intake 专属的两个 `P1`（navigation context 回退、端口漂移）挡掉并修完；但在 author 侧跑全量 gate 时，又暴露出：
- upstream 旧版 `route-serial` / `route-parallel` / `index.ts` 覆盖了家里 `main` 的活逻辑
- rebase 遗留 conflict marker 让 `pnpm check` 直接失败

这轮不是改愿景，是把 absorb 分支重新拉回“**上游 F153 + 家里主线不回退**”。

## Original Requirements
> “那你走intake 回家的流程吧，merge 然后读sop 走流程回家 记得一定要好好看看intake skills 大多数猫猫都会犯错”
> “那你继续呀 那你别at人家小金啊，你at他不就是在传球给他！”
- 来源：当前 thread `thread_mo89w0xb209b8rcu`
- 请对照这两句原话判断：这轮 author 修复是否已经把 `#546` intake 跑到 `review ready`，而不是把 reviewer 责任或未收尾的 gate 红灯往外甩

## Tradeoff
- 我没有顺手处理与本次 intake 无关的 warning 洪水；只处理了会让 `pnpm gate` 失败、或会把家里主线能力回退的内容
- 这意味着 diff 比最初 `#1375` 多了 4 个文件/2 个 commit，但 scope 仍然被收在：
  - `#546` upstream 变更触达的启动/路由路径
  - rebase 直接引入的 docs conflict

## Open Questions
1. 你是否认同这两条新增 author commit 仍然属于“为吸收 `clowder-ai#546` 所必需的最小主线回补”，没有越界修 unrelated feature？
2. `index.ts` / `route-serial.ts` / `route-parallel.ts` 这三处，现在是否已经同时满足：
   - 不回退家里 `main`
   - 不丢 `#546` 的 telemetry / observability 接入
3. 在 `HEAD 4f5258a5` 上，你是否愿意重新放行 `cat-cafe#1375`？

## Next Action
请 review `cat-cafe#1375` @ `4f5258a5f2e0c07abeabb55da62489fe79b40aeb`。  
旧 PR `#1372` 和旧头 `2ab38931` 都不要再看。

## Review Sandbox
- Path: `/tmp/cat-cafe-review/intake-clowder-546/opencode`
- Start Command: `pnpm review:start`

## 自检证据

### 定向修复验证
- `pnpm --filter @cat-cafe/api build` → pass
- `pnpm --dir packages/api exec node --test test/acp/acp-bootstrap-cwd.test.js test/route-serial-parent-invocation-id.test.js test/route-serial-pingpong.test.js test/route-serial-verdict-hint.test.js test/route-strategies.test.js` → `116 passed, 0 failed`

### 全量门禁
- `pnpm gate` → **GATE PASSED**
  - `build` → pass
  - `tsc --noEmit` → pass
  - `pnpm -r test` → pass
  - `pnpm lint` → pass
  - `pnpm check` → pass

### 相关文档
- Feature: `docs/features/F153-observability-infra.md`
- Source PR: `clowder-ai#546`
- Intent Issue: `cat-cafe#1371`
- Absorb PR: `cat-cafe#1375`
