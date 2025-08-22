"""
Notification service layer for business logic and database operations.
"""

from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from uuid import UUID

from sqlalchemy import text, and_, or_, desc, asc, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload, joinedload
from sqlalchemy.future import select

from wippestoolen.app.models.notification import Notification, NotificationPreferences
from wippestoolen.app.models.user import User
from wippestoolen.app.models.booking import Booking
from wippestoolen.app.models.tool import Tool
from wippestoolen.app.schemas.notification import (
    NotificationCreateRequest,
    NotificationPreferencesUpdate,
    NotificationResponse,
    NotificationListItem,
    PaginatedNotificationResponse,
    NotificationPreferencesResponse,
    UnreadCountResponse,
    NotificationStatsResponse,
    NotificationFilters,
    BroadcastNotificationRequest,
    BroadcastResult,
    NotificationEvent,
    BookingNotificationEvent,
    ReviewNotificationEvent,
    NotificationType,
    NotificationChannel,
    NotificationPriority,
    NotificationTemplate
)


class NotificationError(Exception):
    """Base notification exception."""
    pass


class NotificationPermissionError(NotificationError):
    """Raised when user lacks permission for notification operation."""
    pass


class InvalidNotificationError(NotificationError):
    """Raised when notification data is invalid."""
    pass


class NotificationService:
    """Service class for notification operations."""

    # Notification templates
    TEMPLATES = {
        NotificationType.BOOKING_REQUEST: NotificationTemplate(
            type=NotificationType.BOOKING_REQUEST,
            title_template="New booking request for {{ tool_title }}",
            message_template="{{ borrower_name }} wants to borrow your {{ tool_title }} from {{ start_date }} to {{ end_date }}",
            channels=[NotificationChannel.IN_APP, NotificationChannel.EMAIL],
            priority=NotificationPriority.HIGH
        ),
        NotificationType.BOOKING_CONFIRMED: NotificationTemplate(
            type=NotificationType.BOOKING_CONFIRMED,
            title_template="Booking confirmed: {{ tool_title }}",
            message_template="Your booking request for {{ tool_title }} has been confirmed by {{ owner_name }}",
            channels=[NotificationChannel.IN_APP, NotificationChannel.EMAIL],
            priority=NotificationPriority.HIGH
        ),
        NotificationType.BOOKING_DECLINED: NotificationTemplate(
            type=NotificationType.BOOKING_DECLINED,
            title_template="Booking declined: {{ tool_title }}",
            message_template="Your booking request for {{ tool_title }} has been declined",
            channels=[NotificationChannel.IN_APP],
            priority=NotificationPriority.NORMAL
        ),
        NotificationType.BOOKING_CANCELLED: NotificationTemplate(
            type=NotificationType.BOOKING_CANCELLED,
            title_template="Booking cancelled: {{ tool_title }}",
            message_template="The booking for {{ tool_title }} has been cancelled",
            channels=[NotificationChannel.IN_APP, NotificationChannel.EMAIL],
            priority=NotificationPriority.HIGH
        ),
        NotificationType.BOOKING_ACTIVE: NotificationTemplate(
            type=NotificationType.BOOKING_ACTIVE,
            title_template="Tool picked up: {{ tool_title }}",
            message_template="{{ tool_title }} has been picked up and is now active",
            channels=[NotificationChannel.IN_APP],
            priority=NotificationPriority.NORMAL
        ),
        NotificationType.BOOKING_RETURNED: NotificationTemplate(
            type=NotificationType.BOOKING_RETURNED,
            title_template="Tool returned: {{ tool_title }}",
            message_template="{{ tool_title }} has been returned",
            channels=[NotificationChannel.IN_APP],
            priority=NotificationPriority.NORMAL
        ),
        NotificationType.BOOKING_COMPLETED: NotificationTemplate(
            type=NotificationType.BOOKING_COMPLETED,
            title_template="Booking completed: {{ tool_title }}",
            message_template="Your booking for {{ tool_title }} is now complete. You can leave a review!",
            channels=[NotificationChannel.IN_APP],
            priority=NotificationPriority.LOW
        ),
        NotificationType.REVIEW_AVAILABLE: NotificationTemplate(
            type=NotificationType.REVIEW_AVAILABLE,
            title_template="Review available: {{ tool_title }}",
            message_template="You can now review your experience with {{ tool_title }}",
            channels=[NotificationChannel.IN_APP],
            priority=NotificationPriority.LOW
        ),
        NotificationType.REVIEW_RECEIVED: NotificationTemplate(
            type=NotificationType.REVIEW_RECEIVED,
            title_template="New review received",
            message_template="{{ reviewer_name }} left you a {{ rating }}-star review",
            channels=[NotificationChannel.IN_APP, NotificationChannel.EMAIL],
            priority=NotificationPriority.NORMAL
        ),
        NotificationType.WELCOME: NotificationTemplate(
            type=NotificationType.WELCOME,
            title_template="Welcome to Wippestoolen!",
            message_template="Welcome {{ user_name }}! Start by adding your first tool or browsing available tools in your area.",
            channels=[NotificationChannel.IN_APP],
            priority=NotificationPriority.NORMAL
        )
    }

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_notification(
        self,
        recipient_id: UUID,
        notification_data: NotificationCreateRequest
    ) -> NotificationResponse:
        """Create a new notification."""
        
        # Verify recipient exists
        user_query = await self.db.execute(
            select(User).where(User.id == recipient_id)
        )
        user = user_query.scalar_one_or_none()
        if not user:
            raise InvalidNotificationError("Recipient not found")
        
        # Check user preferences
        preferences = await self.get_user_preferences(recipient_id)
        if not self._should_send_notification(notification_data.type, notification_data.channels, preferences):
            return None  # Skip notification based on preferences
        
        # Create notification
        notification = Notification(
            recipient_id=recipient_id,
            type=notification_data.type.value,
            title=notification_data.title,
            message=notification_data.message,
            data=notification_data.data,
            channels=",".join([ch.value for ch in notification_data.channels]),
            priority=notification_data.priority.value,
            expires_at=notification_data.expires_at
        )
        
        self.db.add(notification)
        await self.db.commit()
        await self.db.refresh(notification)
        
        # Convert to response
        return self._create_notification_response(notification)

    async def create_notification_from_event(
        self,
        event: NotificationEvent
    ) -> Optional[NotificationResponse]:
        """Create notification from event using templates."""
        
        template = self.TEMPLATES.get(event.type)
        if not template:
            raise InvalidNotificationError(f"No template found for notification type: {event.type}")
        
        # Render template with context
        rendered = template.render(event.context)
        
        # Use event channels or template defaults
        channels = event.channels or template.channels
        
        # Create notification request
        notification_request = NotificationCreateRequest(
            type=event.type,
            title=rendered['title'],
            message=rendered['message'],
            data=event.context,
            channels=channels,
            priority=event.priority
        )
        
        return await self.create_notification(event.recipient_id, notification_request)

    async def get_user_notifications(
        self,
        user_id: UUID,
        filters: NotificationFilters
    ) -> PaginatedNotificationResponse:
        """Get paginated notifications for a user."""
        
        # Build base query
        query = select(Notification).where(Notification.recipient_id == user_id)
        
        # Apply filters
        if filters.type:
            query = query.where(Notification.type == filters.type.value)
        if filters.is_read is not None:
            query = query.where(Notification.is_read == filters.is_read)
        if filters.priority:
            query = query.where(Notification.priority == filters.priority.value)
        if filters.date_from:
            query = query.where(Notification.created_at >= filters.date_from)
        if filters.date_to:
            query = query.where(Notification.created_at <= filters.date_to)
        
        # Filter out expired notifications
        query = query.where(
            or_(
                Notification.expires_at.is_(None),
                Notification.expires_at > datetime.utcnow()
            )
        )
        
        # Get total count and unread count
        count_query = select(func.count()).select_from(query.subquery())
        count_result = await self.db.execute(count_query)
        total = count_result.scalar()
        
        unread_query = select(func.count()).select_from(
            query.where(Notification.is_read == False).subquery()
        )
        unread_result = await self.db.execute(unread_query)
        unread_count = unread_result.scalar()
        
        # Apply sorting
        if filters.sort == "priority":
            sort_column = Notification.priority
        elif filters.sort == "type":
            sort_column = Notification.type
        else:
            sort_column = Notification.created_at
        
        if filters.order == "asc":
            query = query.order_by(asc(sort_column))
        else:
            query = query.order_by(desc(sort_column))
        
        # Apply pagination
        offset = (filters.page - 1) * filters.size
        query = query.offset(offset).limit(filters.size)
        
        # Execute query
        result = await self.db.execute(query)
        notifications = result.scalars().all()
        
        # Convert to list items
        notification_items = [
            NotificationListItem(
                id=notification.id,
                type=NotificationType(notification.type),
                title=notification.title,
                message=notification.message,
                priority=NotificationPriority(notification.priority),
                is_read=notification.is_read,
                created_at=notification.created_at,
                data=notification.data
            )
            for notification in notifications
        ]
        
        return PaginatedNotificationResponse(
            items=notification_items,
            total=total,
            unread_count=unread_count,
            page=filters.page,
            size=filters.size,
            pages=(total + filters.size - 1) // filters.size
        )

    async def mark_as_read(self, notification_id: UUID, user_id: UUID) -> NotificationResponse:
        """Mark a notification as read."""
        
        notification = await self._get_notification_by_id(notification_id)
        if not notification:
            raise InvalidNotificationError("Notification not found")
        
        # Check permission
        if notification.recipient_id != user_id:
            raise NotificationPermissionError("Can only mark own notifications as read")
        
        # Update notification
        notification.is_read = True
        notification.read_at = datetime.utcnow()
        
        await self.db.commit()
        await self.db.refresh(notification)
        
        return self._create_notification_response(notification)

    async def mark_all_as_read(self, user_id: UUID) -> int:
        """Mark all notifications as read for a user."""
        
        # Update all unread notifications
        update_result = await self.db.execute(
            text("""
                UPDATE notifications 
                SET is_read = true, read_at = CURRENT_TIMESTAMP 
                WHERE recipient_id = :user_id AND is_read = false
                RETURNING id
            """),
            {"user_id": str(user_id)}
        )
        
        updated_count = len(update_result.fetchall())
        await self.db.commit()
        
        return updated_count

    async def delete_notification(self, notification_id: UUID, user_id: UUID) -> bool:
        """Delete a notification."""
        
        notification = await self._get_notification_by_id(notification_id)
        if not notification:
            return False
        
        # Check permission
        if notification.recipient_id != user_id:
            raise NotificationPermissionError("Can only delete own notifications")
        
        await self.db.delete(notification)
        await self.db.commit()
        
        return True

    async def get_unread_count(self, user_id: UUID) -> UnreadCountResponse:
        """Get unread notification count for a user."""
        
        # Total unread count
        total_query = await self.db.execute(
            select(func.count())
            .select_from(Notification)
            .where(
                and_(
                    Notification.recipient_id == user_id,
                    Notification.is_read == False,
                    or_(
                        Notification.expires_at.is_(None),
                        Notification.expires_at > datetime.utcnow()
                    )
                )
            )
        )
        total_unread = total_query.scalar()
        
        # Count by type
        type_query = await self.db.execute(
            select(Notification.type, func.count())
            .where(
                and_(
                    Notification.recipient_id == user_id,
                    Notification.is_read == False,
                    or_(
                        Notification.expires_at.is_(None),
                        Notification.expires_at > datetime.utcnow()
                    )
                )
            )
            .group_by(Notification.type)
        )
        by_type = {row[0]: row[1] for row in type_query}
        
        # Count by priority
        priority_query = await self.db.execute(
            select(Notification.priority, func.count())
            .where(
                and_(
                    Notification.recipient_id == user_id,
                    Notification.is_read == False,
                    or_(
                        Notification.expires_at.is_(None),
                        Notification.expires_at > datetime.utcnow()
                    )
                )
            )
            .group_by(Notification.priority)
        )
        by_priority = {row[0]: row[1] for row in priority_query}
        
        return UnreadCountResponse(
            total_unread=total_unread,
            by_type=by_type,
            by_priority=by_priority
        )

    async def get_user_preferences(self, user_id: UUID) -> NotificationPreferencesResponse:
        """Get user notification preferences."""
        
        # Try to get existing preferences
        prefs_query = await self.db.execute(
            select(NotificationPreferences).where(NotificationPreferences.user_id == user_id)
        )
        prefs = prefs_query.scalar_one_or_none()
        
        # Create default preferences if not exists
        if not prefs:
            prefs = NotificationPreferences(
                user_id=user_id,
                in_app_enabled=True,
                email_enabled=True,
                push_enabled=False,
                booking_notifications=True,
                review_notifications=True,
                system_notifications=True,
                timezone="Europe/Berlin"
            )
            self.db.add(prefs)
            await self.db.commit()
            await self.db.refresh(prefs)
        
        return NotificationPreferencesResponse(
            id=prefs.id,
            user_id=prefs.user_id,
            in_app_enabled=prefs.in_app_enabled,
            email_enabled=prefs.email_enabled,
            push_enabled=prefs.push_enabled,
            booking_notifications=prefs.booking_notifications,
            review_notifications=prefs.review_notifications,
            system_notifications=prefs.system_notifications,
            quiet_hours_start=prefs.quiet_hours_start,
            quiet_hours_end=prefs.quiet_hours_end,
            timezone=prefs.timezone,
            created_at=prefs.created_at,
            updated_at=prefs.updated_at
        )

    async def update_user_preferences(
        self,
        user_id: UUID,
        updates: NotificationPreferencesUpdate
    ) -> NotificationPreferencesResponse:
        """Update user notification preferences."""
        
        # Get or create preferences
        prefs = await self.get_user_preferences(user_id)
        
        # Get the actual model instance
        prefs_query = await self.db.execute(
            select(NotificationPreferences).where(NotificationPreferences.user_id == user_id)
        )
        prefs_model = prefs_query.scalar_one()
        
        # Update fields
        if updates.in_app_enabled is not None:
            prefs_model.in_app_enabled = updates.in_app_enabled
        if updates.email_enabled is not None:
            prefs_model.email_enabled = updates.email_enabled
        if updates.push_enabled is not None:
            prefs_model.push_enabled = updates.push_enabled
        if updates.booking_notifications is not None:
            prefs_model.booking_notifications = updates.booking_notifications
        if updates.review_notifications is not None:
            prefs_model.review_notifications = updates.review_notifications
        if updates.system_notifications is not None:
            prefs_model.system_notifications = updates.system_notifications
        if updates.quiet_hours_start is not None:
            prefs_model.quiet_hours_start = updates.quiet_hours_start
        if updates.quiet_hours_end is not None:
            prefs_model.quiet_hours_end = updates.quiet_hours_end
        if updates.timezone is not None:
            prefs_model.timezone = updates.timezone
        
        prefs_model.updated_at = datetime.utcnow()
        
        await self.db.commit()
        await self.db.refresh(prefs_model)
        
        # Return updated preferences
        return await self.get_user_preferences(user_id)

    async def broadcast_notification(
        self,
        broadcast_request: BroadcastNotificationRequest
    ) -> BroadcastResult:
        """Send broadcast notification to multiple users."""
        
        # Build user query based on targeting options
        user_query = select(User.id).where(User.deleted_at.is_(None))
        
        if broadcast_request.active_users_only:
            user_query = user_query.where(User.is_active == True)
        if broadcast_request.verified_users_only:
            user_query = user_query.where(User.is_verified == True)
        if broadcast_request.min_registration_date:
            user_query = user_query.where(User.created_at >= broadcast_request.min_registration_date)
        if broadcast_request.target_users:
            user_query = user_query.where(User.id.in_(broadcast_request.target_users))
        
        # Get target users
        users_result = await self.db.execute(user_query)
        target_user_ids = [row[0] for row in users_result]
        
        # Create notifications for each user
        notifications = []
        sent_count = 0
        failed_count = 0
        
        for user_id in target_user_ids:
            try:
                notification_request = NotificationCreateRequest(
                    type=broadcast_request.type,
                    title=broadcast_request.title,
                    message=broadcast_request.message,
                    channels=broadcast_request.channels,
                    priority=broadcast_request.priority,
                    expires_at=broadcast_request.expires_at
                )
                
                notification = await self.create_notification(user_id, notification_request)
                if notification:
                    notifications.append(notification)
                    sent_count += 1
            except Exception:
                failed_count += 1
        
        # Generate broadcast ID
        from uuid import uuid4
        broadcast_id = uuid4()
        
        return BroadcastResult(
            broadcast_id=broadcast_id,
            title=broadcast_request.title,
            target_count=len(target_user_ids),
            sent_count=sent_count,
            failed_count=failed_count,
            created_at=datetime.utcnow()
        )

    async def cleanup_expired_notifications(self) -> int:
        """Clean up expired notifications."""
        
        delete_result = await self.db.execute(
            text("""
                DELETE FROM notifications 
                WHERE expires_at IS NOT NULL AND expires_at < CURRENT_TIMESTAMP
                RETURNING id
            """)
        )
        
        deleted_count = len(delete_result.fetchall())
        await self.db.commit()
        
        return deleted_count

    # Event-driven notification creation methods

    async def create_booking_notification(
        self,
        booking_event: BookingNotificationEvent
    ) -> Optional[NotificationResponse]:
        """Create booking-related notification."""
        return await self.create_notification_from_event(booking_event)

    async def create_review_notification(
        self,
        review_event: ReviewNotificationEvent
    ) -> Optional[NotificationResponse]:
        """Create review-related notification."""
        return await self.create_notification_from_event(review_event)

    async def create_welcome_notification(self, user_id: UUID, user_name: str) -> NotificationResponse:
        """Create welcome notification for new users."""
        event = NotificationEvent(
            type=NotificationType.WELCOME,
            recipient_id=user_id,
            context={"user_name": user_name},
            priority=NotificationPriority.NORMAL
        )
        return await self.create_notification_from_event(event)

    # Private helper methods

    async def _get_notification_by_id(self, notification_id: UUID) -> Optional[Notification]:
        """Get notification by ID."""
        query = select(Notification).where(Notification.id == notification_id)
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    def _should_send_notification(
        self,
        notification_type: NotificationType,
        channels: List[NotificationChannel],
        preferences: NotificationPreferencesResponse
    ) -> bool:
        """Check if notification should be sent based on user preferences."""
        
        # Check channel preferences
        for channel in channels:
            if channel == NotificationChannel.IN_APP and not preferences.in_app_enabled:
                continue
            elif channel == NotificationChannel.EMAIL and not preferences.email_enabled:
                continue
            elif channel == NotificationChannel.PUSH and not preferences.push_enabled:
                continue
            else:
                break  # At least one channel is enabled
        else:
            return False  # No channels enabled
        
        # Check type preferences
        if notification_type.value.startswith('booking_') and not preferences.booking_notifications:
            return False
        if notification_type.value.startswith('review_') and not preferences.review_notifications:
            return False
        if notification_type in [NotificationType.SYSTEM_ANNOUNCEMENT] and not preferences.system_notifications:
            return False
        
        return True

    def _create_notification_response(self, notification: Notification) -> NotificationResponse:
        """Create notification response from model."""
        return NotificationResponse(
            id=notification.id,
            recipient_id=notification.recipient_id,
            type=NotificationType(notification.type),
            title=notification.title,
            message=notification.message,
            data=notification.data,
            channels=[NotificationChannel(ch) for ch in notification.channels.split(',')],
            priority=NotificationPriority(notification.priority),
            is_read=notification.is_read,
            read_at=notification.read_at,
            created_at=notification.created_at,
            expires_at=notification.expires_at
        )