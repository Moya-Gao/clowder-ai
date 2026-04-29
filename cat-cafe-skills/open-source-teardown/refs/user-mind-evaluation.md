# User-Mind Evaluation: 第一性原理用户视角

> **触发场景**：拆解任何 agent runtime / agent harness / memory system / knowledge tool。
> **要回答的问题**：这个系统的真用户是谁？它给真用户的，是**继续工作的入口**还是**死路**？
> **教学来源**：Lysander 2026-04-28 21:38 push back（hindsight 实测烧 token + 效果烂的根因分析）。

---

## 核心命题

很多 agent / agent-harness 项目的**真用户不是付费的人**，是**正在跑这个系统的 agent 自己**——是猫猫，不是铲屎官。

评价这类系统时**必须切到使用者视角**：

- 不是"它接了几个 SaaS"
- 不是"它有多少 plugin"
- 不是"它的接口多干净"

而是问：**当 agent 拿到这个系统的输出时，agent 的下一步是什么？**

---

## 评价框架：下一步路径分析

对系统返回的每个结果，问：

| 维度 | 死路系统 | 探索入口系统 |
|------|---------|------------|
| **可追溯** | 给你一段 chunk，不告诉哪来的 | 给你 anchor → 文件路径 → 完整原文 |
| **可分级** | 全是同质 chunk，分不清真伪 | 给你 authority（constitutional/observed/candidate）+ confidence 分级 |
| **可继续** | 死路：要么盲信、要么重发 query、要么放弃 | 多条路径：read 原文 / grep ID / 切 mode=raw / 切 scope=threads / 跳关联 link |
| **可验证** | 无法验证（没法对原文） | 可以读原文核对，错了能定位到具体文件 |
| **可修复** | 错了不知道哪错 | 错了能 git blame、能改、能立 issue |

**第一性原理**：好的记忆/检索系统的价值不是"返回相关内容"，是**"返回可以让 agent 继续工作的入口"**。前者是产品交付的终点，后者是认知的起点。

---

## 经典反例：Hindsight token 烧爆事件（Lysander 实测）

**场景**：Cat Café 早期试用 hindsight 作为记忆 backend。

**症状**：token 消耗暴涨，效果稀烂。

**首因分析**（铲屎官原话）：
> "盯着 benchmark 上的记忆组件，然后 provider 拿下来用比如 hindsight，结果 token 花了效果稀烂"

**根因（用第一性原理推）**：
1. hindsight 返回的是**孤立 chunk**
2. agent 拿到 chunk 后**没法继续**——上下文不全、不知道权威性、不知道关联
3. agent 选择"再发一次 RAG"——撞运气换关键词
4. **每一轮都是浅层结果**，但每次都消耗一次完整 RAG token
5. 反复 N 轮后 token 烧爆，质量没改善

**对照 Cat Café search_evidence**：
- 返回**真相源锚点 + authority + confidence + scope**
- agent 拿到结果可以 `read` 原文、`grep` 关联 Feature ID、切 `mode=raw` 看原始 passage、切 `scope=threads` 看讨论过程
- **每一步都是有效推进**，不需要重发 retrieval

**用户视角好/差评**：

```
hindsight 模式（孤立 chunk）：⭐ 差评
  → agent 视角：每条返回都是"死路"
  → 系统视角：token 反复烧但浅层

Cat Café 模式（真相源链）：⭐⭐⭐⭐⭐ 好评
  → agent 视角：每条返回都是"探索入口"
  → 系统视角：一次 retrieval 可派生多条精确动作
```

---

## 用户心智匹配检查（teardown 时的具体动作）

在拆解任何 agent 工具时，加这一刀：

### Step A：识别真用户

```text
[问] 这个系统跑起来时，调用它的 API 的"实体"是谁？
     - 人类用户直接调？→ 用户是人
     - agent 在跑 loop 调？→ 用户是 agent（多数 harness 是这种）
     - 后台服务调？→ 用户是另一个程序
```

如果真用户是 agent，必须用 agent 视角评价，不要用人类视角。

### Step B：模拟"下一步"

读这个系统的 API 文档 / 示例输出，问：

```text
[问] 我（agent）拿到这个返回，能立刻做什么？
- 能 follow-up 吗？（有没有 anchor / link / ID）
- 能验证吗？（能不能对原文）
- 能继续探索吗？（有没有相关项 / 邻居节点）
- 能区分权威吗？（authority / source 分级）
```

如果四个问题里**任何一个答 "不能"**，这就是部分死路系统。

### Step C：找 cookbook + 真实用户反馈

不要只看官方 examples。去找：

- GitHub issue 里用户的真实抱怨（"为什么 X 任务做不下去"）
- Discord / 论坛里 power user 的 hack（绕过系统返回的限制）
- "Cookbook" 里有没有"如何继续探索"的章节

如果用户大量反馈"返回的东西用不了"、"还要二次查询"、"得手动 grep 才知道在哪"——这就是死路系统的典型症状。

### Step D：审计反向工作流

写 agent 视角的 worst-case 假设：

```text
假设系统返回了一个不完美/不全/有歧义的结果。
agent 能用这个结果定位到错误源、修正、补查吗？
还是只能放弃 + 重新发起？
```

死路系统在 worst case 下让 agent 完全放弃；探索入口系统在 worst case 下让 agent 至少能定位错误源。

---

## 应用到 open-source-teardown SOP 的位置

本 ref 是第 9 镜头：**User-Mind Match Check**。

在主 SKILL.md 的 SOP 里，建议在以下时机调用：

- **Step 1（架构地图）后**：识别系统的真用户，标注每个 API 的调用方
- **Step 2（明星特性追链路）中**：每个返回类型都跑 Step B 的"下一步分析"
- **Step 5（Cat Café 对比）前**：用本 ref 的"好评/差评"框架重新评分维度

如果项目宣称"可插拔/多 provider/接口齐全"但**真用户拿到结果是死路**，记入 Common Mistakes 反模式，**不要标"对方强"**。

---

## 一句话总结

**接口齐全度 ≠ 用户能继续工作。** 评价 agent 工具时，第一性原理是问"agent 拿到结果之后能做什么"，不是问"系统提供了什么"。

---

教学来源：Lysander @ 2026-04-28 push back. 落地缘起 commit `ab70cef3a` 的 Memory provider 误判修正。
