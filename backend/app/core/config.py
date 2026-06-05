"""
MODIFIED FILE: app/core/config.py
Changes: Added all RAG Master Hub configuration fields.
"""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # ── Existing settings (unchanged) ──────────────────────────────────────
    DATABASE_URL:       str = "postgresql+asyncpg://cyberhub:cyberhub123@localhost:5432/cyberhub_db"
    REDIS_URL:          str = "redis://localhost:6379/0"
    CELERY_BROKER_URL:  str = "redis://localhost:6379/1"
    GROQ_API_KEY:       str = ""
    RESEARCHER_MODEL:   str = "llama-3.1-8b-instant"
    GROQ_MODEL:         str = "llama-3.1-8b-instant"
    DEVELOPER_MODEL:    str = "llama-3.1-8b-instant"


    RAG_DATA_DIR: str = "./rag_data"

    # Bi-encoder for embedding child chunks and queries
    # 'all-MiniLM-L6-v2' is a good balance of speed and quality (~80 MB)
    # Upgrade to 'BAAI/bge-base-en-v1.5' for higher quality (~438 MB)
    RAG_EMBEDDING_MODEL: str = "BAAI/bge-base-en-v1.5"

    # Cross-encoder for reranking retrieved candidates
    # 'cross-encoder/ms-marco-MiniLM-L-6-v2' is fast and accurate
    # Upgrade to 'cross-encoder/ms-marco-MiniLM-L-12-v2' for higher quality
    RAG_RERANKER_MODEL: str = "cross-encoder/ms-marco-MiniLM-L-12-v2"

    # Parent chunk settings (large context windows fed to the LLM)
    RAG_PARENT_CHUNK_SIZE: int = 1200   # characters
    RAG_PARENT_OVERLAP:    int = 200    # characters of overlap between parents

    # Child chunk settings (small units embedded and searched)
    RAG_CHILD_CHUNK_SIZE: int = 350     # characters
    RAG_CHILD_OVERLAP:    int = 50      # characters of overlap between children

    # How many candidates to retrieve before reranking
    RAG_TOP_K: int = 20

    # How many chunks to keep after reranking + MMR (passed to the LLM as context)
    RAG_RERANK_TOP_N: int = 5

    class Config:
        env_file = ".env"
        extra    = "ignore"


settings = Settings()