import os
import sys
import requests
import json
from pathlib import Path

# Add project root to sys.path
project_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(project_root))

from backend.config import settings

def seed_documents():
    print("=========================================")
    # Server configuration
    API_URL = "http://127.0.0.1:8000/api"
    UPLOAD_URL = f"{API_URL}/upload"
    DOCS_URL = f"{API_URL}/documents"
    HEALTH_URL = f"{API_URL}/health"

    # Verify if backend server is running
    print("Checking if IntelliMesh backend is running...")
    try:
        health_resp = requests.get(HEALTH_URL, timeout=5)
        if health_resp.status_code == 200:
            print("Backend is online and healthy!")
            print(f"Loaded models: {health_resp.json()['models_loaded']}")
        else:
            print("Backend returned non-200 status. Make sure it is running.")
            sys.exit(1)
    except requests.exceptions.ConnectionError:
        print("Error: Could not connect to backend server at http://127.0.0.1:8000.")
        print("Please start the backend server using 'uvicorn main:app --reload' before seeding data.")
        sys.exit(1)

    # List of files to upload in sample_docs directory
    sample_docs_dir = settings.SAMPLE_DOCS_DIR
    if not sample_docs_dir.exists():
        print(f"Sample docs directory does not exist at: {sample_docs_dir}")
        sys.exit(1)

    files_to_seed = [
        "cybersecurity_policy.pdf",
        "ml_research_notes.docx",
        "meeting_transcript.txt",
        "network_diagram_notes.png",
        "team_briefing.wav"
    ]

    print(f"\nScanning for sample files in {sample_docs_dir}...")
    existing_files = []
    for fname in files_to_seed:
        fpath = sample_docs_dir / fname
        if fpath.exists():
            existing_files.append((fname, fpath))
            print(f"Found: {fname} ({fpath.stat().st_size} bytes)")
        else:
            # Check for alternative mp3
            if fname == "team_briefing.wav":
                alt_path = sample_docs_dir / "team_briefing.mp3"
                if alt_path.exists():
                    existing_files.append(("team_briefing.mp3", alt_path))
                    print(f"Found: team_briefing.mp3 ({alt_path.stat().st_size} bytes)")
                    continue
            print(f"WARNING: File '{fname}' not found in sample_docs directory!")

    if not existing_files:
        print("No sample files found to seed. Exiting.")
        sys.exit(1)

    print(f"\nUploading {len(existing_files)} files to backend via multipart POST stream...")
    
    # Upload files
    # We will upload them in a single batch of up to 5 files as permitted by api
    multipart_files = []
    opened_files = []
    
    try:
        for fname, fpath in existing_files:
            # Determine content type
            ext = fpath.suffix.lower()
            if ext == ".pdf":
                mime = "application/pdf"
            elif ext == ".docx":
                mime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            elif ext == ".txt":
                mime = "text/plain"
            elif ext in [".png", ".jpg", ".jpeg", ".bmp"]:
                mime = f"image/{ext[1:]}"
            elif ext in [".mp3", ".wav"]:
                mime = f"audio/{ext[1:]}"
            else:
                mime = "application/octet-stream"

            f = open(fpath, "rb")
            opened_files.append(f)
            multipart_files.append(("files", (fname, f, mime)))

        print(f"Sending request to {UPLOAD_URL}...")
        resp = requests.post(UPLOAD_URL, files=multipart_files, stream=True)
        
        if resp.status_code != 200:
            print(f"Upload request failed: {resp.status_code} - {resp.text}")
            sys.exit(1)

        # Stream response events
        print("\nProcessing upload stream events (SSE):")
        for line in resp.iter_lines():
            if line:
                decoded_line = line.decode('utf-8')
                if decoded_line.startswith("data: "):
                    event_data = decoded_line[6:]
                    try:
                        event = json.loads(event_data)
                        filename = event.get("filename")
                        stage = event.get("stage")
                        progress = event.get("progress")
                        status = event.get("status")
                        chunks = event.get("chunk_count")
                        
                        if status == "error":
                            print(f"❌ Error indexing {filename}: {event.get('error_message')}")
                        elif status == "completed":
                            print(f"✅ Indexed {filename}: Generated {chunks} chunks.")
                        else:
                            print(f"⏳ {filename} -> Stage: {stage} ({progress}%)")
                    except json.JSONDecodeError:
                        print(f"Could not parse event: {decoded_line}")

    finally:
        # Close all open file handles
        for f in opened_files:
            f.close()

    # Verify indexing status from /api/documents
    print("\nVerifying ChromaDB storage count...")
    try:
        docs_resp = requests.get(DOCS_URL)
        if docs_resp.status_code == 200:
            documents = docs_resp.json()
            print("\n=========================================")
            print("CURRENT SYSTEM DOCUMENT REGISTRY:")
            print("=========================================")
            total_chunks = 0
            for doc in documents:
                print(f"- File: {doc['filename']}")
                print(f"  Modality: {doc['modality']}")
                print(f"  Chunks: {doc['chunk_count']}")
                print(f"  Size: {doc['file_size']} bytes")
                total_chunks += doc['chunk_count']
            print("=========================================")
            print(f"Total documents: {len(documents)}")
            print(f"Total chunks in vector store: {total_chunks}")
            print("=========================================")
        else:
            print(f"Failed to query documents: {docs_resp.status_code}")
    except Exception as e:
        print(f"Verification query failed: {e}")

if __name__ == "__main__":
    seed_documents()

