---
feature_ids: [F093]
related_features: [F102, F129]
topics: [design-gate, world-engine, typescript-contracts, memory-reuse]
doc_kind: discussion
created: 2026-04-30
participants: [opus, codex]
---

# F093 Phase A Design Gate — TS Contract Draft

> **Status**: draft — 待砚砚 review
> **Author**: 宪宪/Opus-46
> **Reviewer**: 砚砚（跨家族）
> **前置**: KD-16（F102 记忆复用边界）+ Phase A plan 已就位

本文定义 F093 Phase A 的终态 TypeScript 接口合约。通过 Design Gate 后，这些合约将在 worktree 中实现为 `packages/shared/src/types/world.ts` + `packages/shared/src/schemas/world.ts`。

## 设计原则

1. **Agent 决策，Runtime 提交**（KD-13）：`WorldActionEnvelope` 是 agent 的提案，不是直接状态变更
2. **索引是加速器，不是真相源**（KD-16）：World runtime 表是权威状态，evidence index 可重建
3. **面具不污染身份**（KD-12）：overlay 写新槽位，永不复用 core key
4. **RP 台词不自动入典**：必须经过 `CanonPromotionRecord` 显式升格

---

## 1. 世界实体（Runtime Authority Tables）

### WorldStatus / SceneStatus / WorldMode

```typescript
type WorldStatus = 'draft' | 'active' | 'archived';

type SceneStatus = 'draft' | 'active' | 'completed';

type WorldMode = 'build' | 'perform' | 'replay';

type WorldActorKind = 'user' | 'cat' | 'system';

interface WorldActorRef {
  kind: WorldActorKind;
  id: string;                // userId / catId / system component id
  displayName?: string;
}
```

### WorldRecord

```typescript
interface WorldRecord {
  worldId: string;
  name: string;
  description?: string;
  constitution?: string;    // 世界宪法：基本规则和风格基调
  status: WorldStatus;
  threadId?: string;         // 可选的 thread 绑定
  createdBy: WorldActorRef;
  createdAt: string;         // ISO8601
  updatedAt: string;
}
```

### CharacterRecord（5 槽）

5 槽定义遵循 spec §9 一等公民。每个槽是结构化对象，不是自由文本。

```typescript
interface CharacterCoreIdentity {
  name: string;
  archetype?: string;        // e.g. "黑客", "守护者", "流浪诗人"
  description: string;
}

interface CharacterInnerDrive {
  motivation: string;
  fears?: string[];
  values?: string[];
  secrets?: string[];
}

interface CharacterRelationshipTension {
  bonds: RelationshipBond[];
}

interface RelationshipBond {
  targetCharacterId: string;
  nature: string;            // e.g. "rivalry", "mentorship", "unresolved"
  tension?: string;          // 什么悬而未决
  intensity?: number;        // 0-100, optional quantification
}

interface CharacterVoiceAndImage {
  voiceStyle?: string;       // 语言风格/口头禅
  visualDescription?: string;
  avatarUrl?: string;
  signature?: string;        // 标志性台词
}

interface CharacterGrowthState {
  currentArc?: string;       // 当前成长弧线
  milestones?: string[];     // 关键时刻
  wounds?: string[];         // 过往伤痕
}

interface CharacterRecord {
  characterId: string;
  worldId: string;
  coreIdentity: CharacterCoreIdentity;
  innerDrive: CharacterInnerDrive;
  relationshipTension: CharacterRelationshipTension;
  voiceAndImage: CharacterVoiceAndImage;
  growthState: CharacterGrowthState;
  // KD-12: L1/L2 永不覆盖，L5 存世界状态表
  // Mask 只覆盖 L3 本体能力 + L4 场景皮肤
  maskOverlay?: CharacterMaskOverlay;
  baseCatId?: string;        // 如果角色由猫猫扮演，链接到 cat-config
  createdAt: string;
  updatedAt: string;
}
```

### CharacterMaskOverlay（KD-12 L3/L4）

```typescript
interface CharacterMaskOverlay {
  // L3: 本体能力 overlay（新槽位名，不复用 core key）
  overlayPersonality?: string;
  overlayVoiceStyle?: string;
  overlayStrengths?: string[];
  // L4: 场景皮肤（临时覆盖）
  sceneDisplayName?: string;
  sceneAvatar?: string;
  scenePalette?: string;
}
```

### SceneRecord

```typescript
interface SceneRecord {
  sceneId: string;
  worldId: string;
  name: string;
  description?: string;
  mode: WorldMode;
  status: SceneStatus;
  activeCharacterIds: string[];
  setting?: string;          // 场景环境描述
  createdAt: string;
  updatedAt: string;
}
```

---

## 2. 三个核心协议

### Protocol 1: WorldContextEnvelope（世界状态 → agent 上下文）

每轮对话动态注入。**不在 `buildStaticIdentity()` 里**（KD-14）。

```typescript
interface WorldRecallResult {
  canonMatches: Array<{
    anchor: string;
    title: string;
    summary: string;
    confidence: number;
  }>;
  eventMatches: Array<{
    eventId: string;
    summary: string;
    createdAt: string;
  }>;
}

interface WorldContextEnvelope {
  world: WorldRecord;
  scene: SceneRecord;
  characters: CharacterRecord[];
  recentEvents: WorldEventEntry[];       // 最近 N 条事件
  relationshipSnapshot: RelationshipBond[]; // 当前场景活跃角色间的关系
  canonSummary: CanonSummaryEntry[];      // 已接受的正典摘要
  recall: WorldRecallResult;             // world-scoped evidence recall
  careLoopHint?: CareLoopHint;           // 如果触发了 Care Loop
}

interface CanonSummaryEntry {
  recordId: string;
  summary: string;
  acceptedAt: string;
}

interface CareLoopHint {
  trigger: string;           // 什么触发了关怀
  suggestion: string;        // 具体行动建议
  realityBridge: string;     // 引导回现实的连接点
}
```

### Protocol 2: WorldActionEnvelope（agent 输出 → 世界状态变化）

Agent 输出 typed 提案，Runtime Coordinator 校验后事务化提交。

```typescript
interface WorldActionEnvelope {
  worldId: string;
  sceneId: string;
  actorCatId: string;
  mode: WorldMode;
  actions: WorldAction[];
  idempotencyKey: string;    // 防重复提交
}

type WorldAction =
  | EditCharacterDefinitionAction
  | PerformDialogueAction
  | NarrateAction
  | UpdateCharacterStateAction
  | ProposeCanonAction
  | DecideCanonAction
  | TransitionSceneAction
  | CareCheckInAction;

type JsonPatchOperation =
  | { op: 'add' | 'replace'; path: string; value: unknown }
  | { op: 'remove'; path: string };

interface EditCharacterDefinitionAction {
  type: 'edit_character_definition';
  characterId: string;
  // Build-mode only: definition edits are explicit, not accidental Perform drift.
  slot: 'coreIdentity' | 'innerDrive' | 'voiceAndImage';
  patch: JsonPatchOperation[];
}

interface PerformDialogueAction {
  type: 'perform_dialogue';
  characterId: string;       // 说话的角色（可以是猫猫戴面具扮演的）
  content: string;
}

interface NarrateAction {
  type: 'narrate';
  content: string;           // 叙事描述（非角色台词）
}

interface UpdateCharacterStateAction {
  type: 'update_character_state';
  characterId: string;
  // Perform/Build mutable state. Core definition edits use EditCharacterDefinitionAction.
  slot: 'relationshipTension' | 'growthState';
  patch: JsonPatchOperation[];
}

interface ProposeCanonAction {
  type: 'propose_canon';
  sourceEventId: string;     // 来源事件
  summary: string;           // 正典摘要
  category?: string;         // e.g. "world_rule", "character_trait", "plot_event"
}

interface DecideCanonAction {
  type: 'decide_canon';
  recordId: string;
  decision: 'accepted' | 'rejected';
  reason?: string;
}

interface TransitionSceneAction {
  type: 'transition_scene';
  targetSceneId?: string;    // 已有场景 or undefined = 新场景
  newSceneName?: string;
  newSceneDescription?: string;
}

interface CareCheckInAction {
  type: 'care_check_in';
  suggestion: string;
  realityBridge: string;
}
```

### Protocol 3: CanonPromotionRecord（显式升格状态机）

```typescript
type CanonStatus = 'draft' | 'proposed' | 'accepted' | 'rejected';

interface CanonPromotionRecord {
  recordId: string;
  worldId: string;
  sceneId: string;
  sourceEventId: string;     // 触发升格的事件
  status: CanonStatus;
  summary: string;
  category?: string;
  proposedBy: WorldActorRef;
  decidedBy?: WorldActorRef;
  reason?: string;           // 接受/拒绝理由
  createdAt: string;
  decidedAt?: string;
}
```

**状态流转**:
```
draft → proposed → accepted
                 → rejected
```

Coordinator 校验规则:
- `propose_canon` 创建 `status='proposed'` 的记录
- `decide_canon` 需要和 proposer 不同身份（或用户确认），并生成 `canon_accepted` / `canon_rejected` 事件
- accepted 后自动触发 `WorldKnowledgeAdapter.indexCanon()` 写入 evidence 派生层
- rejected 不删除记录，保留审计轨迹

---

## 3. 世界事件日志（Append-Only）

```typescript
type WorldEventType =
  | 'scene_created'
  | 'scene_entered'
  | 'scene_completed'
  | 'dialogue'
  | 'narration'
  | 'character_definition_change'
  | 'character_state_change'
  | 'canon_proposed'
  | 'canon_accepted'
  | 'canon_rejected'
  | 'care_check_in'
  | 'scene_transition';

interface WorldEventEntry {
  eventId: string;
  worldId: string;
  sceneId: string;
  type: WorldEventType;
  actor: WorldActorRef;
  characterId?: string;      // 如果是角色扮演动作
  payload: Record<string, unknown>;
  canonRecordId?: string;    // 如果此事件被升格为正典
  createdAt: string;
}
```

**铁律**: `world_event_log` 是 append-only。不支持 UPDATE/DELETE。Replay 依赖这个表的完整性。

---

## 4. F102 复用接口（KD-16 边界）

### SearchOptions 扩展

在现有 `SearchOptions` / `EvidenceItem` 上增加两个可选过滤维度。只有 SearchOptions 没有 EvidenceItem 元数据会导致 `upsert → rowToItem → recall` 链路无法保留 world scope。

```typescript
interface SearchOptions {
  // ... 现有字段不变 ...
  worldId?: string;          // 过滤到指定世界的知识
  sceneId?: string;          // 进一步过滤到指定场景
}

interface EvidenceItem {
  // ... 现有字段不变 ...
  worldId?: string;
  sceneId?: string;
}
```

### WorldKnowledgeAdapter

薄适配层，连接世界 runtime 状态和 F102 检索基础设施：

```typescript
interface IWorldKnowledgeAdapter {
  // accepted canon → evidence index（派生，可重建）
  indexCanon(record: CanonPromotionRecord, worldName: string): Promise<void>;

  // world-scoped recall（WorldContextEnvelope.recall 的数据源）
  searchWorld(query: string, options: {
    worldId: string;
    sceneId?: string;
    mode?: 'lexical' | 'semantic' | 'hybrid';
    limit?: number;
  }): Promise<WorldRecallResult>;

  // 从 world runtime 表重建所有 evidence（灾难恢复）
  rebuildWorldIndex(worldId: string): Promise<void>;
}
```

### evidence_docs 扩展

Schema V16（在现有 V15 基础上）：

```sql
-- V16: F093 world scope
ALTER TABLE evidence_docs ADD COLUMN world_id TEXT;
ALTER TABLE evidence_docs ADD COLUMN scene_id TEXT;
CREATE INDEX idx_evidence_docs_world ON evidence_docs(world_id);
CREATE INDEX idx_evidence_docs_world_scene ON evidence_docs(world_id, scene_id);
```

`world_id` / `scene_id` 仅用于 world-scoped 的派生 evidence。现有 docs/threads evidence 的这两列为 NULL，查询行为不变。

---

## 5. 开放问题（review 决策）

| # | 问题 | 决策 |
|---|------|------|
| DG-1 | 世界 runtime 表放 evidence.sqlite 里还是独立 world.sqlite？ | ✅ 独立 `world.sqlite`。World runtime 表是权威状态，evidence index 是派生层；物理隔离避免 rebuild / migration / FTS 维护影响世界状态。 |
| DG-2 | `WorldContextEnvelope.recentEvents` 取多少条？硬编码还是配置化？ | ✅ world 级别可配置，默认 20 条，但 runtime 必须有全局 token-budget hard cap。 |
| DG-3 | Perform 模式下 agent 可以同时输出多个 action 吗（如对话 + 状态变更）？ | ✅ 可以。`actions[]` 同事务提交；coordinator 必须按 action type 做 mode allowlist 和 idempotency 校验。 |
| DG-4 | `UpdateCharacterStateAction.patch` 用 JSON Merge Patch 还是自定义？ | ✅ 用 JSON Patch (RFC 6902) 的受限子集：`add` / `replace` / `remove` + JSON Pointer path allowlist。原因：Replay/审计需要精确 diff，Merge Patch 对数组是整体替换，容易误删 milestones/bonds。 |
| DG-5 | Care Loop 触发条件（OQ-3 仍未解决） | ✅ Phase A 先做显式触发（场景策略声明 + 用户手动），不做情感推断。 |

---

## 6. Review Verdict（砚砚/GPT-5.5）

**结论：Design Gate 条件放行。** 上面的修正解决了 3 个 blocker：正典 accept/reject 有 typed action、用户/系统 actor 不再被迫伪装成 cat、角色定义编辑和角色状态演化分离。Phase A 可以进入 worktree + TDD，但实现时必须保留这些约束：

1. `world.sqlite` 是权威状态；`evidence.sqlite` 只存派生 recall。
2. `WorldActionEnvelope` 的每个 action 都要有 mode allowlist。
3. 所有 world-scoped evidence 必须写入并返回 `worldId`；缺这个字段就是 recall 隔离失败。
