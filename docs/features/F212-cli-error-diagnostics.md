---
feature_ids: [F212]
related_features: [F153, F118, F173]
topics: [cli, error-handling, diagnostics, sanitizer, frontend, observability]
doc_kind: spec
created: 2026-05-25
---

# F212: CLI Error Diagnostics — 结构化 CLI 错误诊断 + 受控前端展示

> **Status**: spec | **Owner**: 布偶猫/宪宪 (Opus-47) | **Priority**: P1

## Why

社区小伙伴遇到 `codex exec` 退出，前端只显示 `Error: Codex CLI: CLI 异常退出 (code: 1, signal: none)`——**没有任何定位信息**。GLM-5 顺着代码 + 注释**编造**了一套 "invalid transport" 因果链，我在本地实测复现失败（codex-cli 0.133.0 不报错），这次"自信但错"的报告恰恰最危险。

铲屎官原话（2026-05-25 19:14）：
> 我们这里前端显示的不完整？这样让铲屎官很迷惑，我们能不能打印完整的报错啊 而不是那一行 codex cli 退出了

### 当前代码事实

`packages/api/src/utils/cli-spawn.ts` L518-533：
- stderr 被**完全屏蔽**不传前端（注释自我标榜 "may contain thinking/traces"）
- `classifyKnownCliStderr` 白名单只覆盖 2 类（`invalid_thinking_signature` / `missing_rollout`）
- L520-522 stderr 仍**无脑** `log.error` 到服务日志（砚砚 2026-02-08 P3-1 建议的 `LOG_CLI_STDERR=1` env gate 没落地）

### 威胁模型重审

注释假设 "stderr may contain thinking/traces" **站不住**：
- ✅ thinking / chain-of-thought 走 NDJSON stdout stream，不走 stderr
- ⚠️ stderr 实际承载：config 解析错误 / auth / quota / network / spawn error / model_not_found / panic 堆栈
- ⚠️ 真威胁是 **path + token 残留 + panic stack 内部 module path**，全部可分类化处理

**当前设计代价**：CVO 自己 + 全部社区用户失明 100%；真威胁也没堵住（panic 仍带堆栈）。

### 历史教训（2026-02-08 砚砚 review）

砚砚当时挡掉过同样的 `stderrTail` 直传方案：
> `stderrTail = stderrBuffer.trim().slice(-500)` 再 `yield { __cliError, stderr: stderrTail }`，本质上就是把高敏感的 trace/堆栈/路径/潜在 token 片段"喂给用户"；而且"最后 500 字"恰好是堆栈尾部/报错摘要最密集的区域，风险更高。

—— `docs/archive/2026-02/mailbox/2026-02-08/2026-02-08-cloud-cat-review-fixes-response-from-maine.md`

这次本 feat 走 **structured `cliDiagnostics` + `safeExcerpt` 只来自 classifier 白名单抽取**，不再走"sanitize 后 raw tail 直传"老路。

## What

### Architecture cell

- Backend cell: `agents/cli-supervisor`（cli-spawn 错误通道）
- Frontend cell: `frontend/chat-message-bubble`（错误展示面板）
- Map delta: **none**（扩展现有 payload 边界 + 新增折叠面板组件，不改 ownership map）

### Phase A: Backend cliDiagnostics + Sanitizer + Classifier 扩白名单

**核心设计转换**：把"什么算可暴露"从**黑名单兜底**改为**白名单准入**。

1. **structured `cliDiagnostics` payload**（替代当前 `__cliError.message` 字符串）：
   ```ts
   interface CliDiagnostics {
     reasonCode: CliErrorReasonCode;          // 已知错误类别（白名单）
     publicSummary: string;                   // i18n 标题（"API 认证失败" 等）
     publicHint: string;                      // 后端生成的人话提示（"检查 .env 中的 API key"）
     safeExcerpt?: string;                    // 仅当 classifier 抽取到安全片段时填，unknown 不填
     debugRef: {
       command: string;
       exitCode: number | null;
       signal: string | null;
       invocationId: string;
     };
   }
   ```

2. **Sanitizer util**（`packages/api/src/utils/sanitize-cli-stderr.ts`），处理顺序**先 sanitize 再截断**（避免从 token 中间截尾绕过黑名单）：
   - ANSI / OSC 控制序列清理（`\x1b\[[...]`、`\x1b\]...\x07`）
   - NFKC normalize（防 unicode homograph bypass）
   - Path redaction：`$HOME` / project root / `/tmp/*` / Windows `C:\Users\...` → `~/...`
   - JWT pattern：`eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+` → `[JWT_REDACTED]`
   - PEM block：`-----BEGIN .* PRIVATE KEY-----[\s\S]*?-----END .*-----` → `[PEM_REDACTED]`
   - URL query 全量 redact（或敏感键白名单：`key/token/secret/auth/cookie/session/callbackToken`）
   - Cookie / `Set-Cookie` header redact
   - Token patterns（按 provider）：
     - OpenAI / Anthropic：`sk-[A-Za-z0-9_-]{20,}`
     - GitHub：`gh[pousr]_[A-Za-z0-9]{36,}` / `github_pat_[A-Za-z0-9_]{82,}`
     - npm：`npm_[A-Za-z0-9]{36,}`
     - Gemini / Google：`AIza[0-9A-Za-z_-]{35}`
     - 通用 Bearer：`Bearer\s+[A-Za-z0-9_.\-+/=]+`
     - 通用 `(token|api[_-]?key|secret|password)["':=\s]+[^\s,}"]+`
   - Generic high-entropy secret（≥32 字符 + base64/hex pattern + 高熵）
   - 复用 / 对齐 F153 `TelemetryRedactor` Class A（凭证类）正则集合

3. **`classifyKnownCliStderr` 扩白名单**（覆盖 stderr + stream errors）：
   - `model_not_found`（`model.*not found` / `Unknown model`）
   - `auth_failed`（`401` / `Unauthorized` / `invalid api key`）
   - `quota_exceeded`（`429` / `quota` / `rate limit`）
   - `network_error`（`ETIMEDOUT` / `ECONNREFUSED` / `ENOTFOUND`）
   - `invalid_config`（`Error loading config\.toml` / `invalid transport`）
   - `spawn_failed`（`ENOENT` / `EACCES` 当 child 起不来）
   - `context_window_exceeded`（`context length` / `maximum context`）
   - 保留旧分类：`invalid_thinking_signature` / `missing_rollout`

4. **`safeExcerpt` 抽取规则**：
   - 仅当 `reasonCode !== undefined` 时填充
   - 从匹配 classifier regex 的位置抽取 5-8 行或 ≤1500 chars，**先 sanitize 再截**
   - panic stack 类**只保留 panic headline / error headline**，frame / 绝对路径 / cargo / node module path 全部隐藏
   - unknown stderr 不填 `safeExcerpt`，只填 `publicSummary='未识别的 CLI 错误'` + 提示"详细信息见后端日志"

5. **`LOG_CLI_STDERR` env gate**（兑现砚砚 2026-02-08 P3-1）：
   - 默认 `false`，stderr 不写服务日志
   - `LOG_CLI_STDERR=1` 显式启用，开发环境调试用
   - 写日志时仍走 sanitizer（防止内部记录泄露）

6. **Stream errors 覆盖**：Codex 的真实错误语义经常在 NDJSON stream `error` event 里，不在 stderr。classifier 也要扫描已 parse 的 stream error events，统一走 `cliDiagnostics` 通道。

### Phase B: Frontend 折叠面板透传

1. **Extra payload 透传链**：
   - `AgentMessage.extra` 加 `cliDiagnostics` 字段类型
   - `ChatMessage.extra` 同步
   - `bubble-event-adapter` 透传
   - reducer 不丢字段

2. **折叠面板组件**（参考 `TimeoutDiagnosticsPanel` 范式）：
   - 默认折叠（"查看详细错误"按钮）
   - 摘要 + hint 直接显示（小红条上方）
   - `safeExcerpt` 必须点开才显示（隐式 opt-in）
   - 按 `reasonCode` 选样式 / icon（auth → 🔑 / network → 🌐 / quota → ⏱ 等）

3. **i18n humanized hint 后端生成**：前端只渲染，不在 UI 层猜 regex（避免"两边都跑 regex"漂移）。

### Phase C: Alpha smoke + Close

1. 故意触发 codex / claude / gemini / antigravity 各类已知错误（auth / quota / model / network / invalid_config / spawn），看前端展示是否正确
2. 喂 fuzz stderr（含 token / path / panic / JWT / PEM）确认 sanitizer 不漏
3. CloseGateReport + 跨族愿景守护猫（非作者非 reviewer）
4. Merge

## Acceptance Criteria

### Phase A（Backend cliDiagnostics + Sanitizer）

- [ ] AC-A1: `cli-spawn.ts` `__cliError` payload 改为 `cliDiagnostics` structured 对象（含 reasonCode / publicSummary / publicHint / safeExcerpt? / debugRef）
- [ ] AC-A2: `sanitize-cli-stderr.ts` util 实现 + fuzz 单测覆盖（ANSI / NFKC / path / JWT / PEM / URL query / cookie / 5 类 provider token / generic high-entropy）
- [ ] AC-A3: Sanitizer 处理顺序 **先 sanitize 再截断**，单测验证"token 中间截尾"无法绕过
- [ ] AC-A4: `classifyKnownCliStderr` 扩到 8 类（含 model_not_found / auth_failed / quota_exceeded / network_error / invalid_config / spawn_failed / context_window_exceeded + 保留旧 2 类）
- [ ] AC-A5: `safeExcerpt` 仅当 `reasonCode !== undefined` 填充，unknown stderr 不填
- [ ] AC-A6: Panic stack 只保留 headline，frame / cargo / node module path 全部隐藏（单测验证）
- [ ] AC-A7: `LOG_CLI_STDERR` env gate 落地（默认关闭，砚砚 2026-02-08 P3-1）
- [ ] AC-A8: Classifier 同时扫 stderr + NDJSON stream error events（Codex code 1 真语义覆盖）
- [ ] AC-A9: **回归红线**：raw stderr 不进 user-facing message（守 2026-02-08 旧线）

### Phase B（Frontend 折叠面板）

- [ ] AC-B1: `AgentMessage.extra.cliDiagnostics` + `ChatMessage.extra.cliDiagnostics` 类型 + 透传链（bubble-event-adapter + reducer）
- [ ] AC-B2: 折叠面板组件（参考 `TimeoutDiagnosticsPanel`），默认折叠
- [ ] AC-B3: `publicSummary` + `publicHint` 直接显示；`safeExcerpt` 必须点开才显示
- [ ] AC-B4: 按 `reasonCode` 选 icon / 样式
- [ ] AC-B5: i18n hint 在后端生成（前端只渲染）

### Phase C（Alpha smoke + Close）

- [ ] AC-C1: 故意触发 codex / claude / gemini / antigravity 各类已知错误，每类截图验证前端展示
- [ ] AC-C2: Fuzz stderr smoke（含 token / path / panic / JWT / PEM），sanitizer 不漏
- [ ] AC-C3: CloseGateReport 全 AC met + 跨族愿景守护（非作者 = 非 47，非 reviewer = 非砚砚）

## Dependencies

- **Related**: F153（telemetry/log 脱敏，sanitizer 规则对齐 `TelemetryRedactor` Class A）
- **Related**: F118（CLI Liveness Watchdog，已 done，错误通道在它之后）
- **Related**: F173（前端消息管道统一，folded 面板复用既有透传机制）
- **Evolved from**: 无（铲屎官 2026-05-25 提的真实 bug）
- **Blocked by**: 无

## Risk

| 风险 | 缓解 |
|------|------|
| Sanitizer 黑名单永远会漏 | 用白名单准入（`safeExcerpt` 只从 classifier 抽），unknown stderr 不展示 raw tail |
| 处理顺序错（截后 sanitize）从 token 中间截尾 | **先 sanitize 再截**，单测显式验证 |
| panic stack 漏掉 frame redact | 只展示 headline 那一行，其他全砍（不做"sanitize 整段 stack"赌博） |
| Classifier 误判（A 错误被分成 B 类别） | reasonCode 表只决定文案样式，原始 reasonCode 在 telemetry 留痕便于追错 |
| 前端 i18n 漏 reasonCode | reasonCode 渲染 fallback：`Unknown ({reasonCode})` 显示英文 |
| 复用 F153 TelemetryRedactor 引入循环依赖 | 提取 sanitizer regex 到独立 util，F212 / F153 都 import，不直接 import 对方 |

## Open Questions

> **OQ 状态回填 2026-05-26**: 砚砚立项时（thread msg `0001779763858874-000118-afa69a71`, 2026-05-25 19:50）在 A2A 给了详细 5 条 review 意见（已固化 KD-1/KD-2/KD-3 的"收敛决策"侧），下面把那些意见对应映射到 OQ-1..5 的 accept/defer 状态。新 thread 的 F212 author 拿到这个表可直接进 writing-plans 不需重 ping 砚砚（除非有新发现）。

| # | 问题 | 状态 |
|---|------|------|
| OQ-1 | Sanitizer regex 是否复用 F153 `TelemetryRedactor` 还是独立维护？倾向独立 util `packages/api/src/utils/sanitize-cli-stderr.ts`（避免循环依赖），但 regex 来源 align 到 F153 | ✅ **accept (独立 util + regex 来源 align F153)** — 砚砚 review 列了 11 类 sanitizer 黑名单（ANSI/OSC 控制序列、NFKC normalize、HOME/project/tmp/Windows path redaction、JWT、PEM/private key block、URL query 全量或敏感键 redaction、cookie/session/callbackToken、GitHub/npm/Anthropic/OpenAI/Gemini common tokens、generic high-entropy secret）。F153 `TelemetryRedactor` Class A 凭证类 regex 提取到 shared `secret-patterns.ts` util，让 F212 sanitizer + F153 都 import，避免循环依赖。 |
| OQ-2 | `LOG_CLI_STDERR=1` 启用时，log 内容也要走 sanitizer 吗？倾向走（防止内部记录泄露） | ✅ **accept (启用时也走 sanitizer)** — 砚砚 review 隐含同意（"先对完整 stderr sanitize 再截断"作为通用原则）。log channel 是 service-internal 但仍可能持久化到日志系统，走同一 sanitizer 保护一致性。F213 反思胶囊教训：可观测路径泄露风险跟用户面板等同关注。 |
| OQ-3 | `safeExcerpt` 字符上限 1500 还是按行（5-8 行）？倾向"行优先 + 1500 上限保底" | ✅ **accept (行优先 + 1500 chars 上限保底 + unknown 不展示 excerpt)** — 砚砚原话："对 public excerpt：最多 5-8 行或 1500 chars，且只展示 classifier 抽出来的相关行。unknown 不展示。" 新 thread 实施时：safeExcerpt 字段仅在 `reasonCode !== undefined` 时填，跟"白名单准入"原则一致 |
| OQ-4 | Stream error event 的 schema 和 stderr classifier 是否共享 regex？倾向共享 regex 但分别接入 | ✅ **accept (共享 regex pattern lib + 双 entry-point)** — 砚砚原话："classifier 要覆盖 stderr + Codex recent stream errors。很多 Codex code 1 的真实语义在 stream error 里，不一定在 stderr。" 共享 regex pattern lib (`packages/api/src/utils/cli-error-patterns.ts` 或类似)，stderr classifier 和 stream-error classifier 各自 import + 各自 entry-point（同 reasonCode 输出）。 |
| OQ-5 | 前端 `reasonCode` → icon / 色板 映射要不要先发铲屎官审 wireframe？倾向**前端展示 = UX 改动**，要 Design Gate UX 确认 | ⬜ **defer 到新 thread Design Gate UX** — 砚砚 review 提到"前端用 `extra.cliDiagnostics` 渲染一个类似 `TimeoutDiagnosticsPanel` 的折叠面板"——意味着**复用现有组件 + reasonCode→icon/色板映射**，不需要从零审 wireframe。新 thread Phase B 启动时拍一张 `TimeoutDiagnosticsPanel` 现状截图 + 把 8 类 reasonCode 写一张映射表（auth → 🔑 / network → 🌐 / quota → ⏱ 等）给铲屎官 5 分钟过一遍即可，不算从零 Design Gate |

> **新 thread onboarding checklist**：
> 1. 读本 spec + F213 反思胶囊 `docs/reflections/2026-05-26-f213-stale-mcp-config-cleanup-capsule.md` 的 2 条核心教训（5 轮 P1 同方向 = 坐标系信号 / Reframe 前查 ADR）
> 2. OQ-1..5 状态已回填，**不需要重新 ping 砚砚 review spec**（除非新发现）
> 3. Phase A 开始：worktree → writing-plans → tdd
> 4. OQ-5 wireframe 在 Phase B 启动时再单独 ping 铲屎官
> 5. F213 反思胶囊的 trigger missed 参考但本 feat 不重复同坑：先 grep ADR-* 找架构 anchor (`grep -r 'ADR-' docs/decisions/ docs/features/`)

## Key Decisions

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1 | 走 structured `cliDiagnostics` 而非 sanitized raw tail | 黑名单永远会漏 → 白名单准入更安全（砚砚 2026-02-08 + 2026-05-25 两次坚守） | 2026-05-25 |
| KD-2 | Sanitizer 先 sanitize 再截断 | 反过来会从 token 中间截尾绕过黑名单 | 2026-05-25 |
| KD-3 | 一个 feat 一次切完 Phase A + B + C，不拆 "hotfix + follow-up" | "层 1 hotfix + 层 2 follow-up" 是布偶猫"下次一定"病 | 2026-05-25 |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-05-25 | 立项（铲屎官提出 UX 痛点 + 砚砚同意做 + Design Gate 五条意见全部 buy） |
| 2026-05-26 | 第二个 trigger 证据：社区 issue [zts212653/clowder-ai#777](https://github.com/zts212653/clowder-ai/issues/777) — opencode + DeepSeek 用户配置 `deepseek-v-4`（模型名拼错），DeepSeek API 400 + 详细 message 在 NDJSON stream error event 里，但前端只显示 `布偶猫 completed without textual output.`。AC-A8（classifier 扫 stream error events）正面命中此场景；spec 不变 |

## Review Gate

- Phase A: 砚砚（@codex GPT-5.5）review — 安全分析 / 测试覆盖（特别盯 sanitizer fuzz + 旧红线回归）
- Phase B: 砚砚 review — 前端透传 + i18n 边界
- Phase C: 跨族愿景守护（非 47 非砚砚，候选：@opus / @sonnet / @gpt52）

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| **Source** | `packages/api/src/utils/cli-spawn.ts` (L518-533) | 当前 stderr 屏蔽点 |
| **Source** | `packages/api/src/utils/cli-spawn.ts` (L28-36) | 当前 `classifyKnownCliStderr` 白名单 |
| **Historical Review** | `docs/archive/2026-02/mailbox/2026-02-08/2026-02-08-cloud-cat-review-fixes-response-from-maine.md` | 砚砚 2026-02-08 挡 `stderrTail` 直传的原始 review，含威胁向量清单 |
| **Related Feature** | `docs/features/F153-observability-infra.md` | TelemetryRedactor 四级脱敏（sanitizer 规则来源） |
| **Trigger** | 2026-05-25 社区小伙伴 codex code 1 截图 + GLM-5 误诊故事 | Bug 报告（Codex stderr 屏蔽路径） |
| **Trigger** | 2026-05-26 社区 issue [zts212653/clowder-ai#777](https://github.com/zts212653/clowder-ai/issues/777)（masterkunm + opencode + deepseek-v-4） | Bug 报告（opencode NDJSON stream error event 路径 — AC-A8 覆盖） |

[宪宪/Opus-47🐾]
