"""Notification model."""

from datetime import datetime, timedelta
from typing import Optional, Any
import uuid

from sqlalchemy import (
    Boolean,
    DateTime,
    Integer,
    String,
    Text,
    CheckConstraint,
    ForeignKey,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from wippestoolen.app.core.database import Base


class NotificationPreferences(Base):
    """User notification preferences model."""

    __tablename__ = "notification_preferences"

    # Primary key
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # Foreign key
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True
    )

    # Channel preferences
    in_app_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    email_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    push_enabled: Mapped[bool] = mapped_column(Boolean, default=False)

    # Notification type preferences
    booking_notifications: Mapped[bool] = mapped_column(Boolean, default=True)
    review_notifications: Mapped[bool] = mapped_column(Boolean, default=True)
    system_notifications: Mapped[bool] = mapped_column(Boolean, default=True)

    # Quiet hours
    quiet_hours_start: Mapped[Optional[int]] = mapped_column(Integer, default=None)
    quiet_hours_end: Mapped[Optional[int]] = mapped_column(Integer, default=None)
    timezone: Mapped[str] = mapped_column(String(50), default="UTC")

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.current_timestamp()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, 
        server_default=func.current_timestamp(),
        onupdate=func.current_timestamp()
    )

    # Relationship
    user: Mapped["User"] = relationship("User", back_populates="notification_preferences")

    # Constraints
    __table_args__ = (
        CheckConstraint(
            "quiet_hours_start IS NULL OR (quiet_hours_start >= 0 AND quiet_hours_start <= 23)",
            name="notification_preferences_quiet_start_check",
        ),
        CheckConstraint(
            "quiet_hours_end IS NULL OR (quiet_hours_end >= 0 AND quiet_hours_end <= 23)",
            name="notification_preferences_quiet_end_check",
        ),
    )

    def __repr__(self) -> str:
        """String representation of NotificationPreferences."""
        return f"<NotificationPreferences user_id={self.user_id}>"


class Notification(Base):
    """Notification model for in-app notifications."""

    __tablename__ = "notifications"

    # Primary key
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # Foreign key
    recipient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE")
    )

    # Notification content
    type: Mapped[str] = mapped_column(String(50))
    title: Mapped[str] = mapped_column(String(200))
    message: Mapped[str] = mapped_column(Text)

    # Related entities (optional)
    related_booking_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("bookings.id")
    )
    related_tool_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tools.id")
    )
    related_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id")
    )

    # Action data (for deep linking)
    action_url: Mapped[Optional[str]] = mapped_column(String(500))
    action_data: Mapped[Optional[dict[str, Any]]] = mapped_column(JSONB)

    # Status
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    read_at: Mapped[Optional[datetime]] = mapped_column(DateTime)

    # Priority
    priority: Mapped[str] = mapped_column(String(10), default="normal")

    # Delivery channels
    sent_in_app: Mapped[bool] = mapped_column(Boolean, default=True)
    sent_email: Mapped[bool] = mapped_column(Boolean, default=False)
    sent_push: Mapped[bool] = mapped_column(Boolean, default=False)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.current_timestamp()
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime, 
        default=lambda: datetime.utcnow() + timedelta(days=30)
    )

    # Relationships
    recipient: Mapped["User"] = relationship(
        "User", 
        foreign_keys=[recipient_id], 
        back_populates="notifications"
    )
    related_booking: Mapped[Optional["Booking"]] = relationship("Booking")
    related_tool: Mapped[Optional["Tool"]] = relationship("Tool")
    related_user: Mapped[Optional["User"]] = relationship(
        "User", foreign_keys=[related_user_id]
    )

    # Constraints
    __table_args__ = (
        CheckConstraint(
            "priority IN ('low', 'normal', 'high', 'urgent')",
            name="notifications_priority_check",
        ),
    )

    def __repr__(self) -> str:
        """String representation of Notification."""
        return f"<Notification {self.type} - {self.title}>"