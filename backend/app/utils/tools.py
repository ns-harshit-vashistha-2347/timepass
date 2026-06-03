from langchain_core.tools import tool
from langchain_core.messages import ToolMessage


@tool
def web_search(query: str) -> str:
    """Search the web for current information, news, or general knowledge."""
    try:
        from duckduckgo_search import DDGS
        with DDGS() as ddgs:
            results = list(ddgs.text(query, max_results=3))
        if not results:
            return "No results found."
        return "\n\n".join(
            f"Title: {r['title']}\nSummary: {r['body']}\nURL: {r['href']}"
            for r in results
        )
    except Exception as e:
        return f"Web search failed: {e}"


@tool
def search_arxiv(query: str) -> str:
    """Search academic research papers on arxiv.org for scientific or technical topics."""
    try:
        import arxiv
        client = arxiv.Client()
        search = arxiv.Search(query=query, max_results=3,
                              sort_by=arxiv.SortCriterion.Relevance)
        results = []
        for paper in client.results(search):
            authors = ", ".join(a.name for a in paper.authors[:3])
            results.append(
                f"Title: {paper.title}\n"
                f"Authors: {authors}\n"
                f"Abstract: {paper.summary[:400]}...\n"
                f"URL: {paper.entry_id}"
            )
        return "\n\n".join(results) if results else "No papers found."
    except Exception as e:
        return f"Arxiv search failed: {e}"


@tool
def search_github(query: str) -> str:
    """Search GitHub for relevant repositories, code examples, or open-source projects."""
    try:
        from duckduckgo_search import DDGS
        with DDGS() as ddgs:
            results = list(ddgs.text(f"site:github.com {query}", max_results=3))
        if not results:
            return "No GitHub results found."
        return "\n\n".join(
            f"Title: {r['title']}\nDescription: {r['body']}\nURL: {r['href']}"
            for r in results
        )
    except Exception as e:
        return f"GitHub search failed: {e}"


@tool
def search_stackoverflow(query: str) -> str:
    """Search Stack Overflow for solutions, code fixes, or technical Q&A."""
    try:
        from duckduckgo_search import DDGS
        with DDGS() as ddgs:
            results = list(ddgs.text(f"site:stackoverflow.com {query}", max_results=3))
        if not results:
            return "No Stack Overflow results found."
        return "\n\n".join(
            f"Question: {r['title']}\nAnswer: {r['body']}\nURL: {r['href']}"
            for r in results
        )
    except Exception as e:
        return f"Stack Overflow search failed: {e}"


RESEARCH_TOOLS = [web_search, search_arxiv]
DEVELOPER_TOOLS = [web_search, search_github, search_stackoverflow]



async def run_with_tools(llm, tools: list, messages: list) -> str:
    """
    Runs an LLM with tool-calling in a loop until the model
    stops requesting tools and gives a final text response.
    The LLM decides IF and WHEN to call tools.
    """
    tool_map = {t.name: t for t in tools}
    llm_with_tools = llm.bind_tools(tools)

    response = await llm_with_tools.ainvoke(messages)
    messages = list(messages) + [response]

    # Keep looping while the model wants to call tools
    while response.tool_calls:
        for tc in response.tool_calls:
            selected_tool = tool_map.get(tc["name"])
            if selected_tool:
                result = selected_tool.invoke(tc["args"])
                messages.append(
                    ToolMessage(content=str(result), tool_call_id=tc["id"])
                )
        response = await llm_with_tools.ainvoke(messages)
        messages.append(response)

    return response.content