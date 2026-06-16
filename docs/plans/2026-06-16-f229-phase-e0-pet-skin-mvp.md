---
feature_ids: [F229]
topics: [concierge, pet-skin, sprite, projection, accessibility, desktop-pet]
doc_kind: plan
created: 2026-06-16
---

# F229 Phase E0 — PetSkin MVP（v1 布偶猫 + v0 四態投影）

**Feature:** F229 — `docs/features/F229-cat-ball-concierge.md`（Phase E 第一刀）
**Spec:** `docs/features/F229-petskin-contract.md`（KD-18 完整契约）
**Goal:** ConciergeBall 从过渡贴纸升级为 PetSkinContract 驱动的正式桌宠——v1 默认布偶猫像素风 sprite，4 态投影打通，三道闸验收。
**Acceptance Criteria:**
- **AC-E0-1**: v1 布偶猫 sprite 4 态（idle / running / review / failed）可在 ConciergeBall 正确渲染，64×64 可读
- **AC-E0-2**: `conciergeState → petState` 投影为纯函数，ConciergeBallState 全 8 值产出合法 CodexPetState，missing mapping fallback idle
- **AC-E0-3**: skin manifest（`pet.json`）通过 PetSkinContract 结构校验
- **AC-E0-4**: 三道闸 QA 通过（readability / identity-diff / provenance）
- **AC-E0-5**: 非 pet 状态信号通道不受影响（status dot / ARIA label 保留）
- **AC-E0-6**: ConciergeConfig.skin 支持 `'ragdoll-v1'`，新部署默认布偶猫
**Architecture cell:** `concierge-surface`
**Map delta:** none
**Map delta why:** PetSkin 是 concierge-surface 内部视觉层，不新增 cell
**Architecture:** PetSkinContract 是 `conciergeState → petState` 的纯投影（KD-18）。投影函数在 shared 包，skin manifest + sprites 在 web/public，ConciergeBall 通过 projection 函数选择 sprite。零新状态机——projection 是纯函数，manifest 是只读配置。
**Tech Stack:** TypeScript, React, Next.js (public static assets), Vitest
**前端验证:** Yes — reviewer 必须用浏览器实测 4 态 sprite 渲染 + 状态切换动画

---

## 不做什么（Phase E0 scope fence）

- ❌ 全 8×9 atlas spritesheet（defer E1+：v0 用单态 PNG，不走 atlas 合成）
- ❌ 自定义皮肤上传/管理 UI（v0 只有内置 ragdoll-v1，settings 页皮肤区保持锁定）
- ❌ 帧动画/多帧 idle 呼吸（v0 每态单帧静态 sprite，现有 CSS 呼吸动画保留）
- ❌ running-left / running-right / waving / jumping / waiting（defer per contract v0 section）
- ❌ 缅因猫/孟加拉猫/暹罗猫 skin（v1 只做布偶猫；raw 缅因猫素材已在 `assets/F229/desktop-pet-sprite/raw/`，后续 Phase 加工）
- ❌ 修改 concierge 状态机本身（ConciergeBallState 不变，projection 是它的下游消费者）

## Stateful Object Gate

本 plan 无新生命周期状态对象：

| 对象 | 分析 |
|------|------|
| PetStateProjection | 纯函数 `(ballState, projectionMap) → petState`，零存储 |
| SkinManifest (pet.json) | 只读静态配置，build-time 提交到 public/，runtime 从 static asset 加载 |
| ConciergeConfig.skin | 既有字段类型拓宽，生命周期由现有 ConciergeConfigStore 管理，无新 owner |

→ 三件套（状态×事件转移表 / 不变量 / 对抗场景）不适用。KD-18 明确要求"纯投影 + 无同步即无失同步"。

## 投影映射表（核心设计）

ConciergeBallState（代码现状）→ CodexPetState（v0 四态）:

| ConciergeBallState | CodexPetState | Why |
|--------------------|---------------|-----|
| `idle` | `idle` | 安静基线 |
| `sleeping` | `idle` | 安静态不需专属动画（v0） |
| `listening` | `idle` | 被动等待用户输入，视觉安静 |
| `thinking` | `running` | 值班猫正在工作 |
| `found` | `review` | 结果已就绪 |
| `needs-confirmation` | `idle` | v0 defer waiting 态；已有 status dot + card 表达确认 |
| `handoff` | `running` | 正在转交/接力 |
| `error` | `failed` | 阻塞/出错 |

Fallback invariant: 任何未映射值 → `idle`。

## Task 0: Sprite 生成（前置 — 非 code task）

**Who:** image-generation skill（opus 家族调 codex 桌宠风格生成）
**Input:** `assets/F229/desktop-pet-sprite/README.md` 中的 prompt 模板，替换角色行为：
```
角色是奶白色重点色布偶猫桌宠（蓝眼睛、蓬松长毛）
```
**Output:** 4 张 transparent PNG（idle / running / review / failed），192×208 source + 64×64 web-ready
**Pipeline:**
1. 云端生图（prompt 模板）→ raw sheet
2. 透明化：抠背景 → transparent PNG
3. 切片：等格切 4 态（idle / thinking=running / found=review / error=failed）
4. Resize：192×208 source（存 `assets/F229/desktop-pet-sprite/ragdoll-v1/`）+ 64×64 web-ready（存 `packages/web/public/concierge/skins/ragdoll-v1/`）
5. 三道闸 pre-check：64×64 可读 / 4 态同一只猫 / provenance 记录

**验收前置条件：** 4 张 64×64 sprite 存在于 `packages/web/public/concierge/skins/ragdoll-v1/` 后才进 Task 1。

**⚠️ Spike 出口**：如果云端生图质量不达标（三道闸 readability 不过），降级方案：暂用现有 `/concierge/sprites/ragdoll/*.png` 过渡贴纸中的 4 张（idle/thinking→running/found→review/error→failed）重命名使用，skin manifest provenance 标注 `"interim-reuse"`。代码架构不受素材来源影响。

---

## Task 1: PetSkinContract 类型 + 投影函数（shared 包）

**Files:**
- Create: `packages/shared/src/concierge/pet-skin-projection.ts`
- Create: `packages/shared/test/pet-skin-projection.test.js`
- Modify: `packages/shared/src/types/concierge.ts` — 拓宽 `skin` 类型
- Modify: `packages/shared/src/index.ts` — 导出新类型和函数

### Step 1: 写失败测试（Red）

`packages/shared/test/pet-skin-projection.test.js`:

```javascript
import { describe, it, expect } from 'vitest';
import { projectToPetState, PET_STATE_PROJECTION_V0 } from '../src/concierge/pet-skin-projection.js';

describe('projectToPetState — v0 四態投影', () => {
  const proj = PET_STATE_PROJECTION_V0;

  it('idle → idle', () => {
    expect(projectToPetState('idle', proj)).toBe('idle');
  });

  it('thinking → running (processing)', () => {
    expect(projectToPetState('thinking', proj)).toBe('running');
  });

  it('found → review (result ready)', () => {
    expect(projectToPetState('found', proj)).toBe('review');
  });

  it('error → failed', () => {
    expect(projectToPetState('error', proj)).toBe('failed');
  });

  it('sleeping → idle (fallback: quiet state)', () => {
    expect(projectToPetState('sleeping', proj)).toBe('idle');
  });

  it('listening → idle (fallback: passive)', () => {
    expect(projectToPetState('listening', proj)).toBe('idle');
  });

  it('handoff → running (transitioning)', () => {
    expect(projectToPetState('handoff', proj)).toBe('running');
  });

  it('needs-confirmation → idle (v0 defers waiting)', () => {
    expect(projectToPetState('needs-confirmation', proj)).toBe('idle');
  });

  it('unknown value → idle (fallback invariant)', () => {
    expect(projectToPetState('totally-unknown-state', proj)).toBe('idle');
  });

  it('all ConciergeBallState values produce valid CodexPetState', () => {
    const allBallStates = [
      'idle', 'sleeping', 'listening', 'thinking',
      'found', 'needs-confirmation', 'handoff', 'error',
    ];
    const validPetStates = new Set(['idle', 'running', 'review', 'failed']);
    for (const s of allBallStates) {
      expect(validPetStates.has(projectToPetState(s, proj))).toBe(true);
    }
  });
});
```

Run: `pnpm --filter @cat-cafe/shared test -- pet-skin-projection`
Expected: FAIL — module not found

### Step 2: 实现投影函数（Green）

`packages/shared/src/concierge/pet-skin-projection.ts`:

```typescript
import type { ConciergeBallState } from '../types/concierge.js';

/**
 * Codex Pet 动画状态 — v0 四態子集。
 * 完整集见 F229-petskin-contract.md（idle/running-right/running-left/waving/jumping/failed/waiting/running/review）。
 */
export type CodexPetState =
  | 'idle'
  | 'running'
  | 'review'
  | 'failed';

/** v0 投影映射 — concierge ball state → codex pet state */
export interface PetStateProjection {
  readonly version: 1;
  readonly fallback: 'idle';
  readonly map: Readonly<Partial<Record<ConciergeBallState, CodexPetState>>>;
}

/** v0 默认投影（与 F229-petskin-contract.md 对齐） */
export const PET_STATE_PROJECTION_V0: PetStateProjection = {
  version: 1,
  fallback: 'idle',
  map: {
    idle: 'idle',
    sleeping: 'idle',
    listening: 'idle',
    thinking: 'running',
    found: 'review',
    'needs-confirmation': 'idle',
    handoff: 'running',
    error: 'failed',
  },
} as const;

/**
 * 纯投影函数：ConciergeBallState → CodexPetState。
 * 零状态、零副作用、零存储。（KD-18: "纯投影 + 无同步即无失同步"）
 */
export function projectToPetState(
  ballState: string,
  projection: PetStateProjection,
): CodexPetState {
  return projection.map[ballState as ConciergeBallState] ?? projection.fallback;
}
```

Run: `pnpm --filter @cat-cafe/shared test -- pet-skin-projection`
Expected: PASS — all 10 tests green

### Step 3: 拓宽 ConciergeConfig.skin 类型

`packages/shared/src/types/concierge.ts` line 14:

```typescript
// Before:
skin: 'yarn-ball';

// After:
skin: 'yarn-ball' | 'ragdoll-v1';
```

### Step 4: 导出 + build 验证

`packages/shared/src/index.ts` — 追加导出:

```typescript
export { projectToPetState, PET_STATE_PROJECTION_V0 } from './concierge/pet-skin-projection.js';
export type { CodexPetState, PetStateProjection } from './concierge/pet-skin-projection.js';
```

Run: `pnpm --filter @cat-cafe/shared build && pnpm --filter @cat-cafe/shared test`
Expected: build + tests green

### Step 5: Commit

```bash
git add packages/shared/src/concierge/pet-skin-projection.ts \
  packages/shared/test/pet-skin-projection.test.js \
  packages/shared/src/types/concierge.ts \
  packages/shared/src/index.ts
git commit -m "feat(F229-E0): add PetSkinContract v0 projection types + pure function

PET_STATE_PROJECTION_V0 maps all 8 ConciergeBallState values to 4 CodexPetState
values (idle/running/review/failed) with fallback-to-idle invariant.
Widen ConciergeConfig.skin to accept 'ragdoll-v1'.
KD-18: pure projection, zero storage, zero sync.

[宪宪/Opus-4.6🐾]"
```

---

## Task 2: Skin Manifest + Assets（web/public）

**Files:**
- Create: `packages/web/public/concierge/skins/ragdoll-v1/pet.json`
- Create: `packages/web/public/concierge/skins/ragdoll-v1/idle.png` (from Task 0)
- Create: `packages/web/public/concierge/skins/ragdoll-v1/running.png`
- Create: `packages/web/public/concierge/skins/ragdoll-v1/review.png`
- Create: `packages/web/public/concierge/skins/ragdoll-v1/failed.png`

### Step 1: 创建 skin manifest

`packages/web/public/concierge/skins/ragdoll-v1/pet.json`:

```json
{
  "id": "ragdoll-v1",
  "displayName": "布偶猫 v1",
  "description": "Cat Cafe default concierge skin — ragdoll cat pixel art.",
  "version": 1,
  "format": "individual-sprites",
  "sprites": {
    "idle": "idle.png",
    "running": "running.png",
    "review": "review.png",
    "failed": "failed.png"
  },
  "projection": {
    "version": 1,
    "fallback": "idle",
    "map": {
      "idle": "idle",
      "sleeping": "idle",
      "listening": "idle",
      "thinking": "running",
      "found": "review",
      "needs-confirmation": "idle",
      "handoff": "running",
      "error": "failed"
    }
  },
  "identity": {
    "species": "cat",
    "breedOrForm": "ragdoll",
    "palette": [],
    "markings": ["blue lynx point", "blue eyes", "fluffy long fur"],
    "silhouetteNotes": "compact full-body, readable at 64x64",
    "allowedProps": []
  },
  "provenance": {
    "source": "image-generation",
    "generator": "cloud-imagegen",
    "promptTemplate": "assets/F229/desktop-pet-sprite/README.md",
    "notes": "v1 default skin — 4-state individual PNGs, no atlas. No logos, text, UI, scenery."
  },
  "qa": {
    "readabilityCheck": "pending",
    "identityDiffCheck": "pending",
    "provenanceCheck": "pending",
    "reviewer": "pending",
    "reviewedAt": null
  }
}
```

### Step 2: 放置 sprite 文件

将 Task 0 产出的 4 张 64×64 PNG 放入 `packages/web/public/concierge/skins/ragdoll-v1/`。

如果走 Spike 降级路径（复用过渡贴纸），从现有 `/concierge/sprites/ragdoll/` 复制 4 张并重命名：
- `idle.png` → `idle.png` (直用)
- `thinking.png` → `running.png`
- `found.png` → `review.png`
- `error.png` → `failed.png`

### Step 3: Commit

```bash
git add packages/web/public/concierge/skins/ragdoll-v1/
git commit -m "feat(F229-E0): add ragdoll-v1 skin manifest + v0 sprites

pet.json manifest follows PetSkinContract shape (F229-petskin-contract.md).
4 individual PNG sprites for v0 required states: idle/running/review/failed.
Format: individual-sprites (full atlas deferred to E1+).

[宪宪/Opus-4.6🐾]"
```

---

## Task 3: ConciergeBall 集成（投影驱动 sprite）

**Files:**
- Create: `packages/web/src/components/concierge/usePetSkin.ts`
- Create: `packages/web/src/components/concierge/__tests__/usePetSkin.test.ts`
- Modify: `packages/web/src/components/concierge/ConciergeBall.tsx`

### Step 1: 写 usePetSkin hook 失败测试（Red）

`packages/web/src/components/concierge/__tests__/usePetSkin.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { resolvePetSprite, FALLBACK_SPRITE_PATH } from '../usePetSkin';

describe('resolvePetSprite', () => {
  const skinBase = '/concierge/skins/ragdoll-v1';

  it('idle ballState → idle sprite', () => {
    expect(resolvePetSprite('idle', skinBase)).toBe(
      '/concierge/skins/ragdoll-v1/idle.png',
    );
  });

  it('thinking → running sprite (projection)', () => {
    expect(resolvePetSprite('thinking', skinBase)).toBe(
      '/concierge/skins/ragdoll-v1/running.png',
    );
  });

  it('found → review sprite', () => {
    expect(resolvePetSprite('found', skinBase)).toBe(
      '/concierge/skins/ragdoll-v1/review.png',
    );
  });

  it('error → failed sprite', () => {
    expect(resolvePetSprite('error', skinBase)).toBe(
      '/concierge/skins/ragdoll-v1/failed.png',
    );
  });

  it('sleeping → idle sprite (fallback)', () => {
    expect(resolvePetSprite('sleeping', skinBase)).toBe(
      '/concierge/skins/ragdoll-v1/idle.png',
    );
  });

  it('unknown state → idle sprite (fallback invariant)', () => {
    expect(resolvePetSprite('garbage', skinBase)).toBe(
      '/concierge/skins/ragdoll-v1/idle.png',
    );
  });
});

describe('FALLBACK_SPRITE_PATH', () => {
  it('is a valid path', () => {
    expect(FALLBACK_SPRITE_PATH).toMatch(/\.png$/);
  });
});
```

Run: `pnpm --filter @cat-cafe/web test -- usePetSkin`
Expected: FAIL — module not found

### Step 2: 实现 usePetSkin（Green）

`packages/web/src/components/concierge/usePetSkin.ts`:

```typescript
/**
 * F229 Phase E0: PetSkin sprite resolver.
 *
 * 纯函数 — 无 React state/effect。只做 projection + path 拼接。
 * Manifest 加载和 hook 封装是 E1+ 增强项（多皮肤切换 / 异步加载）。
 * v0 硬编码 ragdoll-v1 投影（PET_STATE_PROJECTION_V0）。
 */

import {
  projectToPetState,
  PET_STATE_PROJECTION_V0,
} from '@cat-cafe/shared';
import type { CodexPetState } from '@cat-cafe/shared';

/** v0 skin base path（public static） */
const RAGDOLL_V1_BASE = '/concierge/skins/ragdoll-v1';

/** pet state → sprite filename */
const PET_STATE_SPRITES: Record<CodexPetState, string> = {
  idle: 'idle.png',
  running: 'running.png',
  review: 'review.png',
  failed: 'failed.png',
};

/** 硬故障 fallback（skin 加载失败时） */
export const FALLBACK_SPRITE_PATH = `${RAGDOLL_V1_BASE}/idle.png`;

/**
 * 纯函数：ballState → sprite URL。
 * 对外导出供测试 + ConciergeBall 直接调用。
 */
export function resolvePetSprite(
  ballState: string,
  skinBase: string = RAGDOLL_V1_BASE,
): string {
  const petState = projectToPetState(ballState, PET_STATE_PROJECTION_V0);
  const filename = PET_STATE_SPRITES[petState] ?? PET_STATE_SPRITES.idle;
  return `${skinBase}/${filename}`;
}
```

Run: `pnpm --filter @cat-cafe/web test -- usePetSkin`
Expected: PASS

### Step 3: Commit（投影解析层）

```bash
git add packages/web/src/components/concierge/usePetSkin.ts \
  packages/web/src/components/concierge/__tests__/usePetSkin.test.ts
git commit -m "feat(F229-E0): add resolvePetSprite — projection-driven sprite resolver

Pure function: ConciergeBallState → PET_STATE_PROJECTION_V0 → sprite path.
V0 hardcodes ragdoll-v1 base path + 4-state sprites.
Hook wrapper deferred to E1+ (multi-skin async loading).

[宪宪/Opus-4.6🐾]"
```

### Step 4: 替换 ConciergeBall.tsx 硬编码 sprites（Red → Green）

Red 测试：在 ConciergeBall 现有测试（如果有）或新测试中验证 `resolvePetSprite` 被调用而非 STATE_SPRITES。

**ConciergeBall.tsx 改动**:

```typescript
// 删除（line 27-37）:
const STATE_SPRITES: Record<ConciergeBallState, string> = { ... };

// 新增 import:
import { resolvePetSprite } from './usePetSkin';

// 渲染层改动（img src 从 STATE_SPRITES[ballState] → resolvePetSprite(ballState)）:
// Before:
//   src={STATE_SPRITES[ballState]}
// After:
//   src={resolvePetSprite(ballState)}
```

关键保留项（AC-E0-5 非 pet 信号通道不动）:
- `STATE_DOT_COLORS` 保留原样（status dot = 非 pet 状态信号）
- `aria-label` 保留原样
- 呼吸动画 CSS（idle breathing）保留原样
- crossfade transition 保留（换 src 触发 transition）

Run: `pnpm --filter @cat-cafe/web test` (全量)
Expected: PASS

### Step 5: Commit

```bash
git add packages/web/src/components/concierge/ConciergeBall.tsx
git commit -m "feat(F229-E0): ConciergeBall uses projection-driven PetSkin sprites

Replace hardcoded STATE_SPRITES map with resolvePetSprite().
Status dot colors + ARIA labels + breathing animation preserved (AC-E0-5).
Old transition sprites at /concierge/sprites/ragdoll/ kept as legacy fallback.

[宪宪/Opus-4.6🐾]"
```

---

## Task 4: Config 默认值更新

**Files:**
- Modify: `packages/api/src/stores/concierge-config-store.ts` (或wherever DEFAULT_CONFIG lives) — default skin `'yarn-ball'` → `'ragdoll-v1'`
- Modify: relevant test fixtures

### Step 1: 找到并更新默认值

```typescript
// Before:
skin: 'yarn-ball',

// After:
skin: 'ragdoll-v1',
```

### Step 2: 验证 settings 页皮肤区

Settings 页（ConciergeSettingsContent）的皮肤区当前"锁定"。确认 ragdoll-v1 在 UI 显示正确名称。如果皮肤区用了 `skin` 值做显示，可能需要一个 display name 映射。

### Step 3: Commit

```bash
git commit -m "feat(F229-E0): default concierge skin ragdoll-v1

New deployments get ragdoll-v1 (pixel art ragdoll cat) instead of yarn-ball.
Existing configs with yarn-ball continue to work (type union preserved).
KD-14: v1 default = 布偶猫 (CVO 拍板).

[宪宪/Opus-4.6🐾]"
```

---

## Task 5: 三道闸 QA + 验收

### Gate 1: Readability（可读性）

- [ ] 64×64 渲染下 4 态 sprite 可辨识猫形（不是糊块）
- [ ] 无 text / label / speech bubble / UI element / checkboard
- [ ] 无 shadow-only state cue（状态不依赖阴影表达）
- [ ] 无 frame border / row guide / layout mark

### Gate 2: Identity-Diff（同一性）

- [ ] 4 态同一只猫——毛色/脸型/体型/尾巴一致
- [ ] palette 一致（奶白色+蓝眼睛）
- [ ] 无 species drift（不会某一态变成别的动物）
- [ ] silhouette 在 64×64 保持一致

### Gate 3: Provenance（来源可追溯）

- [ ] `pet.json` 有 generator / promptTemplate / notes
- [ ] source sprites 存 `assets/F229/desktop-pet-sprite/ragdoll-v1/`（192×208 source）
- [ ] web-ready sprites 在 `packages/web/public/concierge/skins/ragdoll-v1/`
- [ ] QA section 填写 reviewer + reviewedAt + check results

### 验收清单（AC-E0-1~6）

- [ ] AC-E0-1: 浏览器打开 concierge ball，4 态 sprite 正确渲染
- [ ] AC-E0-2: `pnpm --filter @cat-cafe/shared test -- pet-skin-projection` 全绿
- [ ] AC-E0-3: `pet.json` 结构匹配 PetSkinContract（手动 schema 校验）
- [ ] AC-E0-4: 三道闸全 pass（上方 checklist）
- [ ] AC-E0-5: status dot 颜色 + ARIA label 不变（浏览器验证）
- [ ] AC-E0-6: 新部署 skin 默认 ragdoll-v1（API 返回验证）

---

## PR 拆分预期

**1 PR（PR-E0）**：Task 1-4 合为一个 PR。体量预估 ~150-200 行新增（含测试）+ 4 张 sprite 文件。

Task 0（sprite 生成）在 PR 之前完成，产出物直接提交进 PR。

## OQ

| # | 类型 | 问题 | 处置 |
|---|------|------|------|
| OQ-1 | 技术 | 过渡贴纸 `/concierge/sprites/ragdoll/` 是否在 E0 删除？ | 保留不删——yarn-ball skin 的 fallback 资源。E1+ 统一清理 |
| OQ-2 | 技术 | v0 manifest 用 `individual-sprites` format 还是提前用 `codex-pet-atlas`？ | v0 用 `individual-sprites`（单态 PNG），避免 atlas 合成的前置依赖。manifest 里 format 字段区分 |
| OQ-3 | 技术 | 已有用户的 ConciergeConfig.skin = 'yarn-ball' 是否迁移？ | 不迁移——ConciergeBall 对 'yarn-ball' 回退到旧 STATE_SPRITES 逻辑（兼容）；新部署默认 ragdoll-v1 |
