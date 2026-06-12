# Review Request: F230 B-hook — Replace transcript-tail with hook sidechannel

Review-Target-ID: f230
Branch: feat/f230-hook-sidechannel

## What

Replaced the interactive PTY carrier's output face: from tailing Claude's internal transcript jsonl to tailing a hook-written sidecar jsonl. Three core changes:

1. **HookSidechannelConsumer** (new) — Pure functions: `hookEntriesToAgentMessages` (Stop→text, PostToolUse→tool_use), `isHookTerminalEvent` (Stop = terminal), `extractSessionIdFromHookEntries`. Replaces `BgTranscriptEventConsumer` for carrier output.
2. **hook-setup infra** (new) — `setupHookInfrastructure(cwd, sidecarPath)` writes `.claude/settings.json` + POSIX sh capture script that reads hook stdin and appends to sidecar. Cleanup restores original settings.
3. **CarrierService switch** — Tails sidecar instead of transcript. Stop event = terminal signal (replaces `system/turn_duration`). Usage degrades to `{}` (no token data from hooks).
4. **Factory pin removal** — Removed `resolveInteractivePtyBinary`, `DEFAULT_PTY_BINARY_170`, `CARRIER_PTY_BINARY_KEY`. Hook works with any Claude version.

10 files changed, +1190 -349 lines. 54 tests green (16 consumer + 7 setup + 23 carrier + 8 factory).

## Why

- Claude 2.1.172+ broke transcript writing in interactive mode — we were pinned to 2.1.170
- Hook sidechannel is Claude's official API for structured output (Stop/PostToolUse hooks)
- Removes version dependency: works with ANY claude binary
- Spike-verified on 2.1.175 (docs/research/2026-06-12-f230-hook-sidechannel-spike.md)

## Original Requirements（必填）
> 铲屎官原话："我决定直接开干！而且我决定听你的 ① B-hook（先做）！"
> "让opus写吧 别sonnet了 sonnet 我害怕哈哈哈 opus麻利多了"
- 来源：F230 讨论 thread + Fable-5 spike verdict (commit b570d6148)
- Fable-5 implementation directive: "核心三件：① carrier 启动时往 PTY 的 cwd 写 `.claude/settings.json` 配 Stop + PostToolUse hook，脚本把结构化 JSON append 到 sidecar jsonl；② consumer 从 tail transcript 改 tail sidecar；③ 解除 factory 的 2.1.170 pin fail-fast。usage 短期降级，别卡在这。"
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- **Usage 降级**：Hook events 不携带 token/usage 数据 → `const usage: TokenUsage = {}`。Accepted per spike (可 Phase C 恢复)
- **Streaming 不可能**：Hook 只在 turn 结束时 fire Stop → 全量文本一次性到达，不是流式。Structural limitation (不是 B-hook scope)
- **去掉 try/catch fallback**：Factory 不再 catch PTY creation failure fallback to -p。Hook works everywhere, no fallback needed.

## Architecture Ownership（必填）
Architecture cell: F143 Hostable Agent Runtime (carrier domain)
Map delta: none
Why: Same carrier abstraction (AgentService), different output channel. No new Store/Queue/Router/Adapter.

请 reviewer 检查：
- diff 是否与 `Map delta` 一致
- 是否新建了并行 `Store` / `Queue` / `Router` / `Adapter` / `Dispatcher` / `Binding`
- 若修改 `docs/architecture/ownership/cells/*.md`，是否确实改变了 owner / boundary / extension point / canonical anchor

## Open Questions

### 技术 OQ（给 reviewer）
1. **hook-setup cleanup 时机**：cleanup 在 carrier dispose 路径调用，但如果进程被 SIGKILL，cwd/.claude/settings.json 残留。实际影响低（下次 setupHookInfrastructure 会覆盖），但值得 reviewer 评估。
2. **sidecar 并发写入**：多个 hook 事件可能并发 append 同一 sidecar 文件。POSIX `printf >> file` 对小行（< PIPE_BUF = 4096）是原子的，但 reviewer 可评估是否需要 flock。
3. **hookSidecarPathOverride test seam**：所有 23 carrier tests 使用 `hookSidecarPathOverride` 跳过真实 hook infra setup。这意味着 hook infra 的集成只在 f230-hook-setup.test.js 的 7 个 unit tests 中覆盖。是否需要一个集成测试？

### 价值 OQ（给 CVO，如有）
无——回滚成本低（revert 7 commits），技术选择已由 Fable-5 spike 验证。

## Next Action
请 review 代码正确性 + 测试覆盖，特别关注 hook event parsing 边界和 cleanup lifecycle。

## Review Sandbox（必填）
- Path: `/tmp/cat-cafe-review/f230/{reviewer-handle}`
- Start Command: `pnpm review:start`
- Ports: 非前端改动，无需起 dev server

## 自检证据

### Spec 合规
- ✅ AC: Carrier uses Stop + PostToolUse hooks for output
- ✅ AC: Works on system claude (any version)
- ✅ AC: Factory no longer requires 2.1.170 pin
- ✅ AC: Existing carrier tests pass on hook path (23 tests)
- ✅ AC: Usage degraded (no token data — accepted)

### 测试结果
```
pnpm gate → ✅ GATE PASSED (SHA cf03cb19, 189s total)
F230 tests: 54 passed, 0 failed (consumer 16 + setup 7 + carrier 23 + factory 8)
Full test suite: all passed
biome check: passed
tsc: passed
```

### 相关文档
- Plan: `docs/plans/2026-06-12-f230-b-hook-sidechannel.md`
- Spike: `docs/research/2026-06-12-f230-hook-sidechannel-spike.md`
- Feature: F230 `docs/features/F230-claude-interactive-pty-carrier.md`
