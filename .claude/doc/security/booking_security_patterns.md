# Booking System Security Patterns

## Overview

This document outlines comprehensive security patterns and measures for the Wippestoolen booking system, covering authentication, authorization, data protection, and abuse prevention.

## Authentication & Authorization

### 1. JWT Token Validation

**Booking Endpoint Protection**:
```python
from functools import wraps
from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

security = HTTPBearer()

async def verify_jwt_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Verify JWT token and extract user information."""
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        user_id = payload.get("sub")
        
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        # Verify token is not blacklisted (if using token blacklist)
        if await is_token_blacklisted(token):
            raise HTTPException(status_code=401, detail="Token revoked")
        
        return UUID(user_id)
    
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
```

### 2. Role-Based Access Control (RBAC)

**Booking Permission Matrix**:

| Action | Borrower | Tool Owner | Admin |
|--------|----------|------------|-------|
| Create booking | ✓ (own request) | ❌ | ✓ |
| View booking details | ✓ (own bookings) | ✓ (own tools) | ✓ |
| Confirm/Decline | ❌ | ✓ (own tools) | ✓ |
| Cancel booking | ✓ (own, if pending) | ✓ (own tools) | ✓ |
| Mark as picked up | ✓ (borrower) | ✓ (owner) | ✓ |
| Mark as returned | ✓ (borrower) | ✓ (owner) | ✓ |

**Implementation**:
```python
class BookingPermission:
    @staticmethod
    async def can_view_booking(user_id: UUID, booking: Booking) -> bool:
        """Check if user can view booking details."""
        return (
            user_id == booking.borrower_id or 
            user_id == booking.tool.owner_id or
            await is_admin(user_id)
        )
    
    @staticmethod
    async def can_modify_booking(user_id: UUID, booking: Booking, action: str) -> bool:
        """Check if user can perform specific action on booking."""
        
        # Admin can do everything
        if await is_admin(user_id):
            return True
        
        # Action-specific permissions
        if action in ['confirm', 'decline']:
            return user_id == booking.tool.owner_id
        
        elif action == 'cancel':
            if booking.status == 'pending':
                return user_id == booking.borrower_id
            else:
                return user_id in [booking.borrower_id, booking.tool.owner_id]
        
        elif action in ['pickup', 'return']:
            return user_id in [booking.borrower_id, booking.tool.owner_id]
        
        return False

# Decorator for permission checking
def require_booking_permission(action: str):
    def decorator(func):
        @wraps(func)
        async def wrapper(booking_id: UUID, current_user: UUID, *args, **kwargs):
            booking = await get_booking_with_tool(booking_id)
            
            if not await BookingPermission.can_modify_booking(current_user, booking, action):
                raise HTTPException(
                    status_code=403, 
                    detail=f"Permission denied for action: {action}"
                )
            
            return await func(booking_id, current_user, *args, **kwargs)
        return wrapper
    return decorator
```

### 3. Anti-Own-Tool Booking Protection

```python
async def validate_booking_request(user_id: UUID, booking_data: BookingCreateSchema):
    """Prevent users from booking their own tools."""
    
    tool = await get_tool(booking_data.tool_id)
    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")
    
    if tool.owner_id == user_id:
        raise HTTPException(
            status_code=400, 
            detail="Cannot book your own tool"
        )
    
    return tool
```

## Input Validation & Sanitization

### 1. Comprehensive Input Validation

```python
from pydantic import BaseModel, field_validator, Field
from datetime import date, timedelta
import re

class BookingCreateSchema(BaseModel):
    tool_id: UUID
    requested_start_date: date
    requested_end_date: date
    borrower_message: Optional[str] = Field(None, max_length=1000)
    pickup_method: Literal['pickup', 'delivery'] = 'pickup'
    pickup_address: Optional[str] = Field(None, max_length=500)
    
    @field_validator('requested_start_date')
    @classmethod
    def validate_start_date(cls, v):
        """Validate start date constraints."""
        today = date.today()
        
        if v < today:
            raise ValueError('Start date cannot be in the past')
        
        if v > today + timedelta(days=365):
            raise ValueError('Start date cannot be more than 1 year in advance')
        
        # Prevent weekend bookings if business rule applies
        if v.weekday() > 4:  # Saturday = 5, Sunday = 6
            raise ValueError('Bookings only allowed on weekdays')
        
        return v
    
    @field_validator('requested_end_date')
    @classmethod
    def validate_end_date(cls, v, info):
        """Validate end date constraints."""
        if 'requested_start_date' in info.data:
            start_date = info.data['requested_start_date']
            
            if v < start_date:
                raise ValueError('End date must be after start date')
            
            # Maximum booking duration
            max_duration = timedelta(days=30)
            if (v - start_date) > max_duration:
                raise ValueError('Booking period cannot exceed 30 days')
            
            # Minimum booking duration
            min_duration = timedelta(days=1)
            if (v - start_date) < min_duration:
                raise ValueError('Minimum booking period is 1 day')
        
        return v
    
    @field_validator('borrower_message')
    @classmethod
    def validate_message(cls, v):
        """Sanitize and validate borrower message."""
        if not v:
            return v
        
        # Remove potentially harmful content
        v = re.sub(r'<[^>]*>', '', v)  # Remove HTML tags
        v = re.sub(r'javascript:', '', v, flags=re.IGNORECASE)  # Remove JS
        v = v.strip()
        
        # Check for spam patterns
        spam_patterns = [
            r'http[s]?://',  # URLs
            r'www\.',        # Web addresses
            r'@\w+\.',       # Email patterns
            r'\b(?:call|text|whatsapp)\b.*\d{3}.*\d{3}.*\d{4}',  # Phone numbers
        ]
        
        for pattern in spam_patterns:
            if re.search(pattern, v, re.IGNORECASE):
                raise ValueError('Message contains prohibited content')
        
        return v
    
    @field_validator('pickup_address')
    @classmethod
    def validate_pickup_address(cls, v, info):
        """Validate pickup address for delivery method."""
        pickup_method = info.data.get('pickup_method')
        
        if pickup_method == 'delivery':
            if not v or len(v.strip()) < 10:
                raise ValueError('Valid pickup address required for delivery')
            
            # Sanitize address
            v = re.sub(r'<[^>]*>', '', v)  # Remove HTML
            v = v.strip()
        
        return v
```

### 2. Status Transition Validation

```python
class BookingStatusUpdateSchema(BaseModel):
    status: Literal['confirmed', 'declined', 'active', 'returned', 'completed', 'cancelled']
    owner_response: Optional[str] = Field(None, max_length=500)
    pickup_notes: Optional[str] = Field(None, max_length=500)
    return_notes: Optional[str] = Field(None, max_length=500)
    cancellation_reason: Optional[str] = Field(None, max_length=500)
    
    @field_validator('owner_response', 'pickup_notes', 'return_notes', 'cancellation_reason')
    @classmethod
    def sanitize_text_fields(cls, v):
        """Sanitize all text input fields."""
        if not v:
            return v
        
        # Remove HTML and potentially harmful content
        v = re.sub(r'<[^>]*>', '', v)
        v = re.sub(r'javascript:', '', v, flags=re.IGNORECASE)
        v = v.strip()
        
        return v
```

## Rate Limiting & Abuse Prevention

### 1. API Rate Limiting

```python
from fastapi import Request
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)

# Rate limiting decorators for booking endpoints
@limiter.limit("10/minute")  # Maximum 10 booking requests per minute
async def create_booking(request: Request, booking_data: BookingCreateSchema):
    """Create booking with rate limiting."""
    pass

@limiter.limit("50/minute")  # Higher limit for viewing bookings
async def list_bookings(request: Request):
    """List bookings with rate limiting."""
    pass

@limiter.limit("20/minute")  # Moderate limit for status updates
async def update_booking_status(request: Request, booking_id: UUID):
    """Update booking status with rate limiting."""
    pass
```

### 2. User-Based Rate Limiting

```python
import redis
from datetime import timedelta

class UserRateLimiter:
    def __init__(self, redis_client):
        self.redis = redis_client
    
    async def check_booking_limits(self, user_id: UUID) -> bool:
        """Check if user has exceeded booking limits."""
        
        # Daily booking creation limit
        daily_key = f"booking_daily:{user_id}:{date.today()}"
        daily_count = await self.redis.get(daily_key) or 0
        
        if int(daily_count) >= 10:  # Max 10 bookings per day
            raise HTTPException(
                status_code=429, 
                detail="Daily booking limit exceeded"
            )
        
        # Hourly booking creation limit
        hour_key = f"booking_hourly:{user_id}:{datetime.now().hour}"
        hourly_count = await self.redis.get(hour_key) or 0
        
        if int(hourly_count) >= 5:  # Max 5 bookings per hour
            raise HTTPException(
                status_code=429, 
                detail="Hourly booking limit exceeded"
            )
        
        return True
    
    async def increment_booking_count(self, user_id: UUID):
        """Increment booking counters."""
        daily_key = f"booking_daily:{user_id}:{date.today()}"
        hour_key = f"booking_hourly:{user_id}:{datetime.now().hour}"
        
        # Increment with expiration
        await self.redis.incr(daily_key)
        await self.redis.expire(daily_key, 86400)  # 24 hours
        
        await self.redis.incr(hour_key)
        await self.redis.expire(hour_key, 3600)  # 1 hour
```

### 3. Suspicious Activity Detection

```python
class BookingSecurityMonitor:
    def __init__(self, redis_client):
        self.redis = redis_client
    
    async def detect_suspicious_patterns(self, user_id: UUID, booking_data: BookingCreateSchema):
        """Detect potentially suspicious booking patterns."""
        
        # Check for rapid-fire booking attempts
        recent_attempts_key = f"booking_attempts:{user_id}"
        attempts = await self.redis.llen(recent_attempts_key)
        
        if attempts > 20:  # More than 20 attempts in 5 minutes
            await self._flag_suspicious_activity(user_id, "rapid_booking_attempts")
        
        # Track booking attempts
        await self.redis.lpush(recent_attempts_key, str(time.time()))
        await self.redis.expire(recent_attempts_key, 300)  # 5 minutes
        await self.redis.ltrim(recent_attempts_key, 0, 19)  # Keep last 20
        
        # Check for same-tool repeated booking attempts
        tool_attempts_key = f"tool_attempts:{user_id}:{booking_data.tool_id}"
        tool_attempts = await self.redis.incr(tool_attempts_key)
        await self.redis.expire(tool_attempts_key, 3600)  # 1 hour
        
        if tool_attempts > 5:  # More than 5 attempts for same tool in 1 hour
            await self._flag_suspicious_activity(user_id, "repeated_tool_booking")
    
    async def _flag_suspicious_activity(self, user_id: UUID, activity_type: str):
        """Flag user for manual review."""
        await self.redis.sadd(f"flagged_users:{activity_type}", str(user_id))
        
        # Log security event
        security_event = {
            "user_id": str(user_id),
            "activity_type": activity_type,
            "timestamp": datetime.utcnow().isoformat(),
            "severity": "medium"
        }
        
        await self.redis.lpush("security_events", json.dumps(security_event))
```

## Data Protection & Privacy

### 1. Sensitive Data Handling

```python
class SecureBookingData:
    @staticmethod
    def sanitize_booking_response(booking: Booking, user_id: UUID) -> dict:
        """Sanitize booking data based on user permissions."""
        
        response = {
            "id": booking.id,
            "tool_id": booking.tool_id,
            "requested_start_date": booking.requested_start_date,
            "requested_end_date": booking.requested_end_date,
            "status": booking.status,
            "total_amount": booking.total_amount,
            "created_at": booking.created_at
        }
        
        # Add sensitive data only for involved parties
        if user_id in [booking.borrower_id, booking.tool.owner_id]:
            response.update({
                "borrower_message": booking.borrower_message,
                "owner_response": booking.owner_response,
                "pickup_notes": booking.pickup_notes,
                "return_notes": booking.return_notes,
                "pickup_address": booking.pickup_address,
                "borrower": {
                    "id": booking.borrower.id,
                    "username": booking.borrower.username,
                    "rating": booking.borrower.rating
                },
                "tool_owner": {
                    "id": booking.tool.owner.id,
                    "username": booking.tool.owner.username,
                    "rating": booking.tool.owner.rating
                }
            })
            
            # Add contact info only when booking is confirmed
            if booking.status in ['confirmed', 'active']:
                response["borrower"]["phone"] = booking.borrower.phone
                response["tool_owner"]["phone"] = booking.tool.owner.phone
        
        return response
```

### 2. GDPR Compliance

```python
class BookingDataProtection:
    @staticmethod
    async def anonymize_user_bookings(user_id: UUID):
        """Anonymize user data while preserving booking integrity."""
        
        # Update borrower bookings
        await db.execute(
            update(Booking)
            .where(Booking.borrower_id == user_id)
            .values(
                borrower_message="[User data removed]",
                pickup_address="[Address removed]",
                return_notes="[User data removed]"
            )
        )
        
        # Update owner response in bookings for tools owned by user
        await db.execute(
            update(Booking)
            .where(Booking.tool_id.in_(
                select(Tool.id).where(Tool.owner_id == user_id)
            ))
            .values(
                owner_response="[User data removed]",
                pickup_notes="[User data removed]"
            )
        )
    
    @staticmethod
    async def export_user_booking_data(user_id: UUID) -> dict:
        """Export user's booking data for GDPR compliance."""
        
        query = select(Booking).where(
            or_(
                Booking.borrower_id == user_id,
                Booking.tool_id.in_(
                    select(Tool.id).where(Tool.owner_id == user_id)
                )
            )
        )
        
        bookings = await db.execute(query)
        
        export_data = {
            "user_id": str(user_id),
            "export_date": datetime.utcnow().isoformat(),
            "bookings": [
                {
                    "id": str(booking.id),
                    "role": "borrower" if booking.borrower_id == user_id else "owner",
                    "tool_id": str(booking.tool_id),
                    "dates": f"{booking.requested_start_date} to {booking.requested_end_date}",
                    "status": booking.status,
                    "messages": {
                        "borrower_message": booking.borrower_message,
                        "owner_response": booking.owner_response
                    }
                }
                for booking in bookings.scalars().all()
            ]
        }
        
        return export_data
```

## Audit Logging & Monitoring

### 1. Security Event Logging

```python
import structlog

security_logger = structlog.get_logger("security")

class BookingAuditLogger:
    @staticmethod
    async def log_booking_created(booking_id: UUID, user_id: UUID, tool_id: UUID):
        """Log booking creation event."""
        security_logger.info(
            "booking_created",
            booking_id=str(booking_id),
            user_id=str(user_id),
            tool_id=str(tool_id),
            event_type="booking_creation",
            timestamp=datetime.utcnow().isoformat()
        )
    
    @staticmethod
    async def log_status_change(booking_id: UUID, user_id: UUID, old_status: str, new_status: str):
        """Log booking status changes."""
        security_logger.info(
            "booking_status_changed",
            booking_id=str(booking_id),
            user_id=str(user_id),
            old_status=old_status,
            new_status=new_status,
            event_type="status_change",
            timestamp=datetime.utcnow().isoformat()
        )
    
    @staticmethod
    async def log_security_violation(user_id: UUID, violation_type: str, details: dict):
        """Log security violations."""
        security_logger.warning(
            "security_violation",
            user_id=str(user_id),
            violation_type=violation_type,
            details=details,
            event_type="security_violation",
            timestamp=datetime.utcnow().isoformat()
        )
```

### 2. Real-time Security Monitoring

```python
class SecurityMonitoring:
    def __init__(self, redis_client):
        self.redis = redis_client
    
    async def monitor_booking_anomalies(self):
        """Monitor for booking-related security anomalies."""
        
        # Check for users with excessive failed booking attempts
        failed_attempts = await self.redis.hgetall("failed_booking_attempts")
        
        for user_id, attempts in failed_attempts.items():
            if int(attempts) > 10:  # More than 10 failed attempts
                await self._alert_security_team(
                    f"User {user_id} has {attempts} failed booking attempts"
                )
        
        # Check for unusual booking patterns
        await self._check_unusual_patterns()
    
    async def _check_unusual_patterns(self):
        """Check for unusual booking patterns."""
        
        # Detect users booking multiple tools from same owner
        pattern_key = "booking_patterns:*"
        patterns = await self.redis.keys(pattern_key)
        
        for pattern in patterns:
            count = await self.redis.get(pattern)
            if int(count) > 5:  # More than 5 bookings from same owner
                await self._alert_security_team(f"Unusual booking pattern: {pattern}")
```

## Fraud Prevention

### 1. Payment Security

```python
class BookingPaymentSecurity:
    @staticmethod
    async def validate_payment_attempt(user_id: UUID, booking_id: UUID, amount: Decimal):
        """Validate payment attempts for security."""
        
        booking = await get_booking(booking_id)
        
        # Verify amount matches booking total
        if amount != booking.total_amount:
            raise HTTPException(
                status_code=400, 
                detail="Payment amount does not match booking total"
            )
        
        # Verify user is the borrower
        if user_id != booking.borrower_id:
            raise HTTPException(
                status_code=403, 
                detail="Only borrower can make payment"
            )
        
        # Check for duplicate payment attempts
        payment_key = f"payment_attempt:{booking_id}"
        if await redis.exists(payment_key):
            raise HTTPException(
                status_code=409, 
                detail="Payment already in progress"
            )
        
        # Lock payment processing
        await redis.setex(payment_key, 300, "processing")  # 5 minute lock
```

### 2. Chargeback Protection

```python
class ChargebackProtection:
    @staticmethod
    async def assess_chargeback_risk(booking: Booking) -> str:
        """Assess chargeback risk for booking."""
        
        risk_score = 0
        
        # Check borrower history
        borrower_bookings = await get_user_booking_history(booking.borrower_id)
        
        # High risk indicators
        if len(borrower_bookings) == 0:  # New user
            risk_score += 2
        
        if booking.borrower.rating < 3.0:  # Low rating
            risk_score += 3
        
        recent_disputes = await count_recent_disputes(booking.borrower_id)
        risk_score += recent_disputes * 2
        
        # Booking-specific risks
        if booking.total_amount > 200:  # High value booking
            risk_score += 1
        
        if (booking.requested_start_date - date.today()).days < 2:  # Last minute booking
            risk_score += 1
        
        # Risk assessment
        if risk_score >= 6:
            return "high"
        elif risk_score >= 3:
            return "medium"
        else:
            return "low"
```

## Security Headers & API Protection

### 1. Security Headers

```python
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware

# Security middleware configuration
app.add_middleware(
    TrustedHostMiddleware, 
    allowed_hosts=["wippestoolen.com", "*.wippestoolen.com"]
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://wippestoolen.com"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
    allow_headers=["*"],
    expose_headers=["X-Rate-Limit-Remaining", "X-Rate-Limit-Reset"]
)

# Custom security headers
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["Content-Security-Policy"] = "default-src 'self'"
    
    return response
```

### 2. SQL Injection Prevention

```python
# Always use parameterized queries with SQLAlchemy
from sqlalchemy import text

# NEVER do this - vulnerable to SQL injection
# query = f"SELECT * FROM bookings WHERE user_id = '{user_id}'"

# ALWAYS do this - safe parameterized query
async def get_user_bookings_safe(user_id: UUID, status: Optional[str] = None):
    """Safe parameterized query for user bookings."""
    
    query = select(Booking).where(Booking.borrower_id == user_id)
    
    if status:
        query = query.where(Booking.status == status)
    
    result = await db.execute(query)
    return result.scalars().all()

# For raw SQL (when absolutely necessary), use text() with bound parameters
async def complex_booking_query(user_id: UUID, date_range: tuple):
    """Example of safe raw SQL usage."""
    
    query = text("""
        SELECT b.*, t.title 
        FROM bookings b 
        JOIN tools t ON b.tool_id = t.id 
        WHERE b.borrower_id = :user_id 
        AND b.requested_start_date BETWEEN :start_date AND :end_date
    """)
    
    result = await db.execute(
        query, 
        {
            "user_id": user_id, 
            "start_date": date_range[0], 
            "end_date": date_range[1]
        }
    )
    return result.fetchall()
```

This comprehensive security documentation provides robust protection patterns for the booking system while maintaining usability and performance.