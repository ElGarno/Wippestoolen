import asyncio
import os
from typing import AsyncGenerator, Generator

import httpx
import pytest
import pytest_asyncio
from httpx import AsyncClient
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool

from wippestoolen.app.core.config import settings
from wippestoolen.app.core.database import Base, get_db
from wippestoolen.app.core.security import create_access_token, get_password_hash
from wippestoolen.app.main import app
from wippestoolen.app.models.user import User

TEST_DATABASE_URL = "postgresql+asyncpg://wippestoolen:password@localhost:5432/wippestoolen_test"

@pytest.fixture(scope="session")
def event_loop() -> Generator:
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

@pytest_asyncio.fixture(scope="function")
async def async_engine():
    engine = create_async_engine(
        TEST_DATABASE_URL,
        poolclass=NullPool,
        echo=False,
    )
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    
    yield engine
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    
    await engine.dispose()

@pytest_asyncio.fixture(scope="function")
async def async_session(async_engine) -> AsyncGenerator[AsyncSession, None]:
    async_session_maker = async_sessionmaker(
        async_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )
    
    async with async_session_maker() as session:
        yield session

@pytest.fixture(scope="function")
def client(async_session) -> TestClient:
    async def override_get_db():
        yield async_session
    
    app.dependency_overrides[get_db] = override_get_db
    
    with TestClient(app) as tc:
        yield tc
    
    app.dependency_overrides.clear()

@pytest_asyncio.fixture
async def test_user(async_session) -> User:
    user = User(
        email="test@example.com",
        display_name="testuser",
        password_hash=get_password_hash("testpassword123"),
        first_name="Test",
        last_name="User",
        bio="Test bio",
        city="Test City",
        phone_number="+1234567890",
        is_active=True,
        is_verified=True,
    )
    async_session.add(user)
    await async_session.commit()
    await async_session.refresh(user)
    return user

@pytest_asyncio.fixture
async def test_user2(async_session) -> User:
    user = User(
        email="test2@example.com",
        display_name="testuser2",
        password_hash=get_password_hash("testpassword123"),
        first_name="Test",
        last_name="User 2",
        bio="Test bio 2",
        city="Test City 2",
        phone_number="+0987654321",
        is_active=True,
        is_verified=True,
    )
    async_session.add(user)
    await async_session.commit()
    await async_session.refresh(user)
    return user

@pytest_asyncio.fixture
async def auth_headers(test_user) -> dict:
    access_token = create_access_token(subject=test_user.email)
    return {"Authorization": f"Bearer {access_token}"}

@pytest_asyncio.fixture
async def auth_headers2(test_user2) -> dict:
    access_token = create_access_token(subject=test_user2.email)
    return {"Authorization": f"Bearer {access_token}"}