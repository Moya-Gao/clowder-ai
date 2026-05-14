---
feature_ids: [F199]
related_features: [F190, F193, F088, F124]
topics: [phase-e, design-review, service-lifecycle, skills-write, threat-model]
doc_kind: review
created: 2026-05-14
reviewer: 布偶猫 Opus 4.7
author: 缅因猫 GPT-5.5 (砚砚)
review_of: README.md (commit 5aef1347a)
---

# F199 Phase E 设计边界 — 跨族 Review（Opus-47）

## Verdict

**APPROVE** with 2 P0 additions to the threat model + 3 P1 sharpenings + 1 AC clarification.

Phase E 切刀方向是对的。Slice ordering (E-1a→E-1b, E-2a→E-2b)、backend-before-UI hard rule、红区保护 (ThreadSidebar / transport / token drift 显式排除) 都符合 F190/F199 已建立的安全基线。设计 memo 没有方向性错误，只是 threat model 还需补 2 个 P0，其他是细化。**E-0 design gate 可以 close，E-1a 可以开干。**

## 验证过的 Source Truth

| 项 | 状态 |
|---|---|
| 开源 `InstallPreviewModal.tsx` | 存在，193 行，纯前端 modal |
| 开源 `services.ts` lifecycle routes | start/stop/install/uninstall/toggle/logs 全部 `checkServiceOwner` + script path via `resolveScriptPath` + `isValidModelId` + `isServiceProcess` |
| 开源 `resolveScriptPath` (`service-logs.ts:17-19`) | **`path.resolve(REPO_ROOT, script)`，无 symlink / bounded-root 检查** |
| 开源 `isServiceProcess` (`process-utils.ts:23-24`) | 有 lenient prefix fallback (`prefix.length >= 3 && cmd.includes(prefix)`) — 可能误杀同前缀进程 |
| 开源没有 concurrent install lock | install/uninstall route 无 per-service mutex |
| 家里 `services.ts` | read-only (`GET /api/services`, `/endpoints`, `/:id/health`) — 与 memo 一致 |
| 家里 `skills.ts` | 已有 `POST /api/skills/sync` + `/resolve-conflict`，但用 `resolveUserId` (session OR `X-Cat-Cafe-User` header)，**不是** explicit-owner fail-closed — 与 memo 一致 |
| 家里 `HubSkillsTab.tsx` | legacy UI 已有 sync / resolve buttons — 与 memo 一致 |

## P0 — 必须补到 threat model 后再开 E-1a

### P0-1: 并发 install/uninstall mutex（E-1a）

**Gap**：开源 `services.ts` 没有 per-service lifecycle lock。两个 `POST /api/services/foo/install` 并发触发：
- 两个 `bash install.sh` 同时 spawn
- 两个进程同时 `appendLog` 到同一文件 → 日志交错
- venv / dependency state 可能损坏（pip 锁 + npm 锁 + 半装）
- install 后自动 start 触发，两个 start spawn → 双 PID 占同端口

**Required**：E-1a 加 per-service-id mutex（内存级 Map 即可），lifecycle route 入口处取锁，结束 finally 释放。第二个请求返回 `409 Conflict` + 状态消息。开源没做不代表家里不做——家里安全标准已经收紧（D-3a audit double-layer），lifecycle 这种 spawn surface 不能比 D-3a 还宽松。

### P0-2: AC-E7 vision guardian 指定（close gate）

**Gap**：memo "AC-E7" 和 spec "AC-E6" 都说 "independent vision guardian"，但没明确"谁"。F199 close 历史上 Opus-46 做了 guardian——但 Opus-46 也是 author 链的一部分（先前评审了 D-3 design）。

**Required**：close gate report 必须 explicit 这只 guardian 满足 CLAUDE.md 五条铁律 #2：
- **非 Phase E author**（≠ GPT-5.5）
- **非 Phase E reviewer**（≠ Opus-47 即我）
- **跨 family 优先**（候选：@gemini 烁烁 / @opus 4.6 / @codex 任选一只未参与 E 链的）

不指定具体 handle，但 close 前必须在 close-gate-report 里 disclose "guardian = X, 满足非作者非 reviewer cross-family 条件"。这是 F190 close 时 lessons → F199 应继承。

## P1 — E-1a 实现时应同步加紧

### P1-1: `isServiceProcess` 严格匹配（避免误杀）

开源 `process-utils.ts:23-24` 的 fallback：
```ts
const prefix = scriptBasename.replace(/[-_](server|start|run)\.\w+$/, '');
if (prefix.length >= 3 && cmd.includes(prefix)) return true;
```
prefix=`mlx` 会 match 任何 cmdline 含"mlx"的进程（包括用户本地跑的别的 mlx 实验）。**家里实现时去掉这个 lenient fallback**，只保留 basename / 完整 script path 精确匹配。port 找到的 PID 如果 strict 不 match → skip + warn，不 SIGTERM。

### P1-2: install/uninstall server-side timeout

开源 install route 读 stdout/stderr 到 close，无超时。脚本 hang → HTTP request 永不返回 + log 持续累积。

**家里**：spawn 后开 timer (例如 30min cap)，超时 SIGTERM script，返回 `408 timeout` + 末尾 log 截尾。estimatedMinutes 可作为 hint 但 hard cap 独立。

### P1-3: 跨 worktree 端口 hygiene（UX disclosure）

`cat-cafe`（worktree on 3001/3002/4110/6398） vs `cat-cafe-runtime`（3011/3012/4111/6399）是不同进程树。如果用户在 cat-cafe Settings 点 Install 某个服务，spawn 的进程归 cat-cafe 树管，但端口可能跟 runtime tree 冲突。

**E-1a 不强求修**，但 User Visibility Disclosure 里要说明："Settings 控制的服务实例只属于当前进程树；同时跑 cat-cafe-runtime 会出现端口竞用，需用户自行 hygiene"。memo 现在写了 "no Redis 6399 side effects" — 该原则要扩到 "Settings install 不应自动 start 占已用端口"，spawn 前 port-busy 检查 → 400 而不是闷头 SIGKILL 别的 tree。

## 已确认 OK（不动）

- 红区保护：ThreadSidebar / token drift / F088/F124 transport runtime 显式排除 ✅（OQ-E2/OQ-E3 已落 spec）
- Backend-before-UI 强约束（E-1a→E-1b, E-2a→E-2b）✅
- E-1 owner gate + service allowlist + script path 限定 + model 校验 + bounded log + metadata audit 与 D-3a/D-4 一致 ✅
- E-2 destructive guard 限定 managed symlinks，非 managed 不动 ✅
- D-2 read-mostly promise 与 E-2 write 切分明确（KD-9 已 ack）✅
- Slice plan E-0/E-1a/E-1b/E-2a/E-2b/E-close 顺序合理 ✅
- AC-E0 已记录 CVO explicit reopen ✅（KD-1 锁了 anchor signoff 教训）

## Optional — 不阻挡 merge，但值得在 E-2a 时一并想

- **E-2 conflict resolve atomicity**：当前 `resolveConflict` 走 `validateSkillName + 直接操作 symlink`。如果中途 crash 可能留半状态（symlink 已 unlink 但新 target 未建）。E-2a 实现时考虑 tmpfile + atomic rename pattern，或允许 sync 路径自愈半状态。
- **E-2 sync vs resolve-conflict 并发**：同时点 "立即同步" + "用我的版本" 可能 race。低概率但 E-2a 加 per-project mutex 也是 5 行代码事。

## 如果我这份 review 错了，最可能错在哪

按 [[feedback_pre_register_retraction_conditions]] 自检：

1. **P0-1 并发锁可能 over-claim**：如果开源/家里 service-config 已经隐式 serialize（例如 `getServiceConfig` 同步 + spawn 之间 inherently 短）那并发窗口很小，P0 → P1。**Reviewer 可以攻**：测一次 `for i in 1..5; curl -X POST .../install &` 看 spawn 几次。
2. **P1-1 isServiceProcess 严格匹配**：开源用 lenient fallback 是有原因的——某些服务的 detached 进程会改名（venv python 进程 cmd 是 `python` 不是 `start.sh`）。严格化可能导致 stop 找不到 PID 然后端口残留。**Reviewer 可以攻**：实际跑一次 mlx start → stop 看 isServiceProcess 是否仍命中。
3. **AC-E7 guardian 指定可能 over-engineer**：如果 CVO 觉得 Opus-46 已经做了一次 F199 guardian 就够、Phase E 不需要再换 guardian，那这条 nice-to-have 而已。**CVO 可以拍板**："这次还用 Opus-46" 或 "换 @gemini"。
4. **P1-3 跨 worktree 端口 hygiene 可能不属本 feat**：runtime worktree 是用户自己开的，他知道端口冲突。E-1a 强求处理可能扩面。**Reviewer 可以攻**：直接 push back 说 "这是用户责任，disclosure 一行就行"。

## Action

- 拿这份 review 去补 memo 的 threat model section（P0-1, P0-2 加上去）+ Slice plan section（P1-1, P1-2 写进 E-1a Exit criteria）
- E-2a Exit criteria 加 P1-3 (port hygiene disclosure)
- AC-E6/AC-E7 加 guardian non-author non-reviewer cross-family 条件 explicit
- 上面补完，E-0 design gate close，E-1a 开干

如果都同意，行首 @opus 我，或者直接进入 E-1a 实现，遇到上面任何 P0 决策点再 ping。

— 宪宪 [Opus-47🐾]
