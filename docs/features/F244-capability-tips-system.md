---
feature_ids: [F244]
related_features: [F114, F155, F192, F203, F220, F223, F227, F229, F243]
topics: [knowledge-feed, capability-tips, waiting-state, onboarding, capability-discovery, magic-words]
doc_kind: spec
created: 2026-06-18
---

# F244: Capability Tips System — 等待态 Knowledge Feed 投影

> **Status**: spec | **Owner**: 缅因猫/砚砚 | **Priority**: P1

## Architecture Ownership

Architecture cell: hub-action-surface + harness-eval
Map delta: update required
Why: Tips render inside first-party Hub waiting/status surfaces and need adoption/effectiveness tracking; F223 owns capability source registry, F192 owns eval, F244 owns the user-facing waiting-state projection.

## Why

铲屎官 2026-06-18 收敛：

> "我们想要的不止是猫言语"

> "比如有什么 magic words 什么时候可以用 / 家里有什么功能 / 开发新 feature 的时候必须补 1-2 条 tips"

> "猫言语只是最后一层皮，真正的价值是把'家里怎么运转'变成用户在自然等待中持续学会的东西"

> "直接立项吧，反正第一个用户就是我啊！"

等待态不是单纯的 dead time。用户盯着猫猫思考、执行、等待外部条件时，注意力被自然锁住；这几秒最适合把 Cat Cafe 的能力、家规、magic words、工作流边界和新 feature 用法轻量投影出来。目标不是把 loading 文案变可爱，而是把 W7 Knowledge Feed 和 F223 capability registry 变成用户能自然吸收的产品表面。

## Current State / 现状基线

- 现有等待/执行 UI 已有真实状态层：`packages/web/src/components/ThinkingIndicator.tsx` 显示 `启动中` / `思考中` / `回复中` / `静默等待中` / `可能卡住了`，`packages/web/src/components/ThreadExecutionBar.tsx` 显示 `执行中`、计时、停止与 `卡住了？强制重置`。
- 现有能力真相源已分散存在：F223 产出 Capability Surface Registry，`cat-cafe-skills/refs/capability-wakeup-index.md` 维护 L0 §8 能力速查，F114/L0/shared-rules 维护 magic words，F155 guide engine 有场景 tips，F227 Event Memory 索引 magic word 事件。
- 当前没有一个用户可见的等待态 tips 投影层。用户要知道"家里有什么能力 / 什么时候用 / 怎么用"，仍主要靠聊天中被动问、读文档、或猫主动解释。
- 当前风险是把真实状态、tips、猫格文案混在一起：如果 UI 写"正在读取工作区"但没有 runtime signal，就是假精确状态；如果卡死入口被可爱文案盖住，会反噬信任。

## CVO Constraints（2026-06-18）

铲屎官补充的三层落地要求是本 feature 的边界，不是实现建议：

| 层 | 硬要求 |
|----|--------|
| Soft | feature PR 模板要求新增 1-2 条 tips；纯内部重构等无用户可感知变化必须写明豁免理由 |
| Hard | 新增 feature manifest / guide / skill 时，CI 检查有没有对应 tips 或明确豁免 |
| Eval | 记录 tips 曝光、点击、被用户追问的频率，反推哪些能力还没被讲清楚 |

单一真相源约束：F244 只做投影和治理，不复制能力定义。Magic words 的含义仍来自 L0/shared-rules/F114；能力 surface 仍来自 F223/capability-wakeup-index；guide steps 仍来自 F155 guide registry；每条 tip 必须有 `sourceRef`，实现不能维护一份平行的"能力大全"。

## 需求点 Checklist

| ID | 需求点（铲屎官原话/转述） | AC 编号 | 验证方式 | 状态 |
|----|---------------------------|---------|----------|------|
| R1 | "不止是猫言语"：猫格只是表达层，核心是展示家里怎么运转 | AC-A1 / AC-B1 | schema + UI 截图 | [ ] |
| R2 | "有什么 magic words 什么时候可以用" | AC-A2 / AC-B3 | seed tips + sourceRef 校验 | [ ] |
| R3 | "家里有什么功能，如何用" | AC-A3 / AC-B3 | seed tips + action link 演示 | [ ] |
| R4 | "开发新 feature 的时候必须补 1-2 条 tips" | AC-C1 / AC-C2 | CI red/green fixture | [ ] |
| R5 | "第一个用户就是我"：优先 dogfood 给铲屎官等待态使用 | AC-B4 / AC-D3 | alpha 录屏 + dogfood report | [ ] |
| R6 | tips 不得冒充真实进度或覆盖故障/强制重置入口 | AC-B2 | component tests + 截图 | [ ] |
| R7 | tips 必须从现有真相源投影，不新造第四套能力清单 | AC-A1 / AC-A4 | sourceRef 校验 + grep | [ ] |

### 覆盖检查

- [x] 每个需求点都能映射到至少一个 AC
- [x] 每个 AC 都有验证方式
- [ ] 前端需求已准备需求→证据映射表（Phase B 交付时补截图/录屏）

## What

### Phase A: Tip Contract + Source Projection

建立 tips 的数据契约和种子投影。F244 不拥有能力清单本体，只拥有"把已有真相源投影成等待态 tip"的格式和选择逻辑。

`CapabilityTip` 最小字段：

| 字段 | 说明 |
|------|------|
| `id` | 稳定 ID，例如 `magic-word-scaffold` / `capability-browser-preview` |
| `kind` | `capability` / `magic_word` / `workflow` / `feature` / `status_help` |
| `sourceRef` | 真相源锚点：feature doc、shared-rules、skill、guide registry、ADR |
| `contexts` | 可展示上下文：`thinking` / `waiting_external` / `review` / `feature_dev` / `merge_gate` / `long_running` |
| `audience` | `cvo` / `developer` / `maintainer` / `all` |
| `body` | 短文本，不能包含假进度承诺 |
| `action` | 可选，打开 guide/source/capability surface 的 typed action |
| `owner` | 维护 owner，用于 stale/sunset |

首批来源：

- F223 + `capability-wakeup-index.md`：Tier 1/Tier 2 能力和 typed surface。
- F114/L0/shared-rules：magic words 的含义与立即动作。
- F155 guides：可交互引导的入口，不把 guide steps 复制成孤岛。
- F192/F203/ADR-031：harness 三层、eval、运行模式、SOP 边界。
- Feature specs：后续每个 user-visible feature 贡献自己的 1-2 条 tips。

### Phase B: Waiting-State Projection UI

在等待/执行 UI 中增加 tips 投影，但与真实状态分层：

- 真实状态仍由 liveness/runtime signal 驱动，继续放在主行。
- Tip 是次级行/可折叠区域，必须视觉上低于状态、取消、强制重置入口。
- `suspected_stall` / `alive_but_silent` 时，故障与取消入口优先；tips 不得遮挡或弱化 `卡住了？强制重置`。
- 首次展示延迟触发，轮播节奏慢，避免每几秒闪动制造噪音。
- 上下文选择优先级：当前执行阶段 > thread workflow > feature dev/review mode > 通用 capability/magic word。
- 支持 action：点开 source、guide、capability surface 或相关 docs；没有 action 的 tip 不能冒充可执行能力。

### Phase C: Feature Tips Contribution Gate

把 tips 变成 feature lifecycle 的一部分，但做质量门，不做机械数量门：

- 新增或修改 user-visible feature / capability / guide / harness 行为时，必须贡献 1-2 条 tips，或写明确 `tips_exempt` 理由。
- 纯内部重构、typo、无用户可感知变化可豁免。
- CI 检查 tip 至少包含 `sourceRef`、`contexts`、`audience`、`owner`，并禁止无源泛泛文案。
- PR/feature 模板增加 `Tips Contribution` 小节，和 requirements checklist 一起在 kickoff/quality-gate 阶段复核。
- 新 tip 不得新造能力定义；必须引用 F223/F155/F114/F192/feature doc 等真相源。

### Phase D: Eval + Staleness Loop

tips system 是 harness 改动，必须有闭环：

- 记录 privacy-minimal usage：展示次数、action 点击、dismiss、source 打开失败。
- F192 侧跟踪：tip 是否降低 capability-wakeup miss / guide 入口迷路 / magic word 不知道怎么用的追问。
- 支持 stale/sunset：sourceRef 失效、feature done/sunset、连续低价值或被用户 dismiss 的 tip 进入 review。
- dogfood 报告：第一个用户为铲屎官，Phase B 后用 alpha 录屏 + 使用反馈判断是否继续上 C/D hard layer。

## Eval / Tracking Contract

### 1. Primary Users + Activation Signal

- **Users**: 铲屎官（等待时学习家里能力）、猫猫/feature owner（贡献和维护 tips）、维护猫（观察 tips 是否改善能力发现）。
- **Activation**: thread 等待/执行状态持续超过阈值；或 feature dev/review/merge-gate 等上下文命中。

### 2. Friction Metric

- 用户仍频繁问"这个功能怎么用 / 家里有没有 X 能力"且已有相关 tip。
- Tip 展示但 action 点击后失败或打开错误 source。
- 新 user-visible feature 合入但没有 tip 或豁免。
- Tip 被高频 dismiss，或 sourceRef stale。

### 3. Regression Fixture

- 等待态 `thinking` 展示 capability tip，但主状态仍只显示真实 `思考中/回复中`。
- `suspected_stall` 状态下故障文案、取消和强制重置入口可见且优先，tips 不遮挡。
- Magic word tip 从 shared-rules/L0 sourceRef 生成，不硬编码第二套词表。
- 新 feature PR fixture 缺 tips 且无 `tips_exempt` 时 hard check red；补 sourceRef + context 后 green。

### 4. Sunset Signal

- 某 tip 连续 N 周零点击且无后续追问改善证据 → 降级或删除。
- sourceRef 指向的 feature/skill/guide sunset → tip 自动进入 stale review。
- 若模型/产品原生 capability discovery 足够稳定，等待态 tips 可降级为按需 help，不再常驻轮播。

## Harness 三层（软+硬+eval）

| 层 | F244 落点 |
|----|-----------|
| Soft | 等待态 UI + feature/PR template 要求新增 1-2 条 tips 或豁免，让用户和猫自然想起能力/tips |
| Hard | feature manifest / guide / skill 新增时检查 tips 或 `tips_exempt`；tip schema/sourceRef/context CI；真实状态与 tips 分层的 component tests |
| Eval | 记录 tip 曝光、点击、被用户追问的频率；F192 usage/friction metrics + dogfood report + stale/sunset review |

## Acceptance Criteria

<!-- 立项愿景硬度自检（F216→F219）：每条 AC 必须 ① trace 回 Why 的某诉求 ② 非作者可复核（命令/数字/截图）。重构/降复杂度类须实测可量，不是"提了可测性就算"。 -->

### Phase A（Tip Contract + Source Projection）

- [ ] AC-A1: 定义 `CapabilityTip` schema，包含 `id/kind/sourceRef/contexts/audience/body/action/owner`，并有 parser/schema 测试。
- [ ] AC-A2: magic word tips 从 shared-rules/L0/F114 sourceRef 投影，不维护第二套硬编码定义；测试能发现 sourceRef 缺失。
- [ ] AC-A3: capability tips 至少覆盖 L0 §8 Tier 1 能力和 3 个高频 workflow tips（memory recall、alpha 验收、merge-gate），每条都有 action 或 sourceRef。
- [ ] AC-A4: 产出 seed tips inventory，明确哪些来自 F223、F155、F114、F192、F203；grep 无独立"能力清单本体"重复段落。

### Phase B（Waiting-State Projection UI）

- [ ] AC-B1: `ThinkingIndicator` / `ThreadExecutionBar` 等等待态 surface 能展示上下文 tip；alpha 截图覆盖 normal thinking、long-running、feature-dev/review 至少 3 种上下文。
- [ ] AC-B2: tips 与真实状态分层；`alive_but_silent` / `suspected_stall` 下取消、故障说明、`卡住了？强制重置` 入口不被遮挡，component tests 覆盖。
- [ ] AC-B3: Tip action 能打开对应 source/guide/capability surface；坏链接或 stale source 有可见错误，不静默失败。
- [ ] AC-B4: 铲屎官 dogfood 路径可演示：等待一次猫执行时看到至少一条 capability/magic-word/workflow tip，并能点开了解来源。

### Phase C（Feature Tips Contribution Gate）

- [ ] AC-C1: Feature kickoff/PR 模板新增 `Tips Contribution` 小节：新增 user-visible feature/capability/guide/harness 行为需 1-2 条 tips 或 `tips_exempt`。
- [ ] AC-C2: CI hard check 有 red/green fixture：缺 tips 且无豁免失败；补合法 tip 或合法豁免通过。
- [ ] AC-C3: hard check 不奖励废话数量：tip 必须有 `sourceRef` + `contexts` + `audience` + `owner`，且 body 不得包含无信号支撑的进度承诺（例如"快好了"）。
- [ ] AC-C4: `feat-lifecycle` / `quality-gate` 文档同步，feature owner 能在收尾前复核 tips 是否仍匹配交付物。

### Phase D（Eval + Staleness Loop）

- [ ] AC-D1: usage telemetry privacy-minimal：记录 tip id、context、action outcome，不记录用户私密正文。
- [ ] AC-D2: F192 eval path 能消费 tips usage/friction 信号，至少产出 one-shot dogfood report 或 domain extension design。
- [ ] AC-D3: Phase B 后产出铲屎官 dogfood 报告：哪些 tips 被看见/点开/觉得有用，哪些造成噪音。
- [ ] AC-D4: stale/sunset 机制能发现 sourceRef 失效或 feature sunset 后仍展示的 tip，并给 owner 可处理清单。

## Dependencies

- **Evolved from**: W7 Knowledge Feed（等待态投影）
- **Related**: F223（Capability Surface Registry — 能力与 typed surface 真相源）
- **Related**: F114 / F227（Magic Words / Event Memory — 拉闸词与使用场景）
- **Related**: F155（Guide Engine — 需要更完整操作时跳转到 guide）
- **Related**: F192（Harness Eval — tips effectiveness 与 stale/sunset）
- **Related**: F203（L0 §8 — capability wakeup 触发层）
- **Related**: F220（A2A 等待/卡死 UI — 不覆盖故障与强制重置）
- **Related**: F229（猫猫球/桌宠 — 后续可复用 tips 投影）
- **Related**: F243（Docs Discovery Profile — sourceRef/doc profile 可复用）

## Risk

| 风险 | 缓解 |
|------|------|
| 退化成随机可爱文案库 | schema 强制 `sourceRef`；猫格文案只是 presentation variant，不是知识本体 |
| 假进度 / 假精确状态 | 真实状态与 tips 分层；无 runtime signal 禁止写状态性动词；AC-B2 测试锁住 |
| 每 feature 强制 1-2 条导致废话 | 做质量门：sourceRef/context/action/owner 必填；纯内部重构可豁免 |
| tips 过多造成噪音 | 展示阈值、慢轮播、dismiss/stale metric；Phase D sunset |
| 能力清单漂移 | 只投影 F223/L0/skill/guide/source docs，不维护独立清单 |
| 覆盖故障逃生口 | suspected_stall/alive_but_silent 下故障与强制重置优先，tips 降级或隐藏 |

## Open Questions

| # | 问题 | 状态 |
|---|------|------|
| OQ-1 | tips manifest 真相源放 Markdown inventory、YAML，还是从 F223/F155/source docs 生成？ | ⬜ Design Gate 定；倾向 seed manifest + sourceRef 校验 |
| OQ-2 | 第一版 UI 只进 chat waiting bar，还是同步进猫猫球/桌宠状态？ | ⬜ 倾向先 chat waiting bar dogfood，猫猫球复用留 Phase B+ |
| OQ-3 | F192 侧复用 `eval:capability-wakeup` 还是新增 `eval:capability-tips` domain？ | ⬜ Phase D 定；先用 one-shot dogfood report |
| OQ-4 | Tip action 打开 source 的主表面用 Workspace navigate、Guide card，还是右侧 help drawer？ | ⬜ Design Gate 画 wireframe 后定 |

## Key Decisions

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1 | 新开 F244，不挂 F223/F155 | F223 owns capability execution registry；F155 owns step-by-step guides；F244 owns waiting-state projection and contribution lifecycle | 2026-06-18 |
| KD-2 | Tips 是投影，不是第四套能力清单 | 防止 source drift，符合 P4 单一真相源 | 2026-06-18 |
| KD-3 | 真实状态、tips、猫格表达三层分离 | 诚实红线；避免假进度与故障粉饰 | 2026-06-18 |
| KD-4 | Feature tips gate 是质量门，不是数量门 | 强制数量会催生废话 tips；必须有 sourceRef/context/action/owner 或豁免 | 2026-06-18 |
| KD-5 | 第一个用户是铲屎官，优先 dogfood | CVO 明确 signoff；先在真实等待态验证是否有用 | 2026-06-18 |
| KD-6 | 不维护平行能力大全 | F244 只消费 F223/L0/F114/F155/F192 等 sourceRef；tips 是投影，不是新真相源 | 2026-06-18 |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-06-18 | 铲屎官 + 宪宪 + 砚砚讨论收敛：从"猫言语"重定为 Capability Tips System / 等待态 Knowledge Feed 投影 |
| 2026-06-18 | 铲屎官确认直接立项 |

## Review Gate

- Design Gate: 前端 UI/UX，必须给铲屎官看 wireframe；重点确认 tip 在等待条里的位置、节奏、动作入口和故障优先级。
- Harness review: 需要跨个体 review `Tips Contribution` hard check 和 Eval Contract，避免数量门/废话门。
- Vision guard: 结束时必须用铲屎官原话对照，证明交付物不是"可爱 loading 文案"，而是真的让用户学会家里能力。

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| **Feature** | `docs/features/F223-capability-surface-registry.md` | 能力 surface 与 typed execution 真相源 |
| **Feature** | `docs/features/F114-governance-magic-words.md` | Magic words 原始 feature |
| **Feature** | `docs/features/F155-scene-guidance-phase-a-spec.md` | Guide Engine 与 tips 字段的既有模式 |
| **Feature** | `docs/features/F192-socio-technical-harness-eval.md` | Eval/tracking control plane |
| **Feature** | `docs/features/F227-event-memory.md` | Magic words 事件索引与 source use case |
| **Ref** | `cat-cafe-skills/refs/capability-wakeup-index.md` | L0 §8 能力速查 |
| **Ref** | `cat-cafe-skills/refs/shared-rules.md` | W7 + Magic Words 真相源 |
