# Review Request: F195 Phase C2 — Speaker Identity Mapping + Manual Correction

Review-Target-ID: f195-phase-c2
Branch: feat/f195-phase-c2-speaker-identity

## What

Source-based speaker attribution for real-time meeting transcription + click-to-correct UI for manual speaker label fixes.

6 files changed, 392 insertions, 4 deletions:
- Python backend: enrollment storage, source-based attribution, correction endpoint
- MCP: `cat_cafe_audio_enroll_speakers` tool + context block passthrough with real speaker data
- API proxy: `/enroll` + `/transcript/correct` routes
- Frontend: speaker labels in floating transcript + correction popover

## Why

AC-C2 (speaker identity) and AC-C6 (manual correction) from Phase C. The model uses audio source channel as a lightweight signal — mic = host at 0.9 confidence, app audio = others (confidence depends on participant count). This avoids real-time diarization complexity while still providing useful speaker attribution.

## Original Requirements

> "每个人说话声音有不同音色 难道分辨不出来吗？" — 铲屎官 (2026-05-09 17:40)

- Source: `docs/features/F195-meeting-copilot-live-advisory.md` "关于说话人识别"
- Phase C2 addresses speaker identity via source-based attribution (enrollment + confidence rules) rather than real-time diarization. Diarization remains a future enhancement.
- **Please verify the attribution rules deliver adequate UX for the stated need.**

## Tradeoff

Chose source-based attribution over real-time voice diarization. Trade: can't distinguish 3+ remote participants individually (degrades to "有人说" at confidence 0.4). Gain: zero latency, no ML dependency, works immediately with existing audio pipeline.

## Architecture Ownership

Architecture cell: action-plane
Map delta: none
Why: Extends existing audio pipeline (Phase B) with enrollment/attribution/correction. No new architectural primitives.

Please check:
- diff does not introduce parallel Store/Queue/Router/Adapter/Dispatcher/Binding
- No ownership cell changes needed

## Open Questions

### Technical OQ (for reviewer)
1. `correct_line()` mutates dicts in the window's line list in-place. The `get_all_lines()` method returns direct references. Is this safe given the single-threaded async nature of the Python backend, or should we copy?
2. Frontend `catch {}` blocks silently swallow errors on correction/enrollment API calls. Should we surface a toast/notification on failure?

### Value OQ (for CVO)
None — all decisions are within the attribution model already specified in the AC.

## Next Action

Review code for correctness, security (API proxy auth), and UX completeness. Focus on attribution rules and confidence thresholds.

## Review Sandbox

- Path: `/tmp/cat-cafe-review/f195-phase-c2/codex`
- Start Command: `pnpm review:start`
- Ports: assigned by review:start (not 3001/3002/3011/3012/4111)

## Self-Check Evidence

### Spec Compliance
- AC-C2: enrollment + attribution + confidence degradation — all implemented and tested
- AC-C6: click-to-correct UI + correction API + optimistic update — all implemented and tested
- Quality gate passed (vision check, delivery completeness, architecture ownership, artifact hygiene all clean)

### Test Results
- Python tests: 27/27 pass (enrollment: 7, attribution: 6, correction: 4, window: 10)
- MCP tests: 179/179 pass (including new tool registration)
- shared build: exit 0
- mcp-server build: exit 0
- Pre-existing failures on main: API better-sqlite3 types, web lint TS install, check yaml module — none related to my changes

### Related Docs
- Plan: `docs/plans/2026-05-11-f195-phase-c2-speaker-identity.md`
- Feature: `docs/features/F195-meeting-copilot-live-advisory.md`
