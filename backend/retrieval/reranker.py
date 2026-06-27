import os
import sys
import numpy as np
from pathlib import Path
from loguru import logger

# Add project root to sys.path
project_root = Path(__file__).resolve().parent.parent.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

from backend.config import settings

class LocalReranker:
    def __init__(self):
        self.model = None
        self.enabled = False
        
        reranker_path = settings.MODELS_DIR / "reranker"
        if reranker_path.exists():
            try:
                from sentence_transformers import CrossEncoder
                logger.info(f"Loading Cross-Encoder reranker from {reranker_path}...")
                self.model = CrossEncoder(str(reranker_path.resolve()), local_files_only=True)
                self.enabled = True
                logger.info("Cross-Encoder reranker loaded successfully.")
            except Exception as e:
                logger.warning(f"Failed to load Cross-Encoder reranker from disk: {e}. Running with graceful fallback (disabled).")
        else:
            logger.warning(f"Cross-Encoder reranker path {reranker_path} does not exist. Running with graceful fallback (disabled).")

    def score_pairs(self, query: str, docs: list[str]) -> list[float]:
        if not self.enabled or not self.model or not docs:
            return [0.0] * len(docs)
            
        try:
            pairs = [[query, doc] for doc in docs]
            scores = self.model.predict(pairs)
            # Convert numpy types to float
            return [float(s) for s in scores]
        except Exception as e:
            logger.error(f"Error during reranking prediction: {e}")
            return [0.0] * len(docs)

    def rerank(self, query: str, candidates: list[dict]) -> list[dict]:
        if not candidates:
            return []
            
        if not self.enabled or not self.model:
            logger.info("Reranker not enabled. Skipping reranking (graceful fallback).")
            return candidates
            
        docs = [item["document"] for item in candidates]
        scores = self.score_pairs(query, docs)
        
        # Merge scores back to candidates and sort
        for item, score in zip(candidates, scores):
            if "metadata" not in item:
                item["metadata"] = {}
            # Keep original RRF/retrieval score in metadata
            item["metadata"]["original_score"] = item["score"]
            # Map logit score to a percentage-like confidence score using sigmoid
            sigmoid_score = 1.0 / (1.0 + np.exp(-score))
            item["score"] = round(sigmoid_score * 100, 1)
            
        # Sort by new score descending
        reranked = sorted(candidates, key=lambda x: x["score"], reverse=True)
        logger.info("Successfully reranked candidates using Cross-Encoder.")
        return reranked

_reranker = None

def get_reranker() -> LocalReranker:
    global _reranker
    if _reranker is None:
        _reranker = LocalReranker()
    return _reranker

if __name__ == "__main__":
    print("Running Reranker smoke test...")
    reranker = get_reranker()
    cands = [
        {"id": "1", "document": "The speed of light is 299,792 km/s.", "metadata": {}, "score": 10.0},
        {"id": "2", "document": "Cats sleep for 12-16 hours a day on average.", "metadata": {}, "score": 9.0}
    ]
    res = reranker.rerank("How long do cats sleep?", cands)
    print("Reranked results:")
    for r in res:
        print(f"ID: {r['id']}, Score: {r['score']}, Doc: {r['document']}")
    print("Reranker smoke test PASSED!")
