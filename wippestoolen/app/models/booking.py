"""Booking-related models."""

from datetime import datetime, date
from decimal import Decimal
from typing import Optional
import uuid

from sqlalchemy import (
    Boolean,
    DateTime,
    String,
    Text,
    Numeric,
    Date,
    CheckConstraint,
    ForeignKey,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from wippestoolen.app.core.database import Base


class Booking(Base):
    """Booking model for tool rental transactions."""

    __tablename__ = "bookings"

    # Primary key
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # Foreign keys
    borrower_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id")
    )
    tool_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tools.id")
    )

    # Booking details
    requested_start_date: Mapped[date] = mapped_column(Date)
    requested_end_date: Mapped[date] = mapped_column(Date)
    actual_start_date: Mapped[Optional[date]] = mapped_column(Date)
    actual_end_date: Mapped[Optional[date]] = mapped_column(Date)

    # Status workflow: pending -> confirmed -> active -> returned -> completed
    # or: pending -> declined / cancelled
    status: Mapped[str] = mapped_column(String(20), default="pending")

    # Messages and notes
    borrower_message: Mapped[Optional[str]] = mapped_column(Text)
    owner_response: Mapped[Optional[str]] = mapped_column(Text)
    pickup_notes: Mapped[Optional[str]] = mapped_column(Text)
    return_notes: Mapped[Optional[str]] = mapped_column(Text)

    # Financial details
    deposit_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    deposit_paid: Mapped[bool] = mapped_column(Boolean, default=False)
    deposit_returned: Mapped[bool] = mapped_column(Boolean, default=False)
    daily_rate: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    total_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)

    # Pickup/delivery details
    pickup_method: Mapped[str] = mapped_column(String(20), default="pickup")
    pickup_address: Mapped[Optional[str]] = mapped_column(Text)
    delivery_fee: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)

    # Cancellation
    cancelled_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id")
    )
    cancellation_reason: Mapped[Optional[str]] = mapped_column(Text)
    cancelled_at: Mapped[Optional[datetime]] = mapped_column(DateTime)

    # Important dates
    confirmed_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.current_timestamp()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=func.current_timestamp(),
        onupdate=func.current_timestamp(),
    )

    # Relationships
    borrower: Mapped["User"] = relationship(
        "User",
        foreign_keys=[borrower_id],
        back_populates="bookings_as_borrower",
    )
    tool: Mapped["Tool"] = relationship("Tool", back_populates="bookings")
    cancelled_by_user: Mapped[Optional["User"]] = relationship(
        "User", foreign_keys=[cancelled_by]
    )
    status_history: Mapped[list["BookingStatusHistory"]] = relationship(
        "BookingStatusHistory", back_populates="booking", cascade="all, delete-orphan"
    )
    reviews: Mapped[list["Review"]] = relationship(
        "Review", back_populates="booking", cascade="all, delete-orphan"
    )

    # Constraints
    __table_args__ = (
        CheckConstraint(
            "status IN ('pending', 'confirmed', 'active', 'returned', 'completed', 'declined', 'cancelled')",
            name="bookings_status_check",
        ),
        CheckConstraint(
            "pickup_method IN ('pickup', 'delivery')",
            name="bookings_pickup_method_check",
        ),
        CheckConstraint(
            "requested_end_date >= requested_start_date",
            name="bookings_date_logic",
        ),
        CheckConstraint(
            "deposit_amount >= 0 AND daily_rate >= 0 AND total_amount >= 0",
            name="bookings_amounts_positive",
        ),
    )

    def __repr__(self) -> str:
        """String representation of Booking."""
        return f"<Booking {self.id} - {self.status}>"


class BookingStatusHistory(Base):
    """Booking status history for audit trail."""

    __tablename__ = "booking_status_history"

    # Primary key
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # Foreign key
    booking_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("bookings.id", ondelete="CASCADE")
    )

    # Status change details
    from_status: Mapped[Optional[str]] = mapped_column(String(20))
    to_status: Mapped[str] = mapped_column(String(20))
    changed_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id")
    )

    # Context
    reason: Mapped[Optional[str]] = mapped_column(Text)
    notes: Mapped[Optional[str]] = mapped_column(Text)

    # Timestamp
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.current_timestamp()
    )

    # Relationships
    booking: Mapped[Booking] = relationship("Booking", back_populates="status_history")
    changed_by_user: Mapped["User"] = relationship("User")

    # Constraints
    __table_args__ = (
        CheckConstraint(
            "from_status IN ('pending', 'confirmed', 'active', 'returned', 'completed', 'declined', 'cancelled') AND "
            "to_status IN ('pending', 'confirmed', 'active', 'returned', 'completed', 'declined', 'cancelled')",
            name="bsh_status_check",
        ),
    )

    def __repr__(self) -> str:
        """String representation of BookingStatusHistory."""
        return f"<BookingStatusHistory {self.from_status} -> {self.to_status}>"