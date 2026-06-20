---
type: review-request
feature: f244
---

# Review Request: F244 tip strip IS the thinking bubble — unified with breathing glow

Review-Target-ID: f244
Branch: feat/f244-tip-as-thinking-bubble
HEAD: 74bf0e01e

## What

CVO dogfood Round 4 反馈：tip strip 和 bouncing dots 是两个割裂的元素。本次改动将 tip strip 统一为 thinking indicator 本身——一个带呼吸光晕动画的气泡，不再有独立的 bouncing dots。

核心变更：
- `PendingMemberBubble`：tip 启用时渲染 `CapabilityTipStrip`（`firstDelayMs=0` 立即显示），不渲染 dots；提取 `PendingDots` 组件作为 dedup/stall fallback
- `CapabilityTipStrip`：容器始终渲染（`enabled=true` 时），tip 内容加载前显示 shimmer placeholder；提取 `TipContent` 子组件保持类型安全
- `globals.css`：新增 `tip-thinking-glow` 呼吸光晕动画（3s 周期，紫色 box-shadow 脉冲），`prefers-reduced-motion` 禁用
- 6 个测试更新覆盖：tip 立即渲染、无 dots、stall 降级、dedup 降级、动画 class

## Why

CVO 在 4 轮 dogfood 中反复指出"dots 和 tip strip 割裂"的体验问题。第 4 轮明确画了低保真线框确认：tip strip 就是思考气泡，内部有动态效果表达"猫在思考"，不要分开。

## Original Requirements（必填）
> "这个tips就当成一个气泡那样的？然后 tips的气泡里边儿 有动态效果 像是你们在思考 或者如何表现 不是这两部分割裂"
> "对的！！ 是这样的！"（确认低保真线框）
> "不用喊我～ 和你的缅因猫好兄弟完成这次sop"
- 来源：当前 session dogfood 对话（F244 Phase B Round 4）
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- 放弃了"dots + tip strip 并排"方案——CVO 明确否决，认为割裂
- 放弃了 tip strip 内部放 dots 动画——改用 CSS breathing glow（更优雅，不占内容空间）
- Shimmer placeholder 在 `firstDelayMs=0` 时一闪而过——可接受，实际用户几乎感知不到

## Architecture Ownership（必填）

Architecture cell: hub-action-surface
Map delta: none
Why: 改动在现有 F244 capability tips 架构内，仅调整 UI 呈现层（PendingMemberBubble → CapabilityTipStrip 的组合方式），不新增 Store/Queue/Router/Adapter

请 reviewer 检查：
- diff 是否与 `Map delta` 一致
- 是否新建了并行 `Store` / `Queue` / `Router` / `Adapter` / `Dispatcher` / `Binding`
- 若修改 `docs/architecture/ownership/cells/*.md`，是否确实改变了 owner / boundary / extension point / canonical anchor

## Open Questions

### 技术 OQ（给 reviewer）
1. `CapabilityTipStrip` 的 `contentReady` state 重命名（从 `visible`）——请确认所有引用已正确更新
2. `TipContent` 子组件提取是否合理（为了 TypeScript type narrowing: tip 在 TipContent 内保证 non-null）
3. Stall 降级逻辑（`isStreamingTipSuppressedByStatus`）——tip 被 suppress 时 fallback 到 dots 是否正确

### 价值 OQ（给 CVO，如有）
无——CVO 已在 dogfood 中确认低保真设计，本轮是纯执行

## Next Action

请 review 代码变更，重点关注：
1. 统一 thinking indicator 的 UX 是否符合 CVO 原话描述
2. CSS 动画的可访问性（`prefers-reduced-motion`）
3. Dedup/stall fallback 路径是否完整

## Review Sandbox（必填）
- Path: `/tmp/cat-cafe-review/f244/gpt52`
- Start Command: `pnpm review:start`
- Ports: `web=3201`, `api=3202`（禁止 3001/3002/3011/3012/4111）

## 自检证据

### Spec 合规
- CVO 低保真线框确认 → 实现完全匹配
- AC-B2 stall suppression → 测试覆盖
- Dedup fallback → 测试覆盖
- `prefers-reduced-motion` → CSS 实现

### 测试结果
```
pnpm test  # 4386 passed, 0 failed (全量)
pnpm biome check  # 0 errors
```

### Root Artifact Guard
```
git status --short | rg root artifacts → ✅ clean
git diff --name-only origin/main...HEAD | rg root artifacts → ✅ clean
```

### 相关文档
- Feature: `docs/features/F244-capability-tips-system.md`
- 无新 ADR（现有架构内调整）

[宪宪/claude-opus-4-6🐾]
