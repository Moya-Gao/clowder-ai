---
feature_ids: [F195]
topics: [asr, vad, hotword, llm-postprocess, punctuation]
doc_kind: plan
created: 2026-05-19
---

# F195 Phase F — ASR Pipeline Enhancement

**Feature:** F195 — `docs/features/F195-meeting-copilot-live-advisory.md`
**Goal:** Fix "语音转写质量太烂了" — wire up existing components (VAD, hotwords, LLM postprocess) that are built but not connected
**Acceptance Criteria:** AC-F1 through AC-F6 from spec
**Architecture cell:** dispatch
**Map delta:** none
**Map delta why:** All changes are within existing audio-service.py pipeline, no new architectural boundaries
**前端验证:** No — all changes are Python backend (audio-service.py)

---

## Approach

Most work is wiring existing components. Only truly new code is the VAD chunker.

### Task 1: VAD Chunker module (AC-F1)

**Files:**
- Create: `scripts/meeting-copilot/vad_chunker.py`
- Test: `scripts/meeting-copilot/test_vad_chunker.py`

A `VadChunker` class that:
- Accepts small PCM frames (512 samples = 32ms)
- Runs Silero VAD on each frame
- Buffers speech segments
- Emits complete utterances when speech ends (after silence padding ~300ms)
- Force-flushes if buffer exceeds max duration (15s ceiling)
- Falls back to fixed-size chunks if VAD disabled

### Task 2: Integrate VAD into audio-service.py (AC-F1)

**Files:**
- Modify: `scripts/meeting-copilot/audio-service.py`

Replace fixed `chunk_bytes`/`chunk_samples` accumulation with VadChunker:
- `_run_app`: Read small frames, feed to VadChunker, process emitted segments
- `_run_mic`: Same pattern
- Add `VAD_ENABLED` env var (default true)

### Task 3: Hotword context injection (AC-F2)

**Files:**
- Modify: `scripts/meeting-copilot/audio-service.py`

In `_process_chunk`, build `initial_prompt` from:
- `enrolled_speakers` names
- `talking_points`
- `ASR_CONTEXT` env var (custom terms)

Add as form field to ASR request.

### Task 4: LLM postprocess integration (AC-F3 + AC-F4)

**Files:**
- Modify: `scripts/meeting-copilot/audio-service.py`
- Modify: `scripts/llm-postprocess-api.py` (extend system prompt for punctuation)

In `_process_chunk`, after ASR returns text:
1. If `LLM_POSTPROCESS_ENABLED` and text is non-empty
2. POST to `LLM_POSTPROCESS_URL/v1/text/refine`
3. Use refined text (with punctuation) for downstream
4. Timeout + fallback to raw text

### Task 5: Config surface (AC-F6)

**Files:**
- Modify: `scripts/meeting-copilot/audio-service.py`

New env vars:
- `VAD_ENABLED` (default "1")
- `LLM_POSTPROCESS_ENABLED` (default "0" — opt-in, needs separate server running)
- `LLM_POSTPROCESS_URL` (default "http://localhost:9878")
- `ASR_CONTEXT` (default "" — additional hotword terms)

### Task 6: Tests + AC-F5

Update existing tests + add new ones for VAD chunker and pipeline integration.
