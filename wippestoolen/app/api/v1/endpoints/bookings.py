"""Booking endpoints for the API."""

import logging
from datetime import date
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from wippestoolen.app.api.v1.dependencies import get_current_active_user
from wippestoolen.app.core.database import get_db
from wippestoolen.app.models.user import User
from wippestoolen.app.schemas.booking import (
    BookingCreateSchema,
    BookingStatusUpdateSchema,
    BookingResponse,
    BookingFilters,
    PaginatedBookingResponse,
    AvailabilityResult,
    BookingCalendarResponse,
    DetailedBookingResponse,
    BookingCreatedResponse,
    BookingUpdatedResponse
)
from wippestoolen.app.schemas.notification import (
    BookingNotificationEvent,
    NotificationType,
    NotificationPriority,
    NotificationChannel,
)
from wippestoolen.app.services.booking_service import (
    BookingService,
    BookingConflictError,
    InvalidStatusTransitionError,
    BookingPermissionError,
    ToolUnavailableError
)
from wippestoolen.app.services.notification_service import NotificationService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/bookings", tags=["bookings"])


async def _notify_booking_event(
    db: AsyncSession,
    recipient_id: UUID,
    notification_type: NotificationType,
    priority: NotificationPriority,
    booking_id: UUID,
    booking_status: str,
    tool_title: str,
    context: dict,
    channels: Optional[list] = None,
) -> None:
    """Send a booking event notification, swallowing errors to avoid disrupting the main flow."""
    try:
        notification_service = NotificationService(db)
        event = BookingNotificationEvent(
            type=notification_type,
            recipient_id=recipient_id,
            context=context,
            priority=priority,
            channels=channels or [NotificationChannel.IN_APP],
            booking_id=booking_id,
            booking_status=booking_status,
            tool_title=tool_title,
        )
        await notification_service.create_booking_notification(event)
    except Exception:
        logger.warning(
            "Failed to create booking notification type=%s booking_id=%s",
            notification_type,
            booking_id,
            exc_info=True,
        )


@router.post("", response_model=BookingCreatedResponse, status_code=status.HTTP_201_CREATED)
async def create_booking(
    booking_data: BookingCreateSchema,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new booking request.

    Creates a booking request from a borrower to a tool owner.
    The tool owner will need to confirm or decline the request.

    - **tool_id**: ID of the tool to book
    - **requested_start_date**: Start date for the booking
    - **requested_end_date**: End date for the booking
    - **borrower_message**: Optional message to the tool owner
    - **pickup_method**: Either 'pickup' or 'delivery'
    - **pickup_address**: Required if pickup_method is 'delivery'
    """
    booking_service = BookingService(db)

    try:
        booking = await booking_service.create_booking_request(
            borrower_id=current_user.id,
            booking_data=booking_data
        )

        # Notify the tool owner that someone wants to borrow their tool
        tool_info = booking.tool
        owner_id = tool_info.owner.id
        tool_title = tool_info.title
        borrower_name = (
            current_user.display_name
            or f"{current_user.first_name or ''} {current_user.last_name or ''}".strip()
            or current_user.email
        )
        await _notify_booking_event(
            db=db,
            recipient_id=owner_id,
            notification_type=NotificationType.BOOKING_REQUEST,
            priority=NotificationPriority.HIGH,
            booking_id=booking.id,
            booking_status="pending",
            tool_title=tool_title,
            context={
                "booking_id": str(booking.id),
                "tool_id": str(tool_info.id),
                "borrower_name": borrower_name,
                "tool_title": tool_title,
                "start_date": str(booking.requested_start_date),
                "end_date": str(booking.requested_end_date),
            },
        )

        return BookingCreatedResponse(
            booking=booking,
            message="Booking request created successfully"
        )

    except BookingConflictError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e)
        )
    except ToolUnavailableError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("", response_model=PaginatedBookingResponse)
async def list_bookings(
    role: Optional[str] = Query(None, description="Filter by role: 'borrower' or 'owner'"),
    status: Optional[str] = Query(None, description="Filter by status"),
    page: int = Query(1, ge=1, description="Page number"),
    size: int = Query(20, ge=1, le=100, description="Page size"),
    sort: str = Query("created_at", description="Sort field: created_at, start_date, updated_at"),
    order: str = Query("desc", description="Sort order: asc or desc"),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get user's bookings with filtering and pagination.

    Returns a paginated list of bookings where the user is either the borrower or tool owner.

    **Query Parameters:**
    - **role**: Filter by user role in booking ('borrower' or 'owner')
    - **status**: Filter by booking status (pending, confirmed, active, etc.)
    - **page**: Page number (starts from 1)
    - **size**: Number of items per page (max 100)
    - **sort**: Sort by field (created_at, start_date, updated_at)
    - **order**: Sort order (asc or desc)
    """
    booking_service = BookingService(db)

    # Validate sort and order parameters
    valid_sorts = ['created_at', 'start_date', 'updated_at']
    valid_orders = ['asc', 'desc']
    valid_roles = ['borrower', 'owner']

    if sort not in valid_sorts:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid sort field. Must be one of: {', '.join(valid_sorts)}"
        )

    if order not in valid_orders:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid order. Must be one of: {', '.join(valid_orders)}"
        )

    if role and role not in valid_roles:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role. Must be one of: {', '.join(valid_roles)}"
        )

    filters = BookingFilters(
        role=role,
        status=status,
        page=page,
        size=size,
        sort=sort,
        order=order
    )

    return await booking_service.get_user_bookings(current_user.id, filters)


@router.get("/calendar", response_model=BookingCalendarResponse)
async def get_booking_calendar(
    start_date: date = Query(..., description="Start date for calendar"),
    end_date: date = Query(..., description="End date for calendar"),
    role: Optional[str] = Query(None, description="Filter by role: 'borrower' or 'owner'"),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get user's booking calendar for a date range.

    Returns bookings organized by date for calendar display.
    Useful for showing user's upcoming bookings and schedule conflicts.

    **Query Parameters:**
    - **start_date**: Start date for the calendar view (YYYY-MM-DD)
    - **end_date**: End date for the calendar view (YYYY-MM-DD)
    - **role**: Filter by user role ('borrower' or 'owner')
    """
    # Validate date range
    if end_date < start_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="End date must be after start date"
        )

    # Limit calendar range to prevent excessive queries
    from datetime import timedelta
    max_range = timedelta(days=365)
    if (end_date - start_date) > max_range:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Date range cannot exceed 365 days"
        )

    valid_roles = ['borrower', 'owner']
    if role and role not in valid_roles:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role. Must be one of: {', '.join(valid_roles)}"
        )

    booking_service = BookingService(db)

    return await booking_service.get_booking_calendar(
        user_id=current_user.id,
        start_date=start_date,
        end_date=end_date,
        role=role
    )


# Tool availability endpoints
@router.get("/tools/{tool_id}/availability", response_model=AvailabilityResult)
async def check_tool_availability(
    tool_id: UUID,
    start_date: date = Query(..., description="Start date to check"),
    end_date: date = Query(..., description="End date to check"),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Check tool availability for a date range.

    Returns availability information including:
    - Whether the tool is available for the entire date range
    - Any conflicting bookings
    - Next available date if tool is booked
    - Day-by-day availability calendar

    **Path Parameters:**
    - **tool_id**: ID of the tool to check

    **Query Parameters:**
    - **start_date**: Start date to check (YYYY-MM-DD)
    - **end_date**: End date to check (YYYY-MM-DD)
    """
    # Validate date range
    if end_date < start_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="End date must be after start date"
        )

    # Limit availability check range
    from datetime import timedelta
    max_range = timedelta(days=90)
    if (end_date - start_date) > max_range:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Date range cannot exceed 90 days"
        )

    booking_service = BookingService(db)

    return await booking_service.check_tool_availability(
        tool_id=tool_id,
        start_date=start_date,
        end_date=end_date
    )


@router.get("/{booking_id}", response_model=DetailedBookingResponse)
async def get_booking(
    booking_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get detailed booking information.

    Returns comprehensive booking details including status history and available actions.
    Only accessible by the borrower or tool owner.
    """
    booking_service = BookingService(db)

    return await booking_service.get_booking(booking_id, current_user.id)


@router.patch("/{booking_id}/status", response_model=BookingUpdatedResponse)
async def update_booking_status(
    booking_id: UUID,
    status_update: BookingStatusUpdateSchema,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Update booking status.

    Updates the booking status through valid state transitions:
    - **pending** → confirmed (tool owner only)
    - **pending** → declined (tool owner only)
    - **pending** → cancelled (borrower only)
    - **confirmed** → active (either party)
    - **confirmed** → cancelled (either party)
    - **active** → returned (either party)
    - **returned** → completed (automatic after both parties confirm)
    """
    booking_service = BookingService(db)

    try:
        booking = await booking_service.update_booking_status(
            booking_id=booking_id,
            user_id=current_user.id,
            status_update=status_update
        )

        # Send in-app notification based on new status
        tool_info = booking.tool
        tool_title = tool_info.title
        owner_id = tool_info.owner.id
        borrower_id = booking.borrower.id

        _NOTIFY_MAP = {
            "confirmed": (
                borrower_id,
                NotificationType.BOOKING_CONFIRMED,
                NotificationPriority.HIGH,
                {
                    "tool_title": tool_title,
                    "owner_name": tool_info.owner.display_name,
                    "booking_id": str(booking_id),
                    "tool_id": str(tool_info.id),
                },
            ),
            "declined": (
                borrower_id,
                NotificationType.BOOKING_DECLINED,
                NotificationPriority.NORMAL,
                {
                    "tool_title": tool_title,
                    "booking_id": str(booking_id),
                    "tool_id": str(tool_info.id),
                },
            ),
            "cancelled": (
                owner_id,
                NotificationType.BOOKING_CANCELLED,
                NotificationPriority.HIGH,
                {
                    "tool_title": tool_title,
                    "borrower_name": booking.borrower.display_name,
                    "booking_id": str(booking_id),
                    "tool_id": str(tool_info.id),
                },
            ),
        }

        if status_update.status in _NOTIFY_MAP:
            recipient_id, n_type, n_priority, context = _NOTIFY_MAP[status_update.status]
            await _notify_booking_event(
                db=db,
                recipient_id=recipient_id,
                notification_type=n_type,
                priority=n_priority,
                booking_id=booking_id,
                booking_status=status_update.status,
                tool_title=tool_title,
                context=context,
            )

        return BookingUpdatedResponse(
            booking=booking,
            message=f"Booking status updated to {status_update.status}"
        )

    except InvalidStatusTransitionError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except BookingPermissionError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )


# Booking actions for convenience
@router.post("/{booking_id}/confirm", response_model=BookingUpdatedResponse)
async def confirm_booking(
    booking_id: UUID,
    owner_response: Optional[str] = Query(None, max_length=500, description="Optional response message"),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Confirm a pending booking request.
    
    Convenience endpoint for tool owners to confirm booking requests.
    Equivalent to updating status to 'confirmed'.
    """
    status_update = BookingStatusUpdateSchema(
        status='confirmed',
        owner_response=owner_response
    )
    
    booking_service = BookingService(db)

    try:
        booking = await booking_service.update_booking_status(
            booking_id=booking_id,
            user_id=current_user.id,
            status_update=status_update
        )

        tool_info = booking.tool
        await _notify_booking_event(
            db=db,
            recipient_id=booking.borrower.id,
            notification_type=NotificationType.BOOKING_CONFIRMED,
            priority=NotificationPriority.HIGH,
            booking_id=booking_id,
            booking_status="confirmed",
            tool_title=tool_info.title,
            context={
                "tool_title": tool_info.title,
                "owner_name": tool_info.owner.display_name,
                "booking_id": str(booking_id),
                "tool_id": str(tool_info.id),
            },
        )

        return BookingUpdatedResponse(
            booking=booking,
            message="Booking confirmed successfully"
        )

    except InvalidStatusTransitionError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except BookingPermissionError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )


@router.post("/{booking_id}/decline", response_model=BookingUpdatedResponse)
async def decline_booking(
    booking_id: UUID,
    owner_response: Optional[str] = Query(None, max_length=500, description="Optional response message"),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Decline a pending booking request.

    Convenience endpoint for tool owners to decline booking requests.
    Equivalent to updating status to 'declined'.
    """
    status_update = BookingStatusUpdateSchema(
        status='declined',
        owner_response=owner_response
    )

    booking_service = BookingService(db)

    try:
        booking = await booking_service.update_booking_status(
            booking_id=booking_id,
            user_id=current_user.id,
            status_update=status_update
        )

        tool_info = booking.tool
        await _notify_booking_event(
            db=db,
            recipient_id=booking.borrower.id,
            notification_type=NotificationType.BOOKING_DECLINED,
            priority=NotificationPriority.NORMAL,
            booking_id=booking_id,
            booking_status="declined",
            tool_title=tool_info.title,
            context={
                "tool_title": tool_info.title,
                "booking_id": str(booking_id),
                "tool_id": str(tool_info.id),
            },
        )

        return BookingUpdatedResponse(
            booking=booking,
            message="Booking declined"
        )

    except InvalidStatusTransitionError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except BookingPermissionError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )


@router.post("/{booking_id}/cancel", response_model=BookingUpdatedResponse)
async def cancel_booking(
    booking_id: UUID,
    cancellation_reason: Optional[str] = Query(None, max_length=500, description="Reason for cancellation"),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Cancel a booking.

    Allows borrowers to cancel pending bookings or either party to cancel confirmed bookings.
    Equivalent to updating status to 'cancelled'.
    """
    status_update = BookingStatusUpdateSchema(
        status='cancelled',
        cancellation_reason=cancellation_reason
    )

    booking_service = BookingService(db)

    try:
        booking = await booking_service.update_booking_status(
            booking_id=booking_id,
            user_id=current_user.id,
            status_update=status_update
        )

        tool_info = booking.tool
        await _notify_booking_event(
            db=db,
            recipient_id=tool_info.owner.id,
            notification_type=NotificationType.BOOKING_CANCELLED,
            priority=NotificationPriority.HIGH,
            booking_id=booking_id,
            booking_status="cancelled",
            tool_title=tool_info.title,
            context={
                "tool_title": tool_info.title,
                "borrower_name": booking.borrower.display_name,
                "booking_id": str(booking_id),
                "tool_id": str(tool_info.id),
            },
        )

        return BookingUpdatedResponse(
            booking=booking,
            message="Booking cancelled"
        )

    except InvalidStatusTransitionError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except BookingPermissionError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )


@router.post("/{booking_id}/pickup", response_model=BookingUpdatedResponse)
async def mark_booking_pickup(
    booking_id: UUID,
    pickup_notes: Optional[str] = Query(None, max_length=500, description="Optional pickup notes"),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Mark booking as picked up (active).
    
    Updates booking status to 'active' when the tool has been picked up.
    Can be done by either the borrower or tool owner.
    """
    status_update = BookingStatusUpdateSchema(
        status='active',
        pickup_notes=pickup_notes
    )
    
    booking_service = BookingService(db)
    
    try:
        booking = await booking_service.update_booking_status(
            booking_id=booking_id,
            user_id=current_user.id,
            status_update=status_update
        )
        
        return BookingUpdatedResponse(
            booking=booking,
            message="Tool marked as picked up"
        )
        
    except InvalidStatusTransitionError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except BookingPermissionError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )


@router.post("/{booking_id}/return", response_model=BookingUpdatedResponse)
async def mark_booking_return(
    booking_id: UUID,
    return_notes: Optional[str] = Query(None, max_length=500, description="Optional return notes"),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Mark booking as returned.
    
    Updates booking status to 'returned' when the tool has been returned.
    Can be done by either the borrower or tool owner.
    """
    booking_service = BookingService(db)

    try:
        # First transition to returned
        status_update = BookingStatusUpdateSchema(
            status='returned',
            return_notes=return_notes
        )
        booking = await booking_service.update_booking_status(
            booking_id=booking_id,
            user_id=current_user.id,
            status_update=status_update
        )

        # Auto-complete: transition returned → completed for MVP
        try:
            complete_update = BookingStatusUpdateSchema(status='completed')
            booking = await booking_service.update_booking_status(
                booking_id=booking_id,
                user_id=current_user.id,
                status_update=complete_update
            )
        except Exception:
            pass  # If auto-complete fails, stay in returned state

        return BookingUpdatedResponse(
            booking=booking,
            message="Tool marked as returned"
        )
        
    except InvalidStatusTransitionError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except BookingPermissionError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )