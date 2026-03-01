## Review 请求: F039 QueuePanel 撤回后 UI 残留修复

### 背景
铲屎官手测反馈：队列里“取消/撤回”的消息在前端仍然残留，体验上会让人误以为没撤回成功。

### 铲屎官原始需求（摘录）
> “原本在队列取消掉的消息 还是会留在前端，感觉得写一个已取消好点。”

### 设计/需求文档
- Feature 真相源：`docs/features/F039-message-queue-delivery.md`
- 相关计划（背景）：`docs/features/plans/2026-02-26-message-queue-delivery-plan.md`

### Spec Compliance 自检

| # | 要求 | 状态 | 代码位置 | 测试覆盖 |
|---|------|------|----------|----------|
| 1 | 点击“撤回”后，QueuePanel 不应继续显示该条目（避免 stale UI） | ✅ | `packages/web/src/components/QueuePanel.tsx` | `packages/web/src/components/__tests__/queue-panel-withdraw.test.ts` |
| 2 | 撤回成功给出明确反馈（“已取消”） | ✅ | `packages/web/src/components/QueuePanel.tsx` toast | 同上 |
| 3 | 撤回失败应回滚 UI，并提示错误 | ✅ | `packages/web/src/components/QueuePanel.tsx` | 同上 |
| 4 | 文档同步：记录该 bug 与修复方向 | ✅ | `docs/features/F039-message-queue-delivery.md` | N/A |

### 改动文件

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `packages/web/src/components/QueuePanel.tsx` | 修改 | 撤回操作增加 optimistic 更新 + toast；失败回滚 |
| `packages/web/src/components/__tests__/queue-panel-withdraw.test.ts` | 新增 | 2 个回归测试（success/remove + failure/rollback） |
| `docs/features/F039-message-queue-delivery.md` | 修改 | 追加 Bug 3 说明（本分支修复中） |

### Git SHA
- Base: `2148207448d517d24074c2d256977535427f98b6`
- Head: `09b57318563f9bbba7dbc18cd044a4a1acc28acd`

### 测试状态
```
pnpm --filter @cat-cafe/web test: 571 passed, 0 failed
pnpm -r --if-present run build: ✅
```

### Review 重点
1. `handleRemove` 的 optimistic 更新是否会引入竞态（WS 同步到达/撤回失败回滚）
2. 文案与交互：toast “已取消/撤回失败” 是否符合我们 UI 风格与信息量

### 五件套
- **What**：撤回队列条目时本地立即移除，避免面板残留；同时 toast 给出“已取消”反馈
- **Why**：当前实现完全依赖 WS `queue_updated`，延迟/丢失会导致 stale UI
- **Tradeoff**：采用 optimistic 更新，失败时回滚；极端竞态下可能短暂闪烁，但比长期残留更可接受
- **Open Questions**：是否需要在撤回后额外 re-fetch `GET /queue` 作为兜底（当前暂不做，避免额外网络噪音）
- **Next Action**：请宪宪 review 上述文件，给 R1 结论

