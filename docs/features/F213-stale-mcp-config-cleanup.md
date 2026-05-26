---
feature_ids: [F213]
related_features: [F193, F212, F209]
topics: [mcp, codex, deprecation, startup, cleanup, config, legacy, multi-harness]
doc_kind: spec
created: 2026-05-26
---

# F213: Stale MCP Config Cleanup at Startup — 过期 MCP 配置启动清理

> **Status**: spec | **Owner**: 布偶猫/宪宪 (Opus-47) | **Priority**: P1

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

- [ ] AC-A1: `deprecated-managed-servers.ts` 创建 + `DEPRECATED_MANAGED_SERVERS` registry 含 `cat-cafe` entry + `knownManagedMarkers` (argsSuffix + echoLegacyShim)
- [ ] AC-A2: `isOurOwnedDeprecatedEntry` helper 实现 + 单测覆盖 5 种 case：
  - args[0] 后缀 `packages/mcp-server/dist/index.js` → true
  - args[0] `["legacy-shim"]` + command `"echo"` → true
  - 未知第三方 binary path → false
  - 文件不存在 → false
  - args 字段缺失 / 类型错误 → false (defensive)
- [ ] AC-A3: `writeCodexMcpConfig` 加 cleanup logic + 单测覆盖 4 case (4×2=8 实际 assertion)：
  - existing config 有自家 legacy → 删除 + warn
  - existing config 有第三方 cat-cafe → 保留 + warn
  - existing config 没 legacy → no-op
  - cleanup 不影响 split server entry 写入
- [ ] AC-A4: `CodexAgentService.ts` 删 helper 全部 + L257 调用 + import 清理；`buildCatCafeMcpConfigArgs` 不为 legacy `cat-cafe` 注入 env
- [ ] AC-A5: codex-agent-service.test.js 删 round-1/2/3/4 legacy lookup test (4 个)，主测试 assert "不注入任何 `mcp_servers.cat-cafe.*`"

### Phase B（All-Harness Coverage）

- [ ] AC-B1: `writeGeminiMcpConfig` 加同 cleanup logic + 单测覆盖
- [ ] AC-B2: `writeClaudeMcpConfig` (`.mcp.json`) 加同 cleanup logic + 单测覆盖
- [ ] AC-B3: `writeAntigravityMcpConfig` 加同 cleanup logic + 单测覆盖
- [ ] AC-B4: 其他 harness writer audit + 文档 (Kimi / 未来 harness)
- [ ] AC-B5: cross-harness shared cleanup helper（避免 5 个 writer 各自重复 cleanup logic）

### Phase C（Documentation + ADR Sync）

- [x] AC-C1: ADR-036 amendment（已完成 2026-05-26）
- [ ] AC-C2: F193 spec 加 Phase C follow-up 节标注 implementation gap 补完
- [ ] AC-C3: lessons-learned 加教训条

### Phase D（Migration Communication）

- [ ] AC-D1: clowder-ai 同步 PR (outbound sync) 包含 cleanup mechanism + user 通信
- [ ] AC-D2: cat-cafe-runtime 同步（铲屎官手动）

### Phase E（Close + Vision Guard）

- [ ] AC-E1: 跨族愿景守护猫（非 47 / 非 reviewer 砚砚）跑愿景三问 — 候选：@opus / @sonnet / @gpt52
- [ ] AC-E2: CloseGateReport 全 AC met 或 cvo_signoff 降级
- [ ] AC-E3: 反思胶囊（5 轮 P1 saga + 坐标系 reframe + ADR 验证缺位教训）
- [ ] AC-E4: PR #1894 close + 临时 workaround 文档化 + 社区小伙伴通知

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
| OQ-1 | `knownManagedMarkers` 是 array 还是 union type？我用 array 灵活但需要 `kind` discriminator —— 砚砚 review pattern | ⬜ 待砚砚 review |
| OQ-2 | log.warn 信息要不要 i18n？现在英文 mixed 中文 reason —— 用户语言场景 | ⬜ 待评估 |
| OQ-3 | Cleanup 是否在 dry-run 模式提供？管理员/调试 case ("show what would be cleaned without actually removing") | ⬜ 待评估，可能 Phase E follow-up |
| OQ-4 | Owner marker 未来设计：要不要 inject 一个 cat-cafe specific TOML comment 标识 managed entries (e.g. `# cat-cafe-managed: 2026-05-26`)? | ⬜ 待 collaborative-thinking |
| OQ-5 | Phase B 多 harness scope：Kimi / 未来 harness 这次一起做还是 Phase E 单独做？倾向"全部一起，避免遗漏" | ⬜ 待评估 |

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
| TBD | Phase A 实施 (worktree → TDD → review → merge) |

## Review Gate

- Phase A/B: 砚砚 (@codex GPT-5.5) cross-family review — 安全分析 / 测试覆盖 / marker 准确性
- Phase C/D: 47 self-review (doc-only)
- Phase E close: 愿景守护猫 @opus / @sonnet / @gpt52 候选（非作者非 reviewer）

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
