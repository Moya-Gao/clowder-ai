---
title: ChatGPT Pro 云端砚砚（yanyan-cloud）接入 Cat Café — Remote MCP Bridge + 公网 Auth 可行性 Research
date: 2026-06-16
authors: [opus-47]
reviewers: [codex]
type: research
status: v2-post-codex-review (APPROVE 方向 + 2 P1 修 + Phase 1 spike gate)
related: [F178, F061, F174]
thread: thread_mqgem09a7skjvwhx
main-thread: thread_mqbpzs2k0fsos5yf

revision_history:
  v1 (2026-06-16, commit 52bc5716f): opus-47 research draft → @codex review
  v2 (2026-06-16, commit 6bea127fb): 修砚砚 R1 的 2 P1
    - P1#1: §6 L3 表述不成立（agent-key 是 bridge 服务凭证而非公网防线，真 blast-radius 控制 = L2 toolset 白名单）
    - P1#2: §2 ChatGPT auth 措辞过严（实际支持 OAuth/No Auth/Mixed Auth，但对公网 endpoint No Auth 安全出局 → 唯一可接受 = OAuth 2.1 + PKCE）
    - 落地砚砚 OQ 1-10 verdict
    - 加实现守门 spec 清单（§10）+ Phase 1 spike gate 细化（§8）
  v3 (2026-06-16, this revision, after opus-48 verify_before_guessing): 域名/基建校准
    - v1/v2 凭空假设域名 `yanyan-cloud.lysander.dev`、CF team `lysander.cloudflareaccess.com` — 错；
      48 查实 `~/.cloudflared/config.yml`，实际是 `clowder-ai.com`，现有 cat-cafe tunnel
      （ID `67125a9e...`, 2026-03-09 建）已在跑 `cafe.clowder-ai.com` / `api.clowder-ai.com`
    - 全 doc `yanyan-cloud.lysander.dev` → `mcp.clowder-ai.com`
    - CF team domain placeholder 化（`<team>.cloudflareaccess.com`，待铲屎官 dashboard 确认）
    - §5.5 SOP 重写：复用现有 tunnel + 加 ingress route + DNS CNAME + reload（不从头建）
    - 加 §5.5.0 现有 cat-cafe tunnel 基建摘要（DRY 复用纪律）
    - **教训**：我 v1/v2 没 verify_before_guessing — feedback_verify_before_guessing 该归档
---

# ChatGPT Pro 云端砚砚接入 Cat Café — Remote MCP Bridge Research

> **Research-not-spec**：本文档是立项前的可行性论证 + auth 风险评估，**不是 spec**。Phase A 拍板（开新 F 号 vs 归 F178 Phase D carry）由铲屎官签字（家规：F 号必须 CVO signoff）。当前默认归 **F178 Phase D carry**（与 fable-cowork-phase0 同处理），不开新 F 号，等 codex 跨族 auth review verdict 后给铲屎官提请。

## 0. TL;DR (v2 post-砚砚 review)

1. **ChatGPT Developer mode 支持多种 auth，但对公网 cat-cafe MCP endpoint 唯一可接受 = OAuth 2.1 Authorization Code + PKCE**：实测 OpenAI 官方文档列出 OAuth / No Auth / Mixed Auth；其中 No Auth 在公网场景必须出局（NeighborJack），自定义 API key / 客户自带 mTLS / client_credentials / JWT bearer assertions / M2M grants **不支持**，OpenAI-managed client mTLS 支持。这把方案空间压缩成"必须搭 OAuth + PKCE"。
2. **推荐路径 A**：Cloudflare Tunnel + Cloudflare Access OAuth（IDP 接 Google email allowlist）→ MCP server 验证 `Cf-Access-Jwt-Assertion` → 映射到 yanyan-cloud agent-key。不自建 OAuth Authorization Server（路径 B 复杂度爆炸 + 新 secret 体系 + 新攻击面），不走 CF Workers（路径 C 放弃现有 stdio entry 与 agent-key 基础设施）。
3. **核心 Phase 0 安全边界 = 二层公网防线 + 一层 internal accountability**（砚砚 P1#1 校正——v1 误把 agent-key 写成第三道公网防线）：
   - **L1 公网入口阻断**：CF Access OAuth + email allowlist（lysander@gmail.com 单人）+ WAF — 这一层挡住公网扫描者
   - **L2 真正的 blast-radius 控制**：`CAT_CAFE_DESKTOP_MODE=cloud-pro-phase0` 10 工具白名单 mode-precedence-highest — **公网攻击者绕过 L1 后能调到什么，全在这里**
   - **L3 internal accountability（非公网阻断）**：yanyan-cloud agent-key 是 bridge 调内部 API 的服务凭证 + 身份归因 + audit log + revocation + thread-targeted tools 必须显式 threadId — 提供事后撤销 / 审计追溯 / 内部 cat 身份隔离，但**不是独立的公网入口阻断**（任何能 hit `/mcp` POST 的请求都通过 bridge 自动拿到 yanyan-cloud 调 API 的权限）

## 1. 真相源 carry

属 **F178 Persistent MCP Agent-Key Auth** 延伸（F178 Phase D 节点：Remote mode profile）。理由：

- 与 fable-cowork-phase0（`docs/discussions/2026-06-13-fable-cowork-adapter-phase0.md`）同性质——给"非本地 invocation"的猫提供受限 MCP surface
- 复用 F178 已经建好的 `CAT_CAFE_DESKTOP_MODE` 收窄机制（`server-toolsets.ts:128` KNOWN_DESKTOP_MODES + `applyReadonlyFilter` mode-precedence-highest + fail-fast）
- 复用 F178 agent-key principal（`AgentKeyRegistry` + sidecar `0600` file + Redis hash）

**升级触发条件（→ 开新 F 号）**：①改公共 auth 语义（OAuth Authorization Server 形态、token issuance）②给 yanyan-cloud 写权限超 Phase 0 白名单（如 publish_verdict / shell）③公网 endpoint 形态变成多租户 / 非铲屎官账号能登录。**只要前述任一升级，必须 CVO 拍板新 F 号**（家规）。

## 2. ChatGPT Developer mode auth 约束矩阵（v2，砚砚 P1#2 校正）

| 能力 | ChatGPT 是否支持 | 公网 cat-cafe 场景的可接受性 | 我的方案影响 |
|------|---------|---|---|
| OAuth 2.1 Authorization Code + PKCE | ✅ 支持 | ✅ **唯一可接受的安全路径** | 必须采用 |
| CIMD（Client ID Metadata Documents） | ✅ 支持（推荐） | ✅ 可接受 | 简化 dynamic client 注册 |
| Dynamic Client Registration (DCR) | ✅ 支持 | ✅ 可接受 | 也行，比 CIMD 复杂 |
| OAuth `private_key_jwt` 签名 assertion | ✅ 支持 | ✅ 可接受 | 不需要（铲屎官单人） |
| `Authorization: Bearer <oauth-token>` 头自动注入 | ✅ 每个 MCP request 都加 | ✅ | server 端 OAuth 流程拿到的 token |
| **No Auth** | ✅ ChatGPT 客户端支持 | ❌ **公网场景必须出局**（NeighborJack — 任何扫到 endpoint 的人都能调 MCP） | 不采用 |
| **Mixed Auth**（部分 endpoint OAuth + 部分 No Auth） | ✅ ChatGPT 客户端支持 | ❌ 公网场景 No Auth 段仍会被打 | 不采用 |
| OpenAI-managed client mTLS（OpenAI 提供证书） | ✅ 支持 | ⚠️ 可加固但不替代 OAuth | 不在 Phase 0 scope |
| 自定义 HTTP 头（如 `CF-Access-Client-Id` / `X-API-Key`） | ❌ **不支持** | N/A | CF Access Service Token 出局；自定义 bearer 也出局 |
| `client_credentials` grant（M2M） | ❌ **不支持** | N/A | service account 出局 |
| 自定义 API key 字段（绕 OAuth） | ❌ **不支持**（官方明确，部分第三方 tutorial 说有 → 与官方冲突，以官方为准） | N/A | "贴个 token 完事"的简单方案不可行 |
| **客户自带 mTLS 证书**（self-provided） | ❌ **不支持** | N/A | 客户 mTLS 出局；OpenAI-managed mTLS 与之不同 |
| JWT bearer assertions（RFC 7523） | ❌ **不支持** | N/A | 不可用 |
| Transport 协议 | ✅ SSE 或 Streamable HTTP | ✅ | MCP TS SDK 有 `StreamableHTTPServerTransport` |
| Endpoint 路径 | ✅ `/mcp`（按 OpenAI Apps SDK doc：`https://abc123.ngrok.app/mcp`） | ✅ | 固定路径 |
| 工具 `readOnlyHint` 注解 | ✅ 决定是否要 confirmation prompt | UX 层防线，不替代 server 端白名单 | 不依赖（L2 白名单已收窄） |
| Write action confirmation | ✅ 默认每个 write 都问用户 | UX 层防线 | 不替代 L2 白名单 |

**关键夜约束**（来自 OpenAI Apps SDK Auth doc）：

> **ChatGPT does not support machine-to-machine OAuth grants such as client credentials, service accounts, or JWT bearer assertions, nor can it present custom API keys or customer-provided mTLS certificates.**

→ **公网 cat-cafe MCP endpoint 唯一可接受的安全路径 = OAuth 2.1 Authorization Code + PKCE**。ChatGPT 端虽然支持 No Auth / Mixed Auth，但公网场景下 No Auth 段必然被打 → 排除。"装个 bearer header 完事"的简单方案在 ChatGPT 端不存在（不支持自定义 header / 不支持自定义 API key field）。

> **Note**：以上交叉验证 OpenAI 官方 doc + Auth0/Cloudflare/MCP spec 三源。部分第三方 tutorial（truthifi 等）声称 ChatGPT 支持 "no auth / API key / OAuth" 三种 — 与 OpenAI 官方明确冲突。优先信官方。
> **v1 → v2 措辞校正**（砚砚 P1#2）：v1 写 "唯一支持 OAuth" 不准确——准确说法是 ChatGPT 支持多种 auth，但**公网 cat-cafe 场景下唯一可接受 = OAuth 2.1 + PKCE**。

## 3. Cat Café 端现状（实测）

### 3.1 现有 MCP server transport
读 `packages/mcp-server/src/`：

| 入口 | Transport | 注册 |
|---|---|---|
| `collab.ts` | `StdioServerTransport` | `registerCollabToolset()` |
| `memory.ts` | `StdioServerTransport` | `registerMemoryToolset()` |
| `signals.ts` | `StdioServerTransport` | signal tools |
| `limb.ts` | `StdioServerTransport` | limb tools |
| `finance.ts` | `StdioServerTransport` | finance tools |
| `index.ts` (legacy) | `StdioServerTransport` | `registerFullToolset()` |

**全部 stdio**。没有 remote transport。

### 3.2 fable-phase0 已建基础（要复用）

`server-toolsets.ts`：

```ts
const KNOWN_DESKTOP_MODES = new Set(['fable-phase0']);

export const DESKTOP_FABLE_PHASE0_ALLOWED_TOOLS = new Set([
  // collab — 5 项
  'cat_cafe_post_message',
  'cat_cafe_cross_post_message',
  'cat_cafe_get_thread_context',
  'cat_cafe_list_threads',
  'cat_cafe_get_message',
  // memory — 5 项
  'cat_cafe_search_evidence',
  'cat_cafe_graph_resolve',
  'cat_cafe_list_recent',
  'cat_cafe_list_session_chain',
  'cat_cafe_read_session_digest',
]);

// applyReadonlyFilter 优先级：
// 1. desktopMode 最高（unknown → fail-fast throw）
// 2. !readonly → 全开
// 3. readonly → READONLY_ALLOWED_TOOLS ∪ (hasAgentKey ? AGENT_KEY_TOOLS : ∅)
```

**关键性质**：`DESKTOP_MODE` 收窄是 **transport 无关**的——stdio / streamable HTTP 都通过 toolset 注册时的同一 filter 处理。只要新 mode 进 KNOWN_DESKTOP_MODES + 共用 `applyReadonlyFilter`，云端砚砚就能复用 fable 已经验证过的 mode-precedence + fail-fast + 不与 READONLY/AGENT_KEY 取并集语义。

### 3.3 agent-key 基础设施（已 production）

- `CallbackPrincipal`（F178 Phase B）：`kind: 'invocation' | 'agent_key'`
- `AgentKeyRegistry`：per-cat-per-user binding，45d TTL，rotation API，实时 revocation
- sidecar secret file：`0600`，路径 `~/.cat-cafe/agent-keys/<catId>.secret`
- mint CLI：`packages/api/dist/scripts/mint-agent-key.js` 三重显式 flag

**复用 yanyan-cloud 独立 agent-key**（不复用 fable-5 key，audit 可区分），符合 fable-phase0 的 LL-072 教训。

## 4. 候选架构路径（三选一）

### 路径 A：Cloudflare Tunnel + Cloudflare Access OAuth IDP ✅ 推荐

```
ChatGPT Web (Developer mode)
  ↓ (1) MCP discovery — GET /mcp 401 → WWW-Authenticate w/ resource_metadata_url
  ↓ (2) OAuth Authorization Code with PKCE
mcp.clowder-ai.com (Cloudflare Edge)
  ↓ Cloudflare Access intercepts
  ↓ (3) Redirect to IDP (Google / GitHub)
  ↓ (4) User logs in (lysander@gmail.com — email allowlist)
  ↓ (5) IDP redirects back → CF Access mints CF JWT as OAuth token
  ↓ (6) Token delivered to ChatGPT
ChatGPT
  ↓ Every MCP request: Authorization: Bearer <cf-jwt>
Cloudflare Tunnel (cloudflared)
  ↓ injects Cf-Access-Jwt-Assertion: <same-jwt> header
  ↓ forwards to origin
127.0.0.1:NEW_PORT (cat-cafe MCP streamable HTTP bridge)
  ↓ middleware: verify Cf-Access-Jwt-Assertion against CF public key
  ↓ extract subject email == lysander@gmail.com → map to { userId: 'default-user', catId: 'yanyan-cloud' }
  ↓ apply CAT_CAFE_REMOTE_MODE=cloud-pro-phase0 toolset whitelist
  ↓ apply agent-key principal injection
  ↓ tool handlers → http://127.0.0.1:3002 (cat-cafe API, agent-key auth)
```

**优势**：
- **不自建 OAuth AS**：Cloudflare Access 是托管 OAuth Authorization Server，代理到 Google IDP，铲屎官用现有 Google 账号登录
- **免费**：CF Tunnel + Access 在 Cloudflare Zero Trust free tier（≤50 seats，铲屎官单用户 1 seat 完全够）
- **email allowlist 防裸奔**：CF Access policy 限定 `lysander@gmail.com`，没注册的访问者 IDP 跳完直接被拒
- **零代码新 auth 层**：MCP server 只验签 `Cf-Access-Jwt-Assertion`（CF 公钥），不实现 OAuth /authorize /token /register endpoints
- **WAF + DDoS 抗压 + audit log**：CF Edge 自带，prompt injection 攻击者扫公网时第一层就过 WAF
- **静态 hostname**：`mcp.clowder-ai.com` 固定，不像 ngrok 免费版会变（ChatGPT connector 一次配好不动）

**劣势**：
- 依赖外部 IDP（Google）— 但铲屎官 Google 账号是现有 identity，不引入新依赖
- Cloudflare 看得到 metadata（hostname + 请求时间 + email）— 不是问题（CF 是基础设施，本来 DNS 就在 CF）
- 2026 Cloudflare 零日（fearsoff ACME）需要监控 — 这是接受的系统性风险，比自建 OAuth AS 风险面小一个量级

**Phase 1 实测 unknown**：
1. ChatGPT 看到 CF Access OAuth 时具体走什么 endpoint？是否符合 ChatGPT 期望的 OAuth shape（authorization_endpoint + token_endpoint + 推送 PKCE）？
2. CF Access 颁的 JWT 是否能直接当 ChatGPT 的 access token？还是需要中间一层 OAuth proxy？
3. 是否需要 `/.well-known/oauth-protected-resource` 在 cat-cafe MCP 一侧 publish，引导 ChatGPT 走 CF Access OAuth？

**实测计划**（Phase 1 spike，不在 research 阶段做）：
- 起一个最简 hello-world HTTP server 用 CF Tunnel 暴露，CF Access OAuth 配 Google IDP
- 在 ChatGPT Developer mode 创建 connector 填 URL，看 ChatGPT 的 OAuth 探测行为（截网络包）
- 若 ChatGPT 不识别 CF Access OAuth shape → 备选方案：在 cat-cafe 一侧搭最小 OAuth proxy（route `/authorize` `/token` `/register` → 转发到 CF Access）

### 路径 B：自建 OAuth 2.1 Authorization Server（如 workers-oauth-provider 模型） ⛔ 不推荐

参考 Cloudflare 官方 [securing-mcp-server doc](https://developers.cloudflare.com/agents/guides/securing-mcp-server/) 和 Auth0 + Cloudflare 示例：

- 自己实现 `/authorize` + `/token` + `/register`（DCR）+ `/oauth/callback`
- 颁发 OAuth token，server-side 映射到 agent-key
- 实现 CSRF 防护、state token binding、`__Host-` cookie、scope 校验、audience binding（resource indicator）

**劣势（compounded）**：
- 新 auth surface = 新攻击面（OAuth AS 实现错一个细节就泄漏全家）
- DCR + CIMD + PKCE + token rotation + introspection 全要正确实现
- TLS 证书管理（需自己跑 ACME）
- 比路径 A 多 10x 代码 + 10x 攻击面 + 10x 维护成本
- **核心反问**：我们没必要重新发明 OAuth Authorization Server。CF Access 已经是托管的 OAuth AS，路径 A 就是用它

**何时考虑 B**：路径 A Phase 1 实测**确认 ChatGPT 不接受 CF Access OAuth shape**（理论可能但概率极低），且 CF Workers as proxy 也不可行时。这时回到 B 是兜底方案，**不是首选**。

### 路径 C：Cloudflare Workers as MCP server bridge ⛔ 不推荐

- 用 cloudflare workers 部署一个 OAuth-aware proxy
- proxy 验证 OAuth → 转发到 worker 内部 MCP 逻辑（或者代理到本地 stdio 子进程）

**劣势**：
- 把 cat-cafe MCP 逻辑搬到 worker 上 = 双套基础设施（worker 上 typescript runtime + 本地 stdio entry）
- worker 上跑 MCP 还得连本地 cat-cafe API（要么暴露本地 API 到公网，要么搭隧道），变成"双套远程"
- 放弃现有 stdio entry / agent-key 体系的统一抽象

## 5. 推荐方案细节（路径 A）

### 5.1 新增 server entry

`packages/mcp-server/src/remote.ts`（**新文件，不改现有 stdio entry**）：

```ts
import express from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { registerCollabToolset, registerMemoryToolset } from './server-toolsets.js';
import { verifyCfAccessJwt } from './utils/cf-access.js';

const app = express();
app.use(express.json());

// 1) Cf-Access-Jwt-Assertion validation middleware
app.use('/mcp', async (req, res, next) => {
  const jwt = req.headers['cf-access-jwt-assertion'] as string | undefined;
  if (!jwt) return res.status(401).json({ error: 'missing cf-access-jwt' });
  try {
    const principal = await verifyCfAccessJwt(jwt, {
      teamDomain: process.env.CF_ACCESS_TEAM_DOMAIN!,
      audience: process.env.CF_ACCESS_AUD!,
      emailAllowlist: ['lysander@gmail.com'],
    });
    next();
  } catch (e) {
    return res.status(401).json({ error: 'invalid cf-access-jwt', reason: (e as Error).message });
  }
});

// 2) MCP endpoint (stateless)
app.post('/mcp', async (req, res) => {
  const server = new McpServer({ name: 'cat-cafe-cloud-pro-mcp', version: '0.1.0' });
  registerCollabToolset(server);  // CAT_CAFE_REMOTE_MODE=cloud-pro-phase0 已收窄
  registerMemoryToolset(server);
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,  // stateless mode
  });
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

const port = Number(process.env.CAT_CAFE_REMOTE_PORT ?? 3098);
app.listen(port, '127.0.0.1', () => {
  console.error(`[cat-cafe-cloud-pro] MCP Streamable HTTP listening on 127.0.0.1:${port}`);
});
```

**关键纪律**：
- bind `127.0.0.1`（绝不 `0.0.0.0` — 那是 NeighborJack 受害者）
- 端口 3098（远离 6398 worktree dev / 6399 sanctuary / 3002 cat-cafe API）
- stateless transport（每 request 一个 server instance — 简化 session state，缺点是失去 SSE 长连接；ChatGPT 用 Streamable HTTP 不依赖 sticky session）

### 5.2 server-toolsets.ts 增量

```ts
// 复用 fable-phase0 同一套白名单（10 项）
export const REMOTE_CLOUD_PRO_PHASE0_ALLOWED_TOOLS = DESKTOP_FABLE_PHASE0_ALLOWED_TOOLS;

const KNOWN_DESKTOP_MODES = new Set(['fable-phase0', 'cloud-pro-phase0']);

// applyReadonlyFilter 内：
if (env.desktopMode === 'cloud-pro-phase0') {
  return tools.filter((t) => REMOTE_CLOUD_PRO_PHASE0_ALLOWED_TOOLS.has(t.name));
}
```

**命名权衡**：
- 云端砚砚原方案提议改名 `CAT_CAFE_REMOTE_MODE`，更准确
- 但改 env 名意味着改 fable-phase0 入口（兼容期 / 测试更新）
- **建议**：保留 `CAT_CAFE_DESKTOP_MODE` env 名不变（fable & cloud-pro 都用同一 env，"Desktop" 是历史命名），只加新 mode 值 `cloud-pro-phase0`。Phase 1 实施前 codex review 拍板这点

### 5.3 yanyan-cloud agent-key + sidecar

```bash
# mint key（铲屎官明确授权后跑，与 fable mint 同形）
node packages/api/dist/scripts/mint-agent-key.js \
  --cat-id yanyan-cloud \
  --redis-url redis://127.0.0.1:6399 \
  --i-understand-runtime-redis \
  --execute
```

写到 `~/.cat-cafe/agent-keys/yanyan-cloud.secret`（mode `0600`）。

**前提**：cat roster（`cat-config.json`）必须有 `yanyan-cloud` 条目（mint script catId allowlist 校验，否则 fail-closed）。Phase 1 implementing 时同时加。

### 5.4 远程 server 启动 env

```bash
CAT_CAFE_AGENT_KEY_FILE=/Users/lysander/.cat-cafe/agent-keys/yanyan-cloud.secret
CAT_CAFE_API_URL=http://127.0.0.1:3002
CAT_CAFE_READONLY=true
CAT_CAFE_DESKTOP_MODE=cloud-pro-phase0
CAT_CAFE_USER_ID=default-user
CAT_CAFE_CAT_ID=yanyan-cloud
CAT_CAFE_REMOTE_PORT=3098
CF_ACCESS_TEAM_DOMAIN=<team>.cloudflareaccess.com  # 待铲屎官 dashboard 确认
CF_ACCESS_AUD=<application-AUD-claim>
```

明示 **不设**：
- `ALLOWED_WORKSPACE_DIRS`（即使 read_file_slice 不在白名单，defense-in-depth）
- `CAT_CAFE_AGENT_KEY_FILES`（保单猫单文件，避免 cross-variant 串身份 — F178 KD-10 fail-closed 教训）

### 5.5 Cloudflare 端配置 SOP（v3，复用现有 cat-cafe tunnel）

#### 5.5.0 现有基建摘要（48 verify_before_guessing 查 `~/.cloudflared/config.yml` 得）

铲屎官**已有** Cloudflare Tunnel `cat-cafe`（ID `67125a9e...`，建于 2026-03-09），现跑：

| Hostname | Origin | 用途 |
|---|---|---|
| `cafe.clowder-ai.com` | front=`http://localhost:3001` + `/api`→3002 + `/ws`→3002 | 主前端 |
| `api.clowder-ai.com` | `http://localhost:3002` | API 备用入口 |

**DRY 复用纪律**：spike 不从头建 tunnel，加 ingress route 即可。

#### 5.5.1 加 `mcp.clowder-ai.com` ingress（一次性）

1. 编辑 `~/.cloudflared/config.yml`，在 ingress **顶部**加一条 route（顺序敏感，新 route 必须在 catch-all 之前）：
   ```yaml
   ingress:
     - hostname: mcp.clowder-ai.com
       service: http://localhost:3098
     # ... 现有 cafe.clowder-ai.com / api.clowder-ai.com 保持不动
   ```
2. 配 DNS CNAME（Cloudflare 自动指向 tunnel）：
   ```bash
   cloudflared tunnel route dns cat-cafe mcp.clowder-ai.com
   ```
3. reload cloudflared 让新 ingress 生效：
   ```bash
   sudo launchctl kickstart -k system/com.cloudflare.cloudflared
   # 或 systemctl reload cloudflared（Linux）
   ```
4. 验证（spike 真正起 bridge 后）：
   ```bash
   curl -I https://mcp.clowder-ai.com/mcp  # 应该 401（缺 JWT，符合预期）
   ```

#### 5.5.2 Cloudflare Access Application + Google IDP（dashboard 一次性）

铲屎官在 Cloudflare Zero Trust dashboard 配：

1. **加 Google OAuth IDP**（Settings → Auth → Login methods → Add → Google）— **48 提醒**：需登 dashboard 确认是否已配
2. **新建 Application**：
   - Application domain: `mcp.clowder-ai.com/*`
   - Policy: Action = Allow, Selector = Emails → `lysander@gmail.com`
   - Identity Provider: Google OAuth
   - Session duration: 24h
   - **CIMD（Client ID Metadata Documents）支持**：Phase 1 spike 实测时确认是否启用（ChatGPT 推荐用）
3. 记下两个值填到 bridge env：
   - **Application AUD claim** → `CF_ACCESS_AUD`
   - **Team domain**（CF Access Settings → General → Team domain）→ `CF_ACCESS_TEAM_DOMAIN`

**SOP 写入**：`docs/SOP.md` 加一节"Cloud Pro MCP Bridge 部署"，或新建 `docs/sops/cloud-pro-mcp-bridge.md`

### 5.6 ChatGPT Web 配置 SOP

铲屎官在 ChatGPT 配（一次性）：

1. Settings → Connectors → Developer Mode → Create connector
2. URL: `https://mcp.clowder-ai.com/mcp`
3. Authentication: OAuth
4. ChatGPT 自动探测 OAuth discovery → CF Access OAuth flow 弹出 → 用 Google 登录 lysander@gmail.com
5. 连接成功，云端砚砚（在 ChatGPT 创建 new chat 选这个 connector）即可调 10 项白名单工具

## 6. Phase 0 安全边界（v2，砚砚 P1#1 校正）

> **v1 错误**：把 yanyan-cloud agent-key 写成"独立的第三道公网防线"，声称"即使前两层穿透，没 valid agent-key 进不了 cat-cafe API"。
>
> **v1 错在哪**：bridge 进程自带 sidecar yanyan-cloud key（启动时从 0600 file 注入）。任何能 hit `/mcp` POST 且通过 CF Access 验签的请求，bridge 会**自动使用**这把 key 调内部 API——所以 L3 不是"门"，是"身份证"。
>
> **真 blast-radius 控制 = L2 toolset 白名单**。L3 提供事后撤销 / 审计追溯 / 内部 cat 身份隔离，是 internal accountability layer，不是独立公网阻断。

| 层 | 类别 | 机制 | 失效/绕过后果 |
|---|---|---|---|
| **L1** | 公网入口阻断 | CF Access OAuth（IDP=Google，email allowlist=lysander@gmail.com）+ WAF + DDoS 抗压 + CF Tunnel inbound 只来自 CF Edge | 公网扫描者打 `/mcp` POST → CF Access 401（无 valid JWT）。Google IDP 跳完发现 email 不在 allowlist → CF Access 拒绝。零外人能到 bridge |
| **L2** | **真正的 blast-radius 控制** | `CAT_CAFE_DESKTOP_MODE=cloud-pro-phase0` mode-precedence-highest，10 工具白名单（5 collab + 5 memory），unknown mode fail-fast throw，不与 READONLY/AGENT_KEY 取并集 | L1 被绕（CF Access 0day / OAuth token 被 ChatGPT 内部泄漏 / prompt injection 让攻击者从 ChatGPT 端发恶意 MCP 请求）→ **公网攻击者能调到的就是这 10 项白名单**（无 shell / file slice / limb / publish_verdict / backfill / hub actions / raw transcript / signals / finance）。攻击者拿不到本地 secret，不能控本地浏览器，不能发 verdict 自盖章——但能：post 消息 / search 记忆 / 读 thread context |
| **L3** | Internal accountability（**非公网阻断**） | yanyan-cloud agent-key sidecar `0600`，bridge 进程注入 → 所有 callback API 调用以 yanyan-cloud 身份归因 + audit log；thread-targeted tools 必须显式 `threadId`（省略 → 400）；agent-key 实时 revocation API；45d TTL + rotation | L1+L2 都被绕时 L3 **不阻断**——bridge 自带 key，能继续调 API。L3 的价值 = 事后能定位"哪些消息是 yanyan-cloud 发的" → revoke yanyan-cloud key → 后续无法再调；audit log 给 forensics 提供根因；threadId 显式约束防"猜测式攻击" |

**独立可挡的攻击 vs 不能挡的攻击**：

| 攻击场景 | L1 挡 | L2 挡 | L3 挡 |
|---|---|---|---|
| 公网扫描者打 `/mcp` POST | ✅ CF Access 401 | n/a | n/a |
| 互联网 prompt injection 攻击者发恶意请求 | ✅ 没有 valid JWT 进不来 | n/a | n/a |
| ChatGPT 端 prompt injection（让云端砚砚自己调危险 tool） | n/a（ChatGPT 端 valid JWT） | ✅ tool-not-found | n/a |
| CF Access 0day（fake JWT 绕过验签） | ❌（前提是 0day） | ✅ 仍限 10 工具 | ❌（攻击者拿到 bridge 等于拿到 yanyan-cloud key） |
| yanyan-cloud key 泄漏（local malware 读 sidecar） | n/a | n/a（key 本来就是 bridge 的） | ❌ → 但能 revoke + audit forensics |

**P(三层同时失效)** = `P(CF Access 0day) × P(mode filter bypass) × P(audit miss after revoke)` → 极低。但**真正决定攻击者能做什么的是 L2**，不是"三层加起来"。Spec 阶段必须把这个分层语义讲清楚，不让 future review 以为"L3 是公网防线"。

## 7. 风险矩阵（v2，砚砚 review 后校准）

| 风险 | 缓解 | Residual |
|---|---|---|
| 公网 `/mcp` 裸奔（NeighborJack） | bind 127.0.0.1 + CF Tunnel + Access OAuth + email allowlist | Low |
| ChatGPT 不支持自定义 header → CF Service Token 出局 | 走 OAuth + CF Access OAuth IDP（不需要自定义 header） | N/A |
| CF Tunnel 注入伪 `Cf-Access-Jwt-Assertion` | 验签校 sig + iss + aud + exp + nbf + email allowlist；multi-value header 拒；401 不回显验签异常（防 oracle） | Low |
| OAuth token 被 ChatGPT 内部劫持 | CF Access 24h TTL + 实时 session revoke；**但攻击者拿到 token 即可触达 L2 的 10 白名单工具**（agent-key 不再被算作独立兜底） | Medium（v1 误标 Low） |
| 工具白名单逃逸（mode bypass） | unit test 覆盖 unknown mode fail-fast + 10 工具白名单回归 + cloud review 已踩过 fable 路径 P1 limb 漏洞，会再踩 | Low |
| yanyan-cloud key 泄漏（本地 malware 读 sidecar） | sidecar `0600` + 45d TTL + rotation API + audit log + 立刻 revoke | Medium（同 fable 风险） |
| 跨 catId 串身份（fable vs yanyan-cloud） | 独立 sidecar file path + mint script catId allowlist + 不设 `CAT_CAFE_AGENT_KEY_FILES`（保单猫单文件，fail-closed） | Low |
| 本地 cat-cafe API 因 bridge bug 暴露给公网 | bridge bind 127.0.0.1 + API 也 bind 127.0.0.1 + CF Tunnel 内网通信 + bridge 不监听外网 interface | Low |
| ChatGPT prompt injection 让 yanyan-cloud 滥发消息 | L2 白名单（无 shell / file slice / publish_verdict）+ user-scope 边界 + 所有写操作 audit + revoke 路径已就绪 | Medium（接受 — 第一版只给眼睛和嘴） |
| **OAuth proxy 自身被攻陷（CF Access 0day）** | 不在我们控制范围；接受系统性风险；Cloudflare 比自建 AS 风险面小一个量级；**但 0day 一旦发生，L2 是唯一防线**（L3 不阻断） | **Medium**（v1 误标 Low-Medium，砚砚校正） |
| ChatGPT 内部 prompt history 泄漏 cat-cafe context | Phase 0 白名单只让 yanyan-cloud 读必要 context，不读 raw transcript / invocation detail | Medium（接受） |
| Cloudflare 看得到 hostname + 请求时间 + email | 接受（CF 是基础设施，本来 DNS 在 CF） | N/A |
| L1+L2 同时被穿（CF 0day + 白名单工具被恶用） | post 消息攻击（伪装 yanyan-cloud 给铲屎官发钓鱼）、search_evidence 拉走 cat-cafe 知识 | Medium-High（接受 — Phase 0 trade-off）；缓解=audit log + revoke API + email allowlist 限制谁能进来 |

## 8. Phase 1 Spike Gate（v2 砚砚明定的核心实测）

> **Gate 性质**：Phase 1 spike 是 **research → spec 之间的硬关卡**。spike 通过 + 2 P1 修完后才能 cross_post 主 thread → 铲屎官 signoff → spec → Design Gate。

**核心实测**：验 Cloudflare Access `oauth_configuration.enabled`（CF Access 自带 OAuth issuer 模式）是否能满足 ChatGPT MCP OAuth discovery 全套：

| 项目 | 验什么 |
|---|---|
| `/.well-known/oauth-protected-resource` | bridge 是否需要 publish 这个 metadata 引导 ChatGPT 探测 CF Access AS？还是 ChatGPT 直接接受 CF Access 自己的 discovery？ |
| `/.well-known/oauth-authorization-server` metadata | CF Access 是否完整 publish？字段是否包含 `authorization_endpoint` / `token_endpoint` / `registration_endpoint` / `code_challenge_methods_supported`（含 S256）？ |
| PKCE | CF Access 是否原生支持 PKCE（S256）？还是需要中间 proxy 补 PKCE？ |
| DCR（Dynamic Client Registration） | CF Access 是否支持？ChatGPT 默认走 DCR，CF 不支持 → ChatGPT 注册失败 |
| `WWW-Authenticate` 401 challenge | bridge 401 时是否要返回 `WWW-Authenticate: Bearer resource_metadata_url=...` 引导 ChatGPT 进入 OAuth flow？ |
| `Cf-Access-Jwt-Assertion` 形态 | CF Tunnel 是否注入这个 header 到 origin？bridge 验签的公钥从哪个 CF endpoint 取？JWT claims 是否含 email / sub / iss / aud / exp / nbf？ |

**Gate 分支决策树**：

```
Phase 1 spike: 起一个 hello-world /mcp server (echo tool)
              + CF Tunnel 暴露
              + CF Access OAuth 配 Google IDP + email allowlist
              + ChatGPT Developer mode 创建 connector 填 URL

  ChatGPT 能完整走 OAuth + 调到 echo tool
  ├─ ✅ CF Access OAuth shape 兼容 ChatGPT
  │     → Path A 落地：bridge 只验 Cf-Access-Jwt-Assertion，无自建 OAuth endpoint
  │     → 推进 spec → Design Gate → 实现
  │
  ├─ ⚠️ ChatGPT 不识别 CF Access shape（具体看哪步失败）
  │     → Path A'：在 cat-cafe 一侧搭 **最小 OAuth proxy**
  │       （route /authorize /token /register → 转发到 CF Access）
  │       ChatGPT 看 cat-cafe 的 OAuth endpoint，背后由 CF Access 颁 token
  │       仍在 research scope，**不开新 F 号**
  │     → spike 再跑一次验通过 → 推进 spec
  │
  └─ ❌ 需要自建完整 OAuth Authorization Server（不能用 CF Access 代理）
        → 这意味着 cat-cafe 一侧实现 AS：颁 token / 管 PKCE / 管 DCR / token introspection
        → 新攻击面 + 新 secret 体系 + 新维护负担
        → **触发新 F 号 + CVO signoff**（家规 KD-9）
        → 不在 research scope；停下来等铲屎官签字开新 F 号
```

**实测路径**（Phase 1 实施清单）：

1. 起 hello-world `/mcp` server，跑在 127.0.0.1:3098（与 spec 一致），暴露一个 `echo` tool
2. 铲屎官按 §5.5.1 加 `mcp.clowder-ai.com` ingress 到现有 `cat-cafe` tunnel + 按 §5.5.2 在 dashboard 建 Access Application（Google IDP，email allowlist `lysander@gmail.com`）
3. 铲屎官在 ChatGPT Web Settings → Connectors → Developer mode 创建 connector 填 `https://mcp.clowder-ai.com/mcp`
4. 看 ChatGPT 的 OAuth 探测行为（cat-cafe MCP server 端日志 + CF Access 后台 audit log）
5. 验证 echo tool 调用 + Authorization Bearer 头 + `Cf-Access-Jwt-Assertion` 头都到位
6. 若分支 ⚠️ → 加最小 OAuth proxy 重跑
7. 若分支 ❌ → 停手，cross_post 主 thread 告诉铲屎官需要开新 F 号

**spike 通过的 verdict 模板**（spike-passing fixture）：

```
[Phase 1 spike result — 2026-XX-XX]
- Tested by: opus47/landy
- CF Access OAuth shape: [✅ ChatGPT 兼容 / ⚠️ 需 OAuth proxy / ❌ 需新 F 号]
- Echo tool 调用: [✅ ok with N round-trips]
- `Cf-Access-Jwt-Assertion` 头: [✅ injected by CF Tunnel] [claims: sub=..., email=..., aud=..., iss=...]
- 失败场景测试: [缺 JWT → 401 / 过期 JWT → 401 / fake JWT → 401 / 非 allowlist email → CF 拒]
- Verdict: [APPROVE 推进 spec / HOLD 重新跑]
```

**Spike unknowns（保留 v1 的，不重复）**：
- Streamable HTTP vs SSE 哪个对 ChatGPT 更稳
- CF Access 24h JWT 过期后 ChatGPT 是否自动 refresh
- MCP TS SDK `StreamableHTTPServerTransport` API 稳定性

## 9. 工程任务拆分

云端砚砚原版 6 任务 vs 我重排后的 7 任务（公网 auth 升级为 #1）：

| # | 云端砚砚原版 | 我的版本（重排） | 理由 |
|---|---|---|---|
| 1 | Remote MCP Bridge Spike | **Phase 1 spike：CF Access OAuth + MCP discovery 兼容性验证** | 公网 auth 是核心难点，必须先验证 ChatGPT 能不能识别 CF Access OAuth shape，否则全盘推倒重来 |
| 2 | Cloud Pro Phase 0 Tool Profile | Server-side toolset 收窄（`cloud-pro-phase0` mode） | 同云端方案，但只是改 `server-toolsets.ts` + unit test，纯 trivial |
| 3 | Agent Key / Identity | yanyan-cloud sidecar + mint CLI cat allowlist | 同云端方案 + 加 yanyan-cloud 到 `cat-config.json` roster |
| 4 | Tunnel SOP | CF Tunnel + Access 一次性配置 SOP（dashboard 操作） | 写文档 |
| 5 | Smoke Test | E2E smoke：10 项可调 + 11 项 deny + auth 401 + email allowlist 拒收 | 同云端方案 |
| 6 | Cloud Review Request Contract | （deferred 到 Phase 2） | 第一版让云端砚砚自由读 thread + 发回消息，先不强制 contract；F178 Phase E 再细化 |
| **+7** | （没有） | **Remote MCP Bridge 实现**（`remote.ts` + Express + Streamable HTTP transport + CF Access 验签 middleware） | 真正的 transport 改造 |

**云端砚砚原方案的 task #1 "Remote MCP Bridge Spike" 把"公网 auth 设计"打包进 bridge spike 一起做**——我**反对这种打包**：公网 auth 是 dealbreaker 级别的可行性问题，必须**先单独验证**再投入 bridge 实现成本。

## 10. ADR-031 三层映射 + 实现守门清单（v2 落砚砚校正）

| 层 | 落地 |
|---|---|
| **软** | 本 research doc + Phase 1 spec（Design Gate 后产出）+ 部署 SOP（CF + ChatGPT 一次性配置） |
| **硬** | `server-toolsets.ts` 加 `cloud-pro-phase0` mode + `remote.ts` CF Access 验签 middleware + mint script catId allowlist + 下面的实现守门清单全部 unit test 覆盖 |
| **eval** | yanyan-cloud 接入后 smoke E2E：白名单工具可调 + 黑名单 `tool not found` + auth 边界全验。verdict 回填本 doc |

### 10.1 实现守门 spec 清单（spec 阶段必带，砚砚 verdict 必修）

**bridge JWT 验签（remote.ts middleware）**：
- [ ] 验 `Cf-Access-Jwt-Assertion` 头签名（CF Access public key，从 `https://<team>.cloudflareaccess.com/cdn-cgi/access/certs` 取并缓存）
- [ ] 校 `iss`（必须等于 `https://<team>.cloudflareaccess.com`）
- [ ] 校 `aud`（必须等于 `CF_ACCESS_AUD` env 配的 application AUD claim）
- [ ] 校 `exp`（过期 → 401）
- [ ] 校 `nbf`（not-before，未生效 → 401）
- [ ] 校 `email`（必须在 email allowlist，默认 lysander@gmail.com）
- [ ] **header 多值拒**：`Cf-Access-Jwt-Assertion` 若 array / 包含多个值 → 直接 401（防 header injection）
- [ ] **401 不回显验签异常细节**（防 oracle attack）：仅返回 `{ error: "invalid auth" }`，不返回 "expired" / "fake sig" / "wrong aud" 之类细分理由
- [ ] env 缺失（`CF_ACCESS_TEAM_DOMAIN` / `CF_ACCESS_AUD` / `CAT_CAFE_AGENT_KEY_FILE`）→ **server 启动 fail-fast throw**，不静默接受裸跑

**bridge 注册面（remote.ts）**：
- [ ] **只注册 `registerCollabToolset` + `registerMemoryToolset`**；不注册 limb / signals / finance / audio（defense-in-depth：即使 mode filter bypass，limb 等 dangerous toolset 根本没注册）
- [ ] **不设 `ALLOWED_WORKSPACE_DIRS`**（即使 read_file_slice 不在白名单，defense-in-depth）
- [ ] **不设 `CAT_CAFE_AGENT_KEY_FILES`**（保单猫单文件，避免 cross-variant 串身份，F178 KD-10 fail-closed 教训）
- [ ] bind 127.0.0.1:3098（**绝不 0.0.0.0**，NeighborJack 反面教材）

**toolset 收窄（server-toolsets.ts）**：
- [ ] `KNOWN_DESKTOP_MODES` 加 `cloud-pro-phase0`
- [ ] `REMOTE_CLOUD_PRO_PHASE0_ALLOWED_TOOLS = DESKTOP_FABLE_PHASE0_ALLOWED_TOOLS`（复用同 10 项）
- [ ] `applyReadonlyFilter` mode 分支处理 `cloud-pro-phase0`（mode-precedence-highest，不与 READONLY / AGENT_KEY 取并集）
- [ ] **守门测试矩阵**：
  - [ ] `cloud-pro-phase0` 模式下 10 项 allow（5 collab + 5 memory）
  - [ ] `cloud-pro-phase0` 模式下危险工具 deny（`cat_cafe_shell_exec` / `cat_cafe_read_file_slice` / 任何 `limb_*` / `cat_cafe_publish_verdict` / `cat_cafe_backfill_events` / `cat_cafe_workspace_navigate` / `cat_cafe_preview_open` / `cat_cafe_teleport` / `cat_cafe_register_external_runtime_session` / `cat_cafe_run_perspective` / `cat_cafe_create_rich_block` / `cat_cafe_list_events` / `cat_cafe_list_external_runtime_sessions` / `cat_cafe_read_external_runtime_session` / `cat_cafe_read_session_events` / `cat_cafe_read_invocation_detail`）
  - [ ] unknown mode（如 `cloud-pro-phase0-typo`）→ fail-fast throw on server startup
  - [ ] `buildLimbTools` 在 `cloud-pro-phase0` mode 下返回空数组（同 fable Phase D V3 cloud P1 修正）

**E2E auth 回归测试**：
- [ ] 缺 `Cf-Access-Jwt-Assertion` 头 → 401
- [ ] header 值为空 / 仅空格 → 401
- [ ] header 多值（如 `Cf-Access-Jwt-Assertion: x, y`）→ 401
- [ ] 过期 JWT（伪造过期 token）→ 401
- [ ] sig 篡改的 JWT → 401
- [ ] 错 `aud` claim → 401
- [ ] 错 `iss` claim → 401
- [ ] email 不在 allowlist → 401
- [ ] valid JWT + 调白名单工具 → 200
- [ ] valid JWT + 调黑名单工具 → tool-not-found（MCP 协议层）
- [ ] valid JWT + 缺 `threadId` 调 thread-targeted tool → 400

**mint script 守门**：
- [ ] catId allowlist 必须含 `yanyan-cloud`（`cat-config.json` roster 同步加）
- [ ] 6399 sanctuary triple-explicit flag（复用 fable mint）
- [ ] preflight 全过才 lazy `registryProvider`（复用 fable）
- [ ] sidecar 写入 `~/.cat-cafe/agent-keys/yanyan-cloud.secret` 0o600 + chmod 显式确认 + stat 校验

## 11. Open Questions Verdict（v2 砚砚 R1 拍板落地）

| # | 问题 | 我建议 | 砚砚 Verdict | 状态 |
|---|---|---|---|---|
| OQ-1 | 路径 A vs B vs C？ | A | ✅ **A 选定**（路径 B/C 都不首选；B 触发新 F 号 + CVO signoff） | resolved |
| OQ-2 | 公网 auth 三层防御是否够 Phase 0？ | 够 | ✅ APPROVE 方向；但 L3 表述要按 v2 §6 校正（不算独立公网防线） | resolved |
| OQ-3 | env 命名：保留 `DESKTOP_MODE` 加新值 vs 改名 `REMOTE_MODE`？ | 保留 `DESKTOP_MODE` | ✅ **保留 `CAT_CAFE_DESKTOP_MODE`** + 加值 `cloud-pro-phase0`（兼容 fable 入口） | resolved |
| OQ-4 | Phase 0 工具白名单是否复用 fable-phase0 同 10 项？ | 复用 | ✅ **复用同 10 项**（5 collab + 5 memory） | resolved |
| OQ-5 | `publish_verdict` 第一版要不要开？ | 不开 | ✅ **不开** | resolved |
| OQ-6 | `cat_cafe_create_rich_block` 第一版要不要开？ | 不开 | ✅ **不开** | resolved |
| OQ-7 | bridge 中间存不存 OAuth session state（如 KV）？ | 不存（stateless） | ✅ **不存**（依赖 CF Access session；bridge stateless） | resolved |
| OQ-8 | bridge 跑在哪个 port？ | 3098 | ✅ **3098 bind 127.0.0.1**（绝不 0.0.0.0） | resolved |
| OQ-9 | Phase 1 spike 失败的备选方案？ | 最小 OAuth proxy；最差升级路径 B | ✅ **见 §8 Spike Gate 决策树**：CF Access 兼容 → A 落地；不兼容 → A' 最小 proxy（仍在 research scope）；要自建完整 AS → **触发新 F 号 + CVO signoff** | resolved |
| OQ-10 | 立项归属：F178 Phase D carry vs 开新 F 号？ | F178 carry | ⏳ 砚砚未明确拍板，**铲屎官签字决定**（默认 carry，触发条件见 §12） | pending CVO |

## 12. 何时升级开新 F 号（立项触发条件）

研究后立项前**默认 F178 Phase D carry**，与 fable-cowork-phase0 同处理。**仅以下触发条件下升级新 F 号**（家规 CVO signoff）：

1. **公网 auth 形态升级**：从 CF Access OAuth IDP 改为自建 OAuth AS（路径 B）→ 新攻击面 + 新 secret 体系
2. **多租户**：从铲屎官单用户扩展到多个 user / cat 共享 endpoint → user binding 模型升级
3. **写权限扩展**：超出 Phase 0 10 工具白名单（如 publish_verdict / create_task / shell）→ 攻击面扩大
4. **持久 session state**：bridge 引入 KV / 数据库存 OAuth state → 新存储依赖

## 13. 不在 scope（明示排除）

- **多 cloud cat 接入**（如同时接 Claude Pro / Gemini Pro / Qwen Cloud）— 只搭 ChatGPT Pro 一条链路；其他 cloud cat 走相同模式但独立 mint / env / 入口
- **跨 user 隔离**（lysander 之外的用户接入）— Phase 0 单用户
- **Token / cost 监控**（云端砚砚每次调用要花 ChatGPT Pro quota）— 不在 server 端追，ChatGPT 自己监控
- **云端砚砚 IDE / 文件系统访问**（即 ChatGPT App SDK 的 UI inline）— Phase 0 只给 MCP 工具，不做 inline UI
- **agent-key rotation 自动化**（手动 rotate 即可）

## 14. 决策记录（research 阶段）

| # | 决策 | 理由 |
|---|---|---|
| KD-R1 | research 阶段不开新 F 号，归 F178 Phase D carry（默认；CVO 签字最终拍） | 与 fable-cowork-phase0 同处理；spec 阶段触发立项条件再升级 |
| KD-R2 | 推荐路径 A（CF Tunnel + Access OAuth IDP）— B/C 备选 | A 复杂度最低 + 风险面最小 + 复用现有 Google IDP + CF 免费 tier 够单用户 |
| KD-R3 | 公网 auth 升级为 task #1（先于 bridge 实现） | dealbreaker 验证必须最先做，否则 bridge 实现可能推倒重来 |
| KD-R4 | yanyan-cloud 独立 agent-key（不复用 fable-5） | audit 可区分 + LL-072 教训（per-cat sidecar 已成纪律） |
| KD-R5 | mode `cloud-pro-phase0` 独立（不复用 `fable-phase0`） | 审计清晰；如 cloud-pro 后续工具白名单与 fable 分歧时无 hard fork 痛点 |
| KD-R6 | env 名保留 `CAT_CAFE_DESKTOP_MODE`（不重命名 `REMOTE_MODE`） | 兼容期成本 vs 命名美感，前者更重；砚砚 OQ-3 verdict 同意 |
| KD-R7 | Phase 0 工具白名单复用 fable 同 10 项（5 collab + 5 memory） | 同安全收窄 + smoke test 矩阵可复用 |
| KD-R8 | bridge stateless（每 request 新 server instance） | 简化 session state；ChatGPT Streamable HTTP 不依赖 sticky |
| KD-R9 | bridge bind 127.0.0.1:3098 | 不 NeighborJack（绝不 0.0.0.0） |
| KD-R10 | 不依赖 ChatGPT 的 `readOnlyHint` UX confirmation 防线 | 我们 server 端白名单收窄是硬约束；UX confirm 是 ChatGPT 自己的兜底 |
| **KD-R11** | **L3 重新定位 = internal accountability，不是公网阻断防线**（v2 砚砚 P1#1 校正） | bridge 自带 sidecar key；任何能 hit `/mcp` POST + 通过 CF Access 的请求都自动获得 yanyan-cloud 调 API 的权限。真 blast-radius 控制 = L2 toolset 白名单 |
| **KD-R12** | **公网 auth 措辞精确化：ChatGPT 支持 OAuth/No Auth/Mixed Auth，但公网场景唯一可接受 = OAuth 2.1 + PKCE**（v2 砚砚 P1#2 校正） | 实测 OpenAI 文档 ChatGPT 支持多种 auth shape，但 No Auth 在公网必然出局（NeighborJack）；OpenAI-managed mTLS 支持但客户自带 mTLS 不支持，要区分清楚 |
| **KD-R13** | **Phase 1 spike 是 spec 前硬关卡**：若需自建完整 OAuth Authorization Server → **触发新 F 号 + CVO signoff**，不在 research scope（砚砚 verdict） | 自建 OAuth AS = 新攻击面 + 新 secret 体系 + 新维护负担，超出 F178 Phase D carry scope |

## 15. 链路状态

- **研究 v1**：opus-47 完成（commit `52bc5716f`）
- **跨族 auth review**：@codex（砚砚）✅ APPROVE 方向 + 2 P1 + Phase 1 spike gate（msg `0001781601105415-000726-10969776` 投递回主 thread）
- **研究 v2**：opus-47 修 2 P1（commit `6bea127fb`）
  - P1#1 §6 L3 表述重写（agent-key 是 internal accountability，不是公网防线；L2 才是 blast-radius 控制）
  - P1#2 §2 ChatGPT auth 措辞校正（公网场景唯一可接受 = OAuth + PKCE，不是"ChatGPT 唯一支持"）
  - 落地 §11 OQ verdict
  - §10 加实现守门 spec 清单
  - §8 Phase 1 Spike Gate 细化（CF Access OAuth discovery 五项验证 + 分支决策树）
- **研究 v3**：opus-47 域名/基建校准（本 revision，opus-48 verify_before_guessing 抓 v1/v2 凭空假设域名）
  - opus-48 查实 `~/.cloudflared/config.yml`：现有 `cat-cafe` tunnel（ID `67125a9e...`）已跑 `cafe.clowder-ai.com` + `api.clowder-ai.com`
  - 全 doc `yanyan-cloud.lysander.dev` → `mcp.clowder-ai.com`；CF team domain → placeholder（待 dashboard 确认）
  - §5.5 重写为"复用现有 tunnel + 加 ingress route + DNS CNAME + reload"，加 §5.5.0 现有基建摘要
  - §8 spike 步骤 2 改为按 §5.5.1/§5.5.2 走（复用而非新建）
  - 教训：v1/v2 没 verify_before_guessing，凭空写域名 — feedback_verify_before_guessing 实战二次踩
- **下一棒**：cross_post 主 thread 给 @opus48 + @landy 签字决策
  - 决策 1：开新 F 号 vs F178 Phase D carry（OQ-10）
  - 决策 2：Phase 1 spike 排期 + Google IDP + ChatGPT connector 账户配置授权（tunnel 不用建，只加 ingress + Access Application）
- **预期路径**：CVO signoff → Phase 1 spike（铲屎官 + opus47 联手实测）→ spike verdict 回填本 doc → spec → Design Gate → 实现

## Sources

- [ChatGPT Developer mode | OpenAI Developers](https://developers.openai.com/api/docs/guides/developer-mode)
- [Connect from ChatGPT – Apps SDK | OpenAI Developers](https://developers.openai.com/apps-sdk/deploy/connect-chatgpt)
- [Authentication – Apps SDK | OpenAI Developers](https://developers.openai.com/apps-sdk/build/auth) — dealbreaker quote source
- [Building MCP servers for ChatGPT Apps and API integrations](https://developers.openai.com/api/docs/mcp)
- [MCP and Connectors | OpenAI API](https://developers.openai.com/api/docs/guides/tools-connectors-mcp)
- [OAuth on MCP: The Comprehensive Implementation Guide | Permit.io](https://www.permit.io/blog/oauth-on-mcp)
- [Securing MCP servers · Cloudflare Agents docs](https://developers.cloudflare.com/agents/guides/securing-mcp-server/)
- [MCP server portals · Cloudflare One docs](https://developers.cloudflare.com/cloudflare-one/access-controls/ai-controls/mcp-portals/)
- [Securing the AI Revolution: Cloudflare MCP Server Portals](https://blog.cloudflare.com/zero-trust-mcp-server-portals/)
- [Service tokens · Cloudflare One docs](https://developers.cloudflare.com/cloudflare-one/identity/service-tokens/) — 用于排除 CF Service Token 路径
- [Secure and Deploy Remote MCP Servers with Auth0 and Cloudflare](https://auth0.com/blog/secure-and-deploy-remote-mcp-servers-with-auth0-and-cloudflare/)
- [Integrate Your Auth0 Secured MCP Server in ChatGPT | Auth0 Blog](https://auth0.com/blog/add-remote-mcp-server-chatgpt/)
- [Deploying remote MCP servers | Speakeasy](https://www.speakeasy.com/mcp/deploying-mcp-servers)
- [Cloudflare Tunnel in 2026: Expose localhost Without Opening Ports](https://dev.to/recca0120/cloudflare-tunnel-in-2026-expose-localhost-without-opening-ports-or-buying-an-ip-32l5)
- [Sovereign MCP: Expose Local MCP Servers to Remote Clients via Cloudflare Tunnel](https://dev.to/y_m_2990f82cec633528440f4/sovereign-mcp-expose-local-mcp-servers-to-remote-clients-via-cloudflare-tunnel-2hpo)
- [Exposed AI Agents in the Wild: Public MCP Server | IONIX](https://www.ionix.io/blog/exposed-ai-agents-in-the-wild-public-mcp-server-security-exposed/) — NeighborJack 反面教材
- [MCP TypeScript SDK | GitHub](https://github.com/modelcontextprotocol/typescript-sdk)
- 内部：`docs/discussions/2026-06-13-fable-cowork-adapter-phase0.md`（架构样板）
- 内部：`docs/features/F178-persistent-mcp-agent-key-auth.md`（agent-key + mode 基础设施）

---

**预先注册的撤回条件**（feedback_pre_register_retraction_conditions）：

我最可能错在哪：

1. **CF Access OAuth shape 实测不兼容 ChatGPT** — 若 Phase 1 spike 发现 ChatGPT 不识别 CF Access 颁的 token shape，路径 A 必须升级到 "CF Access + 自建最小 OAuth proxy" 或回退路径 B
2. **ChatGPT 隐性约束没读全** — 第三方 tutorial 和 OpenAI 官方 doc 冲突，可能有更隐性的限制（如 endpoint 必须 publish 特定 `.well-known/`）
3. **CF Access 的免费 tier 限制** — 50 seats 是 user 维度，但若 CF Access 对单用户的 token 颁发频次有 rate limit，可能需付费升级
4. **Streamable HTTP transport vs SSE 选择** — 我倾向 Streamable HTTP（stateless），但若 ChatGPT 对 SSE 长连接有依赖（如 progress streaming），可能需切 SSE
5. **MCP TS SDK `StreamableHTTPServerTransport` API 不稳定** — 若 SDK 没固化 streamable transport，可能需自己写 transport handler

[宪宪/Opus-4.7🐾]
