import os
import sys
from pathlib import Path
from loguru import logger

# Add project root to sys.path
project_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(project_root))

from backend.core.embedder import get_embedder
from backend.core.vector_store import get_vector_store

def test_embed_and_store():
    logger.info("Starting Core RAG Verification Test...")
    
    # 1. Initialize Embedder and Vector Store
    try:
        embedder = get_embedder()
        vector_store = get_vector_store()
    except Exception as e:
        logger.error(f"Failed to initialize core RAG modules: {e}")
        logger.warning("Make sure the backend packages are fully installed and sentence-transformers is loaded.")
        return

    # 2. Embed a sample string
    test_string = "Project IntelliMesh is an air-gapped secure document intelligence platform running 100% offline."
    logger.info(f"Test input string: '{test_string}'")
    
    try:
        embedding = embedder.encode(test_string)
        logger.info(f"Successfully generated embedding vector. Dimensions: {len(embedding)}")
    except Exception as e:
        logger.error(f"Failed to generate embedding: {e}")
        return

    # 3. Store the embedded chunk in ChromaDB
    file_id = "test_verification_doc"
    chunk_metadata = {
        "file_id": file_id,
        "filename": "verification_test.txt",
        "modality": "Text",
        "page": 1,
        "timestamp": 1717757000.0
    }
    
    logger.info("Storing chunk in ChromaDB collection...")
    try:
        ids = vector_store.add_documents(
            chunks=[test_string],
            embeddings=[embedding],
            metadatas=[chunk_metadata]
        )
        logger.info(f"Chunk added successfully. Record ID: {ids[0]}")
    except Exception as e:
        logger.error(f"Failed to store document in ChromaDB: {e}")
        return

    # 4. Query ChromaDB to retrieve stored string
    query_string = "Tell me about air-gapped IntelliMesh"
    logger.info(f"Querying vector store for: '{query_string}'")
    try:
        query_embedding = embedder.encode(query_string)
        results = vector_store.query(query_embedding, n_results=1)
        
        retrieved_docs = results.get("documents", [[]])[0]
        retrieved_metas = results.get("metadatas", [[]])[0]
        
        if retrieved_docs:
            logger.info("🎯 Core RAG verification SUCCESS!")
            logger.info(f"Retrieved Document: '{retrieved_docs[0]}'")
            logger.info(f"Retrieved Metadata: {retrieved_metas[0]}")
        else:
            logger.error("No documents returned from query search.")
    except Exception as e:
        logger.error(f"Failed to query ChromaDB: {e}")

    # 5. Clean up test record
    logger.info("Cleaning up test records from ChromaDB...")
    try:
        vector_store.delete_by_file_id(file_id)
        logger.info("Cleanup successful.")
    except Exception as e:
        logger.error(f"Failed to delete test records: {e}")

if __name__ == "__main__":
    test_embed_and_store()

