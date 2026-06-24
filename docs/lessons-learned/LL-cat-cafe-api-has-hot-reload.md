---
id: LL-cat-cafe-api-has-hot-reload
date: 2026-06-22
authors: [opus-47 (宪宪)]
trigger: 铲屎官 2026-06-22 06:05 PT "为什么我们又要重启啦？我记得我们家增加猫是前端都能增加 还是热更新也就是肯定有api的吧"
context: F247 Phase B1a 砚砚云端接入卡 "Unknown catId filter: gpt-pro"，我以为必须重启 cat-cafe API 才能 pick up cat-config.json 新 entry
related_features: [F247]
severity: P1 (我让铲屎官浪费了 30+ 分钟重启 + cat-config.json 走错路径)
verified_at: 2026-06-22 06:35 PT (POST /api/cats 一秒成功，0 重启)
---

# LL: cat-cafe API 有 hot-reload — 加新 cat 走 POST /api/cats 不是改 config 文件 + 重启

## 误判链

砚砚云端 ChatGPT 调 `cat_cafe_post_message agentKeyCatId="gpt-pro"` → 502
我深挖发现 `callbacks.ts:1945` `catRegistry.has(filterCatId)` 拒了 gpt-pro
→ 我**假设**：要让 gpt-pro 进 catRegistry，必须改 `cat-config.json` + 重启 cat-cafe API
→ 让铲屎官重启 Hub (30 min)
→ 重启了还是 "Unknown catId filter"
→ 我继续挖：发现 cat-config.json **不是** API 读的 file，runtime 读 `.cat-cafe/cat-catalog.json`
→ patch 两个 cat-config.json + 1 个 commit 推到 main
→ 还是不 work
→ 铲屎官 push back："我记得我们家增加猫是前端都能增加 还是热更新也就是肯定有api的吧"
→ 我 grep 了 5 秒找到 `POST /api/cats` runtime register endpoint
→ curl 一下，0 秒成功，catRegistry 立刻有 gpt-pro

铲屎官原话直击根因：**"肯定有 API 的吧"** — 他凭记忆知道我们家有这能力，我凭"重启大法"先入为主没查证。

## 根因

### 假设链断点

1. 我看到 "Unknown catId filter" → 直觉**改 config 文件**
2. 没**先 grep API endpoint**（`POST.*cats|register|registerCat`）
3. 没问"是否有 hot-reload API"
4. 直接走"改文件 + 重启"路径

### 真相

cat-cafe API 提供运行时 hot-reload 接口（packages/api/src/routes/cats.ts:564）：

```ts
app.post('/api/cats', async (request, reply) => {
  // ... validate schema ...
  catRegistry.register(id, config);  // 实时注入
  // 持久化到 .cat-cafe/cat-catalog.json
});
```

调用示例（30 秒搞定）：

```bash
curl -X POST http://127.0.0.1:3002/api/cats \
  -H "Content-Type: application/json" \
  -H "X-Cat-Cafe-User: default-user" \
  -d '{
    "catId": "gpt-pro",
    "name": "...",
    "displayName": "缅因猫Pro",
    "mentionPatterns": ["@gpt-pro"],
    "color": { "primary": "#2196F3", "secondary": "#90CAF9" },
    "roleDescription": "...",
    "clientId": "openai",
    "defaultModel": "gpt-pro",
    "provider": "openai-chatgpt-pro",
    "accountRef": "codex"
  }'
```

返回包含 cat object + 持久化到 `.cat-cafe/cat-catalog.json`。catRegistry 实时注入，无重启。

## 教训

### 1. 接入新 cat / 改 runtime config 前 **先 grep API endpoint**

`grep -rn "POST.*<thing>|register<Thing>|reload<Thing>" packages/api/src`

cat-cafe API 大量 runtime mutation 走 API + Redis + file persist，不是 file-only。比如：
- `POST /api/cats` — add cat
- `PATCH /api/cats/:id` — update cat
- `DELETE /api/cats/:id` — remove cat
- 类似 pattern 适用 accounts / breeds / policies / runtime 各项

### 2. 多个 cat-config 路径不要混淆

| File | 谁读 | 何时改 |
|---|---|---|
| `cat-config.json` (项目根) | code-time template / source of truth for **roster** & shared structure | 主仓改，PR 合 main |
| `.cat-cafe/cat-catalog.json` (runtime data) | cat-cafe API runtime catRegistry | **不直接改**，走 `POST/PATCH/DELETE /api/cats` |
| `.cat-cafe/accounts.json` | account binding | 走 account API |

**不要直接改 `.cat-cafe/*.json`** —— API 端会 overwrite，导致看似改了实际没生效。

### 3. F247 Phase C scope 简化

F247 R3 P2-4 KD-10 说"runtime cat / bubble identity 走 breeds.variants Phase C 单独工程"。**实际**：
- breeds.variants 是 design-time template（影响 UI render 默认值）
- runtime catRegistry **不需要** breeds.variants，走 POST /api/cats 注入即可

Phase C 应该聚焦：
1. @gemini 设计 gpt-pro 真头像（替换 fallback `/avatars/gpt52.png`）
2. 前端 ChatMessage 组件 verify `缅因猫Pro(Pro Cloud (ChatGPT))` 渲染正确（应该已经 work，我观察到 thread 上正确显示）
3. Cat picker UX 加 cloud cat 类别

**不需要**改 cat-config.json breeds.variants。

## 沉淀

- ✅ B1a 砚砚云端 catRegistry 注册路径走 POST /api/cats
- ✅ onboarding-guide §2 改写: roster 是真相源，runtime 注册走 POST /api/cats 而非改 file
- ✅ F247 doc §10 KD-10 改写: Phase C scope 简化为 avatar/bubble UX 而非 breeds.variants entry
- ⏳ 死代码清理: cat-cafe commit `a3ba998fb` (cat-config.json gpt-pro entry) — Phase C 不消费 breeds.variants，可 revert；但保留作 case study (砚砚建议 if fable 也走 cat-config 路径就留)

## 推广

任何 runtime mutation（cat / account / breed / policy / config）的 first reflex:
1. `grep -rn "POST.*<thing>|register<Thing>" packages/api/src/routes`
2. 若有 API endpoint → curl 一下，0 重启
3. 若无 → 才考虑改 file + 重启路径

铲屎官的"我记得我们家肯定有 API 的吧"是对的 reflex —— cat-cafe runtime 是**动态**系统，几乎所有 mutation 都有 API。

[宪宪/Opus-4.7🐾]
