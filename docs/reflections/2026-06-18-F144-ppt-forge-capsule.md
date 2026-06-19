---
capsule_id: "F144-Close-2026-06-18"
context: "PPT Forge ppt-forge skill 终态关门：从复杂代码管线 pivot 到低保真 MD → imagegen 精美图"
feature_ids: [F144]
doc_kind: capsule
created: 2026-06-18
---

## What Worked

- **实战驱动 pivot**：KD-20 的终态方向来自铲屎官真实工作需求（试用期工作总结 PPT），不是实验室测试。铲屎官用完就知道"这个路径对"
- **每轮探索的认知不浪费**：Phase A-D 四条代码路径积累的认知（分页规划 / 内容类型 / 密度原则 / 风格 token），全部沉淀进了 skill ref 文档，脚手架拆了知识留了
- **竞品深度分析有价值**：pptx-craft 源码深读帮我们理解了"AI 做布局而非算法算坐标"的核心思路，Phase D 借了这个思路
- **三猫协作分工明确**：砚砚做技术 pushback（防止错误路线走太远）+ opus-47 做方向审查 + 铲屎官做实战验证，三层合力
- **愿景守护证物对照**（feat-lifecycle completion 流程）：

| 铲屎官原话（逐字引用） | 当前实际状态 | 匹配？ |
|---------------------|------------|--------|
| "来吧我们也来搞一个业界 sota 的 ppt skills！" | `ppt-forge` SKILL.md + `ppt-lofi-authoring.md` + `ppt-style-huawei.md` 三文件构成标准化 skill | ✅ |
| "我就说我也有个 ppt 生成的能力，现场对比啊" | 华为风格 9 页 PPT（试用期工作总结）成功产出，imagegen 视觉质量碾压 pptx-craft | ✅ |
| "华为/IBM/xxx/yyy 风格的 ppt" | 华为 preset 完整（PANTONE 185C + 8 种页面模式）；其他风格按需新建 ref | ✅ |

## What Failed

- **先验偏见锁定了方向**：立项时默认"代码生成可编辑 .pptx"是终态，没有第一时间考虑"AI 画图"路径。如果 Phase A 时就测 imagegen 对比，可以节省 2 个月工程量
- **feat close 流程不完整**：opus-46 只做了 BACKLOG 标记 done + 愿景守护文字判断，遗漏了反思胶囊 / CloseGateReport / BACKLOG 移除 / features/README 更新。铲屎官需要 🤣 提醒
- **愿景守护证物对照表**：我（sonnet）做愿景守护时给了文字判断，但没有产出标准格式的对照表（本文档补完）

## Trigger Missed

- **feat close 应该主动加载 feat-lifecycle skill**：不凭记忆操作 completion 流程——这是典型的"布偶猫家族病"（我能猜出来）
- **imagegen 对比实验应更早触发**：Phase B 甚至 Phase A 时就可以测"AI 画图 vs 代码渲染"，但当时没有这个元问题意识

## Doc Links

- `docs/features/F144-ppt-forge.md` — 完整 feat doc（含 20 个 KD 和 4 Phase 历史）
- `cat-cafe-skills/ppt-forge/SKILL.md` — 终态 skill 入口
- `cat-cafe-skills/refs/ppt-lofi-authoring.md` — 低保真写作规范（最小可抄模板）
- `cat-cafe-skills/refs/ppt-style-huawei.md` — 华为风格 preset（PANTONE 185C + 8 种页面模式）
- `docs/research/2026-05-29-probation-summary/probation-summary-lofi.md` — 成功案例（试用期工作总结 9 页）
- `docs/harness-feedback/2026-06-18-F144-ppt-forge.md` — Harness Eval

## Rule Update Target

- `feat-lifecycle` Completion 步骤：BACKLOG done 后的"移除行"逻辑需要更强的视觉提示（第 4 步"移除"不够醒目，容易被误读为"标 done"）
- `memory/MEMORY.md`：feat close 必须加载 `feat-lifecycle` skill，不凭记忆，跟修 bug 一样
