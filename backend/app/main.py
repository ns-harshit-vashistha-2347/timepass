"""
MODIFIED FILE: app/main.py
Changes:
  1. Import rag_router from app.api.routes.rag
  2. Import app.models.rag_session  (so SQLAlchemy registers the tables)
  3. Register rag_router with app.include_router()
  4. Updated the root endpoint to list the RAG hub
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.database import engine, Base
from app.api.routes.users     import router as users_router
from app.api.routes.research  import router as research_router
from app.api.routes.hub       import router as hub_router
from app.api.routes.developer import router as developer_router
from app.api.routes.enquiry   import router as enquiry_router
from app.api.routes.collab    import router as collab_router
from app.api.routes.rag       import router as rag_router          # ← NEW


# Import all models so SQLAlchemy registers them before create_all
import app.models.user
import app.models.research
import app.models.agent
import app.models.agent_request
import app.models.dev_session
import app.models.enquiry_session
import app.models.collab_request
import app.models.rag_session                                       # ← NEW


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("✅ Database tables created")
    yield
    print("👋 Shutting down Cyber Hub")


app = FastAPI(
    title="Cyber Hub API",
    description=(
        "Multi-agent simulation platform — "
        "Enquiry Department → Research Hub & Developer Hub (via Agent Hub). "
        "Plus RAG Master Hub for document Q&A."
    ),
    version="0.3.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(users_router)
app.include_router(enquiry_router)    # smart front-door
app.include_router(research_router)   # direct research access
app.include_router(developer_router)  # direct developer access
app.include_router(hub_router)        # agent hub management
app.include_router(collab_router)     # inter-hub collaboration
app.include_router(rag_router)        # RAG Master Hub ← NEW


@app.get("/")
async def root():
    return {
        "status":  "online",
        "message": "Welcome to Cyber Hub 🤖",
        "areas":   [
            "Enquiry Department",
            "Research Hub",
            "Developer Hub",
            "Agent Hub",
            "RAG Master Hub",           # ← NEW
        ],
        "docs": "/docs",
    }


@app.get("/health")
async def health():
    return {"status": "healthy"}