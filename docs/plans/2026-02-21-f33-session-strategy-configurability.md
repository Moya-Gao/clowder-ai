# F33: Session Chain 策略可配置化

> **优先级**: P1
> **作者**: 布偶猫 (宪宪)
> **日期**: 2026-02-21
> **状态**: 草案（等 F32 完成后再优化细化）
> **前置**: F32-a（已完成）、F32-b（进行中）

---

## 1. 背景

### 原始问题

布偶猫（Claude Code）的上下文压缩由 CLI 自动触发（~95% 时），压缩后丢失关键操作记忆——commit 签名规矩、worktree 纪律、PR 流程等。缅因猫能在 context 85% 时主动交接，但布偶猫从未成功交接过。

> 事故来源：2026-02-18 PR #29 反思。

### 铲屎官的更高层洞察

> "Session Chain 得做成可配置的。允许我去配置你们到底百分之几进行压缩。还有比如我要不要使用压缩技术——有时候让你自己压缩可能比交接好。不同猫可能不同，我们需要把这些拆解开，不要做得过于耦合。"

核心观点：**不预设哪种策略更好**，让铲屎官通过实战调优找到每只猫的最优解。

### 为什么等 F32

F32（AgentRegistry + Model Configurability）建立了 per-cat 配置的基础设施：`CatRegistry`、`cat-config.json` breed/variant 结构、provider-based fallback 模式。F33 的策略配置自然挂在这套体系上，避免重复造轮子。

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
| **`hybrid`** | 允许 CLI 压缩 N 次，超过 N 次后 seal + 交接 | 折中方案，平衡连续性和信息衰减 |

**当前默认行为**：所有猫都是隐式 `handoff`（到 sealThreshold → seal）。但布偶猫的 seal 阈值（0.90）和 CLI 压缩点（~0.95）之间只有 5% 的窗口，hook 经常来不及触发。

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

  /** hybrid 专用参数 */
  hybrid?: {
    /** 压缩 N 次后切换到 handoff */
    maxCompressions: number;
    /** 如果压缩后 fillRatio 仍高于此值，立即切 handoff（不等 N 次） */
    compressionEfficiencyFloor: number;
  };

  /** 每 turn 预留 token 额度（现有 turnBudget） */
  turnBudget?: number;
  /** 安全余量（现有 safetyMargin） */
  safetyMargin?: number;
}
```

### 3.3 默认配置（provider-based fallback）

沿用 F32-a 确立的 fallback 模式：catId 精确匹配 → provider 默认 → 全局默认。

```typescript
/** 全局默认（保守的 handoff 策略） */
const GLOBAL_DEFAULT_STRATEGY: SessionStrategyConfig = {
  strategy: 'handoff',
  thresholds: { warn: 0.75, action: 0.85 },
  handoff: { preSealMemoryDump: false, bootstrapDepth: 'extractive' },
  turnBudget: 12_000,
  safetyMargin: 4_000,
};

/** Provider 级默认 */
const DEFAULT_STRATEGY_BY_PROVIDER: Record<string, SessionStrategyConfig> = {
  anthropic: {
    strategy: 'handoff',
    thresholds: { warn: 0.80, action: 0.90 },
    handoff: { preSealMemoryDump: false, bootstrapDepth: 'extractive' },
    turnBudget: 12_000,
    safetyMargin: 4_000,
  },
  openai: {
    strategy: 'handoff',
    thresholds: { warn: 0.75, action: 0.85 },
    handoff: { preSealMemoryDump: false, bootstrapDepth: 'extractive' },
    turnBudget: 12_000,
    safetyMargin: 4_000,
  },
  google: {
    strategy: 'handoff',
    thresholds: { warn: 0.55, action: 0.65 },
    handoff: { preSealMemoryDump: false, bootstrapDepth: 'extractive' },
    turnBudget: 12_000,
    safetyMargin: 4_000,
  },
};

/** catId 级 override（铲屎官可调优） */
const STRATEGY_OVERRIDES: Record<string, Partial<SessionStrategyConfig>> = {
  // 例：布偶猫用 hybrid，允许 1 次压缩后交接
  // opus: {
  //   strategy: 'hybrid',
  //   hybrid: { maxCompressions: 1, compressionEfficiencyFloor: 0.80 },
  // },
};
```

### 3.4 查找函数

```typescript
/**
 * 获取指定猫的 session 策略配置。
 * 查找顺序：catId override → provider default → global default。
 * Partial override 会合并到 base 配置上（shallow merge）。
 */
export function getSessionStrategy(catName: string): SessionStrategyConfig {
  const base = getBaseStrategy(catName);
  const override = STRATEGY_OVERRIDES[catName];
  if (!override) return base;
  return { ...base, ...override };
}

function getBaseStrategy(catName: string): SessionStrategyConfig {
  const entry = catRegistry.tryGet(catName);
  if (entry) {
    const providerDefault = DEFAULT_STRATEGY_BY_PROVIDER[entry.config.provider];
    if (providerDefault) return providerDefault;
  }
  return GLOBAL_DEFAULT_STRATEGY;
}
```

## 4. 改动点分析

### 4.1 seal-thresholds.ts → session-strategy.ts

现有 `seal-thresholds.ts` 的职责被 `session-strategy.ts` 完全吸收：

| 现有概念 | 新概念 |
|---------|--------|
| `ContextHealthConfig.sealThreshold` | `SessionStrategyConfig.thresholds.action` |
| `ContextHealthConfig.warnThreshold` | `SessionStrategyConfig.thresholds.warn` |
| `ContextHealthConfig.turnBudget` | `SessionStrategyConfig.turnBudget` |
| `ContextHealthConfig.safetyMargin` | `SessionStrategyConfig.safetyMargin` |
| `shouldSeal()` | `shouldTakeAction()` — 返回动作类型而非 boolean |
| `getSealConfig()` | `getSessionStrategy()` |

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
      const max = strategy.hybrid?.maxCompressions ?? 2;
      if (compressionCount >= max) {
        return { type: 'seal_after_compress', reason: 'max_compressions' };
      }
      const floor = strategy.hybrid?.compressionEfficiencyFloor ?? 0.80;
      if (fillRatio >= floor && compressionCount > 0) {
        // 压缩过但 fillRatio 没降下来，说明压缩效率差
        return { type: 'seal_after_compress', reason: 'compression_ineffective' };
      }
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

### 4.6 与 F32 的协同

**F32 完成后可以利用的基础设施**：
- `CatRegistry` + `getOrThrow()` / `tryGet()` — 查猫配置
- `cat-config.json` breed/variant 结构 — 可选的 per-variant 策略 override
- provider-based fallback 模式 — `getSessionStrategy()` 已采用
- `AgentRegistry` — 查 AgentService 能力

**F33 不扩展 CatConfig 的理由**（延续 F32-a §3.8 的设计决策）：
session 策略是运行时调优参数，不是猫的身份属性。放进 `CatConfig` 会让接口臃肿。保持独立的策略配置模块，通过 catId/provider 关联。

**🔲 待 F32 完成后确认**：如果 F32-b 在 `cat-config.json` 中引入了扩展能力（如 per-variant features），F33 的策略配置可能可以放进 variant 的 features 字段，而不是独立文件。这取决于 F32-b 最终的实现。

## 5. 配置可调优性

### 5.1 调优入口（Phase 1：静态配置）

铲屎官通过修改 `session-strategy.ts` 中的 `STRATEGY_OVERRIDES` 来调优：

```typescript
// 实验 1：布偶猫试试 hybrid，允许 1 次压缩
const STRATEGY_OVERRIDES = {
  opus: {
    strategy: 'hybrid',
    thresholds: { warn: 0.80, action: 0.88 },
    hybrid: { maxCompressions: 1, compressionEfficiencyFloor: 0.85 },
  },
};

// 实验 2：砚砚试试纯 compress
const STRATEGY_OVERRIDES = {
  codex: {
    strategy: 'compress',
    thresholds: { warn: 0.75, action: 0.90 },
    compress: { trackPostCompression: true },
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

| 文件 | 改动 |
|------|------|
| `config/seal-thresholds.ts` | **重命名/替换** → `config/session-strategy.ts` |
| `config/session-strategy.ts` | **新建**：`SessionStrategyConfig` 接口 + fallback 查找 + `shouldTakeAction()` |
| `domains/.../invoke-single-cat.ts` | `shouldSeal()` → `shouldTakeAction()` + 分支处理 |
| `routes/session-hooks.ts` | seal 端点改为策略感知 |
| `domains/.../stores/ports/SessionChainStore.ts` | `SessionRecord` 新增 `compressionCount` |
| 对应 memory/redis store | 支持 `compressionCount` 字段 |
| `shared/src/types/session.ts` | `ContextHealthConfig` 扩展或替换为 `SessionStrategyConfig` |
| 前端 `SessionChainPanel` | 展示策略类型 + 压缩次数 |
| 测试 | 三种策略的 `shouldTakeAction()` 单元测试 + 集成测试 |

## 7. 实施顺序

```
Step 1: SessionStrategyConfig 类型定义 + shouldTakeAction() 纯函数（shared 包）
  ↓
Step 2: session-strategy.ts — fallback 查找 + 默认配置（替换 seal-thresholds.ts）
  ↓
Step 3: SessionRecord 扩展 compressionCount + store 改造
  ↓
Step 4: invoke-single-cat.ts 改为策略驱动
  ↓
Step 5: session-hooks.ts 改为策略感知
  ↓
Step 6: 前端 SessionChainPanel 展示策略信息
  ↓
Step 7: 全量测试 + 手动实验
```

## 8. 验收标准

1. **向后兼容**：不设 override → 行为和当前完全一样（所有猫默认 handoff）
2. **handoff 策略**：到 action 阈值 → seal + 新 session（当前行为）
3. **compress 策略**：到 action 阈值 → 不 seal，记录压缩事件，session 继续
4. **hybrid 策略**：允许 N 次压缩后 seal；压缩效率低于 floor 时立即 seal
5. **budget 兜底**：无论什么策略，remaining < turnBudget + safetyMargin → 必须 seal
6. **compressionCount 准确**：通过 hook 正确递增，重启后从 store 恢复
7. **观测性**：前端能看到当前策略类型和压缩次数
8. **全量测试绿灯**

## 9. 风险与缓解

| 风险 | 缓解 |
|------|------|
| compress 策略让 CLI 无限压缩，信息持续衰减 | budget 兜底（remaining 不够就强制 seal） + 观测指标 |
| hybrid 的 compressionEfficiencyFloor 难以调优 | 提供合理默认值（0.80），铲屎官可按实际数据调 |
| session-hooks.ts 改了不 seal，CLI 仍然压缩 | 这正是 compress 策略的设计意图——不干预 CLI |
| F32-b 改了 CatConfig 结构，F33 需要适配 | F33 不扩展 CatConfig，通过 catId 关联，影响面小 |
| 运行时调优需要重启 API | Phase 1 接受此限制，Phase 2 可加 API 端点 |

## 10. 开放问题

1. **compress 策略下 bootstrap 怎么办？** 如果不 seal 就没有新 session，也就没有 bootstrap 注入。compress 策略下猫猫只能依赖 CLI 的压缩质量 + MEMORY.md。这是一个 tradeoff。
2. **压缩后 context health 怎么更新？** Claude Code CLI 压缩后不一定会报新的 token 使用量。需要确认各 CLI 的行为。
3. **generative bootstrap** 比 extractive 效果好多少？当前只有 extractive digest。generative 需要额外的 LLM 调用，成本较高。这是 Phase 2+ 的探索方向。
4. **MEMORY.md 自动写入**：pre-seal memory dump（在 seal 前让猫写入当前状态到 MEMORY.md）技术上可行（通过 MCP tool 或 prompt 注入），但需要猫主动配合，可靠性未知。
5. **与 F32-b 的配置整合**：F32-b 如果在 `cat-config.json` 的 variant 级别引入了 features/strategy 配置能力，F33 的策略配置应该利用而不是另起炉灶。待 F32-b 完成后确认。

---

*草案完成于 2026-02-21。等 F32 完成后再优化细化。*
