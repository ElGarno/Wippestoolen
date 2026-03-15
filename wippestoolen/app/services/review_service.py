"""
Review service layer for business logic and database operations.
"""

from datetime import datetime, timedelta
from decimal import Decimal
from typing import List, Optional, Dict, Any
from uuid import UUID

from sqlalchemy import text, and_, or_, desc, asc, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload, joinedload
from sqlalchemy.future import select

from wippestoolen.app.models.review import Review
from wippestoolen.app.models.booking import Booking
from wippestoolen.app.models.tool import Tool
from wippestoolen.app.models.user import User
from wippestoolen.app.schemas.review import (
    ReviewCreateRequest,
    ReviewUpdateRequest,
    ReviewResponseRequest,
    ReviewFlagRequest,
    ReviewResponse,
    ReviewListItem,
    PaginatedReviewResponse,
    ReviewEligibilityResponse,
    ReviewStatistics,
    ReviewFilters,
    MutualReviewStatus,
    UserReviewSummary,
    ToolReviewSummary,
    ReviewType,
    FlagReason
)


class ReviewError(Exception):
    """Base review exception."""
    pass


class ReviewPermissionError(ReviewError):
    """Raised when user lacks permission for review operation."""
    pass


class ReviewNotEligibleError(ReviewError):
    """Raised when user is not eligible to review."""
    pass


class ReviewDeadlineExpiredError(ReviewError):
    """Raised when review deadline has passed."""
    pass


class DuplicateReviewError(ReviewError):
    """Raised when attempting to create duplicate review."""
    pass


class ReviewService:
    """Service class for review operations."""

    REVIEW_DEADLINE_DAYS = 30
    EDIT_WINDOW_HOURS = 48

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_review(
        self,
        user_id: UUID,
        review_data: ReviewCreateRequest
    ) -> ReviewResponse:
        """Create a new review with validation."""
        
        # Get booking with all related data
        booking = await self._get_booking_with_relations(review_data.booking_id)
        if not booking:
            raise ReviewError("Booking not found")
        
        # Validate review eligibility
        eligibility = await self.check_review_eligibility(user_id, review_data.booking_id)
        
        is_borrower = booking.borrower_id == user_id
        is_owner = booking.tool.owner_id == user_id
        
        if not (is_borrower or is_owner):
            raise ReviewPermissionError("User is not participant in this booking")
        
        # Determine review type and validate permissions
        if is_borrower:
            if not eligibility.can_review_owner:
                raise ReviewNotEligibleError("Cannot review owner for this booking")
            review_type = ReviewType.BORROWER_TO_OWNER
            reviewer_id = user_id
            reviewee_id = booking.tool.owner_id
        else:
            if not eligibility.can_review_borrower:
                raise ReviewNotEligibleError("Cannot review borrower for this booking")
            review_type = ReviewType.OWNER_TO_BORROWER
            reviewer_id = user_id
            reviewee_id = booking.borrower_id
        
        # Check for duplicate review
        existing_review = await self._get_existing_review(
            review_data.booking_id, reviewer_id, review_type
        )
        if existing_review:
            raise DuplicateReviewError("Review already exists for this booking")
        
        # Validate tool condition rating (only for borrower reviews)
        if review_type == ReviewType.OWNER_TO_BORROWER and review_data.tool_condition_rating:
            raise ReviewError("Tool condition rating only allowed for borrower reviews")
        
        # Create review
        new_review = Review(
            booking_id=review_data.booking_id,
            reviewer_id=reviewer_id,
            reviewee_id=reviewee_id,
            rating=review_data.rating,
            title=review_data.title,
            comment=review_data.comment,
            tool_condition_rating=review_data.tool_condition_rating,
            review_type=review_type.value,
            is_approved=True  # Auto-approve for now
        )
        
        self.db.add(new_review)
        await self.db.commit()
        await self.db.refresh(new_review)
        
        # Update aggregated ratings
        await self._update_user_rating(reviewee_id)
        if review_type == ReviewType.BORROWER_TO_OWNER:
            await self._update_tool_rating(booking.tool_id)
        
        # Load relations for response
        review_with_relations = await self._get_review_with_relations(new_review.id)
        return self._create_review_response(review_with_relations)

    async def update_review(
        self,
        review_id: UUID,
        user_id: UUID,
        update_data: ReviewUpdateRequest
    ) -> ReviewResponse:
        """Update a review within edit window."""
        
        review = await self._get_review_with_relations(review_id)
        if not review:
            raise ReviewError("Review not found")
        
        # Check permission
        if review.reviewer_id != user_id:
            raise ReviewPermissionError("Can only update own reviews")
        
        # Check edit window
        edit_deadline = review.created_at + timedelta(hours=self.EDIT_WINDOW_HOURS)
        if datetime.utcnow() > edit_deadline:
            raise ReviewDeadlineExpiredError("Edit window has expired")
        
        # Update fields
        if update_data.rating is not None:
            review.rating = update_data.rating
        if update_data.title is not None:
            review.title = update_data.title
        if update_data.comment is not None:
            review.comment = update_data.comment
        if update_data.tool_condition_rating is not None:
            if review.review_type == ReviewType.OWNER_TO_BORROWER.value:
                raise ReviewError("Tool condition rating only allowed for borrower reviews")
            review.tool_condition_rating = update_data.tool_condition_rating
        
        review.updated_at = datetime.utcnow()
        
        await self.db.commit()
        await self.db.refresh(review)
        
        # Update aggregated ratings
        await self._update_user_rating(review.reviewee_id)
        if review.review_type == ReviewType.BORROWER_TO_OWNER.value:
            await self._update_tool_rating(review.booking.tool_id)
        
        return self._create_review_response(review)

    async def add_review_response(
        self,
        review_id: UUID,
        user_id: UUID,
        response_data: ReviewResponseRequest
    ) -> ReviewResponse:
        """Add response to a received review."""
        
        review = await self._get_review_with_relations(review_id)
        if not review:
            raise ReviewError("Review not found")
        
        # Check permission (only reviewee can respond)
        if review.reviewee_id != user_id:
            raise ReviewPermissionError("Can only respond to reviews about you")
        
        # Check if response already exists
        if review.response:
            raise ReviewError("Response already exists")
        
        # Add response
        review.response = response_data.response
        review.response_at = datetime.utcnow()
        review.updated_at = datetime.utcnow()
        
        await self.db.commit()
        await self.db.refresh(review)
        
        return self._create_review_response(review)

    async def flag_review(
        self,
        review_id: UUID,
        user_id: UUID,
        flag_data: ReviewFlagRequest
    ) -> UUID:
        """Flag a review for moderation."""
        
        review = await self._get_review_with_relations(review_id)
        if not review:
            raise ReviewError("Review not found")
        
        # Check permission (cannot flag own reviews)
        if review.reviewer_id == user_id:
            raise ReviewPermissionError("Cannot flag your own review")
        
        # Update review flag status
        review.is_flagged = True
        review.flagged_reason = flag_data.reason.value
        review.is_approved = False  # Pending moderation
        review.updated_at = datetime.utcnow()
        
        await self.db.commit()
        
        # Return a mock flag ID (in real system, would create separate flag record)
        return review.id

    async def check_review_eligibility(
        self,
        user_id: UUID,
        booking_id: UUID
    ) -> ReviewEligibilityResponse:
        """Check if user can create reviews for a booking."""
        
        booking = await self._get_booking_with_relations(booking_id)
        if not booking:
            raise ReviewError("Booking not found")
        
        is_borrower = booking.borrower_id == user_id
        is_owner = booking.tool.owner_id == user_id
        
        if not (is_borrower or is_owner):
            raise ReviewPermissionError("User is not participant in this booking")
        
        # Check booking completion
        booking_completed = booking.status == "completed"
        
        # Check review deadline
        review_deadline = None
        if booking.completed_at:
            review_deadline = booking.completed_at + timedelta(days=self.REVIEW_DEADLINE_DAYS)
            deadline_passed = datetime.utcnow() > review_deadline
        else:
            deadline_passed = True
        
        # Check existing reviews
        existing_reviews = await self._get_booking_reviews(booking_id)
        
        has_reviewed_owner = any(
            r.reviewer_id == user_id and r.review_type == ReviewType.BORROWER_TO_OWNER.value
            for r in existing_reviews
        )
        has_reviewed_borrower = any(
            r.reviewer_id == user_id and r.review_type == ReviewType.OWNER_TO_BORROWER.value
            for r in existing_reviews
        )
        
        # Determine permissions
        can_review_owner = (
            is_borrower and
            booking_completed and
            not deadline_passed and
            not has_reviewed_owner
        )
        
        can_review_borrower = (
            is_owner and
            booking_completed and
            not deadline_passed and
            not has_reviewed_borrower
        )
        
        # Generate message
        if not booking_completed:
            message = "Booking must be completed before reviews can be created"
        elif deadline_passed:
            message = "Review deadline has passed"
        elif has_reviewed_owner and has_reviewed_borrower:
            message = "All reviews already completed"
        elif not (can_review_owner or can_review_borrower):
            message = "No reviews available for this user"
        else:
            message = "Reviews available"
        
        return ReviewEligibilityResponse(
            can_review_owner=can_review_owner,
            can_review_borrower=can_review_borrower,
            review_deadline=review_deadline,
            has_reviewed_owner=has_reviewed_owner,
            has_reviewed_borrower=has_reviewed_borrower,
            booking_status=booking.status,
            message=message
        )

    async def get_booking_reviews(self, booking_id: UUID) -> MutualReviewStatus:
        """Get all reviews for a booking."""
        
        reviews = await self._get_booking_reviews(booking_id)
        
        borrower_review = None
        owner_review = None
        
        for review in reviews:
            if review.review_type == ReviewType.BORROWER_TO_OWNER.value:
                borrower_review = self._create_review_response(review)
            elif review.review_type == ReviewType.OWNER_TO_BORROWER.value:
                owner_review = self._create_review_response(review)
        
        booking = await self._get_booking_with_relations(booking_id)
        review_deadline = None
        if booking and booking.completed_at:
            review_deadline = booking.completed_at + timedelta(days=self.REVIEW_DEADLINE_DAYS)
        
        return MutualReviewStatus(
            booking_id=booking_id,
            borrower_review=borrower_review,
            owner_review=owner_review,
            both_reviewed=borrower_review is not None and owner_review is not None,
            review_deadline=review_deadline
        )

    async def get_user_reviews(
        self,
        user_id: UUID,
        filters: ReviewFilters,
        as_reviewer: bool = True
    ) -> PaginatedReviewResponse:
        """Get paginated reviews for a user (given or received)."""
        
        # Build base query
        query = select(Review).options(
            selectinload(Review.reviewer),
            selectinload(Review.reviewee),
            selectinload(Review.booking).selectinload(Booking.tool)
        )
        
        if as_reviewer:
            query = query.where(Review.reviewer_id == user_id)
        else:
            query = query.where(Review.reviewee_id == user_id)
        
        # Apply filters
        if filters.rating:
            query = query.where(Review.rating == filters.rating)
        if filters.review_type:
            query = query.where(Review.review_type == filters.review_type.value)
        if filters.is_flagged is not None:
            query = query.where(Review.is_flagged == filters.is_flagged)
        if filters.date_from:
            query = query.where(Review.created_at >= filters.date_from)
        if filters.date_to:
            query = query.where(Review.created_at <= filters.date_to)
        
        # Get total count
        count_query = select(func.count()).select_from(query.subquery())
        count_result = await self.db.execute(count_query)
        total = count_result.scalar()
        
        # Apply sorting
        if filters.sort == "rating":
            sort_column = Review.rating
        elif filters.sort == "updated_at":
            sort_column = Review.updated_at
        else:
            sort_column = Review.created_at
        
        if filters.order == "asc":
            query = query.order_by(asc(sort_column))
        else:
            query = query.order_by(desc(sort_column))
        
        # Apply pagination
        offset = (filters.page - 1) * filters.size
        query = query.offset(offset).limit(filters.size)
        
        # Execute query
        result = await self.db.execute(query)
        reviews = result.scalars().all()
        
        # Convert to list items
        review_items = [
            ReviewListItem(
                id=review.id,
                reviewer_name=review.reviewer.display_name,
                rating=review.rating,
                title=review.title,
                comment=review.comment,
                review_type=ReviewType(review.review_type),
                is_flagged=review.is_flagged,
                created_at=review.created_at
            )
            for review in reviews
        ]
        
        return PaginatedReviewResponse(
            items=review_items,
            total=total,
            page=filters.page,
            size=filters.size,
            pages=(total + filters.size - 1) // filters.size
        )

    async def get_tool_reviews(
        self,
        tool_id: UUID,
        filters: ReviewFilters
    ) -> ToolReviewSummary:
        """Get reviews for a specific tool."""
        
        # Get tool info
        tool_query = await self.db.execute(
            select(Tool).where(Tool.id == tool_id)
        )
        tool = tool_query.scalar_one_or_none()
        if not tool:
            raise ReviewError("Tool not found")
        
        # Build base query for tool reviews (borrower_to_owner type)
        query = select(Review).options(
            selectinload(Review.reviewer),
            selectinload(Review.reviewee),
            selectinload(Review.booking)
        ).join(Booking).where(
            and_(
                Booking.tool_id == tool_id,
                Review.review_type == ReviewType.BORROWER_TO_OWNER.value
            )
        )
        
        # Apply filters (similar to user reviews)
        if filters.rating:
            query = query.where(Review.rating == filters.rating)
        if filters.is_flagged is not None:
            query = query.where(Review.is_flagged == filters.is_flagged)
        
        # Get all reviews for statistics
        all_reviews_result = await self.db.execute(query)
        all_reviews = all_reviews_result.scalars().all()
        
        # Calculate statistics
        total_reviews = len(all_reviews)
        average_rating = Decimal('0.0')
        average_condition_rating = Decimal('0.0')
        rating_distribution = {"1": 0, "2": 0, "3": 0, "4": 0, "5": 0}
        
        if total_reviews > 0:
            total_rating = sum(r.rating for r in all_reviews)
            average_rating = Decimal(str(total_rating / total_reviews))
            
            condition_ratings = [r.tool_condition_rating for r in all_reviews if r.tool_condition_rating]
            if condition_ratings:
                average_condition_rating = Decimal(str(sum(condition_ratings) / len(condition_ratings)))
            
            for review in all_reviews:
                rating_distribution[str(review.rating)] += 1
        
        # Get recent reviews with pagination
        recent_query = query.order_by(desc(Review.created_at)).limit(filters.size)
        recent_result = await self.db.execute(recent_query)
        recent_reviews = recent_result.scalars().all()
        
        recent_review_items = [
            ReviewListItem(
                id=review.id,
                reviewer_name=review.reviewer.display_name,
                rating=review.rating,
                title=review.title,
                comment=review.comment,
                review_type=ReviewType(review.review_type),
                is_flagged=review.is_flagged,
                created_at=review.created_at
            )
            for review in recent_reviews
        ]
        
        return ToolReviewSummary(
            tool={"id": tool.id, "title": tool.title},
            total_reviews=total_reviews,
            average_rating=average_rating,
            average_condition_rating=average_condition_rating,
            rating_distribution=rating_distribution,
            recent_reviews=recent_review_items
        )

    async def get_review_statistics(self) -> ReviewStatistics:
        """Get platform-wide review statistics."""
        
        # Get total counts
        total_reviews_result = await self.db.execute(
            select(func.count(Review.id))
        )
        total_reviews = total_reviews_result.scalar()
        
        # Get average rating
        avg_rating_result = await self.db.execute(
            select(func.avg(Review.rating))
        )
        avg_rating = avg_rating_result.scalar() or Decimal('0.0')
        
        # Get rating distribution
        rating_dist_result = await self.db.execute(
            select(Review.rating, func.count(Review.id))
            .group_by(Review.rating)
        )
        rating_distribution = {}
        for rating, count in rating_dist_result:
            rating_distribution[str(rating)] = count
        
        # Fill missing ratings with 0
        for i in range(1, 6):
            if str(i) not in rating_distribution:
                rating_distribution[str(i)] = 0
        
        # Get review type counts
        tool_reviews_result = await self.db.execute(
            select(func.count(Review.id))
            .where(Review.review_type == ReviewType.BORROWER_TO_OWNER.value)
        )
        total_tool_reviews = tool_reviews_result.scalar()
        
        user_reviews_result = await self.db.execute(
            select(func.count(Review.id))
            .where(Review.review_type == ReviewType.OWNER_TO_BORROWER.value)
        )
        total_user_reviews = user_reviews_result.scalar()
        
        # Get flagged reviews count
        flagged_result = await self.db.execute(
            select(func.count(Review.id))
            .where(Review.is_flagged == True)
        )
        flagged_reviews = flagged_result.scalar()
        
        # Get pending moderation count
        pending_result = await self.db.execute(
            select(func.count(Review.id))
            .where(and_(Review.is_flagged == True, Review.is_approved == False))
        )
        pending_moderation = pending_result.scalar()
        
        return ReviewStatistics(
            total_reviews=total_reviews,
            average_rating=Decimal(str(avg_rating)),
            rating_distribution=rating_distribution,
            total_tool_reviews=total_tool_reviews,
            total_user_reviews=total_user_reviews,
            flagged_reviews=flagged_reviews,
            pending_moderation=pending_moderation
        )

    # Private helper methods

    async def _get_booking_with_relations(self, booking_id: UUID) -> Optional[Booking]:
        """Get booking with all related data."""
        query = select(Booking).options(
            selectinload(Booking.tool).selectinload(Tool.owner),
            selectinload(Booking.borrower)
        ).where(Booking.id == booking_id)
        
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def _get_review_with_relations(self, review_id: UUID) -> Optional[Review]:
        """Get review with all related data."""
        query = select(Review).options(
            selectinload(Review.reviewer),
            selectinload(Review.reviewee),
            selectinload(Review.booking).selectinload(Booking.tool)
        ).where(Review.id == review_id)
        
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def _get_existing_review(
        self, 
        booking_id: UUID, 
        reviewer_id: UUID, 
        review_type: ReviewType
    ) -> Optional[Review]:
        """Check if review already exists."""
        query = select(Review).where(
            and_(
                Review.booking_id == booking_id,
                Review.reviewer_id == reviewer_id,
                Review.review_type == review_type.value
            )
        )
        
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def _get_booking_reviews(self, booking_id: UUID) -> List[Review]:
        """Get all reviews for a booking."""
        query = select(Review).options(
            selectinload(Review.reviewer),
            selectinload(Review.reviewee),
            selectinload(Review.booking).selectinload(Booking.tool)
        ).where(Review.booking_id == booking_id)
        
        result = await self.db.execute(query)
        return result.scalars().all()

    async def _update_user_rating(self, user_id: UUID):
        """Update user's aggregated rating."""
        # Calculate average rating for reviews received
        avg_result = await self.db.execute(
            select(
                func.avg(Review.rating).label('avg_rating'),
                func.count(Review.id).label('total_reviews')
            )
            .where(Review.reviewee_id == user_id)
        )
        
        stats = avg_result.first()
        avg_rating = stats.avg_rating if stats.avg_rating else Decimal('0.0')
        total_reviews = stats.total_reviews
        
        # Update user record
        await self.db.execute(
            text("UPDATE users SET average_rating = :avg_rating, total_ratings = :total_reviews WHERE id = :user_id"),
            {
                "avg_rating": round(avg_rating, 2),
                "total_reviews": total_reviews,
                "user_id": str(user_id)
            }
        )

    async def _update_tool_rating(self, tool_id: UUID):
        """Update tool's aggregated rating."""
        # Calculate average rating from borrower reviews
        avg_result = await self.db.execute(
            select(
                func.avg(Review.rating).label('avg_rating'),
                func.count(Review.id).label('total_reviews')
            )
            .join(Booking, Review.booking_id == Booking.id)
            .where(
                and_(
                    Booking.tool_id == tool_id,
                    Review.review_type == ReviewType.BORROWER_TO_OWNER.value
                )
            )
        )
        
        stats = avg_result.first()
        avg_rating = stats.avg_rating if stats.avg_rating else Decimal('0.0')
        total_reviews = stats.total_reviews
        
        # Update tool record
        await self.db.execute(
            text("UPDATE tools SET average_rating = :avg_rating, total_ratings = :total_reviews WHERE id = :tool_id"),
            {
                "avg_rating": round(avg_rating, 2),
                "total_reviews": total_reviews,
                "tool_id": str(tool_id)
            }
        )

    def _create_review_response(self, review: Review) -> ReviewResponse:
        """Create review response with proper data mapping."""
        return ReviewResponse(
            id=review.id,
            booking={
                "id": review.booking.id,
                "requested_start_date": review.booking.requested_start_date,
                "requested_end_date": review.booking.requested_end_date
            },
            reviewer={
                "id": review.reviewer.id,
                "display_name": review.reviewer.display_name,
                "average_rating": review.reviewer.average_rating,
                "total_ratings": review.reviewer.total_ratings
            },
            reviewee={
                "id": review.reviewee.id,
                "display_name": review.reviewee.display_name,
                "average_rating": review.reviewee.average_rating,
                "total_ratings": review.reviewee.total_ratings
            },
            tool={
                "id": review.booking.tool.id,
                "title": review.booking.tool.title
            } if review.booking.tool else None,
            rating=review.rating,
            title=review.title,
            comment=review.comment,
            tool_condition_rating=review.tool_condition_rating,
            review_type=ReviewType(review.review_type),
            response=review.response,
            response_at=review.response_at,
            is_flagged=review.is_flagged,
            is_approved=review.is_approved,
            created_at=review.created_at,
            updated_at=review.updated_at
        )