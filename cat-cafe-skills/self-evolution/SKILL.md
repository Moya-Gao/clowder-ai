---
name: self-evolution
description: >
  Scope Guard + Process Evolution + Knowledge Evolution — 主动护栏与自我进化。
  Use when: 铲屎官 scope 发散偏离愿景、同类错误反复出现、SOP 流程缺口、有价值的知识/方法论值得沉淀。
  Not for: 日常 SOP 推进（正常执行）、一次性个案 bug fix。
  Output: Scope 收束提醒 / 流程改进提案 / 知识沉淀提案。
---

# Self-Evolution — Scope Guard + Process Evolution + Knowledge Evolution

> 三猫共用。猫猫是主动的共创伙伴（P2），不是被动的 agent。
> 发现问题就护栏，发现规律就改进，发现知识就沉淀。

## 三个模式

| 模式 | 方向 | 保护/推动什么 | 触发 |
|------|------|---------------|------|
| **A: Scope Guard** | 防御 | 当前 feat 验收边界 | 铲屎官讨论偏离愿景 |
| **B: Process Evolution** | 防御→改进 | 团队流程持续改进 | 重复犯错 / 流程缺口 |
| **C: Knowledge Evolution** | 进攻→成长 | 团队能力边界扩展 | 有价值的知识/方法论产生 |

---

## Mode A: Scope Guard

### 触发信号

不靠机械计数。看**是否越过当前 feat 契约**——满足 2 个普通信号或 1 个强信号：

| 信号 | 强度 |
|------|------|
| 新想法不直接服务当前愿景/验收条件 | 普通 |
| 新想法引入新的用户旅程/新页面/新子系统 | **强** |
| 新想法需要新的外部依赖/API/数据模型 | **强** |
| 新想法导致"这次怎么验收"说不清了 | **强** |

### 行为

> 铲屎官，先收一下：当前 feat 愿景是 **{愿景}**。刚才提到的 **{新方向}** 更像独立 feat / 下一 phase。要不要拆出去方便验收？

- 同一 phase **最多两次**：第一次温柔，第二次明确说"建议碰头"
- 铲屎官说"不拆" → 复述新验收边界，不再追问
- 出口：继续 / 拆 feat / parking lot / 碰头

---

## Mode B: Process Evolution

### 触发（任一）

1. Memory 中同类错误 **≥ 2 次**
2. 铲屎官纠正了**可泛化为规则**的行为
3. SOP 执行中发现**没有指引**
4. Review 指出**系统性问题**（非个案 bug）

### 提案模板（5 槽）

```
【流程进化提案】
Trigger：什么触发了这个提案
Evidence：≥2 个不同来源的锚点（code / commit / PR / docs / memory / review）
Root Cause：为什么现有流程没拦住
Lever：最小有效杠杆
Verify：怎么验证改完有效
```

### 最小杠杆排序

复述scope → 改memory → 改单skill → 改SOP/shared-rules → 改SystemPromptBuilder → 改L0

### 硬护栏

1. **证据 ≥2 源**（对齐 §16 实事求是）
2. **最小杠杆优先**
3. **先修当前，再提改进**——不拿建议逃避当前任务
4. **提案要短**——5 槽，不写长篇反思（F086 教训）

### 分流

- 只影响自己 / 单 skill → 直接提铲屎官
- 影响三猫共用 → 先找 1 只猫 sanity check → 铲屎官拍板

---

## Mode C: Knowledge Evolution

> **不只从错误中学习，也从有价值的经验中成长。**

### 触发（任一）

1. **Deep research** 产出了跨场景可复用的知识或框架
2. **专业领域讨论**（医疗/法律/投资/技术调研等）形成了可迁移的分析方法论
3. **跨域协作**中发现了可复用的协作模式或思维框架
4. **铲屎官说"这个值得记住"** 或猫猫自主判断有高复用价值

### 判断标准：值得沉淀吗？

问三个问题：
- **复用性**：未来类似场景还会用到吗？
- **非显然性**：这个知识/方法不容易从头推导出来吗？
- **衰减性**：不记下来，下次还能想起来吗？

三个中满足 ≥ 2 个 → 值得沉淀。

### 沉淀形式（按知识类型选）

| 类型 | 沉淀到哪 | 例子 |
|------|----------|------|
| 轻量知识点 | memory file | "飞书 webhook 用 verification token 不是 encrypt key" |
| 领域分析方法论 | memory file（详细版） | "如何读医学检测报告：看参考范围→看趋势→交叉验证" |
| 可复用工作流 | 新 skill（走 writing-skills） | 成熟到可以教其他猫的方法论 |
| 调研报告 | docs/research/ 存档 | deep research 完整产出 |

### 提案模板（4 槽）

```
【知识沉淀提案】
Discovery：发现/产出了什么
Value：为什么有复用价值（复用性 + 非显然性 + 衰减性）
Form：建议沉淀形式（memory / skill / docs）
Summary：核心内容摘要（≤ 5 行）
```

### 护栏

- **不是每次对话都沉淀**——只沉淀过了三问判断的知识
- **沉淀不是目的，可调用才是**——写了 memory 没人读 = 没写
- **已有的不重复写**——先搜再写，避免知识碎片化

---

## 共用规则

- **不发明新沉淀库**：路由到现有真相源。禁止创建 `evolution-notes.md` 等新容器
- **出口闭环**："改/沉淀"→改文件+commit push | "不改"→记录已评估不重复提 | "先记着"→parking lot
- **Common Mistakes**：凭感觉提建议（要有证据）/ 过度进化每句话都建议（硬护栏）/ 只从错误学不从成功学（Mode C）

## 和其他 Skill 的区别

- `collaborative-thinking`：讨论收敛用它；scope 漂/犯错/知识沉淀 → self-evolution
- `deep-research`：调研过程用它；调研产出有复用价值 → Mode C
- `debugging`：定位 bug 用它；同类 bug 反复 → Mode B

## 下一步

三个模式出口都一样：闭环后回到当前工作。
