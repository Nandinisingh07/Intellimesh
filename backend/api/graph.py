from fastapi import APIRouter
import networkx as nx
import numpy as np
from loguru import logger
from backend.core.vector_store import get_vector_store
from backend.core.embedder import get_embedder
from backend.api.query import _query_log

router = APIRouter()

def _build_graph() -> nx.DiGraph:
    G = nx.DiGraph()
    store = get_vector_store()
    collection = store.collection
    results = collection.get(include=["metadatas", "documents", "embeddings"])

    ids = results.get("ids", [])
    metadatas = results.get("metadatas", [])
    documents = results.get("documents", [])
    embeddings = results.get("embeddings", [])

    doc_chunks = {}
    doc_embeddings = {}

    # Group chunks and embeddings by parent document filename
    for i, (chunk_id, meta, doc) in enumerate(zip(ids, metadatas, documents)):
        fname = meta.get("filename", "unknown")
        if fname not in doc_chunks:
            doc_chunks[fname] = []
            doc_embeddings[fname] = []
        doc_chunks[fname].append((chunk_id, doc, meta))

        emb = None
        if embeddings is not None and len(embeddings) > 0 and i < len(embeddings) and embeddings[i] is not None:
            emb = embeddings[i]
        else:
            try:
                embedder = get_embedder()
                emb = embedder.encode(doc)
            except Exception as e:
                logger.error(f"Failed to embed chunk on the fly: {e}")

        if emb is not None:
            doc_embeddings[fname].append(emb)

    # Compute document-level average embedding
    doc_avg_embeddings = {}
    for fname, embs in doc_embeddings.items():
        if embs:
            avg_emb = np.mean(embs, axis=0)
            norm = np.linalg.norm(avg_emb)
            if norm > 0:
                avg_emb = avg_emb / norm
            doc_avg_embeddings[fname] = avg_emb

    doc_seen = {}
    doc_count = 0
    chunk_count = 0

    # Add Document and Chunk nodes
    for fname, chunks in doc_chunks.items():
        doc_id = f"doc_{len(doc_seen)}"
        doc_seen[fname] = doc_id
        modality = chunks[0][2].get("modality", "text") if chunks else "text"
        is_media = modality in ("image", "audio")

        # Document node
        G.add_node(
            doc_id,
            type="doc",
            label=fname,
            detail=f"{modality.upper()} · {collection.count()} chunks",
            isMedia=is_media,
            x=100 + (doc_count % 5) * 120,
            y=80 + (doc_count // 5) * 140
        )
        doc_count += 1

        # Chunk nodes and provenance edges
        for chunk_id, doc_text, meta in chunks:
            snippet = doc_text[:80].replace("\n", " ") + ("…" if len(doc_text) > 80 else "")
            G.add_node(
                chunk_id,
                type="chunk",
                label=snippet,
                detail=snippet,
                x=150 + (chunk_count % 6) * 90,
                y=200 + (chunk_count // 6) * 100
            )
            chunk_count += 1
            G.add_edge(chunk_id, doc_id, weight=1.0, relationship="PROVENANCE")

    # Add Document-Document Similarity edges
    doc_names = list(doc_avg_embeddings.keys())
    for idx1 in range(len(doc_names)):
        for idx2 in range(idx1 + 1, len(doc_names)):
            d1 = doc_names[idx1]
            d2 = doc_names[idx2]
            emb1 = doc_avg_embeddings[d1]
            emb2 = doc_avg_embeddings[d2]
            sim = float(np.dot(emb1, emb2))
            if sim > 0.5:
                id1 = doc_seen[d1]
                id2 = doc_seen[d2]
                G.add_edge(id1, id2, weight=sim, relationship="SIMILARITY")
                G.add_edge(id2, id1, weight=sim, relationship="SIMILARITY")

    # Add Query nodes and Citation edges
    for i, q in enumerate(_query_log[-10:]):
        qid = f"q_{i}"
        G.add_node(
            qid,
            type="query",
            label=q["query"][:40],
            detail=f"{len(q['citations'])} citations",
            x=300 + i * 80,
            y=40
        )
        for c in q["citations"]:
            chunk_id = c["chunk_id"]
            if G.has_node(chunk_id):
                raw_score = c["score"]
                weight = round(raw_score / 100.0, 3) if raw_score > 1.0 else round(raw_score, 3)
                G.add_edge(qid, chunk_id, weight=weight, relationship="CITATION")

    return G

@router.get("/api/graph")
async def get_knowledge_graph():
    """
    Returns nodes and edges for the knowledge graph visualizer.
    Nodes: documents, chunks (top 50 by recency), queries (last 20 from session).
    Edges: chunk→document (provenance), query→chunk (citation, with score).
    """
    G = _build_graph()
    
    try:
        centralities = nx.pagerank(G, weight="weight")
    except Exception as e:
        logger.warning(f"PageRank failed: {e}. Fallback to degree centrality.")
        try:
            centralities = nx.degree_centrality(G)
        except Exception:
            centralities = {n: 0.0 for n in G.nodes}

    nodes = []
    edges = []

    for node_id, attrs in G.nodes(data=True):
        node_dict = {
            "id": node_id,
            "type": attrs["type"],
            "label": attrs["label"],
            "detail": attrs.get("detail", ""),
            "centrality": round(centralities.get(node_id, 0.0), 5),
            "x": attrs.get("x", 150),
            "y": attrs.get("y", 150)
        }
        if attrs.get("type") == "doc":
            node_dict["isMedia"] = attrs.get("isMedia", False)
        nodes.append(node_dict)

    for u, v, attrs in G.edges(data=True):
        edges.append({
            "from": u,
            "to": v,
            "weight": attrs.get("weight", 1.0),
            "relationship": attrs.get("relationship", "RELATED_TO")
        })

    return {"nodes": nodes[:60], "edges": edges[:120]}

@router.get("/api/graph/related/{document_id}")
async def get_related_documents(document_id: str, top_n: int = 5):
    """
    Returns the top-N most similar documents to the given document_id (or document label/filename)
    using actual graph traversal of similarity edges in the NetworkX graph.
    """
    G = _build_graph()
    
    target_node = None
    if G.has_node(document_id):
        target_node = document_id
    else:
        for node_id, attrs in G.nodes(data=True):
            if attrs.get("type") == "doc" and attrs.get("label") == document_id:
                target_node = node_id
                break

    if not target_node:
        return {"error": f"Document '{document_id}' not found in the knowledge graph.", "related": []}

    related = []
    if G.has_node(target_node):
        for neighbor in G.neighbors(target_node):
            edge_data = G.get_edge_data(target_node, neighbor)
            if edge_data and edge_data.get("relationship") == "SIMILARITY":
                neighbor_attrs = G.nodes[neighbor]
                related.append({
                    "document_id": neighbor,
                    "filename": neighbor_attrs.get("label"),
                    "similarity": edge_data["weight"],
                    "detail": neighbor_attrs.get("detail", "")
                })

    related = sorted(related, key=lambda x: x["similarity"], reverse=True)
    return {
        "target_document": G.nodes[target_node].get("label"),
        "target_id": target_node,
        "related": related[:top_n]
    }
