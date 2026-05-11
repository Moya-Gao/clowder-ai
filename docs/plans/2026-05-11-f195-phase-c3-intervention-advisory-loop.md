---
feature_ids: [F195]
topics: [meeting-copilot, turn-taking, intervention-advisory, rate-limit, talking-points]
doc_kind: plan
created: 2026-05-11
---

# F195 Phase C3 — Intervention Advisory Loop

**Feature:** F195 — `docs/features/F195-meeting-copilot-live-advisory.md`
**Goal:** When advisory mode is active, detect intervention windows (question, silence, speaker handoff) and show rate-limited hints in the floating transcript window, with arguments only from user-provided talking points
**Acceptance Criteria:**
- AC-C1: Turn-taking 检测 → 主动推"现在可以插话"信号（频率限制，防 AUDHD 注意力过载）
- AC-C3: 会议中主动推论点提醒（检测到高价值插话点时）
**Architecture cell:** action-plane
**Map delta:** none
**Map delta why:** Extends existing audio pipeline within action-plane; no new architectural boundary
**Architecture:** InterventionDetector analyzes transcript chunks against simple rules (question patterns, silence gaps, keyword matches). AdvisoryRateLimiter enforces runtime frequency caps. Both live in Python audio-service.py. Frontend shows advisory hints in existing FloatingTranscriptWindow. No chat push in this phase (UI-only).
**Tech Stack:** Python (audio-service), TypeScript (MCP tools, API proxy), React (FloatingTranscriptWindow)
**前端验证:** Yes — reviewer 必须实测浮动窗 advisory 显示 + DND 交互

---

## Vision Guardrails (砚砚 愿景守护 2026-05-11)

C1 + C3 are bound as a single **Intervention Advisory Loop** — C1 alone = annoying timing noise, C3 alone = hallucinated arguments. The following guardrails are **hard constraints**, not suggestions:

1. **Active mode opt-in** — Default is passive (pull-based). Advisory events only emitted when user explicitly enables active mode. Prevents AUDHD attention overload.
2. **Runtime rate limiter** — Max 1 advisory per 5 min, cooldown on dismiss, "don't disturb" pauses 15 min. Enforced in Python code, not skill ref text.
3. **Argument source** — Talking points in advisories ONLY from user-registered `talking_points`. Pure transcript triggers timing hints ("good time to speak") but NEVER generates positional arguments.
4. **UI-only first** — This phase: `intervention_advisory` SSE event + floating window hint. No `post_message` / chat push. Chat integration is Phase C3b after false-positive rate is validated.
5. **Evidence on every advisory** — Each event carries: reason, confidence, source_chunk_num, source_text, optional talking_point reference.

---

## Straight-Line Check

**Finish line:** With advisory mode ON, the floating transcript window shows subtle, rate-limited intervention hints when the detector identifies a good moment to speak. If the user registered talking points, matching hints include the relevant point. User can dismiss or enable DND.

**What we're NOT building:**
- Pipecat Smart Turn (future spike — MVP uses simple rules)
- Chat push / post_message (Phase C3b)
- Auto-generated arguments from transcript
- Voice interruption / audio alert
- Diarization-based speaker change detection (using existing source-based attribution)

**Every step check:**
1. InterventionDetector → stays (rules are extensible, not throwaway)
2. RateLimiter → stays (runtime gate, not scaffolding)
3. Talking points → stays (user data, extends AudioSession)
4. SSE event → stays (additive to existing event stream)
5. Frontend advisory UI → stays (extends FloatingTranscriptWindow)

---

## Terminal Schema

```python
# scripts/meeting-copilot/audio-service.py additions

class AdvisoryRateLimiter:
    """Runtime rate gate — enforces frequency caps in code, not skill ref."""

    def __init__(self, min_interval_s: float = 300, dnd_duration_s: float = 900):
        self.min_interval_s = min_interval_s
        self.dnd_duration_s = dnd_duration_s
        self._last_emission: float = 0
        self._dnd_until: float = 0

    def can_emit(self, now: float) -> bool: ...
    def record_emission(self, now: float) -> None: ...
    def set_dnd(self, now: float) -> None: ...
    def status(self) -> dict: ...


class InterventionDetector:
    """Rule-based intervention window detection."""

    def check(self, line: dict, window: TranscriptWindow,
              talking_points: list[str]) -> dict | None:
        """Returns intervention_advisory event dict or None."""
        ...

    def _check_question(self, text: str) -> tuple[bool, float]: ...
    def _check_silence(self, line: dict, window: TranscriptWindow) -> tuple[bool, float]: ...
    def _check_keyword(self, text: str, talking_points: list[str]) -> tuple[bool, float, str | None]: ...
```

```typescript
// SSE event shape (new type alongside 'transcript' and 'status')
interface InterventionAdvisoryEvent {
  type: 'intervention_advisory';
  ts: number;
  reason: 'question_detected' | 'extended_silence' | 'speaker_handoff' | 'keyword_match';
  confidence: number;
  source_chunk_num: number;
  source_text: string;
  talking_point: string | null;  // Only from user-registered points
}

// AudioStatus extension
interface AudioStatus {
  // ... existing fields ...
  advisory_mode: 'active' | 'passive';
  advisory_rate_limiter: {
    can_emit: boolean;
    dnd_until: number | null;
    last_emission: number | null;
  };
  talking_points: string[];
}
```

---

## Task 1: AdvisoryRateLimiter + InterventionDetector (Pure Python Logic)

**Files:**
- Create: `scripts/meeting-copilot/intervention.py`
- Test: `scripts/meeting-copilot/test_intervention.py`

### Step 1: Write failing tests for AdvisoryRateLimiter

```python
class TestAdvisoryRateLimiter(unittest.TestCase):
    def test_first_emission_allowed(self):
        limiter = AdvisoryRateLimiter(min_interval_s=300)
        assert limiter.can_emit(now=1000) is True

    def test_second_emission_within_interval_blocked(self):
        limiter = AdvisoryRateLimiter(min_interval_s=300)
        limiter.record_emission(now=1000)
        assert limiter.can_emit(now=1100) is False

    def test_emission_after_interval_allowed(self):
        limiter = AdvisoryRateLimiter(min_interval_s=300)
        limiter.record_emission(now=1000)
        assert limiter.can_emit(now=1301) is True

    def test_dnd_blocks_all(self):
        limiter = AdvisoryRateLimiter(min_interval_s=300, dnd_duration_s=900)
        limiter.set_dnd(now=1000)
        assert limiter.can_emit(now=1500) is False

    def test_dnd_expires(self):
        limiter = AdvisoryRateLimiter(min_interval_s=300, dnd_duration_s=900)
        limiter.set_dnd(now=1000)
        assert limiter.can_emit(now=1901) is True

    def test_status_reports_state(self):
        limiter = AdvisoryRateLimiter()
        s = limiter.status()
        assert 'can_emit' in s
        assert 'dnd_until' in s
```

### Step 2: Run tests, verify RED

```bash
cd scripts/meeting-copilot && python -m pytest test_intervention.py::TestAdvisoryRateLimiter -v
```

### Step 3: Implement AdvisoryRateLimiter

Minimal implementation in `intervention.py`. Pure logic — no I/O, no imports beyond stdlib.

### Step 4: Run tests, verify GREEN

### Step 5: Write failing tests for InterventionDetector

```python
class TestInterventionDetector(unittest.TestCase):
    def test_detects_question_in_text(self):
        det = InterventionDetector()
        result = det.check(
            line={"text": "What do you think about this?", "chunk_num": 5,
                  "ts": 100, "elapsed_s": 60},
            window=mock_window, talking_points=[])
        assert result is not None
        assert result["reason"] == "question_detected"
        assert result["source_chunk_num"] == 5

    def test_detects_chinese_question(self):
        det = InterventionDetector()
        result = det.check(
            line={"text": "你觉得呢？", "chunk_num": 6,
                  "ts": 101, "elapsed_s": 61},
            window=mock_window, talking_points=[])
        assert result is not None
        assert result["reason"] == "question_detected"

    def test_silence_gap_triggers(self):
        det = InterventionDetector()
        # Window has last line at elapsed_s=50, current line at elapsed_s=58 (8s gap)
        result = det.check(
            line={"text": "...", "chunk_num": 10, "ts": 108, "elapsed_s": 58},
            window=mock_window_with_gap, talking_points=[])
        assert result is not None
        assert result["reason"] == "extended_silence"

    def test_keyword_match_with_talking_point(self):
        det = InterventionDetector()
        result = det.check(
            line={"text": "We should discuss the budget allocation",
                  "chunk_num": 15, "ts": 200, "elapsed_s": 100},
            window=mock_window,
            talking_points=["budget should stay under 50k"])
        assert result is not None
        assert result["reason"] == "keyword_match"
        assert result["talking_point"] == "budget should stay under 50k"

    def test_no_detection_on_normal_speech(self):
        det = InterventionDetector()
        result = det.check(
            line={"text": "The weather is nice today", "chunk_num": 1,
                  "ts": 100, "elapsed_s": 1},
            window=mock_window, talking_points=[])
        assert result is None

    def test_keyword_match_without_talking_points_no_argument(self):
        det = InterventionDetector()
        result = det.check(
            line={"text": "We should discuss the budget",
                  "chunk_num": 15, "ts": 200, "elapsed_s": 100},
            window=mock_window, talking_points=[])
        # No talking points registered → no keyword_match trigger
        assert result is None or result["talking_point"] is None

    def test_every_event_has_evidence_fields(self):
        det = InterventionDetector()
        result = det.check(
            line={"text": "你怎么看？", "chunk_num": 3,
                  "ts": 100, "elapsed_s": 30},
            window=mock_window, talking_points=[])
        assert result is not None
        for field in ["reason", "confidence", "source_chunk_num",
                      "source_text", "talking_point"]:
            assert field in result
```

### Step 6: Run tests, verify RED

### Step 7: Implement InterventionDetector

Detection rules (conservative MVP):
- **question_detected**: Regex for `?`, `？`, question words (`what/how/why/who`, `什么/怎么/为什么/你觉得/你怎么看`)
- **extended_silence**: Gap > 5s between current line and previous line in window
- **keyword_match**: Word overlap between transcript line and registered talking points (simple token intersection, threshold ≥ 2 matching tokens). Only triggers if talking_points is non-empty.
- **speaker_handoff**: NOT in MVP (needs dual-source + turn detection beyond simple rules)

### Step 8: Run tests, verify GREEN

### Step 9: Commit

```bash
git add scripts/meeting-copilot/intervention.py scripts/meeting-copilot/test_intervention.py
git commit -m "feat(F195): C3 intervention detector + rate limiter [宪宪/Opus-46🐾]"
```

---

## Task 2: Advisory Mode + Talking Points + SSE Integration (Python + MCP + API)

**Files:**
- Modify: `scripts/meeting-copilot/audio-service.py` — advisory_mode, talking_points, wire detector
- Modify: `packages/mcp-server/src/tools/audio-tools.ts` — 2 new MCP tools
- Modify: `packages/api/src/routes/audio-proxy.ts` — 3 new proxy routes
- Modify: `packages/mcp-server/test/tool-registration.test.js` — add new tools to expected list
- Test: `scripts/meeting-copilot/test_audio_service.py` — advisory integration tests

### Step 1: Write failing tests for AudioSession advisory integration

```python
class TestAdvisoryMode(unittest.TestCase):
    def setUp(self):
        self.session = AudioSession()

    def test_default_mode_is_passive(self):
        assert self.session.advisory_mode == "passive"

    def test_set_advisory_mode_active(self):
        self.session.set_advisory_mode("active")
        assert self.session.advisory_mode == "active"

    def test_set_advisory_mode_validates(self):
        with self.assertRaises(ValueError):
            self.session.set_advisory_mode("invalid")

    def test_set_talking_points(self):
        self.session.set_talking_points(["budget under 50k", "timeline Q3"])
        assert len(self.session.talking_points) == 2

    def test_talking_points_survive_reset(self):
        self.session.set_talking_points(["keep this"])
        self.session._reset()
        assert len(self.session.talking_points) == 1

    def test_status_includes_advisory_fields(self):
        self.session.set_advisory_mode("active")
        self.session.set_talking_points(["point one"])
        s = self.session.status()
        assert s["advisory_mode"] == "active"
        assert len(s["talking_points"]) == 1
        assert "advisory_rate_limiter" in s

    def test_advisory_dnd(self):
        self.session.advisory_dnd()
        s = self.session.status()
        assert s["advisory_rate_limiter"]["can_emit"] is False
```

### Step 2: Run tests, verify RED

### Step 3: Implement AudioSession advisory methods

Add to `AudioSession.__init__`:
```python
self.advisory_mode = "passive"
self.talking_points: list[str] = []
self._rate_limiter = AdvisoryRateLimiter()
self._detector = InterventionDetector()
```

Add methods: `set_advisory_mode()`, `set_talking_points()`, `advisory_dnd()`.

Wire into `_process_chunk()`: after transcript broadcast, if `advisory_mode == "active"`, run `_detector.check()` → if result and `_rate_limiter.can_emit()` → broadcast `intervention_advisory` event.

Ensure `_reset()` preserves `advisory_mode`, `talking_points`, `_rate_limiter`, `_detector` (same pattern as participants).

### Step 4: Run tests, verify GREEN

### Step 5: Add HTTP handlers + MCP tools + API proxy

Python handlers:
```python
async def h_set_advisory_mode(request):  # POST /advisory-mode
async def h_set_talking_points(request):  # POST /talking-points
async def h_advisory_dnd(request):        # POST /advisory-dnd
```

MCP tools:
```typescript
cat_cafe_audio_set_advisory_mode  // { mode: 'active' | 'passive' }
cat_cafe_audio_set_talking_points // { points: string[] }
```

API proxy routes:
```typescript
POST /api/audio/advisory-mode    → proxy to audio-service
POST /api/audio/talking-points   → proxy to audio-service
POST /api/audio/advisory-dnd     → proxy to audio-service
```

### Step 6: Update tool-registration test

Add `'cat_cafe_audio_set_advisory_mode'` and `'cat_cafe_audio_set_talking_points'` to EXPECTED_TOOLS.

### Step 7: Run full test suite

```bash
cd scripts/meeting-copilot && python -m pytest test_audio_service.py -v
pnpm --filter @cat-cafe/mcp-server test
```

### Step 8: Commit

```bash
git commit -m "feat(F195): C3 advisory mode + talking points + SSE integration [宪宪/Opus-46🐾]"
```

---

## Task 3: Frontend Advisory Display (UI-only)

**Files:**
- Modify: `packages/web/src/components/workspace/FloatingTranscriptContainer.tsx` — handle advisory SSE events
- Modify: `packages/web/src/components/workspace/FloatingTranscriptWindow.tsx` — advisory hint UI + DND button

### Step 1: Extend SSE handler for `intervention_advisory` events

In `FloatingTranscriptContainer.tsx`, add state:
```typescript
const [advisory, setAdvisory] = useState<InterventionAdvisoryEvent | null>(null);
const [advisoryMode, setAdvisoryMode] = useState<'active' | 'passive'>('passive');
```

Handle new SSE event type:
```typescript
if (data.type === 'intervention_advisory') {
  setAdvisory({
    type: 'intervention_advisory',
    ts: data.ts!,
    reason: data.reason!,
    confidence: data.confidence!,
    source_chunk_num: data.source_chunk_num!,
    source_text: data.source_text!,
    talking_point: data.talking_point ?? null,
  });
  // Auto-dismiss after 10s
  setTimeout(() => setAdvisory(null), 10_000);
}
```

### Step 2: Add advisory hint to FloatingTranscriptWindow

Subtle banner at the top of the transcript list (not blocking, not modal):
- Shows reason as icon + label: 🎯 "Question detected" / ⏸️ "Pause in conversation" / 🔑 "Topic match"
- If talking_point present: shows the user's registered point
- Confidence as opacity (high = fully visible, low = semi-transparent)
- Click to dismiss, "Don't disturb" button to invoke `/api/audio/advisory-dnd`

### Step 3: Add advisory mode toggle

In floating window header, add a toggle button:
- Passive (default): no advisory events shown
- Active: advisory events visible
- Calls `POST /api/audio/advisory-mode` with `{ mode }` on toggle

### Step 4: Add DND handler

```typescript
const handleDnd = useCallback(async () => {
  try {
    await apiFetch('/api/audio/advisory-dnd', { method: 'POST' });
    setAdvisory(null);
  } catch {}
}, []);
```

### Step 5: Verify UI in browser

Start dev server, test:
- Toggle advisory mode on/off
- Verify advisory hints appear on detection
- Verify auto-dismiss after 10s
- Verify DND clears current advisory
- Verify advisory doesn't appear in passive mode

### Step 6: Commit

```bash
git commit -m "feat(F195): C3 advisory hints in floating transcript window [宪宪/Opus-46🐾]"
```

---

## Task 4: Skill Ref Update + Feature Doc

**Files:**
- Modify: `cat-cafe-skills/refs/meeting-copilot.md` — add proactive advisory section
- Modify: `docs/features/F195-meeting-copilot-live-advisory.md` — update Phase C status

### Step 1: Update meeting-copilot.md

Add section (supplement to runtime gates, not replacement):

```markdown
## 主动建议模式（Active Advisory）

**前提**：advisory_mode 必须由用户显式开启（默认 passive）。

当 active 且检测到 intervention window 时：
- 浮动窗显示轻提示（不发 chat 消息）
- 带论点的建议只来自用户注册的 talking points
- 每 5 分钟最多 1 条（运行时限频，不靠猫自觉）
- 用户说"别打扰"→ 15 分钟静默

**禁止**：
- 不允许从转写文本生成立场性建议
- 不允许主动发 chat 消息（Phase C3b 再开）
```

### Step 2: Commit

```bash
git commit -m "docs(F195): C3 skill ref + feature doc update [宪宪/Opus-46🐾]"
```

---

## Open Questions

### 技术 OQ（实现过程中自行解决）

1. **Question pattern regex coverage**: Chinese question patterns (你觉得呢/怎么看/什么意思) vs English (what/how/why + ?). Start with common patterns, extend based on false-negative feedback.
2. **Silence threshold**: 5s is conservative. May need tuning per meeting pace. Make configurable via constructor param.
3. **Keyword matching granularity**: Simple token intersection vs fuzzy matching. Start with exact token overlap (split + lowercase + intersection ≥ 2).

### 价值 OQ — 无

All decisions are within the scope specified by 砚砚's vision guardrails + existing spec. No CVO escalation needed.

---

## Execution Order

```
Task 1 (detector + limiter) → Task 2 (wiring) → Task 3 (frontend) → Task 4 (docs)
```

Linear chain — each task depends on the previous. No parallelism needed for a single-cat implementation.

---

*[宪宪/Opus-46🐾]*
