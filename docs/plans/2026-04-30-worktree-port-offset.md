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

### 端口派生规则

| 服务 | 基础端口 | 派生公式 | 备注 |
|---|---|---|---|
| Redis | 6398 | `6398 + OFFSET`（OFFSET ≤ 0） | **OFFSET 必须 ≤ 0**——避免向上撞 6399 圣域 |
| API | 3102 | `3102 - OFFSET` | OFFSET ≤ 0 → 端口向上加 |
| Web | 5102 | `5102 - OFFSET` | 同上 |
| A2A Bridge | 4111 | `4111 - OFFSET` | 同上（4111 是 A2A bridge 端口） |

公式选择理由：
- OFFSET 设为**负数**（0 / -10 / -20 / ...）保证 Redis 永远不撞 6399 圣域
- API/Web/Bridge 用 `port - OFFSET` 让数字"向上"递增（更直觉）
- 例：OFFSET=-10 → Redis=6388, API=3112, Web=5112, Bridge=4121

### Safety Checks

```ts
function deriveWorktreePorts(offset: number): WorktreePorts {
  if (offset > 0) throw new Error('WORKTREE_PORT_OFFSET must be ≤ 0 (圣域 6399)');
  if (offset < -100) throw new Error('WORKTREE_PORT_OFFSET range exceeded');
  if (offset % 10 !== 0) throw new Error('WORKTREE_PORT_OFFSET must be multiple of 10');

  const redis = 6398 + offset;
  if (redis === 6399) throw new Error('Refusing to assign 6399 — 圣域');

  return {
    redis,
    api: 3102 - offset,
    web: 5102 - offset,
    a2aBridge: 4111 - offset,
  };
}
```

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

## Acceptance Criteria

- [ ] AC-1: `derive-worktree-ports.ts` 实现，单元测试覆盖三个 safety checks（offset > 0 / 圣域 6399 / 非 10 倍数）
- [ ] AC-2: 启动脚本读 `WORKTREE_PORT_OFFSET`，未设默认 0，输出实际端口到 console
- [ ] AC-3: worktree SKILL.md 添加 PORT_OFFSET 段落，含端口分配示例（链 F182 contest）
- [ ] AC-4: 在 worktree 里 `WORKTREE_PORT_OFFSET=-10 pnpm dev` 启动，验证 API 在 3112、Redis 用 6388
- [ ] AC-5: 同时跑两个 worktree（offset=0 + offset=-10），互不冲突，互不读对方 Redis 数据

## Risk

| 风险 | 缓解 |
|---|---|
| 启动脚本结构未知，改造范围可能比预期大 | 先调研 `scripts/` 下有什么启动脚本，再决定改一处还是多处 |
| OFFSET 写错（比如 +10 而不是 -10）撞 6399 圣域 | safety check 在启动时拦截，throw + 日志提示 |
| 老 worktree 里 .env.local 已有硬编码 6398 不会自动迁移 | 文档说明：开新 worktree 用 OFFSET，老 worktree 用 OFFSET=0 不变 |
| 6 只猫并发对单机资源压力（CPU / RAM / 端口耗尽） | 实测，必要时回退到错峰 |

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
