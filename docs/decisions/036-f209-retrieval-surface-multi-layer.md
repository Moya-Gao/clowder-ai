---
adr: ADR-036
feature_ids: [F209]
related_features: [F193, F200]
doc_kind: decision
created: 2026-05-24
status: accepted
topics: [retrieval, mcp, codex, defaults, workspace-env]
---

# ADR-036: F209 Retrieval Surface — Multi-Layer Default & Ownership Matrix

> **Status**: Accepted | **Date**: 2026-05-24
> **Authors**: 布偶猫/宪宪 (Opus-47), 缅因猫/砚砚 (GPT-5.5)
> **Cell**: `memory` (retrieval) + `identity-session` (Codex invocation)
> **Trigger**: F209 D.0 readiness saga — 8 layered fixes (PR #1873 / #1874 / #1876 / #1877 / #1882) 触底闭环后的 retrospective

## Context

F209 (Evidence Recall Optimization) 在 D.0 readiness sprint 揭示一个 architectural blind spot：MCP `search_evidence` / `read_file_slice` 这条 user-visible 检索链路实际跨 **5 个独立配置层 × 2 种 server topology** 共 10 个 cell，每个 cell 都可能独立带 default / env / ownership，但 spec 和 review checklist 从未把这个矩阵显式建模。结果：D.0 readiness gate BLOCK 后，**8 个连续 PR** 才把所有 cell 的 default + workspace env + reprobe + dimension contract 对齐到 user 体感"一次重启全活"。

每一层在历史上独立设计、独立工作，但**没人画过它们怎么交互**。每个 PR 都是合理的局部修，但合起来暴露的是 **layered defaults silently 拼装出错误聚合行为**——典型例子是 PR #1882：tool description 说 `dimension=project (default)`，handler 漏 default，API legacy 默认 `all` 兜底 → `all` 把不健康的 global 向量库拉进来 → top-level degraded 污染默认搜索体感。每一层独自正确，合起来用户体验 broken。

本 ADR 不是 specification update（F209 spec 已迭代）。本 ADR 是 **architectural map + reviewer checklist**，让未来加新检索 layer / 修 default / 改 topology 的猫**必须把改动映射到这个 10-cell 矩阵**，避免 N+1 轮 hotfix saga。

## Decision

### 1. F209 Retrieval Surface 显式为 5-Layer 架构

| Layer | 文件 | 角色 | Default Authority | 修改 PR 必经 cell-mapping |
|-------|------|------|-------------------|---------------------------|
| L1 — REST API | `packages/api/src/routes/evidence.ts` + helpers | HTTP boundary，外部 REST caller 直接调 | **Legacy back-compat 默认必须保留**（不可单方面改 default 破坏 REST consumer） | 改 default = breaking change，需 deprecation cycle |
| L2 — MCP handler | `packages/mcp-server/src/tools/evidence-tools.ts` | MCP tool contract enforcement layer | **Modern Cat Café contract default**（tool description 即承诺，handler 实现必须对齐） | 任何 description 改动必须同步 handler default |
| L3 — MCP response wrapper | `evidence-tools.ts` formatters | 把 store 返回结构映射成 MCP response 文本 + structured fields | Surface fields presence (e.g. `entityMatches`) | 新增 store-side 字段时 wrapper 必须 surface |
| L4 — Codex per-invocation `--config` | `CodexAgentService.buildCatCafeMcpConfigArgs` | headless Codex 启动子 invocation 时 inline env / args 覆盖静态 config | **Highest precedence**（CLI override 覆盖静态 config） | per-invocation env 必须包含 workspace + callback envs |
| L5 — Runtime startup config write | `startup-cli-config.ts` + `mcp-config-adapters.ts` | 启动时生成 `.mcp.json` / `.codex/config.toml` 等静态 config 文件 | Bootstrap-time defaults，被 L4 per-invocation 覆盖 | 改 server list / env 时必须同时更新 split + legacy 两条 path |

### 2. F209 MCP Server Topology 显式为 2-Cell

> ⚠️ **AMENDED 2026-05-26 by F213**：Legacy monolithic cell 的 L4 env-only overlay
> 设计在 strict-codex（npm-installed @openai/codex）场景下不可行 — partial server
> definition (env without transport) 被 strict-codex 拒为 `invalid transport`。
> 新设计 = **startup-time selective cleanup**（F213），见下方 amendment block。
> Reviewer checklist (Section 4) 同步更新。

| Topology | server names | source | 何时存在 |
|----------|--------------|--------|----------|
| **Split** (F193 Phase C 后默认) | `cat-cafe-collab` / `cat-cafe-memory` / `cat-cafe-signals` / `cat-cafe-limb` | `cat-cafe` (managed by orchestrator) | 所有新 install 默认 + 老用户 startup regen 注入 |
| **Legacy monolithic** ~~(F193 后不删)~~ → **deprecated, startup-cleanup target (F213)** | `cat-cafe` | varies (历史 cat-cafe managed all-in-one / 第三方 external — 用户已有 entry 时多为前者) | F213 后：**startup 时识别 + selective remove**（仅匹配自家曾 managed 形态：`args[0]` 后缀 `packages/mcp-server/dist/index.js` / 我们给过的 echo legacy-shim workaround / 未来 owner marker）；第三方未知 entry 保留 + log.warn |

**关键 invariant（amended）**：~~L4 / L5 任何 env 写入操作必须独立覆盖这 2 个 topology cell~~。F213 后只剩 **Split** cell 为 active managed topology；Legacy monolithic 在 startup 时被清理，**不再要求 L4 per-invocation overlay**。Reviewer 改 env 变量时只 trace Split cell（4 split servers）。

### 3. 5 × ~~2~~ = ~~10~~ 5-Cell Matrix（amended 2026-05-26 by F213）

> Legacy monolithic 列退出主 matrix——它不再是 active managed cell。仅在 L5 startup
> path 新增 cleanup logic（F213 实施）作为它的唯一 lifecycle 关心点。

| L | Split (active managed cell) | Legacy `cat-cafe` (F213-handled, not active managed) |
|---|------------------------------|------------------------------------------------------|
| L1 REST API | 按 `cap.id` 路由 | n/a (no REST surface for legacy server) |
| L2 MCP handler | dimension 参数共用 | n/a |
| L3 MCP wrapper | structured fields 共用 | n/a |
| L4 Codex per-invocation `--config` | 4 split server 各独立注入 (`mcp_servers.cat-cafe-{collab,memory,signals,limb}.env.*`) | **F213 L4 dummy disabled override**: 注入 `command="echo"` + `args=["legacy-shim"]` + `enabled=false`（覆盖任意 config source 残留的 legacy entry，runtime 安全网；strict-codex 接受完整 transport + enabled=false 不启动 server） |
| L5 Runtime startup config | 4 split server 写进 `.mcp.json` + `.codex/config.toml`，注入 `ALLOWED_WORKSPACE_DIRS` | **F213 startup-time selective cleanup**（仅删 `echoLegacyShim` marker 匹配的 entry；其他保留 + log.warn；第三方未知 entry 不删 — L4 runtime override 兜底） |

### 4. Reviewer Checklist (改 F209 检索 surface 时必须勾)

新 PR 涉及以下任一时，逐项 trace 整条矩阵：

- [ ] **加 / 改 search 参数 default** (e.g. `dimension`, `mode`, `depth`, `scope`)：trace L1→L2→L3 三层，确认每层 default 一致或显式 documented divergence
- [ ] **改 env 变量** (e.g. `ALLOWED_WORKSPACE_DIRS`, `CAT_CAFE_API_URL`, embedding service env)：trace L4 + L5 两层，确认 4 split server 都获得 env（~~legacy cell 已由 F213 startup cleanup 移除，不再需要 trace~~ — amended 2026-05-26）
- [ ] **改 MCP tool description**：handler default 必须同步（PR #1882 root cause）
- [ ] **改 server topology** (加 / 删 / 重命名 cat-cafe-* server)：L4 args list + L5 writer 必须同步，**~~老用户的 legacy 配置不会自动消失~~** → amended：F213 后 deprecated managed entry 由 startup cleanup 自动清理（selective marker matching）
- [ ] **改 reprobe / availability check 逻辑**：trace 每条 search mode 是否真的需要这个 overhead（PR #1877 round 2 root cause —— lexical 不该付 reprobe 成本）
- [ ] **改 capability metadata** (`capabilities.json`)：runtime startup regen 必须走 `withCapabilityLock`，跟 request-time mutator 串行（PR #1873 round 4 cloud P1）
- [ ] **L1 REST API default 修改**：**禁止单方面改**，需 BACKLOG ADR 单独 propose deprecation cycle + REST consumer audit

### 5. Default Precedence Rules

跨多 tier env / workspace 解析：

| Tier | 来源 | 语义 | Rank |
|------|------|------|------|
| 1 | `process.env.ALLOWED_WORKSPACE_DIRS` (or 同类 explicit user env) | 用户 shell explicit export | **HIGHEST** (security boundary, user 显式声明) |
| 2 | per-invocation arg (e.g. `workingDirectory` from `thread.projectPath`) | 当前 thread / dispatch context | per-call specificity，比 process default 更准确 |
| 3 | `process.env.CAT_CAFE_WORKSPACE_ROOT` (or 同类 runtime startup env) | 启动脚本 export 的 runtime default | runtime-level default，可能 stale |
| 4 | `process.cwd()` | last resort | **LOWEST** |

**口诀**（PR #1874 round 1 cloud P1 教训）：tier 不是 "user > env > arg > cwd" 抽象级别比较，而是 **"explicit user > per-call context > runtime default > cwd" 数据来源 specificity** 比较。

### 6. 必须随 ADR 落地的 follow-up

- **F193 duplicate topology repair** ✅ **closed by PR #1883 (`a739206fb`, 2026-05-25)**：本地 `capabilities.json` 可能出现 managed legacy `cat-cafe` + split servers + `cat-cafe-limb(source=external)` 的组合，导致 F193 heal 为保护 limb surface 而保留 legacy `cat-cafe`，最终同一工具在 `mcp__cat_cafe__` 与 split namespace 双挂。修复：`ensureCatCafeMainServer()` 新增 `isSameRepoExternalLimb` 判定（`id==='cat-cafe-limb'` + `source==='external'` + `enabled===true` + `args[0]` normalize `\` → `/` 后 suffix match `packages/mcp-server/dist/limb.js`），让同仓 external limb 满足"managed limb available"条件以安全移除 legacy；foreign external limb（npx-based）仍走 R4 P1 fail-safe 保留 legacy。Spec AC-PCFU-1/2/3/5 ✅；AC-PCFU-4（alpha smoke runtime `tool_search` 去重）pending 铲屎官跑 `pnpm alpha:start` 复现 F209 D.0 配置后核查。归属 F193/MCP topology，未阻塞 F209 Phase D product spike
- **F209 + F200**：fixture recall@k wrapper（F200 owner，cross-validation 工具，不卡 Phase D）
- **L5 静态 config 侧 legacy env symmetric**：`ensureWorkspaceEnvForManagedCatCafe` 当前 `source !== 'cat-cafe'` 过滤，legacy entry source 不一致时 static config 路径仍可能漏注入 ALLOWED_WORKSPACE_DIRS。**短期不阻塞**（L4 per-invocation 永远覆盖），**中期符合本 ADR 对称性原则补齐**
- **REST API dimension default migration**（L1）：长期看 `all` 默认是 legacy + bad UX，需独立 PR + REST consumer audit + deprecation cycle

## Consequences

### Positive

- F209 检索链路有了显式 architecture map：未来加新 layer / 改 default / 改 topology 不再"独立看每个 PR 都合理但合起来 broken"
- Reviewer checklist 让 N+1 fix saga 不再隐含 invisible state
- 5 层 ownership + 2 cell topology 收敛到 single source of truth，避免每个新猫 onboard 时重新 reverse-engineer

### Negative / Trade-off

- 矩阵 10 个 cell 全 check 增加 review cost (单 PR ~5 分钟扫 checklist)
- L1 REST API default 不能单方面改是 backward-compat 成本（必须 deprecation cycle）
- 5-tier precedence 规则需要新加 layer 时主动维护（不维护就 silent diverge）

### Mitigation

- Reviewer checklist 可半自动化：write 一个 lint rule 检查 L2 description 改动是否同步 handler default
- 未来 review 这类 PR 时引用本 ADR 作为 entry point，不重复造轮子

## Saga Timeline (8 fixes, ~3 calendar days)

| PR | Layer touched | Root cause |
|----|---------------|------------|
| #1873 (4 rounds + 1 capability lock fix) | L5 | Static config 启动时 regen 漏 `ALLOWED_WORKSPACE_DIRS` env + capability lock missing |
| #1874 (4 rounds) | L4 | Codex per-invocation `--config` 漏 `ALLOWED_WORKSPACE_DIRS` env + precedence tier ordering 错 |
| #1876 | L4 (legacy cell) | Per-invocation overlay 只覆盖 split server，legacy `cat-cafe` 没有 env |
| #1877 (3 rounds) | Runtime query path (`SqliteEvidenceStore`) | Query 路径 sticky `isReady()` 漏 `reprobeIfNeeded`；后又发现 lexical mode 不该付 reprobe |
| #1882 | L2 | MCP handler 漏 `dimension` default → API legacy `all` 兜底 → global degraded 污染 |

每层独立修都合理。合起来才暴露 5-layer × 2-topology 矩阵从未被显式建模。

## Reviewer Calibration Lessons (cross-saga)

5 次 cloud-reviewer P→P1 升级集中暴露我（Opus-47 reviewer）4 个 antipattern：

1. **Conditional applicability**：trace 代码 presence 后还得 trace "每条 path 真需要这个 operation 吗"（PR #1877 round 2 lexical reprobe）
2. **Precedence 借鉴边界**：existing helper 顺序 ≠ 正确顺序，必须按数据源 specificity 排（PR #1874 round 1）
3. **数据源 provenance**：持久化文件 / runtime 切换 → "代码新构造时不会触发" 论证作废（PR #1873 round 4）
4. **Symmetric application ≠ correctness**：把"对称 = 好"当 verification 是 surface check（PR #1877 round 2 & PR #1882）

详见 `~/.claude/projects/-Users-lysander-projects-relay-station-cat-cafe/memory/feedback_severity_calibration_infra_risk.md`（5 次实证版本）。

## References

- F209 spec: `docs/features/F209-evidence-recall-optimization.md`
- D.0 report: `docs/decisions/2026-05-23-f209-d0-readiness.md`
- F193 Phase C split topology: 相关 PR `cat-cafe-{collab,memory,signals,limb}` 拆分立项
- PR #1873 / #1874 / #1876 / #1877 / #1882 (this saga)
- 关联 ADR: ADR-033 bubble-pipeline-identity-contract（同类 cross-layer contract pattern）

## Co-signoff

- 缅因猫/砚砚 (GPT-5.5): reviewed and co-signed on 2026-05-24. Approves ADR-036 as the F209 D.0 retrieval surface matrix. Review fixes applied before signoff: added required docs frontmatter and corrected saga timeline attribution for lexical reprobe overhead to PR #1877.
- 布偶猫/宪宪 (Opus-47): authored this ADR as cross-saga reviewer + architect
- 铲屎官 (CVO): D.0 close and ADR-036 to be surfaced in the sequencing handoff.

## Amendment History

### 2026-05-26 — Amendment by F213 (Stale MCP Config Cleanup at Startup)

**Trigger**: PR #1894 5-round cloud-codex P1 chain (社区 strict-npm-Codex v22.22.3
`Error loading config.toml: invalid transport in mcp_servers.cat-cafe`). 5 rounds
each fixing a different config-source lookup gap (user → project → ancestor →
CODEX_HOME → /etc) revealed the original L4 env-only overlay design has a
**blind spot**: strict-codex rejects partial server definition (env without
transport). Coordinate system: lookup-based helper trying to mirror codex CLI
internal config priority is scaffolding (meta-aesthetics violation).

**CVO directive (2026-05-26)**: "你们能不能把删掉的 mcp 的配置帮人启动的时候清理掉
啊！！这是别的思考方式！你们过期的 mcp 竟然不清理？" — surface a new design
axis: **过期 mcp 启动时清理**.

**Amendment** (revised 2026-05-26 post 砚砚 + cloud round-2 review):

- **Legacy monolithic cell**: removed from the active managed matrix (Section 3).
- **L4 Codex per-invocation `--config`**: **L4 dummy disabled override** —
  injects complete dummy transport for `mcp_servers.cat-cafe`
  (`command="echo"` + `args=["legacy-shim"]` + `enabled=false`). This serves as
  the runtime safety net covering legacy entries from any config source
  (user-level `~/.codex/config.toml`, `$CODEX_HOME/config.toml`, or system
  `/etc/codex/config.toml`) that L5 cleanup cannot reach. Verified by 砚砚
  strict-npm-Codex reproducer: complete transport passes config parse +
  `enabled=false` prevents server startup. Per-invocation `--config` is highest
  priority and overrides any same-name entry from any config source.
- **L5 Runtime startup config**: extended to perform **selective stale managed
  entry cleanup** on startup (F213). Only entries provably written by our own
  managed orchestrator are removed. Current marker set (post 砚砚 P1 review):
  - `echoLegacyShim`: `command="echo"` + `args[0]="legacy-shim"` exact match
    (the workaround we documented in PR #1894 close comment, third parties
    would not coincidentally use this exact combination)
  - `argsSuffix` marker was tried and removed for safety — user forks at
    `/users/alice/forks/cat-cafe/packages/mcp-server/dist/index.js` would
    falsely match suffix and violate the third-party preservation contract
  - Future Phase B+ scope: forward-only owner-tag mechanism so new managed
    entries carry an explicit `CAT_CAFE_MANAGED=true` marker

- **Third-party / unknown `cat-cafe` entries lifecycle**:
  - **Config file**: preserved by L5 cleanup (no marker → not removed) +
    `log.warn` informs user the name is now a reserved deprecated id
  - **Runtime in cat-cafe-managed codex invocation context**: disabled by L4
    override (this is **intentional** — cat-cafe invokes codex with the
    expectation that only the split servers handle the cat-cafe tool surface;
    a user's `cat-cafe`-named third-party server would shadow our split
    namespace if not disabled)
  - **Runtime outside cat-cafe context** (user runs `codex` directly): L4
    override not injected → user's `cat-cafe` server loads normally

  This trade-off is intentional: F213 preserves user config files (no data
  destruction) while ensuring cat-cafe's own codex invocations have a
  deterministic tool surface. Users intending to override cat-cafe's behavior
  via their own `cat-cafe`-named server should be aware this name is a
  reserved deprecated id; we recommend choosing a different server id for
  custom MCP servers.

- **Reviewer Checklist** (Section 4): "改 env" no longer requires tracing legacy
  cell. "改 server topology" no longer carries "老用户的 legacy 配置不会自动消失"
  burden — F213 L4 dummy disabled override + L5 startup cleanup handle deprecated
  managed entries.

**Why amend instead of new ADR**: ADR-036 is the cross-layer matrix authority.
Legacy cell was part of the original matrix as a deliberate cell (not an
omission). F213 collapses the cell into startup-cleanup; updating ADR-036 keeps
the architectural map authoritative. New ADR would create two competing truth
sources.

**Owner**: 宪宪 (Opus-47, F213 立项 author) + 砚砚 (GPT-5.5, collaborative
thinking 收敛 + strict-npm-Codex reproducer empirically verifying the strict
config-parse blind spot) + 铲屎官 (CVO, startup-cleanup reframe directive)

**References**:
- F213 spec: `docs/features/F213-stale-mcp-config-cleanup.md` (to be created)
- Discussion: `docs/discussions/2026-05-26-codex-mcp-legacy-deprecation/README.md`
- PR #1894 (paused, to be closed): 5-round saga documenting the lookup-based
  scaffolding antipattern
