# Review Request: F230 Phase B-min Skeleton — ClaudeInteractivePtyCarrierService

Review-Target-ID: f230
Branch: feat/F230-bmin-skeleton
PR: https://github.com/zts212653/cat-cafe/pull/2204

## What

F230 Phase B-min skeleton：interactive PTY carrier via tmux，作为 `--bg` daemon（F198）的备胎第四档。

核心产物：
- `PtyDriver.ts`：tmux wrapper，start/injectPrompt/cancel(ESC)/dispose(kill-session)，bracketed paste，fs.watch transcript ack
- `ClaudeInteractivePtyCarrierService.ts`：AgentService 实现，100% 复用 TranscriptTailer/BgTranscriptEventConsumer/transformClaudeEvent
- `claude-carrier-factory.ts`：新增 `interactive_pty` 分支（唯一共享代码改动点，AC-B7）
- `f230-pty-driver.test.js`：4-step TDD 集成测试（sandbox skip，via `pnpm --filter @cat-cafe/api test:pty`）
- `f230-interactive-pty-carrier.test.js`：4-step 单元测试 mock driver（gate-safe，4/4 GREEN）
- `f230-pty-smoke.mjs`：e2e smoke 脚本

## Why

F198 赌 `--bg` 6/15 后仍在订阅桶。若判罚为 SDK，布偶猫家族降至 `print_sdk`（$200/mo，铲屎官实测约 5h 烧完）。F230 提供 interactive PTY 第四档——Anthropic 政策明文保护的 interactive 形态。Skeleton 在 6/15 前完成，判罚日当天可一键切换（KD-6）。

## Original Requirements（必填）

来源：`docs/discussions/2026-06-10/`（CVO Slack 07:22-08:16）

> "要是这个bg到时候不靠谱 我们至少要现在先想清楚备用方案 避免过几天布偶猫拯救失败了！！！"
> "具体写代码交给sonnet…… 砚砚55 review"
> "不然我要破产" + "$200我试过 基本一天就没了 这个一天的意思可能是五个小时"

铲屎官核心诉求：6/15 前 interactive PTY 可切换，默认零流量，判罚日当天可启用。

**请 Reviewer 对照上面的摘录判断：交付物是否解决了铲屎官的问题？**

## Tradeoff

- node-pty 评估后弃用 → tmux（spike 验证全机制 + F089 oversight 天然 + 进程由 tmux server 托管）
- per-invocation 形态先做，常驻形态 Phase C 评估（KD-5）
- B-full golden parity（AC-B2）+ alpha 多轮剧本（AC-B6）gated standby

## Architecture Ownership（必填）

Architecture cell: F143 Hostable Agent Runtime
Map delta: update required — ProcessModel 增加 `interactive_pty` 为第四类 carrier（与 `-p`/`bg_daemon`/`api_key` 平级）
Why: tmux PTY session 是新 process topology；transcript 输出路径与 F198 完全共享

请 Reviewer 检查：
- diff 是否与 Map delta 一致（factory + new carrier class）
- 无新建并行 Store/Queue/Router/Adapter/Dispatcher
- TranscriptTailer/BgTranscriptEventConsumer/transformClaudeEvent 全部复用（零拷贝）

## Open Questions

### 技术 OQ（给 reviewer）
1. `readyGraceMs` default 15s — spike p50 10-15s，是否足够覆盖冷启动慢速机器？
2. `watchForTranscriptFile` 5s timeout — spike p50=0.11s/max=0.12s，有边界 case 会超时吗？
3. `CLAUDE_CODE_ENTRYPOINT` 在 carrier env prep + PtyDriver cmd 双重 unset——belt-and-suspenders 是否正确，还是混乱？
4. Smoke script 充分验证 AC-B1 身份 capsule（argv/TTY/version/auth/entrypoint 实采）吗？

### 价值 OQ（给 CVO）
无 — 所有架构决策在 KD-4/KD-5/KD-6 范围内。

## 关键验证请求

**请 Reviewer 运行 smoke script（AC-B1/B3/B4 validation）：**

```bash
# 在 feat/F230-bmin-skeleton 分支上
node packages/api/scripts/f230-pty-smoke.mjs
```

期望：session_init + text + done + usage.outputTokens > 0 + no zombie sessions。约 30-60s（TUI 启动 10-15s + 响应 + 清理）。

## Next Action

请 reviewer 审查代码质量 + 运行 smoke script 验 AC-B1/B3/B4 + 放行或提 P1/P2。

## Review Sandbox

Review-Target-ID: f230
Branch: feat/F230-bmin-skeleton
- Path: `/tmp/cat-cafe-review/f230/{reviewer-handle}`
- Note: smoke 可独立运行，不需要全量服务器启动

## 自检证据

### Spec 合规

| AC | 状态 | 证据 |
|----|------|------|
| AC-B5 cancel semantics + test | ✅ | unit test Step 2 (abort) + Step 4 (start-error) GREEN |
| AC-B7 factory only | ✅ | diff 只改 claude-carrier-factory.ts（11 lines, import + branch） |
| AC-B1 factory + smoke | 🟡 | code done，smoke script written，pending reviewer run |
| AC-B3 MCP parity | 🟡 | `--mcp-config --strict-mcp-config` in code，pending smoke with real cat_cafe_* call |
| AC-B4 permission bypass | 🟡 | `--permission-mode bypassPermissions` in code，pending smoke |

### 测试结果

```
pnpm gate → ✅ All tests passed, biome passed, build passed

# Unit tests (gate-safe):
packages/api/test/f230-interactive-pty-carrier.test.js
  ✅ Step 1: session_init → text → system_info → done; usage outputTokens > 0
  ✅ Step 2: abort signal → cancel() called; error+done
  ✅ Step 3: tool_use in transcript → AgentMessage tool_use
  ✅ Step 4: start() throws → error+done; dispose() called (no zombie)
  → 4 pass, 0 fail

# Integration tests (run via test:pty, real tmux+claude):
packages/api/test/f230-pty-driver.test.js
  ✅ Step 1: lifecycle (4 pass, 0 fail) — 47ms per test
  ✅ Step 2: injectPrompt needle — 20s
  ✅ Step 3: 60KB byte parity — 24s
  ✅ Step 4: cancel integrity — 24s
  → 4 pass, 0 fail (skipped in sandbox per CAT_CAFE_TEST_SANDBOX=1)
```

### 相关文档

- Plan: `docs/plans/2026-06-10-f230-bmin-skeleton-plan.md`
- Spike: `docs/research/2026-06-10-f230-pty-carrier-spike-report.md`
- Fixtures: `docs/features/assets/F230/phase-a-spike-day1-fixtures-2026-06-10.md`
- Feature: `docs/features/F230-claude-interactive-pty-carrier.md`

---

如果判断某个预登记的错误最可能在哪：

**我最可能错在：**
1. `readyGraceMs: 15_000` 对某些边界情况不够（云端 CI 机器冷启动慢）
2. `watchForTranscriptFile` 5s timeout 在极慢网络/磁盘下会 timeout（但 spike 实测 p50=0.11s）
3. `transcriptDirOverride` 测试 seam 在真实集成场景可能与 `ptyTranscriptDir(cwd)` 不一致——需要 smoke 验证

[宪宪/Sonnet🐾]
