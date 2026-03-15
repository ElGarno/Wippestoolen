"""Photo service for tool photo uploads and management."""

import os
import uuid
from pathlib import Path
from typing import Optional

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from wippestoolen.app.core.config import settings
from wippestoolen.app.models.tool import Tool, ToolPhoto

# Local storage directory (configurable via PHOTO_STORAGE_DIR env var)
PHOTO_STORAGE_DIR = Path(os.getenv("PHOTO_STORAGE_DIR", "/app/uploads/photos"))
PHOTO_BASE_URL = os.getenv("PHOTO_BASE_URL", "/uploads/photos")


class PhotoService:
    """Service for managing tool photos with local file storage."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def upload_photo(
        self,
        tool_id: uuid.UUID,
        file: UploadFile,
        user_id: uuid.UUID,
    ) -> ToolPhoto:
        """Upload a photo for a tool to local storage."""
        # Check tool exists and user owns it
        result = await self.db.execute(select(Tool).where(Tool.id == tool_id))
        tool = result.scalar_one_or_none()

        if tool is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Tool not found",
            )

        if tool.owner_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not own this tool",
            )

        # Validate content type — fall back to extension-based detection
        content_type = file.content_type or ""
        if content_type not in settings.ALLOWED_IMAGE_TYPES:
            filename = (file.filename or "").lower()
            if filename.endswith(".png"):
                content_type = "image/png"
            elif filename.endswith(".webp"):
                content_type = "image/webp"
            elif filename.endswith((".jpg", ".jpeg", ".heic")):
                content_type = "image/jpeg"
            else:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"File type not allowed. Allowed types: {', '.join(settings.ALLOWED_IMAGE_TYPES)}",
                )
        # content_type variable is used below instead of file.content_type

        # Read file and validate size
        content = await file.read()
        if len(content) > settings.MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"File too large. Maximum size is {settings.MAX_FILE_SIZE // (1024 * 1024)}MB",
            )

        # Generate unique filename and ensure directory exists
        extension = (file.filename or "photo").rsplit(".", 1)[-1].lower()
        photo_id = uuid.uuid4()
        relative_path = f"{tool_id}/{photo_id}.{extension}"
        full_path = PHOTO_STORAGE_DIR / relative_path
        full_path.parent.mkdir(parents=True, exist_ok=True)

        # Write file to disk
        full_path.write_bytes(content)

        # Build URL (served by FastAPI static files or reverse proxy)
        original_url = f"{PHOTO_BASE_URL}/{relative_path}"

        # Count existing photos for display_order
        existing_count_result = await self.db.execute(
            select(ToolPhoto).where(
                ToolPhoto.tool_id == tool_id,
                ToolPhoto.is_active == True,  # noqa: E712
            )
        )
        existing_photos = existing_count_result.scalars().all()
        display_order = len(existing_photos)
        is_primary = display_order == 0

        # Create ToolPhoto record
        photo = ToolPhoto(
            tool_id=tool_id,
            original_url=original_url,
            filename=file.filename,
            file_size_bytes=len(content),
            mime_type=content_type,
            display_order=display_order,
            is_primary=is_primary,
            is_active=True,
        )
        self.db.add(photo)
        await self.db.commit()
        await self.db.refresh(photo)

        return photo

    async def delete_photo(
        self,
        photo_id: uuid.UUID,
        user_id: uuid.UUID,
        tool_id: uuid.UUID,
    ) -> None:
        """Delete a photo by soft-deleting it and removing the file."""
        result = await self.db.execute(
            select(ToolPhoto).where(
                ToolPhoto.id == photo_id,
                ToolPhoto.tool_id == tool_id,
                ToolPhoto.is_active == True,  # noqa: E712
            )
        )
        photo = result.scalar_one_or_none()

        if photo is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Photo not found",
            )

        # Validate ownership via the tool
        tool_result = await self.db.execute(select(Tool).where(Tool.id == tool_id))
        tool = tool_result.scalar_one_or_none()

        if tool is None or tool.owner_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not own this tool",
            )

        # Delete file from disk (best-effort)
        relative_path = photo.original_url.removeprefix(f"{PHOTO_BASE_URL}/")
        file_path = PHOTO_STORAGE_DIR / relative_path
        try:
            file_path.unlink(missing_ok=True)
        except OSError:
            pass

        # Soft-delete the record
        photo.is_active = False
        await self.db.commit()

    async def get_photos_for_tool(self, tool_id: uuid.UUID) -> list[ToolPhoto]:
        """Return active photos for a tool, ordered by display_order."""
        result = await self.db.execute(
            select(ToolPhoto)
            .where(
                ToolPhoto.tool_id == tool_id,
                ToolPhoto.is_active == True,  # noqa: E712
            )
            .order_by(ToolPhoto.display_order)
        )
        return list(result.scalars().all())
