---
feature_ids: [F079]
related_features: []
topics: [collaboration, play-mode, rich-block]
doc_kind: spec
created: 2026-03-07
status: done
---

# F079 Voting System

## Why

多猫协作时经常需要投票决策（如"谁最绿茶"、狼人杀投票等），目前只能人工统计。需要系统化的投票机制 + 自动汇总 + rich block 展示。

## What

### 核心功能

1. **触发**：`/vote` 命令 -> 弹窗配置
2. **配置项**：
   - 投票问题（必填）
   - 选项列表（可选，不填则自由投票）
   - 实名/匿名（默认实名）
   - 超时时间（默认 2min）
3. **投票过程**：
   - 系统给每只被 @ 的猫发投票请求
   - 猫猫回复带结构化标记 `[VOTE:选项]`
   - 系统 regex 解析收集
4. **汇总**：
   - 全员投完或超时 -> 系统自动统计
   - 生成 rich block (card) 插入 thread
5. **匿名模式**：
   - play 模式下可选匿名（只显示票数不显示投票人）
   - 狼人杀等推理游戏需要实名（推理阵营）

### 技术要点

- Thread metadata 加 `votingState: { question, options, votes: {}, deadline, anonymous }`
- 路由层检测投票完成 -> 触发汇总 -> 清除 votingState
- Rich block 用现有 `card` kind

## Acceptance Criteria

- [ ] `/vote` 命令触发弹窗配置
- [ ] 弹窗支持：问题、选项、实名/匿名、超时
- [ ] 猫猫投票后系统能解析 `[VOTE:xxx]` 标记
- [ ] 全员投完或超时自动生成结果 rich block
- [ ] 匿名模式只显示票数不显示投票人
- [ ] play 模式下投票功能正常工作

## Links

- 讨论来源：Thread `thread_mm4dj9jp0tij0ch3` (2026-03-07 06:49)

## Key Decisions

1. 用 `/vote` 命令触发（不用自然语言，避免误触发）
2. 汇总由系统完成（不是某只猫负责）
3. 默认实名，匿名是可选项

## Dependencies

- 依赖 rich block 系统（已有）
- 依赖路由层消息拦截能力（已有）

## Risk

- 低风险：功能相对独立，不影响核心流程

## Open Questions

- 超时后未投票的猫算弃权还是无效票？（暂定弃权）
- 是否支持弃权选项？

## Review Gate

- 跨猫 review：@codex

## Timeline

| Date | Event |
|------|-------|
| 2026-03-07 | Kickoff |
