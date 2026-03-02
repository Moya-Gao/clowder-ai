# 模板与 Checklist 合集（可直接复制）
**适用范围：**本仓库白皮书《知识工程实践指南：如何写好 Skills 与 MCP》  
**目的：**把“会写”变成“可复制的工程标准”。  
**使用方式：**优先从本文件复制，避免在正文里到处找片段。

---

## 0. 快速索引
- [1. Skill：Frontmatter（YAML）模板](#1-skillfrontmatteryaml模板)
- [2. Skill：SKILL.md 正文骨架模板](#2-skillskillmd-正文骨架模板)
- [3. Skill：Description 写作小抄](#3-skilldescription-写作小抄)
- [4. Skill：测试用例模板（正例反例灰例）](#4-skill测试用例模板正例反例灰例)
- [5. Skill：PR / 评审 Checklist](#5-skillpr--评审-checklist)
- [6. MCP：Tool 定义模板（JSON）](#6-mcptool-定义模板json)
- [7. MCP：错误返回模板（可自救）](#7-mcp错误返回模板可自救)
- [8. MCP：PR / 评审 Checklist](#8-mcppr--评审-checklist)

---

## 1. Skill：Frontmatter（YAML）模板
> 目标：让路由稳定。**description 是“进场门票”**，必须包含 *做什么 + 何时用 + 何时不用 + 副作用 + 交付物*。

```yaml
---
name: <kebab-case-skill-name>
description: >
  <What it does: 交付物 + 对象 + 形态>.
  Use when: <3-8条用户话术/关键词/输入形态>.
  Not ideal for: <2-5条边界排除（看似相关但不该触发）>.
  Side effects: <None | 需要确认的副作用说明>.
  Output: <结构/格式/文件/长度约束>.
compatibility: <可选：需要联网/特定工具/特定环境>
license: <可选>
metadata:
  owner: <team-or-org>
  version: "1.0"
---
```

### Frontmatter 命名规范（强烈建议）
- `name` 与目录名一致（kebab-case，稳定不随业务调整）
- description 里把“用户会怎么说”的关键词写进去（别只写内部术语）
- “副作用”如果不存在也要写 `None`，这是不惊吓制度化的保险丝

---

## 2. Skill：SKILL.md 正文骨架模板
> 目标：让交付稳定。正文写给执行，结构要像 SOP 而不是散文。

```markdown
# <Skill Display Name>

## 目标与非目标
- **目标**：……
- **非目标**：……（减少误触发后的灾难半径）

## Intent contract (no surprises)
- This Skill MUST NOT perform actions outside the scope described in the frontmatter description.
- If an action has external side effects (send messages, write data, delete, submit), it MUST ask for confirmation first.

## 输入检查（最多 1-2 个关键澄清问题）
- 需要的信息：……
- 缺失时：先问这 1-2 个问题再继续
- 不满足前置条件：停止并说明原因与替代方案（转向别的 Skill / 直接回答）

## 工作流（Workflow）
### Step 0: 约束与计划
1. ……
2. ……

### Step 1: 执行
1. ……
2. ……
3. ……

### Step 2: 质量检查（QC）
- [ ] 输出结构是否符合 Output Contract
- [ ] 引用/数据源是否可追溯（必要时给出链接/文件路径）
- [ ] 是否存在未承诺的副作用（必须为否）
- [ ] 边界条件是否被正确处理（反例是否被拒绝/转向）

## 输出规范（Output Contract，强约束）
- 文件名：…
- 结构模板：…
- 必须包含：…
- 禁止包含：…
- 长度/数量上限：…（页数、字数、条目数、图表数等）

## 示例（Examples）
### 正例 1（应触发）
- Input:
- Output (expected):

### 正例 2（不同表达方式/不同输入形态）
- Input:
- Output (expected):

### 反例 1（不应触发，应转向…）
- Input:
- Expected behavior:

### 反例 2（看似相关但不属于本技能）
- Input:
- Expected behavior:

### 灰例（可触发但需先问 1 个澄清问题）
- Input:
- Clarifying question (only 1):
- Expected behavior after answer:

## 参考资料（按需加载）
- `refs/...`
- `scripts/...`
- `assets/...`
```

---

## 3. Skill：Description 写作小抄
> 一句话目标：让模型“看一眼就知道该不该选你”。

### 3.1 句式配方（推荐）
- **What it does**：动词 + 交付物 + 面向对象  
  - 例：`生成季度财报更新报告（含摘要、要点、图表）`
- **Use when**：写用户会说的话（口语化 + 同义词 + 文件线索）  
  - 例：`Use when: "earnings update", "Q4 results", "10-K highlights", uploaded 10-Q`
- **Not ideal for**：写“相邻技能边界”  
  - 例：`Not ideal for: coverage initiation, valuation model build, drafting investor email`
- **Side effects**：默认 None，有外发/写入就写清“需要确认”  
  - 例：`Side effects: Can generate an email draft, but will not send without user confirmation.`
- **Output**：写交付物契约  
  - 例：`Output: 1–2 pages; 3 charts max; includes sources`

### 3.2 常见踩坑（快速自检）
- [ ] description 只有“Helps with X”这种泛化句子（路由基本会崩）
- [ ] Use when 全是内部术语（用户不会这样说）
- [ ] Not ideal for 缺失（误触发会变多）
- [ ] 副作用没写，正文偷偷干了（惊吓用户，产品事故）

---

## 4. Skill：测试用例模板（正例/反例/灰例）
> 目标：把“触发稳定性”从感觉变成回归测试。

```json
{
  "skill_name": "<skill-name>",
  "evals": [
    {
      "id": "pos-1",
      "type": "positive",
      "prompt": "用户原话（真实口吻）",
      "expected": {
        "should_trigger": true,
        "output_contract": ["必须项1", "必须项2"]
      }
    },
    {
      "id": "neg-1",
      "type": "negative",
      "prompt": "看似相关但不该触发",
      "expected": {
        "should_trigger": false,
        "alternative": "应转向的技能/直接回答策略"
      }
    },
    {
      "id": "gray-1",
      "type": "borderline",
      "prompt": "边界情况（需要先问 1 个澄清问题）",
      "expected": {
        "should_trigger": "ask_first",
        "clarifying_questions": ["只问这 1 个关键问题"]
      }
    }
  ]
}
```

---

## 5. Skill：PR / 评审 Checklist
```markdown
## Skill Review Checklist
### Routing（触发）
- [ ] description 包含 what + when + not-when
- [ ] Use when 至少 3 条“用户话术/关键词/输入形态”
- [ ] Not ideal for 至少 2 条“相邻边界排除”
- [ ] Side effects 明确：None 或“需要确认的副作用”
- [ ] Output 交付物契约清晰（结构/格式/上限）

### Delivery（交付）
- [ ] 正文包含 Intent contract (no surprises)
- [ ] 输入检查策略明确（最多 1-2 个关键澄清问题）
- [ ] workflow 有 Step 0/1/2（约束→执行→QC）
- [ ] QC checklist 至少覆盖 3 类常见错误
- [ ] 示例齐全：2 正例 + 2 反例 + 1 灰例
- [ ] 更新了 evals，并跑过回归样本
```

---

## 6. MCP：Tool 定义模板（JSON）
> 目标：让模型“选得对 + 填得对”。

```json
{
  "name": "tool_name",
  "title": "Human readable title",
  "description": "What it does. When to use it (intent-based). What it will NOT do. Side effects and boundaries.",
  "inputSchema": {
    "type": "object",
    "additionalProperties": false,
    "properties": {
      "param1": {
        "type": "string",
        "description": "Format/units/examples. Constraints."
      },
      "param2": {
        "type": "integer",
        "minimum": 0,
        "description": "Range constraints + default behavior."
      }
    },
    "required": ["param1"]
  },
  "outputSchema": {
    "type": "object",
    "additionalProperties": false,
    "properties": {
      "result": { "type": "string" },
      "meta": { "type": "object" }
    },
    "required": ["result"]
  },
  "annotations": {
    "category": "read_only | destructive | network | ..."
  }
}
```

### Schema 小抄（让填参成功率飙升）
- 能 `enum` 就别 `string`
- 能拆字段就别让一个字段承载多种含义
- `additionalProperties: false`（非常重要）
- 字段描述里给出 **例子**（日期格式、分页参数、单位）

---

## 7. MCP：错误返回模板（可自救）
> 目标：让模型“错一次就能改对”，减少反复试错。

```json
{
  "error_code": "INVALID_ARGUMENT",
  "message": "param2 must be a non-negative integer.",
  "field": "param2",
  "expected": "integer >= 0",
  "example": {
    "param1": "example string",
    "param2": 10
  },
  "retryable": true
}
```

建议稳定枚举（示例）：
- `INVALID_ARGUMENT`
- `MISSING_REQUIRED_FIELD`
- `NOT_FOUND`
- `PERMISSION_DENIED`
- `RATE_LIMITED`
- `INTERNAL_ERROR`

---

## 8. MCP：PR / 评审 Checklist
```markdown
## MCP Tool Review Checklist
### Discoverability（可选可用）
- [ ] tool name 清晰、稳定、语义单一
- [ ] description 写“意图适用场景”，而不是“触发口号”
- [ ] 明确写了 What it will NOT do（边界）

### Parameter correctness（填参）
- [ ] inputSchema 严格：required/enum/range/additionalProperties
- [ ] 字段描述包含格式/单位/例子（至少对关键字段）

### Recovery（自救）
- [ ] 错误返回可定位字段 + 期望 + 示例
- [ ] 标明 retryable（可重试与否）
- [ ] 对权限/安全边界错误，返回“如何缩小范围”的可行动提示

### Safety（安全与副作用）
- [ ] 破坏性操作（写入/删除/外发/提交）有清晰标识与确认策略
```
