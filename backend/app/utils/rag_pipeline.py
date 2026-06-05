"""
Advanced RAG Pipeline — RAG Master Hub

Techniques chained in order:
  1. Query Expansion        — LLM generates 3 alternative phrasings → broader retrieval
  2. HyDE                   — LLM writes a hypothetical answer → embed it for semantic alignment
  3. Hybrid Search          — Dense (ChromaDB / sentence-transformers) + Sparse (BM25Okapi)
  4. Reciprocal Rank Fusion — Merge both ranked lists with weighted RRF
  5. Cross-Encoder Reranking— Precise relevance scoring of the fused candidates
  6. MMR Deduplication      — Maximal Marginal Relevance for result diversity
  7. Contextual Compression — Extract the most relevant sentences per chunk
  8. Parent-Child Retrieval — Small chunks retrieved, large parent windows fed to LLM
  9. Answer Generation      — Groq LLM grounded strictly in retrieved context
 10. Evaluation Metrics     — Faithfulness, Context Precision, Relevance, Coverage
"""

import re
import json
import logging
import asyncio
from functools import lru_cache

import numpy as np
from rank_bm25 import BM25Okapi
from sentence_transformers import CrossEncoder
from langchain_core.messages import HumanMessage, SystemMessage

from app.core.config import settings
from app.utils.agents_extras import get_llm
from app.agents.rag.document_processor import (
    get_embedding_model,
    get_chroma_client,
    load_parents,
    load_corpus,
)

logger = logging.getLogger(__name__)


# ── Singleton: Cross-Encoder Reranker ─────────────────────────────────────

@lru_cache(maxsize=1)
def get_reranker() -> CrossEncoder:
    logger.info(f"[RAG] Loading reranker: {settings.RAG_RERANKER_MODEL}")
    return CrossEncoder(settings.RAG_RERANKER_MODEL)


# ── Step 1: Query Expansion ────────────────────────────────────────────────

async def expand_query(query: str) -> list[str]:
    """
    Generate 3 semantically distinct phrasings of the user query.
    All 4 (original + 3 variants) are used for both dense and BM25 searches.
    """
    llm = get_llm()
    try:
        response = await llm.ainvoke([
            SystemMessage(content=(
                "You are a query expansion specialist.\n"
                "Given a user question, output a JSON array of exactly 3 alternative "
                "phrasings that capture the same intent from different angles.\n"
                "Respond ONLY with a valid JSON array of 3 strings — no preamble."
            )),
            HumanMessage(content=f"Original query: {query}"),
        ])
        raw = re.sub(r"```json|```", "", response.content.strip()).strip()
        variants = json.loads(raw)
        if isinstance(variants, list) and variants:
            return [query] + [v for v in variants if isinstance(v, str)][:3]
    except Exception as e:
        logger.warning(f"[RAG] Query expansion failed: {e}")
    return [query]


# ── Step 2: HyDE — Hypothetical Document Embedding ────────────────────────

async def generate_hypothetical_document(query: str) -> str:
    """
    Ask the LLM to write a short passage that *would* answer the question.
    Embedding this hypothetical document then retrieves chunks with matching semantics,
    bridging the query-document vocabulary gap.
    """
    llm = get_llm()
    try:
        response = await llm.ainvoke([
            SystemMessage(content=(
                "You are a document generation assistant.\n"
                "Write a concise, factual passage (120–180 words) that directly answers "
                "the given question. Write as an expert author — be specific and use "
                "domain vocabulary naturally. Do NOT include 'Based on...' or 'According to...'."
            )),
            HumanMessage(content=f"Question: {query}"),
        ])
        return response.content.strip()
    except Exception as e:
        logger.warning(f"[RAG] HyDE generation failed: {e}")
        return query


# ── Step 3a: Dense Search ──────────────────────────────────────────────────

def _dense_search(
    session_id: str,
    query_embeddings: list[list[float]],
    top_k: int,
) -> list[dict]:
    """
    Query ChromaDB with every embedding (query variants + HyDE doc).
    Returns deduplicated results tagged with their best cosine similarity score.
    """
    client = get_chroma_client()
    col_name = f"rag_{session_id}"
    try:
        col = client.get_collection(col_name)
        total = col.count()
        if total == 0:
            return []
        n_results = min(top_k, total)
    except Exception:
        return []

    best: dict[str, dict] = {}   # id → chunk with best score

    for emb in query_embeddings:
        res = col.query(
            query_embeddings=[emb],
            n_results=n_results,
            include=["documents", "metadatas", "distances"],
        )
        if not res["ids"] or not res["ids"][0]:
            continue
        for i, chunk_id in enumerate(res["ids"][0]):
            score = 1.0 - res["distances"][0][i]   # cosine distance → similarity
            if chunk_id not in best or score > best[chunk_id]["dense_score"]:
                best[chunk_id] = {
                    "id":          chunk_id,
                    "text":        res["documents"][0][i],
                    "metadata":    res["metadatas"][0][i],
                    "dense_score": score,
                }

    return list(best.values())


# ── Step 3b: Sparse Search (BM25) ─────────────────────────────────────────

def _sparse_search(
    session_id: str,
    queries: list[str],
    top_k: int,
) -> list[dict]:
    """
    BM25Okapi search over all indexed child chunks.
    Runs all expanded queries and keeps the best score per chunk.
    """
    corpus = load_corpus(session_id)
    if not corpus:
        return []

    tokenized_corpus = [c["tokens"] for c in corpus]
    bm25 = BM25Okapi(tokenized_corpus)

    best_scores: dict[str, float] = {}

    for query in queries:
        tokens = query.lower().split()
        scores = bm25.get_scores(tokens)
        for idx, score in enumerate(scores):
            cid = corpus[idx]["id"]
            if cid not in best_scores or score > best_scores[cid]:
                best_scores[cid] = float(score)

    results = []
    for c in corpus:
        if c["id"] in best_scores:
            results.append({
                "id":           c["id"],
                "text":         c["text"],
                "metadata": {
                    "parent_id": c.get("parent_id", ""),
                    "doc_id":    c.get("doc_id", ""),
                    "filename":  c.get("filename", ""),
                },
                "sparse_score": best_scores[c["id"]],
            })

    results.sort(key=lambda x: x["sparse_score"], reverse=True)
    return results[:top_k]


# ── Step 4: Reciprocal Rank Fusion ────────────────────────────────────────

def _reciprocal_rank_fusion(
    dense: list[dict],
    sparse: list[dict],
    k: int = 60,
    dense_weight: float = 0.6,
    sparse_weight: float = 0.4,
) -> list[dict]:
    """
    Weighted RRF merges the two ranked lists.
    Dense gets higher weight since semantic similarity is usually more reliable.
    """
    rrf: dict[str, float] = {}
    pool: dict[str, dict] = {}

    for rank, item in enumerate(dense):
        cid = item["id"]
        rrf[cid] = rrf.get(cid, 0.0) + dense_weight / (k + rank + 1)
        pool[cid] = item

    for rank, item in enumerate(sparse):
        cid = item["id"]
        rrf[cid] = rrf.get(cid, 0.0) + sparse_weight / (k + rank + 1)
        if cid not in pool:
            pool[cid] = item

    merged = []
    for cid, score in sorted(rrf.items(), key=lambda x: x[1], reverse=True):
        chunk = pool[cid].copy()
        chunk["rrf_score"] = score
        merged.append(chunk)

    return merged


# ── Step 5: Cross-Encoder Reranking ───────────────────────────────────────

def _rerank(query: str, chunks: list[dict], top_n: int) -> list[dict]:
    """
    Score every (query, chunk) pair with a cross-encoder.
    Far more accurate than bi-encoder similarity for relevance ranking.
    """
    if not chunks:
        return []
    reranker = get_reranker()
    pairs  = [(query, c["text"]) for c in chunks]
    scores = reranker.predict(pairs)
    for chunk, score in zip(chunks, scores):
        chunk["rerank_score"] = float(score)
    chunks.sort(key=lambda x: x["rerank_score"], reverse=True)
    return chunks[:top_n]


# ── Step 6: MMR — Maximal Marginal Relevance ──────────────────────────────

def _mmr_deduplicate(
    query_embedding: list[float],
    chunks: list[dict],
    top_n: int,
    lambda_param: float = 0.7,
) -> list[dict]:
    """
    Pick `top_n` chunks that are both relevant (to query) and diverse (among themselves).
    λ=0.7 → slightly favours relevance over diversity.
    """
    if not chunks:
        return []

    model = get_embedding_model()
    embeddings = model.encode([c["text"] for c in chunks], show_progress_bar=False)
    q_emb = np.array(query_embedding)

    def cos(a, b):
        return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-8))

    relevance  = [cos(e, q_emb) for e in embeddings]
    selected: list[int] = []
    remaining  = list(range(len(chunks)))

    while len(selected) < min(top_n, len(chunks)) and remaining:
        if not selected:
            best = max(remaining, key=lambda i: relevance[i])
        else:
            scores = [
                (i, lambda_param * relevance[i]
                    - (1 - lambda_param) * max(cos(embeddings[i], embeddings[j]) for j in selected))
                for i in remaining
            ]
            best = max(scores, key=lambda x: x[1])[0]
        selected.append(best)
        remaining.remove(best)

    return [chunks[i] for i in selected]


# ── Step 7: Contextual Compression ────────────────────────────────────────

def _compress_chunk(query: str, text: str, max_sentences: int = 4) -> str:
    """
    Keep only the sentences in `text` most similar to `query`.
    Preserves original order of selected sentences.
    """
    model = get_embedding_model()
    sents = [s.strip() for s in re.split(r"(?<=[.!?])\s+", text) if len(s.strip()) > 20]
    if len(sents) <= max_sentences:
        return text

    q_emb   = model.encode([query], show_progress_bar=False)[0]
    s_embs  = model.encode(sents, show_progress_bar=False)

    def cos(a, b):
        return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-8))

    scored  = [(i, cos(q_emb, e)) for i, e in enumerate(s_embs)]
    top_idx = sorted(sorted(scored, key=lambda x: x[1], reverse=True)[:max_sentences])
    return " ".join(sents[i] for i, _ in top_idx)


# ── Step 8 + 9: Answer Generation with Parent Context ─────────────────────

async def _generate_answer(
    query: str,
    context_chunks: list[dict],
    parents: dict[str, str],
    chat_history: list[dict],
) -> str:
    """
    Build context from parent chunks (larger windows), then call the LLM.
    Chat history is included for multi-turn sessions.
    """
    llm = get_llm()

    # Retrieve parent texts for each unique parent_id in the top chunks
    parent_blocks: list[str] = []
    seen_parents: set[str] = set()
    for chunk in context_chunks:
        pid = chunk.get("metadata", {}).get("parent_id", "")
        if pid and pid not in seen_parents:
            parent_text = parents.get(pid, chunk["text"])
            fname = chunk.get("metadata", {}).get("filename", "document")
            parent_blocks.append(f"[Source: {fname}]\n{parent_text}")
            seen_parents.add(pid)

    context_str = "\n\n---\n\n".join(parent_blocks) if parent_blocks else "(no context)"

    # Last 3 turns of history (6 messages)
    history_str = ""
    if chat_history:
        turns = []
        for msg in chat_history[-6:]:
            role = "User" if msg["role"] == "user" else "Assistant"
            turns.append(f"{role}: {msg['content']}")
        history_str = "\n".join(turns)

    system_prompt = (
        "You are a precise RAG assistant. Answer the user's question using ONLY the "
        "provided context documents. Cite the source filename when quoting specific facts. "
        "If the context lacks sufficient information, explicitly say so — never hallucinate. "
        "Use clear formatting (headers, bullet points) when the answer has multiple parts."
    )

    user_content = (
        f"Context Documents:\n{context_str}\n\n"
        + (f"Conversation History:\n{history_str}\n\n" if history_str else "")
        + f"Question: {query}\n\nAnswer (based strictly on context above):"
    )

    response = await llm.ainvoke([
        SystemMessage(content=system_prompt),
        HumanMessage(content=user_content),
    ])
    return response.content.strip()


# ── Main Pipeline Entry Point ──────────────────────────────────────────────

async def run_rag_pipeline(
    session_id: str,
    query: str,
    chat_history: list[dict],
) -> dict:
    """
    Full 10-step advanced RAG pipeline.

    Returns:
      answer            : str
      retrieved_chunks  : list[dict]  (with all scores + compressed text)
      evaluation_metrics: dict
      expanded_queries  : list[str]
      hyde_document     : str
    """
    from app.agents.rag.evaluator import compute_metrics

    loop  = asyncio.get_event_loop()
    model = get_embedding_model()
    top_k = settings.RAG_TOP_K
    top_n = settings.RAG_RERANK_TOP_N

    # ── 1. Query Expansion ───────────────────────────────────────────────
    expanded_queries = await expand_query(query)

    # ── 2. HyDE ──────────────────────────────────────────────────────────
    hyde_doc = await generate_hypothetical_document(query)

    # ── 3. Embed (expanded queries + HyDE document) ──────────────────────
    all_texts  = expanded_queries + [hyde_doc]
    embeddings = await loop.run_in_executor(
        None,
        lambda: model.encode(all_texts, show_progress_bar=False).tolist(),
    )
    query_embedding = embeddings[0]   # original query embedding, used for MMR / metrics

    # ── 4. Hybrid Search ─────────────────────────────────────────────────
    dense_results, sparse_results = await asyncio.gather(
        loop.run_in_executor(None, lambda: _dense_search(session_id, embeddings, top_k)),
        loop.run_in_executor(None, lambda: _sparse_search(session_id, expanded_queries, top_k)),
    )

    if not dense_results and not sparse_results:
        return {
            "answer": (
                "No documents have been indexed in this session yet, or nothing relevant "
                "was found. Please upload documents first."
            ),
            "retrieved_chunks":   [],
            "evaluation_metrics": {},
            "expanded_queries":   expanded_queries,
            "hyde_document":      hyde_doc,
        }

    # ── 5. RRF Fusion ────────────────────────────────────────────────────
    fused = _reciprocal_rank_fusion(dense_results, sparse_results)

    # ── 6. Cross-Encoder Reranking ───────────────────────────────────────
    reranked = await loop.run_in_executor(
        None,
        lambda: _rerank(query, fused[: top_k], top_n * 2),
    )

    # ── 7. MMR Deduplication ─────────────────────────────────────────────
    diverse = await loop.run_in_executor(
        None,
        lambda: _mmr_deduplicate(query_embedding, reranked, top_n),
    )

    # ── 8. Contextual Compression ────────────────────────────────────────
    for chunk in diverse:
        chunk["compressed_text"] = _compress_chunk(query, chunk["text"])

    # ── 9. Load parent contexts + generate answer ────────────────────────
    parents = await loop.run_in_executor(None, lambda: load_parents(session_id))
    answer  = await _generate_answer(query, diverse, parents, chat_history)

    # ── 10. Evaluation Metrics ────────────────────────────────────────────
    metrics = await compute_metrics(
        query=query,
        answer=answer,
        retrieved_chunks=diverse,
        query_embedding=query_embedding,
        model=model,
    )

    # Build serialisable chunk summaries
    chunk_summaries = []
    for c in diverse:
        chunk_summaries.append({
            "id":              c["id"],
            "text":            c["text"],
            "compressed_text": c.get("compressed_text", c["text"]),
            "filename":        c.get("metadata", {}).get("filename", "unknown"),
            "parent_id":       c.get("metadata", {}).get("parent_id", ""),
            "scores": {
                "dense":   round(c.get("dense_score",  0.0), 4),
                "sparse":  round(c.get("sparse_score", 0.0), 4),
                "rrf":     round(c.get("rrf_score",    0.0), 4),
                "rerank":  round(c.get("rerank_score", 0.0), 4),
            },
        })

    return {
        "answer":             answer,
        "retrieved_chunks":   chunk_summaries,
        "evaluation_metrics": metrics,
        "expanded_queries":   expanded_queries,
        "hyde_document":      hyde_doc,
    }