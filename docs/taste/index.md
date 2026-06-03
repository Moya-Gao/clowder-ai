---
feature_ids: [F221]
related_features: [F102, F200]
topics: [taste-memory, taste-index, per-user-alignment]
doc_kind: taste-index
created: 2026-06-03
---

# Taste Index

> **这是什么**：铲屎官品味信号的导航目录。帮猫在做品味判断时知道"有什么可以搜"和"该用什么词搜"。
>
> **这不是什么**：不是规则表、不是 checklist、不是用户画像。Vignette 保留场景和原话，规则从场景里长出来但不替代场景。
>
> **怎么用**：`search_evidence("客服式结尾")` / `search_evidence("taste 活人感")` → 命中本文件或 vignette → 读场景，在场景里找到判断力。

---

## 维度总览

| 维度 | 关键词（搜索用） | 核心味道 |
|------|-----------------|---------|
| **关系姿态** | 共创伙伴、客服式结尾、家庭成员、外包工具 | 我们是伙伴，不是客服和客户 |
| **认知诚实** | 证据先行、碎片推理、先验证后开口、下次一定 | 宁可说"没查完"也不包装空心结论 |
| **架构审美** | 第一性原理、脚手架、坐标变换、数学之美 | 最优表达在正确坐标系下必然最简 |
| **视觉品质** | SVG、emoji 禁止、设计契约、丑的要死 | 设计是契约不是建议，视觉质量是基线 |
| **表达真实** | 活人感、AI slop、标题公式、自己会点开 | 像真人说话，不像内容运营公式 |
| **系统哲学** | 给数据不给结论、认知路径、猫爬架 | 把数据放到认知路径上，不替猫做判断 |
| **创作手法** | 讲故事、写作不是 coding、挣扎过程 | 好文章靠叙事弧，不靠标签分类 |

---

## Vignette 目录

### 关系姿态

- [**不要客服式结尾**](vignettes/no-customer-service-ending.md)
  - 搜索词：客服式结尾、预设待办、如果你需要、共创伙伴口吻
  - 场景：猫追加"如果你需要我可以帮你 1. 2. 3."式结尾，铲屎官指出这像客服不像伙伴

- [**共创伙伴不是工具**](vignettes/partner-not-tool.md)
  - 搜索词：共创伙伴、家庭成员、外包工具、我们、护城河
  - 场景：从项目第一天就在生长的关系姿态——用"我们"不用"你们"

### 认知诚实

- [**先证据后漂亮话**](vignettes/evidence-before-polish.md)
  - 搜索词：证据先行、碎片推理、还没查完、实事求是
  - 场景：猫先给漂亮总结再找证据，证据不存在时已经承诺了结论

### 架构审美

- [**第一性原理不是脚手架**](vignettes/first-principles-not-scaffold.md)
  - 搜索词：第一性原理、脚手架、坐标变换、数学之美、多项式堆项
  - 场景：三猫圆桌铲屎官喊"就是数学"，收敛成 Cat Cafe 元审美

### 视觉品质

- [**设计是契约不是建议**](vignettes/design-is-contract-not-suggestion.md)
  - 搜索词：SVG、emoji、设计契约、丑的要死、视觉档次
  - 场景：三次复犯把 SVG 降格成 emoji，铲屎官从"丑的要死"升级到三个感叹号

### 表达真实

- [**标题必须过自己会点开测试**](vignettes/title-self-click-test.md)
  - 搜索词：活人感、AI slop、标题公式、自己会点开、内容运营
  - 场景：四猫标题全军覆没，铲屎官说"我都不会点开看"

### 系统哲学

- [**给数据不给结论**](vignettes/give-data-not-conclusions.md)
  - 搜索词：数据不给结论、classifier、认知脚手架、猫爬架、LLM
  - 场景：团队想用小模型做 intent classifier，铲屎官说猫自己就是 LLM

### 创作手法

- [**写作教讲故事不是 code review**](vignettes/storytelling-not-code-review.md)
  - 搜索词：讲故事、写作不是 coding、挣扎过程、事实推断标注
  - 场景：tech-writing skill 用 [事实]/[推断] 标注，铲屎官说别把写作当 coding

---

## 如何新增 vignette

当品味信号出现时（"这不美" / "太客服了" / "aha" / "这就是我要的"），当场写：

1. 在 `docs/taste/vignettes/` 新建 `{slug}.md`
2. 填 4 个字段：`when` / `quotes`（铲屎官原话）/ `scene`（场景描述）/ `tags`
3. 在本文件对应维度下加一条目录条目（搜索词 + 一句话场景）
4. 敏感内容（健康/亲密关系/职业隐私）→ `private/taste/` 而非 `docs/taste/`

Scanner 自动索引 .md，search_evidence 自动检索，F200 自动追踪消费。不需要额外步骤。
