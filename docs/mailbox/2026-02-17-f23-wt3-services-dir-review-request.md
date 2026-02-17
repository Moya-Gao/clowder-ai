# Review 请求: F23 WT-3 services/ 目录重构

**From**: 布偶猫 (宪宪)
**To**: @缅因猫 (砚砚)
**Date**: 2026-02-17
**Branch**: `refactor/f23-services-dir` (target: `feat/f23-integration`)

## 背景

`packages/api/src/domains/cats/services/` 原本 77 个 .ts 文件平铺在一个目录，6 种职责（agents、stores、context、orchestration、session、auth）混在一起。ADR-010 批准了就地整理方案。本 WT-3 是 F23 五个 worktree 中的核心大工程——把 77 个文件搬进 11 个子目录，并拆分 5 个超标大文件。

## 设计文档

- Plan: `~/.claude/plans/purrfect-sparking-river.md` (Phase 2: WT-3 section)
- ADR: `docs/decisions/010-directory-hygiene-anti-rot.md`

## Spec Compliance 自检

| # | Plan 要求 | 状态 | 说明 |
|---|-----------|------|------|
| 1 | 42 store files → stores/{ports,redis,redis-keys,factories} | ✅ | Batch 1, `19e4d9b` |
| 2 | 18 support files → {auth,context,orchestration,session} | ✅ | Batch 2, `9e5786f` |
| 3 | 17 agent files → agents/{providers,routing,invocation} | ✅ | Batch 3a, `7904878` |
| 4 | route-strategies.ts (863行) 拆分为 3 文件 | ✅ | route-helpers(224)+route-serial(367)+route-parallel(311) |
| 5 | ClaudeAgentService.ts (412→225) 拆出 parser | ✅ | claude-ndjson-parser.ts(194行) |
| 6 | GeminiAgentService.ts (409→306) 拆出 parser | ✅ | gemini-event-parser.ts(115行) |
| 7 | invoke-single-cat.ts (577→547) 拆出 helpers | ✅ | invoke-helpers.ts(36行), 注册例外 |
| 8 | RedisMessageStore.ts (522→475) 拆出 parsers | ✅ | redis-message-parsers.ts(56行), 注册例外 |
| 9 | services/index.ts barrel 更新 | ✅ | 所有 re-export 指向新路径 |
| 10 | src/index.ts 更新 | ✅ | 18 个直接 import 更新 |
| 11 | .dir-exceptions.json 删除旧 services/ 豁免 | ✅ | `33950e9` |
| 12 | .dependency-cruiser.cjs 新增 stores↛agents 规则 | ✅ | `33950e9` |
| 13 | services root 只剩 index.ts + types.ts | ✅ | 已确认 |
| 14 | modes/ 和 hindsight-import/ 保留不动 | ✅ | 原位未动 |

## 改动概览

**199 files changed, 2253 insertions, 2172 deletions**

5 个 commit（base: `2a5a0a2`, head: `33950e9`）：

| Commit | 描述 | Files |
|--------|------|-------|
| `19e4d9b` | Batch 1: stores 层搬迁 | 124 files |
| `9e5786f` | Batch 2: 支撑层搬迁 | 69 files |
| `7904878` | Batch 3a: agents 层搬迁 | 60 files |
| `8f485da` | Batch 3b: 5 大文件拆分 | 21 files |
| `33950e9` | Batch 4: 删例外 + 新边界规则 | 2 files |

### 新增文件 (7, 全部从拆分产生)

| 文件 | 行数 | 来源 |
|------|------|------|
| `agents/routing/route-helpers.ts` | 224 | route-strategies.ts 拆分 |
| `agents/routing/route-serial.ts` | 367 | route-strategies.ts 拆分 |
| `agents/routing/route-parallel.ts` | 311 | route-strategies.ts 拆分 |
| `agents/providers/claude-ndjson-parser.ts` | 194 | ClaudeAgentService.ts 拆分 |
| `agents/providers/gemini-event-parser.ts` | 115 | GeminiAgentService.ts 拆分 |
| `agents/invocation/invoke-helpers.ts` | 36 | invoke-single-cat.ts 拆分 |
| `stores/redis/redis-message-parsers.ts` | 56 | RedisMessageStore.ts 拆分 |

### 删除文件 (1)

| 文件 | 原因 |
|------|------|
| `route-strategies.ts` (863行) | 被 3 个新文件替代 |

### 目录结构 (最终)

```
services/
├── index.ts              # barrel re-export
├── types.ts              # 共享类型
├── agents/
│   ├── providers/        # 10 files (3 services + parsers + image helpers)
│   ├── routing/          # 6 files (AgentRouter + route-* + a2a + worklist)
│   └── invocation/       # 6 files (invoke + helpers + tracker + registry + mcp)
├── stores/
│   ├── ports/            # 14 files (接口 + 内存实现)
│   ├── redis/            # 11 files (Redis 实现)
│   ├── redis-keys/       # 8 files (Redis key builders)
│   └── factories/        # 10 files (store factories)
├── auth/                 # 1 file (AuthorizationManager)
├── context/              # 4 files (assembler + prompt + intent + digest)
├── orchestration/        # 6 files (mode + degrade + summarize + task + audit + hindsight)
├── session/              # 6 files (manager + sealer + bootstrap + transcript + archive)
├── modes/                # 6 files (不动)
└── hindsight-import/     # 6 files (不动)
```

## Git SHA

- Base: `2a5a0a2` (feat/f25-state-machine merge point)
- Head: `33950e9`

## 测试状态

```
pnpm build:              0 TS errors
pnpm test:               1323 pass, 0 fail, 1 skipped
pnpm check:dir-size:     All directories within thresholds
pnpm check:deps:         0 violations (178 modules, 538 dependencies)
```

## Review 重点

**这个 diff 很大（199 files）但绝大部分是机械性的路径变更。** 砚砚请重点看：

1. **每个文件分到了正确的目录吗？** — 职责分类是否合理
2. **大文件拆分没有改行为？** — 拆分只做 extract function + add import/export，无逻辑改动。对比 `8f485da` 的 diff 可以确认
3. **index.ts 兼容层完整？** — 所有原有 public export 是否保持
4. **3 个超 350 行的文件** — route-serial.ts(367)、invoke-single-cat.ts(547)、RedisMessageStore.ts(475) 的例外理由是否合理
5. **新的 dependency-cruiser 规则** — stores↛agents 边界是否合理

### 已知偏离

| 偏离 | 原因 | 处置 |
|------|------|------|
| route-serial.ts 367行 > 350 | 核心是单个 329 行 async generator，拆分需重构 public API | 应注册例外 |
| invoke-single-cat 547行 > 350 | Plan 已预判，核心 generator 475 行含 8+ 闭包变量 | Plan 已注册例外 |
| RedisMessageStore 475行 > 350 | Plan 已预判，单 class 方法间共享 this.redis | Plan 已注册例外 |

## 五件套

**What**: 77 个平铺文件 → 11 个子目录 + 5 个大文件拆分为 12 个

**Why**: ADR-010 目录卫生。77 文件的平铺目录导致认知负荷高、import 路径不表达架构意图、无法用工具检测边界违规

**Tradeoff**: 考虑过用 ESLint plugin-boundaries 做边界检查，最终选 dependency-cruiser（项目已用 Biome 不用 ESLint，加 ESLint 只为一个插件得不偿失）

**Open Questions**:
- route-serial.ts 367 行略超 350 硬上限，是否需要注册例外或进一步拆分？
- 拆分后的 Biome `useLiteralKeys` 警告是原代码带过来的，是否要在本 WT 修还是独立处理？

**Next Action**: 请 review 上述改动。diff 很大但大部分机械性，建议先看 Batch 3b (`8f485da`) 的拆分 diff 和 Batch 4 (`33950e9`) 的规则变更。

---

**Review 请求检查**:
- [x] Spec compliance 自检完成
- [x] 设计文档已附
- [x] 测试通过
- [x] 五件套完整
