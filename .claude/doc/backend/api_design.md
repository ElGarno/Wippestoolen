# Backend API Design Documentation
## Wippestoolen Tool-Sharing Platform

**Author**: Backend Expert Agent  
**Date**: August 21, 2025  
**Version**: 1.0  

---

## Executive Summary

This document provides comprehensive backend API design specifications for the Wippestoolen tool-sharing platform. The system is designed to support MVP features while maintaining cost efficiency (<$40/month) and scalability from 10 to 10,000+ users on AWS infrastructure.

---

## Framework Recommendation: FastAPI

### Justification

**FastAPI is recommended over Django and Flask for this project:**

#### Why FastAPI:
- **Performance**: Excellent performance for API-heavy applications (outperforms Flask/Django)
- **Modern Python**: Built for Python 3.6+ with full typing support and async capabilities
- **Auto-documentation**: Built-in OpenAPI/Swagger documentation generation
- **Cost Efficiency**: Lower resource usage = reduced AWS costs
- **Scalability**: Async support enables better concurrent request handling
- **Developer Experience**: Fast development with excellent IDE support and validation
- **Small Footprint**: Perfect for containerized deployments on AWS

#### Why Not Django:
- Heavier framework with features we don't need (admin, templating, etc.)
- Higher resource consumption
- Less optimal for pure API services
- More complex for simple tool-sharing use case

#### Why Not Flask:
- Requires more manual setup for features FastAPI provides out-of-box
- Less efficient async support
- Manual API documentation
- Less type safety

### FastAPI Architecture Pattern

```python
# Recommended project structure
wippestoolen/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI app instance
│   ├── core/
│   │   ├── config.py        # Settings management
│   │   ├── security.py      # JWT/Auth utilities
│   │   └── database.py      # DB connection
│   ├── models/              # SQLAlchemy models
│   ├── schemas/             # Pydantic models
│   ├── api/
│   │   ├── v1/              # API version 1
│   │   │   ├── endpoints/   # Route handlers
│   │   │   └── dependencies.py
│   │   └── __init__.py
│   ├── services/            # Business logic
│   └── utils/               # Helper functions
├── tests/
├── migrations/              # Alembic migrations
└── requirements/
```

---

## Authentication Strategy

### JWT Token-Based Authentication

**Recommended approach**: JWT with refresh token pattern

#### Implementation Details:

```python
# Token configuration
ACCESS_TOKEN_EXPIRE_MINUTES = 30
REFRESH_TOKEN_EXPIRE_DAYS = 30

# Token payload structure
{
  "sub": "user_id",
  "email": "user@example.com",
  "exp": timestamp,
  "iat": timestamp,
  "type": "access"  # or "refresh"
}
```

#### Authentication Flow:

1. **Registration/Login**: Return access + refresh token pair
2. **API Requests**: Include `Authorization: Bearer <access_token>`
3. **Token Refresh**: Use refresh token to get new access token
4. **Logout**: Blacklist tokens (Redis cache for scalability)

#### Security Features:
- Password hashing with bcrypt
- Email verification for new accounts
- Rate limiting on auth endpoints
- Optional 2FA for future enhancement

### Authentication Endpoints:

```python
POST /api/v1/auth/register
POST /api/v1/auth/login
POST /api/v1/auth/refresh
POST /api/v1/auth/logout
POST /api/v1/auth/verify-email
POST /api/v1/auth/reset-password
```

---

## RESTful API Design

### Base URL Structure
```
https://api.wippestoolen.com/api/v1/
```

### HTTP Status Code Standards

- `200 OK`: Successful GET, PUT, PATCH
- `201 Created`: Successful POST
- `204 No Content`: Successful DELETE
- `400 Bad Request`: Validation errors
- `401 Unauthorized`: Authentication required
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Resource not found
- `409 Conflict`: Resource conflicts
- `422 Unprocessable Entity`: Validation errors
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Server errors

---

## Core API Endpoints

### 1. Authentication & User Management

#### User Registration
```http
POST /api/v1/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "secure_password123",
  "display_name": "John Doe",
  "location": {
    "latitude": 52.5200,
    "longitude": 13.4050,
    "address": "Berlin, Germany"
  }
}
```

**Response (201 Created):**
```json
{
  "user": {
    "id": "uuid-string",
    "email": "user@example.com",
    "display_name": "John Doe",
    "average_rating": 0.0,
    "review_count": 0,
    "created_at": "2025-08-21T10:00:00Z",
    "is_verified": false
  },
  "access_token": "jwt-access-token",
  "refresh_token": "jwt-refresh-token",
  "token_type": "bearer"
}
```

#### User Login
```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "secure_password123"
}
```

#### Get Current User Profile
```http
GET /api/v1/users/me
Authorization: Bearer <access_token>
```

**Response (200 OK):**
```json
{
  "id": "uuid-string",
  "email": "user@example.com",
  "display_name": "John Doe",
  "location": {
    "latitude": 52.5200,
    "longitude": 13.4050,
    "address": "Berlin, Germany"
  },
  "average_rating": 4.2,
  "review_count": 15,
  "created_at": "2025-08-21T10:00:00Z",
  "is_verified": true
}
```

### 2. Tool Management

#### Create Tool Listing
```http
POST /api/v1/tools
Authorization: Bearer <access_token>
Content-Type: multipart/form-data

{
  "title": "Electric Drill",
  "category": "power_tools",
  "description": "Professional electric drill with multiple bits",
  "manufacturer": "Bosch",
  "model": "PSB 1800",
  "max_loan_days": 7,
  "deposit_amount": 50.00,
  "location": {
    "latitude": 52.5200,
    "longitude": 13.4050,
    "address": "Berlin, Germany"
  },
  "availability_start": "2025-08-22T00:00:00Z",
  "availability_end": "2025-12-31T23:59:59Z",
  "photos": [file1, file2, file3]  # multipart files
}
```

**Response (201 Created):**
```json
{
  "id": "uuid-string",
  "title": "Electric Drill",
  "category": "power_tools",
  "description": "Professional electric drill with multiple bits",
  "manufacturer": "Bosch",
  "model": "PSB 1800",
  "max_loan_days": 7,
  "deposit_amount": 50.00,
  "owner": {
    "id": "uuid-string",
    "display_name": "John Doe",
    "average_rating": 4.2
  },
  "location": {
    "latitude": 52.5200,
    "longitude": 13.4050,
    "address": "Berlin, Germany"
  },
  "photos": [
    {
      "id": "uuid-string",
      "url": "https://s3.amazonaws.com/wippestoolen/photos/photo1.jpg",
      "thumbnail_url": "https://s3.amazonaws.com/wippestoolen/thumbnails/photo1_thumb.jpg"
    }
  ],
  "availability_start": "2025-08-22T00:00:00Z",
  "availability_end": "2025-12-31T23:59:59Z",
  "is_available": true,
  "created_at": "2025-08-21T10:00:00Z",
  "updated_at": "2025-08-21T10:00:00Z"
}
```

#### Search Tools
```http
GET /api/v1/tools/search?q=drill&category=power_tools&lat=52.5200&lon=13.4050&radius=10&available=true&limit=20&offset=0
```

**Response (200 OK):**
```json
{
  "total": 45,
  "limit": 20,
  "offset": 0,
  "tools": [
    {
      "id": "uuid-string",
      "title": "Electric Drill",
      "category": "power_tools",
      "manufacturer": "Bosch",
      "owner": {
        "id": "uuid-string",
        "display_name": "John Doe",
        "average_rating": 4.2
      },
      "location": {
        "distance_km": 2.3,
        "address": "Berlin, Germany"
      },
      "photos": [
        {
          "thumbnail_url": "https://s3.amazonaws.com/wippestoolen/thumbnails/photo1_thumb.jpg"
        }
      ],
      "is_available": true,
      "deposit_amount": 50.00
    }
  ]
}
```

#### Get Tool Details
```http
GET /api/v1/tools/{tool_id}
```

**Response (200 OK):**
```json
{
  "id": "uuid-string",
  "title": "Electric Drill",
  "category": "power_tools",
  "description": "Professional electric drill with multiple bits",
  "manufacturer": "Bosch",
  "model": "PSB 1800",
  "max_loan_days": 7,
  "deposit_amount": 50.00,
  "owner": {
    "id": "uuid-string",
    "display_name": "John Doe",
    "average_rating": 4.2,
    "review_count": 15
  },
  "location": {
    "latitude": 52.5200,
    "longitude": 13.4050,
    "address": "Berlin, Germany"
  },
  "photos": [
    {
      "id": "uuid-string",
      "url": "https://s3.amazonaws.com/wippestoolen/photos/photo1.jpg",
      "thumbnail_url": "https://s3.amazonaws.com/wippestoolen/thumbnails/photo1_thumb.jpg"
    }
  ],
  "availability_start": "2025-08-22T00:00:00Z",
  "availability_end": "2025-12-31T23:59:59Z",
  "is_available": true,
  "created_at": "2025-08-21T10:00:00Z",
  "updated_at": "2025-08-21T10:00:00Z",
  "reviews": [
    {
      "id": "uuid-string",
      "rating": 5,
      "comment": "Great tool, worked perfectly!",
      "reviewer": {
        "display_name": "Jane Smith"
      },
      "created_at": "2025-08-20T15:30:00Z"
    }
  ]
}
```

### 3. Booking Management

#### Create Booking Request
```http
POST /api/v1/bookings
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "tool_id": "uuid-string",
  "start_date": "2025-08-25T10:00:00Z",
  "end_date": "2025-08-27T18:00:00Z",
  "message": "Hi, I need this for a home project. I'll take good care of it."
}
```

**Response (201 Created):**
```json
{
  "id": "uuid-string",
  "tool": {
    "id": "uuid-string",
    "title": "Electric Drill",
    "owner": {
      "id": "uuid-string",
      "display_name": "John Doe"
    }
  },
  "borrower": {
    "id": "uuid-string",
    "display_name": "Jane Smith"
  },
  "start_date": "2025-08-25T10:00:00Z",
  "end_date": "2025-08-27T18:00:00Z",
  "message": "Hi, I need this for a home project. I'll take good care of it.",
  "status": "requested",
  "created_at": "2025-08-21T10:00:00Z",
  "updated_at": "2025-08-21T10:00:00Z"
}
```

#### Booking Status Transitions
```python
# Booking state machine
BOOKING_STATES = {
    "requested": ["confirmed", "declined", "cancelled"],
    "confirmed": ["active", "cancelled"],
    "active": ["returned", "cancelled"],
    "returned": [],  # Terminal state
    "declined": [],  # Terminal state  
    "cancelled": []  # Terminal state
}
```

#### Update Booking Status
```http
PATCH /api/v1/bookings/{booking_id}/status
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "status": "confirmed",
  "message": "Perfect timing! Tool will be ready for pickup."
}
```

#### Get User's Bookings
```http
GET /api/v1/bookings?status=active&role=borrower&limit=20&offset=0
Authorization: Bearer <access_token>
```

**Response (200 OK):**
```json
{
  "total": 5,
  "limit": 20,
  "offset": 0,
  "bookings": [
    {
      "id": "uuid-string",
      "tool": {
        "id": "uuid-string",
        "title": "Electric Drill",
        "photos": [
          {
            "thumbnail_url": "https://s3.amazonaws.com/wippestoolen/thumbnails/photo1_thumb.jpg"
          }
        ]
      },
      "borrower": {
        "id": "uuid-string",
        "display_name": "Jane Smith"
      },
      "owner": {
        "id": "uuid-string", 
        "display_name": "John Doe"
      },
      "start_date": "2025-08-25T10:00:00Z",
      "end_date": "2025-08-27T18:00:00Z",
      "status": "active",
      "created_at": "2025-08-21T10:00:00Z",
      "can_review": false
    }
  ]
}
```

### 4. Reviews System

#### Create Review
```http
POST /api/v1/reviews
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "booking_id": "uuid-string",
  "reviewee_id": "uuid-string",
  "rating": 5,
  "comment": "Great tool owner! Very responsive and tool was in perfect condition."
}
```

**Response (201 Created):**
```json
{
  "id": "uuid-string",
  "booking_id": "uuid-string",
  "reviewer": {
    "id": "uuid-string",
    "display_name": "Jane Smith"
  },
  "reviewee": {
    "id": "uuid-string",
    "display_name": "John Doe"
  },
  "rating": 5,
  "comment": "Great tool owner! Very responsive and tool was in perfect condition.",
  "created_at": "2025-08-21T10:00:00Z"
}
```

### 5. Notifications System

#### Get User Notifications
```http
GET /api/v1/notifications?unread=true&limit=50&offset=0
Authorization: Bearer <access_token>
```

**Response (200 OK):**
```json
{
  "total": 3,
  "unread_count": 2,
  "notifications": [
    {
      "id": "uuid-string",
      "type": "booking_request",
      "title": "New booking request",
      "message": "Jane Smith requested to borrow your Electric Drill",
      "data": {
        "booking_id": "uuid-string",
        "tool_id": "uuid-string"
      },
      "is_read": false,
      "created_at": "2025-08-21T10:00:00Z"
    }
  ]
}
```

#### Mark Notification as Read
```http
PATCH /api/v1/notifications/{notification_id}/read
Authorization: Bearer <access_token>
```

---

## Request/Response Schemas

### Pydantic Schema Examples

```python
from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List
from datetime import datetime
from enum import Enum

# User schemas
class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)
    display_name: str = Field(..., min_length=2, max_length=100)
    location: Optional[LocationCreate] = None

class UserResponse(BaseModel):
    id: str
    email: EmailStr
    display_name: str
    average_rating: float
    review_count: int
    created_at: datetime
    is_verified: bool

# Tool schemas  
class ToolCategory(str, Enum):
    POWER_TOOLS = "power_tools"
    HAND_TOOLS = "hand_tools"
    GARDEN = "garden"
    KITCHEN = "kitchen"
    CLEANING = "cleaning"

class ToolCreate(BaseModel):
    title: str = Field(..., min_length=5, max_length=200)
    category: ToolCategory
    description: str = Field(..., max_length=2000)
    manufacturer: Optional[str] = Field(None, max_length=100)
    model: Optional[str] = Field(None, max_length=100)
    max_loan_days: int = Field(..., ge=1, le=30)
    deposit_amount: Optional[float] = Field(None, ge=0)
    location: LocationCreate

# Booking schemas
class BookingStatus(str, Enum):
    REQUESTED = "requested"
    CONFIRMED = "confirmed"
    ACTIVE = "active"
    RETURNED = "returned"
    DECLINED = "declined"
    CANCELLED = "cancelled"

class BookingCreate(BaseModel):
    tool_id: str
    start_date: datetime
    end_date: datetime
    message: Optional[str] = Field(None, max_length=500)

    @validator('end_date')
    def end_after_start(cls, v, values):
        if 'start_date' in values and v <= values['start_date']:
            raise ValueError('End date must be after start date')
        return v
```

---

## Business Logic Patterns

### Service Layer Pattern

```python
# services/booking_service.py
from typing import List, Optional
from models import Booking, Tool, User
from schemas import BookingCreate, BookingResponse
from exceptions import BusinessLogicError

class BookingService:
    def __init__(self, db_session, notification_service):
        self.db = db_session
        self.notification_service = notification_service
    
    async def create_booking(self, booking_data: BookingCreate, borrower: User) -> BookingResponse:
        # Business logic validation
        tool = await self.get_tool_or_404(booking_data.tool_id)
        
        if tool.owner_id == borrower.id:
            raise BusinessLogicError("Cannot borrow your own tool")
        
        if not self.is_tool_available(tool, booking_data.start_date, booking_data.end_date):
            raise BusinessLogicError("Tool not available for requested dates")
        
        if self.exceeds_max_loan_days(tool, booking_data.start_date, booking_data.end_date):
            raise BusinessLogicError(f"Booking exceeds maximum loan period of {tool.max_loan_days} days")
        
        # Create booking
        booking = Booking(
            tool_id=tool.id,
            borrower_id=borrower.id,
            start_date=booking_data.start_date,
            end_date=booking_data.end_date,
            message=booking_data.message,
            status="requested"
        )
        
        self.db.add(booking)
        await self.db.commit()
        
        # Send notification to tool owner
        await self.notification_service.send_booking_request_notification(
            tool.owner, booking
        )
        
        return BookingResponse.from_orm(booking)
    
    async def update_booking_status(
        self, 
        booking_id: str, 
        new_status: str, 
        user: User,
        message: Optional[str] = None
    ) -> BookingResponse:
        booking = await self.get_booking_or_404(booking_id)
        
        # Authorization check
        if not self.can_update_booking_status(booking, user, new_status):
            raise PermissionError("Not authorized to update this booking")
        
        # State transition validation
        if not self.is_valid_status_transition(booking.status, new_status):
            raise BusinessLogicError(f"Cannot transition from {booking.status} to {new_status}")
        
        booking.status = new_status
        if message:
            booking.status_message = message
        
        await self.db.commit()
        
        # Send appropriate notifications
        await self.notification_service.send_booking_status_notification(booking)
        
        return BookingResponse.from_orm(booking)
```

### Repository Pattern

```python
# repositories/tool_repository.py
from typing import List, Optional
from sqlalchemy import and_, func, text
from models import Tool, User
from schemas import ToolSearchFilters

class ToolRepository:
    def __init__(self, db_session):
        self.db = db_session
    
    async def search_tools(self, filters: ToolSearchFilters) -> List[Tool]:
        query = self.db.query(Tool).filter(Tool.is_available == True)
        
        if filters.query:
            query = query.filter(
                Tool.title.ilike(f"%{filters.query}%") |
                Tool.description.ilike(f"%{filters.query}%") |
                Tool.manufacturer.ilike(f"%{filters.query}%")
            )
        
        if filters.category:
            query = query.filter(Tool.category == filters.category)
        
        if filters.latitude and filters.longitude and filters.radius:
            # Haversine distance calculation
            distance = func.acos(
                func.sin(func.radians(filters.latitude)) * 
                func.sin(func.radians(Tool.latitude)) +
                func.cos(func.radians(filters.latitude)) * 
                func.cos(func.radians(Tool.latitude)) *
                func.cos(func.radians(Tool.longitude) - func.radians(filters.longitude))
            ) * 6371  # Earth radius in km
            
            query = query.filter(distance <= filters.radius)
            query = query.order_by(distance)
        
        return await query.offset(filters.offset).limit(filters.limit).all()
    
    async def get_available_tools_for_dates(
        self, 
        start_date: datetime, 
        end_date: datetime
    ) -> List[Tool]:
        # Complex query to check availability against existing bookings
        subquery = (
            self.db.query(Booking.tool_id)
            .filter(
                and_(
                    Booking.status.in_(["confirmed", "active"]),
                    Booking.start_date < end_date,
                    Booking.end_date > start_date
                )
            )
            .subquery()
        )
        
        return (
            self.db.query(Tool)
            .filter(
                and_(
                    Tool.is_available == True,
                    ~Tool.id.in_(subquery)
                )
            )
            .all()
        )
```

---

## Error Handling Strategy

### Custom Exception Hierarchy

```python
# exceptions.py
class WippeStorollenException(Exception):
    """Base exception for all application errors"""
    def __init__(self, message: str, error_code: str = None):
        self.message = message
        self.error_code = error_code
        super().__init__(message)

class ValidationError(WippeStorollenException):
    """Validation related errors"""
    pass

class BusinessLogicError(WippeStorollenException):
    """Business logic violations"""
    pass

class NotFoundError(WippeStorollenException):
    """Resource not found"""
    pass

class PermissionError(WippeStorollenException):
    """Insufficient permissions"""
    pass

class RateLimitError(WippeStorollenException):
    """Rate limit exceeded"""
    pass
```

### Global Exception Handler

```python
# main.py
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from exceptions import WippeStorollenException

app = FastAPI()

@app.exception_handler(WippeStorollenException)
async def custom_exception_handler(request: Request, exc: WippeStorollenException):
    status_code = 400
    
    if isinstance(exc, NotFoundError):
        status_code = 404
    elif isinstance(exc, PermissionError):
        status_code = 403
    elif isinstance(exc, RateLimitError):
        status_code = 429
    
    return JSONResponse(
        status_code=status_code,
        content={
            "error": {
                "message": exc.message,
                "code": exc.error_code,
                "type": exc.__class__.__name__
            }
        }
    )

# Validation error handler
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={
            "error": {
                "message": "Validation failed",
                "code": "VALIDATION_ERROR", 
                "details": exc.errors()
            }
        }
    )
```

### Error Response Format

```json
{
  "error": {
    "message": "Tool not available for requested dates",
    "code": "TOOL_NOT_AVAILABLE",
    "type": "BusinessLogicError",
    "details": {
      "tool_id": "uuid-string",
      "requested_start": "2025-08-25T10:00:00Z",
      "requested_end": "2025-08-27T18:00:00Z"
    }
  }
}
```

---

## Rate Limiting & Security

### Rate Limiting Strategy

```python
# middleware/rate_limiting.py
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)

# Apply different limits per endpoint
@app.post("/api/v1/auth/register")
@limiter.limit("5/minute")  # 5 registrations per minute per IP
async def register(request: Request, user_data: UserCreate):
    pass

@app.post("/api/v1/auth/login") 
@limiter.limit("10/minute")  # 10 login attempts per minute per IP
async def login(request: Request, credentials: UserLogin):
    pass

@app.post("/api/v1/tools")
@limiter.limit("20/hour")  # 20 tool listings per hour per IP
async def create_tool(request: Request, tool_data: ToolCreate):
    pass

@app.get("/api/v1/tools/search")
@limiter.limit("100/minute")  # 100 searches per minute per IP  
async def search_tools(request: Request, filters: ToolSearchFilters):
    pass
```

### Input Validation & Sanitization

```python
# utils/validation.py
import re
from typing import Any
import bleach

def sanitize_html(text: str) -> str:
    """Remove potentially dangerous HTML"""
    return bleach.clean(text, strip=True)

def validate_image_file(file: UploadFile) -> bool:
    """Validate uploaded image files"""
    allowed_types = ["image/jpeg", "image/png", "image/webp"]
    max_size = 5 * 1024 * 1024  # 5MB
    
    if file.content_type not in allowed_types:
        return False
    
    if file.size > max_size:
        return False
    
    return True

def validate_coordinates(lat: float, lon: float) -> bool:
    """Validate GPS coordinates"""
    return -90 <= lat <= 90 and -180 <= lon <= 180
```

---

## Testing Strategy

### Testing Pyramid Structure

```python
# tests/conftest.py
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.main import app
from app.core.database import get_db, Base

SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture
def db():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)

@pytest.fixture
def client(db):
    def override_get_db():
        try:
            yield db
        finally:
            db.close()
    
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c

@pytest.fixture
def authenticated_user(client):
    # Create test user and return auth headers
    user_data = {
        "email": "test@example.com",
        "password": "testpass123",
        "display_name": "Test User"
    }
    response = client.post("/api/v1/auth/register", json=user_data)
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
```

### Unit Tests Example

```python
# tests/test_services/test_booking_service.py
import pytest
from unittest.mock import Mock, AsyncMock
from services.booking_service import BookingService
from exceptions import BusinessLogicError

class TestBookingService:
    @pytest.fixture
    def booking_service(self):
        db_mock = Mock()
        notification_service_mock = AsyncMock()
        return BookingService(db_mock, notification_service_mock)
    
    @pytest.fixture
    def sample_tool(self):
        return Mock(
            id="tool-123",
            owner_id="owner-456", 
            max_loan_days=7,
            is_available=True
        )
    
    @pytest.fixture
    def sample_user(self):
        return Mock(id="user-789")
    
    async def test_create_booking_success(self, booking_service, sample_tool, sample_user):
        # Arrange
        booking_data = Mock(
            tool_id="tool-123",
            start_date=datetime.now(),
            end_date=datetime.now() + timedelta(days=3)
        )
        booking_service.get_tool_or_404 = AsyncMock(return_value=sample_tool)
        booking_service.is_tool_available = Mock(return_value=True)
        booking_service.exceeds_max_loan_days = Mock(return_value=False)
        
        # Act
        result = await booking_service.create_booking(booking_data, sample_user)
        
        # Assert
        assert result is not None
        booking_service.notification_service.send_booking_request_notification.assert_called_once()
    
    async def test_create_booking_own_tool_error(self, booking_service, sample_tool, sample_user):
        # Arrange
        sample_tool.owner_id = sample_user.id  # User trying to borrow own tool
        booking_data = Mock(tool_id="tool-123")
        booking_service.get_tool_or_404 = AsyncMock(return_value=sample_tool)
        
        # Act & Assert
        with pytest.raises(BusinessLogicError, match="Cannot borrow your own tool"):
            await booking_service.create_booking(booking_data, sample_user)
```

### Integration Tests Example

```python
# tests/test_integration/test_booking_flow.py
import pytest
from fastapi.testclient import TestClient

class TestBookingFlow:
    def test_complete_booking_flow(self, client, authenticated_user):
        # 1. Create a tool
        tool_data = {
            "title": "Test Electric Drill",
            "category": "power_tools",
            "description": "Great tool for testing",
            "max_loan_days": 7,
            "location": {
                "latitude": 52.5200,
                "longitude": 13.4050,
                "address": "Berlin, Germany"
            }
        }
        
        tool_response = client.post(
            "/api/v1/tools", 
            json=tool_data,
            headers=authenticated_user
        )
        assert tool_response.status_code == 201
        tool_id = tool_response.json()["id"]
        
        # 2. Create second user for borrowing
        borrower_data = {
            "email": "borrower@example.com",
            "password": "testpass123", 
            "display_name": "Test Borrower"
        }
        borrower_response = client.post("/api/v1/auth/register", json=borrower_data)
        assert borrower_response.status_code == 201
        borrower_token = borrower_response.json()["access_token"]
        borrower_headers = {"Authorization": f"Bearer {borrower_token}"}
        
        # 3. Create booking request
        booking_data = {
            "tool_id": tool_id,
            "start_date": "2025-08-25T10:00:00Z",
            "end_date": "2025-08-27T18:00:00Z",
            "message": "Need this for a project"
        }
        
        booking_response = client.post(
            "/api/v1/bookings",
            json=booking_data,
            headers=borrower_headers
        )
        assert booking_response.status_code == 201
        booking_id = booking_response.json()["id"]
        assert booking_response.json()["status"] == "requested"
        
        # 4. Owner confirms booking
        confirm_response = client.patch(
            f"/api/v1/bookings/{booking_id}/status",
            json={"status": "confirmed"},
            headers=authenticated_user
        )
        assert confirm_response.status_code == 200
        assert confirm_response.json()["status"] == "confirmed"
        
        # 5. Mark as active (handed over)
        active_response = client.patch(
            f"/api/v1/bookings/{booking_id}/status", 
            json={"status": "active"},
            headers=authenticated_user
        )
        assert active_response.status_code == 200
        
        # 6. Mark as returned
        returned_response = client.patch(
            f"/api/v1/bookings/{booking_id}/status",
            json={"status": "returned"},
            headers=authenticated_user  
        )
        assert returned_response.status_code == 200
```

---

## Performance & Caching Strategy

### Database Query Optimization

```python
# Efficient queries with SQLAlchemy
from sqlalchemy.orm import selectinload, joinedload

# Eager loading to prevent N+1 queries
async def get_tools_with_owner_info(db: Session, limit: int = 20):
    return (
        db.query(Tool)
        .options(
            joinedload(Tool.owner),  # Single JOIN query
            selectinload(Tool.photos)  # Separate optimized query
        )
        .filter(Tool.is_available == True)
        .limit(limit)
        .all()
    )

# Use database indexes effectively
class Tool(Base):
    __tablename__ = "tools"
    
    # Composite indexes for common queries
    __table_args__ = (
        Index('ix_tools_category_available', 'category', 'is_available'),
        Index('ix_tools_location', 'latitude', 'longitude'),
        Index('ix_tools_owner_created', 'owner_id', 'created_at'),
    )
```

### Redis Caching Strategy

```python
# utils/cache.py
import redis
import json
from typing import Optional, Any
from datetime import timedelta

redis_client = redis.Redis(host='localhost', port=6379, db=0)

class CacheService:
    def __init__(self):
        self.redis = redis_client
    
    async def get_cached_search_results(self, search_key: str) -> Optional[List[dict]]:
        """Cache search results for 5 minutes"""
        cached = self.redis.get(f"search:{search_key}")
        if cached:
            return json.loads(cached)
        return None
    
    async def cache_search_results(self, search_key: str, results: List[dict]):
        """Cache search results with TTL"""
        self.redis.setex(
            f"search:{search_key}",
            timedelta(minutes=5),
            json.dumps(results, default=str)
        )
    
    async def invalidate_tool_cache(self, tool_id: str):
        """Invalidate caches when tool is updated"""
        pattern = f"search:*tool*{tool_id}*"
        for key in self.redis.scan_iter(match=pattern):
            self.redis.delete(key)
```

---

## Deployment & Scalability Considerations

### Container Configuration

```dockerfile
# Dockerfile
FROM python:3.13-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create non-root user
RUN useradd --create-home --shell /bin/bash app
USER app

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:8000/health')"

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Horizontal Scaling Pattern

```python
# app/main.py - Stateless application design
from fastapi import FastAPI
from app.core.config import settings

# Stateless FastAPI app
app = FastAPI(
    title="Wippestoolen API",
    version="1.0.0",
    docs_url="/docs" if settings.ENVIRONMENT == "development" else None
)

# Use external session store (Redis) instead of in-memory
@app.middleware("http")
async def session_middleware(request: Request, call_next):
    # All session data stored in Redis, not server memory
    pass

# Database connection pooling for multiple instances
from sqlalchemy.pool import QueuePool

engine = create_async_engine(
    settings.DATABASE_URL,
    poolclass=QueuePool,
    pool_size=20,          # Connections per instance
    max_overflow=30,       # Additional connections if needed
    pool_pre_ping=True,    # Validate connections
    pool_recycle=3600      # Recycle connections hourly
)
```

### Background Job Processing

```python
# tasks/background_tasks.py
from celery import Celery
from app.core.config import settings

# Use Redis as broker for background tasks
celery_app = Celery(
    "wippestoolen",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL
)

@celery_app.task
def send_notification_email(user_id: str, notification_type: str, data: dict):
    """Send email notifications asynchronously"""
    # Email sending logic
    pass

@celery_app.task
def cleanup_expired_bookings():
    """Daily cleanup of old booking requests"""
    # Cleanup logic
    pass

@celery_app.task
def generate_user_rating_summary(user_id: str):
    """Update user rating aggregations"""
    # Rating calculation logic
    pass
```

---

## API Versioning Strategy

### URL Path Versioning

```python
# api/v1/__init__.py
from fastapi import APIRouter

v1_router = APIRouter(prefix="/api/v1")

# Version-specific routers
from .endpoints import auth, tools, bookings, reviews, notifications

v1_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
v1_router.include_router(tools.router, prefix="/tools", tags=["Tools"])
v1_router.include_router(bookings.router, prefix="/bookings", tags=["Bookings"])
v1_router.include_router(reviews.router, prefix="/reviews", tags=["Reviews"])
v1_router.include_router(notifications.router, prefix="/notifications", tags=["Notifications"])

# Future version support
# v2_router = APIRouter(prefix="/api/v2")
```

### Backward Compatibility

```python
# Handle breaking changes gracefully
@router.get("/tools/{tool_id}", response_model=Union[ToolResponseV1, ToolResponseV2])
async def get_tool(
    tool_id: str,
    request: Request,
    version: str = Header(default="v1", alias="API-Version")
):
    tool = await tool_service.get_tool(tool_id)
    
    if version == "v2":
        return ToolResponseV2.from_orm(tool)
    else:
        return ToolResponseV1.from_orm(tool)
```

---

## Monitoring & Logging

### Structured Logging

```python
# utils/logging.py
import logging
import json
from datetime import datetime
from typing import Dict, Any

class JSONFormatter(logging.Formatter):
    def format(self, record):
        log_entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "level": record.levelname,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno
        }
        
        # Add extra fields if present
        if hasattr(record, 'user_id'):
            log_entry['user_id'] = record.user_id
        if hasattr(record, 'request_id'):
            log_entry['request_id'] = record.request_id
            
        return json.dumps(log_entry)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
handler = logging.StreamHandler()
handler.setFormatter(JSONFormatter())
logger.addHandler(handler)

# Usage in endpoints
@app.middleware("http")
async def logging_middleware(request: Request, call_next):
    start_time = time.time()
    
    response = await call_next(request)
    
    process_time = time.time() - start_time
    logger.info(
        "Request completed",
        extra={
            "method": request.method,
            "url": str(request.url),
            "status_code": response.status_code,
            "process_time": process_time
        }
    )
    
    return response
```

### Health Check Endpoints

```python
# api/health.py
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db

router = APIRouter()

@router.get("/health")
async def health_check():
    """Basic health check"""
    return {"status": "healthy", "timestamp": datetime.utcnow()}

@router.get("/health/detailed")
async def detailed_health_check(db: Session = Depends(get_db)):
    """Detailed health check with dependencies"""
    health_status = {
        "status": "healthy",
        "timestamp": datetime.utcnow(),
        "checks": {}
    }
    
    # Database check
    try:
        db.execute("SELECT 1")
        health_status["checks"]["database"] = "healthy"
    except Exception as e:
        health_status["checks"]["database"] = "unhealthy"
        health_status["status"] = "unhealthy"
    
    # Redis check
    try:
        redis_client.ping()
        health_status["checks"]["redis"] = "healthy" 
    except Exception as e:
        health_status["checks"]["redis"] = "unhealthy"
        health_status["status"] = "degraded"
    
    return health_status
```

---

## Cost Optimization Strategies

### Efficient Resource Usage

1. **Database Connection Pooling**: Minimize connection overhead
2. **Query Optimization**: Use proper indexes and avoid N+1 queries
3. **Caching**: Redis for frequently accessed data
4. **Image Optimization**: Compress and resize uploaded images
5. **Background Jobs**: Use Celery for non-urgent tasks

### AWS Cost Management

```python
# Auto-scaling based on demand
# Lambda functions for low-frequency tasks
# RDS with appropriate instance sizing
# S3 with intelligent tiering for media files

# Example: Use SQS instead of constant polling
import boto3

sqs = boto3.client('sqs')

async def check_notification_queue():
    """Process notifications from SQS queue"""
    messages = sqs.receive_message(
        QueueUrl=settings.NOTIFICATION_QUEUE_URL,
        MaxNumberOfMessages=10,
        WaitTimeSeconds=20  # Long polling to reduce costs
    )
    
    for message in messages.get('Messages', []):
        await process_notification(message)
        sqs.delete_message(
            QueueUrl=settings.NOTIFICATION_QUEUE_URL,
            ReceiptHandle=message['ReceiptHandle']
        )
```

---

## Security Implementation

### Input Validation & Sanitization

```python
# middleware/security.py
from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
import re

class SecurityMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # SQL injection prevention (additional to ORM protection)
        if self.contains_sql_injection_patterns(await request.body()):
            raise HTTPException(status_code=400, detail="Invalid input detected")
        
        # XSS prevention
        for key, value in request.query_params.items():
            if self.contains_xss_patterns(value):
                raise HTTPException(status_code=400, detail="Invalid input detected")
        
        response = await call_next(request)
        
        # Security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        
        return response
    
    def contains_sql_injection_patterns(self, body: bytes) -> bool:
        dangerous_patterns = [
            r"union\s+select",
            r"drop\s+table",
            r"delete\s+from",
            r"insert\s+into"
        ]
        body_str = body.decode('utf-8', errors='ignore').lower()
        return any(re.search(pattern, body_str) for pattern in dangerous_patterns)
```

### File Upload Security

```python
# utils/file_upload.py
import magic
from PIL import Image
import hashlib
import uuid

class SecureFileUpload:
    ALLOWED_MIME_TYPES = [
        'image/jpeg',
        'image/png', 
        'image/webp'
    ]
    MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB
    MAX_IMAGE_DIMENSION = 2048
    
    @classmethod
    async def validate_and_process_image(cls, file: UploadFile) -> dict:
        # Validate file size
        if file.size > cls.MAX_FILE_SIZE:
            raise ValidationError("File too large")
        
        # Read file content
        content = await file.read()
        
        # Validate MIME type with python-magic (more secure than trusting headers)
        mime_type = magic.from_buffer(content, mime=True)
        if mime_type not in cls.ALLOWED_MIME_TYPES:
            raise ValidationError(f"File type {mime_type} not allowed")
        
        # Process with PIL to strip EXIF and resize
        try:
            with Image.open(BytesIO(content)) as img:
                # Remove EXIF data (privacy)
                img = img.convert('RGB')
                
                # Resize if too large
                if img.width > cls.MAX_IMAGE_DIMENSION or img.height > cls.MAX_IMAGE_DIMENSION:
                    img.thumbnail((cls.MAX_IMAGE_DIMENSION, cls.MAX_IMAGE_DIMENSION))
                
                # Generate secure filename
                file_hash = hashlib.md5(content).hexdigest()[:8]
                filename = f"{uuid.uuid4().hex}_{file_hash}.jpg"
                
                # Save processed image
                output = BytesIO()
                img.save(output, format='JPEG', quality=85, optimize=True)
                processed_content = output.getvalue()
        
        except Exception as e:
            raise ValidationError("Invalid image file")
        
        return {
            "filename": filename,
            "content": processed_content,
            "size": len(processed_content),
            "mime_type": "image/jpeg"
        }
```

---

## Conclusion

This backend API design provides a comprehensive foundation for the Wippestoolen tool-sharing platform. Key highlights:

### Strengths:
- **FastAPI framework** optimized for performance and cost efficiency
- **JWT authentication** with refresh token security
- **RESTful design** with proper HTTP semantics
- **Comprehensive error handling** with custom exceptions
- **Scalable architecture** supporting growth from 10 to 10,000+ users
- **Security-first approach** with validation, sanitization, and rate limiting
- **Thorough testing strategy** with unit, integration, and E2E tests
- **Performance optimizations** with caching and database indexing
- **AWS deployment ready** with containerization and auto-scaling

### Cost Optimization:
- Efficient database connection pooling
- Redis caching to reduce database load
- Background job processing for non-urgent tasks
- Proper resource sizing and auto-scaling policies

### Next Steps:
1. Implement database models and migrations
2. Set up authentication system with JWT
3. Create core API endpoints following this specification
4. Implement comprehensive test suite
5. Set up CI/CD pipeline with automated testing
6. Configure monitoring and alerting systems
7. Deploy to AWS with Infrastructure as Code (Tofu)

This design ensures a solid foundation that can scale efficiently while maintaining cost effectiveness and security best practices.