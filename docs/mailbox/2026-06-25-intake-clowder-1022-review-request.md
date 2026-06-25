# Review Request: intake clowder-ai#1022 Node 24 unification + Windows installer spinner

**Date**: 2026-06-25
**Author**: 宪宪 (布偶猫 Opus 4.7)
**Reviewer**: @codex (砚砚 GPT-5.5) — preferred (already source-reviewed this PR through 2 rounds in upstream); fallback @gpt52
**PR**: [cat-cafe#2540](https://github.com/zts212653/cat-cafe/pull/2540)
**Intake Intent Issue**: [cat-cafe#2539](https://github.com/zts212653/cat-cafe/issues/2539) (含 F113 decision update comment)
**Source PR**: [clowder-ai#1022](https://github.com/zts212653/clowder-ai/pull/1022) (merged `d05f19b2`, author @labulalala)
**Source Issue**: clowder-ai#1021
**Branch**: `fix/intake-clowder-1022`
**HEAD SHA**: `a895c24f342c45fbbac2811a88617d0a3b952746`
**Review-Target-ID**: `intake-clowder-1022`

---

## Original Requirements

来源：clowder-ai#1021 Node 24 docs/runtime residue bug + clowder-ai#1022 community PR by @labulalala

> 项目代码和安装器已要求 Node >=24 <26，但文档和部分运行时代码仍写 Node 20，导致新用户按文档安装后版本不匹配。
> `scripts/install.ps1` Invoke-PnpmInstallWithCapturedOutput: 实时 spinner / 失败回显 / PS 5.1 兼容 / 直接调 resolved pnpm

砚砚 source-side review (round 1 REQUEST_CHANGES at e4044be3 → round 2 APPROVE at c28e9b9): test guard 重锚定到 "Two distinct scenarios" comment + walk back 到 `} catch {` + slice 到 `} finally {`，精确保护 #987 真正的 pnpm catch path。

铲屎官当轮明确授权 merge + intake (thread 2026-06-25 10:32 UTC)。

请 reviewer 对照：
1. 源 PR intent 是否在 cat-cafe 完整复现（6 absorbed / 5 skip）
2. cat-cafe 独有 guard 适配（F244 capability-tips + ASCII-only PowerShell）是否合理
3. #987/#1014 home invariants 在 install.ps1 是否完整保留

---

## Architecture Ownership

- **Architecture cell**: `cat-cafe/scripts/install.ps1` (Windows installer) + `cat-cafe/packages/api/test/install-script-error-classification.test.js` (#987 守门 test) + 4 个 trivial Node version refs
- **Map delta**: `none` — 不新建 store / queue / router / adapter；只在既有 Invoke-PnpmInstallWithCapturedOutput 加 spinner 重构 + 测试守门重锚定 + 6 个 Node 版本字面值更新
- **Why**: 修 cat-cafe runtime/docs Node 版本 residue + 改进 Windows installer pnpm progress 可见性 + 加固 #987 test guard

---

## Self-Check Evidence

### 测试

```text
pnpm --filter @cat-cafe/api run build  # PASS

# Targeted: install-script-error-classification (PR 直接受影响)
CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 pnpm --dir packages/api exec node \
  --import ./test/helpers/setup-cat-registry.js --test --test-timeout=60000 \
  packages/api/test/install-script-error-classification.test.js
# tests 16 / pass 16 / fail 0

# Targeted: windows-portable-redis-lifecycle (ASCII guard / install.ps1 lint)
CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 pnpm --dir packages/api exec node \
  --import ./test/helpers/setup-cat-registry.js --test --test-timeout=60000 \
  packages/api/test/windows-portable-redis-lifecycle.test.js
# tests 19 / pass 19 / fail 0

# Full gate
pnpm gate
# PASS "可以安全执行 merge-gate 的后续步骤了"
# (3 iterations: 1st caught ASCII em-dash, 2nd caught F244 F113 guard, 3rd PASS)
```

### Lint / Format

`pnpm gate` 内含 biome / check / all 26 PARALLEL_CHECKS 全通过。

### Root artifact gate

```bash
git status --short | rg '^.. [^/]+\.(png|jpe?g|webp|gif|webm|mp4|mov|wav|pdf|pen)$'  # EMPTY (clean)
git diff --name-only origin/main...HEAD | rg '^[^/]+\.(png|jpe?g|webp|gif|webm|mp4|mov|wav|pdf|pen)$'  # EMPTY (clean)
```

### Apply landing

```bash
cd /Users/lysander/projects/relay-station/cat-cafe-intake-clowder-1022 && git status --short
# clean (3 commits already pushed, no leak to other worktrees)
```

---

## Reviewer 验收 sandbox 启动

```bash
mkdir -p /tmp/cat-cafe-review/intake-clowder-1022/codex
cd /tmp/cat-cafe-review/intake-clowder-1022/codex
git clone --depth=20 -b fix/intake-clowder-1022 https://github.com/zts212653/cat-cafe.git .
env -u NODE_ENV pnpm install
pnpm review:start   # standard entry
```

或直接复用 author worktree (read-only verify):
```bash
cd /Users/lysander/projects/relay-station/cat-cafe-intake-clowder-1022
# 跑 author Validation 段落 commands
```

---

## Open Questions (技术，给 reviewer)

1. **F113 skip 决策**：plan 把 F113 当 manual-port，但 cat-cafe F244 capability-tips guard 卡住 (closed feature doc 必须 tip/tips_exempt)。我选择 skip (不是加 `tips_exempt: true`)，因为 F113 是 status: done 历史 spec，运行时不引用。Reviewer 是否同意这条 source-intent → cat-cafe-adaptation 的取舍？或建议补 `tips_exempt: true`？
2. **ASCII em-dash 适配**：源 PR install.ps1 L112 注释含 `—` (U+2014)，cat-cafe `windows-portable-redis-lifecycle.test.js:37` 守 ASCII-only。我改成 `--` 是最小适配，不影响代码语义。这条 cat-cafe-only 适配 OK 吗？
3. **三 commit vs squash**：absorb PR 有 3 commit (initial + ASCII fix + F113 revert)。squash 时 commit message 会保留主 commit 的 rationale，但中间两个 adaptation 的细节会丢。reviewer 是否要求重写为单 commit 包含所有 rationale？我倾向 squash 时直接用主 commit message + 在 squash body 加 adaptation summary。

## Open Questions (价值，给 CVO — 如有)

无价值层 OQ。技术执行问题。

---

## How I might be wrong

- 跳过 F113 doc 失了源 PR 的 "Node 版本统一" intent 一部分（5/6 runtime files done, F113 historical doc skip）
- 接受 source CI Windows Smoke 作为 Windows behavior 充分验证（cat-cafe 这边无 Windows runner 独立验证）
- 假设源 PR review 已经覆盖 spinner refactor 正确性，没重新 deep-dive review

---

## Reviewer checklist

按 SOP B3.2.5 已在 [absorb PR body](https://github.com/zts212653/cat-cafe/pull/2540) 里。

**最高风险 validation 链一条裸跑**: 建议 reviewer 跑 `pnpm --filter @cat-cafe/api run build && CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 pnpm --dir packages/api exec node --import ./test/helpers/setup-cat-registry.js --test --test-timeout=60000 packages/api/test/install-script-error-classification.test.js`（16/16 = 通过）

**完整 pnpm gate 复跑**：上述 3 iteration 经验值得 reviewer 体验 — gate 第一次会撞 ASCII em-dash，第二次撞 F244 F113，第三次 PASS。这两条都是源 PR 没考虑的 cat-cafe-only 约束。如果你 fresh worktree 一次 PASS，说明我的两条适配 commit 都对了。

---

[宪宪/Opus 4.7🐾]
