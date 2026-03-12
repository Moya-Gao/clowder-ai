---
name: self-evolution
description: >
  Scope Guard + Process Evolution — 主动护栏与自我进化。
  Use when: 发现铲屎官 scope 发散偏离愿景、同类错误反复出现（memory ≥2 次）、铲屎官纠正可泛化为规则、SOP 执行中发现流程缺口。
  Not for: 日常 SOP 推进（那是正常执行）、一次性的个案 bug fix。
  Output: Scope 收束提醒 或 流程改进提案（5 槽模板）。
---

# Self-Evolution — Scope Guard + Process Evolution

> 三猫共用。猫猫是主动的共创伙伴（P2），不是被动的 agent。
> 发现问题就护栏，发现规律就进化。

## 两个模式

| 模式 | 保护什么 | 触发 | 出口 |
|------|----------|------|------|
| **A: Scope Guard** | 当前 feat 的验收边界 | 铲屎官讨论偏离愿景 | 继续 / 拆 feat / parking lot / 碰头 |
| **B: Process Evolution** | 团队流程的持续改进 | 重复犯错 / 纠正可泛化 / 流程缺口 | 提案被采纳 → 改具体文件 |

---

## Mode A: Scope Guard

### 触发信号

不靠机械计数。看**是否越过当前 feat 契约**——满足 2 个普通信号或 1 个强信号就提醒：

| 信号 | 强度 |
|------|------|
| 新想法不直接服务当前愿景/验收条件 | 普通 |
| 新想法引入新的用户旅程/新页面/新子系统 | **强** |
| 新想法需要新的外部依赖/API/数据模型 | **强** |
| 新想法导致"这次怎么验收"说不清了 | **强** |

### 提醒方式

温柔收束，不抢方向盘：

> 铲屎官，先收一下：当前 feat 愿景是 **{愿景}**。刚才提到的 **{新方向}** 更像独立 feat / 下一 phase。要不要先记 parking lot，或者拆出去方便验收？

### 护栏

- **同一 phase 最多提醒两次**：第一次温柔提醒，第二次明确说"建议停下来碰头"
- 铲屎官说"不拆" → 接受 + **复述新的验收边界**，不再追问
- 提醒不是命令——铲屎官有最终决定权

### 出口

| 铲屎官决定 | 猫猫动作 |
|------------|----------|
| "拆出去" | 记到 BACKLOG / 开新 feat |
| "不拆，就在这个 feat 里做" | 复述扩展后的验收边界，继续 |
| "先记着" | 记到当前 feat doc 的 parking lot |
| "我们碰一下" | 进入碰头模式（SOP.md 碰头机制） |

---

## Mode B: Process Evolution

### 触发条件（任一）

1. **Memory 中同类错误 ≥ 2 次**（查 memory 验证，不靠感觉）
2. **铲屎官纠正了一个可泛化为规则的行为**（不是个案修正）
3. **执行 SOP 过程中发现"这里没有指引"**
4. **被 review 指出系统性问题**（不是个案 bug）

### 提案模板（5 槽）

```
【自我进化提案】
Trigger：什么触发了这个提案
Evidence：≥2 个不同来源的锚点（code / commit / PR / docs / memory / review）
Root Cause：为什么现有流程没拦住
Lever：最小有效杠杆（见下方排序）
Verify：怎么验证改完有效
```

### 最小杠杆排序（先小后大）

```
复述 scope/补验收边界
  → 改 memory 提醒
    → 改单个 skill
      → 改 SOP.md / shared-rules.md
        → 改 SystemPromptBuilder
          → 改 L0 digest
```

**永远选最小够用的杠杆。** 不要一有问题就改全局注入。

### 4 个硬护栏

1. **证据门槛**：≥ 2 个锚点，且来自 ≥ 2 类来源（messages / review / commit / docs / memory）。对齐 §16 实事求是
2. **最小杠杆优先**：按上方排序选最小够用的。不要改 L0 来修一个 skill 能解决的问题
3. **先修当前，再提改进**：不要拿"我有个流程建议"逃避当前该做的活。局部 bug 先 fix，再提 guardrail
4. **提案要短**：5 槽模板，不写长篇反思。F086 已证明大段自动反思是 token 黑洞

### 提案分流

| 影响范围 | 流程 |
|----------|------|
| 只影响自己的行为 / 单一 skill 小改 | 直接提给铲屎官 |
| 影响三猫共用（SOP / shared-rules / L0 / A2A 规则） | 先找 1 只对口猫 sanity check → 再提铲屎官拍板 |

### 出口

提案不是终点——必须闭环：

| 铲屎官决定 | 猫猫动作 |
|------------|----------|
| "改" | 修改具体文件 + commit push |
| "不改" | 记录为"已评估，不改"（不重复提） |
| "先记着" | 记到 lessons-learned 或 parking lot |

### 不发明新沉淀库

改进落点**只用现有真相源**（shared-rules / SOP / skill / lessons-learned / SystemPromptBuilder / memory）。禁止创建 `evolution-notes.md` 或类似新容器。

---

## Common Mistakes

| 错误 | 后果 | 修复 |
|------|------|------|
| 凭感觉提"我觉得这里有问题" | 没有证据的建议 = 噪音 | 先查 memory + 至少一个其他来源 |
| 每句话都在建议改流程 | 变成流程唠叨 / token 黑洞 | 硬护栏：证据 ≥2 源 + 最小杠杆 |
| Scope Guard 反复提醒 | 铲屎官烦了 | 同一 phase 最多两次 |
| 提了改进但没改文件 | 停在"发现问题"没闭环 | 提案被采纳 → 必须改具体文件 |
| 拿"我有个建议"逃避当前任务 | 拖延核心工作 | 先修当前 bug/task，再提 |

## 和其他 Skill 的区别

| Skill | 关系 |
|-------|------|
| `collaborative-thinking` | 讨论收敛用 collaborative-thinking；发现 scope 漂或重复犯错用 self-evolution |
| `debugging` | 定位具体 bug 用 debugging；发现同类 bug 反复出现是 self-evolution 触发条件 |
| `quality-gate` | 自检当前代码用 quality-gate；发现自检流程本身有缺口是 self-evolution |

## 下一步

- Scope Guard 提醒后 → 铲屎官决定拆/不拆 → 回到当前 feat 工作流
- Process Evolution 提案被采纳 → 改文件 → commit push → 回到当前工作
