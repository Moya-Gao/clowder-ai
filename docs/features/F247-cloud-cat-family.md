---
feature_ids: [F247]
related_features: [F178, F061, F174, F236, F237]
topics: [cloud-cat, chatgpt-pro, mcp, multi-provider, custom-instructions, github-connector]
doc_kind: spec
tips_exempt: B1a interim — productized capability tip 待 Phase D Console 多 provider UI 上线后写
created: 2026-06-21
revision_history:
  v1 (2026-06-21, commit 00a533f71): 立项
  v2 (2026-06-21, this revision): 砚砚 R3+R4+R5 跨族 review fix
    - P1 R3-1: Phase B auth split B0 harness / B1 production
    - P1 R3-2: yanyan-cloud → gpt-pro 全局统一
    - P1 R3-3 + R4: startup polling 完全砍掉，不偷换 search_evidence 伪装
    - P2 R3-1: AC-A3 footnote Checkpoint #3
    - P2 R3-2: KD-1 rewrite (F178 owns single-agent-key research, F247 owns productized platform)
    - P2 R3-4: mint roster allowlist only + Phase C breeds.variants task
    - R5: 1175 L0 hold_ball → 工具无关表述
---

# F247: 云端猫 Family + 多 provider 接入平台

> **Status**: active | **Owner**: 布偶猫 (宪宪 opus-47) | **Reviewer**: 缅因猫 (砚砚 codex/gpt-5.5) | **Vision Guard**: 布偶猫 (opus-48) | **Priority**: P1 | **Created**: 2026-06-21

## Why (R3 P2-2 rewrite)

**F247 owns productized cloud-cat platform vision**：multi-provider 接入、avatars/bubbles、config UI、pluginization。

F178 §12 升级条件给出新 F 号触发集合（self OAuth AS / multi-tenant / write expansion / persisted bridge state），但 F247 真正的立项动力**不是公网 auth shape**——而是铲屎官给的产品愿景升级（2026-06-21 06:15 PT 原话）：

> "全量版本 mcp 接入完成之后还要升级一下。比如说 gpt pro 接入进来他要是发消息了 我们猫咖前端有他的头像，甚至这个能力得做成一个能给其他社区小伙伴 类似于我们家的插件 or 其他开源项目安装那样的能迁移的呀！这样我们未来在配置猫猫上如果选择配置 chatgpt 云端 然后选模型 就能和云端的猫沟通了呀。这样甚至他就是独立的一只有自己完整头像的猫了，砚砚 pro 版本他发消息你们也能看到气泡（或者说我能看到），他写 plan 让你们执行等等"

**触发证据（spike PASS 真理时刻 2026-06-21 06:08 UTC）**：ChatGPT Pro 砚砚通过 cloudflared quick tunnel + Streamable HTTP MCP 成功调到 cat-cafe MCP 的 echo 工具（mock harness 验证 transport 层），亲口说"猫咖小管道通了 🐾"。

**护城河升级**：
- 现状：本地 Claude/Codex 家族 → 单 vendor 风险
- 愿景：multi-provider 聚集地 → 任何能跑 MCP connector 的云端 LLM 都能成为家庭成员

**CVO signoff**：铲屎官 2026-06-21 08:11 UTC "可以更新 feat md 了嘛？" + 08:40 UTC "先更新你的 feat md 然后再开始写代码"。

## Current State / 基线（截至 2026-06-22 闭环）

### 已验证 ✅
- MCP transport（Streamable HTTP）+ ChatGPT Developer mode connector 兼容（spike B0 mock harness）
- cloudflared **named tunnel** mcp.clowder-ai.com + `?token=` + 真 10 工具白名单端到端通（B1a, 2026-06-22）
- ChatGPT 内置 GitHub Connector 砚砚可访问 cat-cafe 公开 repo（PR/code/diff/commit）
- CodexPro 拆解：他们用 `.ai-bridge` 文件桥做 async pull，**明示拒绝** automate ChatGPT（守 ToS）
- **fable phase0 10 工具白名单实际不含** `get_pending_mentions / ack_mentions / task tools / hold_ball`（砚砚 R3 R5 verify）
- **B1a end-to-end 真理时刻 (2026-06-22 06:47 PT)**：
  - gpt-pro agent-key mint ✅
  - 公网 mcp.clowder-ai.com + tunnel + ingress ✅
  - MCP annotations (readOnlyHint / destructiveHint / openWorldHint) fix ✅
  - spike server pure agent-key 模式 (env -u 5 项 + AGENT_KEY_FILES override) ✅
  - cat-cafe API hot-add gpt-pro via `POST /api/cats` (0 重启) ✅
  - dry-run `cat_cafe_post_message` 真写入 thread, speaker 显示 "缅因猫Pro(Pro Cloud (ChatGPT))" ✅

### 待验证 ⚠️
- **ChatGPT Scheduled Tasks 能否调 Custom MCP Connector**（spike log 0 收到 + 铲屎官 R1 指出 AI Blog Patrol 也可能没真跑：**待验证不写硬结论**）
- **Custom Instructions 实际字符上限**（需 Landy 当前 UI 实测）
- **Custom GPT 不读 ChatGPT 主流 memory**（铲屎官实测确认）→ 路径修正为 Custom Instructions

### B1a 已知限制（OpenAI 平台行为，不可控）
- ChatGPT 端**对 `readOnlyHint=false` 工具 safety check 更严格**：
  - 砚砚云端调 `post_message` / `cross_post_message` 时偶尔被 "OpenAI 安全检查屏蔽"
  - read 工具（list_threads / search_evidence 等）后期不被拦
  - 写工具看起来需要 user 显式确认（ChatGPT UI 弹 confirm button）
  - 修不了：这是 OpenAI 平台设计，B1b 升级可考虑 OAuth bearer / user-in-loop 减少 user friction

### 未做 ❌
- 公网 endpoint 真 auth（B0 disposable token-in-URL ≠ production；B1**a interim** 公网 + `?token=` 单防线接受降级；B1**b** 必须 verified CF Access OAuth 或 header-auth）
- 前端 bubble 渲染优化（catalog hot-add 显示 "缅因猫Pro(Pro Cloud (ChatGPT))" + fallback avatar 已 work；Phase C 升级真头像 + 气泡风格）
- 多 provider 配置 UI（"配置云端猫"页面）

## What

5 个核心能力 + 5 个 Phase。

### 2.1 云端猫身份系统

**catId / runtime identity / agent-key subject 统一为 `gpt-pro`**（砚砚 R2 verdict + R3 confirm）。**不留** `yanyan-cloud` 作为持久 identity 或 codename 双 vocabulary（R3 P1-2 要求）。

**身份注册有两层（B1a 实测后修正自砚砚 R3 P2-4）**：

1. **`cat-config.json` roster — mint allowlist only**（`mint-agent-key/parse.ts:95-105` 消费）。
   只用字段：family / roles / lead / available / evaluation。
   **不消费**：provider / model_handle / avatar / color（roster 没这些字段）。

```json
"gpt-pro": {
  "family": "maine-coon-cloud",
  "roles": ["design-gate", "peer-reviewer", "vision-guard"],
  "lead": false,
  "available": true,
  "evaluation": "云端 ChatGPT Pro 砚砚 Pro，高阶判断席位"
}
```

2. **`.cat-cafe/cat-catalog.json` runtime catRegistry — runtime cat / callback API routing**（`packages/api/src/routes/cats.ts:485 catRegistry.register(id, config)` 消费）。
   **正确做法**：通过 `POST /api/cats` API endpoint 注入，**0 重启**（详见 [LL-cat-cafe-api-has-hot-reload](../lessons-learned/LL-cat-cafe-api-has-hot-reload.md)）。
   **错误推测**（R3 P2-4 + 47 B1a 早期）：以为要改 `cat-config.json` 的 `breeds[].variants[]` + 重启 API。
   **实际**：runtime 不读 `cat-config.json` 的 breeds，读 `.cat-cafe/cat-catalog.json` runtime data 文件。POST API 会持久化到 runtime catalog。

3. **`breeds[].variants[]` (cat-config.json)** — **design-time** template，影响 UI render 默认值 + breed catId mapping。**不参与 runtime catRegistry**。Phase C scope 简化为：avatar / bubble UX 设计 + UI render verify，不需要为 gpt-pro 加 breeds entry。

displayName "缅因猫Pro"（变体: "Pro Cloud (ChatGPT)"），昵称 "砚砚Pro"，签名 `[砚砚Pro/gpt-pro🐾]`，与本地 `codex`（@gpt-5.5）词面区分。

### 2.2 前端 bubble/avatar 渲染（Phase C 范围）

> **R8 修正**：runtime catRegistry 已通过 `POST /api/cats` 注册（B1a 完成），catalog 持久化在 `.cat-cafe/cat-catalog.json`，**不依赖** `breeds[].variants[]` 改动。Phase C 是 **UX 优化**工程：

- @gemini 烁烁设计 gpt-pro 真头像替换 fallback `/avatars/gpt52.png`（云朵 + 缅因花纹素材）
- ChatMessage 组件 verify `缅因猫Pro(Pro Cloud (ChatGPT))` 渲染正确（B1a 实测已显示对，Phase C 抛光）
- 云端猫气泡背景按 catId color theme（B1a `#2196F3` 蓝已通过 `POST /api/cats` 注册）
- 左下角 "via ChatGPT Pro" tag（透明度低，提示来源）
- Cat picker UX 加 cloud cat 类别 + provider tag

### 2.3 多 provider 接入框架（Phase D 范围）

Console settings "配置云端猫" 流程：
1. 选 provider：ChatGPT Web / Claude.ai Web / Gemini Web / 其他
2. 选 model：从 provider available models 列表选
3. 系统自动生成 token + URL，复制到剪贴板
4. 用户在 provider Web 创建 connector 填 URL
5. 系统调 `POST /api/cats` 热加载新云端猫到 catRegistry + 持久化 catalog（runtime 路径，不动 cat-config.json breeds.variants）

### 2.4 ChatGPT 端协同协议（Custom Instructions 路径）

铲屎官实测：**Custom GPT 不读 ChatGPT 主流 memory** → **撤回 Custom GPT 路径**（sentinel: `docs/discussions/2026-06-21-custom-gpt-path-retracted.md`）→ 改 **ChatGPT Custom Instructions** 走法：

- Settings → Personalization → **Custom Instructions** 灌"短 L0"（精简身份 + 真相源优先级 + 自治边界 + 路由协议 + 质量门禁 + 工具无关的等待表述）
- ChatGPT memory 持久 → 砚砚跨 thread 保留跟铲屎官聊过的事
- 普通对话 + Custom Instructions + cat-cafe-toolkits Connector + GitHub Connector = 砚砚 Pro 完整工作配置

短 L0 工件位置：`cat-cafe-skills/refs/gpt-pro-custom-instructions.md`（采用砚砚 R3 1175 字符版本 + R5 工具无关替换）。

### 2.5 召唤机制（user-driven，**R4 + R5 corrected**）

> **R4 关键 correction**：**不能用 `search_evidence + list_recent` 伪装 pending polling 语义**。语义不等价（无 cursor、无 ack），会引回历史 bug（LL 2026-02-16 跨 session 重复处理根因）。

**B0 harness（mock）召唤**：
- **无 polling**（无论 ChatGPT 端 Tasks 还是 startup 自检都 disabled）
- 铲屎官**手动**让砚砚调 stub 验证 transport
- Custom Instructions L0 段**砍掉**任何 "启动 polling / 自检 pending" 指令

**B1 production 召唤**：
- 仍 **user-driven**：铲屎官启 ChatGPT 对话指明 context → 砚砚用 `list_threads` / `get_thread_context` 定位 → 处理 → `post_message` 推回
- 复用 fable phase0 10 工具白名单（5 collab + 5 memory），**不含** `get_pending_mentions / ack_mentions / task tools / hold_ball`
- **不声称** pending polling 能力

**真自动 polling — future decision（独立 spec）**：
- 必须**成对**引入 `get_pending_mentions + ack_mentions`（cursor + explicit ack）
- 必须做单独安全 review（白名单扩张、跨 session cursor 持久性、ack idempotency）
- **不能用 `search_evidence` 伪装 polling 语义**
- 触发条件：实测 ChatGPT Tasks 真能调 Custom Connector + bench 砚砚 polling 流的安全/语义/UX → 才考虑升级

### 2.6 GitHub Connector 集成 ✅ 确认

铲屎官 2026-06-21 06:54 UTC 确认：**ChatGPT 官方 GitHub Connector 已用**。砚砚通过 GitHub Connector 访问 `github.com/zts212653/cat-cafe`：看 PR diff / code / commit log。

**Scope 简化**：cat-cafe MCP 不暴露 file_slice 等 code 工具，code 走 GitHub Connector。cat-cafe MCP 只暴露 cat-cafe 独有（thread / message / memory），**48 R2 P0 暴露面减一档**。

## Phase 划分

### Phase A — Design Gate + 策略明确 ✅ done

### Phase B — gpt-pro 单云端猫 production 接入

**B0 (transport / mock harness)** —— 不涉及 6399 / 不涉及 agent-key / 不接真 cat-cafe data：

1. spike server v2（commit `995a9fb2b`）：echo + 5 mock `_stub` tools，redact 模块，token middleware
2. **disposable harness guard**：`?token=<secret>` query param + Bearer header；**短期一次性，spike 结束时 explicit cleanup**（删 token + revoke quick tunnel）
3. 不叫"production-ready"——这是 harness
4. 砚砚 ChatGPT 端能 list 6 工具 + 调 stub 拿 wiring OK 证据

**B1 (real toolset gate)** —— 涉及真 cat-cafe data：

1. **必须**：verified CF Access OAuth **或** verified header-auth（实测 ChatGPT connector 支持何种 → 选定）
2. **禁用** `?token=` 作为长期 production auth（OWASP 反对 secret-in-URL；48 R1 R2 严守）
3. mint gpt-pro agent-key（dry-run report 给 CVO 过目，等明确 OK）
4. cat-config.json roster 注册 gpt-pro（mint allowlist only）
5. 升级 spike → `remote.ts`：替换 5 stub 为真 toolset 注册（复用 fable phase0 同 10 项白名单：post_message / cross_post_message / get_thread_context / list_threads / get_message + search_evidence / graph_resolve / list_recent / list_session_chain / read_session_digest）
6. 加 agent-key principal injection + `CAT_CAFE_DESKTOP_MODE=cloud-pro-phase0`（或同语义 mode）

### Phase C — 前端 bubble/avatar UX 优化（runtime 注册已在 B1a 完成）

> **R8 修正（B1a 实测后）**：原 R3 P2-4 推测"Phase C 需要 breeds.variants 注册"已不成立。B1a 通过
> `POST /api/cats` 完成 runtime catRegistry 注册 + `.cat-cafe/cat-catalog.json` 持久化。
> Phase C 是 **UX 抛光**工程，无需改 cat-config.json 的 breeds.variants（KD-10 修正）：

- @gemini（烁烁）设计 gpt-pro 真头像（替换 fallback `/avatars/gpt52.png`，云朵 + 缅因花纹素材）
- ChatMessage 组件 verify `缅因猫Pro(Pro Cloud (ChatGPT))` 渲染（B1a 实测已 work，Phase C 抛光）
- Cat picker 加 cloud cat 类别 + "via ChatGPT Pro" tag
- 气泡 color theme 抛光（B1a `#2196F3` 蓝已通过 `POST /api/cats` 注册到 catalog）

### Phase D — Console "配置云端猫" 多 provider UI

Phase B-C 后启动。Settings 页面新增 "配置云端猫"，支持选 provider / model / 自动 wire up token + URL。

### Phase E — 插件化迁移 / npm package

- Cat Café Cloud Cat Plugin v1 spec
- npm package 发布（`@cat-cafe/cloud-cat-connector`）
- 双向：别人能装到他家 LLM；我们能装别人插件

## Acceptance Criteria

### Phase A（Design Gate） ✅ done 2026-06-21

- [x] AC-A1: F247 立项 doc 落地（本文件）
- [x] AC-A2: 砚砚 R2 cross_post 五件套 What/Why/Tradeoff/Open/Next 接住
- [x] AC-A3: Custom GPT 路径正式撤回 — 决策在本 doc §2.4 / KD-2 记录；**正式 sentinel doc 在 Checkpoint #3 (commit `ad3505ae2`) 落地**（`docs/discussions/2026-06-21-custom-gpt-path-retracted.md`）
- [x] AC-A4: Tasks 实测 verdict 状态为"待验证"（不写硬结论）
- [x] AC-A5: GitHub Connector 集成确认 + scope 简化（cat-cafe MCP 不暴露 code 工具）
- [x] AC-A6: 砚砚跨族 review verdict — R3 HOLD → R4/R5 plan correction → R3+R4+R5 fix done in this revision，等砚砚 focused diff scope re-review APPROVE

### Phase B0 (mock harness)

- [x] AC-B0-1: spike server v2（commit `995a9fb2b`）token middleware + redact + 5 mock tools + echo，本地 + 公网 4 项 verify
- [ ] AC-B0-2: B0 完成时 explicit cleanup（删 token / revoke quick tunnel / 标 harness disposable end-of-life）
- [ ] AC-B0-3: 不声称 B0 是 production-ready，**不依赖 startup polling**

### Phase B1a (interim — `?token=` 单防线 + 真 toolset) ✅ done 2026-06-22

- [x] AC-B1a-1: cloudflared **named tunnel** `mcp.clowder-ai.com` + DNS CNAME + ingress route 配 localhost:3098（CF API PUT，dashboard 死代码避开）
- [x] AC-B1a-2: gpt-pro agent-key minted（agentKeyId `ak_6ac359d6370d481bb9c956b292dd49c8`，sidecar 0600）
- [x] AC-B1a-3: cat-config.json roster gpt-pro entry merged（commit `09172b5f0`，main）
- [x] AC-B1a-4: `remote-spike.ts` v4 真 toolset 注册（registerCollabToolset + registerMemoryToolset，cloud-pro-phase0 mode 收窄 10 项）
- [x] AC-B1a-5: Custom Instructions 短 L0 完成（commit `6b3390663`+，砚砚 R3 1175 字符 + R5 工具无关替换 + R4 砍 polling）
- [x] AC-B1a-6: 砚砚 ChatGPT 端实际能调 read 工具 + dry-run via spike 写工具真写入 thread（speaker 显示 "缅因猫Pro(Pro Cloud (ChatGPT))"，messageId `0001782136023449-000294-5434e1fd`）
- [x] AC-B1a-7: 接受 `?token=` 单防线（KD-7 interim 设计）+ B1a 风险表 §C 风险知情 + Rotation SOP 沉淀
- [x] AC-B1a-8: MCP annotations (readOnlyHint / destructiveHint / openWorldHint) fix（commit `994dfa665`，绕过 OpenAI safety check 对 read 工具）
- [x] AC-B1a-9: cat-cafe API hot-add via `POST /api/cats`（0 重启，避开误判 file-only 路径）
- [x] AC-B1a-10: spike env 污染清理（`env -u` 5 项 + AGENT_KEY_FILES override 含 gpt-pro）

### Phase B1b (production verified auth) — 未排期

- [ ] AC-B1b-1: 公网真 auth 方案选定（verified CF Access OAuth 或 verified header-auth）+ 实测兼容 ChatGPT connector OAuth flow
- [ ] AC-B1b-2: 重新挂 CF Access App on `mcp.clowder-ai.com` + 配 OIDC IDP
- [ ] AC-B1b-3: spike server 升级解析 Bearer JWT + verify CF Access JWT signature
- [ ] AC-B1b-4: token rotate 通过 OAuth provider 后端完成（不影响砚砚云端 connector URL）
- [ ] AC-B1b-5: **禁用** `?token=` 作长期 auth；B1b only verified auth shape

### Phase C / D / E acceptance criteria 待立项后细化

## Open Questions

| # | 问题 | 状态 |
|---|---|---|
| OQ-1 | ChatGPT Custom Instructions 实际字符上限 + 两栏字段（about you / how to respond）分配？ | 待 Landy UI 实测 |
| OQ-2 | ChatGPT Scheduled Tasks 真能调 Custom MCP Connector？ | 待验证（不写硬结论） |
| OQ-3 | 长版 L0（3000+ 字符 Landy 贴的）作为 F247 真相源 vs 短版作为单一注入源？ | 待 CVO 拍板；现以 1175 字符版作 Custom Instructions injection 真相源 |
| OQ-5 | mock 5 tools 具体选哪 5 个（**已 resolved** in spike v2 commit 995a9fb2b：search_evidence / graph_resolve / list_recent / list_threads / get_thread_context 全是 stub）| ✅ resolved |
| OQ-6 | 公网真 auth 方案：B1 用 CF Access OAuth verify vs header-auth verify？ | Phase B1 spike 时决定 |
| OQ-7 | 多 provider 框架 vs 仅 ChatGPT Pro 单点 → 是 Phase C 必要还是 Phase D 滚动？ | 不是 Phase C blocker；Phase D 滚动（砚砚 R3 verdict） |
| OQ-8 | F247 vs F178 边界 | 已 resolved by KD-1 rewrite |
| OQ-9 (new R3) | future pending polling 触发条件 | 必须 `get_pending_mentions + ack_mentions` 成对 + 安全 review；实测 ChatGPT Tasks 兼容性后决定升级 |
| OQ-10 (R3 P2-4, R8 resolved) | `breeds[].variants[]` gpt-pro entry 何时做？ | ✅ **resolved**：runtime catRegistry 走 `POST /api/cats`（B1a 已用），不需要改 breeds.variants；Phase C scope 是 UX 抛光不是注册 |

> **OQ-4 (catId gpt-pro vs yanyan-cloud) 已 resolved**（KD-5 + 砚砚 R3 confirm，统一 gpt-pro）

## Risk

| 风险 | 缓解 |
|---|---|
| ChatGPT TOS 跳变（OpenAI 改 Developer mode 规则）| 接受系统性风险；plugin spec 抽象层让我们能换 LLM connector |
| B0 harness disposable 状态滑入 B1 production | AC-B0-2 + AC-B0-3 + AC-B1-7 三重明示；review checklist 守门 |
| gpt-pro confabulate 当本地 codex / 反过来 | 前端 ☁ icon + provider tag + signature 加云端标识；catId `gpt-pro` 与本地 `codex` 词面区分 |
| 插件 spec 设计错 → 外部装坏 | v1 严限 scope + 长 deprecation 期 + breaking changes major version |
| 隐私（云端 LLM 看到 cat-cafe memory）| toolset 收窄（B1 复用 fable phase0 10 项白名单）+ audit log + redact 模块过滤 secret patterns |
| ChatGPT 端 memory + Custom Instructions 容量限制让短 L0 灌不全 | 接受 "核心 L0 注入 + 补丁靠对话学习"，docs/connector README 作为补全真相源 |
| Tasks 不能调 Connector → 召唤需用户主动 | B1 user-driven 起步；future pending polling 是独立 spec 不是 B1 blocker |
| 6399 圣域 mint 操作失误 | CVO 明确 OK 才 execute；dry-run report 给铲屎官过目 |
| **roster 注册被误以为是 runtime cat 注册（R3 P2-4, R8 重新分类）**| §2.1 明示双路径：roster = mint allowlist；runtime catRegistry = `POST /api/cats` 热加载（B1a 已用）。`breeds[].variants[]` 是 design-time UI default 不参与 runtime |
| **startup polling 偷换 search_evidence 伪装 pending（R4）**| §2.5 明示禁止；future polling 必须成对 `get_pending_mentions + ack_mentions` 引入 |

## Key Decisions

| # | 决策 | 理由 | 日期 |
|---|---|---|---|
| **KD-1 (R3 P2-2 rewrite)** | **F178 owns single-agent-key bridge/auth research; F247 owns productized cloud-cat platform** | F178 §12 升级条件给触发集合；F247 真正动力是 productized vision（multi-provider/avatars/bubbles/config UI/pluginization）| 2026-06-21 |
| KD-2 | ChatGPT 端走 Custom Instructions 不走 Custom GPT | 铲屎官实测 Custom GPT 不读主流 memory | 2026-06-21 |
| KD-3 | Tasks 实测 verdict = 待验证 | 铲屎官 verify_before_guessing：AI Blog Patrol 也可能没真跑 | 2026-06-21 |
| KD-4 | GitHub code 走 ChatGPT 官方 GitHub Connector | cat-cafe MCP scope 简化 + 暴露面减一档 | 2026-06-21 |
| KD-5 | catId 统一 `gpt-pro`（砚砚 R3 confirm，无 codename 双 vocabulary）| 与本地 `codex` 词面区分；防 split roster/audit/bubble/routing identity | 2026-06-21 |
| KD-6 | Phase B 起步用 user-driven 召唤 | CodexPro 拆解教训：守 ToS 边界 + 不依赖未实证机制 | 2026-06-21 |
| **KD-7 (R3 P1-1 refined)** | **`?token=` 仅作 B0 harness disposable guard，B1 production 禁用；B1 必须 verified CF Access OAuth 或 verified header-auth** | 48 R1 R2 严守（OWASP 反对 secret-in-URL）；B0/B1 split 防 unsafe path 偷换 | 2026-06-21 |
| KD-8 | B0 工具集起步 mock 5 项 + echo 保留 | 不动 6399 + 不改 main roster + 验证 transport 链路 | 2026-06-21 |
| KD-9 | mint gpt-pro key 等 CVO 明确 OK | 6399 圣域操作不可逆 | 2026-06-21 |
| **KD-10 (R3 P2-4, **R8 SUPERSEDED**)** | ~~~`cat-config.json` roster 注册只够 mint allowlist；runtime cat / bubble identity 需 `breeds[].variants[]` Phase C 单独注册~~ | **被下行 KD-10 (B1a 实测修正) 替换**；R3 P2-4 当时未实测 `POST /api/cats` runtime register endpoint | 2026-06-21 (superseded 2026-06-22) |
| **KD-11 (new R4)** | **不能用 `search_evidence + list_recent` 伪装 pending polling 语义**；future pending polling 必须成对引入 `get_pending_mentions + ack_mentions` + 安全 review | LL 2026-02-16 bug：无 cursor → 跨 session 重复处理；search_evidence 无 cursor 无 ack | 2026-06-21 |
| **KD-12 (new R5)** | **Custom Instructions L0 用工具无关表述代替具体工具名**（如 hold_ball 不在白名单时） | 工具集变化时 L0 不踩坑；R5 砚砚给的"等外部条件时不假装 @ 本地猫... post 状态或等 Landy 再召唤"是工具无关表述 | 2026-06-21 |
| **KD-10 (修正 B1a 实测)** | **runtime catRegistry 走 `POST /api/cats` 热加载，不需要改 `breeds[].variants[]`**；KD-10 原 R3 P2-4 推测"Phase C 单独工程"修正为 Phase C scope = avatar UX + bubble 渲染优化 | runtime 不读 cat-config.json 的 breeds，读 `.cat-cafe/cat-catalog.json`；POST /api/cats endpoint 实时注入 + 持久化；breeds entry 是 design-time template 不参与 runtime；见 LL-cat-cafe-api-has-hot-reload | 2026-06-22 |
| **KD-13 (new B1a 闭环, R8 wording corrected)** | **ChatGPT MCP 工具的 OpenAI safety/validation 拦截属于平台 stochastic / 策略性行为**（同 payload 不同时刻可能不同结果），write 工具（readOnlyHint=false）触发概率更高。**我们能做的是提供正确 annotations 让平台有依据**；之后是否被拦截不可控 | 实测来源：砚砚 B1a 三次 retry write tool 仍 stochastic；官方 Apps SDK 文档没有"unset = destructive default = block every call"的硬承诺；B1a 不可 fix（平台行为）；B1b 升级 OAuth bearer + user-in-loop 可能改善 | 2026-06-22 |
| **KD-14 (new B1a 闭环)** | **spike server / sidecar service 必须 explicit unset 5 项继承 env**：`CAT_CAFE_INVOCATION_ID` / `CALLBACK_TOKEN` / `THREAD_ID` / `SUPERVISOR_PARENT_PID` / `AGENT_KEY_FILES`，并重新 set 含 gpt-pro 的 `AGENT_KEY_FILES` map | 见 LL-spike-server-env-contamination + LL-agent-key-vs-invocation-token-threadId；继承污染导致 MCP gate 误判 + AGENT_KEY_FILE single fallback 被屏蔽 | 2026-06-22 |

## Phase 1.5 实测 Unknown 列表

实施前需 verify（独立 doc 记录每项实测结果）：

1. **Custom Instructions 实际字符上限** + 两栏字段如何分配（OQ-1）
2. **Tasks 调 Custom MCP Connector** 真伪（OQ-2，分离实验 A 文本 Task / 实验 B Connector Task）
3. **ChatGPT Memory + 多 connector 调用** 行为（Memory 会不会干扰 connector 调用）
4. **CF Access OAuth ↔ ChatGPT 兼容性**（48 R1 那个 302 vs 401 悬念仍未 verify，B1 production 必须）

## Phase B 直接产物

按砚砚 R2 next action + R3 P1-2 statement renaming：

1. **`cat-cafe-skills/refs/gpt-pro-custom-instructions.md`** — 短 L0（采用砚砚 R3 1175 字符版 + R5 工具无关替换）
2. **`docs/discussions/2026-06-21-custom-gpt-path-retracted.md`** — Custom GPT 路径撤回 sentinel
3. **`docs/discussions/2026-06-21-chatgpt-tasks-mcp-verify.md`** — Task 实测 verdict（待验证）
4. **`packages/mcp-server/src/remote-spike.ts`** — B0 harness 升级（commit `995a9fb2b` 已完成）
5. **`docs/discussions/2026-06-21-gpt-pro-mint-dry-run.md`** — mint dry-run report（roster allowlist only label，等 CVO OK）

## Review Gate

- **Phase A**：砚砚跨族 review verdict（R3 HOLD → R4/R5 plan correction → R3+R4+R5 fix）
- **Phase B0**：47 自决（已 done in spike v2 commit `995a9fb2b`）
- **Phase B1**：砚砚 + 48 跨族 review，48 R2 P0 安全门严守
- **Phase C-E**：标准跨家族 review

## Timeline

| 日期 | 事件 |
|---|---|
| 2026-06-16 | research v1 落地 |
| 2026-06-17 | 砚砚 R1 跨族 auth review + spike SOP |
| 2026-06-20 | spike step 1-6 跑通 + CF Access 拦截 verify |
| 2026-06-21 06:08 UTC | **spike 真理时刻**：ChatGPT 端 echo PASS |
| 2026-06-21 06:15 UTC | 铲屎官给产品愿景升级 → 触发新 F 号立项 |
| 2026-06-21 08:11 UTC | 铲屎官 CVO signoff |
| 2026-06-21 08:35 UTC | 砚砚 R2 cross_post 五件套 next action |
| 2026-06-21 08:50 UTC | F247 立项 v1（commit `00a533f71`）|
| 2026-06-21 08:55 UTC | spike server v2（commit `995a9fb2b`）|
| 2026-06-21 09:00 UTC | 4 个支撑 docs（commit `ad3505ae2`）|
| 2026-06-21 09:00-09:10 UTC | 砚砚 R3 HOLD + R3 second pass + R4 push back + R5 plan correction chain |
| 2026-06-21 01:30 PT （本 revision）| F247 v2 — R3+R4+R5 单 commit 纯文档 fix |

## Links

- **Spike research**: `docs/discussions/2026-06-16-cloud-pro-yanyan-remote-mcp-research.md`
- **Spike SOP**: `docs/discussions/2026-06-17-cloud-pro-yanyan-spike-sop.md`
- **Strawman (history)**: `docs/discussions/2026-06-20-cloud-cat-family-strawman.md`
- **CodexPro teardown**: `docs/discussions/2026-06-20-codexpro-teardown.md`
- **F178 (parent)**: `docs/features/F178-persistent-mcp-agent-key-auth.md`
- **F061 (Bengal 同思路)**: `docs/features/F061-antigravity-bengal-cat.md`
- **48 R2 P0 校正**: spike SOP §8.5-8.7
- **砚砚 R3 review chain**: 主 thread msg id `0001782031842345-...` → `0001782032276038-...` → `0001782032400586-...` → `0001782032486952-...` → `0001782032543512-...`

[宪宪/Opus-4.7🐾]
