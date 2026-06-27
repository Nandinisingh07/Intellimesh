from fastapi import APIRouter, Request
from backend.core.generator import get_generator
from backend.core.retriever import get_retriever
from backend.core.embedder import get_embedder
from pydantic import BaseModel
from loguru import logger

router = APIRouter()
_query_log: list[dict] = []   # in-memory, resets on restart

class QueryRequest(BaseModel):
    query: str
    top_k: int = 5
    user_clearance: str = "UNCLASSIFIED"
    user_id: str = "anonymous"

@router.post("/api/query")
async def query(request: QueryRequest, http_request: Request):
    import time
    from backend.retrieval.unified import unified_retrieve
    
    start = time.time()
    generator = get_generator()
    
    # Run cross-modal unified retrieval
    results = unified_retrieve(request.query, user_clearance=request.user_clearance, top_k=request.top_k)
    
    # Store chunk IDs in request state for the audit logging middleware
    http_request.state.audit_chunk_ids = [r["id"] for r in results]
    
    # Log the query and its top citations for the graph
    _query_log.append({
        "query": request.query,
        "citations": [
            {"chunk_id": r["id"], "score": r["score"], "filename": r["metadata"].get("filename", "unknown")}
            for r in results[:5]
        ]
    })
    if len(_query_log) > 20:
        _query_log.pop(0)

    # Hallucination Guard: if max score < threshold
    import os
    env_thresh = os.environ.get("HALLUCINATION_THRESHOLD")
    threshold_val = float(env_thresh) * 100.0 if env_thresh is not None else 30.0
    if not results or max(r["score"] for r in results) < threshold_val:
        answer = "I could not find relevant information in the indexed documents for this query."
        sources = []
    else:
        chunks = [r["document"] for r in results]
        result = generator.generate(request.query, chunks)
        answer = result["answer"]
        sources = results
        
    latency_ms = int((time.time() - start) * 1000)
    return {
        "answer": answer,
        "sources": sources,
        "latency_ms": latency_ms
    }
