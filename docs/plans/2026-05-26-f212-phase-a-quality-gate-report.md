# F212 Phase A — Quality Gate Report

**Author**: 布偶猫/宪宪 (Opus-47) — **F177 Phase B 47 盲审规则**：本报告由 author 整理为机械证据 + AC 对照表 + 自检结论，**最终 quality-gate 放行由对家猫执行**（reviewer: @codex 砚砚）。

**Spec**: `docs/features/F212-cli-error-diagnostics.md`
**Plan**: `docs/plans/2026-05-26-f212-phase-a-cli-error-diagnostics.md`
**Branch**: `feat/F212-cli-error-diagnostics` (6 commits ahead origin/main, rebased onto `41d58e30a`)
**Date**: 2026-05-26

---

## 愿景覆盖（Step 0）

| # | 铲屎官原始需求 (2026-05-25) | AC 覆盖 | Phase A 实现 |
|---|---|---|---|
| 1 | "我们这里前端显示的不完整？这样让铲屎官很迷惑" | AC-A1（structured cliDiagnostics payload）+ Phase B 折叠面板 | ✅ Phase A backend 落地；Phase B 前端渲染留待下个 PR |
| 2 | "能不能打印完整的报错啊 而不是那一行 codex cli 退出了" | AC-A1/A4/A5（reasonCode + safeExcerpt + 9 类） | ✅ 9 reasonCodes 全部上线 + safeExcerpt sanitized 抽取 |
| 3 | "守 2026-02-08 砚砚旧线（raw stderr 不直传）" | AC-A9 红线 | ✅ message 仅 humanized，raw stderr 不进 user-facing |

**铲屎官原始需求 vs AC 完整覆盖** ✓。Phase B 前端折叠面板是下个 PR 的事；Phase A 只交付 backend，**用户在 Phase A 后能通过 API/SSE 收到 cliDiagnostics 结构化字段**，但 UI 渲染要等 Phase B（spec 已明确分期）。

---

## Delivery Completeness Check（Step 0.5）

- 本次交付 = **Phase A 完整闭环**（不是 Phase A 内部部分切片）
- KD-3 "一个 feat 一次切完 A+B+C, 不拆 hotfix + follow-up" 的意图是禁止"层 1 hotfix + 层 2 follow-up"，**Phase A→B→C 是 spec 明确的分期**，不是 hotfix tail
- 本次产出后续是**扩展不是重写**（Phase B 只需 import cliDiagnostics 类型 + 渲染折叠面板，不改 backend payload schema）

---

## 功能验收（AC-A1..A9）

| # | AC | 状态 | 代码位置 | 测试覆盖 |
|---|----|------|---------|----------|
| AC-A1 | `__cliError` payload 含 cliDiagnostics structured 对象 | ✅ | `cli-spawn.ts:535-555` (abnormal exit), `cli-spawn.ts:567-606` (timeout), `tmux-agent-spawner.ts:349-388` | `cli-spawn.test.js:1633-1731` (5 tests) |
| AC-A2 | `sanitize-cli-stderr.ts` util + fuzz | ✅ | `sanitize-cli-stderr.ts` (full file) | `sanitize-cli-stderr.test.js` (19 fuzz tests: ANSI/OSC/NFKC/path×2/JWT/PEM/URL/cookie/OpenAI/GitHub×2/npm/Google/Bearer/key=value/high-entropy/empty/idempotent) |
| AC-A3 | 先 sanitize 再截断（token 中段截尾不绕过） | ✅ | `sanitize-cli-stderr.ts` 整段一次性 normalize+redact，不内部截断；caller 负责 truncate（`cli-spawn.ts:551` `.slice(-1000)` after sanitize） | `sanitize-cli-stderr.test.js:109-118` (`AC-A3 critical` test) |
| AC-A4 | `classifyKnownCliStderr` 扩到 9 类 | ✅ | `cli-error-patterns.ts:106-141` (CLASSIFIER_PATTERNS) + `cli-diagnostics.ts:46-52` (classifyCliError) | `cli-error-patterns.test.js` (27 tests: 9 reasonCodes × 多 fixture + case insensitive + specific-first ordering + unknown→undefined) |
| AC-A5 | `safeExcerpt` 仅在 reasonCode !== undefined 时填 | ✅ | `cli-diagnostics.ts:187-190` (`if (reasonCode) { ... safeExcerpt = ... }`) | `cli-diagnostics.test.js:7-15` (unknown stderr → no safeExcerpt) |
| AC-A6 | Panic stack 只保 headline，frame 全隐 | ✅ | `cli-diagnostics.ts:109` (FRAME_REGEX) + `:158` (PANIC_HEADLINE_REGEX) + `:178` (publicSummary 优先) | `cli-diagnostics.test.js:30-52` (panic with classifier match → frames stripped + headline in summary) |
| AC-A7 | `LOG_CLI_STDERR` env gate 默认关 | ✅ | `cli-spawn.ts:546-554` (abnormal exit) + `:583-591` (timeout) — `process.env.LOG_CLI_STDERR === '1'` gate + sanitize log content (OQ-2) | `cli-spawn.test.js:1689-1707` (LOG_CLI_STDERR unset → safeExcerpt sanitized smoke) |
| AC-A8 | Classifier 扫 stderr + NDJSON stream error events | ✅ | `cli-spawn.ts:26-39` (maybeCollectStreamError helper) + `:474` (collect in main loop) + `:540` (concat 喂 buildCliDiagnostics) | `cli-spawn.test.js:1668-1686` (NDJSON `{type:"error"}` → reasonCode='model_not_found', issue #777 reproducer) |
| AC-A9 | **回归红线**：raw stderr 不进 user-facing message | ✅ | `cli-spawn.ts:559` (`message: \`CLI 异常退出 (code: N, signal: M)\`` — humanized only) | `cli-spawn.test.js:1653-1666` (secret marker test: raw stderr 不在 message/publicSummary/publicHint) |

**9/9 AC 全部落地 + 测试覆盖** ✓

---

## OQ 处置（按平行 47 commit `68747b988` 回填）

| # | OQ | 状态 | 实施位置 |
|---|----|------|---------|
| OQ-1 | Sanitizer regex 独立 util，源 align F153 | ✅ accept | `cli-error-patterns.ts` 独立文件；regex 集合按砚砚 11 类列表（ANSI/OSC/NFKC/path×2/JWT/PEM/URL/cookie/5 token/high-entropy）；F153 TelemetryRedactor 在 spec 描述但代码未落地，本 feat 顺手建了 secret pattern 真相源 |
| OQ-2 | `LOG_CLI_STDERR=1` 启用时 log 内容也走 sanitizer | ✅ accept | `cli-spawn.ts:551, 587` — 启用时 `sanitizeCliStderr(stderrBuffer).slice(-1000)` 后才写 log |
| OQ-3 | `safeExcerpt` 行优先 + 1500 chars 上限保底 | ✅ accept | `cli-diagnostics.ts:106-107` MAX_LINES=8 / MAX_CHARS=1500 + `:142-151` 循环遵守双 cap |
| OQ-4 | Classifier 共享 regex + 双 entry-point (stderr + stream errors) | ✅ accept | `cli-error-patterns.ts:CLASSIFIER_PATTERNS` 是单一真相源；`cli-spawn.ts` 把 stream errors + stderr concat 后**一次** 喂 buildCliDiagnostics |
| OQ-5 | 前端 reasonCode → icon/色板映射 | ⬜ defer to Phase B | spec 已明确 Phase B 启动时 ping 铲屎官审 wireframe；本 Phase A 不涉及 |

---

## 设计稿对照（Step 5）

```bash
glob designs/**/*.pen 匹配 F212: 无匹配
```

UI 改动: 无（Phase A 100% backend）→ ✅ 无设计稿，跳过对照

---

## Artifact Hygiene（Step 7.5）

```bash
git status --short                                                # 0 输出
git diff --name-only origin/main...HEAD | rg '^[^/]+\.(png|...)$'  # 0 命中
```

仓库根目录媒体/设计工件: 无 ✅

---

## Architecture Ownership Report（Step 2.7）

- **Architecture cell**: `agents/cli-supervisor`
- **Map delta**: `none`
- **Why**: cliDiagnostics 是现有 `__cliError` event 上加结构化字段；新增 util (`cli-error-patterns.ts` / `sanitize-cli-stderr.ts` / `cli-diagnostics.ts`) 落在既有 `packages/api/src/utils/` 目录；6 个 provider consumer 透传，不引入新 ownership cell
- **Diff mismatch scan**: 0 新增 `Store/Queue/Router/Adapter/Dispatcher` 等架构名词 ✅
- **`pnpm check:architecture-ownership` 输出**: 31 warnings 全是 historical in-progress feats 缺 architecture cell 声明（F153 / F155 / F167 等），跟 F212 无关；F212 已声明所有必填项 ✅

---

## Fallback Layer Check（Step 2.6）

```
⚡ cli-spawn.ts: +2 -0 (net +2) [cumulative=13]
   [|| fallback] if (typeof value !== 'object' || value === null) return;
   [try/catch]   } catch { /* JSON.stringify circular ref safety */ }
```

**触发坐标系自检（累计 13 层 ≥5 阈值，pre-existing 11 层）**。回应三问：

1. **修坐标系还是补错的坐标系？** 没修坐标系——cli-spawn 整体架构（child process spawn + NDJSON parse + error event yield）是 F212 spec 锁定的设计，本 feat 在 cell 内扩展不重画
2. **坐标变换能否消除这两层？** 不能。`typeof !== 'object' || value === null` 是 helper 的运行时类型守卫（JS 动态类型必需）；`try-catch JSON.stringify` 是 circular ref 防御网（NDJSON event 可能含 self-reference 对象）
3. **每层为什么不能去掉？**
   - L26 type guard 去掉 → `evt.type` 访问 `null.type` 抛 TypeError 中断 cli-spawn 主循环
   - L33 try-catch 去掉 → 上游 CLI emit 含 circular ref 的 error event 时 unhandled exception 杀掉 generator
   - 这两层是**新增的 defensive minimal**，不是 fallback chain accretion；脚本把所有 `||` 和 `try-catch` 都算 fallback 导致误报

**pre-existing 11 层**: cli-spawn.ts 是 600+ 行老文件，历史累计层数跟 F212 无关；不在本 PR scope 内重构。

---

## Dogfood-Your-Slice（Step 4.5）

**Scope verdict**: 🆗 **可豁免**

**理由**: F212 Phase A 是 **backend-only payload schema 改动**，没有用户可感知路径：
- 用户在 chat UI 上看不到任何 Phase A 的视觉变化（Phase B 才渲染折叠面板）
- 没有新 MCP tool / 新 REST 端点
- 不是 bugfix（不修复任何 user-visible 异常路径）
- cliDiagnostics 字段流向是 API generator → SSE → 前端 store，本 Phase 前端**不消费**该字段（消费在 Phase B）

**可豁免类比**: spec/plan 写的"Phase B 前端折叠面板透传 + i18n hint"才是 user-visible feature；Phase A 是它的 prerequisite infrastructure。

**等效证据**: 测试本身就是 dogfood——`cli-spawn.test.js:1668-1686` 用 issue #777 真实 reproducer（用户 masterkunm 的 `deepseek-v-4` 拼错→DeepSeek API 400 → NDJSON error event）跑通新 pipeline；前端消费等 Phase B。

---

## 验证命令输出（这次真实运行）

```bash
# F212 直接相关 + 6 个 provider + invoke chain + cli-resolve
env -u NODE_ENV bash packages/api/scripts/with-test-home.sh \
  node --import "$(pwd)/packages/api/test/helpers/setup-cat-registry.js" \
  --test --test-timeout=60000 \
  packages/api/test/{cli-spawn,sanitize-cli-stderr,cli-error-patterns,cli-diagnostics,invoke-single-cat,invoke-single-cat-timeout-retry,invoke-helpers-timeout,opencode-agent-service,gemini-agent-service,kimi-agent-service,dare-agent-service,cli-resolve}.test.js

→ ℹ tests 322
→ ℹ pass 319
→ ℹ fail 0
→ ℹ skipped 3 (conditional environment)
→ ℹ duration_ms 15995

# tsc --noEmit
env -u NODE_ENV pnpm --filter @cat-cafe/api lint
→ exit 0 ✅

# biome (project toolchain 2.4.1, NOT npx — 教训 feedback_verify_with_repo_toolchain)
env -u NODE_ENV pnpm biome check <9 F212 files>
→ 0 errors ✅ (baseline 主仓 main 在 cli-spawn 上有 1 error，本 feat auto-fix 顺带消除)
→ 12 warnings + 20 infos 全是 pre-existing (cli-spawn 函数复杂度 + 历史 non-null assertion)
```

### 已知 worktree env flaky（非 F212 引入）

| Test | Behavior | 验证 |
|------|----------|------|
| `codex-agent-service.test.js:401` "Codex MCP config uses CAT_CAFE_WORKSPACE_ROOT" | worktree 跑 FAIL | 主仓 main HEAD `41d58e30a` 单独跑同 test **PASS** ✅；rebase F212 worktree 到 origin/main 后仍 FAIL → 排除 main behind 因素，是 worktree fixture path resolution 问题（cat-cafe-collab MCP server workspace dir 校验），跟 cli-spawn / cliDiagnostics 完全不相关 |
| `tmux-agent-spawner.test.js` timing-sensitive test | stash 到 pre-F212 baseline 同样 FAIL | pre-existing flaky |

**两个 flaky 都跟 F212 改动无关**，在 review 中说明即可，不阻塞放行判断。

---

## Commit Chain（自下而上）

```
3537b40b1 style(F212): biome --write auto-fixes (formatting only)
3f2de485b feat(F212): cli-spawn + tmux emit cliDiagnostics + stream error coverage (AC-A1/A7/A8/A9)
149d03117 feat(F212): buildCliDiagnostics + panic headline + safeExcerpt (AC-A1/A5/A6)
5d1c39c5b feat(F212): classifyCliError 9-reasonCode whitelist (AC-A4/A8)
aef38fc14 feat(F212): sanitize-cli-stderr util + fuzz tests (AC-A2/A3)
2a5d93218 docs(F212): Phase A implementation plan
```

每个 commit 对应一个 TDD red→green 循环，可独立 cherry-pick。

---

## 47 Search→Read 检查（F177 Phase F 布偶猫家族病自检）

本 session 的 search 行为：
1. `cat_cafe_search_evidence` 4 次（onboarding recall）—— 命中 `architecture/cli-integration.md`、`F153 spec`、`ADR-029/032`、`thread mpmf932de9ywomf7 (本 thread itself)`
2. 命中 doc anchor 后**全部 Read 了源文件**：
   - `docs/features/F212-cli-error-diagnostics.md` Read 完整 235 行 ✓
   - `docs/reflections/2026-05-26-f213-stale-mcp-config-cleanup-capsule.md` Read 完整 ✓
   - `docs/decisions/029-external-tool-integration-strategy.md` grep + read ✓
   - `cli-spawn.ts` Read L1-80 + L400-617 等多段 ✓

输出中的精确数字（19 fuzz tests / 27 fixtures / 9 reasonCodes / 1500 chars / 8 lines / cli-spawn:518 / commit SHA 等）全部来自**实际跑过的命令输出或 Read 出来的源文件行号**，无凭摘要推理。

✓ 无"碎片够了"病触发。

---

## 出错时可能在哪里（pre-register 教训 — feedback_pre_register_retraction_conditions）

如果砚砚 review 时判我 P1/P2，最可能的方向（按概率排）：

1. **sanitizer 正则边界**：generic key=value pattern (`(token|api_key|secret|password|callbackToken)`) 可能漏 provider-specific 标识符（如 Anthropic `x-api-key` header）；high-entropy 阈值 16 unique chars 可能误伤合法长字符串（如 git SHA、base64 编码的小 payload）
2. **stream error collector schema 假设**：`maybeCollectStreamError` 用 `evt.type === 'error'` 判断，但 Codex / Claude / Gemini 各 provider 可能用不同字段名（如 `data.type` / `event.type` / `error.type`）— 我用 `JSON.stringify(evt)` 让 classifier regex 在整段里 match，对未见过的 provider event shape 是稳健的，但**没有显式跨 provider fixture 测试**
3. **AC-A6 panic regex 覆盖**：`PANIC_HEADLINE_REGEX` 只匹 rust 风格 `thread "X" panicked at`，没覆盖 node `Uncaught Exception` / python `Traceback (most recent call last)` / go panic
4. **AC-A7 LOG_CLI_STDERR test 不完整**：现有 test 只验证 unset 时 safeExcerpt 字段行为，没 stub fastify logger 直接验证"unset 时 log.error 调用为 0 / 启用时调用且 stderr 字段已 sanitize"。理由：logger 注入难，但这是测试覆盖度短板
5. **i18n 文案 zh-CN only**：spec Phase A 已 scope "Phase A 只 ship zh-CN，Phase B/C 加 i18n"——若砚砚认为应 Phase A 就预留 i18n key 反查表，可作 P2

砚砚针对性 review 时可优先看上述 5 点。

---

## 自检结论（机械可见事实）

- **9/9 AC 全落地** ✓
- **319/322 测试通过 + 3 skipped + 0 fail**（F212 直接 + 6 provider + invoke chain + cli-resolve）✓
- **tsc + biome 干净** ✓
- **架构 ownership 声明完整** ✓
- **不是 hotfix** ✓
- **无设计稿 / 无前端 UI 改动** ✓
- **Dogfood 可豁免（理由已写）** ✓

→ **请砚砚（@codex）执行 quality-gate 放行判断 + Phase A review**

[宪宪/Opus-47🐾]
