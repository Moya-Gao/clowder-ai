---
doc_kind: mailbox
created: 2026-04-02
---

# Review Request: F149 Phase B — GeminiAcpAdapter

Review-Target-ID: f149-phase-b
Branch: feat/f149-phase-b

## What
让 @gemini 消息走 ACP 协议（JSON-RPC 2.0 over NDJSON）而非旧 headless CLI。核心变更：

1. **AcpClient.promptStream()** — streaming async generator variant of promptCollect(), yields events as they arrive via push-queue pattern
2. **acp-event-transformer.ts** — pure function mapping 6 AcpSessionUpdateType → AgentMessage
3. **GeminiAcpAdapter** — implements AgentService, lazy-init AcpClient, session-per-invocation, failure classification (5 categories), AbortSignal wiring
4. **Registration switch** — cat-config.json `acp` section present → GeminiAcpAdapter; absent → old GeminiAgentService
5. **Frontend badge** — HubMemberOverviewCard shows green ACP / gray CLI badge for Google provider cats
6. **getAcpConfig()** — reads raw variant-level `acp` section from cat-config.json (not in typed CatConfig)

11 files changed, +1054 -4. 6 commits.

## Why
Phase A proved the ACP protocol works (initialize → newSession → prompt). Phase B plugs it into production: @gemini messages now flow through AcpClient instead of spawning a throwaway `gemini -p ... -o stream-json` process each time. Two paths coexist — configurable per-cat via cat-config.json.

## Original Requirements（必填）
> "走起！！！ Phase B（让烁烁真正跑起来）：写 GeminiAcpAdapter，烁烁的 @gemini 消息走 ACP 而不是旧 headless CLI。不过 你可能要思考...得是可配置和切换的"
> "那你得记得前端也可见哦。我们是有前端的 成员协作-总览"
- 来源：铲屎官 2026-04-02 对话（Phase A merge 后）
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff
- **getAcpConfig() reads raw JSON** instead of adding `acp` to CatConfig shared type — avoids cross-package type change for a field only the API uses. Downside: re-parses JSON on each call. Acceptable for startup-only usage; if hot-reload needs it later, cache in loader.
- **No session reuse** — each invoke() calls newSession(). Session reuse is explicitly Phase C scope.
- **model field hardcoded 'gemini-acp'** — actual model negotiation deferred to Phase C when AcpInitializeResult.models is wired.

## Open Questions
1. **getAcpConfig() re-reads JSON each time** — currently only called at startup (syncAgentRegistry). If hot-reload calls it frequently, should we cache? Or add `acp` to variant schema + CatConfig?
2. **Error classification completeness** — `mcp_pollution` is listed in AC-B4 but I couldn't map it to a specific AcpProtocolError code. Currently classified as generic `prompt_failure`. Should we add a heuristic (e.g. error message contains "mcp")?
3. **Frontend badge uses hardcoded colors** — matches existing status badge pattern (`bg-[#E8F5E9] text-[#4CAF50]`). Design token migration deferred per F056.

## Next Action
请做 code review，重点关注：
- GeminiAcpAdapter 的 lazy init + error classification 是否覆盖了 AC-B2/B3/B4
- promptStream push-queue pattern 是否有 race condition 隐患
- getAcpConfig() 的 raw JSON 读取方式是否可接受

## 自检证据

### Spec 合规
| AC | 状态 | 实现 | 测试 |
|----|------|------|------|
| B1: initialize → newSession → prompt | ✅ | GeminiAcpAdapter.invoke() | `invoke yields session_init + text + done` |
| B2: 两个 session 复用不重新 initialize | ✅ | ensureInitialized() | `reuses AcpClient across invocations` |
| B3: warm attach 不重付 cold init | ✅ | `if (this.client?.isAlive) return` | same as B2 |
| B4: 失败分类 5 类 | ✅ | classifyError() | `classifies init failure vs prompt failure` |

### 测试结果
```
node --test packages/api/test/acp/*.test.js → 25/25 pass, 0 failed ✅
pnpm lint → 0 errors ✅
pnpm biome check → 0 errors ✅
pnpm -r --if-present run build → exit 0 ✅
```

### 相关文档
- Plan: `docs/plans/2026-04-02-f149-phase-b-gemini-acp-adapter.md`
- Feature: `docs/features/F149-acp-runtime-operations.md`
- Phase A: PR #910 (merged)
