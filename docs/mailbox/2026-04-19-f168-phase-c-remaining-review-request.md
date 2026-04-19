# Review Request: F168 Phase C 剩余 — repo 下拉 + 时间范围筛选 + Pencil 设计稿

Review-Target-ID: f168-phase-c-remaining
Branch: feat/f168-phase-c-remaining

## What

完成 F168 Community Operations Board Phase C 剩余两项：

1. **AC-C7 完整筛选**：repo 从文本输入改为下拉选择（从 `/api/community-repos` 动态获取）+ 时间范围筛选（7d/30d/90d）
2. **AC-C10 Pencil 设计稿**：用 Cat Cafe 暖色设计系统重建完整 CommunityPanel 设计（cream `#FAFAF8`、Outfit/Inter 字体、340px 侧栏）

关键改动：
- 新增 `GET /api/community-repos` 端点（返回去重排序的仓库列表）
- 提取 `CommunityPanelFilters` 组件（CommunityPanel 从 346 行降到 324 行）
- 新增 `TIME_RANGES` 常量 + 客户端时间范围过滤逻辑
- Pencil 设计稿：`designs/F168-community-ops-board.pen`

## Why

Phase C 的 AC-C1~C9 已在上一轮 PR #1276 合入。本轮完成最后两项 AC-C7（完整筛选）和 AC-C10（设计稿），使 Phase C 100% 完成。

## Original Requirements（必填）

> "社区管理看板虽然比如说多久更新一次状态，但是必须有一个按钮手动同步状态"
> "不应该和失败的 mission hub 那样放在独立的页面。应该和成功的 workspace 里面的开发、记忆、调度、任务那些 tab 一样挂在右边"
> "未来这个 feat 最后一个阶段就是要允许社区其他小伙伴用你们这套管理他们自己的社区！你们在架构设计上必须是解耦的！"
> "别用 emoji 用 SVG"

- 来源：`docs/features/F168-community-ops-board.md`「铲屎官原话（需求讨论 2026-04-18）」
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- **组件提取 vs 行内**：为守 350 行限制，把筛选栏提取为独立 `CommunityPanelFilters.tsx`。代价是多一个文件，但职责清晰、可独立测试。
- **客户端时间过滤 vs 服务端**：时间范围在客户端过滤（`Date.now() - threshold`），避免增加 API 复杂度。数据量小（社区 issue 通常 <100 条），可接受。

## Open Questions

1. **Pencil 设计稿**：首次为 CommunityPanel 出设计稿，请 reviewer 对照实际 UI 判断风格一致性
2. **时间范围粒度**：目前提供 7d/30d/90d 三档，是否需要增加"24h"或自定义范围？
3. **repo 下拉初始值**：默认 hardcode `zts212653/clowder-ai`，后续可从用户偏好读取

## Next Action

请 reviewer clone branch 并检查：
- AC-C7 筛选功能是否符合 spec 描述
- AC-C10 设计稿风格是否匹配 Cat Cafe 暖色系
- `CommunityPanelFilters` 提取是否合理
- 测试覆盖是否充分

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/f168-phase-c-remaining/{reviewer-handle}`
- Start Command: `pnpm review:start`
- Ports: web 随 review:start 分配（起点 3201/3202）

## 自检证据

### Spec 合规

| AC | 状态 | 验证 |
|----|------|------|
| AC-C7 | [x] | repo 下拉 + 状态/负责猫/时间范围四重筛选 |
| AC-C10 | [x] | Pencil 设计稿 `designs/F168-community-ops-board.pen` |

### 测试结果

```
pnpm --filter @cat-cafe/api test (community-issues)  → 13/13 pass, 0 failed
pnpm --filter @cat-cafe/web test                      → 2263 pass, 0 failed (324 files)
pnpm lint                                             → 0 errors
pnpm check                                            → 0 errors (biome format + lint)
pnpm -r --if-present run build                        → exit 0
```

### Artifact Hygiene

根目录媒体/设计工件（工作树 + 已提交差异）: 无

### 相关文档

- Feature: `docs/features/F168-community-ops-board.md`
- 前一轮 review: `docs/mailbox/2026-04-19-f168-phase-c-interactive-review-request.md`

---
[宪宪/Opus-46]
