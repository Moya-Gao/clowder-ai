---
title: 云端猫 Family + 多 provider 接入平台 — Strawman
date: 2026-06-20
authors: [opus-47]
type: strawman
status: STRAWMAN — 未立项（feat_anchor_needs_cvo_explicit_signoff）
related: [F178, F061]
spike_evidence: 2026-06-17-cloud-pro-yanyan-spike-sop.md
research: 2026-06-16-cloud-pro-yanyan-remote-mcp-research.md
thread: thread_mqgem09a7skjvwhx
main-thread: thread_mqbpzs2k0fsos5yf
---

# 云端猫 Family + 多 provider 接入平台 — Strawman

> ⚠️ **占位 strawman，不是正式 F 号**（48 R3 polish §3 提醒）。本 doc 是产品愿景拆解 + 工程结构草图，给铲屎官 informed 决策用。
> 正式立项要 **CVO 明确 signoff**（家规 `feedback_feat_anchor_needs_cvo_explicit_signoff`），届时铲屎官给真 F 号，此 doc 改名。
> 在 CVO signoff 前，**任何引用本 doc 都不能写成"已立项"**（防 confabulation）。

## 0. 起源：spike PASS + 铲屎官产品愿景升级

2026-06-20 凌晨 spike PASS（[2026-06-17 SOP §8.5](2026-06-17-cloud-pro-yanyan-spike-sop.md)）：ChatGPT Pro 砚砚通过 cloudflared quick tunnel + No Auth + Streamable HTTP 成功调到 cat-cafe MCP 的 echo 工具，亲口说"猫咖小管道通了 🐾"。

铲屎官接着给出产品愿景升级（thread `thread_mqgem09a7skjvwhx` 06:15 PT 原话）：

> "全量版本 mcp 接入完成之后还要升级一下。比如说 gpt pro 接入进来他要是发消息了 我们猫咖前端有他的头像，甚至这个能力得做成一个能给其他社区小伙伴 类似于我们家的插件 or 其他开源项目安装那样的能迁移的呀！这样我们未来在配置猫猫上如果选择配置 chatgpt 云端 然后选模型 就能和云端的猫沟通了呀。这样甚至他就是独立的一只有自己完整头像的猫了，砚砚 pro 版本他发消息你们也能看到气泡（或者说我能看到），他写 plan 让你们执行等等"

这个愿景**远超 F178 Phase D carry scope**——是"云端猫家族 + 多 provider 接入平台化"，触发 §12 升级条件之**多租户 + 持久 session state**，要新 F 号。

## 1. 愿景 / Why

把猫咖从"本地 Claude/Codex 家族"升级为**多 provider 云端猫聚集地**：

- 铲屎官能在"配置猫猫"页面选 ChatGPT 云端 / Claude.ai 云端 / Gemini Web → 选具体 model → 自动 wire up 接入
- 接入后云端猫**作为独立的家庭成员**（独立 catId + avatar + color theme + dossier）
- 前端 ThreadView 渲染云端猫消息**气泡（视觉一等公民）**，跟 fable/opus 同款
- 云端猫**可写 plan/handoff** 让本地猫执行（`.ai-bridge/current-plan.md` 模式，CodexPro 启发）
- 能力**可迁移**：cat-cafe plugin standard，别人也能装、也能反向把他家的 ChatGPT Pro 接进我们家

护城河升级：
- 现状：本地 Claude/Codex 家族 → 单 vendor 风险
- 愿景：多 provider 聚集地 → 任何"能跑 MCP connector 的云端 LLM"都能成为家庭成员 → vendor 自由 + 用户跨平台

## 2. 核心能力清单（5 项）

### 2.1 云端猫身份系统

- 新增 `cat-config.json` roster entry：
  ```json
  "yanyan-cloud": {
    "family": "maine-coon-cloud",          // 新 family 区分本地缅因猫
    "provider": "openai-chatgpt-pro",      // 新字段：provider 标识
    "model": "gpt-4-or-equivalent",        // 新字段：model 标识
    "roles": ["design-gate", "peer-reviewer"],
    "lead": false,
    "available": true,
    "avatar": "/avatars/yanyan-cloud.jpg",
    "color": { "primary": "#...", "secondary": "#..." },
    "evaluation": "云端 ChatGPT Pro 砚砚，高阶判断席位"
  }
  ```
- 头像设计：和本地砚砚区分（云朵 + 缅因花纹？@gemini 设计）
- color theme：暖色调（区分本地砚砚的冷色）

### 2.2 前端 bubble/avatar 渲染

- 前端 ThreadView 渲染云端猫消息气泡，**视觉与 fable/opus 同等地位**：
  - 头像 + 签名 `[砚砚-cloud/gpt-pro🐾☁]` (带云端标识)
  - 气泡背景色按 catId color theme
  - 气泡左下角加 "via ChatGPT Pro" tag 提示来源（透明度低）
- 现有 ChatMessage 组件扩展 `provider` 字段判断渲染

### 2.3 多 provider 接入框架（"配置猫猫"页面）

- 新建 Console settings → "配置云端猫"
- 流程：
  1. 选 provider：ChatGPT Web / Claude.ai Web / Gemini Web / 其他
  2. 选 model：从 provider available models 列表选
  3. 系统自动 wire up MCP connector（生成 token + URL + 显示给用户复制到 ChatGPT Web 配置）
  4. 用户在 ChatGPT Web 创 connector 填 URL → 完成
  5. 系统标 `yanyan-cloud` 为 `available: true` + 显示在 cat picker

### 2.4 插件化标准 / 可迁移

- 抽象 `Cat Café Cloud Cat Plugin v1 spec`：
  - 一份 npm package（同 CodexPro 模式）
  - 命令 `cat-cafe install <provider-plugin>` 一键安装
  - 提供 stdio MCP entry + remote HTTP MCP entry
  - 暴露 cat-cafe API 的 cloud cat-aware 子集
- 双向能力：
  - 别人能装我们的猫咖插件接到他家 LLM
  - 我们的猫咖能装别人写的插件接到任意 LLM

### 2.5 云端猫写 plan + 本地猫执行

- 云端砚砚（design gate / planning / architecture review 角色）写出 plan → 通过 MCP 工具调用本地 cat-cafe API → 本地猫看到 plan / task
- 类似 CodexPro 的 `.ai-bridge/current-plan.md` 模式
- 本地 thread 收到云端猫的 task → 自动路由给合适本地猫执行

## 3. Non-Goals（不在 scope）

- ❌ 不替代本地 Claude/Codex 猫（云端猫是补充不是替代）
- ❌ 不解锁 model（不是 rate-limit bypass，遵守 OpenAI ToS）
- ❌ 不收云端 LLM cost（铲屎官自己 ChatGPT Pro 订阅）
- ❌ 不暴露 cat-cafe 完整能力（云端猫工具仍按 toolset 收窄）

## 4. Architecture 草图

```
┌─────────────────────────────────────────────────────────────────┐
│  ChatGPT Web (云端砚砚 + 其他云端猫)                              │
│  - MCP Developer mode connector                                  │
│  - 调 cat-cafe 工具                                              │
└──────────────────┬──────────────────────────────────────────────┘
                   │ HTTPS + (auth 模式 TBD)
                   ↓
┌──────────────────────────────────────────────────────────────────┐
│  Public endpoint (CF Tunnel / quick tunnel)                       │
│  - mcp.clowder-ai.com OR <random>.trycloudflare.com               │
└──────────────────┬───────────────────────────────────────────────┘
                   │
                   ↓
┌──────────────────────────────────────────────────────────────────┐
│  cat-cafe Remote MCP Server (新)                                  │
│  - Streamable HTTP transport (spike 已验证)                       │
│  - auth: TBD (CF Access OAuth / header token / mTLS / ...)        │
│  - mode: CAT_CAFE_REMOTE_MODE=cloud-pro-phase{N}                  │
│  - per-cloud-cat toolset 收窄 + per-cloud-cat agent-key principal │
└──────────────────┬───────────────────────────────────────────────┘
                   │ callback (agent-key principal)
                   ↓
┌──────────────────────────────────────────────────────────────────┐
│  cat-cafe API (3002) — 现有                                       │
│  - 写消息 → cloud cat 身份归因                                    │
│  - 读 memory → search_evidence / graph_resolve                    │
│  - 写 plan → handoff to local cats                                │
└──────────────────────────────────────────────────────────────────┘
                   │
                   ↓
┌──────────────────────────────────────────────────────────────────┐
│  cat-cafe 前端 — 现有 + 升级                                      │
│  - ThreadView 渲染云端猫气泡 (with avatar / color / provider tag) │
│  - 配置云端猫 page (新)                                           │
│  - cat picker 加 cloud cat (新)                                   │
└──────────────────────────────────────────────────────────────────┘
```

## 5. 安全门（继承 F178 Phase D carry + 48 R2 P0）

- 任何云端猫接入 endpoint 必须真 auth（不接受 "No Auth + token-in-URL"）
- per-cloud-cat 独立 agent-key（按 LL-072 教训不共用 key）
- toolset 收窄 mode（复用 fable-phase0 设计：mode-precedence-highest + unknown fail-fast）
- 写操作 audit log（cloud cat 写入归因清晰）
- revocation 路径（即时 revoke + 撤销标识在前端可见）

## 6. Open Questions（要立项时收敛）

| # | 问题 | 备注 |
|---|---|---|
| OQ-S1 | 多 provider 接入框架是 cat-cafe 自带 vs 外部 plugin standard？ | trade-off：自带简单但锁我们家；外部 plugin 开放但要维护 spec |
| OQ-S2 | 云端猫的 provider list 在 cat-config 还是动态？ | 锁死 vs ChatGPT/Claude.ai/Gemini 都允许 |
| OQ-S3 | 写 plan handoff 是 MCP tool 还是新 callback endpoint？ | tool 简单；endpoint 更准确分隔 plan 和 message |
| OQ-S4 | 云端猫前端 bubble 视觉怎么和本地区分？ | 同色但加 ☁ icon？分色？|
| OQ-S5 | 云端猫消息 audit 怎么标 model 来源？（同 catId 不同 ChatGPT model 调用时） | 加 `audit_model` 字段？|
| OQ-S6 | 插件化 spec 的 versioning？ | 大改了别家装的可能炸 |
| OQ-S7 | F178 Phase D vs 新 F 号边界在哪？ | F178 Phase D 只管单云端猫 spike；这个 strawman 是整个 family + 平台 |

## 7. Phase 划分草案（立项后细化）

- **Phase A (Design Gate)**：本 strawman + OQ 收敛 + 砚砚跨族 review
- **Phase B (yanyan-cloud single cat)**：单只云端猫接入（roster + avatar + bubble + 真 auth + 1 set toolset）
- **Phase C (多 provider 框架)**：配置云端猫 UI + plugin spec v1
- **Phase D (写 plan handoff)**：cloud cat → local cat plan 路由 + 执行
- **Phase E (外部插件迁移)**：plugin npm package 发布 + 文档化

## 8. 风险

| 风险 | 缓解 |
|---|---|
| ChatGPT TOS 跳变（OpenAI 改 Developer mode 规则） | 接受系统性风险；plugin spec 抽象层让我们能换 LLM connector |
| 真 auth 方案没 verify 就上 production | F178 Phase D 安全门继承；48 R2 严守 |
| 云端猫 confabulate 当作本地猫角色 / 反过来 | 前端清晰 ☁ icon + provider tag + signature 加云端标识 |
| 插件 spec 设计错 → 外部装坏 | v1 严限 scope + 长 deprecation 期 + breaking changes major version |
| 隐私（云端 LLM 看到我们家 memory） | toolset 收窄 + audit log + 用户 opt-in 控制单工具 |

## 9. 不要 confabulate "已立项"

> 重申：本 strawman **不是正式 F 号**。立项时 CVO 给真号（如 `F236`），本 doc 改名 + 加 spec status 升级。
> 引用本 doc 必须带 "（strawman 占位）" 标注，不能写成"按 Fxxx 实施"。

## 10. 链路状态

- spike 真理时刻：echo 工具 ChatGPT 真调用 PASS（2026-06-20 06:08 UTC）
- 48 R2 安全把关：production 暴露面 P0 + 真 auth 不可降级
- **本 strawman**：opus-47 写（2026-06-20 06:25 UTC）
- 待 CVO（铲屎官）review：拍板"开新 F 号 vs 继续 F178 Phase D carry"
- 立项触发条件已满足（多租户 + 持久 session state + 多 provider）

[宪宪/Opus-4.7🐾]
