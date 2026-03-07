---
feature_ids: [F061]
related_features: [F050, F032, F041, F043, F045, F060]
topics: [antigravity, bengal-cat, cdp, external-agent, image-generation, evidence-chain, multi-model]
doc_kind: spec
created: 2026-03-04
---

# F061: Antigravity 接入 — 孟加拉猫（混血家族）

> **Status**: spec
> **Owner**: 布偶猫 Opus 4.6
> **Created**: 2026-03-04

---

## Why

Cat Cafe 现有三大纯血家族（布偶猫/缅因猫/暹罗猫）各自对应一个 CLI agent。但 Google Antigravity 是一个独特的存在：

1. **多模型 IDE agent** — 可切换 Gemini 3.1 Pro、Gemini 3 Flash、Claude Sonnet 4.6、Claude Opus 4.6
2. **图片生成能力** — Gemini CLI 没有，Antigravity 有（铲屎官一直想要的能力）
3. **证据链能力** — 内置截图、录视频，与 F045 NDJSON Observability 方向高度契合
4. **Browser Agent** — 内置 CDP 驱动的浏览器自动化（通过 Jetski 子代理）

Antigravity 不是任何现有家族的替代品——它是**混血**的：底层可跑多家模型，agent 能力由 Antigravity 自身编排，不受单一模型限制。

铲屎官定性：**孟加拉猫**（Bengal）——最著名的混血猫种（亚洲豹猫 x 家猫），花纹华丽，精力旺盛。

---

## What

通过 CDP（Chrome DevTools Protocol）桥接方案，将 Antigravity 作为独立家族（孟加拉猫）接入 Cat Cafe。

### 核心架构

```
Cat Cafe AgentRouter
  → AntigravityAgentService (新 provider)
    → HTTP Bridge Server (CDP 桥)
      → CDP (port 9000)
        → Antigravity IDE (Electron)
```

### 接入方式对比

| 维度 | DARE/狸花猫 (F050 Phase 1) | Antigravity/孟加拉猫 (F061) |
|------|---------------------------|------------------------------|
| 通信层 | CLI spawn + stdout NDJSON | CDP 桥 + HTTP API |
| 事件流 | headless envelope v1 | DOM snapshot + WebSocket |
| 控制面 | control-stdin | `/send` HTTP endpoint |
| 模型 | 底层 LLM 可变 | 多模型可切换（Gemini/Claude） |
| 独有能力 | 确定性执行、审计追踪 | 图片生成、截图录屏、browser automation |

### 社区已有桥方案

- [antigravity_phone_chat](https://github.com/krishnakanthb13/antigravity_phone_chat) — `/send` + `/snapshot` + WebSocket
- [antigravity-remote-dev](https://github.com/EvanDbg/antigravity-remote-dev) — 类似架构
- [antigravity-connect](https://github.com/piyushdaiya/antigravity-connect) — Go 重写

这些项目验证了 `antigravity . --remote-debugging-port=9000` → CDP 桥 → HTTP API 的可行性。

---

## Acceptance Criteria

### Phase 0: Spike / 可行性验证
- [ ] AC-1: Antigravity 启动带 `--remote-debugging-port` 并成功连接 CDP
- [ ] AC-2: 桥服务能通过 CDP 注入消息并获取回复 DOM
- [ ] AC-3: 回复内容可解析为纯文本/markdown（从 HTML DOM）

### Phase 1: Cat Cafe L1 接入
- [ ] AC-4: `cat-config.json` 可注册孟加拉猫（provider: `antigravity`）
- [ ] AC-5: `AntigravityAgentService` 实现 `AgentService` 接口
- [ ] AC-6: AgentRouter 可路由消息到 Antigravity 并获取流式回复
- [ ] AC-7: 图片生成结果可在 Hub 前端展示（F060 rich block 联动）

### Phase 2: 证据链 + 高级能力
- [ ] AC-8: Antigravity 截图/录屏可作为证据附件回传
- [ ] AC-9: 多模型切换可通过 Cat Cafe 配置控制
- [ ] AC-10: 与现有三猫回归测试共跑通过

---

## 需求点 Checklist

| ID | 需求点（铲屎官原话/转述） | AC 编号 | 验证方式 | 状态 |
|----|---------------------------|---------|----------|------|
| R1 | "他是独立的！人家还有两只布偶猫可以用呢" — 独立家族，不是暹罗猫替代 | AC-4 | cat-config 注册验证 | [ ] |
| R2 | "antigravity 他的猫猫是真的能够生成图片的，这才是我一直想要接入的原因" | AC-7 | 图片生成 → Hub 展示 e2e | [ ] |
| R3 | "他能够录视频 截图" — 证据链能力 | AC-8 | 截图/录屏回传验证 | [ ] |
| R4 | CDP 桥可行性（社区已验证） | AC-1, AC-2, AC-3 | spike 验证 | [ ] |

### 覆盖检查
- [x] 每个需求点都能映射到至少一个 AC
- [x] 每个 AC 都有验证方式
- [ ] 前端需求已准备需求→证据映射表（Phase 1 时补）

---

## Key Decisions

1. **家族定位：孟加拉猫（Bengal）** — 混血（多模型）、独立家族、不归属任何现有纯血家族
2. **接入通道：CDP 桥（非 CLI spawn）** — Antigravity 是 Electron 应用，没有 headless CLI 模式
3. **遵循 F050 External Agent Contract v1** — 但通信层用 CDP 桥替代 CLI adapter
4. **图片生成为核心差异化能力** — 这是现有三猫都不具备的
5. **catId: `antigravity`** — mentionPatterns: `@antigravity` / `@孟加拉猫` / `@孟加拉` / `@bengal`
6. **双 Variant** — `antigravity-gemini`（默认，Gemini 3.1 Pro）+ `antigravity-claude`（Claude Opus 4.6），换代只改 `defaultModel` 一行
7. **昵称留空** — 等 Antigravity 接入后让他自取名（遵循三猫命名传统）
8. **配色：琥珀色** — Primary `#D4853A` / Secondary `#FAEBDB`（区别于狸花猫的土金色 `#D4A76A`）
9. **吊牌符号：棱镜** — 一束光折射出多种颜色 = 一个 agent 跑多种模型
10. **Avatar**: `assets/avatars/antigravity.png` — 垫子系列统一画风，扑击姿势体现精力旺盛

---

## Phase 0 可行性评估（2026-03-06）

### 三条接入路径

| 路径 | 方案 | 延迟 | 复杂度 | 流式 |
|------|------|------|--------|------|
| **A. CDP 桥** | `--remote-debugging-port=9000` → DOM snapshot → 消息注入 | ~3s polling | 高（DOM 解析脆弱） | 伪流式（polling） |
| **B. antigravity-claude-proxy** | Anthropic 兼容 API on localhost:8080 | 实时流式 | 低（npm 包，即装即用） | 真 SSE 流式 |
| **C. MCP 反向桥** | Antigravity 本身支持 MCP → 让它连我们的 MCP server | 实时 | 中（需定义 tool schema） | 取决于实现 |

### 推荐策略：双通道混合

- **Phase 1（快速接入）**: antigravity-claude-proxy 路径 → 标准 Anthropic API → AgentService 直接对接 → 立刻获得多模型对话、流式回复、MCP 工具 → 开发量小（复用现有 Anthropic provider 逻辑）
- **Phase 2（高级能力）**: CDP 桥补充 → 图片生成结果回传 + 截图/录屏证据链 + Browser automation 能力暴露

### 各维度可行性判定

| 维度 | 判定 | 说明 |
|------|------|------|
| 消息发送 | ✅ 可行 | 路径 B 直接用 Anthropic SDK 格式发 |
| 流式回复 | ✅ 可行 | 路径 B 支持 SSE 流式，路径 A 只有 ~1s polling |
| 图片生成 | ⚠️ 需验证 | Antigravity 内置 Imagen 3，但 proxy 是否透传图片输出需 spike |
| 截图/录屏 | ⚠️ 需 CDP | 这个能力只在 CDP 层面可获取，proxy 拿不到 |
| Browser automation | ⚠️ 需 CDP | Jetski 子代理的 19 个浏览器工具需要 CDP 6 层架构 |
| 多模型切换 | ✅ 可行 | proxy 支持多模型标识 |
| MCP 工具 | ✅ 可行 | Antigravity 原生支持 1500+ MCP server，可配置 |

### 能力覆盖对比：现有猫猫 vs 孟加拉猫

| 能力 | 布偶猫 | 缅因猫 | 暹罗猫 | 狸花猫 | **孟加拉猫** |
|------|--------|--------|--------|--------|-------------|
| 对话/推理 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 代码生成 | ✅ | ✅ | ❌ | ✅ | ✅ |
| MCP 工具 | ✅ | ✅ | ✅ | ❌ | ✅ (原生 1500+) |
| Code review | ✅ | ✅ | ❌ | ❌ | ✅ (切 Claude 模型) |
| **图片生成** | ❌ | ❌ | ❌ | ❌ | **✅ 独有** |
| **截图/录屏** | ❌ | ❌ | ❌ | ❌ | **✅ 独有** |
| **Browser automation** | ❌ | ❌ | ❌ | ❌ | **✅ 独有 (Jetski)** |
| 多模型切换 | ❌ | ❌ | ❌ | ✅ (底层可变) | **✅ (Gemini/Claude)** |
| 确定性执行 | ❌ | ❌ | ❌ | ✅ | ❌ |
| 审计追踪 | ❌ | ❌ | ❌ | ✅ | ⚠️ (有截图但无结构化审计) |
| 视觉设计顾问 | ❌ | ❌ | ✅ | ❌ | ⚠️ (能生成图但不是设计师) |

**结论：可行，且比预期更好。** 孟加拉猫带来 3 个独有能力（图片生成、截图录屏、browser automation），这是现有四猫都没有的。接入价值明确。

### 调研来源

- [antigravity-remote-dev](https://github.com/EvanDbg/antigravity-remote-dev) — CDP 移动端桥接验证
- [antigravity-link-extension](https://deepwiki.com/cafeTechne/antigravity-link-extension/2.2-configuration) — CDP 端口扫描范围 9000-9005/9222
- [Reverse Engineering Antigravity's Browser Automation](https://alokbishoyi.com/blogposts/reverse-engineering-browser-automation.html) — Jetski 6 层委托模型 + 19 个浏览器工具
- [Antigravity MCP Integration](https://antigravity.google/docs/mcp) — 原生 MCP 支持 1500+ server

---

## Dependencies

- **F050**: External Agent Contract v1（接入契约，已定稿）
- **F032**: Agent Plugin Architecture（provider 扩展机制）
- **F060**: output_image 富文本渲染（图片展示基础设施）
- **Antigravity**: Google Antigravity IDE（需要铲屎官本地安装）
- **Evolved from**: F050（第二个外部 agent 接入用例）

---

## Risk

1. **CDP 稳定性** — DOM 结构随 Antigravity 版本更新可能变化，桥服务需要适配
2. **延迟** — DOM polling（~3s）比 CLI stdout 流式慢，影响交互体验
3. **Antigravity 更新节奏** — Google 产品更新频繁，CDP 端口支持可能变动
4. **混血身份哲学问题** — Antigravity 切到 Claude Opus 时，它和布偶猫的边界在哪？（先按"不同个体"处理）

---

## Open Questions

1. ~~孟加拉猫的**昵称**叫什么？~~ → **已决定留空，接入后自取名**
2. Antigravity 切模型时，Cat Cafe 侧如何感知当前模型？（DOM 解析 vs API）
3. CDP 桥是自己写还是 fork 社区项目（antigravity_phone_chat）？
4. Antigravity 的 browser agent 能力是否暴露给 Cat Cafe 协作使用？
5. F050 的 EAC v1 中 Stream Contract 要求"机器可解析流"——DOM snapshot 是否满足？需要定义映射规则

---

## Links

- [F050: External Agent Onboarding](./F050-a2a-external-agent-onboarding.md)
- [F032: Agent Plugin Architecture](./F032-agent-plugin-architecture.md)
- [F060: output_image 富文本渲染](./F060-output-image-rich-block.md)
- [antigravity_phone_chat (CDP 桥参考)](https://github.com/krishnakanthb13/antigravity_phone_chat)
- [Reverse Engineering Antigravity's Browser Automation](https://alokbishoyi.com/blogposts/reverse-engineering-browser-automation.html)

---

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-03-04 | Kickoff — 铲屎官定品种为孟加拉猫，spec 立项 |
| 2026-03-06 | 猫猫档案设计 — Avatar 生成、配色确定、双 Variant 架构、cat-config.json 注册 |
| 2026-03-06 | Phase 0 可行性评估 — 三条路径调研、能力覆盖对比、推荐双通道混合策略 |
