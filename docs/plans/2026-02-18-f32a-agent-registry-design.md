---
feature_ids: [F032]
topics: [agent, registry, design]
doc_kind: plan
created: 2026-02-18
---

# F32-a: CatId 松绑 + AgentRegistry — 设计文档

> **优先级**: P1
> **作者**: 布偶猫 (宪宪)
> **日期**: 2026-02-18
> **状态**: ✅ 缅因猫 R4 放行。R1→R3 共 7P1+4P2 全部闭环（见 §8 修订记录）
> **讨论记录**: [2026-02-18 讨论纪要](../discussions/2026-02-18-f32-agent-plugin-architecture/README.md)

---

## 1. 背景

Cat Cafe 的 agent 身份（CatId）在编译时焊死为三值 union：

```typescript
type CatId = Brand<'opus' | 'codex' | 'gemini', 'CatId'>;
```

这个假设散落在 20+ 个文件里（类型定义、路由 schema、配置层、前端）。外部贡献者想接入自己的 agent 需要改 ~15 个文件 + rebuild shared 包，门槛太高。

**F32-a 的目标**：把"三猫假设"从编译时移到运行时，让加猫变成"注册一个 AgentService + 写一段 JSON 配置"的事情。

## 2. 非目标

F32-a **不做**以下事情（留给 F32-b）：
- 不接入真实第四只猫
- 不写接入手册
- 不做 CLI 命令安全白名单
- 不做前端完整动态化（只做最小兼容）

## 3. 核心改动

### 3.1 CatId 类型松绑

**Before:**
```typescript
// packages/shared/src/types/ids.ts
type CatId = Brand<'opus' | 'codex' | 'gemini', 'CatId'>;
const VALID_CAT_IDS = ['opus', 'codex', 'gemini'] as const;
```

**After:**
```typescript
// packages/shared/src/types/ids.ts — 保持纯类型层，无运行时依赖
type CatId = Brand<string, 'CatId'>;

// 轻量转换（语法校验，不依赖 registry）
export function createCatId(id: string): CatId {
  if (!id || typeof id !== 'string') {
    throw new Error(`Invalid cat ID: must be non-empty string`);
  }
  return id as CatId;
}

// ⬆️ R3-P1-2 修订：assertKnownCatId 不放在 ids.ts（避免基础类型层→registry 循环依赖）
// 强校验放在 registry 模块里，见 §3.2
```

### 3.2 CatRegistry — 核心注册表

新建 `packages/shared/src/registry/CatRegistry.ts`：

```typescript
export interface CatRegistryEntry {
  config: CatConfig;
  // AgentService 只在 api 包注册，shared 包只管 config
}

export class CatRegistry {
  private entries = new Map<string, CatRegistryEntry>();

  register(catId: string, config: CatConfig): void;
  has(catId: string): boolean;

  // ⬆️ R3-P2-1 修订：明确两种查询契约
  /** 已知存在时用。catId 不存在则 throw（边界层、路由处理等） */
  getOrThrow(catId: string): CatRegistryEntry;
  /** 不确定是否存在时用。返回 undefined 允许 fallback（配置层等） */
  tryGet(catId: string): CatRegistryEntry | undefined;

  getAllIds(): CatId[];
  getAllConfigs(): Record<string, CatConfig>;
  getValidCatIds(): [string, ...string[]];

  // ⬆️ R1-P2-2 修订：测试隔离
  reset(): void;
}

// ⬆️ R3-P1-2 修订：assertKnownCatId 放在 registry 模块，不放在 ids.ts
// 避免基础类型层（ids.ts）依赖运行时 singleton（catRegistry）
export function assertKnownCatId(id: string): CatId {
  catRegistry.getOrThrow(id); // 不存在则 throw
  return id as CatId;
}

// 全局单例（服务启动时填充）
export const catRegistry = new CatRegistry();
```

### 3.3 AgentRegistry — API 层服务注册

新建 `packages/api/src/domains/cats/services/agents/registry/AgentRegistry.ts`：

```typescript
export class AgentRegistry {
  private services = new Map<string, AgentService>();

  register(catId: string, service: AgentService): void;
  get(catId: string): AgentService;
  has(catId: string): boolean;
  getAllEntries(): Map<string, AgentService>;
}
```

### 3.4 AgentRouter 改造

**Before:**
```typescript
interface AgentRouterOptions {
  claudeService: AgentService;
  codexService: AgentService;
  geminiService: AgentService;
}

constructor(options: AgentRouterOptions) {
  this.services = {
    opus: options.claudeService,
    codex: options.codexService,
    gemini: options.geminiService,
  };
}
```

**After:**
```typescript
interface AgentRouterOptions {
  agentRegistry: AgentRegistry;
  // ... 其余不变
}

constructor(options: AgentRouterOptions) {
  this.agentRegistry = options.agentRegistry;
}

// 查找服务时
getService(catId: CatId): AgentService {
  return this.agentRegistry.get(catId as string);
}
```

### 3.5 z.enum → z.string().refine()（R1-P1-2 修订）

**Before（每个路由文件都有）:**
```typescript
z.enum(['opus', 'codex', 'gemini'])
```

**After:**
```typescript
import { catRegistry } from '@cat-cafe/shared';

// ⬆️ R1-P1-2 修订：不用 z.enum（需要静态 tuple），改用 z.string().refine()
// 原因：路由模块在 index.ts 顶层 import 时就会求值，此时 registry 还没初始化。
// z.enum([]) 会在模块加载时炸。z.string().refine() 延迟到请求时才校验。
export function catIdSchema() {
  return z.string().refine(
    (id) => catRegistry.has(id),
    (id) => ({ message: `Unknown cat ID: "${id}". Valid: ${catRegistry.getAllIds().join(', ')}` }),
  );
}
```

### 3.6 启动时注册

**`packages/api/src/index.ts` 改造：**

```typescript
import { catRegistry } from '@cat-cafe/shared';
import { toFlatConfigs, loadCatConfig } from './config/cat-config-loader.js';

// ⬆️ R1-P1-1 修订：cat-config.json 的结构是 { breeds: [...] }，
// 不是 { cats: {...} }。使用 toFlatConfigs() 转换为 Record<string, CatConfig>。

// 1. 从 cat-config.json 加载配置，注册到 CatRegistry
const catConfig = loadCatConfig();
const flatConfigs = toFlatConfigs(catConfig);
for (const [id, config] of Object.entries(flatConfigs)) {
  catRegistry.register(id, config);
}

// 2. 注册 AgentService（内置三猫）
const agentRegistry = new AgentRegistry();
agentRegistry.register('opus', new ClaudeAgentService());
agentRegistry.register('codex', new CodexAgentService());
agentRegistry.register('gemini', new GeminiAgentService());

// 3. 注入 AgentRouter（必须在路由注册之前完成 ↑）
const router = new AgentRouter({ agentRegistry, ... });
```

### 3.7 CAT_CONFIGS 迁移 + 模块级常量时序（R2-P1-1 修订）

**Before:**
```typescript
// packages/shared/src/types/cat.ts
export const CAT_CONFIGS: Record<'opus' | 'codex' | 'gemini', CatConfig> = { ... };
```

**After:**
- `CAT_CONFIGS` 常量保留为 **默认值 / fallback**，但不再是权威来源
- `catRegistry.getAllConfigs()` 成为运行时权威来源
- 所有消费 `CAT_CONFIGS` 的代码改为读 `catRegistry`

**关键时序约束（R2-P1-1）：** 任何依赖猫列表的模块级常量必须改为**构造期或请求期计算**，不能在 import 时读 registry。

具体案例 — `AgentRouter.ts:46` 的 `MENTION_ALIASES`：
```typescript
// ❌ Before: 模块级常量，import 时就从 CAT_CONFIGS 算好
const MENTION_ALIASES = Array.from(
  new Set(Object.values(CAT_CONFIGS).flatMap(c => c.mentionPatterns...))
);

// ✅ After: 改为 AgentRouter 构造函数内计算，或用 lazy getter
// 方案 A（推荐）：构造函数内计算
class AgentRouter {
  private mentionAliases: string[];
  private speechMentionRe: RegExp;

  constructor(options: AgentRouterOptions) {
    // registry 此时已经填充完毕
    const allConfigs = catRegistry.getAllConfigs();
    this.mentionAliases = Array.from(
      new Set(Object.values(allConfigs).flatMap(c => c.mentionPatterns...))
    ).sort((a, b) => b.length - a.length);
    this.speechMentionRe = buildSpeechRegex(this.mentionAliases);
  }
}
```

**排查清单：** 所有从 `CAT_CONFIGS` 读取的模块级常量/立即执行逻辑，都需要迁移到构造期：
- `AgentRouter.ts:46-60` — `MENTION_ALIASES` + `SPEECH_MENTION_RE`
- `SystemPromptBuilder.ts` — `WORKFLOW_TRIGGERS` + `PROVIDER_LABELS`
- 其他类似模式在实施时逐个排查

### 3.8 配置层动态化（R2-P1-2 修订：字段来源与 fallback 策略）

当前 `CatConfig` 接口不包含 seal thresholds / workflow triggers 字段，`cat-config.json` schema 也没有。直接"从 registry 读"会读不到。

**策略：provider-based fallback + optional override**

```typescript
// CatConfig 不扩展（F32-a 保持最小改动）
// seal-thresholds / workflow-triggers 改为 provider-based 默认 + catId override

// seal-thresholds.ts
const DEFAULT_SEAL_BY_PROVIDER: Record<string, SealConfig> = {
  anthropic: { fillRatio: 0.85, ... },
  openai: { fillRatio: 0.80, ... },
  google: { fillRatio: 0.80, ... },
};
// 查找顺序：catId 精确匹配 → provider 默认 → 全局默认
export function getSealConfig(catId: string): SealConfig {
  const override = SEAL_OVERRIDES[catId]; // 可选的 per-cat override
  if (override) return override;
  const config = catRegistry.tryGet(catId)?.config; // R3-P2-1: 用 tryGet 允许 fallback
  if (config) return DEFAULT_SEAL_BY_PROVIDER[config.provider] ?? GLOBAL_DEFAULT;
  return GLOBAL_DEFAULT;
}
```

同理适用于：
- `cat-budgets.ts` — `contextBudget` 已经在 `cat-config.json` 的 variant 里有，可以直接从 registry 读
- `cat-models.ts` — `defaultModel` 已经在 `CatConfig` 里，直接读
- `seal-thresholds.ts` — 用 provider-based fallback（如上）

**为什么不扩展 CatConfig？** seal thresholds 和 workflow triggers 是运行时调优参数，不是猫的身份属性。放进 CatConfig 会让接口臃肿。保持 CatConfig 精简，调优参数走 provider-based fallback。

### 3.9 SystemPromptBuilder 改造（R2-P1-2 修订）

- `WORKFLOW_TRIGGERS`：**不移入 CatConfig**（这是内部运行逻辑，不是配置）。改为 provider-based 默认 + 可选 per-cat override map
- `PROVIDER_LABELS`：已经在 `CatConfig.provider` 字段里有，直接从 registry 读 `config.provider` 然后映射
- `buildStaticIdentity()` 和 `buildInvocationContext()` 改为从 registry 遍历
- 所有模块级常量改为构造期计算（见 §3.7 R2-P1-1）

## 4. 文件改动清单

### 4.1 shared 包

| 文件 | 改动 |
|---|---|
| `types/ids.ts` | CatId 改为 `Brand<string>`，移除 `VALID_CAT_IDS` 硬编码。`createCatId` 保留（语法校验），`assertKnownCatId` 移出（R3-P1-2） |
| `types/cat.ts` | CAT_CONFIGS 降级为默认值，新增从 registry 读取的函数 |
| `registry/CatRegistry.ts` | **新建**，核心注册表 + `assertKnownCatId` + `getOrThrow`/`tryGet`（R3-P1-2 + R3-P2-1） |
| `schemas/message.schema.ts` | `z.enum` → `catIdSchema()` |
| `index.ts` | 导出 catRegistry |

### 4.2 api 包

| 文件 | 改动 |
|---|---|
| `domains/cats/services/agents/registry/AgentRegistry.ts` | **新建**，AgentService 注册表 |
| `domains/cats/services/agents/routing/AgentRouter.ts` | 构造函数改用 agentRegistry |
| `domains/cats/services/context/SystemPromptBuilder.ts` | WORKFLOW_TRIGGERS 改为 registry 驱动 |
| `config/cat-budgets.ts` | 从 registry 读取，移除硬编码类型 |
| `config/cat-models.ts` | 从 registry 读取，移除硬编码类型 |
| `config/seal-thresholds.ts` | 从 registry 读取，移除硬编码类型 |
| `config/cat-config-loader.ts` | `catId` schema 从 `z.enum` 改为 `z.string()` |
| `routes/messages.schema.ts` | `z.enum` → `catIdSchema()` |
| `routes/tasks.ts` | `z.enum` / `VALID_CREATORS` → 动态 |
| `routes/memory.ts` | `z.enum` → `catIdSchema()` |
| `routes/memory-publish.ts` | `z.enum` → 动态 |
| `routes/modes.ts` | 校验改为动态 |
| `routes/summaries.ts` | `VALID_CREATORS` → 动态 |
| `routes/capabilities.ts` | 返回动态猫列表 |
| `index.ts` | 改为 registry 注册式启动 |
| `domains/cats/services/agents/invocation/invoke-single-cat.ts` | 三元链改为 registry 查询 |

### 4.3 前端（F32-a 不改，R1-P2-1 澄清）

**F32-a 边界决定：后端 only。** 前端继续从 `CAT_CONFIGS` 编译时常量读取猫列表。
理由：前端动态化需要新增 `/api/cats` 端点 + 前端状态管理改造，和后端松绑解耦。留给 F32-b。

这意味着 F32-a 完成后，加新猫后端 OK 但前端不会自动显示。这是刻意的取舍——先确保后端骨架正确，前端是独立的第二步。

### 4.4 测试

| 文件 | 改动 |
|---|---|
| `registry/CatRegistry.test.ts` | **新建**，注册 / 查询 / 动态 schema 生成 |
| `registry/AgentRegistry.test.ts` | **新建**，服务注册 / 查询 |
| `mock-agent-integration.test.ts` | **新建**，注册 mock 第四猫 → 发消息 → 验证响应 |
| 现有测试 | 确保三猫行为零变化 |

## 5. 验收标准

1. **行为不变**：现有三猫的所有功能、API、前端表现完全不变
2. **Mock 验收**：在集成测试中注册一只 `mock-cat`（返回固定文本），验证：
   - 消息路由到 mock-cat
   - `catIdSchema()` (z.string().refine) 接受 mock-cat、拒绝未注册 ID（R2-P2-1 修订措辞）
   - 配置查询返回 mock-cat 信息
3. **全量测试绿灯**：现有所有测试通过
4. **类型安全**：`tsc --noEmit` 通过，无 `any` 泄漏

## 6. 风险与缓解

| 风险 | 缓解 |
|---|---|
| shared 包改动影响面大 | 分步重构，每步跑全量测试 |
| CatId 变 string 后失去编译时提示 | `assertKnownCatId()` 放在 registry 模块（非 ids.ts，R3-P1-2）+ 路由层 `z.string().refine()` 双保险 |
| ~~z.enum 变动态后 registry 未初始化时崩~~ | 改用 `z.string().refine()`，延迟到请求时校验，不依赖模块加载时序（R1-P1-2） |
| 模块级常量在 registry 初始化前读到空集合 | 所有依赖猫列表的常量改为构造期/请求期计算（R2-P1-1） |
| seal-thresholds / workflow-triggers 不在 CatConfig 里 | provider-based fallback + optional per-cat override，不扩展 CatConfig（R2-P1-2） |
| 前端猫列表硬编码 | F32-a 不改前端，前端仍从 `CAT_CONFIGS` 读。F32-b 再动态化（R1-P2-1） |
| 全局 singleton 测试污染 | `CatRegistry.reset()` + `AgentRegistry.reset()` 供测试 beforeEach 清空（R1-P2-2） |

### `assertKnownCatId` 边界清单（R1-P1-3 + R2 + R3-P1-1 修订）

**已注册校验**（使用 `assertKnownCatId` 或 `catIdSchema()`）：
1. **路由入参** — 所有 API 路由的 catId 字段（via catIdSchema）
2. **MCP callback 入参** — callback-tools 接收的 catId
3. **外部工具输入** — 任何从外部接收 catId 的入口

**注册源校验**（R3-P1-1 修订：不用 `assertKnownCatId`，用语法/唯一性校验）：
4. **cat-config.json 加载** — 使用 `createCatId()`（语法校验）+ `CatRegistry.register()` 内部做唯一性检查（重复注册 → throw）

> 区分：cat-config 是注册源，在注册之前做"已注册"校验会自锁。注册源只做格式 + 唯一性校验。

每条边界至少一条失败测试用例（未知 ID → 拒绝 / 重复注册 → throw）。

## 7. 实施顺序

```
Step 1: CatRegistry + CatId 松绑（shared 包）
  ↓
Step 2: AgentRegistry + AgentRouter 改造（api 包）
  ↓
Step 3: z.enum 动态化（路由 schema 层）
  ↓
Step 4: 配置层动态化（budgets/models/seal-thresholds）
  ↓
Step 5: SystemPromptBuilder 改造
  ↓
Step 6: Mock agent 集成测试
  ↓
Step 7: 全量测试 + 自检
```

每个 Step 完成后提交一次 commit，确保可回滚。

## 8. 修订记录

### R1: 缅因猫 Review (2026-02-18)

**P1 — 已修复：**

| # | 发现 | 布偶猫判断 | 修订 |
|---|---|---|---|
| P1-1 | `catConfig.cats` 写错，实际是 `{ breeds: [...] }` 结构 | 完全同意，砚砚查了实际代码，我写设计时凭记忆写错了 | §3.6 改用 `toFlatConfigs(loadCatConfig())` |
| P1-2 | z.enum 动态化与模块加载时序冲突，路由 import 时 registry 未初始化 | 完全同意，这是个会导致启动即崩的严重问题 | §3.5 改为 `z.string().refine(catRegistry.has)` |
| P1-3 | `createCatId` 放弃集中校验会引入回归 | 部分同意。`createCatId` 本身应保持轻量（纯类型转换），但确实需要一个统一强校验入口 | 新增 `assertKnownCatId()`，在边界层使用；`createCatId` 保持轻量 |

**P2 — 已澄清：**

| # | 发现 | 布偶猫判断 | 修订 |
|---|---|---|---|
| P2-1 | 前端边界描述自相矛盾 | 同意，需要明确 | §4.3 明确 F32-a 不改前端，留给 F32-b |
| P2-2 | 全局 singleton 测试隔离 | 同意，好点 | §3.2 + §6 新增 `reset()` 方法 |

### R2: 缅因猫 Follow-up Review (2026-02-18)

**P1 — 已修复：**

| # | 发现 | 布偶猫判断 | 修订 |
|---|---|---|---|
| R2-P1-1 | 模块级常量（`MENTION_ALIASES` 等）在 import 时读 registry 会得到空集合 | 完全同意，和 R1-P1-2 是同类问题但更隐蔽（不是启动崩，而是静默空结果） | §3.7 新增"排查清单 + 构造期计算"方案 |
| R2-P1-2 | seal-thresholds/workflow-triggers 不在 CatConfig 和 cat-config.json 里，§3.8/§3.9 落地会卡住 | 完全同意，设计说"从 registry 读"但 registry 里根本没这些字段 | §3.8/§3.9 改为 provider-based fallback 策略，不扩展 CatConfig |

**P2 — 已修复：**

| # | 发现 | 布偶猫判断 | 修订 |
|---|---|---|---|
| R2-P2-1 | 验收标准写"z.enum 动态包含"但方案已改为 z.string().refine | 同意，文案过时 | §5 修正措辞 |

**分歧点共识：** `assertKnownCatId` 边界化方案砚砚接受。布偶猫补充了边界清单（§6）+ 每条边界的失败测试要求。

### R3: 缅因猫 R3 Review (2026-02-18)

**P1 — 已修复：**

| # | 发现 | 布偶猫判断 | 修订 |
|---|---|---|---|
| R3-P1-1 | `assertKnownCatId` 在 cat-config 加载阶段自锁：注册源在注册前做"已注册"校验 | 完全同意，逻辑自洽性错误。cat-config 是注册源，只应做语法+唯一性校验 | §6 边界清单拆分"已注册校验"和"注册源校验"两类 |
| R3-P1-2 | `assertKnownCatId` 放 `ids.ts` 会让基础类型层依赖运行时 registry singleton → 循环依赖风险 | 完全同意，`ids.ts` 应保持纯类型层 | §3.1 移除 assertKnownCatId，§3.2 移入 registry 模块 |

**P2 — 已修复：**

| # | 发现 | 布偶猫判断 | 修订 |
|---|---|---|---|
| R3-P2-1 | `CatRegistry.get()` 契约不一致：定义像"必有值"，示例像"可空 fallback" | 完全同意，API 应该明确 | §3.2 拆为 `getOrThrow()` + `tryGet()`，§3.8 示例改用 `tryGet()` |
