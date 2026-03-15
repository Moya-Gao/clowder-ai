---
capsule_id: "F095-D-2026-03-13"
context: "F095 Phase D 软删除 + 回收站 — 从误删教训到终态数据安全"
feature_ids: [F095]
doc_kind: capsule
created: 2026-03-13
---

## What Worked
- 铲屎官的"面向终态开发"提醒是关键——没有停在确认弹窗（脚手架），直接推到软删除 + 回收站（终态基座），避免了"先做临时方案后重做"的浪费
- Review 链路抓到了多个真实安全问题：PATCH 软删线程仍可修改、POST messages 绕过删除保护、backlogItemId 跨用户归属校验缺失、主服务未注入 backlogStore 导致校验死分支——每一个都是上线后的真实 bug
- 软删除的数据模型设计（`deletedAt` 时间戳 + 条件过滤）是正确的终态原语：后续加 cron 物理清理只需要增量扩展，不需要改动现有 softDelete/restore/listDeleted 的任何逻辑

## What Failed
- Phase C 的 backlogItemId 校验一开始只做了存在性检查没做归属校验，又只在路由层加了条件分支但主服务没注入 backlogStore——Review 连续两轮才完全堵上。说明"安全相关的校验"需要一次性想完整：存在性 + 归属 + 注入 + 负例测试
- Phase D 软删除后，遗漏了 PATCH 和 POST /api/messages 两个写路径的保护——"删除保护"不是只在 DELETE 端点加 guard 就够，需要枚举所有写操作端点

## Trigger Missed
- 应该在写软删除时系统性扫描所有 thread 相关的写操作端点（PATCH, POST messages, addParticipants 等），而不是只盯 DELETE 路由。可以用 grep `threadId` + 写操作来自动化枚举
- AC-D6（30天自动清理 cron）延后是合理决策，但应该在立 AC 时就标注"延后候选"，避免每次愿景守护都要重新判断是否阻塞 close

## Doc Links
- [F095 聚合文件](../features/F095-sidebar-collapse-memory.md)
- [Phase A~C 反思胶囊](2026-03-11-f095-thread-sidebar-navigation-capsule.md)
- PR #378 (hotfix: 确认弹窗 + 审计) / #380 (Phase D: 软删除 + 回收站)

## Rule Update Target
- `cat-cafe-skills/quality-gate/SKILL.md`: 建议在 Step 3 (Spec Verify) 加一条检查——"安全相关 AC（删除/权限/归属）是否覆盖了所有写操作端点，不只是主端点"
- 无需新增 shared-rules 条目（现有"Bug先定位根因再修"已覆盖此类问题）
