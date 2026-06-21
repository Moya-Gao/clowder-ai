---
doc_kind: implementation-plan
created: 2026-06-20
status: draft
feature_ids: [F138]
topics: [video, anime-forge, cucu-pr-flow, production-manifest, yoyoung-shorts]
related_docs:
  - ../videos/cucu-pr-flow/episode-brief.md
  - ../videos/cucu-pr-flow/shot-plan-v0.1.md
  - ../videos/cucu-pr-flow/animatic/README.md
  - ../videos/cucu-pr-flow/assets/README.md
  - ../discussions/2026-06-21-yoyoung-shorts-deep-dive/README.md
---

# Cucu PR Flow YoYoung-Inspired Remake Implementation Plan

**Feature:** F138 — `docs/features/F138-video-studio.md`
**Goal:** Rebuild `cucu-pr-flow` from a 78.4s horizontal animatic into a 9:16 fine-cut production with a manifest-driven short-drama workflow.
**Acceptance Criteria:**
- AC-1: A single production manifest describes story contract, episode beats, every shot, locked continuity, asset state, audio lane, artifact path, status, and next action.
- AC-2: The manifest can be validated by a local script before rendering.
- AC-3: The animatic builder can consume the manifest or a manifest-derived EDL without changing shot truth in two places.
- AC-4: The next render target is explicitly 9:16; horizontal 1280x720 remains labeled as a rhythm-validation artifact only.
- AC-5: Audio policy is visible per shot: source bed, BGM, SFX, TTS/real voice, subtitles, mix notes.
- AC-6: CVO can inspect a shot-card/workbench view or markdown table and see what remains before any new expensive generation.
**Architecture cell:** F138 video production pipeline.
**Map delta:** none
**Map delta why:** This is a content-pipeline slice under existing F138; it introduces no new runtime ownership boundary.
**Architecture:** Keep Git/file provenance as the source of truth. Learn YoYoung's stage rail and per-shot workbench, but do not copy its browser-only/cloud-private persistence boundary. The terminal object is a versioned production manifest that compiles into EDL/audio/render artifacts.
**Tech Stack:** JSON/Markdown manifests, Node validator, existing `animatic/build-animatic.mjs`, ffmpeg/ffprobe, existing generated assets.
**前端验证:** No — optional static workbench can be browser-previewed later, but this plan's first slice is schema/data/render plumbing.

---

## 0. Finish Line

**B definition:** `docs/videos/cucu-pr-flow/animatic/out/animatic-v2-vertical.mp4` is a 9:16 fine-cut candidate generated from a manifest that preserves story intent and visual continuity, not hand-edited state scattered across EDL, asset ledger, and audio plan.

**What we learned from YoYoung Shorts:**

1. The visible asset library is not the essence. It is the UI manifestation of a deeper contract: **story -> episode -> shot -> locked continuity -> first frame -> video -> history**.
2. Short drama production needs a stage rail, not a pile of files.
3. Characters, scenes, props, and audio textures must be reusable continuity contracts, not prompt prose.
4. Each shot should be a production card: beat intent, camera intent, locked assets, continuity rules, first frame, video, subtitles, audio, status, verdict.
5. Batch video output should track per-shot state and shared render parameters.
6. History matters, but for Cat Café history must be Git/file-backed so future cats can re-observe it.

**Deeper essence, beyond material visibility:**

YoYoung's public docs do not prove the private algorithm, but the product surface points to a useful production principle: **progressively freeze uncertainty**.

```text
idea/script
  -> story/episode structure
  -> character/scene/prop continuity contracts
  -> per-shot intent and acceptance region
  -> first-frame or still card that freezes composition
  -> i2v prompt that only supplies motion
  -> edit/audio layer that controls rhythm, subtitles, and sound
  -> history/reuse loop
```

For a longer short drama, the hard part is not "can I see all assets?" The hard part is that every shot must know:

- which story beat it serves;
- which previous/next shot it must match;
- which character features cannot drift;
- which scene geography and prop state must persist;
- what camera/motion is allowed;
- what counts as success and what failure mode forces a split/remake.

That is exactly where our existing anime-forge rules and YoYoung's visible workflow converge. Our current EP01 already has the hard-won generation rules; the remake should make those rules explicit and machine-checkable.

**What we are not building:**

- No full web studio.
- No browser-only project persistence.
- No new model provider abstraction.
- No new expensive image/video generation before CVO can inspect the manifest/workbench state.
- No rewrite of the story beats unless CVO changes the creative direction.

## 1. Current Evidence

Current `cucu-pr-flow` status:

- Story/scope truth: `docs/videos/cucu-pr-flow/episode-brief.md`
- Shot truth: `docs/videos/cucu-pr-flow/shot-plan-v0.1.md`
- Current generated output: `docs/videos/cucu-pr-flow/animatic/out/animatic-v1.mp4`
- Current output properties: 78.4s, 1280x720, H.264 video, AAC stereo audio.
- Current EDL says 1280x720 is a rhythm-validation format and terminal fine cut should return to 9:16.
- Assets are already mostly complete: generated clips cover S01/S02/S03/S04/S05/S07b/S09/S11; static frames cover S06/S07a/S08/S10.
- Audio plan exists and already records source-audio exclusions for S00/S01 because original Landy dialogue is off-timeline.

Important prior lesson:

- LL-071 says content production needs explicit CVO-aligned scope before cats self-run A2A chains. This plan must prevent another "we did a lot, but not the intended video" cycle.

## 2. Terminal Schema

The terminal object is `docs/videos/cucu-pr-flow/production-manifest.json`.

```ts
interface ProductionManifest {
  version: '0.1';
  project: 'cucu-pr-flow';
  format: {
    targetAspect: '9:16';
    width: 720;
    height: 1280;
    fps: 30;
    currentRenderRole: 'rhythm-validation' | 'fine-cut-candidate' | 'final';
  };
  story: StoryContract;
  stages: Array<{
    id: 'brief' | 'assets' | 'shot-plan' | 'keyframes' | 'video' | 'audio' | 'edit' | 'qa' | 'release';
    status: 'not_started' | 'in_progress' | 'blocked' | 'ready' | 'approved';
    evidence: string[];
  }>;
  assets: {
    characters: AssetRecord[];
    scenes: AssetRecord[];
    props: AssetRecord[];
    staticFrames: AssetRecord[];
    videoClips: AssetRecord[];
    audioBeds: AssetRecord[];
  };
  shots: ShotCard[];
  renderOutputs: RenderOutput[];
}

interface StoryContract {
  logline: string;
  episodeArc: Array<{
    id: string;
    beat: string;
    purpose: 'setup' | 'expectation' | 'twist' | 'escalation' | 'proof' | 'payoff' | 'warmth';
    requiredShots: string[];
  }>;
  continuityRules: Array<{
    id: string;
    scope: 'character' | 'scene' | 'prop' | 'audio' | 'style' | 'story';
    rule: string;
    appliesToShots: string[];
  }>;
}

interface AssetRecord {
  id: string;
  kind: 'character' | 'scene' | 'prop' | 'static_frame' | 'video_clip' | 'audio_bed';
  status: 'candidate' | 'accepted' | 'rejected' | 'missing';
  path?: string;
  md5?: string;
  durationSec?: number;
  visualAnchors?: string[];
  promptContract?: string;
  continuityRules?: string[];
  notes?: string;
}

interface ShotCard {
  id: string;
  order: number;
  role: 'title' | 'setup' | 'relationship' | 'info' | 'evidence' | 'reaction' | 'status' | 'finale' | 'end_card' | 'true_end' | 'evidence_roll';
  targetDurationMs: number;
  method: 'video' | 'stills' | 'title' | 'posterTitle' | 'black';
  targetAspect: '9:16' | '16:9' | 'mixed-source';
  status: 'not_started' | 'assets_ready' | 'generated' | 'needs_remake' | 'ready_for_edit' | 'approved';
  beatIntent: string;
  cameraIntent: string;
  acceptanceRegion: string;
  acceptance: string;
  lockedAssets: string[];
  continuityLocks: string[];
  dependsOnShots: string[];
  video?: { src: string; trimSec: number; sourceAudioPolicy: 'use' | 'skip' | 'replace' };
  stills?: Array<{ src: string; holdMs: number }>;
  subtitles: Array<{ startMs: number; endMs: number; text: string; os?: boolean }>;
  audio: {
    bgm: 'global' | 'none';
    sfx: string[];
    tts: string[];
    sourceBed: 'use' | 'skip' | 'replace';
    notes?: string;
  };
  failureModes: string[];
  nextAction: string;
}
```

## 3. Stateful Object Gate

### Lifecycle Owner

`production-manifest.json` is owned by the episode producer for this slice. For implementation, that owner is `@codex` until review handoff.

### State × Event Table

| Object | State | Event | Next State | Invariant |
|---|---|---|---|---|
| Stage | `not_started` | evidence file exists | `in_progress` or `ready` | INV-1 |
| Stage | `in_progress` | all required shot cards are `ready_for_edit` | `ready` | INV-2 |
| Stage | `ready` | CVO/reviewer approves | `approved` | INV-3 |
| ShotCard | `assets_ready` | source media exists and validates | `generated` | INV-4 |
| ShotCard | `generated` | needs 9:16 remake | `needs_remake` | INV-5 |
| ShotCard | `generated` | aspect/duration/audio/subtitle checks pass | `ready_for_edit` | INV-6 |
| ShotCard | `ready_for_edit` | fine-cut render accepted | `approved` | INV-7 |
| AssetRecord | `candidate` | visual/audio QA accepts | `accepted` | INV-8 |
| AssetRecord | `candidate` | QA rejects | `rejected` | INV-9 |
| RenderOutput | `fine-cut-candidate` | QA pass + CVO pass | `final` | INV-10 |
| StoryContract | any | shot added/removed | validate beat coverage | INV-11 |
| ContinuityRule | any | shot references asset | validate lock inheritance | INV-12 |

### Invariants

| # | Invariant | Test |
|---|---|---|
| INV-1 | Every stage evidence path exists or is explicitly marked external. | validator stat check |
| INV-2 | Every non-title shot has either `video` or `stills`; never both unless method explicitly allows it. | validator |
| INV-3 | CVO-gated states cannot be marked `approved` without an evidence note. | validator |
| INV-4 | Every `video.src` exists under `docs/videos/cucu-pr-flow/assets/` or `animatic/out/` if local-only output. | validator |
| INV-5 | Any `targetAspect: mixed-source` shot must have `nextAction` explaining whether it is acceptable or needs vertical remake. | validator |
| INV-6 | Every subtitle cue duration is positive and within the shot duration. | validator |
| INV-7 | Every shot with `sourceAudioPolicy: skip` must explain replacement bed/texture in `audio.notes`. | validator |
| INV-8 | Every accepted asset has `path` and either `md5` or an explicit `external` note. | validator |
| INV-9 | Rejected assets never appear in `lockedAssets`. | validator |
| INV-10 | A final render cannot use `format.currentRenderRole: rhythm-validation`. | validator |
| INV-11 | Every story beat lists at least one shot, and every non-evidence-roll shot belongs to a beat. | validator |
| INV-12 | Every shot with a character/scene/prop asset also lists at least one continuity lock for that asset or explicitly explains why not. | validator |
| INV-13 | Every shot has `beatIntent`, `cameraIntent`, and `acceptanceRegion`; empty prose means the model is being asked to invent the scene. | validator |

### Adversarial Scenarios

| Scenario | Expected Defense |
|---|---|
| A shot exists in EDL but not in manifest | validator fails with missing shot id |
| A shot exists in manifest but not in render EDL | validator fails unless status is `not_started` or `blocked` |
| S00/S01 source audio accidentally re-enabled | validator checks skip/replacement notes |
| Horizontal render mislabeled as final | validator rejects `currentRenderRole: final` with non-9:16 dimensions |
| A rejected failure sample is reused as accepted clip | validator rejects rejected asset in `lockedAssets` or shot media |
| A long-drama shot is added without beat linkage | validator rejects shot without story beat |
| A character appears after costume/identity drift | validator flags missing continuity lock and requires CVO/reviewer decision |

## 4. Implementation Tasks

### Task 1: Add Story Contract + Production Manifest Skeleton

**Files:**
- Create: `docs/videos/cucu-pr-flow/production-manifest.json`
- Create: `docs/videos/cucu-pr-flow/production-manifest.schema.json`
- Optionally create later: `docs/videos/cucu-pr-flow/story-bible.md` if CVO wants a human-readable companion.

**Step 1:** Write schema for the terminal shape above, including story contract, continuity locks, beat intent, camera intent, and acceptance region.

**Step 2:** Create manifest with current known stages, format, story beats, continuity rules, assets, and all shot ids from `edl-v1.mjs`.

**Step 3:** Run:

```bash
node -e "JSON.parse(require('fs').readFileSync('docs/videos/cucu-pr-flow/production-manifest.json','utf8')); JSON.parse(require('fs').readFileSync('docs/videos/cucu-pr-flow/production-manifest.schema.json','utf8')); console.log('json ok')"
```

Expected: `json ok`.

### Task 2: Add Validator

**Files:**
- Create: `scripts/validate-cucu-production-manifest.mjs`
- Test: `test/scripts/validate-cucu-production-manifest.test.mjs`

**Step 1:** Write failing tests for INV-1 through INV-10 using a small fixture manifest.

**Step 2:** Implement validator:

```bash
node scripts/validate-cucu-production-manifest.mjs docs/videos/cucu-pr-flow/production-manifest.json
```

Expected: fails before manifest is complete, then passes when current manifest satisfies all invariants including story/continuity coverage.

### Task 3: Generate Manifest-Derived EDL

**Files:**
- Create: `docs/videos/cucu-pr-flow/animatic/compile-manifest-edl.mjs`
- Modify: `docs/videos/cucu-pr-flow/animatic/build-animatic.mjs`

**Step 1:** Add compiler that reads manifest and emits the current `edl` shape.

**Step 2:** Keep `edl-v1.mjs` as frozen historical input; create `edl-v2.mjs` as generated or manifest-synced output.

**Step 3:** Run:

```bash
node docs/videos/cucu-pr-flow/animatic/compile-manifest-edl.mjs
node docs/videos/cucu-pr-flow/animatic/build-animatic.mjs
```

Expected: same shot order as current v1, no duration drift except deliberate v2 edits.

### Task 4: Make the Vertical Remake Explicit

**Files:**
- Modify: `docs/videos/cucu-pr-flow/production-manifest.json`
- Modify: `docs/videos/cucu-pr-flow/animatic/edl-v2.mjs`

**Step 1:** Set render target to 720x1280.

**Step 2:** Mark each mixed-source/horizontal shot with one of:

- keep with blur-pad for CVO rhythm review
- remake vertical before final
- replace with still/card

**Step 3:** Render:

```bash
node docs/videos/cucu-pr-flow/animatic/build-animatic.mjs
ffprobe -hide_banner -v error -show_entries stream=width,height,duration -of json docs/videos/cucu-pr-flow/animatic/out/animatic-v2-vertical.mp4
```

Expected: video stream is 720x1280.

### Task 5: Add Shot Workbench View

**Files:**
- Create: `docs/videos/cucu-pr-flow/workbench.html`
- Create: `docs/videos/cucu-pr-flow/workbench.mjs`

**Step 1:** Render manifest shot cards: status, thumbnail path, subtitles, audio policy, next action.

**Step 2:** Open via static file or local server and inspect.

**Step 3:** CVO can answer: "which shots are fine, which must be remade, which audio is missing" without reading the EDL.

### Task 6: Fine-Cut Audio Pass

**Files:**
- Modify: `docs/videos/cucu-pr-flow/animatic/audio/audio-plan-v0.1.mjs`
- Optionally create: `docs/videos/cucu-pr-flow/animatic/audio/audio-plan-v0.2.mjs`

**Step 1:** Move source-audio policy into manifest, import it from audio plan.

**Step 2:** Add slots for Landy real voice stems without requiring them.

**Step 3:** Regenerate and verify:

```bash
node docs/videos/cucu-pr-flow/animatic/audio/build-audio.mjs
node docs/videos/cucu-pr-flow/animatic/build-animatic.mjs
ffprobe -hide_banner -v error -show_entries stream=codec_type,codec_name,sample_rate,channels,duration -of json docs/videos/cucu-pr-flow/animatic/out/animatic-v2-vertical.mp4
```

Expected: AAC stereo audio, same duration as video.

## 5. Decision Packet

**TL;DR:** We should not restart from zero. We should remake the workflow and final render around a production manifest whose real payload is story continuity, shot intent, and per-shot acceptance, then do a vertical fine cut.

**Recommended decision:** Start with the lightweight `cucu-pr-flow` manifest, not a generic anime-forge schema.

**Why:** This directly fixes the current pain: scattered state, audio surprises, horizontal/vertical ambiguity, and no CVO-readable shot workbench. More importantly, it answers the long-short-drama problem: every generated shot must be constrained by story beat, locked continuity, camera intent, and acceptance region. Once this episode survives one full v2 render, extract the generic anime-forge schema.

**Rollback cost:** One commit. The plan and manifest are additive; existing `edl-v1.mjs`, assets, and animatic output stay untouched.

**Value question for CVO:** Is the next deliverable a family/internal funny fine cut, or a public 9:16 release candidate? The answer changes how aggressive we are about regenerating mixed-source horizontal shots.

## 6. Verification Checklist

- `node --test test/scripts/validate-cucu-production-manifest.test.mjs`
- `node scripts/validate-cucu-production-manifest.mjs docs/videos/cucu-pr-flow/production-manifest.json`
- `node docs/videos/cucu-pr-flow/animatic/build-animatic.mjs`
- `ffprobe` verifies width/height/duration/audio streams.
- Manual contact sheet check at 5-8s intervals.
- CVO shot-workbench review before any new expensive generation, specifically checking story continuity and shot intent, not just asset visibility.

---

Plan by 砚砚/GPT-5.5🐾
