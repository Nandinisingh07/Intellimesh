import chromadb
from loguru import logger
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "data", "chroma_db")

class VectorStore:
    def __init__(self):
        os.makedirs(DB_PATH, exist_ok=True)
        self.client = chromadb.PersistentClient(path=os.path.abspath(DB_PATH))
        self.collection = self.client.get_or_create_collection("intellimesh_docs")
        logger.info("VectorStore initialized")

    def add_documents(self, chunks: list[str], embeddings: list[list[float]], metadatas: list[dict], ids: list[str]):
        self.collection.add(documents=chunks, embeddings=embeddings, metadatas=metadatas, ids=ids)
        logger.info(f"Added {len(chunks)} chunks to vector store")

    def query(self, embedding: list[float], n_results: int = 5) -> dict:
        return self.collection.query(query_embeddings=[embedding], n_results=n_results)

    def delete_by_file_id(self, file_id: str):
        results = self.collection.get(where={"file_id": file_id})
        if results["ids"]:
            self.collection.delete(ids=results["ids"])
            logger.info(f"Deleted {len(results['ids'])} chunks for file_id {file_id}")

    def get_all_metadata(self) -> list[dict]:
        results = self.collection.get()
        return results.get("metadatas", [])

    def count(self) -> int:
        return self.collection.count()

_store = None

def get_vector_store() -> VectorStore:
    global _store
    if _store is None:
        _store = VectorStore()
    return _store
