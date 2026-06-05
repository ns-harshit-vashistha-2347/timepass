import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, ForeignKey, Text, Enum, Integer, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
import enum as py_enum

from app.core.database import Base


class RAGSessionStatus(str, py_enum.Enum):
    active   = "active"
    archived = "archived"


class DocumentStatus(str, py_enum.Enum):
    processing = "processing"
    ready      = "ready"
    failed     = "failed"


class RAGSession(Base):
    __tablename__ = "rag_sessions"

    id:         Mapped[str]            = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id:    Mapped[str]            = mapped_column(String, ForeignKey("users.id"))
    name:       Mapped[str]            = mapped_column(String(200), nullable=False)
    status:     Mapped[RAGSessionStatus] = mapped_column(Enum(RAGSessionStatus), default=RAGSessionStatus.active)
    created_at: Mapped[datetime]       = mapped_column(DateTime, default=datetime.utcnow)

    documents: Mapped[list["RAGDocument"]] = relationship(back_populates="session", cascade="all, delete-orphan")
    messages:  Mapped[list["RAGMessage"]]  = relationship(back_populates="session", cascade="all, delete-orphan")


class RAGDocument(Base):
    __tablename__ = "rag_documents"

    id:            Mapped[str]           = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id:    Mapped[str]           = mapped_column(String, ForeignKey("rag_sessions.id"))
    filename:      Mapped[str]           = mapped_column(String(500), nullable=False)
    file_type:     Mapped[str]           = mapped_column(String(20), nullable=False)   # pdf | docx | md | txt
    status:        Mapped[DocumentStatus] = mapped_column(Enum(DocumentStatus), default=DocumentStatus.processing)
    chunk_count:   Mapped[int]           = mapped_column(Integer, default=0)
    char_count:    Mapped[int]           = mapped_column(Integer, default=0)
    error_message: Mapped[str | None]    = mapped_column(Text, nullable=True)
    created_at:    Mapped[datetime]      = mapped_column(DateTime, default=datetime.utcnow)

    session: Mapped["RAGSession"] = relationship(back_populates="documents")


class RAGMessage(Base):
    __tablename__ = "rag_messages"

    id:                 Mapped[str]       = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id:         Mapped[str]       = mapped_column(String, ForeignKey("rag_sessions.id"))
    role:               Mapped[str]       = mapped_column(String(20), nullable=False)  # "user" | "assistant"
    content:            Mapped[str]       = mapped_column(Text, nullable=False)
    # Populated only for assistant messages
    retrieved_chunks:   Mapped[dict | None] = mapped_column(JSON, nullable=True)
    evaluation_metrics: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    expanded_queries:   Mapped[list | None] = mapped_column(JSON, nullable=True)
    created_at:         Mapped[datetime]  = mapped_column(DateTime, default=datetime.utcnow)

    session: Mapped["RAGSession"] = relationship(back_populates="messages")