"""Booking-related Pydantic schemas."""

from datetime import date, datetime
from decimal import Decimal
from typing import Optional, Literal, List
from uuid import UUID
import re

from pydantic import BaseModel, Field, field_validator, model_validator

from wippestoolen.app.schemas.auth import UserPublicResponse
from wippestoolen.app.schemas.tool import ToolResponse


# Simple schemas for booking responses
class UserBasic(BaseModel):
    """Basic user info for booking responses."""
    id: UUID
    username: str = Field(alias="display_name")
    full_name: Optional[str] = None
    rating: float = Field(alias="average_rating")
    phone: Optional[str] = Field(alias="phone_number", default=None)
    
    class Config:
        from_attributes = True
        populate_by_name = True


class ToolBasic(BaseModel):
    """Basic tool info for booking responses."""
    id: UUID
    title: str
    category: str
    daily_rate: Decimal
    owner: UserBasic
    
    class Config:
        from_attributes = True


class BookingCreateSchema(BaseModel):
    """Schema for creating a new booking request."""
    
    tool_id: UUID
    requested_start_date: date
    requested_end_date: date
    borrower_message: Optional[str] = Field(None, max_length=1000)
    pickup_method: Literal['pickup', 'delivery'] = 'pickup'
    pickup_address: Optional[str] = Field(None, max_length=500)
    
    @field_validator('requested_start_date')
    @classmethod
    def validate_start_date(cls, v):
        """Validate start date constraints."""
        from datetime import timedelta
        
        today = date.today()
        
        if v < today:
            raise ValueError('Start date cannot be in the past')
        
        if v > today + timedelta(days=365):
            raise ValueError('Start date cannot be more than 1 year in advance')
        
        return v
    
    @field_validator('requested_end_date')
    @classmethod
    def validate_end_date(cls, v, info):
        """Validate end date constraints."""
        if 'requested_start_date' in info.data:
            start_date = info.data['requested_start_date']
            
            if v < start_date:
                raise ValueError('End date must be after start date')
            
            # Maximum booking duration
            from datetime import timedelta
            max_duration = timedelta(days=30)
            if (v - start_date) > max_duration:
                raise ValueError('Booking period cannot exceed 30 days')
            
            # Minimum booking duration
            min_duration = timedelta(days=1)
            if (v - start_date) < min_duration:
                raise ValueError('Minimum booking period is 1 day')
        
        return v
    
    @field_validator('borrower_message')
    @classmethod
    def validate_message(cls, v):
        """Sanitize and validate borrower message."""
        if not v:
            return v
        
        # Remove potentially harmful content
        v = re.sub(r'<[^>]*>', '', v)  # Remove HTML tags
        v = re.sub(r'javascript:', '', v, flags=re.IGNORECASE)  # Remove JS
        v = v.strip()
        
        # Check for spam patterns
        spam_patterns = [
            r'http[s]?://',  # URLs
            r'www\.',        # Web addresses
            r'@\w+\.',       # Email patterns
            r'\b(?:call|text|whatsapp)\b.*\d{3}.*\d{3}.*\d{4}',  # Phone numbers
        ]
        
        for pattern in spam_patterns:
            if re.search(pattern, v, re.IGNORECASE):
                raise ValueError('Message contains prohibited content')
        
        return v
    
    @field_validator('pickup_address')
    @classmethod
    def validate_pickup_address(cls, v, info):
        """Validate pickup address for delivery method."""
        pickup_method = info.data.get('pickup_method')
        
        if pickup_method == 'delivery':
            if not v or len(v.strip()) < 10:
                raise ValueError('Valid pickup address required for delivery')
            
            # Sanitize address
            v = re.sub(r'<[^>]*>', '', v)  # Remove HTML
            v = v.strip()
        
        return v


class BookingStatusUpdateSchema(BaseModel):
    """Schema for updating booking status."""
    
    status: Literal['confirmed', 'declined', 'active', 'returned', 'completed', 'cancelled']
    owner_response: Optional[str] = Field(None, max_length=500)
    pickup_notes: Optional[str] = Field(None, max_length=500)
    return_notes: Optional[str] = Field(None, max_length=500)
    cancellation_reason: Optional[str] = Field(None, max_length=500)
    
    @field_validator('owner_response', 'pickup_notes', 'return_notes', 'cancellation_reason')
    @classmethod
    def sanitize_text_fields(cls, v):
        """Sanitize all text input fields."""
        if not v:
            return v
        
        # Remove HTML and potentially harmful content
        v = re.sub(r'<[^>]*>', '', v)
        v = re.sub(r'javascript:', '', v, flags=re.IGNORECASE)
        v = v.strip()
        
        return v


class BookingCostCalculation(BaseModel):
    """Schema for booking cost calculation."""
    
    daily_rate: Decimal
    num_days: int
    base_cost: Decimal
    deposit_amount: Decimal
    delivery_fee: Decimal
    total_amount: Decimal


class BookingResponse(BaseModel):
    """Schema for booking response data."""
    
    id: UUID
    tool: ToolBasic
    borrower: UserBasic
    tool_owner: Optional[UserBasic] = None
    requested_start_date: date
    requested_end_date: date
    actual_start_date: Optional[date] = None
    actual_end_date: Optional[date] = None
    status: str
    borrower_message: Optional[str] = None
    owner_response: Optional[str] = None
    pickup_notes: Optional[str] = None
    return_notes: Optional[str] = None
    deposit_amount: Decimal
    daily_rate: Decimal
    total_amount: Decimal
    deposit_paid: bool
    deposit_returned: bool
    pickup_method: str
    pickup_address: Optional[str] = None
    delivery_fee: Decimal
    cancellation_reason: Optional[str] = None
    cancelled_at: Optional[datetime] = None
    confirmed_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class BookingSummary(BaseModel):
    """Schema for booking summary in lists."""
    
    id: UUID
    tool: ToolBasic
    borrower: UserBasic
    requested_start_date: date
    requested_end_date: date
    status: str
    total_amount: Decimal
    created_at: datetime
    
    class Config:
        from_attributes = True


class BookingFilters(BaseModel):
    """Schema for booking filters and pagination."""
    
    role: Optional[Literal['borrower', 'owner']] = None
    status: Optional[str] = None
    page: int = Field(default=1, ge=1)
    size: int = Field(default=20, ge=1, le=100)
    sort: Literal['created_at', 'start_date', 'updated_at'] = 'created_at'
    order: Literal['asc', 'desc'] = 'desc'


class PaginatedBookingResponse(BaseModel):
    """Schema for paginated booking responses."""
    
    bookings: List[BookingSummary]
    pagination: dict
    
    @classmethod
    def create(
        cls, 
        bookings: List[BookingSummary], 
        page: int, 
        size: int, 
        total: int
    ) -> "PaginatedBookingResponse":
        """Create paginated response."""
        return cls(
            bookings=bookings,
            pagination={
                "page": page,
                "size": size,
                "total": total,
                "pages": (total + size - 1) // size
            }
        )


class AvailabilityCalendarDay(BaseModel):
    """Schema for a single day in availability calendar."""
    
    date: date
    available: bool
    booking_id: Optional[UUID] = None


class AvailabilityResult(BaseModel):
    """Schema for tool availability check result."""
    
    tool_id: UUID
    is_available: bool
    conflicting_bookings: List[UUID] = []
    next_available_date: Optional[date] = None
    calendar: List[AvailabilityCalendarDay] = []


class BookingCalendarDay(BaseModel):
    """Schema for a single day in booking calendar."""
    
    date: date
    bookings: List[dict]  # Contains booking summary with role info


class BookingCalendarResponse(BaseModel):
    """Schema for booking calendar response."""
    
    calendar: List[BookingCalendarDay]


class BookingStatusHistorySchema(BaseModel):
    """Schema for booking status history."""
    
    id: UUID
    from_status: Optional[str]
    to_status: str
    changed_by: UserBasic
    reason: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


class DetailedBookingResponse(BookingResponse):
    """Extended booking response with additional details."""
    
    status_history: List[BookingStatusHistorySchema] = []
    can_confirm: bool = False
    can_decline: bool = False
    can_cancel: bool = False
    can_pickup: bool = False
    can_return: bool = False
    
    @model_validator(mode='after')
    def set_permissions(self):
        """Set permission flags based on status and user role."""
        # This will be set by the service layer based on current user
        return self


# Response schemas for specific endpoints
class BookingCreatedResponse(BaseModel):
    """Response schema for successful booking creation."""
    
    booking: BookingResponse
    message: str = "Booking request created successfully"


class BookingUpdatedResponse(BaseModel):
    """Response schema for successful booking update."""
    
    booking: BookingResponse
    message: str = "Booking updated successfully"


class BookingConflictResponse(BaseModel):
    """Response schema for booking conflicts."""
    
    error: str = "Booking conflict"
    details: dict
    suggested_dates: List[date] = []


# Input validation schemas
class DateRangeSchema(BaseModel):
    """Schema for date range validation."""
    
    start_date: date
    end_date: date
    
    @field_validator('end_date')
    @classmethod
    def validate_date_range(cls, v, info):
        """Ensure end date is after start date."""
        if 'start_date' in info.data and v < info.data['start_date']:
            raise ValueError('End date must be after start date')
        return v


class BookingSearchSchema(BaseModel):
    """Schema for booking search parameters."""
    
    tool_title: Optional[str] = None
    borrower_username: Optional[str] = None
    status: Optional[str] = None
    date_from: Optional[date] = None
    date_to: Optional[date] = None
    min_amount: Optional[Decimal] = None
    max_amount: Optional[Decimal] = None