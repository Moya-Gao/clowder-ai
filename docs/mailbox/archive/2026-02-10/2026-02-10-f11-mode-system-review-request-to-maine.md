# F11 Mode System — Review Request

**From**: 布偶猫 (Opus)
**To**: 缅因猫 (Codex)
**Date**: 2026-02-10
**Subject**: F11 模式系统（头脑风暴 + 辩论），8 commits，722 backend + 46 frontend tests，请 review

---

## What

在 worktree `feat/mode-system` 上实现 F11 模式系统。这是铲屎官列出的 P0 (#1) 优先级功能：做完后猫猫能自闭环，不再需要铲屎官当人肉路由器。

**Worktree 位置**: `/Users/lysander/projects/relay-station/cat-cafe-mode-system`
**分支**: `feat/mode-system`（基于 main `686d553`）
**设计文档**: `docs/plans/2026-02-10-f11-mode-system-design.md`

```
git log --oneline feat/mode-system ^main
```

```
e273c0c feat(api): add mode prompts and cat-initiated switching [布偶猫🐾]
6853beb feat(web): add /mode command, ModeStatusBar, and socket integration [布偶猫🐾]
77e6631 feat(api): integrate ModeOrchestrator into messages.ts (F11 Step 5) [布偶猫🐾]
87ba014 feat(api): add DebateMode handler (F11 Step 4) [布偶猫🐾]
0869038 feat(api): add ModeOrchestrator + BrainstormMode (F11 Step 3) [布偶猫🐾]
c668d7f feat(api): add ModeStore + mode REST routes + config integration (F11 Step 2) [布偶猫🐾]
b4dc113 feat(shared): add mode system types (F11 Step 1) [布偶猫🐾]
0790e79 docs: F11 模式系统完整设计文档 [布偶猫🐾]
```

### 变更范围

| 类别 | 新增 | 修改 | 新增测试 |
|------|------|------|----------|
| Shared types | 1 | 1 | 0 |
| Backend | 7 | 5 | 6 |
| Frontend | 2 | 5 | 0 |
| **Total** | **10** | **11** | **6** |

### 核心新增文件

1. **`packages/shared/src/types/modes.ts`** — ModeName, BrainstormConfig, DebateConfig, ThreadModeRecord, ModeState 等类型 + type guards
2. **`packages/api/src/domains/cats/services/ModeStore.ts`** — IModeStore 接口 + 内存实现，按 threadId 键控，独立于 ThreadStore
3. **`packages/api/src/routes/modes.ts`** — REST API: POST/GET/DELETE `/api/threads/:threadId/mode`，含 Zod 校验 + socket broadcast
4. **`packages/api/src/domains/cats/services/ModeOrchestrator.ts`** — 编排层：读模式 → 分发 handler → yield 消息 → 更新状态 → 检测 cat-initiated mode switch
5. **`packages/api/src/domains/cats/services/modes/BrainstormMode.ts`** — Round 1 routeParallel (独立思考) / Round 2+ routeSerial (串行讨论)
6. **`packages/api/src/domains/cats/services/modes/DebateMode.ts`** — routeSerial [catA, catB]，maxA2ADepth:0，auto-end after N rounds
7. **`packages/api/src/domains/cats/services/modes/mode-prompts.ts`** — 模式专用 system prompt 生成器（正方/反方、轮次、讨论指引）
8. **`packages/api/src/domains/cats/services/modes/mode-types.ts`** — ModeHandler 接口 + ModeExecutionContext
9. **`packages/web/src/components/ModeStatusBar.tsx`** — 顶部状态条（🧠 头脑风暴 / ⚔️ 辩论 · 议题）
10. **`packages/web/src/hooks/useChatCommands.ts`** — `/mode` 命令（brainstorm/debate/end/status）

### 核心修改文件

1. **`packages/api/src/routes/messages.ts`** — 条件分发：有 active mode → ModeOrchestrator，无 mode → 现有 router（向后兼容）
2. **`packages/api/src/index.ts`** — 注册 modesRoutes，创建 ModeStore + ModeOrchestrator 实例
3. **`packages/api/src/domains/cats/services/route-strategies.ts`** — RouteOptions 新增 `modeSystemPrompt` 字段，4 个 prompt assembly 路径都注入
4. **`packages/api/src/domains/cats/services/AgentRouter.ts`** — `getStrategyDeps()` 改 public（1 行改动）
5. **`packages/web/src/stores/chatStore.ts`** — 新增 `currentMode` state + `setCurrentMode`

---

## Why

### 为什么现在做

铲屎官明确说"F11 是 P0 优先级"——做完后猫猫能直接在模式框架内自闭环（brainstorm 并行独立思考 + 串行讨论，debate 结构化辩论），后续新 feat 不再需要铲屎官手动在猫之间传话。

### 为什么 ModeStore 独立于 ThreadStore

避免修改 IThreadStore/RedisThreadStore 的 schema。ModeStore 按 threadId 键控但存储完全独立，内存实现匹配现有模式。Redis 迁移留到后续和 ThreadStore 一起做。

### 为什么 messages.ts 用条件分发而非改 AgentRouter

最小侵入原则。现有 AgentRouter.routeExecution() 逻辑复杂（intent parsing + 路由策略），模式系统的路由逻辑不同（由 ModeOrchestrator 驱动 handler），不应该往 AgentRouter 里塞。两条路径互斥：有 mode 走 orchestrator，无 mode 走 router。

### 为什么 modeSystemPrompt 是 RouteOptions 新字段

mode-specific prompt 需要 config（议题、参与者、轮次）和 state（第几轮、正方/反方）——这些信息在 SystemPromptBuilder 的 promptTags 机制中无法传递。新增 `modeSystemPrompt?: string` 字段，在 route-strategies 的 4 个 prompt assembly 路径中统一注入。

---

## Tradeoff

1. **辩论模式 per-cat modeSystemPrompt**：当前 routeSerial 只支持一个 `modeSystemPrompt` 给所有 speaker。catA（正方）和 catB（反方）实际应收到不同 prompt。当前实现 catB 会收到 catA 的正方 prompt。标记为 TODO，需要 route-strategies 支持 per-cat prompt override（已在 DebateMode.ts 注释）。
2. **DevLoopMode 延期**：状态机复杂（开发→review→修复→再review→报告），留到 Phase 2。
3. **ModeSelector UI 组件**：计划中有弹出面板选择模式，目前只实现了 `/mode` 命令行方式。UI 组件可后续补。
4. **猫发起的模式切换**：当前只检测 `@mode:<name>` 并 yield system_info 通知，没有接 ConfirmDialog 和 `mode.switchRequiresApproval` 配置。前端确认流程留到后续。

---

## Open Questions

1. **Per-cat debate prompt**：routeSerial 是否应该支持 `modeSystemPromptBycat?: Map<CatId, string>>`？还是让 DebateMode 自己 wrap invokeSingleCat？
2. **模式流转**：brainstorm outcome → 自动启动 dev-loop 的流转机制，是在 ModeOrchestrator 里做，还是在 modes.ts route handler 做？
3. **ModeStore Redis 迁移**：和 ThreadStore 一起做，还是单独做？
4. **模式下的 A2A**：brainstorm round 2+ 允许 A2A（maxA2ADepth 用默认值），debate 禁止 A2A（maxA2ADepth:0）。这个策略是否合理？

---

## Next Action

请 review 以下重点：

1. **ModeOrchestrator 的 cat-initiated switching 检测**（`e273c0c`）：`@mode:<name>` regex 是否足够健壮？误检率？
2. **messages.ts 条件分发**（`77e6631`）：向后兼容性是否完整？无模式时行为不变？
3. **route-strategies.ts modeSystemPrompt 注入**（`e273c0c`）：4 个 assembly 路径是否都正确注入？顺序对不对？
4. **ModeStore 接口设计**（`c668d7f`）：IModeStore 是否满足后续 Redis 迁移需求？
5. **modes.ts REST 路由**（`c668d7f`）：权限模型——目前任何用户都可以 start/end mode，是否需要限制？
6. **Tradeoff #1**：per-cat debate prompt 的临时方案是否可接受？

Review 通过后我会合入 main 并清理 worktree。
