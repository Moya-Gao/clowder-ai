---
feature_ids: [F033]
topics: [session, strategy, configurability]
doc_kind: plan
created: 2026-02-21
---

# F33: Session Chain 策略可配置化

> **优先级**: P1
> **作者**: 布偶猫 (宪宪)
> **日期**: 2026-02-21（初版草案）→ 2026-02-22（F32 完成后更新）
> **状态**: 设计完成，待 review
> **前置**: F32-a（✅ PR #29）、F32-b Phase 1-4（✅ PR #44/46/52/55）

---

## 1. 背景

### 原始问题

布偶猫（Claude Code）的上下文压缩由 CLI 自动触发（~95% 时），压缩后丢失关键操作记忆——commit 签名规矩、worktree 纪律、PR 流程等。缅因猫能在 context 85% 时主动交接，但布偶猫从未成功交接过。

> 事故来源：2026-02-18 PR #29 反思。

### 铲屎官的更高层洞察

> "Session Chain 得做成可配置的。允许我去配置你们到底百分之几进行压缩。还有比如我要不要使用压缩技术——有时候让你自己压缩可能比交接好。不同猫可能不同，我们需要把这些拆解开，不要做得过于耦合。"

核心观点：**不预设哪种策略更好**，让铲屎官通过实战调优找到每只猫的最优解。

### F32 提供的基础设施（已完成）

F32（AgentRegistry + Model Configurability）建立了 per-cat 配置的完整基础设施：

| F32 产出 | F33 如何利用 |
|---------|-------------|
| `CatRegistry` + `tryGet()` / `getOrThrow()` | 查猫配置（provider、breedId） |
| `cat-config.json` breed/variant 两层结构 | `features` 字段是策略配置的天然挂载点 |
| `resolveBreedId(catName)` 辅助函数 | 策略查找也走 breedId 优先（同 breed 的 variant 共享策略） |
| `catFeaturesSchema` = `{ sessionChain?: boolean }` | 扩展为 `{ sessionChain?, sessionStrategy? }` |
| `isSessionChainEnabled(catId)` 模板 | F33 的 `getSessionStrategy(catId)` 沿用同一模式 |
| `seal-thresholds.ts` 已用 breedId-keyed overrides | F33 直接在此基础上演进，不用另起炉灶 |

## 2. 非目标

F33 **不做**：
- 不修改 CLI 内部的压缩机制（无法控制）
- 不做跨 session 的记忆持久化系统（MEMORY.md 已有，但属于另一个方向）
- 不做 session chain 的可视化改造（F24 已有 ContextHealthBar）
- 不接入新猫（F32-b 的范围）

## 3. 核心概念：Session Strategy

### 3.1 三种策略

| 策略 | 行为 | 适合场景 |
|------|------|---------|
| **`handoff`** | 到阈值 → seal 当前 session → 开新 session 接力 | session 间信息丢失少于压缩丢失的猫 |
| **`compress`** | 不主动 seal，让 CLI 自己压缩，同 session 继续 | 压缩保真度好的猫（需实验验证） |
| **`hybrid`** | 允许 CLI 压缩 N 次，超过 N 次后 seal + 交接 | 折中方案，平衡连续性和信息衰减。**Phase 1 仅限 hook-capable provider** |

**当前默认行为**：所有猫都是隐式 `handoff`（到 sealThreshold → seal）。但布偶猫的 seal 阈值（0.90）和 CLI 压缩点（~0.95）之间只有 5% 的窗口，hook 经常来不及触发。

### 3.1.1 Provider 能力矩阵（R3-P1-1 修订）

`hybrid` 策略依赖"压缩事件信号"来递增 `compressionCount`。当前唯一的信号来源是 `POST /api/sessions/seal` hook（由 Claude Code 的 `f24-pre-compact.sh` 调用）。Codex/Gemini 没有等效 hook。

| Provider | 压缩信号 | handoff | compress | hybrid |
|----------|---------|---------|----------|--------|
| Claude (anthropic) | `PreCompact` shell hook → `POST /api/sessions/seal` | ✅ | ✅ | ✅ |
| Codex (openai) | 无 hook（CLI 内部自动压缩，无外部通知） | ✅ | ✅ | ❌ Phase 1 不支持 |
| Gemini (google) | 无 hook（CLI 内部自动压缩，无外部通知） | ✅ | ✅ | ❌ Phase 1 不支持 |

**Phase 1 约束**：
- 配置 `hybrid` 策略时，如果 provider 不支持压缩信号，启动时 **降级为 `handoff` + warning log**（不是 hard error，避免阻止服务启动）
- Phase 2 可探索统一压缩事件信号（如 token 用量骤降检测作为 heuristic）

### 3.2 策略接口

```typescript
/** Session 生命周期策略 */
interface SessionStrategyConfig {
  /** 策略类型 */
  strategy: 'handoff' | 'compress' | 'hybrid';

  /** 上下文健康阈值 */
  thresholds: {
    /** 前端显示警告（黄色）的 fillRatio */
    warn: number;    // 0.0 ~ 1.0
    /** 触发策略动作的 fillRatio */
    action: number;  // 0.0 ~ 1.0
  };

  /** handoff 策略参数 */
  handoff?: {
    /** 是否在 seal 前尝试写入 MEMORY.md（如果猫支持） */
    preSealMemoryDump: boolean;
    /** bootstrap 注入深度：extractive（当前）/ generative（未来） */
    bootstrapDepth: 'extractive' | 'generative';
  };

  /** compress 策略参数 */
  compress?: {
    /** 允许的最大压缩次数（compress 策略下不限，hybrid 策略下有效） */
    maxCompressions?: number;
    /** 压缩后仍然触发 context_health 更新 */
    trackPostCompression: boolean;
  };

  /** hybrid 专用参数（Phase 1 仅限 hook-capable provider） */
  hybrid?: {
    /** 压缩 N 次后切换到 handoff */
    maxCompressions: number;
    // R3-P1-2 修订：compressionEfficiencyFloor 从 Phase 1 移除。
    // 原因：shouldTakeAction() 在 fillRatio >= action 时才进入 hybrid 分支，
    // 此时 fillRatio >= action >= floor 恒成立，floor check 无判别力。
    // 有意义的效率检测需要在 hook 处理时对比 pre/post 压缩 fillRatio，
    // 这属于 Phase 2 的增强（需要 SessionRecord 追踪 preCompressionFillRatio）。
  };

  /** 每 turn 预留 token 额度（现有 turnBudget） */
  turnBudget?: number;
  /** 安全余量（现有 safetyMargin） */
  safetyMargin?: number;
}
```

### 3.3 默认配置（breedId → provider → global fallback）

沿用 F32-b P4d 确立的 `resolveBreedId()` 查找模式（和当前 `seal-thresholds.ts` 一致）：

**查找顺序**：`cat-config.json features` → breedId override → provider 默认 → 全局默认

```typescript
/** 全局默认（保守的 handoff 策略） */
const GLOBAL_DEFAULT_STRATEGY: SessionStrategyConfig = {
  strategy: 'handoff',
  thresholds: { warn: 0.75, action: 0.85 },
  turnBudget: 12_000,
  safetyMargin: 4_000,
};

/** Provider 级默认 */
const DEFAULT_STRATEGY_BY_PROVIDER: Record<string, SessionStrategyConfig> = {
  anthropic: {
    strategy: 'handoff',
    thresholds: { warn: 0.80, action: 0.90 },
    turnBudget: 12_000,
    safetyMargin: 4_000,
  },
  openai: {
    strategy: 'handoff',
    thresholds: { warn: 0.75, action: 0.85 },
    turnBudget: 12_000,
    safetyMargin: 4_000,
  },
  google: {
    strategy: 'handoff',
    thresholds: { warn: 0.55, action: 0.65 },
    turnBudget: 12_000,
    safetyMargin: 4_000,
  },
};

/** breedId 级 override（同 breed 的 variant 共享策略） */
const STRATEGY_BY_BREED: Record<string, Partial<SessionStrategyConfig>> = {
  // 例：布偶猫全系列用 hybrid，允许 1 次压缩后交接
  // ragdoll: {
  //   strategy: 'hybrid',
  //   hybrid: { maxCompressions: 1 },
  // },
};
```

### 3.4 查找函数

```typescript
import { catRegistry } from '@cat-cafe/shared';
import { resolveBreedId } from './breed-resolver.js';

/**
 * 获取指定猫的 session 策略配置。
 *
 * 查找顺序（与 seal-thresholds.ts 的 getSealConfig 一致）：
 * 1. cat-config.json features.sessionStrategy（如果有）
 * 2. breedId override（同 breed 共享）
 * 3. provider 默认
 * 4. 全局默认
 */
export function getSessionStrategy(catName: string): SessionStrategyConfig {
  // 1. cat-config.json features（Phase 2：从 JSON 读取配置）
  const configStrategy = getConfigStrategy(catName);
  if (configStrategy) return { ...getBaseStrategy(catName), ...configStrategy };

  // 2. breedId override
  const breedId = resolveBreedId(catName);
  const breedOverride = (breedId ? STRATEGY_BY_BREED[breedId] : undefined)
    ?? STRATEGY_BY_BREED[catName];
  if (breedOverride) return { ...getBaseStrategy(catName), ...breedOverride };

  // 3 & 4. provider / global
  return getBaseStrategy(catName);
}

function getBaseStrategy(catName: string): SessionStrategyConfig {
  const entry = catRegistry.tryGet(catName);
  if (entry) {
    const providerDefault = DEFAULT_STRATEGY_BY_PROVIDER[entry.config.provider];
    if (providerDefault) return providerDefault;
  }
  return GLOBAL_DEFAULT_STRATEGY;
}

/**
 * Read session strategy from cat-config.json features.
 * Returns undefined if not configured (most cats won't have it initially).
 */
function getConfigStrategy(catName: string): Partial<SessionStrategyConfig> | undefined {
  // 利用 isSessionChainEnabled() 同样的 breed-index 查找
  // 从 breed.features.sessionStrategy 读取
  // Phase 1 先返回 undefined（code-only override），Phase 2 接通 JSON 配置
  return undefined;
}
```

### 3.5 cat-config.json 配置入口（Phase 2）

扩展现有的 `catFeaturesSchema`，让铲屎官可以在 `cat-config.json` 中直接配置：

```jsonc
// cat-config.json — breeds[].features 扩展
{
  "breeds": [
    {
      "id": "ragdoll",
      "features": {
        "sessionChain": true,          // 现有字段
        "sessionStrategy": {           // F33 新增
          "strategy": "hybrid",
          "thresholds": { "warn": 0.80, "action": 0.88 },
          "hybrid": { "maxCompressions": 1 }
        }
      }
    },
    {
      "id": "maine-coon",
      "features": {
        "sessionChain": true,
        "sessionStrategy": {
          "strategy": "compress",      // 让砚砚试试纯压缩
          "thresholds": { "warn": 0.75, "action": 0.90 }
        }
      }
    },
    {
      "id": "siamese",
      "features": {
        "sessionChain": false          // 暹罗猫不用 session chain
        // sessionStrategy 不需要配（sessionChain=false 时忽略）
      }
    }
  ]
}
```

**为什么放在 `features` 而不是 `CatConfig`**：延续 F32 的设计决策——`CatConfig` 存身份属性（name/avatar/provider/model），运行时调优参数走 `features` + breed-index 查找。`isSessionChainEnabled()` 已经是这个模式的范例。

## 4. 改动点分析

### 4.1 seal-thresholds.ts 演进（渐进式，非全量替换）

F32 已将 `seal-thresholds.ts` 改为 breedId-keyed + `resolveBreedId()` 查找。F33 在此基础上**渐进演进**，不是推倒重来：

**Phase 1（最小改动）**：在 `seal-thresholds.ts` 旁新建 `session-strategy.ts`，`getSessionStrategy()` 内部调用 `getSealConfig()` 作为阈值来源，增加策略决策层。

**Phase 2（合并）**：`seal-thresholds.ts` 的职责完全被 `session-strategy.ts` 吸收，旧文件标为 deprecated 后删除。

| 现有概念 | 新概念 |
|---------|--------|
| `ContextHealthConfig.sealThreshold` | `SessionStrategyConfig.thresholds.action` |
| `ContextHealthConfig.warnThreshold` | `SessionStrategyConfig.thresholds.warn` |
| `ContextHealthConfig.turnBudget` | `SessionStrategyConfig.turnBudget` |
| `ContextHealthConfig.safetyMargin` | `SessionStrategyConfig.safetyMargin` |
| `shouldSeal()` — 返回 boolean | `shouldTakeAction()` — 返回动作类型 |
| `getSealConfig()` — 返回阈值 | `getSessionStrategy()` — 返回完整策略 |

### 4.2 `shouldTakeAction()` — 策略决策函数

替代当前的 `shouldSeal()`，根据策略返回不同动作：

```typescript
type StrategyAction =
  | { type: 'none' }                         // 正常，无需动作
  | { type: 'warn' }                          // 接近阈值，发警告
  | { type: 'seal'; reason: SealReason }      // 触发 seal + handoff
  | { type: 'allow_compress' }                // 允许 CLI 压缩，不干预
  | { type: 'seal_after_compress'; reason: SealReason }; // 压缩次数超限，seal

function shouldTakeAction(
  fillRatio: number,
  windowTokens: number,
  usedTokens: number,
  compressionCount: number,   // 当前 session 已压缩次数
  strategy: SessionStrategyConfig,
): StrategyAction {
  const remaining = windowTokens - usedTokens;
  const turnBudget = strategy.turnBudget ?? 12_000;
  const safetyMargin = strategy.safetyMargin ?? 4_000;

  // 无论什么策略，remaining 不够一个 turn → 必须 seal
  if (remaining < turnBudget + safetyMargin) {
    return { type: 'seal', reason: 'budget_exhausted' };
  }

  // 还没到 action 阈值
  if (fillRatio < strategy.thresholds.action) {
    if (fillRatio >= strategy.thresholds.warn) {
      return { type: 'warn' };
    }
    return { type: 'none' };
  }

  // 到了 action 阈值，根据策略决定动作
  switch (strategy.strategy) {
    case 'handoff':
      return { type: 'seal', reason: 'threshold' };

    case 'compress':
      return { type: 'allow_compress' };

    case 'hybrid': {
      // R3-P1-2 修订：Phase 1 只用 maxCompressions 做切换判断
      const max = strategy.hybrid?.maxCompressions ?? 2;
      if (compressionCount >= max) {
        return { type: 'seal_after_compress', reason: 'max_compressions' };
      }
      // Phase 1 不做 compressionEfficiencyFloor 检测。
      // 原因：此分支 fillRatio >= action 恒成立（提前返回保证），
      // floor < action 时 floor check 无判别力（恒 true）。
      // Phase 2 将在 session-hooks.ts 的 hook 处理中实现效率检测
      // （对比 pre/post 压缩 fillRatio，需新增 SessionRecord 字段）。
      return { type: 'allow_compress' };
    }
  }
}
```

### 4.3 invoke-single-cat.ts 改造

当前在每次 invocation `done` 后调用 `shouldSeal()`。改为调用 `shouldTakeAction()` 并分支处理：

```typescript
// 当前（简化）
const sealConfig = getSealConfig(catId);
if (shouldSeal(fillRatio, windowTokens, usedTokens, sealConfig)) {
  await sessionSealer.requestSeal({ sessionId, reason: 'threshold' });
}

// 改后（简化）
const strategy = getSessionStrategy(catId);
const action = shouldTakeAction(
  fillRatio, windowTokens, usedTokens,
  sessionRecord.compressionCount ?? 0,
  strategy,
);

switch (action.type) {
  case 'none':
    break;
  case 'warn':
    // 发 context_health 警告（已有逻辑）
    break;
  case 'seal':
  case 'seal_after_compress':
    await sessionSealer.requestSeal({ sessionId, reason: action.reason });
    sessionManager.delete(userId, catId, threadId);
    break;
  case 'allow_compress':
    // 不干预，让 CLI 自己压缩。但记录一条 system_info
    // 告知前端"策略决定允许压缩"
    break;
}
```

### 4.4 SessionRecord 扩展

需要追踪当前 session 的压缩次数（用于 hybrid 策略）：

```typescript
interface SessionRecord {
  // 现有字段...

  // 新增
  compressionCount?: number;  // 当前 session 已压缩次数
}
```

**压缩次数如何更新**：当 `POST /api/sessions/seal` hook 被调用但策略决定 `allow_compress` 时（非 `handoff` 策略），不 seal，而是 `compressionCount += 1`。

### 4.5 session-hooks.ts 改造

`POST /api/sessions/seal` 端点当前无条件触发 seal。改为先查策略：

```typescript
// 当前：收到 hook → 直接 seal
const result = await sessionSealer.requestSeal({ sessionId, reason });

// 改后：收到 hook → 查策略 → 按策略动作
const strategy = getSessionStrategy(catId);
if (strategy.strategy === 'handoff') {
  // handoff 策略：正常 seal
  const result = await sessionSealer.requestSeal({ sessionId, reason });
  // ...
} else if (strategy.strategy === 'compress') {
  // compress 策略：不 seal，记录压缩事件
  await sessionChainStore.update(sessionId, {
    compressionCount: (record.compressionCount ?? 0) + 1,
  });
  reply.code(200).send({ action: 'compress_allowed', compressionCount: ... });
} else {
  // hybrid 策略：检查是否超过 maxCompressions
  // ...
}
```

### 4.6 与 F32 的协同（✅ 已确认）

**F32 已完成，基础设施可用**：
- `CatRegistry` + `getOrThrow()` / `tryGet()` — 查猫配置（provider、breedId）
- `resolveBreedId(catName)` — breedId 查找（`seal-thresholds.ts` 已在用）
- `cat-config.json` breed 级 `features` 字段 — 当前 `{ sessionChain?: boolean }`
- `catFeaturesSchema` (Zod) + `isSessionChainEnabled()` — 已验证的 feature toggle 模式
- `buildCatIdToBreedIndex()` — catId → breed 索引

**配置策略决定**：
- `features` 字段在 **breed 级别**（不在 variant 级别）——同 breed 的所有 variant 共享策略
- 不扩展 `CatConfig`（延续 F32-a §3.8 决策）——策略是调优参数，不是身份属性
- F33 沿用 `isSessionChainEnabled()` 的查找模式：`catId → breed-index → features`

## 5. 配置可调优性

### 5.1 调优入口（Phase 1：静态配置）

铲屎官通过修改 `session-strategy.ts` 中的 `STRATEGY_BY_BREED` 来调优：

```typescript
// R3-P2-3 修订：示例使用 breedId（与 §3.3 STRATEGY_BY_BREED 一致）

// 实验 1：布偶猫全系列试试 hybrid，允许 1 次压缩
const STRATEGY_BY_BREED = {
  ragdoll: {
    strategy: 'hybrid',
    thresholds: { warn: 0.80, action: 0.88 },
    hybrid: { maxCompressions: 1 },
  },
};

// 实验 2：缅因猫全系列试试纯 compress
const STRATEGY_BY_BREED = {
  'maine-coon': {
    strategy: 'compress',
    thresholds: { warn: 0.75, action: 0.90 },
  },
};
```

改配置后重启 API 即可生效。

### 5.2 运行时可调（Phase 2：API 端点）

如果实战中频繁需要调优，可以加 API 端点：

```
PATCH /api/config/session-strategy/:catId
Body: { strategy: 'hybrid', thresholds: { warn: 0.82, action: 0.90 } }
```

Phase 2 不在 F33 初版范围，根据实际需要再加。

### 5.3 观测性

为支持调优决策，需要能看到策略效果：

| 指标 | 来源 | 展示 |
|------|------|------|
| 每 session 的压缩次数 | `SessionRecord.compressionCount` | SessionChainPanel |
| seal 原因分布 | `SessionRecord.sealReason` | 已有 |
| 压缩后 fillRatio 变化 | context_health 事件 | ContextHealthBar |
| session 平均寿命（turn 数） | `SessionRecord.messageCount` | SessionChainPanel |
| 跨 session 信息丢失率 | 需要新指标（如 bootstrap recall 成功率） | 待设计 |

## 6. 文件改动清单

### 6.1 shared 包
| 文件 | 改动 |
|------|------|
| `types/session.ts` | 新增 `SessionStrategyConfig` 接口 + `StrategyAction` 类型 |
| `types/session.ts` | `SessionRecord` 新增 `compressionCount?: number` |

### 6.2 api 包
| 文件 | 改动 |
|------|------|
| `config/session-strategy.ts` | **新建**：`getSessionStrategy()` + `shouldTakeAction()` + 默认配置 |
| `config/seal-thresholds.ts` | Phase 1 保留（被 session-strategy.ts 内部调用）；Phase 2 合并删除 |
| `config/cat-config-loader.ts` | `catFeaturesSchema` 扩展 `sessionStrategy` 可选字段 |
| `domains/.../invoke-single-cat.ts` | `shouldSeal()` → `shouldTakeAction()` + 分支处理 |
| `routes/session-hooks.ts` | seal 端点改为策略感知（compress 不 seal；hybrid 按 `maxCompressions` 条件 seal） |
| `domains/.../stores/ports/SessionChainStore.ts` | `ISessionChainStore` + `SessionChainStore`（内存实现）支持 `compressionCount` |
| `domains/.../stores/redis/RedisSessionChainStore.ts` | Redis 实现支持 `compressionCount` 字段 |

### 6.3 前端
| 文件 | 改动 |
|------|------|
| `SessionChainPanel` | 展示策略类型 + 压缩次数（小改动） |

### 6.4 测试
| 文件 | 改动 |
|------|------|
| `session-strategy.test.ts` | **新建**：三种策略的 `shouldTakeAction()` 单元测试 |
| `session-strategy-integration.test.ts` | **新建**：策略与 invoke-single-cat 集成测试 |
| `seal-thresholds.test.ts` | 现有测试不动（Phase 1 保留） |

## 7. 实施顺序

```
Phase 1: 策略基建（最小可用）
  Step 1: SessionStrategyConfig 类型 + StrategyAction 类型（shared 包）
  Step 2: shouldTakeAction() 纯函数 + 单元测试
  Step 3: session-strategy.ts — fallback 查找（复用 resolveBreedId + getSealConfig）
  Step 4: SessionRecord 扩展 compressionCount + memory/redis store
  Step 5: invoke-single-cat.ts 改为策略驱动
  Step 6: session-hooks.ts 改为策略感知
  Step 7: 全量测试 + 自检

Phase 2: 配置驱动
  Step 8: catFeaturesSchema 扩展 sessionStrategy
  Step 9: getConfigStrategy() 接通 cat-config.json 读取
  Step 10: 合并 seal-thresholds.ts → session-strategy.ts
  Step 11: 前端 SessionChainPanel 展示

Phase 3: 实战调优
  Step 12: 铲屎官配置不同猫的策略，观察效果
  Step 13: 根据数据调整默认值
```

## 8. 验收标准

1. **向后兼容**：不设 override → 行为和当前完全一样（所有猫默认 handoff）
2. **handoff 策略**：到 action 阈值 → seal + 新 session（当前行为）
3. **compress 策略**：到 action 阈值 → 不 seal，记录压缩事件，session 继续
4. **hybrid 策略**：Phase 1 仅按 `maxCompressions` 切换（压缩 N 次后 seal）；Phase 2 才引入效率检测（pre/post fillRatio delta）
5. **budget 兜底**：无论什么策略，remaining < turnBudget + safetyMargin → 必须 seal
6. **compressionCount 准确**：通过 hook 正确递增，重启后从 store 恢复
7. **观测性**：前端能看到当前策略类型和压缩次数
8. **全量测试绿灯**

## 9. 风险与缓解

| 风险 | 缓解 |
|------|------|
| compress 策略让 CLI 无限压缩，信息持续衰减 | budget 兜底（remaining 不够就强制 seal） + 观测指标 |
| hybrid 仅限 hook-capable provider | Phase 1 显式降级（无 hook → fallback handoff + warning），不是 hard error |
| session-hooks.ts 改了不 seal，CLI 仍然压缩 | 这正是 compress 策略的设计意图——不干预 CLI |
| ~~F32-b 改了 CatConfig 结构~~（已确认） | F33 不扩展 CatConfig，通过 breed features 关联 |
| 运行时调优需要重启 API | Phase 1 接受此限制，Phase 2 可加 API 端点 |

## 10. 开放问题

1. **compress 策略下 bootstrap 怎么办？** 如果不 seal 就没有新 session，也就没有 bootstrap 注入。compress 策略下猫猫只能依赖 CLI 的压缩质量 + MEMORY.md。这是一个 tradeoff。
2. **压缩后 context health 怎么更新？** Claude Code CLI 压缩后不一定会报新的 token 使用量。需要确认各 CLI 的行为。
3. **generative bootstrap** 比 extractive 效果好多少？当前只有 extractive digest。generative 需要额外的 LLM 调用，成本较高。Phase 2+ 探索方向。
4. **MEMORY.md 自动写入**：pre-seal memory dump 技术上可行（通过 MCP tool 或 prompt 注入），但需要猫主动配合，可靠性未知。
5. ~~**与 F32-b 的配置整合**~~：✅ 已确认。`features` 在 breed 级别，`catFeaturesSchema` 是天然扩展点。见 §3.5。

---

## 修订记录

### v1 — 2026-02-21
初版草案。F32 尚未完成，方向性设计。

### v2 — 2026-02-22
F32 Phase 1-4 全部完成后更新：
- 状态从"草案"升为"设计完成，待 review"
- §1 背景：补充 F32 实际产出（`resolveBreedId`、`catFeaturesSchema`、breedId-keyed overrides）
- §3.3/3.4：查找函数改用 `resolveBreedId()` + breed-index 模式（与 `seal-thresholds.ts` 一致）
- §3.5：新增 `cat-config.json` 配置入口设计（Phase 2，扩展 `catFeaturesSchema`）
- §4.1：改为渐进式演进（先共存后合并），而非全量替换
- §4.6：从"待确认"变为"已确认"——`features` breed 级别、不扩展 `CatConfig`
- §6/7：拆为 Phase 1（策略基建）→ Phase 2（配置驱动）→ Phase 3（实战调优）

### v3 — 2026-02-22（缅因猫 R1 修订）

**P1 — 已修复：**

| # | 发现 | 布偶猫判断 | 修订 |
|---|------|-----------|------|
| R1-P1-1 | `hybrid` 在非 Claude 路径没有压缩计数信号，`compressionCount` 只在 `/api/sessions/seal` hook 递增 | 同意。Codex/Gemini 没有 PreCompact hook，hybrid 的 `maxCompressions` 无法可靠生效 | §3.1.1 新增 Provider 能力矩阵：Phase 1 hybrid 仅限 hook-capable provider，其他 provider 降级为 handoff + warning |
| R1-P1-2 | `compressionEfficiencyFloor` 被 `fillRatio < action` 提前返回遮蔽，语义无效 | 同意。hybrid 分支里 `fillRatio >= action >= floor` 恒成立，floor check 无判别力 | §3.2 移除 `compressionEfficiencyFloor`；§4.2 伪代码删除 floor 检测；效率检测推迟到 Phase 2（需要 pre/post 压缩 fillRatio 对比） |

**P2 — 已修复：**

| # | 发现 | 布偶猫判断 | 修订 |
|---|------|-----------|------|
| R1-P2-1 | BACKLOG 状态描述过时（仍写"等 F32 完成后优化"） | 同意 | BACKLOG 改为"F32 ✅ 已完成，设计 v2 缅因猫 R1 修订中" |
| R1-P2-2 | 文件改动清单列了不存在的 `MemorySessionChainStore.ts` | 同意。内存实现在 `SessionChainStore.ts` 内，不是单独文件 | §6.2 改为 `SessionChainStore.ts`（接口 + 内存实现合一） |
| R1-P2-3 | 示例用 `opus/codex`（catId）但设计强调 breedId 共享 | 同意。会误导实施回到 catId 特判 | §5.1 示例改为 `ragdoll/maine-coon` + 变量名改为 `STRATEGY_BY_BREED` |

**开放问题回复：**

> Q1: Phase 1 是否明确只对 Claude 开 hybrid？

A: 是。§3.1.1 明确：Phase 1 hybrid 仅限 hook-capable provider（当前只有 Claude）。非 hook provider 配了 hybrid 会降级为 handoff + warning log。Phase 2 可探索 heuristic 压缩检测（如 token 用量骤降）。

> Q2: `compressionEfficiencyFloor` 最终定义？

A: Phase 1 移除。Phase 2 如果重新引入，定义为"压缩前后 fillRatio 下降幅度"（delta），而非绝对阈值。检测逻辑放在 `session-hooks.ts` 的 hook 处理中（对比 pre-compression 和 post-compression 的 fillRatio），不在 `shouldTakeAction()` 中。需新增 `SessionRecord.preCompressionFillRatio` 字段。

### v3.1 — 2026-02-22（缅因猫 R2 修订）

**P2 — 文档一致性修复：**

| # | 发现 | 修订 |
|---|------|------|
| R2-P2-1 | §8 验收标准第 4 条仍写"压缩效率低于 floor 时立即 seal"，与 Phase 1 移除 floor 冲突 | 改为"Phase 1 仅按 `maxCompressions` 切换；Phase 2 才引入效率检测（delta）" |
| R2-P2-2 | §3.3 `STRATEGY_BY_BREED` 注释示例仍含 `compressionEfficiencyFloor: 0.85` | 移除该字段，保留 `maxCompressions: 1` |
| R2-P2-3 | §6.2 session-hooks.ts 描述"compress/hybrid 不 seal"，但 hybrid 超过 maxCompressions 应当 seal | 改为"compress 不 seal；hybrid 按 `maxCompressions` 条件 seal" |
