import os
import sys
import numpy as np
from loguru import logger
from pathlib import Path

# Add project root to sys.path
project_root = Path(__file__).resolve().parent.parent.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

def reciprocal_rank_fusion(lists: list[list[dict]], k: int = 60) -> list[dict]:
    """
    Perform Reciprocal Rank Fusion (RRF) on multiple ranked lists of dicts.
    Each dict must have an 'id', 'document', 'metadata', 'score', and optionally 'embedding'.
    Returns a unified list of dicts ranked by RRF score descending.
    """
    rrf_scores = {}
    doc_registry = {}
    
    for list_idx, rank_list in enumerate(lists):
        for rank, item in enumerate(rank_list):
            doc_id = item["id"]
            if doc_id not in doc_registry:
                doc_registry[doc_id] = item
            
            # RRF formula: 1 / (k + rank) where rank is 1-indexed (hence rank + 1)
            score = 1.0 / (k + (rank + 1))
            rrf_scores[doc_id] = rrf_scores.get(doc_id, 0.0) + score
            
    # Sort documents by their combined RRF score descending
    sorted_ids = sorted(rrf_scores.keys(), key=lambda x: rrf_scores[x], reverse=True)
    
    fused_results = []
    for doc_id in sorted_ids:
        item = doc_registry[doc_id].copy()
        # Scale the score to 0-100 range for consistency with UI score display
        # The maximum possible RRF score with 3 lists is 3 * (1 / (60 + 1)) ≈ 0.049
        # Let's keep the raw RRF score or represent it out of 100 based on its proportion
        item["score"] = round(rrf_scores[doc_id] * 1000, 1)  # Scale to be a nice number (e.g. 0-100)
        fused_results.append(item)
        
    return fused_results

def run_mmr(query_embedding: list[float], candidates: list[dict], top_k: int = 5, lambda_param: float = 0.5) -> list[dict]:
    """
    Maximal Marginal Relevance reranking to ensure query relevance and result diversity.
    """
    if not candidates:
        return []
        
    # Get embeddings for candidates. If missing, generate using the local embedder.
    candidate_embeddings = []
    from backend.core.embedder import get_embedder
    embedder = get_embedder()
    
    for item in candidates:
        emb = item.get("embedding")
        if emb is None:
            # Check metadata for cached dense_embedding (from image collections)
            meta = item.get("metadata", {})
            if "dense_embedding" in meta:
                emb = meta["dense_embedding"]
            else:
                # Embed on the fly
                emb = embedder.encode(item["document"])
                item["embedding"] = emb
        candidate_embeddings.append(emb)
        
    # Normalize query embedding
    q = np.array(query_embedding)
    q_norm = np.linalg.norm(q)
    if q_norm > 0:
        q = q / q_norm
        
    # Normalize candidate embeddings
    embs = []
    for emb in candidate_embeddings:
        emb_arr = np.array(emb)
        emb_norm = np.linalg.norm(emb_arr)
        if emb_norm > 0:
            emb_arr = emb_arr / emb_norm
        embs.append(emb_arr)
        
    selected_indices = []
    n = len(candidates)
    
    # Calculate similarities with query
    query_sims = [float(np.dot(emb, q)) for emb in embs]
    
    # Precompute pairwise document similarity matrix
    sim_matrix = np.zeros((n, n))
    for i in range(n):
        for j in range(i, n):
            sim = float(np.dot(embs[i], embs[j]))
            sim_matrix[i, j] = sim
            sim_matrix[j, i] = sim
            
    while len(selected_indices) < min(top_k, n):
        best_score = -float('inf')
        best_idx = -1
        
        for idx in range(n):
            if idx in selected_indices:
                continue
                
            sim_q = query_sims[idx]
            if not selected_indices:
                score = sim_q
            else:
                max_sim_selected = max(sim_matrix[idx, s_idx] for s_idx in selected_indices)
                score = lambda_param * sim_q - (1 - lambda_param) * max_sim_selected
                
            if score > best_score:
                best_score = score
                best_idx = idx
                
        if best_idx == -1:
            break
        selected_indices.append(best_idx)
        
    # Clean up temporal embeddings to avoid bloat in response
    results = []
    for idx in selected_indices:
        item = candidates[idx].copy()
        if "embedding" in item:
            del item["embedding"]
        results.append(item)
        
    return results

if __name__ == "__main__":
    print("Running RRF/MMR smoke test...")
    # Mock data
    q_emb = [0.1] * 384
    cand1 = {"id": "1", "document": "Hello world", "metadata": {"filename": "test.txt"}, "score": 90.0, "embedding": [0.1] * 384}
    cand2 = {"id": "2", "document": "Hello world", "metadata": {"filename": "test.txt"}, "score": 85.0, "embedding": [0.1] * 384}
    cand3 = {"id": "3", "document": "Completely different text", "metadata": {"filename": "other.txt"}, "score": 80.0, "embedding": [-0.1] * 384}
    
    # Test RRF
    list1 = [cand1, cand2]
    list2 = [cand2, cand3]
    fused = reciprocal_rank_fusion([list1, list2])
    print(f"Fused length: {len(fused)}")
    for f in fused:
        print(f"ID: {f['id']}, Score: {f['score']}")
        
    # Test MMR
    mmr_res = run_mmr(q_emb, fused, top_k=2, lambda_param=0.5)
    print(f"MMR selected length: {len(mmr_res)}")
    for m in mmr_res:
        print(f"ID: {m['id']}, Document: {m['document']}")
    print("RRF/MMR smoke test PASSED!")
