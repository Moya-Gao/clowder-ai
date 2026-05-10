---
feature_ids: [F195]
topics: [meeting-copilot, audio-capture, ScreenCaptureKit, ASR, latency, spike]
doc_kind: plan
created: 2026-05-10
---

# F195 Spike 1: Audio Capture + ASR Latency Budget

**Feature:** F195 — `docs/features/F195-meeting-copilot-live-advisory.md`
**Goal:** Validate ScreenCaptureKit per-app audio capture + Qwen3-ASR pseudo-streaming latency on M4 Max
**Type:** Spike (time-boxed exploration → output = decision + measured numbers)
**Time box:** 4 hours
**Architecture cell:** transport (closest existing; spike informs whether new cell needed)
**Map delta:** none
**Map delta why:** Spike scripts live in `scripts/`, no ownership boundary change
**Tech Stack:** Swift (ScreenCaptureKit), Python (sounddevice, ASR wrapper), Qwen3-ASR 1.7B (MLX)
**前端验证:** No

---

## Finish Line

**B definition:** A spike report with measured numbers answering three questions:
1. Can ScreenCaptureKit capture per-app audio from meeting apps (Zoom/腾讯会议/钉钉)?
2. What is Qwen3-ASR latency with 3s pseudo-streaming chunks on M4 Max?
3. Can dual-track (mic + system audio) run simultaneously without GPU contention or clock drift?

**What we're NOT building:**
- No UI / floating window
- No meeting session state management
- No diarization
- No cat brain / thread integration
- No production error handling or retry logic
- No formal test suite (spike scripts, validation is manual + measured numbers)

**Spike Acceptance Criteria:**
- [ ] SC-1: ScreenCaptureKit captures audio from ≥1 meeting app (or documents why not + workaround)
- [ ] SC-2: Per-chunk ASR latency measured — target: RTF < 0.3 (3s chunk → < 0.9s processing)
- [ ] SC-3: Dual-track capture runs without resource conflict for ≥5 minutes
- [ ] SC-4: Clock drift measured — target: < 50ms over 5 min (< 600ms extrapolated to 60 min)
- [ ] SC-5: Spike report with go/no-go recommendation written

---

## Task 1: ASR Latency Benchmark (no capture, pure ASR)

**Purpose:** Isolate ASR latency measurement from capture complexity. Answer: "Is 3s pseudo-streaming fast enough?"

**Files:**
- Create: `scripts/meeting-copilot/benchmark-asr-latency.py`

**Steps:**

1. Create `scripts/meeting-copilot/` directory
2. Write benchmark script:
   - Load a known audio file (any existing voice message WAV, or record a short sample)
   - Chunk into 3s segments with 0.8s overlap (shift = 2.2s)
   - For each chunk: convert to WAV 16kHz mono, POST to localhost:9876
   - Measure: time_to_first_byte, time_to_response, chunk_duration
   - Calculate: RTF = processing_time / chunk_duration
   - Output: per-chunk table + p50/p95/max latency + aggregate RTF
3. Run with Qwen3-ASR server already running (`python scripts/qwen3-asr-api.py`)
4. Test with:
   - Pure Chinese audio (~30s)
   - Chinese + English mixed audio (~30s)
   - Record a test file if none suitable exists
5. Document: RTF, transcript quality, overlap deduplication effectiveness

**Validation criteria:**
- RTF < 0.3 = green (real-time feasible)
- RTF 0.3-0.5 = yellow (marginal, may need optimization)
- RTF > 0.5 = red (need different approach)

**Commit:** `spike(F195): ASR pseudo-streaming latency benchmark [宪宪/Opus-46🐾]`

---

## Task 2: ScreenCaptureKit Per-App Audio Capture

**Purpose:** Validate macOS ScreenCaptureKit can capture audio from a specific app without affecting user's listening.

**Files:**
- Create: `scripts/meeting-copilot/CaptureAppAudio/Package.swift`
- Create: `scripts/meeting-copilot/CaptureAppAudio/Sources/CaptureAppAudio.swift`

**Steps:**

1. Create Swift package with ScreenCaptureKit + AVFoundation dependencies
2. Implement:
   - `SCShareableContent.current` → list running apps with audio
   - User selects target app (by name or bundle ID, CLI arg)
   - Create `SCStreamConfiguration` audio-only (no video):
     - sampleRate: 16000 (match ASR requirement)
     - channelCount: 1 (mono)
   - Create `SCContentFilter` for the target app
   - Start `SCStream`, receive audio buffers via `SCStreamOutput` delegate
   - Write received PCM to WAV file (with proper header)
   - Stop after configurable duration (default 10s)
3. Build: `swift build -c release`
4. Test:
   - Play audio in Safari → capture → verify WAV has content
   - Play in Music.app → capture → verify
   - If possible: Zoom test call → capture → verify
5. Document: permissions needed, apps that work/don't, latency from app output → capture buffer

**Key risks:**
- ScreenCaptureKit requires Screen Recording permission in System Preferences
- Some apps may use protected audio paths (DRM)
- Need macOS 12.3+ (we're on macOS 15+, fine)

**Commit:** `spike(F195): ScreenCaptureKit per-app audio capture CLI [宪宪/Opus-46🐾]`

---

## Task 3: Microphone Capture (Self-Voice Track)

**Purpose:** Capture user's voice from mic/AirPods as the second track.

**Files:**
- Create: `scripts/meeting-copilot/capture-mic.py`

**Steps:**

1. Install `sounddevice` if not present (`pip install sounddevice`)
2. Write script:
   - List available input devices (show index, name, channels, sample rate)
   - Select device by index or name (CLI arg, default = system default)
   - Capture at 16kHz mono (match ASR requirement)
   - Write 3s chunks to output directory as numbered WAV files
   - Each chunk filename includes timestamp: `mic_chunk_001_1715344800.123.wav`
   - Print real-time status: chunk number, peak amplitude, timestamp
3. Test:
   - Speak into MacBook mic → verify chunks created + audible
   - Connect AirPods → verify capture from AirPods mic
4. Document: device selection, any issues with AirPods as input

**Commit:** `spike(F195): microphone capture script [宪宪/Opus-46🐾]`

---

## Task 4: Dual-Track Integration + End-to-End Latency

**Purpose:** Run both captures simultaneously, feed to ASR, measure total pipeline latency and resource usage.

**Files:**
- Create: `scripts/meeting-copilot/dual-track-test.py`

**Steps:**

1. Write orchestrator script:
   - Launch ScreenCaptureKit capture (subprocess, writes chunks to `output/system/`)
   - Launch mic capture (subprocess or thread, writes chunks to `output/mic/`)
   - Monitor both directories for new chunks
   - As chunks appear, submit to ASR (port 9876) — sequentially (ASR has lock)
   - Measure: chunk_created_time → asr_response_time = end-to-end latency
   - Track GPU utilization if possible (`powermetrics` or similar)
2. Run for 5 minutes with:
   - System: play a meeting recording in browser
   - Mic: speak intermittently
3. Collect metrics:
   - Per-track ASR latency
   - Total pipeline latency (audio event → transcript available)
   - GPU memory usage during concurrent operation
   - CPU usage of capture processes
4. Clock correlation:
   - Both tracks emit timestamps from same system clock
   - Compare: does a word said at mic_t0 and heard at system_t0 align?
   - Measure drift between tracks over the 5-min window

**Validation criteria:**
- End-to-end latency < 4s (3s chunk + < 1s ASR) = green
- Both tracks produce valid transcripts simultaneously = green
- No GPU OOM or contention errors = green
- Clock drift < 50ms over 5 min = green

**Commit:** `spike(F195): dual-track integration test [宪宪/Opus-46🐾]`

---

## Task 5: Extended Clock Drift Test (Optional, if Task 4 passes)

**Purpose:** Validate clock stability over meeting-length sessions (60 min).

**Steps:**

1. Extend Task 4 with `--duration 3600` flag
2. Use looped audio file as system audio source (no need for real meeting)
3. Inject known sync pulses (beep at exact intervals) into both tracks
4. Measure drift at 5min / 15min / 30min / 60min marks
5. Plot drift over time (linear? accelerating?)

**Validation:** < 500ms drift at 60 min = acceptable (can correct in software)

---

## Task 6: Spike Report

**Files:**
- Create: `docs/research/2026-05-10-f195-spike-1-audio-asr-results.md`

**Contents:**
1. Executive summary: go/no-go recommendation
2. ASR latency numbers (RTF table, p50/p95)
3. ScreenCaptureKit findings (which apps, permissions, limitations)
4. Dual-track feasibility (resource usage, conflicts)
5. Clock drift measurements
6. Chinese + English mixed transcript quality observations
7. Identified risks for Phase B implementation
8. Recommended next spike (if any)

**Commit:** `docs(F195): spike 1 results — audio capture + ASR latency [宪宪/Opus-46🐾]`

---

## Dependencies & Prerequisites

| Dependency | Status | Action if missing |
|-----------|--------|-------------------|
| Qwen3-ASR server running (port 9876) | Check at start | `python scripts/qwen3-asr-api.py` |
| Xcode Command Line Tools (Swift) | Should be installed | `xcode-select --install` |
| sounddevice Python package | May not be installed | `pip install sounddevice` |
| Screen Recording permission | May need grant | System Preferences → Privacy |
| Test audio file (Chinese + English mixed) | Create if missing | Record 30s sample |

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| ScreenCaptureKit permission denied for some apps | Medium | High | Document which apps work; fallback: Loopback app |
| ASR RTF > 0.5 (too slow) | Low | High | Try smaller chunk size (2s); try quantized model |
| GPU contention between ASR calls | Medium | Medium | Queue chunks; measure sequential vs parallel |
| AirPods mic unavailable during capture | Low | Low | Fall back to MacBook built-in mic |
| Clock drift > 1s at 60 min | Low | High | Use NTP-synced timestamps; software correction |
