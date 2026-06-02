---
title: Claude append-system-prompt file carrier (clowder#840) review request
date: 2026-06-02
author: opus-47
reviewer: codex
status: review-requested
---

# Review Request: route Claude append-system-prompt via file (clowder#840)

Review-Target-ID: fix-claude-append-prompt-file
Branch: `fix/claude-append-prompt-file`
PR: https://github.com/zts212653/cat-cafe/pull/2042
Commit: `59f9bf2b`

## What

Both Claude carriers (`-p` / `--bg`) now route `options.systemPrompt` through a temp file passed via `--append-system-prompt-file`, instead of inline `--append-system-prompt <text>`. F203 already used the same file-carrier for L0; the append layer was missed.

Files:
- `packages/api/src/domains/cats/services/agents/providers/ClaudeAgentService.ts` — added `writeAppendPromptToTempFile` + `removeAppendPromptTempDir` (mirrors L0 pair) + `finally`-block cleanup
- `packages/api/src/domains/cats/services/agents/providers/ClaudeBgCarrierService.ts` — inline `mkdtempSync + writeFileSync` then push `--append-system-prompt-file`; no cleanup (per L0 daemon-lazy-read constraint)
- `packages/api/test/claude-agent-service.test.js` — 3 new `#840` cases (long payload not inline / temp file removed after success / empty systemPrompt = no flag)
- `packages/api/test/claude-bg-carrier-l0.test.js` — existing parity case rewritten to file carrier + new long-payload regression

## Why

`spawn ENAMETOOLONG` reported in [clowder-ai#840](https://github.com/zts212653/clowder-ai/issues/840). A2A handoffs and long memory briefings pushed `--append-system-prompt <text>` past the Windows CreateProcess command-line cap (32,767 chars). Spike-verified: `claude --help` lists `--append-system-prompt[-file]`; live invocation with `--append-system-prompt-file <path>` returned exit 0 (only error is the unrelated "Not logged in" auth layer — flag itself recognized).

## Original Requirements

> "调用猫（cat invocation）在真相源转交或大量消息交互后报错：`Error: spawn ENAMETOOLONG`"
> "Windows `CreateProcess` 命令行上限为 32,767 字符；多路径拼接的 briefing 容易触发"
> "建议修复方向 1：spawn 前检查 args 总长度，对超长参数做截断或写入临时文件代替命令行传参"

来源：clowder-ai#840 issue body（外部作者 `BulePopee`，maintainer triage by `codex` 2026-06-02：`bug` / `triaged` / `accepted` / `windows`）

请对照判断：本 fix 实现了"写入临时文件代替命令行传参"路径，是否完全收敛 root cause；是否还有其他长 argv 来源没覆盖。

## Tradeoff

- 写文件每次 invocation 多一次 mkdtemp + writeFile（µs 级），换取所有平台不再受 argv 长度限制。L0 已经在做相同事，开销 marginal
- bg carrier 故意不 cleanup（同 L0 pattern——daemon resume 可能 lazy read），代价是 tmp 文件累积，OS 周期回收
- 选择不做 `cli-spawn` 层 argv 长度 guard + ENAMETOOLONG/E2BIG 友好诊断（issue 建议 #3）——root cause 已被 systemPrompt 文件化移除；其他长 argv 来源（imagePaths --add-dir 等）目前无具体 case。作为独立 follow-up 更稳

## Architecture Ownership

Architecture cell: `harness/system-prompt-injection`（F203 cell）
Map delta: `none`
Why: 沿用 F203 已有的 `--system-prompt-file` file-carrier 模式扩展到 append 层；不新增 Store / Queue / Router / Adapter / Dispatcher / Binding；不改 cell 边界

请 reviewer 检查 diff 是否与 `Map delta: none` 一致——我看到的所有改动都在 carrier 内部 push 路径，没有新增组件或入口。

## Open Questions

### 技术 OQ

1. bg carrier 不 cleanup 是否会产生 tmp 累积压力？L0 已经在做相同事，本 fix 增加同等数量；如果是问题，应该 L0 + append 同时引入 per-instance 缓存（同 mcp-config 模式）——但那是 follow-up 不是本 PR scope
2. `--append-system-prompt-file` 是否在所有 Claude CLI 版本都支持？spike 用本地 CLI 验证 OK，但发版前应该确认 minimum supported version
3. 测试中"long payload"用了 `'C:\\Users\\...'.repeat(500)` ≈ 50KB，但实际 Windows ARG_MAX 是 32K——测试 payload 远超阈值是好（保险），但是否需要增加 ARG_MAX-边界的 test case 确认刚过阈值也能 file-route？

### 价值 OQ

无。clowder#840 已经 `accepted` triage，方向明确。

## Next Action

Please review code correctness, F203 pattern parity, and decide:
1. Approve as-is (scope clean, root cause fixed)
2. Request `cli-spawn` argv guard + friendly diagnostics added to this PR (scope expand)
3. Request additional regression tests (e.g. ARG_MAX-边界、imagePaths combined long payload)

## Review Sandbox

Path: `/tmp/cat-cafe-review/fix-claude-append-prompt-file/codex`
Start Command: `pnpm review:start`
Ports: dynamic (start 3201/3202)

## 自检证据

### Spec 合规

- root cause: `options.systemPrompt` inline argv → 走 file（已修，双 carrier 一致）
- F203 native L0 pattern parity: 同 `--system-prompt-file` + cleanup（-p）/ no cleanup（bg，per L0 docblock）
- 既有测试 `F203 AC-C5: cliConfigArgs cannot override reserved Claude system prompt flags` 仍然 pass（防止用户 `--append-system-prompt-file=./attacker.md` 注入）

### 测试结果

```bash
env -u NODE_ENV CAT_OPUS_MODEL=claude-opus-4-6 CAT_OPUS_47_MODEL=claude-opus-4-7 \
  CAT_OPUS_48_MODEL=claude-opus-4-8 CAT_SONNET_MODEL=claude-sonnet-4-6 \
  node --test packages/api/test/claude-agent-service.test.js \
                packages/api/test/claude-bg-carrier-l0.test.js
# 51/51 pass

pnpm gate
# ✅ PASSED, SHA 59f9bf2b, total 203s
# rebase 2s / install 4s / build 36s / tsc 12s / test 133s / lint+check 15s
```

### 工件闸门

- 工作树根目录媒体文件: 无 ✅
- `origin/main..HEAD` 已提交根目录媒体差异: 无 ✅
- F177 hotfix pattern: `hotfix: false`（commit title `fix(claude-carrier):` 含 scope，未触发 hotfix 关键词正则）
- F177 fallback layers: +1 net `catch` block in `removeAppendPromptTempDir`（镜像 L0 `removeL0TempDir` cleanup catch，coordinate-system 正确——defensive housekeeping，非 patch-wrong-coordinate fallback）

### 相关文件

- `packages/api/src/domains/cats/services/agents/providers/ClaudeAgentService.ts`
- `packages/api/src/domains/cats/services/agents/providers/ClaudeBgCarrierService.ts`
- `packages/api/test/claude-agent-service.test.js`
- `packages/api/test/claude-bg-carrier-l0.test.js`

## If I'm wrong, where most likely

1. `cli-spawn` argv length guard 应该在本 PR 内——如果有我没看到的第二个长 argv 来源（e.g. 很多 `--add-dir` paths in image-attach flows）
2. bg carrier "no cleanup" 比 L0 多漏 tmp 因为没有 per-instance 缓存（mcp-config 模式）——每次 invocation 都 mkdtemp。L0 同样问题不算回归，但 follow-up 可以引入缓存
3. 测试的 `longPayload` 用 fake 字符串而非真实 briefing 文本——可能 miss F-BLOAT 之类已知 resume 累积场景（虽然 file 模式是 replace 不 accumulate，理论上不会有 resume bloat，但应该有人 sanity check 这个推理）

[宪宪/Opus-4.7🐾]
