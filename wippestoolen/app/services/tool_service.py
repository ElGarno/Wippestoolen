"""Tool service layer."""

import math
from datetime import datetime
from decimal import Decimal
from typing import List, Optional, Tuple
from uuid import UUID

from sqlalchemy import and_, desc, func, or_, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

from wippestoolen.app.models.tool import Tool, ToolCategory, ToolPhoto
from wippestoolen.app.models.user import User
from wippestoolen.app.schemas.tool import (
    PaginatedToolResponse,
    ToolCreateRequest,
    ToolListResponse,
    ToolResponse,
    ToolSearchRequest,
    ToolUpdateRequest,
)


class ToolNotFoundError(Exception):
    """Tool not found error."""
    pass


class ToolOwnershipError(Exception):
    """Tool ownership error."""
    pass


class ToolCategoryNotFoundError(Exception):
    """Tool category not found error."""
    pass


class ToolService:
    """Tool service for business logic."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def create_tool(self, user_id: UUID, tool_data: ToolCreateRequest) -> Tool:
        """Create a new tool listing."""
        # Check if category exists and is active
        category_query = await self.db.execute(
            text("SELECT id FROM tool_categories WHERE id = :category_id AND is_active = true"),
            {"category_id": tool_data.category_id}
        )
        category = category_query.fetchone()
        
        if not category:
            raise ToolCategoryNotFoundError("Tool category not found or inactive")
        
        # Create tool instance
        tool = Tool(
            owner_id=user_id,
            category_id=tool_data.category_id,
            title=tool_data.title,
            description=tool_data.description,
            brand=tool_data.brand,
            model=tool_data.model,
            condition=tool_data.condition,
            is_available=True,
            max_loan_days=tool_data.max_loan_days,
            deposit_amount=tool_data.deposit_amount,
            daily_rate=tool_data.daily_rate,
            pickup_address=tool_data.pickup_address,
            pickup_city=tool_data.pickup_city,
            pickup_postal_code=tool_data.pickup_postal_code,
            pickup_latitude=tool_data.pickup_latitude,
            pickup_longitude=tool_data.pickup_longitude,
            delivery_available=tool_data.delivery_available,
            delivery_radius_km=tool_data.delivery_radius_km,
            usage_instructions=tool_data.usage_instructions,
            safety_notes=tool_data.safety_notes,
            is_active=True,
            total_bookings=0,
            average_rating=Decimal("0.00"),
            total_ratings=0,
        )
        
        self.db.add(tool)
        await self.db.commit()
        await self.db.refresh(tool)
        
        return tool
    
    async def get_tool_by_id(self, tool_id: UUID) -> Optional[Tool]:
        """Get tool by ID with all relationships loaded."""
        result = await self.db.execute(
            text("""
                SELECT t.id, t.owner_id, t.category_id, t.title, t.description, 
                       t.brand, t.model, t.condition, t.is_available, t.max_loan_days,
                       t.deposit_amount, t.daily_rate, t.pickup_address, t.pickup_city,
                       t.pickup_postal_code, t.pickup_latitude, t.pickup_longitude,
                       t.delivery_available, t.delivery_radius_km, t.usage_instructions,
                       t.safety_notes, t.last_maintenance_date, t.next_maintenance_due,
                       t.total_bookings, t.average_rating, t.total_ratings, 
                       t.is_active, t.created_at, t.updated_at, t.deleted_at,
                       COALESCE(tp.photo_data, '[]'::json) as photos
                FROM tools t
                LEFT JOIN (
                    SELECT tool_id, 
                           json_agg(
                               json_build_object(
                                   'id', id,
                                   'original_url', original_url,
                                   'thumbnail_url', thumbnail_url,
                                   'medium_url', medium_url,
                                   'large_url', large_url,
                                   'display_order', display_order,
                                   'is_primary', is_primary
                               ) ORDER BY display_order, created_at
                           ) as photo_data
                    FROM tool_photos 
                    WHERE is_active = true
                    GROUP BY tool_id
                ) tp ON t.id = tp.tool_id
                WHERE t.id = :tool_id AND t.is_active = true AND t.deleted_at IS NULL
            """),
            {"tool_id": tool_id}
        )
        
        row = result.fetchone()
        if not row:
            return None
            
        # Manually construct the tool object with explicit column mapping
        tool = Tool(
            id=row[0],
            owner_id=row[1],
            category_id=row[2],
            title=row[3],
            description=row[4],
            brand=row[5],
            model=row[6],
            condition=row[7],
            is_available=row[8],
            max_loan_days=row[9],
            deposit_amount=row[10],
            daily_rate=row[11],
            pickup_address=row[12],
            pickup_city=row[13],
            pickup_postal_code=row[14],
            pickup_latitude=row[15],
            pickup_longitude=row[16],
            delivery_available=row[17],
            delivery_radius_km=row[18],
            usage_instructions=row[19],
            safety_notes=row[20],
            last_maintenance_date=row[21],
            next_maintenance_due=row[22],
            total_bookings=row[23],
            average_rating=row[24],
            total_ratings=row[25],
            is_active=row[26],
            created_at=row[27],
            updated_at=row[28],
            deleted_at=row[29],
        )
        
        return tool
    
    async def browse_tools(
        self,
        page: int = 1,
        page_size: int = 20,
        sort_by: str = "created_at",
        sort_order: str = "desc",
        search: Optional[str] = None,
        category: Optional[str] = None,
        available: Optional[bool] = None
    ) -> PaginatedToolResponse:
        """Browse all available tools with pagination."""

        # Build order clause
        order_clause = f"t.{sort_by} {sort_order.upper()}"

        # Build WHERE conditions
        where_conditions = ["t.is_active = true", "t.deleted_at IS NULL", "t.is_available = true"]
        params = {}

        if search:
            where_conditions.append("(t.title ILIKE :search OR t.description ILIKE :search)")
            params["search"] = f"%{search}%"

        if category:
            where_conditions.append("tc.slug = :category")
            params["category"] = category

        if available is not None:
            where_conditions.append("t.is_available = :available")
            params["available"] = available
        
        where_clause = " AND ".join(where_conditions)
        
        # Get total count
        count_query = f"""
            SELECT COUNT(*) 
            FROM tools t 
            JOIN tool_categories tc ON t.category_id = tc.id
            WHERE {where_clause}
        """
        count_result = await self.db.execute(text(count_query), params)
        total = count_result.scalar()
        
        # Calculate pagination
        offset = (page - 1) * page_size
        total_pages = math.ceil(total / page_size)
        
        # Get tools with pagination
        main_query = f"""
            SELECT t.id, t.title, t.description, t.condition, t.is_available, t.daily_rate, 
                   t.pickup_city, t.pickup_postal_code, t.delivery_available,
                   t.average_rating, t.total_ratings,
                   tc.id as cat_id, tc.name as cat_name, tc.slug as cat_slug, 
                   tc.description as cat_desc, tc.icon_name as cat_icon,
                   u.id as owner_id, u.display_name, u.first_name, u.last_name,
                   u.avatar_url, u.average_rating as owner_rating, u.total_ratings as owner_ratings, u.is_verified,
                   tp.photo_id, tp.original_url, tp.thumbnail_url, tp.medium_url, tp.large_url, tp.display_order, tp.is_primary
            FROM tools t
            JOIN tool_categories tc ON t.category_id = tc.id
            JOIN users u ON t.owner_id = u.id
            LEFT JOIN (
                SELECT DISTINCT ON (tool_id) tool_id, id as photo_id, original_url, thumbnail_url, medium_url, large_url, display_order, is_primary
                FROM tool_photos 
                WHERE is_active = true AND is_primary = true
                ORDER BY tool_id, is_primary DESC, display_order ASC
            ) tp ON t.id = tp.tool_id
            WHERE {where_clause}
            ORDER BY {order_clause}
            LIMIT :limit OFFSET :offset
        """
        
        # Add pagination params
        params.update({"limit": page_size, "offset": offset})
        
        result = await self.db.execute(text(main_query), params)
        
        tools = []
        for row in result:
            # Build the tool list response
            tool_data = {
                "id": row[0],
                "title": row[1],
                "description": row[2],
                "category": {
                    "id": row[11],
                    "name": row[12],
                    "slug": row[13],
                    "description": row[14],
                    "icon_name": row[15]
                },
                "condition": row[3],
                "is_available": row[4],
                "daily_rate": row[5],
                "pickup_city": row[6],
                "pickup_postal_code": row[7],
                "delivery_available": row[8],
                "average_rating": row[9],
                "total_ratings": row[10],
                "owner": {
                    "id": row[16],
                    "display_name": row[17],
                    "first_name": row[18],
                    "last_name": row[19],
                    "avatar_url": row[20],
                    "average_rating": row[21],
                    "total_ratings": row[22],
                    "is_verified": row[23]
                },
                "primary_photo": {
                    "id": row[24],
                    "original_url": row[25],
                    "thumbnail_url": row[26],
                    "medium_url": row[27],
                    "large_url": row[28],
                    "display_order": row[29],
                    "is_primary": row[30]
                } if row[24] else None
            }
            tools.append(ToolListResponse(**tool_data))
        
        return PaginatedToolResponse(
            items=tools,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
            has_next=page < total_pages,
            has_previous=page > 1
        )
    
    async def get_user_tools(
        self, 
        user_id: UUID, 
        status: str = "active", 
        page: int = 1, 
        page_size: int = 20
    ) -> PaginatedToolResponse:
        """Get tools owned by a specific user."""
        
        # Build status filter
        status_filter = ""
        if status == "active":
            status_filter = "AND t.is_active = true AND t.deleted_at IS NULL"
        elif status == "inactive":
            status_filter = "AND (t.is_active = false OR t.deleted_at IS NOT NULL)"
        # "all" means no additional filter
        
        # Get total count
        count_result = await self.db.execute(
            text(f"""
                SELECT COUNT(*) 
                FROM tools t 
                WHERE t.owner_id = :user_id {status_filter}
            """),
            {"user_id": user_id}
        )
        total = count_result.scalar()
        
        # Calculate pagination
        offset = (page - 1) * page_size
        total_pages = math.ceil(total / page_size)
        
        # Get tools
        result = await self.db.execute(
            text(f"""
                SELECT t.id, t.title, t.description, t.condition, t.is_available, t.daily_rate,
                       t.pickup_city, t.pickup_postal_code, t.delivery_available,
                       t.average_rating, t.total_ratings,
                       tc.id as cat_id, tc.name as cat_name, tc.slug as cat_slug,
                       tc.description as cat_desc, tc.icon_name as cat_icon,
                       u.id as owner_id, u.display_name, u.first_name, u.last_name,
                       u.avatar_url, u.average_rating as owner_rating, u.total_ratings as owner_ratings, u.is_verified,
                       tp.photo_id, tp.original_url, tp.thumbnail_url, tp.medium_url, tp.large_url, tp.display_order, tp.is_primary
                FROM tools t
                LEFT JOIN tool_categories tc ON t.category_id = tc.id
                JOIN users u ON t.owner_id = u.id
                LEFT JOIN (
                    SELECT DISTINCT ON (tool_id) tool_id, id as photo_id, original_url, thumbnail_url, medium_url, large_url, display_order, is_primary
                    FROM tool_photos
                    WHERE is_primary = true
                    ORDER BY tool_id, is_primary DESC, display_order ASC
                ) tp ON t.id = tp.tool_id
                WHERE t.owner_id = :user_id {status_filter}
                ORDER BY t.created_at DESC
                LIMIT :limit OFFSET :offset
            """),
            {"user_id": user_id, "limit": page_size, "offset": offset}
        )

        tools = []
        for row in result:
            tool_data = {
                "id": row[0],
                "title": row[1],
                "description": row[2],
                "category": {
                    "id": row[11] if row[11] else 0,
                    "name": row[12] if row[12] else "Unbekannt",
                    "slug": row[13] if row[13] else "unknown",
                    "description": row[14] if row[14] else None,
                    "icon_name": row[15] if row[15] else None
                },
                "condition": row[3],
                "is_available": row[4],
                "daily_rate": row[5],
                "pickup_city": row[6],
                "pickup_postal_code": row[7],
                "delivery_available": row[8],
                "average_rating": row[9],
                "total_ratings": row[10],
                "owner": {
                    "id": row[16],
                    "display_name": row[17],
                    "first_name": row[18],
                    "last_name": row[19],
                    "avatar_url": row[20],
                    "average_rating": row[21],
                    "total_ratings": row[22],
                    "is_verified": row[23]
                },
                "primary_photo": {
                    "id": row[24],
                    "original_url": row[25],
                    "thumbnail_url": row[26],
                    "medium_url": row[27],
                    "large_url": row[28],
                    "display_order": row[29],
                    "is_primary": row[30]
                } if row[24] else None
            }
            tools.append(ToolListResponse(**tool_data))
        
        return PaginatedToolResponse(
            items=tools,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
            has_next=page < total_pages,
            has_previous=page > 1
        )
    
    async def update_tool(
        self, 
        tool_id: UUID, 
        user_id: UUID, 
        update_data: ToolUpdateRequest
    ) -> Tool:
        """Update tool information."""
        # Check if tool exists and user owns it
        result = await self.db.execute(
            text("""
                SELECT id, owner_id FROM tools 
                WHERE id = :tool_id AND is_active = true AND deleted_at IS NULL
            """),
            {"tool_id": tool_id}
        )
        tool_row = result.fetchone()
        
        if not tool_row:
            raise ToolNotFoundError("Tool not found")
        
        if tool_row[1] != user_id:
            raise ToolOwnershipError("You can only modify your own tools")
        
        # Build update query dynamically
        update_fields = []
        params = {"tool_id": tool_id}
        
        update_dict = update_data.model_dump(exclude_unset=True)
        for field, value in update_dict.items():
            update_fields.append(f"{field} = :{field}")
            params[field] = value
        
        if update_fields:
            update_fields.append("updated_at = :updated_at")
            params["updated_at"] = datetime.utcnow()
            
            await self.db.execute(
                text(f"""
                    UPDATE tools 
                    SET {', '.join(update_fields)}
                    WHERE id = :tool_id
                """),
                params
            )
            await self.db.commit()
        
        # Return updated tool
        return await self.get_tool_by_id(tool_id)
    
    async def delete_tool(self, tool_id: UUID, user_id: UUID) -> bool:
        """Soft delete a tool."""
        # Check if tool exists and user owns it
        result = await self.db.execute(
            text("""
                SELECT id, owner_id FROM tools 
                WHERE id = :tool_id AND is_active = true AND deleted_at IS NULL
            """),
            {"tool_id": tool_id}
        )
        tool_row = result.fetchone()
        
        if not tool_row:
            raise ToolNotFoundError("Tool not found")
        
        if tool_row[1] != user_id:
            raise ToolOwnershipError("You can only delete your own tools")
        
        # TODO: Check for active bookings when booking system is implemented
        
        # Soft delete
        await self.db.execute(
            text("""
                UPDATE tools 
                SET is_active = false, deleted_at = :deleted_at 
                WHERE id = :tool_id
            """),
            {"tool_id": tool_id, "deleted_at": datetime.utcnow()}
        )
        await self.db.commit()
        
        return True
    
    async def get_category_by_id(self, category_id: int) -> Optional[dict]:
        """Get category details by ID."""
        result = await self.db.execute(
            text("""
                SELECT id, name, slug, description, icon_name
                FROM tool_categories
                WHERE id = :category_id AND is_active = true
            """),
            {"category_id": category_id}
        )
        row = result.fetchone()
        if row:
            return {
                "id": row[0],
                "name": row[1],
                "slug": row[2],
                "description": row[3],
                "icon_name": row[4]
            }
        return None
    
    async def get_owner_by_id(self, owner_id: UUID) -> Optional[dict]:
        """Get owner details by ID."""
        result = await self.db.execute(
            text("""
                SELECT id, display_name, first_name, last_name, 
                       avatar_url, average_rating, total_ratings, is_verified
                FROM users
                WHERE id = :owner_id AND is_active = true
            """),
            {"owner_id": owner_id}
        )
        row = result.fetchone()
        if row:
            return {
                "id": row[0],
                "display_name": row[1],
                "first_name": row[2],
                "last_name": row[3],
                "avatar_url": row[4],
                "average_rating": row[5],
                "total_ratings": row[6],
                "is_verified": row[7]
            }
        return None
    
    async def get_categories_with_counts(self, active_only: bool = True) -> List[dict]:
        """Get tool categories with tool counts."""
        active_filter = "AND tc.is_active = true" if active_only else ""
        
        result = await self.db.execute(
            text(f"""
                SELECT tc.id, tc.name, tc.slug, tc.description, tc.icon_name,
                       COUNT(t.id) as tool_count
                FROM tool_categories tc
                LEFT JOIN tools t ON tc.id = t.category_id 
                    AND t.is_active = true 
                    AND t.deleted_at IS NULL 
                    AND t.is_available = true
                WHERE 1=1 {active_filter}
                GROUP BY tc.id, tc.name, tc.slug, tc.description, tc.icon_name
                ORDER BY tc.sort_order, tc.name
            """)
        )
        
        categories = []
        for row in result:
            categories.append({
                "id": row[0],
                "name": row[1],
                "slug": row[2],
                "description": row[3],
                "icon_name": row[4],
                "tool_count": row[5]
            })
        
        return categories
    
    async def get_tools_by_category(
        self, 
        category_id: int, 
        page: int = 1, 
        page_size: int = 20,
        sort_by: str = "created_at",
        sort_order: str = "desc"
    ) -> PaginatedToolResponse:
        """Get tools in a specific category."""
        
        # Build order clause
        order_clause = f"t.{sort_by} {sort_order.upper()}"
        
        # Get total count
        count_result = await self.db.execute(
            text("""
                SELECT COUNT(*) 
                FROM tools t 
                WHERE t.category_id = :category_id 
                AND t.is_active = true 
                AND t.deleted_at IS NULL 
                AND t.is_available = true
            """),
            {"category_id": category_id}
        )
        total = count_result.scalar()
        
        # Calculate pagination
        offset = (page - 1) * page_size
        total_pages = math.ceil(total / page_size)
        
        # Get tools
        result = await self.db.execute(
            text(f"""
                SELECT t.id, t.title, t.condition, t.is_available, t.daily_rate, 
                       t.pickup_city, t.pickup_postal_code, t.delivery_available,
                       t.average_rating, t.total_ratings,
                       tc.id as cat_id, tc.name as cat_name, tc.slug as cat_slug, 
                       tc.description as cat_desc, tc.icon_name as cat_icon,
                       u.id as owner_id, u.display_name, u.first_name, u.last_name,
                       u.avatar_url, u.average_rating as owner_rating, u.total_ratings as owner_ratings, u.is_verified,
                       tp.photo_id, tp.original_url, tp.thumbnail_url, tp.medium_url, tp.large_url, tp.display_order, tp.is_primary
                FROM tools t
                LEFT JOIN tool_categories tc ON t.category_id = tc.id
                JOIN users u ON t.owner_id = u.id
                LEFT JOIN (
                    SELECT DISTINCT ON (tool_id) tool_id, id as photo_id, original_url, thumbnail_url, medium_url, large_url, display_order, is_primary
                    FROM tool_photos 
                    WHERE is_active = true AND is_primary = true
                    ORDER BY tool_id, is_primary DESC, display_order ASC
                ) tp ON t.id = tp.tool_id
                WHERE t.category_id = :category_id 
                AND t.is_active = true AND t.deleted_at IS NULL AND t.is_available = true
                ORDER BY {order_clause}
                LIMIT :limit OFFSET :offset
            """),
            {"category_id": category_id, "limit": page_size, "offset": offset}
        )
        
        tools = []
        for row in result:
            tool_data = {
                "id": row[0],
                "title": row[1],
                "category": {
                    "id": row[10] if row[10] else 0,
                    "name": row[11] if row[11] else "Unbekannt",
                    "slug": row[12] if row[12] else "unknown",
                    "description": row[13] if row[13] else None,
                    "icon_name": row[14] if row[14] else None
                },
                "condition": row[2],
                "is_available": row[3],
                "daily_rate": row[4],
                "pickup_city": row[5],
                "pickup_postal_code": row[6],
                "delivery_available": row[7],
                "average_rating": row[8],
                "total_ratings": row[9],
                "owner": {
                    "id": row[15],
                    "display_name": row[16],
                    "first_name": row[17],
                    "last_name": row[18],
                    "avatar_url": row[19],
                    "average_rating": row[20],
                    "total_ratings": row[21],
                    "is_verified": row[22]
                },
                "primary_photo": {
                    "id": row[23],
                    "original_url": row[24],
                    "thumbnail_url": row[25],
                    "medium_url": row[26],
                    "large_url": row[27],
                    "display_order": row[28],
                    "is_primary": row[29]
                } if row[23] else None
            }
            tools.append(ToolListResponse(**tool_data))
        
        return PaginatedToolResponse(
            items=tools,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
            has_next=page < total_pages,
            has_previous=page > 1
        )