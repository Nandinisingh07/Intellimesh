from fastapi import APIRouter, UploadFile, File
from backend.core.ingest import get_ingestion_pipeline
import tempfile, os, uuid

router = APIRouter()

@router.post("/api/voice/transcribe")
async def transcribe_voice(audio: UploadFile = File(...)):
    """Receives a webm/wav blob from the browser mic, transcribes with Whisper, returns text."""
    import whisper
    content = await audio.read()
    ext = "webm" if audio.content_type and "webm" in audio.content_type else "wav"
    with tempfile.NamedTemporaryFile(suffix=f".{ext}", delete=False) as f:
        f.write(content)
        tmp_path = f.name
    try:
        model = whisper.load_model("base")
        result = model.transcribe(tmp_path, fp16=False)
        text = result["text"].strip()
    finally:
        os.unlink(tmp_path)
    return {"text": text}

@router.post("/api/voice/ingest")
async def ingest_voice(audio: UploadFile = File(...), clearance_level: str = "UNCLASSIFIED"):
    """Transcribes audio and indexes it into ChromaDB as a document."""
    content = await audio.read()
    filename = audio.filename or f"voice_{uuid.uuid4().hex[:8]}.wav"
    pipeline = get_ingestion_pipeline()
    result = pipeline(filename, content, clearance_level=clearance_level)
    return result
