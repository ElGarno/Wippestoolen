# FastAPI Test Fixture Best Practices and Patterns

## Executive Summary

This document provides comprehensive guidance for implementing robust, scalable test fixtures in FastAPI applications with async SQLAlchemy, JWT authentication, and complex business logic. It addresses common issues like "Invalid host header" errors, async session management, authentication patterns, and test optimization strategies.

## Current Context

**Project**: Wippestoolen Tool-Sharing Platform
**Status**: 55+ tests failing with "Invalid host header" errors
**Stack**: FastAPI + SQLAlchemy async + PostgreSQL + JWT auth
**Test Framework**: pytest + pytest-asyncio + httpx

**Immediate Issues to Resolve**:
- `httpx.AsyncClient` configuration causing host header validation failures
- Async database session lifecycle management
- Authentication token generation and header injection
- Test fixture dependency chains and cleanup strategies

---

## 1. FastAPI Test Client Configuration

### Problem: "Invalid host header" Error

The current test configuration uses `base_url="http://test"` which triggers FastAPI's host header validation. This is a security feature that prevents host header injection attacks.

### Solution: Proper ASGI Transport Configuration

#### ❌ Current Problematic Configuration
```python
# tests/conftest.py - CURRENT (FAILING)
async with AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as ac:
    yield ac
```

#### ✅ Recommended Solutions

**Option 1: Use Standard Test Server Host**
```python
# tests/conftest.py - RECOMMENDED APPROACH
@pytest_asyncio.fixture(scope="function")
async def client(async_session) -> AsyncGenerator[AsyncClient, None]:
    async def override_get_db():
        yield async_session
    
    app.dependency_overrides[get_db] = override_get_db
    
    # Use testserver hostname to avoid host header validation
    async with AsyncClient(
        transport=httpx.ASGITransport(app=app), 
        base_url="http://testserver",
        headers={"Host": "testserver"}
    ) as ac:
        yield ac
    
    app.dependency_overrides.clear()
```

**Option 2: Disable Host Header Validation for Tests**
```python
# Alternative: Configure app with disabled validation
from fastapi import FastAPI
from fastapi.middleware.trustedhost import TrustedHostMiddleware

def create_test_app():
    test_app = FastAPI(title="Wippestoolen Test")
    
    # Add trusted host middleware with wildcard for tests
    test_app.add_middleware(
        TrustedHostMiddleware, 
        allowed_hosts=["*"]  # Allow all hosts in test environment
    )
    
    # Include your regular routes
    test_app.include_router(api_router, prefix="/api/v1")
    return test_app

@pytest_asyncio.fixture(scope="function")
async def client(async_session) -> AsyncGenerator[AsyncClient, None]:
    test_app = create_test_app()
    
    async def override_get_db():
        yield async_session
    
    test_app.dependency_overrides[get_db] = override_get_db
    
    async with AsyncClient(
        transport=httpx.ASGITransport(app=test_app), 
        base_url="http://testclient"
    ) as ac:
        yield ac
```

**Option 3: TestClient for Synchronous Tests (When Applicable)**
```python
from fastapi.testclient import TestClient

@pytest.fixture(scope="function")
def sync_client(async_session):
    """Use for non-async endpoint testing"""
    def override_get_db():
        # Note: TestClient handles async/sync bridge automatically
        yield async_session
    
    app.dependency_overrides[get_db] = override_get_db
    
    with TestClient(app) as client:
        yield client
    
    app.dependency_overrides.clear()
```

### Best Practices for Client Configuration

#### Headers and Middleware Management
```python
@pytest_asyncio.fixture(scope="function")
async def client_with_common_headers(async_session) -> AsyncGenerator[AsyncClient, None]:
    """Client with common headers pre-configured"""
    async def override_get_db():
        yield async_session
    
    app.dependency_overrides[get_db] = override_get_db
    
    common_headers = {
        "Host": "testserver",
        "User-Agent": "pytest-httpx/test",
        "Accept": "application/json",
        "Content-Type": "application/json"
    }
    
    async with AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url="http://testserver",
        headers=common_headers,
        timeout=30.0  # Increase timeout for debugging
    ) as ac:
        yield ac
    
    app.dependency_overrides.clear()
```

#### Timeout and Connection Configuration
```python
# Configure for different test scenarios
FAST_CLIENT_CONFIG = {
    "timeout": 5.0,
    "limits": httpx.Limits(max_keepalive_connections=5, max_connections=10)
}

SLOW_CLIENT_CONFIG = {
    "timeout": 30.0,
    "limits": httpx.Limits(max_keepalive_connections=10, max_connections=20)
}

@pytest_asyncio.fixture(scope="function") 
async def fast_client(async_session) -> AsyncGenerator[AsyncClient, None]:
    """For unit tests that should complete quickly"""
    # Implementation with FAST_CLIENT_CONFIG
    
@pytest_asyncio.fixture(scope="function")
async def integration_client(async_session) -> AsyncGenerator[AsyncClient, None]:
    """For integration tests that may take longer"""
    # Implementation with SLOW_CLIENT_CONFIG
```

---

## 2. Authentication Test Patterns

### JWT Token Generation and Management

#### Comprehensive Auth Fixture Architecture
```python
# tests/conftest.py - AUTH FIXTURES
from typing import Dict, Optional
from wippestoolen.app.core.security import create_access_token, get_password_hash
from wippestoolen.app.models.user import User

@pytest_asyncio.fixture
async def password_hash() -> str:
    """Reusable password hash for test users"""
    return get_password_hash("testpassword123")

@pytest_asyncio.fixture
async def test_user(async_session, password_hash) -> User:
    """Primary test user with complete profile"""
    user = User(
        email="test@example.com",
        display_name="testuser",
        password_hash=password_hash,
        first_name="Test",
        last_name="User",
        bio="Test bio for primary user",
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
async def test_tool_owner(async_session, password_hash) -> User:
    """User who owns tools for borrowing tests"""
    user = User(
        email="owner@example.com",
        display_name="toolowner",
        password_hash=password_hash,
        first_name="Tool",
        last_name="Owner",
        bio="I have lots of tools to share",
        city="Tool City",
        phone_number="+1111111111",
        is_active=True,
        is_verified=True,
    )
    async_session.add(user)
    await async_session.commit()
    await async_session.refresh(user)
    return user

@pytest_asyncio.fixture
async def test_borrower(async_session, password_hash) -> User:
    """User who borrows tools"""
    user = User(
        email="borrower@example.com",
        display_name="borrower",
        password_hash=password_hash,
        first_name="Tool",
        last_name="Borrower",
        bio="I need to borrow tools occasionally",
        city="Borrower City", 
        phone_number="+2222222222",
        is_active=True,
        is_verified=True,
    )
    async_session.add(user)
    await async_session.commit()
    await async_session.refresh(user)
    return user

@pytest_asyncio.fixture
async def admin_user(async_session, password_hash) -> User:
    """Admin user for administrative tests"""
    user = User(
        email="admin@example.com",
        display_name="admin",
        password_hash=password_hash,
        first_name="Admin",
        last_name="User",
        bio="System administrator",
        city="Admin City",
        phone_number="+9999999999",
        is_active=True,
        is_verified=True,
        is_admin=True,  # Assuming you have admin field
    )
    async_session.add(user)
    await async_session.commit() 
    await async_session.refresh(user)
    return user
```

#### Token Generation with Custom Claims
```python
@pytest_asyncio.fixture
async def auth_headers(test_user) -> Dict[str, str]:
    """Standard authentication headers"""
    access_token = create_access_token(
        subject=test_user.email,
        # Add custom claims if needed
        extra_claims={"user_id": test_user.id, "role": "user"}
    )
    return {"Authorization": f"Bearer {access_token}"}

@pytest_asyncio.fixture  
async def owner_auth_headers(test_tool_owner) -> Dict[str, str]:
    """Auth headers for tool owner"""
    access_token = create_access_token(
        subject=test_tool_owner.email,
        extra_claims={"user_id": test_tool_owner.id, "role": "owner"}
    )
    return {"Authorization": f"Bearer {access_token}"}

@pytest_asyncio.fixture
async def borrower_auth_headers(test_borrower) -> Dict[str, str]:
    """Auth headers for borrower"""
    access_token = create_access_token(
        subject=test_borrower.email,
        extra_claims={"user_id": test_borrower.id, "role": "borrower"}
    )
    return {"Authorization": f"Bearer {access_token}"}

@pytest_asyncio.fixture
async def admin_auth_headers(admin_user) -> Dict[str, str]:
    """Auth headers for admin user"""
    access_token = create_access_token(
        subject=admin_user.email,
        extra_claims={"user_id": admin_user.id, "role": "admin", "is_admin": True}
    )
    return {"Authorization": f"Bearer {access_token}"}
```

#### Advanced Authentication Scenarios
```python
@pytest_asyncio.fixture
async def expired_token_headers(test_user) -> Dict[str, str]:
    """Headers with expired token for testing token validation"""
    from datetime import datetime, timedelta
    
    # Create token that expired 1 hour ago
    expired_token = create_access_token(
        subject=test_user.email,
        expires_delta=timedelta(hours=-1)  # Already expired
    )
    return {"Authorization": f"Bearer {expired_token}"}

@pytest_asyncio.fixture
async def invalid_token_headers() -> Dict[str, str]:
    """Headers with malformed token"""
    return {"Authorization": "Bearer invalid.jwt.token"}

@pytest_asyncio.fixture
async def missing_auth_headers() -> Dict[str, str]:
    """Headers without authorization for unauthorized tests"""
    return {"Content-Type": "application/json"}

# Parameterized authentication scenarios
@pytest.fixture(params=["valid", "expired", "invalid", "missing"])
async def auth_scenario(request, auth_headers, expired_token_headers, 
                       invalid_token_headers, missing_auth_headers):
    """Parameterized fixture for testing different auth scenarios"""
    scenarios = {
        "valid": auth_headers,
        "expired": expired_token_headers, 
        "invalid": invalid_token_headers,
        "missing": missing_auth_headers
    }
    return scenarios[request.param]
```

### Login Flow Testing vs Direct Token Injection

#### Login Flow Testing
```python
@pytest.mark.asyncio
async def test_full_login_flow(client: AsyncClient, test_user: User):
    """Test complete login flow including token generation"""
    # Test login endpoint
    login_response = await client.post(
        "/api/v1/auth/login",
        data={  # Use form data for login
            "username": test_user.email,
            "password": "testpassword123"
        }
    )
    assert login_response.status_code == 200
    login_data = login_response.json()
    
    # Extract token
    access_token = login_data["access_token"]
    assert access_token is not None
    
    # Use token for authenticated request
    auth_headers = {"Authorization": f"Bearer {access_token}"}
    profile_response = await client.get(
        "/api/v1/auth/me",
        headers=auth_headers
    )
    assert profile_response.status_code == 200
    assert profile_response.json()["email"] == test_user.email
```

#### Direct Token Injection (Recommended for Most Tests)
```python
@pytest.mark.asyncio
async def test_protected_endpoint_with_direct_token(
    client: AsyncClient, 
    test_user: User,
    auth_headers: Dict[str, str]
):
    """More efficient: use pre-generated token"""
    response = await client.get(
        "/api/v1/auth/me",
        headers=auth_headers
    )
    assert response.status_code == 200
    assert response.json()["email"] == test_user.email
```

---

## 3. Database Test Fixtures

### Async Session Lifecycle Management

#### Optimized Session Configuration
```python
# tests/conftest.py - DATABASE FIXTURES
import asyncio
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool, StaticPool
from sqlalchemy import event

# Test database configuration
TEST_DATABASE_URL = "postgresql+asyncpg://wippestoolen:password@localhost:5432/wippestoolen_test"

@pytest.fixture(scope="session")
def event_loop() -> Generator:
    """Session-scoped event loop for async tests"""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    yield loop
    loop.close()

@pytest_asyncio.fixture(scope="session")
async def async_engine():
    """Session-scoped engine for better performance"""
    engine = create_async_engine(
        TEST_DATABASE_URL,
        poolclass=NullPool,  # No connection pooling for tests
        echo=False,          # Set to True for SQL debugging
        future=True,
        # Additional optimizations for tests
        pool_recycle=3600,   # Recycle connections after 1 hour
        pool_pre_ping=True,  # Verify connections before use
    )
    
    # Create tables once per session
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    
    yield engine
    
    # Cleanup: drop all tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    
    await engine.dispose()

@pytest_asyncio.fixture(scope="function")  
async def async_session(async_engine) -> AsyncGenerator[AsyncSession, None]:
    """Function-scoped session with automatic cleanup"""
    async_session_maker = async_sessionmaker(
        async_engine,
        class_=AsyncSession,
        expire_on_commit=False,  # Keep objects accessible after commit
        autoflush=True,          # Auto-flush before queries
        autocommit=False,        # Manual transaction control
    )
    
    async with async_session_maker() as session:
        # Begin transaction
        transaction = await session.begin()
        
        try:
            yield session
        finally:
            # Always rollback to clean state
            await transaction.rollback()
            await session.close()
```

### Advanced Session Patterns

#### Nested Transaction Support
```python
@pytest_asyncio.fixture(scope="function")
async def nested_session(async_engine) -> AsyncGenerator[AsyncSession, None]:
    """Session with nested transaction support for complex tests"""
    async with async_engine.connect() as connection:
        transaction = await connection.begin()
        
        async_session_maker = async_sessionmaker(
            bind=connection,
            class_=AsyncSession,
            expire_on_commit=False,
        )
        
        async with async_session_maker() as session:
            # Create savepoint for nested transactions
            nested = await session.begin_nested()
            
            try:
                yield session
            finally:
                await nested.rollback()
                await transaction.rollback()
```

#### Session with Event Listeners
```python
@pytest_asyncio.fixture(scope="function")
async def traced_session(async_engine) -> AsyncGenerator[AsyncSession, None]:
    """Session with query tracing for performance testing"""
    query_count = {"count": 0}
    query_log = []
    
    @event.listens_for(async_engine.sync_engine, "before_cursor_execute")
    def receive_before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
        query_count["count"] += 1
        query_log.append({
            "query": statement,
            "params": parameters,
            "timestamp": datetime.utcnow()
        })
    
    async_session_maker = async_sessionmaker(async_engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session_maker() as session:
        yield session
        
        # Attach query statistics to session for test analysis
        session.query_count = query_count["count"]
        session.query_log = query_log
```

### Test Data Seeding with Relationships

#### Comprehensive Test Data Factory
```python
# tests/factories.py - DATA FACTORIES
from datetime import datetime, timedelta
from decimal import Decimal
from typing import List, Optional

class TestDataFactory:
    """Factory for creating test data with proper relationships"""
    
    @staticmethod
    async def create_tool(session: AsyncSession, owner: User, **kwargs) -> Tool:
        """Create tool with proper owner relationship"""
        from wippestoolen.app.models.tool import Tool
        
        defaults = {
            "title": "Test Power Drill",
            "description": "High-quality cordless drill for all your DIY needs",
            "category": "Power Tools",
            "daily_rate": Decimal("15.00"),
            "deposit_amount": Decimal("50.00"),
            "is_available": True,
            "location": owner.city,
            "owner_id": owner.id,
        }
        defaults.update(kwargs)
        
        tool = Tool(**defaults)
        session.add(tool)
        await session.commit()
        await session.refresh(tool)
        return tool
    
    @staticmethod
    async def create_booking(session: AsyncSession, tool: Tool, borrower: User, **kwargs) -> Booking:
        """Create booking with proper relationships"""
        from wippestoolen.app.models.booking import Booking
        from wippestoolen.app.models.enums import BookingStatus
        
        start_date = datetime.utcnow().date() + timedelta(days=1)
        end_date = start_date + timedelta(days=3)
        
        defaults = {
            "tool_id": tool.id,
            "borrower_id": borrower.id,
            "start_date": start_date,
            "end_date": end_date,
            "total_cost": tool.daily_rate * 3 + tool.deposit_amount,
            "deposit_amount": tool.deposit_amount,
            "status": BookingStatus.PENDING,
        }
        defaults.update(kwargs)
        
        booking = Booking(**defaults)
        session.add(booking)
        await session.commit()
        await session.refresh(booking)
        return booking
    
    @staticmethod
    async def create_review(session: AsyncSession, booking: Booking, reviewer: User, **kwargs) -> Review:
        """Create review for completed booking"""
        from wippestoolen.app.models.review import Review
        
        defaults = {
            "booking_id": booking.id,
            "reviewer_id": reviewer.id,
            "reviewee_id": booking.borrower_id if reviewer.id == booking.tool.owner_id else booking.tool.owner_id,
            "rating": 5,
            "title": "Great experience!",
            "comment": "Everything went smoothly, would definitely do business again.",
        }
        defaults.update(kwargs)
        
        review = Review(**defaults)
        session.add(review)
        await session.commit()
        await session.refresh(review)
        return review

# Fixture integration
@pytest_asyncio.fixture
async def test_tool(async_session, test_tool_owner):
    """Tool owned by test_tool_owner"""
    return await TestDataFactory.create_tool(async_session, test_tool_owner)

@pytest_asyncio.fixture
async def test_booking(async_session, test_tool, test_borrower):
    """Booking between test_borrower and test_tool"""
    return await TestDataFactory.create_booking(async_session, test_tool, test_borrower)

@pytest_asyncio.fixture
async def completed_booking(async_session, test_tool, test_borrower):
    """Completed booking ready for reviews"""
    from wippestoolen.app.models.enums import BookingStatus
    booking = await TestDataFactory.create_booking(
        async_session, 
        test_tool, 
        test_borrower,
        status=BookingStatus.COMPLETED,
        start_date=datetime.utcnow().date() - timedelta(days=7),
        end_date=datetime.utcnow().date() - timedelta(days=4)
    )
    return booking
```

### Fixture Dependency Management

#### Clean Dependency Chains
```python
# Well-structured fixture dependencies
@pytest_asyncio.fixture
async def booking_scenario(async_session, test_tool_owner, test_borrower):
    """Complete booking scenario with all relationships"""
    # Create tool
    tool = await TestDataFactory.create_tool(async_session, test_tool_owner)
    
    # Create booking
    booking = await TestDataFactory.create_booking(async_session, tool, test_borrower)
    
    return {
        "owner": test_tool_owner,
        "borrower": test_borrower,
        "tool": tool,
        "booking": booking,
        "session": async_session
    }

@pytest.mark.asyncio
async def test_booking_workflow(booking_scenario, owner_auth_headers, borrower_auth_headers, client):
    """Test complete booking workflow using scenario fixture"""
    scenario = booking_scenario
    booking = scenario["booking"]
    
    # Test booking confirmation by owner
    confirm_response = await client.patch(
        f"/api/v1/bookings/{booking.id}/confirm",
        headers=owner_auth_headers
    )
    assert confirm_response.status_code == 200
    
    # Test booking start by borrower
    start_response = await client.patch(
        f"/api/v1/bookings/{booking.id}/start",  
        headers=borrower_auth_headers
    )
    assert start_response.status_code == 200
```

---

## 4. Service Layer Testing

### Integration Test Patterns

#### Service Testing with Mocked Dependencies
```python
# tests/test_services.py - SERVICE LAYER TESTS
import pytest
from unittest.mock import AsyncMock, MagicMock
from wippestoolen.app.services.booking_service import BookingService
from wippestoolen.app.services.notification_service import NotificationService

@pytest_asyncio.fixture
async def booking_service(async_session):
    """BookingService with real database session"""
    return BookingService(async_session)

@pytest_asyncio.fixture  
async def mocked_notification_service():
    """Mocked notification service for testing without side effects"""
    mock_service = AsyncMock(spec=NotificationService)
    mock_service.send_booking_request_notification = AsyncMock(return_value=True)
    mock_service.send_booking_confirmation_notification = AsyncMock(return_value=True)
    return mock_service

@pytest.mark.asyncio
async def test_booking_creation_with_notifications(
    booking_service: BookingService,
    mocked_notification_service: AsyncMock,
    test_tool: Tool,
    test_borrower: User,
    monkeypatch
):
    """Test booking creation triggers proper notifications"""
    # Patch the notification service
    monkeypatch.setattr(
        "wippestoolen.app.services.booking_service.notification_service",
        mocked_notification_service
    )
    
    # Create booking via service
    booking_data = {
        "tool_id": test_tool.id,
        "start_date": datetime.utcnow().date() + timedelta(days=1),
        "end_date": datetime.utcnow().date() + timedelta(days=3),
    }
    
    booking = await booking_service.create_booking(test_borrower.id, booking_data)
    
    # Verify booking created
    assert booking.id is not None
    assert booking.status == BookingStatus.PENDING
    
    # Verify notification was triggered
    mocked_notification_service.send_booking_request_notification.assert_called_once_with(
        booking.id, test_tool.owner_id
    )
```

#### Error Handling and Validation Testing
```python
@pytest.mark.asyncio
async def test_booking_service_validation_errors(
    booking_service: BookingService,
    test_tool: Tool,
    test_borrower: User
):
    """Test service layer validation and error handling"""
    
    # Test booking with invalid dates
    with pytest.raises(ValueError, match="Start date must be in the future"):
        await booking_service.create_booking(
            test_borrower.id,
            {
                "tool_id": test_tool.id,
                "start_date": datetime.utcnow().date() - timedelta(days=1),  # Past date
                "end_date": datetime.utcnow().date() + timedelta(days=1),
            }
        )
    
    # Test booking with conflicting dates
    existing_booking = await TestDataFactory.create_booking(
        booking_service.session, test_tool, test_borrower
    )
    
    with pytest.raises(ConflictError, match="Tool is not available"):
        await booking_service.create_booking(
            test_borrower.id,
            {
                "tool_id": test_tool.id,
                "start_date": existing_booking.start_date,
                "end_date": existing_booking.end_date,
            }
        )

@pytest.mark.asyncio
async def test_booking_status_transitions(
    booking_service: BookingService,
    test_booking: Booking,
    test_tool_owner: User,
    test_borrower: User
):
    """Test valid and invalid booking status transitions"""
    
    # Valid transition: PENDING -> CONFIRMED
    confirmed_booking = await booking_service.confirm_booking(
        test_booking.id, test_tool_owner.id
    )
    assert confirmed_booking.status == BookingStatus.CONFIRMED
    
    # Invalid transition: CONFIRMED -> PENDING (should fail)
    with pytest.raises(InvalidStateError, match="Cannot transition"):
        await booking_service.update_booking_status(
            test_booking.id, BookingStatus.PENDING, test_tool_owner.id
        )
    
    # Valid transition: CONFIRMED -> ACTIVE
    active_booking = await booking_service.start_booking(
        test_booking.id, test_borrower.id
    )
    assert active_booking.status == BookingStatus.ACTIVE
```

### Performance Testing with Fixtures

#### Database Performance Testing
```python
@pytest.mark.asyncio
async def test_booking_query_performance(traced_session, booking_scenario):
    """Test that booking queries stay within performance bounds"""
    scenario = booking_scenario
    booking_id = scenario["booking"].id
    
    # Use traced session to monitor query count
    booking_service = BookingService(traced_session)
    
    # Fetch booking with all relationships
    booking = await booking_service.get_booking_with_details(booking_id)
    
    # Verify query efficiency (should be 1 query with proper eager loading)
    assert traced_session.query_count <= 2, f"Too many queries: {traced_session.query_count}"
    assert booking.tool is not None
    assert booking.borrower is not None

@pytest.mark.asyncio
async def test_tool_search_performance(traced_session, test_tool_owner):
    """Test tool search performance with multiple tools"""
    # Create multiple tools for performance testing
    tools = []
    for i in range(50):
        tool = await TestDataFactory.create_tool(
            traced_session,
            test_tool_owner,
            title=f"Tool {i}",
            category="Power Tools" if i % 2 == 0 else "Hand Tools"
        )
        tools.append(tool)
    
    tool_service = ToolService(traced_session)
    
    # Search tools
    search_results = await tool_service.search_tools(
        query="Tool", 
        category="Power Tools",
        limit=20
    )
    
    # Verify performance
    assert traced_session.query_count <= 3, "Search should use efficient queries"
    assert len(search_results) <= 20
```

---

## 5. Performance and Reliability

### Fixture Caching and Reuse Strategies

#### Session-Scoped Fixtures for Static Data
```python
@pytest_asyncio.fixture(scope="session")
async def tool_categories(async_engine):
    """Session-scoped fixture for static reference data"""
    async with async_engine.begin() as conn:
        # Insert category data once per test session
        categories = [
            "Power Tools", "Hand Tools", "Garden Tools", 
            "Kitchen Appliances", "Automotive", "Cleaning"
        ]
        
        # Use raw SQL for efficiency
        await conn.execute(
            text("INSERT INTO tool_categories (name) VALUES (:name)"),
            [{"name": cat} for cat in categories]
        )
        await conn.commit()
    
    return categories

@pytest_asyncio.fixture(scope="session") 
async def reference_users(async_engine, password_hash):
    """Create reference users once per session"""
    async with async_engine.begin() as conn:
        # Create users that will be reused across tests
        reference_data = [
            {
                "email": "ref_owner@example.com",
                "display_name": "ref_owner",
                "password_hash": password_hash,
                "first_name": "Reference", 
                "last_name": "Owner",
                "city": "Reference City",
                "is_active": True,
                "is_verified": True,
            },
            {
                "email": "ref_borrower@example.com", 
                "display_name": "ref_borrower",
                "password_hash": password_hash,
                "first_name": "Reference",
                "last_name": "Borrower", 
                "city": "Reference City",
                "is_active": True,
                "is_verified": True,
            }
        ]
        
        for user_data in reference_data:
            await conn.execute(
                text("""
                    INSERT INTO users (email, display_name, password_hash, first_name, last_name, city, is_active, is_verified)
                    VALUES (:email, :display_name, :password_hash, :first_name, :last_name, :city, :is_active, :is_verified)
                """),
                user_data
            )
        await conn.commit()
```

#### Parallel Test Execution Setup
```python
# pytest.ini - PARALLEL EXECUTION CONFIG
[tool:pytest]
minversion = 6.0
addopts = 
    -ra 
    -q 
    --tb=short
    --strict-markers
    --disable-warnings
    --asyncio-mode=auto
    # Parallel execution (uncomment when stable)
    # -n auto
    # --dist=worksteal
testpaths = tests
markers =
    slow: marks tests as slow (deselect with '-m "not slow"')
    integration: marks tests as integration tests
    unit: marks tests as unit tests
    auth: authentication related tests
    booking: booking system tests
    notifications: notification system tests
asyncio_mode = auto
asyncio_default_fixture_loop_scope = function

# For parallel execution, install pytest-xdist:
# uv add --dev pytest-xdist
```

### Database Connection Pool Optimization

#### Test-Optimized Connection Configuration
```python
# tests/conftest.py - OPTIMIZED CONNECTION POOL
from sqlalchemy.pool import QueuePool, NullPool

def get_test_engine_config(test_type: str = "unit"):
    """Get engine configuration optimized for different test types"""
    
    base_config = {
        "echo": False,
        "future": True,
        "pool_recycle": 300,  # 5 minutes
        "pool_pre_ping": True,
    }
    
    if test_type == "unit":
        # Unit tests: no pooling, fresh connections
        return {
            **base_config,
            "poolclass": NullPool,
            "connect_args": {"server_settings": {"jit": "off"}},  # Disable JIT for faster startup
        }
    elif test_type == "integration":
        # Integration tests: small pool for efficiency
        return {
            **base_config,
            "poolclass": QueuePool,
            "pool_size": 2,
            "max_overflow": 3,
            "pool_timeout": 10,
        }
    elif test_type == "load":
        # Load testing: larger pool
        return {
            **base_config,
            "poolclass": QueuePool,
            "pool_size": 10,
            "max_overflow": 20,
            "pool_timeout": 30,
        }

@pytest_asyncio.fixture(scope="session")
async def unit_test_engine():
    """Engine optimized for unit testing"""
    config = get_test_engine_config("unit")
    engine = create_async_engine(TEST_DATABASE_URL, **config)
    yield engine
    await engine.dispose()

@pytest_asyncio.fixture(scope="session")
async def integration_test_engine():
    """Engine optimized for integration testing"""  
    config = get_test_engine_config("integration")
    engine = create_async_engine(TEST_DATABASE_URL, **config)
    yield engine
    await engine.dispose()
```

### Debugging Failing Async Tests

#### Comprehensive Debugging Fixtures
```python
import logging
import traceback
from typing import Any, Dict

@pytest_asyncio.fixture
async def debug_client(async_session) -> AsyncGenerator[AsyncClient, None]:
    """Client with comprehensive debugging enabled"""
    
    # Enable detailed logging
    logging.basicConfig(level=logging.DEBUG)
    httpx_logger = logging.getLogger("httpx")
    httpx_logger.setLevel(logging.DEBUG)
    
    async def override_get_db():
        try:
            yield async_session
        except Exception as e:
            logging.error(f"Database session error: {e}")
            logging.error(traceback.format_exc())
            raise
    
    app.dependency_overrides[get_db] = override_get_db
    
    # Create client with detailed event hooks
    async def log_request(request):
        logging.debug(f"Request: {request.method} {request.url}")
        logging.debug(f"Headers: {dict(request.headers)}")
        if request.content:
            logging.debug(f"Body: {request.content.decode()}")
    
    async def log_response(response):
        logging.debug(f"Response: {response.status_code}")
        logging.debug(f"Headers: {dict(response.headers)}")
        logging.debug(f"Body: {response.text}")
    
    async with AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url="http://testserver",
        headers={"Host": "testserver"},
        event_hooks={
            "request": [log_request],
            "response": [log_response]
        },
        timeout=60.0  # Long timeout for debugging
    ) as ac:
        yield ac
    
    app.dependency_overrides.clear()

# Test debugging helpers
def debug_test_state(session: AsyncSession, test_name: str):
    """Print current test state for debugging"""
    print(f"\n=== DEBUG: {test_name} ===")
    print(f"Session ID: {id(session)}")
    print(f"Session is active: {session.is_active}")
    print(f"Session in transaction: {session.in_transaction()}")
    print(f"Session dirty objects: {len(session.dirty)}")
    print(f"Session new objects: {len(session.new)}")
    print("=" * 50)

@pytest.fixture(autouse=True)
def debug_test_lifecycle(request):
    """Automatically debug test lifecycle"""
    test_name = request.node.name
    print(f"\n>>> Starting test: {test_name}")
    
    def fin():
        print(f"<<< Finished test: {test_name}")
    
    request.addfinalizer(fin)
```

#### Error Analysis and Reporting
```python
# tests/test_debug_helpers.py - DEBUGGING UTILITIES
import pytest
from typing import List, Dict, Any

class TestErrorCollector:
    """Collect and analyze test errors for debugging"""
    
    def __init__(self):
        self.errors: List[Dict[str, Any]] = []
    
    def collect_error(self, test_name: str, error: Exception, context: Dict[str, Any] = None):
        """Collect error with context for analysis"""
        self.errors.append({
            "test_name": test_name,
            "error_type": type(error).__name__,
            "error_message": str(error),
            "context": context or {},
            "traceback": traceback.format_exc()
        })
    
    def analyze_patterns(self) -> Dict[str, Any]:
        """Analyze error patterns for debugging insights"""
        error_types = {}
        for error in self.errors:
            error_type = error["error_type"]
            if error_type not in error_types:
                error_types[error_type] = []
            error_types[error_type].append(error)
        
        return {
            "total_errors": len(self.errors),
            "error_types": error_types,
            "most_common": max(error_types.keys(), key=lambda k: len(error_types[k])) if error_types else None
        }

@pytest.fixture(scope="session")
def error_collector():
    """Session-scoped error collector"""
    return TestErrorCollector()

@pytest.fixture(autouse=True)
def collect_test_errors(request, error_collector):
    """Automatically collect test errors"""
    yield
    
    if hasattr(request.node, "rep_call") and request.node.rep_call.failed:
        error_collector.collect_error(
            request.node.name,
            request.node.rep_call.longrepr,
            {"test_file": request.fspath.basename}
        )

# Add to conftest.py for error reporting
@pytest.hookimpl(tryfirst=True, hookwrapper=True)
def pytest_runtest_makereport(item, call):
    """Hook to capture test results"""
    outcome = yield
    rep = outcome.get_result()
    setattr(item, f"rep_{rep.when}", rep)
```

---

## 6. Mock and Integration Strategy

### Service Integration Testing

#### Real Database vs Mocked Services Strategy
```python
# Integration testing with real database, mocked external services
@pytest_asyncio.fixture
async def integration_test_setup(async_session):
    """Setup for integration tests with mixed real/mocked dependencies"""
    
    # Real database services
    booking_service = BookingService(async_session)
    tool_service = ToolService(async_session)
    review_service = ReviewService(async_session)
    
    # Mock external services
    email_service = AsyncMock()
    email_service.send_email = AsyncMock(return_value=True)
    
    sms_service = AsyncMock()
    sms_service.send_sms = AsyncMock(return_value=True)
    
    storage_service = AsyncMock() 
    storage_service.upload_file = AsyncMock(return_value="https://example.com/file.jpg")
    
    return {
        "booking_service": booking_service,
        "tool_service": tool_service, 
        "review_service": review_service,
        "email_service": email_service,
        "sms_service": sms_service,
        "storage_service": storage_service,
        "session": async_session
    }

@pytest.mark.asyncio
async def test_complete_booking_workflow_integration(
    integration_test_setup,
    test_tool_owner,
    test_borrower,
    client,
    owner_auth_headers,
    borrower_auth_headers
):
    """Full integration test of booking workflow"""
    setup = integration_test_setup
    
    # Create tool via API
    tool_data = {
        "title": "Integration Test Drill",
        "description": "A drill for integration testing", 
        "category": "Power Tools",
        "daily_rate": 25.00,
        "deposit_amount": 75.00
    }
    
    tool_response = await client.post(
        "/api/v1/tools/",
        json=tool_data,
        headers=owner_auth_headers
    )
    assert tool_response.status_code == 201
    tool = tool_response.json()
    
    # Create booking via API
    booking_data = {
        "tool_id": tool["id"],
        "start_date": (datetime.utcnow().date() + timedelta(days=1)).isoformat(),
        "end_date": (datetime.utcnow().date() + timedelta(days=3)).isoformat()
    }
    
    booking_response = await client.post(
        "/api/v1/bookings/",
        json=booking_data,
        headers=borrower_auth_headers
    )
    assert booking_response.status_code == 201
    booking = booking_response.json()
    
    # Verify notification was triggered (mocked)
    setup["email_service"].send_email.assert_called_once()
    
    # Confirm booking via API  
    confirm_response = await client.patch(
        f"/api/v1/bookings/{booking['id']}/confirm",
        headers=owner_auth_headers
    )
    assert confirm_response.status_code == 200
    
    # Verify confirmation notification
    assert setup["email_service"].send_email.call_count == 2
```

#### Repository Pattern for Testing
```python
# tests/repositories.py - TEST REPOSITORY PATTERN
from abc import ABC, abstractmethod
from typing import List, Optional
from wippestoolen.app.models.user import User
from wippestoolen.app.models.tool import Tool

class UserRepositoryInterface(ABC):
    @abstractmethod
    async def create(self, user_data: dict) -> User:
        pass
    
    @abstractmethod
    async def get_by_id(self, user_id: int) -> Optional[User]:
        pass
    
    @abstractmethod
    async def get_by_email(self, email: str) -> Optional[User]:
        pass

class MockUserRepository(UserRepositoryInterface):
    """Mock repository for unit testing"""
    
    def __init__(self):
        self.users: Dict[int, User] = {}
        self.next_id = 1
    
    async def create(self, user_data: dict) -> User:
        user = User(id=self.next_id, **user_data)
        self.users[user.id] = user
        self.next_id += 1
        return user
    
    async def get_by_id(self, user_id: int) -> Optional[User]:
        return self.users.get(user_id)
    
    async def get_by_email(self, email: str) -> Optional[User]:
        for user in self.users.values():
            if user.email == email:
                return user
        return None

class SQLAlchemyUserRepository(UserRepositoryInterface):
    """Real SQLAlchemy repository for integration testing"""
    
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def create(self, user_data: dict) -> User:
        user = User(**user_data)
        self.session.add(user)
        await self.session.commit()
        await self.session.refresh(user)
        return user
    
    async def get_by_id(self, user_id: int) -> Optional[User]:
        result = await self.session.execute(
            select(User).where(User.id == user_id)
        )
        return result.scalar_one_or_none()
    
    async def get_by_email(self, email: str) -> Optional[User]:
        result = await self.session.execute(
            select(User).where(User.email == email)
        )
        return result.scalar_one_or_none()

# Repository fixtures
@pytest_asyncio.fixture
async def mock_user_repository():
    """Mock repository for unit tests"""
    return MockUserRepository()

@pytest_asyncio.fixture
async def real_user_repository(async_session):
    """Real repository for integration tests"""
    return SQLAlchemyUserRepository(async_session)

@pytest.fixture(params=["mock", "real"])
async def user_repository(request, mock_user_repository, real_user_repository):
    """Parameterized fixture to test both mock and real repositories"""
    if request.param == "mock":
        return mock_user_repository
    else:
        return real_user_repository
```

### External Service Mocking

#### Comprehensive External Service Mocks
```python
# tests/mocks.py - EXTERNAL SERVICE MOCKS
from unittest.mock import AsyncMock, MagicMock
import httpx

class MockEmailService:
    """Mock email service with realistic behavior"""
    
    def __init__(self):
        self.sent_emails = []
        self.should_fail = False
        self.failure_rate = 0.0
    
    async def send_email(self, to: str, subject: str, body: str, **kwargs) -> bool:
        if self.should_fail or (self.failure_rate > 0 and random.random() < self.failure_rate):
            raise EmailDeliveryError(f"Failed to send email to {to}")
        
        self.sent_emails.append({
            "to": to,
            "subject": subject, 
            "body": body,
            "timestamp": datetime.utcnow(),
            **kwargs
        })
        return True
    
    def get_sent_emails(self, to: str = None) -> List[dict]:
        if to:
            return [email for email in self.sent_emails if email["to"] == to]
        return self.sent_emails
    
    def reset(self):
        self.sent_emails.clear()
        self.should_fail = False
        self.failure_rate = 0.0

class MockFileStorageService:
    """Mock file storage with realistic URLs"""
    
    def __init__(self):
        self.uploaded_files = {}
        self.base_url = "https://test-bucket.s3.amazonaws.com"
    
    async def upload_file(self, file_data: bytes, filename: str, content_type: str = None) -> str:
        file_id = hashlib.md5(file_data).hexdigest()
        file_url = f"{self.base_url}/{file_id}_{filename}"
        
        self.uploaded_files[file_id] = {
            "filename": filename,
            "content_type": content_type,
            "size": len(file_data),
            "url": file_url,
            "uploaded_at": datetime.utcnow()
        }
        
        return file_url
    
    async def delete_file(self, file_url: str) -> bool:
        # Extract file_id from URL
        file_id = file_url.split("/")[-1].split("_")[0]
        return self.uploaded_files.pop(file_id, None) is not None
    
    def get_file_info(self, file_url: str) -> Optional[dict]:
        file_id = file_url.split("/")[-1].split("_")[0] 
        return self.uploaded_files.get(file_id)

@pytest_asyncio.fixture
async def mock_email_service():
    """Email service mock"""
    service = MockEmailService()
    yield service
    service.reset()

@pytest_asyncio.fixture  
async def mock_storage_service():
    """File storage service mock"""
    return MockFileStorageService()

@pytest_asyncio.fixture
async def mock_external_api():
    """Mock external HTTP API calls"""
    with httpx.AsyncClient() as client:
        original_request = client.request
        
        async def mock_request(method, url, **kwargs):
            # Mock specific API endpoints
            if "api.stripe.com" in url:
                return httpx.Response(200, json={"status": "succeeded", "id": "mock_payment_id"})
            elif "api.sendgrid.com" in url:
                return httpx.Response(202, json={"message": "success"})
            else:
                # Fall back to real requests for non-mocked endpoints
                return await original_request(method, url, **kwargs)
        
        client.request = mock_request
        yield client
```

---

## Implementation Examples for Current Issues

### Fixing the "Invalid host header" Error

#### Updated conftest.py
```python
# tests/conftest.py - FIXED VERSION
import asyncio
import os
from typing import AsyncGenerator, Generator

import httpx
import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from wippestoolen.app.core.config import settings
from wippestoolen.app.core.database import Base, get_db
from wippestoolen.app.core.security import create_access_token, get_password_hash
from wippestoolen.app.main import app
from wippestoolen.app.models.user import User

TEST_DATABASE_URL = "postgresql+asyncpg://wippestoolen:password@localhost:5432/wippestoolen_test"

@pytest.fixture(scope="session")
def event_loop() -> Generator:
    """Session-scoped event loop for async tests"""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    yield loop
    loop.close()

@pytest_asyncio.fixture(scope="function")
async def async_engine():
    """Function-scoped engine with proper cleanup"""
    engine = create_async_engine(
        TEST_DATABASE_URL,
        poolclass=NullPool,
        echo=False,
        future=True,
    )
    
    # Create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    
    yield engine
    
    # Cleanup
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    
    await engine.dispose()

@pytest_asyncio.fixture(scope="function")
async def async_session(async_engine) -> AsyncGenerator[AsyncSession, None]:
    """Function-scoped session with transaction rollback"""
    async_session_maker = async_sessionmaker(
        async_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )
    
    async with async_session_maker() as session:
        # Begin transaction 
        transaction = await session.begin()
        
        try:
            yield session
        finally:
            # Always rollback for clean state
            await transaction.rollback()

@pytest_asyncio.fixture(scope="function")
async def client(async_session) -> AsyncGenerator[AsyncClient, None]:
    """FIXED: Client with proper host header configuration"""
    async def override_get_db():
        yield async_session
    
    app.dependency_overrides[get_db] = override_get_db
    
    # FIXED: Use testserver as base_url and include Host header
    async with AsyncClient(
        transport=httpx.ASGITransport(app=app), 
        base_url="http://testserver",  # CHANGED from "http://test"
        headers={"Host": "testserver"},  # ADDED explicit Host header
        timeout=30.0
    ) as ac:
        yield ac
    
    app.dependency_overrides.clear()

# Rest of fixtures remain the same...
@pytest_asyncio.fixture
async def test_user(async_session) -> User:
    """Create test user with proper password hashing"""
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
async def auth_headers(test_user) -> dict:
    """Generate authentication headers"""
    access_token = create_access_token(subject=test_user.email)
    return {"Authorization": f"Bearer {access_token}"}
```

### Example Test Implementation

#### Fixed Authentication Test
```python
# tests/test_auth_fixed.py - WORKING VERSION
import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_register_user_fixed(client: AsyncClient):
    """FIXED: Test user registration with proper client configuration"""
    response = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "newuser@example.com",
            "username": "newuser", 
            "password": "securepassword123",
            "full_name": "New User",
            "location": "New York",
            "phone": "+1234567890"
        }
    )
    
    # Should now work without "Invalid host header" error
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "newuser@example.com"
    assert data["username"] == "newuser"
    assert "id" in data

@pytest.mark.asyncio
async def test_protected_endpoint_fixed(client: AsyncClient, test_user, auth_headers):
    """FIXED: Test protected endpoint with proper authentication"""
    response = await client.get(
        "/api/v1/auth/me",
        headers=auth_headers
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == test_user.email
    assert data["display_name"] == test_user.display_name
```

---

## Conclusion

This comprehensive guide addresses the specific FastAPI testing challenges you're facing:

1. **Fixed "Invalid host header" Error**: Use `base_url="http://testserver"` with explicit `Host: testserver` header
2. **Async Session Management**: Proper transaction handling with rollback cleanup
3. **Authentication Patterns**: Comprehensive JWT token generation and role-based testing
4. **Database Fixtures**: Efficient session scoping and relationship management  
5. **Service Layer Testing**: Integration patterns with mocked external dependencies
6. **Performance Optimization**: Connection pooling, fixture caching, and parallel execution strategies

### Immediate Next Steps

1. **Update conftest.py**: Apply the fixed client configuration to resolve host header issues
2. **Implement Repository Pattern**: Add abstraction layer for easier mocking
3. **Add Debug Fixtures**: Use debugging utilities when tests fail
4. **Optimize Session Scoping**: Use session-scoped fixtures for static data
5. **Add Performance Monitoring**: Use traced sessions to monitor query efficiency

### Key Recommendations

- **Always use `base_url="http://testserver"`** with `Host: testserver` header for AsyncClient
- **Prefer direct token injection** over login flow for most tests (faster, more reliable)
- **Use transaction rollback** for database cleanup instead of table recreation
- **Mock external services** but use real database for integration tests
- **Implement comprehensive error collection** for debugging patterns
- **Use fixture dependency chains** to ensure proper setup order

This documentation provides the foundation for robust, maintainable FastAPI tests that will scale with your application growth.