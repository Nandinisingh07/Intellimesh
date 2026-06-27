import os
import sys
from pathlib import Path
from loguru import logger
from transformers import BlipProcessor, BlipForConditionalGeneration
import whisper, os

print("Downloading BLIP...")
blip_cache = "backend/models/blip"
os.makedirs(blip_cache, exist_ok=True)
BlipProcessor.from_pretrained("Salesforce/blip-image-captioning-base", cache_dir=blip_cache)
BlipForConditionalGeneration.from_pretrained("Salesforce/blip-image-captioning-base", cache_dir=blip_cache)
print("BLIP done.")

print("Downloading Whisper...")
whisper_cache = "backend/models/whisper"
os.makedirs(whisper_cache, exist_ok=True)
whisper.load_model("base", download_root=whisper_cache)
print("Whisper done.")

print("All models cached. System is now fully offline.")

# Add project root to sys.path so we can import backend config
project_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(project_root))

from backend.config import settings

def download_llm():
    logger.info("=========================================")
    logger.info("STAGE 1: Downloading local LLM GGUF model...")
    logger.info("=========================================")
    try:
        from huggingface_hub import hf_hub_download
        
        target_dir = settings.MODELS_DIR / "llm"
        target_dir.mkdir(parents=True, exist_ok=True)
        
        logger.info(f"Downloading {settings.LLM_MODEL_NAME} from repo {settings.LLM_REPO_ID}...")
        file_path = hf_hub_download(
            repo_id=settings.LLM_REPO_ID,
            filename=settings.LLM_MODEL_NAME,
            local_dir=str(target_dir),
            local_dir_use_symlinks=False
        )
        logger.info(f"LLM model successfully downloaded and stored at: {file_path}")
    except Exception as e:
        logger.error(f"Failed to download LLM GGUF model: {e}")
        raise e

def download_embeddings():
    logger.info("=========================================")
    logger.info("STAGE 2: Downloading Sentence-Transformers embeddings...")
    logger.info("=========================================")
    try:
        from sentence_transformers import SentenceTransformer
        logger.info(f"Downloading and caching model: {settings.EMBEDDING_MODEL_NAME}")
        
        # Load the model to force download and caching
        _ = SentenceTransformer(
            settings.EMBEDDING_MODEL_NAME,
            cache_folder=str(settings.MODELS_DIR / "embeddings")
        )
        logger.info("Embeddings model successfully cached.")
    except Exception as e:
        logger.error(f"Failed to download Embeddings model: {e}")
        raise e

def download_blip():
    logger.info("=========================================")
    logger.info("STAGE 3: Downloading BLIP image captioning model weights...")
    logger.info("=========================================")
    try:
        from transformers import BlipProcessor, BlipForConditionalGeneration
        logger.info(f"Downloading and caching BLIP model: {settings.BLIP_MODEL_NAME}")
        
        cache_dir = str(settings.MODELS_DIR / "blip")
        _ = BlipProcessor.from_pretrained(settings.BLIP_MODEL_NAME, cache_dir=cache_dir)
        _ = BlipForConditionalGeneration.from_pretrained(settings.BLIP_MODEL_NAME, cache_dir=cache_dir)
        logger.info("BLIP image captioning model successfully cached.")
    except Exception as e:
        logger.error(f"Failed to download BLIP model weights: {e}")
        raise e

def download_whisper():
    logger.info("=========================================")
    logger.info("STAGE 4: Downloading Whisper speech transcription weights...")
    logger.info("=========================================")
    try:
        import whisper
        logger.info(f"Downloading and caching Whisper size: '{settings.WHISPER_MODEL_SIZE}'")
        
        _ = whisper.load_model(
            settings.WHISPER_MODEL_SIZE,
            download_root=str(settings.MODELS_DIR / "whisper")
        )
        logger.info("Whisper model weights successfully cached.")
    except Exception as e:
        logger.error(f"Failed to download Whisper model: {e}")
        raise e

def main():
    logger.info("Starting model downloader script...")
    settings.create_dirs()
    
    download_llm()
    download_embeddings()
    download_blip()
    download_whisper()
    
    logger.info("=========================================")
    logger.info("ALL MODELS DOWNLOADED AND LOADED OFFLINE!")
    logger.info("=========================================")

if __name__ == "__main__":
    main()

