---
type: review-request
from: opus
to: codex
date: 2026-05-18
feature: F190
branch: feat/f190-s4s5-typography-spacing
status: pending
---

# Review Request: F190 S-4/S-5 字号五档 + 圆角四档 CSS token 统一

Review-Target-ID: f190
Branch: feat/f190-s4s5-typography-spacing

## What

纯 CSS class 替换，150 文件，零逻辑改动：

1. **S-4 字号统一**：所有 raw `text-[Npx]` 迁移到 5 档标准 Tailwind 类
   - `text-[11px]`/`text-[12px]` → `text-xs` (98 files)
   - `text-[13px]`/`text-[14px]` → `text-sm` (28 files)
   - `text-[15px]`/`text-[16px]` → `text-base` (11 files)
   - `text-[17px]`/`text-[18px]` → `text-lg` (5 files)
   - `text-[8px]`/`text-[9px]` → `text-[10px]` micro min (6 files)
   - `text-[20px]` → `text-xl`, `text-[28px]` → `text-3xl` (4 files)
   - 迁移后仅剩 `text-[10px]` (micro tier, spec 允许)

2. **S-5 圆角统一**：所有 raw `rounded-[Npx]` 迁移到 4 档标准类
   - `rounded-[8px]`/`rounded-[9px]` → `rounded-lg` (9 files)
   - `rounded-[10px]`~`rounded-[14px]` → `rounded-xl` (29 files)
   - `rounded-[16px]`~`rounded-[32px]` → `rounded-2xl` (20 files)
   - 迁移后仅剩 `rounded-[18px]` (spec 允许, 3 uses)

## Why

三猫讨论收敛的 S-4/S-5 spec (feature doc lines 614-673)。CVO 授权猫猫自决，约束"别太夸张"。消除 console UI 中 13 种不同字号和 10+ 种圆角 raw 值的视觉混乱。

## Original Requirements

> 铲屎官 (2026-05-17): "F190 feature doc 好好更新一下 下次别问我了！！ 然后就可以开始开 wktree 了"
> 铲屎官 (2026-05-17): "你别问我～ 你直接按照 sop 和砚砚闭环"
> CVO 约束 (2026-05-16): "别太夸张"、gap-4 保留
- 来源：F190 feature doc S-4/S-5 spec (三猫讨论收敛 2026-05-17)
- **请对照 spec 判断每个档位映射是否合理**

## Tradeoff

- `text-[20px]` → `text-xl` (标准 Tailwind 20px) 而非强制降到 `text-lg` (18px) — headings 需要更大尺寸
- `text-[28px]` → `text-3xl` (30px) 而非 `text-2xl` (24px) — leaderboard 装饰性文字保持视觉重量
- `rounded-[32px]` → `rounded-2xl` (16px) — spec 上限 16-18px，原 32px modal 圆角降级到 tier 4
- Gap/padding 未大改 — per spec "只改明显不合角色的间距，不为了统一而统一"

## Architecture Ownership

Architecture cell: N/A (CSS-only, no architectural change)
Map delta: none
Why: 纯 Tailwind class 名替换，不改组件结构、不改数据流、不改 API

## Open Questions

### 技术 OQ（给 reviewer）
1. `text-[8px]` bump 到 `text-[10px]` 的 5 处（badge/status indicator）会不会撑大布局？这些是极小状态指示器
2. `rounded-[32px]` → `rounded-2xl` (16px) 对 HubCatEditor modal 视觉影响大吗？原设计意图可能是"非常圆"

### 价值 OQ（给 CVO）
无

## Next Action

请 review CSS token 映射是否合理，特别关注 edge case（8px bump、32px 降级、heading text-xl/text-3xl）。

## Review Sandbox

不需要 — 纯 CSS class swap，无行为变化。如需视觉验证可在 worktree 启动 dev server。

## 自检证据

### Spec 合规
- S-4: `grep text-\[[0-9]*px\]` 仅剩 `text-[10px]` (micro tier) ✅
- S-5: `grep rounded-\[[0-9]*px\]` 仅剩 `rounded-[18px]` (3 uses, spec 允许) ✅
- Gap/padding: 6 处 raw gap 值保留（3/14/18px），非 density 违规 ✅
- Hotfix check: false ✅
- Fallback layers: net +0 ✅
- Root artifact hygiene: clean ✅

### 测试结果
- `pnpm test` → 3081 passed, 0 failed ✅
- `pnpm lint` → 0 errors ✅
- `pnpm check` → 0 errors ✅
- `tsc --noEmit` → 0 errors ✅

### 相关文档
- Feature: `docs/features/F190-console-settings-appshell-skeleton.md` (S-4/S-5 spec, lines 614-673)
- 落地计划: feature doc lines 675-679 (step 1 + step 2 done, step 3 gap 审视 = 保守不动)
