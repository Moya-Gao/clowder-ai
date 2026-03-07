---
feature_ids: [F073]
related_features: [F046, F067]
topics: [sop, automation, workflow, governance]
doc_kind: spec
created: 2026-03-07
---

# F073: SOP 自动化闭环 — 猫猫自主跑完全流程

> Status: spec
> Owner: 布偶猫
> Created: 2026-03-07

## Why

铲屎官需要反复提醒同样的事情，特别是：
- 冷启动守护（跨线程协作）
- 同线程愿景守护
- 先 push main 再开 worktree
- feat close 需要其他猫做愿景守护

**根因**：
1. 上下文压缩后丢失关键检查点
2. Skill 之间没有自动串联，每步都需要手动触发
3. Hook 没有有效提醒（压缩后的 hook 可能失效）

**铲屎官原话 (2026-03-07)**：
> "你看你们很多时候需要我一次次的提醒。如果不唠叨你们很容易走错，特别是上下文压缩之后。"

## What

**核心目标**：猫猫能自主跑完 feat 全生命周期，铲屎官只需要在 close 时收到通知。

### 方案：Skill 前置检查 + 压缩后自动注入

| 组件 | 功能 | 实现 |
|------|------|------|
| **Skill 前置检查器** | 每个 skill 执行前自动检查必要条件 | skill manifest 新增 `preconditions` 字段 |
| **压缩后注入** | 上下文压缩后自动注入关键提醒 | SystemPromptBuilder 读取 `critical-reminders.md` |
| **阶段自动流转** | 完成一个阶段自动提示下一步 | skill 末尾的 `next_steps` 自动路由 |
| **跨猫守护触发** | feat close 前自动 @ 其他猫做愿景守护 | completion skill 内置跨猫验证流程 |

### 需求点 Checklist

**P0 — 必须有**
- [ ] Skill 前置检查：worktree skill 检查 main 是否已 push
- [ ] 压缩后关键提醒注入：SystemPromptBuilder 读取 `critical-reminders.md`
- [ ] feat close 跨猫守护：completion 流程自动 @ 其他猫

**P1 — 应该有**
- [ ] 阶段自动流转提示：skill 末尾提示下一步
- [ ] Hook 诊断：检查为什么压缩后 hook 不生效

**P2 — 可以有**
- [ ] 常用话术模板（铲屎官一键发送）
- [ ] 流程执行仪表盘（可视化当前阶段）

## Acceptance Criteria

1. **前置检查**：执行 `worktree` skill 时，如果本地有未 push 到 main 的 docs 改动，自动提示先 push
2. **压缩后提醒**：上下文压缩后，关键检查点（如"先 push main 再开 worktree"）自动出现在 prompt 中
3. **跨猫守护**：执行 feat completion 时，自动 @ 至少一只其他猫做愿景守护，不需要铲屎官手动提醒
4. **闭环验证**：本 Feature 自己作为测试用例 —— 从立项到 close 全程不需要铲屎官提醒流程步骤

## Links

- 相关：[F046 愿景守护协议](F046-anti-drift-protocol.md)
- 相关：[F067 Cold-start Verifier](F067-cold-start-verifier.md)
- 讨论来源：Thread `thread_...`（2026-03-07 铲屎官提问）

## Key Decisions

（待讨论后填充）

## Dependencies

- `Evolved from`: F046（愿景守护协议）— 本功能是愿景守护的自动化执行
- `Related`: F067（Cold-start Verifier）— 冷启动守护可复用其验证机制

## Risk

| 风险 | 缓解 |
|------|------|
| 过度自动化导致猫猫不思考 | 前置检查只是提醒，不阻断执行 |
| 压缩后注入增加 prompt 长度 | `critical-reminders.md` 严格控制在 10 行以内 |

## Open Questions

1. Hook 为什么压缩后不生效？需要诊断
2. `critical-reminders.md` 放在哪里？CLAUDE.md 还是独立文件？
3. 跨猫守护是异步还是同步等待？

## Review Gate

- [ ] 跨猫 review（首选缅因猫）
- [ ] 云端 Codex review 通过
- [ ] 本 Feature 自己作为测试用例验证闭环

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-03-07 | Kickoff |
