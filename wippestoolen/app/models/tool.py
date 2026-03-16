"""Tool-related models."""

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
    Integer,
    CheckConstraint,
    ForeignKey,
    Date,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from wippestoolen.app.core.database import Base


class ToolCategory(Base):
    """Tool category model."""

    __tablename__ = "tool_categories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(50), unique=True)
    slug: Mapped[str] = mapped_column(String(50), unique=True)
    description: Mapped[Optional[str]] = mapped_column(Text)
    icon_name: Mapped[Optional[str]] = mapped_column(String(50))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.current_timestamp()
    )

    # Relationships
    tools: Mapped[list["Tool"]] = relationship("Tool", back_populates="category")

    def __repr__(self) -> str:
        """String representation of ToolCategory."""
        return f"<ToolCategory {self.name}>"


class Tool(Base):
    """Tool model for tool listings."""

    __tablename__ = "tools"

    # Primary key
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # Foreign keys
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE")
    )
    category_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("tool_categories.id")
    )

    # Tool information
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text)
    brand: Mapped[Optional[str]] = mapped_column(String(100))
    model: Mapped[Optional[str]] = mapped_column(String(100))
    condition: Mapped[str] = mapped_column(String(20), default="good")

    # Availability and pricing
    is_available: Mapped[bool] = mapped_column(Boolean, default=True)
    max_loan_days: Mapped[int] = mapped_column(Integer, default=7)
    deposit_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    daily_rate: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)

    # Location (can differ from owner location)
    pickup_address: Mapped[Optional[str]] = mapped_column(Text)
    pickup_city: Mapped[Optional[str]] = mapped_column(String(100))
    pickup_postal_code: Mapped[Optional[str]] = mapped_column(String(20))
    pickup_latitude: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 8))
    pickup_longitude: Mapped[Optional[Decimal]] = mapped_column(Numeric(11, 8))
    delivery_available: Mapped[bool] = mapped_column(Boolean, default=False)
    delivery_radius_km: Mapped[int] = mapped_column(Integer, default=0)

    # Usage and maintenance
    usage_instructions: Mapped[Optional[str]] = mapped_column(Text)
    safety_notes: Mapped[Optional[str]] = mapped_column(Text)
    last_maintenance_date: Mapped[Optional[date]] = mapped_column(Date)
    next_maintenance_due: Mapped[Optional[date]] = mapped_column(Date)

    # Statistics (denormalized for performance)
    total_bookings: Mapped[int] = mapped_column(Integer, default=0)
    average_rating: Mapped[Decimal] = mapped_column(Numeric(3, 2), default=0.0)
    total_ratings: Mapped[int] = mapped_column(Integer, default=0)

    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.current_timestamp()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=func.current_timestamp(),
        onupdate=func.current_timestamp(),
    )
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime)

    # Relationships
    owner: Mapped["User"] = relationship("User", back_populates="owned_tools")
    category: Mapped[ToolCategory] = relationship("ToolCategory", back_populates="tools")
    photos: Mapped[list["ToolPhoto"]] = relationship(
        "ToolPhoto", back_populates="tool", cascade="all, delete-orphan"
    )
    bookings: Mapped[list["Booking"]] = relationship(
        "Booking", back_populates="tool", cascade="all, delete-orphan"
    )

    # Constraints
    __table_args__ = (
        CheckConstraint(
            "condition IN ('excellent', 'good', 'fair', 'poor')",
            name="tools_condition_check",
        ),
        CheckConstraint(
            "average_rating >= 0 AND average_rating <= 5",
            name="tools_rating_range",
        ),
        CheckConstraint(
            "max_loan_days > 0 AND max_loan_days <= 365",
            name="tools_max_loan_days",
        ),
        CheckConstraint(
            "deposit_amount >= 0",
            name="tools_deposit_amount",
        ),
    )

    def __repr__(self) -> str:
        """String representation of Tool."""
        return f"<Tool {self.title}>"


class ToolPhoto(Base):
    """Tool photo model."""

    __tablename__ = "tool_photos"

    # Primary key
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # Foreign key
    tool_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tools.id", ondelete="CASCADE")
    )

    # Photo data
    original_url: Mapped[str] = mapped_column(String(500))
    thumbnail_url: Mapped[Optional[str]] = mapped_column(String(500))
    medium_url: Mapped[Optional[str]] = mapped_column(String(500))
    large_url: Mapped[Optional[str]] = mapped_column(String(500))

    # Metadata
    filename: Mapped[Optional[str]] = mapped_column(String(255))
    file_size_bytes: Mapped[Optional[int]] = mapped_column(Integer)
    mime_type: Mapped[Optional[str]] = mapped_column(String(50))
    width: Mapped[Optional[int]] = mapped_column(Integer)
    height: Mapped[Optional[int]] = mapped_column(Integer)

    # Ordering
    display_order: Mapped[int] = mapped_column(Integer, default=0)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False)

    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.current_timestamp()
    )

    # Relationships
    tool: Mapped[Tool] = relationship("Tool", back_populates="photos")

    # Constraints
    __table_args__ = (
        CheckConstraint(
            "file_size_bytes > 0",
            name="tool_photos_file_size",
        ),
        CheckConstraint(
            "width > 0 AND height > 0",
            name="tool_photos_dimensions",
        ),
    )

    def __repr__(self) -> str:
        """String representation of ToolPhoto."""
        return f"<ToolPhoto {self.filename}>"