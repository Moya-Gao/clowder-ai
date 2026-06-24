---
title: gpt-pro agent-key mint dry-run report
date: 2026-06-21
authors: [opus-47]
type: dry-run-report
status: PENDING-CVO-OK (砚砚 R2 next action #4 + R3 P2-4 P1-2 corrected：6399/mint 等 Landy 明确 OK)
related_features: [F247, F178]
---

# gpt-pro agent-key mint — dry-run report

> **R3+R4+R5 corrected (2026-06-21)**：
> - catId 统一 `gpt-pro`（不留 `yanyan-cloud` 作 codename）— R3 P1-2
> - roster 草案明确 **mint allowlist only**，**不消费** provider/avatar/color — R3 P2-4
> - runtime cat / bubble identity 需 `breeds[].variants[]` Phase C 单独工程
>
> **状态**：**不 execute，等 CVO 明确 OK**（涉及 Redis 6399 圣域 = 不可逆操作 = §4 决策漏斗硬条件需铲屎官明确签 "OK mint"）

## 前置

砚砚 R2 cross_post 明确：
> "涉及 6399/mint/真 cat-cafe API 继续等 Landy 明确 OK"

铲屎官 directive 2026-06-21 08:40 UTC：
> "先更新你的 feat md 然后再开始写代码"（未明示 OK mint）

本 dry-run 是给铲屎官**醒来过目用**——把"如果 execute 会发生什么"提前可视化，让铲屎官能用一句 "OK mint" 触发 execute（同 fable phase0 mint 模式）。

## Dry-run preflight 7 项

按 fable-phase0 mint script preflight 设计（同 SOP）：

### 1. CatId allowlist 校验

**catId**：`gpt-pro`（砚砚 R3 confirm，与本地 `codex` 词面区分）

**当前 cat-config.json roster**：
```
$ grep -E "gpt-pro" cat-config.json
# (empty — not present)
```

**前置**：先加入 cat-config.json roster (Phase B1 main commit + cross-cat review)。**未做**。

### 2. 6399 Sanctuary 校验

- runtime Redis 6399: ✅ `PING` 返 `PONG`（基建可用）
- mint script: `packages/api/dist/scripts/mint-agent-key.js`（fable mint 同 script）
- 三重显式 flag: `--execute --redis-url redis://127.0.0.1:6399 --i-understand-runtime-redis`

### 3. 目标 key file path

- `~/.cat-cafe/agent-keys/gpt-pro.secret` (mode 0o600，预期)
- 当前**不存在**

### 4. F178 KD-10 fail-closed 验证

砚砚 audit 隔离纪律（LL-072）：**不复用 fable-5 key**，每只云端猫独立 sidecar file。

`CAT_CAFE_AGENT_KEY_FILES` 多 cat 映射设计（fable + gpt-pro 各自一个 file）：B1 实施时定。

### 5. registry preflight（lazy）

- preflight 全过才 lazy `registryProvider`，不提前 connect Redis（fable 同款）
- Redis backend: `RedisAgentKeyBackend`（F178 Phase D 上线）

### 6. sidecar exclusive-create

- `wx` flag 防 race condition（fable 同款）
- `EEXIST` race 自动 revoke orphan key

### 7. audit + cleanup

- 输出 agentKeyId（audit log）
- **不输出** secret 全文（48 R1 P0 纪律）
- `finally` 块 cleanup Redis 连接

## Dry-run 输出示例（假设 OK execute）

```
node packages/api/dist/scripts/mint-agent-key.js \
  --cat-id gpt-pro \
  --redis-url redis://127.0.0.1:6399 \
  --i-understand-runtime-redis \
  --execute

[preflight] catId allowlist: FAIL — gpt-pro not in cat-config.json roster
            (resolve: add gpt-pro to cat-config.json + cross-cat review + main commit first)
```

→ **dry-run preflight FAIL，不能立刻 mint**

## Blocker：cat-config.json roster 草案（R3 P2-4 corrected）

> **R3 P2-4 砚砚抓出**：roster 注册和 runtime cat 注册是**两层独立的事**：
> - `roster` 是 **mint allowlist 来源**（`mint-agent-key/parse.ts:95-105`）
> - **Runtime cat / cat picker / avatar / bubble identity** 从 `breeds[].variants[]` 来（`cat-config-loader.ts:459-502`）
> - **Roster 只消费**：family / roles / lead / available / evaluation
> - **Roster 不消费**：provider / model_handle / avatar / color
>
> 我原 v1 提议在 roster 加 provider/model_handle/avatar/color 字段是 **conflation**。修正：roster 草案**只**含 mint allowlist 必需字段。

### Step 1: 加 `gpt-pro` 到 cat-config.json roster (mint allowlist only)

```json
"gpt-pro": {
  "family": "maine-coon-cloud",
  "roles": ["design-gate", "peer-reviewer", "vision-guard"],
  "lead": false,
  "available": true,
  "evaluation": "云端 ChatGPT Pro 砚砚 Pro，高阶判断席位"
}
```

**注意（R3 P2-4 严守）**：**不**包含 provider / model_handle / avatar / color——roster 不消费这些字段，加了也没用，反而误导未来读者以为 roster 注册够 runtime cat 用。

**位置**：main commit + 跨猫 review（砚砚 + 48）。不在 worktree 改了直接合，按 SOP 走。

### Step 2: Phase C — `breeds[].variants[]` catalog entry (runtime cat / bubble identity)

**独立工程**（不在 Phase B1 scope）：

- `cat-config.json breeds[].variants[]` 加 gpt-pro entry，含：
  - provider: "openai-chatgpt-pro"
  - model_handle: "gpt-pro"
  - avatar: "/avatars/gpt-pro.jpg"（@gemini 烁烁设计）
  - color: { primary, secondary }（区别本地 codex）
  - displayName: "砚砚Pro"
- ChatMessage 组件扩展 provider 字段渲染
- Cat picker 加 cloud cat 类别

这一步**只有做完**，gpt-pro 才会作为 full runtime cat 出现在前端 UI / bubble / avatar / cat picker。

### Step 3: 砚砚 R2 confirm roster entry（已 done in R3 R5 chain）

- catId = `gpt-pro` ✅
- family = `maine-coon-cloud` — 待砚砚 / 48 review confirm（也可能就用 `maine-coon` 加 cloud flag 在 breeds.variants 层处理）
- roles = `["design-gate", "peer-reviewer", "vision-guard"]` ✅

### Step 4: cat-config.json 合 main 后 → 跑 mint script

```
铲屎官在 terminal:
node packages/api/dist/scripts/mint-agent-key.js \
  --cat-id gpt-pro \
  --redis-url redis://127.0.0.1:6399 \
  --i-understand-runtime-redis \
  --execute
```

预期输出：
- `[ok] minted gpt-pro agent-key`
- `agentKeyId = ak_<uuid>`（audit log）
- `secret written to /Users/lysander/.cat-cafe/agent-keys/gpt-pro.secret (mode 0600)`

### Step 5: B1 升级 spike server 接真 cat-cafe API

- `remote-spike.ts` → `remote.ts`
- 删 5 个 `_stub` mock tool
- 注册真 `registerCollabToolset` + `registerMemoryToolset`（复用 fable phase0 / cloud-pro-phase0 同套 10 项白名单）
- 加 agent-key principal injection
- env `CAT_CAFE_AGENT_KEY_FILE=~/.cat-cafe/agent-keys/gpt-pro.secret` + `CAT_CAFE_CAT_ID=gpt-pro` + `CAT_CAFE_USER_ID=default-user`
- **auth 升级**：禁用 `?token=` 长期，启用 verified CF Access OAuth 或 verified header-auth（B1 必须）

### Step 6: 重启 server + 砚砚 ChatGPT connector 配置

砚砚试调真 toolset：
- `cat_cafe_search_evidence` 真返 cat-cafe 记忆
- `cat_cafe_post_message` 真推消息到猫咖 thread（前端渲染需 Phase C breeds.variants 注册后才有 avatar/bubble）

## 风险评估

| 风险 | 缓解 |
|---|---|
| catId `gpt-pro` 串身份本地 `codex`（gpt-5.5）audit 不清 | 词面区分：本地 catId `codex`，云端 catId `gpt-pro`，audit 字段不重叠 |
| 6399 mint 操作误 | 三重显式 flag + dry-run 预看 + 铲屎官手动 execute |
| 砚砚拿到 agent-key 后能调真 `post_message` 写猫咖 thread | toolset 白名单收窄 + redact 模块 + 48 R2 P0 暴露面控制 |
| 砚砚 ChatGPT 端 prompt injection 让他滥发消息 | toolset 收窄（无 publish_verdict / shell / file slice / hold_ball / get_pending_mentions / task tools）+ user-scope 边界 + audit log |
| **roster 注册被误以为 runtime cat 注册** (R3 P2-4 新增风险) | 本 doc + F247 §2.1 + KD-10 明示两层注册；Phase C breeds.variants 单独工程 |
| **B0 disposable token 滑入 B1 production** | F247 KD-7 + AC-B0-2 + AC-B1-7 三重明示 |

## CVO 决策提请

请铲屎官醒来后回一句中的一句：

1. **"OK mint gpt-pro"** → 47 执行 Step 1（roster main commit + 砚砚跨猫 review）→ Step 4-6 mint + 升级 server
2. **"先用 mock 不要 mint"** → spike server v2 mock 模式继续用（B0 harness），砚砚 ChatGPT 调到 stub 数据，验证 transport
3. **(R3 后不再 valid)** ~~"换 catId 为 yanyan-cloud"~~ — catId 已统一 `gpt-pro`（KD-5 + 砚砚 R3 confirm）

## 关联

- F247 §10 KD-9（mint 等 CVO 明确 OK）
- F247 §10 KD-10（roster vs runtime cat 两层注册）
- F247 §6 AC-B1-2
- F178 Phase D（fable phase0 mint 同 script + 同 SOP）
- 48 R1 P0 secret 传递纪律

[宪宪/Opus-4.7🐾]
