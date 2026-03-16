# Python Import Order and Dependency Injection Analysis

## Executive Summary

This document analyzes Python import order, dependency injection patterns, and module loading issues affecting the Wippestoolen FastAPI application. The analysis covers systematic debugging approaches for route registration problems, async session management, and modern Python 3.13+ best practices.

## Current Architecture Analysis

### Import Chain Structure

```
main.py
├── core/config.py
├── core/database.py  
├── api/v1/api.py
│   ├── endpoints/auth.py
│   ├── endpoints/tools.py
│   ├── endpoints/bookings.py
│   ├── endpoints/reviews.py
│   └── endpoints/notifications.py
├── services/*.py
├── models/*.py
└── schemas/*.py
```

### Dependency Injection Flow

1. **Database Session**: `get_db()` → AsyncSession
2. **Authentication**: `get_current_user()` → User 
3. **Service Layer**: Service classes with injected AsyncSession
4. **Route Registration**: Endpoint modules with dependency injection

## Critical Issues and Solutions

### 1. Import Order Problems

#### Problem: Module Loading Sequence
When FastAPI shows different route counts between direct import and uvicorn server, it typically indicates import order issues or circular dependencies.

#### Solution: Systematic Import Analysis

```python
# Debug script: debug_imports.py
import sys
import importlib
from collections import defaultdict

def trace_imports():
    """Trace import order and dependencies."""
    import_order = []
    
    class ImportTracker:
        def __init__(self):
            self.imports = defaultdict(list)
            
        def trace_calls(self, frame, event, arg):
            if event == 'call':
                filename = frame.f_code.co_filename
                if 'wippestoolen' in filename:
                    module_name = filename.split('wippestoolen/')[-1]
                    import_order.append(module_name)
            return self.trace_calls
    
    tracker = ImportTracker()
    sys.settrace(tracker.trace_calls)
    
    # Import main application
    from wippestoolen.app.main import app
    
    sys.settrace(None)
    return import_order, app

# Run diagnostic
order, app = trace_imports()
print(f"Import order: {order}")
print(f"Total routes: {len(app.routes)}")
for route in app.routes:
    print(f"  {route.path} [{','.join(route.methods)}]")
```

#### Best Practice: Explicit Import Ordering

```python
# main.py - Recommended structure
"""Main FastAPI application with explicit import ordering."""

# 1. Standard library imports
from typing import Any

# 2. Third-party imports  
from fastapi import FastAPI, Request

# 3. Local configuration (no dependencies)
from wippestoolen.app.core.config import settings

# 4. Database setup (minimal dependencies)
from wippestoolen.app.core.database import engine, Base

# 5. Models (after database setup)
from wippestoolen.app.models import User, Tool, Booking

# 6. API routes (after all dependencies are loaded)
from wippestoolen.app.api.v1.api import api_router

# Create app instance
app = FastAPI(title="Wippestoolen API")

# Include routes AFTER all imports complete
app.include_router(api_router)
```

### 2. Circular Import Prevention

#### Problem: Services ↔ Models ↔ Schemas Circular Dependencies

Current risk areas in your codebase:
- `models/user.py` → references relationship strings
- `services/auth_service.py` → imports models and schemas  
- `endpoints/auth.py` → imports services and dependencies

#### Solution: Dependency Inversion Pattern

```python
# protocols/repositories.py - Define interfaces
from typing import Protocol, Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession

class UserRepositoryProtocol(Protocol):
    """User repository interface."""
    
    async def create_user(self, user_data: dict) -> "User":
        """Create new user."""
        ...
    
    async def get_user_by_id(self, user_id: UUID) -> Optional["User"]:
        """Get user by ID."""
        ...
    
    async def get_user_by_email(self, email: str) -> Optional["User"]:
        """Get user by email."""
        ...

# repositories/user_repository.py - Implementation
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from wippestoolen.app.models.user import User
from wippestoolen.app.protocols.repositories import UserRepositoryProtocol

class UserRepository:
    """User repository implementation."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def create_user(self, user_data: dict) -> User:
        """Create new user."""
        user = User(**user_data)
        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)
        return user
    
    async def get_user_by_email(self, email: str) -> Optional[User]:
        """Get user by email."""
        stmt = select(User).where(User.email == email)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

# services/auth_service.py - Service with repository injection  
class AuthService:
    """Authentication service with repository injection."""
    
    def __init__(self, user_repo: UserRepositoryProtocol):
        self.user_repo = user_repo
    
    async def register_user(self, user_data: UserCreate) -> AuthResponse:
        """Register new user."""
        # Check if user exists
        existing_user = await self.user_repo.get_user_by_email(user_data.email)
        if existing_user:
            raise UserAlreadyExistsError("User already exists")
        
        # Create user
        user = await self.user_repo.create_user({
            "email": user_data.email,
            "password_hash": hash_password(user_data.password),
            "display_name": user_data.display_name
        })
        
        return self._create_auth_response(user)
```

### 3. FastAPI Dependency Injection Best Practices

#### Problem: Complex Dependency Chains
Your current dependency chain: `db` → `current_user` → `service` → `business_logic`

#### Solution: Optimized Dependency Pattern

```python
# dependencies/services.py - Service dependency factories
from typing import Annotated
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from wippestoolen.app.core.database import get_db
from wippestoolen.app.repositories.user_repository import UserRepository
from wippestoolen.app.services.auth_service import AuthService

def get_user_repository(
    db: Annotated[AsyncSession, Depends(get_db)]
) -> UserRepository:
    """Get user repository instance."""
    return UserRepository(db)

def get_auth_service(
    user_repo: Annotated[UserRepository, Depends(get_user_repository)]
) -> AuthService:
    """Get auth service instance."""
    return AuthService(user_repo)

# endpoints/auth.py - Clean endpoint with injected services
@router.post("/register", response_model=AuthResponse)
async def register(
    user_data: UserCreate,
    auth_service: Annotated[AuthService, Depends(get_auth_service)],
) -> AuthResponse:
    """Register new user with injected service."""
    try:
        return await auth_service.register_user(user_data)
    except UserAlreadyExistsError as e:
        raise HTTPException(status_code=400, detail=str(e))
```

### 4. Async Session Management Issues

#### Problem: Session Lifecycle and Connection Pool Issues

Common async session problems:
- Sessions not properly closed
- Connection pool exhaustion  
- Transaction rollback failures
- Mixing sync/async code

#### Solution: Robust Session Management

```python
# core/database.py - Enhanced session management
from typing import AsyncGenerator
from contextlib import asynccontextmanager
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.exc import SQLAlchemyError

# Enhanced engine configuration
engine = create_async_engine(
    settings.DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://"),
    echo=settings.DEBUG,
    pool_size=20,
    max_overflow=30,
    pool_pre_ping=True,
    pool_recycle=3600,
    connect_args={
        "command_timeout": 60,
        "server_settings": {
            "application_name": "wippestoolen_api",
        },
    },
)

# Session factory with proper configuration
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    autoflush=False,
    autocommit=False,
    expire_on_commit=False,
)

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Get database session with enhanced error handling."""
    session = AsyncSessionLocal()
    try:
        yield session
        await session.commit()
    except SQLAlchemyError as e:
        await session.rollback()
        raise e
    except Exception as e:
        await session.rollback()
        raise e
    finally:
        await session.close()

@asynccontextmanager
async def get_db_context():
    """Context manager for database sessions."""
    session = AsyncSessionLocal()
    try:
        yield session
        await session.commit()
    except Exception:
        await session.rollback()
        raise
    finally:
        await session.close()

# Session monitoring
class SessionMonitor:
    """Monitor database session health."""
    
    @staticmethod
    async def check_connection_pool():
        """Check connection pool status."""
        pool = engine.pool
        return {
            "size": pool.size(),
            "checked_in": pool.checkedin(),
            "checked_out": pool.checkedout(),
            "overflow": pool.overflow(),
            "invalid": pool.invalid(),
        }
    
    @staticmethod
    async def test_connection():
        """Test database connection."""
        try:
            async with get_db_context() as db:
                await db.execute(text("SELECT 1"))
                return True
        except Exception:
            return False
```

### 5. Route Registration Debugging

#### Problem: Routes Not Accessible Despite Registration

#### Solution: Comprehensive Route Debugging

```python
# debug/route_analyzer.py - Route registration analyzer
from typing import Dict, List, Any
from fastapi import FastAPI
from fastapi.routing import APIRoute

class RouteAnalyzer:
    """Analyze FastAPI route registration and accessibility."""
    
    @staticmethod
    def analyze_routes(app: FastAPI) -> Dict[str, Any]:
        """Comprehensive route analysis."""
        analysis = {
            "total_routes": len(app.routes),
            "api_routes": [],
            "mount_routes": [],
            "websocket_routes": [],
            "duplicate_paths": [],
            "missing_dependencies": [],
        }
        
        path_methods = {}
        
        for route in app.routes:
            route_info = {
                "path": route.path,
                "name": getattr(route, 'name', 'unknown'),
                "methods": getattr(route, 'methods', []),
            }
            
            if hasattr(route, 'endpoint'):
                route_info["endpoint"] = route.endpoint.__name__
                route_info["module"] = route.endpoint.__module__
            
            if isinstance(route, APIRoute):
                analysis["api_routes"].append(route_info)
                
                # Check for duplicates
                path_key = f"{route.path}:{sorted(route.methods)}"
                if path_key in path_methods:
                    analysis["duplicate_paths"].append({
                        "path": route.path,
                        "methods": route.methods,
                        "duplicate_endpoints": [
                            path_methods[path_key],
                            route_info["endpoint"]
                        ]
                    })
                else:
                    path_methods[path_key] = route_info["endpoint"]
                
                # Check dependencies
                if hasattr(route, 'dependant'):
                    deps = route.dependant.dependencies
                    for dep in deps:
                        if hasattr(dep.call, '__module__'):
                            try:
                                # Try to resolve dependency
                                dep.call()
                            except Exception as e:
                                analysis["missing_dependencies"].append({
                                    "route": route.path,
                                    "dependency": dep.call.__name__,
                                    "error": str(e)
                                })
        
        return analysis
    
    @staticmethod
    def check_endpoint_accessibility(app: FastAPI) -> List[Dict[str, Any]]:
        """Check if endpoints are accessible via HTTP."""
        from fastapi.testclient import TestClient
        
        client = TestClient(app)
        results = []
        
        for route in app.routes:
            if isinstance(route, APIRoute) and hasattr(route, 'methods'):
                for method in route.methods:
                    if method in ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']:
                        try:
                            # Try to access endpoint
                            response = client.request(method, route.path)
                            results.append({
                                "path": route.path,
                                "method": method,
                                "status_code": response.status_code,
                                "accessible": response.status_code != 404,
                            })
                        except Exception as e:
                            results.append({
                                "path": route.path,
                                "method": method,
                                "error": str(e),
                                "accessible": False,
                            })
        
        return results

# Usage in debugging
def debug_application():
    """Debug application routes and dependencies."""
    from wippestoolen.app.main import app
    
    analyzer = RouteAnalyzer()
    
    # Route analysis
    route_analysis = analyzer.analyze_routes(app)
    print("=== ROUTE ANALYSIS ===")
    print(f"Total routes: {route_analysis['total_routes']}")
    print(f"API routes: {len(route_analysis['api_routes'])}")
    
    if route_analysis['duplicate_paths']:
        print("\n⚠️  DUPLICATE PATHS:")
        for dup in route_analysis['duplicate_paths']:
            print(f"  {dup['path']} -> {dup['duplicate_endpoints']}")
    
    if route_analysis['missing_dependencies']:
        print("\n❌ MISSING DEPENDENCIES:")
        for dep in route_analysis['missing_dependencies']:
            print(f"  {dep['route']} -> {dep['dependency']}: {dep['error']}")
    
    # Accessibility check
    accessibility = analyzer.check_endpoint_accessibility(app)
    inaccessible = [r for r in accessibility if not r['accessible']]
    
    if inaccessible:
        print("\n❌ INACCESSIBLE ENDPOINTS:")
        for endpoint in inaccessible:
            print(f"  {endpoint['method']} {endpoint['path']} -> {endpoint.get('error', 'Not found')}")
    
    return route_analysis, accessibility
```

### 6. Production-Ready Dependency Injection

#### Complete Service Layer Pattern

```python
# core/dependencies.py - Centralized dependency management
from typing import Annotated, AsyncGenerator
from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from wippestoolen.app.core.database import get_db
from wippestoolen.app.repositories.user_repository import UserRepository
from wippestoolen.app.repositories.tool_repository import ToolRepository
from wippestoolen.app.repositories.booking_repository import BookingRepository
from wippestoolen.app.services.auth_service import AuthService
from wippestoolen.app.services.tool_service import ToolService
from wippestoolen.app.services.booking_service import BookingService

# Repository dependencies
def get_user_repository(
    db: Annotated[AsyncSession, Depends(get_db)]
) -> UserRepository:
    return UserRepository(db)

def get_tool_repository(
    db: Annotated[AsyncSession, Depends(get_db)]
) -> ToolRepository:
    return ToolRepository(db)

def get_booking_repository(
    db: Annotated[AsyncSession, Depends(get_db)]
) -> BookingRepository:
    return BookingRepository(db)

# Service dependencies
def get_auth_service(
    user_repo: Annotated[UserRepository, Depends(get_user_repository)]
) -> AuthService:
    return AuthService(user_repo)

def get_tool_service(
    tool_repo: Annotated[ToolRepository, Depends(get_tool_repository)]
) -> ToolService:
    return ToolService(tool_repo)

def get_booking_service(
    booking_repo: Annotated[BookingRepository, Depends(get_booking_repository)],
    tool_repo: Annotated[ToolRepository, Depends(get_tool_repository)],
) -> BookingService:
    return BookingService(booking_repo, tool_repo)

# Type aliases for cleaner endpoint signatures
UserRepositoryDep = Annotated[UserRepository, Depends(get_user_repository)]
ToolRepositoryDep = Annotated[ToolRepository, Depends(get_tool_repository)]
BookingRepositoryDep = Annotated[BookingRepository, Depends(get_booking_repository)]

AuthServiceDep = Annotated[AuthService, Depends(get_auth_service)]
ToolServiceDep = Annotated[ToolService, Depends(get_tool_service)]
BookingServiceDep = Annotated[BookingService, Depends(get_booking_service)]
```

## Debugging Commands and Tools

### 1. Import Analysis

```bash
# Check import order and circular dependencies
python -c "
import sys
sys.path.insert(0, '.')
from debug.route_analyzer import debug_application
debug_application()
"

# Analyze circular imports
python -m pycycle --here wippestoolen

# Check import times
python -X importtime -c "from wippestoolen.app.main import app"
```

### 2. Route Testing

```bash
# Test route accessibility
python -c "
from fastapi.testclient import TestClient
from wippestoolen.app.main import app

client = TestClient(app)

# Test all GET endpoints
for route in app.routes:
    if hasattr(route, 'methods') and 'GET' in route.methods:
        try:
            response = client.get(route.path)
            print(f'{route.path}: {response.status_code}')
        except Exception as e:
            print(f'{route.path}: ERROR - {e}')
"
```

### 3. Database Connection Testing

```bash
# Test database connectivity
python -c "
import asyncio
from wippestoolen.app.core.database import get_db_context, SessionMonitor

async def test_db():
    # Test connection
    connected = await SessionMonitor.test_connection()
    print(f'Database connected: {connected}')
    
    # Check pool status
    pool_status = await SessionMonitor.check_connection_pool()
    print(f'Pool status: {pool_status}')

asyncio.run(test_db())
"
```

### 4. Dependency Resolution Testing

```python
# test_dependencies.py
import pytest
from fastapi.testclient import TestClient
from wippestoolen.app.main import app

def test_dependency_resolution():
    """Test that all dependencies can be resolved."""
    client = TestClient(app)
    
    # Test endpoints that require dependencies
    test_endpoints = [
        ("GET", "/api/v1/auth/me"),
        ("GET", "/api/v1/tools/"),
        ("GET", "/health"),
    ]
    
    for method, path in test_endpoints:
        try:
            response = client.request(method, path)
            assert response.status_code != 500, f"Dependency error in {method} {path}"
        except Exception as e:
            pytest.fail(f"Dependency resolution failed for {method} {path}: {e}")
```

## Performance Optimizations

### 1. Lazy Loading Pattern

```python
# core/lazy_imports.py - Lazy import pattern for heavy modules
from typing import TYPE_CHECKING, Any, Callable
import importlib

if TYPE_CHECKING:
    from wippestoolen.app.services.auth_service import AuthService

class LazyImport:
    """Lazy import utility for heavy modules."""
    
    def __init__(self, module_name: str, attribute_name: str):
        self.module_name = module_name
        self.attribute_name = attribute_name
        self._cached_attribute = None
    
    def __call__(self, *args, **kwargs) -> Any:
        if self._cached_attribute is None:
            module = importlib.import_module(self.module_name)
            self._cached_attribute = getattr(module, self.attribute_name)
        return self._cached_attribute(*args, **kwargs)

# Usage
get_auth_service_lazy = LazyImport(
    "wippestoolen.app.services.auth_service", 
    "AuthService"
)
```

### 2. Connection Pool Optimization

```python
# core/database.py - Optimized connection pool
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.pool import QueuePool

# Production-optimized engine
engine = create_async_engine(
    settings.DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://"),
    echo=False,  # Disable in production
    pool_size=50,  # Increase for high traffic
    max_overflow=100,
    pool_pre_ping=True,
    pool_recycle=3600,
    poolclass=QueuePool,
    connect_args={
        "command_timeout": 60,
        "server_settings": {
            "application_name": "wippestoolen_api",
            "jit": "off",  # Disable JIT for faster connection
        },
    },
)
```

## Recommendations

### Immediate Actions

1. **Run Route Analysis**: Execute the `debug_application()` function to identify route registration issues
2. **Check Database Connections**: Use `SessionMonitor` to verify connection pool health
3. **Verify Import Order**: Use import timing analysis to identify slow imports
4. **Test Dependencies**: Run dependency resolution tests

### Long-term Improvements

1. **Implement Repository Pattern**: Decouple services from direct model access
2. **Add Connection Monitoring**: Implement health checks for database connections
3. **Optimize Import Structure**: Use lazy loading for heavy modules
4. **Add Comprehensive Testing**: Include dependency injection tests in test suite

### Code Quality Metrics

- **Import Time**: Target <2 seconds for complete application import
- **Route Registration**: All routes should be accessible via OpenAPI spec
- **Dependency Resolution**: Zero failures in dependency injection
- **Connection Pool**: Maintain <80% pool utilization under normal load

## Conclusion

The FastAPI application architecture shows good separation of concerns with proper dependency injection patterns. The inconsistent route behavior likely stems from import order issues or circular dependencies rather than fundamental architectural problems. Following the debugging procedures and implementing the recommended patterns should resolve the route accessibility issues while improving overall code quality and maintainability.