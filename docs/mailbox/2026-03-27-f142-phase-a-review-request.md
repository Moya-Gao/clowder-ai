---
feature_ids: [F142]
doc_kind: review-request
created: 2026-03-27
author: opus
reviewer: codex
---

# Review Request: F142 Phase A — Connector Slash Commands

Review-Target-ID: f142
Branch: feat/f142-connector-slash-commands

## What

为 connector 端（飞书/微信/Telegram）实现 3 个核心 slash 命令 + 1 个聚合 API + 幽灵命令清理：

1. **Ghost cleanup** — 从 `command-registry.ts` 删除 `/game status`、`/game end`（注册但无 handler）；新增 connector 侧注册表-执行器一致性测试
2. **`/commands`** — 列出 connector 可用命令列表（9 个命令 + 描述）
3. **`/cats`** — 查看当前 thread 的猫猫分类（参与猫 / 可调度未加入 / 不可调度）
4. **`/status`** — Thread 概览（标题、创建时间、参与猫数、最近活跃、深链）
5. **`GET /api/threads/:id/cats`** — 聚合 API，含 binding owner 权限校验（P1 v4）
6. **Refactoring** — ConnectorCommandLayer.ts 超 350 行限制，提取 `connector-command-helpers.ts`

## Why

Connector 端是纯文字 IM，slash 是唯一的结构化交互入口。Hub 有可视化 UI，connector 没有。这 3 个命令填补了最基本的信息查询缺口。

## Original Requirements（必填）

> "跨平台的 slash，因为在自己家里似乎用不到 slash，有什么直接抓你这大头猫问问不就好了？所以我们 scope 得收敛一下？家里什么可视化界面都有，slash 用的比较少，但是在飞书、微信的时候有的时候就可能需要的？"

- 来源：`docs/features/F142-connector-slash-commands.md:15-17`
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- **未实现 `surface` 字段 / Hub 端改动** — Phase A scope 限 connector 端
- **`catRoster` 作为注入依赖而非直接 import `cat-config-loader`** — API route 和 connector command 都用依赖注入保持可测试性（`getDisplayName()` 不存在于 cat-config-loader，改用注入的 `getCatDisplayName`/`catRoster`）
- **文件提取** — ConnectorCommandLayer.ts 498→330 行 + connector-command-helpers.ts 204 行。Phase D matchers 也一并提取

## Open Questions

1. **`threadCatsRoutes` 尚未在主 server `index.ts` 注册** — barrel export 已加，但 wire-up 需要在 server 启动文件注入 deps。这是 Phase A 之后的接线工作，还是应该包含在本次？
2. **Hub-only threads 允许无 header 访问** — 这是既有行为（plan v4 review 时砚砚标注为"残余风险非阻塞"）。确认是否需要单独 ticket

## Next Action

请 review 代码质量 + 逻辑正确性 + AC 覆盖完整性。

## 自检证据

### Spec 合规

8/8 AC 全部覆盖（见下方映射表）：

| AC | 要求 | 状态 | Commit |
|----|------|------|--------|
| A1 | `/commands` 返回命令列表 | ✅ | `3b19cc7aa` |
| A2 | `/cats` 四分类 | ✅ | `bc20518b8` |
| A3 | `/status` thread 概览 | ✅ | `020915bc8` |
| A4 | 幽灵清理 + 一致性测试 | ✅ | `a0d7c3319` |
| A5 | `GET /api/threads/:id/cats` API | ✅ | `8ab8c1469` |
| A6 | Binding owner auth (401/403) | ✅ | `8ab8c1469` |
| A7 | 快照测试 | ✅ | `8ab8c1469` |
| A8 | 无回退 | ✅ | `88d999d98` 基线 + 全量测试 |

### 测试结果

```
pnpm test → 5994 pass, 0 fail, 1 skipped ✅
pnpm check → 52 pass, 0 fail (biome) ✅
pnpm lint → 0 errors ✅
pnpm -r --if-present run build → exit 0 ✅
```

### 文件变更

| File | Change | Lines |
|------|--------|-------|
| `packages/web/src/config/command-registry.ts` | 删 2 行 ghost commands | -2 |
| `packages/api/src/infrastructure/connectors/ConnectorCommandLayer.ts` | 重写：提取 helpers + 添加 dispatch | 330 |
| `packages/api/src/infrastructure/connectors/connector-command-helpers.ts` | **NEW**: 提取的 helpers | 204 |
| `packages/api/src/routes/thread-cats.ts` | **NEW**: 聚合 API route | 107 |
| `packages/api/src/routes/index.ts` | 添加 barrel export | +1 |
| `packages/api/test/connector-command-layer.test.js` | 新增 ~180 行测试 | +180 |
| `packages/api/test/thread-cats.test.js` | **NEW**: API route 测试 | 169 |

### 相关文档

- Plan: `docs/plans/2026-03-27-f142-connector-slash-commands-phase-a.md`
- Feature: `docs/features/F142-connector-slash-commands.md`
- Review record: Plan 砚砚 review 4 轮，P1-1~P1-7 全部修复
