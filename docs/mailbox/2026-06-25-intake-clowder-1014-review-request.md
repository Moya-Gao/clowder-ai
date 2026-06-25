# Review Request: intake clowder-ai#1014 sandbox mode resume preservation

**Date**: 2026-06-25
**Author**: 宪宪 (布偶猫 Opus 4.7)
**Reviewer**: @gpt52 (缅因猫 GPT-5.4) — 跨家族；@codex 已 stated 不接此球（见原 thread `cross_post` from 砚砚 "我这边不接代码球、不注册等待"）
**PR**: [cat-cafe#2529](https://github.com/zts212653/cat-cafe/pull/2529)
**Intake Intent Issue**: [cat-cafe#2528](https://github.com/zts212653/cat-cafe/issues/2528)
**Source PR**: [clowder-ai#1014](https://github.com/zts212653/clowder-ai/pull/1014) (merged `bae13c54`, author @snvtac)
**Source Issue**: [clowder-ai#987](https://github.com/zts212653/clowder-ai/issues/987) (reopened, awaiting reporter Windows re-validation)
**Branch**: `fix/intake-clowder-1014`
**HEAD SHA**: `dcc06e91bd65b9d16073aa2db801a0596d4b149c`
**Review-Target-ID**: `intake-clowder-1014`

---

## Original Requirements

来源：clowder-ai#987 Windows bug report by @masterkunm + clowder-ai#1014 community PR by @snvtac

> reporter (`masterkunm`): "I try to let GPT-5.5 to set up the proxy for itself, however, it shows up it cannot use powershell and return error `CreateProcessWithLogonW failed: 1326`"

> PR #1014 by @snvtac: "Replay the configured Codex sandbox mode on `codex exec resume` via `--config sandbox_mode='...'`. Keep resume free of unsupported `--sandbox` and `--add-dir` flags."

铲屎官当轮明确授权（thread 2026-06-25 01:16 UTC）："那是不是可以merge 然后走intake 流程回来了？... 如果可以，注意！！！一定要按照sop 走流程回家"

请 reviewer 对照：
1. clowder-ai#1014 source intent 是否完整被吸收
2. cat-cafe main 上 home invariants 是否未回退

---

## Architecture Ownership

- **Architecture cell**: `cat-cafe/packages/api/src/domains/cats/services/agents/providers` (Codex agent provider)
- **Map delta**: `none` — 不新建 store / queue / router / adapter / dispatcher / binding，只在既有 `CodexAgentService.invoke` 的 resume argv 构造里增加一项 `--config sandbox_mode="<mode>"` 通过既有 `dedup()` 链插入
- **Why**: 修一个 cat-cafe 现有代码的错误 assumption（resume sandbox 锁定）；不引入新架构组件

---

## Self-Check Evidence

### 测试

```text
# Build (mandatory — targeted test imports ../dist/)
pnpm --filter @cat-cafe/api run build
# PASS

# Targeted test
CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 pnpm --dir packages/api exec node \
  --import ./test/helpers/setup-cat-registry.js \
  --test --test-timeout=60000 \
  packages/api/test/codex-agent-service.test.js
# tests 48 / pass 48 / fail 0

# Full gate
pnpm gate
# tests 17418 / pass 17404 / skipped 13 / cancelled 1 / fail 0
# 1 timeout: test/dare-smoke.test.js (DARE CLI headless smoke)
#   * PRE-EXISTING FLAKE on cat-cafe main HEAD — verified by running same test
#     on origin/main before intake (same `python exitCode:1 stderrEmpty:true
#     timeout 60s`)
#   * Not in PR diff scope (DARE != Codex)
#   * External dep: DARE Python subprocess + OpenRouter API
```

### Lint / Format

`pnpm gate` 内含 `pnpm check` + biome 全部通过（17404/17418，0 fail，仅前述 dare-smoke 超时）。

### Root artifact gate

```bash
git status --short | rg '^.. [^/]+\.(png|jpe?g|webp|gif|webm|mp4|mov|wav|pdf|pen)$'
# EXIT:1 (empty, clean)
git diff --name-only origin/main...HEAD | rg '^[^/]+\.(png|jpe?g|webp|gif|webm|mp4|mov|wav|pdf|pen)$'
# EXIT:1 (empty, clean)
```

### Apply landing

```bash
cd /Users/lysander/projects/relay-station/cat-cafe-intake-clowder-1014 && git status --short
# only 2 files modified (now committed); no leak to main worktree
```

---

## Reviewer 验收 sandbox 启动

```bash
# Path 1: review sandbox (per SOP)
mkdir -p /tmp/cat-cafe-review/intake-clowder-1014/gpt52
cd /tmp/cat-cafe-review/intake-clowder-1014/gpt52
git clone --depth=20 -b fix/intake-clowder-1014 https://github.com/zts212653/cat-cafe.git .
env -u NODE_ENV pnpm install
pnpm review:start   # standard entry, auto-allocates port

# Path 2: 直接复用 author worktree（read-only verify only）
cd /Users/lysander/projects/relay-station/cat-cafe-intake-clowder-1014
# 跑 author Validation 段落 commands 复现
```

---

## Open Questions (技术，给 reviewer)

1. **DARE smoke flake 处理**：我证实是 main HEAD 上同样失败，但 `pnpm gate` exit 1。SOP 要求 "Validation 段落命令裸跑可复现"——如果 reviewer 跑 `pnpm gate` 也撞同样 flake，是否接受 diff-scoped validation（targeted test 48/48 pass）作为充分证据？我倾向接受，因为：(a) 不在我 diff scope (b) main HEAD 同 fail mode (c) 外部依赖 not code regression。
2. **Manual-port 升级判断**：plan 脚本说 safe-cherry-pick；我升级到 manual-port 是按 SOP Step 1.1 软约束（high-risk file class + 同文件家里演化）。reviewer 是否同意此 conservative 选择？或认为应该接受脚本 safe-cherry-pick 分类？
3. **Upstream codex CLI 行为验证**：clowder-ai#1014 的 Windows Smoke CI 通过证明 `--config sandbox_mode=` 在 Windows runner 上生效；但 cat-cafe 这边没有 Windows runner 独立 verify。我接受 source CI 信号作为充分证据，reviewer 同意吗？

## Open Questions (价值，给 CVO — 如有)

无价值层 OQ。技术执行问题。

---

## How I might be wrong

- **过度 conservative**：升级 manual-port 多写了一份 home invariants 文档，可能 overkill — 但按 SOP 这是对的做法
- **接受 source CI 作为 Windows verify**：如果上游 Windows Smoke 实际只跑了浅 mock 而非真 sandbox 调用，那 `--config sandbox_mode=` 在 Windows 实际行为可能仍未 verify。本地无法穷尽
- **DARE flake gating**：如果 reviewer 不接受 diff-scoped validation，需要先修 dare-smoke 才能 advance — 但那不是 intake 的活

---

## Reviewer checklist

按 SOP B3.2.5 已写在 [absorb PR body](https://github.com/zts212653/cat-cafe/pull/2529) 里。

**裸跑命令至少一条复现**: 建议 reviewer 跑 `pnpm --filter @cat-cafe/api run build && CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 pnpm --dir packages/api exec node --import ./test/helpers/setup-cat-registry.js --test --test-timeout=60000 packages/api/test/codex-agent-service.test.js`（48/48 pass = 通过）。

---

[宪宪/Opus 4.7🐾]
