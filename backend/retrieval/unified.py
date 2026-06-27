import os
import sys
from pathlib import Path
from loguru import logger

# Add project root to sys.path
project_root = Path(__file__).resolve().parent.parent.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

from backend.config import settings

class LocalCLIPEmbedder:
    _model = None
    _processor = None

    @classmethod
    def get_clip(cls):
        if cls._model is None or cls._processor is None:
            clip_path = settings.MODELS_DIR / "clip"
            if clip_path.exists():
                try:
                    from transformers import CLIPProcessor, CLIPModel
                    logger.info("Loading CLIP model from disk...")
                    cls._model = CLIPModel.from_pretrained(str(clip_path.resolve()), local_files_only=True)
                    cls._processor = CLIPProcessor.from_pretrained(str(clip_path.resolve()), local_files_only=True)
                    logger.info("CLIP model loaded successfully.")
                except Exception as e:
                    logger.error(f"Failed to load CLIP model: {e}")
            else:
                logger.warning(f"CLIP model path {clip_path} does not exist.")
        return cls._model, cls._processor

    def encode_query(self, query: str) -> list[float]:
        model, processor = self.get_clip()
        if model is None or processor is None:
            return []
        try:
            import torch
            inputs = processor(text=[query], return_tensors="pt", padding=True)
            with torch.no_grad():
                text_features = model.get_text_features(**inputs)
            
            # Extract tensor from output container if needed
            if not hasattr(text_features, "norm"):
                if hasattr(text_features, "text_embeds"):
                    text_features = text_features.text_embeds
                elif hasattr(text_features, "pooler_output"):
                    text_features = text_features.pooler_output
                elif hasattr(text_features, "last_hidden_state"):
                    text_features = text_features.last_hidden_state
            
            # Normalize embedding
            text_features = text_features / text_features.norm(dim=-1, keepdim=True)
            return text_features[0].cpu().numpy().tolist()
        except Exception as e:
            logger.error(f"CLIP text encoding failed: {e}")
            return []

    def encode_image(self, pil_image) -> list[float]:
        model, processor = self.get_clip()
        if model is None or processor is None:
            return []
        try:
            import torch
            inputs = processor(images=pil_image, return_tensors="pt")
            with torch.no_grad():
                image_features = model.get_image_features(**inputs)
            
            # Extract tensor from output container if needed
            if not hasattr(image_features, "norm"):
                if hasattr(image_features, "image_embeds"):
                    image_features = image_features.image_embeds
                elif hasattr(image_features, "pooler_output"):
                    image_features = image_features.pooler_output
                elif hasattr(image_features, "last_hidden_state"):
                    image_features = image_features.last_hidden_state
            
            # Normalize embedding
            image_features = image_features / image_features.norm(dim=-1, keepdim=True)
            return image_features[0].cpu().numpy().tolist()
        except Exception as e:
            logger.error(f"CLIP image encoding failed: {e}")
            return []

def unified_retrieve(query: str, user_clearance: str = "UNCLASSIFIED", top_k: int = 5) -> list[dict]:
    # 1. Prepare dense query embedding
    from backend.core.embedder import get_embedder
    embedder = get_embedder()
    query_dense_embedding = embedder.encode(query)
    
    # 2. Setup clearance filter
    from backend.retrieval.bm25_index import CLEARANCE_HIERARCHY
    allowed_levels = CLEARANCE_HIERARCHY.get(user_clearance, ["UNCLASSIFIED"])
    where_filter = {"clearance_level": {"$in": allowed_levels}}
    
    # 3. Query dense retrieval (docs collection)
    from backend.core.vector_store import get_vector_store
    store = get_vector_store()
    
    dense_results = []
    try:
        # Pull up to 20 candidates for rank fusion
        results = store.collection.query(
            query_embeddings=[query_dense_embedding],
            n_results=20,
            where=where_filter,
            include=["documents", "metadatas", "distances", "embeddings"]
        )
        
        docs = results.get("documents", [[]])[0]
        metas = results.get("metadatas", [[]])[0]
        distances = results.get("distances", [[]])[0]
        ids = results.get("ids", [[]])[0]
        embs = results.get("embeddings", [[]])[0]
        
        for doc, meta, dist, chunk_id, emb in zip(docs, metas, distances, ids, embs):
            lvl = meta.get("clearance_level", "UNCLASSIFIED")
            if lvl in allowed_levels:
                score = round((1 - dist) * 100, 1)
                dense_results.append({
                    "id": chunk_id,
                    "document": doc,
                    "metadata": meta,
                    "score": score,
                    "embedding": emb
                })
    except Exception as e:
        logger.error(f"Dense query failed: {e}")

    # 4. Query sparse retrieval (BM25)
    from backend.retrieval.bm25_index import get_bm25_index_manager
    bm25_manager = get_bm25_index_manager()
    sparse_results = bm25_manager.search(query, user_clearance=user_clearance, n_results=20)
    
    # 5. Query image retrieval (CLIP)
    image_results = []
    try:
        clip_embedder = LocalCLIPEmbedder()
        query_clip_embedding = clip_embedder.encode_query(query)
        if query_clip_embedding:
            images_coll = store.client.get_or_create_collection("intellimesh_images")
            img_query_res = images_coll.query(
                query_embeddings=[query_clip_embedding],
                n_results=20,
                where=where_filter,
                include=["documents", "metadatas", "distances"]
            )
            
            img_docs = img_query_res.get("documents", [[]])[0]
            img_metas = img_query_res.get("metadatas", [[]])[0]
            img_distances = img_query_res.get("distances", [[]])[0]
            img_ids = img_query_res.get("ids", [[]])[0]
            
            for doc, meta, dist, chunk_id in zip(img_docs, img_metas, img_distances, img_ids):
                lvl = meta.get("clearance_level", "UNCLASSIFIED")
                if lvl in allowed_levels:
                    # chroma Cosine distance: score = (1 - dist) * 100
                    score = round((1 - dist) * 100, 1)
                    image_results.append({
                        "id": chunk_id,
                        "document": doc,
                        "metadata": meta,
                        "score": score,
                        "embedding": meta.get("dense_embedding")
                    })
    except Exception as e:
        logger.error(f"Image query failed: {e}")

    # 6. Reciprocal Rank Fusion (RRF)
    from backend.retrieval.rrf import reciprocal_rank_fusion
    fused_results = reciprocal_rank_fusion([dense_results, sparse_results, image_results])
    
    # 7. Cross-Encoder Re-ranking
    from backend.retrieval.reranker import get_reranker
    reranker = get_reranker()
    reranked_candidates = reranker.rerank(query, fused_results[:20])
    
    # 8. MMR diversity selection on the top fused/reranked candidates
    from backend.retrieval.rrf import run_mmr
    import os
    env_lambda = os.environ.get("MMR_LAMBDA")
    curr_lambda = float(env_lambda) if env_lambda is not None else 0.5
    final_results = run_mmr(query_dense_embedding, reranked_candidates, top_k=top_k, lambda_param=curr_lambda)
    
    # 9. Format outputs with prefixing based on modality
    for item in final_results:
        meta = item.get("metadata", {})
        modality = meta.get("modality", "text").lower()
        
        prefix = "[TEXT]"
        if "audio" in modality:
            prefix = "[AUDIO]"
        elif "image" in modality:
            prefix = "[IMAGE]"
            
        item["document"] = f"{prefix} {item['document']}"
        
    return final_results

if __name__ == "__main__":
    print("Running Unified Retriever smoke test...")
    # Mock retrieval test
    res = unified_retrieve("Is there any test document?", "CONFIDENTIAL", 2)
    print(f"Retrieved: {len(res)} items")
    for r in res:
        print(f"ID: {r['id']}, Doc: {r['document']}")
    print("Unified Retriever smoke test PASSED!")
