"""User model."""

from datetime import datetime
from decimal import Decimal
from typing import Optional
import uuid

from sqlalchemy import Boolean, DateTime, String, Text, Numeric, Integer, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from wippestoolen.app.core.database import Base


class User(Base):
    """User model for authentication and profiles."""

    __tablename__ = "users"

    # Primary key
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # Authentication
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))

    # Profile information
    display_name: Mapped[str] = mapped_column(String(100))
    first_name: Mapped[Optional[str]] = mapped_column(String(50))
    last_name: Mapped[Optional[str]] = mapped_column(String(50))
    phone_number: Mapped[Optional[str]] = mapped_column(String(20))

    # Location data
    address: Mapped[Optional[str]] = mapped_column(Text)
    city: Mapped[Optional[str]] = mapped_column(String(100))
    postal_code: Mapped[Optional[str]] = mapped_column(String(20))
    country: Mapped[str] = mapped_column(String(2), default="DE")
    latitude: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 8))
    longitude: Mapped[Optional[Decimal]] = mapped_column(Numeric(11, 8))
    location_precision: Mapped[int] = mapped_column(Integer, default=100)

    # Profile data
    bio: Mapped[Optional[str]] = mapped_column(Text)
    avatar_url: Mapped[Optional[str]] = mapped_column(String(500))

    # Ratings (denormalized for performance)
    average_rating: Mapped[Decimal] = mapped_column(Numeric(3, 2), default=0.0)
    total_ratings: Mapped[int] = mapped_column(Integer, default=0)

    # Account status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    email_verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime)

    # Privacy settings
    location_visible: Mapped[bool] = mapped_column(Boolean, default=True)
    profile_visible: Mapped[bool] = mapped_column(Boolean, default=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.current_timestamp()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=func.current_timestamp(),
        onupdate=func.current_timestamp(),
    )
    last_login_at: Mapped[Optional[datetime]] = mapped_column(DateTime)

    # GDPR compliance
    data_retention_until: Mapped[Optional[datetime]] = mapped_column(DateTime)
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime)

    # Relationships
    owned_tools: Mapped[list["Tool"]] = relationship(
        "Tool", back_populates="owner", cascade="all, delete-orphan"
    )
    bookings_as_borrower: Mapped[list["Booking"]] = relationship(
        "Booking",
        foreign_keys="Booking.borrower_id",
        back_populates="borrower",
        cascade="all, delete-orphan",
    )
    reviews_given: Mapped[list["Review"]] = relationship(
        "Review",
        foreign_keys="Review.reviewer_id",
        back_populates="reviewer",
        cascade="all, delete-orphan",
    )
    reviews_received: Mapped[list["Review"]] = relationship(
        "Review",
        foreign_keys="Review.reviewee_id",
        back_populates="reviewee",
    )
    notifications: Mapped[list["Notification"]] = relationship(
        "Notification", 
        foreign_keys="Notification.recipient_id",
        back_populates="recipient", 
        cascade="all, delete-orphan"
    )
    notification_preferences: Mapped["NotificationPreferences"] = relationship(
        "NotificationPreferences",
        back_populates="user",
        cascade="all, delete-orphan",
        uselist=False
    )

    # Constraints
    __table_args__ = (
        CheckConstraint(
            "average_rating >= 0 AND average_rating <= 5",
            name="users_rating_range",
        ),
        CheckConstraint(
            "email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$'",
            name="users_email_format",
        ),
    )

    def __repr__(self) -> str:
        """String representation of User."""
        return f"<User {self.email}>"