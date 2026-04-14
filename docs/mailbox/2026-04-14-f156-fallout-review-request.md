# Review Request: F156 fallout thread hydration / auth 后续收口

Review-Target-ID: f156
Branch: feat/f156-fallout-closure

## What
- 去掉同项目 thread 切换时额外的 `governance/status` refetch，避免把项目级状态混进每次 thread 切换
- 给 `SessionChainPanel` 增加 per-thread session cache，回切已访问 thread 时先显示该 thread 自己的 session 数据，再后台 revalidate
- 补回归测试，钉住：
  - 同项目 thread switch 不再多打一枪 governance
  - SessionChain revisit 命中 per-thread cache
  - thread-level bubble override 异步到达时，能压过初始 global default

## Why
- 当前 F156 fallout 里，铲屎官最强烈的体感是：thread A → thread B 仍然要等 1s 左右，`session chain` 等 secondary panel 明显慢半拍
- 我们已经确认单个 localhost API 并不慢；主因是前端 thread 切换把首屏数据和 secondary hydration 混成了一次体验
- 这轮不是“重写整个数据层”，而是先砍两个已定位的 fan-out 点，给后续收口留出清晰边界

## Original Requirements
> “对 你上个pr 合入之后我切换线程还是非常卡”
> “比如thread a 到thread b 大概率还得等个1s”
> “session chain等等数据都要等”
> “这张 issue 必须挂回 F156，而且不能写成‘后续优化’，要写成‘事故后续关闭条件’”
- 来源：当前 thread（2026-04-14 04:13 / 06:25 / 06:32 / 06:41 用户原话）
- **请对照上面的摘录判断交付物是否真的在改善铲屎官的体感，而不只是代码更整齐**

## Tradeoff
- 我没有在这轮直接引入 React Query / SWR，也没有重构 `useChatHistory` 的整条 hydration 状态机
- 原因：那会把 F156 fallout 热修拖成大改；这轮先切掉已经证实的重复请求和明显错位的 stale source
- 我也没有把“气泡刷新后又跑出来”的根因硬判死。现有测试证明“thread override 异步到达”本身不是罪魁，所以这块请你继续尖锐质疑

## Open Questions
1. 这两刀是否真的击中了体感瓶颈，还是只是削掉了边缘噪音？
2. `queue / task-progress / authorization pending` 这些 secondary 请求，是否仍然被用户感知成“thread 还没切完”？
3. `bubbleThinking / bubbleCli` 刷新后异常恢复，是否还有别的恢复链漏口没被这轮覆盖？
4. 现在的 patch 会不会引入新的“旧 thread session 闪回”或 cache owner 错配问题？

## Next Action
- 请你按 **红蓝对抗 / 愿景守护** 视角 review，不要停在“测试过了、代码没问题”
- 我希望你重点挑战：
  - 这是不是只是把 secondary 慢留在别处
  - 用户会不会仍然觉得“点了 thread 但还要等”
  - 有没有哪条失败路径还会表现成“无事发生 / 像没数据”

## Review Sandbox
- Path: `/tmp/cat-cafe-review/f156/opus`
- Start Command: `pnpm review:start`
- Ports: `web=3201`, `api=3202`

## 自检证据

### Spec 合规
- 真相源已回挂 F156：`docs/features/F156-websocket-security-hardening.md`
- 已新增 section：`Incident Follow-up: 事故后续关闭条件（必须回挂 F156）`
- 本轮改动对应关闭条件中的两项：
  - 同项目 thread switch 不再把项目级治理状态混入首屏链路
  - `SessionChainPanel` revisits 不再回退到跨 thread 的 stale 显示

### 测试结果
- `pnpm exec vitest run src/components/__tests__/chat-container-governance-refetch.test.ts src/components/__tests__/thinking-mode-toggle.test.ts src/components/__tests__/session-chain-panel.test.ts` → `47 passed`
- `pnpm --filter @cat-cafe/web test` → `2145 passed, 0 failed`
- `pnpm --filter @cat-cafe/web lint` → 通过（仅既有 warnings）
- `pnpm --filter @cat-cafe/web build` → exit 0

### Artifact Hygiene
- `git status --short | rg '^.. [^/]+\.(png|jpe?g|webp|gif|webm|mp4|mov|wav|pdf|pen)$'` → 无
- `git diff --name-only origin/main...HEAD | rg '^[^/]+\.(png|jpe?g|webp|gif|webm|mp4|mov|wav|pdf|pen)$'` → 无

### 相关文档
- Feature: [docs/features/F156-websocket-security-hardening.md](/Users/lysander/projects/relay-station/cat-cafe/docs/features/F156-websocket-security-hardening.md:1)
- Mailbox: [docs/mailbox/2026-04-14-f156-fallout-review-request.md](/Users/lysander/projects/relay-station/cat-cafe-f156-fallout-closure/docs/mailbox/2026-04-14-f156-fallout-review-request.md:1)
- Commit: `13b66c718` — `perf(F156): trim thread switch fan-out [砚砚/GPT-5.4🐾]`
