# Review Request: intake clowder-ai#551 route nav hotfix

Review-Target-ID: intake-clowder-551
Branch: fix/intake-clowder-551

## What
吸收 `clowder-ai#551` 的跨 layout 导航 hotfix，并在家里追加 page-level `from` 透传，让 `/memory`、`/signals`、`/mission-hub` 的 back link 在 SSR 首帧就指向来源线程。

相关真相源：
- Intake Intent Issue: `cat-cafe#1331`
- Absorb PR: `cat-cafe#1332`
- Source PR: `clowder-ai#551`

## Why
只吸收 upstream 的 mount-only `useEffect` 缓解版时，真实浏览器验收里 `/memory?from=...` 的 back link 会一直停在 `/`，过不了家里的 quality gate。为避免“ledger 记了 absorbed，但实际运行态仍坏着”的老事故，这次在同一个 absorb branch 里补了 home-native stabilization。

## Original Requirements
> “那你开始走起？  
> 那你走intake 回家的流程吧，merge 然后读sop 走流程回家  
> 记得一定要好好看看intake skills 大多数猫猫都会犯错”

- 来源：当前 thread（铲屎官 2026-04-21 18:46）
- 请对照上面的摘录判断：这次 intake 有没有把 source PR 吸对、scope 有没有在证据基础上更新、以及 reviewer 能不能据此闭环 `cat-cafe#1331`

## Tradeoff
原计划只镜像 upstream 9 文件，不在 intake 里顺手修 `?from=` hydration gap。真实浏览器证据证明这会把 back link 留在 `/`，所以改为：
- 先完整 absorb upstream 9 文件
- 再最小追加 10 个 page/bridge 文件做 `searchParams.from` 透传

没有继续扩成新的交互/视觉改造，只补足让 absorbed patch 在家里真正可用的最小闭环。

## Open Questions
1. `cat-cafe#1331` 现在扩成 19 文件，逐文件决策表是否足够清楚，review 时有没有遗漏需要补充的“行为变化”描述？
2. home-native stabilization 和 upstream absorb 放在同一个 PR 是否可接受，还是 reviewer 倾向拆分成第二个 follow-up PR？
3. 请重点看 SSR 首帧 back link：这次修正是否已经把 `/memory`、`/signals`、`/mission-hub` 三页都兜住。

## Next Action
请按 `cat-cafe#1331` 的逐文件表对照审 `cat-cafe#1332` 当前 HEAD，给 formal review 结论。通过后我继续走 `record + advance-ledger`。

## Review Sandbox
- Path: `/tmp/cat-cafe-review/intake-clowder-551/opus`
- Start Command: `pnpm review:start`
- Ports: auto-assigned by `review:start`（不要用 3001/3002/3011/3012/4111）

## 自检证据

### Spec 合规
- `cat-cafe#1331` 已更新为 19 文件版本，明确区分：
  - upstream absorb: 9 files
  - home-native stabilization: 10 files
- source merge commit: `83d535a8c78d8c71d98a252956f5c9bbb20a35d5`

### 测试结果
- `NODE_ENV=test pnpm --filter @cat-cafe/web exec vitest run src/app/(chat)/__tests__/thread-route-marker.test.tsx src/components/__tests__/thread-navigation.test.ts src/components/__tests__/signal-nav.test.ts src/components/__tests__/signal-nav-back.test.ts src/components/__tests__/chat-container-header-signal-nav.test.tsx src/components/__tests__/mission-control-page.test.ts`
  - 52 passed, 0 failed
- `pnpm lint`
  - exit 0（现存项目 warning 未新增阻塞 error）
- `pnpm check`
  - exit 0
- `pnpm -r --if-present run build`
  - exit 0

### 浏览器证据
- 隔离运行态：
  - `env -u NODE_ENV FRONTEND_PORT=3211 API_SERVER_PORT=3212 PREVIEW_GATEWAY_PORT=4211 NEXT_PUBLIC_API_URL=http://localhost:3212 REDIS_URL=redis://localhost:6398 pnpm dev:direct`
- Playwright 验证：
  - `/memory?from=thread_browser -> /thread/thread_browser`
  - `/signals?from=thread_browser -> /thread/thread_browser`
  - `/mission-hub?from=thread_browser -> /thread/thread_browser`
- 截图：
  - `/tmp/cat-cafe-evidence/intake-551/memory.png`
  - `/tmp/cat-cafe-evidence/intake-551/signals.png`
  - `/tmp/cat-cafe-evidence/intake-551/mission-hub.png`

### 相关文档
- Intent Issue: `cat-cafe#1331`
- Absorb PR: `cat-cafe#1332`
- Source PR: `clowder-ai#551`
