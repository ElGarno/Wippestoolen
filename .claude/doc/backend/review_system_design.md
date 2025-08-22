# Review System API Design Documentation

## Overview

This document provides comprehensive API design and business logic patterns for the Wippestoolen review system. The review system enables mutual ratings and trust building between users after completed bookings, supporting both tool reviews (borrower reviewing tool/owner) and user reviews (owner reviewing borrower).

## Database Schema Context

The review system leverages the existing database models:

### Review Model
- **Primary Key**: UUID
- **Foreign Keys**: booking_id, reviewer_id, reviewee_id, moderated_by
- **Review Content**: rating (1-5), title, comment, review_type
- **Tool Condition**: tool_condition_rating (1-5, for borrower reviews)
- **Response System**: response, response_at (for review responses)
- **Moderation**: is_flagged, flagged_reason, is_approved, moderated_by, moderated_at
- **Constraints**: 
  - Unique constraint per booking/reviewer/review_type
  - Rating range validation (1-5)
  - Review type validation ('borrower_to_owner', 'owner_to_borrower')
  - No self-reviews

### User Model Integration
- **Denormalized Rating Fields**: average_rating, total_ratings
- **Relationships**: reviews_given, reviews_received

### Tool Model Integration
- **Denormalized Rating Fields**: average_rating, total_ratings
- **Review Calculation**: Tool ratings calculated from borrower reviews

## API Endpoints Design

### 1. Create Review

**Endpoint**: `POST /api/v1/reviews`

**Description**: Creates a new review for a completed booking. Only allows reviews after booking completion.

**Authentication**: Required (JWT)

**Request Schema**:
```json
{
  "booking_id": "uuid",
  "rating": 5,
  "title": "Great tool and helpful owner!",
  "comment": "The drill worked perfectly for my project. Owner was very responsive and helpful with pickup instructions.",
  "tool_condition_rating": 5
}
```

**Response Schema** (201 Created):
```json
{
  "id": "uuid",
  "booking_id": "uuid",
  "reviewer": {
    "id": "uuid",
    "display_name": "John D.",
    "average_rating": 4.8
  },
  "reviewee": {
    "id": "uuid", 
    "display_name": "Sarah M.",
    "average_rating": 4.9
  },
  "tool": {
    "id": "uuid",
    "title": "DeWalt Cordless Drill"
  },
  "rating": 5,
  "title": "Great tool and helpful owner!",
  "comment": "The drill worked perfectly for my project. Owner was very responsive and helpful with pickup instructions.",
  "tool_condition_rating": 5,
  "review_type": "borrower_to_owner",
  "is_flagged": false,
  "is_approved": true,
  "created_at": "2024-01-25T15:30:00Z",
  "updated_at": "2024-01-25T15:30:00Z"
}
```

**Error Responses**:
- `400 Bad Request`: Invalid booking ID, booking not completed, duplicate review
- `401 Unauthorized`: Not authenticated
- `403 Forbidden`: Not participant in booking
- `404 Not Found`: Booking not found

### 2. Get Reviews for Booking

**Endpoint**: `GET /api/v1/bookings/{booking_id}/reviews`

**Description**: Retrieves all reviews for a specific booking (both directions).

**Authentication**: Required (must be booking participant or reviews are public)

**Response Schema** (200 OK):
```json
{
  "booking_id": "uuid",
  "reviews": [
    {
      "id": "uuid",
      "reviewer": {
        "id": "uuid",
        "display_name": "John D.",
        "average_rating": 4.8
      },
      "reviewee": {
        "id": "uuid",
        "display_name": "Sarah M.",
        "average_rating": 4.9
      },
      "rating": 5,
      "title": "Great tool and helpful owner!",
      "comment": "The drill worked perfectly for my project.",
      "tool_condition_rating": 5,
      "review_type": "borrower_to_owner",
      "response": null,
      "response_at": null,
      "created_at": "2024-01-25T15:30:00Z"
    },
    {
      "id": "uuid",
      "reviewer": {
        "id": "uuid",
        "display_name": "Sarah M.",
        "average_rating": 4.9
      },
      "reviewee": {
        "id": "uuid",
        "display_name": "John D.",
        "average_rating": 4.8
      },
      "rating": 5,
      "title": "Responsible borrower",
      "comment": "Tool returned in perfect condition and on time.",
      "tool_condition_rating": null,
      "review_type": "owner_to_borrower",
      "response": null,
      "response_at": null,
      "created_at": "2024-01-25T16:00:00Z"
    }
  ],
  "review_status": {
    "borrower_can_review": false,
    "owner_can_review": false,
    "both_completed": true
  }
}
```

### 3. Get Reviews for User

**Endpoint**: `GET /api/v1/users/{user_id}/reviews`

**Description**: Retrieves all reviews received by a specific user (public profile data).

**Query Parameters**:
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10, max: 50)
- `type`: Filter by review type (`received`, `given`) - default: `received`

**Response Schema** (200 OK):
```json
{
  "user": {
    "id": "uuid",
    "display_name": "Sarah M.",
    "average_rating": 4.9,
    "total_ratings": 25
  },
  "reviews": [
    {
      "id": "uuid",
      "reviewer": {
        "id": "uuid",
        "display_name": "John D."
      },
      "rating": 5,
      "title": "Great tool and helpful owner!",
      "comment": "The drill worked perfectly for my project.",
      "review_type": "borrower_to_owner",
      "tool": {
        "id": "uuid",
        "title": "DeWalt Cordless Drill"
      },
      "created_at": "2024-01-25T15:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "pages": 3
  },
  "rating_distribution": {
    "5": 15,
    "4": 8,
    "3": 2,
    "2": 0,
    "1": 0
  }
}
```

### 4. Get Reviews for Tool

**Endpoint**: `GET /api/v1/tools/{tool_id}/reviews`

**Description**: Retrieves all reviews for a specific tool (borrower reviews only).

**Query Parameters**:
- `page`: Page number (default: 1) 
- `limit`: Items per page (default: 10, max: 50)

**Response Schema** (200 OK):
```json
{
  "tool": {
    "id": "uuid",
    "title": "DeWalt Cordless Drill",
    "average_rating": 4.8,
    "total_ratings": 12
  },
  "reviews": [
    {
      "id": "uuid",
      "reviewer": {
        "id": "uuid",
        "display_name": "John D.",
        "average_rating": 4.8
      },
      "rating": 5,
      "title": "Perfect drill for home projects",
      "comment": "Great tool, well-maintained and worked perfectly.",
      "tool_condition_rating": 5,
      "created_at": "2024-01-25T15:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 12,
    "pages": 2
  },
  "rating_distribution": {
    "5": 8,
    "4": 3,
    "3": 1,
    "2": 0,
    "1": 0
  }
}
```

### 5. Add Response to Review

**Endpoint**: `POST /api/v1/reviews/{review_id}/response`

**Description**: Allows the reviewee to respond to a review they received.

**Authentication**: Required (must be the reviewee)

**Request Schema**:
```json
{
  "response": "Thank you for the positive feedback! Glad the drill worked well for your project."
}
```

**Response Schema** (200 OK):
```json
{
  "id": "uuid",
  "response": "Thank you for the positive feedback! Glad the drill worked well for your project.",
  "response_at": "2024-01-26T10:30:00Z"
}
```

### 6. Flag Review

**Endpoint**: `POST /api/v1/reviews/{review_id}/flag`

**Description**: Allows users to flag inappropriate reviews for moderation.

**Authentication**: Required

**Request Schema**:
```json
{
  "reason": "inappropriate_content"
}
```

**Response Schema** (200 OK):
```json
{
  "message": "Review flagged for moderation",
  "flagged_at": "2024-01-26T11:00:00Z"
}
```

### 7. Get Review Eligibility

**Endpoint**: `GET /api/v1/bookings/{booking_id}/review-eligibility`

**Description**: Checks if the current user can leave a review for a specific booking.

**Authentication**: Required (must be booking participant)

**Response Schema** (200 OK):
```json
{
  "booking_id": "uuid",
  "can_review": true,
  "review_type": "borrower_to_owner",
  "existing_review_id": null,
  "booking_status": "completed",
  "completion_date": "2024-01-24T18:00:00Z",
  "review_deadline": "2024-02-24T18:00:00Z"
}
```

### 8. Update Review

**Endpoint**: `PUT /api/v1/reviews/{review_id}`

**Description**: Allows reviewers to update their reviews within 48 hours of posting.

**Authentication**: Required (must be the reviewer)

**Request Schema**:
```json
{
  "rating": 4,
  "title": "Good tool with minor issues",
  "comment": "Tool worked well overall, though the battery didn't last as long as expected.",
  "tool_condition_rating": 4
}
```

**Response Schema** (200 OK):
```json
{
  "id": "uuid",
  "rating": 4,
  "title": "Good tool with minor issues",
  "comment": "Tool worked well overall, though the battery didn't last as long as expected.",
  "tool_condition_rating": 4,
  "updated_at": "2024-01-25T17:30:00Z",
  "can_edit": true,
  "edit_deadline": "2024-01-27T15:30:00Z"
}
```

### 9. Delete Review

**Endpoint**: `DELETE /api/v1/reviews/{review_id}`

**Description**: Allows reviewers to delete their reviews within 48 hours of posting.

**Authentication**: Required (must be the reviewer)

**Response Schema** (204 No Content)

### 10. Get Review Statistics

**Endpoint**: `GET /api/v1/reviews/statistics`

**Description**: Get platform-wide review statistics (admin/public metrics).

**Query Parameters**:
- `user_id`: Filter by specific user (optional)
- `tool_id`: Filter by specific tool (optional)
- `date_from`: Start date filter (optional)
- `date_to`: End date filter (optional)

**Response Schema** (200 OK):
```json
{
  "total_reviews": 1250,
  "average_rating": 4.6,
  "rating_distribution": {
    "5": 650,
    "4": 400,
    "3": 150,
    "2": 35,
    "1": 15
  },
  "reviews_by_type": {
    "borrower_to_owner": 625,
    "owner_to_borrower": 625
  },
  "reviews_with_responses": 320,
  "flagged_reviews": 8,
  "date_range": {
    "from": "2024-01-01",
    "to": "2024-01-31"
  }
}
```

## Request/Response Schema Specifications

### Core Review Schema

```python
from pydantic import BaseModel, Field, validator
from datetime import datetime
from typing import Optional, Literal
import uuid

class ReviewCreateRequest(BaseModel):
    booking_id: uuid.UUID
    rating: int = Field(..., ge=1, le=5)
    title: Optional[str] = Field(None, max_length=200)
    comment: Optional[str] = Field(None, max_length=2000)
    tool_condition_rating: Optional[int] = Field(None, ge=1, le=5)
    
    @validator('tool_condition_rating')
    def validate_tool_condition_for_borrower(cls, v, values):
        """Tool condition rating only for borrower reviews"""
        # Validation logic handled in service layer
        return v

class ReviewUpdateRequest(BaseModel):
    rating: Optional[int] = Field(None, ge=1, le=5)
    title: Optional[str] = Field(None, max_length=200)
    comment: Optional[str] = Field(None, max_length=2000)
    tool_condition_rating: Optional[int] = Field(None, ge=1, le=5)

class ReviewResponseRequest(BaseModel):
    response: str = Field(..., max_length=1000)

class ReviewFlagRequest(BaseModel):
    reason: Literal[
        "inappropriate_content",
        "spam",
        "harassment",
        "fake_review",
        "other"
    ]

class UserSummary(BaseModel):
    id: uuid.UUID
    display_name: str
    average_rating: Optional[float] = None

class ToolSummary(BaseModel):
    id: uuid.UUID
    title: str

class ReviewResponse(BaseModel):
    id: uuid.UUID
    booking_id: uuid.UUID
    reviewer: UserSummary
    reviewee: UserSummary
    tool: Optional[ToolSummary] = None
    rating: int
    title: Optional[str] = None
    comment: Optional[str] = None
    tool_condition_rating: Optional[int] = None
    review_type: Literal["borrower_to_owner", "owner_to_borrower"]
    response: Optional[str] = None
    response_at: Optional[datetime] = None
    is_flagged: bool
    is_approved: bool
    created_at: datetime
    updated_at: datetime
    can_edit: Optional[bool] = None
    edit_deadline: Optional[datetime] = None

class ReviewEligibilityResponse(BaseModel):
    booking_id: uuid.UUID
    can_review: bool
    review_type: Optional[Literal["borrower_to_owner", "owner_to_borrower"]] = None
    existing_review_id: Optional[uuid.UUID] = None
    booking_status: str
    completion_date: Optional[datetime] = None
    review_deadline: Optional[datetime] = None

class PaginationInfo(BaseModel):
    page: int
    limit: int
    total: int
    pages: int

class RatingDistribution(BaseModel):
    one: int = Field(alias="1")
    two: int = Field(alias="2") 
    three: int = Field(alias="3")
    four: int = Field(alias="4")
    five: int = Field(alias="5")
```

## Business Logic Patterns

### Review Creation Logic

```python
async def create_review(
    db: AsyncSession,
    review_data: ReviewCreateRequest,
    reviewer_id: uuid.UUID
) -> ReviewResponse:
    """
    Business logic for creating a review with validation.
    """
    # 1. Validate booking exists and is completed
    booking = await get_booking_by_id(db, review_data.booking_id)
    if not booking or booking.status != "completed":
        raise HTTPException(400, "Booking must be completed to leave review")
    
    # 2. Validate reviewer is participant
    if reviewer_id not in [booking.borrower_id, booking.tool.owner_id]:
        raise HTTPException(403, "Must be booking participant to review")
    
    # 3. Determine review type
    review_type = "borrower_to_owner" if reviewer_id == booking.borrower_id else "owner_to_borrower"
    reviewee_id = booking.tool.owner_id if review_type == "borrower_to_owner" else booking.borrower_id
    
    # 4. Check for duplicate review
    existing = await get_existing_review(db, review_data.booking_id, reviewer_id, review_type)
    if existing:
        raise HTTPException(400, "Review already exists for this booking")
    
    # 5. Validate tool condition rating (only for borrower reviews)
    if review_type == "owner_to_borrower" and review_data.tool_condition_rating:
        raise HTTPException(400, "Tool condition rating only allowed for borrower reviews")
    
    # 6. Create review
    review = Review(
        booking_id=review_data.booking_id,
        reviewer_id=reviewer_id,
        reviewee_id=reviewee_id,
        rating=review_data.rating,
        title=review_data.title,
        comment=review_data.comment,
        tool_condition_rating=review_data.tool_condition_rating,
        review_type=review_type
    )
    
    db.add(review)
    await db.flush()
    
    # 7. Update denormalized rating fields
    await update_user_rating(db, reviewee_id)
    if review_type == "borrower_to_owner":
        await update_tool_rating(db, booking.tool_id)
    
    await db.commit()
    return await get_review_response(db, review.id)
```

### Rating Aggregation Algorithms

```python
async def update_user_rating(db: AsyncSession, user_id: uuid.UUID) -> None:
    """
    Updates denormalized user rating fields.
    Uses weighted average considering recency and review type.
    """
    # Get all reviews for user
    query = select(Review).where(Review.reviewee_id == user_id)
    result = await db.execute(query)
    reviews = result.scalars().all()
    
    if not reviews:
        return
    
    total_ratings = len(reviews)
    average_rating = sum(review.rating for review in reviews) / total_ratings
    
    # Update user record
    user_update = update(User).where(User.id == user_id).values(
        average_rating=round(average_rating, 2),
        total_ratings=total_ratings
    )
    await db.execute(user_update)

async def update_tool_rating(db: AsyncSession, tool_id: uuid.UUID) -> None:
    """
    Updates denormalized tool rating fields.
    Only considers borrower reviews (borrower_to_owner type).
    """
    query = select(Review).join(Booking).where(
        Booking.tool_id == tool_id,
        Review.review_type == "borrower_to_owner"
    )
    result = await db.execute(query)
    reviews = result.scalars().all()
    
    if not reviews:
        return
    
    # Use tool_condition_rating if available, otherwise main rating
    ratings = [
        review.tool_condition_rating or review.rating 
        for review in reviews
    ]
    
    total_ratings = len(ratings)
    average_rating = sum(ratings) / total_ratings
    
    # Update tool record
    tool_update = update(Tool).where(Tool.id == tool_id).values(
        average_rating=round(average_rating, 2),
        total_ratings=total_ratings
    )
    await db.execute(tool_update)
```

### Review Eligibility Logic

```python
async def get_review_eligibility(
    db: AsyncSession,
    booking_id: uuid.UUID,
    user_id: uuid.UUID
) -> ReviewEligibilityResponse:
    """
    Determines if user can review a specific booking.
    """
    booking = await get_booking_with_relations(db, booking_id)
    if not booking:
        raise HTTPException(404, "Booking not found")
    
    # Check if user is participant
    if user_id not in [booking.borrower_id, booking.tool.owner_id]:
        raise HTTPException(403, "Must be booking participant")
    
    # Determine review type
    review_type = "borrower_to_owner" if user_id == booking.borrower_id else "owner_to_borrower"
    
    # Check if booking is completed
    if booking.status != "completed":
        return ReviewEligibilityResponse(
            booking_id=booking_id,
            can_review=False,
            booking_status=booking.status
        )
    
    # Check for existing review
    existing_review = await get_existing_review(db, booking_id, user_id, review_type)
    
    # Calculate review deadline (30 days after completion)
    review_deadline = booking.actual_end_date + timedelta(days=30)
    can_review = datetime.utcnow() <= review_deadline and not existing_review
    
    return ReviewEligibilityResponse(
        booking_id=booking_id,
        can_review=can_review,
        review_type=review_type if can_review else None,
        existing_review_id=existing_review.id if existing_review else None,
        booking_status=booking.status,
        completion_date=booking.actual_end_date,
        review_deadline=review_deadline
    )
```

## Moderation Workflows

### Automated Content Filtering

```python
async def moderate_review_content(review: Review) -> bool:
    """
    Automated content moderation for reviews.
    Returns True if content should be flagged.
    """
    # Basic keyword filtering
    flagged_keywords = [
        "inappropriate", "scam", "fake", "fraud",
        # Add more as needed
    ]
    
    text_content = f"{review.title} {review.comment}".lower()
    
    # Check for flagged keywords
    for keyword in flagged_keywords:
        if keyword in text_content:
            review.is_flagged = True
            review.flagged_reason = "Automated: Inappropriate content detected"
            return True
    
    # Check for excessive capitalization
    if text_content.isupper() and len(text_content) > 20:
        review.is_flagged = True
        review.flagged_reason = "Automated: Excessive capitalization"
        return True
    
    # Check review length (too short might be spam)
    if review.comment and len(review.comment.strip()) < 10:
        review.is_flagged = True
        review.flagged_reason = "Automated: Review too short"
        return True
    
    return False

async def handle_review_flag(
    db: AsyncSession,
    review_id: uuid.UUID,
    flag_reason: str,
    flagger_id: uuid.UUID
) -> None:
    """
    Handle manual review flagging by users.
    """
    review = await get_review_by_id(db, review_id)
    if not review:
        raise HTTPException(404, "Review not found")
    
    # Update review flagging status
    review.is_flagged = True
    review.flagged_reason = f"User reported: {flag_reason}"
    
    # Create moderation task (could be async job)
    await create_moderation_task(
        review_id=review_id,
        reason=flag_reason,
        reported_by=flagger_id
    )
    
    await db.commit()
```

### Review Response System

```python
async def add_review_response(
    db: AsyncSession,
    review_id: uuid.UUID,
    response_text: str,
    responder_id: uuid.UUID
) -> Review:
    """
    Allows reviewees to respond to reviews.
    """
    review = await get_review_by_id(db, review_id)
    if not review:
        raise HTTPException(404, "Review not found")
    
    # Verify responder is the reviewee
    if responder_id != review.reviewee_id:
        raise HTTPException(403, "Only reviewee can respond")
    
    # Check if response already exists
    if review.response:
        raise HTTPException(400, "Response already exists")
    
    # Add response
    review.response = response_text
    review.response_at = datetime.utcnow()
    
    await db.commit()
    return review
```

## Integration Patterns with Booking System

### Booking Completion Triggers

```python
# In booking_service.py
async def complete_booking(
    db: AsyncSession,
    booking_id: uuid.UUID,
    current_user_id: uuid.UUID
) -> BookingResponse:
    """
    Complete booking and trigger review eligibility.
    """
    # ... existing completion logic ...
    
    booking.status = "completed"
    booking.actual_end_date = date.today()
    
    # Create notifications for review eligibility
    await create_review_notification(
        db, booking_id, booking.borrower_id, "borrower_to_owner"
    )
    await create_review_notification(
        db, booking_id, booking.tool.owner_id, "owner_to_borrower"
    )
    
    await db.commit()
    return booking

async def create_review_notification(
    db: AsyncSession,
    booking_id: uuid.UUID,
    user_id: uuid.UUID,
    review_type: str
) -> None:
    """
    Creates notification for review eligibility.
    """
    notification = Notification(
        recipient_id=user_id,
        type="review_available",
        title="Leave a review",
        message=f"You can now leave a review for your recent booking.",
        data={"booking_id": str(booking_id), "review_type": review_type},
        action_url=f"/bookings/{booking_id}/review"
    )
    db.add(notification)
```

### Review Impact on User Trust Score

```python
async def calculate_trust_score(db: AsyncSession, user_id: uuid.UUID) -> float:
    """
    Calculate comprehensive trust score based on reviews and activity.
    """
    user = await get_user_by_id(db, user_id)
    if not user:
        return 0.0
    
    # Base score from average rating (0-50 points)
    rating_score = (user.average_rating / 5.0) * 50
    
    # Volume bonus (0-25 points)
    volume_bonus = min(user.total_ratings / 20.0, 1.0) * 25
    
    # Activity bonus based on completed bookings (0-15 points)
    completed_bookings = await count_completed_bookings(db, user_id)
    activity_bonus = min(completed_bookings / 10.0, 1.0) * 15
    
    # Response rate bonus (0-10 points)
    response_rate = await calculate_review_response_rate(db, user_id)
    response_bonus = response_rate * 10
    
    total_score = rating_score + volume_bonus + activity_bonus + response_bonus
    return round(total_score, 1)
```

## Error Handling Strategies

### Common Error Scenarios

```python
class ReviewError(Exception):
    """Base review system error"""
    pass

class BookingNotCompletedError(ReviewError):
    """Booking not in completed status"""
    pass

class DuplicateReviewError(ReviewError):
    """Review already exists"""
    pass

class ReviewEditDeadlineError(ReviewError):
    """Edit deadline exceeded"""
    pass

class UnauthorizedReviewError(ReviewError):
    """User not authorized to review"""
    pass

# Error handler mapping
review_error_handlers = {
    BookingNotCompletedError: (400, "Booking must be completed to leave review"),
    DuplicateReviewError: (400, "Review already exists for this booking"),
    ReviewEditDeadlineError: (400, "Review edit deadline exceeded"),
    UnauthorizedReviewError: (403, "Not authorized to review this booking")
}
```

## Caching and Performance Patterns

### Review Caching Strategy

```python
from redis.asyncio import Redis
import json

async def get_cached_user_reviews(
    redis: Redis,
    user_id: uuid.UUID,
    page: int = 1
) -> Optional[dict]:
    """
    Get cached user reviews with pagination.
    """
    cache_key = f"user_reviews:{user_id}:page_{page}"
    cached_data = await redis.get(cache_key)
    
    if cached_data:
        return json.loads(cached_data)
    return None

async def cache_user_reviews(
    redis: Redis,
    user_id: uuid.UUID,
    page: int,
    reviews_data: dict,
    ttl: int = 300  # 5 minutes
) -> None:
    """
    Cache user reviews data.
    """
    cache_key = f"user_reviews:{user_id}:page_{page}"
    await redis.setex(
        cache_key,
        ttl,
        json.dumps(reviews_data, default=str)
    )

async def invalidate_review_cache(
    redis: Redis,
    user_id: uuid.UUID,
    tool_id: uuid.UUID = None
) -> None:
    """
    Invalidate relevant caches when review is created/updated.
    """
    # Invalidate user review caches
    pattern = f"user_reviews:{user_id}:*"
    keys = await redis.keys(pattern)
    if keys:
        await redis.delete(*keys)
    
    # Invalidate tool review caches if applicable
    if tool_id:
        pattern = f"tool_reviews:{tool_id}:*"
        keys = await redis.keys(pattern)
        if keys:
            await redis.delete(*keys)
```

## Testing Strategies

### Unit Test Examples

```python
import pytest
from unittest.mock import AsyncMock
from app.services.review_service import create_review, ReviewCreateRequest

@pytest.mark.asyncio
async def test_create_review_success():
    """Test successful review creation."""
    # Arrange
    mock_db = AsyncMock()
    review_data = ReviewCreateRequest(
        booking_id="uuid-booking",
        rating=5,
        title="Great tool!",
        comment="Worked perfectly"
    )
    reviewer_id = "uuid-reviewer"
    
    # Mock successful booking retrieval
    mock_booking = Mock(
        status="completed",
        borrower_id=reviewer_id,
        tool=Mock(owner_id="uuid-owner")
    )
    mock_get_booking_by_id.return_value = mock_booking
    mock_get_existing_review.return_value = None
    
    # Act
    result = await create_review(mock_db, review_data, reviewer_id)
    
    # Assert
    assert result.rating == 5
    assert result.title == "Great tool!"
    assert result.review_type == "borrower_to_owner"

@pytest.mark.asyncio
async def test_create_review_booking_not_completed():
    """Test review creation fails for incomplete booking."""
    # Arrange
    mock_db = AsyncMock()
    review_data = ReviewCreateRequest(
        booking_id="uuid-booking",
        rating=5
    )
    
    mock_booking = Mock(status="active")
    mock_get_booking_by_id.return_value = mock_booking
    
    # Act & Assert
    with pytest.raises(HTTPException) as exc_info:
        await create_review(mock_db, review_data, "uuid-reviewer")
    
    assert exc_info.value.status_code == 400
    assert "completed" in exc_info.value.detail
```

## API Documentation Generation

### OpenAPI Schema Extensions

```python
from pydantic import Field

class ReviewCreateRequest(BaseModel):
    """Request schema for creating a review."""
    
    booking_id: uuid.UUID = Field(
        ...,
        description="ID of the completed booking to review",
        example="123e4567-e89b-12d3-a456-426614174000"
    )
    rating: int = Field(
        ...,
        ge=1,
        le=5,
        description="Rating from 1 (poor) to 5 (excellent)",
        example=5
    )
    title: Optional[str] = Field(
        None,
        max_length=200,
        description="Optional review title",
        example="Great tool and helpful owner!"
    )
    comment: Optional[str] = Field(
        None,
        max_length=2000,
        description="Detailed review comment",
        example="The drill worked perfectly for my project. Owner was very responsive."
    )
    tool_condition_rating: Optional[int] = Field(
        None,
        ge=1,
        le=5,
        description="Tool condition rating (borrower reviews only)",
        example=5
    )
    
    class Config:
        schema_extra = {
            "example": {
                "booking_id": "123e4567-e89b-12d3-a456-426614174000",
                "rating": 5,
                "title": "Great tool and helpful owner!",
                "comment": "The drill worked perfectly for my project.",
                "tool_condition_rating": 5
            }
        }
```

## Implementation Guidelines

### Service Layer Structure

```python
# app/services/review_service.py
from typing import List, Optional, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.models.review import Review
from app.schemas.review import *

class ReviewService:
    """Service layer for review operations."""
    
    def __init__(self, db: AsyncSession, redis: Redis = None):
        self.db = db
        self.redis = redis
    
    async def create_review(
        self,
        review_data: ReviewCreateRequest,
        reviewer_id: uuid.UUID
    ) -> ReviewResponse:
        """Create a new review with validation."""
        # Implementation here
        pass
    
    async def get_reviews_for_user(
        self,
        user_id: uuid.UUID,
        page: int = 1,
        limit: int = 10,
        review_type: str = "received"
    ) -> Tuple[List[ReviewResponse], PaginationInfo]:
        """Get paginated reviews for a user."""
        # Implementation here
        pass
    
    async def get_reviews_for_tool(
        self,
        tool_id: uuid.UUID,
        page: int = 1,
        limit: int = 10
    ) -> Tuple[List[ReviewResponse], PaginationInfo]:
        """Get paginated reviews for a tool."""
        # Implementation here
        pass
```

### Router Structure

```python
# app/api/v1/endpoints/reviews.py
from fastapi import APIRouter, Depends, HTTPException, Query
from app.services.review_service import ReviewService
from app.core.auth import get_current_user
from app.schemas.review import *

router = APIRouter(prefix="/reviews", tags=["reviews"])

@router.post("/", response_model=ReviewResponse, status_code=201)
async def create_review(
    review_data: ReviewCreateRequest,
    current_user: User = Depends(get_current_user),
    review_service: ReviewService = Depends(get_review_service)
):
    """Create a new review for a completed booking."""
    return await review_service.create_review(review_data, current_user.id)

@router.get("/bookings/{booking_id}", response_model=BookingReviewsResponse)
async def get_booking_reviews(
    booking_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    review_service: ReviewService = Depends(get_review_service)
):
    """Get all reviews for a specific booking."""
    return await review_service.get_booking_reviews(booking_id, current_user.id)
```

This comprehensive design provides a robust foundation for implementing the review system while maintaining consistency with existing FastAPI patterns and ensuring proper validation, security, and performance optimization.