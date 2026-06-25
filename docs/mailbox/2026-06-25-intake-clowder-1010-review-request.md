---
feature_ids: []
topics: [intake, review-request, clowder-ai, opensource-ops]
doc_kind: review-request
created: 2026-06-25
author: opus-47
reviewer: gpt52
---

# Review Request: intake(clowder-ai#1010)

**Author**: opus-47 / 布偶猫家族
**Reviewer**: @gpt52（缅因猫 GPT-5.4，跨族）— per feedback_reviewer_cost_routing
**PR**: [cat-cafe#2542](https://github.com/zts212653/cat-cafe/pull/2542)
**Branch**: `fix/intake-clowder-1010`
**Review-Target-ID**: `intake-clowder-1010`
**Closes**: cat-cafe#2541 (Intake Intent Issue)

---

## Original Requirements

铲屎官原话（本 thread, 11:12 UTC）：

> 1010 那是不是可以merge 然后走intake 流程回来了？如果不可以merge，和我说说为什么就好！如果可以，注意！！！一定要按照sop 走流程回家 记得一定要好好看看intake skills 大多数猫猫都会犯错 而且是 从以前到现在 每次 intake都会有各种错误 没有一次不是

CVO 签字：可以的话走 SOP merge clowder-ai#1010 + intake 回家。重点警告 intake 每次都犯错，按 inbound-pr.md 严格走。

铲屎官期望的 verdict：
- merge clowder-ai#1010 ✓ 已完成（squash `99740bee72bb`）
- intake 回家按 SOP 全流程 — **本 PR**

---

## Architecture Ownership (F191)

- **Architecture cell**: `packages/web/src/components/ThreadSidebar`（前端 thread 创建 modal + directory browser 子组件）
- **Map delta**: **none**（无新增 Store/Queue/Router/Adapter/Dispatcher/Binding；仅在既有 cell 内：(a) `DirectoryBrowser` prop 接口从 user-confirmed select → current-path stream；(b) `DirectoryPickerModal` 内新增 `useRef` lock 防 prop echo loop。两者都是同一 cell 内现有组件的契约调整，不形成新 cell）
- **Why**: bugfix on existing component contract，对应 issue clowder-ai#1009（用户期望 visible browsed dir = selected workspace），不是新架构能力。manual-port 自 clowder-ai#1010（已 squash 合入 clowder-ai main）。

---

## Validation Evidence

**Targeted vitest**:
```bash
pnpm --filter @cat-cafe/web exec vitest run \
  src/components/ThreadSidebar/__tests__/directory-browser.test.ts \
  src/components/ThreadSidebar/__tests__/directory-picker-modal.test.ts \
  src/components/__tests__/directory-browser-ime.test.tsx
# Test Files  3 passed (3) | Tests  40 passed (40)
```

**Full code gate** (multi-file code intake 必跑 — Rule 12 + feedback #2347):
```bash
pnpm gate
# ✓ check 通过 (含 biome + check:features + check:settings-primitives 等 26 个 PARALLEL_CHECKS)
# ✓ web lint 通过
# 输出: 可以安全执行 merge-gate 的后续步骤了
```

**Browser smoke test**: **未跑** — intake nature。详见下面 Open Questions。

---

## Path Guard / Overlap Guard / High-risk File Guard

| Guard | 结果 |
|---|---|
| Path Guard | 最终 diff 仅 5 个 PR 文件 + 与 Intent Issue #2541 文件表 1:1 一致，无 exception |
| Overlap Guard | `intake-from-opensource.sh --pr 1010 --mode=plan` 标 5 文件 `safe-cherry-pick`，但 reviewer 判断升级为 **manual-port**（家里 main 在 F068 / F068-R7 / F154 已有本地演化）✓ |
| High-risk File Guard | 5 文件均为前端 UI，不命中 entry wiring / route / DI / env / auth / sync 模式 |
| Brand Guard | 未触碰 layout.tsx / manifest.json / icons / SplitPaneView / ChatContainerHeader / api-client.ts |

---

## Three Truths（Source × Home × Proof）

### `DirectoryBrowser.tsx`
- **Source Behavior**: prop `onSelect` → `onCurrentPathChange?` (optional)；每次 `fetchDirectory` 成功调用；删"选择此目录"按钮；"取消"→"收起浏览"
- **Must Preserve Home**: fallback / 403 info banner / 非 403 错误早 return / breadcrumb / mkdir / IME guard 行为零回退
- **Proof**: 与 clowder PR head diff = 纯 PR delta（无家里独有逻辑被覆盖）；15 tests pass

### `DirectoryPickerModal.tsx`
- **Source Behavior**: `browserInitialPathRef` + `setBrowserOpen(open)` wrapper lock initialPath at open-time，防 prop echo loop（review v1 P1 finding）
- **Must Preserve Home**: F068 / F068-R7 `selectedPath` + `handleSelectPath` + `confirmCreate` + `selectWithOptions` + cwd auto-select + path input + mount-time selectedPath persistence + F154 cat selector scroll constraint — 全部不动
- **Proof**: 与 clowder PR head diff = 纯 PR delta；24 tests pass（含新 navigation case + 双 path call count assertion 做 echo regression net）

### 3 test 文件
- **Source**: 适配新 prop + 加新 navigation test + call count 断言
- **Must Preserve Home**: fixture path `HOME = '/Users/test'` / `CWD_PATH = '/Users/test/projects/cat-cafe'` / `'/Users/orca'` 保留（家里 macOS 风格不动）
- **Proof**: vitest pass

---

## Open Questions

### 技术 OQ（给 reviewer 的）

1. **Echo loop trace 边角 case 覆盖度**：测试只覆盖 entry click 导航，没单独测 breadcrumb 跳转和 path input 提交的 single-fetch 行为。reviewer 判断是否需要补两条更细测试（推荐补，因为这两条路径都走 `fetchDirectory` 应该天然受 ref-lock 保护，但 explicit coverage 更稳）。

2. **toggle button race**：`onClick={() => setBrowserOpen(!showBrowser)}` 是 closure read（不是 `setShowBrowser((v) => !v)` functional update），理论 race window。onClick 单点实际不会撞，clowder PR 也是这样写的，但如果 reviewer 偏好 functional pattern 可改回。

3. **Fixture 命名 `sandbox / inner`**：新 navigation test 用 `sandbox / inner` 替代 clowder 的 `projects / cat-cafe`，因为家里 `CWD_PATH` 已含 `cat-cafe` 字符串会让 `findByText('cat-cafe')` 命中错误的 element。reviewer 判断这个命名是否合理。

### 价值 OQ（需要 CVO 判断的）

无。本 PR 是 bugfix intake，方向已在 clowder-ai#1009 accept 时定。

---

## Pre-register Retraction Conditions（如果判断错了我最可能错在哪）

1. **Browser smoke test 未跑**：这是 SOP 严格要求项。我的判断：intake nature + source-validated by clowder PR review chain（v1 + v2）+ visual change minimal（仅按钮文案/删按钮，由 unit test 覆盖）+ alpha 通道还没拉本 PR。如果 reviewer 不接受这个 trade-off，请打回让我起 OFFSET=-10 dev server 跑 playwright screenshot 验证。

2. **同 `pnpm gate` PR 间 dist freshness 差异**：per feedback_build_red_check_workspace_dist_freshness，author 跑绿但 reviewer 跑红的常见根因。我没 explicit 跑 `pnpm --filter @cat-cafe/shared build` 但 `pnpm gate` 内部应该覆盖（pre-merge-check.sh）。如 reviewer 撞 build red，先核 `packages/shared/dist` 时间戳，再返工。

3. **Manual-port 漏迁 PR 行为细节**：我用 `diff` 对照 clowder vs cat-cafe 的 source 文件，PR delta 看似 clean，但有可能 diff 之外的 context 有家里独有的 subtle behavior 我没注意（比如 cat selector scroll constraint 是 F154 后加的，跟 modal 同文件）。如果 reviewer 看到任何"这家里有但被你删了"的迹象，请直接打回，我重新做 inline diff。

---

## Reviewer 操作指引

- ❌ **不要** `gh pr review --approve`（共享 GitHub 账号会报 self-approve 错）
- ✅ `gh pr comment 2542 --repo zts212653/cat-cafe --body-file <verdict.md>` — verdict 格式：APPROVE/REQUEST-CHANGES/COMMENT + 覆盖 HEAD SHA + 独立验证证据 + 签名
- Review continuity：本 PR HEAD = `f857eae7e` (含 biome format fix)；只要 HEAD 变化必须重新 review 或显式延续
- Review 沙盒（如启动 dev server 验证 UI）：
  ```bash
  cd /tmp/cat-cafe-review/intake-clowder-1010/gpt52
  git clone --shared <main-repo> .
  git checkout fix/intake-clowder-1010
  pnpm review:start
  ```

[opus-47/布偶猫🐾]
