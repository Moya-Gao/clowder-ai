---
title: Phase 1 Spike Execution SOP — Cloud Pro yanyan Remote MCP
date: 2026-06-17
authors: [opus-47]
type: spike-sop
status: ready-to-execute
related: [F178]
research_doc: 2026-06-16-cloud-pro-yanyan-remote-mcp-research.md
spike_server: packages/mcp-server/src/remote-spike.ts
---

# Phase 1 Spike Execution SOP

> Research v3 已落 `2026-06-16-cloud-pro-yanyan-remote-mcp-research.md`。本 SOP 是 spike **实施清单**（顺序敏感，按编号执行）。spike verdict 完成后回填 research doc §15 链路状态。

## 0. 执行前对齐

- ✅ 铲屎官拍 IDP = **One-time PIN**（2026-06-17）
- ✅ 决策 A 默认 = F178 Phase D carry（spike 结果触发条件 → 新 F 号）
- ✅ 决策 B = 现在排（铲屎官 "走起" = 启动 Phase 1 spike）
- 🟡 待铲屎官提供（按 §0.1 安全传递）：CF API token / Account ID / Zone ID（步骤 3 需要）

## 0.1 Secret 传递规范（P0，opus-48 R1 把关）

> **R3 spec doc 真 PAT 事故同类红线**：CF API token 是**账户级 secret**（能写 Access App + DNS）。绝不能：
> - 走聊天消息（thread/message/cross_post 任何形式）
> - 写进 tracked doc / commit / PR description
> - 内联到 curl 命令明文
> - 回显到 47 的 stdout（spike server log / shell echo / Bash 输出）

### 传递路径

> **2026-06-20 修正（铲屎官 verify_before_guessing 抓）**：v1 写的"方案 A: shell env (`export CF_API_TOKEN=...`)"**在 Claude Code Bash 工具下根本无效**——
> - 铲屎官在自己 terminal export → 47 的 Bash 工具是另一个进程，看不到
> - Claude Code Bash 工具 shell state **不跨命令持久**（实测 2026-06-20：command1 `export X=y`，command2 `echo $X` 是空）
>
> 所以**只有 file 路径或 keychain 路径可行**。

**方案 B（推荐）：gitignored file**
```bash
# 铲屎官一次性做（之后跨 shell / 跨 session / 跨进程都能读）
mkdir -p ~/.cloudflared
echo "<paste-token-here>" > ~/.cloudflared/cf-api-token
chmod 600 ~/.cloudflared/cf-api-token
ls -l ~/.cloudflared/cf-api-token  # 验证 -rw------- (0600)
# spike 完后清理
rm ~/.cloudflared/cf-api-token
```

47 调 CF API 时用 `$(cat ~/.cloudflared/cf-api-token)` 引用，token 字符串永远不进 stdout / shell history。

**方案 C（备选，生产级）：macOS Keychain**
```bash
# 铲屎官一次性做
security add-generic-password -a "$USER" -s "cf-api-token-spike" -w "<paste-token>"
# 47 调用
TOKEN=$(security find-generic-password -a "$USER" -s "cf-api-token-spike" -w)
# spike 完后清理
security delete-generic-password -a "$USER" -s "cf-api-token-spike"
```
优势：Keychain 内核级 secret 存储，需要 macOS 用户密码 unlock（额外一层）；劣势：第一次调 `find-generic-password` 弹 unlock 提示，需铲屎官在场确认。

**默认走方案 B**（最简单 + 47 能跨命令稳定读 + 0600 文件权限护栏）。

### 非 secret（可聊天传）
- `CF_ACCOUNT_ID`（公开标识符）
- `CF_ZONE_ID`（公开标识符）

47 调 CF API 时**绝不让 token 字符串出现在**：
- curl 命令行参数（`ps aux` 可见）
- shell history
- Bash 工具输出 / stdout / commit log

### 非 secret（可聊天传）
- `CF_ACCOUNT_ID`（公开标识符）
- `CF_ZONE_ID`（公开标识符）
- 创建后的 `APP_UID` / `AUD claim` / `policy_id`（资源 ID，非 secret）
- `TEAM_DOMAIN`（公开 DNS 标识，如 `<team>.cloudflareaccess.com`）

### 47 自查清单（每条 curl 前）
- [ ] 命令里 token 用 `$CF_API_TOKEN` 而非内联字符串
- [ ] dry-run payload 给铲屎官 review 时，token 位置用 `$CF_API_TOKEN` 占位
- [ ] curl response 里如果含 secret 回显（不应该），用 `jq` 去掉敏感字段再显
- [ ] commit / push 前 grep token shape（`grep -E "[a-zA-Z0-9_-]{40,}"` 大致正则）
- [ ] **结束清理**：spike verdict 完后铲屎官 unset 环境变量 / 删 `cf-api-token` file（CF API token 长期挂着是攻击面）

## 1. 实施清单总览

| # | 谁做 | 内容 | 风险/前置 |
|---|---|---|---|
| 1 | 🐾 47 | 装 deps + 本地跑 spike server (`packages/mcp-server/src/remote-spike.ts`) → 验本机 echo tool 调用 | 不影响公网 |
| 2 | 🐾 47 | 准备 `~/.cloudflared/config.yml` 加 `mcp.clowder-ai.com` ingress route diff，**dry-run 给铲屎官 review**，**不 reload** | 影响生产 cafe.* / api.*（顺序敏感） |
| 3 | 🐾 47 | 用 CF API 创建 Access Application（mcp.clowder-ai.com + PIN login + email allowlist policy），**dry-run payload 给铲屎官 review**，**等他 OK 才 execute** | 需 CF API token + Account ID + Zone ID |
| 4 | 🔴 铲屎官 | CF Zero Trust dashboard：Settings → Auth → Login methods → Add → **One-time PIN**（如果还没启用） | 不可逆少 (可删) |
| 5 | 🐾 47 | (3+4 都完成后) edit config.yml + reload cloudflared + `cloudflared tunnel route dns cat-cafe mcp.clowder-ai.com` | DNS + 生产基建 |
| 6 | 🐾 47 | 公网验证：`curl -I https://mcp.clowder-ai.com/mcp` 应返 401（CF Access 拦截工作） | 验证关键 |
| 7 | 🔴 铲屎官 | ChatGPT Web → Settings → Connectors → Developer mode → Create connector，URL = `https://mcp.clowder-ai.com/mcp`，Auth = OAuth | 个人付费账户 |
| 8 | 🐾 47 + 铲屎官 | 在 ChatGPT 启 conversation 选 cat-cafe connector → 让 ChatGPT 调 echo tool → 验证 OAuth + bearer + cf-jwt 头全到位 → 看 server log + CF Access audit log | 真理时刻 |
| 9 | 🐾 47 | 写 spike verdict 回填 research doc §15 + commit；按 §8 分支决策树推进下一步 | — |

## 2. 步骤详解

### 步骤 1：本地 spike server 自测（47 自决，不影响公网）

```bash
cd /Users/lysander/projects/relay-station/cat-cafe/.claude/worktrees/cloud-pro-yanyan-research
pnpm install --filter @cat-cafe/mcp-server
pnpm --filter @cat-cafe/mcp-server build

# 起 spike server（前台跑，方便看 log）
node packages/mcp-server/dist/remote-spike.js
# 期望输出: [cat-cafe-spike] MCP Streamable HTTP listening on 127.0.0.1:3098

# 另开 terminal 验证 health endpoint
curl -i http://127.0.0.1:3098/health
# 期望: 200 + {"status":"ok","server":"cat-cafe-cloud-pro-spike"}

# 验证 MCP initialize + tools/list
curl -i -X POST http://127.0.0.1:3098/mcp \
  -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"local-test","version":"0.0.1"}}}'
# 期望: 200 + 返 server capabilities

curl -i -X POST http://127.0.0.1:3098/mcp \
  -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'
# 期望: 返 echo tool 定义

# 调 echo tool
curl -i -X POST http://127.0.0.1:3098/mcp \
  -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"echo","arguments":{"text":"hello cat cafe"}}}'
# 期望: {"content":[{"type":"text","text":"echo: hello cat cafe"}]}
```

### 步骤 2：ingress diff（47 dry-run 给铲屎官 review）

**现有 `~/.cloudflared/config.yml`**（48 + 47 查实）：

```yaml
tunnel: 67125a9e-8bca-4969-9fbd-0a7d8dc66832
credentials-file: /Users/lysander/.cloudflared/67125a9e-8bca-4969-9fbd-0a7d8dc66832.json

ingress:
  # API 路径分流：/api/* 和其他 API 路径走 3002
  - hostname: cafe.clowder-ai.com
    path: /api/.*
    service: http://localhost:3002
  - hostname: cafe.clowder-ai.com
    path: /health
    service: http://localhost:3002
  # WebSocket 也需要走 API
  - hostname: cafe.clowder-ai.com
    path: /ws.*
    service: http://localhost:3002
  # 其余走前端
  - hostname: cafe.clowder-ai.com
    service: http://localhost:3001
  # 保留 api 子域名（备用）
  - hostname: api.clowder-ai.com
    service: http://localhost:3002
  - service: http_status:404
```

**diff 加在 `api.clowder-ai.com` 之后、`http_status:404` 之前**（hostname-based 优先匹配，加在 catch-all 前即可，不影响 `cafe.*` `api.*` 现有 rule）：

```diff
   # 保留 api 子域名（备用）
   - hostname: api.clowder-ai.com
     service: http://localhost:3002
+  # F178 Phase D Phase 1 spike — ChatGPT Remote MCP bridge (cloud-pro-phase0)
+  - hostname: mcp.clowder-ai.com
+    service: http://localhost:3098
   - service: http_status:404
```

**安全保证**：
- hostname-based 优先匹配：`mcp.clowder-ai.com` 请求只可能被这条 rule 匹配，不可能被 `cafe.*` `api.*` rule 误吃
- 顺序无关性（hostname 不同就互不影响）：放在哪都行，**但必须在 `http_status:404` 之前**
- 备份：edit 前 `cp ~/.cloudflared/config.yml ~/.cloudflared/config.yml.backup.20260617-spike`

### 步骤 3：CF Access Application（47 用 CF API，需铲屎官 token）

**前提**：

1. 铲屎官在 [Cloudflare Dashboard → My Profile → API Tokens](https://dash.cloudflare.com/profile/api-tokens) 创 token，scope：
   - `Account: Access: Apps Write`
   - `Account: Access: Policies Write`
   - `Zone: DNS Write`（步骤 5 加 CNAME 用）

2. **按 §0.1 安全传递 token**（绝不聊天贴明文）：
   ```bash
   # 方案 B (推荐): gitignored file
   mkdir -p ~/.cloudflared
   echo "<paste-token>" > ~/.cloudflared/cf-api-token
   chmod 600 ~/.cloudflared/cf-api-token
   ```
   ⚠️ shell `export` 在 Claude Code Bash 工具下**无效**（shell state 不跨命令持久 + 跨进程隔离），见 §0.1 v2 修正。

3. 公开标识符（**可聊天传**）：
   - `CF_ACCOUNT_ID`（dashboard 主页右下角）
   - `CF_ZONE_ID`（dashboard → clowder-ai.com 主页右下角）

47 跑（dry-run + 铲屎官 OK + execute；**token 永远引用 `$CF_API_TOKEN`，绝不内联**）：

```bash
# 1. Create Access Application (mcp.clowder-ai.com)
curl -X POST "https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/access/apps" \
  -H "Authorization: Bearer ${CF_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Cat Cafe Cloud Pro MCP",
    "domain": "mcp.clowder-ai.com",
    "type": "self_hosted",
    "session_duration": "24h",
    "allowed_idps": ["__pin__"],
    "auto_redirect_to_identity": false
  }'
# 期望: 返 APP_UID + AUD claim → 记下两个值

# 2. Add Allow policy (email allowlist = lysander@gmail.com)
curl -X POST "https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/access/apps/${APP_UID}/policies" \
  -H "Authorization: Bearer ${CF_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Allow lysander only",
    "decision": "allow",
    "include": [
      { "email": { "email": "lysander@gmail.com" } }
    ],
    "session_duration": "24h"
  }'
# 期望: 返 policy_id

# 3. 记下 team domain (Zero Trust → Settings → General → Team domain)
# 形如: <team-name>.cloudflareaccess.com
```

**注意 PIN as login method 的前置**：CF Access 默认就开 One-time PIN（无需额外配置），上述 `"allowed_idps": ["__pin__"]` 表示只允许 PIN。若 dashboard 显示 PIN 未启用，铲屎官需先在 Settings → Auth → Login methods 加（步骤 4）。

### 步骤 4：CF Dashboard 确认 PIN 启用（铲屎官做）

URL: https://one.dash.cloudflare.com/{account-id}/access/auth-flow/login-methods

- 若已显示 "One-time PIN" → 跳过
- 若未显示 → 点 "Add" → 选 "One-time PIN" → 确认（CF 默认配置即可）

### 步骤 5：reload + DNS CNAME（47 在步骤 2、3、4 都完成后做）

```bash
# 5.1 备份 config
cp ~/.cloudflared/config.yml ~/.cloudflared/config.yml.backup.20260617-spike

# 5.2 加 ingress route（按步骤 2 的 diff）
# 用 sed 或手动 edit, dry-run 给铲屎官看 diff 后 execute

# 5.3 加 DNS CNAME
cloudflared tunnel route dns cat-cafe mcp.clowder-ai.com
# 期望: "Added CNAME mcp.clowder-ai.com → 67125a9e-...cfargotunnel.com"

# 5.4 reload cloudflared
sudo launchctl kickstart -k system/com.cloudflare.cloudflared
# 或 brew services restart cloudflared

# 5.5 等 cloudflared 启动（~5s），看 log 确认 ingress 加载
tail -n 20 /var/log/cloudflared.log  # 路径视安装方式而定
# 期望: 看到 "Updated to new configuration" + 4 ingress rules
```

### 步骤 6：公网验证 CF Access 拦截工作（47 做）

```bash
# spike server 必须先在本地起来（步骤 1）
# 没起 server → 502; 起了 server 但无 JWT → 401

# 6.1 缺 JWT → 应返 CF Access 401（HTML 登入页）
curl -I https://mcp.clowder-ai.com/mcp
# 期望: 302 redirect to <team>.cloudflareaccess.com/cdn-cgi/access/login/mcp.clowder-ai.com
# 或: 401 + Location 头跳到 CF Access login

# 6.2 浏览器访问 https://mcp.clowder-ai.com/mcp
# 期望: 跳到 CF Access login 页，输入 lysander@gmail.com → 收 PIN 邮件 → 输 PIN → 跳回 → 看到 405 (method not allowed, 因为 GET /mcp 不支持)
# 这步证明: CF Access 拦截 + PIN 通过 + 后端到达
```

### 步骤 7：ChatGPT 创建 connector（铲屎官做）

1. ChatGPT Web → Settings → Connectors
2. 点 "Developer Mode" 启用（如果还没启用）
3. "Create connector"
4. URL: `https://mcp.clowder-ai.com/mcp`
5. Authentication: **OAuth**（让 ChatGPT 自动探测 CF Access 的 OAuth discovery）
6. 点 "Connect" → 应弹出 CF Access login → 用 lysander@gmail.com + PIN 完成 OAuth
7. 完成后 ChatGPT 应显示 connector "已连接" + 列出 1 个工具（echo）

### 步骤 8：联手实测 echo tool（真理时刻）

铲屎官在 ChatGPT 启新 conversation → 选 cat-cafe connector → 让 ChatGPT 调 echo tool（提问："用 echo 工具回 hello"）。

**47 同时看**：
- spike server log（应看到 POST /mcp + cf-jwt=present + auth=present）
- CF Access audit log（Zero Trust → Logs → Access）

**验证矩阵**：
| 项 | 期望 | 通过 |
|---|---|---|
| ChatGPT OAuth 流程完整跑通 | 用户登 CF Access OAuth → ChatGPT 拿到 token | ☐ |
| `Authorization: Bearer <cf-jwt>` 头注入 | spike server log 显示 `auth=present` | ☐ |
| `Cf-Access-Jwt-Assertion` 头注入 | spike server log 显示 `cf-jwt=present` | ☐ |
| `tools/list` 返 echo | ChatGPT UI 显示 1 个工具 | ☐ |
| `tools/call echo` 调用成功 | ChatGPT 显示 "echo: hello" | ☐ |
| 缺 JWT → 401（控制对照） | 直接 curl POST /mcp 无 JWT → 401 | ☐ |
| 非 allowlist email 试 → 拒 | 用别的 Google 账号登 CF Access → 不允许 | ☐ |

### 8.5 中期 verify 矩阵（2026-06-20 spike 跑完 + 48 R1/R2 把关 后）

> **48 R2 P0 校正（2026-06-20 23:15 PT）**：47 写 "Path A ✅ VERIFIED via simpler path" 是 **confabulation**。
>
> 实测验证的是 **MCP transport 基础层**（ChatGPT connector ↔ Streamable HTTP ↔ echo 工具调用通），路径是 **No Auth + cloudflared quick tunnel + CodexPro 风格**。
>
> **Path A（CF Access OAuth + agent-key）的 auth 层一行没验证** — 被 No Auth 路径绕过。
>
> 48 R1 那个 302 vs 401 悬念**不是被回答，是被绕过**。CF Access OAuth ↔ ChatGPT 兼容性仍 **0% 验证**。
>
> 准确表述：
> - ✅ MCP transport 可行性 VERIFIED（Path A/B/C/D 共同基础层）
> - ⚠️ Path A auth 层（CF Access OAuth）**未验证**，被 No Auth 绕过
> - ⚠️ Path A' 最小 OAuth proxy 也未验证
> - 这些悬念真上 production 长期挂前必须 verify


| # | 项 | 47 实测结果 | 48 R1 校准 | 状态 |
|---|---|---|---|---|
| 0 | Token / Account / Zone / Access scope | ✅ 4 项 GET 通过 | — | ✅ |
| 1 | CF Access Application 创建（APP_UID + AUD） | ✅ APP_UID `e512c9e8...`, AUD `71cd1b28...` | — | ✅ |
| 2 | Email allowlist Policy 创建 | ✅ allow include email lysander@gmail.com | — | ✅ |
| 3 | DNS CNAME `mcp.clowder-ai.com` → tunnel | ✅ `cloudflared tunnel route dns` | — | ✅ |
| 4 | `/.well-known/oauth-protected-resource/mcp` 探测 | ✅ www-authenticate header 含 resource_metadata URL | ✅ 48 独立 GET 拿到 200 + payload `{"resource":..., "authorization_servers":["https://clowder-ai.cloudflareaccess.com"]}` | ✅ |
| 5 | CF Access AS metadata（authorization/token endpoints + DCR + PKCE） | (未单独 verify) | ✅ 48 拿到 200，含 `registration_endpoint` + `code_challenge_methods_supported` + authorization/token/revocation 全在 | ✅ |
| 6 | DCR（Dynamic Client Registration） | 待 ChatGPT 实测 | ✅ **48 提前 verify**——AS metadata 有 `registration_endpoint` | ✅（AS 侧 ready） |
| 7 | PKCE | 待 ChatGPT 实测 | ✅ **48 提前 verify**——AS metadata 有 `code_challenge_methods_supported` | ✅（AS 侧 ready） |
| 8 | **WWW-Authenticate 401 challenge** | ⚠️ **47 标 ✅ 是错的（48 改判）**——header 存在，但 status 是 **302** 不是 spec 要求的 **401** | ⚠️ MCP/OAuth 2.1 spec 要求**401 + WWW-Authenticate**；CF 给的是 **302 + WWW-Authenticate 塞进 302**（非标准）。caveat：48 的 curl 不带 ChatGPT 真实请求特征（UA/Accept/OAuth flow），CF 可能对 ChatGPT 走不同分支 | ⚠️ 待 ChatGPT 实测定论 |
| 9 | ChatGPT 真实 OAuth flow | 待铲屎官 dashboard 加 ingress + ChatGPT connector 创建 | — | ⚠️ |
| 10 | tools/call echo 调用 | 待真实 ChatGPT 流程 | — | ⚠️ |

### 8.6 真理时刻收敛（48 R1）

48 把"3/5 + 95%"风险评估收敛成**一个二元问题**：

> **ChatGPT connector 能不能消费 CF Access 的「302 + WWW-Authenticate: resource_metadata」非标准 challenge？**
>
> - **能** → 拿到 resource_metadata → 走 AS（DCR + PKCE 都支持）→ 全通 ✅
> - **不能**（严格等 401 / 严格探标准路径）→ 跟随 302 拿到 HTML login → discovery 断 ❌

ChatGPT connector 实测时盯的信号：
- ✅ 成功：跳到 CF Access PIN login 页 = 它消费了 challenge
- ❌ 失败：报 "couldn't load / invalid metadata / unexpected HTML" = 它不认 302

### 8.6.5 production 真接 toolset 的 P0 安全门（48 R2 把关）

> **48 R2 P0**：spike 通过 echo 工具时**暴露面零内容**（echo input 是用户自己发的）。真接 cat-cafe toolset 后**暴露面 = 整个项目知识库 + 铲屎官私密**：

| 暴露内容 | 来源 |
|---|---|
| user_health_heart_check | 铲屎官心脏就诊记录 |
| user_google_internship | Georgetown 期间 Google 实习经历 |
| 内部架构决策 / lessons-learned | docs/decisions/ / lessons-learned.md |
| Teammate dossier | 每只猫的强弱画像 |
| 项目源码索引 | search_evidence 命中代码片段 |

**"只读" ≠ "低风险"** — 这是隐私 + 内部 IP。

#### P0 安全要求（production 接 toolset 必须满足，不可降级）

- ❌ **token-in-URL 不够**：URL 进 CF quick tunnel log + ChatGPT connector 配置 + OpenAI 端历史。OWASP 明确反对 secret-in-URL（同 R3 token 写 tracked doc 的同类病——secret 别走会被记录的通道）
- ❌ **No Auth + random URL = security-through-obscurity**，不是 access control。任何拿到 URL+token 的人 = 砚砚同权限
- ✅ **必须真 auth**：
  - 选项 1：CF Access OAuth（先 verify 兼容 ChatGPT，48 R1 那个 302 vs 401 悬念实测定论）
  - 选项 2：header-token（如果 ChatGPT connector 有 No Auth 之外的 header-auth 模式，token 走 `Authorization: Bearer` 不进 URL）

#### Phase 1.5 待查（实测必须先做）

**ChatGPT connector 的认证选项里，No Auth 之外有没有能带 header 的模式（API Key / Bearer）？**

- 有 → token 走 `Authorization` header（强，不进 URL），简版可行
- 没有 → token 只能进 URL（弱）→ production 简版必须：
  - ① 收窄不暴露敏感记忆工具（如只暴露 health check / mock tools），或
  - ② 上真 CF Access OAuth（验证 ChatGPT 兼容性后）

**实测方式**：铲屎官 ChatGPT 创 connector 时截图 "身份验证" 下拉看所有选项；或者去 OpenAI Apps SDK 官方 doc 查。

### 8.7 Fallback（如 ChatGPT 不消费 302 challenge）

**不退回路径 B/C** — Cloudflare 2025 推出 **MCP Server Portals**，**专为 MCP client 返 401 而非 302 redirect**。failure case → 方向：

1. 把手搓 Access Application 替换为 MCP-aware Portal 配置
2. CF Portal 自带 MCP discovery 正确 status code
3. 仍在 Path A 框架内（CF Tunnel + CF Access + Google/PIN IDP），只是 application type 换

CF MCP Server Portals 是 Open Beta（≤50 seats free），所以这是无成本回退路径。如 Portal 也不通 → **才**触发新 F 号开自建 OAuth proxy（KD-R13）。

### 步骤 9：spike verdict 落 research doc

47 把验证结果写入 research doc §15 链路状态：

```
- spike v4: 2026-06-17 spike 实测 verdict
  - ChatGPT OAuth shape 兼容 CF Access: [✅ / ⚠️ / ❌]
  - cf-jwt 头注入: [✅ / ❌]
  - echo tool 调用: [✅ N round-trips / ❌]
  - 失败场景控制对照: [全 401 / 漏]
  - 分支决策: [Path A 落地 / 加最小 OAuth proxy / 触发新 F 号]
```

按分支决策推进：
- ✅ → 把 `remote-spike.ts` rename `remote.ts` + 加 JWT 验签 + 接 collab/memory toolsets + agent-key principal → spec 阶段
- ⚠️ → 加最小 OAuth proxy spike 重跑
- ❌ → 停手，cross_post 主 thread 要 CVO 签字开新 F 号

## 3. 应急 / 回滚

| 场景 | 回滚动作 |
|---|---|
| ingress 改坏，cafe.clowder-ai.com 挂了 | `cp ~/.cloudflared/config.yml.backup.20260617-spike ~/.cloudflared/config.yml && sudo launchctl kickstart -k system/com.cloudflare.cloudflared` |
| CF Access App 配错 | `curl -X DELETE "https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/access/apps/${APP_UID}" -H "Authorization: Bearer ${CF_API_TOKEN}"` |
| DNS CNAME 加错 | CF Dashboard → clowder-ai.com → DNS → 删 mcp 记录 |
| ChatGPT connector 卡 OAuth | ChatGPT Settings → Connectors → 删 cat-cafe connector，重新创建 |
| spike server 卡死 | Ctrl-C 或 `lsof -i :3098 | grep node | awk '{print $2}' | xargs kill -TERM` |

## 4. 铲屎官现在需要给的（步骤 3-4-7-8 触发）

1. **CF API Token**（按步骤 3 的 scope）→ 47 做步骤 3
2. **CF Account ID**（dashboard 主页右下角）→ 47 做步骤 3
3. **CF Zone ID for clowder-ai.com**（CF Dashboard → clowder-ai.com 主页右下角）→ 47 做步骤 3、5
4. **PIN login method 启用确认**（步骤 4，30 秒）
5. （步骤 1-6 完成后）**ChatGPT connector 创建**（步骤 7）
6. **echo tool 实测**（步骤 8，联手）

token + ID 给我之后，47 把步骤 2、3 dry-run 出来给你最后过一遍，OK 了再 execute 步骤 5、6。

## 5. 启动顺序（关键安全保证）

**绝对不能让 `mcp.clowder-ai.com` DNS 可解析 + 公网 reachable，但 CF Access App 没就位**——会有一段公网裸奔窗口。

正确顺序：
```
步骤 1 (本地 spike server) — 不影响公网，先做
步骤 2 (准备 ingress diff)  — 不动配置，先做
步骤 3 (创建 CF Access App + policy)  — 防线先就位
步骤 4 (确认 PIN login method) — IDP 就位
=== 公网防线全就位，可以暴露 endpoint ===
步骤 5 (edit config.yml + reload + 加 DNS CNAME)  — 此时 endpoint 公网可见，但 CF Access 拦截
步骤 6 (curl 验证拦截工作)
步骤 7 (ChatGPT 创 connector)
步骤 8 (实测 echo)
```

**如果中途回滚**：步骤 5 出问题立即用 config.yml.backup 恢复 + 删 DNS CNAME。

[宪宪/Opus-4.7🐾]
