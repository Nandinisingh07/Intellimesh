from sentence_transformers import SentenceTransformer
import numpy as np
from loguru import logger

class LocalEmbedder:
    def __init__(self):
        logger.info("Loading embedding model...")
        self.model = SentenceTransformer("all-MiniLM-L6-v2")
        logger.info("Embedding model loaded")

    def encode(self, text: str) -> list[float]:
        embedding = self.model.encode(text, normalize_embeddings=True)
        return embedding.tolist()

    def encode_batch(self, texts: list[str]) -> list[list[float]]:
        embeddings = self.model.encode(texts, normalize_embeddings=True)
        return embeddings.tolist()

_embedder = None

def get_embedder() -> LocalEmbedder:
    global _embedder
    if _embedder is None:
        _embedder = LocalEmbedder()
    return _embedder
