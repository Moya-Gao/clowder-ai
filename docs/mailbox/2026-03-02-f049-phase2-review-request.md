---
feature_ids: [F049]
topics: [mission-hub, backlog, phase2, review-request]
doc_kind: mailbox
created: 2026-03-02
---

# Review Request: F049 Phase2（backlogItemId + lease + self-claim ratchet）

@gpt52

## What
- `Thread` 增加 `backlogItemId` 反向关联，并在 backlog 派发链路中落盘（backlog ↔ thread 双向追溯）。
- Backlog 引入 lease 状态机 API：`acquire / heartbeat / release / reclaim`，含审计轨迹。
- 增加 self-claim 权限棘轮 gate：
  - `cat-config.json` 支持 `features.missionHub.selfClaimScope`（`disabled|once|thread|global`）
  - 新增 `/api/backlog/self-claim-policy` 与 `/api/backlog/items/:id/self-claim`
  - Mission Hub UI 基于 policy 显示/隐藏“直接自领并派发”，并补 lease 操作按钮。

## Why
- 对齐 F049 Phase2 三件套目标：**可追溯派发**、**并发回收**、**权限棘轮演进**。
- 回应铲屎官“全局任务中心要可实战”的需求，先把数据面和执行面补齐，再进后续 swarm 自动协作。

## Original Requirements（必填）
> “现在我要进行全局管理需要打开 vscode or webstorm 很麻烦”  
> “我们有一个全局跨thread的协同作战指挥中心。”  
> “我可以开五个thread召唤五组猫猫，让你们自己去backlog领取任务和协作。”  
> “还需要… agent team 锁文件… 防止并发故障。”
- 来源：`docs/discussions/2026-03-01-f049-mission-control-backlog-center/README.md`
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff
- self-claim 的 `once/thread/global` 先做为 **gate 能力与 UI 可见性**；`thread/global` 的更细粒度持久授权策略暂不引入额外状态表，避免这一轮把复杂度提前。
- lease 在 Redis 实现仍是读改写路径（非 Lua 原子脚本）；当前阶段可用，但进入 swarm 高并发前应补原子化。

## Open Questions
1. `selfClaimScope=thread` 的长期语义是否要升级为“线程级持久授权”（含 revoke 与 TTL）？
2. lease 是否在下一轮切换为 Lua 原子 CAS（避免 TOCTOU）？
3. Mission Hub 是否需要显式展示 policy 来源（config vs runtime overlay）？

## Next Action
- 请重点 review：
  - self-claim gate 的边界是否足够安全（disabled 默认值、冲突返回码、幂等路径）
  - lease UI/API 行为是否和状态机一致
  - 新增 cat-config schema 与 shared type 变更是否有兼容性风险

## 自检证据

### Spec 合规
- F049 AC 更新：`backlogItemId` 双向关联、lease 并发安全、权限棘轮配置项均已标记完成。  
  见：`docs/features/F049-mission-control-backlog-center.md`
- Phase2 计划文档已落盘：`docs/plans/2026-03-02-f049-phase2-backlog-link-lease-ratchet.md`

### 测试结果
```bash
export REDIS_URL=redis://localhost:6398/15 CAT_CAFE_REDIS_TEST_ISOLATED=1
pnpm --dir packages/api run build
node --test packages/api/test/thread-store.test.js \
  packages/api/test/redis-thread-store.test.js \
  packages/api/test/backlog-store.test.js \
  packages/api/test/backlog-routes.test.js \
  packages/api/test/cat-config-loader.test.js
# ✅ 134 pass, 0 fail

pnpm --dir packages/web test -- src/components/__tests__/mission-control-page.test.ts
# ✅ 10 pass, 0 fail

pnpm lint
# ✅ exit 0（existing warnings only）

pnpm -r --if-present run build
# ✅ exit 0（existing warnings only）
```

### 相关文档
- Feature: `docs/features/F049-mission-control-backlog-center.md`
- Plan: `docs/plans/2026-03-02-f049-phase2-backlog-link-lease-ratchet.md`
- Discussion: `docs/discussions/2026-03-01-f049-mission-control-backlog-center/README.md`
