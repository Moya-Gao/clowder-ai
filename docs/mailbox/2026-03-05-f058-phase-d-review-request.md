---
feature_ids: [F058]
topics: [mission-control, review-request]
doc_kind: review-request
created: 2026-03-05
---

# Review Request: F058 Phase D — 导入状态映射 + Layout 修复

## What

两个 bug 修复：

1. **AC-D1: 导入状态映射** — `buildBacklogInputFromFeature` 现在根据 BACKLOG.md feature status 设置 backlog item 的 `initialStatus`：`in-progress`/`in-review` → `dispatched`，`done` → `done`，其他 → `open`。已有 item 通过 `refreshMetadata` 的 `importStatus` 同步，只升级不降级（open→dispatched，不会 dispatched→open）。

2. **AC-D2: Layout overflow** — 右侧面板加 `overflow-auto`，ThreadSituationPanel 和 FeatureBirdEyePanel 不再被截断。

**Changed files:**
- `packages/shared/src/types/backlog.ts` — `initialStatus` on `CreateBacklogItemInput`, `importStatus` on `RefreshBacklogItemInput`
- `packages/api/src/routes/backlog-doc-import.ts` — `featureStatusToBacklogStatus()` + wired into `buildBacklogInputFromFeature`
- `packages/api/src/routes/backlog.ts` — import loop passes `importStatus` on refresh, `needsStatusUpgrade` in shouldRefresh check
- `packages/api/src/domains/cats/services/stores/ports/BacklogStore.ts` — Memory store: `create` reads `initialStatus`, `refreshMetadata` handles `importStatus` upgrade
- `packages/api/src/domains/cats/services/stores/redis/RedisBacklogStore.ts` — Redis store: same changes
- `packages/web/src/components/mission-control/MissionControlPage.tsx` — `overflow-auto` on right sidebar
- `packages/api/test/backlog-doc-import.test.js` — 9 new tests

## Why

铲屎官实测截图暴露：27 个 feature 全堆在 Open 栏（in-progress/in-review 的也是），右下角面板完全看不到。详见 `docs/stories/f058-grep-is-not-verification.md`。

## Original Requirements

> "明明不能用！刷新之后都进度不对吧？还是对的？以及你看其实有些在做了，你也没同步过去的？然后右下角那些东西！看都看不到！你还不能 done"
> — 铲屎官，2026-03-05

- 来源：`docs/features/F058-mission-control-enhancements.md` Phase D 段落
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- `initialStatus` 加在 `CreateBacklogItemInput` 而非在 import loop 里跑多步状态转换（open→suggested→approved→dispatched）。理由：import 是从外部数据 bootstrap，不需要走工作流中间步骤。
- Refresh 时只升级不降级（open→dispatched），不做 dispatched→open。理由：已经在做的任务不应该因为 BACKLOG.md 手误改回 spec 就丢失 dispatched 状态。

## Open Questions

1. `done (Phase 1)` 映射为 `dispatched` 而非 `done` — 因为还有后续 Phase。这个逻辑对吗？
2. 右侧面板 `overflow-auto` 是最简修复。是否需要更好的 layout 方案（比如把面板拆到底部或独立 tab）？

## Next Action

请 review 代码，特别关注：
- `featureStatusToBacklogStatus` 的映射是否完整
- `refreshMetadata` 只升级不降级的逻辑是否正确
- `initialStatus` 跳过工作流是否有安全隐患

## 自检证据

### Spec 合规
- AC-D1: `featureStatusToBacklogStatus('in-progress')` → `'dispatched'` ✅ (test)
- AC-D1: `buildBacklogInputFromFeature({status: 'in-progress'})` → `initialStatus: 'dispatched'` ✅ (test)
- AC-D2: `overflow-auto` added to right sidebar div ✅ (code)

### 测试结果
```
backlog-doc-import tests: 18 passed, 0 failed (9 new)
backlog total tests: 74 passed, 0 failed
web tests: 717 passed, 0 failed
build: clean (shared + api + web)
```

### 相关文档
- Feature: `docs/features/F058-mission-control-enhancements.md`
- Story: `docs/stories/f058-grep-is-not-verification.md`
- BACKLOG: F058
