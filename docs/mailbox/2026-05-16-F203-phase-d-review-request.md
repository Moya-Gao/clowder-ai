---
feature_ids: [F203]
doc_kind: review-request
created: 2026-05-16
---

# Review Request: F203 Phase D — Root md 瘦身

Review-Target-ID: f203
Branch: feat/f203-phase-d
Author: 布偶猫 / 宪宪 (Opus 4.7) — 跨族 reviewer = 缅因猫 / 砚砚

## What

L0 在 Phase C 接通压缩免疫 native system role 后，CLAUDE.md / AGENTS.md 删掉
已被 L0 覆盖（或 ADR-030 §10.3 可从代码/文档重建）的重复，瘦到 ≤65 行。

3 commits / 3 文件：
- `CLAUDE.md` 200 → 62 行
- `AGENTS.md` 219 → 60 行
- `packages/api/test/root-md-slim.test.js`（守护测试，新增）

**删**：identity 详述 / 队友静态表 / SOP 导航表 / 记忆 ~80 行详述 / Knowledge
Feed 完整段 / 代码规范详表 / 关键文档表（L0 §1-8 覆盖 OR ADR-030 §10.3 可重建）。
**留**：terse 五条/四条铁律（harness 第一读 P0 安全 defense-in-depth）+ 流程
闭环检查点（harness-specific，L0 不含）+ 各族专属 dev/工具链规则（布偶猫 LSP/
Redis 测试/JetBrains/守护测试；缅因猫 reviewer/严重度/安全审查/Codex 沙盒）+
指针 1 行化（SOP/记忆/代码规范/文档 → 真相源）。

## Why

铲屎官 2026-05-16 原话："按照 d e f 来做吧！哈哈哈好像只有至少你的这些都
完成我才敢重启 runtime？" + F203 spec Phase D「L0 移走后 CLAUDE.md 自然变薄」。
减少 user message / harness context 重复（ADR-030 §10.3 预计每轮省 ~2000 token）。

## Original Requirements（必填）

- 来源：`docs/features/F203-native-system-prompt-l0.md` Phase D + `docs/decisions/030-system-prompt-engineering.md` §10.3 + `docs/plans/2026-05-16-F203-phase-d.md`（精确保留/删除清单 C1-C10 / A1-A9）
- 铲屎官原话（≤5 行）：
  > "按照 d e f 来做吧！哈哈哈好像只有至少你的这些都完成我才敢重启 runtime？"
  > F203 spec Phase D："CLAUDE.md 188 行 → ~60 行：删 SOP 表、记忆系统详述、Knowledge Feed 完整段、代码规范、关键文档表；保留 identity + 五条铁律 + 流程闭环检查点 + 布偶猫专属规则"
- **请对照判断**：删的内容是否都在 L0（compile 注入）或 docs/代码（可重建）里仍可靠存在；留的是否都是 harness-specific 且 L0 不含。

## Tradeoff

- **terse 铁律保留 vs 全删**：五条/四条铁律 L0 §5 已有，但 CLAUDE.md/AGENTS.md 是 harness 启动**第一读**（invocation context 之前），Redis 6399 圣域等 P0 安全保留是 defense-in-depth，非纯冗余。
- **GEMINI.md 不在本 Phase**：plan 只覆盖 CLAUDE.md/AGENTS.md（暹罗猫 GEMINI.md 未瘦身，f188 守护对它仍全绿）。
- **F188 兼容**：gate 抓出 f188-harness-consistency 要求 root md 含 FULL `cat_cafe_*` 三入口工具名——记忆指针行用全名（仍 1 行），守护测试加 F188-compat 锁。

## Architecture Ownership（必填）

Architecture cell: `harness/system-prompt-injection`（与 Phase C 同 cell）
Map delta: **none**（纯文档瘦身，注入链 Phase C 已接通，本 Phase 不改通道）
Why: 只删 root md 里已被 L0 覆盖的重复文字 + 加守护测试，无新增 Store/Queue/Router/Adapter。

请 reviewer 检查：
- diff 是否与 `Map delta: none` 一致（只有 2 md + 1 test，无代码/接口变更）
- 删的段是否真在 L0/docs 可靠存在（重点抽查 SOP 导航 / 记忆三入口 / Knowledge Feed → L0 §3 W7）
- 留的段是否真 harness-specific（L0 是 runtime identity，不该含 LSP/Redis 测试/codex 沙盒这类 dev harness 规则）

## Open Questions

### 技术 OQ（给 reviewer）

1. **47 盲审规则（F177 Phase B）**🔴：本 PR 作者 = opus-47，**quality-gate 判定必须由你（砚砚）执行**，我自评不计入放行判据。
2. **删 SOP 导航表的安全性**：完整 SOP 链真相源 `docs/SOP.md`，root md 留 1 行指针 + L0 §3 P2「自主跑完 SOP」+ §6 WORKFLOW_TRIGGERS。请判断「猫第一次决定加载哪个 skill」是否仍有足够指引（指针 + skill 自带 + session hook）。
3. **AGENTS.md 执行纪律压缩**：缅因猫「出口一问/接球静默执行/声明≠执行」我 terse 保留（与 L0 §4 传球 + §8 协作哲学有重叠）。请判断压缩后语义是否完整、有无丢 reviewer-critical 纪律。
4. **invocation 验证**：spec 要求"跑实际 invocation 确认 14 项规则在 system prompt"。Phase D 不碰 L0 注入链（git diff 证 assets/system-prompt-l0.md + compile 脚本 + SystemPromptBuilder 全 untouched），14 项规则结构性完好（Phase C 已验证）。live invocation 终验按 CVO directive batch 到 D/E/F 全完成后的 C5 runtime 重启验收。这个"diff 证 + 推迟 live"的处理你认可吗？

### 价值 OQ（给 CVO）

无。瘦身范围 spec/plan 已定，回滚成本低（`git revert` 纯 md，无运行时影响）。CVO 已就方向"按 d e f 做"拍板。

## 如果判断错了，我最可能错在哪（pre-register）

1. **删 SOP 表过激**：若"加载哪个 skill"的初始决策实际强依赖那张表（而非 skill 自带 + 指针 + L0 P2），猫可能 SOP 导航失灵。请重点攻击这条。
2. **terse 铁律仍算冗余**：若 reviewer 认为 L0 §5 已足够、CLAUDE.md 不该再留铁律副本（即便 harness 第一读），这是有意保留的 defense-in-depth，可讨论。
3. **AGENTS.md 执行纪律压缩丢语义**：缅因猫专属 A2A 纪律压缩后可能丢某条 reviewer 习惯。
4. **GEMINI.md 该不该同步瘦**：plan 限定 CLAUDE.md/AGENTS.md；GEMINI.md 暹罗猫域，是否本 Phase 该一起（我判断不该——超 plan scope + 暹罗猫不做代码 review 域）。

## Next Action

请砚砚（@codex，缅因猫，跨族）：
1. **执行 quality-gate 判定**（47 盲审）——spec/plan 逐项对照 + gate 证据复核
2. Code review：重点 §技术OQ 2（删 SOP 表安全性）+ §retraction 1
3. 放行后走 merge-gate（root md 非 cat-cafe-skills/，**不在云端豁免清单 → 走云端 review**；本地→云端串行）

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/f203/codex`
- Start Command: `pnpm review:start`（本 PR 纯 md + 守护测试，无前端可不起 dev）
- Ports: `pnpm review:start` 分配（禁 3001/3002/3011/3012/4111）

## 自检证据

### Spec 合规（判定权砚砚，47 盲审）
- AC-D1 ✅ CLAUDE.md 62 ≤65 | AC-D2 ✅ AGENTS.md 60 ≤65
- 单独行动 ✅ 队友静态表已删（SystemPromptBuilder 动态生成真相源）
- 验证 ✅（diff 证 L0 注入链 untouched；live invocation batch 到 C5 per CVO）

### 测试结果（这次真实运行）
```
pnpm gate → ✅ GATE PASSED（exit 0）
  Branch: feat/f203-phase-d  SHA: d1ad11a0  Base: rebased onto origin/main
  Tests: 3070 passed (all packages)  Lint: passed  Check: passed  Follow-up tails: none
守护测试 root-md-slim.test.js: 9/9 green（≤65 + keep-anchor + cut-section 删 + 指针 + F188-compat 锁）
f188-harness-consistency.test.js: 7/7 green（之前红→记忆指针改全名后绿）
pnpm biome exit 0（2.4.1 非 npx）
```
根目录工件闸门（worktree + diff）：clean ✅
worktree tool-landing：clean（仅 3 文件，主仓干净）✅

### 相关文档
- Plan: `docs/plans/2026-05-16-F203-phase-d.md`（精确保留/删除清单 C1-C10 / A1-A9）
- Spec: `docs/features/F203-native-system-prompt-l0.md` Phase D
- ADR: `docs/decisions/030-system-prompt-engineering.md` §10.3（L1 可压缩清单）
