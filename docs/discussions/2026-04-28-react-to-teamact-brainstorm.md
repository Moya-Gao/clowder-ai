---
title: "Brainstorm · ReAct → TeamAct：从单 Agent 主循环到团队协作主循环"
date: 2026-04-28
participants: [opus-46, codex, opus-47, gemini, landy]
context: "赛博猫猫面对面 · 多智能体 Harness 进化论"直播彩排
status: draft
---

# Brainstorm · ReAct → TeamAct

## 起因

铲屎官在直播彩排中提问：ReAct 有主循环和结束条件，那团队协作能不能也总结出类似的公式？

## ReAct 主循环（单 Agent）

```
while has_tool_call:
    Thought → Action → Observation
```

**结束条件**：没有 tool call 了（模型认为信息足够，直接输出 final answer）。

核心特征：
- 单一 agent 的内部循环
- 每一轮都是 think → act → observe 的三拍
- 结束由模型自主判断

## TeamAct 主循环（团队协作）

```
loop:
    State   → 读 shared state（docs / spec / task / 记忆）
    Owner   → 谁持球？（@ 路由 / hold_ball）
    Action  → 持球猫执行（写代码 / review / 设计 / 调研）
    Evidence → 产出证据（commit / test / trace / 截图）
    Verdict → 验证（跨猫 review / 自检 / 铲屎官确认）
    Route   → 传球（@ 下一只猫 / hold_ball / @ 铲屎官）
```

**结束条件**（三者同时满足）：
1. **AC 全部达成** — 验收标准逐条通过
2. **跨猫交叉验证** — 非作者的猫确认通过（Generator-Verifier）
3. **愿景收敛** — CVO 确认产出符合愿景（Vision Oracle）

核心特征：
- 多 agent 的外部循环
- 每一轮都有明确的球权归属（Owner）和证据产出（Evidence）
- 结束不由单只猫判断，需要交叉验证 + 愿景确认

## 嵌套关系（分形结构）

三层循环层层嵌套：

```
feat creation（系统层）
  └─ @ mention（团队层 = TeamAct）
       └─ tool call（单 agent 层 = ReAct）
```

- **最内层** tool call：单只猫调用工具完成一步操作
- **中间层** @ mention：猫与猫之间传球协作
- **最外层** feat creation：整个功能从立项到关闭的生命周期

每一层都有自己的主循环和结束条件，结构是自相似的。

## ReAct vs TeamAct 对比

| 维度 | ReAct（单 Agent） | TeamAct（团队） |
|------|-------------------|-----------------|
| 循环主体 | 单一模型 | 多猫 + CVO |
| 状态 | 模型内部 context | shared state（docs / git / 任务） |
| 动作 | tool call | @ mention + tool call |
| 验证 | observation（工具返回） | 跨猫 review + 愿景守护 |
| 结束判断 | 模型自主（无 tool call） | 三方收敛（AC + 交叉验证 + 愿景） |
| 失败模式 | hallucination | 球权掉地上 / 乒乓球 / 虚空传球 |

## 关键洞察

1. **ReAct 的结束条件太弱**：单 agent 自己判断"够了"容易 hallucinate completion。TeamAct 用交叉验证解决这个问题。
2. **TeamAct 的新失败模式**：ReAct 不存在"传球"问题，TeamAct 的独特风险是球权管理（F167 专门治这个）。
3. **Vision Oracle 是硬约束**：ReAct 没有外部终止者，TeamAct 的 CVO 是系统最终一致性的保证。
4. **Shared State 是团队的 observation**：ReAct 靠工具返回值感知世界，TeamAct 靠共享文档/git/任务状态感知团队进度。
