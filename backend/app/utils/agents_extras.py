from langchain_groq import ChatGroq
from app.core.config import settings


from app.models.agent import SkillLevel


AGENT_NAMES = [
    "Nova", "Atlas", "Lyra", "Orion", "Sage", "Echo", "Flux",
    "Cleo", "Rex", "Zara", "Blaze", "Coda", "Dune", "Fern",
    "Gale", "Haze", "Iris", "Jade", "Kite", "Luna"
]


def get_llm(department_model: str = "researcher") -> ChatGroq:
    return ChatGroq(
        model=getattr(settings, f"{department_model.upper()}_MODEL", settings.GROQ_MODEL),
        api_key=settings.GROQ_API_KEY
    )


async def request_collab(requesting_hub: str, target_hub: str,
                          reason: str, help_needed: str,
                          parent_session_id: str, db) -> str:
    from app.models.collab_request import CollabRequest, CollabStatus
    from app.agents.project_manager.project_manager import validate_collab_request
    import uuid

    req = CollabRequest(
        id=str(uuid.uuid4()),
        requesting_hub=requesting_hub,
        target_hub=target_hub,
        reason=reason,
        help_needed=help_needed,
        parent_session_id=parent_session_id,
        status=CollabStatus.pending,
    )
    db.add(req)
    await db.flush()

    req.status = CollabStatus.validating
    await db.flush()

    verdict = await validate_collab_request(requesting_hub, target_hub, reason, help_needed)
    req.pm_verdict = verdict.reason

    if not verdict.approved:
        req.status = CollabStatus.rejected
        await db.commit()
        return f"[Collaboration request rejected by Project Manager: {verdict.reason}]"

    req.status = CollabStatus.forwarded
    await db.flush()

    if target_hub == 'research':
        from app.agents.research.researcher import research_graph
        state = await research_graph.ainvoke({
            "topic": verdict.refined_question,
            "session_id": req.id,
            "plan": "", "agents_needed": [],
            "spawned_agents": [], "research_pieces": [],
            "final_report": "", "db": db,
        })
        answer = state["final_report"]
        
    elif target_hub == 'developer':
        from app.agents.developer.developer import developer_graph
        state = await developer_graph.ainvoke({
            "query": verdict.refined_question,
            "session_id": req.id,
            "plan": "", "agents_needed": [],
            "spawned_agents": [], "work_pieces": [],
            "final_output": "", "db": db,
        })
        answer = state["final_output"]
    else:
        answer = "Unknown hub"

    req.answer = answer
    req.status = CollabStatus.answered
    await db.commit()
    return answer


