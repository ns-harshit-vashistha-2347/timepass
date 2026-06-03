from pydantic import BaseModel
from app.utils.agents_extras import get_llm  

class PMVerdict(BaseModel):
    approved: bool
    reason:   str
    refined_question: str   

async def validate_collab_request(requesting_hub: str, target_hub: str,
                                   reason: str, help_needed: str) -> PMVerdict:
    llm = get_llm().with_structured_output(PMVerdict)
    prompt = f"""
    You are the Project Manager overseeing a multi-hub AI company.
    The {requesting_hub} hub is asking the {target_hub} hub for help.

    Reason given: {reason}
    Help needed: {help_needed}

    Decide if this collaboration request is valid and necessary.
    If approved, refine the question for clarity before forwarding.
    """
    return await llm.ainvoke(prompt)