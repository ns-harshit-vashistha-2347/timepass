from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.models.collab_request import CollabRequest
import uuid

router = APIRouter(prefix="/collab", tags=["collaboration"])

@router.get("/{request_id}")
async def get_collab_request(request_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(CollabRequest).where(CollabRequest.id == request_id))
    req = result.scalar_one_or_none()
    if not req:
        from fastapi import HTTPException
        raise HTTPException(404, "Collab request not found")
    return {
        "id": req.id,
        "status": req.status,
        "requesting_hub": req.requesting_hub,
        "target_hub": req.target_hub,
        "pm_verdict": req.pm_verdict,
        "answer": req.answer,
    }