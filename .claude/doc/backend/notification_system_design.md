# Notification System API Design

## Overview

The notification system is the final MVP component for the Wippestoolen tool-sharing platform. It provides real-time communication to users about platform activities including booking requests, status changes, reviews, and system announcements.

## System Architecture

### Notification Flow
```
Event Trigger → Notification Service → Channel Router → Delivery
     ↓                    ↓                 ↓           ↓
  Booking           Create Notification   In-App    User Receives
  Review            Template Processing   Email     Notification
  System            User Preferences      Push      
```

### Integration Points
- **Booking System**: Trigger notifications on status changes (pending → confirmed → active → returned)
- **Review System**: Notify when reviews become available or are received
- **User System**: Welcome messages, profile updates
- **Admin System**: System announcements and maintenance notifications

## Database Model (Already Exists)

```python
class Notification(BaseModel):
    __tablename__ = "notifications"
    
    id = Column(UUID, primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID, ForeignKey("users.id"), nullable=False)
    type = Column(String(50), nullable=False)  # booking_request, booking_status, review_available, etc.
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    data = Column(JSON, nullable=True)  # Additional context data
    channel = Column(String(20), default="in_app")  # in_app, email, push
    priority = Column(String(10), default="normal")  # low, normal, high, urgent
    read_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=True)
    
    # Relationships
    user = relationship("User", back_populates="notifications")
```

## API Endpoints Specification

### 1. Get User Notifications

**Endpoint**: `GET /api/v1/notifications`

**Description**: Retrieve paginated list of user's notifications with filtering and sorting options.

**Query Parameters**:
```python
class NotificationQueryParams(BaseModel):
    page: int = 1
    limit: int = 20
    unread_only: bool = False
    type_filter: Optional[str] = None  # booking, review, system
    priority: Optional[str] = None     # low, normal, high, urgent
    sort: str = "created_at_desc"      # created_at_desc, created_at_asc
```

**Response Schema**:
```python
class NotificationResponse(BaseModel):
    id: UUID
    type: str
    title: str
    message: str
    data: Optional[dict] = None
    channel: str
    priority: str
    read_at: Optional[datetime] = None
    created_at: datetime
    expires_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class NotificationListResponse(BaseModel):
    notifications: List[NotificationResponse]
    total: int
    page: int
    limit: int
    unread_count: int
```

**HTTP Status Codes**:
- `200 OK`: Notifications retrieved successfully
- `401 Unauthorized`: Invalid or missing authentication token
- `422 Unprocessable Entity`: Invalid query parameters

### 2. Get Unread Notification Count

**Endpoint**: `GET /api/v1/notifications/unread-count`

**Description**: Get count of unread notifications for badge display.

**Response Schema**:
```python
class UnreadCountResponse(BaseModel):
    count: int
    urgent_count: int  # Separate count for urgent notifications
```

**HTTP Status Codes**:
- `200 OK`: Count retrieved successfully
- `401 Unauthorized`: Invalid authentication token

### 3. Mark Notification as Read

**Endpoint**: `PATCH /api/v1/notifications/{notification_id}/read`

**Description**: Mark a specific notification as read.

**Response Schema**:
```python
class NotificationReadResponse(BaseModel):
    id: UUID
    read_at: datetime
    success: bool = True
```

**HTTP Status Codes**:
- `200 OK`: Notification marked as read
- `401 Unauthorized`: Invalid authentication token
- `403 Forbidden`: User cannot access this notification
- `404 Not Found`: Notification not found

### 4. Mark All Notifications as Read

**Endpoint**: `PATCH /api/v1/notifications/read-all`

**Description**: Mark all user's notifications as read.

**Response Schema**:
```python
class BulkReadResponse(BaseModel):
    marked_count: int
    success: bool = True
```

**HTTP Status Codes**:
- `200 OK`: Notifications marked as read
- `401 Unauthorized`: Invalid authentication token

### 5. Delete Notification

**Endpoint**: `DELETE /api/v1/notifications/{notification_id}`

**Description**: Delete a specific notification.

**HTTP Status Codes**:
- `204 No Content`: Notification deleted successfully
- `401 Unauthorized`: Invalid authentication token
- `403 Forbidden`: User cannot delete this notification
- `404 Not Found`: Notification not found

### 6. Get Notification Preferences

**Endpoint**: `GET /api/v1/notifications/preferences`

**Description**: Get user's notification preferences for different channels and types.

**Response Schema**:
```python
class NotificationPreferences(BaseModel):
    booking_requests: dict  # {"in_app": true, "email": true, "push": false}
    booking_status_changes: dict
    review_available: dict
    review_received: dict
    system_announcements: dict
    marketing: dict
    
class NotificationPreferencesResponse(BaseModel):
    preferences: NotificationPreferences
    email_verified: bool
    push_enabled: bool
```

**HTTP Status Codes**:
- `200 OK`: Preferences retrieved successfully
- `401 Unauthorized`: Invalid authentication token

### 7. Update Notification Preferences

**Endpoint**: `PATCH /api/v1/notifications/preferences`

**Description**: Update user's notification preferences.

**Request Schema**:
```python
class UpdateNotificationPreferences(BaseModel):
    booking_requests: Optional[dict] = None
    booking_status_changes: Optional[dict] = None
    review_available: Optional[dict] = None
    review_received: Optional[dict] = None
    system_announcements: Optional[dict] = None
    marketing: Optional[dict] = None
```

**Response Schema**:
```python
class NotificationPreferencesResponse(BaseModel):
    preferences: NotificationPreferences
    updated_at: datetime
    success: bool = True
```

**HTTP Status Codes**:
- `200 OK`: Preferences updated successfully
- `401 Unauthorized`: Invalid authentication token
- `422 Unprocessable Entity`: Invalid preference values

### 8. Admin: Create System Notification

**Endpoint**: `POST /api/v1/admin/notifications/broadcast`

**Description**: Create system-wide notification (admin only).

**Request Schema**:
```python
class BroadcastNotificationCreate(BaseModel):
    title: str
    message: str
    type: str = "system_announcement"
    priority: str = "normal"
    channels: List[str] = ["in_app"]  # in_app, email, push
    target_users: Optional[List[UUID]] = None  # If None, broadcast to all
    expires_at: Optional[datetime] = None
```

**Response Schema**:
```python
class BroadcastNotificationResponse(BaseModel):
    notification_id: UUID
    target_count: int
    channels: List[str]
    created_at: datetime
    success: bool = True
```

**HTTP Status Codes**:
- `201 Created`: Notification broadcast successfully
- `401 Unauthorized`: Invalid authentication token
- `403 Forbidden`: User is not an admin
- `422 Unprocessable Entity`: Invalid notification data

## Real-time Delivery Mechanisms

### WebSocket Implementation

**Endpoint**: `ws://api/v1/notifications/ws`

**Connection Flow**:
```python
# Client connects with JWT token in query string or header
# Server validates token and associates connection with user_id
# Server sends real-time notifications to connected clients

class WebSocketMessage(BaseModel):
    type: str  # "notification", "unread_count", "connection_status"
    data: dict
    timestamp: datetime

# Example notification message
{
    "type": "notification",
    "data": {
        "id": "uuid-here",
        "type": "booking_request",
        "title": "New booking request",
        "message": "John wants to borrow your Power Drill",
        "priority": "normal",
        "created_at": "2024-01-15T10:00:00Z"
    },
    "timestamp": "2024-01-15T10:00:00Z"
}

# Example unread count update
{
    "type": "unread_count",
    "data": {
        "count": 5,
        "urgent_count": 1
    },
    "timestamp": "2024-01-15T10:00:00Z"
}
```

**Connection Management**:
- Authenticate user on connection
- Store active connections in Redis with user mapping
- Handle connection drops and reconnection
- Rate limit WebSocket messages (100 messages per minute per user)

### Server-Sent Events (SSE) Alternative

**Endpoint**: `GET /api/v1/notifications/stream`

**Description**: Alternative to WebSocket for one-way real-time notifications.

**Headers**: 
```
Authorization: Bearer {jwt_token}
Accept: text/event-stream
Cache-Control: no-cache
```

**Event Format**:
```
event: notification
data: {"id": "uuid", "type": "booking_request", "title": "New request", ...}

event: unread_count
data: {"count": 5, "urgent_count": 1}

event: heartbeat
data: {"timestamp": "2024-01-15T10:00:00Z"}
```

## Background Job Patterns

### Email Notification Jobs

**Celery Task Structure**:
```python
@celery.task(bind=True, max_retries=3)
def send_email_notification(self, notification_id: str):
    """
    Send email notification with retry logic.
    """
    try:
        notification = get_notification_by_id(notification_id)
        if not notification:
            return {"status": "failed", "reason": "notification_not_found"}
        
        user = notification.user
        if not user.email_verified or not should_send_email(user, notification.type):
            return {"status": "skipped", "reason": "user_preferences"}
        
        email_content = render_email_template(notification)
        send_email_via_ses(user.email, email_content)
        
        # Update notification delivery status
        mark_email_sent(notification_id)
        
        return {"status": "success", "sent_at": datetime.utcnow()}
    
    except Exception as exc:
        # Exponential backoff: 60s, 300s, 900s
        countdown = 60 * (2 ** self.request.retries)
        raise self.retry(exc=exc, countdown=countdown)
```

**Job Scheduling**:
```python
# Immediate email for urgent notifications
send_email_notification.delay(notification_id)

# Batched email for normal priority (5-minute delay)
send_email_notification.apply_async(
    args=[notification_id],
    countdown=300
)

# Daily digest email
send_daily_digest.apply_async(
    args=[user_id],
    eta=get_next_digest_time(user.timezone)
)
```

### Notification Cleanup Jobs

**Daily Cleanup Task**:
```python
@celery.task
def cleanup_old_notifications():
    """
    Remove expired and old read notifications.
    """
    # Remove expired notifications
    expired_count = delete_expired_notifications()
    
    # Remove read notifications older than 30 days
    old_read_count = delete_old_read_notifications(days=30)
    
    # Remove unread notifications older than 90 days (with email fallback)
    old_unread_count = cleanup_old_unread_notifications(days=90)
    
    return {
        "expired_removed": expired_count,
        "old_read_removed": old_read_count,
        "old_unread_removed": old_unread_count
    }
```

## Notification Template System

### Template Structure

**Base Template Class**:
```python
class NotificationTemplate:
    def __init__(self, notification_type: str):
        self.type = notification_type
    
    def render_in_app(self, context: dict) -> dict:
        """Render notification for in-app display"""
        raise NotImplementedError
    
    def render_email(self, context: dict) -> dict:
        """Render notification for email delivery"""
        raise NotImplementedError
    
    def render_push(self, context: dict) -> dict:
        """Render notification for push notification"""
        raise NotImplementedError
```

**Booking Request Template**:
```python
class BookingRequestTemplate(NotificationTemplate):
    def render_in_app(self, context: dict) -> dict:
        return {
            "title": f"New booking request from {context['borrower_name']}",
            "message": f"{context['borrower_name']} wants to borrow your {context['tool_name']} from {context['start_date']} to {context['end_date']}.",
            "data": {
                "booking_id": context["booking_id"],
                "tool_id": context["tool_id"],
                "borrower_id": context["borrower_id"],
                "action_required": True
            }
        }
    
    def render_email(self, context: dict) -> dict:
        return {
            "subject": f"New booking request for your {context['tool_name']}",
            "html_body": render_jinja_template("booking_request_email.html", context),
            "text_body": render_jinja_template("booking_request_email.txt", context)
        }
```

**Template Registry**:
```python
NOTIFICATION_TEMPLATES = {
    "booking_request": BookingRequestTemplate,
    "booking_confirmed": BookingConfirmedTemplate,
    "booking_declined": BookingDeclinedTemplate,
    "booking_active": BookingActiveTemplate,
    "booking_returned": BookingReturnedTemplate,
    "review_available": ReviewAvailableTemplate,
    "review_received": ReviewReceivedTemplate,
    "system_announcement": SystemAnnouncementTemplate,
    "welcome": WelcomeTemplate,
}

def get_template(notification_type: str) -> NotificationTemplate:
    template_class = NOTIFICATION_TEMPLATES.get(notification_type)
    if not template_class:
        raise ValueError(f"Unknown notification type: {notification_type}")
    return template_class(notification_type)
```

## User Preference Management

### Preference Storage Model

**Extended User Model**:
```python
class User(BaseModel):
    # ... existing fields ...
    
    # Notification preferences stored as JSON
    notification_preferences = Column(JSON, default=lambda: {
        "booking_requests": {"in_app": True, "email": True, "push": False},
        "booking_status_changes": {"in_app": True, "email": True, "push": True},
        "review_available": {"in_app": True, "email": True, "push": False},
        "review_received": {"in_app": True, "email": False, "push": False},
        "system_announcements": {"in_app": True, "email": True, "push": False},
        "marketing": {"in_app": False, "email": False, "push": False}
    })
    
    # Email and push notification settings
    email_verified = Column(Boolean, default=False)
    push_token = Column(String(500), nullable=True)
    push_enabled = Column(Boolean, default=False)
```

### Preference Validation

**Preference Helper Functions**:
```python
def should_send_notification(user: User, notification_type: str, channel: str) -> bool:
    """
    Check if user wants to receive notifications of this type via this channel.
    """
    preferences = user.notification_preferences or {}
    type_prefs = preferences.get(notification_type, {})
    
    # Default to enabled for in-app, disabled for others
    default_enabled = channel == "in_app"
    enabled = type_prefs.get(channel, default_enabled)
    
    # Additional checks
    if channel == "email" and not user.email_verified:
        return False
    
    if channel == "push" and not user.push_enabled:
        return False
    
    return enabled

def validate_preferences(preferences: dict) -> dict:
    """
    Validate and sanitize user notification preferences.
    """
    valid_types = ["booking_requests", "booking_status_changes", 
                   "review_available", "review_received", 
                   "system_announcements", "marketing"]
    valid_channels = ["in_app", "email", "push"]
    
    sanitized = {}
    for pref_type, channels in preferences.items():
        if pref_type not in valid_types:
            continue
        
        sanitized[pref_type] = {}
        for channel, enabled in channels.items():
            if channel in valid_channels:
                sanitized[pref_type][channel] = bool(enabled)
    
    return sanitized
```

## Admin Notification Capabilities

### System Announcement Features

**Bulk Notification Creation**:
```python
async def create_system_notification(
    title: str,
    message: str,
    target_users: Optional[List[UUID]] = None,
    channels: List[str] = ["in_app"],
    priority: str = "normal",
    expires_at: Optional[datetime] = None
) -> dict:
    """
    Create system notification for multiple users.
    """
    if target_users is None:
        # Get all active users
        target_users = await get_all_active_user_ids()
    
    notifications = []
    for user_id in target_users:
        notification = Notification(
            user_id=user_id,
            type="system_announcement",
            title=title,
            message=message,
            channel="in_app",  # Always create in-app first
            priority=priority,
            expires_at=expires_at,
            data={"channels": channels}
        )
        notifications.append(notification)
    
    # Bulk insert notifications
    await bulk_create_notifications(notifications)
    
    # Schedule email/push delivery for users who want them
    for user_id in target_users:
        if "email" in channels:
            send_email_notification.delay(user_id, "system_announcement")
        if "push" in channels:
            send_push_notification.delay(user_id, "system_announcement")
    
    return {
        "notification_count": len(notifications),
        "target_users": len(target_users),
        "channels": channels
    }
```

**Admin Dashboard Endpoints**:
```python
# Get notification statistics
GET /api/v1/admin/notifications/stats
{
    "total_sent_today": 156,
    "total_sent_this_week": 1243,
    "delivery_rates": {
        "in_app": 98.5,
        "email": 94.2,
        "push": 87.3
    },
    "most_common_types": [
        {"type": "booking_request", "count": 89},
        {"type": "booking_confirmed", "count": 67}
    ]
}

# Get notification delivery logs
GET /api/v1/admin/notifications/delivery-log
{
    "logs": [
        {
            "notification_id": "uuid",
            "user_id": "uuid", 
            "type": "booking_request",
            "channels": ["in_app", "email"],
            "delivery_status": {
                "in_app": "delivered",
                "email": "failed"
            },
            "created_at": "2024-01-15T10:00:00Z"
        }
    ],
    "total": 500,
    "page": 1
}
```

## Integration Patterns

### Booking System Integration

**Booking Event Triggers**:
```python
# In booking_service.py
async def create_booking_request(booking_data: BookingCreate, current_user: User) -> Booking:
    booking = await create_booking(booking_data)
    
    # Trigger notification
    await notify_booking_request(
        booking_id=booking.id,
        owner_id=booking.tool.owner_id,
        borrower=current_user,
        tool=booking.tool
    )
    
    return booking

async def update_booking_status(booking_id: UUID, status: BookingStatus, current_user: User) -> Booking:
    booking = await update_booking(booking_id, status)
    
    # Trigger status change notification
    await notify_booking_status_change(
        booking=booking,
        old_status=booking.previous_status,
        new_status=status,
        actor=current_user
    )
    
    return booking
```

**Notification Service Functions**:
```python
async def notify_booking_request(booking_id: UUID, owner_id: UUID, borrower: User, tool: Tool):
    """Send notification to tool owner about new booking request."""
    context = {
        "booking_id": booking_id,
        "borrower_name": borrower.full_name,
        "borrower_id": borrower.id,
        "tool_name": tool.title,
        "tool_id": tool.id,
        "start_date": booking.start_date.strftime("%B %d"),
        "end_date": booking.end_date.strftime("%B %d"),
    }
    
    await create_notification(
        user_id=owner_id,
        type="booking_request",
        context=context,
        priority="normal"
    )

async def notify_booking_status_change(booking: Booking, old_status: str, new_status: str, actor: User):
    """Send notification about booking status changes."""
    # Notify the other party (not the actor)
    recipient_id = booking.borrower_id if actor.id == booking.tool.owner_id else booking.tool.owner_id
    
    context = {
        "booking_id": booking.id,
        "tool_name": booking.tool.title,
        "old_status": old_status,
        "new_status": new_status,
        "actor_name": actor.full_name
    }
    
    # Higher priority for time-sensitive statuses
    priority = "high" if new_status in ["confirmed", "returned"] else "normal"
    
    await create_notification(
        user_id=recipient_id,
        type="booking_status_change",
        context=context,
        priority=priority
    )
```

### Review System Integration

**Review Event Triggers**:
```python
# In review_service.py
async def complete_booking_for_reviews(booking_id: UUID) -> dict:
    """Mark booking complete and enable review eligibility."""
    booking = await mark_booking_completed(booking_id)
    
    # Notify both parties that reviews are available
    await notify_review_available(
        booking=booking,
        borrower_id=booking.borrower_id,
        owner_id=booking.tool.owner_id
    )
    
    return {"status": "completed", "review_deadline": booking.review_deadline}

async def create_review(review_data: ReviewCreate, current_user: User) -> Review:
    review = await save_review(review_data)
    
    # Notify the reviewed user
    await notify_review_received(
        review=review,
        reviewer=current_user,
        reviewee_id=review.reviewee_id
    )
    
    return review
```

## Performance Optimization

### Caching Strategies

**Redis Caching**:
```python
# Cache unread notification counts
@cached(ttl=60)  # Cache for 1 minute
async def get_unread_count(user_id: UUID) -> dict:
    return await count_unread_notifications(user_id)

# Cache notification preferences
@cached(ttl=300)  # Cache for 5 minutes
async def get_user_preferences(user_id: UUID) -> dict:
    return await fetch_user_notification_preferences(user_id)

# Cache active WebSocket connections
class NotificationWebSocketManager:
    def __init__(self):
        self.connections: Dict[UUID, List[WebSocket]] = defaultdict(list)
        self.redis = Redis()
    
    async def connect(self, user_id: UUID, websocket: WebSocket):
        self.connections[user_id].append(websocket)
        await self.redis.sadd(f"active_users:{user_id}", websocket.id)
    
    async def disconnect(self, user_id: UUID, websocket: WebSocket):
        self.connections[user_id].remove(websocket)
        await self.redis.srem(f"active_users:{user_id}", websocket.id)
    
    async def send_to_user(self, user_id: UUID, message: dict):
        connections = self.connections.get(user_id, [])
        if connections:
            # Send to active WebSocket connections
            await asyncio.gather(*[
                conn.send_json(message) for conn in connections
            ], return_exceptions=True)
```

### Database Optimization

**Efficient Queries**:
```python
# Optimized notification fetching with joins
async def get_user_notifications_optimized(
    user_id: UUID, 
    page: int = 1, 
    limit: int = 20,
    unread_only: bool = False
) -> tuple[List[Notification], int]:
    
    query = select(Notification).where(Notification.user_id == user_id)
    
    if unread_only:
        query = query.where(Notification.read_at.is_(None))
    
    # Add indexes for common query patterns
    query = query.order_by(Notification.created_at.desc())
    
    # Get total count efficiently
    count_query = select(func.count(Notification.id)).where(
        Notification.user_id == user_id
    )
    if unread_only:
        count_query = count_query.where(Notification.read_at.is_(None))
    
    # Execute queries in parallel
    notifications_result, total_result = await asyncio.gather(
        session.execute(query.offset((page - 1) * limit).limit(limit)),
        session.execute(count_query)
    )
    
    return notifications_result.scalars().all(), total_result.scalar()

# Batch notification creation for system announcements
async def bulk_create_notifications(notifications: List[Notification]) -> List[Notification]:
    """Efficiently create multiple notifications at once."""
    session.add_all(notifications)
    await session.commit()
    
    # Trigger real-time delivery for online users
    online_users = await get_online_user_ids()
    for notification in notifications:
        if notification.user_id in online_users:
            await websocket_manager.send_to_user(
                notification.user_id,
                {"type": "notification", "data": notification.to_dict()}
            )
    
    return notifications
```

### Rate Limiting

**Notification Rate Limiting**:
```python
class NotificationRateLimit:
    def __init__(self, redis_client):
        self.redis = redis_client
    
    async def check_rate_limit(self, user_id: UUID, notification_type: str) -> bool:
        """
        Rate limiting rules:
        - Max 50 notifications per user per hour
        - Max 10 booking notifications per user per hour
        - Max 5 system notifications per user per day
        """
        current_hour = datetime.utcnow().strftime("%Y-%m-%d-%H")
        current_day = datetime.utcnow().strftime("%Y-%m-%d")
        
        # General rate limit
        general_key = f"rate_limit:notifications:{user_id}:{current_hour}"
        general_count = await self.redis.incr(general_key)
        if general_count == 1:
            await self.redis.expire(general_key, 3600)  # 1 hour
        if general_count > 50:
            return False
        
        # Type-specific rate limits
        if notification_type.startswith("booking_"):
            booking_key = f"rate_limit:booking:{user_id}:{current_hour}"
            booking_count = await self.redis.incr(booking_key)
            if booking_count == 1:
                await self.redis.expire(booking_key, 3600)
            if booking_count > 10:
                return False
        
        if notification_type == "system_announcement":
            system_key = f"rate_limit:system:{user_id}:{current_day}"
            system_count = await self.redis.incr(system_key)
            if system_count == 1:
                await self.redis.expire(system_key, 86400)  # 1 day
            if system_count > 5:
                return False
        
        return True
```

## Error Handling and Monitoring

### Error Response Schemas

**Common Error Responses**:
```python
class NotificationError(BaseModel):
    error_code: str
    message: str
    details: Optional[dict] = None

# Rate limit exceeded
{
    "error_code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many notifications. Please try again later.",
    "details": {
        "limit": 50,
        "reset_time": "2024-01-15T11:00:00Z",
        "retry_after": 1800
    }
}

# Invalid notification type
{
    "error_code": "INVALID_NOTIFICATION_TYPE",
    "message": "Unknown notification type: invalid_type",
    "details": {
        "valid_types": ["booking_request", "booking_status", "review_available"]
    }
}

# WebSocket authentication failed
{
    "error_code": "WS_AUTH_FAILED", 
    "message": "Invalid or expired JWT token",
    "details": {
        "close_code": 4001,
        "reconnect": true
    }
}
```

### Monitoring and Metrics

**Key Metrics to Track**:
```python
# Notification delivery metrics
notification_created_total = Counter(
    'notifications_created_total',
    'Total notifications created',
    ['type', 'priority', 'channel']
)

notification_delivered_total = Counter(
    'notifications_delivered_total', 
    'Total notifications delivered',
    ['type', 'channel', 'status']
)

notification_delivery_duration = Histogram(
    'notification_delivery_duration_seconds',
    'Time to deliver notification',
    ['channel']
)

websocket_connections_active = Gauge(
    'websocket_connections_active',
    'Active WebSocket connections'
)

# Email delivery metrics  
email_delivery_success_rate = Histogram(
    'email_delivery_success_rate',
    'Email delivery success rate',
    buckets=[0.8, 0.85, 0.9, 0.95, 0.99, 1.0]
)

# User engagement metrics
notification_read_rate = Histogram(
    'notification_read_rate', 
    'Rate of notifications read by users',
    ['notification_type'],
    buckets=[0.1, 0.3, 0.5, 0.7, 0.8, 0.9, 1.0]
)
```

## Testing Strategy

### Unit Test Examples

**Service Layer Testing**:
```python
# Test notification creation
async def test_create_booking_request_notification():
    # Setup
    booking = create_mock_booking()
    owner = create_mock_user(id="owner-id")
    borrower = create_mock_user(id="borrower-id", name="John Doe")
    
    # Execute
    notification = await notify_booking_request(
        booking_id=booking.id,
        owner_id=owner.id,
        borrower=borrower,
        tool=booking.tool
    )
    
    # Assert
    assert notification.user_id == owner.id
    assert notification.type == "booking_request"
    assert "John Doe" in notification.message
    assert notification.data["booking_id"] == booking.id

# Test rate limiting
async def test_notification_rate_limiting():
    user_id = uuid.uuid4()
    rate_limiter = NotificationRateLimit(redis_client)
    
    # Should allow first 50 notifications
    for i in range(50):
        assert await rate_limiter.check_rate_limit(user_id, "booking_request")
    
    # Should block the 51st notification
    assert not await rate_limiter.check_rate_limit(user_id, "booking_request")
```

**API Endpoint Testing**:
```python
# Test notification listing with filtering
async def test_get_notifications_with_filters():
    # Setup test data
    await create_test_notifications(user_id, [
        {"type": "booking_request", "read_at": None},
        {"type": "review_available", "read_at": datetime.utcnow()},
        {"type": "system_announcement", "read_at": None}
    ])
    
    # Test unread only filter
    response = await client.get(
        "/api/v1/notifications?unread_only=true",
        headers=auth_headers
    )
    
    assert response.status_code == 200
    data = response.json()
    assert len(data["notifications"]) == 2
    assert data["unread_count"] == 2
    assert all(notif["read_at"] is None for notif in data["notifications"])

# Test WebSocket notification delivery
async def test_websocket_notification_delivery():
    with TestClient(app) as client:
        with client.websocket_connect("/api/v1/notifications/ws?token=valid_jwt") as websocket:
            # Trigger notification creation
            await create_notification(
                user_id=test_user.id,
                type="booking_request",
                context={"borrower_name": "John"}
            )
            
            # Should receive notification via WebSocket
            data = websocket.receive_json()
            assert data["type"] == "notification"
            assert data["data"]["type"] == "booking_request"
```

## Security Considerations

### Authentication and Authorization

**WebSocket Authentication**:
```python
async def authenticate_websocket(websocket: WebSocket, token: str) -> Optional[User]:
    """Authenticate WebSocket connection using JWT token."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        user_id = payload.get("user_id")
        if not user_id:
            return None
        
        user = await get_user_by_id(user_id)
        if not user or not user.is_active:
            return None
        
        return user
    except JWTError:
        return None

async def websocket_endpoint(websocket: WebSocket, token: str):
    user = await authenticate_websocket(websocket, token)
    if not user:
        await websocket.close(code=4001, reason="Authentication failed")
        return
    
    await websocket.accept()
    await websocket_manager.connect(user.id, websocket)
```

**Notification Access Control**:
```python
async def verify_notification_access(notification_id: UUID, current_user: User) -> Notification:
    """Ensure user can only access their own notifications."""
    notification = await get_notification_by_id(notification_id)
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    if notification.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return notification
```

### Input Validation and Sanitization

**Message Content Validation**:
```python
def sanitize_notification_content(title: str, message: str) -> tuple[str, str]:
    """Sanitize notification content to prevent XSS and injection attacks."""
    import bleach
    
    # Strip HTML tags and sanitize
    clean_title = bleach.clean(title, strip=True)[:200]  # Max length
    clean_message = bleach.clean(message, strip=True)[:1000]  # Max length
    
    # Validate content is not empty after sanitization
    if not clean_title.strip() or not clean_message.strip():
        raise ValueError("Title and message cannot be empty")
    
    return clean_title, clean_message
```

## Deployment Considerations

### Environment Variables

```bash
# Notification service configuration
NOTIFICATION_WS_MAX_CONNECTIONS=1000
NOTIFICATION_RATE_LIMIT_ENABLED=true
NOTIFICATION_EMAIL_ENABLED=true
NOTIFICATION_PUSH_ENABLED=false

# Email service (AWS SES)
AWS_SES_REGION=eu-west-1
AWS_SES_FROM_EMAIL=notifications@wippestoolen.com
AWS_SES_TEMPLATE_PREFIX=wippestoolen-

# Redis for caching and real-time connections
REDIS_NOTIFICATION_DB=2
REDIS_WEBSOCKET_DB=3

# Celery for background jobs
CELERY_NOTIFICATION_QUEUE=notifications
CELERY_EMAIL_QUEUE=emails
```

### Scaling Considerations

**Horizontal Scaling**:
- Use Redis for shared WebSocket connection state
- Load balance WebSocket connections with sticky sessions
- Scale email workers independently based on volume
- Use database read replicas for notification fetching

**Performance Monitoring**:
- Track WebSocket connection counts and memory usage
- Monitor email delivery rates and failures
- Alert on notification delivery delays
- Track user engagement with notifications

This comprehensive notification system design provides real-time communication capabilities while maintaining performance, security, and scalability for the Wippestoolen platform. The system integrates seamlessly with existing booking and review systems and provides both immediate in-app notifications and reliable email delivery for important events.