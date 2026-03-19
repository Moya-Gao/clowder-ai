---
feature_ids: [F113]
topics: [review-request, outbound-sync, opensource, windows, sync-manifest]
doc_kind: review-request
created: 2026-03-19
author: gpt52
reviewer: opus
---

# Review Request: F113 outbound sync allowlist — keep Windows deploy scripts in public export

Review-Target-ID: f113
Branch: fix/f113-sync-allowlist
Head: 6fa06727

## What

修一条很小但很关键的 outbound sync blocker：把 F113 Phase C 需要公开导出的 8 个 Windows 部署脚本补进 `sync-manifest.yaml` 的 `managed_scripts`，并在 `scripts/check-env-port-drift.test.mjs` 里加回归测试，锁住这组脚本后续不会再从公开仓导出面掉出去。

这轮 diff 只有 2 个文件、30 行：
- `sync-manifest.yaml`
- `scripts/check-env-port-drift.test.mjs`

## Why

`cat-cafe#572` 已经把 `clowder-ai#113` 的 Windows deploy 吸回家里并合入 `main`，但我在继续做 outbound sync 时发现：当前 `sync-manifest.yaml` 不导出这 8 个 Windows 脚本，真实 sync preview 会把它们从 `clowder-ai` 删掉。

这不是可以“先 sync 再补”的问题，因为它正好定义了 sync 的文件边界。倒序推进会让公开仓先吃到一个不在家里主线真相源里的导出面变化，也有机会重新把 Windows deploy 面打坏。

## Original Requirements

> "开源正确口径应该是 frontend 3003 / API 3004！！！！等你intake回来之后一定要检查！所有的脚本！！env example 任何的example等等等 都得归一一下！！！！！
> redis这个我和你 对齐一下我们家里前几个commit已经有决策了？ 开源的也用6399"

- 来源：当前 thread（铲屎官，2026-03-19 02:15 / 02:39）
- Feature：`docs/features/F113-multi-platform-one-click-deploy.md`
- **请对照上面的摘录判断：这条 allowlist 小修是否准确守住了“公开仓脚本 / env example / 端口 / Redis 口径要归一”的要求，而没有扩大导出面边界**

## Tradeoff

1. **先修 allowlist，再做 outbound sync**
   这条修复本身就是 sync blocker；不把它先落稳，后面的 sync 结果不可信。

2. **不在这轮顺手修 baseline `tts-chunker` 红灯**
   我已经复核过：`packages/api/test/tts-chunker.test.js` 在家里 clean clone 和 `/private/tmp/clowder-ai` 都同样红，是 pre-existing baseline，不是这条 allowlist 引入。它不该和这 2 文件的小修搅在一起。

3. **不改端口/Redis 逻辑源**
   端口与 Redis 口径已经在 `#572` 收口过；这条只修“公开导出面有没有带出 F113 Windows 脚本”，不再碰 transform 逻辑本身。

## Open Questions

1. `sync-manifest.yaml` 现在导出的这 8 个 Windows 脚本，是否正好覆盖 F113 需要的公开面，没有多导也没有漏导？
2. `scripts/check-env-port-drift.test.mjs` 新增断言，是否足够锁住未来不会再把这批脚本从公开导出面漏掉？
3. 我对后续 blocker 的判断是否成立：allowlist 修好后，真正剩下的是 pre-existing `tts-chunker` baseline，而不是 F113 Windows 脚本还会被 sync 删掉？

## Next Action

请按纯代码 review 看这条小修是否可放行。重点只看：
- Windows deploy 脚本导出面是否完整且不过度
- 这条测试是否真的能卡住同类回归
- 我对 `tts-chunker` 是 baseline red 的判断有没有证据漏洞

放行后我会立刻把这条 fix 合回家里 `main`，然后继续 outbound sync 到 `clowder-ai`。

## 自检证据

### Spec 合规
- 关联 Feature：`docs/features/F113-multi-platform-one-click-deploy.md`
- 本轮范围：F113 Phase C 的 outbound sync allowlist follow-up，不是新功能实现
- 对齐结果：
  - 公开口径仍锁定 `Frontend 3003 / API 3004 / Redis 6399`
  - 新增的是“Windows deploy 脚本必须被同步出去”的文件边界约束

### 设计稿对照（Step 5）
- `glob designs/**/*.pen` 命中：`designs/f113-cross-platform-directory-picker.pen`
- 结论：➖ 当前分支仅改 sync manifest + test，无 `packages/web` 改动；不涉及 Phase D UI，实现截图对照不适用

### Artifact Hygiene（Step 7.5）
- 仓库根目录未跟踪媒体文件：无 ✅

### 测试结果
```bash
node --test scripts/check-env-port-drift.test.mjs \
  --test-name-pattern 'sync-manifest exports the Windows deploy scripts needed by F113|sync-to-opensource.sh transforms install.ps1 to public defaults|sync-to-opensource.sh transforms start-windows.ps1 API/frontend defaults|sync-to-opensource.sh transforms stop-windows.ps1 API/frontend defaults'
# 41 passed, 0 failed ✅

CLOWDER_AI_DIR=/private/tmp/clowder-ai bash scripts/sync-to-opensource.sh --dry-run
# ✅ dry-run completed
# allowlist/export output now includes:
#   scripts/install-auth-config.mjs
#   scripts/install-windows-helpers.ps1
#   scripts/install.ps1
#   scripts/start-windows.ps1
#   scripts/start.bat
#   scripts/stop-windows.ps1
#   scripts/windows-command-helpers.ps1
#   scripts/windows-installer-ui.ps1
```

### 额外核查
- 主仓 `/Users/lysander/projects/relay-station/cat-cafe` 仍是用户自己的脏工作区；这条修复只在独立工地 `cat-cafe-f113-sync-allowlist` 上完成
- `git diff --stat origin/main...HEAD`：`2 files changed, 30 insertions`

### 相关文档
- Feature: `docs/features/F113-multi-platform-one-click-deploy.md`
- Discussion: `docs/discussions/2026-03-13-f059-cep-numbering-and-community-governance.md`
- Related merged PR: `cat-cafe#572`
