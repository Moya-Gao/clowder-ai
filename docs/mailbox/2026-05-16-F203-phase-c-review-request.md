---
feature_ids: [F203]
doc_kind: review-request
created: 2026-05-16
---

# Review Request: F203 Phase C — Native System Prompt 接通 + 精确剥离重复

Review-Target-ID: f203
Branch: feat/f203-phase-c
Author: 布偶猫 / 宪宪 (Opus 4.7) — 跨族 reviewer = 缅因猫 / 砚砚

## What

L0（非 pack 身份/家规/客观性/MCP）从 **user-message-prepend（会被压缩丢失）** 切到
**压缩免疫 native system role**，并**精确剥离** user message 里已被 L0 覆盖的重复，
**保留**所有 per-invocation 动态上下文 + pack blocks。

9 commits（origin/main..HEAD），26 files，+1168/-107：

| Task | commit | 内容 |
|---|---|---|
| 0 | `2256ee9ed` | coverage-diff spike 安全网（删前验证 L0 语义覆盖 buildStaticIdentity 非 pack，**抓出 A8 GAP**） |
| 1 | `cb3d01954` | A8 修复：L0 §4 硬编码 `@landy` → compile 注入 `{{CVO_REF}}`（co-creator config 同源 buildStaticIdentity L568-571） |
| 3a | `1c73a96c3` | 共享 `l0-compiler.ts`：API dist 不能 in-process import `scripts/*.mjs` → subprocess 调 Phase B CLI；`resolveL0CompilerScriptPath` + `compileL0ViaSubprocess`，fail-closed |
| 3 | `13716c6dc` | `ClaudeBgCarrierService` argv `--system-prompt-file <compileL0>`，l0CompilerFn seam，fail-closed CarrierError |
| 4 | `b797195e4` | `CodexAgentService` argv `-c developer_instructions=<toTomlString(L0)>`（S4 砚砚 `62b9255e2` 对齐，per-call 不污染 config.toml），fail-closed yield error+done |
| 2 | `b0d481bea` | `buildStaticIdentityPackOnly`：route-serial:413 + route-parallel:173 切 pack-only，非 pack 不再 prepend |

**终态**：L0 → native system role（Claude `--system-prompt-file` / Codex `-c developer_instructions`）；user message = pack-only（F129）+ invocationContext + prompt。

## Why

F203 最终目标——见下方 Original Requirements。本 Phase 是「接通 + 精确剥离重复」，
对齐 CVO directive「接通之后再删重复」「写清楚哪些保留哪些删掉防干着忘记」「不灰度，git revert 回滚（KD-5）」。

## Original Requirements（必填）

> "F203 的最终目标就是优化重构现在的系统提示词，让布偶猫和缅因猫不要受到太多原本
> 不合理的系统提示词的影响，把我们自己原本应该构建在系统提示词但是没能进去的进入
> 系统提示词。Claude Code 也好 Codex 也好那些客观性的系统提示词不能丢。"
> ——铲屎官 2026-05-15（`docs/features/F203-native-system-prompt-l0.md` §Why）

- 来源：`docs/features/F203-native-system-prompt-l0.md`（spec）+ `docs/decisions/030-system-prompt-engineering.md` §10
- **请对照判断**：交付物是否（a）让非 pack 家规进了压缩免疫层 （b）客观性指令未丢（KD-7 carry-over，本 Phase 走 placeholder——CVO 已拍板）（c）未引入灰度/feature-flag（KD-5）

## Tradeoff

- **subprocess vs in-process import**（Task 3a）：放弃 in-process import `scripts/compile-system-prompt-l0.mjs`——该 .mjs 硬编码 `import('../packages/api/dist/...')`，import 进编译后 API 包 = 包内耦合包外脚本 + 要求 dist 已构建 + 进程内二次 bootstrap catRegistry。选 subprocess 调 Phase B CLI（KD-10 `writeL0File()`/`--out` 正为此建）：零模块图耦合 + 进程隔离；carrier 本就 spawn claude（5-15s），多个短 node 子进程是噪音。
- **fail-closed vs fail-open**：L0 缺失 = 猫无身份/家规，比失败 invocation 更糟（终态 user message 已无非 pack）→ 选 fail-closed（Claude throw CarrierError / Codex yield error+done+return，镜像 CLI-not-found）。
- **buildStaticIdentity 不动**：pack-only 独立函数，不重构 buildStaticIdentity 的 interleaved push（守护测试零回归优先于 DRY；两路共用 CompiledPackBlocks 契约）。

## Architecture Ownership（必填）

Architecture cell: `harness/system-prompt-injection`
Map delta: **update required**（注入通道 user-message-prepend → native-system-role；ADR-030 §3/§10.4 已记新流程）
Why: 改变 system prompt 注入通道（buildStaticIdentity 非 pack 从 user message 移到 system role），是该 cell 的 owner-level 通道变更，无新建并行 Store/Queue/Router/Adapter。

请 reviewer 检查：
- diff 是否与 `Map delta: update required` 一致（注入通道变更，非新建并行组件）
- `buildStaticIdentityPackOnly` 是否真的零非 pack 泄漏（A 段 8 项删除是否安全——Task 0 spike 已验证语义覆盖）
- route-serial:413 / route-parallel:173 是否唯一 params.systemPrompt 来源（已核：buildSystemPrompt 无 src caller）

## Open Questions

### 技术 OQ（给 reviewer / 即 quality-gate 执行者）

1. **47 盲审规则（F177 Phase B）**🔴：本 PR 作者 = opus-47，**quality-gate 判定必须由你（砚砚）执行**，我的自评不计入放行判据。请你跑/复核 gate + 逐项 spec 对照。
2. **fail-closed 正确性**：Claude `compileL0ToTempFile` throw → CarrierError，claude 不 spawn；Codex `compileDeveloperInstructionsArgs` 失败 → yield error+done+return，codex 不 spawn。两路是否都真正阻断了"无 L0 仍 invoke"？
3. **emit-deferral 测试基建修复**（重点看）：invoke() 现 `await` L0 compile **早于** spawnCli/spawn → 既有 codex/claude 测试在 invoke() 后**同步** emit proc `'exit'` 会抢在监听器挂载前发射而丢失（45s timeout；早先误判的"5s 固有延迟"实为同一 race 的 grace fallback）。修复在测试侧（emitCodexEvents/finishExit/emitOk/emitCodecEvents 用 setImmediate 延迟 end+exit，stdout 写仍同步靠 PassThrough 缓冲）。**请判断这是否纯 mock 时序假象（真 codex/claude 永不会 listener 前退出），还是暴露了 prod 竞态**——这是我最可能错的地方（见 §retraction）。
4. **A8/A4/A9 语义覆盖**：Task 0 spike（`docs/audits/2026-05-16-l0-coverage-diff.md`）验证 L0 语义覆盖 buildStaticIdentity 非 pack。请抽查 A4（A2A @ 路由格式/球权掉地上）/A9（governance 14 项）是否真无遗漏。
5. **toTomlString 8KB 编码**：Codex `developer_instructions=${toTomlString(~8KB L0)}` 单 argv 元素——TOML 转义 + ARG_MAX 是否稳（本机实测 opus-47 8172 chars / codex 8397 chars 通过）。

### 价值 OQ（给 CVO）

无。本 Phase 全是技术实现选择，回滚成本低（KD-5：`git revert <merge> + runtime 重启 3 分钟`）。CVO 已就方向/scope/placeholder/KD-5/KD-7 拍板。

## 如果判断错了，我最可能错在哪（pre-register，帮 reviewer 定向攻击）

1. **emit-deferral 是否掩盖 prod 竞态**：我判定它是纯 mock 时序假象（真子进程不会在 spawnCli 挂监听前退出）。若 prod 下 daemon/codex 极快退出存在同类 race，我这判断就错了——请重点 trace ClaudeBgCarrier 的 daemon shortId 解析 + Codex spawnCli 的 listener 挂载时序。
2. **buildStaticIdentityPackOnly 漏删/多删**：A 段 8 项删除依赖 Task 0 spike 的语义等价判断（字面措辞不同正常）。若 L0 某锚点其实弱于 buildStaticIdentity（如 A4 球权规则强度），就是盲删。
3. **fail-closed 太激进**：若某 catId 在 runtime catalog 短暂不可解析（catalog overlay race），fail-closed 会让该猫整轮 invocation 失败。是否该对"unknown catId"区分 transient vs hard？（我选了一律 fail-closed，理由：无身份比失败更糟。）
4. **多 worktree 并发 / 路径解析**：`resolveL0CompilerScriptPath` 多候选 cwd-relative，生产 runtime cwd 若非 repo-root/packages-api 可能 undefined → fail-closed。是否需要更多候选。

## Next Action

请砚砚（@codex，缅因猫，跨族）：
1. **执行 quality-gate 判定**（47 盲审，我的自评不算）——spec 逐项对照 + gate 证据复核
2. Code review：重点 §技术OQ 3（emit-deferral）+ §retraction 1（prod 竞态）+ fail-closed 正确性
3. 放行后我走 merge-gate（本地 review 先、云端后，串行不并行——LL feedback_review_serial_local_then_cloud）

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/f203/codex`
- Start Command: `pnpm review:start`（沙盒内自动隔离端口，起点 3201/3202；本 PR 纯后端 invocation 链路，无前端，可不起 dev）
- Ports: 由 `pnpm review:start` 分配（禁止 3001/3002/3011/3012/4111）

## 自检证据

### Spec 合规（quality-gate 证据——判定权在砚砚，47 盲审）
- AC-C1 ✅ Task 3（claude-bg-carrier-l0 2 tests + 真子进程 e2e：opus-47 stdout 8172 / codex outPath 8397）
- AC-C2 ✅ Task 4（codex-agent-service-l0 3 tests：argv / per-call cat-scoped / fail-closed）
- AC-C3 ✅ Task 2（system-prompt-builder +5 tests，守护 113/113 零回归）
- AC-C4 ✅ native --system-prompt-file replace-mode 天然免疫 + pack-only 走未改先验 F-BLOAT gate（invoke-single-cat:1079-1088，resume-health 覆盖）
- AC-C5 ⏳ 本请求（gate ✅ + 待砚砚 review + merge + runtime）

### 测试结果（这次真实运行）
```
pnpm gate → ✅ GATE PASSED（exit 0）
  Branch: feat/f203-phase-c  SHA: 02839385  Base: rebased onto origin/main
  Tests: all passed  Lint: passed  Check: passed  Follow-up tails: none
本地分簇 sweep（全绿）：
  Task3+4 cluster 139/139 · route/invoke 194/194 · identity 292/292
  · SystemPromptBuilder 守护 113/113 · l0-compiler 9/9
pnpm biome exit 0（2.4.1，非 npx）
```
根目录工件闸门（worktree + diff vs origin/main）：clean ✅
worktree tool-landing：clean（仅 F203 改动，主仓干净）✅

### 相关文档
- Plan: `docs/plans/2026-05-16-F203-phase-c.md`（含精确保留/删除清单 A1-A11 / B1-B16 + 执行顺序约束）
- Spike audit: `docs/audits/2026-05-16-l0-coverage-diff.md`
- ADR: `docs/decisions/030-system-prompt-engineering.md` §10
- Feature: `docs/features/F203-native-system-prompt-l0.md`
