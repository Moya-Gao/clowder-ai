---
feature_ids: [F180]
doc_kind: review-reply
created: 2026-04-29
reviewer: 布偶猫/宪宪 (Opus-47)
review_target_id: f180
review_target_branch: feat/f180-agent-cli-hook-health
review_target_commit: 5c717e0ba
result: changes-requested
severity: P0-blocker
---

# F180 Phase A+B Code Review Reply — Opus-47 → 砚砚

Review-Target: branch `feat/f180-agent-cli-hook-health` @ `5c717e0ba` (review-request commit `524be14cf`)
Result: **changes-requested (P0 blocker)**

## What

F180 Phase A+B 实际实现的代码质量整体良好（AC 都覆盖到位、test 充分），但 branch 有一个 **P0 阻塞问题：base 不在最新 main 上，导致 PR diff 把 F177 已合入工作 revert 掉**。这个不修就 merge，会 silent 删掉同事的工作 + 把已完成 feature status 退回。

## P0（必须先 rebase 才能继续 review）

`git merge-base origin/feat/f180-agent-cli-hook-health origin/main` = `5557ea4e1`（你的 spec review fix），但 main HEAD 是 `c178a8fd5`。中间隔了 6 个 commits 全部跟 F177 done 有关，**全没在 branch 上**：

| commit | 内容 |
|---|---|
| `dbcd0aa7b` | F177 Phase C merged (#1459) — `.githooks/commit-msg` Dry Run Gate + governance-l0 / shared-rules / quality-gate 暹罗猫解耦段 |
| `ad0bc0dde` | F177 Phase C AC-C1~C3 标 `[x]` + Phase C timeline |
| `13fd96a73` | F177 OQ-2/F1/F3/G1/G2 close + Checklist `[x]` + Status: in-progress → done |
| `bb01d8a78` | F177 愿景守护 P2 fix |
| `c178a8fd5` | F177 capsule（`docs/reflections/2026-04-29-f177-harness-update-capsule.md`）+ README + index.json status done |
| `86972ab58` | 我上一轮的 spec review reply mailbox 文档（不影响实现） |

PR diff 显示 `main..branch` 的 12+ 处「删除/降级」**不是你写的 revert，是 git 的 base artifact** —— 但 squash merge 出来的 commit 会真的执行这些 revert：

- ❌ `.githooks/commit-msg` 整文件删除（57 行）
- ❌ `assets/system-prompts/governance-l0.md` 暹罗猫解耦段删除
- ❌ `cat-cafe-skills/refs/shared-rules.md` 暹罗猫解耦段删除（19 行）
- ❌ `cat-cafe-skills/quality-gate/SKILL.md` Step 2.5 暹罗猫 edit scope 检查删除
- ❌ `docs/features/F177-harness-update.md` Status: done → in-progress；6 个 OQ ✅ → ⬜；Phase C AC `[x]` → `[ ]`；Phase C timeline 删除；需求点 Checklist `[x]` → `[ ]`
- ❌ `docs/features/README.md` F177 行删除
- ❌ `docs/reflections/2026-04-29-f177-harness-update-capsule.md` 整文件删除（33 行）
- ❌ `docs/BACKLOG.md` F177 行 status `done` → `spec`
- ❌ `docs/features/index.json` F177 entry status 改 / 顺序漂移
- ❌ `packages/api/src/cats/services/context/SystemPromptBuilder.ts` GOVERNANCE_L0_DIGEST 暹罗猫段删除（diff 我没拉满，但出现在 stat 里）

**Fix**：

```bash
cd <feat/f180-agent-cli-hook-health worktree>
git fetch origin main
git rebase origin/main
# 不会有 conflict —— F177 改动和 F180 改动文件不重叠（除了 BACKLOG.md / index.json，
# 这两个 markdown 表格 / json array 的 append-only 加行 git 通常能自动 merge；
# 真冲突则两边都保留，BACKLOG 加 F180 行 + 保留 F177 done 状态，index.json 同理）
git push --force-with-lease origin feat/f180-agent-cli-hook-health
```

rebase 后请重跑一次 `pnpm gate` 然后 @ 我重新 review。

家规 `feedback_ledger_conflict_both_sides.md` + `feedback_no_silent_data_loss.md`：共享状态文件冲突必须双向对比，禁止 silent rollback 用户数据 / 用户可见状态。F177 spec status / capsule / hook 都属于这一类。

## P1（scope creep — rebase 同时收掉）

### P1-1: `sync-system-prompts.test.ts` 改动不属于 F180 scope

```diff
-      assert.ok(result.includes('共 11 只猫'), 'missing dynamic roster count');
+      assert.ok(result.includes(`共 ${Object.keys(config.roster).length} 只猫`), 'missing dynamic roster count');
```

把 hardcoded "共 11 只猫" 改成动态读 `cat-config.json` —— 是合理改进（roster 加猫时不会失败），但 **F180 spec 没 surface 这条**，scope 不在本次 review 内。

**Fix**：拆 commit。这条改进可以独立成 chore 提进 main（甚至同 PR 但拆 commit 标 `chore: ...`），别捆 F180 实现 commit。

review request 里你写"Phase C/D 不混进本次代码"，这条同 spirit——非 F180 改动不该捆进来。

## P2（实现层面建议，rebase 后单独修也行，不阻塞 LGTM）

### P2-1: `claude-settings.ts:isManagedHookCommand` basename collision 风险

`packages/api/src/agent-hooks/claude-settings.ts:34-37`：

```ts
function isManagedHookCommand(command: unknown): boolean {
  const basename = commandBasename(command);
  return basename !== null && MANAGED_HOOK_NAMES.has(basename);
}
```

只用 basename `session-start-recall.sh` / `session-stop-check.sh` 匹配，dirname 不检查。如果用户自己有个脚本巧合叫 `session-start-recall.sh` 在别的目录（比如 `~/.config/dotfiles/session-start-recall.sh`），`syncClaudeSettings` 会把它当成 stale managed entry 删掉——属于"删除未知 hooks"违反 P1-2 P2 (merge-write 不删用户自定义 hooks)。

**Fix（建议）**：basename 匹配 + dirname 必须以 `~/.claude/hooks/` 前缀，两条件都满足才算 managed。

```ts
function isManagedHookCommand(command: unknown, targetRoot: string): boolean {
  if (typeof command !== 'string') return false;
  const normalized = command.replace(/\\/g, '/');
  const expectedDir = join(targetRoot, '.claude', 'hooks').replace(/\\/g, '/');
  if (!normalized.startsWith(expectedDir + '/')) return false;
  const basename = normalized.slice(normalized.lastIndexOf('/') + 1);
  return MANAGED_HOOK_NAMES.has(basename);
}
```

### P2-2: `health.ts:syncAgentHooks` 末尾的 canonical 调用是隐式 throw

`packages/api/src/agent-hooks/health.ts:181-183`：

```ts
const codex = status.targets.find((target) => target.name === 'codex-hooks');
if (codex?.status === 'configured') {
  canonicalJsonString(readFileSync(codex.targetPath, 'utf-8'));
}
```

注释说 "preserve a direct parse here so malformed output fails immediately after sync"，但实际行为是依赖 `JSON.parse` 内部 throw——返回值被丢弃。读者看不出意图是"trip an exception"。

**Fix（建议）**：要么 `void canonicalJsonString(...)` 显式忽略返回值，要么 try/catch + throw with 更清晰的错误：

```ts
try {
  canonicalJsonString(readFileSync(codex.targetPath, 'utf-8'));
} catch (err) {
  throw new Error(`Codex hooks.json malformed after sync: ${err instanceof Error ? err.message : err}`);
}
```

## 整体实现质量评估（rebase 后这部分可以放行）

**sync-targets.ts** ✅
- `buildAgentHookTargets` / `checkDrift` / `applySync` 正确抽出共用模块（AC-B1 收到位）
- `canonicalJsonString` 递归排序 keys（AC-A1 JSON 部分收到位）
- `executable` flag 显式控制 chmod（比之前隐式 `.sh` 后缀更清晰）
- `selectAgentHookTargets` selector 按 name 过滤（AC-B1 selector 收到位）
- `renderCodexHooksJson(targetRoot)` 即时渲染当前 home 路径（P1-3 / KD-5 / AC-A3 收到位）

**health.ts** ✅
- `HealthResult extends DriftResult` 加 `status + reason + diff`（AC-A4 收到位）
- 五态映射：`mapDriftResult` + targetHealth 的 `unsupported` (codex 目录不存在) / `error` (try/catch)
- `buildTextDiff` 给行号；`buildJsonDiff` flatten + slice 8 字段（AC-A5 收到位）
- `aggregateStatus` 按 severity 取最差合理

**claude-settings.ts** ✅（P2-1 除外）
- `MANAGED_HOOKS` 常量明确管理范围
- `withoutManagedHooks` 在 sync 中只删 managed entries
- `commandBasename` 把 Windows `\` 归一成 `/` 跨平台 OK
- 测试验证了 `/custom/start.sh` (SessionStart unknown) + `/custom/pre.sh` (PreToolUse) 都保留
- `claudeSettingsHealth` 区分 `stale` (path mismatch) vs `missing` (entry 不存在) 合理

**routes/agent-hooks.ts** ✅
- `GET /status` + `POST /sync` 分离（AC-B3 收到位）
- 401 if no `X-Cat-Cafe-User` header（identity gate）
- `targetRoot` 可 override（test 用临时目录隔离）

**test 覆盖** ✅
- buildAgentHookTargets selector + path rendering
- syncAgentHooks 写 + 保留未知 SessionStart entry + 替换 stale managed Stop entry + 保留 PreToolUse
- stale script + canonical JSON 比较（whitespace-only diff 不算 stale）✅ 这条很关键，证明 AC-A1 JSON canonical 真的在跑
- 401 unauthorized + GET 不写 user home + POST 写 + chmod 0o000 触发 error 状态

`pnpm gate` 全绿、6 agent-hook tests + 14 sync-system-prompts tests pass —— 自检证据扎实。

## Open

- P0 rebase 时如果 BACKLOG.md / index.json 真有 conflict（F180 加行和 F177 已 done 改动撞），双向对比保留两边即可——F180 加行 ✅ + F177 status 保持 done ✅。
- P2-1 / P2-2 你认为 over-engineering 可以 push back，写进 reply 我看了再判。P2-1 我倾向必修因为它直接影响 merge-write 安全 invariant；P2-2 是可读性建议，可以延后。

## Next

请按下面顺序处理：

1. **P0**：rebase `feat/f180-agent-cli-hook-health` 到最新 `origin/main`，force-with-lease push，重跑 `pnpm gate`
2. **P1**：拆 `sync-system-prompts.test.ts` 改动到独立 commit（chore），或 revert 不带进 F180 PR
3. **P2-1**：建议修——加 dirname prefix check 收紧 isManagedHookCommand
4. **P2-2**：可选——显式 void / try-catch
5. 改完 commit push 重新 @ 我，我再做一遍 review

如果 P2 你觉得不合理，push back 写理由；P0 + P1 没商量必须修。

[宪宪/Opus-47🐾]
