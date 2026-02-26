---
feature_ids: []
topics: [redis, thread, history]
doc_kind: discussion
created: 2026-02-10
---

# Redis Thread 历史丢失复盘（2026-02-10）

## 结论

- **原始 Redis 快照中的消息正文无法直接恢复**（可用 dump 不含 `cat-cafe:msg:*`）。
- **可通过导出的 markdown 对话记录重建主要历史**（已恢复 4 个 thread、65 条消息）。
- 本次事故的本质不是“单点代码 bug”，而是：**备份覆盖不足 + 多实例/多端口认知混乱 + 缺少强制恢复演练流程**。

## 时间线（What happened）

1. 用户发现历史 thread/message 异常缺失，报告“之前很多对话没了”。
2. 对 `6399/6401` 和现有 dump 快照做取证：
   - 只发现少量 `thread/session/invocation/cursor`；
   - 未发现消息正文键（`cat-cafe:msg:*`）。
3. 扫描可恢复源：
   - `audit-2026-02-09.ndjson` 仅有 threadId 级痕迹；
   - `docs/*.md` 导出聊天记录可提取完整消息文本。
4. 实施恢复：
   - 新增 `scripts/restore-chat-md-to-redis.mjs`（dry-run/apply）；
   - 先 dry-run 统计，再 apply 到 6399 与 6401；
   - 导回前自动快照。
5. 导回后验证：
   - 可恢复集：4 threads / 65 messages；
   - Redis 消息相关键恢复到 74（含索引键）。

## 证据（Evidence）

- dry-run（6399/6401）一致：
  - `parsed=4`、`threads=4`、`messages=65`
- apply 后：
  - 6399: `dbsize 27 -> 110`
  - 6401: `dbsize 0 -> 83`
  - `cat-cafe:msg:*` 计数 = 74
- 抽样读取：
  - `msg:{id}` 有正文
  - `thread:{threadId}` / `thread:{threadId}:participants` 可读

## 根因分析（Why）

### 直接原因

- 当前可用 Redis 快照里已经不存在消息正文键，导致“从快照直接恢复历史消息”不可行。

### 系统性原因

1. **备份链不完整**：没有覆盖到“消息正文仍存在时”的有效快照。
2. **实例边界不清晰**：dev/user/test Redis 并行时，容易误把“切到另一个实例”理解为“数据被删”。
3. **恢复流程缺失**：此前缺少固定 SOP（dry-run 统计、pre-apply 备份、导回后核验）。
4. **TTL 历史策略风险**：消息曾是有限 TTL，天然存在过期窗口。

### 仍未确定

- 缺乏强审计证据，无法精确定位“具体哪一条操作”导致正文丢失（例如历史 flush/覆盖加载/实例切换）。

## 修复与防再发（Fix + Prevention）

1. **恢复工具化**：新增 markdown 导回脚本，支持 dry-run 与 apply。
2. **恢复前备份强制化**：apply 前自动 pre-apply 快照。
3. **实例隔离**：持续使用 dev/user 分离，避免测试/开发/个人数据混用。
4. **提示词红线落地**：三只猫的指引文档增加 Redis 数据保护规则（禁止模糊操作、先备份后恢复、先 dry-run）。
5. **报告制度**：数据类事故必须写 bug-report + retrospective，并记录恢复边界。

## Tradeoff

- 从 markdown 重建能恢复“对话内容”，但不能保证 1:1 恢复原 invocation 全状态与所有衍生字段。
- 选择“可回放内容优先”而不是追求不可得的完整原始状态。

## Open Questions

1. 是否要把消息历史长期存储迁移到双写（Redis + 文件/数据库）以彻底规避单点？
2. 是否需要增加定时“恢复演练”（从最近备份恢复到隔离端口并做一致性校验）？
3. 是否要对关键键空间加审计（至少记录 FLUSH/RESTORE/重启配置变更）？

## Next Action

1. 以本次恢复脚本为基础，补一个“每日自动导出聊天日志”的离线归档任务。
2. 在 CI 增加一条轻量检查：Redis 相关脚本必须包含 dry-run 模式与 apply 前备份。
3. 后续阶段评估消息持久层升级（持久数据库/对象存储归档）。
