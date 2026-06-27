import os
import whisper
from typing import List, Dict, Any
from loguru import logger
from backend.config import settings

class AudioProcessor:
    _whisper_model = None

    def __init__(self) -> None:
        pass

    @classmethod
    def _get_whisper(cls):
        """
        Lazy loader for Whisper model to save memory until audio transcription is needed.
        """
        if cls._whisper_model is None:
            logger.info(f"Loading Whisper model (size: {settings.WHISPER_MODEL_SIZE}) from disk...")
            download_dir = str(settings.MODELS_DIR / "whisper")
            cls._whisper_model = whisper.load_model(
                settings.WHISPER_MODEL_SIZE,
                device="cpu",  # CPU for local compatibility, can be customized to cuda if GPU is present
                download_root=download_dir
            )
            logger.info("Whisper model loaded successfully.")
        return cls._whisper_model

    def extract_text(self, file_path: str) -> List[Dict[str, Any]]:
        """
        Transcribe an audio file (.wav, .mp3, etc.) using OpenAI Whisper.
        Returns a single list item dict with the transcription text and page=1.
        """
        logger.info(f"Transcribing audio file: {file_path}")
        
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"Audio file not found: {file_path}")
            
        try:
            model = self._get_whisper()
            # Transcribe with fp16=False to run on CPU without warnings, language specified as English
            result = model.transcribe(file_path, fp16=False, language="en")
            transcript_text = result.get("text", "").strip()
            
            logger.info(f"Successfully transcribed audio. Characters: {len(transcript_text)}")
            return [{"text": f"Audio Transcription:\n{transcript_text}", "page": 1}]
        except Exception as e:
            logger.error(f"Error during audio transcription of {file_path}: {e}")
            raise e

