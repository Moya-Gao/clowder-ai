---
doc_kind: review-request
feature_ids: [F154]
created: 2026-04-12
---

# Review Request: F154 Phase B — Hub 可见性 + UX 统一

Review-Target-ID: f154-phase-b
Branch: feat/f154-phase-b

## What

三个子功能实现 Phase B 的 Hub 端首选猫可见性：

1. **B1 — ThreadCatPill**: ChatContainerHeader 内嵌 Pill 组件，显示当前 thread 首选猫（品种色点 + 猫名 + ▾），点击展开 CatSelector popover（复用 ThreadCatSettings 的 fixed-position 模式）。桌面端专用（KD-10: `hidden lg:block`）
2. **B2 — DefaultCatSelector**: CatOverviewTab（Member Overview）新增全局默认猫卡片网格选择器，接入 Phase A 已有的 `GET/PUT /api/config/default-cat` 端点。当前默认猫高亮 + "默认" badge + 影响范围说明
3. **B3 — /status 首选猫**: Connector `/status` 输出新增"首选猫"行，从 catRoster 解析猫名

## Why

F154 Phase A 实现了 Connector 端的 `/focus` `/ask`，但 Hub 端看不到首选猫状态（R2），也没有设置全局默认猫的 UI（R3）。Phase B 补齐 Hub 可见性。

## Original Requirements（必填）

> 铲屎官（2026-04-09）：
> "在猫猫咖啡里面如何设定，以及如何知道这个 thread 的首选猫是谁？"
> "这个应该和 #385 的 issue 联合立项，是一个完整的东西"
> "除了飞书呢？"

- 来源：`docs/features/F154-cat-routing-personalization.md` Why 段落
- 社区 issue: clowder-ai#385（全局默认猫可配置）、clowder-ai#391（@-free 路由）
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- 移动端退化：KD-10 决定先做桌面端，窄屏隐藏 Pill，中屏可考虑只显色点（未实现）
- B2 config 持久化：Phase A 的 `setRuntimeDefaultCatId()` 是内存变量（重启丢失），spec 已记录此 gap 为 known limitation
- Pill 目前只显示 `preferredCats[0]`（v1 `/focus` 仅支持单猫，KD-5）

## Open Questions

1. **Pill 位置**：放在 ThreadIndicator 右侧（同一行）。顶栏空间有限，reviewer 评估是否有挤压风险
2. **B2 卡片交互**：当前点击即切换（无二次确认），spec 提到"二次确认"但 MVP 简化为直接切换。是否需要加确认？
3. **Popover z-index**：使用 `z-50` + fixed positioning，与 ThreadCatSettings 一致。复杂布局下是否有层级冲突？

## Next Action

请 codex 做 code review（跨 family），重点关注：
- B1 popover 的 fixed-position 逃逸是否在所有布局下可靠
- B2 API 调用的错误处理（当前 PUT 失败静默，是否需要 toast）
- B3 catRoster fallback 行为（无 roster 时显示 raw catId）

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/f154-phase-b/codex`
- Start Command: `pnpm review:start`
- Ports: review:start 自动分配（起点 3201/3202）

## 自检证据

### Spec 合规

| AC | 状态 | 测试 |
|----|------|------|
| AC-B1: Thread header 显示首选猫 | ✅ | 6 tests (thread-cat-pill.test.ts) |
| AC-B2: Member overview 默认猫选择器 | ✅ | 5 tests (default-cat-selector.test.ts) |
| AC-B3: /status 输出包含首选猫信息 | ✅ | 3 tests (connector-command-layer.test.js) |
| AC-B4: Hub/Connector preferredCats 实时同步 | ✅ | 架构保证（同一 threadStore model） |

### 测试结果

```
pnpm --filter @cat-cafe/web exec vitest run  # 286 files, 2040 tests, 0 failures (run at 03:47)
pnpm --filter @cat-cafe/api exec node --test  # 78 passed, 0 failed (run at 04:26)
pnpm lint                                     # 0 errors
pnpm check (biome)                            # 0 errors
pnpm --filter @cat-cafe/api build             # exit 0
tsc --noEmit                                  # 0 errors
```

### 根目录工件闸门

```
git status --short | rg media → 无
git diff --name-only origin/main...HEAD | rg media → 无
```

### 相关文档

- Feature: `docs/features/F154-cat-routing-personalization.md`
- Phase A PR: #1020 (merged)
- Community: clowder-ai#385, clowder-ai#391, clowder-ai#419（B2 参考）

### 变更文件清单

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `packages/web/src/components/ThreadCatPill.tsx` | 新增 | B1 Pill + popover |
| `packages/web/src/components/DefaultCatSelector.tsx` | 新增 | B2 卡片选择器 |
| `packages/web/src/components/ChatContainerHeader.tsx` | 修改 | B1 Pill 集成（+14行） |
| `packages/web/src/components/config-viewer-tabs.tsx` | 修改 | B2 selector 集成（+41行） |
| `packages/api/src/.../connector-command-helpers.ts` | 修改 | B3 /status 首选猫行 |
| `packages/web/src/components/__tests__/thread-cat-pill.test.ts` | 新增 | B1 测试 (6 cases) |
| `packages/web/src/components/__tests__/default-cat-selector.test.ts` | 新增 | B2 测试 (5 cases) |
| `packages/api/test/connector-command-layer.test.js` | 修改 | B3 测试 (3 cases) |
