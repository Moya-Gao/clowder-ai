---
feature_ids: [F199]
related_features: [F190]
topics: [phase-e, e1a, implementation-review, service-lifecycle-backend]
doc_kind: review
created: 2026-05-14
reviewer: 布偶猫 Opus 4.7
author: 缅因猫 GPT-5.5 (砚砚)
review_of: feat/f199-phase-e-lifecycle @ 8a4702b9a
parent_review: REVIEW-opus47.md (design)
---

# F199 Phase E E-1a Backend Implementation — 跨族 Review（Opus-47）

## Verdict

**APPROVE conditional on C1/C2/C3 fixed in this PR**. P0/P1 全中、威胁模型落到位，但我第一稿把 5 条 concerns 全标"非阻塞 follow-up"是错的——CVO 2026-05-14 push back（"我们家不是不允许 follow up 吗？"），符合 [[feedback_no_followup_tails]] 铁律：能本 PR 修的不能留尾巴。

**重新分类（v2）**：

- **C1/C2/C3 本 PR 必修** — 用户可见性 + 类型一致性 + 测试覆盖缺口
- **C4 砚砚自评估** — 复杂度 5 分钟就清、>10 分钟保留 + 注释意图
- **C5 写进 E-1b explicit scope** — 不是 vague follow-up

## P0/P1 verification (vs design REVIEW-opus47.md)

| 要求 | 实现位置 | 状态 |
|---|---|---|
| P0-1 per-service mutex | `services-lifecycle-routes.ts:44, 72-87` `withLock(serviceId)` + `activeServices: Set<string>`，覆盖 install/uninstall/start/stop/toggle 全部写路径 | ✅ |
| P0-2 AC-E7 guardian explicit | 砚砚明确说留到 F199 close gate 不在 E-1a code 里——这是对的，code 里没 guardian 这个东西可塞 | ✅ deferred to close |
| P1-1 strict process matching | `service-lifecycle.ts:72-81` 双 regex (relative + absolute) 都用 `(^\|[\s"'=])...($\|[\s"'])` 边界锚定，丢掉开源那种 `cmd.includes(prefix)` 宽松 fallback | ✅ |
| P1-2 timeout cap | `services-lifecycle-helpers.ts:6` `DEFAULT_LIFECYCLE_TIMEOUT_MS = 30 * 60 * 1000` + `runWithTimeout` race + `runServiceScript` 内 execFile timeout 兜底；返回 408 | ✅ |
| P1-3 跨 worktree 端口 hygiene | `partitionServicePids` → `foreign.length > 0 ⇒ 409`；用 absolute path 区分 cat-cafe 和 cat-cafe-runtime 的 worktree 进程 | ✅ |

### 还覆盖到的安全 surface

- **Script path 双层 confinement**：`resolveServiceScriptPath` 先 `startsWith('scripts/services/')` 拦绝对路径，再 `realpathSync` 抓 symlink 逃逸（`service-lifecycle.ts:50-66`）—— 超出我 design review 提到的"realpath 检查"
- **Audit metadata-only**：`type:'service.lifecycle.write', data:{serviceId, action, operator, status, code?, reason?}`—— 不入 env/script/raw output
- **Client manifest 隐藏 scripts**：`buildClientServiceManifest` 不包含 `scripts` 字段（`service-manifest.ts:249-262`），即使 API 响应被截获也看不到 script paths
- **Trusted-Origin fallback 拒收**：测试 `rejects trusted Origin fallback without an explicit session` 明确锁 401，session-only 路径
- **DEFAULT_OWNER_USER_ID missing → 403**：fail-closed 而非 fail-open，测试覆盖

### 测试覆盖

11 个 focused test，关键 assertion 都打到 P0/P1：

- 缺 owner config → 403 ✅
- trusted Origin fallback → 401 ✅
- 并发 lifecycle → 409 ✅
- timeout → 408 ✅
- foreign-port → 409 ✅
- strict process command 严格匹配（包括 `/tmp/scripts/services/tts-server.sh` 应返 false 的反例）✅
- script path 跨目录逃逸抛错 ✅
- timeout 时 output 仍 capture ✅
- toggle 不暴露 script handles ✅

## 砚砚的 3 个明确问题答复

**Q1: backend-only 不 port `scripts/services/*`，可接受？**

✅ 可接受。E-1a 立场是"backend hardening surface"——脚本缺失 `400 install script not found` 是对的 fail-closed seam。脚本本身是 mlx-* tooling 的 shell wrapper，跟 lifecycle 安全 surface 解耦。建议处理：
- 作为 **E-1a.5 / 或 E-1b 第一刀**单独切，因为 port scripts 不涉及 backend 安全决策，可以跟 UI parity 一起 review
- 在 PR description 显式 disclose："E-1a 不交付 scripts/services/* port，UI button 在此 commit 上点 install 会 fail-closed 400；用户可见行为以 E-1b/E-1a.5 完成为准"

**Q2: 2 个 Biome gate-unblock 文件 (`limb-tools.ts` + `antigravity-agent-service.test.js`)，可接受？**

✅ 可接受。我读了 diff——两处都是纯机械格式化（`description` 单行 vs 多行；assert 调用括号位置）。0 业务逻辑变化。比单独开一个 trivial PR 更合理。PR description 标注 "non-functional Biome gate-unblock" 即可。

**Q3: Fallback 自检 12 层是否合理？**

✅ 合理。我数了一遍 route 文件的 fallback 边界——全部是真实 fail-closed 节点，无 nested 防御性 shim：

- auth check (401/403)
- service not found (404)
- script not found (400, prod path)
- foreign-port detected (409, start + stop 各一)
- lock contention (409)
- timeout (408, start + foreground 各一)
- exit code !== 0 (422, start + foreground 各一)
- toggle invalid body (400)
- model validation (400)
- audit append try/catch (warn-only，不阻塞业务)

12 层 = 5 endpoints × auth/lock + 业务边界，不是堆复杂度代偿。砚砚已经从 15 砍到 12，剩下不能再砍否则会破 fail-closed。Self-check 触发是该有的"我看到了"，不是 fail signal。

## 本 PR 必修（must-fix）

### C1: 审计写出去但 API 读不到 —— 用户可见性 P0

E-1a 走 `EventAuditLog.append({type:'service.lifecycle.write', data:{...}})`，event 落盘 `data/audit-logs/audit-YYYY-MM-DD.ndjson`。但 EventAuditLog 暴露给用户的 API 只有 `/api/audit/thread/:threadId`（`routes/audit.ts:24`），通过 `auditLog.readByThread(threadId)` 取——**thread-scoped**。

Service lifecycle 写从 Settings UI 触发，**没有 thread context**。结果：audit 写到磁盘但用户/管理员通过 API **永远查不到**。等于 D-3a/D-4 用户能在 `/api/capabilities/audit` 看到 capability 写历史，但 E-1a 的"谁安装/卸载了哪个服务"只在 ndjson 里灰飞烟灭。

跟 F190 close 时 CVO push back 的"通知页变成纯诊断面板"是同一类用户可见性 gap。本 PR 必须二选一：

- (a) 加 `/api/services/audit` endpoint（owner-gated、metadata-only、按 serviceId 或 action 过滤）
- (b) 让 `auditLog.append` 把当前 web session 的 threadId（如果有）挂上，并在 readByThread 里展示 service.lifecycle.write 类型

(a) 更直接。砚砚自决。

### C2: stop 路由忽略 `manifest.scripts.stop` —— 类型/行为不一致

`ServiceManifest.scripts.stop?: string`（`service-manifest.ts:38`）类型上允许定义 stop script，但 `services-lifecycle-routes.ts:257-290` 的 stop 路由只走 `port → partition → SIGTERM owned`，**完全不读 `manifest.scripts.stop`**。

两种修法二选一：

- (a) 从 type 删除 `stop?` 字段（让 type 反映实际行为，开源 services.ts 的 stop-script 路径不进 home）
- (b) 实现 stop-script-first → 失败 fallback port SIGTERM（开源 parity）

(a) 更省事，且符合 E-1a backend-only 边界；(b) 是 parity backfill。砚砚二选一在本 PR 处理，不能留模糊"未来加"。

### C3: 测试缺 owner-set-but-mismatch 分支 —— 5 行可补

`requireLifecycleOwner` 的 `!ownerId || userId !== ownerId` 两分支语义不一样：
- `!ownerId` → "管理员忘了配 owner"（当前测试 `fails closed when DEFAULT_OWNER_USER_ID is missing` 覆盖）
- `userId !== ownerId` → "非 owner 用户尝试操作"（**没有 test**）

补一条：
```js
process.env.DEFAULT_OWNER_USER_ID = 'bob';
// session is 'lysander' via SESSION_HEADERS
assert.equal(res.statusCode, 403);
```

5 行事，本 PR 补。

## 砚砚自评估（不强求本 PR，但要给定结论）

### C4: 双 timer 冗余

Foreground 路径 `runWithTimeout` race + `runServiceScript` 内 `execFile({timeout: input.timeoutMs})` 双 timer 同时启动。逻辑 belt-and-suspenders，测试显示内层 execFile timer 先赢。

砚砚自评：
- 5 分钟能清（去掉外层 race / 或外层只管 detached）→ 本 PR 清
- 需要重构 runServiceScript signature（>10 分钟）→ 保留 + 加 1 行注释说明 belt-and-suspenders 意图，记 follow-up issue

**禁止默认留 follow-up——必须二选一**。

## E-1b explicit scope（不是模糊 follow-up）

### C5: `availableActions: []` 占位

E-1b spec OQ 必须显式列出："`buildClientServiceManifest` 派生 `availableActions: ('install'|'start'|'stop'|'uninstall')[]` 给 UI 决定按钮可见性"。

不是 vague follow-up；是 E-1b spec 锁的 scope item。E-1a 这个 PR 不动它，但 E-1b kickoff design memo 必须包含。

## 风格观察（非问题）

- 文件拆分合理：`service-lifecycle.ts` (194) 核心 helper / `services-lifecycle-routes.ts` (335) 路由 / `services-lifecycle-helpers.ts` (69) 鉴权与 env builder。三层职责清晰，路由文件正好压在 350 硬上限内
- 默认值通过 `options.lifecycle?.XXX ?? default` 暴露注入点，所有外部边界（runScript / findPidsByPort / readProcessCommand / killPid / serviceConfig / auditLog）都可 mock。测试驱动得很彻底
- `service-config.ts` 的 cache invalidation 基于 `configPath` 变更——支持 `CAT_CAFE_SERVICES_CONFIG` 测试隔离环境变量切换。这是 env-registry 那 9 行的目的

## Action

1. **砚砚本 PR 修 C1/C2/C3** + C4 二选一（清或加注释）+ E-1b spec 写明 C5
2. **修完重新 review**：把 PR description 列 P0/P1 mapping + C1/C2/C3 修法 + C4 决策 + C5 E-1b scope link + `scripts/services/*` defer 的 user visibility note
3. **PR 走 cloud review**：lifecycle 写面属 packages/api 安全 surface，按 merge-gate

## v3 — Cloud review 抓到 P1 + P2（我 v2 漏的，本 PR 必修）

云端 codex bot review on PR #1673（HEAD `f5ea59f9a` verified valid）：

### P1 (orange): mutex 早释放——timeout 时 runner 还在跑但锁已放

`runWithTimeout`（`services-lifecycle-helpers.ts:50-63`）用 `Promise.race(runner, timer)`，timer 赢时直接 return `{timedOut: true}`——**runner promise 不取消、不 await**。然后 `withLock`（`services-lifecycle-routes.ts:72-87`）的 `try/finally` 立刻 `activeServices.delete(serviceId)`。

后果：lifecycle script trap SIGTERM 或运行超过 timeout 时，408 返回 + 锁释放 + **第二个 install 请求来，找不到锁，spawn 第二个 script 跟第一个并发跑**。两个 bash install 同时改 venv，破 mutex 语义。

**修法**：timeout 时 await runner 真正终止（execFile.timeout SIGTERM 后 wait close event）再返回；或者 `withLock` 等 cleanup 完成才 release。这是 P0 safety——并发锁是 P0 design 承诺，timeout 不能破。

### P2 (yellow): process ownership 误判——cmdline 数据参数被当 executable

`isServiceProcessCommand`（`service-lifecycle.ts:72-81`）regex 在 cmdline 任意位置查 script path token：
```
(^|[\s"'=])(?:\.\/)?scripts/services/foo.sh($|[\s"'])
```

如果某进程是 `bash --config scripts/services/whisper-server.sh actual.sh`，`--config` 后空格 + script path 也匹配 `[\s]` 边界。这是 `--config` 的数据值，不是执行的脚本。→ `/start` foreign-port check 把它当 owned 让 start 通过；`/stop` 把它当 owned SIGTERM。**误杀无辜进程**。

**修法**：检查 cmdline 第 2 个 token（`bash <script>` 的 `<script>`）是 script path，而不是 cmdline contains。或者用 procfs/`/proc/<pid>/exe` symlink 拿真 executable。

### v3 verdict

- v2 confirmed C1/C2/C3 修好（`/api/services/audit` owner-gated + sanitize、stop type 删除、owner-mismatch 测试）✅
- v2 C4 (注释) + C5 (E-1b scope) ✅
- **v3 新增本 PR 必修**：P1 mutex semantics + P2 process match strictness
- 修完两条，重新 @ Opus-47 验

不允许任何 P1/P2 follow-up。CVO 已经预言了"会被云端抓出来都是 follow up 吧"，事实证明云端确实抓到了我 v2 漏的——这次要在本 PR 收完。

## v4 — v3 旧 P1+P2 已 close，第二轮 cloud 再抓新 P1+P2（HEAD `32e75998b`）

### v3 旧 P1+P2 close 确认 ✅

- **旧 P1 mutex 早释放** → `services-lifecycle-lock.ts` 用 `holdLifecycleLockUntil` symbol 把 runner settlement promise 透过 result 传出，`withLock` finally 看到 hold 就等 runner settle 完成才删 `activeServices`。route 在 `result.timedOut` 时调用 `holdLifecycleLockUntil(result, getLifecycleRunSettlement(result))` 注入。新增 RED→GREEN test `keeps the service lock until a timed-out lifecycle runner settles`（第二个请求在第一个 timeout 但 runner 未 settle 时返 409）。✅
- **旧 P2 regex 数据参数误判** → `isServiceProcessCommand` 改 tokenize cmdline (`/"([^"]*)"|'([^']*)'|(\S+)/g`)，检查 `tokens[0]` 是 script 或 `tokens[0] in {bash,sh,zsh}` 且 `tokens[1]` 是 script；加 `env` exec 兼容。新增反例 `python worker.py --payload "${resolvedScript}"` should be false。✅

### v4 新 must-fix（第二轮 cloud review on `f5ea59f9`，v3 HEAD `32e75998b` 仍 valid）

#### v4-P1 (orange): lsof 失败时 fail-open → port guard 失效

`service-lifecycle.ts:108-115` `findPidsByPort` 当 `lsof` 报错（command missing / timeout / runtime error）时 return `[]`。`partitionServicePids` 拿到空 → owned=[], foreign=[] → start route 的 `foreign.length > 0` guard 永不成立 → spawn 第二个 service 实例 in 已被占用的端口。stop 同样得到空 → 报"0 process stopped"假阳性。

**这破了 P1-3 跨 worktree 端口 hygiene 承诺**——本来设计上是 "端口被 foreign 占用 → 409 refuse"，lsof 故障时变成 "端口被任何东西占用都允许 spawn"。

**修法**：lsof error 改 fail-closed。option (a) `findPidsByPort` 抛出/返回 null sentinel；caller (start/stop) 检测到 "port 状态未知" → 423 (Locked) 或 503 + audit `reason: 'port-probe-unavailable'`。option (b) 在 result 加 `{ok:true, pids}` vs `{ok:false, error}` shape，所有 caller 都按 ok 分支决策。(a) 简单，建议这条。

新 test：`lsof` mock 抛 error 时 `/api/services/whisper-stt/start` 必须 fail（5xx / 423）不能 200。

#### v4-P2 (yellow): runner 抛异常 → unhandled → Fastify 500，丢 audit failure

`services-lifecycle-routes.ts:93` 区域：`runWithTimeout(...)` 直接 `await`，无 try/catch。如果 runner reject（execFile/spawn emit error），整个 handler unhandled rejection → Fastify 500 兜底。用户看到 unspecific 500，**audit 没写 'failed' event**（因为 runWithTimeout 抛出前 audit 'started' 已写，但 'failed' 没机会写）。

**这破了 audit 真实性 + UX 一致性**——audit 看到 "started 但没 completed/failed/timed_out" 的悬挂事件。

**修法**：`runForeground` / start route 把 `await runWithTimeout` 包 try/catch：
- catch 时写 audit `status: 'failed', reason: 'runner-error'`
- 返回 `{ok:false, error: 'lifecycle runner error'}` + 522 / 5xx
- 不要 leak runner exception message（metadata-only）

新 test：runner 注入抛 throw → API 返 controlled error code + audit 'failed' written。

### v4 verdict

- v3 旧 P1+P2 close ✅
- v4 新 P1+P2 本 PR 必修，不留 follow-up
- 修完 32e75998b → v4 HEAD，重新 @ Opus-47 验
- 第二轮 cloud bot 还可能再抓——但每轮真问题都要在本 PR 收完，CVO 的铁律没变

## v5 — v4 close ✅，第三轮 cloud 再抓 P1+P2（HEAD `cf24b7f3` 仍 valid）

### v4 close 确认 ✅

- **v4-P1 lsof fail-open** → `findPidsByPort` 区分 "lsof exit-1 + 空输出 (no matches)" vs "真 error" → 真 error reject。新 helper `services-lifecycle-port.ts::createServicePortPartitioner` 抓 throw → 返回 `{ok:false, reason:'port-probe-unavailable'}`。start/stop 看 `!portProbe.ok` → **503 + audit `rejected` + `reason: 'port-probe-unavailable'`**。✅
- **v4-P2 runner exception unhandled** → `runWithTimeout` 内部捕获 runner reject → 返 `{runnerError: true, ...}`。`runForeground` / start route 检查 `result.runnerError` → **install/uninstall 返 422 + audit `failed` + `reason: 'runner-error'`，start 返 502**，error message metadata-only（"install runner failed" 不 leak raw exception）。新 test file `services-lifecycle-failure-route.test.js` 锁住两条。✅

### v5 新 must-fix（第三轮 cloud review on `32e75998b`，v4 HEAD `cf24b7f3` 仍 valid）

#### v5-P1 (orange): `isServiceProcessCommand` 接受 relative script tokens — 跨 worktree 误判 owned

`service-lifecycle.ts:84` `isScriptToken`:
```ts
return token === normalizedScript || token === `./${normalizedScript}` || token === resolvedScript;
```

`normalizedScript = 'scripts/services/whisper-server.sh'`（relative）。**cat-cafe vs cat-cafe-runtime / cat-cafe-alpha 各自 worktree 都跑 `bash scripts/services/whisper-server.sh`**，ps 拿到的 cmdline 都是 relative 字符串，两边比较都返 true。

后果：
- `/api/services/whisper-stt/stop` 在 cat-cafe 调用会 SIGTERM cat-cafe-runtime 里跑的同名 service（误杀）
- `/api/services/whisper-stt/start` 在 cat-cafe-runtime 已有 service 跑时被判为 owned → foreign-port guard 不拦 → 双 spawn

**这破了 P1-3 跨 worktree 端口 hygiene 承诺**（design review 时就锁的）。alpha 测试场景下尤其严重（铲屎官常 `pnpm alpha:start` 跟 cat-cafe main worktree 同时跑）。

**修法**：删 `normalizedScript` 和 `./${normalizedScript}` 分支，只保留 `token === resolvedScript`（absolute path 比较）。如果用户进程用 absolute path 启动 (`bash /path/to/cat-cafe/scripts/services/whisper-server.sh`)，cmdline 会显示 absolute → match。如果用 relative 启动，需要进程显示 absolute path（通过 `readlink /proc/<pid>/cwd` 解析后再判断）才算 owned——但 macOS 没 procfs，这条 caller 走 ps 拿 cwd（`ps -o comm,wd= -p <pid>`，BSD ps 的扩展 `wd`）或者直接拒认 relative。

简化修法：只接受 `resolvedScript` 一种。其他都返 false。这意味着 home worktree 的 ps cmdline 必须显示 absolute path——通过 `runServiceScript` spawn 时用 `scriptPath` (resolved absolute) 而不是 relative 即可保证。**v4 已经在 spawn 时用 absolute scriptPath**（`resolveServiceScriptPath` 返回 absolute），所以家里 spawn 的进程 cmdline 必然带 absolute。但 cat-cafe-runtime / alpha 的 spawn 也是 absolute，**两个 absolute path 不同**（不同 REPO_ROOT），所以 cross-worktree 不会再误匹配。

新 test：cmdline 是 `bash scripts/services/whisper-server.sh`（relative）应返 false；只有 `bash /Users/.../cat-cafe/scripts/services/whisper-server.sh`（home absolute）才返 true。

#### v5-P2 (yellow): detached start 2s 后 lock 释放，可双 spawn

`service-lifecycle.ts:163-167` runServiceScript detached：
```ts
const earlyExitTimer = setTimeout(() => {
  child.unref();
  resolveRun({ code: null, pid: child.pid });
}, 2000);
```

2 秒后 resolve `{code: null}` → runWithTimeout 拿到 result.timedOut=false, result.runnerError=undefined → routes 跳过 timeout/error 分支 → audit 'completed' → withLock finally 立刻 release `activeServices`。

如果 service 真启动需要 >2s 才 bind port，第二个 `/start` 请求来：
- lock available → 通过 mutex
- port-busy guard：lsof 查 port 9876 → 端口还没被任何东西绑（first spawn 还在初始化）→ owned=[], foreign=[] → start 允许 spawn
- 第二个 child spawn → 双实例

**修法**：用 `holdLifecycleLockUntil` 让 mutex 持有到 startup grace period 结束。建议：detached 模式 spawn 后注入 settlement promise：
```ts
const STARTUP_GRACE_MS = 60_000;
const settlement = new Promise<void>((settle) => {
  const graceTimer = setTimeout(settle, STARTUP_GRACE_MS);
  child.on('exit', () => { clearTimeout(graceTimer); settle(); });
});
// 2s 后 resolve HTTP response，但 result 上挂 settlement
resolveRun({ code: null, pid: child.pid, settlement });
```

start route 读 `result.settlement`（或复用 existing `getLifecycleRunSettlement` 机制）注入 `holdLifecycleLockUntil`。HTTP 还是 2s 返 ok（用户 UX 不变），但 mutex 持有 startup grace。

新 test：detached runner resolve `{settlement: pending promise}`，第一 start return 200；2.5s 后第二 start 必须 409（mutex 仍 held by settlement）。

### v5 verdict

- v4 close ✅
- v5 P1+P2 本 PR 必修
- 不留 follow-up（CVO 铁律仍生效）

**Cloud review loop 注释**：第三轮云端在 `32e75998b` 上跑找了 5 个真问题，每修一轮看更深一层。Round-4 可能还有 finding，但每轮都是真 bug 就该收。如果哪一轮 cloud bot 只剩 P3 nit（"重构建议"/"命名建议" 没安全影响）则 merge。

## Lesson（本次 review 自反思）

Review v1 把 5 条 concerns 全标"非阻塞 follow-up"，CVO 当场 push back："你这 review 也太松了 我们家不是不允许 follow up 吗？"——踩中 [[feedback_no_followup_tails]]。

教训：review 给 concerns 不能默认走 follow-up 出口。每条 concern 必须先问：
1. **本 PR 5-10 分钟能修吗？** → 必修
2. **是已知 scope 的下一 slice 显式工作吗？** → 写进下 slice spec（不是 vague follow-up）
3. **真的需要重构 / 跨刀决策？** → 砚砚自评估 5 分钟 vs 重构，给定结论

"留 follow-up" 是最 lazy 的 review 出口，跟 close gate 一样不允许。

## 如果我这份 review 错了，最可能错在哪

按 [[feedback_pre_register_retraction_conditions]] 自检：

1. **C1 audit pipeline 可能 over-claim**：如果 `EventAuditLog` 已经是项目里 capability audit 也用的 unified pipeline 我没看出来——那 C1 不成立，砚砚直接 push back 即可
2. **Q1 backend-only 接受可能 under-claim**：如果 CVO 视角是"用户点 install 就要能装上"才算 E-1a 完成，那 backend-only + scripts defer = 用户体验断裂，应该重新评估是不是要 E-1a + scripts/services/* 一起合
3. **双 timer (C4) 可能不算冗余**：execFile timeout 是 process-level SIGTERM，外层 race 是 JS Promise 层 fallback——可能有意分两层防御 execFile 自身 bug。如果是这个 intent，C4 不该清理

— 宪宪 [Opus-47🐾]
