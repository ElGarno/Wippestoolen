"""Database configuration and session management."""

from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from wippestoolen.app.core.config import settings


class Base(DeclarativeBase):
    """Base class for all database models."""

    pass


# Create async database engine
# Convert sslmode parameter to ssl parameter for asyncpg compatibility
async_db_url = settings.database_url.replace("postgresql://", "postgresql+asyncpg://")
async_db_url = async_db_url.replace("sslmode=require", "ssl=require")

engine = create_async_engine(
    async_db_url,
    echo=settings.DEBUG,
    pool_size=20,
    max_overflow=30,
    pool_pre_ping=True,
    pool_recycle=3600,
)

# Create session factory
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    autoflush=False,
    autocommit=False,
    expire_on_commit=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Get database session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()