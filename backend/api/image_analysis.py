from fastapi import APIRouter, UploadFile, File
import os, tempfile
from backend.processors.image_processor import ImageProcessor

router = APIRouter()

@router.post("/api/image/analyze")
async def analyze_image(image: UploadFile = File(...)):
    """Returns an AI vision description of an image for the frontend preview panel using local ImageProcessor."""
    content = await image.read()
    ext = image.filename.rsplit(".", 1)[-1].lower()

    with tempfile.NamedTemporaryFile(suffix=f".{ext}", delete=False) as f:
        f.write(content)
        tmp_path = f.name
    try:
        processor = ImageProcessor()
        res_list = processor.extract_text(tmp_path)
        description = res_list[0]["text"] if res_list else "Analysis failed."
        return {"description": description, "model": "local-blip-tesseract"}
    except Exception as e:
        return {"description": f"Local vision analysis failed: {str(e)}", "error": True}
    finally:
        try:
            os.unlink(tmp_path)
        except Exception:
            pass
