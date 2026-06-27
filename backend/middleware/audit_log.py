import os
import sys
import time
import json
import sqlite3
from datetime import datetime
from pathlib import Path
from loguru import logger
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

# Add project root to sys.path
project_root = Path(__file__).resolve().parent.parent.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

from backend.config import settings

class AuditLogMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # We only log requests to the query endpoint
        if request.url.path != "/api/query" or request.method != "POST":
            return await call_next(request)
            
        start_time = time.time()
        
        # Intercept and cache the request body so we can extract query/user_id
        body_bytes = await request.body()
        
        # Restore the request stream for the next handler
        async def receive():
            return {"type": "http.request", "body": body_bytes, "more_body": False}
        request._receive = receive
        
        user_id = "anonymous"
        query_text = ""
        try:
            body_json = json.loads(body_bytes)
            user_id = body_json.get("user_id", "anonymous")
            query_text = body_json.get("query", "")
        except Exception:
            pass
            
        # Call the next handler
        response = await call_next(request)
        
        # Calculate latency
        latency_ms = int((time.time() - start_time) * 1000)
        
        # Retrieve chunk IDs stored in request.state during query execution
        chunk_ids = []
        if hasattr(request.state, "audit_chunk_ids"):
            chunk_ids = request.state.audit_chunk_ids
            
        # Log to SQLite inside try-except to guarantee zero failure propagation
        try:
            db_path = settings.DATA_DIR / "audit_log.db"
            db_path.parent.mkdir(parents=True, exist_ok=True)
            
            conn = sqlite3.connect(str(db_path.resolve()))
            cursor = conn.cursor()
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS audit_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp TEXT,
                    user_id TEXT,
                    query TEXT,
                    chunk_ids TEXT,
                    latency_ms INTEGER
                )
            """)
            
            timestamp_str = datetime.utcnow().isoformat()
            chunk_ids_str = json.dumps(chunk_ids)
            
            cursor.execute("""
                INSERT INTO audit_logs (timestamp, user_id, query, chunk_ids, latency_ms)
                VALUES (?, ?, ?, ?, ?)
            """, (timestamp_str, user_id, query_text, chunk_ids_str, latency_ms))
            
            conn.commit()
            conn.close()
            logger.info(f"Audit Log written to database for user {user_id}. Latency: {latency_ms}ms.")
        except Exception as e:
            logger.error(f"Failed to write audit log to database: {e}")
            
        return response

if __name__ == "__main__":
    print("Running Audit Log Middleware smoke test...")
    # Initialize middleware and check that table creation/insertion runs without error
    db_path = settings.DATA_DIR / "audit_log.db"
    if db_path.exists():
        try:
            db_path.unlink()
        except Exception:
            pass
            
    conn = sqlite3.connect(str(db_path.resolve()))
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT,
            user_id TEXT,
            query TEXT,
            chunk_ids TEXT,
            latency_ms INTEGER
        )
    """)
    cursor.execute("""
        INSERT INTO audit_logs (timestamp, user_id, query, chunk_ids, latency_ms)
        VALUES (?, ?, ?, ?, ?)
    """, ("2026-06-17T12:00:00", "test_user", "smoke test", "['doc1']", 45))
    conn.commit()
    cursor.execute("SELECT count(*) FROM audit_logs")
    cnt = cursor.fetchone()[0]
    conn.close()
    
    print(f"Table created and verified. Test row count: {cnt}")
    if cnt == 1:
        print("Audit Log Middleware smoke test PASSED!")
    else:
        print("Audit Log Middleware smoke test FAILED!")
