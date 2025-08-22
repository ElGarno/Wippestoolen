"""
Notification-related Pydantic schemas for request/response serialization.
"""

from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict, Any
from uuid import UUID

from pydantic import BaseModel, Field, validator


class NotificationType(str, Enum):
    """Notification type enumeration."""
    BOOKING_REQUEST = "booking_request"
    BOOKING_CONFIRMED = "booking_confirmed"
    BOOKING_DECLINED = "booking_declined"
    BOOKING_CANCELLED = "booking_cancelled"
    BOOKING_ACTIVE = "booking_active"
    BOOKING_RETURNED = "booking_returned"
    BOOKING_COMPLETED = "booking_completed"
    BOOKING_OVERDUE = "booking_overdue"
    REVIEW_AVAILABLE = "review_available"
    REVIEW_RECEIVED = "review_received"
    REVIEW_RESPONSE = "review_response"
    SYSTEM_ANNOUNCEMENT = "system_announcement"
    TOOL_INQUIRY = "tool_inquiry"
    WELCOME = "welcome"


class NotificationChannel(str, Enum):
    """Notification delivery channel enumeration."""
    IN_APP = "in_app"
    EMAIL = "email"
    PUSH = "push"


class NotificationPriority(str, Enum):
    """Notification priority enumeration."""
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    URGENT = "urgent"


# Request Schemas

class NotificationCreateRequest(BaseModel):
    """Schema for creating a notification (admin use)."""
    recipient_id: Optional[UUID] = Field(None, description="Specific recipient (null for broadcast)")
    type: NotificationType = Field(..., description="Type of notification")
    title: str = Field(..., max_length=200, description="Notification title")
    message: str = Field(..., max_length=1000, description="Notification message")
    data: Optional[Dict[str, Any]] = Field(None, description="Additional notification data")
    channels: List[NotificationChannel] = Field(default=[NotificationChannel.IN_APP], description="Delivery channels")
    priority: NotificationPriority = Field(NotificationPriority.NORMAL, description="Notification priority")
    expires_at: Optional[datetime] = Field(None, description="Expiration timestamp")

    @validator('title', 'message')
    def sanitize_content(cls, v):
        """Sanitize notification content."""
        if not v:
            return v
        
        # Remove HTML tags and potentially harmful content
        import re
        v = re.sub(r'<[^>]*>', '', v)
        v = re.sub(r'javascript:', '', v, flags=re.IGNORECASE)
        v = v.strip()
        
        return v

    @validator('data')
    def validate_data(cls, v):
        """Validate notification data structure."""
        if v is None:
            return v
        
        # Ensure data is serializable and doesn't contain sensitive info
        allowed_keys = {
            'booking_id', 'tool_id', 'user_id', 'review_id', 
            'action_url', 'metadata', 'reference_id'
        }
        
        if not isinstance(v, dict):
            raise ValueError('Notification data must be a dictionary')
        
        # Filter out potentially sensitive keys
        filtered_data = {k: v for k, v in v.items() if k in allowed_keys}
        return filtered_data


class NotificationPreferencesUpdate(BaseModel):
    """Schema for updating notification preferences."""
    in_app_enabled: Optional[bool] = Field(None, description="Enable in-app notifications")
    email_enabled: Optional[bool] = Field(None, description="Enable email notifications")
    push_enabled: Optional[bool] = Field(None, description="Enable push notifications")
    
    # Per-type preferences
    booking_notifications: Optional[bool] = Field(None, description="Enable booking-related notifications")
    review_notifications: Optional[bool] = Field(None, description="Enable review-related notifications")
    system_notifications: Optional[bool] = Field(None, description="Enable system notifications")
    
    # Timing preferences
    quiet_hours_start: Optional[int] = Field(None, ge=0, le=23, description="Quiet hours start (24h format)")
    quiet_hours_end: Optional[int] = Field(None, ge=0, le=23, description="Quiet hours end (24h format)")
    timezone: Optional[str] = Field(None, max_length=50, description="User timezone (e.g., 'Europe/Berlin')")

    @validator('quiet_hours_start', 'quiet_hours_end')
    def validate_hours(cls, v):
        """Validate hour format."""
        if v is not None and (v < 0 or v > 23):
            raise ValueError('Hours must be between 0 and 23')
        return v


# Response Schemas

class NotificationResponse(BaseModel):
    """Schema for notification response."""
    id: UUID
    recipient_id: UUID
    type: NotificationType
    title: str
    message: str
    data: Optional[Dict[str, Any]]
    channels: List[NotificationChannel]
    priority: NotificationPriority
    is_read: bool
    read_at: Optional[datetime]
    created_at: datetime
    expires_at: Optional[datetime]

    class Config:
        from_attributes = True


class NotificationListItem(BaseModel):
    """Simplified notification schema for list views."""
    id: UUID
    type: NotificationType
    title: str
    message: str
    priority: NotificationPriority
    is_read: bool
    created_at: datetime
    data: Optional[Dict[str, Any]] = None

    class Config:
        from_attributes = True


class PaginatedNotificationResponse(BaseModel):
    """Paginated notification response schema."""
    items: List[NotificationListItem]
    total: int
    unread_count: int
    page: int
    size: int
    pages: int


class NotificationPreferencesResponse(BaseModel):
    """Schema for notification preferences response."""
    id: UUID
    user_id: UUID
    in_app_enabled: bool
    email_enabled: bool
    push_enabled: bool
    booking_notifications: bool
    review_notifications: bool
    system_notifications: bool
    quiet_hours_start: Optional[int]
    quiet_hours_end: Optional[int]
    timezone: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class UnreadCountResponse(BaseModel):
    """Schema for unread notification count."""
    total_unread: int
    by_type: Dict[str, int]
    by_priority: Dict[str, int]


class NotificationStatsResponse(BaseModel):
    """Schema for notification statistics."""
    total_sent: int
    total_delivered: int
    total_read: int
    delivery_rate: float
    read_rate: float
    by_channel: Dict[str, Dict[str, int]]
    by_type: Dict[str, Dict[str, int]]


# Filter and Search Schemas

class NotificationFilters(BaseModel):
    """Schema for notification filters."""
    type: Optional[NotificationType] = None
    is_read: Optional[bool] = None
    priority: Optional[NotificationPriority] = None
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None
    page: int = Field(1, ge=1)
    size: int = Field(20, ge=1, le=100)
    sort: str = Field("created_at", pattern="^(created_at|priority|type)$")
    order: str = Field("desc", pattern="^(asc|desc)$")


# WebSocket Schemas

class WebSocketMessage(BaseModel):
    """Schema for WebSocket messages."""
    type: str = Field(..., description="Message type")
    data: Dict[str, Any] = Field(..., description="Message payload")
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class NotificationWebSocketMessage(WebSocketMessage):
    """Schema for notification WebSocket messages."""
    type: str = Field("notification", description="Always 'notification' for notification messages")
    data: NotificationResponse = Field(..., description="Notification data")


class UnreadCountWebSocketMessage(WebSocketMessage):
    """Schema for unread count WebSocket messages."""
    type: str = Field("unread_count", description="Always 'unread_count' for count updates")
    data: UnreadCountResponse = Field(..., description="Unread count data")


class ConnectionStatusMessage(WebSocketMessage):
    """Schema for connection status messages."""
    type: str = Field("connection_status", description="Connection status message")
    data: Dict[str, str] = Field(..., description="Status information")


# Admin Schemas

class BroadcastNotificationRequest(BaseModel):
    """Schema for broadcast notification creation."""
    title: str = Field(..., max_length=200, description="Broadcast notification title")
    message: str = Field(..., max_length=1000, description="Broadcast notification message")
    type: NotificationType = Field(NotificationType.SYSTEM_ANNOUNCEMENT, description="Notification type")
    channels: List[NotificationChannel] = Field(default=[NotificationChannel.IN_APP], description="Delivery channels")
    priority: NotificationPriority = Field(NotificationPriority.NORMAL, description="Notification priority")
    target_users: Optional[List[UUID]] = Field(None, description="Specific users to target (null for all)")
    expires_at: Optional[datetime] = Field(None, description="Expiration timestamp")
    
    # Targeting options
    active_users_only: bool = Field(True, description="Send only to active users")
    verified_users_only: bool = Field(False, description="Send only to verified users")
    min_registration_date: Optional[datetime] = Field(None, description="Minimum registration date")

    @validator('title', 'message')
    def sanitize_content(cls, v):
        """Sanitize notification content."""
        import re
        v = re.sub(r'<[^>]*>', '', v)
        v = re.sub(r'javascript:', '', v, flags=re.IGNORECASE)
        v = v.strip()
        return v


class BroadcastResult(BaseModel):
    """Schema for broadcast notification result."""
    broadcast_id: UUID
    title: str
    target_count: int
    sent_count: int
    failed_count: int
    created_at: datetime


# Template Schemas

class NotificationTemplate(BaseModel):
    """Schema for notification templates."""
    type: NotificationType
    title_template: str
    message_template: str
    channels: List[NotificationChannel]
    priority: NotificationPriority
    
    def render(self, context: Dict[str, Any]) -> Dict[str, str]:
        """Render template with context."""
        from jinja2 import Template
        
        title_tmpl = Template(self.title_template)
        message_tmpl = Template(self.message_template)
        
        return {
            'title': title_tmpl.render(**context),
            'message': message_tmpl.render(**context)
        }


# Success Response Schemas

class NotificationCreatedResponse(BaseModel):
    """Response schema for successful notification creation."""
    notification: NotificationResponse
    message: str = "Notification created successfully"


class NotificationUpdatedResponse(BaseModel):
    """Response schema for successful notification update."""
    notification: NotificationResponse
    message: str = "Notification updated successfully"


class PreferencesUpdatedResponse(BaseModel):
    """Response schema for successful preferences update."""
    preferences: NotificationPreferencesResponse
    message: str = "Preferences updated successfully"


class BulkReadResponse(BaseModel):
    """Response schema for bulk read operation."""
    updated_count: int
    message: str = "Notifications marked as read"


# Error Response Schemas

class NotificationErrorResponse(BaseModel):
    """Response schema for notification errors."""
    error: str
    details: Optional[Dict[str, Any]] = None
    suggestions: Optional[List[str]] = None


# Event Schemas for Integration

class NotificationEvent(BaseModel):
    """Schema for notification events."""
    type: NotificationType
    recipient_id: UUID
    context: Dict[str, Any]
    priority: NotificationPriority = NotificationPriority.NORMAL
    channels: Optional[List[NotificationChannel]] = None


class BookingNotificationEvent(NotificationEvent):
    """Schema for booking-related notification events."""
    booking_id: UUID
    booking_status: str
    tool_title: str
    borrower_name: Optional[str] = None
    owner_name: Optional[str] = None


class ReviewNotificationEvent(NotificationEvent):
    """Schema for review-related notification events."""
    booking_id: UUID
    review_id: Optional[UUID] = None
    tool_title: str
    reviewer_name: Optional[str] = None