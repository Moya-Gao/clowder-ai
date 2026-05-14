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

**APPROVE — open PR**. P0/P1 全中，威胁模型边界落到位，测试覆盖了关键安全 surface。5 个非阻塞 concerns 见下。

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

## 非阻塞 concerns（不挡 PR，记录到 close gate / 后续 slice）

**C1: 审计 pipeline 选择**

E-1a 用 `EventAuditLog` (`getEventAuditLog()` from `domains/cats/services/orchestration/EventAuditLog`)，跟 D-3a/D-4 用的 `appendCapabilityAudit` / `appendPushAudit` 不是同一管道。D-3a/D-4 的 audit 可通过 `/api/capabilities/audit` 暴露给用户；E-1a 的 service.lifecycle.write 当前没有对应读端 API。

E-1b UI parity 时如果用户希望看到 "谁在什么时候 install 了哪个服务"，需要加一个 `/api/services/audit` 端点或者把 service.lifecycle.write 接进 capability audit pipeline。

**这是 E-1a 外延，不阻塞 merge**——E-1b 设计时决定即可。

**C2: stop 路由忽略 `manifest.scripts.stop`**

当前 stop route 只走 `port → partitionServicePids → SIGTERM owned`，没看 `manifest.scripts.stop`。开源 services.ts 是 try stop script first → port SIGTERM。

实际影响很小：当前 5 个 service manifest 都没定义 `scripts.stop`。但未来如果加需要 graceful cleanup 的服务（flush state / drain queue），需要补 stop-script 路径。建议在 E-1b 或后续 slice 加。

**C3: 测试缺一格——owner 已配但 session user 不匹配**

`requireLifecycleOwner` 的 `!ownerId || userId !== ownerId` 中，`!ownerId` 分支有测试覆盖，但 `userId !== ownerId` 分支（owner=bob、session=alice → 403）没有专门 test。两个分支语义不一样：一个是"忘了配 owner"，一个是"非 owner 用户尝试操作"。

建议补一行测试，5 行代码事。

**C4: 双 timer**

Foreground 路径 `runWithTimeout` 用 race + 同时 `runServiceScript` 内 `execFile({timeout: input.timeoutMs})` 也设了 timer。两个 timer 同时启动，逻辑上是 belt-and-suspenders。当前测试 `marks timed-out scripts even when they emitted output before termination` 显示内层 execFile timer 先赢（output 被 capture）。

不影响正确性，但代码层面有冗余。可以选其一：要么外层 race 只服务 detached path，要么删 execFile timeout 让外层 race 单源管 timeout。E-1a 可保持现状，后续重构清理。

**C5: `availableActions: []` 始终空**

`buildClientServiceManifest` + `resolveServiceState` 不返回 scripts，`availableActions` 写死空数组。E-1b UI 需要知道某个 service 是否有 install/start/stop/uninstall 可用——要么让 client 从其它信号（service has prerequisites? configured?）猜，要么 backend 派生 `availableActions: ('install'|'start'|...)[]`。

E-1b 设计时决定，不阻塞 E-1a。

## 风格观察（非问题）

- 文件拆分合理：`service-lifecycle.ts` (194) 核心 helper / `services-lifecycle-routes.ts` (335) 路由 / `services-lifecycle-helpers.ts` (69) 鉴权与 env builder。三层职责清晰，路由文件正好压在 350 硬上限内
- 默认值通过 `options.lifecycle?.XXX ?? default` 暴露注入点，所有外部边界（runScript / findPidsByPort / readProcessCommand / killPid / serviceConfig / auditLog）都可 mock。测试驱动得很彻底
- `service-config.ts` 的 cache invalidation 基于 `configPath` 变更——支持 `CAT_CAFE_SERVICES_CONFIG` 测试隔离环境变量切换。这是 env-registry 那 9 行的目的

## Action

1. **砚砚开 PR**：title 建议 `feat(F199): Phase E E-1a service lifecycle backend hardening`，PR description 列上 P0/P1 mapping、C1-C5 follow-up、`scripts/services/*` defer 的 user visibility note
2. **PR 标 cloud review**：lifecycle 写面属 packages/api 安全 surface，按 merge-gate 走云端 review
3. **F199 close gate 时**：把 C1 (audit pipeline)、C5 (availableActions) 落到 E-1b 设计 OQ；C2 (stop script)、C3 (test gap)、C4 (双 timer) 作为 follow-up tickets 列在 close gate report

## 如果我这份 review 错了，最可能错在哪

按 [[feedback_pre_register_retraction_conditions]] 自检：

1. **C1 audit pipeline 可能 over-claim**：如果 `EventAuditLog` 已经是项目里 capability audit 也用的 unified pipeline 我没看出来——那 C1 不成立，砚砚直接 push back 即可
2. **Q1 backend-only 接受可能 under-claim**：如果 CVO 视角是"用户点 install 就要能装上"才算 E-1a 完成，那 backend-only + scripts defer = 用户体验断裂，应该重新评估是不是要 E-1a + scripts/services/* 一起合
3. **双 timer (C4) 可能不算冗余**：execFile timeout 是 process-level SIGTERM，外层 race 是 JS Promise 层 fallback——可能有意分两层防御 execFile 自身 bug。如果是这个 intent，C4 不该清理

— 宪宪 [Opus-47🐾]
