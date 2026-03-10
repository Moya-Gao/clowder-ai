# F090 Phase 1b: 4 Cats + Pixel Fonts + Skills

> **For Claude:** REQUIRED SUB-SKILL: Use parallel-execution skill (Mode C) to implement this plan task-by-task.

**Goal:** Expand the Pixel Cat Brawl from 2 rectangle fighters to 4 cats with pixel fonts, unique special skills, sprite sheets, and tuned combat pacing.

**Architecture:** Generalize the hardcoded p1/p2 GameState to array-based N-fighter support. Extract BattleScene HUD into a separate class (current 340 lines near 350 limit). Add a skill system with per-cat cooldowns. Load CUTE LEGENDS sprite sheets with Phaser sprite animations. Use Google web fonts (Silkscreen, Press Start 2P) for pixel typography.

**Tech Stack:** Phaser 3, TypeScript, Vitest, Google Fonts (Silkscreen, Press Start 2P), CUTE LEGENDS: CAT HEROES sprite pack (16x16 per frame)

**Sprite status:** Assets not on disk yet. 铲屎官 provided link (https://9e0.itch.io/cute-legends-cat-heroes). Plan uses colored rectangles with cat-identifying patterns as placeholders. When sprites arrive, Task 7 swaps them in.

---

## Task 1: Extend types for 4-fighter + skill system

**Files:**
- Modify: `packages/web/src/games/pixel-brawl/types.ts`
- Test: `packages/web/src/games/pixel-brawl/__tests__/types.test.ts` (new)

**Step 1: Write type test**

```typescript
// __tests__/types.test.ts
import { describe, it, expect } from 'vitest';
import {
  SKILLS,
  TEAM_COLORS,
  FIGHTER_NAMES,
  FIGHTER_STATS,
  type SkillId,
} from '../types';

describe('types', () => {
  it('every FighterId has a skill, color, name, and stats', () => {
    const ids = ['opus46', 'opus45', 'codex', 'gpt54'] as const;
    for (const id of ids) {
      expect(TEAM_COLORS[id]).toBeDefined();
      expect(FIGHTER_NAMES[id]).toBeDefined();
      expect(FIGHTER_STATS[id]).toBeDefined();
      expect(SKILLS[FIGHTER_STATS[id].skillId]).toBeDefined();
    }
  });

  it('all skills have positive cooldown and duration', () => {
    for (const [, skill] of Object.entries(SKILLS)) {
      expect(skill.cooldownMs).toBeGreaterThan(0);
      expect(skill.durationMs).toBeGreaterThanOrEqual(0);
      expect(skill.damage).toBeGreaterThanOrEqual(0);
    }
  });
});
```

**Step 2: Run test — expect FAIL** (SKILLS, FIGHTER_STATS not defined)

```bash
cd /Users/lysander/projects/relay-station/cat-cafe-f090-pixel-brawl-1b
pnpm --filter @cat-cafe/web test -- --run packages/web/src/games/pixel-brawl/__tests__/types.test.ts
```

**Step 3: Add skill + stats types to types.ts**

Add after existing exports:

```typescript
// --- Skill System ---

export type SkillId =
  | 'architecture_lock'    // 宪宪 4.6 — 架构禁锢
  | 'logic_threads'        // 宪宪 4.5 — 逻辑丝线
  | 'code_flood'           // 砚砚 Codex — 代码洪流
  | 'golden_review';       // 砚砚 GPT-5.4 — 金级 Review

export interface SkillDef {
  id: SkillId;
  name: string;
  description: string;
  cooldownMs: number;      // time between uses
  durationMs: number;      // effect duration (0 = instant)
  damage: number;          // direct damage
  range: number;           // activation range (pixels)
}

export const SKILLS: Record<SkillId, SkillDef> = {
  architecture_lock: {
    id: 'architecture_lock',
    name: '架构禁锢',
    description: 'Trap opponent in a structure block for 2s',
    cooldownMs: 8000,
    durationMs: 2000,
    damage: 5,
    range: 80,
  },
  logic_threads: {
    id: 'logic_threads',
    name: '逻辑丝线',
    description: 'Multi-hit slicing damage over time',
    cooldownMs: 6000,
    durationMs: 1500,
    damage: 15,  // total across ticks
    range: 70,
  },
  code_flood: {
    id: 'code_flood',
    name: '代码洪流',
    description: 'AOE push wave that knocks back',
    cooldownMs: 7000,
    durationMs: 0,
    damage: 12,
    range: 100,
  },
  golden_review: {
    id: 'golden_review',
    name: '金级 Review',
    description: 'Stamp the ground — AOE damage + slow',
    cooldownMs: 9000,
    durationMs: 1000,
    damage: 18,
    range: 90,
  },
};

export interface FighterStatsDef {
  skillId: SkillId;
  moveSpeed: number;     // pixels/sec
  attackDamage: number;   // basic attack damage
}

export const FIGHTER_STATS: Record<FighterId, FighterStatsDef> = {
  opus46:  { skillId: 'architecture_lock', moveSpeed: 150, attackDamage: 9 },
  opus45:  { skillId: 'logic_threads',     moveSpeed: 140, attackDamage: 10 },
  codex:   { skillId: 'code_flood',        moveSpeed: 170, attackDamage: 8 },
  gpt54:   { skillId: 'golden_review',     moveSpeed: 155, attackDamage: 11 },
};
```

Also extend `Fighter` interface:

```typescript
export interface Fighter {
  // ... existing fields ...
  skillCooldownMs: number;   // remaining cooldown for special skill
  skillActiveMs: number;     // remaining duration of active skill effect
  stunMs: number;            // remaining stun duration (from opponent skill)
}
```

And extend `AiAction` concept — add `'skill'` to valid actions.

**Step 4: Run test — expect PASS**

**Step 5: Commit**

```bash
git add -A && git commit -m "feat(F090): add skill system types and per-cat stats [布偶猫🐾]"
```

---

## Task 2: Generalize GameState from 2 → N fighters

**Files:**
- Modify: `packages/web/src/games/pixel-brawl/game-state.ts`
- Modify: `packages/web/src/games/pixel-brawl/__tests__/game-state.test.ts`

**Step 1: Write failing tests for 4-fighter GameState**

Add to existing test file:

```typescript
describe('4-fighter GameState', () => {
  it('creates 4 fighters with correct positions', () => {
    const gs = new GameState(['opus46', 'opus45', 'codex', 'gpt54']);
    expect(gs.fighters).toHaveLength(4);
    expect(gs.fighters[0].id).toBe('opus46');
    expect(gs.fighters[3].id).toBe('gpt54');
  });

  it('getFighter returns correct fighter by id', () => {
    const gs = new GameState(['opus46', 'opus45', 'codex', 'gpt54']);
    expect(gs.getFighter('gpt54').name).toBe('GPT 5.4');
  });

  it('isOver when any fighter reaches 0 HP', () => {
    const gs = new GameState(['opus46', 'opus45', 'codex', 'gpt54']);
    expect(gs.isOver()).toBe(false);
    gs.applyDamage('codex', 100);
    expect(gs.isOver()).toBe(true);
  });

  it('skill cooldown initializes to 0', () => {
    const gs = new GameState(['opus46', 'codex']);
    expect(gs.getFighter('opus46').skillCooldownMs).toBe(0);
  });

  // Backward compat: p1/p2 still work
  it('p1/p2 aliases work for 2-fighter mode', () => {
    const gs = new GameState(['opus46', 'codex']);
    expect(gs.p1.id).toBe('opus46');
    expect(gs.p2.id).toBe('codex');
  });
});
```

**Step 2: Run — expect FAIL** (constructor signature changed)

**Step 3: Refactor GameState**

- Change constructor: `constructor(fighterIds: FighterId[])`
- Store `fighters: Fighter[]` array
- `p1`/`p2` become getters for `fighters[0]`/`fighters[1]` (backward compat)
- `createFighter` adds `skillCooldownMs: 0, skillActiveMs: 0, stunMs: 0`
- Space fighters evenly: x positions at `160, 320, 480, 560` (or computed)
- `getOpponent(id)` → for 2-fighter returns the other; for 4-fighter returns **nearest enemy** (simple distance)
- `isOver()` → any fighter HP <= 0

**Step 4: Fix existing 2-fighter tests** that use `new GameState('opus46', 'codex')` → `new GameState(['opus46', 'codex'])`

**Step 5: Run all game-state tests — expect PASS**

**Step 6: Commit**

```bash
git add -A && git commit -m "refactor(F090): generalize GameState to N fighters [布偶猫🐾]"
```

---

## Task 3: Add skill execution to GameState

**Files:**
- Modify: `packages/web/src/games/pixel-brawl/game-state.ts`
- Test: `packages/web/src/games/pixel-brawl/__tests__/game-state.test.ts`

**Step 1: Write failing tests**

```typescript
describe('skill system', () => {
  it('activateSkill sets cooldown and active duration', () => {
    const gs = new GameState(['opus46', 'codex']);
    gs.activateSkill('opus46');
    const f = gs.getFighter('opus46');
    expect(f.skillCooldownMs).toBe(8000); // architecture_lock cooldown
    expect(f.skillActiveMs).toBe(2000);
  });

  it('activateSkill does nothing if on cooldown', () => {
    const gs = new GameState(['opus46', 'codex']);
    gs.activateSkill('opus46');
    gs.activateSkill('opus46'); // should be no-op
    expect(gs.getFighter('opus46').skillCooldownMs).toBe(8000);
  });

  it('checkSkillHit returns hit when in range', () => {
    const gs = new GameState(['opus46', 'codex']);
    // Move codex into skill range
    gs.getFighter('codex').x = gs.getFighter('opus46').x + 50;
    gs.activateSkill('opus46');
    const hit = gs.checkSkillHit('opus46');
    expect(hit).not.toBeNull();
    expect(hit!.damage).toBe(5); // architecture_lock damage
  });

  it('architecture_lock stuns the target', () => {
    const gs = new GameState(['opus46', 'codex']);
    gs.getFighter('codex').x = gs.getFighter('opus46').x + 50;
    gs.activateSkill('opus46');
    const hit = gs.checkSkillHit('opus46');
    if (hit) gs.applySkillEffect('opus46', hit.defenderId);
    expect(gs.getFighter('codex').stunMs).toBe(2000);
  });
});
```

**Step 2: Run — expect FAIL**

**Step 3: Implement skill methods**

Add to GameState:
- `activateSkill(id)` — sets cooldown + activeMs from SKILLS lookup
- `checkSkillHit(id)` — like checkHit but uses skill range/damage
- `applySkillEffect(attackerId, defenderId)` — applies per-skill effect (stun, DoT, knockback, AOE)
- `tickCooldowns(deltaMs)` — reduces skillCooldownMs, skillActiveMs, stunMs

**Step 4: Run — expect PASS**

**Step 5: Commit**

```bash
git add -A && git commit -m "feat(F090): add skill activation + effect system [布偶猫🐾]"
```

---

## Task 4: Update AI controller for skills + 4 cats

**Files:**
- Modify: `packages/web/src/games/pixel-brawl/ai-controller.ts`
- Modify: `packages/web/src/games/pixel-brawl/__tests__/ai-controller.test.ts`

**Step 1: Write failing test**

```typescript
it('AI uses skill when off cooldown and in range', () => {
  // Create game state with opus46 in skill range
  const gs = new GameState(['opus46', 'codex']);
  gs.getFighter('codex').x = gs.getFighter('opus46').x + 50;
  // Seeded RNG that gives roll < 0.3 → should pick skill
  const ai = new AiController('opus46', createRng(42));
  // Run enough decisions to get a 'skill' action
  let gotSkill = false;
  for (let i = 0; i < 100; i++) {
    const action = ai.decide(gs);
    if (action === 'skill') { gotSkill = true; break; }
  }
  expect(gotSkill).toBe(true);
});
```

**Step 2: Run — expect FAIL** (`'skill'` not in AiAction)

**Step 3: Extend AiAction + decision logic**

- Add `'skill'` to `AiAction` type
- In `decide()`: if skill off cooldown + in skill range → 30% chance to use skill
- Per-cat personality tuning (optional, can add aggression/defense weights later)

**Step 4: Run — expect PASS**

**Step 5: Commit**

```bash
git add -A && git commit -m "feat(F090): AI controller supports skill action [布偶猫🐾]"
```

---

## Task 5: Extract HUD into separate class

**Files:**
- Create: `packages/web/src/games/pixel-brawl/scenes/BattleHud.ts`
- Modify: `packages/web/src/games/pixel-brawl/scenes/BattleScene.ts`

**Why:** BattleScene is 340 lines (near 350 limit). Adding 4 fighters + skills would blow past it. HUD logic (HP bars, timer, labels, skill indicators) extracts cleanly.

**Step 1: Create BattleHud class**

```typescript
// scenes/BattleHud.ts
import * as Phaser from 'phaser';
import type { Fighter } from '../types';
import { PALETTE, TEAM_COLORS, SKILLS, FIGHTER_STATS } from '../types';

export class BattleHud {
  private hpBars: Map<string, Phaser.GameObjects.Rectangle> = new Map();
  private skillBars: Map<string, Phaser.GameObjects.Rectangle> = new Map();
  private nameLabels: Map<string, Phaser.GameObjects.Text> = new Map();
  private timerText!: Phaser.GameObjects.Text;
  private fightText!: Phaser.GameObjects.Text;

  constructor(
    private scene: Phaser.Scene,
    private fighters: Fighter[],
  ) {}

  create(): void { /* build all HUD elements */ }
  update(fighters: Fighter[], timer: number): void { /* sync HP/skill bars */ }
  showFight(): void { /* FIGHT! flash */ }
  hideFight(): void { /* hide FIGHT! */ }
  showResult(label: string): void { /* K.O. / TIME UP */ }
  showRestart(): void { /* Press R hint */ }
}
```

**Step 2: Move HUD creation/update from BattleScene → BattleHud**

The HUD handles:
- Per-fighter HP bar (positioned based on fighter count: 2 bars for 2v2, 4 bars for 4-way)
- Timer text
- FIGHT! / ROUND text
- Result text
- Skill cooldown indicators (new)
- Fighter name labels under sprites

**Step 3: BattleScene delegates to `this.hud.create()` and `this.hud.update()`**

**Step 4: Verify BattleScene stays under 200 lines, BattleHud under 200 lines**

**Step 5: Run existing tests — expect PASS** (no logic change, only extraction)

**Step 6: Commit**

```bash
git add -A && git commit -m "refactor(F090): extract BattleHud from BattleScene [布偶猫🐾]"
```

---

## Task 6: Generalize BattleScene for 4 fighters + skills

**Files:**
- Modify: `packages/web/src/games/pixel-brawl/scenes/BattleScene.ts`
- Modify: `packages/web/src/games/pixel-brawl/scenes/BattleHud.ts`

**Step 1: Update BattleScene**

- `init()`: accept `fighters: FighterId[]` in data (default `['opus46', 'codex']`)
- Create `GameState(fighterIds)` instead of hardcoded 2
- Create one `AiController` per non-player fighter
- `update()` loop: iterate all fighters for actions, hit detection, skill effects
- Player controls P1 in pvai mode; all others AI
- `applyAction` handles `'skill'` action
- Visual: one rectangle per fighter, positioned from GameState
- Skill VFX: flash effect when skill activates (colored rectangle overlay matching team color)

**Step 2: Update BattleHud for 4 fighters**

- HP bars: 2 on left (blue team), 2 on right (green/gold team) — or 4 across top
- Skill cooldown indicator per fighter (small bar under HP bar)
- Timer centered

**Step 3: Update page.tsx mode selector**

Add fighter count option or default to 4 in aivai mode, 2 in pvai mode.

**Step 4: Manual browser test** (deferred to codex Playwright)

**Step 5: Commit**

```bash
git add -A && git commit -m "feat(F090): 4-fighter battle + skill VFX [布偶猫🐾]"
```

---

## Task 7: Load pixel web fonts

**Files:**
- Modify: `packages/web/src/app/pixel-brawl/page.tsx` (add font links)
- Modify: `packages/web/src/games/pixel-brawl/scenes/BattleScene.ts` (font usage)
- Modify: `packages/web/src/games/pixel-brawl/scenes/BattleHud.ts` (font usage)

**Step 1: Add Google Fonts to page head**

In `page.tsx`, add `<link>` tags or use `next/font/google`:

```typescript
import { Press_Start_2P, Silkscreen } from 'next/font/google';

const pressStart = Press_Start_2P({ weight: '400', subsets: ['latin'] });
const silkscreen = Silkscreen({ weight: '400', subsets: ['latin'] });
```

**Step 2: Update font references in BattleScene/BattleHud**

- FIGHT! / ROUND / K.O. → `'Press Start 2P'` (bold, dramatic)
- HUD text (HP labels, timer, names) → `'Silkscreen'` (clean pixel font)
- Controls hint → `'Silkscreen'` 8px

**Step 3: Ensure fonts load before Phaser canvas renders text**

Use `document.fonts.ready` promise or a short delay.

**Step 4: Visual check** (deferred to codex Playwright)

**Step 5: Commit**

```bash
git add -A && git commit -m "feat(F090): pixel fonts — Press Start 2P + Silkscreen [布偶猫🐾]"
```

---

## Task 8: Sprite sheet integration (placeholder or real)

**Files:**
- Create: `packages/web/src/games/pixel-brawl/sprites.ts` (sprite config)
- Modify: `packages/web/src/games/pixel-brawl/scenes/BattleScene.ts`
- Assets: `packages/web/public/images/f090/sprites/` (when available)

**If sprites NOT on disk:** Create programmatic pixel-art placeholders:
- Each fighter is a colored rectangle with a distinctive pattern:
  - opus46: solid blue rectangle + small "4.6" text
  - opus45: light blue rectangle + small "4.5" text
  - codex: green rectangle + small "C" text
  - gpt54: gold rectangle + small "G" text
- On attack: flash white
- On hurt: flash red
- On skill: flash team color bright

**If sprites ARE on disk:**
- Load sprite sheet with `this.load.spritesheet()`
- 16x16 frames at 2x zoom = 32x32 display (with `pixelArt: true`)
- Define animation configs: idle (4f), run (6f), attack (4f), hurt (3f)
- Apply team color tint via `setTint()`

**Step 1: Create sprites.ts with animation config**

```typescript
export interface SpriteConfig {
  key: string;
  path: string;
  frameWidth: 16;
  frameHeight: 16;
  animations: Record<string, { start: number; end: number; frameRate: number; repeat: number }>;
}

// Placeholder — update paths when real assets arrive
export const SPRITE_CONFIGS: Record<FighterId, SpriteConfig | null> = {
  opus46: null, // null = use rectangle placeholder
  opus45: null,
  codex: null,
  gpt54: null,
};
```

**Step 2: BattleScene checks SPRITE_CONFIGS — uses sprite if available, rectangle if null**

**Step 3: Commit**

```bash
git add -A && git commit -m "feat(F090): sprite system with rectangle placeholders [布偶猫🐾]"
```

---

## Task 9: Combat pacing tuning

**Files:**
- Modify: `packages/web/src/games/pixel-brawl/types.ts` (constants)

**Context:** Phase 1a codex review noted matches end too fast (~20s). Tuning needed.

**Step 1: Adjust constants**

```typescript
export const ATTACK_DAMAGE = 7;        // was 10 — slower matches
export const ATTACK_COOLDOWN_MS = 500;  // was 400 — less spam
export const ATTACK_RANGE = 55;         // was 60 — slightly tighter
export const KNOCKBACK_FORCE = 100;     // was 120 — less ping-pong
```

Target match duration: 40-60 seconds.

**Step 2: Update any test assertions that depend on old damage values**

**Step 3: Run tests — expect PASS**

**Step 4: Commit**

```bash
git add -A && git commit -m "feat(F090): tune combat pacing — longer matches [布偶猫🐾]"
```

---

## Task 10: Quality gate + request review

**Step 1: Run full test suite**

```bash
cd /Users/lysander/projects/relay-station/cat-cafe-f090-pixel-brawl-1b
pnpm --filter @cat-cafe/web test -- --run
```

**Step 2: Run type check**

```bash
pnpm --filter @cat-cafe/web exec tsc --noEmit
```

**Step 3: Run lint**

```bash
pnpm check
```

**Step 4: Check file sizes** (none should exceed 350 lines)

```bash
wc -l packages/web/src/games/pixel-brawl/**/*.ts packages/web/src/games/pixel-brawl/scenes/*.ts
```

**Step 5: Load `quality-gate` skill and run self-check**

**Step 6: Load `request-review` skill → @ codex for review**

**Step 7: After codex passes → `merge-gate` → PR → cloud review → merge**

---

## Execution Notes

- **Tasks 1-4** are pure logic (types, GameState, AI) — all testable without browser
- **Task 5** is a refactor extraction — no behavior change, existing tests must pass
- **Task 6** integrates everything into the scene — visual testing needed (codex Playwright)
- **Tasks 7-8** are visual enhancements — may need font loading debugging
- **Task 9** is a constants-only change
- **Sprite status**: If 铲屎官 provides sprites mid-implementation, integrate immediately in Task 8; otherwise ship with placeholders and swap later
- **铲屎官 said**: "test in browser 你让codex用playwright做！你自己做完quality-gate让他帮你测试！" — I do quality-gate, codex does Playwright browser testing
