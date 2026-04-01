---
doc_kind: review-request
feature_ids: [F102]
created: 2026-04-01
author: opus
reviewer: gpt52
---

# Review Request: F102 Phase F-1/F-2/F-3 — Multi-Project Memory Onboarding

Review-Target-ID: f102-phase-f123
Branch: feat/f102-phase-f123

## What

三个协同工具，让猫出征新项目或接手遗留项目时记忆系统自动适配：

1. **F-2: IndexBuilder recursive fallback** — `discoverFiles()` 在 13 个 KIND_DIRS 扫完后，递归扫 docsRoot 下剩余 `.md`（排除 node_modules/.git/archive/mailbox + 已扫 KIND_DIRS），避免重复索引
2. **F-1: project-init CLI** — `pnpm project:init <dir>` 创建标准 13 个 KIND_DIRS + BACKLOG.md/VISION.md 骨架，幂等安全
3. **F-3: frontmatter-formatter CLI** — 扫描 `.md`，推断 doc_kind/topics 并补全 frontmatter，支持 `--dry-run`/`--apply`

## Why

铲屎官问"猫出征到 dare/studio-flow 怎么办？记忆系统怎么办？"（KD-35/KD-36）。当前 IndexBuilder 只认 13 个标准目录，遗留项目散落的 `.md` 完全搜不到。Phase F 补齐这个短板。

## Original Requirements（必填）

> 铲屎官："猫出征到 dare/studio-flow 怎么办？记忆系统怎么办？"
> KD-35: 两种策略——新项目 project-init、遗留项目 recursive fallback
> KD-36: 遗留项目 frontmatter formatter 自动补全

- 来源：`docs/features/F102-memory-adapter-refactor.md` Phase F 设计段落（L449-490）
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- Recursive fallback 用 depth=10 硬上限 + FALLBACK_EXCLUDE 排除集，而非 glob pattern。理由：更可控、避免意外索引 node_modules 深层文件
- frontmatter-formatter 放在 `scripts/` 根目录（.mjs）而非 `packages/api/src/`。理由：它是独立 CLI 工具，不依赖 API 编译链
- mailbox/ 加入 FALLBACK_EXCLUDE。理由：review 请求是操作噪声不是知识，signal-noise-comparison 测试验证了这一点

## Open Questions

1. **FALLBACK_EXCLUDE 是否够完整？** 目前排除：node_modules/.git/archive/mailbox + 13 KIND_DIRS。reviewer 看看有没有遗漏
2. **frontmatter-formatter 的 inferDocKind** 用正则匹配标题关键词（decision/adr/lesson/pitfall/postmortem/research），覆盖度够吗？
3. **KIND_DIRS 从 private → export** — project-init 复用这个常量。是否有更好的共享方式？

## Next Action

请 @gpt52 review 代码质量、安全边界、测试覆盖。

## 自检证据

### Spec 合规

10/10 AC 全部覆盖（AC-F1-1 ~ AC-F3-4），见 quality-gate report。

### 测试结果

```
memory tests       → 199/199 pass, 0 fail ✅
formatter tests    → 13/13 pass, 0 fail ✅
pnpm lint          → 0 errors ✅ (web warnings are pre-existing color tokens)
pnpm check         → 0 errors ✅
pnpm build         → exit 0 ✅
```

### 相关文档

- Feature: `docs/features/F102-memory-adapter-refactor.md`
- Plan: `docs/plans/2026-04-01-f102-phase-f123-multi-project-memory.md`

### Commits (5)

```
8519d2b83 fix(F102-F2): exclude mailbox/ from recursive fallback discovery
592169985 chore(F102-F123): biome format + script wiring + feature index
119648dc3 feat(F102-F3): frontmatter-formatter CLI — dry-run/apply modes
f4585759e feat(F102-F1): project-init CLI — scaffold standard docs structure
9e13469de feat(F102-F2): recursive fallback discovery for legacy project .md files
```
