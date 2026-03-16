"""Tool-related Pydantic schemas."""

from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field


# Request Schemas
class ToolCreateRequest(BaseModel):
    """Schema for creating a new tool."""
    title: str = Field(..., min_length=3, max_length=200, description="Tool title")
    description: str = Field(..., min_length=10, max_length=2000, description="Detailed description")
    category_id: int = Field(..., gt=0, description="Tool category ID")
    brand: Optional[str] = Field(None, max_length=100)
    model: Optional[str] = Field(None, max_length=100)
    condition: str = Field(..., pattern="^(excellent|good|fair|poor)$")
    max_loan_days: int = Field(..., ge=1, le=90, description="Maximum loan period in days")
    deposit_amount: Decimal = Field(..., ge=0, max_digits=10, decimal_places=2)
    daily_rate: Decimal = Field(..., ge=0, max_digits=10, decimal_places=2)
    pickup_address: Optional[str] = Field(None, max_length=500)
    pickup_city: Optional[str] = Field(None, max_length=100)
    pickup_postal_code: Optional[str] = Field(None, max_length=20)
    pickup_latitude: Optional[Decimal] = Field(None, ge=-90, le=90)
    pickup_longitude: Optional[Decimal] = Field(None, ge=-180, le=180)
    delivery_available: bool = Field(default=False)
    delivery_radius_km: int = Field(default=0, ge=0, le=50)
    usage_instructions: Optional[str] = Field(None, max_length=2000)
    safety_notes: Optional[str] = Field(None, max_length=2000)


class ToolUpdateRequest(BaseModel):
    """Schema for updating an existing tool."""
    title: Optional[str] = Field(None, min_length=3, max_length=200)
    description: Optional[str] = Field(None, min_length=10, max_length=2000)
    category_id: Optional[int] = Field(None, gt=0)
    brand: Optional[str] = Field(None, max_length=100)
    model: Optional[str] = Field(None, max_length=100)
    condition: Optional[str] = Field(None, pattern="^(excellent|good|fair|poor)$")
    is_available: Optional[bool] = None
    max_loan_days: Optional[int] = Field(None, ge=1, le=90)
    deposit_amount: Optional[Decimal] = Field(None, ge=0, max_digits=10, decimal_places=2)
    daily_rate: Optional[Decimal] = Field(None, ge=0, max_digits=10, decimal_places=2)
    pickup_address: Optional[str] = Field(None, max_length=500)
    pickup_city: Optional[str] = Field(None, max_length=100)
    pickup_postal_code: Optional[str] = Field(None, max_length=20)
    pickup_latitude: Optional[Decimal] = Field(None, ge=-90, le=90)
    pickup_longitude: Optional[Decimal] = Field(None, ge=-180, le=180)
    delivery_available: Optional[bool] = None
    delivery_radius_km: Optional[int] = Field(None, ge=0, le=50)
    usage_instructions: Optional[str] = Field(None, max_length=2000)
    safety_notes: Optional[str] = Field(None, max_length=2000)


# Search & Filter Schemas
class ToolSearchFilters(BaseModel):
    """Schema for tool search filters."""
    query: Optional[str] = Field(None, max_length=200, description="Search in title/description")
    category_ids: Optional[List[int]] = Field(None, description="Filter by category IDs")
    condition: Optional[List[str]] = Field(None, description="Filter by condition")
    min_daily_rate: Optional[Decimal] = Field(None, ge=0)
    max_daily_rate: Optional[Decimal] = Field(None, ge=0)
    max_deposit: Optional[Decimal] = Field(None, ge=0)
    available_only: bool = Field(default=True, description="Show only available tools")
    delivery_available: Optional[bool] = None
    min_rating: Optional[Decimal] = Field(None, ge=1, le=5)
    
    # Location-based filters
    latitude: Optional[Decimal] = Field(None, ge=-90, le=90)
    longitude: Optional[Decimal] = Field(None, ge=-180, le=180)
    max_distance_km: Optional[int] = Field(None, ge=1, le=100)
    postal_codes: Optional[List[str]] = Field(None, description="Filter by postal codes")
    cities: Optional[List[str]] = Field(None, description="Filter by cities")


class ToolSearchRequest(BaseModel):
    """Schema for tool search request."""
    filters: ToolSearchFilters = Field(default_factory=ToolSearchFilters)
    sort_by: str = Field(default="created_at", pattern="^(created_at|daily_rate|rating|title)$")
    sort_order: str = Field(default="desc", pattern="^(asc|desc)$")
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)


# Response Schemas
class ToolPhotoResponse(BaseModel):
    """Schema for tool photo response."""
    id: UUID
    original_url: str
    thumbnail_url: Optional[str]
    medium_url: Optional[str]
    large_url: Optional[str]
    display_order: int
    is_primary: bool

    class Config:
        from_attributes = True


class ToolCategoryResponse(BaseModel):
    """Schema for tool category response."""
    id: int
    name: str
    slug: str
    description: Optional[str]
    icon_name: Optional[str]

    class Config:
        from_attributes = True


class ToolCategoryWithCountResponse(BaseModel):
    """Schema for tool category with tool count."""
    id: int
    name: str
    slug: str
    description: Optional[str]
    icon_name: Optional[str]
    tool_count: int

    class Config:
        from_attributes = True


class ToolOwnerResponse(BaseModel):
    """Schema for tool owner response."""
    id: UUID
    display_name: str
    first_name: Optional[str]
    last_name: Optional[str]
    avatar_url: Optional[str]
    average_rating: Optional[Decimal]
    total_ratings: int
    is_verified: bool

    class Config:
        from_attributes = True


class ToolResponse(BaseModel):
    """Schema for detailed tool response."""
    id: UUID
    title: str
    description: str
    category: ToolCategoryResponse
    brand: Optional[str]
    model: Optional[str]
    condition: str
    is_available: bool
    max_loan_days: int
    deposit_amount: Decimal
    daily_rate: Decimal
    pickup_address: Optional[str]
    pickup_city: Optional[str]
    pickup_postal_code: Optional[str]
    pickup_latitude: Optional[Decimal]
    pickup_longitude: Optional[Decimal]
    delivery_available: bool
    delivery_radius_km: int
    usage_instructions: Optional[str]
    safety_notes: Optional[str]
    last_maintenance_date: Optional[date]
    next_maintenance_due: Optional[date]
    total_bookings: int
    average_rating: Optional[Decimal]
    total_ratings: int
    photos: List[ToolPhotoResponse]
    owner: ToolOwnerResponse
    created_at: datetime
    updated_at: datetime
    
    # Distance field for location-based searches
    distance_km: Optional[float] = Field(None, description="Distance from search origin in km")

    class Config:
        from_attributes = True


class ToolListResponse(BaseModel):
    """Schema for tool list response (summary view)."""
    id: UUID
    title: str
    description: str
    category: ToolCategoryResponse
    condition: str
    is_available: bool
    daily_rate: Decimal
    pickup_city: Optional[str]
    pickup_postal_code: Optional[str]
    pickup_latitude: Optional[Decimal] = None
    pickup_longitude: Optional[Decimal] = None
    delivery_available: bool
    average_rating: Optional[Decimal]
    total_ratings: int
    primary_photo: Optional[ToolPhotoResponse]
    owner: ToolOwnerResponse
    distance_km: Optional[float] = None

    class Config:
        from_attributes = True


# Paginated Response
class PaginatedToolResponse(BaseModel):
    """Schema for paginated tool response."""
    items: List[ToolListResponse]
    total: int
    page: int
    page_size: int
    total_pages: int
    has_next: bool
    has_previous: bool