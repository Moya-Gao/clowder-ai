---
feature_ids: []
topics: [review-request, intake, community, opensource, clowder-ai-1024]
doc_kind: review-request
created: 2026-06-25
author: opus47
intake_source: clowder-ai#1024
intake_intent_issue: cat-cafe#2576
absorb_pr: cat-cafe#2582
---

# Review Request: intake clowder-ai#1024 — bootcamp modal create feedback

Review-Target-ID: `intake-clowder-1024`
Branch: `fix/intake-clowder-1024`
PR: https://github.com/zts212653/cat-cafe/pull/2582
Intake Intent Issue: https://github.com/zts212653/cat-cafe/issues/2576

## What

Absorb 社区 PR clowder-ai#1024（fixes clowder-ai#1023）— 修复 BootcampListModal 创建按钮 UI 视觉 bug + 表面化创建失败错误反馈。两个 commit：

1. **`cd5615070` Fix bootcamp modal create feedback (#1024)** — community cherry-pick (author=labulalala 归属保留)
   - `w-4.5 h-4.5`（Tailwind 不支持，默认 fallback 撑开按钮）→ `w-5 h-5 shrink-0`
   - 按钮加 `whitespace-nowrap` 防中文换行
   - 新增 `readApiError` / `normalizeCreateError` / `showCreateError` helpers
   - handleCreate：非 ok → 读 API error → normalize → toast；catch → toast；不再 silent return
   - 新增 vitest 用例覆盖 className + toast 调用
2. **`bd91d3db8` chore: biome format baseline fix** — pre-existing main 红被 fast-fail
   - 仅 baseline format（inline→multiline），无行为变化
   - 由 `2422385e3 feat(merge-gate): Step 7.5` 引入；不修就 `pnpm gate` 过不去

## Why

社区贡献者 @labulalala 提交的 bug fix，packages/web 是共享 runtime 代码（cat-cafe + clowder-ai 镜像），fix 必须吸收回家以保持双仓行为一致。Plan 输出全部 safe-cherry-pick，无 Brand Guard / High-risk / Overlap。

## Original Requirements

> "@opus47 你家又土豆服务器了 继续吧" — 上一轮铲屎官指令
>
> 上文："如果可以（merge），注意！！！一定要按照sop 走流程回家 记得一定要好好看看intake skills 大多数猫猫都会犯错 而且是 从以前到现在 每次 intake都会有各种错误 没有一次不是"
>
> 上文："你自己thred 完成这些闭环别找 issue那个平行世界呀"

- 来源：本 thread 铲屎官原话（守门 thread `thread_mp3ab0r9xqxrkrc5` 投递后续）
- **请 reviewer 对照判断**：本 PR 是否按 intake SOP 完整闭环，是否避免了"踢给平行世界"的反模式

## Tradeoff

| 备选 | 我选 | 弃 | 原因 |
|------|------|-----|------|
| chore biome fix 单独开 PR | 同 PR 内分 commit | 单独 PR | 串行 2 PR 时间成本翻倍；分 commit 已让 reviewer 一眼分辨 scope |
| Reimplement 改动（不 cherry-pick） | git cherry-pick 跨仓 commit | 重写 | 保留 community contributor 作者归属（labulalala GitHub commit graph） |
| 用 absorb route 的 `--skip-absorbed-guard` 例外通道 | 默认 absorbed lane | skip-guard | 不是 `direct-main historical backfill` / `outbound-filed hotfix`，没资格走例外 |

## Architecture Ownership

Architecture cell: `packages/web/components/bootcamp`
Map delta: none
Why: 仅修一个已存在 component (`BootcampListModal`) 的内部实现 + 新增 helper functions（同文件内私有），不新建 Store/Queue/Router/Adapter；toastStore 是已有 dependency，仅消费不改 shape

请 reviewer 检查：
- diff 是否与 `Map delta: none` 一致
- toastStore 用法是否跟 QueuePanel 等既有 pattern 一致

## Open Questions

### 技术 OQ（给 reviewer）

1. **Cherry-pick 行为等价性**：cat-cafe main 上的 BootcampListModal 是否在 PR base 时就跟 clowder-ai 完全一致？plan 判 safe-cherry-pick 已 imply 无 home delta，但 reviewer 自己 verify 一下更稳。
2. **Baseline biome fix 是否真 baseline**：`bd91d3db8` 是 `pnpm biome check --write` 自动产出，无逻辑改动。reviewer 可 `git show bd91d3db8 -- packages/api/` diff 确认全是 inline↔multiline format。
3. **chore commit 是否应分独立 PR**：本 PR 同时承载 intake + baseline biome fix。我选 bundle 避免串行 2 PR，但接受 reviewer 要求 split。
4. **未单独浏览器实测**：vitest 覆盖了 button className + svg className + toast addToast 调用，上游 clowder-ai CI Test Public 12m46s passed。Icon size 改动 1-2px 视觉级，不破 layout。如果 reviewer 觉得必须 spin up dev 实测，请明示。

### 价值 OQ（给 CVO）

无 — 都是技术细节，回滚成本低（PR 一键 revert）。

### 我可能错在哪（pre-register retraction）

1. ① 选 bundle vs split chore commit 错 → reviewer 要求拆，REQUEST-CHANGES 即可
2. ② cat-cafe main BootcampListModal 跟 clowder-ai 不一致（home delta）→ plan 判 safe 但 reviewer 实查发现 overlap → 升级 manual-port
3. ③ Intake Intent Issue #2576 三真相填得不够全 → reviewer 让补

## Next Action

Reviewer：
1. Verify 两个 commit 的 scope 拆分清楚
2. 对照 Intake Intent Issue #2576 逐文件决策表检查
3. 给 verdict（APPROVE / REQUEST-CHANGES / COMMENT）→ 用 `gh pr comment` 写到 cat-cafe#2582 上（不能 `--approve`，author/reviewer 共 GH 账号会报错）
4. APPROVE 后 ping 回我（行首 `@opus47`），我做 record + advance-ledger + merge + close intent issue

## Review Sandbox

- Path: `/tmp/cat-cafe-review/intake-clowder-1024/gpt52`
- Start Command: `pnpm review:start`
- Ports: `web=5202`, `api=3202`（默认 review:start 分配，禁 3001/3002/3011/3012/4111）

### 沙盒 Bootstrap

```bash
# 1. 清继承的 NODE_ENV=production
unset NODE_ENV
# 2. 干净安装
pnpm install --frozen-lockfile
# 3. 此 PR 无 dist/ import 依赖，不需 build shared/api
```

## 自检证据

### Spec 合规
- Intake Intent Issue #2576 三真相（Source / Must Preserve / Proof）已填
- Plan classification：✓ safe-cherry-pick (2 files)，无 Brand Guard / High-risk / Overlap
- Runtime data flow 已实测通过（错误源 → HTTP shape → toast 渲染）

### 测试结果

```bash
# 1. Targeted vitest
pnpm --filter @cat-cafe/web exec vitest run \
  src/components/__tests__/bootcamp-list-modal-navigation.test.tsx
# → 2 tests passed, 0 failed (27ms)

# 2. Full gate
pnpm gate --no-rebase --skip-install
# → ✅ GATE PASSED (213s)
#    rebase  0s / install  0s / build 20s / tsc  7s / test 154s / lint+check 31s
```

### 相关文档
- Intake Intent Issue: cat-cafe#2576
- Source PR: clowder-ai#1024 (merged `0aa5961`)
- Linked issue: clowder-ai#1023

---

[宪宪/opus-4.7🐾]
