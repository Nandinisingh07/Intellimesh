import os
from pathlib import Path
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # Base paths
    BASE_DIR: Path = Path(__file__).resolve().parent.parent
    DATA_DIR: Path = BASE_DIR / "data"
    MODELS_DIR: Path = BASE_DIR / "backend" / "models"
    UPLOAD_DIR: Path = DATA_DIR / "uploaded_files"
    CHROMA_DB_DIR: Path = DATA_DIR / "chroma_db"
    SAMPLE_DOCS_DIR: Path = DATA_DIR / "sample_docs"

    # Ensure directories exist
    def create_dirs(self) -> None:
        self.DATA_DIR.mkdir(parents=True, exist_ok=True)
        self.MODELS_DIR.mkdir(parents=True, exist_ok=True)
        (self.MODELS_DIR / "llm").mkdir(parents=True, exist_ok=True)
        (self.MODELS_DIR / "whisper").mkdir(parents=True, exist_ok=True)
        (self.MODELS_DIR / "embeddings").mkdir(parents=True, exist_ok=True)
        (self.MODELS_DIR / "blip").mkdir(parents=True, exist_ok=True)
        self.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
        self.CHROMA_DB_DIR.mkdir(parents=True, exist_ok=True)
        self.SAMPLE_DOCS_DIR.mkdir(parents=True, exist_ok=True)

    # Embedding model settings
    EMBEDDING_MODEL_NAME: str = "sentence-transformers/all-MiniLM-L6-v2"
    
    # LLM Settings
    LLM_MODEL_NAME: str = "phi-2.Q4_K_M.gguf"  # Using phi-2 as default due to size/RAM considerations, can be Mistral-7B
    LLM_REPO_ID: str = "TheBloke/phi-2-GGUF"
    LLM_CONTEXT_LENGTH: int = 2048
    
    # Image Captioning
    BLIP_MODEL_NAME: str = "Salesforce/blip-image-captioning-base"
    
    # Whisper settings
    WHISPER_MODEL_SIZE: str = "base"
    
    # Chunking config
    CHUNK_SIZE: int = 512
    CHUNK_OVERLAP: int = 64
    
    # RAG Settings
    SIMILARITY_THRESHOLD: float = 0.3
    TOP_K: int = 5
    
    # External Tools
    GEMINI_API_KEY: str = ""
    ANTHROPIC_API_KEY: str = ""
    TESSERACT_CMD: str = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
    # TESSDATA_PREFIX is set internally or via env variable if needed
    
    class Config:
        env_file = ".env"

settings = Settings()
settings.create_dirs()

