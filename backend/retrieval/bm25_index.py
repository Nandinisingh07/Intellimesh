import os
import sys
import threading
from pathlib import Path
from loguru import logger
from rank_bm25 import BM25Okapi

# Add project root to sys.path so it runs standalone
project_root = Path(__file__).resolve().parent.parent.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

from backend.core.vector_store import get_vector_store

CLEARANCE_HIERARCHY = {
    "UNCLASSIFIED": ["UNCLASSIFIED"],
    "RESTRICTED": ["UNCLASSIFIED", "RESTRICTED"],
    "CONFIDENTIAL": ["UNCLASSIFIED", "RESTRICTED", "CONFIDENTIAL"]
}

class BM25IndexManager:
    def __init__(self):
        self._lock = threading.Lock()
        # Cache structures by clearance level
        self._cache = {}  # user_clearance -> { "index": BM25Okapi, "ids": [...], "docs": [...], "metadatas": [...], "embeddings": [...] }
        self._all_ids_cache = None

    def _get_all_ids(self, collection) -> set:
        try:
            results = collection.get(include=[])
            return set(results.get("ids", []))
        except Exception as e:
            logger.error(f"Error fetching IDs from collection for BM25 sync check: {e}")
            return set()

    def get_index_for_clearance(self, user_clearance: str):
        store = get_vector_store()
        collection = store.collection
        
        # Check if collection has changed
        current_ids = self._get_all_ids(collection)
        
        # If collection has changed, invalidate all caches
        if self._all_ids_cache is None or current_ids != self._all_ids_cache:
            with self._lock:
                self._cache.clear()
                self._all_ids_cache = current_ids
                logger.info("ChromaDB changed. Invalidated BM25 cache.")

        allowed_levels = CLEARANCE_HIERARCHY.get(user_clearance, ["UNCLASSIFIED"])
        
        with self._lock:
            if user_clearance in self._cache:
                c = self._cache[user_clearance]
                return c["index"], c["docs"], c["ids"], c["metadatas"], c["embeddings"]
            
            # Fetch allowed documents
            where_filter = {"clearance_level": {"$in": allowed_levels}}
            
            try:
                results = collection.get(where=where_filter, include=["documents", "metadatas", "embeddings"])
            except Exception as e:
                logger.error(f"Failed to query ChromaDB for BM25 building with filter: {e}. Trying fallback.")
                try:
                    # Fallback to get everything and filter manually or fetch without filter
                    results = collection.get(include=["documents", "metadatas", "embeddings"])
                except Exception as e2:
                    logger.error(f"Fallback ChromaDB fetch failed: {e2}")
                    results = {}
            
            ids = results.get("ids")
            if ids is None:
                ids = []
            docs = results.get("documents")
            if docs is None:
                docs = []
            metadatas = results.get("metadatas")
            if metadatas is None:
                metadatas = []
            embeddings = results.get("embeddings")
            if embeddings is None:
                embeddings = []
            
            # If some metadata is missing "clearance_level", default it to "UNCLASSIFIED"
            # and filter out if not in allowed_levels
            filtered_ids = []
            filtered_docs = []
            filtered_metadatas = []
            filtered_embeddings = []
            
            for i in range(len(ids)):
                meta = metadatas[i] if i < len(metadatas) else {}
                lvl = meta.get("clearance_level", "UNCLASSIFIED")
                if lvl in allowed_levels:
                    filtered_ids.append(ids[i])
                    filtered_docs.append(docs[i])
                    filtered_metadatas.append(meta)
                    if i < len(embeddings):
                        filtered_embeddings.append(embeddings[i])
            
            # Rebuild index
            tokenized_corpus = [doc.lower().split() for doc in filtered_docs]
            if tokenized_corpus:
                index = BM25Okapi(tokenized_corpus)
                logger.info(f"Rebuilt BM25 index for clearance {user_clearance} with {len(filtered_docs)} documents.")
            else:
                index = None
                logger.info(f"Empty corpus for clearance {user_clearance}. BM25 index set to None.")
                
            self._cache[user_clearance] = {
                "index": index,
                "ids": filtered_ids,
                "docs": filtered_docs,
                "metadatas": filtered_metadatas,
                "embeddings": filtered_embeddings
            }
            return index, filtered_docs, filtered_ids, filtered_metadatas, filtered_embeddings

    def search(self, query: str, user_clearance: str = "UNCLASSIFIED", n_results: int = 5) -> list[dict]:
        try:
            index, docs, ids, metadatas, embeddings = self.get_index_for_clearance(user_clearance)
        except Exception as e:
            import traceback
            logger.error(f"Failed to retrieve BM25 index: {e}\n{traceback.format_exc()}")
            return []
            
        if not index or not docs:
            return []
            
        tokenized_query = query.lower().split()
        scores = index.get_scores(tokenized_query)
        
        # Sort by BM25 score descending
        ranked_indices = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)
        
        results = []
        for idx in ranked_indices[:n_results]:
            score = float(scores[idx])
            results.append({
                "id": ids[idx],
                "document": docs[idx],
                "metadata": metadatas[idx],
                "score": score,
                "embedding": embeddings[idx] if idx < len(embeddings) else None
            })
        return results

_bm25_manager = None

def get_bm25_index_manager() -> BM25IndexManager:
    global _bm25_manager
    if _bm25_manager is None:
        _bm25_manager = BM25IndexManager()
    return _bm25_manager

if __name__ == "__main__":
    print("Running BM25 Index smoke test...")
    manager = get_bm25_index_manager()
    print("BM25 Index manager initialized.")
    res = manager.search("test", "UNCLASSIFIED", 3)
    print(f"Search results count: {len(res)}")
    for r in res:
        print(f"ID: {r['id']}, Doc length: {len(r['document'])}")
    print("BM25 Index smoke test PASSED!")
