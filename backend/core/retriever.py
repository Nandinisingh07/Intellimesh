from backend.core.vector_store import get_vector_store
from loguru import logger

class Retriever:
    def retrieve(self, embedding: list[float], n_results: int = 5) -> list[dict]:
        store = get_vector_store()
        results = store.query(embedding, n_results=n_results)
        output = []
        docs = results.get("documents", [[]])[0]
        metas = results.get("metadatas", [[]])[0]
        distances = results.get("distances", [[]])[0]
        ids = results.get("ids", [[]])[0]
        for doc, meta, dist, chunk_id in zip(docs, metas, distances, ids):
            score = round((1 - dist) * 100, 1)
            output.append({"id": chunk_id, "document": doc, "metadata": meta, "score": score})
        return output

_retriever = None

def get_retriever() -> Retriever:
    global _retriever
    if _retriever is None:
        _retriever = Retriever()
    return _retriever
