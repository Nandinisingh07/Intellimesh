from dotenv import load_dotenv
load_dotenv()
import os
# Force offline modes for HuggingFace hub and transformers
os.environ["HF_HUB_OFFLINE"] = "1"
os.environ["TRANSFORMERS_OFFLINE"] = "1"

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.api.health import router as health_router
from backend.api.upload import router as upload_router
from backend.api.query import router as query_router
from backend.api.documents import router as documents_router
from backend.api.voice import router as voice_router
from backend.api.image_analysis import router as image_router
from backend.api.graph import router as graph_router
from backend.middleware.audit_log import AuditLogMiddleware

app = FastAPI(title="IntelliMesh API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(AuditLogMiddleware)

app.include_router(health_router)
app.include_router(upload_router)
app.include_router(query_router)
app.include_router(documents_router)
app.include_router(voice_router)
app.include_router(image_router)
app.include_router(graph_router)
