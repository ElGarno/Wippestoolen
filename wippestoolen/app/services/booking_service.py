"""Booking service layer for business logic."""

from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import List, Optional, Dict, Any
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select, update, and_, or_, func, desc, asc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload, joinedload

from wippestoolen.app.models.booking import Booking, BookingStatusHistory
from wippestoolen.app.models.tool import Tool
from wippestoolen.app.models.user import User
from wippestoolen.app.schemas.booking import (
    BookingCreateSchema,
    BookingStatusUpdateSchema,
    BookingResponse,
    BookingSummary,
    BookingFilters,
    PaginatedBookingResponse,
    AvailabilityResult,
    AvailabilityCalendarDay,
    BookingCostCalculation,
    BookingCalendarResponse,
    BookingCalendarDay,
    DetailedBookingResponse
)


class BookingError(Exception):
    """Base booking exception."""
    pass


class BookingConflictError(BookingError):
    """Raised when booking conflicts with existing reservations."""
    pass


class InvalidStatusTransitionError(BookingError):
    """Raised when attempting invalid status transition."""
    pass


class BookingPermissionError(BookingError):
    """Raised when user lacks permission for booking operation."""
    pass


class ToolUnavailableError(BookingError):
    """Raised when tool is not available for booking."""
    pass


class BookingStatusMachine:
    """Manages valid booking status transitions."""
    
    VALID_TRANSITIONS = {
        'pending': ['confirmed', 'declined', 'cancelled'],
        'confirmed': ['active', 'cancelled'],
        'active': ['returned'],
        'returned': ['completed'],
        'declined': [],
        'cancelled': [],
        'completed': []
    }
    
    @classmethod
    def can_transition(cls, from_status: str, to_status: str) -> bool:
        """Check if status transition is valid."""
        return to_status in cls.VALID_TRANSITIONS.get(from_status, [])
    
    @classmethod
    def validate_transition_permission(
        cls, 
        booking: Booking, 
        user_id: UUID, 
        new_status: str
    ) -> bool:
        """Validate if user can perform status transition."""
        if new_status in ['confirmed', 'declined']:
            return user_id == booking.tool.owner_id
        elif new_status == 'cancelled' and booking.status == 'pending':
            return user_id == booking.borrower_id
        elif new_status in ['active', 'returned', 'cancelled']:
            return user_id in [booking.borrower_id, booking.tool.owner_id]
        return False


class BookingService:
    """Service for booking operations."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def create_booking_request(
        self, 
        borrower_id: UUID, 
        booking_data: BookingCreateSchema
    ) -> BookingResponse:
        """Create a new booking request with validation."""
        
        # Validate tool ownership - users cannot book their own tools
        tool = await self._get_tool_with_owner(booking_data.tool_id)
        if tool.owner_id == borrower_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot book your own tool"
            )
        
        # Check tool availability
        availability = await self.check_tool_availability(
            booking_data.tool_id,
            booking_data.requested_start_date,
            booking_data.requested_end_date
        )
        
        if not availability.is_available:
            raise BookingConflictError("Tool not available for requested dates")
        
        # Calculate booking costs
        cost_calc = await self.calculate_booking_cost(
            tool,
            booking_data.requested_start_date,
            booking_data.requested_end_date,
            booking_data.pickup_method
        )
        
        # Create booking
        booking = Booking(
            borrower_id=borrower_id,
            tool_id=booking_data.tool_id,
            requested_start_date=booking_data.requested_start_date,
            requested_end_date=booking_data.requested_end_date,
            borrower_message=booking_data.borrower_message,
            pickup_method=booking_data.pickup_method,
            pickup_address=booking_data.pickup_address,
            deposit_amount=cost_calc.deposit_amount,
            daily_rate=cost_calc.daily_rate,
            total_amount=cost_calc.total_amount,
            delivery_fee=cost_calc.delivery_fee,
            status='pending'
        )
        
        self.db.add(booking)
        await self.db.flush()
        
        # Create status history entry
        await self._create_status_history(
            booking.id,
            None,
            'pending',
            borrower_id,
            "Booking request created"
        )
        
        await self.db.commit()
        
        # Load relationships for response
        await self.db.refresh(booking)
        booking_with_relations = await self._get_booking_with_relations(booking.id)
        
        return self._create_booking_response(booking_with_relations, borrower_id)
    
    async def update_booking_status(
        self, 
        booking_id: UUID, 
        user_id: UUID, 
        status_update: BookingStatusUpdateSchema
    ) -> BookingResponse:
        """Update booking status with validation."""
        
        # Get booking with relationships
        booking = await self._get_booking_with_relations(booking_id)
        if not booking:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Booking not found"
            )
        
        # Validate status transition
        if not BookingStatusMachine.can_transition(booking.status, status_update.status):
            raise InvalidStatusTransitionError(
                f"Cannot transition from {booking.status} to {status_update.status}"
            )
        
        # Validate user permission
        if not BookingStatusMachine.validate_transition_permission(
            booking, user_id, status_update.status
        ):
            raise BookingPermissionError(
                f"User does not have permission to {status_update.status} this booking"
            )
        
        # Update booking
        old_status = booking.status
        booking.status = status_update.status
        
        # Set status-specific fields
        if status_update.status == 'confirmed':
            booking.confirmed_at = datetime.utcnow()
            booking.owner_response = status_update.owner_response
        elif status_update.status == 'declined':
            booking.owner_response = status_update.owner_response
        elif status_update.status == 'active':
            booking.started_at = datetime.utcnow()
            booking.actual_start_date = date.today()
            if status_update.pickup_notes:
                booking.pickup_notes = status_update.pickup_notes
        elif status_update.status == 'returned':
            booking.actual_end_date = date.today()
            if status_update.return_notes:
                booking.return_notes = status_update.return_notes
        elif status_update.status == 'cancelled':
            booking.cancelled_by = user_id
            booking.cancelled_at = datetime.utcnow()
            booking.cancellation_reason = status_update.cancellation_reason
        elif status_update.status == 'completed':
            booking.completed_at = datetime.utcnow()
        
        # Create status history entry
        await self._create_status_history(
            booking_id,
            old_status,
            status_update.status,
            user_id,
            status_update.owner_response or status_update.cancellation_reason
        )
        
        await self.db.commit()
        
        return self._create_booking_response(booking, user_id)
    
    async def get_booking(self, booking_id: UUID, user_id: UUID) -> DetailedBookingResponse:
        """Get detailed booking information."""
        
        booking = await self._get_booking_with_relations(booking_id)
        if not booking:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Booking not found"
            )
        
        # Verify user has access (borrower or tool owner)
        if user_id not in [booking.borrower_id, booking.tool.owner_id]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
        
        # Get status history
        history_query = select(BookingStatusHistory).options(
            joinedload(BookingStatusHistory.changed_by_user)
        ).where(BookingStatusHistory.booking_id == booking_id).order_by(
            BookingStatusHistory.created_at
        )
        
        history_result = await self.db.execute(history_query)
        status_history = history_result.scalars().all()
        
        # Create detailed response
        response = self._create_booking_response(booking, user_id)
        detailed_response = DetailedBookingResponse(**response.model_dump())
        
        # Add status history
        detailed_response.status_history = [
            {
                "id": h.id,
                "from_status": h.from_status,
                "to_status": h.to_status,
                "changed_by": {
                    "id": h.changed_by_user.id,
                    "username": h.changed_by_user.display_name,
                    "full_name": f"{h.changed_by_user.first_name or ''} {h.changed_by_user.last_name or ''}".strip() or None,
                    "rating": h.changed_by_user.average_rating
                },
                "reason": h.reason,
                "notes": h.notes,
                "created_at": h.created_at
            }
            for h in status_history
        ]
        
        # Set permission flags
        detailed_response.can_confirm = (
            booking.status == 'pending' and 
            user_id == booking.tool.owner_id
        )
        detailed_response.can_decline = (
            booking.status == 'pending' and 
            user_id == booking.tool.owner_id
        )
        detailed_response.can_cancel = (
            booking.status in ['pending', 'confirmed'] and
            user_id in [booking.borrower_id, booking.tool.owner_id]
        )
        detailed_response.can_pickup = (
            booking.status == 'confirmed' and
            user_id in [booking.borrower_id, booking.tool.owner_id]
        )
        detailed_response.can_return = (
            booking.status == 'active' and
            user_id in [booking.borrower_id, booking.tool.owner_id]
        )
        
        return detailed_response
    
    async def get_user_bookings(
        self, 
        user_id: UUID, 
        filters: BookingFilters
    ) -> PaginatedBookingResponse:
        """Get paginated list of user's bookings."""
        
        # Build base query
        query = select(Booking).options(
            joinedload(Booking.tool).joinedload(Tool.owner),
            joinedload(Booking.tool).joinedload(Tool.category),
            joinedload(Booking.borrower)
        )
        
        # Apply role filter
        if filters.role == 'borrower':
            query = query.where(Booking.borrower_id == user_id)
        elif filters.role == 'owner':
            query = query.join(Tool).where(Tool.owner_id == user_id)
        else:
            # Both roles
            query = query.join(Tool, Booking.tool_id == Tool.id).where(
                or_(
                    Booking.borrower_id == user_id,
                    Tool.owner_id == user_id
                )
            )
        
        # Apply status filter
        if filters.status:
            query = query.where(Booking.status == filters.status)
        
        # Count total results
        count_query = select(func.count()).select_from(query.subquery())
        count_result = await self.db.execute(count_query)
        total = count_result.scalar()
        
        # Apply sorting
        if filters.sort == 'created_at':
            sort_column = Booking.created_at
        elif filters.sort == 'start_date':
            sort_column = Booking.requested_start_date
        elif filters.sort == 'updated_at':
            sort_column = Booking.updated_at
        else:
            sort_column = Booking.created_at
        
        if filters.order == 'asc':
            query = query.order_by(asc(sort_column))
        else:
            query = query.order_by(desc(sort_column))
        
        # Apply pagination
        offset = (filters.page - 1) * filters.size
        query = query.offset(offset).limit(filters.size)
        
        # Execute query
        result = await self.db.execute(query)
        bookings = result.scalars().all()
        
        # Create summary responses
        booking_summaries = [
            BookingSummary(
                id=booking.id,
                tool={
                    "id": booking.tool.id,
                    "title": booking.tool.title,
                    "category": booking.tool.category.name,
                    "daily_rate": booking.tool.daily_rate,
                    "owner": {
                        "id": booking.tool.owner.id,
                        "username": booking.tool.owner.display_name,
                        "full_name": f"{booking.tool.owner.first_name or ''} {booking.tool.owner.last_name or ''}".strip() or None,
                        "rating": booking.tool.owner.average_rating
                    }
                },
                borrower={
                    "id": booking.borrower.id,
                    "username": booking.borrower.display_name,
                    "full_name": f"{booking.borrower.first_name or ''} {booking.borrower.last_name or ''}".strip() or None,
                    "rating": booking.borrower.average_rating
                },
                requested_start_date=booking.requested_start_date,
                requested_end_date=booking.requested_end_date,
                status=booking.status,
                total_amount=booking.total_amount,
                created_at=booking.created_at
            )
            for booking in bookings
        ]
        
        return PaginatedBookingResponse.create(
            booking_summaries, filters.page, filters.size, total
        )
    
    async def check_tool_availability(
        self, 
        tool_id: UUID, 
        start_date: date, 
        end_date: date,
        exclude_booking_id: Optional[UUID] = None
    ) -> AvailabilityResult:
        """Check if tool is available for given date range."""
        
        # Query for conflicting bookings
        query = select(Booking).where(
            and_(
                Booking.tool_id == tool_id,
                Booking.status.in_(['confirmed', 'active', 'returned']),
                or_(
                    and_(
                        Booking.requested_start_date <= end_date,
                        Booking.requested_end_date >= start_date
                    )
                )
            )
        )
        
        if exclude_booking_id:
            query = query.where(Booking.id != exclude_booking_id)
        
        result = await self.db.execute(query)
        conflicting_bookings = result.scalars().all()
        
        # Calculate next available date
        next_available_date = None
        if conflicting_bookings:
            # Find the earliest date after all conflicts
            max_end_date = max(b.requested_end_date for b in conflicting_bookings)
            next_available_date = max_end_date + timedelta(days=1)
        
        # Create calendar for the requested period
        calendar = []
        current_date = start_date
        while current_date <= end_date:
            booking_on_date = None
            for booking in conflicting_bookings:
                if booking.requested_start_date <= current_date <= booking.requested_end_date:
                    booking_on_date = booking.id
                    break
            
            calendar.append(AvailabilityCalendarDay(
                date=current_date,
                available=booking_on_date is None,
                booking_id=booking_on_date
            ))
            current_date += timedelta(days=1)
        
        return AvailabilityResult(
            tool_id=tool_id,
            is_available=len(conflicting_bookings) == 0,
            conflicting_bookings=[b.id for b in conflicting_bookings],
            next_available_date=next_available_date,
            calendar=calendar
        )
    
    async def get_booking_calendar(
        self, 
        user_id: UUID, 
        start_date: date, 
        end_date: date,
        role: Optional[str] = None
    ) -> BookingCalendarResponse:
        """Get user's booking calendar for date range."""
        
        # Build query based on role
        query = select(Booking).options(
            joinedload(Booking.tool).joinedload(Tool.owner),
            joinedload(Booking.borrower)
        ).where(
            and_(
                Booking.status.in_(['confirmed', 'active', 'returned']),
                or_(
                    and_(
                        Booking.requested_start_date <= end_date,
                        Booking.requested_end_date >= start_date
                    )
                )
            )
        )
        
        if role == 'borrower':
            query = query.where(Booking.borrower_id == user_id)
        elif role == 'owner':
            query = query.join(Tool).where(Tool.owner_id == user_id)
        else:
            query = query.where(
                or_(
                    Booking.borrower_id == user_id,
                    and_(Booking.tool_id == Tool.id, Tool.owner_id == user_id)
                )
            )
        
        result = await self.db.execute(query)
        bookings = result.scalars().all()
        
        # Create calendar
        calendar_dict = {}
        current_date = start_date
        
        while current_date <= end_date:
            calendar_dict[current_date] = []
            current_date += timedelta(days=1)
        
        # Add bookings to calendar
        for booking in bookings:
            booking_start = max(booking.requested_start_date, start_date)
            booking_end = min(booking.requested_end_date, end_date)
            
            booking_date = booking_start
            while booking_date <= booking_end:
                if booking_date in calendar_dict:
                    user_role = 'borrower' if booking.borrower_id == user_id else 'owner'
                    calendar_dict[booking_date].append({
                        "id": booking.id,
                        "tool": {
                            "id": booking.tool.id,
                            "title": booking.tool.title
                        },
                        "status": booking.status,
                        "role": user_role
                    })
                booking_date += timedelta(days=1)
        
        # Convert to response format
        calendar = [
            BookingCalendarDay(date=date_key, bookings=bookings_list)
            for date_key, bookings_list in sorted(calendar_dict.items())
        ]
        
        return BookingCalendarResponse(calendar=calendar)
    
    async def calculate_booking_cost(
        self, 
        tool: Tool, 
        start_date: date, 
        end_date: date,
        pickup_method: str
    ) -> BookingCostCalculation:
        """Calculate total booking cost."""
        
        num_days = (end_date - start_date).days + 1
        daily_rate = tool.daily_rate or Decimal('0.00')
        
        # Calculate base cost
        base_cost = daily_rate * num_days
        
        # Calculate deposit (50% of base cost)
        deposit_percentage = Decimal('0.50')
        deposit_amount = base_cost * deposit_percentage
        
        # Calculate delivery fee
        delivery_fee = Decimal('0.00')
        if pickup_method == 'delivery':
            delivery_fee = tool.delivery_fee or Decimal('5.00')
        
        total_amount = base_cost + delivery_fee
        
        return BookingCostCalculation(
            daily_rate=daily_rate,
            num_days=num_days,
            base_cost=base_cost,
            deposit_amount=deposit_amount,
            delivery_fee=delivery_fee,
            total_amount=total_amount
        )
    
    # Private helper methods
    
    async def _get_tool_with_owner(self, tool_id: UUID) -> Tool:
        """Get tool with owner information."""
        query = select(Tool).options(joinedload(Tool.owner)).where(Tool.id == tool_id)
        result = await self.db.execute(query)
        tool = result.scalar_one_or_none()
        
        if not tool:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Tool not found"
            )
        
        return tool
    
    async def _get_booking_with_relations(self, booking_id: UUID) -> Optional[Booking]:
        """Get booking with all related data."""
        query = select(Booking).options(
            joinedload(Booking.tool).joinedload(Tool.owner),
            joinedload(Booking.tool).joinedload(Tool.category),
            joinedload(Booking.borrower)
        ).where(Booking.id == booking_id)
        
        result = await self.db.execute(query)
        return result.scalar_one_or_none()
    
    async def _create_status_history(
        self, 
        booking_id: UUID, 
        from_status: Optional[str], 
        to_status: str, 
        user_id: UUID, 
        reason: Optional[str] = None
    ) -> None:
        """Create booking status history entry."""
        history = BookingStatusHistory(
            booking_id=booking_id,
            from_status=from_status,
            to_status=to_status,
            changed_by=user_id,
            reason=reason
        )
        self.db.add(history)
    
    def _create_booking_response(
        self, 
        booking: Booking, 
        current_user_id: UUID
    ) -> BookingResponse:
        """Create booking response with appropriate data visibility."""
        
        # Base response data
        response_data = {
            "id": booking.id,
            "tool": {
                "id": booking.tool.id,
                "title": booking.tool.title,
                "category": booking.tool.category.name,
                "daily_rate": booking.tool.daily_rate,
                "owner": {
                    "id": booking.tool.owner.id,
                    "username": booking.tool.owner.display_name,
                    "full_name": f"{booking.tool.owner.first_name or ''} {booking.tool.owner.last_name or ''}".strip() or None,
                    "rating": booking.tool.owner.average_rating
                }
            },
            "borrower": {
                "id": booking.borrower.id,
                "username": booking.borrower.display_name,
                "full_name": f"{booking.borrower.first_name or ''} {booking.borrower.last_name or ''}".strip() or None,
                "rating": booking.borrower.average_rating
            },
            "requested_start_date": booking.requested_start_date,
            "requested_end_date": booking.requested_end_date,
            "actual_start_date": booking.actual_start_date,
            "actual_end_date": booking.actual_end_date,
            "status": booking.status,
            "deposit_amount": booking.deposit_amount,
            "daily_rate": booking.daily_rate,
            "total_amount": booking.total_amount,
            "deposit_paid": booking.deposit_paid,
            "deposit_returned": booking.deposit_returned,
            "pickup_method": booking.pickup_method,
            "delivery_fee": booking.delivery_fee,
            "confirmed_at": booking.confirmed_at,
            "started_at": booking.started_at,
            "completed_at": booking.completed_at,
            "cancelled_at": booking.cancelled_at,
            "created_at": booking.created_at,
            "updated_at": booking.updated_at
        }
        
        # Add sensitive data only for involved parties
        if current_user_id in [booking.borrower_id, booking.tool.owner_id]:
            response_data.update({
                "borrower_message": booking.borrower_message,
                "owner_response": booking.owner_response,
                "pickup_notes": booking.pickup_notes,
                "return_notes": booking.return_notes,
                "pickup_address": booking.pickup_address,
                "cancellation_reason": booking.cancellation_reason,
                "tool_owner": {
                    "id": booking.tool.owner.id,
                    "username": booking.tool.owner.display_name,
                    "full_name": f"{booking.tool.owner.first_name or ''} {booking.tool.owner.last_name or ''}".strip() or None,
                    "rating": booking.tool.owner.average_rating
                }
            })
            
            # Add contact info only when booking is confirmed
            if booking.status in ['confirmed', 'active']:
                response_data["borrower"]["phone"] = booking.borrower.phone_number
                response_data["tool_owner"]["phone"] = booking.tool.owner.phone_number
        
        return BookingResponse(**response_data)