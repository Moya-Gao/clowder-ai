# Review Request: F127 structured provider-aware cli.effort editor

Review-Target-ID: f127
Branch: feat/f127-effort-editor

## What

这轮把 F127 的 `cli.effort` 缺口补成完整链路，不再靠手写 raw `cliConfigArgs` 传 effort：

- Hub 编辑器新增结构化 `CLI Effort` 字段
- Claude 只给 `low / medium / high / max`
- Codex 只给 `low / medium / high / xhigh`
- `/api/cats` 接受并校验 `cli.effort`
- runtime catalog 持久化 `variant.cli.effort`
- 新 invocation 通过 `getCatEffort()` 自动吃到新值；旧 session 不强切

核心改动集中在：

| File | Change |
|------|--------|
| `packages/shared/src/cli-effort.ts` | 新增 provider-aware effort matrix / default / validation |
| `packages/api/src/routes/cats.ts` | create/update schema 接受 `cli.effort`，并拒绝非法 provider/effort 组合 |
| `packages/api/src/config/cat-config-loader.ts` | `toAllCatConfigs()` 投影 `cli`；`getCatEffort()` 用 provider-aware fallback |
| `packages/api/src/domains/cats/services/agents/providers/CodexAgentService.ts` | Codex invocation 显式以 `openai` fallback 读取 effort |
| `packages/api/src/domains/cats/services/agents/providers/ClaudeAgentService.ts` | Claude invocation 显式以 `anthropic` fallback 读取 effort |
| `packages/web/src/components/hub-cat-editor-advanced.tsx` | 编辑器新增结构化 `CLI Effort` select |
| `packages/web/src/components/hub-cat-editor.payload.ts` | payload 发送 `cli.effort`，与 raw `cliConfigArgs` 解耦 |
| `packages/web/src/components/hub-cat-editor.model.ts` | 前端 option matrix + form state round-trip |
| `docs/features/F127-cat-instance-management.md` | 新增 R-11 gap 归属与开源 issue 链接 |

## Why

F127 之前只把成员 profile 编辑面做到“能改 raw CLI args”，但 Claude/Codex 的合法 effort 集不一样：

- Claude CLI 认 `max`
- Codex CLI 不认 `max`，只认 `xhigh`

继续让铲屎官手写 raw 参数，会把 provider 约束外泄给 UI，既易错，也不可验证。这个缺口本质上是 F127 的成员编辑面还没做完；F136 只提供“保存后新 invocation 读取新配置”的热更新底座。

开源跟踪 issue 已补：`clowder-ai#315`

## Original Requirements（必填）
> [19:00 铲屎官] 是的 这个是一个f127的 遗留 你赶紧搞起来！ issue可以提写清楚是f127 然后你想想看要实现什么
> Claude: low / medium / high / max
> Codex: low / medium / high / xhigh
> Hub 结构化编辑，不再靠手写 raw args；保存后持久化到 runtime catalog
> 对新 invocation 生效；旧 session 不强切
- 来源：当前 thread，消息 `0001774922451101-000033-397e7954`
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- 我把 provider-aware 运行时真相源放在 shared（`cli-effort.ts`），但前端 option helper 仍保留了一份本地轻量实现，没有直接从 shared root export 复用。
- 原因不是偷懒，而是 web/vitest 当前通过 workspace 包入口消费 built shared 产物；直接切到新 shared root export 会让 Hub 在未先 rebuild shared 的情况下读到 `undefined`，把本地开发顺序耦死。
- 后端 runtime / API 的唯一真相源仍是 shared；前端只是渲染层的稳定镜像。

## Open Questions

1. 请重点看 `packages/api/src/routes/cats.ts` 的 merge 语义：client 切换时 `cli` 是否只保留当前 provider 合法字段，没有留下旧 provider 的脏值。
2. 请重点看 `packages/api/src/config/cat-config-loader.ts`：`toAllCatConfigs()` 新投影 `cli` 后，会不会影响别的依赖 `CatConfig` 的读取路径。
3. 前端目前保留 raw `cliConfigArgs` 作为 escape hatch，但文案已改成“effort 优先走结构化字段”；这个边界你是否认同。

## Next Action

请 review 这条 F127 实现，重点看：

- API schema / 持久化 / fallback 是否真正封死了 `Codex + max` 这类非法组合
- Hub 结构化字段是否满足铲屎官要求，且没有把旧 raw args 路径改坏
- F127 spec 里 R-11 的归属与 scope 是否写清楚

## 自检证据

### Spec 合规

- Claude / Codex 的 option matrix 已按 provider 分开 ✅
- Hub 结构化编辑已落地，不再需要用 raw args 传 effort ✅
- 保存后持久化到 `.cat-cafe/cat-catalog.json` 的 `variant.cli.effort` ✅
- 新 invocation 通过 `getCatEffort()` 读取新值；旧 session 不强切 ✅
- 非法 provider/effort 组合在 API 层直接拒绝 ✅
- F127 residual 与开源 issue 追踪已补齐 ✅

### 测试结果

```bash
pnpm --filter @cat-cafe/web exec vitest run src/components/__tests__/hub-cat-editor.test.tsx
# 33 passed, 0 failed

pnpm --filter @cat-cafe/api exec sh -lc 'pnpm run build >/tmp/f127-effort-api-build.log && CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 node --test test/cats-routes-runtime-crud.test.js test/codex-agent-service.test.js'
# 65 passed, 0 failed

pnpm --filter @cat-cafe/web build
# success
```

### 浏览器实测

- 本地起了隔离服务：web `3101` / api `3102` / preview gateway `4111`
- 实测 `gpt52`（Codex）编辑器显示 `默认 / low / medium / high / xhigh`
- 实测 `opus`（Claude）编辑器显示 `默认 / low / medium / high / max`
- 在 Hub 中把 `gpt52` 的 `CLI Effort` 改为 `high` 并保存后，`GET /api/cats` 回显 `cli.effort=high`
- 再改回 `xhigh` 并保存后，`GET /api/cats` 与 `.cat-cafe/cat-catalog.json` 都回到 `xhigh`
- 截图证据：`/Users/lysander/projects/relay-station/cat-cafe/f127-cli-effort-editor-advanced.png`

### 相关文档

- Plan: `docs/plans/2026-03-30-f127-structured-effort-editor.md`
- Feature: `docs/features/F127-cat-instance-management.md`
- Upstream issue: `https://github.com/zts212653/clowder-ai/issues/315`
