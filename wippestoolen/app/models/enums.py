"""Enums for database models."""

from enum import Enum


class BookingStatus(str, Enum):
    """Booking status enum."""
    PENDING = "pending"
    CONFIRMED = "confirmed"
    DECLINED = "declined"
    CANCELLED = "cancelled"
    ACTIVE = "active"
    COMPLETED = "completed"
    DISPUTED = "disputed"


class NotificationType(str, Enum):
    """Notification type enum."""
    BOOKING_REQUEST = "booking_request"
    BOOKING_CONFIRMED = "booking_confirmed"
    BOOKING_DECLINED = "booking_declined"
    BOOKING_CANCELLED = "booking_cancelled"
    BOOKING_STARTED = "booking_started"
    BOOKING_COMPLETED = "booking_completed"
    REVIEW_RECEIVED = "review_received"
    REVIEW_REMINDER = "review_reminder"
    TOOL_RETURN_REMINDER = "tool_return_reminder"
    SYSTEM = "system"
    PROMOTIONAL = "promotional"