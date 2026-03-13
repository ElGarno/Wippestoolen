"""Photo service for tool photo uploads and management."""

import uuid
from typing import Optional

import boto3
from botocore.exceptions import BotoCoreError, ClientError
from fastapi import HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from wippestoolen.app.core.config import settings
from wippestoolen.app.models.tool import Tool, ToolPhoto


class PhotoNotFoundError(Exception):
    """Photo not found error."""
    pass


class PhotoOwnershipError(Exception):
    """Photo ownership error."""
    pass


class PhotoUploadError(Exception):
    """Photo upload error."""
    pass


class PhotoService:
    """Service for managing tool photos."""

    def __init__(self, db: AsyncSession):
        self.db = db

    def _get_s3_client(self):
        """Get a boto3 S3 client."""
        kwargs = {"region_name": settings.AWS_REGION}
        if settings.AWS_ACCESS_KEY_ID and settings.AWS_SECRET_ACCESS_KEY:
            kwargs["aws_access_key_id"] = settings.AWS_ACCESS_KEY_ID
            kwargs["aws_secret_access_key"] = settings.AWS_SECRET_ACCESS_KEY
        return boto3.client("s3", **kwargs)

    async def upload_photo(
        self,
        tool_id: uuid.UUID,
        file: UploadFile,
        user_id: uuid.UUID,
    ) -> ToolPhoto:
        """
        Upload a photo for a tool.

        Validates that the user owns the tool, uploads the file to S3,
        and creates a ToolPhoto record in the database.

        Args:
            tool_id: UUID of the tool to attach the photo to
            file: Uploaded file
            user_id: UUID of the current user

        Returns:
            ToolPhoto: Created photo record

        Raises:
            HTTPException: If tool not found, user doesn't own the tool,
                           file validation fails, or upload fails
        """
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

        # Validate content type
        if file.content_type not in settings.ALLOWED_IMAGE_TYPES:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"File type not allowed. Allowed types: {', '.join(settings.ALLOWED_IMAGE_TYPES)}",
            )

        # Read file and validate size
        content = await file.read()
        if len(content) > settings.MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"File too large. Maximum size is {settings.MAX_FILE_SIZE // (1024 * 1024)}MB",
            )

        # Generate a unique S3 key
        extension = (file.filename or "photo").rsplit(".", 1)[-1].lower()
        s3_key = f"tools/{tool_id}/photos/{uuid.uuid4()}.{extension}"

        # Upload to S3
        try:
            s3_client = self._get_s3_client()
            s3_client.put_object(
                Bucket=settings.S3_BUCKET_NAME,
                Key=s3_key,
                Body=content,
                ContentType=file.content_type,
            )
        except (BotoCoreError, ClientError) as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Failed to upload photo to storage: {exc}",
            )

        # Build public URL
        original_url = (
            f"https://{settings.S3_BUCKET_NAME}.s3.{settings.AWS_REGION}.amazonaws.com/{s3_key}"
        )

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
            mime_type=file.content_type,
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
        """
        Delete a photo by soft-deleting it and removing it from S3.

        Args:
            photo_id: UUID of the photo to delete
            user_id: UUID of the current user
            tool_id: UUID of the tool (used for ownership validation)

        Raises:
            HTTPException: If photo not found or user doesn't own the tool
        """
        # Load photo with its tool
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

        # Attempt S3 deletion (best-effort; don't block on failure)
        try:
            s3_key = photo.original_url.split(
                f"https://{settings.S3_BUCKET_NAME}.s3.{settings.AWS_REGION}.amazonaws.com/"
            )[-1]
            s3_client = self._get_s3_client()
            s3_client.delete_object(Bucket=settings.S3_BUCKET_NAME, Key=s3_key)
        except (BotoCoreError, ClientError):
            pass  # Log in production; don't fail the request

        # Soft-delete the record
        photo.is_active = False
        await self.db.commit()

    async def get_photos_for_tool(self, tool_id: uuid.UUID) -> list[ToolPhoto]:
        """
        Return active photos for a tool, ordered by display_order.

        Args:
            tool_id: UUID of the tool

        Returns:
            List[ToolPhoto]: Active photos ordered by display_order
        """
        result = await self.db.execute(
            select(ToolPhoto)
            .where(
                ToolPhoto.tool_id == tool_id,
                ToolPhoto.is_active == True,  # noqa: E712
            )
            .order_by(ToolPhoto.display_order)
        )
        return list(result.scalars().all())
