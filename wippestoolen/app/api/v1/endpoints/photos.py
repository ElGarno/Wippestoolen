"""Photo upload and management endpoints."""

from uuid import UUID

from fastapi import APIRouter, Depends, Request, UploadFile, File, status
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.ext.asyncio import AsyncSession

from wippestoolen.app.api.v1.dependencies import get_current_active_user
from wippestoolen.app.core.database import get_db
from wippestoolen.app.models.user import User
from wippestoolen.app.schemas.tool import ToolPhotoResponse
from wippestoolen.app.services.photo_service import PhotoService

router = APIRouter(prefix="/tools", tags=["Photos"])

limiter = Limiter(key_func=get_remote_address)


@router.post(
    "/{tool_id}/photos",
    response_model=ToolPhotoResponse,
    status_code=status.HTTP_201_CREATED,
)
@limiter.limit("20/minute")
async def upload_tool_photo(
    request: Request,
    tool_id: UUID,
    file: UploadFile = File(..., description="Image file (JPEG, PNG, or WebP, max 5MB)"),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> ToolPhotoResponse:
    """
    Upload a photo for a tool.

    The authenticated user must be the owner of the tool.
    Accepted formats: JPEG, PNG, WebP — maximum 5 MB.

    Args:
        tool_id: UUID of the tool
        file: Image file to upload
        current_user: Current authenticated user
        db: Database session

    Returns:
        ToolPhotoResponse: Created photo details

    Raises:
        HTTPException 403: If the user does not own the tool
        HTTPException 404: If the tool does not exist
        HTTPException 422: If the file is too large or has an unsupported type
        HTTPException 502: If the S3 upload fails
    """
    photo_service = PhotoService(db)
    photo = await photo_service.upload_photo(
        tool_id=tool_id,
        file=file,
        user_id=current_user.id,
    )
    return ToolPhotoResponse(
        id=photo.id,
        original_url=photo.original_url,
        thumbnail_url=photo.thumbnail_url,
        medium_url=photo.medium_url,
        large_url=photo.large_url,
        display_order=photo.display_order,
        is_primary=photo.is_primary,
    )


@router.delete(
    "/{tool_id}/photos/{photo_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
@limiter.limit("20/minute")
async def delete_tool_photo(
    request: Request,
    tool_id: UUID,
    photo_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """
    Delete a photo from a tool.

    The authenticated user must be the owner of the tool.

    Args:
        tool_id: UUID of the tool
        photo_id: UUID of the photo to delete
        current_user: Current authenticated user
        db: Database session

    Raises:
        HTTPException 403: If the user does not own the tool
        HTTPException 404: If the photo does not exist
    """
    photo_service = PhotoService(db)
    await photo_service.delete_photo(
        photo_id=photo_id,
        user_id=current_user.id,
        tool_id=tool_id,
    )
