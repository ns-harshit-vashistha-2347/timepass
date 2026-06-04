from contextlib import asynccontextmanager

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import NullPool

from app.core.config import settings

engine = create_async_engine(settings.DATABASE_URL, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session


@asynccontextmanager
async def celery_db_session():
    task_engine = create_async_engine(
        settings.DATABASE_URL,
        echo=False,
        poolclass=NullPool,  # ← key fix: no pooling in Celery workers
    )
    session_factory = async_sessionmaker(task_engine, expire_on_commit=False)
    try:
        async with session_factory() as session:
            yield session
    finally:
        await task_engine.dispose()