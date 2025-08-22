"""
Review-related Pydantic schemas for request/response serialization.
"""

from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Optional, List
from uuid import UUID

from pydantic import BaseModel, Field, validator


class ReviewType(str, Enum):
    """Review type enumeration."""
    BORROWER_TO_OWNER = "borrower_to_owner"
    OWNER_TO_BORROWER = "owner_to_borrower"


class FlagReason(str, Enum):
    """Flag reason enumeration."""
    INAPPROPRIATE_CONTENT = "inappropriate_content"
    SPAM = "spam"
    HARASSMENT = "harassment"
    FALSE_INFORMATION = "false_information"
    OTHER = "other"


# Request Schemas

class ReviewCreateRequest(BaseModel):
    """Schema for creating a new review."""
    booking_id: UUID = Field(..., description="ID of the completed booking")
    rating: int = Field(..., ge=1, le=5, description="Overall rating (1-5 stars)")
    title: Optional[str] = Field(None, max_length=100, description="Review title/summary")
    comment: Optional[str] = Field(None, max_length=1000, description="Review comment")
    tool_condition_rating: Optional[int] = Field(None, ge=1, le=5, description="Tool condition rating (borrower reviews only)")

    @validator('title', 'comment')
    def sanitize_text(cls, v):
        """Sanitize text input."""
        if not v:
            return v
        
        # Remove HTML tags and potentially harmful content
        import re
        v = re.sub(r'<[^>]*>', '', v)
        v = re.sub(r'javascript:', '', v, flags=re.IGNORECASE)
        v = v.strip()
        
        # Check for spam patterns
        spam_patterns = [
            r'http[s]?://',  # URLs
            r'www\.',        # Web addresses
            r'@\w+\.',       # Email patterns
        ]
        
        for pattern in spam_patterns:
            if re.search(pattern, v, re.IGNORECASE):
                raise ValueError('Review contains prohibited content')
        
        return v


class ReviewUpdateRequest(BaseModel):
    """Schema for updating a review (within 48-hour window)."""
    rating: Optional[int] = Field(None, ge=1, le=5)
    title: Optional[str] = Field(None, max_length=100)
    comment: Optional[str] = Field(None, max_length=1000)
    tool_condition_rating: Optional[int] = Field(None, ge=1, le=5)

    @validator('title', 'comment')
    def sanitize_text(cls, v):
        """Sanitize text input."""
        if not v:
            return v
        
        import re
        v = re.sub(r'<[^>]*>', '', v)
        v = re.sub(r'javascript:', '', v, flags=re.IGNORECASE)
        v = v.strip()
        return v


class ReviewResponseRequest(BaseModel):
    """Schema for responding to a received review."""
    response: str = Field(..., max_length=500, description="Response to the review")

    @validator('response')
    def sanitize_response(cls, v):
        """Sanitize response text."""
        import re
        v = re.sub(r'<[^>]*>', '', v)
        v = re.sub(r'javascript:', '', v, flags=re.IGNORECASE)
        v = v.strip()
        
        if len(v) < 5:
            raise ValueError('Response must be at least 5 characters long')
        
        return v


class ReviewFlagRequest(BaseModel):
    """Schema for flagging a review."""
    reason: FlagReason = Field(..., description="Reason for flagging")
    details: Optional[str] = Field(None, max_length=500, description="Additional details")

    @validator('details')
    def sanitize_details(cls, v):
        """Sanitize flag details."""
        if not v:
            return v
        
        import re
        v = re.sub(r'<[^>]*>', '', v)
        v = v.strip()
        return v


# Response Schemas

class UserBasicInfo(BaseModel):
    """Basic user information for reviews."""
    id: UUID
    display_name: str
    average_rating: Optional[Decimal]
    total_ratings: int

    class Config:
        from_attributes = True


class ToolBasicInfo(BaseModel):
    """Basic tool information for reviews."""
    id: UUID
    title: str

    class Config:
        from_attributes = True


class BookingBasicInfo(BaseModel):
    """Basic booking information for reviews."""
    id: UUID
    requested_start_date: datetime
    requested_end_date: datetime

    class Config:
        from_attributes = True


class ReviewResponse(BaseModel):
    """Schema for review response."""
    id: UUID
    booking: BookingBasicInfo
    reviewer: UserBasicInfo
    reviewee: UserBasicInfo
    tool: Optional[ToolBasicInfo] = None
    rating: int
    title: Optional[str]
    comment: Optional[str]
    tool_condition_rating: Optional[int]
    review_type: ReviewType
    response: Optional[str] = None
    response_at: Optional[datetime] = None
    is_flagged: bool
    is_approved: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ReviewListItem(BaseModel):
    """Simplified review schema for list views."""
    id: UUID
    reviewer_name: str
    rating: int
    title: Optional[str]
    comment: Optional[str]
    review_type: ReviewType
    is_flagged: bool
    created_at: datetime

    class Config:
        from_attributes = True


class PaginatedReviewResponse(BaseModel):
    """Paginated review response schema."""
    items: List[ReviewListItem]
    total: int
    page: int
    size: int
    pages: int


class ReviewEligibilityResponse(BaseModel):
    """Schema for review eligibility check."""
    can_review_owner: bool
    can_review_borrower: bool
    review_deadline: Optional[datetime]
    has_reviewed_owner: bool
    has_reviewed_borrower: bool
    booking_status: str
    message: str


class ReviewStatistics(BaseModel):
    """Schema for review statistics."""
    total_reviews: int
    average_rating: Decimal
    rating_distribution: dict  # {"5": 45, "4": 32, "3": 15, "2": 5, "1": 3}
    total_tool_reviews: int
    total_user_reviews: int
    flagged_reviews: int
    pending_moderation: int


class UserReviewSummary(BaseModel):
    """Schema for user review summary."""
    total_reviews_given: int
    total_reviews_received: int
    average_rating_given: Optional[Decimal]
    average_rating_received: Optional[Decimal]
    recent_reviews: List[ReviewListItem]


class ToolReviewSummary(BaseModel):
    """Schema for tool review summary."""
    tool: ToolBasicInfo
    total_reviews: int
    average_rating: Decimal
    average_condition_rating: Optional[Decimal]
    rating_distribution: dict
    recent_reviews: List[ReviewListItem]


# Filter and Search Schemas

class ReviewFilters(BaseModel):
    """Schema for review filters."""
    rating: Optional[int] = Field(None, ge=1, le=5)
    review_type: Optional[ReviewType] = None
    is_flagged: Optional[bool] = None
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None
    page: int = Field(1, ge=1)
    size: int = Field(20, ge=1, le=100)
    sort: str = Field("created_at", pattern="^(created_at|rating|updated_at)$")
    order: str = Field("desc", pattern="^(asc|desc)$")


class ReviewSearchRequest(BaseModel):
    """Schema for review search."""
    query: Optional[str] = Field(None, max_length=100)
    tool_title: Optional[str] = Field(None, max_length=100)
    reviewer_name: Optional[str] = Field(None, max_length=50)
    min_rating: Optional[int] = Field(None, ge=1, le=5)
    max_rating: Optional[int] = Field(None, ge=1, le=5)


# Success Response Schemas

class ReviewCreatedResponse(BaseModel):
    """Response schema for successful review creation."""
    review: ReviewResponse
    message: str = "Review created successfully"


class ReviewUpdatedResponse(BaseModel):
    """Response schema for successful review update."""
    review: ReviewResponse
    message: str = "Review updated successfully"


class ReviewResponseAddedResponse(BaseModel):
    """Response schema for successful review response."""
    review: ReviewResponse
    message: str = "Response added successfully"


class ReviewFlaggedResponse(BaseModel):
    """Response schema for successful review flagging."""
    message: str = "Review flagged for moderation"
    flag_id: UUID


# Error Response Schemas

class ReviewErrorResponse(BaseModel):
    """Response schema for review errors."""
    error: str
    details: Optional[dict] = None
    suggestions: Optional[List[str]] = None


# Special Use Case Schemas

class MutualReviewStatus(BaseModel):
    """Schema for mutual review status in a booking."""
    booking_id: UUID
    borrower_review: Optional[ReviewResponse] = None
    owner_review: Optional[ReviewResponse] = None
    both_reviewed: bool
    review_deadline: Optional[datetime]


class ReviewModerationAction(BaseModel):
    """Schema for review moderation actions."""
    action: str  # 'approve', 'reject', 'flag', 'unflag'
    reason: Optional[str] = None
    moderator_notes: Optional[str] = None


class ReviewAnalytics(BaseModel):
    """Schema for review analytics."""
    period: str  # 'week', 'month', 'year'
    total_reviews: int
    average_rating: Decimal
    review_trend: List[dict]  # [{"date": "2024-01-01", "count": 15, "avg_rating": 4.2}]
    top_rated_tools: List[dict]
    most_active_reviewers: List[dict]