"""Review model."""

from datetime import datetime
from typing import Optional
import uuid

from sqlalchemy import (
    Boolean,
    DateTime,
    String,
    Text,
    Integer,
    CheckConstraint,
    ForeignKey,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from wippestoolen.app.core.database import Base


class Review(Base):
    """Review model for mutual ratings between users."""

    __tablename__ = "reviews"

    # Primary key
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # Foreign keys
    booking_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("bookings.id")
    )
    reviewer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id")
    )
    reviewee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id")
    )

    # Review content
    rating: Mapped[int] = mapped_column(Integer)
    title: Mapped[Optional[str]] = mapped_column(String(200))
    comment: Mapped[Optional[str]] = mapped_column(Text)

    # Review type
    review_type: Mapped[str] = mapped_column(String(20))

    # Tool condition (for borrower reviews)
    tool_condition_rating: Mapped[Optional[int]] = mapped_column(Integer)

    # Response to review
    response: Mapped[Optional[str]] = mapped_column(Text)
    response_at: Mapped[Optional[datetime]] = mapped_column(DateTime)

    # Moderation
    is_flagged: Mapped[bool] = mapped_column(Boolean, default=False)
    flagged_reason: Mapped[Optional[str]] = mapped_column(Text)
    is_approved: Mapped[bool] = mapped_column(Boolean, default=True)
    moderated_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id")
    )
    moderated_at: Mapped[Optional[datetime]] = mapped_column(DateTime)

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
    booking: Mapped["Booking"] = relationship("Booking", back_populates="reviews")
    reviewer: Mapped["User"] = relationship(
        "User", foreign_keys=[reviewer_id], back_populates="reviews_given"
    )
    reviewee: Mapped["User"] = relationship(
        "User", foreign_keys=[reviewee_id], back_populates="reviews_received"
    )
    moderator: Mapped[Optional["User"]] = relationship(
        "User", foreign_keys=[moderated_by]
    )

    # Constraints
    __table_args__ = (
        CheckConstraint(
            "rating >= 1 AND rating <= 5",
            name="reviews_rating_range",
        ),
        CheckConstraint(
            "tool_condition_rating IS NULL OR (tool_condition_rating >= 1 AND tool_condition_rating <= 5)",
            name="reviews_tool_condition_range",
        ),
        CheckConstraint(
            "review_type IN ('borrower_to_owner', 'owner_to_borrower')",
            name="reviews_type_check",
        ),
        CheckConstraint(
            "reviewer_id != reviewee_id",
            name="reviews_not_self_review",
        ),
        # Ensure one review per user per booking per type
        UniqueConstraint(
            "booking_id", "reviewer_id", "review_type",
            name="reviews_unique_per_booking_user_type",
        ),
    )

    def __repr__(self) -> str:
        """String representation of Review."""
        return f"<Review {self.rating}/5 - {self.review_type}>"