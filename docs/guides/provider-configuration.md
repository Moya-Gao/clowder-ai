---
title: Third-Party AI Provider Configuration Guide
created: 2026-03-30
---

# Third-Party AI Provider Configuration Guide

Configure third-party AI providers (Kimi, GLM, MiniMax, OpenRouter, etc.) to work with
claude-code, codex, and opencode clients.

## Key Concepts

### Two API Protocols

Most Chinese AI providers now support **both** API formats:

| Protocol | Endpoint Format | SDK |
|----------|----------------|-----|
| **OpenAI** | `/v1/chat/completions` | `@ai-sdk/openai-compatible` |
| **Anthropic** | `/v1/messages` | `@ai-sdk/anthropic` |

### Three Clients

| Client | Supported Protocol | When to Use |
|--------|-------------------|-------------|
| `claude-code` | Anthropic only | Provider has Anthropic-compatible endpoint |
| `codex` | OpenAI only | Provider has OpenAI-compatible endpoint |
| `opencode` | Both | Maximum flexibility, supports any provider |

---

## Part 1: Provider Account Setup

### 1. Kimi (Moonshot AI)

**Get API Key**: [platform.moonshot.ai](https://platform.moonshot.ai/)

| Protocol | Base URL | Region |
|----------|----------|--------|
| OpenAI | `https://api.moonshot.ai/v1` | International |
| OpenAI | `https://api.moonshot.cn/v1` | China Mainland |
| Anthropic | `https://api.moonshot.ai/anthropic` | International |

**Models**: `kimi-k2.5`, `moonshot-v1-128k`, `moonshot-v1-32k`, `moonshot-v1-8k`

**Hub Configuration** (recommended — opencode client):

| Field | Value |
|-------|-------|
| Client | `opencode` |
| Protocol | `openai` |
| Base URL | `https://api.moonshot.ai/v1` |
| Model | `kimi-k2.5` |
| ocProviderName | `kimi` |

> **For Claude Code client**: set Protocol = `anthropic`, Base URL = `https://api.moonshot.ai/anthropic`

---

### 2. GLM (Zhipu AI / Z.AI)

**Get API Key**: [open.bigmodel.cn](https://open.bigmodel.cn/) (China) or [z.ai](https://z.ai/) (International)

| Protocol | Base URL | Region |
|----------|----------|--------|
| OpenAI | `https://open.bigmodel.cn/api/paas/v4` | China Mainland |
| OpenAI | `https://api.z.ai/api/paas/v4` | International |
| Anthropic | `https://api.z.ai/api/anthropic` | International |

**Models**: `glm-5`, `glm-5-turbo`, `glm-4.7`, `glm-4.5`

**Hub Configuration** (recommended — opencode client):

| Field | Value |
|-------|-------|
| Client | `opencode` |
| Protocol | `openai` |
| Base URL | `https://open.bigmodel.cn/api/paas/v4` |
| Model | `glm-4.7` |
| ocProviderName | `glm` |

> **For Claude Code client**: set Protocol = `anthropic`, Base URL = `https://api.z.ai/api/anthropic`

---

### 3. MiniMax

**Get API Key**: [platform.minimax.io](https://platform.minimax.io/)

| Protocol | Base URL |
|----------|----------|
| OpenAI | `https://api.minimax.io/v1` |
| Anthropic | `https://api.minimax.io/anthropic` |

**Models**: `MiniMax-M2.7`, `MiniMax-M2.5`, `MiniMax-M2.1`

**Hub Configuration** (recommended — opencode client):

| Field | Value |
|-------|-------|
| Client | `opencode` |
| Protocol | `openai` |
| Base URL | `https://api.minimax.io/v1` |
| Model | `MiniMax-M2.7` |
| ocProviderName | `minimax` |

> **For Claude Code client**: set Protocol = `anthropic`, Base URL = `https://api.minimax.io/anthropic`

---

### 4. Aggregator (OpenRouter)

**Get API Key**: [openrouter.ai](https://openrouter.ai/)

| Protocol | Base URL |
|----------|----------|
| OpenAI | `https://openrouter.ai/api/v1` |

**Models**: Use `provider/model` format, e.g. `google/gemini-3-pro`, `anthropic/claude-sonnet-4-6`

**Hub Configuration**:

| Field | Value |
|-------|-------|
| Client | `opencode` |
| Protocol | `openai` |
| Base URL | `https://openrouter.ai/api/v1` |
| Model | `google/gemini-3-pro` |
| ocProviderName | `openrouter` |

---

## Part 2: Which Client Should I Use?

### Decision Flowchart

```
Want to use Claude Code CLI?
  ├─ Yes → Provider has Anthropic endpoint?
  │         ├─ Yes → claude-code + anthropic protocol
  │         └─ No  → Can't use Claude Code with this provider
  │
  └─ No  → Provider has OpenAI endpoint?
            ├─ Yes → opencode + openai protocol (recommended)
            │        OR codex + openai protocol
            └─ No  → opencode + anthropic protocol
```

### Recommendation by Provider

| Provider | Recommended Client | Protocol | Why |
|----------|--------------------|----------|-----|
| Kimi | opencode | openai | Full feature support via chat/completions |
| GLM | claude-code | anthropic | Native Anthropic compatibility, works with Claude Code CLI |
| MiniMax | opencode | openai | Stable OpenAI-compatible endpoint |
| OpenRouter | opencode | openai | Standard OpenAI format |

> **opencode** is the most versatile client — it works with any protocol and gives you
> runtime config flexibility. When in doubt, use opencode.

### Claude Code Client Setup

Claude Code reads these environment variables:

```bash
export ANTHROPIC_AUTH_TOKEN="your-api-key"
export ANTHROPIC_BASE_URL="https://api.z.ai/api/anthropic"  # GLM example
export ANTHROPIC_MODEL="glm-4.7"
```

In the Hub, create a member with:
- Client: `claude-code`
- Protocol: `anthropic`
- Base URL: the provider's Anthropic-compatible endpoint

### Codex Client Setup

Codex uses OpenAI protocol. In the Hub:
- Client: `codex`
- Protocol: `openai`
- Base URL: the provider's OpenAI-compatible endpoint
- Model: the provider's model name

### opencode Client Setup

opencode is the most flexible. In the Hub:
- Client: `opencode`
- Protocol: `openai` or `anthropic` (match the base URL format)
- Base URL: the provider's API endpoint
- Model: the provider's model name
- **ocProviderName**: a custom name (see pitfalls below)

---

## Common Pitfalls

### 1. Base URL must include the version path

**Wrong**: `https://api.moonshot.cn`
**Right**: `https://api.moonshot.cn/v1`

The SDK appends `/chat/completions` (OpenAI) or `/messages` (Anthropic) directly to
the base URL. If you omit `/v1`, requests go to the wrong path and you get `404 Not Found`.

### 2. ocProviderName must NOT be a built-in name

**Wrong**: `ocProviderName: "openai"` or `"anthropic"` or `"google"`
**Right**: `ocProviderName: "kimi"` or `"glm"` or `"minimax"`

opencode has built-in providers named `openai`, `anthropic`, and `google`. If you use
a built-in name, opencode ignores your custom SDK adapter and uses its built-in handler,
which may call the wrong API method (e.g., OpenAI Responses API instead of chat/completions).

**Rule**: always use the provider's brand name (lowercase) as `ocProviderName`.

### 3. Protocol must match the base URL format

If your base URL is an OpenAI-compatible endpoint (`/v1/chat/completions`), set
protocol to `openai`. If it's Anthropic-compatible (`/v1/messages` or `/anthropic`),
set protocol to `anthropic`. Mismatching causes authentication or format errors.

### 4. Model names are provider-specific

Each provider has its own model naming convention:
- Kimi: `kimi-k2.5` (not `moonshot/kimi-k2.5`)
- GLM: `glm-4.7` (not `zhipu/glm-4.7`)
- MiniMax: `MiniMax-M2.7` (case-sensitive)
- OpenRouter: `provider/model` format required (e.g., `google/gemini-3-pro`)

---

## Quick Reference Card

| Provider | OpenAI Base URL | Anthropic Base URL | Suggested ocProviderName |
|----------|----------------|--------------------|--------------------------|
| Kimi | `https://api.moonshot.ai/v1` | `https://api.moonshot.ai/anthropic` | `kimi` |
| GLM | `https://open.bigmodel.cn/api/paas/v4` | `https://api.z.ai/api/anthropic` | `glm` |
| MiniMax | `https://api.minimax.io/v1` | `https://api.minimax.io/anthropic` | `minimax` |
| OpenRouter | `https://openrouter.ai/api/v1` | — | `openrouter` |
