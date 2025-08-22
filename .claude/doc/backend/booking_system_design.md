# Booking System API Design Documentation

## Overview

This document provides comprehensive API design and business logic patterns for the Wippestoolen booking system. The booking system enables users to request tools, manage lending transactions, and handle the complete borrowing lifecycle.

## API Endpoints Design

### 1. Create Booking Request

**Endpoint**: `POST /api/v1/bookings`

**Description**: Creates a new booking request from a borrower to a tool owner.

**Request Schema**:
```json
{
  "tool_id": "uuid",
  "requested_start_date": "2024-01-15",
  "requested_end_date": "2024-01-20",
  "borrower_message": "I need this drill for a kitchen renovation project",
  "pickup_method": "pickup|delivery",
  "pickup_address": "123 Main St (optional, for delivery)"
}
```

**Response Schema** (201 Created):
```json
{
  "id": "uuid",
  "tool": {
    "id": "uuid",
    "title": "DeWalt Cordless Drill",
    "owner": {
      "id": "uuid",
      "username": "toolowner",
      "rating": 4.8
    }
  },
  "borrower_id": "uuid",
  "requested_start_date": "2024-01-15",
  "requested_end_date": "2024-01-20",
  "status": "pending",
  "borrower_message": "I need this drill for a kitchen renovation project",
  "deposit_amount": 25.00,
  "daily_rate": 5.00,
  "total_amount": 30.00,
  "delivery_fee": 0.00,
  "pickup_method": "pickup",
  "created_at": "2024-01-10T10:00:00Z"
}
```

**Error Responses**:
- 400: Invalid dates, tool not available, own tool booking attempt
- 404: Tool not found
- 409: Booking conflict with existing reservations

### 2. Get Booking Details

**Endpoint**: `GET /api/v1/bookings/{booking_id}`

**Authorization**: Borrower or tool owner only

**Response Schema** (200 OK):
```json
{
  "id": "uuid",
  "tool": {
    "id": "uuid",
    "title": "DeWalt Cordless Drill",
    "owner": {
      "id": "uuid",
      "username": "toolowner",
      "rating": 4.8,
      "phone": "+1234567890"
    }
  },
  "borrower": {
    "id": "uuid",
    "username": "borrower123",
    "rating": 4.5,
    "phone": "+1987654321"
  },
  "requested_start_date": "2024-01-15",
  "requested_end_date": "2024-01-20",
  "actual_start_date": "2024-01-15",
  "actual_end_date": null,
  "status": "active",
  "borrower_message": "I need this drill for a kitchen renovation project",
  "owner_response": "Tool is ready for pickup after 3 PM",
  "pickup_notes": "Tool is in garage, ring doorbell",
  "return_notes": null,
  "deposit_amount": 25.00,
  "daily_rate": 5.00,
  "total_amount": 30.00,
  "deposit_paid": true,
  "deposit_returned": false,
  "pickup_method": "pickup",
  "pickup_address": null,
  "delivery_fee": 0.00,
  "confirmed_at": "2024-01-12T14:30:00Z",
  "started_at": "2024-01-15T15:30:00Z",
  "created_at": "2024-01-10T10:00:00Z",
  "updated_at": "2024-01-15T15:30:00Z"
}
```

### 3. Update Booking Status

**Endpoint**: `PATCH /api/v1/bookings/{booking_id}/status`

**Description**: Updates booking status through valid state transitions.

**Request Schema**:
```json
{
  "status": "confirmed|declined|active|returned|completed|cancelled",
  "owner_response": "Tool is ready for pickup after 3 PM (optional)",
  "pickup_notes": "Ring doorbell, tool in garage (optional)",
  "return_notes": "Tool returned in good condition (optional)",
  "cancellation_reason": "No longer needed (optional for cancelled status)"
}
```

**Valid Status Transitions**:
- `pending` → `confirmed` (tool owner only)
- `pending` → `declined` (tool owner only)
- `pending` → `cancelled` (borrower only)
- `confirmed` → `active` (either party)
- `confirmed` → `cancelled` (either party)
- `active` → `returned` (either party)
- `returned` → `completed` (automatic after both parties confirm)

**Response Schema** (200 OK):
```json
{
  "id": "uuid",
  "status": "confirmed",
  "owner_response": "Tool is ready for pickup after 3 PM",
  "confirmed_at": "2024-01-12T14:30:00Z",
  "updated_at": "2024-01-12T14:30:00Z"
}
```

### 4. List User Bookings

**Endpoint**: `GET /api/v1/bookings`

**Query Parameters**:
- `role`: `borrower|owner` (filter by user role in booking)
- `status`: `pending|confirmed|active|returned|completed|declined|cancelled`
- `page`: Page number (default: 1)
- `size`: Page size (default: 20, max: 100)
- `sort`: `created_at|start_date|updated_at` (default: created_at)
- `order`: `asc|desc` (default: desc)

**Response Schema** (200 OK):
```json
{
  "bookings": [
    {
      "id": "uuid",
      "tool": {
        "id": "uuid",
        "title": "DeWalt Cordless Drill",
        "owner": {
          "id": "uuid",
          "username": "toolowner"
        }
      },
      "borrower": {
        "id": "uuid",
        "username": "borrower123"
      },
      "requested_start_date": "2024-01-15",
      "requested_end_date": "2024-01-20",
      "status": "active",
      "total_amount": 30.00,
      "created_at": "2024-01-10T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "size": 20,
    "total": 15,
    "pages": 1
  }
}
```

### 5. Check Tool Availability

**Endpoint**: `GET /api/v1/tools/{tool_id}/availability`

**Query Parameters**:
- `start_date`: Start date (ISO format)
- `end_date`: End date (ISO format)

**Response Schema** (200 OK):
```json
{
  "tool_id": "uuid",
  "is_available": true,
  "conflicting_bookings": [],
  "next_available_date": null,
  "calendar": [
    {
      "date": "2024-01-15",
      "available": true,
      "booking_id": null
    },
    {
      "date": "2024-01-16",
      "available": false,
      "booking_id": "uuid"
    }
  ]
}
```

### 6. Get Booking Calendar

**Endpoint**: `GET /api/v1/bookings/calendar`

**Query Parameters**:
- `start_date`: Start date (ISO format)
- `end_date`: End date (ISO format)
- `role`: `borrower|owner` (filter by user role)

**Response Schema** (200 OK):
```json
{
  "calendar": [
    {
      "date": "2024-01-15",
      "bookings": [
        {
          "id": "uuid",
          "tool": {
            "id": "uuid",
            "title": "DeWalt Cordless Drill"
          },
          "status": "active",
          "role": "borrower"
        }
      ]
    }
  ]
}
```

## Business Logic Architecture

### BookingService Class Design

```python
class BookingService:
    def __init__(self, db: AsyncSession, notification_service: NotificationService):
        self.db = db
        self.notification_service = notification_service
    
    async def create_booking_request(
        self, 
        borrower_id: UUID, 
        booking_data: BookingCreateSchema
    ) -> BookingResponse:
        """Creates a new booking request with validation."""
        
    async def check_tool_availability(
        self, 
        tool_id: UUID, 
        start_date: date, 
        end_date: date,
        exclude_booking_id: Optional[UUID] = None
    ) -> AvailabilityResult:
        """Checks if tool is available for given date range."""
        
    async def update_booking_status(
        self, 
        booking_id: UUID, 
        user_id: UUID, 
        status_update: BookingStatusUpdate
    ) -> BookingResponse:
        """Updates booking status with validation."""
        
    async def calculate_booking_cost(
        self, 
        tool: Tool, 
        start_date: date, 
        end_date: date,
        pickup_method: str
    ) -> BookingCostCalculation:
        """Calculates total booking cost including fees."""
        
    async def get_user_bookings(
        self, 
        user_id: UUID, 
        filters: BookingFilters
    ) -> PaginatedBookingResponse:
        """Gets paginated list of user's bookings."""
```

### Availability Checking Algorithm

```python
async def check_tool_availability(
    self, 
    tool_id: UUID, 
    start_date: date, 
    end_date: date,
    exclude_booking_id: Optional[UUID] = None
) -> AvailabilityResult:
    """
    Optimized availability checking:
    1. Query active bookings for tool in date range
    2. Check for overlapping periods
    3. Return detailed availability info
    """
    
    # Query for conflicting bookings
    query = select(Booking).where(
        and_(
            Booking.tool_id == tool_id,
            Booking.status.in_(['confirmed', 'active', 'returned']),
            or_(
                and_(
                    Booking.requested_start_date <= end_date,
                    Booking.requested_end_date >= start_date
                )
            )
        )
    )
    
    if exclude_booking_id:
        query = query.where(Booking.id != exclude_booking_id)
    
    result = await self.db.execute(query)
    conflicting_bookings = result.scalars().all()
    
    return AvailabilityResult(
        is_available=len(conflicting_bookings) == 0,
        conflicting_bookings=conflicting_bookings,
        next_available_date=self._calculate_next_available_date(conflicting_bookings)
    )
```

### Status Transition Validation

```python
class BookingStatusMachine:
    VALID_TRANSITIONS = {
        'pending': ['confirmed', 'declined', 'cancelled'],
        'confirmed': ['active', 'cancelled'],
        'active': ['returned'],
        'returned': ['completed'],
        'declined': [],
        'cancelled': [],
        'completed': []
    }
    
    @classmethod
    def can_transition(cls, from_status: str, to_status: str) -> bool:
        return to_status in cls.VALID_TRANSITIONS.get(from_status, [])
    
    @classmethod
    def validate_transition_permission(
        cls, 
        booking: Booking, 
        user_id: UUID, 
        new_status: str
    ) -> bool:
        """Validates if user can perform status transition."""
        if new_status in ['confirmed', 'declined']:
            return user_id == booking.tool.owner_id
        elif new_status == 'cancelled' and booking.status == 'pending':
            return user_id == booking.borrower_id
        elif new_status in ['active', 'returned', 'cancelled']:
            return user_id in [booking.borrower_id, booking.tool.owner_id]
        return False
```

### Price Calculation Logic

```python
async def calculate_booking_cost(
    self, 
    tool: Tool, 
    start_date: date, 
    end_date: date,
    pickup_method: str
) -> BookingCostCalculation:
    """
    Calculates total booking cost:
    - Daily rate * number of days
    - Deposit (usually 50% of daily rate * days)
    - Delivery fee if applicable
    """
    
    num_days = (end_date - start_date).days + 1
    daily_rate = tool.daily_rate or Decimal('0.00')
    
    # Calculate base cost
    base_cost = daily_rate * num_days
    
    # Calculate deposit (configurable percentage)
    deposit_percentage = Decimal('0.50')  # 50% default
    deposit_amount = base_cost * deposit_percentage
    
    # Calculate delivery fee
    delivery_fee = Decimal('0.00')
    if pickup_method == 'delivery':
        delivery_fee = tool.delivery_fee or Decimal('5.00')
    
    total_amount = base_cost + delivery_fee
    
    return BookingCostCalculation(
        daily_rate=daily_rate,
        num_days=num_days,
        base_cost=base_cost,
        deposit_amount=deposit_amount,
        delivery_fee=delivery_fee,
        total_amount=total_amount
    )
```

## Data Validation & Security Patterns

### Input Validation Rules

```python
class BookingCreateSchema(BaseModel):
    tool_id: UUID
    requested_start_date: date
    requested_end_date: date
    borrower_message: Optional[str] = None
    pickup_method: Literal['pickup', 'delivery'] = 'pickup'
    pickup_address: Optional[str] = None
    
    @field_validator('requested_start_date')
    @classmethod
    def validate_start_date(cls, v):
        if v < date.today():
            raise ValueError('Start date cannot be in the past')
        if v > date.today() + timedelta(days=365):
            raise ValueError('Start date cannot be more than 1 year in advance')
        return v
    
    @field_validator('requested_end_date')
    @classmethod
    def validate_end_date(cls, v, info):
        if 'requested_start_date' in info.data:
            start_date = info.data['requested_start_date']
            if v < start_date:
                raise ValueError('End date must be after start date')
            if (v - start_date).days > 30:
                raise ValueError('Booking period cannot exceed 30 days')
        return v
    
    @field_validator('pickup_address')
    @classmethod
    def validate_pickup_address(cls, v, info):
        if info.data.get('pickup_method') == 'delivery' and not v:
            raise ValueError('Pickup address required for delivery')
        return v
```

### Authorization Patterns

```python
async def verify_booking_access(
    booking_id: UUID, 
    user_id: UUID, 
    db: AsyncSession
) -> Booking:
    """Verifies user has access to booking (borrower or tool owner)."""
    
    query = select(Booking).options(
        joinedload(Booking.tool)
    ).where(Booking.id == booking_id)
    
    result = await db.execute(query)
    booking = result.scalar_one_or_none()
    
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    if user_id not in [booking.borrower_id, booking.tool.owner_id]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return booking
```

### Double Booking Prevention

```python
async def create_booking_with_lock(
    self, 
    booking_data: BookingCreateSchema, 
    borrower_id: UUID
) -> Booking:
    """Creates booking with database-level locking to prevent conflicts."""
    
    async with self.db.begin():
        # Lock the tool row to prevent concurrent bookings
        tool_query = select(Tool).where(Tool.id == booking_data.tool_id).with_for_update()
        result = await self.db.execute(tool_query)
        tool = result.scalar_one_or_none()
        
        if not tool:
            raise HTTPException(status_code=404, detail="Tool not found")
        
        # Check availability with the lock held
        availability = await self.check_tool_availability(
            tool.id,
            booking_data.requested_start_date,
            booking_data.requested_end_date
        )
        
        if not availability.is_available:
            raise HTTPException(
                status_code=409, 
                detail="Tool not available for requested dates"
            )
        
        # Create booking
        booking = Booking(
            borrower_id=borrower_id,
            tool_id=tool.id,
            **booking_data.model_dump(exclude={'tool_id'})
        )
        
        self.db.add(booking)
        await self.db.flush()
        return booking
```

## Error Handling Strategies

### Custom Exception Classes

```python
class BookingError(Exception):
    """Base booking exception."""
    pass

class BookingConflictError(BookingError):
    """Raised when booking conflicts with existing reservations."""
    pass

class InvalidStatusTransitionError(BookingError):
    """Raised when attempting invalid status transition."""
    pass

class BookingPermissionError(BookingError):
    """Raised when user lacks permission for booking operation."""
    pass

class ToolUnavailableError(BookingError):
    """Raised when tool is not available for booking."""
    pass
```

### Error Response Format

```json
{
  "error": {
    "code": "BOOKING_CONFLICT",
    "message": "Tool is not available for the requested dates",
    "details": {
      "conflicting_bookings": ["uuid1", "uuid2"],
      "next_available_date": "2024-01-25"
    }
  }
}
```

## Integration Points

### Notification System Hooks

```python
class BookingEventHandler:
    def __init__(self, notification_service: NotificationService):
        self.notification_service = notification_service
    
    async def on_booking_created(self, booking: Booking):
        """Send notification to tool owner about new booking request."""
        await self.notification_service.send_booking_request_notification(
            booking.tool.owner_id,
            booking
        )
    
    async def on_booking_confirmed(self, booking: Booking):
        """Send confirmation notification to borrower."""
        await self.notification_service.send_booking_confirmed_notification(
            booking.borrower_id,
            booking
        )
    
    async def on_booking_declined(self, booking: Booking):
        """Send decline notification to borrower."""
        await self.notification_service.send_booking_declined_notification(
            booking.borrower_id,
            booking
        )
```

### Review System Integration

```python
async def on_booking_completed(self, booking: Booking):
    """Trigger review creation when booking is completed."""
    # Create review opportunities for both parties
    await self.review_service.create_review_opportunities(
        booking_id=booking.id,
        borrower_id=booking.borrower_id,
        owner_id=booking.tool.owner_id
    )
```

## Performance Considerations

### Database Optimization

1. **Indexes for Availability Queries**:
   ```sql
   -- Composite index for efficient availability checking
   CREATE INDEX idx_bookings_availability ON bookings 
   (tool_id, status, requested_start_date, requested_end_date);
   
   -- Index for user booking queries
   CREATE INDEX idx_bookings_user_date ON bookings 
   (borrower_id, created_at);
   
   CREATE INDEX idx_bookings_owner_date ON bookings 
   (tool_id, created_at);
   ```

2. **Query Optimization**:
   - Use `joinedload` for related data
   - Implement pagination for large result sets
   - Cache availability calendars for popular tools

3. **Concurrent Request Handling**:
   - Row-level locking for booking creation
   - Optimistic locking for status updates
   - Connection pooling for high throughput

### Caching Strategy

```python
class BookingCacheService:
    def __init__(self, redis_client):
        self.redis = redis_client
    
    async def cache_tool_availability(
        self, 
        tool_id: UUID, 
        month: date, 
        availability_data: dict
    ):
        """Cache monthly availability data."""
        key = f"availability:{tool_id}:{month.strftime('%Y-%m')}"
        await self.redis.setex(key, 3600, json.dumps(availability_data))
    
    async def get_cached_availability(
        self, 
        tool_id: UUID, 
        month: date
    ) -> Optional[dict]:
        """Get cached availability data."""
        key = f"availability:{tool_id}:{month.strftime('%Y-%m')}"
        data = await self.redis.get(key)
        return json.loads(data) if data else None
```

## Service Layer Architecture

### Dependency Injection Pattern

```python
# services/booking.py
class BookingService:
    def __init__(
        self,
        db: AsyncSession,
        notification_service: NotificationService,
        cache_service: CacheService,
        event_handler: BookingEventHandler
    ):
        self.db = db
        self.notification_service = notification_service
        self.cache_service = cache_service
        self.event_handler = event_handler

# dependencies.py
async def get_booking_service(
    db: AsyncSession = Depends(get_db),
    notification_service: NotificationService = Depends(get_notification_service),
    cache_service: CacheService = Depends(get_cache_service),
    event_handler: BookingEventHandler = Depends(get_event_handler)
) -> BookingService:
    return BookingService(db, notification_service, cache_service, event_handler)
```

### Transaction Management

```python
class BookingService:
    async def create_booking_request(
        self, 
        borrower_id: UUID, 
        booking_data: BookingCreateSchema
    ) -> BookingResponse:
        """Create booking with proper transaction handling."""
        try:
            async with self.db.begin():
                # Validate tool ownership
                if await self._is_own_tool(borrower_id, booking_data.tool_id):
                    raise HTTPException(400, "Cannot book your own tool")
                
                # Check availability
                availability = await self.check_tool_availability(
                    booking_data.tool_id,
                    booking_data.requested_start_date,
                    booking_data.requested_end_date
                )
                
                if not availability.is_available:
                    raise BookingConflictError("Tool not available")
                
                # Calculate costs
                tool = await self._get_tool(booking_data.tool_id)
                cost_calc = await self.calculate_booking_cost(
                    tool, 
                    booking_data.requested_start_date,
                    booking_data.requested_end_date,
                    booking_data.pickup_method
                )
                
                # Create booking
                booking = Booking(
                    borrower_id=borrower_id,
                    tool_id=booking_data.tool_id,
                    requested_start_date=booking_data.requested_start_date,
                    requested_end_date=booking_data.requested_end_date,
                    borrower_message=booking_data.borrower_message,
                    pickup_method=booking_data.pickup_method,
                    pickup_address=booking_data.pickup_address,
                    deposit_amount=cost_calc.deposit_amount,
                    daily_rate=cost_calc.daily_rate,
                    total_amount=cost_calc.total_amount,
                    delivery_fee=cost_calc.delivery_fee,
                    status='pending'
                )
                
                self.db.add(booking)
                await self.db.flush()
                
                # Send notification
                await self.event_handler.on_booking_created(booking)
                
                return BookingResponse.from_orm(booking)
                
        except BookingConflictError:
            raise HTTPException(409, "Booking conflict")
        except Exception as e:
            await self.db.rollback()
            raise HTTPException(500, f"Failed to create booking: {str(e)}")
```

This comprehensive documentation provides the foundation for implementing a robust, scalable booking system that handles concurrent requests, maintains data consistency, and provides clear API contracts for frontend integration.