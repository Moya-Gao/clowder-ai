"""Online incremental speaker clustering using centroid matching.

F195 Phase H: unsupervised speaker diarization without pre-enrollment.
Lifecycle owner: AudioSession (created on start, cleared on _reset).
Each meeting session gets a fresh ClusterRegistry.
"""

import logging
import os

import numpy as np

logger = logging.getLogger(__name__)

SPEAKER_CLUSTER_THRESHOLD = float(os.getenv("SPEAKER_CLUSTER_THRESHOLD", "0.65"))
MAX_CLUSTERS = int(os.getenv("MAX_SPEAKER_CLUSTERS", "8"))
MIN_SEGMENT_SEC = 0.8
ASSIGNMENT_MARGIN = 0.08


class ClusterRegistry:
    """Online incremental speaker clustering using centroid matching.

    Assigns each audio segment to an existing speaker cluster or creates
    a new one. Clusters are identified as "Speaker 1", "Speaker 2", etc.
    Users can later map cluster IDs to real names via ``map_speaker()``.

    Three guardrails:
    - ``min_segment_sec``: segments shorter than this are skipped
    - ``max_clusters``: hard cap on number of concurrent speakers
    - ``assignment_margin``: ambiguous assignments (top1-top2 < margin) return None
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
        self._next_id = 1

    def assign(self, embedding: np.ndarray, segment_duration: float) -> dict:
        """Assign embedding to existing cluster or create new one.

        Returns:
            dict with keys:
            - cluster_id: str or None (None if skipped/ambiguous/full)
            - confidence: float in [0, 1]
            - is_new: bool (True if a new cluster was created)
        """
        # Guard: segment too short
        if segment_duration < self._min_segment_sec:
            return {"cluster_id": None, "confidence": 0.0, "is_new": False}

        # Guard: zero-norm or NaN embedding
        norm = np.linalg.norm(embedding)
        if norm < 1e-8 or np.isnan(norm):
            return {"cluster_id": None, "confidence": 0.0, "is_new": False}

        # First embedding ever → create first cluster
        if not self._clusters:
            return self._create_cluster(embedding)

        # Compute cosine similarities to all centroids
        sims = []
        for c in self._clusters:
            sim = self._cosine(embedding, c["centroid"])
            sims.append(sim)

        sorted_sims = sorted(enumerate(sims), key=lambda x: x[1], reverse=True)
        best_idx, best_sim = sorted_sims[0]

        # Ambiguity check: if top-1 and top-2 are too close, reject
        if len(sorted_sims) >= 2:
            _, second_sim = sorted_sims[1]
            if (
                best_sim - second_sim < self._assignment_margin
                and best_sim >= self._threshold
            ):
                return {"cluster_id": None, "confidence": 0.0, "is_new": False}

        # Match: update centroid via running average
        if best_sim >= self._threshold:
            c = self._clusters[best_idx]
            c["centroid"] = (c["centroid"] * c["count"] + embedding) / (c["count"] + 1)
            c["count"] += 1
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
        """Create a new cluster with the given embedding as its centroid."""
        cluster_id = f"Speaker {self._next_id}"
        self._next_id += 1
        self._clusters.append(
            {
                "id": cluster_id,
                "centroid": embedding.copy(),
                "count": 1,
            }
        )
        return {"cluster_id": cluster_id, "confidence": 1.0, "is_new": True}

    def map_speaker(self, cluster_id: str, name: str) -> bool:
        """Map a cluster_id (e.g. 'Speaker 1') to a human-readable name.

        Does NOT update transcript lines — the caller (AudioSession) must
        do the retroactive update across TranscriptWindow lines.

        Returns True if cluster found, False otherwise.
        """
        for c in self._clusters:
            if c["id"] == cluster_id:
                c["display_name"] = name
                return True
        return False

    def get_display_name(self, cluster_id: str) -> str:
        """Return mapped name if exists, else the original cluster_id."""
        for c in self._clusters:
            if c["id"] == cluster_id:
                return c.get("display_name", c["id"])
        return cluster_id

    def get_clusters(self) -> list[dict]:
        """Return cluster state snapshot (for /api/audio/status)."""
        return [
            {
                "id": c["id"],
                "display_name": c.get("display_name", c["id"]),
                "count": c["count"],
            }
            for c in self._clusters
        ]

    def reset(self) -> None:
        """Clear all clusters. Called by AudioSession._reset()."""
        self._clusters = []
        self._next_id = 1

    @property
    def cluster_count(self) -> int:
        """Number of active clusters."""
        return len(self._clusters)

    @staticmethod
    def _cosine(a: np.ndarray, b: np.ndarray) -> float:
        """Cosine similarity between two vectors. Range [-1, 1]."""
        na, nb = np.linalg.norm(a), np.linalg.norm(b)
        if na < 1e-8 or nb < 1e-8:
            return 0.0
        return float(np.dot(a, b) / (na * nb))
