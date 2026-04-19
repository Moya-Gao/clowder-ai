---
doc_kind: mailbox
created: 2026-04-19
---

# Review Request: F146 Phase D — L1/L2/L3 联动体验

Review-Target-ID: f146
Branch: feat/f146-phase-d

## What

Phase D 为能力中心和 Skills 页添加三个联动功能：

1. **AC-D1**: Skills 页 missing MCP 依赖旁显示"补齐"按钮，点击展开 McpInstallForm（预填 MCP ID）
2. **AC-D2**: 能力中心新增 L1/L2/L3 层级过滤 FilterChips（L1=MCP, L2=Skill, L3=扩展）
3. **AC-D3**: 能力卡片显示来源生态 badge（Claude/Codex/OpenClaw/Antigravity），ecosystem 从安装时写入、board API 透传

变更范围：shared types → API board builder + install path → web components（3 层贯穿）。

## Why

铲屎官明确要求"L1、L2、L3 都得做"且要多生态追踪。Phase D 是 F146 最后一个 Phase，补齐 L1/L2/L3 联动体验后 F146 全部 AC 完成。

## Original Requirements（必填）

> "Connectors 比如 Figma 那种 app connector 也要。L1、L2、L3 都得做。"
>
> "我想问你，我们搞设计有什么 MCP？到时候你就可以直接去 Claude 官方的 Hub 市场、Codex 官方的市场、OpenClaw 的市场，一搜……"

- 来源：`docs/features/F146-mcp-marketplace-control-plane.md` 铲屎官愿景段落
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- 补齐按钮直接复用 McpInstallForm 而非新建专用安装流程——简单但安装体验略粗糙（reviewer 请判断是否足够）
- Layer 标签在 API 端硬推导（mcp→L1, cat-cafe skill→L2, external→L3），不持久化——后续如需自定义 layer 需改

## Open Questions

1. 补齐按钮的 UX 是否足够直观？当前实现是 inline underline button + 展开 McpInstallForm
2. Ecosystem badge 颜色方案复用 Phase B 的 marketplace-badges.tsx，是否需要调整

## Next Action

请 reviewer：
1. 代码审查（类型安全、边界处理）
2. 在 review 沙盒中浏览器实测三个功能点（dev server 有 xterm CSS 问题，需确认 Hub 是否可用）
3. 愿景对照：交付物是否满足铲屎官的 L1/L2/L3 分层 + 多生态追踪需求

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/f146/codex`
- Start Command: `pnpm review:start`
- Ports: `web=3201`, `api=3202`

## 自检证据

### Spec 合规

Quality Gate Report 2026-04-19 15:17：
- AC-D1 ✅ Skills 页 missing MCP 补齐 → HubSkillsTab.tsx + McpInstallForm.tsx
- AC-D2 ✅ 能力中心 L1/L2/L3 过滤 → HubCapabilityTab.tsx + capabilities.ts
- AC-D3 ✅ 生态追踪 badge → capability-board-ui.tsx + capability-install.ts

### 测试结果

```
pnpm test → 8665 pass, 0 fail, 1 skipped ✅
pnpm check → 0 errors ✅ (biome format + lint + features + guides)
pnpm -r --if-present run build → exit 0 ✅
pnpm lint → pre-existing failure on main (hardcoded color warnings), no new errors ✅
```

### 浏览器实测

⚠️ worktree dev server 有 pre-existing xterm CSS 解析问题导致 Hub 页面白屏。Phase D 改动均使用已有 UI 组件（FilterChips, EcosystemBadge, inline button），6 个 Vitest 前端测试覆盖渲染正确性。请 reviewer 在沙盒中验证。

### 根目录工件闸门

```
git status --short | rg ... → 无 ✅
git diff --name-only origin/main...HEAD | rg ... → 无 ✅
```

### 相关文档

- Feature: `docs/features/F146-mcp-marketplace-control-plane.md`
- Plan: `docs/plans/2026-04-19-f146-phase-d-l1l2l3-linkage.md`
