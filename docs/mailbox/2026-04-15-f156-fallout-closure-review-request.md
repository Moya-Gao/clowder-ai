# Review Request: F156 fallout 最后一轮收口

Review-Target-ID: f156
Branch: feat/f156-fallout-closure

## What
- 把 F156 剩余 3 个 fallout closure item 直接写回真相源：browser-facing route ledger、4 条 smoke evidence、shared session-loss UX regression pack
- 给 `threads` / `signals` / `connector-hub` 补 trusted-origin fallback 回归，避免同源 Hub 入口继续出现“有的能开、有的 401”分裂态
- 给前端补两类显式失败反馈：
  - `HubListModal` 在 IM Hub 拉取失败时显示错误态，不再伪装成“还没有 IM Hub”
  - `ThreadSidebar` 在创建线程 / 训练营线程失败时弹明确 toast，不再表现成“点了没反应”
- 给 `apiFetch` 的 401 自愈补共享回归：区分 `retry success` 与 `retry failed but visible error`

## Why
- 铲屎官已经把范围压缩成“最小收尾清单”，而且明确要求 F156 文档本身成为真相源，不接受再散落到 PR/聊天里靠记忆回忆
- 这轮的目标不是再做一个大 patch，而是把此前已经止血的 fallout 修复链收成可审核、可回放、可交接的闭环
- 如果不把路由级 fallback 语义和失败态 UX 一起钉住，F156 仍会停在“修过一些 bug，但 reviewer 无法判断是不是已经真正闭环”

## Original Requirements
> “IM Hub/Signal Hub 打不开”
> “创建线程点击无事发生”
> “刷新后气泡又跑出来”
> “剩下的未关项压成一张最小收尾清单。”
> “更新一下f156让他这个md变成真相源头”
- 来源：`docs/features/F156-websocket-security-hardening.md` 的 `Incident Follow-up` 节（记录了 2026-04-14 铲屎官连续反馈）+ 当前 thread 2026-04-15 09:36 / 09:51 用户原话
- **请对照上面的摘录判断：这轮是否真的把“像没数据 / 没反应 / 文档不是真相源”的问题一起收掉了**

## Tradeoff
- 我没有再扩展新的 F156 follow-up scope，也没有顺手去碰 issue `#1064` 或其它非 blocker 清理项；这轮只做 closure item 本身
- 前端证据我按 live browser 复现拿了截图，但没有为了录屏再引入新的页面 harness 或额外 demo 路由，避免把“取证”反过来膨胀成新开发
- 相关 `.pen` 文件有命中 `sidebar/hub/signal` 关键词，但它们覆盖的是导航/结构方案，不是本轮新增的错误态文案；因此这轮按“相关设计存在，但错误态无专门设计稿”处理，并以 live-browser 失败态截图补证

## Open Questions
1. F156 文档里现在这份 route ledger / smoke pack 是否已经足够成为 reviewer 和后续作者的真相源，还是还有关键信息仍然埋在代码/tests 里？
2. `apiFetch` 的共享 401 UX 回归，是否还漏了其它 surface，可能继续表现成“像没数据”而不是显式失败？
3. `HubListModal` 和 `ThreadSidebar` 的错误态文案/层级是否足够明显，还是用户仍可能把它看成普通空态或临时闪一下？

## Next Action
- 请你按 F156 merge 前的最后一轮 closure review 来看，不要只审代码正确性
- 我希望你重点挑战：
  - 这 3 个 closure item 是不是真的都能从 F156 里打勾
  - reviewer 仅看 spec + 这轮证据，能不能独立复述 fallout 为什么算闭环
  - 失败路径是否还残留“空白 / 无事发生 / 文档不是单一真相源”的漏口

## Review Sandbox
- Path: `/tmp/cat-cafe-review/f156/opus`
- Start Command: `pnpm review:start`
- Ports: `web=3201`, `api=3202`

## 自检证据

### Spec 合规
- 真相源：`docs/features/F156-websocket-security-hardening.md`
- 本轮直接完成并打勾：
  - `AC-F156-FALLOUT-1`
  - `AC-F156-FALLOUT-2`
  - `AC-F156-FALLOUT-3`
- 新增三个可审计区块：
  - `Browser-Facing Route Ledger（fallout-critical）`
  - `Smoke Evidence Pack（4 条核心路径）`
  - `Shared Session-Loss UX Regression Pack`

### 前端实证
- live-browser screenshot:
  - `/var/folders/41/n9jlv4ps78b90cb9vkgwtdv00000gn/T/cat-cafe-evidence/feat-f156-fallout-closure/2026-04-15/hub-error.png`
  - `/var/folders/41/n9jlv4ps78b90cb9vkgwtdv00000gn/T/cat-cafe-evidence/feat-f156-fallout-closure/2026-04-15/thread-create-error-toast-closeup.png`
- 需求 → 证据映射：
  - `IM Hub 失败不能假装成空态` → `hub-error.png`
  - `创建线程失败必须有可见反馈` → `thread-create-error-toast-closeup.png`
- 设计稿对照：
  - 命中相关 `.pen`：`designs/sidebar-navigation.pen`、`designs/f099-hub-navigation-scalability.pen`、`designs/mission-hub-f091-signal-study-mode.pen`
  - 结论：这些设计稿覆盖导航/结构，不覆盖本轮新增的 failure state；因此按“错误态无专门设计稿”处理，使用 live-browser failure screenshots 作为 UX 证据

### 测试结果
- `pnpm vitest run src/components/ThreadSidebar/__tests__/thread-sidebar-create-error-toast.test.tsx src/components/ThreadSidebar/__tests__/sidebar-mobile-close.test.ts src/components/__tests__/hub-list-modal-error-state.test.tsx src/utils/__tests__/api-client-retry.test.ts src/utils/__tests__/api-client-body-normalization.test.ts` → `17 passed`
- `pnpm --filter @cat-cafe/api build && CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash ./scripts/with-test-home.sh node --test test/threads-endpoint.test.js test/signals-route.test.js test/connector-hub-route.test.js` → `97 passed, 0 failed`
- `env -u REDIS_URL -u NEXT_PUBLIC_API_URL pnpm test` → root workspace test 通过（第一次带宿主 `REDIS_URL=redis://localhost:6399` 失败在 Redis 隔离守卫；净化环境后全绿）
- `env -u REDIS_URL -u NEXT_PUBLIC_API_URL pnpm lint` → 通过（仅既有 `cafe/no-hardcoded-colors` warnings）
- `env -u REDIS_URL -u NEXT_PUBLIC_API_URL pnpm check` → 通过
- `env -u REDIS_URL -u NEXT_PUBLIC_API_URL pnpm -r --if-present run build` → 通过（仅既有 `onnxruntime-web` / lint warnings）

### Artifact Hygiene
- `git status --short | rg '^.. [^/]+\\.(png|jpe?g|webp|gif|webm|mp4|mov|wav|pdf|pen)$'` → 无
- `git diff --name-only origin/main...HEAD | rg '^[^/]+\\.(png|jpe?g|webp|gif|webm|mp4|mov|wav|pdf|pen)$'` → 无

### 相关文档
- Feature: `docs/features/F156-websocket-security-hardening.md`
- Mailbox: `docs/mailbox/2026-04-15-f156-fallout-closure-review-request.md`
