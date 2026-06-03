import uuid, enum as py_enum
from datetime import datetime
from sqlalchemy import String, DateTime, Text, Enum, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base

class CollabStatus(str, py_enum.Enum):
    pending    = "pending"
    validating = "validating"
    forwarded  = "forwarded"
    answered   = "answered"
    rejected   = "rejected"

class CollabRequest(Base):
    __tablename__ = "collab_requests"

    id:              Mapped[str]          = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    requesting_hub:  Mapped[str]          = mapped_column(String(50))   # 'research' | 'developer'
    target_hub:      Mapped[str]          = mapped_column(String(50))   # 'research' | 'developer'
    reason:          Mapped[str]          = mapped_column(Text)
    help_needed:     Mapped[str]          = mapped_column(Text)
    parent_session_id: Mapped[str]        = mapped_column(String)       # which session triggered this
    status:          Mapped[CollabStatus] = mapped_column(Enum(CollabStatus), default=CollabStatus.pending)
    pm_verdict:      Mapped[str | None]   = mapped_column(Text, nullable=True)   # PM validation note
    answer:          Mapped[str | None]   = mapped_column(Text, nullable=True)   # response from target hub
    created_at:      Mapped[datetime]     = mapped_column(DateTime, default=datetime.utcnow)