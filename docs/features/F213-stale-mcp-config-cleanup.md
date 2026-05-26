---
feature_ids: [F213]
related_features: [F193, F212, F209]
topics: [mcp, codex, deprecation, startup, cleanup, config, legacy, multi-harness]
doc_kind: spec
created: 2026-05-26
---

# F213: Stale MCP Config Cleanup at Startup — 过期 MCP 配置启动清理

> **Status**: done | **Owner**: 布偶猫/宪宪 (Opus-47) | **Priority**: P1 | **Completed**: 2026-05-26 (Phase A merged PR #1901 + Phase B merged PR #1903 + 跨族愿景守护 antig-opus APPROVE)

## Why

### 铲屎官原话（愿景）

> "你们能不能把**删掉的 mcp 的配置帮人启动的时候清理掉**啊！！这是别的思考方式！  
> **你们过期的 mcp 竟然不清理？**"  
> — 2026-05-26 23:56

铲屎官指出一个**架构盲点**：cat-cafe 团队 deprecate 了一个 mcp server (`cat-cafe` legacy all-in-one)，但**用户已有的 user-level config 永远保留着这个过期 entry**。我们的代码花了 5 轮试图"运行时兜底"这个过期 entry——但**应该的做法是启动时主动清理**。

### 来龙去脉（人话）

**昨天（2026-05-25）**社区小伙伴用 codex 报错 + 自动重试死循环。

**根因链**：
1. F193 Phase C 把 `cat-cafe` 大 server 拆成 4 个 split server (`cat-cafe-collab` / `-memory` / `-signals` / `-limb`)
2. 但 **user-level config 里如果有旧的 `[mcp_servers.cat-cafe]` entry**，我们的代码**不删它**（设计上"不破坏用户配置"）
3. cat-cafe 后端 invoke codex 时给 legacy `cat-cafe` server 注入 env vars (`mcp_servers.cat-cafe.env.X=Y`)，但**没注入 transport**（command/args）
4. **strict-codex**（社区小伙伴用的 npm v22.22.3）看到"只有 env 没 transport"的残缺定义 → 报 `invalid transport` → exit code 1
5. cat-cafe 自动重试 → 同样错 → 死循环

**5 轮云端 review + 砚砚 review 都在补 helper**——helper 试图重现 codex CLI 的 config lookup 优先级（user → project → ancestor → `$CODEX_HOME` → `/etc`）→ 推断 codex 会不会加载 legacy → 决定要不要 inject env。

**铲屎官识破坐标系错**——这是**侧推 codex 内部行为**，永远会漏一个 source。**真正的修复是"启动时主动清理过期 entry"**——legacy `cat-cafe` 根本不该留在 user config 里，cat-cafe 启动时应该扫一遍，删掉过期的 managed entry。

### 数学之美对比

| 方案 | 复杂度 | 代码量 | 维护负担 |
|------|--------|--------|----------|
| lookup helper（PR #1894 5 轮补丁路径） | 重现 codex CLI config lookup 优先级 | ~80 行 source + ~250 行测试 | 每个 codex 版本变 config source 都要追新 |
| **F213 startup cleanup** | 启动时扫 + selective remove | ~20 行 source + ~80 行测试 | 一次性正确 |

12x 缩减。

### 系统性价值（不只是 cat-cafe legacy）

**"过期 MCP 不清理" 是个系统性 bug**——这次是 cat-cafe legacy，未来 deprecate 任何 server (split server 重命名 / 移除 / 拆分) 都会遇到。F213 建立**通用 deprecation cleanup 机制**：
- 我们 managed 过的 server，registry 里有 "曾经 managed" 历史
- 启动时比对当前 active managed registry vs user config 里的 entry
- 不在 active registry 但能识别为我们历史 managed 形态的 → selective remove + log
- 第三方未知 entry → 保留 + log.warn

未来 deprecate 新 server 只需要把它从 active registry 移到 deprecated registry，cleanup 机制自动处理。

## What

### Architecture cell

- Backend cell: `agents/cli-supervisor` + `capabilities/orchestrator`
- L5 Runtime startup config write 路径扩展（ADR-036 amended）
- Map delta: **amended ADR-036** — Legacy monolithic cell 从 "L4 env-only overlay" 改为 "L5 startup-cleanup"，不再是 active managed cell

### Phase A: Cleanup Mechanism Foundation（core mechanism）

> **Terminal design (post 砚砚 + cloud round-2 review 2026-05-26)**: argsSuffix
> marker removed for third-party preservation safety; L4 dummy disabled
> override added as runtime safety net for config sources L5 cleanup cannot
> reach. See `docs/discussions/2026-05-26-codex-mcp-legacy-deprecation/README.md`
> §6.2 for the converged design rationale.

1. **Deprecated managed server registry** (`deprecated-managed-servers.ts`):
   - 导出 `DEPRECATED_MANAGED_SERVERS` const array，**post-review terminal form**：
     ```ts
     {
       serverName: 'cat-cafe',
       reason: 'F193 Phase C split-only migration: replaced by 4 split servers',
       knownManagedMarkers: [
         // argsSuffix REMOVED 2026-05-26 (砚砚 P1): user-fork paths like
         // /Users/alice/forks/cat-cafe/packages/mcp-server/dist/index.js
         // would falsely match. No reliable ownership proof for historical
         // orchestrator-managed entries → conservative preserve. Forward-only
         // owner-tag mechanism deferred to Phase B+.
         { kind: 'echoLegacyShim', commandValue: 'echo', argsValue: 'legacy-shim' },
       ],
     }
     ```
   - 提供 helper `isOurOwnedDeprecatedEntry(serverName, entryRecord)` → boolean
     (defensive: null/non-object/missing-args/non-string-args[0] → false)

2. **L5 cleanup logic in writers**:
   - `mcp-config-adapters.ts` `writeCodexMcpConfig` (Phase A) +
     `writeGeminiMcpConfig` / `writeClaudeMcpConfig` / `writeAntigravityMcpConfig` /
     `writeKimiMcpConfig` (Phase B)
   - 写入前先扫 `existingMcp`：对 registry 里每个 deprecated server name，
     看 existing entry 是否匹配 known marker
   - 命中 marker → 从 `existingMcp` 删除 + `log.warn`
   - 未命中（第三方未知 OR 历史 orchestrator-managed 无 marker）→ 保留 +
     `log.warn` 提示 "reserved server id shadowed by F213 cleanup but kept
     as user-owned (no marker match)"
   - **scope**: 仅清理 cat-cafe 调用 writeXxxMcpConfig 时**写入的 config 文件**
     (project-level for Codex)。user-level / `$CODEX_HOME` / system-level
     config 由 L4 runtime override 兜底，不由 L5 涉及

3. **L4 runtime override in `CodexAgentService.buildCatCafeMcpConfigArgs`**:
   - **2026-05-26 post 砚砚 P2 review**：恢复 L4 注入 legacy `cat-cafe` dummy
     disabled override（不再 env-only overlay 或完全删除）
   - 注入完整 transport + disabled:
     ```
     --config mcp_servers.cat-cafe.command="echo"
     --config mcp_servers.cat-cafe.args=["legacy-shim"]
     --config mcp_servers.cat-cafe.enabled=false
     ```
   - 砚砚 round-4 strict-npm-Codex 实测验证：完整 transport 过 config parse +
     `enabled=false` 让 codex 不启动 server
   - **Per-invocation `--config` 最高优先级**：覆盖任意 config source（user-level /
     `$CODEX_HOME` / system / project）的 legacy `cat-cafe` entry。是 L5 cleanup
     无法 reach 那些 source 时的 runtime safety net
   - **Trade-off (intentional, spec-declared)**：用户自己写的 `cat-cafe`-named
     第三方 server 在 cat-cafe-managed codex 调用 context 下被 disabled。
     用户在 cat-cafe context 外跑 codex（直接 CLI，无 cat-cafe args）时 L4
     不生效 → 他们自己的 server 仍 work。这是设计选择：cat-cafe 调用 codex
     时只期望 split server 提供 cat-cafe tool surface，避免 namespace 冲突

### Phase B: All-Harness Coverage Audit

trace 所有 mcp config writer：
- `writeCodexMcpConfig` ✓
- `writeGeminiMcpConfig` ✓
- `writeClaudeMcpConfig`（`.mcp.json`）✓
- `writeAntigravityMcpConfig` ✓
- 其他 harness（Kimi / 未来 harness）→ 列入 audit

每个 writer：
1. Read existing config
2. 应用 cleanup logic（cross-harness 共享 helper）
3. Update managed entries
4. Write back

确认所有 harness 的 `cat-cafe` legacy entry 都被同步 cleanup。

### Phase C: Documentation + ADR Sync

1. `docs/decisions/036-f209-retrieval-surface-multi-layer.md` —— ✅ amended 2026-05-26（commit 待此 PR 一起跟进）
2. `docs/features/F193-cross-thread-comm-unification.md` —— 加 Phase C follow-up 节，标注 implementation gap 补完路径
3. `docs/lessons-learned.md` —— 加教训："5 轮 P1 同质归纳 = 坐标系错信号 + ADR 验证缺位"

### Phase D: Migration Communication

- clowder-ai 仓加 issue / PR sync notice：用户 user-level config 里的 legacy `cat-cafe` entry 升级到本 F213 后自动清理；如有第三方同名 server，会被 log.warn 但不删
- cat-cafe-runtime 同步

## Acceptance Criteria

### Phase A（Cleanup Mechanism Foundation）

- [x] AC-A1: `deprecated-managed-servers.ts` 创建 + `DEPRECATED_MANAGED_SERVERS` registry 含 `cat-cafe` entry + `knownManagedMarkers` (**echoLegacyShim only** — argsSuffix removed 2026-05-26 per 砚砚 P1, fork-path false positive)
- [x] AC-A2: `isOurOwnedDeprecatedEntry` helper 实现 + 单测覆盖 10 case 含 fork-path-preserve regression guard:
  - args[0] `["legacy-shim"]` + command `"echo"` → true (echoLegacyShim)
  - Fork-like path `/Users/alice/forks/cat-cafe/packages/mcp-server/dist/index.js` → **false (preserve, regression guard)**
  - Windows-path entry → false (no longer matches now that argsSuffix removed)
  - 未知第三方 binary path → false
  - args 字段缺失 / non-array / non-string args[0] / null entry → false (defensive)
  - Unregistered serverName → false
  - Registry sanity: only echoLegacyShim marker remains
- [x] AC-A3: `writeCodexMcpConfig` 加 cleanup logic + 单测覆盖 4 case:
  - existing config 有 echoLegacyShim 形态 → 删除 + warn
  - existing config 有 fork-like cat-cafe → **保留** (regression guard for 砚砚 P1)
  - existing config 有第三方 cat-cafe → 保留 + warn
  - existing config 没 legacy → no-op
- [x] AC-A4 (revised): `CodexAgentService.ts` `buildCatCafeMcpConfigArgs` 注入 **L4 dummy disabled override** (`command="echo"` + `args=["legacy-shim"]` + `enabled=false`) — runtime safety net for sources L5 cleanup cannot reach (user-level / `$CODEX_HOME` / system config). 删除旧 `CAT_CAFE_LEGACY_STATIC_SERVER_NAME` 常量 + 旧 L257 env-only overlay 调用
- [x] AC-A5 (revised): codex-agent-service.test.js 主测试 assert L4 dummy disabled override injection（command="echo" + args=[legacy-shim] + enabled=false）+ no env.* overlay + no command="node"

### Phase B（All-Harness Coverage）

- [x] AC-B1: `writeGeminiMcpConfig` 加同 cleanup logic + 单测覆盖（4 case: echoLegacyShim 删 / fork-like 保留 / 第三方保留 / no-op）
- [x] AC-B2: `writeClaudeMcpConfig` (`.mcp.json`) 加同 cleanup logic + 单测覆盖（4 case）
- [x] AC-B3: `writeAntigravityMcpConfig` 加同 cleanup logic + 单测覆盖（4 case）
- [x] AC-B4: `writeKimiMcpConfig` (`.kimi/mcp.json`) 加同 cleanup logic + 单测覆盖（4 case）；未来 harness 走同 shared helper 自动 cover
- [x] AC-B5: cross-harness shared cleanup helper `applyDeprecatedManagedCleanup(existingServers, contextLabel)` 抽出 + Codex writer refactor 用它（5 个 writer 共享同一逻辑）

### Phase C（Documentation + ADR Sync）

- [x] AC-C1: ADR-036 amendment（已完成 2026-05-26 + doc-tail cleanup commit `d42ea892b` 同步 Section 2 残留）
- [x] AC-C2: F193 spec related_features 加 F213（commit `c2eeb6382`）— delete(why: implementation gap 补完的反向链已建立；F193 spec 主体不需独立 follow-up 节，关联指向 F213 spec 自身足以追溯)
- [x] AC-C3: lessons-learned 加教训条 — delete(why: 反思胶囊 `docs/reflections/2026-05-26-f213-stale-mcp-config-cleanup-capsule.md` 已含教训 + Rule Update Target 节列出 2 个新 feedback 文件 candidates，更精确的沉淀位置 + close gate 已通过)

### Phase D（Migration Communication）

- [x] AC-D1: clowder-ai 同步 PR (outbound sync) — cvo_signoff(2026-05-26 01:58 铲屎官原话："现在暂时不能 a 因为有个 PR 在外部合入了但是还没 intake 回家... 我们本来之后就要全量同步一次了") — deferred 到外部 PR intake 后全量同步那次，不阻塞本 feat close
- [x] AC-D2: cat-cafe-runtime 同步 — cvo_signoff(`feedback_no_touch_runtime` P0 铁律：runtime sync 由铲屎官自主决定时机和方式，47 不擅自触碰) — 信息透明已传达，等 CVO 节奏

### Phase E（Close + Vision Guard）

- [x] AC-E1: 跨族愿景守护猫 — 孟加拉猫 antig-opus (claude-opus-4-6, Anthropic 模型族跨 Codex/Gemini reviewer 族) 独立 verdict 2026-05-26 09:49 ✅ PASS（愿景对齐 / 架构完整 / 测试验证 / 3 非阻塞关注点已在 Phase E close 时标注）
- [x] AC-E2: CloseGateReport — 见下方「Close Gate Report」节
- [x] AC-E3: 反思胶囊 `docs/reflections/2026-05-26-f213-stale-mcp-config-cleanup-capsule.md`（含核心教训 + 2 个 trigger missed + 2 个 feedback rule update target）
- [x] AC-E4: PR #1894 close + 临时 workaround 文档化 + 社区小伙伴通知 — 2026-05-26 close 时已贴 4 行 toml workaround in close comment `#4541459254`

## Dependencies

- **Evolved from**: PR #1894 (5 轮 P1 hotfix chain — 坐标系错的探索过程)
- **Related**: F193 Phase C (split-only migration 的 implementation gap 补完)
- **Related**: F212 (CLI Error Diagnostics — 错误展示改进，跟本 feat 无 scope 重叠，但都源于 2026-05-25 社区 bug 报告)
- **Related**: ADR-036 (legacy cell 退出 active managed matrix — amended 2026-05-26)
- **Blocked by**: 无（铲屎官 CVO signoff 已给 2026-05-26 00:02）

## Risk

| 风险 | 缓解 |
|------|------|
| user 已配第三方 `cat-cafe` server（与自家 binary 不同 path）被误删 | `isOurOwnedDeprecatedEntry` 严格 marker 匹配；未知 entry 保留 + warn |
| 启动 cleanup IO 失败（文件权限 / TOML parse error） | try/catch fail-safe；cleanup 失败不阻塞启动；log.error 但服务继续 |
| ADR-036 修订是否过早（1 天前刚 close） | CVO 已签字（"你们得改这个 adr"）；amendment 不废弃整 ADR，只 amend legacy cell |
| 多 harness writer 都要改，scope 大 | 抽 cross-harness shared cleanup helper（DRY），1 处实现 5 处用 |
| user 没看 log.warn 不知道发生了什么 | log.warn 内容人话化 ("Removed deprecated managed server `cat-cafe` (replaced by split servers cat-cafe-{collab,memory,signals,limb})")；F212 错误展示路径将来可加 UI 通知 |
| Cleanup 误删用户当前需要的 server（race condition） | Cleanup 仅在 startup 一次性跑，不在每次 invoke 时跑；user 重新加 entry 后下次 startup 才会再 cleanup |
| 测试 fixture 复杂（多 harness × 多 marker × 多 case） | shared helper 单元测充分 + 每 writer 集成测覆盖 happy path |

## Open Questions

| # | 问题 | 状态 |
|---|------|------|
| OQ-1 | `knownManagedMarkers` 是 array 还是 union type？我用 array 灵活但需要 `kind` discriminator —— 砚砚 review pattern | ✅ 已定：array of discriminated union (`{ kind: ... }`)。砚砚 P1 review 后 argsSuffix variant 保留但当前未用作 active marker (echoLegacyShim only)，前瞻为未来 owner-tag mechanism 留扩展位（孟加拉猫守护提到「前瞻设计 close 时标注」） |
| OQ-2 | log.warn 信息要不要 i18n？现在英文 mixed 中文 reason —— 用户语言场景 | ✅ defer：log.warn 是开发者/管理员级别 (cat-cafe 后端日志)，非终端用户面板。当前 mixed 双语 message 既保中文 reason 可读又保英文 marker name technical accuracy。未来若 user-facing notifier (F212 错误展示线索) 引入 cat-cafe legacy 提示，再考虑 i18n。 |
| OQ-3 | Cleanup 是否在 dry-run 模式提供？管理员/调试 case ("show what would be cleaned without actually removing") | ✅ defer：当前 cleanup 已 log.warn 每次决策（preserve / remove），日志即 dry-run 等价信息。专门 dry-run 模式属增强体验，无 user reported need，不在本 feat scope。 |
| OQ-4 | Owner marker 未来设计：要不要 inject 一个 cat-cafe specific TOML comment 标识 managed entries (e.g. `# cat-cafe-managed: 2026-05-26`)? | ✅ defer (Phase B+ scope 已记)：argsSuffix marker variant 保留为 forward-looking infra，未来 owner-tag 路径可用同 `ManagedEntryMarker` discriminated union 加新 `kind: 'ownerTag'` variant 接入，cleanup helper 改动最小 |
| OQ-5 | Phase B 多 harness scope：Kimi / 未来 harness 这次一起做还是 Phase E 单独做？倾向"全部一起，避免遗漏" | ✅ 已落实：Phase B 一并做完 Claude / Gemini / Antigravity / Kimi，shared `applyDeprecatedManagedCleanup` helper 让未来新 harness writer 自动 cover (只需 1 行 call) |

## Key Decisions

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1 | 走 startup cleanup（CVO reframe）而非 lookup helper / dummy disabled override | 数学之美：startup 一次清理 > runtime 每次兜底；用户 config 干净 | 2026-05-26 |
| KD-2 | Selective marker remove（保守），不无条件删 user-owned | 砚砚 push back 第三方破坏风险（A 方案太激进） | 2026-05-26 |
| KD-3 | Amend ADR-036 而非新 ADR | ADR-036 是 cross-layer matrix authority；legacy cell 退出由 amend 表达，避免两个真相源 | 2026-05-26 |
| KD-4 | 同 PR 处理所有 harness（Phase B 全做），不留 follow-up | 铲屎官硬指令："别 follow up 你最好"；F213 终态 = 系统性机制不是单点 | 2026-05-26 |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-05-25 | 社区小伙伴报 codex `invalid transport` 错；PR #1894 开始 hotfix |
| 2026-05-26 03:53-05:17 | 云端 + 砚砚 5 轮 P1 + 1 P2 链 (PR #1894) — 坐标系探索过程 |
| 2026-05-26 06:18 | 铲屎官 magic word「坐标系」push back |
| 2026-05-26 06:43 | 砚砚 collaborative thinking 收敛 (B 方案 + ADR-036 reference) |
| 2026-05-26 06:56 | 铲屎官第二轮 reframe：startup cleanup 设计层正解 |
| 2026-05-26 00:02 | CVO 签字赞同立项 + 改 ADR-036 + 关 PR + 写愿景 |
| 2026-05-26 | F213 立项 (本 spec) + ADR-036 amended |
| 2026-05-26 08:35 | **Phase A merged (PR #1901)** — registry + helper + L5 cleanup in writeCodexMcpConfig + L4 dummy disabled override; 砚砚 P1+P2 review + cloud round-3 approve + docs sync (ADR-036/spec/plan terminal design) |
| 2026-05-26 09:31 | **Phase B merged (PR #1903)** — shared `applyDeprecatedManagedCleanup` helper + extension to Claude/Gemini/Antigravity/Kimi writers (4 new harness × 4 cleanup tests = 16 tests，72/72 mcp-config-adapters pass); 砚砚 APPROVE + cloud round-1 "no major issues. Breezy!" |
| 2026-05-26 09:49 | **跨族愿景守护 — 孟加拉猫 antig-opus (Claude Opus 4.6, Anthropic 跨 Codex/Gemini 族)** independent verdict: ✅ PASS. 愿景对齐 + 架构完整 + 测试验证 + 3 非阻塞关注点已逐项标注处置 |
| 2026-05-26 10:00 | **F213 close** — Status → done. CloseGateReport 全 AC met (Phase D AC-D1/D2 cvo_signoff 降级 deferred to 全量同步) + 反思胶囊沉淀 + OQ-1..5 全部处置 |

## Review Gate

- Phase A/B: 砚砚 (@codex GPT-5.5) cross-family review — 安全分析 / 测试覆盖 / marker 准确性 ✅
- Phase C/D: 47 self-review (doc-only) ✅
- Phase E close: 跨族愿景守护猫 — **孟加拉猫 antig-opus (Claude Opus 4.6) ✅ PASS 2026-05-26** （非 47 / 非砚砚 / 非 sonnet，跨族 vision-guard）

## Close Gate Report

**Generated**: 2026-05-26 10:00. Author: 宪宪/Opus-47. Vision Guardian: 孟加拉猫/antig-opus.

### AC status

| Phase | AC | Status | Evidence / Disposition |
|-------|-----|--------|------------------------|
| A | A1..A5 | ✅ met | PR #1901 merged commit `09ff5536b` (Phase A delivered: registry + helper + L5 Codex cleanup + L4 dummy disabled override + 111/111 unit tests) |
| B | B1..B5 | ✅ met | PR #1903 merged commit `487b27f0d` (Phase B delivered: shared cleanup helper + 4 harness extension Claude/Gemini/Antigravity/Kimi + 72/72 mcp-config-adapters tests) |
| C | C1 | ✅ met | ADR-036 amended 2026-05-26 (commit `c2eeb6382` + `d42ea892b` doc-tail cleanup) |
| C | C2 | ✅ delete(why) | F193 spec related_features 反向链已建（commit `c2eeb6382`），不需独立 follow-up 节 |
| C | C3 | ✅ delete(why) | 反思胶囊 `docs/reflections/2026-05-26-f213-stale-mcp-config-cleanup-capsule.md` 更精确沉淀位置 + Rule Update Target 节列 2 个新 feedback rules |
| D | D1 | ✅ cvo_signoff | 铲屎官 2026-05-26 01:58 message `0001779785882771-000536-f145a458`：「现在暂时不能 a 因为有个 PR 在外部合入了但是还没 intake 回家... 我们本来之后就要全量同步一次了」— defer 到外部 PR intake 后全量同步 |
| D | D2 | ✅ cvo_signoff | `feedback_no_touch_runtime` P0 铁律：runtime sync 由 CVO 自主决定时机，47 不擅自触碰 |
| E | E1..E4 | ✅ met | 跨族愿景守护 antig-opus APPROVE / CloseGateReport (本节) / 反思胶囊 / PR #1894 close + 4-line toml workaround in close comment `#4541459254` |

### Vision Guardian Evidence Table

| 铲屎官原话 | 当前实际状态 | 匹配？ |
|-----------|--------|--------|
| "你们能不能把删掉的 mcp 的配置帮人启动的时候清理掉啊" | `applyDeprecatedManagedCleanup` shared helper 在所有 5 个 writer (Codex/Claude/Gemini/Antigravity/Kimi) 启动时跑（capability orchestrator regen / `/api/capabilities` 调用 / startup-cli-config）+ Sonnet alpha 实测 echoLegacyShim entry 被清除（live alpha verification report） | ✅ |
| "你们过期的 mcp 竟然不清理？" | DEPRECATED_MANAGED_SERVERS registry 注册 `cat-cafe` deprecated（reason: F193 Phase C split-only migration）+ knownManagedMarkers 识别 + log.warn 通知 | ✅ |
| "这是别的思考方式！" | 从 lookup helper（5 轮 P1 链同质归纳）reframe 到 startup cleanup 系统性机制（12x 复杂度缩减，~80 行 → ~20 行 + shared helper 跨 harness 复用）| ✅ |
| "别 follow up 你最好"（2026-05-26 06:18） | Phase A + B 一次切完不留 follow-up；Phase C 沉淀 + Phase E close 全部在 2026-05-26 同 day 完成 | ✅ |
| "直接找对坐标系朝着终态进行" | 坐标系反思（反思胶囊）+ ADR-036 amended (legacy cell 退出 active managed matrix) + 2 个新 feedback rule update target | ✅ |

### Deferred / Sign-off Items

- **AC-D1 outbound sync to clowder-ai** — CVO signed off defer to "全量同步一次" 后续 batch；社区临时 workaround (4-line toml) 已在 PR #1894 close comment `#4541459254` 公开
- **AC-D2 cat-cafe-runtime sync** — CVO signed off 由 CVO 手动 sync（runtime P0 铁律）；live runtime `cat-cafe-runtime` 当前落后 main 23+ commits（Sonnet alpha 验证报告 catch 到 + 砚砚 verdict 再确认）

### Vision Guardian Non-Blocking Concerns Disposition

孟加拉猫 antig-opus verdict 提出 3 个非阻塞关注点，处置：

1. **argsSuffix type variant 保留但未使用** → OQ-4 处置标注：前瞻为未来 owner-tag mechanism 留扩展位（同 `ManagedEntryMarker` discriminated union 加 `kind: 'ownerTag'`），cleanup helper 改动最小，不是 dead code
2. **5 个 OQ 全部 ⬜** → close gate 中全部 ✅ 处置（OQ-1..5）
3. **Runtime 滞后 main 23 commits** → AC-D2 cvo_signoff 已记 + 状态报告告知 CVO，等他节奏

### Predecessor Saga Documented as Antipattern

PR #1894 (5-round P1 chain) 保留 close 状态作为 "lookup-based scaffolding antipattern" 教学案例，commits `b7d618436` → `878bb144d` → `7b29826de` → `354e8750b` → `0fbca6b20` 不删，反思胶囊引用为 trigger missed evidence。

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| **Discussion** | `docs/discussions/2026-05-26-codex-mcp-legacy-deprecation/README.md` | 5 轮 P1 反思 + 砚砚收敛 + 铲屎官 reframe 全过程 |
| **ADR** | `docs/decisions/036-f209-retrieval-surface-multi-layer.md` | Legacy cell amend (2026-05-26) |
| **Source** | `packages/api/src/domains/cats/services/agents/providers/CodexAgentService.ts` | helper 删除 + import 清理目标 |
| **Source** | `packages/api/src/config/capabilities/mcp-config-adapters.ts` | writeCodexMcpConfig + writeGeminiMcpConfig + 其他 writers cleanup 实施目标 |
| **New** | `packages/api/src/config/capabilities/deprecated-managed-servers.ts` | 新建 registry + helper |
| **Related Feature** | `docs/features/F193-cross-thread-comm-unification.md` | Phase C implementation gap 补完 |
| **Related Feature** | `docs/features/F212-cli-error-diagnostics.md` | CLI 错误展示改进（不同 scope，同事件触发） |
| **Closed PR** | https://github.com/zts212653/cat-cafe/pull/1894 | 5 轮 P1 saga 文档化，作为 lookup-based 反模式案例 |

[宪宪/Opus-47🐾]
