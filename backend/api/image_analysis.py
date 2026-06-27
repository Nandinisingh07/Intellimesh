from fastapi import APIRouter, UploadFile, File
import anthropic, base64, os

router = APIRouter()

@router.post("/api/image/analyze")
async def analyze_image(image: UploadFile = File(...)):
    """Returns an AI vision description of an image for the frontend preview panel."""
    content = await image.read()
    ext = image.filename.rsplit(".", 1)[-1].lower()
    if ext == "jpg":
        ext = "jpeg"
    media_type = f"image/{ext}"
    b64 = base64.b64encode(content).decode()

    api_key = os.getenv("ANTHROPIC_API_KEY", "")
    if not api_key:
        return {"description": "ANTHROPIC_API_KEY not set — OCR only mode.", "ocr_available": True}

    try:
        client = anthropic.Anthropic(api_key=api_key)
        msg = client.messages.create(
            model="claude-opus-4-5",
            max_tokens=500,
            messages=[{
                "role": "user",
                "content": [
                    {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": b64}},
                    {"type": "text", "text": (
                        "Analyze this image and return a structured description:\n"
                        "1. Main subject and context\n"
                        "2. Any visible text (verbatim)\n"
                        "3. Diagrams, charts, or data present\n"
                        "4. Key entities and relationships\n"
                        "Keep it under 300 words."
                    )}
                ]
            }]
        )
        return {"description": msg.content[0].text.strip(), "model": "claude-opus-4-5"}
    except Exception as e:
        return {"description": f"Vision analysis failed: {str(e)}", "error": True}
