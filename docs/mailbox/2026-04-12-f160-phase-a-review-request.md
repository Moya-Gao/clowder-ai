# Review Request: F160 Phase A — Protocol Closure (毛线球 MCP)

Review-Target-ID: f160-phase-a
Branch: feat/f160-phase-a

## What

补齐毛线球（Thread Task Board）的 MCP 协议层，让猫猫能发现和创建持久化任务：

1. **新增 `POST /api/callbacks/create-task`** — 回调路由，kind 强制 `work`（KD-4），广播 `task_created`
2. **注册 `cat_cafe_create_task` MCP tool** — schema: title(必填)/why(选填)/ownerCatId(选填)
3. **SystemPromptBuilder 更新** — MCP 工具列表加入 create_task/list_tasks/update_task + 毛线球使用指南

5 files changed, 213 insertions(+), 8 deletions(-)

## Why

毛线球自上线**从未被任何猫使用过**。三猫头脑风暴诊断四个根因：协议缺失、创建入口缺失、展示边界模糊、UI 存在感为零。Phase A 解决前两个（协议+创建），ROI 最高。

## Original Requirements（必填）

> "为什么毛线球长期任务从来没有被任何猫用过？是因为这个能力猫猫不知道？"
> "为什么一个东西有两个展示的地方？"
- 来源：2026-04-11 thread 讨论（thread_mnhd0mogj78h14vl），铲屎官原话
- Feature spec: `docs/features/F160-task-board-upgrade.md`
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- `create_task` 不接受 `kind` 参数（强制 `work`）— 防止 MCP 创建 pr_tracking 任务（PR #958 教训）
- SystemPromptBuilder size guards 上调 300 chars — 为毛线球指南腾空间，token 成本可接受

## Open Questions

1. **ownerCatId 校验**: 路由用 `catRegistry.has()` 校验，测试里需要先注册猫到 catRegistry。这个模式和 list-tasks 一致，但请确认是否有更好的方式
2. **毛线球指南文案**: SystemPromptBuilder 里的使用场景描述是否清晰？有没有遗漏的场景？

## Next Action

请 review 代码质量 + 协议设计合理性。Phase A 纯后端，无前端改动。

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/f160-phase-a/codex`
- Start Command: `pnpm review:start`
- Ports: 纯后端 review，跑测试即可：`node --test packages/api/test/integration/task-callback.test.js`

## 自检证据

### Spec 合规

| AC | 状态 | 验证 |
|----|------|------|
| AC-A1: create_task MCP tool, kind=work | Pass | 5 integration tests |
| AC-A2: SystemPromptBuilder 毛线球描述 | Pass | F160 guardian test |
| AC-A3: list_tasks 支持 threadId+kind | Pass | Already existed (verified) |
| AC-A4: PR tracking 回归守护 | Pass | "enforces kind=work" test + client-side filters |

### 测试结果

```
node --test task-callback.test.js + system-prompt-builder.test.js
  → 87/87 pass, 0 failed
pnpm check  → exit 0, 0 errors (biome)
pnpm lint   → exit 0, 0 errors (warnings are pre-existing)
pnpm build (api + mcp-server) → exit 0
```

### 相关文档

- Feature: `docs/features/F160-task-board-upgrade.md`
- Plan: `docs/plans/2026-04-12-f160-phase-a-protocol-closure.md`
- Discussion: thread_mnhd0mogj78h14vl (三猫头脑风暴)
