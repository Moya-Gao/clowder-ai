---
id: LL-chatgpt-mcp-auth-limits
date: 2026-06-21
authors: [opus-47 (宪宪)]
trigger: 铲屎官 2026-06-21 05:06 UTC 截图实证 ChatGPT MCP 创建表单缺 Custom Headers
context: F247 Phase B1a 砚砚云端 ChatGPT 接入实测真理时刻
related_features: [F247, F178]
severity: P0 (设计约束 — 影响 F247 全部 auth 路径选择)
sources:
  - https://developers.openai.com/apps-sdk/build/auth (2026-06-21 fetched)
---

# LL: ChatGPT 自定义 MCP Connector Auth 硬限制

## 实测发现

铲屎官 2026-06-21 05:06 UTC 在 ChatGPT 端"添加自定义连接"对话框看到的字段：
- 名称、描述
- 连接（dropdown: 服务器 URL / 通道）
- URL（placeholder: `https://example.com/sse`）
- **身份验证**（dropdown: 未授权 / OAuth）

**没有 Custom Headers 字段**。

## OpenAI 官方文档实证

源：https://developers.openai.com/apps-sdk/build/auth（fetch verbatim 2026-06-21 05:13 UTC）

### ChatGPT MCP custom connector **支持**

1. **OAuth 2.1** (主要)
   - Authorization code flow with PKCE
   - Client ID Metadata Documents (CIMD)
   - Dynamic Client Registration (DCR)
   - Token endpoint auth: `none` / `private_key_jwt`

2. **mTLS** — OpenAI-managed client certificates (transport 层)

3. **Bearer Tokens** — `Authorization: Bearer <token>`，但 **token 必须从 OAuth flow 拿到**

### ChatGPT MCP custom connector **不支持**

引用文档原文：
> "ChatGPT does not support machine-to-machine OAuth grants such as client credentials,
> service accounts, or JWT bearer assertions, nor can it present custom API keys or
> customer-provided mTLS certificates."

- ❌ Custom HTTP headers（包括 `CF-Access-Client-Id` 类）
- ❌ Machine-to-machine OAuth grants
- ❌ Service tokens / API keys 客户提供
- ❌ 客户自带 mTLS certs

## F247 设计影响

### B1a interim 设计修正

| Auth 路径 | 修正前（错）| 修正后（实测对）|
|---|---|---|
| 公网 endpoint auth | CF Access service token + 2 个 custom headers | CF Access 不挂 / 删除 App，spike `?token=` 单防线 |
| ChatGPT connector 配置 | URL + Custom Headers (2 个) | URL only (token 嵌在 query) + "未授权" 选项 |

### B1b production 路径锁定

B1b 必须走 **CF Access OAuth 2.1 (Authorization code + PKCE)**：
- CF Access App 配 OIDC IDP (Google 或自建)
- ChatGPT MCP connector "身份验证" dropdown 选 OAuth
- 铲屎官浏览器 OAuth 一次，ChatGPT 端拿 Bearer token 后续自动用

**B1b OQ 仍未 verify**：ChatGPT MCP OAuth client 是否兼容 CF Access OAuth shape（CF 用的 IDP / well-known endpoint / scope 字段名）。需要 dashboard 配 OAuth IDP + 实测 + 不通则 push back 找 workaround。

## 教训

### 1. 服务接入前先 fetch vendor 官方 auth 文档

我之前 push back 时已提"ChatGPT MCP UI 不确定是否支持 custom header"，但**没立刻 WebFetch 官方文档 verify**，浪费铲屎官 15 分钟去 dashboard 加 token scope + mint service token + 配 policy，全部白做（最后还要 revoke）。

**反射纪律**：任何 vendor 接入决策前**必须先 fetch 官方文档**，不靠脑补：
```
WebFetch URL prompt="What auth methods does X support? List exact methods..."
```

Provenance 记 LL 不靠记忆。

### 2. ChatGPT vs Claude MCP 客户端差异

| 客户端 | Custom Headers 支持 | 备注 |
|---|---|---|
| Claude Desktop / Code | ✅ 支持（MCP config）| 我们日常用的 |
| Claude API | ✅ Bearer / API key 任意 | 程序化 |
| **ChatGPT Custom MCP Connector** | ❌ 不支持 | OAuth 2.1 / Bearer-via-OAuth only |
| Codex CLI | ✅ 支持 | OpenAI 但走 CLI 不走 ChatGPT |

不能假设"X 家 LLM 都支持 Y auth"，每个 connector 客户端有独立 UI 限制。

### 3. CF Access service token 路径 ≠ B1a 唯一选项

之前我以为 service token 是 "production-grade 不动 OAuth policy" 的优选路径，但 ChatGPT 端不接受 custom headers → service token 在这场景**无用**。

B1a interim 设计本来就允许**只用 spike server 自己的 token 防线**（F247 KD-7 + AC-B1-7），不需要 CF Access 兜底。复杂度更低，验证更快。

### 4. 用户实测 > 文档推断

铲屎官实测截图证据 > 我对 ChatGPT UI 的脑补。当用户报告 "找不到 X 字段"，**先信用户**，不要假设他没看仔细。

## 沉淀

- ✅ `cat-cafe-skills/refs/chatgpt-cloud-onboarding-guide.md` §1.2.5 加 P0 硬限制小节
- ✅ §4.3 改写为 "不挂 CF Access App" + 残留删除指引
- ✅ §6 E2E test 简化为 3 项（去除 CF Access headers 步骤）
- ✅ §7 ChatGPT 配置只剩 URL + "未授权"
- ✅ F247 §10 KD-7 spike server 单防线设计与 B1a interim 一致
- ✅ docs/discussions/2026-06-21-chatgpt-tasks-mcp-verify.md 同款 待验证 vs 实测纪律

## 推广

凡是接入第三方 MCP / API / LLM 客户端前的 reflex：

1. WebFetch 官方 auth doc → list 支持方法
2. 实测 UI → screenshot 加 verify
3. 不要靠 "general LLM auth common pattern" 脑补
4. **铲屎官报告 UI 异常 → 信任 + 帮忙 fetch 文档实证，不 push back 让他多翻几次**

[宪宪/Opus-4.7🐾]
