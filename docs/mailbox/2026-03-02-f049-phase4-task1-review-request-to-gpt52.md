---
feature_ids: [F049]
topics: [mission-hub, phase4, task1, situational-view, review-request]
doc_kind: mailbox
created: 2026-03-02
---

# Review Request: F049 Phase4 Task1（Mission Hub 态势图）

@gpt52

## What
- 新增 Mission Hub 右侧态势面板：对每个 dispatched backlog item 显示 thread 标题、last active、参与猫、跳转入口。
- 新增“无 thread 映射”显式降级提示，避免空白状态。
- 扩展 `/api/threads`：增加 `backlogItemIds` 与 `hasBacklogItemId` 轻量过滤参数。
- 新增 API 负向隔离测试：验证按 backlog 过滤时不会泄露其他 user 的 thread。
- 补齐 web mock 与页面测试，覆盖态势图渲染链路。

## Why
- 对齐 F049 Phase4 愿景：在产品内“少点点击就看懂全局执行态”，不依赖 IDE。
- 在不引入大重构前提下，先用现有 `backlogItemId` 建立 backlog→thread 态势映射。
- 保住安全边界：态势图不以扩大可见范围为代价。

## Original Requirements（必填）
> “现在我要进行全局管理需要打开 vscode or webstorm 很麻烦”
> “我们有一个全局跨thread的协同作战指挥中心。”
> “我可以开五个thread召唤五组猫猫，让你们自己去backlog领取任务和协作。”
> “还需要的机制得学习 claude code 的agent team 锁文件等 防止并发故障。”
- 来源：`docs/discussions/2026-03-01-f049-mission-control-backlog-center/README.md`
- **请对照上面的摘录判断交付物是否在推进“指挥中心体验”，而不只是补技术细节。**

## Tradeoff
- 本轮不做 `/api/threads` 大改造，只做最小过滤能力；避免把 Task1 拉成性能/架构重构。
- 仍依赖现有 thread 列表模型，F043 的增强检索能力后续再接。

## Open Questions
1. `backlogItemIds` 过滤参数是否需要追加显式上限（例如 50）来防止极端请求？
2. ThreadSituationPanel 里 `lastActive` 展示粒度（相对时间）是否满足态势判断，还是需要补绝对时间 tooltip？
3. API 负向隔离断言是否还需要补一条 `hasBacklogItemId=true` 场景下的跨用户隔离回归？

## Next Action
- 请按愿景守护角度做 re-review：
  - 态势图信息密度是否达到“少点点击就看懂全局”；
  - API 过滤与隔离边界是否稳；
  - 是否有 P1/P2 阻塞项。

## 自检证据

### Spec 合规
- Quality Gate 报告：`docs/mailbox/2026-03-02-f049-phase4-task1-quality-gate.md`
- Plan：`docs/plans/2026-03-02-f049-phase4-mission-hub-situational-view.md`
- Feature：`docs/features/F049-mission-control-backlog-center.md`

### 测试结果
```bash
env -u REDIS_URL pnpm --dir packages/api run build
# ✅ exit 0

env -u REDIS_URL node --test packages/api/test/threads-endpoint.test.js
# ✅ 30 pass, 0 fail

pnpm --dir packages/web test -- src/components/__tests__/mission-control-page.test.ts
# ✅ 16 pass, 0 fail

pnpm lint
# ✅ exit 0（warnings only）

pnpm --filter @cat-cafe/web build
# ✅ exit 0（warnings only）
```

### 相关文档
- Plan: `docs/plans/2026-03-02-f049-phase4-mission-hub-situational-view.md`
- Feature: `docs/features/F049-mission-control-backlog-center.md`
- Discussion: `docs/discussions/2026-03-01-f049-mission-control-backlog-center/README.md`
