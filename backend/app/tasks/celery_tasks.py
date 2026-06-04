import json
import asyncio
import traceback

from app.tasks.celery_app import celery_app


@celery_app.task(name="run_research")
def run_research_task(session_id: str, query: str):
    try:
        asyncio.run(_async_research(session_id, query))
    except Exception:
        raise


async def _async_research(session_id: str, topic: str):
    from app.core.database import celery_db_session
    from app.agents.research.researcher import research_graph
    import app.models as models
    from sqlalchemy import select

    async with celery_db_session() as db:
        session = None
        try:
            result = await db.execute(
                select(models.ResearchSession).where(models.ResearchSession.id == session_id)
            )
            session = result.scalar_one_or_none()
            if not session:
                return

            session.status = models.SessionStatus.processing
            await db.commit()

            final_state = await research_graph.ainvoke({
                "topic": topic,
                "session_id": session_id,
                "plan": "",
                "agents_needed": [],
                "spawned_agents": [],
                "research_pieces": [],
                "final_report": "",
                "collab_result": "",
                "db": db,
            })

            session.result = final_state["final_report"]
            session.status = models.SessionStatus.completed

            agents_result = await db.execute(
                select(models.Agent).where(models.Agent.session_id == session_id)
            )
            for agent in agents_result.scalars().all():
                agent.status = models.AgentStatus.released

            await db.commit()

        except Exception as exc:
            traceback.print_exc()
            if session:
                session.status = models.SessionStatus.failed
                session.result = f"Research failed: {exc}"
                await db.commit()
            raise


# ═══════════════════════════════════════════════════════════════════════════════
# Developer task
# ═══════════════════════════════════════════════════════════════════════════════

@celery_app.task(name="run_developer")
def run_developer_task(session_id: str, query: str):
    try:
        asyncio.run(_async_developer(session_id, query))
    except Exception:
        raise


async def _async_developer(session_id: str, query: str):
    from app.core.database import celery_db_session
    from app.agents.developer.developer import developer_graph
    from app.models.dev_session import SessionStatus as DevSessionStatus
    import app.models as models
    from sqlalchemy import select

    async with celery_db_session() as db:
        session = None
        try:
            result = await db.execute(
                select(models.DevSession).where(models.DevSession.id == session_id)
            )
            session = result.scalar_one_or_none()
            if not session:
                return

            session.status = DevSessionStatus.processing
            await db.commit()

            final_state = await developer_graph.ainvoke({
                "query": query,
                "session_id": session_id,
                "plan": "",
                "agents_needed": [],
                "spawned_agents": [],
                "work_pieces": [],
                "final_output": "",
                "collab_result": "",
                "db": db,
            })

            session.result = final_state["final_output"]
            session.status = DevSessionStatus.completed

            agents_result = await db.execute(
                select(models.Agent).where(models.Agent.session_id == session_id)
            )
            for agent in agents_result.scalars().all():
                agent.status = models.AgentStatus.released

            await db.commit()

        except Exception as exc:
            traceback.print_exc()
            if session:
                session.status = DevSessionStatus.failed
                session.result = f"Developer task failed: {exc}"
                await db.commit()
            raise


# ═══════════════════════════════════════════════════════════════════════════════
# Enquiry task  — routes the query then fires the relevant hub task(s)
# ═══════════════════════════════════════════════════════════════════════════════

@celery_app.task(name="run_enquiry")
def run_enquiry_task(session_id: str, query: str, user_id: str):
    # Use asyncio.run() — same pattern as the other tasks.
    # It creates a fresh event loop, runs the coroutine, then closes the loop.
    # Combined with NullPool in celery_db_session(), there are no stale
    # connections left over from a previous task's loop.
    try:
        asyncio.run(_async_enquiry(session_id, query, user_id))
    except Exception:
        raise


async def _async_enquiry(session_id: str, query: str, user_id: str):
    """
    1. Call the Enquiry Department LLM to decide which hub(s) to use.
    2. Create a session in each chosen hub.
    3. Fire the corresponding Celery task for each hub.
    4. Store the hub session IDs back on the EnquirySession row.
    """
    from app.core.database import celery_db_session
    from app.agents.enquiry.enquiry import route_query
    from app.models.enquiry_session import EnquirySession, EnquiryStatus
    from app.models.research import ResearchSession, SessionStatus as ResearchStatus
    from app.models.dev_session import DevSession, SessionStatus as DevStatus
    from sqlalchemy import select
    import uuid

    async with celery_db_session() as db:
        enq_session = None
        try:
            result = await db.execute(
                select(EnquirySession).where(EnquirySession.id == session_id)
            )
            enq_session = result.scalar_one_or_none()
            if not enq_session:
                return

            # ── Step 1: Route ────────────────────────────────────────────────
            enq_session.status = EnquiryStatus.routing
            await db.commit()

            decision = await route_query(query)

            enq_session.routing_decision = json.dumps(decision.hubs)
            enq_session.reasoning = decision.reasoning

            # ── Step 2 & 3: Spawn hub sessions + fire tasks ──────────────────
            for hub_name in decision.hubs:

                if hub_name == "research":
                    new_session = ResearchSession(
                        id=str(uuid.uuid4()),
                        user_id=user_id,
                        topic=query,
                        status=ResearchStatus.pending,
                    )
                    db.add(new_session)
                    await db.flush()
                    enq_session.research_session_id = new_session.id
                    run_research_task.delay(new_session.id, query)

                elif hub_name == "developer":
                    new_session = DevSession(
                        id=str(uuid.uuid4()),
                        user_id=user_id,
                        query=query,
                        status=DevStatus.pending,
                    )
                    db.add(new_session)
                    await db.flush()
                    enq_session.dev_session_id = new_session.id
                    run_developer_task.delay(new_session.id, query)

                # ── Adding a new hub ─────────────────────────────────────────
                # elif hub_name == "your_new_hub":
                #     new_session = YourHubSession(id=..., user_id=user_id, ...)
                #     db.add(new_session); await db.flush()
                #     enq_session.your_hub_session_id = new_session.id
                #     run_your_hub_task.delay(new_session.id, query)

            enq_session.status = EnquiryStatus.dispatched
            await db.commit()

        except Exception as exc:
            traceback.print_exc()
            if enq_session:
                enq_session.status = EnquiryStatus.failed
                await db.commit()
            raise