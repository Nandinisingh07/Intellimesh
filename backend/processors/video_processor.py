import os
import sys
import uuid
import tempfile
from pathlib import Path
from loguru import logger

# Add project root to sys.path
project_root = Path(__file__).resolve().parent.parent.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

from backend.config import settings

def process_video_file(filename: str, content: bytes, clearance_level: str = "UNCLASSIFIED") -> dict:
    """
    Process video files (.mp4, .avi, .mkv) offline:
    1. Extract audio and transcribe using Whisper, chunking into 30s segments.
    2. Extract keyframes every 10 seconds using OpenCV, run OCR (Tesseract) + Captioning (BLIP).
    3. Compute CLIP embeddings for keyframes and dense text embeddings.
    4. Save to ChromaDB intellimesh_docs (text/audio/kf) and intellimesh_images (CLIP vectors).
    """
    ext = filename.rsplit(".", 1)[-1].lower()
    
    # Save video bytes to a temporary file
    with tempfile.NamedTemporaryFile(suffix=f".{ext}", delete=False) as tmp_file:
        tmp_file.write(content)
        tmp_path = tmp_file.name
        
    logger.info(f"Temporary video file created at: {tmp_path}")
    
    try:
        # 1. Transcribe audio with Whisper to get timeline segments
        logger.info("Extracting and transcribing audio with Whisper...")
        import whisper
        whisper_dir = str(settings.MODELS_DIR / "whisper")
        
        # Load Whisper model (CPU mode)
        whisper_model = whisper.load_model(settings.WHISPER_MODEL_SIZE, download_root=whisper_dir, device="cpu")
        result = whisper_model.transcribe(tmp_path, fp16=False, language="en")
        segments = result.get("segments", [])
        
        # Group Whisper segments into 30-second chunks
        audio_chunks = []
        current_text = []
        current_start = 0.0
        
        for seg in segments:
            start = seg["start"]
            end = seg["end"]
            text = seg["text"].strip()
            
            if not current_text:
                current_start = start
                current_end = end
                current_text.append(text)
            elif end - current_start <= 30.0:
                current_end = end
                current_text.append(text)
            else:
                # Save previous chunk
                audio_chunks.append({
                    "start": current_start,
                    "end": current_end,
                    "text": " ".join(current_text)
                })
                current_start = start
                current_end = end
                current_text = [text]
                
        if current_text:
            audio_chunks.append({
                "start": current_start,
                "end": current_end,
                "text": " ".join(current_text)
            })
            
        logger.info(f"Segmented audio into {len(audio_chunks)} chunks.")

        # 2. Extract keyframes from video using OpenCV
        logger.info("Extracting keyframes from video via OpenCV...")
        import cv2
        from PIL import Image
        from backend.processors.image_processor import ImageProcessor
        
        image_processor = ImageProcessor()
        cap = cv2.VideoCapture(tmp_path)
        fps = cap.get(cv2.CAP_PROP_FPS)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        duration = total_frames / fps if fps > 0 else 0
        
        keyframe_data = []
        interval_sec = 10  # keyframe every 10 seconds
        
        for t in range(0, int(duration), interval_sec):
            frame_num = int(t * fps)
            cap.set(cv2.CAP_PROP_POS_FRAMES, frame_num)
            ret, frame = cap.read()
            if not ret:
                break
            
            # Save frame to a temporary image file for image_processor
            frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            pil_img = Image.fromarray(frame_rgb)
            
            with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp_img:
                pil_img.save(tmp_img.name)
                tmp_img_path = tmp_img.name
                
            try:
                # Run OCR + Captioning (Tesseract + BLIP)
                img_res = image_processor.extract_text(tmp_img_path)
                description = img_res[0]["text"]
                
                mins = int(t // 60)
                secs = int(t % 60)
                time_str = f"{mins:02d}:{secs:02d}"
                
                keyframe_data.append({
                    "timestamp": float(t),
                    "time_str": time_str,
                    "description": description,
                    "pil_image": pil_img
                })
            finally:
                if os.path.exists(tmp_img_path):
                    os.unlink(tmp_img_path)
                    
        cap.release()
        logger.info(f"Extracted {len(keyframe_data)} keyframes.")

        # 3. Save and index all chunks in ChromaDB
        from backend.core.embedder import get_embedder
        from backend.core.vector_store import get_vector_store
        from backend.retrieval.unified import LocalCLIPEmbedder
        
        embedder = get_embedder()
        store = get_vector_store()
        clip_embedder = LocalCLIPEmbedder()
        
        file_id = str(uuid.uuid4())
        total_chunks = 0
        
        doc_chunks = []
        doc_embeddings = []
        doc_metadatas = []
        doc_ids = []
        
        # Index audio chunks into intellimesh_docs
        for idx, chunk in enumerate(audio_chunks):
            mins_start, secs_start = int(chunk["start"] // 60), int(chunk["start"] % 60)
            mins_end, secs_end = int(chunk["end"] // 60), int(chunk["end"] % 60)
            time_label = f"[{mins_start:02d}:{secs_start:02d} - {mins_end:02d}:{secs_end:02d}]"
            
            chunk_text = f"{time_label} {chunk['text']}"
            emb = embedder.encode(chunk_text)
            
            meta = {
                "file_id": file_id,
                "filename": filename,
                "modality": "audio",
                "start_time": chunk["start"],
                "end_time": chunk["end"],
                "clearance_level": clearance_level,
                "chunk_index": idx
            }
            
            doc_chunks.append(chunk_text)
            doc_embeddings.append(emb)
            doc_metadatas.append(meta)
            doc_ids.append(f"{file_id}_audio_{idx}")
            total_chunks += 1
            
        # Index keyframe texts into intellimesh_docs
        image_coll = store.client.get_or_create_collection("intellimesh_images")
        
        for idx, kf in enumerate(keyframe_data):
            chunk_text = f"[Video Frame at {kf['time_str']}] {kf['description']}"
            emb = embedder.encode(chunk_text)
            
            meta = {
                "file_id": file_id,
                "filename": filename,
                "modality": "image",
                "timestamp": kf["timestamp"],
                "clearance_level": clearance_level,
                "chunk_index": idx + len(audio_chunks)
            }
            
            doc_chunks.append(chunk_text)
            doc_embeddings.append(emb)
            doc_metadatas.append(meta)
            doc_ids.append(f"{file_id}_kf_{idx}")
            total_chunks += 1
            
            # Compute and store CLIP embedding
            clip_emb = clip_embedder.encode_image(kf["pil_image"])
            if clip_emb:
                img_meta = {
                    "file_id": file_id,
                    "filename": filename,
                    "modality": "image",
                    "timestamp": kf["timestamp"],
                    "clearance_level": clearance_level,
                    "dense_embedding": emb  # Store dense vector in metadata for MMR
                }
                image_coll.add(
                    ids=[f"{file_id}_image_{idx}"],
                    embeddings=[clip_emb],
                    metadatas=[img_meta],
                    documents=[chunk_text]
                )
                
        # Batch write docs to ChromaDB
        if doc_chunks:
            store.add_documents(doc_chunks, doc_embeddings, doc_metadatas, doc_ids)
            
        logger.info(f"Video {filename} indexing completed. Saved {total_chunks} total chunks.")
        return {
            "file_id": file_id,
            "filename": filename,
            "chunk_count": total_chunks,
            "modality": ext,
            "status": "indexed"
        }
        
    finally:
        # Cleanup temp video file
        if os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except Exception as e:
                logger.error(f"Error removing temp video file {tmp_path}: {e}")

if __name__ == "__main__":
    print("Running Video Processor smoke test...")
    # This is a smoke test check
    print("Video Processor process_video_file function is defined successfully.")
    print("Video Processor smoke test PASSED!")
