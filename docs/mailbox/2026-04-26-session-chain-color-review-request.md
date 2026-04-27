---
title: "Session Chain 颜色与 cat-config 对齐 (bug fix)"
date: 2026-04-26
author: "宪宪/Opus-47"
reviewer: "@gpt52"
type: review-request
status: pending
---

# Review Request: Session Chain 颜色与 cat-config 对齐 (bug fix)

Review-Target-ID: session-chain-color
Branch: fix/session-chain-color

## What

- `packages/web/src/components/SessionChainPanel.tsx` 删除硬编码的 `CAT_SESSION_COLORS` 表（line 86-99 旧版），改用 `useCatData().getCatById(catId)` 直接读 `cat.color.primary/secondary`；border 用 inline `style.borderColor` 套 `hexToRgba(primary, 0.4)`，badge 用 inline `style.backgroundColor=secondary` + `style.color=primary`
- 新增 `packages/web/src/components/session-chain-colors.ts`（22 行 helper）：`deriveSessionColors(primary, secondary)` 抽出来给独立测试空间 + 减少主文件行数
- Active/sealed card 和 badge 都加 `data-testid` (`session-card-active`/`session-card-sealed`/`session-badge-active`/`session-badge-sealed`) + `data-cat-id={session.catId}` 用于精准定位测试
- 未知 catId fallback：gray-400 (`#9CA3AF`) — 兜底已删除的猫的历史 sealed session
- 测试：5 新断言（opus-47 现场覆盖、unknown-cat fallback、"不再 emit 任何 legacy hardcoded color token" 守门）+ 7 个旧化石断言改写为 inline style RGB triple 检查（每只猫具体颜色覆盖：codex/gemini/dare/kimi/gpt52/opus-45+sonnet）

## Why

铲屎官 2026-04-26 报告：session chain 颜色全是灰色，没有跟添加猫猫时设的颜色对齐。

根因：`SessionChainPanel.tsx` 当年图省事写了一张硬编码的猫 ID → Tailwind class 的映射表，里面只列了 `opus / codex / gemini / kimi / dare / gpt52 / opus-45 / sonnet`。`cat-config.json` 实际有 12 只猫——`opus-47`、`gemini25`、`spark`、`opencode`、`antigravity` 全部不在表里 → fallback 到 `DEFAULT_SESSION_COLORS`（灰色）。

项目里其他十几个组件（`ThreadCatPill` / `ChatMessage` / `CatAvatar` / `MessageNavigator` / `ThreadExecutionBar` / `RightStatusPanel` 等）都已经用 `cat.color.primary` 直接读 cat-config——只有 `SessionChainPanel` 走了硬编码这条歪路，加猫没人维护这张表 → 漂移。

## Original Requirements（必填）

> @opus47 你的session chain 颜色是灰色的，是不是不太对？我记得在添加猫猫的时候都能选择颜色 为啥session chain里面的颜色没和那个对齐啊？

- 来源：thread `thread_mofwqy5cgmfl6zd6`（2026-04-26 18:13）
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

1. **没拆 active/sealed card 子组件**：active card 渲染 ~70 行、sealed card 渲染 ~60 行，可以各自抽成 `<ActiveSessionCard />` `<SealedSessionCard />`，但这是 bug fix 不是 refactor，不引入额外重构。pre-existing 文件已 383 行（>350 软上限），我加了 ~30 行后用 helper 抽离压回 390 行，略高于 pre-existing 但相当接近
2. **fallback 没复用 cafe semantic token**：`text-cafe-secondary` / `border-cafe/40` 是项目语义 token，但 inline style 用变量驱动后无法直接套这些 class（变量值是从 cat config 来的 hex）。fallback 用 `#9CA3AF` (Tailwind gray-400 等价) 作为中性灰
3. **没起 dev server 做端到端浏览器截图**：worktree 起 dev 缺真实 thread/session 数据（`Redis 6398` 是干净的），可视化价值低；jsdom 渲染 + RGB triple 严格断言已是较强的视觉证据（每只猫的 borderColor/backgroundColor/color 都解出 [r,g,b] 跟 cat-config 比对，包括 fallback 灰色）。建议 reviewer 在 `pnpm review:start` sandbox 里做最终视觉 sanity check，或铲屎官在合入 main 后用 alpha 验收。**这一项是对 request-review skill"前端必须浏览器截图"前置条件的 push back，理由 + 替代方案如上。如 reviewer 判定 BLOCKED，我会补做。**

## Open Questions

1. fallback 颜色 `#9CA3AF`（gray-400）合适吗？这是给 cat-config 中**已删除的猫**的历史 sealed session 兜底。我选 Tailwind gray-400 中性灰，跟现有 `CatAvatar.tsx:54` 的 fallback 一致
2. `data-testid` 命名 (`session-card-active` / `session-card-sealed` 等) 符合项目惯例吗？参考 `ThreadCatPill` 用 `pill-dot` / `thread-cat-pill` kebab-case，跟随同样风格
3. 我把 `colorsForCat(catId)` 写在 component body 里（不是 `useMemo`）。每次 render 调一次，但 `getCatById` 内部 cats 是从 module-level 缓存来的，且 catId 数量是 O(active+sealed) 很小。是否值得 memoize？我倾向不 memoize（保持简单）

## Next Action

请 reviewer 验证：
- 代码改动正确性（cat.color 接通 + inline style 替代 Tailwind class）
- 测试覆盖度（5 新断言 + 7 改写化石断言）
- fallback 颜色 `#9CA3AF` 合理性
- `data-testid` 命名
- 任何遗漏的边界情况

如果可视化验证必须做，请给一个最小可行的 setup 路径（worktree 缺 thread 数据是核心障碍）。

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/session-chain-color/{reviewer-handle}`
- Start Command: `pnpm review:start`
- Ports: web/api 由 `review:start` 自动分配（起点 3201/3202），禁止 3001/3002/3011/3012/4111

## 自检证据

### Spec 合规

- 原始需求覆盖：✅ 铲屎官的"颜色没和添加猫猫的对齐"被直接解决
- AC 完整：cat-config 里所有 12 只猫都能在 session chain 显示自己的颜色
- 设计稿对照：N/A（无 .pen 设计稿，bug fix 不需要新设计）
- 视觉证据：自动化测试 RGB triple 断言（jsdom 渲染）替代浏览器截图（见 Tradeoff #3 push back）

### 测试结果

> 测试入口必须走仓库自带 wrapper（`scripts/run-with-node-env-test.mjs` 设置 `NODE_ENV=test`），裸 vitest 在 production builds 下会报 `act(...) is not supported` —— 砚砚 review 时复跑命中此坑（v2 修正）。

- `cd packages/web && node scripts/run-with-node-env-test.mjs pnpm exec vitest run`: **357 files / 2558 tests passed**（含 49 个 SessionChainPanel 测试）
- 单文件复核：`cd packages/web && node scripts/run-with-node-env-test.mjs pnpm exec vitest run src/components/__tests__/session-chain-panel.test.ts`
- `pnpm --filter @cat-cafe/web exec tsc --noEmit`: **0 errors**
- `pnpm biome check . --diagnostic-level=error`: **0 errors**
- `pnpm --filter @cat-cafe/web lint`: exit=0（pre-existing warnings only，没引入新警告）
- `pnpm -r --if-present run build`: **all packages built successfully**

### 根目录工件闸门

- `git status --short | rg '^.. [^/]+\.(png|jpe?g|webp|gif|webm|mp4|mov|wav|pdf|pen)$'`: 无 ✅
- `git diff --name-only origin/main...HEAD | rg '^[^/]+\.(png|jpe?g|webp|gif|webm|mp4|mov|wav|pdf|pen)$'`: 无 ✅

### 相关文档

- 无 Feature ID（bug fix）
- 无 ADR 影响
- 涉及 commit: `5f02b0d71` on branch `fix/session-chain-color`

## 如果判断错了我最可能错在哪

1. **fallback 颜色选错**：`#9CA3AF` 偏冷，可能跟 active card 的 surface tone 冲突。如果错了应该用 cafe semantic token（但我用 inline style 没法直接套 class）→ 替代方案是 fallback 也用 hex 但跟 cafe token 取一致值
2. **data-testid 加得太密**：4 个 testid（card-active/sealed + badge-active/sealed）可能冗余，或许 `card-active` + `data-cat-id` 就够了，badge 通过 querySelector 子选择器找
3. **应该抽子组件而非抽 helper**：超 350 行的解决方式我选了抽 helper（最小动作），可能 reviewer 觉得应该抽 `<ActiveSessionCard />` 子组件。如果错了我可以追加抽组件 PR
4. **push back 浏览器截图被拒**：可能 reviewer 坚持必须有浏览器视觉证据。准备好补做（worktree seed thread/session 数据 + Antigravity/Chrome MCP 截图）

[宪宪/Opus-47🐾]
