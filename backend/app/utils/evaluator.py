"""
RAG Evaluation Metrics

All five metrics are computed after every answer and returned to the user
so they can gauge retrieval + generation quality in real-time.

Metrics:
  context_precision   — Mean normalised reranker score of retrieved chunks.
                        Reflects how precisely the retrieval system targeted relevant content.

  context_relevance   — Mean cosine similarity between the query embedding and each chunk embedding.
                        Reflects semantic alignment between what was asked and what was retrieved.

  answer_faithfulness — LLM-as-judge (0.0-1.0): is every claim in the answer supported by the context?
                        Catches hallucination.

  answer_relevance    — Cosine similarity between query embedding and answer embedding.
                        High if the answer directly addresses the question.

  retrieval_coverage  — Fraction of retrieved chunks whose reranker score exceeds a quality threshold.
                        Low coverage → retrieval returned many low-quality chunks.

  overall_score       — Equal-weighted average of the four primary metrics.
"""

import re
import json
import logging

import numpy as np
from sentence_transformers import SentenceTransformer
from langchain_core.messages import HumanMessage, SystemMessage

from app.utils.agents_extras import get_llm

logger = logging.getLogger(__name__)

# Sigmoid converts raw cross-encoder logit → 0-1 probability
def _sigmoid(x: float) -> float:
    return 1.0 / (1.0 + float(np.exp(-x)))


# ── Faithfulness (LLM judge) ───────────────────────────────────────────────

async def _faithfulness_score(query: str, answer: str, context: str) -> tuple[float, str]:
    """
    Ask the LLM to rate how faithfully the answer is grounded in the retrieved context.
    Returns (score 0-1, reason string).
    """
    llm = get_llm()
    try:
        response = await llm.ainvoke([
            SystemMessage(content=(
                "You are a strict factual evaluation assistant.\n"
                "Your job: given a CONTEXT, a QUESTION, and an ANSWER, "
                "rate whether every claim in the ANSWER is directly supported by the CONTEXT.\n\n"
                "Scoring guide:\n"
                "  1.0 — every claim is explicitly in the context\n"
                "  0.7 — most claims are supported; minor extrapolation\n"
                "  0.5 — roughly half the claims are supported\n"
                "  0.2 — few claims are supported; significant hallucination\n"
                "  0.0 — the answer contradicts or ignores the context entirely\n\n"
                'Respond ONLY with valid JSON: {"score": <float>, "reason": "<one sentence>"}'
            )),
            HumanMessage(content=(
                f"CONTEXT:\n{context}\n\n"
                f"QUESTION: {query}\n\n"
                f"ANSWER: {answer}\n\n"
                "Rate faithfulness:"
            )),
        ])
        raw = re.sub(r"```json|```", "", response.content.strip()).strip()
        result = json.loads(raw)
        score  = max(0.0, min(1.0, float(result.get("score", 0.5))))
        reason = result.get("reason", "")
        return score, reason
    except Exception as e:
        logger.warning(f"[RAG] Faithfulness eval error: {e}")
        return 0.5, "Evaluation unavailable"


# ── Main Metrics Function ──────────────────────────────────────────────────

async def compute_metrics(
    query: str,
    answer: str,
    retrieved_chunks: list[dict],
    query_embedding: list[float],
    model: SentenceTransformer,
) -> dict:
    """
    Compute all five evaluation metrics.
    Returns a flat dict ready to be stored in the DB and returned to the frontend.
    """
    if not retrieved_chunks:
        return {
            "context_precision":   0.0,
            "context_relevance":   0.0,
            "answer_faithfulness": 0.0,
            "answer_relevance":    0.0,
            "retrieval_coverage":  0.0,
            "overall_score":       0.0,
            "num_chunks_retrieved": 0,
            "faithfulness_reason": "No chunks retrieved.",
        }

    q_emb = np.array(query_embedding)

    def cos(a, b):
        return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-8))

    # ── 1. Context Precision ──────────────────────────────────────────────
    rerank_scores      = [c.get("rerank_score", 0.0) for c in retrieved_chunks]
    norm_rerank        = [_sigmoid(s) for s in rerank_scores]
    context_precision  = float(np.mean(norm_rerank))

    # ── 2. Context Relevance ──────────────────────────────────────────────
    chunk_embs        = model.encode([c["text"] for c in retrieved_chunks], show_progress_bar=False)
    similarities      = [cos(q_emb, e) for e in chunk_embs]
    context_relevance = float(np.mean(similarities))

    # ── 3. Answer Relevance ───────────────────────────────────────────────
    ans_emb          = model.encode([answer], show_progress_bar=False)[0]
    answer_relevance = cos(q_emb, ans_emb)

    # ── 4. Retrieval Coverage ─────────────────────────────────────────────
    # Chunks with normalised reranker score ≥ 0.55 are considered "quality"
    quality_count      = sum(1 for s in norm_rerank if s >= 0.55)
    retrieval_coverage = quality_count / len(retrieved_chunks)

    # ── 5. Faithfulness (LLM judge) ───────────────────────────────────────
    # Use only top-3 chunks for the LLM call to keep latency low
    context_for_judge = "\n\n---\n\n".join(c["text"] for c in retrieved_chunks[:3])
    faithfulness, faith_reason = await _faithfulness_score(query, answer, context_for_judge)

    # ── Overall ───────────────────────────────────────────────────────────
    overall = float(np.mean([
        context_precision,
        context_relevance,
        faithfulness,
        answer_relevance,
    ]))

    return {
        "context_precision":    round(context_precision,  4),
        "context_relevance":    round(context_relevance,  4),
        "answer_faithfulness":  round(faithfulness,       4),
        "answer_relevance":     round(answer_relevance,   4),
        "retrieval_coverage":   round(retrieval_coverage, 4),
        "overall_score":        round(overall,            4),
        "num_chunks_retrieved": len(retrieved_chunks),
        "faithfulness_reason":  faith_reason,
        # Per-chunk scores (useful for debugging / advanced UI display)
        "chunk_scores": [
            {
                "id":             c["id"],
                "filename":       c.get("metadata", {}).get("filename", "?"),
                "rerank_score":   round(c.get("rerank_score",  0.0), 4),
                "rerank_norm":    round(_sigmoid(c.get("rerank_score", 0.0)), 4),
                "semantic_sim":   round(similarities[i],             4),
            }
            for i, c in enumerate(retrieved_chunks)
        ],
    }