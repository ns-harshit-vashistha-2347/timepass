from pydantic import BaseModel
from datetime import datetime
from typing import Any, Optional

from app.models.research        import SessionStatus
from app.models.dev_session     import SessionStatus as DevSessionStatus
from app.models.enquiry_session import EnquiryStatus
from app.models.agent           import SkillLevel, AgentStatus
from app.models.rag_session import DocumentStatus, RAGSessionStatus


# ── Shared ────────────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    pass

class UserResponse(BaseModel):
    id:         str
    name:       str
    created_at: datetime

    class Config:
        from_attributes = True


# ── Agent Hub ─────────────────────────────────────────────────────────────────

class AgentResponse(BaseModel):
    id:          str
    name:        str
    role:        str
    department:  str
    skill_level: SkillLevel
    status:      AgentStatus
    created_at:  datetime

    class Config:
        from_attributes = True


class AgentHubRequest(BaseModel):
    requesting_department: str
    role_needed:           str
    skill_level:           SkillLevel
    reason:                str
    session_id:            Optional[str] = None

class AgentHubResponse(BaseModel):
    request_id:    str
    spawned_agent: AgentResponse
    message:       str


# ── Research Hub ──────────────────────────────────────────────────────────────

class ResearchRequest(BaseModel):
    user_id: str
    topic:   str

class ResearchResponse(BaseModel):
    session_id: str
    status:     SessionStatus
    topic:      str
    message:    str

class ResearchResult(BaseModel):
    session_id:  str
    status:      SessionStatus
    topic:       str
    result:      Optional[str]
    agents_used: list[AgentResponse]


# ── Developer Hub ─────────────────────────────────────────────────────────────

class DevRequest(BaseModel):
    user_id: str
    query:   str

class DevResponse(BaseModel):
    session_id: str
    status:     DevSessionStatus
    query:      str
    message:    str

class DevResult(BaseModel):
    session_id:  str
    status:      DevSessionStatus
    query:       str
    result:      Optional[str]
    agents_used: list[AgentResponse]


# ── Enquiry Department ────────────────────────────────────────────────────────

class EnquiryRequest(BaseModel):
    user_id: str
    query:   str

class EnquiryResponse(BaseModel):
    enquiry_session_id: str
    status:             EnquiryStatus
    query:              str
    message:            str

class EnquiryResult(BaseModel):
    enquiry_session_id:  str
    status:              EnquiryStatus
    query:               str
    routing_decision:    Optional[list[str]]   # e.g. ["research", "developer"]
    reasoning:           Optional[str]
    research_session_id: Optional[str]
    dev_session_id:      Optional[str]


class RAGSessionCreate(BaseModel):
    user_id: str
    name: str
 
 
class RAGSessionResponse(BaseModel):
    id:         str
    user_id:    str
    name:       str
    status:     RAGSessionStatus
    created_at: datetime
 
    class Config:
        from_attributes = True
 
 
# ── Document ───────────────────────────────────────────────────────────────
 
class RAGDocumentResponse(BaseModel):
    id:            str
    session_id:    str
    filename:      str
    file_type:     str
    status:        DocumentStatus
    chunk_count:   int
    char_count:    int
    error_message: Optional[str] = None
    created_at:    datetime
 
    class Config:
        from_attributes = True
 
 
# ── Chat ───────────────────────────────────────────────────────────────────
 
class RAGChatRequest(BaseModel):
    query: str
 
 
class ChunkScore(BaseModel):
    dense:  float
    sparse: float
    rrf:    float
    rerank: float
 
 
class RetrievedChunk(BaseModel):
    id:              str
    text:            str
    compressed_text: str
    filename:        str
    parent_id:       str
    scores:          ChunkScore
 
 
class EvaluationMetrics(BaseModel):
    context_precision:    float
    context_relevance:    float
    answer_faithfulness:  float
    answer_relevance:     float
    retrieval_coverage:   float
    overall_score:        float
    num_chunks_retrieved: int
    faithfulness_reason:  str
    chunk_scores:         list[dict[str, Any]] = []
 
 
class RAGChatResponse(BaseModel):
    message_id:         str
    answer:             str
    retrieved_chunks:   list[RetrievedChunk]
    evaluation_metrics: EvaluationMetrics | dict
    expanded_queries:   list[str]
    hyde_document:      str
 
 
# ── Message History ────────────────────────────────────────────────────────
 
class RAGMessageResponse(BaseModel):
    id:                 str
    session_id:         str
    role:               str
    content:            str
    retrieved_chunks:   Optional[list[dict]] = None
    evaluation_metrics: Optional[dict]       = None
    expanded_queries:   Optional[list[str]]  = None
    created_at:         datetime
 
    class Config:
        from_attributes = True
