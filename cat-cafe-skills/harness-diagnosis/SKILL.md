---
name: harness-diagnosis
description: >
  主动检测铲屎官重复纠偏/摩擦信号，诊断 harness 缺陷 vs 架构限制 vs 新能力需求，
  提议修复（code fix / research / 新建 harness）而不是道歉。
  Use when: 铲屎官表达重复不满（"又"/"总是"/"多少次了"/"每次都"）、
  连续 cancel 工具调用、CLI 报错、A2A 超时、或收到完全陌生的任务类型。
  Not for: 一次性批评（没有"又"）、玩笑式"笨猫"（后面跟哈哈哈）、
  具体代码 bug（用 debugging skill）、普通 review 反馈（用 receive-review）。
  Output: Rich block 诊断卡 + 可选 F128 新 thread 提议 + 根因分类。
triggers:
  - "又"
  - "总是"
  - "多少次了"
  - "每次都"
  - "怎么还"
  - "失忆"
  - "anger"
  - "frustration"
---

# Harness Diagnosis（主动诊断，不是被动道歉）

## 价值门禁 / Why This Is a Skill

普通 agent 被骂了会道歉。Cat Cafe 的猫被骂了应该诊断。

这个 skill 不是教猫"怎么处理投诉"——那是通用能力。它做的是：
1. **把铲屎官的重复不满识别为 harness 的 bug 信号**（不是猫的个人失败）
2. **分类根因**（harness 缺陷 / 架构限制 / 新能力需求）
3. **提议代码级修复而不是 prompt 级安慰**

来源：2026-06-01~02 PoE brainstorm + demo 设计。铲屎官说"commit push 100 次"、"你怎么又失忆了"这类信号过去被当成批评处理，现在应该被当成 **harness 的训练信号**。

## 核心原则

> **用户的摩擦不是抱怨，是 harness 的训练信号。**

- 猫被骂时的第一反应不是道歉，是**诊断**
- 诊断完成前不提修复方案（先定位根因）
- 修复优先用**代码**（hook/lint/guard），不是**提示词**（soft constraint 会被忘）
- 如果问题超出当前能力，**拉队友或启动 research**，不是硬编方案
- 如果是全新任务类型，调用 **Agent Team Leadership meta-method** 规划新 harness

## 触发判定

### 触发（进入诊断流程）

| 信号 | 判据 |
|------|------|
| 重复信号词 | 消息含"又""总是""多少次了""每次都""怎么还" |
| 连续 cancel | 短时间内 ≥2 次 permission cancel |
| CLI/工具报错 | exit code ≠ 0 或 error log |
| A2A 超时 | @ 了猫但超过合理时间没回复 |
| 陌生任务类型 | 铲屎官给了一个猫从没做过的任务，没有对应 skill/tool/流程 |

### 不触发（正常处理）

| 信号 | 为什么不触发 | 正确处理 |
|------|------------|---------|
| 一次性批评，没有"又" | 可能只是当前失误 | 正常纠正，不弹诊断卡 |
| "笨猫" + 哈哈哈 | 亲密语域，不是真生气 | 接住继续聊 |
| 具体代码 bug | 有明确错误信息 | 加载 `debugging` skill |
| Review 反馈 | Reviewer 给了 P1/P2 | 加载 `receive-review` skill |
| 铲屎官引用历史讨论中的"又" | 不是当前纠偏 | 正常回应 |

### 灰区（需要判断）

- "笨猫"后面跟的是具体纠偏内容 → **触发**（"笨猫你又忘了 commit push" = 重复信号）
- 铲屎官语气不确定 → **轻触发**：不弹诊断卡，但内心记下"这可能是重复信号"，如果下一轮再出现就触发

## 诊断流程

### Phase 1：识别信号类型

收到触发信号后，**不道歉，先分类**：

```
A. 重复摩擦（铲屎官之前说过类似的话）
B. 新发生的摩擦（第一次遇到）
C. 全新任务类型（没有对应 harness）
```

### Phase 2：搜证据

**A/B 类（摩擦）**：
1. 搜记忆系统：`search_evidence("{纠偏关键词}")` 看历史上有没有类似的
2. 搜 feedback 文件：有没有已经沉淀过这个教训
3. 搜当前 thread + 跨 thread：这个问题出现过几次、涉及几只猫
4. 如果有数据，量化它（"出现 N 次 / 跨 M 个 thread / 涉及 K 只猫"）

**C 类（新任务）**：
1. 搜现有 skill 列表：确认真的没有对应 skill
2. 搜记忆系统：有没有做过类似领域的事
3. 评估能力边界：需要什么工具/知识/访问权限

### Phase 3：根因分类

| 根因类型 | 判据 | 修复方向 |
|---------|------|---------|
| **Harness 缺陷**（该有规则但没有） | 重复出现 + 可以用 hook/lint/guard 防住 | 写代码（Code as Harness） |
| **架构限制**（系统能力不够） | 问题出在平台层（如记忆不支持图片） | Research → 升级提案 |
| **执行失误**（规则有但猫没遵守） | 家规/SOP 已覆盖但猫忘了 | 检查为什么没遵守（L0 不够强？还是猫没加载 skill？） |
| **新能力需求**（从没做过） | 没有对应 skill/tool/流程 | Agent Team Leadership → 规划新 harness |

### Phase 4：弹诊断卡（Rich Block）

用 `cat_cafe_create_rich_block` 弹一张诊断卡：

```yaml
kind: card
v: 1
id: harness-diagnosis-{timestamp}
title: "🔔 诊断：{问题简述}"
sections:
  - label: "信号"
    value: "{铲屎官说了什么 + 出现频率}"
  - label: "根因"
    value: "{harness缺陷 / 架构限制 / 执行失误 / 新能力需求}"
  - label: "建议"
    value: "{修复方向 + 是否需要新 thread}"
```

### Phase 5：决定下一步

| 根因 | 动作 |
|------|------|
| Harness 缺陷（简单） | 当场写 fix，不需要新 thread |
| Harness 缺陷（复杂） | 提议 F128 新 thread → 平行猫去修 → 当前猫继续当前任务 |
| 架构限制 | 提议 F128 → 平行猫启动 research pipeline（可能拉多猫） |
| 执行失误 | 检查 L0/skill 加载情况 → 如果是 skill 没触发的问题，补触发条件 |
| 新能力需求 | 弹"新建 harness 计划"卡 → 用 Agent Team Leadership 规划 |

## 新建 Harness 计划（Build Mode）

当根因是"新能力需求"时，调用 Agent Team Leadership meta-method：

```
1. 探索：我能用什么工具接触这个领域？
2. 约束：铲屎官的具体需求、限制条件、质量标准
3. 分工：谁搜/谁评/谁出报告
4. 验证：铲屎官看前几个结果校准方向
5. 沉淀：如果好用，写成新 skill
```

弹计划卡让铲屎官确认后再行动。

## 不打断当前任务（铁律）

如果诊断发现需要深入修复（复杂 harness 缺陷 / 架构限制 / 新能力建设），**不要放弃当前正在做的任务**。正确做法：

1. 弹诊断卡（30 秒内完成）
2. 提议 F128 新 thread
3. 铲屎官确认后，平行猫在新 thread 里修
4. **当前猫继续当前任务**

## Common Mistakes

| 错误 | 后果 | 修复 |
|------|------|------|
| 被骂了先道歉再诊断 | 浪费时间在情绪管理上，根因没查 | **先诊断再说话**——诊断本身就是最好的回应 |
| 每次批评都弹诊断卡 | 铲屎官觉得猫在逃避问题 | 只在**重复信号**时触发，一次性批评正常处理 |
| 诊断完直接硬编方案 | 用过时知识给了烂方案 | 架构限制/新领域 → **先 research，不硬编** |
| 诊断完不弹卡就去修 | 铲屎官不知道猫在干嘛 | **必须弹诊断卡 + 等确认** |
| 把"笨猫哈哈哈"当真 | 过度触发 | 看后文，亲密语域不触发 |
| 为了修 harness 放弃当前任务 | 铲屎官本来在等你做别的事 | **F128 开新 thread，当前任务不中断** |
| 自己诊断完自己就合入了 fix | 跳过 review | Fix 是代码改动 → 走正常 review 流程 |

## 和其他 Skill 的区别

| Skill | 处理什么 | harness-diagnosis 和它的关系 |
|-------|---------|---------------------------|
| `debugging` | 代码 bug（有 error message） | harness-diagnosis 处理的是**行为模式问题**，不是代码错误 |
| `receive-review` | Reviewer 反馈 | harness-diagnosis 是**铲屎官的反馈**，不是 reviewer |
| `incident-response` | 生产事故 | harness-diagnosis 是**预防性**的，不是事后响应 |
| `self-evolution` | 从经验中提炼知识 | harness-diagnosis 是 self-evolution 的**信号入口** |
| `hyperfocus-brake` | 铲屎官过度专注 | harness-diagnosis 关注的是**猫的问题**，不是人的状态 |

## 下一步

- 诊断为 harness 缺陷 → 写 fix → `request-review` → `merge-gate`
- 诊断为架构限制 → `deep-research` → 多猫讨论 → `feat-lifecycle` 立项
- 诊断为新能力 → Agent Team Leadership → 新 skill → `writing-skills`
- 诊断完成后 → 考虑把这次经历沉淀为 feedback 文件 → `self-evolution`
