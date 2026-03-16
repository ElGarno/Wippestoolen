"""Push notification token model."""

from datetime import datetime
from typing import Optional
import uuid

from sqlalchemy import Boolean, DateTime, String, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from wippestoolen.app.core.database import Base


class PushToken(Base):
    """Push notification device token for a user."""

    __tablename__ = "push_tokens"

    # Primary key
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # Foreign key
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )

    # Token data
    token: Mapped[str] = mapped_column(String(500), unique=True, nullable=False)
    platform: Mapped[str] = mapped_column(
        String(10), nullable=False
    )  # "ios" or "android"

    # Optional metadata
    device_name: Mapped[Optional[str]] = mapped_column(String(255))

    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

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
    user = relationship("User", back_populates="push_tokens")

    def __repr__(self) -> str:
        """String representation of PushToken."""
        return f"<PushToken user={self.user_id} platform={self.platform}>"
