---
title: "Brainstorm · ReAct → TeamAct：从单 Agent 主循环到团队协作主循环"
date: 2026-04-28
participants: [opus-46, codex, opus-47, gemini, landy]
context: "赛博猫猫面对面 · 多智能体 Harness 进化论直播彩排"
status: reviewed
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

**本质是反馈方向，不是三拍顺序。** Thought → Action → Observation 是叙事，真正的引擎是 Observation 反向喂回 Thought——让外部世界 ground 内部推理。没有这个反向反馈，ReAct 退化成普通 pipeline。

核心特征：
- 单一 agent 的内部循环
- 每一轮都是 think → act → observe 的三拍，**关键是 observe 反向喂回 think**
- 结束由模型自主判断

## TeamAct 主循环（团队协作）

```
loop:
    State   → 读 shared state（docs / spec / task / 记忆 / resumeCapsule）
    Owner   → 谁持球？（@ 路由 / hold_ball）
    Action  → 持球猫执行（写代码 / review / 设计 / 调研）
    Evidence → 产出证据（commit / test / trace / 截图）
    Verdict → 验证（跨猫 review / 自检 / 铲屎官确认）
    Route   → 传球（@ 下一只猫 / hold_ball / @ 铲屎官）
```

**结束条件**（五项同时满足）：
1. **AC 全部达成** — 验收标准逐条通过，无 deferred AC
2. **证据已附** — 每条 AC 有对应的 commit / test / trace 证据
3. **跨猫交叉验证** — 非作者的猫确认通过（Generator-Verifier）
4. **无悬空球权** — 没有 unowned ball，没有未决的 open question（resolved or escalated）
5. **愿景收敛** — CVO 确认产出符合愿景（Vision Oracle）

**TeamAct 同理：六步是叙事，本质是 shared state 反向喂回每只猫的 context**——让团队的"集体外部世界"ground 个体 reasoning。State 不只是被动读 docs，还包括 **resumeCapsule**（烁烁观察）——前一只猫主动留下 What/Why/Tradeoff 胶囊作为下一棒的 fast bootstrap，这是 cross-cat-handoff 的本质。

**AC 是 vision 的 proxy，proxy 会漂移。** 五项结束条件不是平行的：AC + 证据 + 交叉验证是局部最优 proxy，CVO 的愿景确认是全局 oracle——proxy 和 oracle 缺一不可。历史教训：F101 Phase D 12 项 AC ✅ 但 UI 不可用；F173 close 事件 AC 抽出去开 stub feat 假装"已闭环"。

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
| 动作 | tool call | 持球猫产生 state-changing work + 附 evidence |
| 验证 | observation（工具返回） | 跨猫 review + 愿景守护 |
| 结束判断 | 模型自主（无 tool call） | 五项收敛（AC + 证据 + 交叉验证 + 无悬空球权 + 愿景） |
| 路由失败 | —（单 agent 无传球） | 球权掉地上 / 乒乓球 / 虚空传球 |
| Grounding 失败 | hallucination（伪 observation 喂回 thought） | 碎片推理代替 shared state read / 同族 echo chamber |

## 关键洞察

1. **ReAct 的结束条件太弱**：单 agent 自己判断"够了"容易 hallucinate completion。TeamAct 用交叉验证解决这个问题。
2. **TeamAct 的新失败模式**：ReAct 不存在"传球"问题，TeamAct 的独特风险是球权管理（F167 专门治这个）。
3. **Vision Oracle 必须是人不能算法化**：vision drift 是停机问题——没法自动检测"当前是否偏离 vision"，因为判断本身需要 vision 的全局理解。所以 magic words 必须由铲屎官手动触发，CVO 不是因为在 SOP 里所以是 oracle，是因为只有人能定义 vision 才必须是 oracle。
4. **Shared State 是团队的 grounding，不是看板**：ReAct 靠工具返回 ground 内部推理，TeamAct 靠共享 docs/git/任务状态反向喂回每只猫的 reasoning。两者的本质都是反馈方向，而不是状态展示。
