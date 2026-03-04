# Review Request: F050 Phase 1 — DARE L1 CLI 接入

## What

Cat Café 新增 DARE（Deterministic Agent Runtime Engine）作为第四个 agent provider。通过 CLI adapter 模式（`python -m client --headless`），Cat Café 可以驱动 DARE agent 完成单轮任务，接收 NDJSON 事件流并映射为标准 `AgentMessage`。

**核心变更**（15 files, +1845 lines）：

1. **类型扩展**: `CatProvider` 从 `'anthropic' | 'openai' | 'google'` → 加 `'dare'`
2. **事件映射**: `dare-event-transform.ts` — DARE headless envelope → AgentMessage（126 行，15 tests）
3. **CLI Adapter**: `DareAgentService.ts` — 复用 `spawnCli` 驱动 DARE 子进程（128 行，11 tests）
4. **注册入口**: `index.ts` switch + `cat-config.json` DARE breed/roster
5. **Smoke test**: 真实调用 DARE CLI（OpenRouter + qwen/qwen3-coder:free）

## Why

铲屎官要把 DARE 接入 Cat Café，验证外部 agent 能否像内部三猫一样被统一管理。F050 是"外部 Agent 接入契约"的第一步——用最简单的 CLI adapter 跑通端到端。

## Original Requirements（必填）

> 铲屎官原话（thread 2026-03-04）：
> - "你应该立项我们自己的 cat cafe 里立项接入 dare"
> - "我们这两天要把 dare 尝试接入进来"
> - "你们要如何测试是否接入了 dare？能启动嘛？还是我在 zshrc 里面 export 一个 open router 的 aksk 你们使用 glm-4.7 去测试？"
> - "你最好先写好你的 f50 完整的 feat 文档包括更新我刚刚说的东西"

- 来源：Thread `thread_mm4dj9jp0tij0ch3`，2026-03-04 对话
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

| 选项 | 选了？ | 原因 |
|------|--------|------|
| stdin pipe（`--control-stdin`）| 延期 Phase 1b | Phase 1 用 `--auto-approve --headless`，不需要运行期控制 |
| DARE 参与 @mention 路由 | 延期 Phase 2+ | Phase 1 只做单轮调用，不参与协作路由 |
| 直接调 DARE Python API | ❌ | CLI adapter 更通用，复用 spawnCli 基建，不依赖 Python runtime 细节 |

## Open Questions

1. **DARE 的 `task.completed` 事件映射成 `text`（非 `done`）** — 因为 `rendered_output` 是 agent 的最终答案，不是会话结束信号。`done` 由 DareAgentService 在流结束后统一 yield。Reviewer 请确认这个语义映射是否合理。
2. **`model.response` 事件被丢弃** — DARE 的 `model.response` 只含 `iteration`/`has_tool_calls` 元数据，没有文本内容。我们选择跳过。合理吗？
3. **System prompt size guard 从 2000→2200** — DARE breed 加入 roster 后 prompt 变长。这个阈值调整是否合适？

## Next Action

请 @codex review 代码质量 + 架构合理性。重点关注：
- `dare-event-transform.ts` 的事件映射是否完整/正确
- `DareAgentService.ts` 的错误处理是否健壮
- cat-config 中 DARE breed 的配置是否合理

## 自检证据

### Spec 合规

Quality Gate 通过（本轮输出）：
- Phase 1 AC: 6/6 checked（stdin pipe 已拆为 Phase 1b）
- 愿景覆盖：DARE 扩展 agent 入口，不破坏三猫内部协作

### 测试结果

```
node --test test/dare-*.test.js test/system-prompt-builder.test.js test/cat-config-loader.test.js
→ 141 tests, 0 fail ✅

pnpm lint (tsc --noEmit)
→ 0 errors ✅

pnpm -r --if-present run build
→ shared ✅ → mcp-server ✅ → api ✅ → web ✅

pnpm biome check (DARE files only)
→ 0 errors, 1 warning (cognitive complexity, same as ClaudeAgentService)
```

### 相关文档

- Feature: `docs/features/F050-a2a-external-agent-onboarding.md`
- Plan: `docs/plans/2026-03-04-f050-dare-l1-cli-integration.md`
- BACKLOG: F050 status `in-progress`

### Commits（10 on `feat/f050-dare-l1`）

| # | Hash | Message |
|---|------|---------|
| 1 | `9d52bf65` | docs(F050): Phase 1 kickoff |
| 2 | `5e1a3f6f` | docs(F050): Phase 1 implementation plan |
| 3 | `e323edda` | feat(F050): extend CatProvider type |
| 4 | `fdcfde1c` | feat(F050): accept 'dare' provider in zod schema |
| 5 | `5ace55ba` | feat(F050): DARE headless event transformer (15 tests) |
| 6 | `89904604` | feat(F050): DareAgentService (11 tests) |
| 7 | `21becc86` | feat(F050): register DARE provider + cat-config |
| 8 | `4585d521` | fix(F050): biome format + size guard |
| 9 | `487a8527` | test(F050): DARE smoke test |
| 10 | `4900356e` | docs(F050): update AC |
