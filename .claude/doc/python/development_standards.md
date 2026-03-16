# Python Development Standards - Wippestoolen Platform

## Overview

This document establishes Python development standards for the Wippestoolen tool-sharing platform. These standards ensure code quality, maintainability, and scalability while adhering to Python best practices and SOLID principles.

## Project Requirements

- **Python Version**: 3.13+
- **Package Manager**: uv
- **Code Quality Tools**: black, ruff, mypy, pytest
- **Architecture**: Clean architecture with dependency injection
- **Scalability**: Support 10-40 initial users → 10,000+ users

## 1. Project Structure

### Recommended Directory Layout

```
wippestoolen/
├── src/                           # Source code root
│   └── wippestoolen/             # Main application package
│       ├── __init__.py
│       ├── core/                 # Core business logic
│       │   ├── __init__.py
│       │   ├── entities/         # Domain entities
│       │   ├── use_cases/        # Business use cases
│       │   └── interfaces/       # Abstract interfaces
│       ├── infrastructure/       # External concerns
│       │   ├── __init__.py
│       │   ├── database/         # Database implementations
│       │   ├── web/              # Web framework specific code
│       │   ├── storage/          # File storage (S3, etc.)
│       │   └── notifications/    # Email, SMS, push notifications
│       ├── presentation/         # API/Web controllers
│       │   ├── __init__.py
│       │   ├── api/              # REST API endpoints
│       │   ├── schemas/          # Request/response schemas
│       │   └── middleware/       # Custom middleware
│       └── config/               # Configuration management
│           ├── __init__.py
│           ├── settings.py       # Application settings
│           └── dependencies.py   # Dependency injection setup
├── tests/                        # Test code
│   ├── unit/                     # Unit tests
│   ├── integration/              # Integration tests
│   └── e2e/                      # End-to-end tests
├── migrations/                   # Database migrations
├── scripts/                      # Utility scripts
├── docs/                         # Additional documentation
├── pyproject.toml               # Project configuration
├── uv.lock                      # Dependency lock file
└── README.md
```

### Module Organization Principles

1. **Separation of Concerns**: Clear boundaries between layers
2. **Dependency Inversion**: High-level modules don't depend on low-level modules
3. **Single Responsibility**: Each module has one reason to change
4. **Interface Segregation**: Clients depend only on interfaces they use

## 2. Code Style Guidelines

### Beyond Black/Ruff Configuration

While black and ruff handle formatting and basic linting, follow these additional guidelines:

#### Naming Conventions (PEP 8 Extended)

```python
# Classes: PascalCase with descriptive names
class UserRepository:
    pass

class ToolBookingService:
    pass

# Functions/methods: snake_case with verb phrases
def create_user_profile(user_data: dict) -> User:
    pass

def validate_booking_request(booking: BookingRequest) -> bool:
    pass

# Constants: SCREAMING_SNAKE_CASE
MAX_BOOKING_DURATION_DAYS = 30
DEFAULT_SEARCH_RADIUS_KM = 5

# Private methods: leading underscore
def _validate_user_permissions(self, user_id: int) -> bool:
    pass

# Internal use: double leading underscore (name mangling)
def __calculate_ranking_score(self) -> float:
    pass
```

#### Function Design Principles

```python
# Good: Single responsibility, clear purpose
def calculate_tool_availability(
    tool_id: int, 
    start_date: date, 
    end_date: date
) -> bool:
    """Check if tool is available for booking period."""
    existing_bookings = booking_repository.get_by_tool_and_period(
        tool_id, start_date, end_date
    )
    return len(existing_bookings) == 0

# Bad: Multiple responsibilities
def process_booking(booking_data: dict) -> dict:
    """Process booking - does too many things."""
    # Validates, saves, sends email, updates cache, logs...
    pass
```

#### Class Design Patterns

```python
# Good: Composition over inheritance
class BookingService:
    def __init__(
        self,
        booking_repository: BookingRepositoryInterface,
        notification_service: NotificationServiceInterface,
        user_service: UserServiceInterface,
    ):
        self._booking_repo = booking_repository
        self._notification_service = notification_service
        self._user_service = user_service
    
    def create_booking_request(self, request: BookingRequest) -> BookingResult:
        """Create new booking request with proper validation."""
        # Implementation here
        pass

# Bad: Deep inheritance hierarchy
class BaseBookingProcessor:
    pass

class ToolBookingProcessor(BaseBookingProcessor):
    pass

class PowerToolBookingProcessor(ToolBookingProcessor):
    pass
```

## 3. Type Hints Best Practices

### Comprehensive Type Coverage

```python
from typing import Optional, List, Dict, Any, Union, Protocol
from datetime import datetime, date
from decimal import Decimal
from dataclasses import dataclass

# Domain entities with complete typing
@dataclass(frozen=True)
class User:
    id: int
    email: str
    name: str
    location: tuple[float, float]  # (lat, lng)
    rating: Optional[Decimal] = None
    created_at: datetime
    
    def __post_init__(self):
        """Validate user data after initialization."""
        if not self.email or '@' not in self.email:
            raise ValueError("Invalid email address")

# Use Protocol for dependency injection
class BookingRepositoryInterface(Protocol):
    def create(self, booking: BookingRequest) -> Booking:
        ...
    
    def get_by_id(self, booking_id: int) -> Optional[Booking]:
        ...
    
    def get_active_by_user(self, user_id: int) -> List[Booking]:
        ...

# Generic types for reusable components
from typing import TypeVar, Generic

T = TypeVar('T')

class Repository(Generic[T], Protocol):
    def create(self, entity: T) -> T:
        ...
    
    def get_by_id(self, entity_id: int) -> Optional[T]:
        ...
    
    def update(self, entity: T) -> T:
        ...
    
    def delete(self, entity_id: int) -> bool:
        ...
```

### Union Types and Error Handling

```python
from typing import Union
from dataclasses import dataclass

@dataclass(frozen=True)
class Success:
    value: Any

@dataclass(frozen=True)
class Error:
    message: str
    code: str

Result = Union[Success, Error]

def create_user_account(user_data: dict) -> Result:
    """Create user account with explicit success/failure types."""
    try:
        # Validation logic
        if not user_data.get('email'):
            return Error("Email is required", "MISSING_EMAIL")
        
        # Create user
        user = User(**user_data)
        saved_user = user_repository.create(user)
        
        return Success(saved_user)
    
    except ValidationError as e:
        return Error(str(e), "VALIDATION_ERROR")
    except DatabaseError as e:
        return Error("Database operation failed", "DB_ERROR")
```

## 4. Error Handling Patterns

### Custom Exception Hierarchy

```python
# Base exception classes
class WippestoolenError(Exception):
    """Base exception for all application errors."""
    
    def __init__(self, message: str, error_code: str = None):
        self.message = message
        self.error_code = error_code
        super().__init__(message)

class ValidationError(WippestoolenError):
    """Raised when data validation fails."""
    pass

class NotFoundError(WippestoolenError):
    """Raised when requested resource doesn't exist."""
    pass

class PermissionError(WippestoolenError):
    """Raised when user lacks required permissions."""
    pass

class BusinessRuleError(WippestoolenError):
    """Raised when business rules are violated."""
    pass

# Usage example
def book_tool(user_id: int, tool_id: int, dates: tuple[date, date]) -> Booking:
    """Book a tool with comprehensive error handling."""
    try:
        user = user_repository.get_by_id(user_id)
        if not user:
            raise NotFoundError(f"User {user_id} not found", "USER_NOT_FOUND")
        
        tool = tool_repository.get_by_id(tool_id)
        if not tool:
            raise NotFoundError(f"Tool {tool_id} not found", "TOOL_NOT_FOUND")
        
        if not tool.is_available(dates[0], dates[1]):
            raise BusinessRuleError(
                "Tool not available for requested period", 
                "TOOL_UNAVAILABLE"
            )
        
        return booking_service.create_booking(user, tool, dates)
    
    except (ValidationError, NotFoundError, BusinessRuleError):
        # Re-raise application errors as-is
        raise
    except Exception as e:
        # Wrap unexpected errors
        logger.exception("Unexpected error in book_tool")
        raise WippestoolenError(
            "An unexpected error occurred", 
            "INTERNAL_ERROR"
        ) from e
```

### Result Pattern for Clean Error Handling

```python
from typing import Generic, TypeVar, Union, Callable
from dataclasses import dataclass

T = TypeVar('T')
E = TypeVar('E')

@dataclass(frozen=True)
class Ok(Generic[T]):
    value: T

@dataclass(frozen=True)
class Err(Generic[E]):
    error: E

Result = Union[Ok[T], Err[E]]

def map_result(result: Result[T, E], func: Callable[[T], U]) -> Result[U, E]:
    """Transform successful result value."""
    return Ok(func(result.value)) if isinstance(result, Ok) else result

def and_then(result: Result[T, E], func: Callable[[T], Result[U, E]]) -> Result[U, E]:
    """Chain operations that can fail."""
    return func(result.value) if isinstance(result, Ok) else result

# Usage
def process_booking_pipeline(booking_data: dict) -> Result[Booking, str]:
    """Process booking through validation pipeline."""
    return (
        validate_booking_data(booking_data)
        .and_then(check_tool_availability)
        .and_then(create_booking_record)
        .and_then(send_confirmation_email)
    )
```

## 5. Testing Strategy

### Test Architecture

```
tests/
├── unit/                     # Fast, isolated tests
│   ├── core/
│   │   ├── test_entities.py
│   │   └── test_use_cases.py
│   ├── infrastructure/
│   └── presentation/
├── integration/              # Component interaction tests
│   ├── test_database.py
│   ├── test_api_endpoints.py
│   └── test_notification_service.py
├── e2e/                      # Full workflow tests
│   ├── test_booking_flow.py
│   └── test_user_registration.py
├── fixtures/                 # Test data
│   ├── users.json
│   └── tools.json
└── conftest.py              # Pytest configuration
```

### Unit Testing Best Practices

```python
import pytest
from unittest.mock import Mock, patch
from datetime import date, datetime
from decimal import Decimal

# Test class organization
class TestBookingService:
    """Test suite for BookingService."""
    
    @pytest.fixture
    def mock_repositories(self):
        """Setup mock repositories for testing."""
        return {
            'booking_repo': Mock(),
            'user_repo': Mock(),
            'tool_repo': Mock(),
            'notification_service': Mock(),
        }
    
    @pytest.fixture
    def booking_service(self, mock_repositories):
        """Create BookingService with mocked dependencies."""
        return BookingService(
            booking_repository=mock_repositories['booking_repo'],
            user_repository=mock_repositories['user_repo'],
            tool_repository=mock_repositories['tool_repo'],
            notification_service=mock_repositories['notification_service'],
        )
    
    def test_create_booking_success(self, booking_service, mock_repositories):
        """Test successful booking creation."""
        # Arrange
        user = User(
            id=1, 
            email="user@test.com", 
            name="Test User",
            location=(52.5, 13.4),
            created_at=datetime.now()
        )
        tool = Tool(
            id=1, 
            title="Drill", 
            owner_id=2,
            location=(52.5, 13.4),
            available=True
        )
        booking_dates = (date(2024, 1, 1), date(2024, 1, 5))
        
        mock_repositories['user_repo'].get_by_id.return_value = user
        mock_repositories['tool_repo'].get_by_id.return_value = tool
        mock_repositories['booking_repo'].create.return_value = Mock(id=123)
        
        # Act
        result = booking_service.create_booking_request(
            user_id=1, 
            tool_id=1, 
            dates=booking_dates
        )
        
        # Assert
        assert isinstance(result, Ok)
        assert result.value.id == 123
        mock_repositories['notification_service'].send_booking_request.assert_called_once()
    
    def test_create_booking_tool_not_available(self, booking_service, mock_repositories):
        """Test booking creation when tool is not available."""
        # Arrange
        mock_repositories['tool_repo'].get_by_id.return_value = None
        
        # Act & Assert
        with pytest.raises(NotFoundError) as exc_info:
            booking_service.create_booking_request(
                user_id=1, 
                tool_id=999, 
                dates=(date(2024, 1, 1), date(2024, 1, 5))
            )
        
        assert exc_info.value.error_code == "TOOL_NOT_FOUND"

# Property-based testing for complex validation
from hypothesis import given, strategies as st

class TestUserValidation:
    """Property-based tests for user validation."""
    
    @given(
        email=st.emails(),
        name=st.text(min_size=1, max_size=100),
        lat=st.floats(min_value=-90, max_value=90),
        lng=st.floats(min_value=-180, max_value=180),
    )
    def test_valid_user_creation_always_succeeds(self, email, name, lat, lng):
        """Valid user data should always create a user successfully."""
        user_data = {
            'email': email,
            'name': name,
            'location': (lat, lng),
            'created_at': datetime.now()
        }
        
        user = User(**user_data)
        assert user.email == email
        assert user.name == name
        assert user.location == (lat, lng)
```

### Integration Testing

```python
import pytest
import asyncio
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from testcontainers.postgres import PostgresContainer

class TestDatabaseIntegration:
    """Integration tests with real database."""
    
    @pytest.fixture(scope="class")
    def postgres_container(self):
        """Start PostgreSQL container for testing."""
        with PostgresContainer("postgres:15") as postgres:
            yield postgres
    
    @pytest.fixture(scope="class")
    def database_session(self, postgres_container):
        """Create database session for testing."""
        connection_url = postgres_container.get_connection_url()
        engine = create_engine(connection_url)
        
        # Create tables
        Base.metadata.create_all(engine)
        
        Session = sessionmaker(bind=engine)
        session = Session()
        
        yield session
        
        session.close()
        engine.dispose()
    
    def test_user_repository_crud_operations(self, database_session):
        """Test complete CRUD operations for users."""
        repo = SqlAlchemyUserRepository(database_session)
        
        # Create
        user_data = {
            'email': 'test@example.com',
            'name': 'Test User',
            'location': (52.5, 13.4),
            'created_at': datetime.now()
        }
        created_user = repo.create(User(**user_data))
        assert created_user.id is not None
        
        # Read
        fetched_user = repo.get_by_id(created_user.id)
        assert fetched_user.email == user_data['email']
        
        # Update
        updated_user = repo.update(
            created_user.id, 
            {'name': 'Updated Name'}
        )
        assert updated_user.name == 'Updated Name'
        
        # Delete
        result = repo.delete(created_user.id)
        assert result is True
        assert repo.get_by_id(created_user.id) is None
```

### End-to-End Testing

```python
import pytest
from httpx import AsyncClient
from fastapi.testclient import TestClient

class TestBookingFlow:
    """End-to-end tests for complete booking workflow."""
    
    @pytest.fixture
    def test_client(self, app):
        """Create test client with application."""
        return TestClient(app)
    
    def test_complete_booking_workflow(self, test_client):
        """Test complete booking from request to completion."""
        # 1. Create user accounts
        lender_response = test_client.post("/api/users", json={
            "email": "lender@test.com",
            "name": "Tool Lender",
            "location": [52.5, 13.4]
        })
        assert lender_response.status_code == 201
        lender_id = lender_response.json()["id"]
        
        borrower_response = test_client.post("/api/users", json={
            "email": "borrower@test.com",
            "name": "Tool Borrower",
            "location": [52.5, 13.4]
        })
        assert borrower_response.status_code == 201
        borrower_id = borrower_response.json()["id"]
        
        # 2. Create tool listing
        tool_response = test_client.post(
            "/api/tools",
            json={
                "title": "Electric Drill",
                "description": "Professional grade drill",
                "category": "power_tools",
                "daily_rate": "15.00",
                "location": [52.5, 13.4]
            },
            headers={"Authorization": f"Bearer {lender_token}"}
        )
        assert tool_response.status_code == 201
        tool_id = tool_response.json()["id"]
        
        # 3. Create booking request
        booking_response = test_client.post(
            "/api/bookings",
            json={
                "tool_id": tool_id,
                "start_date": "2024-01-01",
                "end_date": "2024-01-03",
                "message": "Need this for home renovation"
            },
            headers={"Authorization": f"Bearer {borrower_token}"}
        )
        assert booking_response.status_code == 201
        booking_id = booking_response.json()["id"]
        
        # 4. Approve booking
        approval_response = test_client.patch(
            f"/api/bookings/{booking_id}/approve",
            headers={"Authorization": f"Bearer {lender_token}"}
        )
        assert approval_response.status_code == 200
        
        # 5. Complete booking
        completion_response = test_client.patch(
            f"/api/bookings/{booking_id}/complete",
            headers={"Authorization": f"Bearer {lender_token}"}
        )
        assert completion_response.status_code == 200
        
        # 6. Submit reviews
        borrower_review = test_client.post(
            f"/api/bookings/{booking_id}/reviews",
            json={
                "rating": 5,
                "comment": "Great tool, worked perfectly!"
            },
            headers={"Authorization": f"Bearer {borrower_token}"}
        )
        assert borrower_review.status_code == 201
        
        lender_review = test_client.post(
            f"/api/bookings/{booking_id}/reviews",
            json={
                "rating": 5,
                "comment": "Responsible borrower, tool returned in perfect condition"
            },
            headers={"Authorization": f"Bearer {lender_token}"}
        )
        assert lender_review.status_code == 201
```

## 6. Performance Optimization

### Database Query Optimization

```python
# Use query optimization patterns
class OptimizedToolRepository:
    """Repository with optimized database queries."""
    
    def get_nearby_available_tools(
        self, 
        location: tuple[float, float], 
        radius_km: float,
        start_date: date,
        end_date: date,
        limit: int = 20
    ) -> List[Tool]:
        """Get available tools near location with minimal queries."""
        # Use single query with joins instead of N+1 queries
        query = (
            self.session.query(Tool)
            .join(User, Tool.owner_id == User.id)
            .outerjoin(Booking, and_(
                Booking.tool_id == Tool.id,
                Booking.status.in_(['active', 'confirmed']),
                or_(
                    and_(Booking.start_date <= start_date, Booking.end_date >= start_date),
                    and_(Booking.start_date <= end_date, Booking.end_date >= end_date),
                    and_(Booking.start_date >= start_date, Booking.end_date <= end_date)
                )
            ))
            .filter(
                Tool.is_active == True,
                Booking.id.is_(None),  # No conflicting bookings
                func.ST_DWithin(
                    func.ST_MakePoint(Tool.longitude, Tool.latitude),
                    func.ST_MakePoint(location[1], location[0]),
                    radius_km * 1000  # Convert to meters
                )
            )
            .options(
                joinedload(Tool.owner),  # Eager load owner data
                joinedload(Tool.photos).load_only('url', 'alt_text')  # Only needed fields
            )
            .limit(limit)
        )
        
        return query.all()

# Caching strategies
from functools import lru_cache, wraps
import asyncio

def cache_result(ttl_seconds: int = 300):
    """Decorator for caching function results with TTL."""
    def decorator(func):
        cache = {}
        
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Create cache key
            key = f"{func.__name__}:{hash((args, tuple(sorted(kwargs.items()))))}"
            
            # Check cache
            if key in cache:
                result, timestamp = cache[key]
                if time.time() - timestamp < ttl_seconds:
                    return result
            
            # Execute function and cache result
            result = await func(*args, **kwargs)
            cache[key] = (result, time.time())
            
            return result
        
        return wrapper
    return decorator

class CachedToolService:
    """Tool service with intelligent caching."""
    
    @cache_result(ttl_seconds=300)  # Cache for 5 minutes
    async def get_popular_tools(self, category: str = None) -> List[Tool]:
        """Get popular tools with caching."""
        return await self.tool_repository.get_most_booked_tools(
            category=category, 
            limit=20
        )
```

### Async/Await Patterns

```python
import asyncio
from typing import List, Dict, Any
import httpx

class NotificationService:
    """Async notification service for better performance."""
    
    def __init__(self, email_client: httpx.AsyncClient):
        self.email_client = email_client
    
    async def send_booking_notifications(
        self, 
        booking: Booking
    ) -> List[bool]:
        """Send notifications concurrently."""
        tasks = [
            self._send_email_to_lender(booking),
            self._send_email_to_borrower(booking),
            self._send_push_notification(booking),
            self._update_notification_history(booking)
        ]
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Log any failed notifications
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                logger.warning(f"Notification task {i} failed: {result}")
        
        return [not isinstance(r, Exception) for r in results]
    
    async def _send_email_to_lender(self, booking: Booking) -> bool:
        """Send email notification to tool lender."""
        try:
            response = await self.email_client.post("/send", json={
                "to": booking.tool.owner.email,
                "subject": f"New booking request for {booking.tool.title}",
                "template": "booking_request_lender",
                "data": {
                    "lender_name": booking.tool.owner.name,
                    "borrower_name": booking.borrower.name,
                    "tool_name": booking.tool.title,
                    "dates": f"{booking.start_date} to {booking.end_date}"
                }
            })
            return response.status_code == 200
        except Exception as e:
            logger.exception("Failed to send lender email")
            return False

# Background job processing
from celery import Celery

celery_app = Celery('wippestoolen')

@celery_app.task
def process_booking_completion(booking_id: int):
    """Background task for booking completion processing."""
    try:
        booking = booking_repository.get_by_id(booking_id)
        
        # Update tool availability
        tool_service.update_availability(booking.tool_id)
        
        # Generate review requests
        review_service.create_review_requests(booking)
        
        # Update user statistics
        user_service.update_booking_stats(booking.borrower_id)
        user_service.update_lending_stats(booking.tool.owner_id)
        
        # Send completion notifications
        notification_service.send_completion_notifications(booking)
        
        logger.info(f"Successfully processed booking completion: {booking_id}")
        
    except Exception as e:
        logger.exception(f"Failed to process booking completion: {booking_id}")
        raise  # Re-raise for Celery retry mechanism
```

## 7. Dependency Management with uv

### pyproject.toml Configuration

```toml
[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[project]
name = "wippestoolen"
version = "0.1.0"
description = "Neighborhood tool-sharing platform"
readme = "README.md"
authors = [
    { name = "Wippestoolen Team", email = "team@wippestoolen.com" }
]
requires-python = ">=3.13"

dependencies = [
    # Web framework (choose one)
    "fastapi>=0.104.0",
    "uvicorn>=0.24.0",
    
    # Database
    "sqlalchemy>=2.0.0",
    "alembic>=1.12.0",
    "asyncpg>=0.29.0",  # PostgreSQL async driver
    
    # Authentication & Security
    "python-jose[cryptography]>=3.3.0",
    "passlib[bcrypt]>=1.7.4",
    "python-multipart>=0.0.6",
    
    # Data validation
    "pydantic>=2.4.0",
    "email-validator>=2.1.0",
    
    # HTTP client
    "httpx>=0.25.0",
    
    # Configuration
    "pydantic-settings>=2.0.0",
    
    # Background jobs
    "celery>=5.3.0",
    "redis>=5.0.0",
    
    # File storage
    "boto3>=1.34.0",
    "pillow>=10.1.0",
    
    # Monitoring & Logging
    "structlog>=23.2.0",
    "sentry-sdk>=1.38.0",
]

[project.optional-dependencies]
dev = [
    # Code quality
    "black>=23.10.0",
    "ruff>=0.1.5",
    "mypy>=1.7.0",
    
    # Testing
    "pytest>=7.4.0",
    "pytest-asyncio>=0.21.0",
    "pytest-cov>=4.1.0",
    "pytest-mock>=3.12.0",
    "httpx>=0.25.0",  # For testing async HTTP clients
    "testcontainers>=3.7.0",
    
    # Property-based testing
    "hypothesis>=6.88.0",
    
    # Database testing
    "factory-boy>=3.3.0",
    
    # Performance testing
    "locust>=2.17.0",
]

prod = [
    # Production server
    "gunicorn>=21.2.0",
    
    # Monitoring
    "prometheus-client>=0.19.0",
]

[tool.black]
line-length = 88
target-version = ['py313']
include = '\.pyi?$'
extend-exclude = '''
/(
  # directories
  migrations/
  | \.git/
  | \.venv/
  | build/
  | dist/
)/
'''

[tool.ruff]
target-version = "py313"
line-length = 88
select = [
    "E",   # pycodestyle errors
    "W",   # pycodestyle warnings
    "F",   # pyflakes
    "I",   # isort
    "B",   # flake8-bugbear
    "C4",  # flake8-comprehensions
    "UP",  # pyupgrade
    "ARG", # flake8-unused-arguments
    "SIM", # flake8-simplify
    "ICN", # flake8-import-conventions
    "RUF", # ruff-specific rules
]
ignore = [
    "E501",  # line too long (handled by black)
    "B008",  # do not perform function calls in argument defaults
    "C901",  # too complex (handled by complexity check separately)
]

[tool.ruff.per-file-ignores]
"tests/*" = ["ARG", "S101"]  # Allow unused args and asserts in tests
"migrations/*" = ["ALL"]     # Ignore all rules in migrations

[tool.mypy]
python_version = "3.13"
warn_return_any = true
warn_unused_configs = true
disallow_untyped_defs = true
disallow_incomplete_defs = true
check_untyped_defs = true
disallow_untyped_decorators = true
no_implicit_optional = true
warn_redundant_casts = true
warn_unused_ignores = true
warn_no_return = true
warn_unreachable = true
strict_equality = true
show_error_codes = true

[[tool.mypy.overrides]]
module = "tests.*"
disallow_untyped_defs = false

[[tool.mypy.overrides]]
module = [
    "celery.*",
    "boto3.*",
    "testcontainers.*",
]
ignore_missing_imports = true

[tool.pytest.ini_options]
testpaths = ["tests"]
python_files = ["test_*.py", "*_test.py"]
python_classes = ["Test*"]
python_functions = ["test_*"]
addopts = [
    "-ra",
    "--strict-markers",
    "--strict-config",
    "--cov=src",
    "--cov-report=term-missing",
    "--cov-report=html",
    "--cov-fail-under=85",
]
markers = [
    "unit: Unit tests",
    "integration: Integration tests",
    "e2e: End-to-end tests",
    "slow: Slow running tests",
]

[tool.coverage.run]
source = ["src"]
omit = [
    "*/tests/*",
    "*/migrations/*",
    "*/venv/*",
    "*/.venv/*",
]

[tool.coverage.report]
exclude_lines = [
    "pragma: no cover",
    "def __repr__",
    "raise AssertionError",
    "raise NotImplementedError",
    "if __name__ == .__main__.:",
    "if TYPE_CHECKING:",
]
```

### Dependency Management Commands

```bash
# Environment setup
source .venv/bin/activate
uv sync                        # Install all dependencies
uv sync --dev                  # Install with dev dependencies
uv sync --prod                 # Install only production dependencies

# Adding dependencies
uv add fastapi                 # Add production dependency
uv add --dev pytest           # Add development dependency
uv add --optional prod gunicorn # Add to optional dependency group

# Updating dependencies
uv update                      # Update all dependencies
uv update fastapi              # Update specific package
uv lock                        # Update lock file only

# Removing dependencies
uv remove pytest              # Remove dependency
uv remove --dev black          # Remove dev dependency

# Virtual environment management
uv venv                        # Create virtual environment
uv venv --python 3.13         # Create with specific Python version
```

## 8. Common Patterns and Anti-Patterns

### Recommended Patterns

#### Repository Pattern with Dependency Injection

```python
# Good: Abstract interface and concrete implementation
from abc import ABC, abstractmethod
from typing import Optional, List

class UserRepositoryInterface(ABC):
    """Abstract user repository interface."""
    
    @abstractmethod
    async def create(self, user: User) -> User:
        """Create new user."""
        pass
    
    @abstractmethod
    async def get_by_id(self, user_id: int) -> Optional[User]:
        """Get user by ID."""
        pass
    
    @abstractmethod
    async def get_by_email(self, email: str) -> Optional[User]:
        """Get user by email address."""
        pass

class SqlAlchemyUserRepository(UserRepositoryInterface):
    """SQLAlchemy implementation of user repository."""
    
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def create(self, user: User) -> User:
        """Create new user in database."""
        db_user = UserModel(**user.dict())
        self.session.add(db_user)
        await self.session.commit()
        await self.session.refresh(db_user)
        return User.from_orm(db_user)
```

#### Factory Pattern for Complex Object Creation

```python
from enum import Enum
from typing import Dict, Type

class NotificationType(Enum):
    EMAIL = "email"
    SMS = "sms"
    PUSH = "push"

class NotificationFactory:
    """Factory for creating notification handlers."""
    
    _handlers: Dict[NotificationType, Type[NotificationHandler]] = {
        NotificationType.EMAIL: EmailNotificationHandler,
        NotificationType.SMS: SMSNotificationHandler,
        NotificationType.PUSH: PushNotificationHandler,
    }
    
    @classmethod
    def create_handler(
        self, 
        notification_type: NotificationType,
        config: Dict[str, Any]
    ) -> NotificationHandler:
        """Create appropriate notification handler."""
        handler_class = self._handlers.get(notification_type)
        if not handler_class:
            raise ValueError(f"Unknown notification type: {notification_type}")
        
        return handler_class(config)
```

#### Strategy Pattern for Business Rules

```python
class BookingValidationStrategy(ABC):
    """Abstract booking validation strategy."""
    
    @abstractmethod
    def validate(self, booking_request: BookingRequest) -> ValidationResult:
        """Validate booking request."""
        pass

class StandardBookingValidation(BookingValidationStrategy):
    """Standard booking validation rules."""
    
    def validate(self, booking_request: BookingRequest) -> ValidationResult:
        """Apply standard validation rules."""
        errors = []
        
        # Date validation
        if booking_request.start_date >= booking_request.end_date:
            errors.append("Start date must be before end date")
        
        # Duration validation
        duration = (booking_request.end_date - booking_request.start_date).days
        if duration > 30:
            errors.append("Booking duration cannot exceed 30 days")
        
        return ValidationResult(is_valid=len(errors) == 0, errors=errors)

class BookingService:
    """Booking service with pluggable validation."""
    
    def __init__(
        self,
        validation_strategy: BookingValidationStrategy,
        booking_repository: BookingRepositoryInterface
    ):
        self.validation_strategy = validation_strategy
        self.booking_repository = booking_repository
    
    def create_booking(self, request: BookingRequest) -> Result[Booking, str]:
        """Create booking with validation."""
        validation_result = self.validation_strategy.validate(request)
        
        if not validation_result.is_valid:
            return Err("; ".join(validation_result.errors))
        
        booking = self.booking_repository.create(request)
        return Ok(booking)
```

### Anti-Patterns to Avoid

#### God Class Anti-Pattern

```python
# Bad: Single class doing too many things
class BookingManager:
    """Don't do this - violates single responsibility."""
    
    def create_booking(self, data):
        # Validates data
        # Sends emails
        # Updates database
        # Calculates pricing
        # Handles payments
        # Updates cache
        # Logs events
        # Etc...
        pass

# Good: Separated responsibilities
class BookingService:
    """Focused on booking business logic."""
    
    def __init__(
        self,
        validator: BookingValidator,
        repository: BookingRepository,
        notification_service: NotificationService,
        pricing_service: PricingService,
    ):
        self.validator = validator
        self.repository = repository
        self.notification_service = notification_service
        self.pricing_service = pricing_service
```

#### Magic Numbers and Strings

```python
# Bad: Magic values scattered throughout code
def validate_booking_duration(days):
    if days > 30:  # What is 30?
        return False
    return True

def get_search_radius():
    return 5000  # What is 5000?

# Good: Named constants with context
class BookingConstants:
    MAX_BOOKING_DURATION_DAYS = 30
    DEFAULT_SEARCH_RADIUS_METERS = 5000
    MIN_BOOKING_DURATION_HOURS = 2

def validate_booking_duration(days):
    return days <= BookingConstants.MAX_BOOKING_DURATION_DAYS
```

#### Deeply Nested Code

```python
# Bad: Pyramid of doom
def process_booking(booking_data):
    if booking_data:
        if booking_data.get('user_id'):
            user = get_user(booking_data['user_id'])
            if user:
                if user.is_active:
                    if booking_data.get('tool_id'):
                        tool = get_tool(booking_data['tool_id'])
                        if tool and tool.available:
                            # Finally do something...
                            pass

# Good: Early returns and validation
def process_booking(booking_data: BookingRequest) -> Result[Booking, str]:
    """Process booking with early validation."""
    if not booking_data:
        return Err("Missing booking data")
    
    user = get_user(booking_data.user_id)
    if not user or not user.is_active:
        return Err("Invalid or inactive user")
    
    tool = get_tool(booking_data.tool_id)
    if not tool or not tool.available:
        return Err("Tool not available")
    
    # Process valid booking
    return create_booking(user, tool, booking_data.dates)
```

## 9. Logging and Debugging

### Structured Logging Configuration

```python
import structlog
import logging
from typing import Dict, Any

# Configure structlog
structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.add_logger_name,
        structlog.processors.TimeStamper(fmt="ISO"),
        structlog.dev.ConsoleRenderer(colors=True)  # Development
        # structlog.processors.JSONRenderer()  # Production
    ],
    wrapper_class=structlog.make_filtering_bound_logger(logging.INFO),
    logger_factory=structlog.PrintLoggerFactory(),
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger()

class BookingService:
    """Service with comprehensive logging."""
    
    def __init__(self, booking_repository: BookingRepositoryInterface):
        self.booking_repository = booking_repository
        self.logger = logger.bind(service="booking")
    
    async def create_booking_request(
        self, 
        booking_request: BookingRequest
    ) -> Result[Booking, str]:
        """Create booking with detailed logging."""
        request_id = str(uuid4())
        log = self.logger.bind(
            operation="create_booking",
            request_id=request_id,
            user_id=booking_request.user_id,
            tool_id=booking_request.tool_id
        )
        
        log.info("Starting booking creation", 
                 dates=f"{booking_request.start_date} to {booking_request.end_date}")
        
        try:
            # Validation
            validation_result = self._validate_booking_request(booking_request)
            if not validation_result.is_valid:
                log.warning("Booking validation failed", 
                           errors=validation_result.errors)
                return Err("Validation failed")
            
            # Create booking
            booking = await self.booking_repository.create(booking_request)
            
            log.info("Booking created successfully", 
                    booking_id=booking.id,
                    status=booking.status)
            
            return Ok(booking)
            
        except Exception as e:
            log.exception("Unexpected error during booking creation",
                         error=str(e))
            return Err("Internal error occurred")

# Context management for request tracking
from contextlib import contextmanager

@contextmanager
def request_context(user_id: int, operation: str):
    """Add request context to all logs within the context."""
    structlog.contextvars.clear_contextvars()
    structlog.contextvars.bind_contextvars(
        user_id=user_id,
        operation=operation,
        request_id=str(uuid4())
    )
    try:
        yield
    finally:
        structlog.contextvars.clear_contextvars()

# Usage
async def handle_booking_request(request_data: dict, user_id: int):
    """Handle booking request with context."""
    with request_context(user_id, "create_booking"):
        logger = structlog.get_logger()
        logger.info("Processing booking request")
        
        result = await booking_service.create_booking_request(
            BookingRequest(**request_data)
        )
        
        if isinstance(result, Ok):
            logger.info("Booking request processed successfully")
        else:
            logger.error("Booking request failed", error=result.error)
        
        return result
```

### Error Tracking and Monitoring

```python
import sentry_sdk
from sentry_sdk.integrations.logging import LoggingIntegration
from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration

# Configure Sentry for production error tracking
def configure_sentry(dsn: str, environment: str):
    """Configure Sentry error tracking."""
    sentry_logging = LoggingIntegration(
        level=logging.INFO,        # Capture info and above as breadcrumbs
        event_level=logging.ERROR  # Send errors as events
    )
    
    sentry_sdk.init(
        dsn=dsn,
        environment=environment,
        integrations=[
            sentry_logging,
            SqlalchemyIntegration(),
        ],
        traces_sample_rate=0.1,  # Performance monitoring
        profiles_sample_rate=0.1,  # Profiling
        before_send=filter_sensitive_data,
    )

def filter_sensitive_data(event, hint):
    """Filter sensitive data from error reports."""
    # Remove sensitive keys from event data
    sensitive_keys = ['password', 'token', 'secret', 'key']
    
    if 'extra' in event:
        for key in sensitive_keys:
            if key in event['extra']:
                event['extra'][key] = '[Filtered]'
    
    return event

# Custom metrics for monitoring
from prometheus_client import Counter, Histogram, Gauge

# Business metrics
booking_requests_total = Counter(
    'booking_requests_total',
    'Total booking requests',
    ['status', 'tool_category']
)

booking_duration = Histogram(
    'booking_processing_duration_seconds',
    'Time spent processing bookings'
)

active_bookings = Gauge(
    'active_bookings_count',
    'Current number of active bookings'
)

class MonitoredBookingService:
    """Booking service with metrics collection."""
    
    def __init__(self, booking_repository: BookingRepositoryInterface):
        self.booking_repository = booking_repository
    
    @booking_duration.time()
    async def create_booking_request(
        self, 
        booking_request: BookingRequest
    ) -> Result[Booking, str]:
        """Create booking with metrics collection."""
        try:
            result = await self._create_booking_internal(booking_request)
            
            # Record metrics
            if isinstance(result, Ok):
                booking_requests_total.labels(
                    status='success',
                    tool_category=booking_request.tool.category
                ).inc()
                active_bookings.inc()
            else:
                booking_requests_total.labels(
                    status='failed',
                    tool_category=booking_request.tool.category
                ).inc()
            
            return result
            
        except Exception as e:
            booking_requests_total.labels(
                status='error',
                tool_category='unknown'
            ).inc()
            raise
```

### Development Debugging Tools

```python
# Debug decorator for development
from functools import wraps
import time

def debug_performance(func):
    """Decorator to measure function performance in development."""
    @wraps(func)
    async def wrapper(*args, **kwargs):
        if not settings.DEBUG:
            return await func(*args, **kwargs)
        
        start_time = time.time()
        
        try:
            result = await func(*args, **kwargs)
            duration = time.time() - start_time
            
            logger.debug(f"{func.__name__} completed",
                        duration_ms=round(duration * 1000, 2),
                        args_count=len(args),
                        kwargs_keys=list(kwargs.keys()))
            
            return result
            
        except Exception as e:
            duration = time.time() - start_time
            logger.error(f"{func.__name__} failed",
                        duration_ms=round(duration * 1000, 2),
                        error=str(e))
            raise
    
    return wrapper

# Database query debugging
class DebugSessionMixin:
    """Mixin to add query debugging to repository classes."""
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if settings.DEBUG:
            self._setup_query_logging()
    
    def _setup_query_logging(self):
        """Setup query logging for development."""
        import sqlalchemy.engine
        
        @event.listens_for(sqlalchemy.engine.Engine, "before_cursor_execute")
        def receive_before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
            context._query_start_time = time.time()
            logger.debug("Starting query", statement=statement[:200])
        
        @event.listens_for(sqlalchemy.engine.Engine, "after_cursor_execute")
        def receive_after_cursor_execute(conn, cursor, statement, parameters, context, executemany):
            duration = time.time() - context._query_start_time
            logger.debug("Query completed",
                        duration_ms=round(duration * 1000, 2),
                        statement=statement[:200])
```

## 10. Summary

This document establishes comprehensive Python development standards for the Wippestoolen platform, covering:

1. **Project Structure**: Clean architecture with clear separation of concerns
2. **Code Style**: Beyond formatting tools, emphasizing readability and maintainability  
3. **Type Hints**: Comprehensive typing for better code documentation and IDE support
4. **Error Handling**: Robust error handling with custom exception hierarchies
5. **Testing**: Multi-level testing strategy with unit, integration, and e2e tests
6. **Performance**: Database optimization, async patterns, and caching strategies
7. **Dependencies**: Modern dependency management with uv and proper configuration
8. **Patterns**: Recommended patterns and anti-patterns to avoid
9. **Logging**: Structured logging with monitoring and debugging capabilities

These standards ensure code quality, maintainability, and scalability while following Python best practices and SOLID principles. Regular code reviews should enforce adherence to these standards.

## Implementation Priority

1. **Immediate**: Project structure, basic patterns, and testing setup
2. **Short-term**: Error handling, logging, and monitoring implementation  
3. **Medium-term**: Performance optimizations and advanced patterns
4. **Long-term**: Comprehensive metrics and advanced debugging tools

Follow these standards consistently to build a robust, maintainable, and scalable platform.