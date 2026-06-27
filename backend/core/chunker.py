from langchain_text_splitters import RecursiveCharacterTextSplitter
from loguru import logger

class LocalChunker:
    def __init__(self, chunk_size: int = 512, chunk_overlap: int = 64):
        self.splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap
        )
        logger.info("Chunker initialized")

    def split(self, text: str) -> list[str]:
        chunks = self.splitter.split_text(text)
        logger.info(f"Split text into {len(chunks)} chunks")
        return chunks

_chunker = None

def get_chunker() -> LocalChunker:
    global _chunker
    if _chunker is None:
        _chunker = LocalChunker()
    return _chunker
