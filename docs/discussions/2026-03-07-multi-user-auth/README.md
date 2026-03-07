---
feature_ids: [F077]
topics: [auth, oauth, multi-user, security, architecture]
doc_kind: discussion
created: 2026-03-07
participants: [opus, gpt52, landy]
---

# 多用户安全协作 — 架构讨论

> Thread: thread_mmg97bckrmxcbrlj | 2026-03-07

## 触发

铲屎官的朋友通过同 WiFi 直接访问了 Hub 3001 端口，发现零认证裸跑。铲屎官想让朋友也能用，但需要独立身份和私有空间隔离。

## 铲屎官原话

> "我朋友喊你们搞的哈哈哈哈 我们的 3001 没做任何防护 直接同个 wifi 就能访问到 好像很危险？"
> "可以用 github！？那不是刚好！？"
> "能让他们以其他铲屎官的身份接入吗？而不是 landy 以及我的这些 thread 能不让他们看见吗？他们只能看见共享区的 thread"

## 布偶猫方案

提出 4 级渐进方案：Token 邀请码 / GitHub OAuth / OAuth+OIDC / 简单密码。倾向 GitHub OAuth + Thread visibility (private/shared/public) + 分 Phase 做。

## gpt52 独立分析（关键贡献）

gpt52 **不按"OAuth 常识"空谈，先看了代码**，给出了精确到行号的现状审计：

### 代码事实

1. **身份入口集中** — `resolveUserId()` 在 `request-identity.ts:27`，对迁移有利
2. **但浏览器自报身份** — `userId.ts:9` / `api-client.ts:24` 明文传 `X-Cat-Cafe-User`
3. **WS 不校验** — `useSocket.ts:136` 客户端自报 `auth.userId`，`SocketManager.ts:62` 直接信
4. **CORS 自动放行私网** — `frontend-origin.ts:87` 放行 Tailscale/私网段
5. **Route 越权** — `threads.ts:235` 的 GET/PATCH/DELETE 无 owner 校验，`export.ts:128` 无鉴权
6. **userId 贯穿所有层** — ThreadStore/MessageStore/SessionManager/InvocationQueue 都按 userId 过滤

### gpt52 核心洞察

> **"MVP 不能只做登录页。"** 现在身份、会话、消息流、队列、WS 房间底层都是"单用户命名空间"假设；如果不一起改，做完只会得到一个"能登录的伪多用户"。

### gpt52 的 5 个立场

1. GitHub OAuth + 本地 member/invite + Redis session（不是纯 OAuth）
2. Thread ACL 要有 `ownerUserId` + `access` + `memberUserIds`，`public` 不要做
3. 迁移保留 `resolveUserId()` seam，内部改 session → signed header → legacy
4. Redis session > JWT（已有 Redis，撤销更简单）
5. 共享 thread 下 session/delivery/draft/queue 应改为 thread-scoped

### gpt52 发现的被忽略风险

- OAuth 不会自动修复现有越权 route
- CORS 不是安全边界
- 默认公共大厅是天然泄漏口
- 朋友在共享区驱动猫改本机文件 = 远程执行

## 收敛共识

| 议题 | 结论 | 来源 |
|------|------|------|
| 认证方案 | GitHub OAuth + 本地 member store + Redis session | 布偶猫提议, gpt52 加强 |
| Session | Redis-backed server-side, 不用 JWT | gpt52 立场, 布偶猫同意 |
| Thread 可见性 | private + shared（不做 public） | gpt52 建议, 布偶猫同意 |
| 迁移路径 | resolveUserId() seam + /api/me bootstrap | 共识 |
| MVP 范围 | 登录 + 授权 + route audit + WS auth 同期 | gpt52 坚持, 布偶猫同意 |
| Auth 开关 | 默认关闭 = 向后兼容 | 布偶猫补充 |

## 否决记录

- **纯 token 邀请码**：身份弱，无法关联 GitHub 生态
- **mTLS / 公私钥**：对人类浏览器登录太重，适合机器
- **JWT**：已有 Redis，server-side session 更适合
- **裸 `private/shared/public` 枚举**：需要 `ownerUserId` + `memberUserIds` 才有实际隔离

## 待决

1. 共享 thread 下 session/queue/delivery 是否改为 thread-scoped
2. Provider profile 是否按 workspace 隔离
3. Phase 2 审批体系的具体设计
