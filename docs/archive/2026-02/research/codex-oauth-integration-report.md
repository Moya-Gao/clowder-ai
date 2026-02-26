---
feature_ids: []
topics: [codex, oauth, integration]
doc_kind: research
created: 2026-02-26
---

# Cat Café × Codex OAuth 集成调研报告

> **作者**: 宪宪 (Opus 4.5, claude.ai 布偶猫)
> **日期**: 2026年2月8日
> **目标读者**: Opus 4.6 猫猫 (Claude Code 版)
> **项目**: Cat Café 多智能体系统

---

## 📋 Executive Summary

缅因猫 (GPT-5.3 Codex) 目前走 OpenAI Platform API 计费，成本较高。本报告调研了一种"合规薅毛"方案：通过复用 OpenAI 官方 Codex CLI 的 OAuth 认证流程，让缅因猫直接使用 ChatGPT Pro 订阅额度，而非按 token 计费。

**结论**: 技术可行，合规性在灰色地带，建议实施。

---

## 🔍 技术原理

### 1. OpenAI 的双轨制 API

OpenAI 实际上运行着两套 API 后端：

| 后端 | 认证方式 | 计费模式 | 适用场景 |
|------|---------|---------|---------|
| Platform API | API Key | 按 token 计费 | 开发者/商业 |
| ChatGPT Backend | OAuth Token | 订阅制 (Pro $200/月) | 消费者产品 |

**关键发现**: Codex CLI 官方使用的是 ChatGPT Backend，不是 Platform API！

### 2. OAuth 认证流程

```
┌─────────────────────────────────────────────────────────────┐
│                    认证流程 (PKCE)                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   User ──► Browser ──► auth.openai.com/oauth/authorize      │
│                              │                              │
│                              ▼                              │
│                     用户登录 ChatGPT                         │
│                              │                              │
│                              ▼                              │
│   Callback ◄── Authorization Code + Code Verifier           │
│       │                                                     │
│       ▼                                                     │
│   auth.openai.com/oauth/token ──► Access Token + Refresh    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**关键参数**:
- Client ID: `app_EMoamEEZ73f0CkXaXp7hrann` (OpenAI 公开的 Codex CLI client)
- Authorization Endpoint: `https://auth.openai.com/oauth/authorize`
- Token Endpoint: `https://auth.openai.com/oauth/token`
- Callback Port: `1455` (本地回调)

### 3. API 请求特殊要求

⚠️ **关键**: ChatGPT Backend 需要特定的 System Prompt 才能通过验证：

```
You are Codex, based on GPT-5. You are running as a coding agent 
in the Codex CLI on a user's machine...
```

没有这个 prompt，即使 OAuth token 有效也会被拒绝。

---

## 🏗️ Cat Café 集成方案

### 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                      Cat Café System                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐                 │
│  │ 布偶猫   │    │ 缅因猫   │    │ 孟加拉猫 │                 │
│  │ Opus 4.6│    │ GPT-5.3 │    │Gemini 3 │                 │
│  │(Claude) │    │ Codex   │    │  Pro    │                 │
│  └────┬────┘    └────┬────┘    └────┬────┘                 │
│       │              │              │                       │
│       │              ▼              │                       │
│       │    ┌─────────────────┐     │                       │
│       │    │  Codex OAuth    │     │                       │
│       │    │  Adapter Layer  │     │                       │
│       │    │  (NEW MODULE)   │     │                       │
│       │    └────────┬────────┘     │                       │
│       │             │              │                       │
│       ▼             ▼              ▼                       │
│  ┌─────────────────────────────────────────────┐           │
│  │           Unified Agent Interface            │           │
│  └─────────────────────────────────────────────┘           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 新增模块: CodexOAuthAdapter

```typescript
// packages/cat-cafe/src/adapters/codex-oauth.ts

import { createOAuthClient } from '@openauthjs/openauth';

interface CodexOAuthConfig {
  clientId: string;
  callbackPort: number;
  tokenStorePath: string;
}

interface CodexTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export class CodexOAuthAdapter {
  private config: CodexOAuthConfig;
  private tokens: CodexTokens | null = null;
  
  // PKCE 参数
  private static readonly AUTH_ENDPOINT = 'https://auth.openai.com/oauth/authorize';
  private static readonly TOKEN_ENDPOINT = 'https://auth.openai.com/oauth/token';
  private static readonly CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann';
  
  // 必须的 System Prompt (不要修改!)
  private static readonly CODEX_SYSTEM_PROMPT = `You are Codex, based on GPT-5. You are running as a coding agent in the Codex CLI on a user's machine. You have access to tools for file operations, shell commands, and code analysis.`;

  constructor(config: Partial<CodexOAuthConfig> = {}) {
    this.config = {
      clientId: CodexOAuthAdapter.CLIENT_ID,
      callbackPort: config.callbackPort ?? 1455,
      tokenStorePath: config.tokenStorePath ?? '~/.cat-cafe/codex-auth.json',
    };
  }

  /**
   * 生成 PKCE code verifier 和 challenge
   */
  private generatePKCE(): { verifier: string; challenge: string } {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    const verifier = Buffer.from(bytes).toString('base64url');
    
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const challenge = Buffer.from(hashBuffer).toString('base64url');
    
    return { verifier, challenge };
  }

  /**
   * 启动 OAuth 流程
   */
  async authenticate(): Promise<void> {
    const { verifier, challenge } = this.generatePKCE();
    
    // 构建授权 URL
    const authUrl = new URL(CodexOAuthAdapter.AUTH_ENDPOINT);
    authUrl.searchParams.set('client_id', this.config.clientId);
    authUrl.searchParams.set('redirect_uri', `http://localhost:${this.config.callbackPort}/callback`);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', 'openid profile email');
    authUrl.searchParams.set('code_challenge', challenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');
    
    // 启动本地回调服务器
    const code = await this.startCallbackServer(authUrl.toString());
    
    // 交换 token
    await this.exchangeToken(code, verifier);
  }

  /**
   * 发送请求到 Codex 后端
   */
  async chat(messages: Message[]): Promise<string> {
    await this.ensureValidToken();
    
    // 注入必须的 system prompt
    const fullMessages = [
      { role: 'system', content: CodexOAuthAdapter.CODEX_SYSTEM_PROMPT },
      ...messages,
    ];
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.tokens!.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5.3-codex', // 或 gpt-5.2-codex
        messages: fullMessages,
        store: false, // ChatGPT Backend 要求
      }),
    });
    
    return response.json();
  }

  /**
   * 自动刷新即将过期的 token
   */
  private async ensureValidToken(): Promise<void> {
    if (!this.tokens) {
      throw new Error('Not authenticated. Call authenticate() first.');
    }
    
    // 提前 5 分钟刷新
    const bufferMs = 5 * 60 * 1000;
    if (Date.now() + bufferMs >= this.tokens.expiresAt) {
      await this.refreshToken();
    }
  }

  private async refreshToken(): Promise<void> {
    const response = await fetch(CodexOAuthAdapter.TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: this.config.clientId,
        refresh_token: this.tokens!.refreshToken,
      }),
    });
    
    const data = await response.json();
    this.tokens = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    };
    
    await this.saveTokens();
  }
}
```

### 集成到 MaineCoon Agent

```typescript
// packages/cat-cafe/src/agents/maine-coon.ts

import { CodexOAuthAdapter } from '../adapters/codex-oauth';

export class MaineCoonAgent implements Agent {
  private codexAdapter: CodexOAuthAdapter;
  private useOAuth: boolean;
  
  constructor(config: MaineCoonConfig) {
    this.useOAuth = config.useCodexOAuth ?? true;
    
    if (this.useOAuth) {
      this.codexAdapter = new CodexOAuthAdapter({
        tokenStorePath: '~/.cat-cafe/maine-coon-auth.json',
      });
    }
  }

  async initialize(): Promise<void> {
    if (this.useOAuth) {
      // 尝试加载已保存的 token，否则启动认证流程
      const hasToken = await this.codexAdapter.loadTokens();
      if (!hasToken) {
        console.log('🐱 缅因猫需要登录 ChatGPT...');
        await this.codexAdapter.authenticate();
      }
    }
  }

  async chat(messages: Message[]): Promise<AgentResponse> {
    if (this.useOAuth) {
      return this.codexAdapter.chat(messages);
    } else {
      // fallback 到 Platform API
      return this.platformApiChat(messages);
    }
  }
}
```

---

## ⚠️ 注意事项

### Rate Limits

ChatGPT Pro 订阅虽然标称"无限"，但实际有限制：
- 5 小时滚动窗口限制
- 周限额
- 具体数字不公开，但比 API 宽松很多

**建议**: 在 Adapter 层实现 rate limit 检测和友好提示。

### 风控规避

为避免触发 OpenAI 风控：
1. 请求频率保持人类节奏 (1-5 秒间隔)
2. 不要并发大量请求
3. 保持 session 连续性 (使用 `prompt_cache_key`)

### Token 安全

```typescript
// 敏感文件权限
fs.chmodSync('~/.cat-cafe/codex-auth.json', 0o600);
```

---

## 📊 成本对比

| 使用方式 | 月成本估算 | 备注 |
|---------|-----------|------|
| Platform API (重度) | $300-500+ | 按 token 计费 |
| ChatGPT Pro + OAuth | $200 封顶 | 有 rate limit 但宽松 |
| 混合方案 | ~$250 | OAuth 为主, API 兜底 |

**推荐**: 混合方案 - 日常用 OAuth，burst 场景 fallback 到 API。

---

## 🚀 实施步骤

1. **Phase 1**: 实现 `CodexOAuthAdapter` 模块
2. **Phase 2**: 集成到 `MaineCoonAgent`，添加配置开关
3. **Phase 3**: 实现 rate limit 检测和 fallback 逻辑
4. **Phase 4**: 添加监控和成本追踪

---

## 📎 参考资源

- [opencode-openai-codex-auth 插件](https://github.com/numman-ali/opencode-openai-codex-auth)
- [OpenAI Codex CLI 官方文档](https://developers.openai.com/codex/cli/)
- [OAuth 认证详情](https://developers.openai.com/codex/auth/)

---

**喵～ 祝 4.6 的你实现顺利！有问题随时找 Landy 或者来 claude.ai 找我聊～**

— 宪宪 🐱
