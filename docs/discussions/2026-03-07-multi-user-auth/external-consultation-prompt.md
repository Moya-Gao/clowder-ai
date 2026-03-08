# F077 多用户安全协作 — 外部架构咨询

> 背景：Cat Café 是一个本地部署的多 AI Agent 协作平台（类似 chat UI + agent orchestrator），目前单用户使用。我们计划加入多用户支持，想请你从安全架构角度帮忙审视我们的方案。

---

## 一、系统现状

### 技术栈
- **后端**：Fastify 4.25 + Node.js 20 + TypeScript
- **前端**：Next.js 14 + React 18 + Zustand
- **实时通信**：Socket.IO 4.7
- **缓存/存储**：Redis (ioredis 5.3)
- **部署形态**：本地 macOS 单机，`localhost:3001`(API) + `localhost:3000`(Web)

### 核心概念
- **Thread**：对话线程，用户和 AI Agent 在 thread 中交互
- **Agent**：AI 代理（支持多个 LLM provider：Anthropic/OpenAI/Google），可以执行文件操作、运行命令
- **projectPath**：每个 thread 绑定一个项目目录，Agent 在该目录下工作（读写文件、执行 git 等）
- **Session**：Agent 的会话状态（非用户 session），按 `userId:catId:threadId` 键值存储
- **InvocationQueue**：Agent 调用队列，按 `threadId:userId` 隔离

### 当前认证/授权（几乎为零）
1. **身份识别**：浏览器通过 `X-Cat-Cafe-User` HTTP header 自报 userId（明文，无校验）
   - 前端从 URL 参数或 localStorage 取 userId，写入每个 fetch 请求的 header
   - 后端 `resolveUserId()` 统一解析：header → query param → fallback default
   - 设计时就预留了"将来替换成 session/JWT"的统一入口
2. **CORS**：自动放行所有 RFC1918 私网 IP + Tailscale CGNAT 段
3. **WebSocket**：客户端连接时传 `auth: { userId }`，服务端直接信任
4. **路由权限**：大部分路由无 owner 校验，知道 threadId 就能读写任何 thread
5. **文件系统**：Agent 可操作用户本机文件系统（受 `projectPath` allowlist 约束，但不区分用户）

**问题暴露**：同 WiFi 的朋友直接通过 IP 访问了 Hub，能看到所有对话、以 owner 身份操作 Agent。

---

## 二、需求

1. **朋友能以独立身份登录**（不是冒充 owner）
2. **私有 thread 只有 owner 可见**，共享区的 thread 大家可见
3. **每个用户只能操作自己被授权的目录**（比如各自的共享挂载卷 `/Volumes/xxx`）
4. **传输安全**（防同网络窃听）
5. **向后兼容**：单用户部署不受影响（auth 可关闭）

---

## 三、我们的方案（已内部讨论收敛）

### 三层安全模型
```
Layer 1: 认证 — GitHub OAuth + 本地 member/invite store
Layer 2: Thread ACL — ownerUserId + access(private|shared) + memberUserIds[]
Layer 3: projectPath ACL — userId → allowedProjectPaths[]
```

### Phase 1 MVP 具体设计

**认证**：
- GitHub OAuth App 做身份验证
- 本地 member store（Redis）维护 `githubUserId → localUserId + role(admin/member)`
- Admin（owner）可生成邀请链接，朋友用 GitHub 登录后成为 member
- Redis-backed server-side session + HttpOnly cookie（不用 JWT，已有 Redis）

**身份迁移**：
- 保留 `resolveUserId()` 作为统一入口，内部改为：session cookie → signed internal header → legacy header(dev only)
- 新增 `/api/me` 端点，前端启动时 bootstrap 当前用户
- 前端 fetch 改为 `credentials: 'include'`（cookie 自动带）
- WS 握手从 cookie/session 取身份

**Thread ACL**：
- Thread 新增字段：`ownerUserId`, `access: 'private' | 'shared'`, `memberUserIds: string[]`
- 所有 thread 读写路由加 owner/member 校验
- 默认 `private`，owner 可设为 `shared`

**projectPath ACL**：
- Member store 维护 `userId → allowedProjectPaths[]`
- Agent 执行命令前校验当前 thread 的 projectPath 是否在用户授权列表中
- 场景示例：
  - owner(landy): `~/projects/*` + `/Volumes/shared-team/*`
  - friend(alex): `/Volumes/alex-macbook/*` + `/Volumes/shared-team/*`

**Route audit**：
- 路由分三级：admin-only / member / internal(MCP/callback)
- `X-Cat-Cafe-User` 降级为 internal-only

**向后兼容**：
- `AUTH_ENABLED=true` 开启多用户模式
- 默认关闭 = 现有单用户行为不变

### 已否决方案
- 纯 token 邀请码（无持久身份）
- mTLS/客户端证书（对人类太重）
- 自建用户名密码（重复造轮子）
- JWT（撤销复杂，且已有 Redis）
- Thread 裸 `public` visibility（MVP 阶段容易泄漏）

---

## 四、请帮忙审视的问题

### 安全架构
1. 这套 GitHub OAuth + Redis session + HttpOnly cookie 的方案，在"本地部署、局域网多用户"场景下，有没有明显的安全漏洞？
2. projectPath ACL 在应用层做够吗？还是需要 OS 级隔离（如 chroot/容器）？考虑到 Agent 能执行任意 shell 命令。
3. CORS 当前自动放行私网 IP——多用户模式下这个策略要怎么调整？
4. Session fixation / CSRF 在这个场景下需要特别注意什么？

### 共享 Thread 的数据模型
5. Agent session 现在按 `userId:catId:threadId` 存储。共享 thread 下，多个用户看到的应该是同一个对话历史。Session 应该改成 thread-scoped 还是保持 user-scoped？各自的 tradeoff？
6. InvocationQueue 按 `threadId:userId` 隔离。共享 thread 下，A 发了消息 B 能看到 agent 回复吗？队列模型需要怎么调整？

### 迁移策略
7. 从"浏览器自报 userId"迁移到"server-side session"，有没有优雅的灰度方案？避免一次性大爆炸切换。
8. 现有 thread 数据没有 `ownerUserId` 字段，迁移时怎么处理？全标记为 admin 的？

### 我们可能忽略的
9. 这种"本地部署 + 局域网共享 + Agent 能执行命令"的场景，有没有我们完全没考虑到的攻击面？
10. 有没有类似的开源项目（self-hosted AI chat + multi-user）可以参考他们的 auth 实现？

---

## 五、补充约束

- 这是个人/小团队项目，不是企业级部署，方案要实用不要过度工程
- 目前只有 macOS 环境，未来可能支持 Linux
- Agent 执行的命令包括：git 操作、文件读写、npm/pnpm 命令、任意 shell 命令（通过 LLM tool use）
- 前端是 SPA，API 和 Web 同机部署
- Redis 已有，不想引入额外中间件
