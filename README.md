# IntelliMesh — Secure Multimodal Offline RAG System

> A fully air-gapped, offline document intelligence platform supporting heterogeneous modalities (PDF, DOCX, images, audio) with zero internet dependency at runtime.

**Author:** Nandini Singh — B.Tech AI/ML, Indore Institute of Science and Technology  
**Stack:** FastAPI · ChromaDB · sentence-transformers · Ollama (phi3:mini) · BLIP · Whisper · React + Vite + TypeScript

---

## Research Motivation

Retrieval-Augmented Generation (RAG) systems typically assume cloud connectivity, limiting deployment in air-gapped or resource-constrained environments (edge computing, defense, offline enterprise). IntelliMesh investigates whether a fully offline multimodal RAG pipeline can maintain competitive retrieval accuracy while operating entirely on local CPU hardware with no external API dependencies.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    INGESTION PIPELINE                   │
│  PDF → PyMuPDF  │  DOCX → python-docx  │  TXT → direct │
│  Image → OpenCV + Tesseract OCR + BLIP captioning       │
│  Audio → OpenAI Whisper (local, base model)             │
└────────────────────────┬────────────────────────────────┘
                         │ chunked text (512 tokens, 64 overlap)
┌────────────────────────▼────────────────────────────────┐
│                   RETRIEVAL PIPELINE                    │
│  Dense: all-MiniLM-L6-v2 (384-dim, local)              │
│  Sparse: BM25Okapi keyword index                        │
│  Visual: CLIP embeddings (images)                       │
│  Fusion: Reciprocal Rank Fusion (RRF)                   │
│  Rerank: Cross-encoder reranker                         │
│  Diversity: Maximal Marginal Relevance (MMR, λ=0.5)     │
│  Guard: Cosine hallucination threshold (0.3 cutoff)     │
└────────────────────────┬────────────────────────────────┘
                         │ top-5 chunks
┌────────────────────────▼────────────────────────────────┐
│                   GENERATION PIPELINE                   │
│  phi3:mini via Ollama (local inference, CPU)            │
│  Prompt injection filtering                             │
│  Clearance-level access control                         │
└─────────────────────────────────────────────────────────┘
```

---

## Ablation Study: Retrieval Parameter Tuning

To justify parameter choices rather than relying on defaults, a systematic ablation was conducted over MMR lambda (λ) and hallucination cosine threshold across 28 evaluation queries (in-corpus) with 8 deliberately out-of-corpus queries to stress-test the hallucination guard.

| λ (MMR) | Threshold | Retrieval Accuracy | False Refusal Rate | Hallucination Rate |
|---------|-----------|-------------------|-------------------|-------------------|
| 0.2 | 0.2 | 100% | 25.0% | 0% |
| 0.2 | 0.3 | 100% | 28.6% | 0% |
| 0.2 | 0.4 | 100% | 28.6% | 0% |
| 0.5 | 0.2 | 100% | 21.4% | 0% |
| **0.5** | **0.3** | **100%** | **25.0%** | **0%** | ← selected |
| 0.5 | 0.4 | 100% | 25.0% | 0% |
| 0.8 | 0.2 | 100% | 10.7% | 0% |
| 0.8 | 0.3 | 100% | 14.3% | 0% |
| 0.8 | 0.4 | 100% | 14.3% | 0% |

**Finding:** All 9 configurations achieved 100% retrieval accuracy on in-corpus queries, confirming the robustness of the dense+sparse+visual RRF fusion pipeline. The hallucination guard successfully suppressed all out-of-corpus responses across every configuration (0% hallucination rate). The key tradeoff is in false refusal rate: higher λ (0.8) reduced false refusals to 10.7–14.3% by prioritizing relevance-focused retrieval, while lower λ (0.2) increased false refusals to 25–28.6% due to diversity-driven chunk selection reducing per-chunk cosine scores. λ=0.5 with threshold=0.3 was selected as the production default, balancing retrieval diversity against refusal rate while maintaining zero hallucinations — a critical property for air-gapped deployments where unverified responses are unacceptable.

---

## Key Features

- **100% offline at runtime** — no API calls, no cloud dependencies after one-time model setup
- **Multimodal ingestion** — PDF, DOCX, TXT, PNG/JPG (OCR + BLIP caption), WAV/MP3 (Whisper)
- **6-stage retrieval pipeline** — dense + sparse + visual fusion with reranking and MMR diversity
- **Hallucination guard** — cosine confidence threshold prevents responses on low-confidence retrievals
- **Prompt injection filtering** — strips instruction-tuning tokens before vector creation
- **Clearance-level access control** — document classification with query-time enforcement
- **React dashboard** — dark/light mode, real-time ingestion telemetry, knowledge graph view

---

## Setup

### Prerequisites
```powershell
# Tesseract OCR
winget install UB-Mannheim.TesseractOCR

# FFmpeg (audio processing)
winget install Gyan.FFmpeg

# Ollama (local LLM)
# Download from: https://ollama.com
ollama pull phi3:mini
```

### Installation
```powershell
# Clone and setup
git clone https://github.com/Nandinisingh07/intellimesh.git
cd intellimesh

# Python environment
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r backend/requirements.txt

# Download all models locally (one-time, ~3GB)
python scripts/download_models.py

# Start backend
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload

# Start frontend (separate terminal)
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`

### Environment
Copy `.env.example` to `.env` — no API keys required for local mode.

---

## Project Structure

```
intellimesh/
├── backend/
│   ├── api/          # FastAPI route handlers
│   ├── core/         # Chunker, embedder, vector store, generator
│   ├── processors/   # PDF, DOCX, image, audio, video processors
│   ├── retrieval/    # BM25, RRF, reranker, unified pipeline
│   └── middleware/   # Audit logging
├── frontend/         # React + Vite + TypeScript + Tailwind
├── eval/             # Ablation scripts and results
├── scripts/          # Setup and data generation utilities
└── data/sample_docs/ # Sample documents for testing
```

---

## Research Context

This system was developed as part of ongoing research into efficient offline RAG architectures for resource-constrained and air-gapped environments. The multimodal pipeline, hallucination guardrail design, and ablation methodology inform ongoing work targeting publication at ML systems venues.

---

## License

MIT