---
feature_ids: [F156]
related_features: [F077]
topics: [security, websocket, cswsh, origin-validation, auth]
doc_kind: spec
created: 2026-04-10
---

# F156: Security Hardening — 实时通道 + 本机信任边界加固

> **Status**: done | **Owner**: 布偶猫 | **Priority**: P0 | **Completed**: 2026-04-12

## Why

2026-04-10 安全审计发现：Cat Cafe Hub 的 Socket.IO 实时通道存在 Cross-Site WebSocket Hijacking (CSWSH) 风险。缅因猫(GPT-5.4) 实测验证：从 `Origin: https://evil.example` 发起 WebSocket-only 连接到 `127.0.0.1:3002`，**连接成功**。

根因：Socket.IO v4 的 `cors` 配置仅对 HTTP long-polling 生效，**不校验 WebSocket upgrade 请求的 Origin 头**（Socket.IO 官方文档 2026-02-16 明确标注）。加上身份自报（`handshake.auth.userId`）、Room 无 ACL，攻击者可以：
- 从任何恶意网页发现并连接本机 WebSocket
- 冒充任意 userId
- 加入任意 thread/user/global room 监听所有消息
- 发送 `cancel_invocation` 干扰猫猫工作

**外部参考**：OpenClaw 2026 年初连续爆出两个同类漏洞（CVE-2026-25253 + ClawJacked），攻击链高度相似。

**铲屎官原话**："我们的 websockets 是不是有被钓鱼的风险？""先修自己家的，然后自己家验证没问题再帮他们 officeclaw 修复一下"

## What

聚焦 WebSocket 实时通道的安全加固，不涉及 F077 的多用户认证体系。修完后作为 F077 的前置基础设施。

### Phase A: 连接层加固（堵 CSWSH） ✅

1. **`allowRequest` Origin 校验** — 在 Socket.IO Server 构造时加 `allowRequest` hook，显式校验 WebSocket upgrade 请求的 `Origin` 头。不在白名单内的 Origin 直接拒绝连接
2. **禁止自报 userId** — 服务端不再从 `handshake.auth.userId` / `query.userId` 取身份。单用户模式下连接一律赋予 `default-user`，为 F077 session 认证预留接口
3. **私网 Origin 收紧** — `PRIVATE_NETWORK_ORIGIN` 正则从默认放行改为需要 `.env` 显式 `CORS_ALLOW_PRIVATE_NETWORK=true` 才启用

### Phase B: 授权层加固（堵监听/干扰） ✅

> 砚砚(GPT-5.4) review 后重新排序：plain WS 端点比 Socket.IO room 收口更紧急（read-write PTY > 被动泄漏）

**B-1: Plain WebSocket Origin + 身份校验**
1. **terminal WS Origin gate** — `@fastify/websocket` 的 `/api/terminal/sessions/:id/ws` 和 `/api/terminal/agent-panes/:id/ws` 补 Origin 校验（复用 `isOriginAllowed`）。这两个端点完全绕过 Socket.IO `allowRequest`，恶意网页可直连 read-write PTY
2. **terminal 身份硬化** — `resolveUserId(req)` 允许 query param 自报身份，需收紧为 header-only 或服务端决定

**B-2: Socket.IO 敏感事件授权**
1. **cancelAll 授权** — `cancel_invocation` 的 `cancelAll()` 分支补 `userId` 校验，不能只看 room membership

**B-3: 全局 room 收口**
1. **Room ACL 扩展** — `workspace:global` 和 `preview:global` 在多用户模式下需认证后才能加入（带文件路径、worktreeId、preview 端口等元数据）

### Phase D: Local Trust Boundary Hardening（三猫安全审计产出）

> 2026-04-10 三猫安全攻防讨论产出。详见 `docs/discussions/2026-04-10-security-trust-boundary-audit.md`

**D-1: HTTP 身份从"自报"升级为服务端 session** (P0)
1. 浏览器侧停用 `userId query param` 作为身份源
2. 引入同源 `HttpOnly session cookie`，首次打开 Hub 自动配对
3. 逐步淘汰 `resolveUserId()` 的 query/default 回退路径，写操作统一走 session
4. 用户零配置：CLI `cat-cafe start` 自动打开浏览器并完成 session 配对

**D-2: 防 Clickjacking** (P0)
1. API 层加 `X-Frame-Options: DENY` + CSP `frame-ancestors 'none'`（@fastify/helmet 或手动 header）
2. preview-gateway 保留例外（它需要 iframe 嵌入）
3. 零用户摩擦，纯后端 header

**D-3: 前端 XSS 基线加固** (P1) ✅
1. 严格 CSP（禁 unsafe-inline JS）
2. HtmlWidgetBlock 加 DOMPurify sanitization（sandbox 隔离正确但应加防数据外泄）
3. 富文本/外部 HTML 渲染放入 sandboxed iframe（已部分实现，需审计完整性）

**~~D-4: Prompt Injection 降权~~** → 已拆出为独立课题，不属于 WS 安全加固 scope

> 2026-04-12 闭环决定：Prompt Injection 是独立设计课题（需要来源追踪新机制），
> 不是"WebSocket 安全加固"的一部分。拆出后 F156 核心 scope 全部完成。

**D-5: preview-gateway Origin 校验** (P2) ✅
1. WS upgrade 路径补 Origin 校验（复用 isOriginAllowed）
2. 现有 loopback+port 限制保留

**D-6: DNS Rebinding 防御** (P2) ✅
1. 校验 HTTP `Host` header，allowlist 从 CORS origins + API base URL 动态派生
2. 自定义 FRONTEND_URL 和 split-host 部署自动覆盖

### ~~Phase C: OfficeClaw 修复~~ → 已拆出

> **2026-04-10 铲屎官决定**：OfficeClaw 安全加固是"外出务工"，不属于我们家的 feat，拆为独立 feature/任务。
> 参考 F156 Phase A/B/D 的修复模式适配 OfficeClaw 协议差异。

## Acceptance Criteria

### Phase A（连接层加固）
- [x] AC-A1: `Origin: https://evil.example` 的 **WebSocket-only**（`transports: ['websocket']`）连接被服务端拒绝（集成测试 + 实测验证）。验收标准是"恶意网页不能建立 WS 连接"，不是"CORS 配对了"
- [x] AC-A2: 合法前端 Origin（localhost:3001、配置的 FRONTEND_URL）连接正常
- [x] AC-A3: 服务端不再从客户端 handshake 取 userId，所有 socket 身份由服务端决定
- [x] AC-A4: 私网 Origin 默认不放行，需显式 `CORS_ALLOW_PRIVATE_NETWORK=true`
- [x] AC-A5: 现有前端功能不受影响（消息收发、取消、room 订阅正常）
- [x] AC-A6: 有 `socket.io-client` + `transports: ['websocket']` + 恶意 Origin 被拒的集成测试（钉住核心修复）

### Phase B-1（Plain WS 安全加固）
- [x] AC-B1a: `/api/terminal/sessions/:id/ws` 和 `/api/terminal/agent-panes/:id/ws` 的 WebSocket upgrade 校验 Origin header，恶意 Origin 被拒
- [x] AC-B1b: terminal WS 身份不再从 query param 自报，收紧为 header-only 或服务端决定
- [x] AC-B1c: Socket.IO `user:` room ACL（Phase A 已实现）

### Phase B-2（Socket.IO 敏感事件授权）
- [x] AC-B2: `cancel_invocation` 的 `cancelAll` 分支在 socket 层做 thread ownership guard 后再调用

### Phase B-3（全局 room 收口）
- [x] AC-B3: `workspace:global` 和 `preview:global` 在多用户模式下需认证后才能加入（带文件路径、worktreeId、preview 端口等元数据）

### Phase D-1（HTTP 身份加固） ✅
- [x] AC-D1a: 浏览器请求通过 HttpOnly session cookie 认证，不再接受 userId query param
- [x] AC-D1b: 首次打开 Hub 自动完成 session 配对（零配置）
- [x] AC-D1c: 写操作统一走 session 校验

### Phase D-2（防 Clickjacking） ✅
- [x] AC-D2a: API 响应包含 X-Frame-Options: DENY
- [x] AC-D2b: API 响应包含 CSP frame-ancestors 'none'
- [x] AC-D2c: preview-gateway 保留 iframe 例外

### Phase D-3（前端 XSS 基线） ✅
- [x] AC-D3a: HtmlWidgetBlock 加 DOMPurify sanitization
- [x] AC-D3b: CSP 加固（script-src 'self' 'unsafe-inline' + object-src 'none'；nonce-based 为 future work）

### ~~Phase D-4（Prompt Injection 降权）~~ → 已拆出为独立课题

### Phase D-5（preview-gateway Origin） ✅
- [x] AC-D5: preview-gateway WS upgrade + HTTP 校验 Origin header

### Phase D-6（DNS Rebinding） ✅
- [x] AC-D6: HTTP 请求校验 Host header，allowlist 从 CORS origins + API base URL 动态派生

### ~~Phase C（OfficeClaw）~~ → 已拆出为独立任务

## Dependencies

- **Related**: F077（多用户安全协作 — F156 是 F077 Phase 1 的前置基础设施，AC6/AC7 有重叠）
- **Related**: OpenClaw CVE-2026-25253、ClawJacked（外部同类漏洞参考）

## Risk

| 风险 | 缓解 |
|------|------|
| Origin 校验过严导致合法场景被拦 | 保留 `.env` 配置口子（CORS_ALLOW_PRIVATE_NETWORK）；回归测试覆盖现有连接场景 |
| 禁止自报 userId 影响现有前端逻辑 | 单用户模式下服务端统一赋 `default-user`，前端不需要改 userId 传递逻辑（只是服务端忽略） |

## Key Decisions

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1 | 独立 hotfix，不并入 F077 | P0 漏洞不能等大 feature；hotfix 是 F077 的前置基础设施，不浪费 | 2026-04-10 |
| KD-2 | 用 `allowRequest` 而非依赖 `cors` 配置 | Socket.IO 的 cors 不管 WebSocket upgrade（官方文档明确）| 2026-04-10 |
| KD-3 | 先修自家 Hub，验证后再修 OfficeClaw | 铲屎官拍板 | 2026-04-10 |
| KD-4 | Phase C（OfficeClaw）从 F156 拆出 | 铲屎官："和我们家无关是外出务工的事情"，不污染自家 feat 真相源 | 2026-04-10 |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-04-10 | 立项。安全审计发现 CSWSH 风险，缅因猫(GPT-5.4) 实测验证 |
| 2026-04-10 | Phase A merged (PR #1041) — allowRequest origin guard + userId hardening + 14 tests |
| 2026-04-10 | Phase B merged (PR #1045) — terminal WS origin guard + cancelAll auth + global room guard + 13 tests |
| 2026-04-10 | Phase D-1+D-2 merged (PR #1054) — session auth + anti-clickjacking + 20+ route identity收口 + 57 files |
| 2026-04-10 | Phase D-3/D-5/D-6 merged (PR #1072) — XSS baseline + preview-gateway Origin + DNS rebinding defense |
| 2026-04-10 | Phase C（OfficeClaw）拆出 F156，铲屎官决定"外出务工"不属于自家 feat |
| 2026-04-10 | 砚砚(GPT-5.4) 主干实测验证：Socket.IO / terminal WS / preview-gateway 三条入口全绿 |
| 2026-04-11 | Private network UX optimization merged (PR #1087) — env-registry 注册 + 启动提示 + 描述优化 |
| 2026-04-12 | Host guard fix merged (PR #1114) — private network IPs now pass Host validation |
| 2026-04-12 | **Feature closed** — 愿景守护(codex) 放行，D-4/FU-1/FU-2 拆出为独立任务 |
| 2026-04-14 | Fallout fix merged (PR #1159) — trusted-origin fallback + 401 retry (author: opus, reviewer: codex cloud) |
| 2026-04-14 | Fallout perf merged (PR #1164) — trim thread-switch fan-out + per-thread caches (author: gpt52, reviewer: opus + codex cloud) |
| 2026-04-14 | Fallout self-heal merged (PR #1165) — failed `sessionGate` no longer poisons future bootstrap attempts; `ThreadSidebar` now reloads on `online` after network blips (author: gpt52, reviewer: opus; cloud review unavailable, downgraded per merge-gate Q4) |
| 2026-04-14 | Fallout hydration+bubble merged (PR #1167) — secondary thread hydration now starts in parallel with `messages`; bubble toggle no longer no-ops on first click when following an already-expanded global default (author: gpt52, reviewer: opus + codex cloud) |
| 2026-04-14 | Bubble refresh restore merged (PR #1174) — thread-level bubble preference no longer flashes back to the global default before thread metadata finishes hydrating after F5 (author: gpt52, reviewer: codex cloud) |
| 2026-04-14 | Signal Inbox nav fix merged (PR #1177) — `next/link` replaced with explicit `window.location.assign` for Signal entry in ChatContainerHeader, matching Memory/Mission Hub pattern (author: gpt52+opus, reviewer: opus + codex cloud) |
| 2026-04-15 | Bubble initial default race fix merged (PR #1178) — globalBubbleDefaults.thinking changed from localStorage-dependent to always 'collapsed'; eliminates race where threads load before config causing stale expanded flash (author: opus, reviewer: codex cloud) |
| 2026-04-15 | ThinkingContent toggle fix merged (PR #1184) — added `userInteracted` ref guard matching CliOutputBlock pattern; inline thinking bubble click-to-collapse no longer reverts on prop updates (author: opus, reviewer: codex cloud) |
| 2026-04-15 | Unread badge dismiss fix merged (PR #1190) — `handleSelect` now calls `clearUnread` before the `currentThreadId` early-return guard; clicking a thread always dismisses its unread badge (author: opus, reviewer: codex cloud) |
| 2026-04-15 | Bare POST 415 fix merged (PR #1194) — `apiFetch` auto-adds content-type + body for mutating requests with no body; fixes read cursor ack and mark-all through Cloudflare Tunnel (root cause: gpt52, systemic fix: opus, reviewer: codex cloud) |
| 2026-04-15 | Fallout closure baseline synced to spec — remaining blocker narrowed to 3 closure items (route ledger, smoke evidence, unified session-loss UX); GitHub issue #1064 marked as related non-blocker |

## Known Issue: API 重启后 Session 丢失导致用户惊吓（P1）

> **Reporter**: 铲屎官（2026-04-13，从 Claude Code CLI 环境发现）

### 症状

API 重启后，用户在浏览器中看到所有 thread 消失、发消息 401，**第一反应是"数据丢了"**。实际 Redis 数据完好（52838 key、1803 thread key），但用户体验等同数据丢失。

### 根因

1. `SessionStore`（`session-auth.ts`）是**纯内存 `Map`**，API 重启即清空所有 session
2. 浏览器仍携带旧的 `cat_cafe_session` cookie → `globalStore.validate()` 返回 null → `sessionUserId` 为空
3. F156 D-1 的 `resolveUserId()`（`request-identity.ts:41`）：浏览器请求带 `Origin` header 时，**不 fallback 到 `default-user`**（这是正确的安全设计）
4. → 所有浏览器请求返回 401
5. 前端 `api-client.ts` 的 `ensureSession()` **只在页面首次加载调一次**（`sessionGate` 已 resolved 就不会重试），收到 401 后不会自动重新签发 session

### 铲屎官担忧

**如果推送到社区（clowder-ai），所有用户都会遭遇同样的惊吓**。社区小伙伴不像铲屎官知道可以查 Redis，他们只会看到"thread 全没了 + 401"→ 以为数据丢失 → 提 issue / 放弃使用。

### 建议修复

1. **前端（最小改动，堵住体验坑）**：`apiFetch` 收到 401 时清掉 `sessionGate`，自动重调 `/api/session` 拿新 cookie 后重试一次原请求
2. **后端（可选增强）**：SessionStore 持久化到 Redis（而非内存 Map），API 重启不丢 session

### 追加发现：刷新页面后 Session 再次失效（Race Condition）

铲屎官实测：刷新页面后 thread 又消失了，只有回到首页再进才恢复。

根因：**两套 session 初始化存在竞争**：
1. `SessionBootstrap.tsx`：`useEffect` 中调 `fetch('/api/session')`（模块级 `established` 标志）
2. `api-client.ts`：`ensureSession()` 在首次 `apiFetch` 时也调 `fetch('/api/session')`

两个并发请求各拿到不同的 session token，后写入 cookie 的覆盖先写入的，导致其中一个 token 在服务端有效但在浏览器被覆盖 → 后续请求携带的是"被覆盖方"的 token → 401。

**建议**：统一为一个入口点，`SessionBootstrap` 和 `ensureSession` 共享同一个 Promise，避免并发签发。

### 临时 Workaround

回到首页 `localhost:3001/` 再进入 thread（首页请求少，不容易触发竞争），或在控制台执行 `fetch('/api/session')` 后刷新。

---

## Incident Follow-up: 事故后续关闭条件（必须回挂 F156）

> **来源**：2026-04-14 铲屎官连续反馈。"IM Hub/Signal Hub 打不开"、"创建线程点击无事发生"、"刷新后气泡又跑出来"、"thread 切换仍有约 1s 卡顿"。
>
> **原则**：这不是"以后有空再优化"。这是 F156 改动后的事故后续，必须作为关闭条件挂回 F156 真相源，直到体验和恢复链重新达标。

### A. 安全改动直接造成（今天必须清零）

1. **browser-facing API 身份语义分裂**
   - 部分路由走 trusted browser fallback，部分路由仍严格依赖 live session
   - 直接表现：IM Hub / Signal Hub / thread create / 其他 Hub 页面出现 401、空白或点击无反应

2. **session 失效恢复链不完整**
   - API 重启或 cookie 失效后，前端没有统一自愈路径
   - 直接表现：刷新后页面像"数据全没了"，用户感知接近数据丢失

3. **thread 级 UI 偏好恢复链脆弱**
   - 线程级 bubble override 写入后，刷新场景会掉回 global 默认
   - 直接表现：thinking / CLI 气泡开关刷新后重新冒出来

### B. 原来就糟、这次被放大（今天必须定死方案并开始收敛）

1. **thread 切换 fan-out 过重**
   - `messages`、`tasks`、`task-progress`、`queue`、`sessions`、`authorization`、`governance` 在 thread 切换体验里混合收敛

2. **secondary hydration 设计过重**
   - 右侧状态、Session Chain、权限卡片等辅助面板仍在影响"thread 是否已经切好"的主观感受

3. **project 级状态与 thread 级状态耦合**
   - 同项目切 thread 仍会额外触发 `governance/status`、`index-state` 等 project 级读取，放大抖动

### 关闭条件（全部完成前，不得宣称 F156 体验层面真正闭环）

- [ ] **AC-F156-FALLOUT-1**：browser-facing API 全量审计完成；每条路由明确标注是 `trusted browser fallback` 还是 `strict session`，不再存在"同类页面有的能打开、有的直接 401"的分裂态
- [ ] **AC-F156-FALLOUT-2**：IM Hub、Signal Hub、创建线程、刷新后气泡偏好 4 条核心 smoke path 全绿，并有回归测试或脚本证据
- [ ] **AC-F156-FALLOUT-3**：前端不再把 401 静默吞成"没数据/没反应"；至少要能自愈重试，失败也要有明确错误态
- [x] **AC-F156-FALLOUT-4**：thread 切换体验分层完成；只有 `messages` 允许算首屏阻塞，`queue` / `task-progress` / `sessions` / `authorization` 必须降级为 secondary hydration — PR #1167 makes secondary hydration start in parallel with `messages`, removing the old history-first serial dependency on cold thread switches
- [x] **AC-F156-FALLOUT-5**：同项目切 thread 不再额外 refetch `governance/status` 这类 project 级状态 — PR #1164 removed redundant govRefetch
- [x] **AC-F156-FALLOUT-6**：`sessions` / `queue` / `task-progress` 至少满足其一：per-thread cache、聚合为一个 sidebar-state 接口、或明确延后到首屏之后再拉 — PR #1164 added per-thread cache for sessions, tasks, auth pending (stale-while-revalidate)
- [x] **AC-F156-FALLOUT-7**：review 流程补上红蓝对抗视角，不只检查代码正确性，还必须检查"恢复链 / 失败路径 / 体验退化"；本轮作者与 reviewer 都要显式过这一关 — PR #1164 reviewed with red-blue adversarial perspective (opus, two rounds)

> 2026-04-14 追加状态：PR #1165 已经止住 AC-3 中最危险的一条链路：`sessionGate` bootstrap 失败后不再卡死，且网络恢复后 `ThreadSidebar` 会自动重拉，不必靠 F5 自救。  
> 但 AC-3 **仍未完全关闭**：其他前端 surface 还没有统一的显式错误态 / `online` 自愈策略，暂时不能宣称"401 静默吞错"问题彻底解决。
>
> 2026-04-14 再追加状态：PR #1167 已关闭 AC-4，并确认 bubble 的 `PATCH /api/threads/:id` 落盘链当前是通的；同时修掉了一个真实前端交互陷阱：当 thread 仍跟随全局且全局默认已展开时，第一次点击 bubble toggle 不再是 no-op。  
> 但 AC-2 **仍未完全关闭**：如果 runtime 上仍复现“刷新后 bubble 又跑出来”，剩余嫌疑点已经收缩到 thread metadata 的刷新恢复时序，而不是普通点击交互或 PATCH 路由本身。
>
> 2026-04-14 再追加状态：PR #1174 已补上这条刷新恢复时序缺口。`isLoadingThreads` 初始态改为真实 loading，thread 元数据未到前不再抢先按 global 默认渲染 bubble；恢复期间 UI 选择保守隐藏而不是错误闪烁。  
> 因此 AC-2 剩余未闭环项进一步收缩为其他 smoke path（尤其 Signal Hub 入口）是否全绿，而不是 bubble 刷新恢复链本身。
>
> 2026-04-14 再追加状态：PR #1177 修复 Signal Hub 入口导航。ChatContainerHeader 里的 Signal Inbox `<Link>` 被 Next.js router 吞掉 click 但不完成跳转，改为 `button + window.location.assign`（和 Memory/Mission Hub 同路数）。AC-2 的 4 条核心 smoke path 现已全部有对应修复进入 main。
>
> 2026-04-15 再追加状态：PR #1178 修复 bubble F5 flash 的第二层根因。PR #1174 的 `isLoadingThreads` guard 只覆盖 thread 加载窗口；当 threads 先于 config 加载完成时，guard 释放但 `globalBubbleDefaults.thinking` 仍持有 localStorage 的 stale `'expanded'` 值，导致所有 `null` bubbleThinking 的 thread 闪烁展开。修复：初始值改为 `'collapsed'`，server config 到达后覆盖。AC-2 的 bubble 刷新恢复链现已双层加固（thread 加载 guard + 安全初始值）。

### 2026-04-15 最小收尾清单（这 3 项清完才算 F156 真正闭环）

- [ ] **收口 1: browser-facing route ledger**  
  在 F156 真相源或其直接链接附件中列出 browser-facing API 清单；每条路由必须明确写明是 `trusted browser fallback` 还是 `strict session`，并标出对应 handler / 测试。  
  **关闭口径**：不存在“同类页面一部分靠 fallback 能开、一部分直接 401”的分裂态；AC-F156-FALLOUT-1 才能打勾。

- [ ] **收口 2: 4 条核心 smoke path 证据归档**  
  把 IM Hub、Signal Hub、创建线程、刷新后 bubble 偏好恢复 4 条路径跑成一份集中证据（测试、脚本或录屏都可以，但必须可追溯），并把链接挂回本 spec。  
  **关闭口径**：不是“修复 PR 已 merge”就算，而是“当前 main 上验证全绿且证据可回放”；AC-F156-FALLOUT-2 才能打勾。

- [ ] **收口 3: 统一 session-loss UX**  
  `apiFetch` 的 401 自愈已在位，但剩余 surface 还要统一做到两件事：成功时自动恢复，失败时给出显式错误态，不能继续表现成“空白 / 无反应 / 像数据没了”。  
  **关闭口径**：至少有 1 组共享回归覆盖 `401 -> retry success` 与 `401 -> retry failed but visible error` 两条链；AC-F156-FALLOUT-3 才能打勾。

### 不阻塞 F156 关单，但必须从这里分流出去的尾巴

- GitHub issue `#1064`（brand guard 仍检查已被 F156 废弃的 `X-Cat-Cafe-User` 头）属于 **相关清理项**，不是 runtime fallout blocker；应单独关闭，不要继续混进 F156 体验闭环口径里。
- D-4 / FU-1 / FU-2 已在本 spec 的 Spun-off Items 里正式拆出；后续若再做，必须走独立立项或独立文档任务，不得把它们重新塞回 F156 completion gate。

### 守护说明

- 这是 **F156 fallout**，不是独立 enhancement，也不是松散的 tech debt
- 后续 PR 若声称"修完 F156 后遗症"，必须逐条对照本节 closure conditions
- 若只修了可用性止血、没修体验分层，只能算"事故止血完成"，不能算"F156 体验闭环"

---

## Spun-off Items（闭环时拆出，不留尾巴）

| 原编号 | 内容 | 去向 |
|--------|------|------|
| D-4 | Prompt Injection 降权（独立设计课题） | 独立立项时再分配 F 编号（需设计方案成熟） |
| FU-1 | 精确 IP/域名 allowlist | 独立增强，铲屎官确认需要时立项 |
| FU-2 | 开源社区 setup 文档（手机/Tailscale 章节） | 独立文档任务，铲屎官确认需要时执行 |

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| **Feature** | `docs/features/F077-multi-user-secure-collab.md` | 多用户认证体系（F156 是其前置） |
| **External** | Socket.IO Handling CORS 文档 | `cors` 不管 WebSocket 的官方说明 |
| **External** | OpenClaw ClawJacked 漏洞（2026-02-26） | 同类攻击链参考 |
| **External** | CVE-2026-25253 | OpenClaw Auth Token 窃取 → RCE |
