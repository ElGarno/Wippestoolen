"""Review endpoints for the API."""

from datetime import datetime
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from wippestoolen.app.api.v1.dependencies import get_current_active_user
from wippestoolen.app.core.database import get_db
from wippestoolen.app.models.user import User
from wippestoolen.app.schemas.review import (
    ReviewCreateRequest,
    ReviewUpdateRequest,
    ReviewResponseRequest,
    ReviewFlagRequest,
    ReviewResponse,
    ReviewFilters,
    PaginatedReviewResponse,
    ReviewEligibilityResponse,
    ReviewStatistics,
    MutualReviewStatus,
    ToolReviewSummary,
    ReviewCreatedResponse,
    ReviewUpdatedResponse,
    ReviewResponseAddedResponse,
    ReviewFlaggedResponse
)
from wippestoolen.app.services.review_service import (
    ReviewService,
    ReviewError,
    ReviewPermissionError,
    ReviewNotEligibleError,
    ReviewDeadlineExpiredError,
    DuplicateReviewError
)

router = APIRouter(prefix="/reviews", tags=["reviews"])


@router.post("", response_model=ReviewCreatedResponse, status_code=status.HTTP_201_CREATED)
async def create_review(
    review_data: ReviewCreateRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new review for a completed booking.
    
    Creates a review after booking completion. Users can review:
    - Borrowers can review tool owners and tools
    - Tool owners can review borrowers
    
    Reviews must be created within 30 days of booking completion.
    
    - **booking_id**: ID of the completed booking
    - **rating**: Overall rating (1-5 stars)
    - **title**: Optional review title/summary
    - **comment**: Optional detailed review comment
    - **tool_condition_rating**: Tool condition rating (borrower reviews only)
    """
    review_service = ReviewService(db)
    
    try:
        review = await review_service.create_review(
            user_id=current_user.id,
            review_data=review_data
        )
        
        return ReviewCreatedResponse(
            review=review,
            message="Review created successfully"
        )
        
    except ReviewNotEligibleError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except ReviewPermissionError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )
    except DuplicateReviewError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e)
        )
    except ReviewDeadlineExpiredError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except ReviewError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/{review_id}", response_model=ReviewResponse)
async def get_review(
    review_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get detailed review information.
    
    Returns comprehensive review details. Reviews are publicly accessible
    but sensitive information may be filtered based on user permissions.
    """
    review_service = ReviewService(db)
    
    try:
        review_with_relations = await review_service._get_review_with_relations(review_id)
        if not review_with_relations:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Review not found"
            )
        
        return review_service._create_review_response(review_with_relations)
        
    except ReviewError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.put("/{review_id}", response_model=ReviewUpdatedResponse)
async def update_review(
    review_id: UUID,
    update_data: ReviewUpdateRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Update a review within the 48-hour edit window.
    
    Reviews can only be updated by their authors within 48 hours of creation.
    This allows users to correct mistakes or add additional information.
    """
    review_service = ReviewService(db)
    
    try:
        review = await review_service.update_review(
            review_id=review_id,
            user_id=current_user.id,
            update_data=update_data
        )
        
        return ReviewUpdatedResponse(
            review=review,
            message="Review updated successfully"
        )
        
    except ReviewPermissionError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )
    except ReviewDeadlineExpiredError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except ReviewError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/{review_id}/response", response_model=ReviewResponseAddedResponse)
async def add_review_response(
    review_id: UUID,
    response_data: ReviewResponseRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Add a response to a received review.
    
    Allows users to respond to reviews they have received. This provides
    an opportunity for respectful dialogue and clarification.
    
    Only the reviewee can add a response, and only one response per review is allowed.
    """
    review_service = ReviewService(db)
    
    try:
        review = await review_service.add_review_response(
            review_id=review_id,
            user_id=current_user.id,
            response_data=response_data
        )
        
        return ReviewResponseAddedResponse(
            review=review,
            message="Response added successfully"
        )
        
    except ReviewPermissionError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )
    except ReviewError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/{review_id}/flag", response_model=ReviewFlaggedResponse)
async def flag_review(
    review_id: UUID,
    flag_data: ReviewFlagRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Flag a review for moderation.
    
    Reports inappropriate content, spam, harassment, or false information.
    Flagged reviews are sent for human moderation and may be hidden
    until reviewed.
    
    Users cannot flag their own reviews.
    """
    review_service = ReviewService(db)
    
    try:
        flag_id = await review_service.flag_review(
            review_id=review_id,
            user_id=current_user.id,
            flag_data=flag_data
        )
        
        return ReviewFlaggedResponse(
            message="Review flagged for moderation",
            flag_id=flag_id
        )
        
    except ReviewPermissionError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )
    except ReviewError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/bookings/{booking_id}/reviews", response_model=MutualReviewStatus)
async def get_booking_reviews(
    booking_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get all reviews for a specific booking.
    
    Returns both borrower and owner reviews for a booking, if they exist.
    Includes review deadline information and completion status.
    
    Accessible by booking participants or publicly if reviews exist.
    """
    review_service = ReviewService(db)
    
    try:
        return await review_service.get_booking_reviews(booking_id)
        
    except ReviewError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/bookings/{booking_id}/review-eligibility", response_model=ReviewEligibilityResponse)
async def check_review_eligibility(
    booking_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Check review eligibility for a booking.
    
    Determines whether the current user can create reviews for a booking.
    Returns information about review permissions, deadlines, and existing reviews.
    
    Useful for frontend applications to show/hide review creation options.
    """
    review_service = ReviewService(db)
    
    try:
        return await review_service.check_review_eligibility(
            user_id=current_user.id,
            booking_id=booking_id
        )
        
    except ReviewPermissionError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )
    except ReviewError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/users/{user_id}/reviews", response_model=PaginatedReviewResponse)
async def get_user_reviews(
    user_id: UUID,
    as_reviewer: bool = Query(True, description="Get reviews given (true) or received (false)"),
    rating: Optional[int] = Query(None, ge=1, le=5, description="Filter by rating"),
    page: int = Query(1, ge=1, description="Page number"),
    size: int = Query(20, ge=1, le=100, description="Page size"),
    sort: str = Query("created_at", pattern="^(created_at|rating|updated_at)$"),
    order: str = Query("desc", pattern="^(asc|desc)$"),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get reviews for a specific user.
    
    Returns paginated reviews either given by the user (as reviewer)
    or received by the user (as reviewee).
    
    **Query Parameters:**
    - **as_reviewer**: Get reviews given (true) or received (false)
    - **rating**: Filter by specific rating (1-5)
    - **page**: Page number (starts from 1)
    - **size**: Number of items per page (max 100)
    - **sort**: Sort by field (created_at, rating, updated_at)
    - **order**: Sort order (asc or desc)
    """
    review_service = ReviewService(db)
    
    filters = ReviewFilters(
        rating=rating,
        page=page,
        size=size,
        sort=sort,
        order=order
    )
    
    try:
        return await review_service.get_user_reviews(
            user_id=user_id,
            filters=filters,
            as_reviewer=as_reviewer
        )
        
    except ReviewError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/tools/{tool_id}/reviews", response_model=ToolReviewSummary)
async def get_tool_reviews(
    tool_id: UUID,
    rating: Optional[int] = Query(None, ge=1, le=5, description="Filter by rating"),
    size: int = Query(10, ge=1, le=50, description="Number of recent reviews to include"),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get reviews for a specific tool.
    
    Returns comprehensive tool review information including:
    - Overall statistics and rating distribution
    - Average tool condition rating
    - Recent reviews with pagination
    
    Only includes reviews from borrowers (borrower_to_owner type).
    
    **Query Parameters:**
    - **rating**: Filter reviews by specific rating (1-5)
    - **size**: Number of recent reviews to include (max 50)
    """
    review_service = ReviewService(db)
    
    filters = ReviewFilters(
        rating=rating,
        size=size,
        page=1
    )
    
    try:
        return await review_service.get_tool_reviews(
            tool_id=tool_id,
            filters=filters
        )
        
    except ReviewError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/my-reviews", response_model=PaginatedReviewResponse)
async def get_my_reviews(
    as_reviewer: bool = Query(True, description="Get reviews given (true) or received (false)"),
    rating: Optional[int] = Query(None, ge=1, le=5, description="Filter by rating"),
    page: int = Query(1, ge=1, description="Page number"),
    size: int = Query(20, ge=1, le=100, description="Page size"),
    sort: str = Query("created_at", pattern="^(created_at|rating|updated_at)$"),
    order: str = Query("desc", pattern="^(asc|desc)$"),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get current user's reviews.
    
    Convenience endpoint for getting the authenticated user's reviews
    without specifying user ID.
    
    Returns paginated reviews either given by the user (as reviewer)
    or received by the user (as reviewee).
    """
    review_service = ReviewService(db)
    
    filters = ReviewFilters(
        rating=rating,
        page=page,
        size=size,
        sort=sort,
        order=order
    )
    
    try:
        return await review_service.get_user_reviews(
            user_id=current_user.id,
            filters=filters,
            as_reviewer=as_reviewer
        )
        
    except ReviewError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/statistics", response_model=ReviewStatistics)
async def get_review_statistics(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get platform-wide review statistics.
    
    Returns comprehensive review analytics including:
    - Total review counts and averages
    - Rating distribution across all reviews
    - Tool vs user review breakdown
    - Moderation statistics
    
    Useful for admin dashboards and platform insights.
    """
    review_service = ReviewService(db)
    
    try:
        return await review_service.get_review_statistics()
        
    except ReviewError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


# Convenience endpoints for common actions

@router.delete("/{review_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_review(
    review_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Delete a review within the 48-hour edit window.
    
    Reviews can only be deleted by their authors within 48 hours of creation.
    This is a hard delete and cannot be undone.
    
    Returns 204 No Content on successful deletion.
    """
    review_service = ReviewService(db)
    
    # Get review to check permissions and timing
    review = await review_service._get_review_with_relations(review_id)
    if not review:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Review not found"
        )
    
    # Check permission
    if review.reviewer_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Can only delete own reviews"
        )
    
    # Check edit window
    from datetime import timedelta
    edit_deadline = review.created_at + timedelta(hours=48)
    if datetime.utcnow() > edit_deadline:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Delete window has expired"
        )
    
    try:
        # Delete review
        await db.delete(review)
        await db.commit()
        
        # Update aggregated ratings
        await review_service._update_user_rating(review.reviewee_id)
        if review.review_type == "borrower_to_owner":
            await review_service._update_tool_rating(review.booking.tool_id)
        
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete review"
        )