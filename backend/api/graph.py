from fastapi import APIRouter
from backend.core.vector_store import get_vector_store
from backend.api.query import _query_log

router = APIRouter()

@router.get("/api/graph")
async def get_knowledge_graph():
    """
    Returns nodes and edges for the knowledge graph visualizer.
    Nodes: documents, chunks (top 50 by recency), queries (last 20 from session).
    Edges: chunk→document (provenance), query→chunk (citation, with score).
    """
    store = get_vector_store()
    collection = store.collection

    results = collection.get(include=["metadatas", "documents"])
    nodes = []
    edges = []
    doc_seen = {}

    # 1. Add Query nodes and edges to citations
    for i, q in enumerate(_query_log[-10:]):
        qid = f"q_{i}"
        nodes.append({
            "id": qid,
            "type": "query",
            "label": q["query"][:40],
            "detail": f"{len(q['citations'])} citations",
            "x": 300 + i * 80,
            "y": 40
        })
        for c in q["citations"]:
            # Convert percentage score (e.g. 85.0) to range [0, 1] for visualizer
            raw_score = c["score"]
            weight = round(raw_score / 100.0, 3) if raw_score > 1.0 else round(raw_score, 3)
            edges.append({"from": qid, "to": c["chunk_id"], "weight": weight})

    # 2. Add Chunk and Document nodes
    for i, (chunk_id, meta, doc) in enumerate(zip(
        results["ids"], results["metadatas"], results["documents"]
    )):
        fname = meta.get("filename", "unknown")
        modality = meta.get("modality", "text")
        is_media = modality in ("image", "audio")

        # Document node (deduplicate)
        if fname not in doc_seen:
            doc_seen[fname] = f"doc_{len(doc_seen)}"
            nodes.append({
                "id": doc_seen[fname],
                "type": "doc",
                "label": fname,
                "detail": f"{modality.upper()} · {collection.count()} chunks",
                "isMedia": is_media,
                "x": 100 + (len(doc_seen) % 5) * 120,
                "y": 80 + (len(doc_seen) // 5) * 140,
            })

        # Chunk node (using the database chunk_id to align with query citations)
        cnode_id = chunk_id
        snippet = doc[:80].replace("\n", " ") + ("…" if len(doc) > 80 else "")
        nodes.append({
            "id": cnode_id,
            "type": "chunk",
            "label": snippet,
            "detail": snippet,
            "x": 150 + (i % 6) * 90,
            "y": 200 + (i // 6) * 100,
        })
        edges.append({"from": cnode_id, "to": doc_seen[fname], "weight": 1.0})

    return {"nodes": nodes[:60], "edges": edges[:120]}
