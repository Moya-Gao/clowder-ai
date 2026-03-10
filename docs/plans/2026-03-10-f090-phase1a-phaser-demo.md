# F090 Phase 1a: Phaser Demo Implementation Plan

> **Status:** Implemented (all 6 tasks complete)

**Goal:** A playable pixel fighting game demo at `/pixel-brawl` with 2 cat fighters,
keyboard controls, HP system, and AI auto-fight mode.

**Architecture:** Phaser 3 embedded in Next.js App Router via `'use client'` page.
Game logic in `src/games/pixel-brawl/`. Phaser scenes handle rendering; GameState
manages HP/position/actions. All client-side for Phase 1a.

**Tech Stack:** Phaser 3.80+ | Next.js 14 App Router | TypeScript | Vitest

---

## Terminal Schema

See `packages/web/src/games/pixel-brawl/types.ts` for:
- `Fighter` interface (id, name, teamColor, hp, x, y, facing, state, cooldown, hitLanded)
- `GameConfig`, `HitResult`, `FighterId`, `FighterState`, `Facing`, `GameMode`
- `TEAM_COLORS`, `PALETTE`, `GROUND_Y`, `ATTACK_DAMAGE`, `ATTACK_COOLDOWN_MS`, etc.

---

## Task 1: Install Phaser + Create Empty Page ✅

- `packages/web/package.json` — added `phaser` dependency
- `packages/web/src/app/pixel-brawl/page.tsx` — Next.js page with mode selector

## Task 2: Types + Deterministic RNG ✅

- `packages/web/src/games/pixel-brawl/types.ts` — all types + constants
- `packages/web/src/games/pixel-brawl/rng.ts` — mulberry32 PRNG
- `packages/web/src/games/pixel-brawl/__tests__/rng.test.ts` — 4 tests
  - Determinism (same seed = same sequence)
  - Range correctness (`int()`, `pick()`)
  - Different seeds → different sequences

## Task 3: GameState Class ✅

- `packages/web/src/games/pixel-brawl/game-state.ts` — fighter factory, HP, hit detection
  - `createFighter()`, `getFighter()`, `getOpponent()`
  - `applyDamage()`, `isOver()`, `winner()`
  - `checkHit()` with `hitLanded` guard (P1-1 fix), `consumeHit()`, `resetSwing()`
- `packages/web/src/games/pixel-brawl/__tests__/game-state.test.ts` — 9 tests
  - Fighter creation, damage clamping, win detection
  - Hit range/state checks, single-hit-per-swing (regression)

## Task 4: AI Controller ✅

- `packages/web/src/games/pixel-brawl/ai-controller.ts` — deterministic AI
  - In range + off cooldown → 70% attack, 30% idle
  - Out of range → 80% approach, 10% retreat, 10% idle
- `packages/web/src/games/pixel-brawl/__tests__/ai-controller.test.ts` — 3 tests
  - Approaches when far, attacks when close, determinism with fixed seed

## Task 5: BattleScene ✅

- `packages/web/src/games/pixel-brawl/scenes/BattleScene.ts` — Phaser main scene
  - Background image (cityscape, 25% opacity)
  - Colored rectangle fighters with name labels
  - HUD: mirrored HP bars, timer countdown, ROUND 1, FIGHT! flash
  - Action system: move/attack/idle with cooldowns
  - Hit detection → damage + knockback + red flash
  - Match end: winner text + R to restart
  - Timer=0 check before combat processing (cloud P1 fix)
  - `matchEnded` flag for idempotent endMatch (local P1-2 fix)
  - Seed preservation on restart (local P2-2 fix)

## Task 6: Mode Toggle + Polish ✅

- `page.tsx`: Title screen with AI vs AI / Player vs AI buttons
- PvAI: A/D move, J attack controls with 5s fade hint
- AiVAI: "AI vs AI — watching" label
- Dynamic Phaser import (code-split, no SSR)
- Cleanup on unmount

---

## Review History

### R1 (codex, local)
- P1-1: Multi-hit attack bug → `hitLanded` + `consumeHit`/`resetSwing`
- P1-2: TIME UP unreachable → `matchEnded` flag
- P2-1: Phaser default import → namespace import
- P2-2: Seed lost on restart → `this.seed` preserved

### R2 (codex, local) — 放行, 0 P1/P2

### Cloud Review (codex, PR #352)
- P1: Extra combat frame after timeout → timer check moved before combat
- P2: Plan file 943 lines → trimmed to summary + file references

---

## Phase 1b Roadmap

- Replace rectangles with CUTE LEGENDS: CAT HEROES sprite sheets
- Pixel BitmapText fonts (Silkscreen, Tiny5, Press Start 2P)
- Expand to 4 fighters (opus46, opus45, codex, gpt54)
- Special skills per fighter
- Team meters, combo counter, sound effects
- Tune combat pacing (ATTACK_DAMAGE / COOLDOWN / AI probability)
