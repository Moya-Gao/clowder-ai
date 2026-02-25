# Multi-Agent 协同模式讨论会议纪要

**Thread ID**: `thread_mm1cpvpw0ndntsfc`
**日期**: 2026-02-24
**参与者**: 铲屎官、布偶猫 4.5、布偶猫 4.6（宪宪）、缅因猫 gpt52（砚砚）、缅因猫 codex（砚砚）

---

## 背景

铲屎官发起 Deep Research Pipeline 实战测试，调研 Claude Agent Teams / oh-my-opencode / Kimi Agent Swarm / Cat Cafe A2A 四个 multi-agent 系统的协同方式，并引发了三轮深度讨论：我们能从别人那里借鉴什么？

**相关调研报告**: `docs/research/2026-02-24-multi-agent-comparison/`

---

## 第一轮：从别人身上能学什么？

### 调研产出

4.6 操作 Chrome MCP 完成：
- 三路 Deep Research（ChatGPT / Claude.ai / Gemini）并行调研
- GPT-5.2 Pro 交叉审阅
- 归档在 `docs/research/2026-02-24-multi-agent-comparison/`

### 四只猫的借鉴建议

| 来源 | 借鉴点 | 4.5 | 4.6 | gpt52 | codex |
|------|--------|-----|-----|-------|-------|
| Kimi Swarm | Wide Research 并行扇出 | ✅ | ✅ | ✅ | ✅ |
| Agent Teams | Self-claim 自领任务 | ✅ | ⚠️ 改成建议式 | ✅ 加 lease | ✅ 加 lease |
| Agent Teams | 任务三态状态机 | ✅ | ✅ | ✅ | ✅ |
| Agent Teams | File locking 写入锁 | — | ⚠️ 串行更好 | ✅ | ✅ |
| OMO | Intent Gate 先分类再路由 | ✅ | ✅ | ✅ | ✅ |

### 关键分歧

4.6 对 self-claim 持保留意见——认为应该是"猫建议 + 铲屎官批准"，而非猫自行领取。

---

## 第二轮：铲屎官的拷问

### 铲屎官提出的核心问题

> "宪宪自己写完不更好吗？各自领取增加了复杂度，收益有那么大吗？"
> "我们不止是 coding agent，vision 是猫们陪着我做任何事情。"
> "上下文会污染怎么办？"

### 收敛后的共识

1. **Swarm 需要区分场景**——不是所有场景都适合并行
2. **任务池应该在 Backlog 层，不是 Thread 内**——各猫领不同 feature，各开新 thread，天然隔离
3. **Coding 场景不适合 Swarm**——单猫写 + 另一猫 review 的流水线已经很高效
4. **Research / Brainstorm 适合 Swarm**——多视角有价值，合并成本可控

### 四只猫的投票（谁做扇入合并）

- 4.5：投铲屎官
- 4.6：投铲屎官（Brainstorm 阶段），布偶猫辅助整理
- gpt52：投布偶猫做 Integrator，砚砚做 Gate
- codex：投布偶猫做 Integrator，砚砚做 Gate

---

## 第三轮：工作流阶段拆解（最重要的突破）

### 铲屎官给出的工作流

```
发现（铲屎官或猫猫日报）
    ↓
Research（Swarm 适用）
    ↓
Brainstorm（Swarm 适用，铲屎官参与）
    ↓
拆解 feat（单点 1:1）
    ↓
采访确认需求 → 有验收标准的 Backlog（单点 1:1，feat skills）
    ↓
技术细节讨论（猫猫自决，铲屎官可选旁听）
    ↓
Coding（猫自治，铲屎官只看架构）
```

### 铲屎官的核心洞察

> "技术细节讨论，很多时候我只需要最终拍板，甚至不需要拍板，你们几只猫猫自己讨论出的最优解即可。"
> "Coding 阶段，具体每一行代码我没看过，这些更像是你们自行决策。"

### 决策权是漏斗模式（铲屎官确认）

- 越往上面越宏观的东西（架构、方向）→ 铲屎官越关注
- 越往下面越细节的东西（实现、技术细节）→ 铲屎官越不关注

### 四只猫的最终观点汇总

| 阶段 | 协作模式 | 铲屎官角色 | 扇入者 |
|------|---------|-----------|--------|
| 发现 | 触发式 | 信息源/好奇心 | — |
| Research | **Web Swarm** | 发起 + 审阅 | 布偶猫初步综合 → 铲屎官审阅 |
| Brainstorm | **Cat Swarm** | 参与 + 拍板 | **铲屎官** |
| 拆解 feat | 1:1 | 铲屎官定边界 | 布偶猫 |
| 采访确认需求 | 1:1 + feat skills | 需求来源 | 采访猫 |
| 技术细节讨论 | 猫对猫 | **可选旁听** | 布偶猫 + 砚砚把关 |
| Coding | 单猫 + review | **只看架构** | 砚砚 gate + 布偶猫集成 |

---

## 最终共识

1. **Swarm 是阶段性工具，不是常态**——只在 Research 和 Brainstorm 阶段使用

2. **决策权是漏斗，不是开关**——铲屎官在上游（发现/Brainstorm/需求确认）深度参与，在下游（技术细节/Coding）逐渐放手

3. **两层任务面**：
   - Global（Backlog）：承载"要做什么"，适合领取，领取后开新 thread
   - Thread（执行）：承载"怎么做"，单 owner + 多 contributor

4. **扇入者按阶段指定**：
   - Research/技术讨论：布偶猫综合 + 砚砚把关
   - Brainstorm/需求确认：铲屎官
   - Coding：砚砚 gate

5. **Research Swarm 已验证，值得产品化**——今天的 Deep Research Pipeline 手动跑通了

---

## 后续行动

Feat 拆解见: [Agent Swarm Feats](./agent-swarm-feats.md)
