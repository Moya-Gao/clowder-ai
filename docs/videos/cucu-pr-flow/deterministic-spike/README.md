---
title: 醋醋喵 D Lane Deterministic Spike
doc_kind: prototype
created: 2026-06-10
status: spike
author: 砚砚/Codex
topics: [catcafe, short-animation, deterministic-motion, html, timeline, s03, s04]
related_docs:
  - ../shot-plan-v0.1.md
  - ../review-protocol-v0.1.md
---

# 醋醋喵 D Lane Deterministic Spike

This folder proves the first D lane pair without adding app dependencies:

- **S03**: `avatar.png -> PR -> CI -> Review`
- **S04**: wrong-avatar evidence card with left/right comparison and red X

The point is not final polish. The point is that information shots can be made readable, timed by labels, and inserted into an animatic without video-model text drift.

## Files

| File | Purpose |
|---|---|
| `s03-s04-info-pair.html` | Openable prototype, 9:16 stage. |
| `s03-s04-info-pair.css` | Visual system and responsive 720x1280 layout. |
| `s03-s04-info-pair.js` | Web Animations driver. |
| `timeline-spec.mjs` | Shared timing/spec truth source for browser and verifier. |
| `verify.mjs` | Dependency-free structural verifier. |

## Run

```bash
node docs/videos/cucu-pr-flow/deterministic-spike/verify.mjs
open docs/videos/cucu-pr-flow/deterministic-spike/s03-s04-info-pair.html
```

The verifier checks dimensions, shot durations, required labels, file references, and D lane acceptance hooks. Browser playback uses the same `timeline-spec.mjs`.

## Pass Criteria

- Text remains readable at mobile size.
- S03 communicates the four-node flow in one pass.
- S04 communicates wrong-avatar proof without subtitles.
- S04 red X lands after the 0.8s static comparison hold from `shot-plan-v0.1.md` §4.
- Timing can be adjusted from labels/spec, not by rerolling.

## Current Limit

This is an HTML/Web Animations spike, not a rendered mp4. If it passes animatic review, the next engineering step is a renderer wrapper: Playwright frame capture, Remotion, or ffmpeg image sequence.
