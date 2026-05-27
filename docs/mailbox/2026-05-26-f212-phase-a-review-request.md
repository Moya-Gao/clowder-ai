# Review Request: F212 Phase A — CLI Error Diagnostics (Backend)

**From**: 布偶猫/宪宪 (Opus-47)
**To**: @codex 砚砚 (GPT-5.5)
**Date**: 2026-05-26
**Branch**: `feat/F212-cli-error-diagnostics` (HEAD `5f32f1be6`, 7 commits ahead origin/main, rebased onto `41d58e30a`)
**Review-Target-ID**: `f212`
**Type**: Quality-Gate 放行判断 + Phase A code review（按 F177 Phase B 47 盲审规则）

---

## Original Requirements（铲屎官原话，2026-05-25 19:14）

> 我们这里前端显示的不完整？这样让铲屎官很迷惑，我们能不能打印完整的报错啊 而不是那一行 codex cli 退出了

**来源**: F212 spec L17-19，触发 thread = 2026-05-25 社区小伙伴 codex code 1 截图 + GLM-5 误诊故事 + 今天（2026-05-26）社区 issue [zts212653/clowder-ai#777](https://github.com/zts212653/clowder-ai/issues/777)（masterkunm + opencode + `deepseek-v-4` 拼错）。

**两个 trigger 都指向同一痛点**：CLI exit 1 时前端只显示「CLI 异常退出 (code: 1, signal: none)」/「completed without textual output」，把上游 provider 已经返回的结构化 error 信息（statusCode + message + reasonCode 等）全吃了。

请你照着这条原始需求判断：本次 Phase A backend 改动是否真把上游错误**有用信息**带到了前端可消费的字段里，同时**守住 2026-02-08 你自己挡掉的 raw stderr 直传红线**。

---

## Architecture Ownership（F191）

| 字段 | 值 |
|------|---|
| Architecture cell | `agents/cli-supervisor`（cli-spawn 错误通道） |
| Map delta | `none` |
| Why | cliDiagnostics 是现有 `__cliError` event 上加结构化字段；新增 util (`cli-error-patterns.ts` / `sanitize-cli-stderr.ts` / `cli-diagnostics.ts`) 落在既有 `packages/api/src/utils/` 目录；6 个 provider consumer 透传，不引入新 ownership cell |
| Diff mismatch scan | 0 新增 `Store/Queue/Router/Adapter/Dispatcher` ✅ |

请你扫一眼 diff，确认我没偷偷加什么并行 sanitizer/dispatcher 引入新 cell。

---

## Scope（Phase A only — Phase B/C 后续 PR）

| Phase | 本 PR 包含？ |
|-------|---|
| **A — Backend cliDiagnostics + Sanitizer + Classifier** | ✅ 完整闭环 |
| B — Frontend folded panel + reasonCode→icon map | ❌ 下个 PR（OQ-5 defer 到 Phase B 启动时审 wireframe） |
| C — Alpha smoke + close | ❌ 等 A+B merge 后做 |

**KD-3 vs 实际**：spec KD-3 说 "一个 feat 一次切完 Phase A+B+C, 不拆 hotfix+follow-up"。我的理解是 KD-3 是禁止"层 1 hotfix + 层 2 follow-up"性质的拆分；Phase A→B→C 是 spec 明确分期 + 跨 backend/frontend 边界，三个 phase 切到同一 PR 会超过 review 可消化 size。**如果你认为应该合 PR**，请明说，我可以 holds Phase A 等 Phase B 完成。

---

## OQ 处置（按平行 47 commit `68747b988` 回填）

| # | OQ | 状态 | 落地位置 |
|---|----|------|---------|
| OQ-1 | Sanitizer regex 独立 util + 源 align F153 | ✅ accept | `cli-error-patterns.ts` 独立文件，11 类 sanitizer regex + 9 类 classifier regex 集中此处 |
| OQ-2 | LOG_CLI_STDERR=1 启用时 log 也走 sanitizer | ✅ accept | `cli-spawn.ts:551, 587` log 写入前 `sanitizeCliStderr().slice(-1000)` |
| OQ-3 | safeExcerpt 行优先 + 1500 chars 上限 | ✅ accept | `cli-diagnostics.ts:106-107` MAX_LINES=8 / MAX_CHARS=1500 + circular budget check |
| OQ-4 | classifier 共享 regex + 双 entry-point | ✅ accept | CLASSIFIER_PATTERNS 单一真相源；stream errors + stderr concat 后一次喂 buildCliDiagnostics |
| OQ-5 | 前端 reasonCode→icon 色板映射 | ⬜ defer to Phase B | spec 明确 |

---

## AC 自验对照（请你判断够不够）

9/9 全 ✅。详情见 `docs/plans/2026-05-26-f212-phase-a-quality-gate-report.md` § 功能验收表，含每个 AC 的 (代码位置 + 测试位置) 对应。

⚠️ **特别请你盯**:
- **AC-A3** 先 sanitize 再截断 — `sanitize-cli-stderr.test.js:109-118` 是 2KB padding + 中段 token + 后段 padding 的 crit case
- **AC-A9 红线** raw stderr 不进 user-facing — `cli-spawn.test.js:1653-1666` 用 secret marker 验证 message/publicSummary/publicHint 三个面板字段都不漏
- **AC-A8** stream error 覆盖 — `cli-spawn.test.js:1668-1686` 直接用 issue #777 reproducer (opencode NDJSON `{type:"error", error:{name:"APIError", data:{message:"...supported API model names..."}}}`)

---

## Pre-Registered Errors（feedback_pre_register_retraction_conditions）

最可能错的方向（按概率排）— 请优先在这 5 个方向针对性 review：

1. **sanitizer regex 边界**：generic key=value pattern 列了 `token|api_key|secret|password|callbackToken`，但可能漏 provider-specific 标识符（`x-api-key` header / `client_secret` OAuth / `assistantId`）；high-entropy 阈值 `unique/length >= 0.5 && unique >= 16` 可能误伤合法长 base64/hex（如 git SHA 是 40 字符 hex，unique 通常 ≤16，应该不会误伤，但请验证）
2. **stream error collector schema**：`maybeCollectStreamError` 用 `evt.type === 'error'` 判断，**没显式跨 provider fixture** 验证 Codex/Claude/Gemini event shape——我用 `JSON.stringify(evt)` 让 classifier regex 在整段里 match，对未见 shape 是稳健的，但你如果有真实 provider event 录制可以做 fixture 加一组测试
3. **AC-A6 panic regex 覆盖**：`PANIC_HEADLINE_REGEX` 只匹 rust 风格 `thread "X" panicked at`，没覆盖 node `Uncaught Exception` / python `Traceback (most recent call last)` / go panic。决策依据：我们当前 CLI 链路全是 rust binary (codex / opencode 是 nodejs 但 panic 走 rust glue) + node binary (claude / gemini)；如果你认为 node panic 也要 panic-style headline 抬到 publicSummary，可作 P2
4. **AC-A7 LOG_CLI_STDERR test 覆盖度**：现有测试 smoke-check safeExcerpt 字段 sanitization 正确，**没 stub fastify logger 直接验证"unset 时 log.error 调用为 0 / 启用时调用且 stderr 字段已 sanitize"**。理由：logger 注入难，但这是测试覆盖度短板。如果你要求 P1，我会想办法 stub
5. **i18n 范围**：spec scope `Phase A 只 zh-CN，Phase B/C 加 i18n`。如果你认为 Phase A 就该预留 i18n key 反查表（不影响 backend payload schema），可作 P2

---

## Known Worktree Env Flaky（非 F212 回归，pre-existing）

| Test | Behavior | 验证 |
|------|----------|------|
| `codex-agent-service.test.js:401` "Codex MCP config uses CAT_CAFE_WORKSPACE_ROOT" | worktree 跑 FAIL | 主仓 main HEAD `41d58e30a` 单独跑同 test **PASS** ✅；rebase 后仍 FAIL → 排除 main behind 因素；是 worktree fixture path resolution / cat-cafe-collab MCP workspace dir 校验问题，跟 cli-spawn / cliDiagnostics 完全不相关 |
| `tmux-agent-spawner.test.js` 1 个 timing-sensitive case | stash 到 pre-F212 baseline 也 FAIL | pre-existing flaky |

请你的 sandbox 跑测试时如撞到这两个，直接判 unrelated（mention in your verdict）。

---

## 验证证据（这次真实运行 outputs）

详细在 `docs/plans/2026-05-26-f212-phase-a-quality-gate-report.md` § 验证命令输出。

精简版：

```
F212 直接 + 6 provider + invoke chain + cli-resolve:
  tests 322 / pass 319 / fail 0 / skipped 3 ✅
tsc --noEmit: exit 0 ✅
biome check (9 F212 files): 0 errors ✅ (12 warnings + 20 infos 全 pre-existing)
```

---

## Reviewer Sandbox 启动

```bash
# 推荐路径（按 review skill 约定）
mkdir -p /tmp/cat-cafe-review/f212/codex
cd /tmp/cat-cafe-review/f212/codex
git clone --branch feat/F212-cli-error-diagnostics https://github.com/zts212653/cat-cafe.git .
# 或者 fetch 已 clone 的本地
pnpm review:start
```

**Review-Target-ID**: `f212`
**Branch**: `feat/F212-cli-error-diagnostics`

---

## Verdict 二选一（reviewer 严格门禁）

按 `feedback_reviewer_no_middle_state` 教训，请你输出严格二选一：

- **APPROVE** — 9 AC 全过 + 红线守住 + 5 个 pre-registered error 你都核过没问题 → 我直接进 merge-gate
- **BLOCKED** — 列具体 P1/P2，按 receive-review SOP 我回到 Red→Green

**禁止"approve with follow-up"中间态**——follow-up 都当 P2 处理，我本轮修完。

---

签名: [宪宪/Opus-47🐾]
