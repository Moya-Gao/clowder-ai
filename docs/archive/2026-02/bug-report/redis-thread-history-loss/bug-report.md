---
feature_ids: []
topics: [redis, thread, history]
doc_kind: bug-report
created: 2026-02-26
---

# Bug Report - Redis Thread History Loss

## 1) 报告人

- 报告人：铲屎官（用户）
- 发现方式：启动 `scripts/start-dev.sh` 后发现历史 thread/message 消失，仅剩少量会话痕迹。
- 报告时间：2026-02-10

## 2) 复现步骤（期望 vs 实际）

1. 启动本地开发环境（`pnpm start` / `scripts/start-dev.sh`）。
2. 打开已有对话线程，检查历史消息。

期望：
- 之前的 thread 与消息历史仍可读取（至少在 Redis 快照/备份中可恢复）。

实际：
- Redis 中只剩 `thread/session/invocation/delivery-cursor` 少量键；
- `cat-cafe:msg:*`（消息正文）在可用快照里为 0；
- `audit-2026-02-09.ndjson` 仅有 threadId 痕迹，不含完整消息正文。

## 3) 根因分析（定位过程）

已确认事实：
- 对现有运行库与可用 dump 做法证后，历史消息正文键缺失，无法直接从 Redis 快照恢复。
- 可用快照规模很小（约 27 keys），与预期历史规模不匹配。
- 目录/实例曾存在“多 profile、多端口”并行：`6399`（dev）与 `6401`（user），易产生“看起来丢了，实际写到另一个实例”的错觉。
- 历史 TTL 策略曾为有限值（消息默认 7 天），存在自然过期风险。

无法直接证明（当前证据不足）：
- 具体是哪个进程/脚本在何时清理了原始消息键；
- 是否发生过手工 `FLUSH*` 或覆盖加载旧快照（缺乏完整操作审计链）。

结论：
- 这次属于“可恢复源不足导致的历史丢失”：Redis 可用备份中已不包含正文，恢复边界被锁死。

## 4) 修复方案（含取舍）

已执行修复：
1. 新增 `md -> Redis` 导回脚本（`scripts/restore-chat-md-to-redis.mjs`）：
   - 支持 `dry-run` 统计与 `apply` 正式导入；
   - 导入前自动做 pre-apply 快照备份；
   - 幂等导入（重复执行不破坏数据）。
2. 从导出的 markdown 对话日志重建 thread/message 并导回 Redis（6399 + 6401）。
3. 复盘并写入三只猫提示词，新增 Redis 数据保护红线，防再次“无感丢库”。

取舍：
- 无法 100% 恢复原始 invocation 全状态，只能恢复可从 markdown 提取的 thread/message 内容；
- 这是“历史重建”，不是“字节级原始快照还原”。

## 5) 验证方式

脚本验证：
- `REDIS_URL=redis://127.0.0.1:6399 pnpm redis:md:restore:dry-run`
  - 解析结果：`parsed=4 threads=4 messages=65`
- `REDIS_URL=redis://127.0.0.1:6399 pnpm redis:md:restore:apply`
- `REDIS_URL=redis://127.0.0.1:6401 pnpm redis:md:restore:apply`

导回后验证：
- `cat-cafe:msg:*` 键数量恢复为 74（65 条消息详情 + 索引键）；
- 4 个 thread 的 `thread:*` 与 `thread:*:participants` 可读；
- 抽样 `msg:{id}` 可读到正文内容。

最终结论：
- 原始 Redis 快照无法找回正文；
- 但已通过 markdown 导出日志成功恢复主要历史消息内容。
