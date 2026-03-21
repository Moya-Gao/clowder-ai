# Review Request: home baseline sync gate red-light cleanup

Review-Target-ID: baseline-sync-gate
Branch: fix/baseline-sync-gate

## What
- 修了家里 `pnpm check` 的 2 条真红灯：
  - `HubAddMemberWizard.tsx` 的 `aria-label` 容器补 `role="group"`
  - `HubProviderProfilesTab.tsx` 的 `aria-label` 容器补 `role="group"`
- 修了剩余的文档真相源漂移：
  - 重生成 `docs/features/index.json`，收进 `F127 intake` 后的状态变化
- 共享状态拆分说明：
  - `docs/BACKLOG.md` 移除已 done 的 `F131` 已按 shared-state 规则单独落到 `main`（commit `0b3da2bd`），不放进这张 branch PR

## Why
- 当前目标不是继续猜社区红灯，而是先把家里 `main` 按 full-sync SOP 验到真绿。
- 我在 live runtime shell 里复现到 `REDIS_URL=6399` 和 `3001/3002` 占用会污染 `pnpm test`，所以这次在隔离 worktree + clean env 里重新做了 baseline gate。
- clean env 下 `pnpm test` 已经是绿的；真正剩下的只是不该留在真相源里的 4 处小漂移。

## Original Requirements
> “你来负责检查是否全量同步？ 或者是说家里基线按照我们的全量同步sop 先修到全绿，然后走全量同步？”
>
> “那你来吧！ 现在家里没有其他任何thread在跑 全部都在等你收拾 你开始收拾清楚红灯？ 然后再考虑走full gate？”
- 来源：当前 thread，消息 `0001774099348182-000000-da7cad6c` 与 `0001774099762276-000002-1f2b4663`
- **请对照上面的摘录判断：这组改动是否确实把“先修家里基线到绿，再走 full gate”落成了可 merge 的真相源修复**

## Tradeoff
- 没有直接拿 feature worktree 去做 full sync，因为 `BACKLOG` / feature index 属于真相源，必须先回到家里的 `main`。
- 没有追加任何 UI 外观改动；这两处前端 patch 只改无障碍语义，不碰测试选择器、不改视觉层。

## Open Questions
1. `role="group"` 这两处补丁是否保持了“纯 baseline 修复、不越过语义边界”？
2. `F131` 从 `BACKLOG` 移除是否符合当前“done 后移出 BACKLOG”的真相源规则？
3. 这组改动合回 `main` 后，是否就可以直接进入 full sync？

## Next Action
- 请按严格标准 review 这 4 个文件。
- 如果放行，我下一步直接合回 `main`，然后执行 full sync。

## 自检证据

### Spec 合规
- 目标只收家里 baseline 红灯，不顺手扩 scope。
- live runtime 污染已被隔离验证排除：clean env 下 `pnpm test` 全绿，说明之前 runtime shell 的假红灯不应拿来挡 sync。
- `BACKLOG` 规则明确写了“只放活跃 Feature，done 后移除”；`F131` 继续留在 `BACKLOG` 本身就是规则违例。
- shared-state 约束已执行：`BACKLOG` 没有留在 feature branch 上，而是单独先落 `main`。

### 测试结果
```bash
env -u REDIS_URL -u CAT_CAFE_REDIS_TEST_ISOLATED -u API_SERVER_PORT -u FRONTEND_PORT pnpm check
# PASS

env -u REDIS_URL -u CAT_CAFE_REDIS_TEST_ISOLATED -u API_SERVER_PORT -u FRONTEND_PORT pnpm test
# packages/api: 5189 pass / 0 fail / 1 skipped
# packages/web + packages/mcp-server: pass

env -u REDIS_URL -u CAT_CAFE_REDIS_TEST_ISOLATED -u API_SERVER_PORT -u FRONTEND_PORT pnpm build
# PASS (仅现存 next/no-img-element warnings，无 build failure)
```

### 相关文档
- Backlog: `docs/BACKLOG.md`
- Feature: `docs/features/F127-cat-instance-management.md`
- Feature: `docs/features/F131-workspace-navigator.md`
