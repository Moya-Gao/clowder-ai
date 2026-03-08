---
feature_ids: [F077]
topics: [auth, oauth, multi-user, security, external-review]
doc_kind: research
created: 2026-03-07
source: ChatGPT Pro (GPT-5.4)
---

# F077 外部咨询 — ChatGPT Pro 架构反馈

> 咨询 prompt 见同目录 `external-consultation-prompt.md`

## 回复原文

<!-- 铲屎官：把 ChatGPT Pro 的完整回复粘贴在下面 -->

先给结论。

你们这套三层模型方向是对的，MVP 能落地。真正的分水岭不在 GitHub OAuth，也不在 Thread ACL，而在一句很硬的话上面：

**只要多个成员触发的任意 shell，最终都跑在同一个 macOS OS 用户下面，你们就还没有“强隔离”的多用户安全，只是“有身份、有权限检查的协作模式”。**

所以我会把方案分成两层来拍板：

1. **现在就能上线的安全多用户协作**
   GitHub OAuth + Redis server session + HttpOnly cookie + Thread ACL + projectPath ACL + HTTPS + CSRF/Origin 校验。这能解决“同 WiFi 朋友直接冒充 owner 看全部 thread”这一类问题。([GitHub Docs][1])

2. **真正的成员级 shell 隔离**
   必须把 Agent runner 提升到 OS 级边界，比如每个成员独立 OS 用户或独立 rootless 容器。因为 Git 仓库、npm 生命周期脚本、以及任意 shell 都能执行命令；Node 自己的 permission model 也明确说它**不是**对恶意代码的安全边界，symlink 还可能绕过路径授权。`chroot` 也不是可靠沙箱。([Git][2])

下面我按你们的 10 个问题逐条过。

---

## 1. GitHub OAuth + Redis session + HttpOnly cookie，在本地部署 / 局域网多用户下有没有明显漏洞？

**方案本身没问题，明显漏洞主要有三个：**

**第一，浏览器侧身份来源必须彻底收口到 session cookie。**
一旦 `AUTH_ENABLED=true`，浏览器请求里就不应该再有任何能“自报身份”的入口。`X-Cat-Cafe-User` 必须从“普通浏览器请求可用”降成“internal-only 且默认不用”。否则你们相当于在正门装了门禁，旁边还留了一个“自己写名字就能进”的侧门。Open WebUI 的 trusted-header 文档就专门警告过这类配置，一旦代理没挡住直连，用户可能伪装成任意用户，所以应用应该只暴露给那个受信代理，或仅绑定到 `127.0.0.1`。([Open WebUI][3])

**第二，局域网里不能再跑明文 HTTP。**
OWASP 和 MDN 都强调 session cookie 应该是 `Secure`，而 `Secure` cookie 只会在 HTTPS 下发送，`localhost` 是特殊例外，但 `192.168.x.x` 这种 LAN 地址不是例外。也就是说，你们如果继续让朋友通过局域网 IP 走 HTTP，session 就会在网络上裸奔，窃听和会话劫持都成立。WebSocket 也一样，局域网多用户模式应该上 `wss://`。([OWASP Cheat Sheet Series][4])

**第三，session 细节要补齐，不然容易被 fixation 和实现坑绊一下。**
GitHub OAuth 这条链路要用随机 `state`，最好加 PKCE。GitHub 明说 `state` 应该是随机且不可猜的；授权码 10 分钟过期；PKCE 能防 code interception。Fastify OAuth 插件文档也说明它依赖 cookie，默认是 `httpOnly` + `sameSite: 'lax'`，并支持 state cookie 与 PKCE。([GitHub Docs][1])

我会这样配：

* `__Host-catcafe.sid` 这种 cookie 名，带 `Secure`、`HttpOnly`、`Path=/`、不设 `Domain`，`SameSite=Lax`
* 登录成功后 `session.regenerate()`
* 邀请接受成功后再 `regenerate()`
* 角色变化，比如 member 提升 admin 后也 `regenerate()`
* `saveUninitialized=false`
* Fastify 在反代后面时打开 `trustProxy`
* `@fastify/session` 升到不受 CVE-2024-35220 影响的版本。这个漏洞会导致部分场景下过期 session 没有被正确销毁。([MDN Web Docs][5])

还有一个小但很值钱的点：**GitHub OAuth scope 尽量最小化。**
如果你们只是把 GitHub 当身份提供者，不要顺手多拿 repo 权限。GitHub 的 scope 文档里写得很清楚，默认无 scope 就能拿到用户公开资料；只有在需要读取私有邮箱时才要 `user:email`。([GitHub Docs][6])

---

## 2. projectPath ACL 只做应用层够吗？还是必须 OS 级隔离？

**如果成员能触发“任意 shell”，应用层 ACL 不够。**

原因不是抽象哲学，是很具体的：

* Git 本身会受 repo 配置、hook、外部 diff/merge 工具等影响而执行 shell，官方安全文档明确写了，**不要在不受信任的仓库里以高权限身份跑 Git**。([Git][2])
* npm / pnpm 生态里，`install`、`postinstall`、`prepare` 这些生命周期脚本都能跑任意命令。([npm 文档][7])
* Node 的 permission model 文档直接说了，它**不是**用来防御恶意代码的，symlink 还能把路径权限绕出去。([Node.js][8])
* `chroot` 不是现代意义上的安全沙箱，官方手册就写了它**不是为了这个设计的**。([man7.org][9])

所以我建议你们把这个问题说得坦率一点：

### 能接受“协作型安全”时

应用层 `projectPath ACL` 是必要的，而且应该做严：

* 所有路径先 `realpath`
* allowlist 也存 canonical path
* 比较前统一带尾部 `/`
* 相对路径、`cwd`、工具参数里的路径都要在 spawn 前重新校验
* 拒绝 symlink 跨界
* thread 绑定的 `projectPath` 本身就要 canonicalize

这能挡住误操作和大部分“正常用户”的越权。

### 要求“成员之间硬隔离”时

**raw shell 不要直接给 member。**
至少在 macOS MVP 阶段，我会这样分：

* `admin` 可以用 raw shell
* `member` 先只给受控工具，比如受限文件读写、受限 git、受限 npm/pnpm wrapper
* 真要给 member raw shell，就做 **per-user runner**，每个 runner 跑在独立 OS 用户下，独立 `HOME`、独立 ssh/git credential、独立 env allowlist，共享目录用 OS 文件权限开放

这个设计不花哨，但它是真门，不是贴纸。

---

## 3. CORS 现在自动放行私网 IP。多用户模式要怎么改？

**多用户模式下，这个策略应该直接退休。**

原因有两层：

### 第一层，cookie + CORS 不是“看到私网就放行”

一旦你们改成 cookie session，并且前端要 `credentials: 'include'`，服务端就**不能**回 `Access-Control-Allow-Origin: *`。必须返回具体 origin，而且最好带 `Vary: Origin`。MDN 和 Socket.IO 都写得很明确。([MDN Web Docs][10])

### 第二层，Socket.IO 里 WebSocket 本身不吃 CORS

Socket.IO 官方文档专门提醒，CORS 只影响浏览器的 HTTP long-polling，**WebSocket 不受 CORS 限制**。如果你们只配了 CORS，却没在握手阶段做 `allowRequest` / `Origin` 校验，等于门禁只拦住了穿西装的请求，翻窗的还在。([Socket.IO][11])

### 我建议的做法

**最优解：把 Web 和 API 收成一个 HTTPS origin。**
比如 `https://catcafe.local`，前面放 Caddy，Next 和 Fastify 都挂在这个 origin 下，`/api` 和 `/socket.io` 反代到后端。这样 CORS 基本消失，复杂度和出错面都小很多。Caddy 对本地和内网主机支持 automatic HTTPS，也支持本地 CA。Tailscale Serve 也能给 tailnet 内本地服务自动上 TLS。([Caddy Web Server][12])

如果短期内还要保留 `3000` 和 `3001` 双端口，那就：

* 显式 `ALLOWED_ORIGINS`，比如只允许 `https://catcafe.local`
* Fastify CORS `credentials: true`
* Socket.IO `cors.credentials: true`
* 同时在 Socket.IO `allowRequest` 里校验 `Origin`
* 不再根据 RFC1918 网段自动放行
* 不主动给任意来源开放 Private Network Access

Chrome 关于 Private Network Access 的说明也强调了，对更私有网络的请求本来就有 CSRF / DNS rebinding 风险，宽松开放会把你们的本地服务变成别人网页的跳板。([Chrome for Developers][13])

---

## 4. Session fixation / CSRF 这里要特别注意什么？

这两件事在你们场景里都要认真对待，不是大公司专属烦恼。

### Session fixation

OWASP 和 MDN 的建议都很直接：**用户认证成功时要重新生成 session ID**，权限级别变化时也一样。Fastify session 也提供了 `regenerate()` 和 `destroy()`。([OWASP Cheat Sheet Series][4])

你们这里至少四个时机要 rotate：

* GitHub OAuth 登录成功
* 邀请链接兑换成功
* 角色变化
* logout

### CSRF

因为你们准备用 cookie，CSRF 就进场了。
`SameSite=Lax` 很有帮助，但 **不是完整防线**。OWASP 建议对所有 state-changing 请求用 CSRF token，并配合 `Origin`/`Referer`/Fetch Metadata 之类的校验。Fastify 生态也有 `@fastify/csrf-protection`。([OWASP Cheat Sheet Series][14])

我会这样做：

* 所有 `POST/PUT/PATCH/DELETE` 都校验 CSRF token
* 同时校验 `Origin` 必须等于你们的前端 origin
* 可以再加 `Sec-Fetch-Site` 拒绝跨站
* WebSocket 握手时校验 session 和 `Origin`
* 即使 socket 建好了，后续每个敏感 event 仍然要做 ACL 检查，不能因为“已经连上 socket”就信任它

这套组合拳很接地气，成本也不高。

---

## 5. 共享 Thread 下，Agent session 应该 thread-scoped 还是 user-scoped？

我建议你们**拆成两种状态**，不要二选一。

### 共享状态，thread-scoped

这些应该跟 thread 走：

* 对话历史
* Agent 看到的共享上下文
* 当前计划 / 草稿 / patch / 待执行步骤
* 共享文件树快照、repo 状态缓存这类“所有成员看到应该一致”的东西

因为共享 thread 的核心价值就是“大家看的是同一场戏”，不是每个人看同一块幕布但后台剧本各写各的。

### 个体状态，user-scoped

这些应该跟 `threadId + userId` 走：

* 发起本次 run 的身份
* 此用户当前可用的 `allowedProjectPaths`
* 此用户是否允许 raw shell / 哪些工具可用
* 个人 provider credential 或偏好
* 面向个人的 UI 状态、未读、草稿

所以你们现在这个“Agent session”概念最好拆成：

* `threadRuntimeState`
* `actorContext`

**共享 thread 的运行时应该以 `thread` 为主，以 `initiator user` 为辅。**
也就是：同一份共享上下文，叠加“这次是谁发起的、他有哪些权限”。

这样可以避免一个很要命的混乱：A 和 B 明明看到同一条共享历史，但 Agent 暗地里维护了两份不同 session，最后回复风格、上下文、工具可见性都飘开，审计也会很难看。

---

## 6. InvocationQueue 共享 thread 下怎么调？A 发消息 B 能看到回复吗？

**共享 thread 下，队列应该改成 thread-scoped。**

也就是：

* 队列 key 用 `threadId`
* 每个 job 附上 `initiatorUserId`
* 回复写入共享 thread transcript
* 所有在 `thread:{threadId}` room 里的成员都能看到 agent 回复
* 如果有仅给发起者看的错误，比如“你无权访问这个 projectPath”，再额外发到 `user:{userId}` room

原因很简单。
如果继续保留 `threadId:userId` 级别的独立队列，在共享 thread 里就会出现上下文交叉污染和执行顺序撕裂：A 觉得他在第 7 步，B 那边可能已经从另一份 session 跑到第 9 步了，repo 还是同一个，最后现场像两只猫在同一张键盘上同时踩空格。

Socket.IO 官方文档本身就推荐用自定义 session ID 或用户 ID 加 room，不要把业务身份绑在临时的 `socket.id` 上，因为 `socket.id` 每次重连都会变，而且官方也明确说它不是持久业务标识。它也提供了把 Express session 共享到 Socket.IO 的标准做法，这个思路同样适用于你们的 server-side session。([Socket.IO][15])

我会额外加一个小规则：
**同一 thread 只允许一个 active invocation。**
如果两个共享 thread 指向同一 `projectPath`，再考虑加一个“按 projectPath 的写锁”，避免两个 agent 同时改一个 repo。

---

## 7. 从浏览器自报 userId 迁到 server-side session，怎么灰度最稳？

你们现在这个 `resolveUserId()` 正好可以当迁移桥，但要改成“**双栈过渡，不是长期双标**”。

我会按这个顺序走：

1. **先引入 session middleware、`/api/me`、socket 从 cookie 取身份**
   前端启动后只认 `/api/me`，不再从 URL/localStorage 决定自己是谁。

2. **`resolveUserId()` 改顺序**
   `session cookie -> internal signed header -> legacy header(dev only)`
   这里的关键是最后那个 legacy header 要被 Feature Flag 狠狠关住。

3. **加 shadow logging**
   记录每个请求的身份来源 `session|internal|legacy`、threadId、路由、决策结果。这样你能先看一周日志，确认有没有前端角落还偷偷发旧 header。

4. **先把所有读接口挂上统一 authz，再切写接口**
   不要一个个手改 hoping for the best。OWASP 的建议就是 deny-by-default，而且每个请求都要做对象级授权。([OWASP Cheat Sheet Series][16])

5. **最后把 legacy header 收成两种特殊情况**

    * `AUTH_ENABLED=false` 的单用户开发模式
    * internal callback / MCP 回调，但最好只走 loopback 或 Unix socket，且前置代理负责剥掉外部传来的同名头

**重点是：不要让 legacy header 在 AUTH_ENABLED=true 的浏览器流量里长期存活。**
那会把你们整个认证模型变成“有 session，但也能旁路”。

---

## 8. 现有 thread 没有 `ownerUserId`，迁移时怎么处理？

**在 auth-enabled 模式下，我建议一刀切：所有历史 thread 默认归 bootstrap admin，并且默认 `private`。**

理由很硬：

* 旧时代的 `userId` 来源本来就是浏览器自报，**不可信**
* 既然旧身份不可验证，就不能把它当授权依据
* 在权限系统上线时，宁可“收紧后人工开放”，不要“放宽后等泄露”

我会这样迁：

* `ownerUserId = bootstrapAdminUserId`
* `access = 'private'`
* `memberUserIds = []`
* 可额外存一个 `legacyUserHint` / `legacyOwnerHint` 只做审计，不做授权

如果你们确定历史上真的是长期单人使用，这个迁移对语义也最贴近现实。

---

## 9. 这种“本地部署 + 局域网共享 + Agent 能执行命令”的场景，还有哪些你们可能没想到的攻击面？

有，而且还不止一个。这里我把最值得盯的几只“暗门鼠”列出来。

### 9.1 Git repo 本身就是代码执行入口

不受信 repo 里的 hook、config、外部工具调用都可能触发命令，Git 官方安全文档明确提醒不要用高权限身份在这类环境里跑 Git。([Git][2])

### 9.2 npm / pnpm 安装就是脚本执行

`install`、`postinstall`、`prepare` 都会跑命令。只要 agent 能 `npm install`，它就已经不是“包管理”，而是“脚本执行器”。([npm 文档][7])

### 9.3 child process 默认会继承你们进程环境变量

Node 子进程默认 `env: process.env`。如果主进程带着 OpenAI key、Anthropic key、GitHub token、SSH 相关环境变量，agent shell 会自然继承。([Node.js][17])

所以我会强烈建议：

* spawn 时用显式 env allowlist
* runner 使用独立 `HOME`
* 不把 owner 的 shell profile、ssh-agent、git credential helper 暴露给成员 runner

### 9.4 Redis 不要暴露在 LAN 上

Redis 官方自己都说了，它是给受信客户端的，应该放在应用层后面，用 bind / 防火墙限制访问；而且 AUTH 在无 TLS 情况下是明文。([Redis][18])

### 9.5 WebSocket 跨站劫持和 DNS rebinding

浏览器会带 `Origin` 头，服务端应该检查。Chrome 对 Private Network Access 的说明也点过，私网资源天然有 CSRF / rebinding 风险。你们现在这个“局域网服务 + 浏览器 + 自动放私网”的组合，天生就要对 `Origin`、`Host`、反代边界更敏感。([MDN Web Docs][19])

### 9.6 XSS / Clickjacking

既然这是个“能操作本地文件和命令”的前端面板，前端安全头别省：

* `Content-Security-Policy`
* `frame-ancestors 'none'`
* `X-Frame-Options: DENY`
* `X-Content-Type-Options: nosniff`

OWASP 对 clickjacking 和 CSP 都有明确建议。([OWASP Cheat Sheet Series][20])

### 9.7 Prompt injection 不是“模型问题”，而是“权限边界问题”

这个点没有必要装成外星科技。
只要模型会读 repo、读 issue、读 README、读网页，就可能被里面的恶意内容引导去调用工具。所以危险工具不要只靠“模型应该懂事”，而要靠权限检查和最小权限。

### 9.8 内网横向探测 / SSRF

一旦 agent 能 shell，它就能 `curl http://localhost:6379`、扫你本机端口、碰各种本地服务。这个在 Linux 以后更值得做网络级限制。MVP 先至少不要把 Redis、数据库、内部 callback 暴露给 LAN。

---

## 10. 有没有类似开源项目可参考 auth 实现？

有几个值得抄“思想”，不一定抄“整套架构”。

### Open WebUI

它已经有比较成熟的多用户、RBAC、群组和资源分享模型。文档里还能看到它对 trusted-header SSO 的警告，这对你们特别有参考价值，因为你们也有“internal-only identity header”的想法。([Open WebUI][21])

### AnythingLLM

它把 single-user 和 multi-user 明确分开，多用户下有 admin / manager / default user 角色，普通用户只能访问被加入的 workspace。它还有一次性、短时效的 auth-link 设计，适合作为“邀请链接安全性”参考。([AnythingLLM][22])

### LibreChat

如果你们想看一个 self-hosted AI chat 项目是怎么接 OAuth2 / OIDC 的，LibreChat 值得翻。它支持 GitHub、Google 和通用 OIDC。([LibreChat][23])

**你们这个项目最适合参考的组合是：**
Open WebUI 学“多用户资源分享和 trusted proxy 边界”，LibreChat 学“auth provider 接入”，AnythingLLM 学“single-user / multi-user 模式切换”和“工作区级访问控制”。

---

## 我会怎么给你们的 MVP 定版

如果你让我今天就拍一个“够实用、不超工”的版本，我会定成这样：

1. **AUTH_ENABLED=false 时只绑定 `127.0.0.1`**
   想暴露到 LAN，必须显式开 `LISTEN_LAN=true`。单用户旧模式可以保留，但不再默认对局域网开放。

2. **AUTH_ENABLED=true 时统一走 HTTPS 单一 origin**
   前面放 Caddy 或 Tailscale Serve。这样 cookie、CORS、Socket.IO 都顺很多。([Caddy Web Server][12])

3. **浏览器身份只认 session cookie**
   GitHub OAuth + Redis session + `__Host-` cookie + session rotate + CSRF token + Origin 校验。([GitHub Docs][1])

4. **所有 thread 相关接口统一走对象级 authz**
   `private/shared/member` 全放中央中间件里，不靠每个路由手写心情。([OWASP Cheat Sheet Series][16])

5. **共享 thread 的 transcript 和 runtime 改成 thread-scoped**
   `initiatorUserId` 只作为这次运行的权限上下文。队列也改成 thread-scoped。

6. **projectPath ACL 继续做，但 raw shell 先只给 admin**
   member 先上受控工具。要给 member 任意 shell，再上 per-user runner / OS 用户隔离。

7. **Redis 只监听 loopback，本机内部服务单独认证**
   internal callback 最好走 loopback / Unix socket，不接受外网同名头。([Redis][18])

8. **历史 thread 全迁到 admin/private**
   老 `userId` 只留作备注，不做授权依据。

---

最后给你一个很直白的判断：

**你们现在的设计，作为“朋友一起用、默认彼此善意”的多用户协作平台，完全可以做得很稳。**
**但只要成员拥有“任意 shell”，而 runner 仍共享同一个 OS 用户，就不要把它描述成真正的安全隔离。**

这不是方案失败，恰恰相反，这是把门框、锁芯、和整栋楼的承重墙分清楚了。

如果你愿意，我下一条可以直接给你一份**“Cat Café 多用户安全 MVP 落地清单”**，按后端改动点拆到 Fastify 中间件、cookie 配置、Socket.IO 握手、Thread/Queue 数据结构和迁移脚本字段级别。

[1]: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps "https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps"
[2]: https://git-scm.com/docs/git "https://git-scm.com/docs/git"
[3]: https://docs.openwebui.com/features/access-security/auth/sso/ "https://docs.openwebui.com/features/access-security/auth/sso/"
[4]: https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html "https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html"
[5]: https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Cookies "https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Cookies"
[6]: https://docs.github.com/enterprise-cloud%40latest/apps/oauth-apps/building-oauth-apps/best-practices-for-creating-an-oauth-app "https://docs.github.com/enterprise-cloud%40latest/apps/oauth-apps/building-oauth-apps/best-practices-for-creating-an-oauth-app"
[7]: https://docs.npmjs.com/cli/v11/using-npm/scripts/ "https://docs.npmjs.com/cli/v11/using-npm/scripts/"
[8]: https://nodejs.org/api/permissions.html "https://nodejs.org/api/permissions.html"
[9]: https://man7.org/linux/man-pages/man2/chroot.2.html "https://man7.org/linux/man-pages/man2/chroot.2.html"
[10]: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Access-Control-Allow-Credentials "https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Access-Control-Allow-Credentials"
[11]: https://socket.io/docs/v4/handling-cors/ "https://socket.io/docs/v4/handling-cors/"
[12]: https://caddyserver.com/docs/automatic-https "https://caddyserver.com/docs/automatic-https"
[13]: https://developer.chrome.com/blog/private-network-access-preflight "https://developer.chrome.com/blog/private-network-access-preflight"
[14]: https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html "https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html"
[15]: https://socket.io/how-to/use-with-express-session "https://socket.io/how-to/use-with-express-session"
[16]: https://cheatsheetseries.owasp.org/cheatsheets/Insecure_Direct_Object_Reference_Prevention_Cheat_Sheet.html "https://cheatsheetseries.owasp.org/cheatsheets/Insecure_Direct_Object_Reference_Prevention_Cheat_Sheet.html"
[17]: https://nodejs.org/api/child_process.html "https://nodejs.org/api/child_process.html"
[18]: https://redis.io/docs/latest/operate/oss_and_stack/management/security/ "https://redis.io/docs/latest/operate/oss_and_stack/management/security/"
[19]: https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API/Writing_WebSocket_servers "https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API/Writing_WebSocket_servers"
[20]: https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html "https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html"
[21]: https://docs.openwebui.com/features/access-security/rbac/ "https://docs.openwebui.com/features/access-security/rbac/"
[22]: https://docs.anythingllm.com/features/security-and-access "https://docs.anythingllm.com/features/security-and-access"
[23]: https://www.librechat.ai/docs/configuration/authentication/OAuth2-OIDC "https://www.librechat.ai/docs/configuration/authentication/OAuth2-OIDC"


<!-- 回复原文结束 -->

## 关键发现摘录

<!-- 布偶猫会在收到回复后提取要点填写 -->

### 安全架构（Q1-Q4）

| 问题 | GPT Pro 观点 | 我们的行动 |
|------|-------------|-----------|
| Q1: OAuth+Session+Cookie 方案漏洞 | | |
| Q2: projectPath ACL 应用层 vs OS 隔离 | | |
| Q3: CORS 策略调整 | | |
| Q4: Session fixation / CSRF | | |

### 共享 Thread 数据模型（Q5-Q6）

| 问题 | GPT Pro 观点 | 我们的行动 |
|------|-------------|-----------|
| Q5: Session thread-scoped vs user-scoped | | |
| Q6: InvocationQueue 共享 thread 调整 | | |

### 迁移策略（Q7-Q8）

| 问题 | GPT Pro 观点 | 我们的行动 |
|------|-------------|-----------|
| Q7: 灰度迁移方案 | | |
| Q8: 现有 thread 数据迁移 | | |

### 盲区 & 参考（Q9-Q10）

| 问题 | GPT Pro 观点 | 我们的行动 |
|------|-------------|-----------|
| Q9: 未考虑的攻击面 | | |
| Q10: 可参考的开源项目 | | |

## 对 F077 spec 的影响

<!-- 收到回复后评估是否需要修改 spec -->

- [ ] Key Decisions 需要调整？
- [ ] 新增 AC？
- [ ] Phase 划分需要变？
- [ ] 新增 Open Questions？

## 审计追踪

| 时间 | 事件 |
|------|------|
| 2026-03-07 | 发送咨询 prompt |
| | 收到回复（铲屎官粘贴） |
| | 布偶猫提取要点 + 评估影响 |
