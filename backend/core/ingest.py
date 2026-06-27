import os, uuid
from loguru import logger
from backend.core.chunker import get_chunker
from backend.core.embedder import get_embedder
from backend.core.vector_store import get_vector_store

def process_file(filename: str, content: bytes, clearance_level: str = "UNCLASSIFIED") -> dict:
    ext = filename.rsplit(".", 1)[-1].lower()
    text = ""

    if ext == "pdf":
        import fitz
        doc = fitz.open(stream=content, filetype="pdf")
        text = "\n".join(page.get_text() for page in doc)
    elif ext == "docx":
        import io
        from docx import Document
        doc = Document(io.BytesIO(content))
        text = "\n".join(p.text for p in doc.paragraphs)
    elif ext == "txt":
        text = content.decode("utf-8", errors="ignore")
    elif ext in ("jpg", "jpeg", "png", "bmp", "webp"):
        import pytesseract
        from PIL import Image
        import io, base64

        pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
        img = Image.open(io.BytesIO(content))

        # 1. OCR
        try:
            ocr_text = pytesseract.image_to_string(img).strip()
        except Exception:
            ocr_text = ""

        # 2. AI vision description — tries Gemini first, then Anthropic, then skips
        vision_text = ""

        # Try Gemini
        try:
            import google.generativeai as genai
            gemini_key = os.getenv("GEMINI_API_KEY", "")
            if gemini_key:
                genai.configure(api_key=gemini_key)
                model = genai.GenerativeModel("gemini-1.5-flash")
                img_part = {"mime_type": f"image/{ext if ext != 'jpg' else 'jpeg'}", "data": content}
                response = model.generate_content([
                    img_part,
                    (
                        "Describe this image in detail for a document retrieval system. "
                        "Include: main subject, visible text, diagrams, data, entities, colors, layout. "
                        "Be specific and dense — this will be embedded for semantic search."
                    )
                ])
                vision_text = response.text.strip()
                logger.info(f"Gemini vision analysis complete for {filename}")
        except Exception as e:
            logger.warning(f"Gemini vision failed: {e}")
            vision_text = ""

        # Fallback: Try Anthropic
        if not vision_text:
            try:
                import anthropic
                api_key = os.getenv("ANTHROPIC_API_KEY", "")
                if api_key:
                    client = anthropic.Anthropic(api_key=api_key)
                    b64 = base64.b64encode(content).decode()
                    media_type = f"image/{ext if ext != 'jpg' else 'jpeg'}"
                    msg = client.messages.create(
                        model="claude-opus-4-5",
                        max_tokens=400,
                        messages=[{
                            "role": "user",
                            "content": [
                                {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": b64}},
                                {"type": "text", "text": (
                                    "Describe this image in detail for a document retrieval system. "
                                    "Include: main subject, visible text, diagrams, data, entities, colors, layout. "
                                    "Be specific and dense — this will be embedded for semantic search."
                                )}
                            ]
                        }]
                    )
                    vision_text = msg.content[0].text.strip()
                    logger.info(f"Anthropic vision analysis complete for {filename}")
            except Exception as e:
                logger.warning(f"Anthropic vision failed: {e}")
                vision_text = ""

        # 3. Combine
        parts = []
        if vision_text:
            parts.append(f"[AI Vision Description]: {vision_text}")
        if ocr_text:
            parts.append(f"[OCR Extracted Text]: {ocr_text}")
        if not parts:
            parts.append(f"[Image file: {filename}. Dimensions: {img.width}x{img.height}px. No text detected.]")

        text = "\n\n".join(parts)

    elif ext in ("mp3", "wav", "m4a", "ogg"):
        import whisper
        import tempfile
        with tempfile.NamedTemporaryFile(suffix=f".{ext}", delete=False) as f:
            f.write(content)
            tmp_path = f.name
        try:
            model = whisper.load_model("base")
            result = model.transcribe(tmp_path, fp16=False, language="en")
            text = result["text"].strip()
        finally:
            os.unlink(tmp_path)
    elif ext in ("mp4", "avi", "mkv"):
        from backend.processors.video_processor import process_video_file
        return process_video_file(filename, content, clearance_level)
    else:
        text = content.decode("utf-8", errors="ignore")

    if not text.strip():
        return {"file_id": str(uuid.uuid4()), "filename": filename, "chunk_count": 0, "modality": ext, "status": "empty"}

    chunker = get_chunker()
    embedder = get_embedder()
    store = get_vector_store()

    chunks = chunker.split(text)
    embeddings = embedder.encode_batch(chunks)
    file_id = str(uuid.uuid4())
    modality = "audio" if ext in ("mp3", "wav", "m4a", "ogg") else "image" if ext in ("jpg", "jpeg", "png", "bmp", "webp") else ext
    metadatas = [{"file_id": file_id, "filename": filename, "modality": modality, "chunk_index": i, "clearance_level": clearance_level} for i in range(len(chunks))]
    ids = [f"{file_id}_{i}" for i in range(len(chunks))]
    store.add_documents(chunks, embeddings, metadatas, ids)

    # If image, also index CLIP embedding to intellimesh_images collection
    if ext in ("jpg", "jpeg", "png", "bmp", "webp"):
        try:
            from PIL import Image
            import io
            from backend.retrieval.unified import LocalCLIPEmbedder
            clip_embedder = LocalCLIPEmbedder()
            pil_img = Image.open(io.BytesIO(content))
            clip_emb = clip_embedder.encode_image(pil_img)
            if clip_emb:
                images_coll = store.client.get_or_create_collection("intellimesh_images")
                img_meta = {
                    "file_id": file_id,
                    "filename": filename,
                    "modality": "image",
                    "clearance_level": clearance_level,
                    "dense_embedding": embeddings[0] if embeddings else embedder.encode(text)
                }
                images_coll.add(
                    ids=[f"{file_id}_image"],
                    embeddings=[clip_emb],
                    metadatas=[img_meta],
                    documents=[text]
                )
                logger.info(f"CLIP embedding added to intellimesh_images for {filename}")
        except Exception as e:
            logger.error(f"Failed to add CLIP embedding for image {filename}: {e}")

    return {"file_id": file_id, "filename": filename, "chunk_count": len(chunks), "modality": modality, "status": "indexed"}

def get_ingestion_pipeline():
    return process_file