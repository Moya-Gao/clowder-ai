# CLI/OAuth 调用方式研究报告

> **研究日期**: 2026-02-05
> **研究者**: 布偶猫 (Opus)
> **目的**: 为 Phase 2.5 SDK → CLI 迁移找到最佳方案

---

## 1. 研究背景

Phase 2 使用 SDK 模式调用三只猫，但发现 SDK 只能用 API key，不能用订阅额度。需要研究如何用 CLI/OAuth 方式调用，以便使用：
- Claude Max plan x20
- ChatGPT Plus/Pro
- Antigravity Pro

---

## 2. 布偶猫 (Claude) 调用方案

### 2.1 CLI 调用 ✅ 推荐

```bash
claude -p "prompt" \
  --output-format stream-json \
  --allowedTools Read,Edit,Glob,Grep \
  --permission-mode acceptEdits \
  --resume <session-id>
```

**认证**: 已登录的 Max plan 账号
**Agent 能力**: ✅ 完整（文件操作、工具调用）
**Session Resume**: ✅ 支持 `--resume`

### 2.2 OAuth 方案（OpenClaw 风格）

OpenClaw 提供了 token-based 方案：
- 运行 `claude setup-token` 生成 token
- 用 token 认证消费订阅配额
- **限制**: "This credential is only authorized for use with Claude Code"

还有 `claude-oauth-refresher` skill（macOS 专用）自动刷新 token。

**结论**: CLI 方案更简单直接，推荐使用。

---

## 3. 缅因猫 (Codex) 调用方案

### 3.1 CLI 调用 ✅ 推荐

```bash
# 新 session
codex exec --json --sandbox workspace-write --full-auto "prompt"

# Resume session
codex exec resume <session-id> "prompt" --json --full-auto
```

**认证**: 已登录的 ChatGPT Plus/Pro 账号
**Agent 能力**: ✅ 完整（文件操作、沙箱执行）
**Session Resume**: ✅ 支持 `exec resume`

**参数兼容性备注（2026-02-05）**：
- 当前环境的 `codex exec --help` 不支持 `--approval-mode`
- 自动化建议使用 `--full-auto`（并保持 `--sandbox workspace-write`）

**结论**: CLI 方案直接可用。

---

## 4. 暹罗猫 (Gemini/Antigravity) 调用方案

### 4.1 Gemini CLI

```bash
gemini -p "prompt" --output-format stream-json --yolo
```

**认证**: Google 账号 OAuth（支持 AI Pro/Ultra 订阅）
**Agent 能力**: ⚠️ 有限（铲屎官反馈"不好用"）
**Session Resume**: 待确认

### 4.2 Antigravity IDE

Antigravity 是 Google 的 Agentic IDE，提供完整的 Agent 能力，但：
- **不是 CLI 工具**，是 IDE
- 没有官方的 headless/programmatic API
- 社区方案需要额外代理服务

### 4.3 社区方案：antigravity2api-nodejs

GitHub: [Akash777-ctrl/antigravity2api-nodejs](https://github.com/Akash777-ctrl/antigravity2api-nodejs)

**原理**：
1. 代理服务用 Google OAuth 认证 Antigravity
2. 提供 OpenAI 兼容的 API（`/v1/chat/completions`）
3. 自动转换请求/响应格式

**设置**：
```bash
npm install
npm run login  # Google OAuth
npm start      # 运行在 localhost:8045
```

**API 调用**：
```typescript
// OpenAI 兼容格式
const response = await fetch('http://localhost:8045/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer sk-antigravity',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'gemini-3-pro',
    messages: [{ role: 'user', content: 'Hello' }],
    stream: true
  })
});
```

**局限**：
- ⚠️ 只是 chat completions API，不是完整 Agent 能力
- ⚠️ 需要运行额外的代理服务
- ⚠️ 需要手动 OAuth 登录

### 4.4 社区方案：opencode-antigravity-auth

GitHub: [NoeFabris/opencode-antigravity-auth](https://github.com/NoeFabris/opencode-antigravity-auth)

**原理**：
1. OpenCode 插件
2. 用 Google OAuth 认证 Antigravity
3. 支持多账号轮换
4. 可以访问 `gemini-3-pro` 和 `claude-opus-4-5-thinking`

**调用方式**：
```bash
opencode auth login  # Google OAuth
opencode run "Hello" --model=google/antigravity-gemini-3-pro
```

**局限**：
- ⚠️ OpenCode 已 archived（移到 "Crush" 项目）
- ⚠️ 依赖 OpenCode 生态
- ⚠️ 违反 Google ToS 的风险警告

### 4.5 暹罗猫方案对比

| 方案 | Agent 能力 | 认证 | 复杂度 | 风险 |
|------|-----------|------|--------|------|
| Gemini CLI | ⚠️ 有限 | Google OAuth | 低 | 低 |
| antigravity2api-nodejs | ⚠️ Chat only | Google OAuth | 中 | 中 |
| opencode-antigravity-auth | ✅ 完整 | Google OAuth | 高 | 高（ToS） |
| Antigravity IDE 手动 | ✅ 完整 | Google 账号 | N/A | N/A |

---

## 5. 研究结论

### 5.1 布偶猫和缅因猫：方案明确 ✅

- **Claude**: `claude -p` CLI，用 Max plan
- **Codex**: `codex exec` CLI，用 ChatGPT Plus/Pro

### 5.2 暹罗猫：Phase 2.5 方案已确定（双 Adapter） ✅

**决策**：
1. **主力**：`antigravity-desktop`（半自动，本地 GUI）
2. **fallback**：`gemini-cli`（全自动/headless，用于 CI/远程）

**理由**：
1. 纯 headless 无法获得 Antigravity IDE 的完整 agent 工作流
2. `antigravity chat --mode agent` 可唤醒本地 IDE，并通过 MCP 回传结果
3. `gemini-cli` 提供部署场景的自动化兜底

### 5.3 实施前提（必须满足）

1. 由 Cat Café 后端下发 `invocationId + callbackToken`，用作 MCP 回传关联与鉴权
2. 暹罗猫回传不走 CLI stdout，统一走 `cat_cafe.post_message`
3. token 设置短 TTL，并在后端审计所有回传事件

---

## 6. 参考链接

### 官方文档
- [Gemini CLI Headless Mode](https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/headless.md)
- [Gemini CLI Authentication](https://github.com/google-gemini/gemini-cli/blob/main/docs/get-started/authentication.md)
- [Google Antigravity](https://developers.googleblog.com/build-with-google-antigravity-our-new-agentic-development-platform/)

### 社区项目
- [antigravity2api-nodejs](https://github.com/Akash777-ctrl/antigravity2api-nodejs)
- [opencode-antigravity-auth](https://github.com/NoeFabris/opencode-antigravity-auth)
- [OpenClaw Authentication](https://docs.openclaw.ai/gateway/authentication)

### 相关文章
- [Choosing Antigravity or Gemini CLI](https://cloud.google.com/blog/topics/developers-practitioners/choosing-antigravity-or-gemini-cli)
- [Google Antigravity AI IDE 2026](https://www.baytechconsulting.com/blog/google-antigravity-ai-ide-2026)

---

*布偶猫备注（v3.1）：暹罗猫路线从“待定”更新为“已定双 adapter”，但要严格依赖 MCP 回传鉴权与线程关联。*
