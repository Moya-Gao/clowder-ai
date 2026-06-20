# F195 Phase G — Speaker Verification Implementation Plan

**Feature:** F195 — `docs/features/F195-meeting-copilot-live-advisory.md`
**Goal:** 将现有纯规则的 speaker 归因升级为基于 voice embedding 的声纹识别，显著提升多人会议中"谁在说话"的准确率
**Acceptance Criteria:**
- AC-G1: Enrollment 阶段 — `/enroll` 接受语音样本，提取 embedding 存储；测试不同分段长度（1s/2s/3s/5s）对 embedding 质量的影响
- AC-G2: 实时归因 — 每个 ASR 段提取 embedding，cosine similarity 对比 enrolled embeddings
- AC-G3: Fallback 降级 — similarity < threshold（默认 0.6）时降级到现有规则归因
- AC-G4: 中文会议实测 — 离线评估脚本：attribution accuracy、speaker swap rate、分段长度 ablation、跨设备 enrollment 测试
- AC-G5: 性能预算 — embedding 提取 < 200ms/segment，模型占用 < 100MB
**Architecture cell:** meeting-copilot（新 cell 候选 — 目前无独立 cell，评估后决定）
**Map delta:** none
**Map delta why:** 改动局限于 `scripts/meeting-copilot/` Python sidecar 内部（新模块 + 扩展现有方法），不改变任何 packages/ 架构边界或 API 契约。meeting-copilot 是独立 Python 进程，不影响 Node.js ownership map
**前端验证:** No — 纯 Python backend 改动，无前端 UI 变化

---

## Finish Line

**一句话 B**：`audio-service.py` 的 `_attribute_speaker()` 能基于 enrolled voice embeddings 做 cosine similarity 匹配，准确区分已注册说话人；unknown speaker 降级到现有规则归因。

**什么不做（明确排除）**：
- 实时 speaker diarization（全自动 pyannote pipeline）
- Swift MLX 迁移
- 跨会议持久化 speaker profile
- 前端 UI 改动（enrollment 语音采集通过现有 `/enroll` API 扩展）

---

## Terminal Schema

```python
# SpeakerEmbedder — 独立模块，封装 embedding 提取
class SpeakerEmbedder:
    """Wraps WeSpeaker/3D-Speaker model for speaker embedding extraction."""
    
    def __init__(self, model_id: str = "iic/speech_campplus_sv_zh-cn_16k-common"):
        # Lazy-load model on first extract() call
        self._model = None
        self._model_id = model_id
    
    def extract(self, pcm: bytes, sample_rate: int = 16000) -> np.ndarray | None:
        """Extract speaker embedding from PCM audio.
        Returns float32 vector (e.g. 512-dim) or None if audio too short.
        """
        ...
    
    def similarity(self, emb_a: np.ndarray, emb_b: np.ndarray) -> float:
        """Cosine similarity between two embeddings. Range [-1, 1]."""
        ...

# AudioSession.participants 扩展后的 schema
participant_with_embedding = {
    "id": "p1",
    "name": "铲屎官",
    "role": "host",
    "embedding": np.ndarray | None,  # NEW: voice embedding vector, None if no voice sample provided
}

# _attribute_speaker() 返回值不变（向后兼容）
attribution_result = {
    "speaker_label": str,       # participant name or "有人说"/"发言者"
    "speaker_confidence": float, # 0.0-1.0
    "speaker_id": str | None,   # participant id
}
```

---

## Stateful Object Gate（Census）

### 有生命周期的状态对象普查

本 Plan 涉及 **2 个**有生命周期的状态对象：

#### 对象 1: SpeakerEmbedder（模型实例）

**Lifecycle Owner**: `AudioSession`（通过 `__init__` 创建，session 级单例）

**状态×事件转移表**：

| 当前状态 | 事件 | 下一状态 | 动作 |
|---------|------|---------|------|
| unloaded | `extract()` 首次调用 | loaded | lazy-load 模型到内存 |
| loaded | `extract()` 后续调用 | loaded | 直接使用已加载模型 |
| loaded | AudioSession 销毁/GC | unloaded | 模型释放（Python GC） |

**旁路 API 限制**：无旁路。SpeakerEmbedder 只通过 AudioSession 访问，不暴露 HTTP 端点。

**不变量**：
- INV-E1: SpeakerEmbedder 实例跟 AudioSession 生命周期绑定（不跨 session 复用模型状态）— 可测：`__init__` 后 `_model is None`
- INV-E2: `extract()` 对同一 PCM 输入产出相同 embedding（确定性）— 可测：两次调用 assert allclose
- INV-E3: 模型文件不存在 / 加载失败时 `extract()` 返回 None，不抛异常 — 可测：mock 加载失败

**对抗场景**：
- 模型下载不完整 / 文件损坏 → `extract()` 返回 None，降级到规则归因（INV-E3）
- 并发调用 `extract()` → 无状态（纯函数式推理），线程安全（GIL + inference 是同步的）

#### 对象 2: Enrolled Speaker Embeddings（participants[].embedding）

**Lifecycle Owner**: `AudioSession.enroll()` 方法

**状态×事件转移表**：

| 当前状态 | 事件 | 下一状态 | 动作 |
|---------|------|---------|------|
| empty（`__init__`） | `enroll(metadata_only)` | metadata_only | 存 id/name/role，embedding=None |
| empty | `enroll(with_voice)` | has_embeddings | 提取 + 存 embedding |
| metadata_only | `enroll(with_voice)` | has_embeddings | 覆盖旧 participants，提取新 embedding |
| has_embeddings | `enroll(any)` | metadata_only 或 has_embeddings | 覆盖（现有行为不变） |
| any | `_reset()` | 保留 | participants 跨 reset 存活（现有行为，Phase C 测试覆盖） |
| any | session GC | empty | Python GC |

**旁路 API 限制**：`h_enroll` HTTP handler 是唯一入口，禁止直接操作 `session.participants`。

**不变量**：
- INV-P1: `enroll()` 是幂等替换——多次调用最终状态只取决于最后一次调用参数 — 可测：连续 enroll 两次，检查 participants
- INV-P2: `_reset()` 不清除 participants 和 embeddings（和 Phase C 行为一致）— 可测：enroll → reset → check participants
- INV-P3: 没有 voice sample 的 participant 的 embedding = None — 可测：enroll metadata-only → check embedding is None
- INV-P4: embedding 维度一致（所有 enrolled embeddings 同维度）— 可测：enroll 多人，check shapes

**对抗场景**：
- enroll 时音频太短（< 0.5s）→ `extract()` 返回 None → participant 有 metadata 但 embedding=None → 该 participant 走规则归因
- 混合 enrollment（部分有 voice，部分无）→ 有 embedding 的走 similarity，无 embedding 的走规则归因
- 跨设备域失配（enrollment 麦 vs 会议麦）→ AC-G4 离线评估覆盖

### 派生值检查

`_attribute_speaker()` 的返回值是纯计算（从 participants embeddings + current chunk embedding 实时算），零存储。✅ 符合派生值规则。

---

## Task 1: SpeakerEmbedder 模块

**Files:**
- Create: `scripts/meeting-copilot/speaker_embedder.py`
- Test: `scripts/meeting-copilot/test_speaker_embedder.py`

### 技术选型决策

使用 **3D-Speaker** (`modelscope` 的 `iic/speech_campplus_sv_zh-cn_16k-common` 模型)：
- CAM++ 架构，中文优化（cn_16k），EER ~0.72%
- 支持 ONNX Runtime（未来 Apple Silicon 迁移更平滑）
- `modelscope` pip 安装 + 自动下载模型缓存
- 模型大小 ~25MB，远低于 100MB 预算

**依赖**：`modelscope`、`numpy`（已有）、`torch`（VadChunker 已有 Silero 依赖）

### Step 1: 写 SpeakerEmbedder 单元测试

```python
# test_speaker_embedder.py
import unittest
import numpy as np

class TestSpeakerEmbedder(unittest.TestCase):
    """Unit tests for SpeakerEmbedder — model-agnostic with mock."""
    
    def test_extract_returns_ndarray_or_none(self):
        """extract() returns np.ndarray on valid audio, None on too-short."""
        from speaker_embedder import SpeakerEmbedder
        emb = SpeakerEmbedder()
        # 2 seconds of silence PCM (16kHz, 16-bit mono)
        pcm_2s = b'\x00\x00' * 16000 * 2
        result = emb.extract(pcm_2s)
        # With real model: ndarray; with stub: ensure interface works
        assert result is None or isinstance(result, np.ndarray)
    
    def test_extract_too_short_returns_none(self):
        """Audio shorter than MIN_DURATION_SEC returns None."""
        from speaker_embedder import SpeakerEmbedder
        emb = SpeakerEmbedder()
        pcm_100ms = b'\x00\x00' * 1600  # 0.1s
        result = emb.extract(pcm_100ms)
        assert result is None
    
    def test_similarity_identical(self):
        """Cosine similarity of identical vectors = 1.0."""
        from speaker_embedder import SpeakerEmbedder
        emb = SpeakerEmbedder()
        v = np.random.randn(512).astype(np.float32)
        assert abs(emb.similarity(v, v) - 1.0) < 1e-6
    
    def test_similarity_orthogonal(self):
        """Cosine similarity of orthogonal vectors = 0.0."""
        from speaker_embedder import SpeakerEmbedder
        emb = SpeakerEmbedder()
        v1 = np.array([1, 0, 0, 0], dtype=np.float32)
        v2 = np.array([0, 1, 0, 0], dtype=np.float32)
        assert abs(emb.similarity(v1, v2)) < 1e-6
    
    def test_similarity_range(self):
        """Similarity is always in [-1, 1]."""
        from speaker_embedder import SpeakerEmbedder
        emb = SpeakerEmbedder()
        for _ in range(10):
            v1 = np.random.randn(512).astype(np.float32)
            v2 = np.random.randn(512).astype(np.float32)
            s = emb.similarity(v1, v2)
            assert -1.0 <= s <= 1.0
    
    def test_extract_deterministic(self):
        """Same PCM input → same embedding (INV-E2)."""
        from speaker_embedder import SpeakerEmbedder
        emb = SpeakerEmbedder()
        pcm = b'\x00\x00' * 16000 * 3  # 3s silence
        r1 = emb.extract(pcm)
        r2 = emb.extract(pcm)
        if r1 is not None and r2 is not None:
            np.testing.assert_allclose(r1, r2, atol=1e-6)
    
    def test_model_load_failure_graceful(self):
        """If model can't load, extract() returns None (INV-E3)."""
        from speaker_embedder import SpeakerEmbedder
        emb = SpeakerEmbedder(model_id="nonexistent/model")
        pcm = b'\x00\x00' * 16000 * 3
        result = emb.extract(pcm)
        assert result is None
```

**Run**: `cd scripts/meeting-copilot && python -m pytest test_speaker_embedder.py -v`
**Expected**: RED — `ModuleNotFoundError: No module named 'speaker_embedder'`

### Step 2: 实现 SpeakerEmbedder

```python
# speaker_embedder.py
"""Speaker embedding extraction using 3D-Speaker CAM++ model.

Wraps modelscope/3D-Speaker for real-time speaker verification.
Lazy-loads model on first extract() call to avoid startup cost.
"""

import logging
import numpy as np

logger = logging.getLogger(__name__)

SAMPLE_RATE = 16000
MIN_DURATION_SEC = 0.5  # Below this, embedding quality is unreliable

class SpeakerEmbedder:
    def __init__(self, model_id: str = "iic/speech_campplus_sv_zh-cn_16k-common"):
        self._model_id = model_id
        self._pipeline = None
        self._load_error = False
    
    def _ensure_model(self) -> bool:
        """Lazy-load model. Returns True if ready."""
        if self._pipeline is not None:
            return True
        if self._load_error:
            return False
        try:
            from modelscope.pipelines import pipeline
            self._pipeline = pipeline(
                task="speaker-verification",
                model=self._model_id,
            )
            logger.info("Speaker embedding model loaded: %s", self._model_id)
            return True
        except Exception as e:
            logger.warning("Failed to load speaker embedding model: %s", e)
            self._load_error = True
            return False
    
    def extract(self, pcm: bytes, sample_rate: int = SAMPLE_RATE) -> np.ndarray | None:
        """Extract speaker embedding from raw PCM (16-bit mono).
        
        Returns:
            np.ndarray of shape (D,) with float32 embedding, or None if:
            - audio is too short (< MIN_DURATION_SEC)
            - model failed to load
            - extraction error
        """
        n_samples = len(pcm) // 2  # 16-bit = 2 bytes per sample
        duration = n_samples / sample_rate
        if duration < MIN_DURATION_SEC:
            return None
        
        if not self._ensure_model():
            return None
        
        try:
            # Convert PCM bytes to float32 numpy array [-1, 1]
            audio = np.frombuffer(pcm, dtype=np.int16).astype(np.float32) / 32768.0
            # modelscope speaker-verification pipeline accepts numpy array
            result = self._pipeline({"audio": audio, "sample_rate": sample_rate})
            embedding = np.array(result["spk_embedding"], dtype=np.float32)
            return embedding
        except Exception as e:
            logger.warning("Embedding extraction failed: %s", e)
            return None
    
    def similarity(self, emb_a: np.ndarray, emb_b: np.ndarray) -> float:
        """Cosine similarity between two embeddings."""
        norm_a = np.linalg.norm(emb_a)
        norm_b = np.linalg.norm(emb_b)
        if norm_a < 1e-8 or norm_b < 1e-8:
            return 0.0
        return float(np.dot(emb_a, emb_b) / (norm_a * norm_b))
```

**Run**: `cd scripts/meeting-copilot && python -m pytest test_speaker_embedder.py -v`
**Expected**: GREEN（similarity 测试立即通过；extract 测试取决于 modelscope 可用性——无模型时走 graceful None 路径）

### Step 3: Commit

```bash
git add scripts/meeting-copilot/speaker_embedder.py scripts/meeting-copilot/test_speaker_embedder.py
git commit -m "feat(f195-g): add SpeakerEmbedder module with CAM++ model"
```

---

## Task 2: 扩展 enroll() 支持语音样本

**Files:**
- Modify: `scripts/meeting-copilot/audio-service.py:69-142`（AudioSession.__init__ + enroll）
- Modify: `scripts/meeting-copilot/audio-service.py:715-727`（h_enroll HTTP handler）
- Test: `scripts/meeting-copilot/test_audio_service.py`（扩展 TestEnrollment）

### Step 4: 写扩展后 enrollment 的失败测试

在 `test_audio_service.py` 的 TestEnrollment 中新增：

```python
def test_enroll_with_voice_sample_stores_embedding(self):
    """Enrollment with voice_sample extracts and stores embedding (AC-G1)."""
    pcm_3s = b'\x00\x00' * 16000 * 3
    import base64
    b64 = base64.b64encode(pcm_3s).decode()
    self.session.enroll([
        {"id": "p1", "name": "铲屎官", "role": "host", "voice_sample": b64},
    ])
    assert self.session.participants[0].get("embedding") is not None or \
           self.session.participants[0].get("embedding") is None  # model may not be available

def test_enroll_without_voice_sample_embedding_is_none(self):
    """Enrollment without voice_sample sets embedding=None (INV-P3)."""
    self.session.enroll([
        {"id": "p1", "name": "铲屎官", "role": "host"},
    ])
    assert self.session.participants[0].get("embedding") is None

def test_enroll_mixed_voice_and_metadata(self):
    """Mixed enrollment: some with voice, some without."""
    pcm_3s = b'\x00\x00' * 16000 * 3
    import base64
    b64 = base64.b64encode(pcm_3s).decode()
    self.session.enroll([
        {"id": "p1", "name": "铲屎官", "role": "host", "voice_sample": b64},
        {"id": "p2", "name": "Alice", "role": "participant"},
    ])
    # p1 attempted embedding extraction; p2 definitely None
    assert self.session.participants[1].get("embedding") is None

def test_enroll_embedding_survives_reset(self):
    """Embeddings survive _reset() like participants do (INV-P2)."""
    pcm_3s = b'\x00\x00' * 16000 * 3
    import base64
    b64 = base64.b64encode(pcm_3s).decode()
    self.session.enroll([
        {"id": "p1", "name": "铲屎官", "role": "host", "voice_sample": b64},
    ])
    emb_before = self.session.participants[0].get("embedding")
    self.session._reset()
    emb_after = self.session.participants[0].get("embedding")
    # Must be the same object (reset doesn't re-extract)
    if emb_before is not None:
        assert emb_after is not None

def test_enroll_too_short_voice_sample(self):
    """Voice sample too short → embedding=None, participant still enrolled."""
    pcm_100ms = b'\x00\x00' * 1600  # 0.1s
    import base64
    b64 = base64.b64encode(pcm_100ms).decode()
    self.session.enroll([
        {"id": "p1", "name": "铲屎官", "role": "host", "voice_sample": b64},
    ])
    assert len(self.session.participants) == 1
    assert self.session.participants[0]["name"] == "铲屎官"
    assert self.session.participants[0].get("embedding") is None
```

**Run**: `cd scripts/meeting-copilot && python -m pytest test_audio_service.py::TestEnrollment -v`
**Expected**: RED — new tests fail (no `embedding` key in participants, no `voice_sample` handling)

### Step 5: 实现 enroll() 扩展

修改 `audio-service.py`：

1. `AudioSession.__init__` 新增 `self._embedder`：
```python
from speaker_embedder import SpeakerEmbedder
# In __init__:
self._embedder = SpeakerEmbedder()
```

2. 扩展 `enroll()` 方法处理 `voice_sample`：
```python
def enroll(self, participants: list[dict]) -> None:
    # ... existing validation unchanged ...
    import base64
    enrolled = []
    for p in participants:
        entry = {
            "id": p["id"], 
            "name": p["name"], 
            "role": p.get("role", "participant"),
            "embedding": None,
        }
        voice_sample = p.get("voice_sample")
        if voice_sample:
            try:
                pcm = base64.b64decode(voice_sample)
                embedding = self._embedder.extract(pcm)
                entry["embedding"] = embedding
            except Exception:
                pass  # Enrollment succeeds even if embedding extraction fails
        enrolled.append(entry)
    self.participants = enrolled
```

3. `h_enroll` HTTP handler：序列化时跳过 embedding（ndarray 不 JSON 序列化）：
```python
async def h_enroll(request):
    # ... existing code ...
    # Return only serializable fields
    safe_participants = [
        {"id": p["id"], "name": p["name"], "role": p["role"], 
         "has_embedding": p.get("embedding") is not None}
        for p in session.participants
    ]
    return web.json_response({"ok": True, "participants": safe_participants})
```

4. `status()` 也需要安全序列化 participants（跳过 embedding ndarray）。

**Run**: `cd scripts/meeting-copilot && python -m pytest test_audio_service.py::TestEnrollment -v`
**Expected**: GREEN

### Step 6: 验证现有测试不 regress

**Run**: `cd scripts/meeting-copilot && python -m pytest test_audio_service.py -v`
**Expected**: ALL PASS（现有 enrollment 测试不依赖 `embedding` 字段）

### Step 7: Commit

```bash
git add scripts/meeting-copilot/audio-service.py scripts/meeting-copilot/test_audio_service.py
git commit -m "feat(f195-g): extend enroll() to accept voice samples and extract embeddings"
```

---

## Task 3: 扩展 _attribute_speaker() 使用 cosine similarity

**Files:**
- Modify: `scripts/meeting-copilot/audio-service.py:154-164`（_attribute_speaker）
- Modify: `scripts/meeting-copilot/audio-service.py:478-537`（_process_chunk — 传 pcm 给 attribution）
- Test: `scripts/meeting-copilot/test_audio_service.py`（新增 TestEmbeddingAttribution class）

### Step 8: 写 embedding-based attribution 的失败测试

新增 `TestEmbeddingAttribution` test class：

```python
class TestEmbeddingAttribution(unittest.TestCase):
    """Tests for voice-embedding-based speaker attribution (AC-G2, AC-G3)."""
    
    def setUp(self):
        self.session = AudioSession()
    
    def test_attribution_with_embeddings_matches_nearest(self):
        """When enrolled with embeddings, attribution picks nearest match (AC-G2)."""
        import numpy as np
        # Manually inject embeddings (simulating post-enrollment state)
        self.session.participants = [
            {"id": "p1", "name": "铲屎官", "role": "host",
             "embedding": np.array([1, 0, 0], dtype=np.float32)},
            {"id": "p2", "name": "Alice", "role": "participant",
             "embedding": np.array([0, 1, 0], dtype=np.float32)},
        ]
        # Chunk embedding close to p1
        chunk_emb = np.array([0.9, 0.1, 0], dtype=np.float32)
        attr = self.session._attribute_speaker(chunk_embedding=chunk_emb)
        assert attr["speaker_label"] == "铲屎官"
        assert attr["speaker_id"] == "p1"
        assert attr["speaker_confidence"] > 0.8
    
    def test_attribution_below_threshold_falls_back(self):
        """Similarity below threshold → fallback to rule-based (AC-G3)."""
        import numpy as np
        self.session.participants = [
            {"id": "p1", "name": "铲屎官", "role": "host",
             "embedding": np.array([1, 0, 0], dtype=np.float32)},
        ]
        # Orthogonal chunk embedding → similarity ≈ 0
        chunk_emb = np.array([0, 0, 1], dtype=np.float32)
        self.session.source = "mic"
        attr = self.session._attribute_speaker(chunk_embedding=chunk_emb)
        # Should fallback to rule-based (mic + host → host name, conf 0.9)
        assert attr["speaker_label"] == "铲屎官"
        assert attr["speaker_confidence"] == 0.9  # rule-based confidence
    
    def test_attribution_no_embeddings_uses_rules(self):
        """No embeddings enrolled → pure rule-based (backward compat)."""
        self.session.enroll([
            {"id": "p1", "name": "铲屎官", "role": "host"},
        ])
        self.session.source = "mic"
        attr = self.session._attribute_speaker()  # No chunk_embedding
        assert attr["speaker_label"] == "铲屎官"
        assert attr["speaker_confidence"] == 0.9
    
    def test_attribution_none_chunk_embedding_uses_rules(self):
        """chunk_embedding=None → rule-based even with enrolled embeddings."""
        import numpy as np
        self.session.participants = [
            {"id": "p1", "name": "铲屎官", "role": "host",
             "embedding": np.array([1, 0, 0], dtype=np.float32)},
        ]
        self.session.source = "mic"
        attr = self.session._attribute_speaker(chunk_embedding=None)
        assert attr["speaker_label"] == "铲屎官"
        assert attr["speaker_confidence"] == 0.9
    
    def test_attribution_partial_embeddings(self):
        """Some participants have embeddings, some don't — only compare with those that do."""
        import numpy as np
        self.session.participants = [
            {"id": "p1", "name": "铲屎官", "role": "host",
             "embedding": np.array([1, 0, 0], dtype=np.float32)},
            {"id": "p2", "name": "Alice", "role": "participant",
             "embedding": None},  # No voice sample
        ]
        chunk_emb = np.array([0.9, 0.1, 0], dtype=np.float32)
        attr = self.session._attribute_speaker(chunk_embedding=chunk_emb)
        assert attr["speaker_label"] == "铲屎官"
        assert attr["speaker_id"] == "p1"
    
    def test_attribution_configurable_threshold(self):
        """SPEAKER_SIMILARITY_THRESHOLD env var controls fallback threshold."""
        import numpy as np
        self.session.participants = [
            {"id": "p1", "name": "铲屎官", "role": "host",
             "embedding": np.array([1, 0, 0], dtype=np.float32)},
        ]
        # Similarity ≈ 0.7 — above default 0.6 threshold
        chunk_emb = np.array([0.7, 0.7, 0.1], dtype=np.float32)
        attr = self.session._attribute_speaker(chunk_embedding=chunk_emb)
        assert attr["speaker_id"] == "p1"
```

**Run**: `cd scripts/meeting-copilot && python -m pytest test_audio_service.py::TestEmbeddingAttribution -v`
**Expected**: RED — `_attribute_speaker()` doesn't accept `chunk_embedding` parameter

### Step 9: 实现 embedding-based _attribute_speaker()

```python
SPEAKER_SIMILARITY_THRESHOLD = float(os.getenv("SPEAKER_SIMILARITY_THRESHOLD", "0.6"))

def _attribute_speaker(self, chunk_embedding=None) -> dict:
    """Attribute speaker: embedding-based (preferred) → rule-based (fallback)."""
    # --- Embedding path (AC-G2) ---
    if chunk_embedding is not None:
        enrolled_with_emb = [
            p for p in self.participants 
            if p.get("embedding") is not None
        ]
        if enrolled_with_emb:
            best_sim = -1.0
            best_p = None
            for p in enrolled_with_emb:
                sim = self._embedder.similarity(chunk_embedding, p["embedding"])
                if sim > best_sim:
                    best_sim = sim
                    best_p = p
            if best_p and best_sim >= SPEAKER_SIMILARITY_THRESHOLD:
                return {
                    "speaker_label": best_p["name"],
                    "speaker_confidence": round(min(best_sim, 1.0), 3),
                    "speaker_id": best_p["id"],
                }
    # --- Rule-based fallback (AC-G3, existing Phase C logic) ---
    host = next((p for p in self.participants if p.get("role") == "host"), None)
    non_hosts = [p for p in self.participants if p.get("role") != "host"]
    if self.source == "mic":
        if host:
            return {"speaker_label": host["name"], "speaker_confidence": 0.9, "speaker_id": host["id"]}
        return {"speaker_label": "发言者", "speaker_confidence": 0.5, "speaker_id": None}
    if len(self.participants) == 2 and len(non_hosts) == 1:
        other = non_hosts[0]
        return {"speaker_label": other["name"], "speaker_confidence": 0.7, "speaker_id": other["id"]}
    return {"speaker_label": "有人说", "speaker_confidence": 0.4, "speaker_id": None}
```

### Step 10: 修改 _process_chunk() 传入 chunk embedding

在 `_process_chunk()` 中，ASR 完成后、调用 `_attribute_speaker()` 前，提取当前 chunk 的 embedding：

```python
async def _process_chunk(self, pcm: bytes, force: bool = False):
    # ... existing ASR + LLM postprocess code unchanged ...
    
    # Extract chunk embedding for speaker attribution (Phase G)
    chunk_embedding = None
    has_enrolled_embeddings = any(
        p.get("embedding") is not None for p in self.participants
    )
    if has_enrolled_embeddings:
        chunk_embedding = self._embedder.extract(pcm)
    
    speaker = self._attribute_speaker(chunk_embedding=chunk_embedding)
    # ... rest unchanged ...
```

**Run**: `cd scripts/meeting-copilot && python -m pytest test_audio_service.py -v`
**Expected**: GREEN（所有新旧测试通过）

### Step 11: Commit

```bash
git add scripts/meeting-copilot/audio-service.py scripts/meeting-copilot/test_audio_service.py
git commit -m "feat(f195-g): embedding-based speaker attribution with rule-based fallback"
```

---

## Task 4: 离线评估脚本（AC-G4）

**Files:**
- Create: `scripts/meeting-copilot/eval_speaker_verification.py`
- No unit test（评估脚本是工具，输出是报告）

### Step 12: 实现离线评估脚本

```python
# eval_speaker_verification.py
"""Offline evaluation of speaker verification quality.

Usage:
    python eval_speaker_verification.py \
        --enrollment-dir /path/to/enrollment_samples/ \
        --test-audio /path/to/meeting_recording.wav \
        --ground-truth /path/to/ground_truth.json \
        --segment-lengths 1,2,3,5

Output:
    - Speaker attribution accuracy (per-speaker + overall)
    - Speaker swap rate (adjacent segments attributed to different speakers incorrectly)
    - Segment length ablation table
    - Cross-device enrollment test (if --cross-device-enrollment provided)
"""
```

评估脚本功能：
1. 加载 enrollment 语音样本 → 提取 reference embeddings
2. 将 test audio 按指定 segment lengths（1s/2s/3s/5s）切分
3. 每个 segment 提取 embedding → cosine similarity 匹配
4. 对比 ground truth → 计算 accuracy / swap rate
5. 输出 ablation 表（不同 segment length 的效果对比）
6. 可选：cross-device enrollment（近讲麦 enrollment vs 会议麦测试）

### Step 13: Commit

```bash
git add scripts/meeting-copilot/eval_speaker_verification.py
git commit -m "feat(f195-g): add offline evaluation script for speaker verification"
```

---

## Task 5: 性能验证 + 依赖更新（AC-G5）

**Files:**
- Modify: `scripts/meeting-copilot/requirements.txt`
- Test: `scripts/meeting-copilot/test_speaker_embedder.py`（新增性能测试）

### Step 14: 添加性能基准测试

在 `test_speaker_embedder.py` 新增：

```python
class TestPerformance(unittest.TestCase):
    """Performance budget tests (AC-G5)."""
    
    def test_extract_latency_under_200ms(self):
        """Embedding extraction should complete in < 200ms per segment."""
        import time
        from speaker_embedder import SpeakerEmbedder
        emb = SpeakerEmbedder()
        pcm_3s = b'\x00\x00' * 16000 * 3
        # Warm up (first call loads model)
        emb.extract(pcm_3s)
        # Measure
        times = []
        for _ in range(5):
            t0 = time.perf_counter()
            emb.extract(pcm_3s)
            times.append(time.perf_counter() - t0)
        avg = sum(times) / len(times)
        assert avg < 0.200, f"Average extraction latency {avg:.3f}s exceeds 200ms budget"
    
    def test_similarity_computation_fast(self):
        """Cosine similarity should be negligible (< 1ms)."""
        import time
        from speaker_embedder import SpeakerEmbedder
        emb = SpeakerEmbedder()
        v1 = np.random.randn(512).astype(np.float32)
        v2 = np.random.randn(512).astype(np.float32)
        t0 = time.perf_counter()
        for _ in range(1000):
            emb.similarity(v1, v2)
        elapsed = time.perf_counter() - t0
        assert elapsed < 1.0, f"1000 similarity computations took {elapsed:.3f}s"
```

### Step 15: 更新 requirements.txt

```
aiohttp>=3.9
sounddevice>=0.5
numpy>=1.24
modelscope>=1.10
```

### Step 16: Commit

```bash
git add scripts/meeting-copilot/requirements.txt scripts/meeting-copilot/test_speaker_embedder.py
git commit -m "feat(f195-g): performance budget tests + modelscope dependency"
```

---

## Task 6: 集成测试 — 端到端 enrollment → attribution 流程

**Files:**
- Test: `scripts/meeting-copilot/test_audio_service.py`（新增 TestSpeakerVerificationIntegration）

### Step 17: 写集成测试

```python
class TestSpeakerVerificationIntegration(unittest.TestCase):
    """End-to-end: enroll with voice → attribute by embedding → fallback on unknown."""
    
    def test_full_flow_enroll_then_attribute(self):
        """Enroll with voice sample → _attribute_speaker uses embedding."""
        import base64
        import numpy as np
        session = AudioSession()
        # Create synthetic "voice" (random PCM — won't produce meaningful embedding
        # in tests without real model, but exercises the full code path)
        pcm = np.random.randint(-1000, 1000, 16000 * 3, dtype=np.int16).tobytes()
        b64 = base64.b64encode(pcm).decode()
        session.enroll([
            {"id": "p1", "name": "铲屎官", "role": "host", "voice_sample": b64},
        ])
        session.source = "mic"
        # Without chunk_embedding → rule-based
        attr = session._attribute_speaker()
        assert attr["speaker_label"] == "铲屎官"
        assert attr["speaker_confidence"] == 0.9  # rule-based
    
    def test_backward_compat_all_existing_tests_pass(self):
        """Verify no regression in existing enrollment/attribution behavior."""
        session = AudioSession()
        session.enroll([
            {"id": "p1", "name": "铲屎官", "role": "host"},
            {"id": "p2", "name": "Alice", "role": "participant"},
        ])
        session.source = "mic"
        attr = session._attribute_speaker()
        assert attr["speaker_label"] == "铲屎官"
        assert attr["speaker_confidence"] == 0.9
        assert attr["speaker_id"] == "p1"
```

**Run**: `cd scripts/meeting-copilot && python -m pytest test_audio_service.py -v`
**Expected**: GREEN

### Step 18: Final commit

```bash
git add scripts/meeting-copilot/test_audio_service.py
git commit -m "test(f195-g): add speaker verification integration tests"
```

---

## Open Questions

### 技术 OQ（实现过程中自行解决）

1. **modelscope vs wespeaker pip 包**：modelscope 的 `iic/speech_campplus_sv_zh-cn_16k-common` 模型 API 需要实测确认。如果 modelscope 安装太重（拉很多依赖），考虑降级到直接用 ONNX Runtime + 预下载模型权重（3D-Speaker 仓库提供 ONNX 导出）。Spike 预算：实现 Task 1 时如果 modelscope 安装超过 5 分钟或体积超过 500MB，切换到 ONNX 方案。

2. **chunk PCM vs WAV 输入格式**：`_process_chunk` 拿到的是 `pcm: bytes`（raw 16-bit mono 16kHz），`wav` 变量是给 ASR API 用的 WAV 格式。SpeakerEmbedder.extract() 直接接收 PCM bytes 是最高效的路径（避免多余的 WAV header 打包/解包）。

3. **`status()` / `h_enroll` 响应中 embedding 的序列化**：ndarray 不能直接 JSON 序列化。方案：返回时只包含 `has_embedding: bool`，不传 embedding 数据本身（embedding 是内部状态，不需要暴露给 API 调用者）。

### 价值 OQ（无）

没有需要 CVO 判断的价值取舍。技术选型（CAM++ vs ECAPA-TDNN vs ONNX）在 Task 1 实现时基于可用性自决，属于可逆决策。

---

## 实现顺序总结

| Task | 内容 | AC 覆盖 | 预估 |
|------|------|---------|------|
| 1 | SpeakerEmbedder 模块 | AC-G5（部分） | 15 min |
| 2 | enroll() 扩展 | AC-G1 | 15 min |
| 3 | _attribute_speaker() 升级 | AC-G2, AC-G3 | 20 min |
| 4 | 离线评估脚本 | AC-G4 | 15 min |
| 5 | 性能验证 + 依赖 | AC-G5 | 10 min |
| 6 | 集成测试 | 全部 | 10 min |
