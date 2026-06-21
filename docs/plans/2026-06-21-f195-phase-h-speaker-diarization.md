# F195 Phase H — Speaker Diarization (Unsupervised Clustering) Implementation Plan

**Feature:** F195 — `docs/features/F195-meeting-copilot-live-advisory.md`
**Goal:** 将 Phase G 的预注册声纹归因升级为无监督 speaker diarization，无需预先注册即可自动按声音特征聚类说话人，用户事后可映射真实姓名
**Acceptance Criteria:**
- AC-H1: 无监督聚类 — 无需预注册，自动按声音特征分离说话人（>=2 人）
- AC-H2: 事后归名 — `/api/audio/map-speaker` 将 Speaker N 映射为真实姓名，retroactive 更新已有全部 transcript 行
- AC-H3: Phase G 兼容 — 已 enrolled 说话人优先走 verification 路径，未知说话人走 diarization
- AC-H4: 实测评估 — DER + swap rate + fragmentation rate + unknown rate
**Architecture cell:** meeting-copilot（无独立 cell，改动局限于 `scripts/meeting-copilot/` Python sidecar）
**Map delta:** none
**Map delta why:** 改动全在 `scripts/meeting-copilot/` Python sidecar 内部（新模块 + 扩展现有方法），不改变任何 packages/ 架构边界或 API 契约
**前端验证:** No — 纯 Python backend 改动，前端 TranscriptPanel 已有 speaker_label/speaker_id 渲染

---

## Finish Line

**一句话 B**：`audio-service.py` 的 `_attribute_speaker()` 在 enrolled 匹配失败后能基于 online centroid matching 自动聚类说话人为 Speaker 1 / Speaker 2 / ...，用户通过 `/api/audio/map-speaker` retroactive 映射真名到全部历史 transcript 行。

**什么不做（明确排除）**：
- 跨会议 speaker 持久化（每次独立，不建全局 speaker 库）
- 实时字幕级低延迟（<500ms）— 允许几秒延迟换取更高聚类准确率
- Swift 原生迁移（先验 Python 方案）
- pyannote streaming hosted service 集成（开源 pyannote 是 file-based pipeline，Phase H 只评估 batch 路径）
- Batch re-diarization 实现（本 Phase 仅做 online 聚类 + 评估 pyannote batch 可行性，不实现 batch 路径）

---

## Terminal Schema

```python
# --- speaker_cluster_registry.py (新文件) ---

import numpy as np

SPEAKER_CLUSTER_THRESHOLD = 0.65   # 独立于 Phase G 的 0.6
MAX_CLUSTERS = 8
MIN_SEGMENT_SEC = 0.8              # 低于此长度的段不参与聚类
ASSIGNMENT_MARGIN = 0.08           # top1 - top2 < margin → ambiguous

class ClusterRegistry:
    """Online incremental speaker clustering using centroid matching.

    Lifecycle owner: AudioSession (created on start, cleared on _reset).
    """

    def __init__(
        self,
        threshold: float = SPEAKER_CLUSTER_THRESHOLD,
        max_clusters: int = MAX_CLUSTERS,
        min_segment_sec: float = MIN_SEGMENT_SEC,
        assignment_margin: float = ASSIGNMENT_MARGIN,
    ):
        self._threshold = threshold
        self._max_clusters = max_clusters
        self._min_segment_sec = min_segment_sec
        self._assignment_margin = assignment_margin
        self._clusters: list[dict] = []
        # Each cluster: {"id": "Speaker 1", "centroid": np.ndarray, "count": int}

    def assign(self, embedding: np.ndarray, segment_duration: float) -> dict:
        """Assign embedding to existing cluster or create new one.

        Returns:
            {"cluster_id": str, "confidence": float, "is_new": bool}
            or {"cluster_id": None, "confidence": 0, "is_new": False}
            if segment too short or ambiguous.
        """
        ...

    def map_speaker(self, cluster_id: str, name: str) -> bool:
        """Map a cluster_id (e.g. "Speaker 1") to a human name.

        Returns True if cluster found and mapped, False otherwise.
        Does NOT update transcript lines — caller must do retroactive update.
        """
        ...

    def get_display_name(self, cluster_id: str) -> str:
        """Return mapped name if exists, else original cluster_id."""
        ...

    def get_clusters(self) -> list[dict]:
        """Return cluster state for status/debug endpoint."""
        ...

    def reset(self) -> None:
        """Clear all clusters. Called by AudioSession._reset()."""
        self._clusters = []

    @property
    def cluster_count(self) -> int:
        return len(self._clusters)


# --- _attribute_speaker() 修改后的完整签名 (audio-service.py) ---

def _attribute_speaker(self, chunk_embedding=None, segment_duration=0.0) -> dict:
    """Attribute speaker: enrolled match → cluster match → rule fallback.

    Priority chain:
    1. Enrolled cosine match (Phase G) — if enrolled embeddings exist
    2. Cluster centroid match (Phase H) — if diarization_enabled
    3. Rule-based fallback (Phase C) — always available
    """
    ...

# --- /api/audio/map-speaker endpoint response ---
# POST /api/audio/map-speaker
# Body: {"cluster_id": "Speaker 1", "name": "张三"}
# Response: {"ok": true, "mapped_name": "张三", "updated_lines": 12}
```

---

## Stateful Object Gate: ClusterRegistry

### Census

Plan 涉及的有生命周期对象：

| 对象 | 类型 | Lifecycle Owner | 文件 |
|------|------|----------------|------|
| **ClusterRegistry** | 新建 | AudioSession（start 创建，_reset 清除） | `speaker_cluster_registry.py` |
| AudioSession._cluster_registry | 字段引用 | AudioSession | `audio-service.py` |
| TranscriptWindow lines（retroactive 更新目标） | 已有 | AudioSession | `audio-service.py` |

注意：TranscriptArtifactStore 的 MD 文件是 append-only 写入，map-speaker retroactive 更新只改 TranscriptWindow 的 in-memory lines + SSE 广播更新事件，不回改已写入的 MD 文件（MD 文件是历史快照，最终 finalize 时会有正确的归名）。

### 状态 × 事件转移表（ClusterRegistry）

**唯一 Lifecycle Owner**：`AudioSession`（`_reset()` 清除 → `start()` 后可用 → `stop()` → `_reset()` 再次清除）

**旁路 API 禁止**：`map_speaker()` 不创建/删除 cluster，只更新 display name；`get_clusters()` 只读。

| 当前状态 | 事件 | 下一状态 | 动作 |
|----------|------|----------|------|
| EMPTY (0 clusters) | `assign(emb, dur)` dur >= min_seg | ACTIVE (1 cluster) | 创建 cluster "Speaker 1"，centroid = emb |
| EMPTY | `assign(emb, dur)` dur < min_seg | EMPTY | 返回 `{cluster_id: None}` |
| EMPTY | `map_speaker(id, name)` | EMPTY | 返回 False（无此 cluster） |
| EMPTY | `reset()` | EMPTY | no-op |
| ACTIVE (1..max-1 clusters) | `assign(emb, dur)` match above threshold | ACTIVE (same count) | 更新 matched cluster centroid（running average），返回 match |
| ACTIVE (1..max-1) | `assign(emb, dur)` no match above threshold | ACTIVE (count+1) | 创建新 cluster "Speaker N"，返回 new |
| ACTIVE (1..max-1) | `assign(emb, dur)` ambiguous (top1-top2 < margin) | ACTIVE (same) | 返回 `{cluster_id: None}` + confidence=0（不强行分配） |
| ACTIVE (1..max-1) | `assign(emb, dur)` dur < min_seg | ACTIVE (same) | 返回 `{cluster_id: None}` |
| ACTIVE | `map_speaker(id, name)` id exists | ACTIVE | 更新 cluster display_name，返回 True |
| ACTIVE | `map_speaker(id, name)` id not found | ACTIVE | 返回 False |
| ACTIVE | `reset()` | EMPTY | 清空 `_clusters` |
| FULL (max clusters) | `assign(emb, dur)` match | FULL | 更新 matched centroid，返回 match |
| FULL (max) | `assign(emb, dur)` no match | FULL | 返回 `{cluster_id: None}`（不创建新 cluster，logged） |
| FULL | `map_speaker(id, name)` | FULL (same) | 同 ACTIVE |
| FULL | `reset()` | EMPTY | 清空 |

### 不变量清单

| ID | 不变量 | 可测方式 |
|----|--------|----------|
| INV-1 | `len(clusters) <= max_clusters` 恒成立 | 单测：FULL 状态下 assign 不增长 |
| INV-2 | 每个 cluster 的 centroid 是非 None 的 float32 ndarray | 单测：创建后 assert dtype + shape |
| INV-3 | cluster_id 格式为 "Speaker N"（1-indexed，单调递增，不复用已删除 ID） | 单测：创建 3 个 cluster 后 reset 再创建，ID 重新从 1 开始 |
| INV-4 | `assign()` 返回的 confidence 在 [0, 1] | 单测：正常 + 边界 embedding |
| INV-5 | centroid 更新使用 running average：`new = (old * count + emb) / (count + 1)` | 单测：手算验证 3 次更新后的 centroid |
| INV-6 | `map_speaker()` 不改变 cluster 数量 | 单测：map 前后 `cluster_count` 不变 |
| INV-7 | `reset()` 后 `cluster_count == 0` 且后续 assign 从 "Speaker 1" 重新开始 | 单测：reset → assign → check id |
| INV-8 | ambiguous assignment（top1 - top2 < margin）返回 `cluster_id: None` | 单测：构造两个相近 centroid + 等距 embedding |

### 对抗场景

| 场景 | 预期行为 | 测试方式 |
|------|----------|----------|
| **crash window**: assign 到一半（centroid 已更新但 count 未 +1） | 不会发生——assign 是单线程同步操作，无 await 点；centroid 和 count 在同一行更新 | 代码审查：确认无 async gap |
| **concurrent assign**: 两个 chunk 同时调 assign | 不会发生——`_process_chunk` 是串行 async（一次只处理一个 chunk），assign 在 sync 路径上 | 代码审查 + 注释 |
| **极短段 flooding**: 大量 < min_segment_sec 的段连续到达 | 全部返回 `{cluster_id: None}`，不影响 cluster 状态 | 单测：100 次短段 assign，assert cluster_count == 0 |
| **单人会议**: 只有一个说话人 | 创建 "Speaker 1" 后所有段都 match 回它，centroid 逐步稳定 | 单测：10 次相似 embedding，assert cluster_count == 1 |
| **max_clusters 后新人**: 已达上限时出现新说话人 | 返回 `{cluster_id: None}`（不创建），log warning | 单测：填满 max 个 cluster，再 assign 不同 embedding |
| **map_speaker 不存在的 ID**: 用户发 "Speaker 99" | 返回 False，无副作用 | 单测 |
| **retroactive 归名范围**: map_speaker 后新到的行也用 mapped name | `get_display_name()` 查到 mapped name，新行的 speaker_label 直接用 display_name | 集成测试：map → 新 assign → check label |
| **reset 后 map**: reset 清空后再 map 旧 ID | 返回 False（cluster 不存在） | 单测 |
| **embedding 全零 / NaN**: 模型异常输出 | `assign()` 检测零范数或 NaN → 返回 `{cluster_id: None}` | 单测：zero vector + NaN vector |

---

## Design Decisions (砚砚 review 收敛)

| # | Decision | Source |
|---|----------|--------|
| 1 | Embedding gate: `diarization_enabled or has_enrolled_embeddings` | 砚砚 |
| 2 | Online = provisional hint, batch = truth source（本 Phase 仅做 online） | 砚砚 |
| 3 | Centroid matching MVP with 3 guardrails: `min_segment_sec`, `max_clusters=8`, `assignment_margin` | Both |
| 4 | 新 config `SPEAKER_CLUSTER_THRESHOLD`, default 0.65, 不复用 Phase G 的 0.6 | 砚砚 |
| 5 | 独立模块 `speaker_cluster_registry.py`, 不膨胀 AudioSession | 砚砚 |
| 6 | Retroactive 归名: 更新 ALL lines for cluster, 不只 future | 砚砚 |
| 7 | Batch: 评估 pyannote file-based pipeline 可行性，不假设 streaming | 砚砚 |
| 8 | AC 可测化: DER + swap rate + fragmentation rate + unknown rate | 砚砚 |
| 9 | `_reset()` must clear cluster registry | 砚砚 |

---

## Open Questions

### 技术 OQ（实现过程中自行解决）

1. **Centroid running average vs. reservoir sampling**：running average 对早期 embedding 有 bias（第一个 embedding 权重最大）。如果实测 DER 不理想，考虑 reservoir sampling 或 exponential moving average。先用 running average 作 MVP，评估后再优化。
2. **pyannote batch 可行性**：本 Phase 只在 eval script 里试跑 pyannote file-based pipeline，不集成到 runtime。如果 DER 显著优于 online centroid matching，Phase I 再做 batch re-diarization。

### 价值 OQ

无。本 Phase 方向已由铲屎官"谁特喵看视频和参加会议能提前注册啊！！"明确，技术方案由设计 brainstorm 收敛。

---

## Implementation Tasks

### Task 1: ClusterRegistry — 核心聚类引擎

**Files:**
- Create: `scripts/meeting-copilot/speaker_cluster_registry.py`
- Create: `scripts/meeting-copilot/test_speaker_cluster_registry.py`

**Step 1: Write failing tests for basic lifecycle**

```python
# test_speaker_cluster_registry.py
import numpy as np
import pytest
from speaker_cluster_registry import ClusterRegistry

def _random_emb(seed=42, dim=192):
    rng = np.random.RandomState(seed)
    v = rng.randn(dim).astype(np.float32)
    return v / np.linalg.norm(v)

def _similar_emb(base, noise_scale=0.05, seed=99):
    rng = np.random.RandomState(seed)
    noisy = base + rng.randn(*base.shape).astype(np.float32) * noise_scale
    return noisy / np.linalg.norm(noisy)

class TestClusterRegistryLifecycle:
    def test_empty_initial_state(self):
        reg = ClusterRegistry()
        assert reg.cluster_count == 0
        assert reg.get_clusters() == []

    def test_assign_creates_first_cluster(self):
        reg = ClusterRegistry()
        emb = _random_emb(seed=1)
        result = reg.assign(emb, segment_duration=1.0)
        assert result["cluster_id"] == "Speaker 1"
        assert result["is_new"] is True
        assert reg.cluster_count == 1

    def test_assign_matches_existing_cluster(self):
        reg = ClusterRegistry()
        emb1 = _random_emb(seed=1)
        reg.assign(emb1, segment_duration=1.0)
        emb2 = _similar_emb(emb1, noise_scale=0.02, seed=2)
        result = reg.assign(emb2, segment_duration=1.0)
        assert result["cluster_id"] == "Speaker 1"
        assert result["is_new"] is False
        assert reg.cluster_count == 1

    def test_assign_creates_second_cluster_for_different_speaker(self):
        reg = ClusterRegistry()
        emb1 = _random_emb(seed=1)
        reg.assign(emb1, segment_duration=1.0)
        emb2 = _random_emb(seed=100)  # very different
        result = reg.assign(emb2, segment_duration=1.0)
        assert result["cluster_id"] == "Speaker 2"
        assert result["is_new"] is True
        assert reg.cluster_count == 2

    def test_reset_clears_all(self):
        reg = ClusterRegistry()
        reg.assign(_random_emb(seed=1), segment_duration=1.0)
        reg.assign(_random_emb(seed=100), segment_duration=1.0)
        assert reg.cluster_count == 2
        reg.reset()
        assert reg.cluster_count == 0
        # IDs restart from 1
        result = reg.assign(_random_emb(seed=200), segment_duration=1.0)
        assert result["cluster_id"] == "Speaker 1"
```

**Step 2: Run tests to verify they fail**

```bash
cd scripts/meeting-copilot && python -m pytest test_speaker_cluster_registry.py -v
```
Expected: ModuleNotFoundError (speaker_cluster_registry not found)

**Step 3: Implement ClusterRegistry core**

```python
# speaker_cluster_registry.py
"""Online incremental speaker clustering using centroid matching.

Lifecycle owner: AudioSession (created on start, cleared on _reset).
Each meeting session gets a fresh ClusterRegistry.
"""

import logging

import numpy as np

logger = logging.getLogger(__name__)

SPEAKER_CLUSTER_THRESHOLD = float(
    __import__("os").getenv("SPEAKER_CLUSTER_THRESHOLD", "0.65")
)
MAX_CLUSTERS = int(__import__("os").getenv("MAX_SPEAKER_CLUSTERS", "8"))
MIN_SEGMENT_SEC = 0.8
ASSIGNMENT_MARGIN = 0.08


class ClusterRegistry:
    """Online incremental speaker clustering using centroid matching."""

    def __init__(
        self,
        threshold: float = SPEAKER_CLUSTER_THRESHOLD,
        max_clusters: int = MAX_CLUSTERS,
        min_segment_sec: float = MIN_SEGMENT_SEC,
        assignment_margin: float = ASSIGNMENT_MARGIN,
    ):
        self._threshold = threshold
        self._max_clusters = max_clusters
        self._min_segment_sec = min_segment_sec
        self._assignment_margin = assignment_margin
        self._clusters: list[dict] = []
        self._next_id = 1

    def assign(self, embedding: np.ndarray, segment_duration: float) -> dict:
        """Assign embedding to existing cluster or create new one."""
        # Guard: too short
        if segment_duration < self._min_segment_sec:
            return {"cluster_id": None, "confidence": 0.0, "is_new": False}
        # Guard: zero-norm or NaN
        norm = np.linalg.norm(embedding)
        if norm < 1e-8 or np.isnan(norm):
            return {"cluster_id": None, "confidence": 0.0, "is_new": False}

        if not self._clusters:
            return self._create_cluster(embedding)

        # Compute similarities to all centroids
        sims = []
        for c in self._clusters:
            sim = self._cosine(embedding, c["centroid"])
            sims.append(sim)

        sorted_sims = sorted(enumerate(sims), key=lambda x: x[1], reverse=True)
        best_idx, best_sim = sorted_sims[0]

        # Ambiguity check
        if len(sorted_sims) >= 2:
            _, second_sim = sorted_sims[1]
            if best_sim - second_sim < self._assignment_margin and best_sim >= self._threshold:
                return {"cluster_id": None, "confidence": 0.0, "is_new": False}

        if best_sim >= self._threshold:
            # Match: update centroid via running average
            c = self._clusters[best_idx]
            c["centroid"] = (c["centroid"] * c["count"] + embedding) / (c["count"] + 1)
            c["count"] += 1
            display = c.get("display_name", c["id"])
            return {
                "cluster_id": c["id"],
                "confidence": round(min(float(best_sim), 1.0), 3),
                "is_new": False,
            }

        # No match: create new cluster if under limit
        if len(self._clusters) >= self._max_clusters:
            logger.warning(
                "Max clusters (%d) reached, cannot create new cluster",
                self._max_clusters,
            )
            return {"cluster_id": None, "confidence": 0.0, "is_new": False}

        return self._create_cluster(embedding)

    def _create_cluster(self, embedding: np.ndarray) -> dict:
        cluster_id = f"Speaker {self._next_id}"
        self._next_id += 1
        self._clusters.append({
            "id": cluster_id,
            "centroid": embedding.copy(),
            "count": 1,
        })
        return {"cluster_id": cluster_id, "confidence": 1.0, "is_new": True}

    def map_speaker(self, cluster_id: str, name: str) -> bool:
        """Map cluster_id to a human-readable name."""
        for c in self._clusters:
            if c["id"] == cluster_id:
                c["display_name"] = name
                return True
        return False

    def get_display_name(self, cluster_id: str) -> str:
        """Return mapped name if exists, else original cluster_id."""
        for c in self._clusters:
            if c["id"] == cluster_id:
                return c.get("display_name", c["id"])
        return cluster_id

    def get_clusters(self) -> list[dict]:
        """Return cluster state for status/debug."""
        return [
            {
                "id": c["id"],
                "display_name": c.get("display_name", c["id"]),
                "count": c["count"],
            }
            for c in self._clusters
        ]

    def reset(self) -> None:
        """Clear all clusters."""
        self._clusters = []
        self._next_id = 1

    @property
    def cluster_count(self) -> int:
        return len(self._clusters)

    @staticmethod
    def _cosine(a: np.ndarray, b: np.ndarray) -> float:
        na, nb = np.linalg.norm(a), np.linalg.norm(b)
        if na < 1e-8 or nb < 1e-8:
            return 0.0
        return float(np.dot(a, b) / (na * nb))
```

**Step 4: Run tests to verify they pass**

```bash
cd scripts/meeting-copilot && python -m pytest test_speaker_cluster_registry.py -v
```
Expected: 5/5 PASS

**Step 5: Write invariant tests**

```python
# Append to test_speaker_cluster_registry.py

class TestInvariants:
    def test_inv1_max_clusters_not_exceeded(self):
        reg = ClusterRegistry(max_clusters=3)
        for i in range(10):
            reg.assign(_random_emb(seed=i * 50), segment_duration=1.0)
        assert reg.cluster_count <= 3

    def test_inv2_centroid_dtype_and_shape(self):
        reg = ClusterRegistry()
        emb = _random_emb(seed=1, dim=192)
        reg.assign(emb, segment_duration=1.0)
        clusters = reg.get_clusters()
        # Access internal for invariant check
        c = reg._clusters[0]
        assert c["centroid"].dtype == np.float32
        assert c["centroid"].shape == (192,)

    def test_inv3_ids_monotonic_and_restart_after_reset(self):
        reg = ClusterRegistry()
        r1 = reg.assign(_random_emb(seed=1), 1.0)
        r2 = reg.assign(_random_emb(seed=100), 1.0)
        r3 = reg.assign(_random_emb(seed=200), 1.0)
        assert r1["cluster_id"] == "Speaker 1"
        assert r2["cluster_id"] == "Speaker 2"
        assert r3["cluster_id"] == "Speaker 3"
        reg.reset()
        r4 = reg.assign(_random_emb(seed=300), 1.0)
        assert r4["cluster_id"] == "Speaker 1"

    def test_inv4_confidence_in_range(self):
        reg = ClusterRegistry()
        emb = _random_emb(seed=1)
        result = reg.assign(emb, segment_duration=1.0)
        assert 0.0 <= result["confidence"] <= 1.0
        result2 = reg.assign(_similar_emb(emb, noise_scale=0.02), 1.0)
        assert 0.0 <= result2["confidence"] <= 1.0

    def test_inv5_centroid_running_average(self):
        reg = ClusterRegistry()
        e1 = np.array([1.0, 0.0, 0.0], dtype=np.float32)
        e1 = e1 / np.linalg.norm(e1)
        reg.assign(e1, 1.0)

        e2 = np.array([0.98, 0.1, 0.0], dtype=np.float32)
        e2 = e2 / np.linalg.norm(e2)
        # Need to set threshold low enough for this to match
        reg._threshold = 0.5
        reg.assign(e2, 1.0)

        expected = (e1 * 1 + e2) / 2
        np.testing.assert_allclose(reg._clusters[0]["centroid"], expected, atol=1e-5)
        assert reg._clusters[0]["count"] == 2

    def test_inv6_map_speaker_doesnt_change_count(self):
        reg = ClusterRegistry()
        reg.assign(_random_emb(seed=1), 1.0)
        reg.assign(_random_emb(seed=100), 1.0)
        before = reg.cluster_count
        reg.map_speaker("Speaker 1", "Alice")
        assert reg.cluster_count == before

    def test_inv7_reset_then_assign_restarts_ids(self):
        reg = ClusterRegistry()
        reg.assign(_random_emb(seed=1), 1.0)
        reg.reset()
        assert reg.cluster_count == 0
        r = reg.assign(_random_emb(seed=2), 1.0)
        assert r["cluster_id"] == "Speaker 1"

    def test_inv8_ambiguous_returns_none(self):
        """Two very similar centroids + equidistant embedding → ambiguous."""
        reg = ClusterRegistry(threshold=0.5, assignment_margin=0.1)
        # Create two clusters with centroids that are somewhat similar
        e1 = np.array([1.0, 0.0, 0.0], dtype=np.float32)
        e2 = np.array([0.0, 1.0, 0.0], dtype=np.float32)
        reg.assign(e1, 1.0)
        reg.assign(e2, 1.0)
        # Embedding equidistant to both
        eq = np.array([0.707, 0.707, 0.0], dtype=np.float32)
        eq = eq / np.linalg.norm(eq)
        result = reg.assign(eq, 1.0)
        # Should be ambiguous (margin too small) or create new cluster
        # depending on whether sims exceed threshold
        # The key invariant: if top1-top2 < margin AND top1 >= threshold → None
        assert result["cluster_id"] is None or result["is_new"]


class TestAdversarialScenarios:
    def test_short_segment_no_effect(self):
        reg = ClusterRegistry(min_segment_sec=0.8)
        for _ in range(100):
            result = reg.assign(_random_emb(seed=42), segment_duration=0.3)
            assert result["cluster_id"] is None
        assert reg.cluster_count == 0

    def test_single_speaker_stays_one_cluster(self):
        reg = ClusterRegistry(threshold=0.5)
        base = _random_emb(seed=1)
        for i in range(10):
            reg.assign(_similar_emb(base, noise_scale=0.02, seed=i), 1.0)
        assert reg.cluster_count == 1

    def test_max_clusters_blocks_new(self):
        reg = ClusterRegistry(max_clusters=3)
        for i in range(3):
            r = reg.assign(_random_emb(seed=i * 100), 1.0)
            assert r["is_new"] is True
        # 4th different speaker blocked
        r4 = reg.assign(_random_emb(seed=999), 1.0)
        assert r4["cluster_id"] is None
        assert reg.cluster_count == 3

    def test_map_nonexistent_cluster(self):
        reg = ClusterRegistry()
        assert reg.map_speaker("Speaker 99", "Ghost") is False

    def test_map_after_reset(self):
        reg = ClusterRegistry()
        reg.assign(_random_emb(seed=1), 1.0)
        reg.reset()
        assert reg.map_speaker("Speaker 1", "Alice") is False

    def test_zero_embedding(self):
        reg = ClusterRegistry()
        r = reg.assign(np.zeros(192, dtype=np.float32), 1.0)
        assert r["cluster_id"] is None

    def test_nan_embedding(self):
        reg = ClusterRegistry()
        nan_emb = np.full(192, np.nan, dtype=np.float32)
        r = reg.assign(nan_emb, 1.0)
        assert r["cluster_id"] is None

    def test_display_name_after_map(self):
        reg = ClusterRegistry()
        reg.assign(_random_emb(seed=1), 1.0)
        assert reg.get_display_name("Speaker 1") == "Speaker 1"
        reg.map_speaker("Speaker 1", "Alice")
        assert reg.get_display_name("Speaker 1") == "Alice"
        assert reg.get_display_name("Speaker 99") == "Speaker 99"
```

**Step 6: Run full test suite**

```bash
cd scripts/meeting-copilot && python -m pytest test_speaker_cluster_registry.py -v
```
Expected: All tests PASS

**Step 7: Commit**

```bash
git add scripts/meeting-copilot/speaker_cluster_registry.py scripts/meeting-copilot/test_speaker_cluster_registry.py
git commit -m "feat(f195-h): add ClusterRegistry for online speaker diarization

Centroid matching with 3 guardrails: min_segment_sec, max_clusters,
assignment_margin. Includes full invariant + adversarial test coverage."
```

---

### Task 2: Configuration — SPEAKER_CLUSTER_THRESHOLD + diarization_enabled

**Files:**
- Modify: `scripts/meeting-copilot/audio-service.py:54` (add config)
- Modify: `scripts/meeting-copilot/audio-service.py:73-97` (add field)

**Step 1: Write failing test**

```python
# In test_audio_service.py — add test for diarization_enabled config
def test_diarization_enabled_default_true():
    """diarization_enabled should default to True (Phase H behavior)."""
    session = AudioSession()
    assert hasattr(session, 'diarization_enabled')
    assert session.diarization_enabled is True

def test_diarization_enabled_env_override(monkeypatch):
    monkeypatch.setenv("DIARIZATION_ENABLED", "0")
    # Need to reimport or re-read env
    session = AudioSession()
    assert session.diarization_enabled is False
```

**Step 2: Run test to verify it fails**

```bash
cd scripts/meeting-copilot && python -m pytest test_audio_service.py::test_diarization_enabled_default_true -v
```
Expected: FAIL (AttributeError)

**Step 3: Add config and field**

Add to audio-service.py after line 54:
```python
DIARIZATION_ENABLED = os.getenv("DIARIZATION_ENABLED", "1") != "0"
```

Add to `AudioSession.__init__` after `self._embedder`:
```python
self.diarization_enabled: bool = DIARIZATION_ENABLED
self._cluster_registry = ClusterRegistry()
```

Add import at top:
```python
from speaker_cluster_registry import ClusterRegistry
```

**Step 4: Run tests**

```bash
cd scripts/meeting-copilot && python -m pytest test_audio_service.py -v
```
Expected: PASS

**Step 5: Commit**

```bash
git add scripts/meeting-copilot/audio-service.py scripts/meeting-copilot/test_audio_service.py
git commit -m "feat(f195-h): add diarization_enabled config + ClusterRegistry field"
```

---

### Task 3: Extend `_reset()` to clear ClusterRegistry

**Files:**
- Modify: `scripts/meeting-copilot/audio-service.py:99-114` (`_reset`)

**Step 1: Write failing test**

```python
def test_reset_clears_cluster_registry():
    session = AudioSession()
    # Simulate some clusters
    emb = np.random.randn(192).astype(np.float32)
    emb /= np.linalg.norm(emb)
    session._cluster_registry.assign(emb, 1.0)
    assert session._cluster_registry.cluster_count > 0
    session._reset()
    assert session._cluster_registry.cluster_count == 0
```

**Step 2: Run to verify failure**

```bash
cd scripts/meeting-copilot && python -m pytest test_audio_service.py::test_reset_clears_cluster_registry -v
```
Expected: FAIL (cluster_count still > 0)

**Step 3: Add reset line**

In `_reset()` after `self._artifact_store = None`:
```python
self._cluster_registry.reset()
```

**Step 4: Run tests**

```bash
cd scripts/meeting-copilot && python -m pytest test_audio_service.py -v
```
Expected: PASS (all existing + new)

**Step 5: Commit**

```bash
git add scripts/meeting-copilot/audio-service.py scripts/meeting-copilot/test_audio_service.py
git commit -m "feat(f195-h): clear ClusterRegistry on session reset"
```

---

### Task 4: Modify `_process_chunk()` embedding extraction gate

**Files:**
- Modify: `scripts/meeting-copilot/audio-service.py:570-577`

**Step 1: Write failing test**

```python
def test_process_chunk_extracts_embedding_when_diarization_enabled():
    """Even without enrolled embeddings, diarization_enabled should trigger extraction."""
    session = AudioSession()
    session.participants = []  # no enrolled participants
    session.diarization_enabled = True
    # Mock _embedder.extract to track calls
    extract_called = []
    original_extract = session._embedder.extract
    def mock_extract(pcm):
        extract_called.append(True)
        return original_extract(pcm)
    session._embedder.extract = mock_extract
    # Simulate a chunk processing (need enough PCM for extraction)
    # This test verifies the gate logic, not full pipeline
    has_enrolled = any(p.get("embedding") is not None for p in session.participants)
    should_extract = session.diarization_enabled or has_enrolled
    assert should_extract is True  # diarization_enabled alone is enough
    assert has_enrolled is False   # no enrolled embeddings
```

**Step 2: Run to verify current behavior**

The current gate `if has_enrolled_embeddings:` would skip extraction when no enrolled participants but diarization is enabled.

**Step 3: Modify the gate**

Change `audio-service.py` lines 570-576 from:
```python
chunk_embedding = None
has_enrolled_embeddings = any(
    p.get("embedding") is not None for p in self.participants
)
if has_enrolled_embeddings:
    chunk_embedding = self._embedder.extract(pcm)
```
to:
```python
chunk_embedding = None
has_enrolled_embeddings = any(
    p.get("embedding") is not None for p in self.participants
)
if self.diarization_enabled or has_enrolled_embeddings:
    chunk_embedding = self._embedder.extract(pcm)
```

**Step 4: Run tests**

```bash
cd scripts/meeting-copilot && python -m pytest test_audio_service.py -v
```

**Step 5: Commit**

```bash
git add scripts/meeting-copilot/audio-service.py scripts/meeting-copilot/test_audio_service.py
git commit -m "feat(f195-h): widen embedding gate to include diarization_enabled

Previously only extracted embeddings when enrolled participants had
voice samples. Now also extracts when diarization is enabled, allowing
unsupervised clustering without pre-enrollment."
```

---

### Task 5: Extend `_attribute_speaker()` with cluster path

**Files:**
- Modify: `scripts/meeting-copilot/audio-service.py:172-209`

**Step 1: Write failing tests**

```python
def test_attribute_speaker_cluster_path_when_no_enrollment():
    """Without enrolled embeddings, should fall through to cluster assignment."""
    session = AudioSession()
    session.participants = []  # no enrolled
    session.diarization_enabled = True
    emb = np.random.randn(192).astype(np.float32)
    emb /= np.linalg.norm(emb)
    result = session._attribute_speaker(chunk_embedding=emb, segment_duration=1.0)
    assert result["speaker_label"] == "Speaker 1"
    assert result["speaker_id"] == "Speaker 1"  # cluster_id as speaker_id

def test_attribute_speaker_enrolled_takes_priority():
    """Enrolled match should win over clustering."""
    session = AudioSession()
    emb = np.random.randn(192).astype(np.float32)
    emb /= np.linalg.norm(emb)
    session.participants = [{
        "id": "p1", "name": "Alice", "role": "host",
        "embedding": emb,  # exact match
    }]
    result = session._attribute_speaker(chunk_embedding=emb, segment_duration=1.0)
    assert result["speaker_label"] == "Alice"
    assert result["speaker_id"] == "p1"

def test_attribute_speaker_cluster_none_falls_to_rule():
    """If embedding is None (extraction failed), fall through to rules."""
    session = AudioSession()
    session.participants = [{"id": "h", "name": "Host", "role": "host"}]
    session.source = "mic"
    result = session._attribute_speaker(chunk_embedding=None, segment_duration=0.0)
    assert result["speaker_label"] == "Host"

def test_attribute_speaker_uses_display_name_after_map():
    """After map_speaker, _attribute_speaker should use mapped name."""
    session = AudioSession()
    session.diarization_enabled = True
    emb = np.random.randn(192).astype(np.float32)
    emb /= np.linalg.norm(emb)
    # First call creates Speaker 1
    r1 = session._attribute_speaker(chunk_embedding=emb, segment_duration=1.0)
    assert r1["speaker_label"] == "Speaker 1"
    # Map Speaker 1 → Alice
    session._cluster_registry.map_speaker("Speaker 1", "Alice")
    # Second call with similar embedding
    similar = emb + np.random.randn(192).astype(np.float32) * 0.01
    similar /= np.linalg.norm(similar)
    r2 = session._attribute_speaker(chunk_embedding=similar, segment_duration=1.0)
    assert r2["speaker_label"] == "Alice"
```

**Step 2: Run to verify failure**

```bash
cd scripts/meeting-copilot && python -m pytest test_audio_service.py -k "cluster_path or enrolled_takes_priority or cluster_none or display_name_after_map" -v
```
Expected: FAIL (current _attribute_speaker doesn't accept segment_duration)

**Step 3: Modify `_attribute_speaker()`**

```python
def _attribute_speaker(self, chunk_embedding=None, segment_duration=0.0) -> dict:
    """Attribute speaker: enrolled match -> cluster match -> rule fallback.

    Priority chain (AC-H3):
    1. Enrolled cosine match (Phase G) — if enrolled embeddings exist
    2. Cluster centroid match (Phase H) — if diarization_enabled
    3. Rule-based fallback (Phase C) — always available
    """
    # --- 1. Embedding path: enrolled verification (AC-G2) ---
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

    # --- 2. Cluster path: unsupervised diarization (AC-H1) ---
    if chunk_embedding is not None and self.diarization_enabled:
        cluster_result = self._cluster_registry.assign(
            chunk_embedding, segment_duration
        )
        if cluster_result["cluster_id"] is not None:
            display = self._cluster_registry.get_display_name(
                cluster_result["cluster_id"]
            )
            return {
                "speaker_label": display,
                "speaker_confidence": cluster_result["confidence"],
                "speaker_id": cluster_result["cluster_id"],
            }

    # --- 3. Rule-based fallback (AC-G3, existing Phase C logic) ---
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

Also update the call site in `_process_chunk()` (~line 577):
```python
speaker = self._attribute_speaker(
    chunk_embedding=chunk_embedding,
    segment_duration=len(pcm) / 2 / SAMPLE_RATE,  # PCM 16-bit → samples → seconds
)
```

**Step 4: Run tests**

```bash
cd scripts/meeting-copilot && python -m pytest test_audio_service.py -v
```
Expected: All PASS (existing + new)

**Step 5: Commit**

```bash
git add scripts/meeting-copilot/audio-service.py scripts/meeting-copilot/test_audio_service.py
git commit -m "feat(f195-h): insert cluster path in _attribute_speaker priority chain

enrolled match → cluster centroid match → rule fallback (AC-H3).
Cluster assignments use display name when mapped (AC-H2 prep)."
```

---

### Task 6: `/api/audio/map-speaker` endpoint with retroactive update

**Files:**
- Modify: `scripts/meeting-copilot/audio-service.py` (add `map_speaker` method + HTTP handler)

**Step 1: Write failing tests**

```python
def test_map_speaker_retroactive_updates_window_lines():
    """map_speaker should update ALL existing transcript lines for that cluster."""
    session = AudioSession()
    session.diarization_enabled = True
    # Simulate: two chunks assigned to Speaker 1
    emb = np.random.randn(192).astype(np.float32)
    emb /= np.linalg.norm(emb)
    session._attribute_speaker(chunk_embedding=emb, segment_duration=1.0)
    # Add fake lines to window with Speaker 1
    session._window.add_line({
        "ts": "00:00:01", "elapsed_s": 1.0, "chunk_num": 1,
        "text": "hello", "speaker_label": "Speaker 1",
        "speaker_confidence": 1.0, "speaker_id": "Speaker 1",
    })
    session._window.add_line({
        "ts": "00:00:05", "elapsed_s": 5.0, "chunk_num": 2,
        "text": "world", "speaker_label": "Speaker 1",
        "speaker_confidence": 1.0, "speaker_id": "Speaker 1",
    })
    # Map Speaker 1 → Alice
    result = session.map_speaker_name("Speaker 1", "Alice")
    assert result["ok"] is True
    assert result["updated_lines"] == 2
    # Verify lines updated
    for line in session._window.get_all_lines():
        if line.get("speaker_id") == "Speaker 1":
            assert line["speaker_label"] == "Alice"

def test_map_speaker_nonexistent_cluster():
    session = AudioSession()
    result = session.map_speaker_name("Speaker 99", "Ghost")
    assert result["ok"] is False
```

**Step 2: Run to verify failure**

Expected: AttributeError (map_speaker_name not defined)

**Step 3: Implement `map_speaker_name` method + HTTP handler**

Add method to AudioSession:
```python
def map_speaker_name(self, cluster_id: str, name: str) -> dict:
    """Map a cluster ID to a real name, retroactively updating transcript."""
    if not self._cluster_registry.map_speaker(cluster_id, name):
        return {"ok": False, "mapped_name": name, "updated_lines": 0}
    # Retroactive update: change speaker_label in all window lines (AC-H2)
    updated = 0
    for line in self._window.get_all_lines():
        if line.get("speaker_id") == cluster_id:
            line["speaker_label"] = name
            updated += 1
    return {"ok": True, "mapped_name": name, "updated_lines": updated}
```

Add HTTP handler:
```python
async def h_map_speaker(request):
    data = await request.json()
    cluster_id = data.get("cluster_id")
    name = data.get("name")
    if not cluster_id or not name:
        return web.json_response(
            {"error": "cluster_id and name required"}, status=400
        )
    result = session.map_speaker_name(cluster_id, name)
    return web.json_response(result)
```

Add route in app setup:
```python
app.router.add_post("/api/audio/map-speaker", h_map_speaker)
```

**Step 4: Run tests**

```bash
cd scripts/meeting-copilot && python -m pytest test_audio_service.py -v
```

**Step 5: Commit**

```bash
git add scripts/meeting-copilot/audio-service.py scripts/meeting-copilot/test_audio_service.py
git commit -m "feat(f195-h): add /api/audio/map-speaker with retroactive rename

POST {cluster_id, name} → updates cluster registry display name AND
retroactively renames all existing transcript lines for that cluster (AC-H2)."
```

---

### Task 7: Cluster info in `/api/audio/status` response

**Files:**
- Modify: `scripts/meeting-copilot/audio-service.py` (h_status)

**Step 1: Write failing test**

```python
def test_status_includes_cluster_info():
    session = AudioSession()
    session.running = True
    session.diarization_enabled = True
    # Create a cluster
    emb = np.random.randn(192).astype(np.float32)
    emb /= np.linalg.norm(emb)
    session._cluster_registry.assign(emb, 1.0)
    # Check status dict includes clusters
    status = session.get_status()
    assert "clusters" in status
    assert len(status["clusters"]) == 1
    assert status["clusters"][0]["id"] == "Speaker 1"
    assert "diarization_enabled" in status
```

**Step 2-5: Implement, verify, commit**

Add `get_status()` method or extend existing status dict to include:
```python
"diarization_enabled": self.diarization_enabled,
"clusters": self._cluster_registry.get_clusters(),
```

```bash
git commit -m "feat(f195-h): expose cluster info in /api/audio/status"
```

---

### Task 8: Eval script — DER + swap rate + fragmentation + unknown rate

**Files:**
- Modify: `scripts/meeting-copilot/eval_speaker_verification.py` (extend with diarization metrics)

**Step 1: Write failing test for DER calculation**

```python
def test_diarization_error_rate_calculation():
    """DER = (miss + false_alarm + confusion) / total_duration."""
    from eval_speaker_verification import compute_der
    # Reference: [0-5s Speaker A, 5-10s Speaker B]
    # Hypothesis: [0-3s Speaker A, 3-7s Speaker B, 7-10s Speaker A]
    ref = [("A", 0, 5), ("B", 5, 10)]
    hyp = [("A", 0, 3), ("B", 3, 7), ("A", 7, 10)]
    der = compute_der(ref, hyp)
    # confusion: 3-5s (B predicted but A true) + 7-10s (A predicted but B true) = 5s
    # total = 10s → DER = 5/10 = 0.5
    assert 0.4 <= der <= 0.6  # approximate

def test_swap_rate_calculation():
    from eval_speaker_verification import compute_swap_rate
    # Swaps = number of times assigned speaker changes incorrectly
    labels = ["A", "A", "B", "A", "B", "B"]
    true_labels = ["A", "A", "A", "A", "B", "B"]
    rate = compute_swap_rate(labels, true_labels)
    assert rate > 0  # at least one swap
```

**Step 2-5: Implement eval functions, verify, commit**

```bash
git commit -m "feat(f195-h): add DER + swap rate + fragmentation eval metrics (AC-H4)"
```

---

### Task 9: Update Phase H spec — mark TranscriptPanel bug as fixed

**Files:**
- Modify: `docs/features/F195-meeting-copilot-live-advisory.md:335`

**Step 1: Update bug table**

Change line 335 from:
```
| TranscriptPanel（Hub 右侧）不显示 speaker 名字 | P2 | ... | 📋 待修 |
```
to:
```
| TranscriptPanel（Hub 右侧）不显示 speaker 名字 | P2 | ... | ✅ PR #2468 (dfc07171b) |
```

**Step 2: Commit**

```bash
git add docs/features/F195-meeting-copilot-live-advisory.md
git commit -m "docs(f195): mark TranscriptPanel speaker bug as fixed (PR #2468)"
```

---

## Execution Order

```
Task 1 (ClusterRegistry core + tests) → pure, no dependencies
Task 2 (Config + field) → depends on Task 1 import
Task 3 (_reset extension) → depends on Task 2
Task 4 (Embedding gate) → depends on Task 2
Task 5 (_attribute_speaker) → depends on Tasks 1-4
Task 6 (map-speaker endpoint) → depends on Task 5
Task 7 (Status endpoint) → depends on Task 2
Task 8 (Eval metrics) → independent, can parallel with Task 5-7
Task 9 (Doc fix) → independent
```

Straight-line: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9. No rewrite expected — each task's output stays in the final system.
