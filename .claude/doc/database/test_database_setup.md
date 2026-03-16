# Test Database Setup and Configuration Guide

## Overview

This guide provides comprehensive documentation for configuring pytest with PostgreSQL Docker containers for the Wippestoolen FastAPI application. It addresses the specific "Invalid host header" error and provides best practices for async database session management in tests.

## Quick Fix for "Invalid host header" Error

The current test failure is caused by FastAPI's host header validation. Here's the immediate fix:

### 1. Update AsyncClient Configuration in conftest.py

```python
@pytest_asyncio.fixture(scope="function")
async def client(async_session) -> AsyncGenerator[AsyncClient, None]:
    async def override_get_db():
        yield async_session
    
    app.dependency_overrides[get_db] = override_get_db
    
    # FIX: Add proper headers and disable host validation
    async with AsyncClient(
        transport=httpx.ASGITransport(app=app), 
        base_url="http://testserver",  # Use testserver instead of test
        headers={"Host": "testserver"}  # Add explicit host header
    ) as ac:
        yield ac
    
    app.dependency_overrides.clear()
```

### 2. Alternative Fix: Disable Host Validation

Add to your FastAPI app configuration (for tests only):

```python
# In tests/conftest.py - create test app instance
@pytest_asyncio.fixture(scope="function")
async def test_app():
    from fastapi import FastAPI
    from wippestoolen.app.main import app
    
    # Disable host validation for tests
    app.allow_origins = ["*"]
    return app

@pytest_asyncio.fixture(scope="function")
async def client(async_session, test_app) -> AsyncGenerator[AsyncClient, None]:
    async def override_get_db():
        yield async_session
    
    test_app.dependency_overrides[get_db] = override_get_db
    
    async with AsyncClient(
        transport=httpx.ASGITransport(app=test_app), 
        base_url="http://testserver"
    ) as ac:
        yield ac
    
    test_app.dependency_overrides.clear()
```

## Complete Test Database Configuration

### 1. Environment Variables for Tests

Create `.env.test` file:

```env
# Database Configuration for Tests
DATABASE_URL=postgresql+asyncpg://wippestoolen:password@localhost:5432/wippestoolen_test
TEST_DATABASE_URL=postgresql+asyncpg://wippestoolen:password@localhost:5432/wippestoolen_test

# Disable security features for faster tests
SECRET_KEY=test-secret-key-not-for-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# Test-specific settings
ENVIRONMENT=test
DEBUG=True
LOG_LEVEL=WARNING
```

### 2. Improved conftest.py with Better Error Handling

```python
import asyncio
import os
import sys
from typing import AsyncGenerator, Generator

import httpx
import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool
from sqlalchemy.exc import SQLAlchemyError

from wippestoolen.app.core.config import settings
from wippestoolen.app.core.database import Base, get_db
from wippestoolen.app.core.security import create_access_token, get_password_hash
from wippestoolen.app.main import app
from wippestoolen.app.models.user import User

# Test database configuration
TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL", 
    "postgresql+asyncpg://wippestoolen:password@localhost:5432/wippestoolen_test"
)

@pytest.fixture(scope="session")
def event_loop() -> Generator:
    """Create an instance of the default event loop for the test session."""
    if sys.platform.startswith("win"):
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
    
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()

@pytest_asyncio.fixture(scope="function")
async def async_engine():
    """Create async database engine for tests with proper cleanup."""
    engine = create_async_engine(
        TEST_DATABASE_URL,
        poolclass=NullPool,  # Disable connection pooling for tests
        echo=False,  # Set to True for SQL debugging
        future=True,
    )
    
    try:
        # Create all tables
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
            await conn.run_sync(Base.metadata.create_all)
        
        yield engine
        
    except SQLAlchemyError as e:
        print(f"Database setup error: {e}")
        raise
    finally:
        # Clean up - drop all tables and dispose engine
        try:
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.drop_all)
        except Exception as e:
            print(f"Database cleanup error: {e}")
        
        await engine.dispose()

@pytest_asyncio.fixture(scope="function")
async def async_session(async_engine) -> AsyncGenerator[AsyncSession, None]:
    """Create async database session for tests with transaction management."""
    async_session_maker = async_sessionmaker(
        async_engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autoflush=True,
        autocommit=False,
    )
    
    async with async_session_maker() as session:
        try:
            yield session
        finally:
            await session.close()

@pytest_asyncio.fixture(scope="function")
async def client(async_session) -> AsyncGenerator[AsyncClient, None]:
    """Create HTTP client for API testing with proper host configuration."""
    async def override_get_db():
        yield async_session
    
    app.dependency_overrides[get_db] = override_get_db
    
    # Configure client with proper headers to avoid host validation issues
    async with AsyncClient(
        transport=httpx.ASGITransport(app=app), 
        base_url="http://testserver",
        headers={
            "Host": "testserver",
            "Content-Type": "application/json",
        },
        timeout=30.0,
    ) as ac:
        yield ac
    
    # Clean up dependency overrides
    app.dependency_overrides.clear()

@pytest_asyncio.fixture
async def test_user(async_session: AsyncSession) -> User:
    """Create a test user for authentication tests."""
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
async def test_user2(async_session: AsyncSession) -> User:
    """Create a second test user for multi-user tests."""
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
async def auth_headers(test_user: User) -> dict:
    """Create authentication headers for test requests."""
    access_token = create_access_token(subject=test_user.email)
    return {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }

@pytest_asyncio.fixture
async def auth_headers2(test_user2: User) -> dict:
    """Create authentication headers for second test user."""
    access_token = create_access_token(subject=test_user2.email)
    return {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }

# Database health check fixture
@pytest_asyncio.fixture(scope="session", autouse=True)
async def check_database_connection():
    """Verify database connection before running tests."""
    engine = create_async_engine(TEST_DATABASE_URL, poolclass=NullPool)
    
    try:
        async with engine.connect() as conn:
            await conn.execute("SELECT 1")
        print("✅ Test database connection successful")
    except Exception as e:
        pytest.fail(f"❌ Cannot connect to test database: {e}")
    finally:
        await engine.dispose()
```

### 3. Test Database Isolation Strategies

#### Option A: Database per Test (Current Approach)
- **Pros**: Complete isolation, no test interference
- **Cons**: Slower tests due to schema recreation
- **Best for**: Small test suites, critical isolation needs

#### Option B: Transaction Rollback Strategy
```python
@pytest_asyncio.fixture(scope="function")
async def async_session_with_rollback(async_engine) -> AsyncGenerator[AsyncSession, None]:
    """Create session with transaction rollback for faster tests."""
    async with async_engine.connect() as connection:
        transaction = await connection.begin()
        
        async_session_maker = async_sessionmaker(
            bind=connection,
            class_=AsyncSession,
            expire_on_commit=False,
        )
        
        async with async_session_maker() as session:
            try:
                yield session
            finally:
                await transaction.rollback()
```

#### Option C: Separate Test Database
```python
# Create dedicated test database
TEST_DATABASE_URL = "postgresql+asyncpg://wippestoolen:password@localhost:5432/wippestoolen_test_isolated"

@pytest_asyncio.fixture(scope="session")
async def setup_test_database():
    """Set up dedicated test database once per test session."""
    engine = create_async_engine(TEST_DATABASE_URL, poolclass=NullPool)
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    yield
    
    # Optional: Clean up test data between test runs
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    
    await engine.dispose()
```

## Docker Integration

### 1. Docker Compose for Tests

Create `docker-compose.test.yml`:

```yaml
version: '3.8'

services:
  test-postgres:
    image: postgres:15-alpine
    container_name: wippestoolen-test-db
    environment:
      POSTGRES_USER: wippestoolen
      POSTGRES_PASSWORD: password
      POSTGRES_DB: wippestoolen_test
      POSTGRES_INITDB_ARGS: "--encoding=UTF-8 --lc-collate=C --lc-ctype=C"
    ports:
      - "5433:5432"  # Use different port to avoid conflicts
    volumes:
      - test_db_data:/var/lib/postgresql/data
    tmpfs:
      - /tmp
    command: |
      postgres
      -c log_statement=all
      -c log_destination=stderr
      -c log_min_duration_statement=0
      -c max_connections=200
      -c shared_buffers=128MB
      -c effective_cache_size=512MB
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U wippestoolen -d wippestoolen_test"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  test_db_data:
```

### 2. Test Database Initialization Script

Create `scripts/setup-test-db.py`:

```python
"""Script to set up test database for pytest."""

import asyncio
import os
from sqlalchemy.ext.asyncio import create_async_engine

from wippestoolen.app.core.database import Base

TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL", 
    "postgresql+asyncpg://wippestoolen:password@localhost:5433/wippestoolen_test"
)

async def setup_test_database():
    """Initialize test database schema."""
    engine = create_async_engine(TEST_DATABASE_URL, echo=True)
    
    try:
        async with engine.begin() as conn:
            # Drop and recreate all tables
            await conn.run_sync(Base.metadata.drop_all)
            await conn.run_sync(Base.metadata.create_all)
        
        print("✅ Test database initialized successfully")
        
    except Exception as e:
        print(f"❌ Test database setup failed: {e}")
        raise
    finally:
        await engine.dispose()

if __name__ == "__main__":
    asyncio.run(setup_test_database())
```

### 3. Connection Pool Configuration for Tests

```python
# In wippestoolen/app/core/database.py - add test configuration
import os
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy.pool import NullPool, StaticPool

def create_test_engine():
    """Create database engine optimized for testing."""
    return create_async_engine(
        os.getenv("TEST_DATABASE_URL", "postgresql+asyncpg://localhost/test"),
        
        # Connection pool settings for tests
        poolclass=NullPool,  # Disable pooling for predictable test behavior
        
        # Or use StaticPool for single connection
        # poolclass=StaticPool,
        # pool_size=1,
        # max_overflow=0,
        # pool_pre_ping=True,
        
        # Logging
        echo=False,  # Set to True for SQL debugging
        echo_pool=False,
        
        # Connection settings
        connect_args={
            "server_settings": {
                "application_name": "wippestoolen_tests",
                "jit": "off",  # Disable JIT for faster test startup
            }
        },
        
        # Performance settings for tests
        future=True,
        execution_options={"isolation_level": "AUTOCOMMIT"}
    )
```

## FastAPI Test Client Configuration

### 1. Alternative Client Configurations

#### Using TestClient (Synchronous)
```python
from fastapi.testclient import TestClient

@pytest.fixture(scope="function")
def sync_client(async_session) -> TestClient:
    """Synchronous test client - simpler but less realistic."""
    async def override_get_db():
        yield async_session
    
    app.dependency_overrides[get_db] = override_get_db
    
    with TestClient(app) as client:
        yield client
    
    app.dependency_overrides.clear()
```

#### Using httpx.AsyncClient with Custom Transport
```python
import httpx
from httpx._transports.asgi import ASGITransport

@pytest_asyncio.fixture(scope="function")
async def custom_client(async_session) -> AsyncGenerator[AsyncClient, None]:
    """Custom async client with advanced configuration."""
    async def override_get_db():
        yield async_session
    
    app.dependency_overrides[get_db] = override_get_db
    
    # Custom transport with specific settings
    transport = ASGITransport(
        app=app,
        root_path="",
        client=("testclient", 0),
    )
    
    async with AsyncClient(
        transport=transport,
        base_url="http://testserver",
        headers={
            "Host": "testserver",
            "User-Agent": "testclient",
            "Accept": "application/json",
            "Content-Type": "application/json",
        },
        timeout=httpx.Timeout(30.0),
        follow_redirects=True,
    ) as ac:
        yield ac
    
    app.dependency_overrides.clear()
```

### 2. Debugging Client Issues

```python
# Add to conftest.py for debugging
@pytest_asyncio.fixture
async def debug_client(async_session) -> AsyncGenerator[AsyncClient, None]:
    """Debug client with extensive logging."""
    import logging
    
    # Enable httpx debug logging
    logging.getLogger("httpx").setLevel(logging.DEBUG)
    
    async def override_get_db():
        yield async_session
    
    app.dependency_overrides[get_db] = override_get_db
    
    async with AsyncClient(
        transport=httpx.ASGITransport(app=app), 
        base_url="http://testserver",
        headers={"Host": "testserver"},
        event_hooks={
            "request": [lambda request: print(f"Request: {request.method} {request.url}")],
            "response": [lambda response: print(f"Response: {response.status_code} {response.text[:200]}")],
        }
    ) as ac:
        yield ac
    
    app.dependency_overrides.clear()
```

## Async Test Fixtures Architecture

### 1. User Authentication Fixtures

```python
@pytest_asyncio.fixture
async def authenticated_user_session(async_session: AsyncSession, test_user: User):
    """Fixture that provides both user and session for complex tests."""
    return {
        "user": test_user,
        "session": async_session,
        "user_id": test_user.id,
        "email": test_user.email,
    }

@pytest_asyncio.fixture
async def admin_user(async_session: AsyncSession) -> User:
    """Create admin user for authorization tests."""
    admin = User(
        email="admin@example.com",
        display_name="admin",
        password_hash=get_password_hash("adminpassword123"),
        first_name="Admin",
        last_name="User",
        is_active=True,
        is_verified=True,
        is_superuser=True,  # Assuming you have this field
    )
    
    async_session.add(admin)
    await async_session.commit()
    await async_session.refresh(admin)
    return admin
```

### 2. Test Data Seeding Fixtures

```python
@pytest_asyncio.fixture
async def sample_tools(async_session: AsyncSession, test_user: User):
    """Create sample tools for testing."""
    from wippestoolen.app.models.tool import Tool
    
    tools = [
        Tool(
            title="Test Drill",
            description="A test power drill",
            category="Power Tools",
            daily_rate=10.00,
            deposit_required=50.00,
            owner_id=test_user.id,
            location="Test City",
            is_available=True,
        ),
        Tool(
            title="Test Saw",
            description="A test circular saw",
            category="Power Tools",
            daily_rate=15.00,
            deposit_required=75.00,
            owner_id=test_user.id,
            location="Test City",
            is_available=True,
        ),
    ]
    
    for tool in tools:
        async_session.add(tool)
    
    await async_session.commit()
    
    for tool in tools:
        await async_session.refresh(tool)
    
    return tools

@pytest_asyncio.fixture
async def sample_booking(async_session: AsyncSession, test_user: User, test_user2: User, sample_tools):
    """Create sample booking for testing."""
    from wippestoolen.app.models.booking import Booking
    from datetime import datetime, timedelta
    
    booking = Booking(
        tool_id=sample_tools[0].id,
        borrower_id=test_user2.id,
        owner_id=test_user.id,
        start_date=datetime.utcnow() + timedelta(days=1),
        end_date=datetime.utcnow() + timedelta(days=3),
        total_cost=30.00,
        deposit_amount=50.00,
        status="pending",
    )
    
    async_session.add(booking)
    await async_session.commit()
    await async_session.refresh(booking)
    return booking
```

### 3. Error Handling Fixtures

```python
@pytest_asyncio.fixture
async def db_error_handler(async_session: AsyncSession):
    """Fixture for testing database error scenarios."""
    class DBErrorHandler:
        def __init__(self, session):
            self.session = session
        
        async def simulate_connection_error(self):
            """Simulate database connection error."""
            await self.session.close()
        
        async def simulate_constraint_violation(self):
            """Simulate foreign key constraint violation."""
            from wippestoolen.app.models.booking import Booking
            
            # Try to create booking with non-existent tool
            invalid_booking = Booking(
                tool_id=99999,  # Non-existent ID
                borrower_id=1,
                owner_id=1,
                start_date=datetime.utcnow(),
                end_date=datetime.utcnow() + timedelta(days=1),
                total_cost=10.00,
                status="pending",
            )
            
            self.session.add(invalid_booking)
            await self.session.commit()  # This should raise an error
    
    return DBErrorHandler(async_session)
```

## Performance Optimization

### 1. Connection Pool Settings for Tests

```python
# Fast test configuration
TEST_ENGINE_CONFIG = {
    "poolclass": NullPool,  # No connection pooling
    "echo": False,  # Disable SQL logging
    "future": True,
    "connect_args": {
        "server_settings": {
            "jit": "off",  # Disable JIT compilation
            "shared_preload_libraries": "",  # Minimize extensions
        }
    }
}

# Realistic test configuration (closer to production)
REALISTIC_TEST_ENGINE_CONFIG = {
    "pool_size": 5,
    "max_overflow": 10,
    "pool_pre_ping": True,
    "pool_recycle": 3600,
    "echo": False,
}
```

### 2. Parallel Test Execution

Update `pytest.ini`:

```ini
[tool:pytest]
minversion = 7.0
addopts = 
    -v
    --tb=short
    --strict-markers
    --asyncio-mode=auto
    --cov=wippestoolen
    --cov-report=html
    --cov-report=term-missing
    --cov-fail-under=80
    -n auto  # Run tests in parallel with pytest-xdist
testpaths = tests
python_files = test_*.py
python_classes = Test*
python_functions = test_*
asyncio_mode = auto
asyncio_default_fixture_loop_scope = function
filterwarnings =
    ignore::DeprecationWarning
    ignore::PendingDeprecationWarning
```

### 3. Test Database Cleanup Strategies

```python
@pytest_asyncio.fixture(scope="function", autouse=True)
async def cleanup_database(async_session: AsyncSession):
    """Automatically clean up database after each test."""
    yield
    
    # Clean up in reverse dependency order
    tables_to_clean = [
        "reviews", "bookings", "notifications", 
        "tools", "notification_preferences", "users"
    ]
    
    for table in tables_to_clean:
        await async_session.execute(f"DELETE FROM {table}")
    
    await async_session.commit()
```

## Troubleshooting Common Issues

### 1. "Invalid host header" Error
**Cause**: FastAPI/Starlette host validation
**Solutions**:
- Use `base_url="http://testserver"` with `Host: testserver` header
- Disable host validation in test configuration
- Use proper ASGI transport configuration

### 2. Async Session Management Issues
**Common Problems**:
- Session not properly closed
- Multiple sessions accessing same data
- Transaction not committed/rolled back

**Solutions**:
```python
# Always use async context managers
async with async_session_maker() as session:
    try:
        # Your test code
        await session.commit()
    except Exception:
        await session.rollback()
        raise
    finally:
        await session.close()
```

### 3. Connection Pool Exhaustion
**Symptoms**: Tests hanging or timeout errors
**Solutions**:
- Use `NullPool` for tests
- Ensure proper session cleanup
- Limit concurrent test execution

### 4. Foreign Key Constraint Violations
**Debugging**:
```python
# Add to test setup
@pytest_asyncio.fixture
async def debug_foreign_keys(async_session):
    """Enable foreign key debugging."""
    await async_session.execute("SET session_replication_role = replica;")  # PostgreSQL
    yield
    await async_session.execute("SET session_replication_role = origin;")
```

### 5. Test Data Isolation Issues
**Solutions**:
- Use separate test database
- Implement proper cleanup fixtures
- Use database transactions with rollback
- Clear dependency overrides after tests

## CI/CD Integration

### GitHub Actions Configuration

```yaml
# .github/workflows/test.yml
name: Run Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: wippestoolen
          POSTGRES_PASSWORD: password
          POSTGRES_DB: wippestoolen_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Set up Python
      uses: actions/setup-python@v4
      with:
        python-version: '3.13'
    
    - name: Install uv
      run: pip install uv
    
    - name: Install dependencies
      run: uv sync
    
    - name: Wait for PostgreSQL
      run: |
        timeout 30 bash -c 'until pg_isready -h localhost -p 5432; do sleep 1; done'
    
    - name: Run tests
      env:
        TEST_DATABASE_URL: postgresql+asyncpg://wippestoolen:password@localhost:5432/wippestoolen_test
      run: |
        source .venv/bin/activate
        pytest -v --cov=wippestoolen --cov-report=xml
    
    - name: Upload coverage
      uses: codecov/codecov-action@v3
```

## Best Practices Summary

### 1. Database Configuration
- Use separate test database or schema recreation
- Disable connection pooling with `NullPool`
- Configure appropriate timeouts and connection limits
- Use environment variables for test database URLs

### 2. FastAPI Client Setup
- Always use `base_url="http://testserver"`
- Include explicit `Host` header
- Configure proper timeouts and headers
- Use `ASGITransport` for async clients

### 3. Fixture Design
- Scope fixtures appropriately (`function` for data, `session` for setup)
- Always clean up resources (sessions, connections)
- Use dependency injection for test data
- Implement proper error handling

### 4. Performance Optimization
- Use `NullPool` for predictable test behavior
- Minimize database operations in fixtures
- Implement proper cleanup strategies
- Consider parallel test execution

### 5. Error Handling
- Always wrap database operations in try/except
- Implement proper session rollback
- Use health checks for database connectivity
- Add debugging fixtures for troubleshooting

This comprehensive guide should resolve your current "Invalid host header" issue and provide a solid foundation for test database management in your FastAPI application.