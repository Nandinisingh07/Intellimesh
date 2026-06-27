from fastapi import APIRouter

router = APIRouter()

@router.get("/api/health")
async def health_check():
    return {
        "status": "ok",
        "models_loaded": {
            "embedder": True,
            "llm": "phi3:mini via Ollama",
            "whisper": True,
            "blip": True
        }
    }
