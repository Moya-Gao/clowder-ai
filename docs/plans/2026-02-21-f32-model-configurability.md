---
feature_ids: [F032]
topics: [model, configurability]
doc_kind: plan
created: 2026-02-21
---

# F32-b: 模型可配置 + 线程级猫猫选择

> **优先级**: P1
> **作者**: 布偶猫 (宪宪)
> **日期**: 2026-02-21
> **状态**: 草案（等铲屎官 + 缅因猫 review）
> **前置**: F32-a 已完成并合入 main（`aa6ed6d`，PR #29，缅因猫 R5 放行）

---

## 1. 铲屎官的需求（原始需求）

铲屎官原话：
> "这个线程召唤出什么猫猫最好可配置。比如我想召唤 opus 4.5 而不是 4.6；比如我想要召唤 GPT 5.2 而不是 GPT Codex 5.3。甚至我想召唤 sonnet + opus 4.5 + opus 4.6 组成多只布偶猫军团。"

拆解为 3 个子需求：

| # | 需求 | 例子 |
|---|------|------|
| R1 | **线程级模型选择** | 在某个线程里用 opus 4.5 而不是 4.6 |
| R2 | **同 provider 多实例** | anthropic 下同时有 opus-4.5, opus-4.6, sonnet 三只猫 |
| R3 | **不同 provider 模型切换** | 选 GPT 5.2 而不是 Codex 5.3 |

## 2. 现状分析

### F32-a 已完成（`aa6ed6d`，2026-02-18 合入 main）
- `CatId = Brand<string, 'CatId'>` — 运行时注册 ✅
- `CatRegistry` + `catIdSchema()` — 动态校验 ✅
- `AgentRegistry` — catId → AgentService 映射 ✅
- 所有路由 `z.enum` → `catIdSchema()` ✅
- 配置层 provider-based fallback（budgets/models/seal）✅
- mock-agent-integration 25 用例 ✅
- `cat-config.json` breed+variant 两层结构 ✅

### F32-b 要做的（本文档范围）

| 瓶颈 | 位置 | 问题 |
|------|------|------|
| **一 breed 只注册一只猫** | `toFlatConfigs()` | 只取 `defaultVariant`，多 variant 被忽略 |
| **AgentService 硬编码 catId** | `ClaudeAgentService:35` | `const CAT_ID = createCatId('opus')` |
| **一 provider 只有一个 AgentService 实例** | `index.ts:141-145` | 三个实例共享给所有同 provider 猫 |
| **getCatModel 硬编码 env key** | `cat-models.ts:16-19` | `MODEL_ENV_KEYS` 只有 3 个 |
| **线程无模型偏好** | `ThreadStore` | 没有 `preferredCats` 字段 |
| **前端猫列表硬编码** | `CAT_CONFIGS` / `CatAvatar` | 只知道 3 只猫 |

## 3. 核心设计

### 3.1 cat-config.json 多 variant → 多猫实例

**当前**：一个 breed 有 1 个 variant，注册 1 只猫。
**改后**：一个 breed 可以有 N 个 variant，每个 variant 注册为独立猫。

```jsonc
// cat-config.json — 新增 opus-45 和 sonnet 两个 variant
{
  "breeds": [
    {
      "id": "ragdoll",
      "catId": "opus",           // 默认 catId（backward compat）
      "name": "布偶猫",
      "displayName": "布偶猫",
      "avatar": "/avatars/opus.png",
      "color": { "primary": "#9B7EBD", "secondary": "#E8DFF5" },
      "mentionPatterns": ["@opus", "@布偶猫", "@布偶", "@宪宪"],
      "defaultVariantId": "opus-46",
      "variants": [
        {
          "id": "opus-46",
          // 不指定 catId → 继承 breed.catId = "opus"
          "provider": "anthropic",
          "defaultModel": "claude-opus-4-6",
          "mcpSupport": true,
          "cli": { "command": "claude", "outputFormat": "stream-json", "defaultArgs": ["--output-format", "stream-json"] }
        },
        {
          "id": "opus-45",
          "catId": "opus-45",              // ← 指定独立 catId
          "displayName": "布偶猫 4.5",     // ← 覆盖 breed 级 displayName
          "mentionPatterns": ["@opus-45", "@布偶45"],  // ← 独立 mention
          "provider": "anthropic",
          "defaultModel": "claude-opus-4-5",
          "mcpSupport": true,
          "cli": { "command": "claude", "outputFormat": "stream-json", "defaultArgs": ["--output-format", "stream-json"] }
        },
        {
          "id": "sonnet-46",
          "catId": "sonnet",
          "displayName": "小布偶 Sonnet",
          "mentionPatterns": ["@sonnet", "@小布偶"],
          "provider": "anthropic",
          "defaultModel": "claude-sonnet-4-6",
          "mcpSupport": true,
          "cli": { "command": "claude", "outputFormat": "stream-json", "defaultArgs": ["--output-format", "stream-json"] }
        }
      ]
    }
  ]
}
```

**规则**：
- Variant 不指定 `catId` → 继承 `breed.catId`（向后兼容）
- Variant 指定 `catId` → 注册为独立猫，可有独立 displayName、mentionPatterns
- `defaultVariantId` 指向的 variant 是 breed 的"主猫"，继承 breed 的 mentionPatterns
- 其他 variant 必须自带 mentionPatterns（否则无法被 @mention）
- 所有同 breed 的 variant **共享** avatar、color（视觉一致性）
- **⚠️ R2-P1-1 修订：mention 冲突防护规则见 §3.8**

### 3.2 `toFlatConfigs()` → `toAllCatConfigs()`

```typescript
// cat-config-loader.ts

/** 新：注册所有 variant 为独立猫 */
export function toAllCatConfigs(config: CatCafeConfig): Record<string, CatConfig> {
  const result: Record<string, CatConfig> = {};
  for (const breed of config.breeds) {
    for (const variant of breed.variants) {
      const isDefault = variant.id === breed.defaultVariantId;
      const catId = variant.catId ?? breed.catId;  // variant 级覆盖

      // R3-P1: catId 唯一性校验——重复即 hard error，启动失败
      if (result[catId]) {
        throw new Error(
          `Duplicate catId "${catId}": variant "${variant.id}" in breed "${breed.id}" `
          + `conflicts with already registered cat. Each variant must have a unique catId.`
        );
      }

      result[catId] = {
        id: createCatId(catId),
        name: catId,
        displayName: variant.displayName ?? breed.displayName,
        avatar: breed.avatar,            // 共享 breed 级
        color: breed.color,              // 共享 breed 级
        mentionPatterns: variant.mentionPatterns
          ?? (isDefault ? breed.mentionPatterns : []),  // 默认 variant 继承 breed
        provider: variant.provider,
        defaultModel: variant.defaultModel,
        mcpSupport: variant.mcpSupport,
        roleDescription: breed.roleDescription,
        personality: variant.personality ?? '',
        breedId: breed.id,               // 新字段：溯源 breed
      };
    }
  }
  return result;
}

// 保留 toFlatConfigs() 作为 backward compat alias
export function toFlatConfigs(config: CatCafeConfig): Record<string, CatConfig> {
  return toAllCatConfigs(config);
}
```

### 3.3 AgentService 参数化

**Before**：
```typescript
// ClaudeAgentService.ts
const CAT_ID = createCatId('opus');    // 硬编码
this.model = getCatModel('opus');      // 从全局取
```

**After**：
```typescript
interface ClaudeAgentServiceOptions {
  catId: CatId;              // 必传
  model: string;             // 必传
  mcpServerPath?: string;
  spawnFn?: SpawnFn;
}

class ClaudeAgentService implements AgentService {
  readonly catId: CatId;
  private readonly model: string;

  constructor(options: ClaudeAgentServiceOptions) {
    this.catId = options.catId;
    this.model = options.model;
    // ... 其余不变
  }
}
```

同理 `CodexAgentService` 和 `GeminiAgentService`。

### 3.4 启动注册改造

**Before**（一 provider 一实例）：
```typescript
const providerServices = {
  anthropic: new ClaudeAgentService(),  // 共享
  openai: new CodexAgentService(),
  google: new GeminiAgentService(),
};
```

**After**（一 catId 一实例）：
```typescript
function createAgentServiceForCat(catId: string, config: CatConfig): AgentService {
  const opts = { catId: createCatId(catId), model: config.defaultModel };
  switch (config.provider) {
    case 'anthropic': return new ClaudeAgentService(opts);
    case 'openai':    return new CodexAgentService(opts);
    case 'google':    return new GeminiAgentService(opts);
    default: throw new Error(`Unknown provider: ${config.provider}`);
  }
}

const agentRegistry = new AgentRegistry();
for (const [catId, config] of Object.entries(catRegistry.getAllConfigs())) {
  agentRegistry.register(catId, createAgentServiceForCat(catId, config));
}
```

每只猫有自己的 AgentService 实例，带自己的 model。

### 3.5 `getCatModel()` 简化

参数化后 AgentService 自带 model，不再需要全局 `getCatModel()` 查三层优先级。

```typescript
// 新：AgentService 创建时传入 model，运行时直接用
// getCatModel() 只在创建 AgentService 时调用一次

export function getCatModel(catId: string): string {
  // 1. 环境变量：CAT_{CATID}_MODEL（动态 key）
  const envKey = `CAT_${catId.toUpperCase().replace(/-/g, '_')}_MODEL`;
  const envValue = process.env[envKey]?.trim();
  if (envValue) return envValue;

  // 2. catRegistry（from cat-config.json）
  const entry = catRegistry.tryGet(catId);
  if (entry) return entry.config.defaultModel;

  // 3. 硬编码 fallback（向后兼容）
  const legacy = CAT_CONFIGS[catId];
  if (legacy) return legacy.defaultModel;

  throw new Error(`No model for cat "${catId}"`);
}
```

环境变量 key 变成动态的：`CAT_OPUS_45_MODEL`、`CAT_SONNET_MODEL` 等。

### 3.6 线程级猫猫选择

**Thread 扩展**：

```typescript
interface Thread {
  // 现有字段
  participants: string[];     // 已有：通过 @mention 积累的参与者

  // 新增
  preferredCats?: string[];   // 线程默认召唤哪些猫（不需要 @mention）
}
```

**行为**：
- 创建线程时可指定 `preferredCats: ['opus-45', 'codex']`
- 发消息无 @mention 时，路由到 `preferredCats`（而不是默认 opus）
- 有 @mention 时，@mention 优先（和现在一样）
- `preferredCats` 可在线程设置中修改

**API 变更**：
```
POST /api/threads      → body 新增 preferredCats?: string[]
PATCH /api/threads/:id → body 新增 preferredCats?: string[]
```

**⚠️ R2-P1-2 修订：`preferredCats` 校验策略**

写入路径（POST/PATCH）：
```typescript
// routes/threads.ts
const threadCreateSchema = z.object({
  // ... 现有字段
  preferredCats: z.array(catIdSchema()).max(10).optional(),
  // catIdSchema() 内部调 catRegistry.has()，未注册的 catId 直接拒绝
});
```

读取路径（route resolution 时）：
```typescript
// AgentRouter.resolveTargets() — 防御性过滤
const validPreferred = (thread.preferredCats ?? [])
  .filter(id => agentRegistry.has(id));  // 过滤掉已卸载/未注册的猫
```

> 为什么读取路径也要过滤？如果一只猫在 cat-config.json 里被移除，旧线程的 preferredCats 可能包含无效 catId。写入时校验防新数据，读取时过滤防旧数据。

**AgentRouter 改造**：
```typescript
// resolveTargets() 中
if (mentionedCats.length > 0) {
  return mentionedCats;  // @mention 优先，不变
}
// R2-P1-2: 防御性过滤无效 catId
const validPreferred = (thread.preferredCats ?? [])
  .filter(id => this.agentRegistry.has(id));
if (validPreferred.length > 0) {
  return validPreferred.map(createCatId);  // 线程偏好
}
if (thread.participants?.length) {
  return thread.participants;  // 现有参与者
}
// R2-P2-2: 默认猫从 registry 取，不硬编码 opus
return [this.getDefaultCatId()];
```

### 3.7 前端动态猫列表

**后端已有**：`GET /api/cats` 返回所有注册猫。

**前端改造**：
1. **启动时 fetch `/api/cats`** → 动态猫列表（替代 `CAT_CONFIGS` 硬编码）
2. **CatAvatar 主题动态化** — 从 API 响应的 `color` 字段生成 Tailwind class
3. **线程创建 UI** — 猫猫选择器（按 breed 分组）
4. **线程设置 UI** — 修改 `preferredCats`

```
┌─────────────────────────────────────┐
│ 新建对话                             │
├─────────────────────────────────────┤
│ 选择猫猫：                          │
│                                     │
│ 布偶猫家族 (Anthropic)              │
│  ☑ 布偶猫 4.6    claude-opus-4-6   │
│  ☐ 布偶猫 4.5    claude-opus-4-5   │
│  ☐ 小布偶 Sonnet  claude-sonnet-4-6│
│                                     │
│ 缅因猫家族 (OpenAI)                 │
│  ☑ 缅因猫         gpt-5.3-codex    │
│                                     │
│ 暹罗猫家族 (Google)                 │
│  ☐ 暹罗猫         gemini-3-pro     │
│                                     │
│               [创建对话]            │
└─────────────────────────────────────┘
```

### 3.8 Mention 冲突防护（R2-P1-1 修订）

**问题**：当前 `parseMentions()` 用 `indexOf` 子串匹配（`AgentRouter.ts:152`），`@opus-45` 会同时命中 `@opus`，导致误召唤两只猫。

**修复方案：最长匹配优先 + token 边界**

```typescript
// AgentRouter.parseMentions() 改造
private parseMentions(message: string): CatId[] {
  const lowerMessage = this.normalizeSpeechMentions(message).toLowerCase();

  // 1. 收集所有猫的所有 mentionPattern，按长度降序排列
  const allPatterns: Array<{ pattern: string; catId: CatId }> = [];
  for (const config of Object.values(catRegistry.getAllConfigs())) {
    for (const pattern of config.mentionPatterns) {
      allPatterns.push({ pattern: pattern.toLowerCase(), catId: config.id });
    }
  }
  allPatterns.sort((a, b) => b.pattern.length - a.pattern.length);  // 最长优先

  // 2. 逐 pattern 匹配，已消费区间不重复匹配
  const consumed: Array<[number, number]> = [];  // [start, end] 区间
  const mentions: ParsedMention[] = [];
  const seenCats = new Set<string>();

  for (const { pattern, catId } of allPatterns) {
    let searchFrom = 0;
    while (searchFrom < lowerMessage.length) {
      const pos = lowerMessage.indexOf(pattern, searchFrom);
      if (pos === -1) break;

      const end = pos + pattern.length;

      // Token 边界检查：pattern 后必须是空白/标点/EOF
      const charAfter = lowerMessage[end];
      const isEndBoundary = !charAfter || /[\s,.:;!?，。！？、：；]/.test(charAfter);

      // 不在已消费区间内
      const isConsumed = consumed.some(([s, e]) => pos >= s && pos < e);

      if (isEndBoundary && !isConsumed) {
        consumed.push([pos, end]);
        if (!seenCats.has(catId as string)) {
          seenCats.add(catId as string);
          mentions.push({ catId, position: pos });
        }
      }
      searchFrom = pos + 1;
    }
  }

  mentions.sort((a, b) => a.position - b.position);
  return mentions.map((m) => m.catId);
}
```

**关键规则**：
- `@opus-45` 先于 `@opus` 匹配（长度 9 > 5）
- `@opus-45` 消费了 `[pos, pos+9]` 区间，`@opus` 在同位置不会再匹配
- 如果用户同时写 `@opus @opus-45`，两者在不同位置，都会被匹配 ✅
- Token 边界防止 `@opus` 在 `@opus-45` 中部被匹配（`opus` 后面是 `-`，不是边界字符）

**回归测试（至少覆盖）**：
1. `@opus-45` → 只匹配 opus-45，不匹配 opus
2. `@opus` → 只匹配 opus
3. `@opus @opus-45` → 匹配两只
4. `@布偶45` → 匹配 opus-45（如果配置了）
5. `opus-45` 无 `@` 前缀 → 不匹配（mention 必须以 `@` 开头）

### 3.9 sessionChain variant 映射（R2-P2-1 修订）

**问题**：`isSessionChainEnabled()` 用 `breeds.find(b => b.catId === catId)` 查找，variant 独立 catId 如 `opus-45` 找不到对应 breed，默认 true。如果 breed 设了 `sessionChain: false`（如暹罗猫），新 variant 会无视这个设置。

**修复方案：在 loader 建 catId → breed 索引**

```typescript
// cat-config-loader.ts

export function buildCatIdToBreedIndex(config: CatCafeConfig): Map<string, CatBreed> {
  const index = new Map<string, CatBreed>();
  for (const breed of config.breeds) {
    for (const variant of breed.variants) {
      const catId = variant.catId ?? breed.catId;
      index.set(catId, breed);
    }
  }
  return index;
}

// R4-P2 修订：缓存绑定到 config 引用，传入不同 config 时重建索引
// 设计约束：Cat Cafe 配置在启动期单次加载，运行期不支持热更新。
// _cachedConfig 和 _catIdToBreed 生命周期一致，都在 getCachedConfig() 首次调用时初始化。
let _catIdToBreed: Map<string, CatBreed> | null = null;
let _catIdToBreedSource: CatCafeConfig | null = null;  // 缓存的 config 引用

export function isSessionChainEnabled(catId: CatId | string, config?: CatCafeConfig): boolean {
  const cfg = config ?? getCachedConfig();
  if (!cfg) return true;

  // 缓存失效检查：config 引用变了就重建索引
  if (!_catIdToBreed || _catIdToBreedSource !== cfg) {
    _catIdToBreed = buildCatIdToBreedIndex(cfg);
    _catIdToBreedSource = cfg;
  }
  const breed = _catIdToBreed.get(catId as string);
  if (!breed) return true;  // 未知猫 → 默认 enabled
  return breed.features?.sessionChain !== false;
}
```

> **R4-P2 设计约束声明**：Cat Cafe 配置在启动期单次加载（`loadCatConfig()` + `getCachedConfig()`），运行期不支持热更新。修改 `cat-config.json` 需要重启 API 服务。`_catIdToBreed` 缓存通过引用比较确保与传入 config 一致，测试场景下传入不同 config 会自动重建索引。

### 3.10 默认猫去硬编码 + opus 残留清理（R2-P2-2 修订）

**问题**：代码中仍有 `createCatId('opus')` 硬编码，和"任意猫"目标不一致。

**默认猫解析策略（R4-P1 修订：显式从 defaultVariantId 推导）**：

```typescript
// cat-config-loader.ts — 新增
let _defaultCatId: CatId | null = null;

/** 获取默认猫 catId（= breeds[0] 的 defaultVariantId 对应的 catId） */
export function getDefaultCatId(): CatId {
  if (_defaultCatId) return _defaultCatId;

  const config = getCachedConfig();
  if (config && config.breeds.length > 0) {
    const firstBreed = config.breeds[0];
    const defaultVariant = firstBreed.variants.find(
      (v) => v.id === firstBreed.defaultVariantId,
    );
    // variant 有独立 catId → 用 variant 的；否则继承 breed 的
    _defaultCatId = createCatId(defaultVariant?.catId ?? firstBreed.catId);
    return _defaultCatId;
  }

  // 终极 fallback（理论上不应触发——config 至少有 1 个 breed）
  return createCatId('opus');
}

// AgentRouter 使用：
getDefaultCatId(): CatId {
  return getDefaultCatIdFromConfig();  // 从 loader 导入
}
```

> **R4-P1 修订要点**：不再依赖 `catRegistry.getAllIds()[0]`（受 variant 注册顺序影响，不可预测）。改为从 `breeds[0].defaultVariantId` 显式推导——用户配的 `defaultVariantId` 就是默认猫，符合直觉。

**测试覆盖**：
1. breeds 只有一个猫（一个 variant）→ 默认就是它
2. breeds[0] 有多个 variant，defaultVariantId 指向第二个 → 默认是第二个（不是第一个）
3. breeds[0] 的 defaultVariant 有独立 catId（如 `opus-45`）→ 默认是 `opus-45`
4. breeds[0] 的 defaultVariant 无独立 catId → 默认继承 `breed.catId`（如 `opus`）
5. config 加载失败 → fallback `opus`

**opus 硬编码清理清单**：

| 位置 | 类型 | 清理方式 |
|------|------|---------|
| `messages.ts:329` | error broadcast catId | 改为从 invocation context 取实际 catId |
| `invocations.ts:202` | error broadcast catId | 同上 |
| `DebateMode.ts:35` | system info catId | 改为从 config.catA 取 |
| `AgentRouter resolveTargets` | 终极 fallback | 改为 `this.getDefaultCatId()` |

> **清理范围约定**：F32-b Phase 1 清理路由相关的硬编码（AgentRouter fallback）；error/system 消息的硬编码在 Phase 2 一并清理，因为需要 invocation context 支持。

## 4. CatConfig 扩展

```typescript
// packages/shared/src/types/cat.ts
export interface CatConfig {
  // 现有字段不变
  readonly id: CatId;
  readonly name: string;
  readonly displayName: string;
  readonly avatar: string;
  readonly color: CatColor;
  readonly mentionPatterns: readonly string[];
  readonly provider: CatProvider;
  readonly defaultModel: string;
  readonly mcpSupport: boolean;
  readonly roleDescription: string;
  readonly personality: string;

  // 新增
  readonly breedId?: string;         // 溯源到哪个 breed（前端分组用）
  readonly nickname?: string;        // 昵称（已有但未在 CatConfig 里）
}
```

### CatVariant schema 扩展

```typescript
// cat-config-loader.ts — variant schema 新增可选字段

// R3-P2-1: mentionPatterns 必须以 @ 开头
const mentionPatternSchema = z.string().min(2).regex(
  /^@/,
  'mentionPattern must start with @'
);

const catVariantSchema = z.object({
  id: z.string().min(1),
  catId: z.string().min(1).optional(),              // 新：variant 级 catId
  displayName: z.string().min(1).optional(),         // 新：variant 级显示名
  mentionPatterns: z.array(mentionPatternSchema).optional(),  // R3-P2-1: @前缀强制
  provider: z.enum(['anthropic', 'openai', 'google']),
  defaultModel: z.string().min(1),
  mcpSupport: z.boolean(),
  cli: cliConfigSchema,
  personality: z.string().optional(),
  strengths: z.array(z.string()).optional(),
  contextBudget: contextBudgetSchema.optional(),
});

// breed 级 mentionPatterns 也用同样约束
const catBreedSchema = z.object({
  // ... 现有字段
  mentionPatterns: z.array(mentionPatternSchema).min(1),  // R3-P2-1
  // ...
});
```

## 5. 文件改动清单

### 5.1 shared 包
| 文件 | 改动 |
|---|---|
| `types/cat.ts` | CatConfig 新增 `breedId`；CatProvider 考虑开放为 `string` |
| `types/cat-breed.ts` | CatVariant 新增 `catId?`, `displayName?`, `mentionPatterns?` |

### 5.2 api 包
| 文件 | 改动 |
|---|---|
| `config/cat-config-loader.ts` | schema 扩展 + `toAllCatConfigs()` + `buildCatIdToBreedIndex()` + `isSessionChainEnabled()` 修复（R2-P2-1） |
| `config/cat-models.ts` | `getCatModel()` 动态 env key + 简化 |
| `domains/.../ClaudeAgentService.ts` | 接受 `catId` + `model` 参数，移除硬编码 |
| `domains/.../CodexAgentService.ts` | 同上 |
| `domains/.../GeminiAgentService.ts` | 同上 |
| `index.ts` | 一 catId 一 AgentService 实例 |
| `domains/.../AgentRouter.ts` | `parseMentions()` 最长匹配优先 + token 边界（R2-P1-1）；`resolveTargets()` 支持 `preferredCats`（R2-P1-2）；`getDefaultCatId()`（R2-P2-2） |
| `routes/threads.ts` | POST/PATCH 支持 `preferredCats` + `catIdSchema()` 校验（R2-P1-2） |
| `routes/messages.ts` | error broadcast catId 从 context 取（R2-P2-2，Phase 2） |
| `routes/invocations.ts` | 同上（R2-P2-2，Phase 2） |
| `domains/.../DebateMode.ts` | system info catId 从 config 取（R2-P2-2，Phase 2） |
| Thread 相关 store | 存储 `preferredCats` |

### 5.3 web 包
| 文件 | 改动 |
|---|---|
| 新建猫猫选择器组件 | 按 breed 分组的猫列表 |
| `CatAvatar.tsx` | 动态主题（从 API color 字段） |
| 线程创建 UI | 集成猫猫选择器 |
| 线程设置 UI | 修改 preferredCats |
| 替换 `CAT_CONFIGS` 硬编码 | 全部改为 API 驱动 |

## 6. 实施顺序

```
Phase 1: 后端多实例基建（~1 session）
  Step 1: CatVariant schema 扩展（catId/displayName/mentionPatterns 可选字段）
  Step 2: toAllCatConfigs() — 每个 variant 注册为独立猫
  Step 3: parseMentions() 最长匹配优先 + token 边界（R2-P1-1）+ 回归测试
  Step 4: AgentService 参数化（catId + model 作为构造参数）
  Step 5: index.ts 改为一猫一实例
  Step 6: getCatModel() 简化 + 动态 env key
  Step 7: isSessionChainEnabled() variant 映射修复 + catId→breed 索引（R2-P2-1）
  Step 8: AgentRouter.getDefaultCatId() 去 opus 硬编码（R2-P2-2）
  Step 9: 验证——cat-config.json 加一个 variant，API 自动识别

Phase 2: 线程级选择（~1 session）
  Step 10: Thread 类型扩展 + store 改造
  Step 11: AgentRouter resolveTargets() 支持 preferredCats + 防御性过滤（R2-P1-2）
  Step 12: API 路由 POST/PATCH threads + catIdSchema() 校验（R2-P1-2）
  Step 13: error/system broadcast catId 去硬编码（R2-P2-2 Phase 2 部分）
  Step 14: 验证——curl 创建带 preferredCats 的线程

Phase 3: 前端动态化（~1-2 session）
  Step 15: 猫猫选择器组件
  Step 16: CatAvatar 动态主题
  Step 17: 线程创建/设置 UI
  Step 18: 替换 CAT_CONFIGS 硬编码

Phase 4: 开源友好（F32 收尾）
  Step 19: 接入手册 — "如何添加你自己的猫"
  Step 20: 示例配置 — cat-config.example.json
```

## 7. 验收标准

1. **向后兼容**：不改 cat-config.json → 行为和现在完全一样
2. **多实例验证**：cat-config.json 加两个 variant → API 能召唤不同模型
3. **mention 正确性**：`@opus-45` 只召唤 opus-45，不误召唤 opus（R2-P1-1）
4. **preferredCats 校验**：未注册 catId 在 POST/PATCH 被拒绝，旧数据在路由时过滤（R2-P1-2）
5. **sessionChain 一致性**：variant 继承 breed 的 features 设置（R2-P2-1）
6. **线程选择**：创建线程时指定 preferredCats，发消息自动路由到对应猫
7. **前端显示**：动态猫列表，新猫不需要改前端代码
8. **全量测试绿灯**

## 8. 风险与缓解

| 风险 | 缓解 |
|---|---|
| 同 provider 多实例 CLI 进程多，吃资源 | 和现在一样 on-demand spawn，不常驻 |
| MCP server 路径对多个 Claude 实例要复用 | MCP server 是猫猫共用的，path 逻辑不变 |
| 前端 CatAvatar 动态主题复杂度 | 同 breed 共享 color，视觉一致 |
| env 变量 key 变多 | 大部分情况直接用 cat-config.json，env 是 override |
| 老线程没有 preferredCats | fallback 到 participants → 系统默认猫（由 `defaultVariantId` 决定），不影响现有行为 |

## 9. 开放问题

1. **回复方式**：布偶猫军团和现有多猫一样——ideate 并行 / execute 串行，没有特殊处理
2. **MCP callback 区分**：多个 Claude 实例同时跑，InvocationRegistry 用 invocationId 区分，已有机制够用
3. **Session chain**：同 breed 多 variant 的 session chain 建议独立（各自有自己的上下文历史）
4. **计费/额度**：多只布偶猫 = 多份 API 调用成本，铲屎官自行评估

### 砚砚 R1 提问的答复

> Q1: `@opus` 是否固定绑定 default variant，还是允许配置切到 opus-45？

A: `@opus` 固定绑定 `defaultVariantId` 指向的 variant（breed 级 mentionPatterns 只继承给默认 variant）。如果用户想让 `@opus` 指向 4.5，改 `defaultVariantId: "opus-45"` 即可。不做运行时切换。

> Q2: `preferredCats` 允许为空数组吗？为空时应回退 participants 还是系统默认猫？

A: 空数组 `[]` 等价于未设置，回退到 participants → 系统默认猫。`undefined` 和 `[]` 行为相同。

## 10. 修订记录

### R1（草案）— 2026-02-21
初版设计草案。

### R2（缅因猫 Review 修订）— 2026-02-21

**P1 — 已修复：**

| # | 发现 | 布偶猫判断 | 修订 |
|---|------|-----------|------|
| P1-1 | mention 冲突：`@opus-45` 同时命中 `@opus`（`indexOf` 子串匹配无边界） | 完全同意。代码确认 `parseMentions` 无 token boundary | §3.8 新增：最长匹配优先 + token 边界 + 已消费区间排除 + 回归测试清单 |
| P1-2 | `preferredCats` 校验缺失，未注册 catId 到 `getService()` 会 hard throw | 完全同意。`route-helpers.ts:74` 确认 throw | §3.6 新增：POST/PATCH 用 `catIdSchema()` 校验 + 读取路径防御性过滤 |

**P2 — 已修复：**

| # | 发现 | 布偶猫判断 | 修订 |
|---|------|-----------|------|
| P2-1 | `sessionChain` 对 variant-catId 映射不完整，`breeds.find(b => b.catId === catId)` 找不到独立 variant | 同意 | §3.9 新增：`buildCatIdToBreedIndex()` + `isSessionChainEnabled()` 用索引查找 |
| P2-2 | opus 硬编码清理范围不一致 | 部分同意。3 处都是 error/system 消息非路由逻辑，但应清理 | §3.10 新增：默认猫解析策略 `getDefaultCatId()` + 清理清单（路由 Phase 1，消息 Phase 2） |

### R3（缅因猫 R2 复核修订）— 2026-02-21

**P1 — 已修复：**

| # | 发现 | 布偶猫判断 | 修订 |
|---|------|-----------|------|
| R3-P1 | `catId` 唯一性缺失，`toAllCatConfigs` 中 `result[catId] = ...` 会静默覆盖 | 完全同意。开源场景下用户容易配错，必须 fail-fast | §3.2 新增：重复 catId → throw Error，启动失败 |

**P2 — 已修复：**

| # | 发现 | 布偶猫判断 | 修订 |
|---|------|-----------|------|
| R3-P2-1 | `mentionPatterns` schema 缺 `@` 前缀约束，但 §3.8 回归测试假设"无 @ 不匹配" | 同意 | §4 CatVariant schema：`mentionPatternSchema = z.string().regex(/^@/)` |
| R3-P2-2 | `defaultCatId` 提案未形成完整改动面（schema/加载/fallback测试缺失） | 同意但简化 | §3.10 简化：不引入新字段，默认猫 = `catRegistry.getAllIds()[0]`（breeds 数组顺序决定），附 3 条测试用例 |

**砚砚 R2 提问答复：**

> Q1: 重复 catId 定义为 hard error 还是 warning？

A: hard error（启动失败）。重复 catId 意味着配置错误，应该尽早暴露。

> Q2: mentionPatterns 是否允许不带 @ 的特殊别名？

A: 不允许。所有 mentionPatterns 必须以 `@` 开头，schema 层强制（`^@` regex）。语音输入走 `normalizeSpeechMentions()` 预处理，会将口语别名转为标准 @mention 后再匹配。

### R4（缅因猫 R3 复核修订）— 2026-02-21

**P1 — 已修复：**

| # | 发现 | 布偶猫判断 | 修订 |
|---|------|-----------|------|
| R4-P1 | 默认猫 `getAllIds()[0]` 受 variant 注册顺序影响，不保证等于 `defaultVariantId`，会默认召唤错猫 | 完全同意。`getAllIds()` 顺序不可控，必须显式推导 | §3.10 重写：`getDefaultCatId()` 从 `breeds[0].defaultVariantId` 显式推导 catId，附 5 条测试用例 |

**P2 — 已修复：**

| # | 发现 | 布偶猫判断 | 修订 |
|---|------|-----------|------|
| R4-P2 | `_catIdToBreed` 全局缓存无失效策略，传入不同 config 时读旧映射 | 同意 | §3.9 重写：缓存绑定 config 引用（`_catIdToBreedSource !== cfg` 时重建），并声明设计约束"配置运行期不可热更新" |

**砚砚 R3 提问答复：**

> Q1: "默认猫"语义是"第一 breed 的 defaultVariant"，还是"全局第一个注册 catId"？

A: **第一 breed 的 defaultVariant**。`getDefaultCatId()` 显式从 `breeds[0].defaultVariantId` 推导 catId，不依赖 `getAllIds()` 注册顺序。用户把想要的默认猫放在 breeds[0] + 设好 defaultVariantId 即可。

> Q2: 是否正式声明"配置运行期不可热更新"？

A: **是**。Cat Cafe 配置在启动期单次加载，运行期不支持热更新。已在 §3.9 的 `isSessionChainEnabled()` 注释中明确声明，并将缓存绑定到 config 引用以确保测试场景下的一致性。
