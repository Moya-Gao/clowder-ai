---
feature_ids: [F032]
topics: [review-request, agent-plugin, dynamic-config]
doc_kind: review-request
created: 2026-02-27
---

# Review Request: F032 Agent Plugin Architecture

## 背景

**为什么做这个**：2026-02-26 铲屎官指出 Codex 喊 Opus 4.6 帮忙 review 而不是负责人 Opus 4.5。多分身共存导致硬编码规则失效 — 哪个布偶猫？哪个缅因猫？

**$40 教训**：SOP 写死了"布偶猫 ↔ 缅因猫"，布偶猫没猫粮了缅因猫还疯狂找他 review，烧了铲屎官 40 美刀！

**解决方案**：把硬编码的猫名替换成动态 roster-based 规则，包括技术侧（CatRegistry, AgentRegistry, catIdSchema）和协作侧（SOP, Skills）。

## 设计文档

- **Spec**: `docs/features/F032-agent-plugin-architecture.md`
- **相关讨论**: 2026-02-26 三猫讨论

## Spec Compliance 自检

### Phase A: 技术侧松绑

| # | Spec 要求 | 实现状态 | 代码位置 | 测试覆盖 |
|---|-----------|----------|----------|----------|
| A1 | CatId 类型松绑 | ✅ | shared/src/types.ts:CatIdSchema | cat-config-loader.test.js |
| A2 | AgentRegistry 替代硬编码 | ✅ | services/agents/index.ts:agentRegistry | agent-registry.test.js |
| A3 | z.enum 动态化 | ✅ | shared/src/types.ts:catIdSchema | 使用 refine 校验 |

### Phase B: 协作规则动态化

| # | Spec 要求 | 实现状态 | 代码位置 | 测试覆盖 |
|---|-----------|----------|----------|----------|
| B1 | Roster Schema + available 字段 | ✅ | cat-config.json:roster + rosterEntrySchema | cat-config-loader.test.js |
| B2 | Reviewer 匹配规则 + 降级逻辑 | ✅ | services/collaboration/reviewer-matcher.ts | reviewer-matcher.test.js |
| B3 | SOP/Skill 模板化 | ✅ | docs/SOP.md:Reviewer配对规则 + skills/*.md | - |

### Phase C: Thread 活跃度支持

| # | Spec 要求 | 实现状态 | 代码位置 | 测试覆盖 |
|---|-----------|----------|----------|----------|
| C1 | ThreadStore 扩展 | ✅ | stores/ports/ThreadStore.ts:getParticipantsWithActivity | thread-store.test.js |
| C2 | AgentRouter fallback 链改进 | ✅ | agents/routing/AgentRouter.ts | agent-router.test.js |

### Phase D: 提示词动态注入

| # | Spec 要求 | 实现状态 | 代码位置 | 测试覆盖 |
|---|-----------|----------|----------|----------|
| D1 | 队友介绍动态化 | ✅ | context/SystemPromptBuilder.ts:buildTeammateRoster | system-prompt-builder.test.js |
| D2 | Reviewers 动态注入 | ✅ | context/SystemPromptBuilder.ts:buildReviewerSection | system-prompt-builder.test.js |

### Phase E: 验证可扩展性

| # | Spec 要求 | 实现状态 | 代码位置 | 测试覆盖 |
|---|-----------|----------|----------|----------|
| E1 | Spark 新猫配置 | ✅ | cat-config.json:codex-spark variant | - |
| E2 | Spark 路由正确 | ✅ | @spark 可被正确路由 | - |
| E3 | Spark 不在 peer-reviewer 列表 | ✅ | roles=["coder"] 无 peer-reviewer | reviewer-matcher.test.js |

### P2 清理: 遗留 fallback 硬编码

| # | 清理项 | 实现状态 | 代码位置 |
|---|--------|----------|----------|
| 1 | cat-budgets.ts 使用 getAllCatIdsFromConfig() | ✅ | config/cat-budgets.ts:L121-128 |
| 2 | cat-voices.ts 使用 getAllCatIdsFromConfig() | ✅ | config/cat-voices.ts:L89-96 |
| 3 | TaskExtractor.ts 使用 getAllCatIdsFromConfig() | ✅ | services/orchestration/TaskExtractor.ts:L13-17 |
| 4 | CatCafeHub.tsx 动态 TABS | ✅ | web/components/CatCafeHub.tsx:L48-55 |
| 5 | SummaryCard.tsx 使用 useCatData() | ✅ | web/components/SummaryCard.tsx:L24-27 |
| 6 | ThinkingIndicator.tsx 使用 useCatData() | ✅ | web/components/ThinkingIndicator.tsx:L8-10 |

## 改动文件

### Backend (packages/api)

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| src/config/cat-config-loader.ts | 修改 | 添加 getAllCatIdsFromConfig() helper |
| src/config/cat-budgets.ts | 修改 | 用动态 fallback 替代硬编码 |
| src/config/cat-voices.ts | 修改 | 用动态 fallback 替代硬编码 |
| src/domains/cats/services/orchestration/TaskExtractor.ts | 修改 | 用动态 fallback 替代硬编码 |
| test/cat-budgets.test.js | 修改 | 更新测试适配 8 猫 roster |
| test/system-prompt-builder.test.js | 修改 | 修复 regex 匹配 |

### Frontend (packages/web)

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| src/components/CatCafeHub.tsx | 修改 | HubTabId 动态化, TABS 用 useCatData() |
| src/components/SummaryCard.tsx | 修改 | 用 useCatData() 替代硬编码 CAT_NAMES |
| src/components/ThinkingIndicator.tsx | 修改 | 用 useCatData() 替代硬编码 CAT_NAMES |

## Git SHA

- **Base**: `0a8782c` (feat: add Spark variant)
- **Head**: `d86845a` (refactor: replace hardcoded cat fallbacks)

## 测试状态

```
pnpm test (排除 Redis/并发测试):
ℹ tests 1970
ℹ pass 1970
ℹ fail 0

pnpm build: ✅ 通过
```

## Review 重点

1. **getAllCatIdsFromConfig() 容错**：config 加载失败时返回空数组是否合理？
2. **useCatData() 在 Hub 组件的使用**：动态 TABS 构建逻辑是否正确？
3. **Test regex 修复**：`/@缅因猫(?=\s*\/)/g` 是否过于 specific？

## 五件套

**What**:
- Backend: 4 个文件用 getAllCatIdsFromConfig() 替代硬编码 ['opus', 'codex', 'gemini']
- Frontend: 3 个组件用 useCatData() hook 替代硬编码 CAT_NAMES
- Tests: 2 个测试更新适配动态 roster

**Why**:
- 硬编码猫名是 $40 教训的根因 — 当 opus 额度耗尽，hardcoded "布偶猫找缅因猫" 静默失败
- 动态配置允许优雅的 reviewer 重新分配和降级

**Tradeoff**:
- 放弃了编译时类型安全（CatId 从 union type 变为 branded string）
- 换取了运行时动态配置的灵活性

**Open Questions**:
- 前端 useCatData() 的 retry 逻辑（10s × 3）是否足够？
- getAllCatIdsFromConfig() 返回空数组时的降级行为是否需要 log 警告？

**Next Action**:
请 @codex review 上述 9 个文件

---

**Review 请求检查**:
- [x] Spec compliance 自检完成
- [x] 设计文档已附
- [x] 测试通过 (1970 pass, 0 fail)
- [x] Build 通过
- [x] 五件套完整
