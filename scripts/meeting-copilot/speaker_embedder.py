"""Speaker embedding extraction using 3D-Speaker CAM++ model.

Wraps modelscope/3D-Speaker for real-time speaker verification.
Lazy-loads model on first extract() call to avoid startup cost when
speaker verification is not used.
"""

import logging

import numpy as np

logger = logging.getLogger(__name__)

SAMPLE_RATE = 16000
MIN_DURATION_SEC = 0.5  # Below this, embedding quality is unreliable


class SpeakerEmbedder:
    """Extract speaker embeddings and compute cosine similarity.

    Model is lazy-loaded on first ``extract()`` call. If the model fails
    to load (missing dependency, bad model_id), ``extract()`` returns None
    and the caller falls back to rule-based attribution.
    """

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
            from modelscope.pipelines import pipeline  # type: ignore[import-untyped]

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
            result = self._pipeline({"audio": audio, "sample_rate": sample_rate})
            embedding = np.array(result["spk_embedding"], dtype=np.float32)
            return embedding
        except Exception as e:
            logger.warning("Embedding extraction failed: %s", e)
            return None

    def similarity(self, emb_a: np.ndarray, emb_b: np.ndarray) -> float:
        """Cosine similarity between two embeddings. Range [-1, 1]."""
        norm_a = np.linalg.norm(emb_a)
        norm_b = np.linalg.norm(emb_b)
        if norm_a < 1e-8 or norm_b < 1e-8:
            return 0.0
        return float(np.dot(emb_a, emb_b) / (norm_a * norm_b))
