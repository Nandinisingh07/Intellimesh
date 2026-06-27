"""
eval/run_ablation.py
--------------------
Retrieval ablation harness for IntelliMesh.

Ablates:
  - MMR lambda         : [0.2, 0.5, 0.8]
  - Hallucination guard threshold : [0.2, 0.3, 0.4]

9 combinations × 36 questions = 324 retrieval calls.

Usage (from project root):
    python eval/run_ablation.py

No new dependencies. Calls unified_retrieve() exactly as the API does.
Overrides lambda via os.environ["MMR_LAMBDA"] (already read per-call in unified.py).
Replicates the hallucination guard from backend/api/query.py inline.
"""

import os
import sys
import json

# Force UTF-8 stdout so λ and other Unicode chars don't crash on Windows cp1252
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
import csv
import time
from pathlib import Path

# ── path bootstrap ────────────────────────────────────────────────────────────
project_root = Path(__file__).resolve().parent.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

# ── imports (lazy-loaded after path is ready) ─────────────────────────────────
from backend.retrieval.unified import unified_retrieve  # noqa: E402


# ── helpers ───────────────────────────────────────────────────────────────────

def load_qa_set() -> list[dict]:
    qa_path = Path(__file__).resolve().parent / "qa_set.json"
    with open(qa_path, "r", encoding="utf-8") as f:
        return json.load(f)


def seed_if_needed() -> None:
    """
    Seeds the Chroma vector store with the four sample documents if they are
    not already present.  Safe to call multiple times — checks before ingesting.
    """
    from backend.core.vector_store import get_vector_store
    from backend.core.ingest import process_file
    from backend.config import settings

    store = get_vector_store()

    # Collect filenames already indexed
    try:
        all_meta = store.collection.get(include=["metadatas"])["metadatas"] or []
    except Exception:
        all_meta = []
    existing = {m.get("filename") for m in all_meta if m}

    sample_files = [
        ("cybersecurity_policy.pdf",  "CONFIDENTIAL"),
        ("ml_research_notes.docx",    "UNCLASSIFIED"),
        ("meeting_transcript.txt",    "UNCLASSIFIED"),
        ("network_diagram_notes.png", "UNCLASSIFIED"),
    ]

    for filename, clearance in sample_files:
        if filename in existing:
            print(f"[seed] already indexed: {filename}")
            continue
        filepath = settings.SAMPLE_DOCS_DIR / filename
        if not filepath.exists():
            print(f"[seed] WARNING: sample file not found at {filepath}")
            continue
        print(f"[seed] ingesting {filename} ({clearance}) ...")
        with open(filepath, "rb") as fh:
            content = fh.read()
        result = process_file(filename, content, clearance_level=clearance)
        print(f"[seed] done — {result.get('chunk_count', '?')} chunks indexed")


def _guard_fired(chunks: list[dict], threshold: float) -> bool:
    """
    Replicates the hallucination guard logic from backend/api/query.py L46:
        if not results or max(r["score"] for r in results) < threshold_val:
    where threshold_val = threshold * 100 and scores are already 0–100.
    Equivalently: max(score)/100 < threshold, which is what we compute here.
    """
    if not chunks:
        return True
    top_score_norm = max(c["score"] for c in chunks) / 100.0
    return top_score_norm < threshold


def _source_in_top5(chunks: list[dict], expected_src: str) -> bool:
    if not expected_src:
        return False  # OOC questions have no expected source
    return any(c["metadata"].get("filename", "") == expected_src for c in chunks)


# ── main ablation loop ────────────────────────────────────────────────────────

def run_ablation() -> None:
    print("=" * 72)
    print("IntelliMesh Retrieval Ablation Study")
    print("=" * 72)

    # ── 1. Seed DB ────────────────────────────────────────────────────────────
    print("\n[1/3] Checking vector store seeding ...")
    seed_if_needed()

    # ── 2. Load QA set ────────────────────────────────────────────────────────
    qa_set = load_qa_set()
    in_corpus  = [q for q in qa_set if q["expected_source"]]
    out_corpus = [q for q in qa_set if not q["expected_source"]]
    print(f"\n[2/3] Loaded {len(qa_set)} questions "
          f"({len(in_corpus)} in-corpus, {len(out_corpus)} out-of-corpus)")

    # ── 3. Ablation grid ─────────────────────────────────────────────────────
    lambdas    = [0.2, 0.5, 0.8]
    thresholds = [0.2, 0.3, 0.4]

    aggregate_rows   = []   # one row per (lambda, threshold)
    per_query_rows   = []   # one row per (lambda, threshold, question)

    print(f"\n[3/3] Running {len(lambdas) * len(thresholds)} combinations "
          f"× {len(qa_set)} questions = "
          f"{len(lambdas) * len(thresholds) * len(qa_set)} retrieval calls\n")
    print("-" * 72)

    total_combos = len(lambdas) * len(thresholds)
    combo_idx = 0

    for l_param in lambdas:
        for t_param in thresholds:
            combo_idx += 1
            # ── override lambda (read per-call in unified.py L182–183) ────────
            os.environ["MMR_LAMBDA"] = str(l_param)

            in_corpus_correct  = 0
            in_corpus_refused  = 0   # guard fired on a valid question
            out_corpus_passed  = 0   # guard did NOT fire on an OOC question (hallucination)

            t0 = time.time()

            for item in qa_set:
                query       = item["question"]
                expected    = item["expected_source"]
                is_in_corpus = bool(expected)

                # ── call the real pipeline ────────────────────────────────────
                try:
                    chunks = unified_retrieve(
                        query,
                        user_clearance="CONFIDENTIAL",  # sees all docs
                        top_k=5
                    )
                except Exception as exc:
                    print(f"  [WARN] retrieval failed for '{query[:50]}': {exc}")
                    chunks = []

                # ── per-query metrics ─────────────────────────────────────────
                top_cosine = (max(c["score"] for c in chunks) / 100.0
                              if chunks else 0.0)
                guard      = _guard_fired(chunks, t_param)
                src_hit    = _source_in_top5(chunks, expected)

                per_query_rows.append({
                    "lambda":            l_param,
                    "threshold":         t_param,
                    "question":          query,
                    "expected_source":   expected,
                    "top_cosine_score":  round(top_cosine, 4),
                    "guard_fired":       int(guard),
                    "source_in_top5":    int(src_hit),
                })

                # ── aggregate counters ────────────────────────────────────────
                if is_in_corpus:
                    if src_hit:
                        in_corpus_correct += 1
                    if guard:
                        in_corpus_refused += 1
                else:
                    if not guard:
                        out_corpus_passed += 1

            elapsed = time.time() - t0

            # ── compute rates ─────────────────────────────────────────────────
            n_in  = len(in_corpus)
            n_out = len(out_corpus)

            retrieval_acc      = (in_corpus_correct / n_in  * 100) if n_in  else 0.0
            false_refusal_rate = (in_corpus_refused / n_in  * 100) if n_in  else 0.0
            hallucination_rate = (out_corpus_passed / n_out * 100) if n_out else 0.0

            row = {
                "lambda":             l_param,
                "threshold":          t_param,
                "retrieval_accuracy": round(retrieval_acc,      2),
                "false_refusal_rate": round(false_refusal_rate, 2),
                "hallucination_rate": round(hallucination_rate, 2),
            }
            aggregate_rows.append(row)

            print(
                f"  [{combo_idx:02d}/{total_combos}] "
                f"lam={l_param:.1f}  thresh={t_param:.1f}  |  "
                f"accuracy={retrieval_acc:5.1f}%  "
                f"false_refusal={false_refusal_rate:5.1f}%  "
                f"hallucination={hallucination_rate:5.1f}%  "
                f"({elapsed:.1f}s)"
            )

    # ── 4. Save aggregate CSV ─────────────────────────────────────────────────
    out_dir  = Path(__file__).resolve().parent
    csv_path = out_dir / "ablation_results.csv"
    agg_fields = ["lambda", "threshold", "retrieval_accuracy",
                  "false_refusal_rate", "hallucination_rate"]
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=agg_fields)
        writer.writeheader()
        writer.writerows(aggregate_rows)
    print(f"\n[saved] {csv_path}")

    # ── 5. Save per-query CSV ─────────────────────────────────────────────────
    pq_path = out_dir / "ablation_per_query.csv"
    pq_fields = ["lambda", "threshold", "question", "expected_source",
                 "top_cosine_score", "guard_fired", "source_in_top5"]
    with open(pq_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=pq_fields)
        writer.writeheader()
        writer.writerows(per_query_rows)
    print(f"[saved] {pq_path}")

    # ── 6. Print results table ────────────────────────────────────────────────
    print("\n" + "=" * 72)
    print("ABLATION RESULTS TABLE")
    print("=" * 72)
    header = (
        f"{'lam':>6}  {'Thresh':>6}  "
        f"{'Retrieval Acc':>14}  {'False Refusal':>14}  {'Hallucination':>14}"
    )
    print(header)
    print("-" * 72)
    for r in aggregate_rows:
        print(
            f"{r['lambda']:>6.1f}  {r['threshold']:>6.1f}  "
            f"{r['retrieval_accuracy']:>13.1f}%  "
            f"{r['false_refusal_rate']:>13.1f}%  "
            f"{r['hallucination_rate']:>13.1f}%"
        )
    print("=" * 72)

    # ── 7. Markdown table (copy-pasteable) ────────────────────────────────────
    print("\nMarkdown table:\n")
    print("| lam | Threshold | Retrieval Accuracy | False Refusal Rate | Hallucination Rate |")
    print("|-----|-----------|--------------------|--------------------|--------------------|")
    for r in aggregate_rows:
        print(
            f"| {r['lambda']:.1f} | {r['threshold']:.1f}       "
            f"| {r['retrieval_accuracy']:.1f}%              "
            f"| {r['false_refusal_rate']:.1f}%              "
            f"| {r['hallucination_rate']:.1f}%              |"
        )

    # ── 8. Quick best-config summary ─────────────────────────────────────────
    print("\n" + "=" * 72)
    print("QUICK SUMMARY")
    print("=" * 72)

    best_by_acc = max(aggregate_rows, key=lambda r: r["retrieval_accuracy"])
    best_balanced = max(
        aggregate_rows,
        key=lambda r: r["retrieval_accuracy"] - r["false_refusal_rate"] - r["hallucination_rate"]
    )
    print(
        f"  Best raw accuracy    : lam={best_by_acc['lambda']:.1f}, "
        f"thresh={best_by_acc['threshold']:.1f}  "
        f"-> {best_by_acc['retrieval_accuracy']:.1f}% accuracy"
    )
    print(
        f"  Best balanced config : lam={best_balanced['lambda']:.1f}, "
        f"thresh={best_balanced['threshold']:.1f}  "
        f"-> {best_balanced['retrieval_accuracy']:.1f}% accuracy, "
        f"{best_balanced['false_refusal_rate']:.1f}% false refusal, "
        f"{best_balanced['hallucination_rate']:.1f}% hallucination"
    )
    print("=" * 72)


if __name__ == "__main__":
    run_ablation()
