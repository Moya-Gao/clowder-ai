# F195 Phase C2 — Speaker Identity Mapping + Manual Correction

**Feature:** F195 — `docs/features/F195-meeting-copilot-live-advisory.md`
**Goal:** Each transcript line shows who said it (source-based attribution + enrolled participants), with manual correction for misattributions
**Acceptance Criteria:**
- AC-C2: Speaker identity 映射（会前 enrollment → 实时归因，置信度 <0.6 降级为"有人说"）
- AC-C6: Speaker label 手动修正
**Architecture cell:** action-plane
**Map delta:** none
**Map delta why:** extending existing meeting/audio tools within action-plane cell, no new architectural boundary
**Architecture:** Source-based speaker attribution using audio capture source (mic → host, app → others) + participant enrollment. Manual correction stored in Python backend, proxied through API. Frontend shows speaker labels with click-to-correct UI.
**Tech Stack:** Python (audio-service), TypeScript (MCP tools, API proxy, shared types), React (FloatingTranscriptWindow)
**前端验证:** Yes — reviewer 必须用 Playwright/Chrome 实测浮动窗 speaker 显示 + 修正交互

---

## Straight-Line Check

**Finish line:** When a meeting is active, each transcript line in the floating window displays a speaker label (e.g. "铲屎官", "Alice", or "有人说"). Labels are derived from audio source + enrolled participant count. User can click any label to correct it from a list of enrolled participants.

**What we're NOT building:**
- Real-time voice diarization (pyannote — deferred to 会后 batch)
- Dual-source simultaneous capture (mic + app at same time)
- Voice embedding/fingerprint enrollment
- Automatic speaker change detection within a single source

**Every step check:**
1. Enrollment → stays as-is (backend stores participants per session)
2. Attribution → stays as-is (source → speaker, confidence → degradation)
3. Correction → stays as-is (PATCH endpoint, frontend popover)
4. No throwaway scaffolding — all code is final form

## Terminal Schema

```typescript
// TranscriptLine gains speaker fields (Python → SSE → Frontend)
interface TranscriptLine {
  ts: number;
  elapsed_s: number;
  chunk_num: number;
  asr_latency: number;
  text: string;
  speaker_label: string;       // NEW: "铲屎官" | participant name | "有人说"
  speaker_confidence: number;  // NEW: 0-1
  speaker_id: string | null;   // NEW: participant ID if attributed
}
```

```python
# AudioSession gains participant enrollment
class AudioSession:
    participants: list[dict]  # [{id, name, role}]

    def enroll(self, participants: list[dict]) -> None: ...
    def _attribute_speaker(self) -> dict: ...  # returns {speaker_label, speaker_confidence, speaker_id}
    def correct_line(self, chunk_num: int, speaker_id: str, speaker_label: str) -> bool: ...
```

**Attribution rules (source-based, no diarization):**

| Source | Enrolled count | speaker_label | confidence |
|--------|---------------|---------------|------------|
| mic | host enrolled | host name | 0.9 |
| mic | no host | "发言者" | 0.5 |
| app | 2 total participants | other's name | 0.7 |
| app | 3+ participants | "有人说" (< 0.6) | 0.4 |
| app | 0 enrolled | "有人说" (< 0.6) | 0.4 |
| any | manual correction | corrected name | 1.0 |

---

## Task 1: Speaker enrollment — Python backend

**Files:**
- Modify: `scripts/meeting-copilot/audio-service.py`
- Create: `scripts/meeting-copilot/test_audio_service.py`

**Step 1: Write failing test for enrollment**

```python
# test_audio_service.py
import pytest
from aiohttp.test_utils import AioHTTPTestCase, unittest_run_loop
from aiohttp import web
from audio_service import session, h_start, h_stop, h_status, cors_mw

class TestEnrollment(AioHTTPTestCase):
    async def get_application(self):
        app = web.Application(middlewares=[cors_mw])
        app.router.add_post("/enroll", h_enroll)
        app.router.add_get("/status", h_status)
        return app

    async def test_enroll_participants(self):
        resp = await self.client.post("/enroll", json={
            "participants": [
                {"id": "p1", "name": "铲屎官", "role": "host"},
                {"id": "p2", "name": "Alice", "role": "participant"},
            ]
        })
        assert resp.status == 200
        data = await resp.json()
        assert data["ok"] is True
        assert len(data["participants"]) == 2

        status = await self.client.get("/status")
        status_data = await status.json()
        assert len(status_data["participants"]) == 2
        assert status_data["participants"][0]["name"] == "铲屎官"

    async def test_enroll_requires_participants(self):
        resp = await self.client.post("/enroll", json={})
        assert resp.status == 400

    async def test_enroll_overwrites_previous(self):
        await self.client.post("/enroll", json={
            "participants": [{"id": "p1", "name": "A", "role": "host"}]
        })
        await self.client.post("/enroll", json={
            "participants": [{"id": "p2", "name": "B", "role": "host"}]
        })
        status = await self.client.get("/status")
        data = await status.json()
        assert len(data["participants"]) == 1
        assert data["participants"][0]["name"] == "B"
```

**Step 2: Run test to verify it fails**

Run: `cd scripts/meeting-copilot && python -m pytest test_audio_service.py::TestEnrollment -v`
Expected: FAIL (h_enroll not defined)

**Step 3: Implement enrollment**

In `audio-service.py`:
- Add `self.participants = []` to `AudioSession.__init__` and `_reset`
- Add `enroll(participants)` method — validates and stores
- Add `h_enroll` handler — parses JSON, calls `session.enroll()`
- Extend `status()` to include `"participants": self.participants`
- Register route: `app.router.add_post("/enroll", h_enroll)`

**Step 4: Run test to verify it passes**

Run: `cd scripts/meeting-copilot && python -m pytest test_audio_service.py::TestEnrollment -v`
Expected: PASS

**Step 5: Commit**

```bash
git add scripts/meeting-copilot/audio-service.py scripts/meeting-copilot/test_audio_service.py
git commit -m "feat(F195): C2 speaker enrollment endpoint + tests [宪宪/Opus-46🐾]"
```

---

## Task 2: Source-based speaker attribution — Python backend

**Files:**
- Modify: `scripts/meeting-copilot/audio-service.py`
- Modify: `scripts/meeting-copilot/test_audio_service.py`

**Step 1: Write failing tests for attribution**

```python
class TestAttribution(AioHTTPTestCase):
    # ... app setup ...

    async def test_mic_source_attributes_host(self):
        session._reset()
        session.participants = [
            {"id": "p1", "name": "铲屎官", "role": "host"},
            {"id": "p2", "name": "Alice", "role": "participant"},
        ]
        session.source = "mic"
        attr = session._attribute_speaker()
        assert attr["speaker_label"] == "铲屎官"
        assert attr["speaker_confidence"] == 0.9
        assert attr["speaker_id"] == "p1"

    async def test_app_source_two_participants_attributes_other(self):
        session._reset()
        session.participants = [
            {"id": "p1", "name": "铲屎官", "role": "host"},
            {"id": "p2", "name": "Alice", "role": "participant"},
        ]
        session.source = "app"
        attr = session._attribute_speaker()
        assert attr["speaker_label"] == "Alice"
        assert attr["speaker_confidence"] == 0.7
        assert attr["speaker_id"] == "p2"

    async def test_app_source_three_plus_degrades(self):
        session._reset()
        session.participants = [
            {"id": "p1", "name": "铲屎官", "role": "host"},
            {"id": "p2", "name": "Alice", "role": "participant"},
            {"id": "p3", "name": "Bob", "role": "participant"},
        ]
        session.source = "app"
        attr = session._attribute_speaker()
        assert attr["speaker_confidence"] == 0.4
        # confidence < 0.6 → downstream createMeetingContextBlock degrades to "有人说"

    async def test_no_enrollment_degrades(self):
        session._reset()
        session.source = "app"
        attr = session._attribute_speaker()
        assert attr["speaker_confidence"] == 0.4
```

**Step 2: Run tests to verify fail**

Run: `cd scripts/meeting-copilot && python -m pytest test_audio_service.py::TestAttribution -v`
Expected: FAIL (_attribute_speaker not defined)

**Step 3: Implement attribution**

In `AudioSession`:
```python
def _attribute_speaker(self) -> dict:
    host = next((p for p in self.participants if p.get("role") == "host"), None)
    non_hosts = [p for p in self.participants if p.get("role") != "host"]

    if self.source == "mic" and host:
        return {"speaker_label": host["name"], "speaker_confidence": 0.9, "speaker_id": host["id"]}
    if self.source == "mic":
        return {"speaker_label": "发言者", "speaker_confidence": 0.5, "speaker_id": None}
    # source == "app"
    if len(self.participants) == 2 and len(non_hosts) == 1:
        other = non_hosts[0]
        return {"speaker_label": other["name"], "speaker_confidence": 0.7, "speaker_id": other["id"]}
    return {"speaker_label": "有人说", "speaker_confidence": 0.4, "speaker_id": None}
```

**Step 4: Wire attribution into `_process_chunk`**

Extend `line` dict in `_process_chunk` to include speaker fields from `_attribute_speaker()`.

**Step 5: Run tests to verify pass**

Run: `cd scripts/meeting-copilot && python -m pytest test_audio_service.py -v`
Expected: ALL PASS

**Step 6: Commit**

```bash
git add scripts/meeting-copilot/audio-service.py scripts/meeting-copilot/test_audio_service.py
git commit -m "feat(F195): C2 source-based speaker attribution [宪宪/Opus-46🐾]"
```

---

## Task 3: Speaker label correction — Python backend

**Files:**
- Modify: `scripts/meeting-copilot/audio-service.py`
- Modify: `scripts/meeting-copilot/test_audio_service.py`

**Step 1: Write failing test**

```python
class TestCorrection(AioHTTPTestCase):
    async def get_application(self):
        # routes include /transcript/correct + /transcript
        ...

    async def test_correct_speaker_label(self):
        session._reset()
        session._window.add_line({
            "ts": 100.0, "elapsed_s": 1.0, "chunk_num": 1,
            "asr_latency": 0.1, "text": "hello",
            "speaker_label": "有人说", "speaker_confidence": 0.4, "speaker_id": None,
        })
        resp = await self.client.post("/transcript/correct", json={
            "chunk_num": 1,
            "speaker_label": "Alice",
            "speaker_id": "p2",
        })
        assert resp.status == 200
        lines = session.get_transcript()
        assert lines[0]["speaker_label"] == "Alice"
        assert lines[0]["speaker_confidence"] == 1.0
        assert lines[0]["speaker_id"] == "p2"

    async def test_correct_nonexistent_chunk(self):
        session._reset()
        resp = await self.client.post("/transcript/correct", json={
            "chunk_num": 999, "speaker_label": "X",
        })
        assert resp.status == 404
```

**Step 2: Run test, verify fail**

Run: `cd scripts/meeting-copilot && python -m pytest test_audio_service.py::TestCorrection -v`
Expected: FAIL

**Step 3: Implement correction**

- Add `correct_line(chunk_num, speaker_label, speaker_id)` to `AudioSession`
- Update matching line in `TranscriptWindow` (speaker fields + confidence = 1.0)
- Add `h_correct` handler + route `app.router.add_post("/transcript/correct", h_correct)`

**Step 4: Run test, verify pass**

Run: `cd scripts/meeting-copilot && python -m pytest test_audio_service.py::TestCorrection -v`
Expected: PASS

**Step 5: Commit**

```bash
git add scripts/meeting-copilot/audio-service.py scripts/meeting-copilot/test_audio_service.py
git commit -m "feat(F195): C2 speaker label correction endpoint [宪宪/Opus-46🐾]"
```

---

## Task 4: Enrollment MCP tool — TypeScript

**Files:**
- Modify: `packages/mcp-server/src/tools/audio-tools.ts`

**Step 1: Write failing test for enrollment tool**

```typescript
// In existing audio-tools test or inline test approach
// Test: audio_enroll_speakers validates participants and forwards to audio-service
```

**Step 2: Run test, verify fail**

Run: `pnpm --filter @cat-cafe/mcp-server test`
Expected: FAIL

**Step 3: Implement audio_enroll_speakers tool**

Add to `audio-tools.ts`:
- New tool `audio_enroll_speakers` with input: `{ participants: Array<{ id: string, name: string, role?: string }> }`
- Calls `audioFetch('/enroll', { method: 'POST', body: JSON.stringify({ participants }) })`
- Returns success/error result

**Step 4: Run test, verify pass**

Run: `pnpm --filter @cat-cafe/mcp-server test`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/mcp-server/src/tools/audio-tools.ts
git commit -m "feat(F195): C2 audio_enroll_speakers MCP tool [宪宪/Opus-46🐾]"
```

---

## Task 5: Speaker passthrough in context blocks — TypeScript

**Files:**
- Modify: `packages/mcp-server/src/tools/audio-tools.ts`

**Step 1: Write failing test**

Test: when transcript lines include `speaker_label`/`speaker_confidence`/`speaker_id`, `format=context_block` uses those values instead of hardcoded `'参会者'`/`0.5`.

**Step 2: Run test, verify fail**

**Step 3: Update context block construction**

In `audio-tools.ts` line ~221, change:
```typescript
// Before (hardcoded):
createMeetingContextBlock({
  meetingId,
  speakerLabel: '参会者',
  speakerConfidence: 0.5,
  ...
})

// After (from line data):
createMeetingContextBlock({
  meetingId,
  speakerId: l.speaker_id ?? undefined,
  speakerLabel: l.speaker_label ?? '参会者',
  speakerConfidence: l.speaker_confidence ?? 0.5,
  ...
})
```

Add `speaker_label`, `speaker_confidence`, `speaker_id` to `TranscriptLine` type.

**Step 4: Run test, verify pass**

**Step 5: Commit**

```bash
git add packages/mcp-server/src/tools/audio-tools.ts
git commit -m "feat(F195): C2 context blocks use real speaker data [宪宪/Opus-46🐾]"
```

---

## Task 6: API proxy routes — TypeScript

**Files:**
- Modify: `packages/api/src/routes/audio-proxy.ts`

**Step 1: Write failing test**

Test: `POST /api/audio/transcript/correct` proxied to Python backend.
Test: `POST /api/audio/enroll` proxied to Python backend.

**Step 2: Run test, verify fail**

**Step 3: Implement proxy routes**

Add to `audioProxyRoutes`:
```typescript
app.post('/api/audio/enroll', async (req, reply) => {
  if (!requireIdentity(req, reply)) return;
  try { return await proxyJson(reply, 'POST', '/enroll', req.body); }
  catch { return reply.status(502).send({ error: 'Audio service unavailable' }); }
});

app.post('/api/audio/transcript/correct', async (req, reply) => {
  if (!requireIdentity(req, reply)) return;
  try { return await proxyJson(reply, 'POST', '/transcript/correct', req.body); }
  catch { return reply.status(502).send({ error: 'Audio service unavailable' }); }
});
```

**Step 4: Run test, verify pass**

Run: `pnpm --filter @cat-cafe/api test`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/api/src/routes/audio-proxy.ts
git commit -m "feat(F195): C2 enrollment + correction proxy routes [宪宪/Opus-46🐾]"
```

---

## Task 7: Speaker labels in floating transcript — React

**Files:**
- Modify: `packages/web/src/components/workspace/FloatingTranscriptWindow.tsx`
- Modify: `packages/web/src/components/workspace/FloatingTranscriptContainer.tsx`

**Step 1: Extend TranscriptLine type**

In both files, add to `TranscriptLine`:
```typescript
speaker_label?: string;
speaker_confidence?: number;
speaker_id?: string | null;
```

In `FloatingTranscriptContainer.tsx`, extend `SseEvent` with same fields.

**Step 2: Pass speaker fields through SSE handler**

In `FloatingTranscriptContainer` `es.onmessage`:
```typescript
setLines((prev) => [...prev, {
  ts: data.ts!,
  elapsed_s: data.elapsed_s ?? 0,
  chunk_num: data.chunk_num ?? 0,
  asr_latency: data.asr_latency ?? 0,
  text: data.text!,
  speaker_label: data.speaker_label,
  speaker_confidence: data.speaker_confidence,
  speaker_id: data.speaker_id,
}]);
```

**Step 3: Render speaker label in FloatingTranscriptWindow**

In the transcript line rendering (line ~213):
```tsx
{lines.map((l, i) => (
  <div key={l.chunk_num ?? i} className="mb-1 flex gap-2">
    <span className="shrink-0 text-cafe-text-muted">[{formatTime(l.ts)}]</span>
    {l.speaker_label && (
      <span className="shrink-0 font-medium text-cafe-accent-primary">
        {l.speaker_label}:
      </span>
    )}
    <span className="text-cafe-text-primary">{l.text}</span>
  </div>
))}
```

**Step 4: Visual verify in browser**

Open floating transcript → confirm speaker labels appear next to each line.

**Step 5: Commit**

```bash
git add packages/web/src/components/workspace/FloatingTranscriptWindow.tsx \
      packages/web/src/components/workspace/FloatingTranscriptContainer.tsx
git commit -m "feat(F195): C2 speaker labels in floating transcript [宪宪/Opus-46🐾]"
```

---

## Task 8: Manual correction UI — React

**Files:**
- Modify: `packages/web/src/components/workspace/FloatingTranscriptWindow.tsx`
- Modify: `packages/web/src/components/workspace/FloatingTranscriptContainer.tsx`

**Step 1: Fetch enrolled participants from status**

In `FloatingTranscriptContainer`, extend `AudioStatus`:
```typescript
interface AudioStatus {
  running: boolean;
  source?: string;
  app_name?: string;
  duration_s?: number;
  participants?: Array<{ id: string; name: string; role?: string }>;
}
```

Pass `participants` as prop to `FloatingTranscriptWindow`.

**Step 2: Add correction popover to speaker label**

In `FloatingTranscriptWindow`:
- Click speaker label → small dropdown showing enrolled participants
- Select participant → call `onCorrect(chunkNum, participantId, participantName)`
- Dropdown auto-dismisses after selection

**Step 3: Wire correction API call**

In `FloatingTranscriptContainer`:
```typescript
const handleCorrect = useCallback(async (chunkNum: number, speakerId: string, speakerLabel: string) => {
  try {
    await apiFetch('/api/audio/transcript/correct', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chunk_num: chunkNum, speaker_id: speakerId, speaker_label: speakerLabel }),
    });
    setLines((prev) => prev.map((l) =>
      l.chunk_num === chunkNum
        ? { ...l, speaker_label: speakerLabel, speaker_confidence: 1.0, speaker_id: speakerId }
        : l
    ));
  } catch {}
}, []);
```

**Step 4: Visual verify in browser**

1. Enroll participants (via MCP tool → POST /enroll)
2. Start capture
3. See speaker labels in floating transcript
4. Click a speaker label → correction dropdown appears
5. Select different speaker → label updates immediately

**Step 5: Commit**

```bash
git add packages/web/src/components/workspace/FloatingTranscriptWindow.tsx \
      packages/web/src/components/workspace/FloatingTranscriptContainer.tsx
git commit -m "feat(F195): C2 speaker label manual correction UI [宪宪/Opus-46🐾]"
```

---

## Task 9: Integration verification

**Step 1: Run full test suite**

```bash
pnpm test
pnpm lint
pnpm check
pnpm -r --if-present run build
```

**Step 2: End-to-end manual verify**

1. MCP: `audio_enroll_speakers` with 2 participants (host + 1 other)
2. MCP: `audio_capture_start` with source="app"
3. Floating transcript shows speaker labels ("Alice:" or "有人说:")
4. Click to correct → dropdown → select → immediate update
5. MCP: `audio_read_transcript` with format=context_block → blocks have correct speaker data

**Step 3: Commit any fixups, run quality-gate**
