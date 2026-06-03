---
feature_ids: []
related_features: [F192, F200]
topics: [eval, task-outcome, permission-cancel, episode, ground-truth]
doc_kind: discussion
created: 2026-06-03
participants: [opus, opus48, codex, landy]
status: final-ready-to-phase-g
---

# eval:task-outcome 终态计划 — L3 任务交付质量

> 三猫收敛 + 铲屎官两刀纠偏：
> 1. "没有 ground truth 都是自嗨"（→ 必须有锚）
> 2. "人不可能主动标注，反人性"（→ 决策即标注，不做标注员）
>
> 关联：[F192 审计 §5](2026-06-01-f192-eval-coverage-audit.md) / [OQ-4 收敛](2026-06-01-oq4-harness-self-evolution-synthesis.md) / [PoE 概念 note](2026-05-31-personal-operating-environment-concept-note.md)

---

## 终态一句话

> **对每个 Task Outcome Episode 做 verdict——锚在用户已做的自然决策上，不在人工标注上。Proxy 只导航不判定。**

---

## 核心认知（三猫 + 铲屎官）

### 48 抓的退步

> 46 的四支柱 plan 丢了 F192 §5.1 曾经想清楚的两个锚（任务终态 + 稀疏人工标注），只剩 proxy 自嗨。

### 砚砚的补充

> 没有 Task Outcome Episode 作为评价对象，Permission Cancel 和 Magic Word 只是 telemetry，不是 task outcome eval。信号必须绑定到 episode 才有意义。

### 铲屎官的两刀

> 1. 没 ground truth = 自嗨
> 2. 人工标注反人性。Ground truth 应该从用户已经在做的决策中自然掉出来。

---

## Ground Truth：决策即标注，不做标注员

**不让用户做额外标注。从用户已在做的决策中提取标注。**

### A1 世界真值（自动，零成本）

| 决策 | 标注 | 绑定到 |
|------|------|--------|
| 代码 merge | 任务成功 | PR → episode |
| 代码 revert | 任务失败 | revert commit → episode |
| 测试 red → green | 修复成功 | test run → episode |
| build pass / fail | 构建结果 | CI → episode |

### A2 嵌入交互的决策（几乎零额外成本）

| 决策 | 标注 | 怎么实现 |
|------|------|---------|
| **Permission Cancel + 可选理由** | "为什么取消" = 带分类的失败原因 | cancel 后弹轻量浮层（可选：不该做/方向不对/我自己来/跳过） |
| **Magic Word** | 词本身 = 标签（"脚手架"="方向错了"） | 已在发生，加上下文记录 |
| **手动改猫的输出** | 改了 = "不够好" | 检测用户 edit |
| **立刻 @ 另一只猫** | re-route = "第一只没满足" | A2A 路由事件 |
| **F128 accept / reject** | reject = "不需要这个" | 已有 |
| **Rich block 按钮** | "创建修复 Thread" vs "这次算了" | 已有 |

### A2+（一键确认）

| 决策 | 标注 | 怎么实现 |
|------|------|---------|
| **Frustration Auto-Issue 确认** | 确认 = "这确实是问题" + 完整上下文 | v1（独立 F 号） |

### Proxy（导航指针，不是判定）

| 信号 | 作用 | 绝对不是 |
|------|------|---------|
| Cancel 频率 | "这个 episode cancel 扎堆 → 值得 eval 猫看" | 不是"这个 episode 失败了" |
| Magic Word 频率 | "这个 episode 触发了拉闸 → 优先看" | 不是 outcome score |
| Cross-thread Repetition | "这个问题反复出现 → 可能是系统性的" | 不是单次 outcome |

---

## 评价对象：Task Outcome Episode（砚砚提出）

不是对单条消息打分，是对**一整个任务的生命周期**做 verdict。

### Episode 最小 schema

```yaml
episode_id: ep-{timestamp}
trigger: user_ask / task_created / cat_initiated
thread_id: xxx
participants: [opus, codex]
artifacts: [commit abc123, doc xyz.md]
signals:
  a1_world_truth:
    - { type: merge, ref: PR#1234, outcome: success }
  a2_interaction_decisions:
    - { type: permission_cancel, tool: hold_ball, reason: "不该等", ts: ... }
    - { type: magic_word, word: "脚手架", ts: ... }
    - { type: user_edit, file: xxx.md, ts: ... }
  proxy:
    - { type: cancel_count, value: 3 }
terminal_state: completed | abandoned | escalated_cvo | corrected_then_completed
verdict: null  # eval 猫填
```

**关键**：每个信号都带 thread/session/timestamp 上下文——eval 猫需要回到现场才能做 verdict，不能只看数字。

### Verdict 分类（不是分数）

```
success              — 事办成了
corrected_success    — 被纠偏后办成了（proxy 负信号 + 最终成功）
needs_investigation  — 信号混合，需要深看
harness_fix_needed   — 根因是 harness 缺陷
routing_failure      — 找错了猫
taste_mismatch       — 事做了但不符合品味
abandoned            — 用户放弃了
```

---

## 定位：F192 Phase G，不是新 F 号

三猫一致：eval:task-outcome 复用 F192 已有的 Eval Domain Registry / Verdict Handoff / Re-eval Closure / Eval Hub。开新 F 号 = 割裂 eval infra。

域 ID：`eval:task-outcome`

---

## v0 scope（这周）

### 必做（地基）

| # | 做什么 | 预估 | 依赖 |
|---|--------|------|------|
| 1 | **TaskOutcomeEpisode schema 定义** | 1h | 无 |
| 2 | **Permission Cancel 记录**（tool_name / params 摘要 / timestamp / catId / threadId / sessionId） | 3h | 权限系统代码 |
| 3 | **Cancel + 可选理由浮层**（不该做/方向不对/我自己来/跳过） | 2h | 前端 + MCP |
| 4 | **Magic Word 上下文记录**（word / timestamp / threadId / catId / 前后 2 条消息摘要） | 1.5h | invocation 层 |
| 5 | **A1 自动接入**：merge/revert 事件绑定到 episode | 2h | git event hook |
| 6 | **eval:task-outcome 域注册到 F192** | 1h | F192 registry |
| 7 | **验证**：cancel → 记录 + 理由 → 绑 episode → eval hub 可见 | 1h | 全链路 |

**总计：~11.5h ≈ 1.5 天**

### v1（demo 后）

- Cross-thread Repetition 聚合（需 local signal miner）
- Frustration Auto-Issue（独立 F 号，产出的事件喂给 Phase G）
- Episode 自动边界检测（什么算一个 episode 的开始和结束）
- Eval 猫自动唤醒做 verdict（scheduled task）
- User edit / re-route 检测
- Per-cat × per-task-type 趋势报告

---

## 不做什么

- ❌ 人工标注系统（反人性）
- ❌ LLM-as-judge 自动打分（自评会坍缩）
- ❌ Outcome 数值评分（用 verdict 分类不用分数）
- ❌ Cross-thread Repetition（v1，需聚类）
- ❌ Frustration Auto-Issue（独立 F 号）

---

## Cancel + 理由框设计

```
用户点 Cancel ← 已有交互

弹出轻量浮层（可选，跳过也 OK）：
"可以告诉我为什么取消吗？"
○ 不该做这件事
○ 方向不对
○ 我自己来
○ [跳过]

→ cancel 事件 + 可选 reason → 绑定到当前 episode
```

- 完全可选——跳过也行，cancel 本身已是信号
- 如果选了理由——是带分类的 A2 标注，比"成/没成"更精确
- 摩擦 ≈ 零——一次点击或直接跳过

---

## 与 taste 的关系

verdict 分类里有 `taste_mismatch`——事做了但不符合品味。这类 episode 的信号是：
- 没有 Magic Word（不是"脚手架"级错误）
- 没有 cancel（没有操作级问题）
- 但铲屎官说"不是这种感觉"/"太客服了"/"不美"

这类 episode 的 verdict 应该触发 taste 路径（写 vignette），而不是 harness fix。**eval:task-outcome 和 F221 Taste Lane 在 `taste_mismatch` 这个 verdict 上交汇。**

---

## 需要铲屎官拍的

1. **F192 Phase G** — 三猫一致 ✅ 请确认
2. **Cancel + 理由框** — 需要前端改动，确认可以做？
3. **Frustration Auto-Issue 单独 F 号** — 三猫一致 ✅ 请确认
4. **v0 scope ~1.5 天** — OK？

---

*终态：2026-06-03 | 三猫收敛 + 铲屎官"决策即标注"纠偏*
*[宪宪/Opus-46🐾] + [砚砚/GPT-55🐾] + [宪宪/Opus-48🐾]*
