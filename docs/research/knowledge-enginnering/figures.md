# 图表说明书与提示词（Figure Pack）
**适用范围：**白皮书《知识工程实践指南：如何写好 Skills 与 MCP》  
**目的：**让可视化“信息完整、风格统一、可复制、可导出”。

---

## 0. 先看烁烁当前版本：总体评价与最重要的修改点
你这三张图的**结构与信息逻辑是对的**，完全满足白皮书的三项需求（分层架构、路由漏斗、评测矩阵）。  
但有一个会影响“对外交付”的大问题：

### 0.1 中文字体缺失（导致方块字）
当前 SVG 用的是 `Inter`，它不包含中文 glyph。  
如果在某些环境渲染（尤其转 PNG/PDF、或服务器端渲染），中文会变成“方块字”。

**建议任选其一：**
1) **最稳方案（强烈推荐）：导出前把文字转曲线/轮廓（outline text）**  
   - Figma：选中文字 → Outline stroke（或使用插件/导出设置）  
   - Illustrator：Create Outlines  
   这样 SVG/PDF 不依赖系统字体，跨平台不会炸。
2) **可接受方案：给 font-family 加 CJK fallback**  
   - 例如：`Inter, "Noto Sans SC", "Source Han Sans SC", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif`  
   但这仍依赖导出机器是否装了这些字体。

### 0.2 Emoji 图标兼容性
图里用了 🔑 / 🛡️ 等 emoji。不同平台 emoji 字体不同，有时会缺字或变形。  
**对外交付建议：**用简单矢量 icon（钥匙/盾牌）替代 emoji，或导出时转曲线。

---

## 1. Figure 1：分层架构图（MCP / Skills / Agent 三层）

### 1.1 图注（放在白皮书正文里）
**Figure 1. 三层架构：Agent 负责路由与编排，Skills 提供专业 workflow 与交付标准，MCP 提供可发现、可描述、可安全接入的能力（tools/resources/prompts）。**  
路由阶段模型常驻可见的是 Skill 的 `name + description`；正文（SKILL.md）仅在技能被选中后加载。

### 1.2 图中关键文字（可直接贴进图里）
> 建议做双语：中文为主，英文小字辅助（或反之）。以下提供一套“可直接粘贴”的文案。

**标题：**
- `三层架构：MCP 能力层 × Skills 经验层 × Agent 编排层`  
  小字：`Capability / Experience / Orchestration`

**Agent 编排层（顶部框）**
- `Router（路由）`  
  小字：`reads skill catalog: name + description`
- `Planner（计划）`
- `Executor（执行）`
- `Evaluator（评估/QC）`

**箭头（Agent → Skills）**
- `Select skill → Load SKILL.md body → Execute workflow`  
  小字：`No selection = no body loaded`

**Skills 经验层（中间框）**
- `SKILL.md（核心执行逻辑）`  
  - `workflow（分步）`
  - `output contract（交付契约）`
  - `QC checklist（自检）`
  - `no-surprises（不惊吓）`
- `refs/ scripts/ assets/（按需加载）`  
  小字：`only when referenced`

**箭头（Skills → MCP）**
- `Call tools / Read resources`  
  小字：`schema-bound calls`

**MCP 能力层（底部框）**
- `Tools（工具）`  
  小字：`Actions constrained by JSON Schema`
- `Resources（资源）`  
  小字：`Read-only data via URI`
- `Prompts（模板）`  
  小字：`Reusable prompt scaffolds`

**可选角标（右下角小注）**
- `Skills ≠ 原子操作；Skills = 专业经验 + 工作流 + 质检标准`

### 1.3 给烁烁的“修订提示词”（用于改现有图）
- 保持三层堆叠与箭头关系不变  
- 修复中文字体（转曲线或加 CJK fallback）  
- 把 emoji 图标替换为矢量 icon（钥匙/盾牌）  
- 在 Router 附近加一行小字：`metadata always-on (name + description)`  
- 可选：把“能力供给 (Supply)”虚线箭头改成更直观的注释，例如：  
  `MCP exposes capability surface`（放在 MCP 框内角落即可），避免双向箭头造成歧义。

### 1.4（可选）AI 生成矢量图提示词（如果要重画一版）
> 适用于任何矢量/图表生成工具，输出 SVG。

**Prompt：**  
“Create a clean minimalist vector diagram (SVG) on warm off-white background. Show a 3-layer architecture stack: top ‘Agent (Orchestration)’ with four rounded boxes Router, Planner, Executor, Evaluator; Router has subtitle ‘reads skill catalog: name + description’. Middle layer ‘Skills (Experience)’ contains a large box ‘SKILL.md’ listing workflow, output contract, QC checklist, no-surprises; and a dashed box ‘refs/scripts/assets (on-demand)’. Bottom layer ‘MCP (Capability)’ contains three boxes Tools, Resources, Prompts with short subtitles. Add arrows: Agent→Skills labeled ‘Select skill → Load body → Execute workflow’; Skills→MCP labeled ‘Call tools / Read resources’. Use consistent typography, bilingual labels (Chinese primary, English small). No photos, flat style, soft pastel accents. Ensure CJK font or outline text.”

---

## 2. Figure 2：路由漏斗（description → 加载 → 执行）

### 2.1 图注（放在白皮书正文里）
**Figure 2. 路由漏斗：模型先基于 Skill 的 name+description 做语义匹配，仅当技能被选中时才加载 SKILL.md 正文并执行 workflow；若未选中则走兜底策略。**  
QC 失败应回流到执行步骤进行修复，形成闭环。

### 2.2 图中关键文字（可直接贴进图里）

**标题：**
- `路由漏斗：description 决定正文能否进场`  
  小字：`progressive disclosure: metadata → body → execution`

**Step 1**
- `1. User Message（用户请求）`

**Step 2**
- `2. Skill Catalog Metadata（常驻元信息）`  
  小字：`only name + description`

**Step 3（菱形）**
- `3. Semantic Match?（语义匹配）`

**No 分支**
- 红字：`No selection = No body loaded`  
- 盒子：`Fallbacks（兜底）`  
  小字建议三选一或都放：  
  - `Direct answer`  
  - `Ask 1 clarifying question`  
  - `Try other skill / tool`

**Yes 分支**
- `YES`

**Step 4**
- `4. Load Selected SKILL.md（加载正文）`  
  小字：`workflow + rules + output contract + QC`

**Step 5**
- `5. Execute Workflow（执行工作流）`  
  小字：`call tools / read resources / run scripts`

**Step 6**
- `6. Produce Output & QC（交付与自检）`  
  小字：`QC fails → fix → QC again`

**回环箭头**
- 红字：`QC fails → Fix!`

### 2.3 给烁烁的“修订提示词”
- 修复中文字体（转曲线或 CJK fallback）  
- “Fallbacks / Others”建议改成 `Fallbacks (Direct answer / Ask / Other skill)`，更具体  
- Step 4 小字补全：加入 `output contract + QC`  
- 标题如果太长，可拆两行：  
  第一行 `路由漏斗`，第二行 `description 决定正文能否进场`

### 2.4（可选）AI 生成提示词
“Create a vertical flowchart (SVG) showing the routing funnel for agent skills: Step 1 User Message → Step 2 Skill Catalog Metadata (only name + description, always-on) → Step 3 Semantic Match? diamond. No branch: callout ‘No selection = No body loaded’ to a pink fallback box listing Direct answer / Ask 1 clarifying question / Other skill. Yes branch: Step 4 Load Selected SKILL.md (workflow + output contract + QC) → Step 5 Execute Workflow (call tools / run scripts) → Step 6 Produce Output & QC. Add a red loop arrow from Step 6 back to Step 5 labeled ‘QC fails → Fix!’. Clean flat design, rounded rectangles, pastel accents, bilingual labels (Chinese primary). Outline text or use CJK font.”

---

## 3. Figure 3：评测矩阵（触发指标 × 交付指标）

### 3.1 图注（放在白皮书正文里）
**Figure 3. 评测矩阵：以“触发质量（Routing）”与“交付质量（Delivery）”为两轴，区分 Under-trigger、Over-trigger、Needs Redesign 与 Ready to Ship 四类状态，并给出对应的优化方向。**

### 3.2 图中关键文字（可直接贴进图里）

**标题：**
- `评测矩阵：触发质量 × 交付质量`  
  小字：`Routing × Delivery`

**X 轴（触发质量 Routing）**
- `Routing / 触发质量`  
  小字（轴下方或右上角 legend）：  
  - `Precision（少误触发）`  
  - `Recall（少漏触发）`  
  - `Borderline stability（灰区稳定）`

**Y 轴（交付质量 Delivery）**
- `Delivery / 交付质量`  
  小字（轴上方或左上角 legend）：  
  - `Output contract compliance（契约合规）`  
  - `Tool-call efficiency（工具效率）`  
  - `Recovery（失败可自救）`  
  - `No-surprise（无意外副作用）`

**四象限（建议每格 2 行“诊断 + 处方”）**

- 左上：`Under-trigger（该用不用）`  
  - `Description 太弱 / 触发词不足`  
  - `补 Use when + 同义词 + 边界样本`

- 右下：`Over-trigger（不该用乱用）`  
  - `Description 太宽 / 边界不清`  
  - `加 Not ideal for + 收紧范围 + 强化 QC`

- 左下：`Needs Redesign（需要重构）`  
  - `触发与交付都不稳`  
  - `重定义范围 / 拆分技能 / 重做契约与测试`

- 右上：`✅ Ready to Ship（可发布）`  
  - `精准触发 + 稳定交付`  
  - `覆盖正例/反例/灰例评测，且无副作用惊吓`

### 3.3 给烁烁的“修订提示词”
- 修复中文字体（转曲线或 CJK fallback）  
- 在轴旁边加一个很小的 legend（上面列的 Precision/Recall 等），读者会更快理解“触发质量”是什么  
- 四象限里保持“诊断 + 处方”两行，别写太长，避免拥挤  
- 如果空间允许，右上角加一个小角标：`Evals covered ✅`（强调可回归）

### 3.4（可选）AI 生成提示词
“Create a 2x2 evaluation matrix (SVG) with x-axis Routing quality and y-axis Delivery quality. Label low/high on both axes. Quadrants: top-left Under-trigger (description too weak; add keywords/examples), top-right Ready to Ship (stable routing and delivery; output contract met; no surprise), bottom-left Needs Redesign (redefine scope/split skill), bottom-right Over-trigger (description too broad; add Not ideal for; tighten QC). Add a small legend listing routing metrics (precision, recall, borderline stability) and delivery metrics (output contract compliance, tool efficiency, recovery, no-surprise). Clean flat style, pastel quadrant backgrounds, bilingual labels (Chinese primary). Outline text or use CJK font.”

---

## 4. 导出规范（对外交付推荐）
- **首选：SVG + PDF**（矢量可缩放）  
- 如果要放进 PPT/Keynote：导出一份 **PNG 2x 或 3x** 备用  
- 对外发布前做一次“无本机字体”的渲染测试（避免方块字）  
- 文本尽量转曲线，或明确使用 Noto / Source Han 等 CJK 字体

