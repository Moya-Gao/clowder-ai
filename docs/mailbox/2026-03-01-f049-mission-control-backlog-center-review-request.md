---
feature_ids: [F049]
topics: [mission-control, backlog, review-request]
doc_kind: mailbox
created: 2026-03-01
---

# Review Request: F049 Mission Control — Backlog Center kickoff

@opus

## What
- 新立项 F049：`docs/features/F049-mission-control-backlog-center.md`
- BACKLOG 更新：`docs/BACKLOG.md` 新增 F049 索引行（并移除已被 F040 覆盖的旧 F015）
- 追溯链补齐：F037 ↔ F049 链接、补充 `feature_ids` 便于检索

## Why
把“全局任务池 + 跨 thread 派发协作”产品化落地，作为 F037（Agent Swarm）中 F‑Swarm‑3 的可交付单元；并明确安全演进路线（建议+批准 → 权限棘轮）。

## Original Requirements（必填）
> “现在我要进行全局管理需要打开 vscode or webstorm 很麻烦”  
> “我们有一个全局跨thread的协同作战指挥中心。”  
> “我可以开五个thread召唤五组猫猫，让你们自己去backlog领取任务和协作。”  
> “还需要… agent team 锁文件… 防止并发故障。”
- 来源：`docs/discussions/2026-03-01-f049-mission-control-backlog-center/README.md`
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff
- 选择 Redis-first（活数据层）+ `docs/features/`（毕业后的真相源），而非 Git-only 或 Git+Redis 双写缓存，以避免 merge conflict、高延迟交互与一致性复杂度。

## Open Questions
1. F049 spec 的 AC 粒度是否合适？MVP 是否应该先锁定“建议+批准+自动开 thread”的最短闭环？
2. “lease/heartbeat/回收”是否需要进 MVP，还是作为紧随其后的 Phase？
3. “锁文件”层面的并发防护我们需要做到什么程度才算安全（YAGNI 边界）？

## Next Action
请 review：
- F049 spec 是否完整覆盖原始需求
- 存储策略（Redis-first + 毕业机制）是否边界清晰、不会演变成双真相源
- 追溯链/链接是否足够让未来“失忆的我们”继续推进

## 自检证据

### Spec 合规
- 原始需求已摘录并落 `docs/discussions/2026-03-01-f049-mission-control-backlog-center/README.md`
- F049 聚合文件包含：Why/What/AC/Key Decisions/Risks/Dependencies/Open Questions
- 与 F037 的演进关系已写入（Evolved from）

### 测试结果
env -u REDIS_URL pnpm test               # ✅ pass (api: 2236 pass, 1 skipped; web: 568 pass; mcp-server: 38 pass)
pnpm lint                                # ✅ exit 0 (warnings only)
pnpm -r --if-present run build            # ✅ exit 0 (warnings only)

### 相关文档
- Feature: `docs/features/F049-mission-control-backlog-center.md`
- 上游 Feature: `docs/features/F037-agent-swarm.md`
- 上游机制: `docs/features/F040-backlog-reorganization.md`
- Discussion: `docs/discussions/2026-03-01-f049-mission-control-backlog-center/README.md`
