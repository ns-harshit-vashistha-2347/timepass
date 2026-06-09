import uuid
import asyncio
import logging
from pathlib import Path

from fastapi import (
    APIRouter, Depends, HTTPException, UploadFile, File,
    BackgroundTasks, status,
)
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db, AsyncSessionLocal
from app.models.rag_session import (
    RAGSession, RAGDocument, RAGMessage,
    RAGSessionStatus, DocumentStatus,
)
from app.schemas.schema import (
    RAGSessionCreate, RAGSessionResponse,
    RAGDocumentResponse, RAGChatRequest, RAGChatResponse,
    RAGMessageResponse, RetrievedChunk, EvaluationMetrics,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/rag", tags=["RAG Master Hub"])

ALLOWED_EXTENSIONS = {"pdf", "docx", "doc", "md", "markdown", "txt"}
MAX_FILE_SIZE_MB   = 50

# get the extension of a filename
def _file_extension(filename: str) -> str:
    return Path(filename).suffix.lstrip(".").lower()


async def _process_document_background(
    session_id: str,
    doc_id: str,
    file_bytes: bytes,
    file_type: str,
    filename: str,
) -> None:
    """
    Background task: index the document and update its DB status.
    Uses its own DB session since the request session is already closed.
    """
    from app.utils.document_processor import index_document

    async with AsyncSessionLocal() as db:
        try:
            result = await db.execute(
                select(RAGDocument).where(RAGDocument.id == doc_id)
            )
            doc = result.scalar_one_or_none()
            if not doc:
                return

            loop = asyncio.get_event_loop()
            stats = await loop.run_in_executor(
                None,
                lambda: index_document(session_id, doc_id, file_bytes, file_type, filename),
            )

            doc.status      = DocumentStatus.ready
            doc.chunk_count = stats["chunk_count"]
            doc.char_count  = stats["char_count"]
            await db.commit()
            logger.info(f"[RAG] doc={doc_id} ready ({stats['chunk_count']} chunks)")

        except Exception as exc:
            logger.exception(f"[RAG] Indexing failed for doc={doc_id}: {exc}")
            try:
                result = await db.execute(
                    select(RAGDocument).where(RAGDocument.id == doc_id)
                )
                doc = result.scalar_one_or_none()
                if doc:
                    doc.status        = DocumentStatus.failed
                    doc.error_message = str(exc)[:500]
                    await db.commit()
            except Exception:
                pass


# ══════════════════════════════════════════════════════════════════════════════
# Session Endpoints
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/sessions", response_model=RAGSessionResponse, status_code=status.HTTP_201_CREATED)
async def create_session(
    payload: RAGSessionCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create a new RAG workspace for a user."""
    session = RAGSession(
        id      = str(uuid.uuid4()),
        user_id = payload.user_id,
        name    = payload.name,
        status  = RAGSessionStatus.active,
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return session


@router.get("/sessions/user/{user_id}", response_model=list[RAGSessionResponse])
async def list_user_sessions(
    user_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Return all RAG sessions for a user (newest first)."""
    result = await db.execute(
        select(RAGSession)
        .where(RAGSession.user_id == user_id)
        .order_by(RAGSession.created_at.desc())
    )
    return list(result.scalars().all())


@router.get("/sessions/{session_id}", response_model=RAGSessionResponse)
async def get_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(RAGSession).where(RAGSession.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def archive_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(RAGSession).where(RAGSession.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    session.status = RAGSessionStatus.archived
    await db.commit()


# ══════════════════════════════════════════════════════════════════════════════
# Document Endpoints
# ══════════════════════════════════════════════════════════════════════════════

@router.post(
    "/sessions/{session_id}/upload",
    response_model=list[RAGDocumentResponse],
    status_code=status.HTTP_202_ACCEPTED,
)
async def upload_documents(
    session_id: str,
    background_tasks: BackgroundTasks,
    files: list[UploadFile] = File(...),
    db: AsyncSession = Depends(get_db),
):
    """
    Upload one or more documents to a RAG session.
    Processing (embedding + indexing) happens in the background.
    Poll GET /documents/{doc_id} to check when status becomes 'ready'.
    """
    # Verify session exists
    result = await db.execute(select(RAGSession).where(RAGSession.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.status == RAGSessionStatus.archived:
        raise HTTPException(status_code=400, detail="Cannot upload to an archived session")

    created_docs: list[RAGDocument] = []

    for upload in files:
        ext = _file_extension(upload.filename or "file.txt")
        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"'{upload.filename}' — unsupported file type '{ext}'. "
                       f"Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}",
            )

        file_bytes = await upload.read()
        if len(file_bytes) > MAX_FILE_SIZE_MB * 1024 * 1024:
            raise HTTPException(
                status_code=413,
                detail=f"'{upload.filename}' exceeds the {MAX_FILE_SIZE_MB} MB limit.",
            )

        doc = RAGDocument(
            id         = str(uuid.uuid4()),
            session_id = session_id,
            filename   = upload.filename or "document",
            file_type  = ext,
            status     = DocumentStatus.processing,
        )
        db.add(doc)
        await db.flush()

        background_tasks.add_task(
            _process_document_background,
            session_id, doc.id, file_bytes, ext, upload.filename or "document",
        )
        created_docs.append(doc)

    await db.commit()
    for doc in created_docs:
        await db.refresh(doc)

    return created_docs


@router.get("/sessions/{session_id}/documents", response_model=list[RAGDocumentResponse])
async def list_documents(
    session_id: str,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(RAGDocument)
        .where(RAGDocument.session_id == session_id)
        .order_by(RAGDocument.created_at.desc())
    )
    return list(result.scalars().all())


@router.get("/sessions/{session_id}/documents/{doc_id}", response_model=RAGDocumentResponse)
async def get_document(
    session_id: str,
    doc_id: str,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(RAGDocument)
        .where(RAGDocument.id == doc_id, RAGDocument.session_id == session_id)
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc


@router.delete("/sessions/{session_id}/documents/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    session_id: str,
    doc_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Remove a document from the session and purge its chunks from the vector store."""
    from app.utils.document_processor import delete_doc_from_storage

    result = await db.execute(
        select(RAGDocument)
        .where(RAGDocument.id == doc_id, RAGDocument.session_id == session_id)
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, lambda: delete_doc_from_storage(session_id, doc_id))

    await db.delete(doc)
    await db.commit()


# ══════════════════════════════════════════════════════════════════════════════
# Chat Endpoints
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/sessions/{session_id}/chat", response_model=RAGChatResponse)
async def chat(
    session_id: str,
    payload: RAGChatRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Ask a question against indexed documents.

    Pipeline: Query Expansion → HyDE → Hybrid Search → RRF →
              Cross-Encoder Reranking → MMR → Contextual Compression →
              Parent Context Retrieval → LLM Answer → Evaluation Metrics
    """
    from app.utils.rag_pipeline import run_rag_pipeline

    # Verify session
    sess_result = await db.execute(select(RAGSession).where(RAGSession.id == session_id))
    session = sess_result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Check at least one document is ready
    docs_result = await db.execute(
        select(RAGDocument)
        .where(RAGDocument.session_id == session_id, RAGDocument.status == DocumentStatus.ready)
    )
    ready_docs = docs_result.scalars().all()
    if not ready_docs:
        raise HTTPException(
            status_code=400,
            detail="No documents are ready yet. Upload documents and wait for processing to complete.",
        )

    # Load recent chat history for multi-turn context
    hist_result = await db.execute(
        select(RAGMessage)
        .where(RAGMessage.session_id == session_id)
        .order_by(RAGMessage.created_at.desc())
        .limit(10)
    )
    recent_messages = list(reversed(hist_result.scalars().all()))
    chat_history = [{"role": m.role, "content": m.content} for m in recent_messages]

    # Store user message
    user_msg = RAGMessage(
        id         = str(uuid.uuid4()),
        session_id = session_id,
        role       = "user",
        content    = payload.query,
    )
    db.add(user_msg)
    await db.flush()

    # Run the RAG pipeline
    try:
        result = await run_rag_pipeline(
            session_id  = session_id,
            query       = payload.query,
            chat_history= chat_history,
        )
    except Exception as exc:
        logger.exception(f"[RAG] Pipeline error: {exc}")
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"RAG pipeline error: {exc}")

    # Store assistant message
    assistant_msg = RAGMessage(
        id                 = str(uuid.uuid4()),
        session_id         = session_id,
        role               = "assistant",
        content            = result["answer"],
        retrieved_chunks   = result["retrieved_chunks"],
        evaluation_metrics = result["evaluation_metrics"],
        expanded_queries   = result["expanded_queries"],
    )
    db.add(assistant_msg)
    await db.commit()

    # Build typed response
    chunks = [
        RetrievedChunk(
            id              = c["id"],
            text            = c["text"],
            compressed_text = c["compressed_text"],
            filename        = c["filename"],
            parent_id       = c["parent_id"],
            scores          = c["scores"],
        )
        for c in result["retrieved_chunks"]
    ]

    return RAGChatResponse(
        message_id         = assistant_msg.id,
        answer             = result["answer"],
        retrieved_chunks   = chunks,
        evaluation_metrics = result["evaluation_metrics"],
        expanded_queries   = result["expanded_queries"],
        hyde_document      = result["hyde_document"],
    )


@router.get("/sessions/{session_id}/messages", response_model=list[RAGMessageResponse])
async def get_messages(
    session_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Return the full conversation history for a RAG session."""
    result = await db.execute(
        select(RAGMessage)
        .where(RAGMessage.session_id == session_id)
        .order_by(RAGMessage.created_at.asc())
    )
    return list(result.scalars().all())