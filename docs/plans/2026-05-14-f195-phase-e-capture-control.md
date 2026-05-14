# F195 Phase E — UI Capture Control Implementation Plan

**Feature:** F195 — `docs/features/F195-meeting-copilot-live-advisory.md`
**Goal:** User can start/stop/pause/resume audio capture from the UI without cat intervention
**Acceptance Criteria:** AC-E1 through AC-E6 (see spec Phase E section)
**Architecture cell:** dispatch
**Map delta:** none
**Map delta why:** Extends existing audio proxy + frontend components, no new architectural boundaries
**Architecture:** Add pause/resume endpoints to Python backend, proxy through API, add Start/Pause/Resume UI to floating window
**Tech Stack:** Python aiohttp (backend), TypeScript/Fastify (proxy), React (frontend), Vitest (tests)
**前端验证:** Yes — floating window UI changes require browser verification

---

## Task 1: Backend pause/resume (audio-service.py)

**Files:**
- Modify: `scripts/meeting-copilot/audio-service.py`

Add `self.paused` flag to AudioSession. When paused: still collect PCM (for recording continuity) but skip ASR. Broadcast `status: paused/resumed` SSE events. Add `POST /pause` and `POST /resume` endpoints.

Key changes:
- `__init__`: add `self.paused = False`
- `_reset`: add `self.paused = False`
- `status()`: add `"paused": self.paused`
- `_process_chunk()`: early return after `append_pcm` when paused (keep recording audio, skip ASR)
- `pause()` method: set flag, broadcast SSE, return status
- `resume()` method: clear flag, broadcast SSE, return status
- `h_pause` / `h_resume` handlers + route registration

## Task 2: API proxy routes (audio-proxy.ts)

**Files:**
- Modify: `packages/api/src/routes/audio-proxy.ts`

Add two proxy routes following existing pattern:
- `POST /api/audio/pause` → `/pause`
- `POST /api/audio/resume` → `/resume`

## Task 3: Frontend — Pause/Resume (FloatingTranscriptWindow + Container)

**Files:**
- Modify: `packages/web/src/components/workspace/FloatingTranscriptContainer.tsx`
- Modify: `packages/web/src/components/workspace/FloatingTranscriptWindow.tsx`
- Test: `packages/web/src/components/workspace/__tests__/FloatingTranscriptWindow.test.tsx`

Container changes:
- Add `paused` state
- Handle SSE `paused` / `resumed` status events
- Add `handlePause` and `handleResume` callbacks
- Stop elapsed timer when paused
- Pass `paused`, `onPause`, `onResume` to window

Window changes:
- Add `paused`, `onPause`, `onResume` to props
- When `recording && !paused`: show Pause + Stop buttons
- When `recording && paused`: show Resume + Stop + "Paused" indicator (yellow dot replaces green pulse)
- Pause button: ⏸ yellow-ish styling
- Resume button: ▶ green styling

## Task 4: Frontend — Start with source selection

**Files:**
- Modify: `packages/web/src/components/workspace/FloatingTranscriptContainer.tsx`
- Modify: `packages/web/src/components/workspace/FloatingTranscriptWindow.tsx`
- Test: `packages/web/src/components/workspace/__tests__/FloatingTranscriptWindow.test.tsx`

Container changes:
- Add `sources` state (fetched from `/api/audio/sources` when window opens + not recording)
- Add `handleStart` callback (call `POST /api/audio/start` with selected source)
- Pass `sources`, `onStart` to window

Window changes:
- Add `onStart`, `sources` to props
- When `!recording && !savedPath`: show start section
  - App source dropdown (from `sources.apps`)
  - Microphone option (from `sources.mics`)
  - "Start" button

## Task 5: TranscriptPanel parity (side panel)

**Files:**
- Modify: `packages/web/src/components/workspace/TranscriptPanel.tsx`

Mirror the same pause/resume + start controls from the floating window. Simpler layout since panel is fixed-position.
