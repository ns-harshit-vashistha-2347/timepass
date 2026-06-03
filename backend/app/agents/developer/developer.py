from langgraph import graph
import operator
from typing import TypedDict, Annotated

from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import StateGraph, END, START
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.agents_hub.hub import agent_hub
from app.models.agent import Agent, SkillLevel, AgentStatus
from app.utils.agents_extras import get_llm
from app.utils.agents_prompt import major_developer_system_prompt
from app.utils.structured_output_file import DeveloperStructuredOutput


class DevState(TypedDict):
    query: str
    session_id: str
    plan: str
    agents_needed: list[dict]
    spawned_agents: list[Agent]
    work_pieces: Annotated[list[str], operator.add]
    final_output: str
    collab_result: str
    db: object            


async def major_dev_planning_node(state: DevState) -> dict:
    llm = get_llm(department_model="developer")
    dev_llm = llm.with_structured_output(DeveloperStructuredOutput)

    try:
        response = await dev_llm.ainvoke([
            SystemMessage(content=major_developer_system_prompt),
            HumanMessage(content=f"Developer task: {state['query']}"),
        ])
        return {"plan": response.plan, "agents_needed": response.agents_needed}

    except Exception as exc:
        print(f"[DevHub] Planning error — {exc}")
        return {
            "plan": f"Handle the developer task: {state['query']}",
            "agents_needed": [
                {"role": "Full Stack Developer", "skill_level": "senior", "focus": state["query"]}
            ],
        }


async def spawn_dev_agents_node(state: DevState) -> dict:
    db: AsyncSession = state["db"]
    spawned: list[Agent] = []

    for spec in state["agents_needed"]:
        skill = SkillLevel(spec.get("skill_level", "mid"))
        _, agent = await agent_hub.request_agent(
            db=db,
            requesting_department="developer",
            role_needed=spec["role"],
            skill_level=skill,
            reason=spec.get("focus", "Development task"),
            session_id=state["session_id"],
        )
        spawned.append(agent)

    return {"spawned_agents": spawned}


async def dev_work_node(state: DevState) -> dict:
    from app.utils.tools import DEVELOPER_TOOLS, run_with_tools

    llm = get_llm()
    pieces: list[str] = []

    for i, agent in enumerate(state["spawned_agents"]):
        focus = (
            state["agents_needed"][i].get("focus", state["query"])
            if i < len(state["agents_needed"])
            else state["query"]
        )

        system_prompt = agent_hub.get_agent_system_prompt(agent)

        messages = [
            SystemMessage(content=system_prompt + """
You have access to tools: web_search, search_github, and search_stackoverflow.
Use them only when you need to find real code examples, libraries, or solutions.
You do NOT have to use them — use your judgement.
After gathering any needed information, write your development contribution.
"""),
            HumanMessage(content=f"""
Development Plan: {state['plan']}
Your specific focus: {focus}
Overall task: {state['query']}

{f"Research context from Research Hub: {state['collab_result']}" if state.get('collab_result') else ""}

Provide your contribution to this development task.
Use tools if you need real code references, libraries, or Stack Overflow solutions.
Include code snippets, architecture decisions, and practical implementation notes.
""")
        ]

        content = await run_with_tools(llm, DEVELOPER_TOOLS, messages)
        pieces.append(f"## {agent.name} ({agent.role})\n{content}")
        agent.status = AgentStatus.busy

    return {"work_pieces": pieces}


async def synthesize_dev_node(state: DevState) -> dict:
    llm = get_llm()
    combined = "\n\n".join(state["work_pieces"])

    response = await llm.ainvoke([
        SystemMessage(content="""
You are the Lead Architect at Cyber Hub's Developer Hub.
You receive contributions from specialist developer agents and combine them
into one cohesive, actionable development guide.

Format your response with these sections:
- **Project Overview** — what we're building and why
- **Architecture & Tech Stack** — the chosen approach with justification
- **Implementation Plan** — step-by-step, broken down by component/layer
- **Key Code Patterns** — the most important snippets and patterns
- **Deployment & Next Steps** — how to ship it
Make it clear, practical, and immediately usable by a developer.
"""),
        HumanMessage(content=f"""
Task: {state['query']}
Development Plan: {state['plan']}

Agent Contributions:
{combined}

Synthesize the above into a complete, well-structured development guide.
"""),
    ])

    return {"final_output": response.content}


async def collab_check_node(state: DevState) -> dict:
    """Ask PM if Research Hub help is needed before starting dev work."""
    from app.utils.agents_extras import request_collab
    import json

    llm = get_llm()
    response = await llm.ainvoke([
        SystemMessage(content="""You are a Developer Major at Cyber Hub.
Decide if this development task needs help from the Research Hub.
Research Hub helps with: background knowledge, domain theory, data analysis, literature review.
Respond ONLY in JSON: {"needs_help": true/false, "reason": "one sentence", "help_needed": "specific question"}"""),
        HumanMessage(content=f"Task: {state['query']}\nPlan: {state['plan']}")
    ])

    try:
        decision = json.loads(response.content.strip())
    except Exception:
        return {"collab_result": ""}

    if not decision.get("needs_help", False):
        return {"collab_result": ""}

    result = await request_collab(
        requesting_hub="developer",
        target_hub="research",
        reason=decision["reason"],
        help_needed=decision["help_needed"],
        parent_session_id=state["session_id"],
        db=state["db"],
    )
    return {"collab_result": result}


def build_developer_graph():
    graph = StateGraph(DevState)

    graph.add_node("major_planning", major_dev_planning_node)
    graph.add_node("spawn_agents", spawn_dev_agents_node)
    graph.add_node("collab_check", collab_check_node)
    graph.add_node("dev_work", dev_work_node)
    graph.add_node("synthesize", synthesize_dev_node)

    graph.add_edge(START, "major_planning")
    graph.add_edge("major_planning", "collab_check")
    graph.add_edge("collab_check", "spawn_agents")
    graph.add_edge("spawn_agents", "dev_work")
    graph.add_edge("dev_work", "synthesize")
    graph.add_edge("synthesize", END)

    return graph.compile()


developer_graph = build_developer_graph()
