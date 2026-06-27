from fastapi import APIRouter, UploadFile, File
from typing import List
from backend.core.ingest import get_ingestion_pipeline
from loguru import logger

router = APIRouter()

@router.post("/api/upload")
async def upload_files(files: List[UploadFile] = File(...), clearance_level: str = "UNCLASSIFIED"):
    pipeline = get_ingestion_pipeline()
    results = []
    for file in files:
        content = await file.read()
        logger.info(f"Processing file: {file.filename} with clearance {clearance_level}")
        result = pipeline(file.filename, content, clearance_level=clearance_level)
        results.append(result)
    return {"results": results}
