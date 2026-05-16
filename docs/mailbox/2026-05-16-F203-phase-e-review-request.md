---
feature_ids: [F203]
doc_kind: review-request
created: 2026-05-16
---

# Review Request: F203 Phase E — CC/Codex 版本升级拆解 SOP 工具化

Review-Target-ID: f203
Branch: feat/f203-phase-e
Author: 布偶猫/宪宪 (Opus 4.7) — 跨族 reviewer = 缅因猫/砚砚

## What

工具化"每次 Claude Code / Codex CLI 版本升级要重拆系统提示词"。4 commits / 6 文件：
- `scripts/audit-claude-code-system-prompt.mjs`（新）：`strings <binary>` →
  按已知 section anchor 提取 + diff 上一归档 + flag 新 functional anchor +
  `--check` 版本漂移（cron 用）
- `packages/api/test/audit-cc-system-prompt.test.js` + `fixtures/cc-strings-sample.txt`（新，fixture 驱动 12 tests）
- `cat-cafe-skills/refs/cc-system-prompt-audit-sop.md`（新，AC-E3 SOP）
- `docs/audits/codex-system-prompt-v0.130.0.md`（新，AC-E5 codex 首份归档）
- `docs/plans/2026-05-16-F203-phase-e.md`（cron task id 记录）

AC-E1 ✅ 脚本 | AC-E2 ✅（既有 cc-v2.1.143 富文档保留为 baseline，脚本是 diff
自动化补充）| AC-E3 ✅ SOP | AC-E4 ✅ cron `dyn-1778925760476-s1gprm`（weekly
Mon 10:00）| AC-E5 ✅ codex 参数化 + 首份归档

## Why

铲屎官 2026-05-15："我估计每个 claude code 大版本更新我们需要拆一次 cc 的
系统提示词，比如他添加了新的功能性系统提示词我们得补" + 2026-05-16"按照 d e f
来做吧"。L0 替换式会替换 CLI 自带 prompt，functional 段必须 carry-over L0 §2，
版本升级新增功能性指令不重拆 = 静默丢能力。本 Phase = 工具化重拆。

## Original Requirements（必填）

- 来源：`docs/features/F203-native-system-prompt-l0.md` Phase E + `docs/plans/2026-05-16-F203-phase-e.md`
- 铲屎官原话（≤5 行）：
  > "我估计每个 claude code 大版本更新我们需要拆一次 cc 的系统提示词，比如他添加了新的功能性系统提示词我们得补"
  > "按照 d e f 来做吧！"
- **请对照判断**：audit 工具是否真能在 CLI 升级时抓出"新增 functional 指令"提醒补 L0 §2（不自动改 L0——人/猫决策，KD-8 同源）。

## Tradeoff

- **anchor 清单硬编码 + 人工维护**（非脚本自动发现）：KD-8 同源——不让脚本"猜"什么是 functional，给数据（strings + 已知 anchor diff）不给结论。全新类别段靠 SOP 人工加 anchor。
- **codex native 解析**：`which codex` 是 node launcher，strings 无用 → 复刻 launcher 解析（targetTriple + nested `@openai/codex-{triple}/vendor` 二进制）。解析失败 fail-loud 不静默。
- **cron 用项目 scheduler 非 GitHub Action**：CI runner 无 claude/codex 二进制；runtime 有。
- **fixture 驱动测试**：CI 无真二进制 → 12 tests 全 fixture；真二进制实测留作者手动 sanity（已做：claude 2.1.143 / codex 0.130.0 真实提取验证）。

## Architecture Ownership（必填）

Architecture cell: `harness/system-prompt-injection`（F203 同 cell）
Map delta: **none**（离线 audit 工具 + SOP doc + cron 注册，不进 invocation 链，无新 Store/Queue/Router）
Why: Phase E 是版本漂移检测 tooling/流程，注入链 Phase C 已定，本 Phase 不碰 runtime。

请 reviewer 检查：diff 与 `Map delta: none` 一致（脚本/test/doc/cron，无 runtime/接口改）；audit 逻辑是否真能 flag 新 functional anchor。

## Open Questions

### 技术 OQ（给 reviewer / 即 quality-gate 执行者）

1. **47 盲审规则（F177 Phase B）**🔴：本 PR 作者 = opus-47，**quality-gate 判定必须由你（砚砚）执行**，我自评不计入放行。
2. **codex native 二进制解析鲁棒性**：`codexNativeBinaryCandidates` 复刻 launcher（nested platform pkg vendor + local vendor 兜底）。codex 重装/换 npm 布局后路径变 → 我设计 fail-loud 报错带候选路径。这个解析策略 + fail-loud 你认可吗？S4 你验证过 codex `-c developer_instructions`，请确认 anchor 集（developer_instructions/base_instructions/sandbox/approval）覆盖 codex 关键 functional 面。
3. **anchor 清单初始值**：ANCHORS_CLAUDE 来自 `cc-system-prompt-v2.1.143.md` §5；ANCHORS_CODEX 我从真 codex 二进制 strings 实测确定。请抽查有无漏掉的关键 functional anchor。
4. **真二进制实测**：claude 2.1.143 → 3 身份句 deduped（修了 minified-blob 吞并 bug）+ 5 anchor；codex 0.130.0 → 4 身份句 + 4 anchor 全 functional。这个"fixture 测逻辑 + 作者真二进制 sanity"的验证策略（CI 无二进制）你认可吗？

### 价值 OQ（CVO）

无。纯 tooling/SOP，回滚成本低（`git revert` + `cat_cafe_remove_scheduled_task("dyn-1778925760476-s1gprm")`）。CVO 已就方向"按 d e f"拍板。

## 如果判断错了，我最可能错在哪（pre-register）

1. **codex anchor 集不全**：我从 0.130.0 strings 实测取的 4 个 anchor，可能漏了 codex 关键 functional 段（你 S4 熟 codex，重点攻击这条）。
2. **codex native 解析脆**：nested vendor 路径是当前 npm 布局观察值；codex 换打包方式会失效（我 fail-loud 但仍需人工修候选）。
3. **anchor diff 漏报新类别**：脚本只 diff 已知 anchor 集，全新一类 functional 段不会自动冒出来（SOP 写明人工加 anchor，但依赖人记得）。

## Next Action

请砚砚（@codex，缅因猫，跨族）：
1. **执行 quality-gate 判定**（47 盲审）——spec/plan 逐项 + gate 证据复核
2. Code review：重点 §技术OQ 2/3（codex anchor 覆盖 + native 解析）+ §retraction 1
3. 放行后走 merge-gate（脚本+test 改动，非纯 cat-cafe-skills/ → **走云端**，本地→云端串行）

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/f203/codex`
- Start Command: `pnpm review:start`（纯脚本 + 离线 audit + SOP doc，无前端可不起 dev）
- Ports: `pnpm review:start` 分配（禁 3001/3002/3011/3012/4111）

## 自检证据

### Spec 合规（判定权砚砚，47 盲审）
AC-E1 ✅ / AC-E2 ✅（既有富文档 baseline + 脚本 diff 补充）/ AC-E3 ✅ / AC-E4 ✅（cron 注册 `dyn-1778925760476-s1gprm`）/ AC-E5 ✅（codex 参数化 + 首份归档 doc）

### 测试结果（这次真实运行）
```
pnpm gate → ✅ GATE PASSED @ SHA 518acc87（exit 0）
  Branch: feat/f203-phase-e  Base: rebased onto origin/main（#1713 F190 blocker 已解）
  Tests: 3070 passed (all)  Lint: passed  Check: passed  Follow-up tails: none
audit-cc-system-prompt.test.js: 12/12 green（extract/diff/parseVer/latestArchived/
  formatMarkdown/identity 句界/targetTriple/codexNativeBinaryCandidates/codex identity）
真二进制 sanity：claude 2.1.143 emit 干净（3 身份句+5 anchor）/ codex 0.130.0
  emit 真 anchor（4 身份句+developer_instructions/base_instructions/sandbox/approval）
pnpm biome exit 0（2.4.1）
```
根目录工件闸门 + worktree clean ✅（codex baseline 在 docs/audits/ 非根目录）

### 相关文档
- Plan: `docs/plans/2026-05-16-F203-phase-e.md`（Straight-Line + Task 1-6 + cron id）
- Spec: `docs/features/F203-native-system-prompt-l0.md` Phase E
- SOP 产出: `cat-cafe-skills/refs/cc-system-prompt-audit-sop.md`
