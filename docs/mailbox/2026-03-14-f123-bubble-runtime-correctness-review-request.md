# Review Request: F123 Bubble Runtime Correctness Phase A/B 切口

## What
- 扩展 `window.__catCafeDebug`，新增 `dumpBubbleTimeline()`，并给 bubble lifecycle 补上 `catId/messageId/invocationId/origin` 级别导出
- 在 active path 与 background path 分别落了首批 F123 事件埋点：
  - `active_late_bind`
  - `background_ref_lost`
- 修复同一 `catId + invocationId` 下 callback text 与 stream text 的重叠替换：
  - active path：在 `useAgentMessages.ts` 用 `patchMessage` + `replaceMessageId` 替换 streaming bubble
  - background path：在 `useSocket-background.ts` 用 `patchThreadMessage` + `replaceThreadMessageId` 做对称替换
- 补了回归测试，并把 full-suite 里这轮直接带出来的两个 hook mock 回归一起修掉

## Why
这刀是 F123 的第一段可交付切口，目标不是“再修一个截图 bug”，而是先把 bubble identity / overlap / recovery 的两个主路径钉住：
- active late-bind 双影
- background ref-lost 停更

同时把 callback-overlap 的实际行为落到 active + background 两条镜像路径上，直接对齐 F123 的 `AC-B2 / AC-B4 / AC-C3`。

## Original Requirements
> 铲屎官明确提出：前端气泡问题从第一天修到现在，已经不接受继续靠零散补丁维持；  
> 要求我们基于代码重新收敛三猫观点，并新开一个明确从 F081 演进而来的 follow-up feature。
- 来源：`docs/discussions/2026-03-14-f123-bubble-runtime-followup/README.md`
- **请对照上面的摘录判断交付物是否真的在收敛这条线，而不是继续打散装补丁**

## Tradeoff
- 这轮没有先上统一 `MessageWriter`，仍然保持“hook 决策、store 只给 patch primitive”的分层
- provenance 先只做到 debug dump，不做 UI 入口
- `quality-gate` 没法按“全仓零红灯”字面通过，因为仓库 baseline 本来就红；这次我补了 main vs worktree 对比证据，只证明“F123 没引入新红灯，而且把 baseline 往前推了 3 条测试”

## Open Questions
- callback/stream overlap 的判定边界放在 hook/shared helper 是否合理，还是 reviewer 会建议再下沉一层
- `patchMessage` / `patchThreadMessage` 现在的职责边界是否够干净，尤其是 `extra.stream.invocationId` 的保留策略
- “baseline 红灯不阻塞 review，但必须证明没有新增红灯” 这个 gate 例外，表述是否足够严谨

## Next Action
- 请按 `F123` 的 `AC-A2 / AC-B2 / AC-B4 / AC-C3` 重点看这刀是否闭合了 active + background 两条路径
- 请特别审：
  - overlap 替换逻辑是否放对了层
  - background 对称版是否和 active path 真正一致
  - 这份 gate 证据是否足以支持进入 review，而不是继续卡在历史红灯上

## 自检证据

### Spec 合规
- `AC-A2`: Phase A 首批两条 fixture 已有真实代码与测试覆盖
  - active late-bind 双影
  - background ref-lost 停更
- `AC-B2`: 同一 `catId + invocationId` 的重叠 text bubble 在 active/background 两条路径都不再稳定并存
- `AC-B4`: callback text 到达时会替换对应 stream text，而不是新增第二条 bubble
- `AC-C3`: `dumpBubbleTimeline()` 已可导出 bubble provenance/timeline

### 设计稿对照（Step 5）
- `find designs -name '*.pen'` 结果：仓里有多份 `.pen`，但**没有匹配 F123 / bubble runtime correctness 的设计稿**
- 本轮改动只触及：
  - `packages/web/src/hooks/**`
  - `packages/web/src/stores/**`
  - `packages/web/src/debug/**`
- 没有组件/UI 文件改动，因此本轮不做浏览器截图对照

### 测试结果
- `pwd=/Users/lysander/projects/relay-station/cat-cafe-f123-bubble-runtime-correctness/packages/web`
- `pnpm test -- --run src/debug/__tests__/invocationEventDebug.test.ts src/hooks/__tests__/useAgentMessages-placeholder-recovery.test.ts src/hooks/__tests__/useSocket-background.test.ts src/hooks/__tests__/useAgentMessages-richblock-correlation.test.ts src/hooks/__tests__/useAgentMessages-bubble-merge.test.ts src/hooks/__tests__/useAgentMessages-stream-catchup.test.ts src/hooks/__tests__/useSocket-thread-guard.test.ts src/stores/__tests__/chatStore-multithread.test.ts src/hooks/__tests__/useAgentMessages-loading.test.ts src/hooks/__tests__/useAgentMessages-web-search.test.ts`
  - `10` files, `157` tests passed
- baseline 对比：
  - `main` 上 `pnpm --filter @cat-cafe/web test` → `23` failed files / `61` failed tests
  - F123 worktree 上同命令 → `21` failed files / `58` failed tests
  - 结论：**没有新增 full-suite 红灯，且把 baseline 压下去了 2 个文件 / 3 条测试**

### 其他门禁
- `pnpm lint` → exit `0`（仅现存 warnings，无 error）
- `pnpm --filter @cat-cafe/web build` → exit `0`
- `pnpm check` → 仍红，但剩余 `12` 条 error 都不在本轮 diff 内，主要是 repo baseline 的 biome/organizeImports 债
- `pnpm check:features` → 仍红，原因是共享状态旧账：
  - `docs/features/index.json` stale
  - `F118` 在 BACKLOG 但 records 都是 done
  - active feature `F101` 缺 BACKLOG 入口

## 相关文档
- Feature: `docs/features/F123-bubble-runtime-correctness.md`
- Discussion: `docs/discussions/2026-03-14-f123-bubble-runtime-followup/README.md`
- Mailbox: `docs/mailbox/2026-03-14-f123-bubble-runtime-correctness-review-request.md`
