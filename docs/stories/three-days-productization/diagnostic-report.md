---
title: "Clowder AI Playground 分支多猫协作失效诊断报告"
created: 2026-03-28
participants: [opus, gpt52, opencode]
status: final
audience: external — 发给 fork 团队
---

# Clowder AI Playground 分支多猫协作失效诊断报告

> 诊断方：Cat Café 原作者团队（布偶猫/Opus、缅因猫/GPT-5.4、金渐层/OpenCode）
> 日期：2026-03-28
> 仓库：`clowder-labs/clowder-ai` `playground` 分支（HEAD as of 2026-03-27）
> 对照基线：`clowder-labs/clowder-ai` `main` 分支

---

## 一、症状

据反馈，playground 分支的多猫协作出现以下退化：

1. **传球失效**：同时 @多只猫后，「大家一人说一句，然后就停了」
2. **群聊不可用**：猫无法发起或参与多猫讨论
3. **Skill 失效**：猫的 skill 「没有打进去」「读不懂」
4. **整体变笨**：猫的表现从「团队协作」退化成「一次性问答」

---

## 二、诊断过程

我们的诊断经历了三轮迭代，每轮都修正了前一轮的判断偏差：

| 轮次 | 方法 | 初始判断 | 修正后 |
|------|------|---------|--------|
| 第一轮 | 三猫独立分析配置/文档 | 「shared-rules 没注入、CLAUDE.md 被掏空」 | — |
| 第二轮 | 代码级对比 SystemPromptBuilder | 规则其实注入了，代码基本相同 | 修正了「没注入」的判断 |
| 第三轮 | 实证验证（clone + harness 抓取启动参数） | 通道补上了，但语义不对 | 精确定位到 provider 层三个断点 |

**这个迭代过程本身就是重要信息**：问题不在表面，需要逐层深入才能定位。

---

## 三、核心发现：系统提示词注入链完整，但三个断点导致失效

### 3.1 注入链是完整的（与 main 分支基本相同）

经过代码对比，playground 分支的 `SystemPromptBuilder.ts` 与 main 分支**功能相同**。以下组件均完整保留：

| 组件 | 代码位置 | 功能 | playground 状态 |
|------|---------|------|----------------|
| `GOVERNANCE_L0_DIGEST` | SystemPromptBuilder.ts L238-251 | 注入 shared-rules 家规（P1-P5 原则、W1-W7 世界观、纪律） | **保留** |
| `WORKFLOW_TRIGGERS` | SystemPromptBuilder.ts L255-287 | 按品种注入传球规则（「完成开发→@缅因猫请 review」等） | **保留** |
| `buildTeammateRoster()` | SystemPromptBuilder.ts L294 | 注入队友名册（@句柄、擅长、注意事项） | **保留** |
| `buildCallableMentions()` | SystemPromptBuilder.ts L370-381 | 注入 @提及格式教学（行首写法、正确/错误示例） | **保留** |
| `buildInvocationContext()` | SystemPromptBuilder.ts L480-497 | 注入链位置（「你是第 2/3 只」）+ A2A 出口检查 | **保留** |
| `parseA2AMentions()` | a2a-mentions.ts L64-120 | 解析回复中的行首 @提及，扩展 worklist | **保留** |
| `route-serial.ts` worklist | route-serial.ts L786-815 | A2A 接力队列：检测到 @提及 → push 下一只猫 | **保留** |

**所以问题不是「规则没注入」或「路由代码没了」。整个骨架在。**

### 3.2 三个断点导致骨架无法运转

#### 断点 1：provider 通道把系统规则降级为普通文本

**代码证据**：`invoke-single-cat.ts` L777-798

```typescript
// invoke-single-cat.ts — 系统提示词注入方法
const effectivePrompt =
  injectSystemPrompt && params.systemPrompt
    ? `${params.systemPrompt}\n\n---\n\n${promptWithMission}`
    : promptWithMission;
```

所有 provider 都通过**拼接到 prompt 字符串**的方式注入系统提示词——这是一个 universal fallback。在我们的 Claude Code CLI / Codex CLI 环境中，这没有问题，因为这些 CLI 本身就能区分 system prompt 和 user prompt。

但在 `relayclaw` provider 中：

```typescript
// RelayClawAgentService.ts — 发给下游的只有 params.query
// 没有独立的 systemPrompt 字段
```

系统规则被拼进了 `query` 字段。对下游模型来说，15-20k token 的身份+家规+队友表+传球纪律，变成了**一段很长的用户消息前缀**，而不是最高优先级的系统指令。

更关键的是，`jiuwenclaw` 的 Python 后端自带一套更高优先级的通用 system prompt：

```python
# vendor/jiuwenclaw/jiuwenclaw/agentserver/interface.py L98
"你是一个能够帮助用户执行任务的小助手"
```

```python
# vendor/jiuwenclaw/jiuwenclaw/agentserver/prompt_builder.py L882
# 自带的 todo/memory/温暖助手范式
```

**结果**：我们精心编排的共同规则被盖掉了。猫听到的最高优先级指令不是「@是路由指令——发前问到我这里结束了吗？」，而是「你是一个小助手」。

**类比**：想象你给足球队员发了一份详细的战术手册，但教练在开赛前对他们说「你们就是来踢着玩的」。队员会听谁的？

#### 断点 2：Session 连续性被切断

**代码证据**：`cat-config.json`

```json
// dare:
"sessionChain": false

// jiuwenclaw:
"sessionChain": false
```

加上 `relayclaw` provider 每次请求都生成新的 `session_id`（砚砚/GPT-5.4 通过实际 harness 抓取验证），导致：

- 第 1 轮：猫知道「你是团队里的猫，要传球」
- 第 2 轮：猫不记得第 1 轮说了什么
- 第 3 轮：猫还是从零开始

我们的系统有 `SessionBootstrap`（session/SessionBootstrap.ts），会在新 session 开始时注入上一个 session 的摘要、任务快照、thread memory。`sessionChain=false` 直接关掉了这个机制。

**类比**：队员每跑完一个回合就被换成一个新人，新人对之前的战术讨论一无所知。

#### 断点 3：多猫异质性消失

**代码证据**：`modelarts-preset.json`

```json
{
  "sharedAccount": {
    "profileId": "modelarts-shared",
    "models": ["glm-5"]
  },
  "members": [
    { "catId": "office",    "provider": "relayclaw", "nickname": "小九" },
    { "catId": "assistant", "provider": "dare",      "nickname": "小理" },
    { "catId": "agentteams","provider": "acp",       "nickname": "小协" }
  ]
}
```

三个成员共用一个 `modelarts-shared/glm-5` 账户。原来的多猫体系中，不同品种的猫使用不同家族的模型（Claude/GPT/Gemini），每个家族有独特的视角和擅长领域——布偶猫（Claude）做架构、缅因猫（GPT）做 review、暹罗猫（Gemini）做设计。

三只同脑的猫，不会产生真正的交叉审查。

---

## 四、为什么 GLM-5（≈ Sonnet 水平）也传不好球

这是最关键的问题。GLM-5 的能力约等于 Claude Sonnet，而 Sonnet 在我们的系统中传球完全正常。

答案是：**传球不靠模型自觉，靠的是一整套基础设施。**

我们的传球运转依赖以下闭环：

```
① 系统提示词以最高优先级注入传球规则
   │
   ├── GOVERNANCE_L0_DIGEST: "@是路由指令"
   ├── WORKFLOW_TRIGGERS: "完成开发 → @缅因猫请 review"
   ├── A2A Exit Check: "回复前问'到我这里结束了吗？'"
   └── 缅因猫专属: "完成任务后必须 @ 下一棒" + "出口一问"
   │
② 猫在回复中写出 @handle（行首）
   │
③ parseA2AMentions() 实时解析回复文本
   │
   ├── 去除 code fence（避免误匹配）
   ├── 行首匹配（非行首无效）
   ├── 最长匹配优先（@opus 不会误匹配 @opus-45）
   └── token 边界检查
   │
④ route-serial.ts 的 worklist 自动扩展
   │
   ├── worklist.push(nextCat)
   ├── a2aCount++ / maxDepth 防死循环
   ├── 去重（已在队列中不重复加）
   └── 公平门控（用户消息排队时暂停 A2A）
   │
⑤ 下一只猫被调用，带着新的 buildInvocationContext()
   │
   ├── 链位置更新："你是第 2/3 只被召唤的猫"
   ├── A2A Exit Check 重新注入
   └── 消息历史包含前面猫的回复
   │
⑥ 循环继续直到没有新的 @mention
```

**这六步中，断点在第①步：规则虽然注入了，但在 relayclaw/jiuwenclaw 通道里被降成了普通文本，被 jiuwenclaw 自带的「小助手」人设覆盖。**

即使用 Claude Opus（当前最强模型），如果不修复这个断点，照样传不好球。不是模型笨，是模型收到的最高优先级指令不对。

---

## 五、修复建议

按优先级排序：

### P0：给 relayclaw/jiuwenclaw 一条真正的 system prompt 通道

**当前状态**：系统规则拼进 `query` 字段，被当作用户消息。
**目标**：让系统规则以 `system` role 到达模型。

具体做法：
- `RelayClawAgentService` 的请求中增加独立的 `systemPrompt` 字段
- `jiuwenclaw` 的 Python 后端需要将 Cat Café 的系统规则作为 system prompt 注入，优先级高于自带的「小助手」人设
- 或者至少让 Cat Café 的规则排在 jiuwenclaw 默认 prompt 之后（后注入 = 更高优先级，对多数模型成立）

### P1：打开 sessionChain，让 provider 复用 session

**当前状态**：`dare` 和 `jiuwenclaw` 的 `sessionChain=false`，每轮新 session。
**目标**：按 `threadId + catId` 稳定复用 session。

具体做法：
- 将实际出场猫的 `sessionChain` 设为 `true`
- `relayclaw` provider 层改为按 `threadId + catId` 复用 `session_id`，而非每次新建
- 确保 `SessionBootstrap` 能正常工作（上一轮摘要注入下一轮）

### P2：恢复多猫异质性

**当前状态**：三只猫共用 `modelarts-shared/glm-5`。
**目标**：至少两种不同来源的模型，让交叉审查有意义。

这不是说必须用 Claude + GPT + Gemini。任何两种有差异化视角的模型组合都行——关键是审查者和被审查者不能是同一个脑子。

### P3：CLAUDE.md / AGENTS.md 不是 README

**当前状态**：CLAUDE.md 被改成了 Windows 快速出包验证教程。
**目标**：CLAUDE.md 应包含猫的完整行为指导。

CLAUDE.md 不是给人类开发者看的 README，是给 AI agent 看的行为规范。对 Claude Code 环境来说，CLAUDE.md 是最高优先级的项目级指令。把它改成打包教程 = 把猫的行为指南换成了设备说明书。

---

## 六、一句话总结

> **代码可以 fork，但判断力不会跟着走。不是模型变笨了——是让模型变聪明的基础设施，在 provider 对接过程中被无意间降级了。规则灌进去了，但模型没有以最高优先级听到它们。**

修复路径很明确：先修通道（P0），再修连续性（P1），再补异质性（P2）。这不需要换模型，需要的是让现有模型正确地接收和遵循协作规则。

---

## 附录：代码路径索引

| 文件 | 行号 | 功能 |
|------|------|------|
| `SystemPromptBuilder.ts` | L238-251 | GOVERNANCE_L0_DIGEST — shared-rules 注入 |
| `SystemPromptBuilder.ts` | L255-287 | WORKFLOW_TRIGGERS — 按品种的传球规则 |
| `SystemPromptBuilder.ts` | L294 | buildTeammateRoster() — 队友名册 |
| `SystemPromptBuilder.ts` | L345-395 | buildStaticIdentity() — 完整系统提示词组装 |
| `SystemPromptBuilder.ts` | L480-497 | buildInvocationContext() — 链位置 + A2A 出口检查 |
| `invoke-single-cat.ts` | L777-798 | 系统提示词注入逻辑（prepend to prompt） |
| `a2a-mentions.ts` | L64-120 | parseA2AMentions() — 行首 @提及解析 |
| `route-serial.ts` | L786-815 | worklist 自动扩展 — A2A 接力核心 |
| `SessionBootstrap.ts` | L96+ | Session 间记忆交接 |

---

*诊断者：布偶猫/宪宪（Claude Opus 4.6）、缅因猫/砚砚（GPT-5.4）、金渐层/小金（OpenCode）*
*日期：2026-03-28*
