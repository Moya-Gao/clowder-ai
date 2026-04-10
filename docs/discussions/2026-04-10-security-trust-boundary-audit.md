---
doc_kind: discussion
created: 2026-04-10
topics: [security, trust-boundary, attack-surface, F156]
participants: [opus, gpt52, gemini]
---

# 安全攻防讨论纪要：Cat Cafe Hub Trust Boundary 审计

**Thread ID**: `thread_mnskgsiuyrmi6k55` | **日期**: 2026-04-10 | **参与者**: 布偶猫(opus)、缅因猫(gpt52)、暹罗猫(gemini)

## 背景

F156 Phase A+B 已合入，堵住了 WebSocket 层 CSWSH。铲屎官要求扩展审计范围："别人还能怎么打我们？怎么防？防御不能让非程序员用户难用。"

## 各方观点摘要

### 布偶猫（架构视角）
- 攻击面已从"某个 WS 端口"转变为"浏览器→本机 API 的整体信任边界"
- 排序：HTTP API 无认证 > 身份自报 > DNS Rebinding > Redis > preview-gateway > XSS
- 主张零配置安全 + cookie-based session + 本地信任模型

### 缅因猫（安全视角）
- 新增攻击面：**Prompt Injection / 外部内容驱动工具误用**（Agent 产品特有主风险）
- 排序：身份自报 > Prompt Injection > XSS > Redis > preview-gateway > DNS Rebinding
- 主张先做 Local Trust Boundary Hardening 再去 OfficeClaw
- 具体验证了 preview-gateway 有 loopback+port 限制但无 Origin 校验

### 暹罗猫（UX/前端视角）
- 新增攻击面：**Clickjacking**（无 X-Frame-Options）、**Visual Spoofing**（伪造系统提示骗密钥）、**Rich Block 沙箱穿透**
- 排序：XSS+富媒体穿透 > HTTP API+身份 > DNS Rebinding+Clickjacking > preview > Visual Spoofing > Redis
- 主张安全提示人性化（"巡逻猫"而非红色警告）、高危操作用 Slide/Hold 确认

## 验证结果（布偶猫实际读码确认）

| 声明 | 真/假 | 证据 |
|------|-------|------|
| request-identity.ts 接受 header > query > fallback > default | **真** | resolveUserId() 完整链存在，resolveHeaderUserId() 只读 header |
| preview-gateway WS upgrade 无 Origin 校验 | **真** | server.on('upgrade') 只做 validatePort，不检查 Origin |
| preview-gateway 有 loopback+port 限制 | **真** | LOOPBACK_HOSTS 限 localhost/127.0.0.1/::1，排除 3001/3002/6398/6399 等 |
| 无 X-Frame-Options / CSP frame-ancestors | **真** | 无 @fastify/helmet，无安全 header 中间件，Next.js 也未配置 |
| HtmlWidgetBlock 无 HTML sanitization | **真** | srcDoc 直接渲染 block.html，无 DOMPurify |
| HtmlWidgetBlock sandbox 配置正确 | **真** | sandbox="allow-scripts" 且**无** allow-same-origin，父窗口 DOM/cookie 不可访问 |
| 沙箱内仍可 fetch 外部 | **真** | sandboxed iframe 内 JS 可发外部网络请求（数据外泄风险） |
| Markdown 渲染安全 | **真** | react-markdown，不用 dangerouslySetInnerHTML |

## 共识区

1. **HTTP 身份自报是最高优先级** — 三猫一致排 Top 1/P0
2. **前端 XSS/CSP 是关键基础设施** — 三猫一致
3. **Prompt Injection 对 Agent 产品是真实主风险** — 布偶猫+缅因猫
4. **Clickjacking 是真实问题** — 暹罗猫提出，验证确认无防护
5. **安全默认开启、透明、不恐吓** — 三猫一致
6. **先修自己家再去 OfficeClaw** — 三猫一致

## 分歧区

| 分歧点 | 各方立场 | 综合判断 |
|--------|---------|---------|
| DNS Rebinding 优先级 | 烁烁 P1 / 砚砚+宪宪较低 | **较低**：当前白名单只有 localhost/127.0.0.1，DNS Rebinding 攻击不太现实；但如果开放自定义 FRONTEND_URL 需重新评估 |
| Rich Block 沙箱是否够 | 烁烁认为需要 sanitization / 宪宪验证沙箱隔离有效 | **沙箱隔离正确但应加 sanitization**：sandbox 无 allow-same-origin 阻止了父窗口访问，但 fetch 外泄仍在。DOMPurify 是低成本加固 |
| 高危操作确认 UX | 烁烁建议 Slide/Hold 替代 Click | **方向对但需评估成本**：防 clickjacking 主要靠 X-Frame-Options（零成本），Slide/Hold 是锦上添花 |
| Prompt Injection 范围 | 砚砚排 Top 2 / 宪宪认同 / 烁烁合并到 XSS | **独立列为 Top 2**：Agent 产品特有风险，和传统 XSS 不同维度 |

## 收敛后优先级（Phase 排序建议）

| 优先级 | 攻击面 | Phase |
|--------|--------|-------|
| **P0** | HTTP 身份自报 → 服务端 session | D-1 |
| **P0** | Clickjacking（X-Frame-Options + CSP frame-ancestors） | D-2 |
| **P1** | 前端 XSS 基线（CSP strict + HtmlWidget DOMPurify） | D-3 |
| **P1** | Prompt Injection 降权（外部内容隔离 + 高危操作确认） | D-4 |
| **P2** | preview-gateway Origin 校验 | D-5 |
| **P2** | DNS Rebinding（Host header 校验） | D-6 |
| **P3** | Redis 密码保护 | 留给 F077 |

## 行动项

1. 更新 F156 spec，增加 Phase D（Local Trust Boundary Hardening）
2. D-1 和 D-2 可以先做（低摩擦、高收益）
3. D-4 需要和铲屎官进一步讨论 Prompt Injection 的具体降权策略
4. 全部 Phase D 完成后再做 Phase C（OfficeClaw）
