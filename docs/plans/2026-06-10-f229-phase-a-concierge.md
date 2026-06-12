# F229 Phase A 前台开张 Implementation Plan

**Feature:** F229 — `docs/features/F229-cat-ball-concierge.md`
**Goal:** web 内常驻悬浮球前台猫：任意页面唤起对话，值班猫可配置，文字三件套（功能发现 / 求助 / 记忆导航含去取分叉），安静默认。
**Acceptance Criteria:**（从 feat doc 逐条抄录，本 plan 全覆盖）
- AC-A1 任意页面悬浮球唤起对话，不离开当前页面（截图 + 15s 录屏）→ PR-A2
- AC-A2 功能发现：非作者 3 问验收，答案与 release notes/feature docs 一致 → PR-A1+A3
- AC-A3 记忆导航：3 query 正确 anchor + 两动作（跳过去 teleport / 原地看 inline）→ PR-A3
- AC-A4 求助触发 F155 guide flow（录屏）→ PR-A3
- AC-A5 形象/人设/值班猫设置页可配置，与 cat profile 解耦（截图）→ PR-A4
- AC-A6 安静默认：零主动文本、低优先级只 badge、一键 hide/mute（录屏+截图）→ PR-A2

**Architecture cell:** concierge-surface（新建）
**Map delta:** new cell required
**Map delta why:** 用户侧常驻入口 + 值班槽 + escalation 协议是新架构线（hub-action-surface 是猫→用户单向）；cell 文件 `docs/architecture/ownership/cells/concierge-surface.md` 随 PR-A1 一起建并跑 `node docs/architecture/ownership/generate-readme.mjs`。
**Architecture:** 前台猫 = 岗位（KD-1/2）：① 对话载体 = per-user 专属 concierge thread（懒创建，sidebar 隐藏）——消息/invocation/记忆全复用；② 值班猫 = 普通 cat invocation + ConciergePromptSection 岗位注入（GuidePromptSection 同模式）；③ surface = AppShell/root 级 host（F226 KD-1 教训）。零平行设施。
**Tech Stack:** 现有栈——Zustand store / Fastify routes / Redis store (TTL=0) / node --test + vitest / rich block CardBlock actions。
**前端验证:** Yes — reviewer 必须 Playwright/Chrome 实测四态 + 路由切换 survival。

**Not building（Phase A 明确不做）:** 语音 loop（C）/ 快速档 clerk（D）/ 桌宠高级动效与皮肤上传（E）/ Tier 2+ 主动气泡（relay 回执除外）/ propose_thread 分诊（B）/ 页面内容读取（只取路由级 URL/标题）。

---

## 终态 Schema（先钉死，所有 Task 围绕它）

```ts
// packages/shared/src/types/concierge.ts （新建）
export interface ConciergeConfig {
  enabled: boolean;            // default true
  skin: 'yarn-ball';           // Phase A 唯一皮肤
  displayName: string;         // default '猫猫球'（本家投票后改）
  personaTone: string;         // default '温暖、简短、不啰嗦'
  dutyCatProfileId: string;    // default 解析：'gemini35' 存在则用之，否则 roster 第一只可用猫
  proactivePolicy: 'ambient' | 'quiet-badge';  // Phase A 仅 Tier 0/0-1；default 'quiet-badge'
  muted: boolean;              // 一键 hide/mute（AC-A6）；default false
}

export type ConciergeBallState =
  | 'idle' | 'sleeping' | 'listening' | 'thinking'
  | 'found' | 'needs-confirmation' | 'handoff' | 'error';

// concierge thread 标记：ThreadStore record 增加可选字段（ports/ThreadStore.ts:121 同模式）
threadKind?: 'concierge';      // 缺省 = 普通 thread；sidebar 列表过滤掉 concierge

// CardBlock concierge actions（前端 action handler 注册）
type ConciergeCardAction =
  | { kind: 'concierge_teleport'; threadId: string; messageId?: string }      // 去
  | { kind: 'concierge_peek'; threadId: string; messageId: string }           // 取：inline 展开
  | { kind: 'concierge_relay'; targetThreadId: string; targetCats: string[] } // 传话
  | { kind: 'concierge_go'; targetThreadId: string };                         // 跟去
```

**岗位 prompt section 契约**（PR-A1 核心交付，ConciergePromptSection 输出骨架）：

```
## 前台岗位（Concierge Duty）
你此刻在前台岗位值班，岗位名 {displayName}，性格基调 {personaTone}。职责：接线，不深潜。
- 回答必须 anchor-first：功能/记忆类回答带 1-3 个可点击 anchor（feature doc / guide / thread/message / release note）；多文档推断要标注"推断"；没有 anchor → 转接或明说不确定。
- 功能发现知识源限定：cat_cafe_feat_index、docs/BACKLOG.md、docs/features/、release notes、guide catalog（cat_cafe_get_available_guides）。
- 工具白名单（只许使用）：search_evidence / graph_resolve / list_recent / get_thread_context / feat_index / get_available_guides / start_guide / create_rich_block。跳转与传话不直接执行——发确认卡（CardBlock concierge actions），用户点击后由前端/后端执行。
- 转接（escalation）：超出岗位能力 → 发转接确认卡，带上用户原话全文 + 相关 anchor（禁止只带你的摘要）。
- 禁止：长人设独白；未经请求的教程；声称能做白名单外的事。
```

---

## PR-A1: 后端地基（config + thread 载体 + 岗位注入）

**Files:**
- Create: `packages/shared/src/types/concierge.ts`（上方 schema）
- Create: `packages/api/src/domains/concierge/ConciergeConfigStore.ts`（port + Redis 实现 + memory 实现，参照 LabelStore 三件模式 `stores/redis/RedisLabelStore.ts`）
- Create: `packages/api/src/domains/concierge/ConciergeThreadService.ts`（懒创建/获取 per-user concierge thread）
- Create: `packages/api/src/domains/concierge/ConciergePromptSection.ts`（参照 `packages/api/src/domains/guides/GuidePromptSection.ts` 的 compose 模式）
- Create: `packages/api/src/routes/concierge.ts`（GET/PUT `/api/concierge/config`、POST `/api/concierge/thread`→懒创建返回 threadId）
- Modify: `packages/api/src/domains/cats/services/stores/ports/ThreadStore.ts`（~L121 区域加 `threadKind?: 'concierge'`）
- Modify: `packages/api/src/routes/threads.ts`（列表查询默认排除 `threadKind === 'concierge'`，显式 query 参数可包含）
- Modify: `packages/api/src/domains/cats/services/context/SystemPromptBuilder.ts`（compose ConciergePromptSection：仅当 thread.threadKind === 'concierge'）
- Create: `docs/architecture/ownership/cells/concierge-surface.md` + 重新生成 README
- Test: `packages/api/src/domains/concierge/__tests__/`（store Redis-backed / thread service / prompt section）

**Steps（TDD 节奏）:**
1. 写 `concierge.ts` types + `pnpm --filter @cat-cafe/shared build`
2. 失败测试：ConciergeConfigStore get 返回默认值（dutyCatProfileId 解析：gemini35 不在 roster 时 fallback 第一只可用）→ 实现 → 绿。**Redis-backed 测试**（`pnpm --filter @cat-cafe/api test:redis`，in-memory 假绿教训）；**持久化 TTL=0**（铁律 5）
3. 失败测试：ConciergeThreadService 同 user 二次调用返回同一 threadId（幂等懒创建）+ threadKind 标记 → 实现 → 绿
4. 失败测试：threads 列表默认不含 concierge thread；带 `includeConcierge=true` 包含 → 实现 → 绿
5. 失败测试：SystemPromptBuilder 在 concierge thread 注入岗位 section（含白名单文案），普通 thread 不注入 → 实现 → 绿。**改完立刻跑守护测试 `node --test test/system-prompt-builder.test.js`**
6. routes + cell 文件 + `node docs/architecture/ownership/generate-readme.mjs`
7. `pnpm check` + commit（每步小 commit）

## PR-A2: 前端壳（host + 球八态 + 面板 + 安静默认）

> **⚠️ 本段已被 micro-spec 取代**：`docs/plans/2026-06-10-f229-pr-a2-frontend-microspec.md`（PR-A1 20 轮 review 复盘产物——球态改为纯投影 + 9 条不变量 + test matrix，实现以 micro-spec 为准，本段仅留文件清单参考）。

**Files:**
- Create: `packages/web/src/stores/conciergeStore.ts`（参照 guideStore 模式：config + ballState + panelOpen + 懒 threadId；ballState 由 concierge thread 的 invocation 状态驱动：pending→thinking、卡片待确认→needs-confirmation 等）
- Create: `packages/web/src/components/concierge/ConciergeSurfaceHost.tsx`（球 + 面板容器；portal(document.body)，z-index 用统一层级 token——与 F226 浮窗/Modal 不冲突）
- Create: `packages/web/src/components/concierge/ConciergeBall.tsx`（40-56px，八态 CSS/SVG 动画；`prefers-reduced-motion` 降级静态图标+badge；muted 时隐藏，ActivityBar 留唤回入口）
- Create: `packages/web/src/components/concierge/ConciergePanel.tsx`（compact drawer：page context chip（route 级 URL/标题）+ concierge thread 消息 mini 流（复用现有消息渲染组件）+ 输入框（含现有 F020 语音输入按钮）+ pull 式快捷入口两枚）
- Modify: `packages/web/src/components/AppShell.tsx`（root 挂载 host——在 `(chat)` route group 之外，F226 KD-1）
- Test: `packages/web/src/components/concierge/__tests__/`

**关键测试（先红后绿）:** host 路由切换 survival（`/` → `/memory` → `/settings` 球不卸载，仿 F226 AC-A2 测试模式）/ 球态状态机映射 / muted 隐藏+唤回 / reduced-motion 降级 / 默认零主动文本（badge 不渲染 text 节点，hover 才有 tooltip）→ AC-A1/A6 证据在此采集。

## PR-A3: 三件套交互（结果卡 + 确认卡 + 回执）

**Files:**
- Modify: 前端 CardBlock action handler 注册处（实现前 grep `console.warn` 的 unknown-action footgun 位置，F225 加的——那里就是注册点）：接 4 个 concierge actions
- Create: `packages/web/src/components/concierge/ConciergePeekCard.tsx`（原地看：调 `GET /api/messages?threadId=...` 按 anchor 前后窗口 inline 渲染，不离开当前页）
- Modify: `packages/api/src/routes/concierge.ts` 增加 relay 端点（POST `/api/concierge/relay`：cross_post 到目标 thread + 注册回执监听——目标 thread 对应回复到达后向 concierge thread 投回执卡；Phase A 简实现 = relay 消息带 marker，目标 thread 下一条该猫回复触发回执）
- Test: action dispatch 单测 + relay 回执 Redis-backed 测试

**Steps:** teleport/go 复用现有跳转（F227 teleport 语义，前端已有 cross-post 跳转链路 PR #2041 先例）；peek 失败测试先行（窗口边界：thread 首尾消息）；relay 回执是本 PR 最大风险点——先写"回执只触发一次（幂等）"红测。guide 触发（AC-A4）零新代码：岗位 section 已指引值班猫调 `start_guide`，验收录屏即可。

## PR-A4: 设置页 + 硬裁剪 spike + 收尾

> **2026-06-12 增强（census + 收尾清单，A3b 后更新）**：
> - **Census**：SettingsForm 状态轻量（dirty→saving→saved/error；config 为 per-user 单写者，球内 muted 切换与设置页并发 = last-write-wins 可接受，**标注进代码注释**即可不画全表）。`ballPosition` A3b 已进 config——设置页**不重复暴露**（拖球本身就是配置动作），只在"重置位置"给一个按钮（写 default 值）。
> - **字段终态**：enabled / displayName / personaTone / dutyCatProfileId（下拉 = roster 已配置猫）/ proactivePolicy（ambient | quiet-badge）/ muted / 重置位置；`skin` 显示为锁定项（贴纸过渡版，KD-14 像素猫正式素材后解锁四选一）——锁定也要可见，让用户知道皮肤体系存在。
> - **Spike 不变**（≤1h time-box）：`--mcp-config` per-thread-kind 切换在 claude/gemini 两 adapter 的可行性 → 结论进 F229 KD（Phase D 消费）。
> - **收尾职责**：AC-A2（功能发现 3 问）/ AC-A4（guide 触发录屏）证据采集 → AC checkbox 对照更新 → 配合 alpha 验收记录回填（验收本身由 sonnet 操作 + 铲屎官体感，见分工表）。

**Files:**
- Create: `packages/web/src/components/settings/ConciergeContent.tsx`（5+1 配置位：enabled/skin(锁定单选)/displayName/personaTone/dutyCatProfileId(下拉=roster 已配置猫)/proactivePolicy + muted；参照现有 settings section + `ops-nav-config.ts` 注册模式）
- Modify: settings nav 注册（实现时按 ops-nav-config 同模式找到注册点）
- Test: 组件测试（配置读写 round-trip）

**Spike（time-boxed ≤1h，输出结论不输出代码）:** per-invocation MCP 工具硬裁剪可行性——providers 已用 per-process `--mcp-config`（ClaudeAgentService.ts:373-386），验证"concierge thread 的 invocation 换裁剪版 config 文件"在 claude/gemini 两条 adapter 上是否都可达。结论写进 F229 doc Key Decisions（可达→Phase D 直接用；不可达→Phase D 设计替代）。Phase A 安全模型不依赖它（软白名单 + 全部 mutation 走确认卡已完备）。

**收尾:** AC-A1~A6 证据采集（截图/录屏 + 非作者验收 3 问/3 query 留给 reviewer/守护环节）→ merge-gate Step 7.5 同步 feat doc。

---

## 给实现猫的注意事项（按家规）

1. **每个 PR 独立走完整链**：worktree(6398) → tdd → quality-gate → request-review（reviewer 见 feat doc 分工表）→ merge-gate。PR 顺序 A1→A2→A3→A4，A2 依赖 A1 的 types/routes。
2. SystemPromptBuilder 守护测试（改即跑）；shared 改后 `pnpm --filter @cat-cafe/shared build`；LSP 诊断每 Edit 必看；store 测试 Redis-backed。
3. **z-index/层级**：与 F226 FloatingPresentationSurfaceHost、Modal/Lightbox 用统一 token，别新造数字。
4. 文案默认值（displayName='猫猫球'）是占位——本家投票（KD-6）后只改配置不改代码。
5. 技术 OQ 自决（动画实现/组件复用选型/badge 计数源）；价值 OQ 无（Design Gate 已全关栓，见 feat doc OQ 表）。
6. 真相源：`docs/features/F229-cat-ball-concierge.md` + `docs/discussions/2026-06-09-f229-design/README.md`（四态 wireframe + Duty Toolset + 调研红线）。动手前通读这两份。
