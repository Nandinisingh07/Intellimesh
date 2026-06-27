from fastapi import APIRouter
from backend.core.vector_store import get_vector_store
from loguru import logger

router = APIRouter()

@router.get("/api/documents")
async def list_documents():
    store = get_vector_store()
    metadatas = store.get_all_metadata()
    seen = {}
    chunk_counts = {}
    for m in metadatas:
        fid = m.get("file_id")
        if fid:
            chunk_counts[fid] = chunk_counts.get(fid, 0) + 1
            if fid not in seen:
                seen[fid] = m
    
    docs = []
    for fid, m in seen.items():
        doc_copy = dict(m)
        doc_copy["chunk_count"] = chunk_counts[fid]
        docs.append(doc_copy)
    return {"documents": docs, "total_chunks": store.count()}

@router.delete("/api/documents/{file_id}")
async def delete_document(file_id: str):
    store = get_vector_store()
    store.delete_by_file_id(file_id)
    return {"status": "deleted", "file_id": file_id}
