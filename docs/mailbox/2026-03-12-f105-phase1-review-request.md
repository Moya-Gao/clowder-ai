# Review Request: F105 Phase 1 — opencode 金渐层 L1 CLI 接入

## What

为 Cat Cafe 新增第三条外部 agent 接入通道：opencode（金渐层）。复用 DARE L1 CLI Adapter 模式，通过 `opencode run --format json` 驱动 opencode agent，解析 NDJSON 事件流映射到 AgentMessage。

核心变更（4 commits on `feat/f105-opencode-l1`）：
1. `opencode-event-transform.ts` — step_start/text/tool_use/error → AgentMessage 纯函数映射
2. `CatProvider` 类型 + Zod enum 扩展 `'opencode'`
3. `OpenCodeAgentService.ts` — spawn opencode CLI, env-based auth（API key + baseURL via env vars）
4. `cat-config.json` — 金渐层 roster + breed `golden-chinchilla` + variant `opencode-default`
5. `index.ts` — AgentRouter switch case `'opencode'`

## Why

铲屎官要求接入 opencode（开源 AI coding agent），作为 F050 External Agent Onboarding 的衍生。opencode 支持 Anthropic 格式 API，通过 nuoda.vip proxy 可调用所有 Claude 模型。自带 Oh My OpenCode 多专家编排（Phase 2 scope）。

## Original Requirements（必填）
> "opencode 我们猫猫家族要迎接来新的猫猫了，我希望他和 dare 那样走 api 接入，用 felix-2 API key，baseUrl: https://chat.nuoda.vip/claudecode"
> "可不可以叫金渐层？"
> "Oh My OpenCode 是他的卖点，得考虑"
> "OMOC 不让他去编排指挥你们，只允许他编排他自己的 API"
- 来源：对话历史 2026-03-11 22:00~22:30 铲屎官消息
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- **选 L1 CLI 而非 HTTP API**：opencode 有 `opencode serve` HTTP 模式，但 L1 CLI 与 DARE 模式一致，复用 spawnCli 基础设施，降低接入成本。HTTP 模式留给 Phase 3。
- **cwd = workingDirectory**：与 DARE 不同（DARE 的 cwd 必须是 darePath）。opencode 是 npm 全局安装，不需要 repo 路径作为 cwd，直接用 thread 的 workingDirectory。
- **model 前缀 `anthropic/`**：opencode 期望 `provider/model` 格式，如果 config 里没带前缀自动补 `anthropic/`。

## Open Questions

1. **env var 优先级链**：`callbackEnv.CAT_CAFE_ANTHROPIC_API_KEY` > `OPENCODE_API_KEY` > `ANTHROPIC_API_KEY`。这个链条是否合理？还是应该有 `OPENCODE_API_KEY` 独立路径？
2. **step_start → session_init**：opencode 可能在一次 run 中产生多个 step_start（多步骤任务）。当前每个 step_start 都映射为 session_init，是否应该只映射第一个？
3. **cat-config `available: false`**：金渐层目前设为不可用（Phase 1 只是代码层接入），何时翻为 true 需要和 Phase 2 OMOC 集成联动。

## Next Action

请 review 代码质量、架构决策、测试覆盖。重点关注 Open Questions 中的 3 点。

## 自检证据

### Spec 合规
- AC-4 ✅ CatProvider + Zod enum
- AC-5 ✅ OpenCodeAgentService (11 tests)
- AC-6 ✅ opencode-event-transform (10 tests)
- AC-7 ✅ cat-config 金渐层 (6 tests)
- AC-8 ✅ AgentRouter switch case

### 测试结果
```
node --test test/opencode-*.test.js  # 27 passed, 0 failed ✅
tsc --noEmit                          # 0 errors ✅
tsc (build)                           # exit 0 ✅
```

### 相关文档
- Feature: `docs/features/F105-opencode-golden-chinchilla.md`
- Plan: `docs/plans/2026-03-12-f105-phase1-opencode-l1-cli.md`
- Parent: F050 External Agent Onboarding
- Worktree: `cat-cafe-f105-opencode` branch `feat/f105-opencode-l1`
