"""Tool management API endpoints."""

import logging
from typing import List, Optional
from uuid import UUID

logger = logging.getLogger(__name__)

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.ext.asyncio import AsyncSession

from wippestoolen.app.api.v1.dependencies import get_current_active_user
from wippestoolen.app.core.database import get_db
from wippestoolen.app.models.user import User
from wippestoolen.app.schemas.tool import (
    PaginatedToolResponse,
    ToolCategoryWithCountResponse,
    ToolCreateRequest,
    ToolPhotoResponse,
    ToolResponse,
    ToolUpdateRequest,
)
from wippestoolen.app.services.photo_service import PhotoService
from wippestoolen.app.services.tool_service import (
    ToolCategoryNotFoundError,
    ToolNotFoundError,
    ToolOwnershipError,
    ToolService,
)

# Create router
router = APIRouter(prefix="/tools", tags=["Tools"])

# Rate limiter
limiter = Limiter(key_func=get_remote_address)


@router.post("", response_model=ToolResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("10/minute")
async def create_tool(
    request: Request,
    tool_data: ToolCreateRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> ToolResponse:
    """
    Create a new tool listing.
    
    Args:
        tool_data: Tool creation data
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        ToolResponse: Created tool details
        
    Raises:
        HTTPException: If category not found or validation fails
    """
    tool_service = ToolService(db)
    photo_service = PhotoService(db)

    try:
        tool = await tool_service.create_tool(current_user.id, tool_data)

        photos = await photo_service.get_photos_for_tool(tool.id)
        photo_responses = [
            ToolPhotoResponse(
                id=p.id,
                original_url=p.original_url,
                thumbnail_url=p.thumbnail_url,
                medium_url=p.medium_url,
                large_url=p.large_url,
                display_order=p.display_order,
                is_primary=p.is_primary,
            )
            for p in photos
        ]

        category_data = await tool_service.get_category_by_id(tool.category_id)
        return ToolResponse(
            id=tool.id,
            title=tool.title,
            description=tool.description,
            category={
                "id": category_data.get("id") if category_data else tool.category_id,
                "name": category_data.get("name") if category_data else "Unknown",
                "slug": category_data.get("slug") if category_data else "unknown",
                "description": category_data.get("description") if category_data else None,
                "icon_name": category_data.get("icon_name") if category_data else None,
            },
            brand=tool.brand,
            model=tool.model,
            condition=tool.condition,
            is_available=tool.is_available,
            max_loan_days=tool.max_loan_days,
            deposit_amount=tool.deposit_amount,
            daily_rate=tool.daily_rate,
            pickup_address=tool.pickup_address,
            pickup_city=tool.pickup_city,
            pickup_postal_code=tool.pickup_postal_code,
            pickup_latitude=tool.pickup_latitude,
            pickup_longitude=tool.pickup_longitude,
            delivery_available=tool.delivery_available,
            delivery_radius_km=tool.delivery_radius_km,
            usage_instructions=tool.usage_instructions,
            safety_notes=tool.safety_notes,
            last_maintenance_date=tool.last_maintenance_date,
            next_maintenance_due=tool.next_maintenance_due,
            total_bookings=tool.total_bookings,
            average_rating=tool.average_rating,
            total_ratings=tool.total_ratings,
            photos=photo_responses,
            owner={
                "id": current_user.id,
                "display_name": current_user.display_name,
                "first_name": current_user.first_name,
                "last_name": current_user.last_name,
                "avatar_url": current_user.avatar_url,
                "average_rating": current_user.average_rating,
                "total_ratings": current_user.total_ratings,
                "is_verified": current_user.is_verified,
            },
            created_at=tool.created_at,
            updated_at=tool.updated_at,
        )
    except ToolCategoryNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception:
        logger.exception("Unexpected error in create_tool")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Tool creation failed"
        )


@router.get("", response_model=PaginatedToolResponse)
@limiter.limit("100/minute")
async def browse_tools(
    request: Request,
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    sort_by: str = Query("created_at", regex="^(created_at|daily_rate|rating|title)$"),
    sort_order: str = Query("desc", regex="^(asc|desc)$"),
    search: Optional[str] = Query(None, description="Search term"),
    category: Optional[str] = Query(None, description="Category slug filter"),
    available: Optional[bool] = Query(None, description="Filter by availability"),
    db: AsyncSession = Depends(get_db),
) -> PaginatedToolResponse:
    """
    Browse all available tools with pagination.

    Args:
        page: Page number (1-based)
        page_size: Number of items per page
        sort_by: Sort field
        sort_order: Sort order (asc/desc)
        search: Search term
        category: Category slug filter
        available: Filter by availability
        db: Database session

    Returns:
        PaginatedToolResponse: Paginated list of tools
    """
    tool_service = ToolService(db)

    try:
        return await tool_service.browse_tools(
            page=page,
            page_size=page_size,
            sort_by=sort_by,
            sort_order=sort_order,
            search=search,
            category=category,
            available=available
        )
    except Exception:
        logger.exception("Unexpected error in browse_tools")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve tools"
        )


@router.get("/my-tools", response_model=PaginatedToolResponse)
@limiter.limit("50/minute")
async def get_my_tools(
    request: Request,
    status_filter: str = Query("active", regex="^(active|inactive|all)$", alias="status"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> PaginatedToolResponse:
    """
    Get current user's tools.
    
    Args:
        status_filter: Filter by tool status (active/inactive/all)
        page: Page number (1-based)
        page_size: Number of items per page
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        PaginatedToolResponse: Paginated list of user's tools
    """
    tool_service = ToolService(db)
    
    try:
        return await tool_service.get_user_tools(
            user_id=current_user.id,
            status=status_filter,
            page=page,
            page_size=page_size
        )
    except Exception:
        logger.exception("Unexpected error in get_my_tools")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve user tools"
        )


@router.get("/categories", response_model=List[ToolCategoryWithCountResponse])
@limiter.limit("100/minute")
async def get_tool_categories(
    request: Request,
    active_only: bool = Query(True, description="Show only active categories"),
    db: AsyncSession = Depends(get_db),
) -> List[ToolCategoryWithCountResponse]:
    """
    Get all tool categories with tool counts.
    
    Args:
        active_only: Whether to show only active categories
        db: Database session
        
    Returns:
        List[ToolCategoryWithCountResponse]: List of categories with counts
    """
    tool_service = ToolService(db)
    
    try:
        categories = await tool_service.get_categories_with_counts(active_only=active_only)
        return [ToolCategoryWithCountResponse(**cat) for cat in categories]
    except Exception:
        logger.exception("Unexpected error in get_tool_categories")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve categories"
        )


@router.get("/categories/{category_id}/tools", response_model=PaginatedToolResponse)
@limiter.limit("100/minute")
async def get_tools_by_category(
    request: Request,
    category_id: int,
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    sort_by: str = Query("created_at", regex="^(created_at|daily_rate|rating|title)$"),
    sort_order: str = Query("desc", regex="^(asc|desc)$"),
    db: AsyncSession = Depends(get_db),
) -> PaginatedToolResponse:
    """
    Get tools in a specific category.
    
    Args:
        category_id: Category ID
        page: Page number (1-based)
        page_size: Number of items per page
        sort_by: Sort field
        sort_order: Sort order (asc/desc)
        db: Database session
        
    Returns:
        PaginatedToolResponse: Paginated list of tools in category
    """
    tool_service = ToolService(db)
    
    try:
        return await tool_service.get_tools_by_category(
            category_id=category_id,
            page=page,
            page_size=page_size,
            sort_by=sort_by,
            sort_order=sort_order
        )
    except Exception:
        logger.exception("Unexpected error in get_tools_by_category")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve tools by category"
        )


@router.get("/{tool_id}", response_model=ToolResponse)
@limiter.limit("100/minute")
async def get_tool_details(
    request: Request,
    tool_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> ToolResponse:
    """
    Get detailed information about a specific tool.
    
    Args:
        tool_id: Tool UUID
        db: Database session
        
    Returns:
        ToolResponse: Detailed tool information
        
    Raises:
        HTTPException: If tool not found
    """
    tool_service = ToolService(db)
    
    try:
        tool = await tool_service.get_tool_by_id(tool_id)
        if not tool:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Tool not found"
            )
        
        # Load category, owner and photo details
        category_data = await tool_service.get_category_by_id(tool.category_id)
        owner_data = await tool_service.get_owner_by_id(tool.owner_id)
        photo_service = PhotoService(db)
        photos = await photo_service.get_photos_for_tool(tool.id)
        photo_responses = [
            ToolPhotoResponse(
                id=p.id,
                original_url=p.original_url,
                thumbnail_url=p.thumbnail_url,
                medium_url=p.medium_url,
                large_url=p.large_url,
                display_order=p.display_order,
                is_primary=p.is_primary,
            )
            for p in photos
        ]

        return ToolResponse(
            id=tool.id,
            title=tool.title,
            description=tool.description,
            category={
                "id": category_data.get("id"),
                "name": category_data.get("name"),
                "slug": category_data.get("slug"),
                "description": category_data.get("description"),
                "icon_name": category_data.get("icon_name")
            } if category_data else {"id": tool.category_id, "name": "Unknown", "slug": "unknown", "description": None, "icon_name": None},
            brand=tool.brand,
            model=tool.model,
            condition=tool.condition,
            is_available=tool.is_available,
            max_loan_days=tool.max_loan_days,
            deposit_amount=tool.deposit_amount,
            daily_rate=tool.daily_rate,
            pickup_address=tool.pickup_address,
            pickup_city=tool.pickup_city,
            pickup_postal_code=tool.pickup_postal_code,
            pickup_latitude=tool.pickup_latitude,
            pickup_longitude=tool.pickup_longitude,
            delivery_available=tool.delivery_available,
            delivery_radius_km=tool.delivery_radius_km,
            usage_instructions=tool.usage_instructions,
            safety_notes=tool.safety_notes,
            last_maintenance_date=tool.last_maintenance_date,
            next_maintenance_due=tool.next_maintenance_due,
            total_bookings=tool.total_bookings,
            average_rating=tool.average_rating,
            total_ratings=tool.total_ratings,
            photos=photo_responses,
            owner={
                "id": owner_data.get("id"),
                "display_name": owner_data.get("display_name"),
                "first_name": owner_data.get("first_name"),
                "last_name": owner_data.get("last_name"),
                "avatar_url": owner_data.get("avatar_url"),
                "average_rating": owner_data.get("average_rating"),
                "total_ratings": owner_data.get("total_ratings", 0),
                "is_verified": owner_data.get("is_verified", False),
            } if owner_data else {
                "id": tool.owner_id,
                "display_name": "Owner",
                "first_name": None,
                "last_name": None,
                "avatar_url": None,
                "average_rating": None,
                "total_ratings": 0,
                "is_verified": False,
            },
            created_at=tool.created_at,
            updated_at=tool.updated_at,
        )
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception:
        logger.exception("Unexpected error in get_tool_details")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve tool details"
        )


@router.put("/{tool_id}", response_model=ToolResponse)
@limiter.limit("20/minute")
async def update_tool(
    request: Request,
    tool_id: UUID,
    update_data: ToolUpdateRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> ToolResponse:
    """
    Update tool information.
    
    Args:
        tool_id: Tool UUID
        update_data: Tool update data
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        ToolResponse: Updated tool details
        
    Raises:
        HTTPException: If tool not found or user doesn't own it
    """
    tool_service = ToolService(db)
    photo_service = PhotoService(db)

    try:
        tool = await tool_service.update_tool(tool_id, current_user.id, update_data)

        photos = await photo_service.get_photos_for_tool(tool.id)
        photo_responses = [
            ToolPhotoResponse(
                id=p.id,
                original_url=p.original_url,
                thumbnail_url=p.thumbnail_url,
                medium_url=p.medium_url,
                large_url=p.large_url,
                display_order=p.display_order,
                is_primary=p.is_primary,
            )
            for p in photos
        ]

        # Load relationships and return full response
        category_data = await tool_service.get_category_by_id(tool.category_id)
        return ToolResponse(
            id=tool.id,
            title=tool.title,
            description=tool.description,
            category={
                "id": category_data.get("id") if category_data else tool.category_id,
                "name": category_data.get("name") if category_data else "Unknown",
                "slug": category_data.get("slug") if category_data else "unknown",
                "description": category_data.get("description") if category_data else None,
                "icon_name": category_data.get("icon_name") if category_data else None,
            },
            brand=tool.brand,
            model=tool.model,
            condition=tool.condition,
            is_available=tool.is_available,
            max_loan_days=tool.max_loan_days,
            deposit_amount=tool.deposit_amount,
            daily_rate=tool.daily_rate,
            pickup_address=tool.pickup_address,
            pickup_city=tool.pickup_city,
            pickup_postal_code=tool.pickup_postal_code,
            pickup_latitude=tool.pickup_latitude,
            pickup_longitude=tool.pickup_longitude,
            delivery_available=tool.delivery_available,
            delivery_radius_km=tool.delivery_radius_km,
            usage_instructions=tool.usage_instructions,
            safety_notes=tool.safety_notes,
            last_maintenance_date=tool.last_maintenance_date,
            next_maintenance_due=tool.next_maintenance_due,
            total_bookings=tool.total_bookings,
            average_rating=tool.average_rating,
            total_ratings=tool.total_ratings,
            photos=photo_responses,
            owner={
                "id": current_user.id,
                "display_name": current_user.display_name,
                "first_name": current_user.first_name,
                "last_name": current_user.last_name,
                "avatar_url": current_user.avatar_url,
                "average_rating": current_user.average_rating,
                "total_ratings": current_user.total_ratings,
                "is_verified": current_user.is_verified,
            },
            created_at=tool.created_at,
            updated_at=tool.updated_at,
        )
    except ToolNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except ToolOwnershipError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )
    except Exception:
        logger.exception("Unexpected error in update_tool")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Tool update failed"
        )


@router.delete("/{tool_id}", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("10/minute")
async def delete_tool(
    request: Request,
    tool_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """
    Delete (deactivate) a tool.
    
    Args:
        tool_id: Tool UUID
        current_user: Current authenticated user
        db: Database session
        
    Raises:
        HTTPException: If tool not found or user doesn't own it
    """
    tool_service = ToolService(db)
    
    try:
        await tool_service.delete_tool(tool_id, current_user.id)
    except ToolNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except ToolOwnershipError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )
    except Exception:
        logger.exception("Unexpected error in delete_tool")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Tool deletion failed"
        )