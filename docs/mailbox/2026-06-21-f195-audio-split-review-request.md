---
feature_ids: [F195]
topics: [mcp-server, audio, split-entry, review]
doc_kind: mailbox
created: 2026-06-21
---

# Review Request: feat(mcp-server): add audio.ts split entry for F195

Review-Target-ID: f195-audio-split
Branch: feat/f195-audio-split-entry

## What

Added `packages/mcp-server/src/audio.ts` — a split MCP server entry for audio tools (`cat_cafe_audio_*`). Follows the exact pattern of `finance.ts` / `limb.ts`.

## Why

Audio tools were only registered in the all-in-one `registerFullToolset()` (via `index.ts`) but had no independent split entry file. Codex and other clients using the split MCP topology (`.codex/config.toml`) couldn't discover audio tools. This was found during F195 dogfood (G7 video session) — both codex and gpt52 failed to ToolSearch `cat_cafe_audio_*`.

## Original Requirements（必填）

> F195 dogfood（G7 视频实测）中发现 codex 和 gpt52 都无法 ToolSearch 到 `cat_cafe_audio_*`。
> audio 没有独立入口文件——只在 all-in-one 的 registerFullToolset() 里注册。
> Codex 的 `.codex/config.toml` 只有分拆 server，没有 all-in-one，所以 audio 丢了。

- 来源：cross-thread message from F195 main thread (`thread_mqn89xsplr3a5w1y`)
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

No tradeoff — this is the only correct approach. All other toolsets already have split entries; audio was the sole gap.

## Architecture Ownership（必填）

Architecture cell: mcp-server/split-topology
Map delta: none
Why: Adding a new split entry following the established pattern. No new architectural cell; no boundary change.

请 reviewer 检查：
- diff 是否与 `Map delta` 一致
- 是否新建了并行 `Store` / `Queue` / `Router` / `Adapter` / `Dispatcher` / `Binding`
- 若修改 `docs/architecture/ownership/cells/*.md`，是否确实改变了 owner / boundary / extension point / canonical anchor

## Open Questions

### 技术 OQ（给 reviewer）

1. `audio.ts` 是 `finance.ts` 的 1:1 copy with s/finance/audio/g. Reviewer 请验证有没有漏改的地方。

### 价值 OQ（给 CVO，如有）

无

## Next Action

请 reviewer 审查 PR #2478 并放行。

## Review Sandbox（必填）

- 无需启动服务 — 纯 TypeScript 编译产物，不涉及运行时行为变化
- 验证方式：`pnpm --filter @cat-cafe/mcp-server build && ls dist/audio.js`

## 自检证据

### Spec 合规

- [x] 新文件 `audio.ts` 遵循 `finance.ts` 模式（同 imports/structure/shebang/error handling）
- [x] 覆盖审计：`union(split entries) ⊇ registerFullToolset()` — 6/6 全覆盖
- [x] 无新建并行架构组件

### 测试结果

```
pnpm --filter @cat-cafe/mcp-server build  # 成功，dist/audio.js 产生
pnpm --filter @cat-cafe/mcp-server lint   # tsc --noEmit 通过
pnpm check                                # 全绿
```

### 相关文档

- Feature: F195 (Meeting Copilot)
- Related: F043 (MCP 归一化), F193 (Split-only 配置)

[宪宪/claude-opus-4-6🐾]
