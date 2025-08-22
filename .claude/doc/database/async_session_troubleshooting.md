# Async Session Troubleshooting & Database Connection Analysis

**Project**: Wippestoolen Tool-Sharing Platform  
**Document**: Database Connection & Session Management Diagnostics  
**Version**: 1.0  
**Created**: 2025-08-22  

## Executive Summary

This document provides comprehensive analysis and solutions for database connection and async session management issues in the Wippestoolen FastAPI application. Based on the current technical stack (PostgreSQL 15, SQLAlchemy 2.x async, AsyncSession), this guide addresses common pitfalls and provides practical debugging solutions.

## Current Technical Environment

### Database Stack
- **Database**: PostgreSQL 15 in Docker container (`wippestoolen-db`)
- **ORM**: SQLAlchemy 2.x with async support
- **Driver**: asyncpg for PostgreSQL async operations
- **Session Management**: AsyncSession with dependency injection
- **Connection String**: `postgresql+asyncpg://wippestoolen:password@localhost:5432/wippestoolen`

### Application Context
- **Framework**: FastAPI with async/await support
- **Models**: User, Tool, Booking, Review, Notification, NotificationPreferences
- **Issue**: Some API endpoints returning "Internal Server Error"
- **Status**: Database tables created successfully, connection test passes

## Common Async Session Issues & Solutions

### 1. Session Lifecycle Management

#### Problem: Session Not Properly Closed
```python
# ❌ INCORRECT - Session never closed
async def get_user_bad(user_id: int):
    session = AsyncSession(engine)
    user = await session.get(User, user_id)
    return user  # Session leaks!
```

#### Solution: Proper Session Context Management
```python
# ✅ CORRECT - Using context manager
async def get_user_good(user_id: int):
    async with AsyncSession(engine) as session:
        user = await session.get(User, user_id)
        return user

# ✅ BEST - Using FastAPI dependency
async def get_user_endpoint(
    user_id: int, 
    db: AsyncSession = Depends(get_db)
):
    user = await db.get(User, user_id)
    return user
```

#### Recommended Database Dependency Pattern
```python
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import Depends
from contextlib import asynccontextmanager

@asynccontextmanager
async def get_async_session():
    """Async context manager for database sessions."""
    async with AsyncSession(engine, expire_on_commit=False) as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()

async def get_db() -> AsyncSession:
    """FastAPI dependency for database sessions."""
    async with get_async_session() as session:
        yield session
```

### 2. Connection Pool Configuration

#### Recommended Engine Configuration
```python
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.pool import NullPool

# Production-ready async engine configuration
engine = create_async_engine(
    "postgresql+asyncpg://wippestoolen:password@localhost:5432/wippestoolen",
    # Connection pool settings
    pool_size=10,                    # Number of persistent connections
    max_overflow=20,                 # Additional connections beyond pool_size
    pool_timeout=30,                 # Timeout for getting connection from pool
    pool_recycle=1800,              # Recycle connections every 30 minutes
    pool_pre_ping=True,             # Validate connections before use
    
    # Async-specific settings
    future=True,                     # Use SQLAlchemy 2.0 style
    echo=False,                      # Set to True for SQL query logging
    echo_pool=False,                 # Set to True for connection pool logging
    
    # Error handling
    connect_args={
        "server_settings": {
            "application_name": "wippestoolen-api",
        },
        "command_timeout": 60,       # Command timeout in seconds
        "statement_timeout": 30000,  # Statement timeout in milliseconds
    }
)
```

#### Development vs Production Pool Settings
```python
# Development settings (smaller pool)
DEVELOPMENT_ENGINE_ARGS = {
    "pool_size": 5,
    "max_overflow": 10,
    "echo": True,  # Enable SQL logging
}

# Production settings (optimized pool)
PRODUCTION_ENGINE_ARGS = {
    "pool_size": 15,
    "max_overflow": 30,
    "pool_timeout": 30,
    "pool_recycle": 3600,  # 1 hour
    "echo": False,
}
```

### 3. Transaction Handling in Service Layers

#### Problem: Inconsistent Transaction Management
```python
# ❌ INCORRECT - Manual transaction management
async def create_booking_bad(booking_data: BookingCreate, db: AsyncSession):
    booking = Booking(**booking_data.dict())
    db.add(booking)
    await db.commit()  # What if this fails?
    
    # Update tool availability - separate transaction!
    tool = await db.get(Tool, booking.tool_id)
    tool.available_count -= 1
    await db.commit()  # Race condition possible!
```

#### Solution: Atomic Service Operations
```python
async def create_booking_good(booking_data: BookingCreate, db: AsyncSession):
    """Create booking with atomic tool availability update."""
    try:
        # Start explicit transaction
        async with db.begin():
            # Check tool availability first
            tool = await db.get(Tool, booking_data.tool_id)
            if not tool or tool.available_count < 1:
                raise ValueError("Tool not available")
            
            # Create booking
            booking = Booking(**booking_data.dict())
            db.add(booking)
            
            # Update tool availability atomically
            tool.available_count -= 1
            
            # Commit happens automatically if no exception
            await db.flush()  # Get booking.id before commit
            return booking
            
    except Exception as e:
        # Rollback happens automatically
        raise HTTPException(status_code=400, detail=str(e))
```

#### Advanced Transaction Patterns
```python
from sqlalchemy.ext.asyncio import AsyncSession
from contextlib import asynccontextmanager

@asynccontextmanager
async def atomic_operation(db: AsyncSession):
    """Context manager for atomic database operations."""
    savepoint = await db.begin()
    try:
        yield db
        await savepoint.commit()
    except Exception:
        await savepoint.rollback()
        raise

# Usage in service layer
async def complex_booking_operation(booking_data: BookingCreate, db: AsyncSession):
    async with atomic_operation(db):
        # Multiple related operations
        booking = await create_booking_record(booking_data, db)
        await update_tool_availability(booking.tool_id, db)
        await create_notification(booking, db)
        return booking
```

### 4. Foreign Key Constraints & Rollbacks

#### Common FK Constraint Issues
```python
# ❌ Problem: Creating booking without checking user/tool existence
async def create_booking_unsafe(booking_data: BookingCreate, db: AsyncSession):
    booking = Booking(
        borrower_id=booking_data.borrower_id,  # User might not exist!
        tool_id=booking_data.tool_id,          # Tool might not exist!
        **booking_data.dict()
    )
    db.add(booking)
    await db.commit()  # FK constraint violation!
```

#### Solution: Proper FK Validation
```python
async def create_booking_safe(booking_data: BookingCreate, db: AsyncSession):
    """Create booking with proper FK validation."""
    # Validate foreign keys exist
    borrower = await db.get(User, booking_data.borrower_id)
    if not borrower:
        raise HTTPException(status_code=404, detail="Borrower not found")
    
    tool = await db.get(Tool, booking_data.tool_id)
    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")
    
    # Additional business logic validation
    if tool.owner_id == booking_data.borrower_id:
        raise HTTPException(status_code=400, detail="Cannot borrow own tool")
    
    if tool.available_count < 1:
        raise HTTPException(status_code=400, detail="Tool not available")
    
    # Create booking
    booking = Booking(**booking_data.dict())
    db.add(booking)
    
    try:
        await db.commit()
        await db.refresh(booking)  # Load relationships
        return booking
    except IntegrityError as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=f"Database constraint error: {str(e)}")
```

### 5. Database Initialization & Migration Issues

#### Proper Database Initialization
```python
from sqlalchemy.ext.asyncio import AsyncEngine
from sqlalchemy import text

async def initialize_database(engine: AsyncEngine):
    """Initialize database with proper error handling."""
    try:
        # Test basic connectivity
        async with engine.begin() as conn:
            result = await conn.execute(text("SELECT 1"))
            print(f"Database connection successful: {result.scalar()}")
        
        # Create all tables
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            print("Database tables created successfully")
        
        # Seed initial data if needed
        await seed_initial_data(engine)
        
    except Exception as e:
        print(f"Database initialization failed: {e}")
        raise

async def seed_initial_data(engine: AsyncEngine):
    """Seed essential data like tool categories."""
    async with AsyncSession(engine) as session:
        try:
            # Check if categories already exist
            existing_categories = await session.execute(
                text("SELECT COUNT(*) FROM tool_categories")
            )
            if existing_categories.scalar() > 0:
                print("Categories already seeded")
                return
            
            # Seed categories
            categories = [
                "Power Tools", "Hand Tools", "Garden Tools", 
                "Cleaning Equipment", "Automotive", "Electronics"
            ]
            
            for category_name in categories:
                category = ToolCategory(name=category_name)
                session.add(category)
            
            await session.commit()
            print(f"Seeded {len(categories)} tool categories")
            
        except Exception as e:
            await session.rollback()
            print(f"Seeding failed: {e}")
            raise
```

### 6. Session Dependency Injection Patterns

#### Recommended FastAPI Dependency Structure
```python
from fastapi import Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import AsyncGenerator

class DatabaseManager:
    """Centralized database management."""
    
    def __init__(self, engine: AsyncEngine):
        self.engine = engine
    
    async def get_session(self) -> AsyncGenerator[AsyncSession, None]:
        """Get async database session."""
        async with AsyncSession(
            self.engine,
            expire_on_commit=False,  # Keep objects usable after commit
            autoflush=True,          # Auto-flush before queries
            autocommit=False         # Explicit transaction control
        ) as session:
            try:
                yield session
            except Exception:
                await session.rollback()
                raise
            finally:
                await session.close()

# Global database manager
db_manager = DatabaseManager(engine)

# FastAPI dependency
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Database session dependency for FastAPI."""
    async for session in db_manager.get_session():
        yield session

# Usage in endpoints
@router.post("/tools/", response_model=ToolResponse)
async def create_tool(
    tool_data: ToolCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    return await tool_service.create_tool(tool_data, current_user.id, db)
```

## Diagnostic Commands & Testing

### 1. Database Connectivity Tests

#### Basic Connection Test
```python
# test_db_connection.py
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

async def test_connection():
    """Test basic database connectivity."""
    engine = create_async_engine(
        "postgresql+asyncpg://wippestoolen:password@localhost:5432/wippestoolen",
        echo=True
    )
    
    try:
        async with engine.begin() as conn:
            # Test basic query
            result = await conn.execute(text("SELECT version()"))
            version = result.scalar()
            print(f"✅ PostgreSQL Version: {version}")
            
            # Test table existence
            tables_query = text("""
                SELECT tablename FROM pg_tables 
                WHERE schemaname = 'public'
                ORDER BY tablename
            """)
            result = await conn.execute(tables_query)
            tables = [row[0] for row in result.fetchall()]
            print(f"✅ Tables found: {tables}")
            
            # Test table row counts
            for table in ['users', 'tools', 'bookings', 'reviews']:
                if table in tables:
                    count_result = await conn.execute(text(f"SELECT COUNT(*) FROM {table}"))
                    count = count_result.scalar()
                    print(f"✅ {table}: {count} rows")
            
    except Exception as e:
        print(f"❌ Connection failed: {e}")
    finally:
        await engine.dispose()

if __name__ == "__main__":
    asyncio.run(test_connection())
```

#### Connection Pool Health Check
```python
# test_connection_pool.py
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy import text

async def test_connection_pool():
    """Test connection pool behavior under load."""
    engine = create_async_engine(
        "postgresql+asyncpg://wippestoolen:password@localhost:5432/wippestoolen",
        pool_size=5,
        max_overflow=10,
        echo_pool=True  # Enable pool logging
    )
    
    async def db_operation(session_id: int):
        """Simulate database operation."""
        try:
            async with AsyncSession(engine) as session:
                result = await session.execute(
                    text("SELECT pg_sleep(1), :session_id as id"),
                    {"session_id": session_id}
                )
                row = result.fetchone()
                print(f"✅ Session {session_id} completed: {row}")
        except Exception as e:
            print(f"❌ Session {session_id} failed: {e}")
    
    # Create 15 concurrent operations (more than pool_size)
    tasks = [db_operation(i) for i in range(15)]
    await asyncio.gather(*tasks, return_exceptions=True)
    
    # Check pool status
    print(f"Pool size: {engine.pool.size()}")
    print(f"Checked out connections: {engine.pool.checkedout()}")
    print(f"Overflow: {engine.pool.overflow()}")
    
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(test_connection_pool())
```

### 2. Session Lifecycle Testing

#### Session Leak Detection
```python
# test_session_leaks.py
import asyncio
import gc
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy import text

async def test_session_leaks():
    """Test for session leaks."""
    engine = create_async_engine(
        "postgresql+asyncpg://wippestoolen:password@localhost:5432/wippestoolen",
        pool_size=5,
        max_overflow=0  # No overflow to detect leaks quickly
    )
    
    # Function that creates session leak
    async def leaky_function():
        session = AsyncSession(engine)
        await session.execute(text("SELECT 1"))
        # ❌ Not closing session!
        return "done"
    
    # Function that properly manages session
    async def clean_function():
        async with AsyncSession(engine) as session:
            await session.execute(text("SELECT 1"))
        return "done"
    
    print("Testing session leaks...")
    
    # Test leaky function
    for i in range(10):
        await leaky_function()
        print(f"Leaky iteration {i+1}, pool checkedout: {engine.pool.checkedout()}")
    
    print("\nTesting clean function...")
    
    # Test clean function
    for i in range(10):
        await clean_function()
        print(f"Clean iteration {i+1}, pool checkedout: {engine.pool.checkedout()}")
    
    # Force garbage collection
    gc.collect()
    await asyncio.sleep(1)
    
    print(f"\nFinal pool status:")
    print(f"Pool size: {engine.pool.size()}")
    print(f"Checked out: {engine.pool.checkedout()}")
    
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(test_session_leaks())
```

### 3. Transaction Rollback Testing

#### Constraint Violation Testing
```python
# test_transaction_rollback.py
import asyncio
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.exc import IntegrityError
from wippestoolen.app.models import User, Tool

async def test_transaction_rollback():
    """Test transaction rollback on constraint violations."""
    engine = create_async_engine(
        "postgresql+asyncpg://wippestoolen:password@localhost:5432/wippestoolen",
        echo=True
    )
    
    async with AsyncSession(engine) as session:
        try:
            # Try to create user with invalid data
            user = User(
                email="test@example.com",
                phone_number="invalid",  # Should trigger validation
                hashed_password="test123"
            )
            session.add(user)
            await session.commit()
            print("✅ User created successfully")
            
        except IntegrityError as e:
            print(f"❌ Constraint violation (expected): {e}")
            await session.rollback()
            
        except Exception as e:
            print(f"❌ Unexpected error: {e}")
            await session.rollback()
    
    # Test that session is still usable after rollback
    async with AsyncSession(engine) as session:
        try:
            # This should work
            from sqlalchemy import text
            result = await session.execute(text("SELECT COUNT(*) FROM users"))
            count = result.scalar()
            print(f"✅ Session still usable, user count: {count}")
            
        except Exception as e:
            print(f"❌ Session unusable after rollback: {e}")
    
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(test_transaction_rollback())
```

### 4. SQL Query Debugging

#### Query Performance Analysis
```python
# query_performance_test.py
import asyncio
import time
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy import text
from sqlalchemy.orm import selectinload

async def test_query_performance():
    """Test query performance and identify N+1 problems."""
    engine = create_async_engine(
        "postgresql+asyncpg://wippestoolen:password@localhost:5432/wippestoolen",
        echo=True  # See all SQL queries
    )
    
    async with AsyncSession(engine) as session:
        print("=== Testing N+1 Query Problem ===")
        
        # ❌ N+1 Query (bad)
        start_time = time.time()
        tools_query = text("SELECT * FROM tools LIMIT 5")
        result = await session.execute(tools_query)
        tools = result.fetchall()
        
        for tool in tools:
            # This creates N additional queries!
            owner_query = text("SELECT * FROM users WHERE id = :owner_id")
            owner_result = await session.execute(owner_query, {"owner_id": tool.owner_id})
            owner = owner_result.fetchone()
            print(f"Tool: {tool.title}, Owner: {owner.full_name if owner else 'Unknown'}")
        
        n_plus_1_time = time.time() - start_time
        print(f"N+1 approach took: {n_plus_1_time:.3f} seconds")
        
        print("\n=== Testing Optimized Query ===")
        
        # ✅ Single query with JOIN (good)
        start_time = time.time()
        optimized_query = text("""
            SELECT t.title, u.full_name 
            FROM tools t 
            JOIN users u ON t.owner_id = u.id 
            LIMIT 5
        """)
        result = await session.execute(optimized_query)
        rows = result.fetchall()
        
        for row in rows:
            print(f"Tool: {row.title}, Owner: {row.full_name}")
        
        optimized_time = time.time() - start_time
        print(f"Optimized approach took: {optimized_time:.3f} seconds")
        
        print(f"\nPerformance improvement: {(n_plus_1_time/optimized_time):.1f}x faster")
    
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(test_query_performance())
```

## Performance Monitoring & Optimization

### 1. Connection Pool Monitoring

#### Pool Metrics Collection
```python
from sqlalchemy.ext.asyncio import AsyncEngine
from dataclasses import dataclass
from typing import Dict, Any
import time

@dataclass
class PoolMetrics:
    """Connection pool metrics."""
    pool_size: int
    checkedout: int
    overflow: int
    invalid: int
    timestamp: float

class DatabaseMonitor:
    """Monitor database connection pool health."""
    
    def __init__(self, engine: AsyncEngine):
        self.engine = engine
        self.metrics_history = []
    
    def get_current_metrics(self) -> PoolMetrics:
        """Get current pool metrics."""
        pool = self.engine.pool
        return PoolMetrics(
            pool_size=pool.size(),
            checkedout=pool.checkedout(),
            overflow=pool.overflow(),
            invalid=pool.invalid(),
            timestamp=time.time()
        )
    
    def log_metrics(self):
        """Log current metrics."""
        metrics = self.get_current_metrics()
        self.metrics_history.append(metrics)
        
        # Keep only last 100 metrics
        if len(self.metrics_history) > 100:
            self.metrics_history = self.metrics_history[-100:]
        
        print(f"Pool: {metrics.checkedout}/{metrics.pool_size + metrics.overflow} "
              f"(overflow: {metrics.overflow})")
    
    def get_pool_utilization(self) -> float:
        """Get current pool utilization percentage."""
        metrics = self.get_current_metrics()
        total_capacity = metrics.pool_size + metrics.overflow
        if total_capacity == 0:
            return 0.0
        return (metrics.checkedout / total_capacity) * 100

# Usage in FastAPI middleware
from fastapi import Request, Response
import time

async def database_monitoring_middleware(request: Request, call_next):
    """Middleware to monitor database usage per request."""
    start_time = time.time()
    
    # Log pool status before request
    db_monitor.log_metrics()
    
    response = await call_next(request)
    
    # Log pool status after request
    end_time = time.time()
    db_monitor.log_metrics()
    
    # Add custom headers for monitoring
    response.headers["X-DB-Pool-Utilization"] = f"{db_monitor.get_pool_utilization():.1f}%"
    response.headers["X-Request-Time"] = f"{end_time - start_time:.3f}s"
    
    return response
```

### 2. Query Performance Monitoring

#### Slow Query Detection
```python
import time
from functools import wraps
from sqlalchemy.ext.asyncio import AsyncSession

def monitor_query_performance(threshold_seconds: float = 1.0):
    """Decorator to monitor slow queries."""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            start_time = time.time()
            try:
                result = await func(*args, **kwargs)
                return result
            finally:
                end_time = time.time()
                duration = end_time - start_time
                
                if duration > threshold_seconds:
                    print(f"⚠️ Slow query detected in {func.__name__}: {duration:.3f}s")
                    # Log to monitoring system in production
                else:
                    print(f"✅ {func.__name__}: {duration:.3f}s")
        
        return wrapper
    return decorator

# Usage in service layer
@monitor_query_performance(threshold_seconds=0.5)
async def get_user_tools(user_id: int, db: AsyncSession):
    """Get all tools for a user with performance monitoring."""
    from sqlalchemy.orm import selectinload
    from wippestoolen.app.models import Tool
    
    result = await db.execute(
        select(Tool)
        .options(selectinload(Tool.category))
        .where(Tool.owner_id == user_id)
    )
    return result.scalars().all()
```

## Troubleshooting Checklist

### Database Connection Issues

**✅ Verify Database Container Status**
```bash
# Check if PostgreSQL container is running
docker ps | grep wippestoolen-db

# Check container logs
docker logs wippestoolen-db

# Test connection from host
psql -h localhost -p 5432 -U wippestoolen -d wippestoolen
```

**✅ Test Connection String Components**
```python
# Test each component individually
import asyncpg

async def test_connection_components():
    try:
        conn = await asyncpg.connect(
            host="localhost",
            port=5432,
            user="wippestoolen", 
            password="password",
            database="wippestoolen"
        )
        print("✅ Direct asyncpg connection successful")
        await conn.close()
    except Exception as e:
        print(f"❌ Connection failed: {e}")
```

**✅ Verify SQLAlchemy Engine Configuration**
```python
# Debug engine creation
from sqlalchemy.ext.asyncio import create_async_engine

try:
    engine = create_async_engine(
        "postgresql+asyncpg://wippestoolen:password@localhost:5432/wippestoolen",
        echo=True,  # Enable SQL logging
        future=True
    )
    print("✅ Engine created successfully")
except Exception as e:
    print(f"❌ Engine creation failed: {e}")
```

### Session Management Issues

**✅ Check Session Creation Pattern**
```python
# Verify proper session usage pattern
async def debug_session_usage():
    # ❌ This will cause issues
    session = AsyncSession(engine)
    # ... operations ...
    # Missing: await session.close()
    
    # ✅ This is correct
    async with AsyncSession(engine) as session:
        # ... operations ...
        pass  # Session automatically closed
```

**✅ Verify FastAPI Dependencies**
```python
# Check if dependency injection is working
from fastapi import Depends

async def debug_endpoint(db: AsyncSession = Depends(get_db)):
    """Debug endpoint to verify dependency injection."""
    try:
        result = await db.execute(text("SELECT 1"))
        return {"status": "ok", "result": result.scalar()}
    except Exception as e:
        return {"status": "error", "message": str(e)}
```

**✅ Transaction State Debugging**
```python
async def debug_transaction_state(db: AsyncSession):
    """Debug current transaction state."""
    print(f"In transaction: {db.in_transaction()}")
    print(f"Is active: {db.is_active}")
    print(f"Autocommit: {db.autocommit}")
    print(f"Expire on commit: {db.expire_on_commit}")
```

### Common Error Patterns & Solutions

#### 1. "AsyncSession object has no attribute 'commit'"
```python
# ❌ Wrong: Using sync session methods
await db.commit()

# ✅ Correct: Use async methods
await db.commit()
```

#### 2. "RuntimeError: Task was destroyed but it is pending!"
```python
# ❌ Problem: Not awaiting async operations
db.add(user)
db.commit()  # Missing await!

# ✅ Solution: Properly await async calls
db.add(user)
await db.commit()
```

#### 3. "Connection pool is exhausted"
```python
# ❌ Problem: Sessions not being closed
for i in range(100):
    session = AsyncSession(engine)
    # ... operations ...
    # Not closing sessions!

# ✅ Solution: Use context managers
for i in range(100):
    async with AsyncSession(engine) as session:
        # ... operations ...
        pass  # Auto-closed
```

#### 4. "Object was created in a different Context"
```python
# ❌ Problem: Using objects across different sessions
user = await session1.get(User, 1)
session1.close()
# Later...
session2.add(user)  # Error!

# ✅ Solution: Merge objects or query in same session
async with AsyncSession(engine) as session:
    user = await session.get(User, 1)
    user.name = "Updated"
    await session.commit()  # Same session
```

## Production Deployment Considerations

### Environment-Specific Configurations

#### Development Environment
```python
DEVELOPMENT_CONFIG = {
    "pool_size": 5,
    "max_overflow": 10,
    "echo": True,              # SQL logging enabled
    "echo_pool": True,         # Pool logging enabled
    "pool_timeout": 30,
    "pool_recycle": 3600,
}
```

#### Production Environment
```python
PRODUCTION_CONFIG = {
    "pool_size": 20,           # Larger pool for production
    "max_overflow": 40,
    "echo": False,             # Disable SQL logging
    "echo_pool": False,
    "pool_timeout": 60,
    "pool_recycle": 1800,      # More frequent recycling
    "pool_pre_ping": True,     # Validate connections
}
```

### Health Check Implementation
```python
from fastapi import APIRouter, HTTPException
from sqlalchemy import text

router = APIRouter()

@router.get("/health/database")
async def database_health_check(db: AsyncSession = Depends(get_db)):
    """Database health check endpoint."""
    try:
        # Test basic connectivity
        result = await db.execute(text("SELECT 1"))
        if result.scalar() != 1:
            raise HTTPException(status_code=503, detail="Database query failed")
        
        # Test table access
        await db.execute(text("SELECT COUNT(*) FROM users"))
        
        return {
            "status": "healthy",
            "database": "postgresql",
            "timestamp": time.time()
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail=f"Database unhealthy: {str(e)}"
        )
```

## Recommended Next Steps

### Immediate Actions
1. **Implement Connection Pool Monitoring**: Add pool metrics to your FastAPI application
2. **Create Health Check Endpoints**: Implement `/health/database` endpoint for monitoring
3. **Add Slow Query Logging**: Use the performance monitoring decorators in service layer
4. **Session Leak Testing**: Run the session leak detection script in your test suite

### Short-term Improvements
1. **Connection Pool Optimization**: Adjust pool settings based on load testing results
2. **Error Handling Enhancement**: Implement comprehensive error handling for database operations
3. **Transaction Management**: Audit service layer for proper transaction boundaries
4. **Performance Baseline**: Establish query performance baselines for monitoring

### Long-term Optimization
1. **Database Replica Setup**: Implement read replicas for scaling
2. **Connection Pooling**: Consider external connection poolers like PgBouncer
3. **Query Optimization**: Implement query analysis and optimization processes
4. **Monitoring Integration**: Integrate with APM tools like DataDog or New Relic

## Conclusion

The async session management issues in the Wippestoolen FastAPI application are likely caused by:

1. **Session Lifecycle Issues**: Sessions not being properly closed or managed
2. **Connection Pool Exhaustion**: Too many concurrent connections without proper cleanup
3. **Transaction Management**: Incomplete or incorrect transaction handling in service layers
4. **Foreign Key Constraints**: Database constraint violations causing rollbacks

By implementing the diagnostic tools and following the best practices outlined in this document, you should be able to identify and resolve the specific issues affecting your API endpoints.

The key is to:
- Use async context managers for all database operations
- Implement proper error handling and transaction management
- Monitor connection pool health continuously
- Test session lifecycle thoroughly in your development environment

This comprehensive approach will ensure robust and reliable database connectivity for your FastAPI application.