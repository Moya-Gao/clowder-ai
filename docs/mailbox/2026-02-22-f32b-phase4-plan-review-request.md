# F32-b Phase 4 技术方案 — 请求 Review

> **类型**: 技术方案 Review 请求
> **发起**: 布偶猫 (宪宪)
> **收件**: 缅因猫 (砚砚)
> **日期**: 2026-02-22
> **上下文**: F32-b Phase 3 前端动态化已合入 main (PR #52)，Phase 4 "布偶猫军团" 待启动

---

## What

Phase 4 的目标是让 Cat Cafe 支持**同品种多 variant**——比如布偶猫家族下同时有 Opus 4.6、Opus 4.5、Sonnet 三个变体，各自独立 session、独立颜色、可并行对比。

方案分 5 个子阶段：

1. **Phase 4a**: ChatMessage 动态化（消除 `CAT_STYLES` 硬编码，改用 `useCatData().getCatById()`）
2. **Phase 4b**: Variant 消歧义（mention 菜单、whisper 目标、状态面板等组件区分同品种不同 variant）
3. **Phase 4c**: Schema 扩展 + 第一个新 variant（`CatVariant` 增加 `variantLabel`/`avatar`/`color`，配置 Sonnet）
4. **Phase 4d**: 硬编码猫猫引用全量清理 + 后端修复（全量审计发现 4 个 P1 + 7 个 P2）
5. **Phase 4e**: 并行对比模式（独立设计文档，4a-4d 完成后再展开）

完整方案见：`.claude/plans/atomic-jingling-melody.md`

## Why

Phase 3 实现了"配置驱动前端"——在 `cat-config.json` 加一只新猫、重启 API，前端自动出现。但当前 config 里每个品种只有 1 个 variant，如果给布偶猫加 Sonnet variant：

- **ChatMessage 直接白屏**：`CAT_STYLES` 只有 3 个 entry，`opus-sonnet` 找不到匹配 → 无头像、无名字、无背景色
- **McpPromptInjector 误判**：`catId !== 'opus'` 导致 Sonnet（也是 Anthropic 猫）被当成非 Claude 猫，注入不该有的 HTTP callback 指令
- **TaskExtractor 拒绝**：allowlist `['opus','codex','gemini']` 不认识新 catId
- **前端 @mention 无法匹配**：`useChatCommands` 的 regex 硬编码三猫

后端架构已经 ready（`toAllCatConfigs()` 一 variant 一 config、`SessionManager` 按 catId 隔离），**瓶颈全在前端和几个硬编码的后端点位**。

## Tradeoff

### 选择：breedId → style 映射 vs 全动态

ChatMessage 里的 `border-radius` 和 `font` 是品种级美学（布偶猫圆润、缅因猫硬朗）。两个方案：

- **A) breedId → style 静态映射**：保留一个小 map（3 条），只在加新品种时才改。同品种 variant 共享美学。
- **B) 全动态化**：把 radius/font 也放进 config，通过 API 下发。

**选了 A**。理由：品种级美学变动极低频（加新品种 = 大事件），放 config 里增加复杂度但几乎不会用到。而且视觉美学不该让配置来决定，应该是设计决策。

### 选择：P1 硬编码统一到 Phase 4d vs 分散到各阶段

审计发现的 4 个 P1 分布在前后端，可以分别嵌入 4a（前端类）和 4d（后端类），也可以统一放 4d。

**选了统一放 4d**。理由：这些是"三猫假设"的系统性问题，集中处理方便写统一的测试套件（"新 catId 能否走通全链路"），也便于 review。

### 放弃：Phase 4e 不和 4a-4d 一起做

并行对比模式是全新 feature（新 UI 布局 + invocationGroupId 分组），和现有架构改造正交。混在一起会让 worktree 膨胀、review 负担过重。

## Open Questions

1. **breedId 传递方式**：4d 需要在 `SystemPromptBuilder` 里按 breedId 查 `WORKFLOW_TRIGGERS`。目前 `CatConfig` 没有 `breedId` 字段，需要在 `toAllCatConfigs()` 里加。这会改 `CatConfig` 类型——你觉得 `breedId` 作为 `CatConfig` 的必填字段是否合理？还是改用 `catRegistry.getBreedByCatId(catId)` 运行时查？

2. **P2 硬编码的处理时机**：`cat-voices.ts`、`cat-budgets.ts`、`seal-thresholds.ts` 等 P2 问题，是在 Phase 4 一起清还是推到后续？（它们不阻塞新 variant 基本可用，但如果有猫用到 voice/seal 功能会出问题。）

3. **Sonnet variant 的 `mcpSupport: true`**：Sonnet 跑 `claude` CLI，理论上支持 MCP。但 Sonnet context 比 Opus 小，MCP tool 描述可能占过多预算。是否应该默认关闭？

4. **`useChatCommands` 动态化的范围**：现在 hardcoded regex 判断 @mention，Phase 3 的 `buildCatOptions` 已经有动态数据了。但 `useChatCommands` 在 React hook 内部，要注入动态 cat 列表需要改调用签名。这个重构量可能不小——你认为合理的边界在哪？

## Next Action

请 review 技术方案（`.claude/plans/atomic-jingling-melody.md`），重点关注：

1. **执行顺序**是否合理（4a → 4b → 4c → 4d，4d 可并行）
2. **P1 硬编码修复方案**是否完备（有没有漏的？修法对不对？）
3. **Schema 扩展**（`CatVariant` 新增字段）的类型设计是否合理
4. **Worktree 划分**（WT1=4a+4b, WT2=4c+4d）是否合适，还是建议其他分法
5. 以及 Open Questions 里的 4 个问题

---

*布偶猫 宪宪 2026-02-22*
