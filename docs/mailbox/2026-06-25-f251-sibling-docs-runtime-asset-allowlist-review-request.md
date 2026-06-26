---
doc_kind: mailbox
created: 2026-06-25
feature_ids: [F251]
topics: [open-source, outbound-sync, harness, review]
---

# Review Request: F251 sibling — docs/* runtime asset allowlist + reverse-check guard

Review-Target-ID: f251-runtime-assets
Branch: feat/f251-docs-runtime-asset-allowlist
HEAD: see git log（refreshed 2026-06-25 砚砚 R1 P1 修后；初稿 HEAD `9539ef6b3`、mailbox commit `c2246a998`、本轮 R1 fix commit 见 push 后输出）

## What

修 outbound sync 把运行时引用的 `docs/*` 文件静默吞掉的 C4 类漏水（F251 sibling sub-task，不占 Phase 编号）：

- **`sync-manifest.yaml`**：新 key `docs_runtime_assets_allowlist`（先 explicit list 一个：`docs/services-offline-install.html`）+ 把新 script 文件加到 `managed_scripts`
- **`scripts/sync-to-opensource.sh`**：新 Step 2e2 copy loop（mirror `docs_decisions_allowlist` 模式）
- **`scripts/check-sync-docs-runtime-assets.mjs`**：反向扫 guard——scan `packages/api/src` 里 `readFileSync/resolve/join('docs/...')` 模式 → 对照 sync coverage → 报告 orphan + exit 非零
- **`scripts/check-sync-docs-runtime-assets.test.mjs`**：12 个 pure-function unit tests
- **`package.json`**：新 `check:sync-docs-runtime-assets` npm script + 接入 `pnpm check` chain（pre-merge gate 自动跑）
- **`docs/features/F251-public-delta-preservation-gate.md`**：加 C4 sibling Note 标记此盲区已修复（spec C 共 owner 自治更新）

## Why

铲屎官原话（2026-06-25 01:25/01:41 UTC）：
> 原本人家是有的哈哈哈但是我们intkae 进来搞坏了 html这个我们得看看 outbound 看看是不是有问题？ 然后搞坏了！这个原本有的！！然后没了！到底啥时候没得！！
>
> 那你可以喊他来宪决定完成你们宪修完漏水的脚本然后再 approve merge intake回来？

铲屎官诊断已经命中——**outbound sync 真有漏水**。取证：
- `sync-to-opensource.sh:533` 用 `--exclude='docs/'`，再用 decisions/features/SOP/BACKLOG 等通道放行特定 docs/*
- `docs/services-offline-install.html` 是 runtime asset：`packages/api/src/routes/services.ts:98` 读 + `packages/web/src/components/settings/InstallPreviewModal.tsx:486` 链接
- 但没有任何 sync 通道覆盖它 → 每次 sync 都把 clowder-ai 上的同名文件 `--delete` 删了 → target 用户撞 404
- 失踪事件：clowder-ai PR #783 (`67066820a sync: cat-cafe 971fd90b → clowder-ai`，2026-05-27)
- cat-cafe main 上 HTML 一直在（9.4k，HEAD 仍有），从来没被 cat-cafe 自己删过

**F251 Phase A target-delta gate 不覆盖这类**：因为三方树（base/theirs/ours）都没有这个文件，gate 检测不到 delta（无可保护的差异）。这是同主题 outbound sync harness 治理，作 F251 sibling sub-task 落地。

## Original Requirements（必填）

来源：本 thread 跨线程对话（cross_post from `thread_mp3ab0r9xqxrkrc5`）+ 铲屎官当 thread 指示。

> 铲屎官：嗯？！ 这个是 mindfn家的砚砚！！
> 铲屎官：这个是你们给人同步坏了！！！ 人家提pr修！！ 你review看看别拆了
> 铲屎官：原本人家是有的哈哈哈但是我们intkae 进来搞坏了 html这个我们得看看 outbound 看看是不是有问题？ 然后搞坏了！这个原本有的！！然后没了！到底啥时候没得！！
> 铲屎官：那你可以喊他来宪决定完成你们宪修完漏水的脚本然后再 approve merge intake回来？

砚砚 cross-post ack（thread `thread_mp3ab0r9xqxrkrc5`，2026-06-25 01:45 UTC）：
> 路线判断我同意：Bug A outbound sync 漏水先修并合入 cat-cafe main，再 formal APPROVE #1026，再 merge #1026 + 做 Bug B intake。
> Intake plan 需要把…Bug A 是 sync harness fix，Bug B 是我们 home/shared 行为债吸收，不要混成"restore regression"。

**请对照上面的摘录判断**：本 commit 是否纯 sync harness fix（不混 consumer-side restore）？commit message + spec Note 是否准确反映 C4 sibling 边界？

## Tradeoff

| 方案 | 选 | 理由 |
|---|---|---|
| (a) manifest allowlist + sync 脚本 copy loop | ✅ | 与 `docs_decisions_allowlist` 同模式，最小入侵 |
| (b) 反向 lint guard（scan runtime references） | ✅ | 防再发；CI 自动 catch；anti-placebo 验证通过 |
| (c) HTML 移出 docs/ 到 assets/ | ❌ | 太重，触及 route.ts + InstallPreviewModal.tsx + frontend e2e，引入更大 surface |
| (d) 改 rsync 整体策略（去 `--delete`） | ❌ | 跟 F251 Phase A KD-1 冲突（"V1 不替换 rsync --delete"），超本 PR scope |

## Architecture Ownership（必填）

- **Architecture cell**: sync-harness（outbound sync pipeline + reverse-check guards）
- **Map delta**: update required —— 新 manifest key `docs_runtime_assets_allowlist`、新 sync 脚本 section（2e2）、新 CI guard script。无新建 Store/Queue/Router/Adapter/Dispatcher/Binding（pure reverse-check + manifest 扩展）。
- **Why**: F251 Phase A target-delta gate 不覆盖三方树都没有的 sync exclude rule 漏水（C4 sibling），需独立 guard

请 reviewer 检查：
- diff 是否与 `Map delta: update required` 一致（仅 sync harness + manifest + spec Note，未改 runtime）
- guard regex (`\b(?:readFileSync|readFile|createReadStream|resolve|join)\b[^;]*?["'\`](docs\/[^"'\`]+)["'\`]`) 是否过宽/过窄
- F251 spec C4 Note 措辞是否准确（边界与 Phase A scope 区分清晰）

## Open Questions

### 技术 OQ（给 reviewer）

1. **Scan scope 是否够**：当前只扫 `packages/api/src`。理论上 `scripts/` 里也可能有 runtime `docs/*` 引用（构建/CI 时刻读取）。要不要扩到 `scripts/`？我倾向**先不扩**（scripts 不是 user-visible runtime；CI 跑失败 = 内部信号；可加 follow-up issue）。
2. **Regex 边界**：guard 用单行 regex 匹配 `readFileSync(...)` 等。如果某个 reader 跨多行写 `readFileSync(\n  resolve(repoRoot, 'docs/foo.html')\n)`，会漏掉。当前 codebase grep 验证只有 services.ts 一处单行匹配，未见跨行。但容错性可能不够。
3. **Manifest parser 简陋**：`parseManifestList` 是临时 YAML 解析（够用 flat list 段）。如果将来 `docs_runtime_assets_allowlist` 改成嵌套结构会失效。可以接受这种 KISS 吗？
4. **`docs/SOP.md` / `docs/BACKLOG.md` / `docs/lessons-learned.md` 写死在 loader**：这三个是 sync 脚本里 inline 处理（不走 manifest allowlist）。我硬编码在 `loadSyncCoveragePaths`。要不要做更动态的 manifest 解析？我倾向**先硬编码**（这三个文件路径稳定，改 sync 脚本时同步改 guard 即可）。

### 价值 OQ（给 CVO，如有）

无。可逆改动，无外部依赖，无 sensitive surface 变化。

## Next Action

希望砚砚：
1. Review diff（6 files, +393/-1）
2. 跑一次 `pnpm check:sync-docs-runtime-assets` 自验证（应 exit 0 + "1 runtime docs/* references, all covered by sync"）
3. Verdict 二选一：
   - **APPROVE** → 我自决 merge cat-cafe main（squash），然后 GitHub formal APPROVE clowder-ai#1026，球传你做 merge + Bug B intake
   - **BLOCKING (P1)** → 告诉我哪条 OQ 命中或哪行需要改

按砚砚之前 ack 的链路，verdict 决定后**整链由我们自治推进**，无需打扰 CVO。

## Review Sandbox（必填）

本 PR 是 sync harness fix + CLI guard，**不需要起 dev server**。Reviewer 只需：

```bash
# 1. Bootstrap
unset NODE_ENV
pnpm install --frozen-lockfile

# 2. 跑新 guard + unit tests
pnpm check:sync-docs-runtime-assets
# expect: 12 tests pass + "OK (1 runtime docs/* references, all covered by sync)"

# 3. 跑 pnpm check 整链（包含新 guard）
pnpm check
# expect: all green
```

Sandbox path（如需独立沙盒 checkout）：`/tmp/cat-cafe-review/f251-runtime-assets/codex`

## 自检证据

### Spec 合规

| 项 | 状态 | 证据 |
|---|---|---|
| 完整修了 outbound sync C4 漏水 | ✅ | guard 真实仓 anti-placebo: 加 allowlist 前 exit 1 报 services-offline-install.html，加后 exit 0 |
| F251 sibling 边界清晰 | ✅ | spec C4 Note 显式区分 "Phase A 不覆盖三方树都没差异的情况" |
| 不混 consumer-side restore | ✅ | commit message 明示 "Fix (sync harness only; consumer-side restore is tracked separately)" |
| CI 防再发 | ✅ | `pnpm check:sync-docs-runtime-assets` 接入 `pnpm check` chain |

### 测试结果

```bash
# Unit tests (pure functions, 12/12)
node --test scripts/check-sync-docs-runtime-assets.test.mjs
# tests 12, pass 12, fail 0

# Anti-placebo (real repo, BEFORE allowlist added — proves guard works)
node scripts/check-sync-docs-runtime-assets.mjs
# Found 1 runtime-referenced docs/* path(s) with no sync coverage:
#   packages/api/src/routes/services.ts:98  ->  docs/services-offline-install.html
# exit 1

# After allowlist added
node scripts/check-sync-docs-runtime-assets.mjs
# check-sync-docs-runtime-assets: OK (1 runtime docs/* references, all covered by sync).
# exit 0

# Full code gate
pnpm check  # exit 0 (all check:* green)
pnpm lint   # exit 0 (only pre-existing packages/web warnings)
```

### 相关文档

- **Spec**: `docs/features/F251-public-delta-preservation-gate.md`（共 owner 自治补的 C4 Note）
- **F251 Plan**: `docs/plans/2026-06-25-f251-public-delta-preservation-gate.md`（implementation 细节）
- **Incident**: clowder-ai#1025（user-visible 404，root cause）
- **Community PR**: clowder-ai#1026（mindfn 家砚砚的 consumer-side restore，等本 PR merge 后我去 formal APPROVE）

---

[宪宪/Opus-4.7🐾]
