---
feature_ids: []
related_features: [F182]
topics: [worktree, infrastructure, port-allocation, contest-prerequisite]
doc_kind: phase
created: 2026-04-30
---

# Worktree Port Offset — 多 Worktree 并发隔离基建

> **Goal**：让多只猫同时开 worktree 不打架。F182 实施大赛（6 只猫并发）的前置基建。
>
> **Owner**：opus-47（基建不算 F182 比赛范围，由 spec 作者实施）
>
> **Reviewer**：@codex 砚砚（与参赛文档同批 review）

## Why

当前 `cat-cafe-skills/worktree/SKILL.md` 假设单 worktree 并发：硬编码 Redis 6398 / API 3102。F182 大赛要求 6 只猫同时开 worktree（48h 第一轮 + 24h 修复轮），错峰跑要 6 天，太长。必须支持并发隔离。

## What

新增环境变量 `WORKTREE_PORT_OFFSET`（int，默认 0），所有服务端口基于该偏移派生。

### 端口派生规则（砚砚二审 P1-1 收紧：sidecar 禁用不 offset）

**架构决策**：F182 大赛 worktree **默认禁用 sidecar**（沿用 `scripts/review-start.sh:224` 的模式），仅 offset 化核心服务。理由：F182 不需要 Proxy/ASR/TTS/LLM/Embedding；offset 化全部 sidecar = 增加 attack surface 但 ROI 为零。未来如有需要，单独做 sidecar offset feat。

**核心服务（必须 offset）**：

| 服务 | 基础值 | 派生公式 | 备注 |
|---|---|---|---|
| Redis 端口 | 6398 | `6398 + OFFSET`（OFFSET ≤ 0） | **必须 ≤ 0**——避免向上撞 6399 圣域 |
| Redis data dir | — | `default_redis_data_dir(profile, port)` 派生 → `~/.cat-cafe/redis-dev-${port}` | 砚砚二审 P2-4：用现有 start-dev.sh:324 函数，不发明新格式 |
| API server | 3102 | `3102 - OFFSET` | |
| Frontend (Web/Next) | 5102 | `5102 - OFFSET` | |
| NEXT_PUBLIC_API_URL | — | `http://localhost:${API_SERVER_PORT}` | 必须从派生 API 端口拼接 |

**Sidecar（默认禁用，不参与 offset）**：

| 服务 | 实际默认 base | 大赛 worktree 处理 |
|---|---|---|
| Preview Gateway | 4100（alpha 才覆盖 4111）| `PREVIEW_GATEWAY_PORT=0` 禁用 |
| Anthropic Proxy | 9877 | `ANTHROPIC_PROXY_ENABLED=0` 禁用 |
| Whisper (ASR) | 9876 | `ASR_ENABLED=0` 禁用 |
| TTS | 9879 | `TTS_ENABLED=0` 禁用 |
| LLM Postprocess | 9878 | `LLM_POSTPROCESS_ENABLED=0` 禁用 |
| Embedding | 9880 | `EMBED_ENABLED=0` + `EMBED_MODE=off` 禁用（注：现在 EMBED_ENABLED 没在 CLI_*_OVERRIDE 列表里，但通过 .env.local 可设） |

**公式统一写法**（砚砚 P2-6）：核心服务非 Redis 用 `BASE - OFFSET`（OFFSET 是负数 → 端口向上加）。文档里**不再写"向上加 offset"**，避免歧义。

### Safety Checks（砚砚二审 P1-2：preflight 必须接 start-dev.sh，不只独立脚本）

**接入位置**（砚砚 P1-2 拍板）：preflight 主接进 `scripts/start-dev.sh` 的配置解析路径（见 line 85-103 env override 加载段附近），保证 `pnpm dev:direct` / `start:direct` 必经；另加 `pnpm check:worktree-port-offset` 诊断脚本（CI 用，不是唯一 gate）。**不要**只做独立 `pnpm preflight`——根 `pnpm dev` 走 `pnpm -r --parallel run dev` 会绕过。

```ts
// derive-worktree-ports.ts（基础派生）
function deriveWorktreePorts(offset: number): WorktreePorts {
  // === 数学约束 ===
  if (offset > 0) throw new Error('WORKTREE_PORT_OFFSET must be ≤ 0 (圣域 6399)');
  if (offset < -100) throw new Error('WORKTREE_PORT_OFFSET range exceeded');
  if (offset % 10 !== 0) throw new Error('WORKTREE_PORT_OFFSET must be multiple of 10');

  // === 圣域 ===
  const redis = 6398 + offset;
  if (redis === 6399) throw new Error('Refusing to assign 6399 — 圣域');
  if (redis < 6000) throw new Error('Redis port out of safe range');

  return {
    redis,
    api: 3102 - offset,
    web: 5102 - offset,
    nextPublicApiUrl: `http://localhost:${3102 - offset}`,
    // sidecar 不在派生范围 — 大赛 worktree 全禁用
  };
}

// preflight check（接入 start-dev.sh）
async function preflightCheck(ports: WorktreePorts): Promise<void> {
  // 1. .env.local 不能硬编码会覆盖 OFFSET 派生的值
  if (envLocalHasHardcodedPort('REDIS_URL', '6398', '6399')) {
    throw new Error('.env.local 硬编码 REDIS_URL 与 OFFSET 冲突，请删除该行');
  }

  // 2. 端口占用检查（避免启动后才发现端口被占）
  for (const [name, port] of Object.entries(ports)) {
    if (typeof port === 'number' && (await isPortInUse(port))) {
      throw new Error(`Port ${port} (${name}) already in use — 另一个 worktree 没清理？`);
    }
  }

  // 3. REDIS_URL 必须从 OFFSET 派生，不读 .env.local 旧值
  process.env.REDIS_URL = `redis://localhost:${ports.redis}`;

  // 4. 验证 sidecar 都被禁用（大赛 worktree 默认）
  const requiredOff = ['ANTHROPIC_PROXY_ENABLED', 'ASR_ENABLED', 'TTS_ENABLED', 'LLM_POSTPROCESS_ENABLED', 'EMBED_ENABLED'];
  for (const k of requiredOff) {
    if (process.env[k] && process.env[k] !== '0' && process.env[k] !== 'false') {
      throw new Error(`Sidecar ${k} should be disabled in contest worktree (set to 0)`);
    }
  }
}

// Redis data dir 用现有 start-dev.sh:324 函数，不发明新格式
// default_redis_data_dir(profile, port) → ~/.cat-cafe/redis-dev-${port}
```

### LL-015 历史教训锚定

`docs/lessons-learned.md:325` 明确记录："未设 REDIS_URL 回落 6399 → 数据从 307 keys 掉到 15 keys"。本基建必须**主动派生** REDIS_URL，不允许依赖 `.env.local` 既有值——否则 OFFSET 看起来生效（端口数字对了）但 ioredis 实际连了 6399（圣域），数据丢失。

### 实施清单

| # | 改动 | 文件 |
|---|---|---|
| 1 | 新增 `derive-worktree-ports.ts` 工具函数 | `packages/api/src/config/derive-worktree-ports.ts`（或 `scripts/lib/`） |
| 2 | 改造启动脚本读 `WORKTREE_PORT_OFFSET` | `scripts/start-dev.sh`、`scripts/start-dev.mjs` 之类 |
| 3 | `.env.local` 模板支持 OFFSET | worktree skill 文档里的 `cat > .env.local <<EOF` 改成"先 export OFFSET 再启动" |
| 4 | worktree skill 添加 PORT_OFFSET 段落 | `cat-cafe-skills/worktree/SKILL.md` |
| 5 | 单元测试覆盖 safety checks | `packages/api/test/derive-worktree-ports.test.js` |
| 6 | 文档：参赛文档端口分配表链回这个 plan | 已有 link |

### 不在范围

- **不动 6398 / 6399 的圣域规则** — 6399 永远不可触碰，6398 仍是默认开发 Redis
- **不动 runtime 3001/3002** — runtime 是 cat-cafe-runtime，独立路径
- **不改 alpha 端口（3011/3012/4111/6398）** — alpha 用默认 OFFSET=0

## Acceptance Criteria（砚砚二审 P1-1/P1-2 后修订）

- [ ] AC-1: `derive-worktree-ports.ts` 实现，单元测试覆盖**全部** safety checks：offset > 0 / 圣域 6399 / Redis < 6000 / 非 10 倍数 / range > -100
- [ ] AC-2: 启动脚本读 `WORKTREE_PORT_OFFSET`，未设默认 0，派生**核心 4 服务**（Redis + API + Web + NEXT_PUBLIC_API_URL），sidecar 全禁用（不在派生范围）；输出 console 表格
- [ ] AC-3: **Preflight 接入 `scripts/start-dev.sh`**（不是独立 pnpm preflight，砚砚 P1-2）— 启动前 (a) 检查 `.env.local` 是否硬编码会覆盖 OFFSET 的端口值 → 拒绝启动 + 提示删除该行；(b) 派生端口是否被占用 → 拒绝启动；(c) 验证 sidecar 都禁用
- [ ] AC-4: **REDIS_URL 主动派生**——不读 .env.local 既有值，启动时 `export REDIS_URL=redis://localhost:${derivedRedisPort}` 覆盖；对应单元测试覆盖 `.env.local` 残留场景（LL-015 防回归）
- [ ] AC-5: **Redis data dir 用现有 `default_redis_data_dir(profile, port)`**（start-dev.sh:324），派生 `~/.cat-cafe/redis-dev-${port}`；不发明 `.cat-cafe/redis-data-10` 新格式（砚砚二审 P2-4）
- [ ] AC-6: worktree SKILL.md 添加 PORT_OFFSET 段落，含端口分配示例（链 F182 contest）+ "如何检查 .env.local 是否会冲突" + "为什么必须用 `pnpm dev:direct` 而不是 `pnpm dev`"（砚砚二审 P1-2）
- [ ] AC-7: 在 worktree 里 `WORKTREE_PORT_OFFSET=-10 bash scripts/start-dev.sh` 启动，验证 API 在 3112、Redis 用 6388、Redis data dir 派生为 `~/.cat-cafe/redis-dev-6388`
- [ ] AC-8: 同时跑两个 worktree（offset=-10 + offset=-20），互不冲突，互不读对方 Redis 数据
- [ ] AC-9: 加 `pnpm check:worktree-port-offset` 诊断脚本（CI 可用，不是唯一 gate；唯一 gate 是 start-dev.sh 内的 preflight）
- [ ] AC-10: **资源压力测试**——并发启动 6 个 worktree（OFFSET=-10 ~ -60），监测 CPU/RAM/FD 能否承受；若不行降级到错峰

## Risk

| 风险 | 缓解 |
|---|---|
| 启动脚本管理 11 个端口/路径，改造覆盖不全 → sidecar 撞端口 | AC-2 全量覆盖，CI 加 lint：派生端口数 = 11 |
| **LL-015 重演**：`.env.local` 硬编码 REDIS_URL=...6398 覆盖 OFFSET，看似生效实际撞圣域 | AC-3 preflight 主动检查 + AC-4 主动 export 覆盖 + 单元测试防回归 |
| OFFSET 写错（比如 +10 而不是 -10）撞 6399 圣域 | safety check 在启动时拦截，throw + 日志提示 |
| Redis data dir 没隔离 → 两个 Redis 进程抢同一份 RDB | dataDir / backupDir 一起 OFFSET 化（已加进派生公式） |
| 6 只猫并发对单机资源压力（CPU / RAM / FD / TCP socket） | AC-8 资源压力测试，监控 watch CPU/RAM/FD；6 套 Next.js + API + watcher 大概率扛不住，必要时回退到 3 并发 + 2 轮错峰 |
| 老 worktree 里 .env.local 已有硬编码 6398 不会自动迁移 | preflight check 拒绝启动 + 文档说明迁移步骤 |

## Timeline

| 日期 | 事件 |
|---|---|
| 2026-04-30 | plan 写好，@codex 砚砚 review |
| 2026-04-30 | review pass 后实施（估计 1-2h）|
| 2026-04-30 | F182 contest 启动 |

## Links

- F182 实施大赛：[`docs/discussions/2026-04-30-f182-contest/README.md`](../discussions/2026-04-30-f182-contest/README.md)
- Worktree skill：`cat-cafe-skills/worktree/SKILL.md`
- 圣域规则（铁律 #1）：`CLAUDE.md` 五条铁律段落
