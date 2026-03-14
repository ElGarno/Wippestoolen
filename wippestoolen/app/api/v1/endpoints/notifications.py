"""Notification endpoints for the API."""

from datetime import datetime
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from wippestoolen.app.api.v1.dependencies import get_current_active_user
from wippestoolen.app.core.database import get_db
from wippestoolen.app.models.user import User
from wippestoolen.app.schemas.notification import (
    NotificationCreateRequest,
    NotificationPreferencesUpdate,
    NotificationResponse,
    NotificationFilters,
    PaginatedNotificationResponse,
    NotificationPreferencesResponse,
    UnreadCountResponse,
    BroadcastNotificationRequest,
    BroadcastResult,
    NotificationCreatedResponse,
    NotificationUpdatedResponse,
    PreferencesUpdatedResponse,
    BulkReadResponse,
    NotificationWebSocketMessage,
    UnreadCountWebSocketMessage,
    ConnectionStatusMessage
)
from wippestoolen.app.services.notification_service import (
    NotificationService,
    NotificationError,
    NotificationPermissionError,
    InvalidNotificationError
)
from wippestoolen.app.services.push_service import PushService

router = APIRouter(prefix="/notifications", tags=["notifications"])

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[UUID, WebSocket] = {}

    async def connect(self, websocket: WebSocket, user_id: UUID):
        await websocket.accept()
        self.active_connections[user_id] = websocket

    def disconnect(self, user_id: UUID):
        if user_id in self.active_connections:
            del self.active_connections[user_id]

    async def send_personal_message(self, message: dict, user_id: UUID):
        if user_id in self.active_connections:
            try:
                await self.active_connections[user_id].send_json(message)
            except Exception:
                # Connection closed, remove it
                self.disconnect(user_id)

    async def send_to_all(self, message: dict):
        disconnected = []
        for user_id, connection in self.active_connections.items():
            try:
                await connection.send_json(message)
            except Exception:
                disconnected.append(user_id)
        
        # Clean up disconnected connections
        for user_id in disconnected:
            self.disconnect(user_id)

manager = ConnectionManager()


@router.get("", response_model=PaginatedNotificationResponse)
async def get_notifications(
    type: Optional[str] = Query(None, description="Filter by notification type"),
    is_read: Optional[bool] = Query(None, description="Filter by read status"),
    priority: Optional[str] = Query(None, description="Filter by priority"),
    date_from: Optional[datetime] = Query(None, description="Filter from date"),
    date_to: Optional[datetime] = Query(None, description="Filter to date"),
    page: int = Query(1, ge=1, description="Page number"),
    size: int = Query(20, ge=1, le=100, description="Page size"),
    sort: str = Query("created_at", pattern="^(created_at|priority|type)$"),
    order: str = Query("desc", pattern="^(asc|desc)$"),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get user's notifications with filtering and pagination.
    
    Returns a paginated list of notifications for the authenticated user.
    
    **Query Parameters:**
    - **type**: Filter by notification type (booking_request, review_available, etc.)
    - **is_read**: Filter by read status (true/false)
    - **priority**: Filter by priority (low, normal, high, urgent)
    - **date_from**: Filter notifications from this date
    - **date_to**: Filter notifications to this date
    - **page**: Page number (starts from 1)
    - **size**: Number of items per page (max 100)
    - **sort**: Sort by field (created_at, priority, type)
    - **order**: Sort order (asc or desc)
    """
    notification_service = NotificationService(db)
    
    # Convert string enums if provided
    from wippestoolen.app.schemas.notification import NotificationType, NotificationPriority
    
    notification_type = None
    if type:
        try:
            notification_type = NotificationType(type)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid notification type: {type}"
            )
    
    notification_priority = None
    if priority:
        try:
            notification_priority = NotificationPriority(priority)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid priority: {priority}"
            )
    
    filters = NotificationFilters(
        type=notification_type,
        is_read=is_read,
        priority=notification_priority,
        date_from=date_from,
        date_to=date_to,
        page=page,
        size=size,
        sort=sort,
        order=order
    )
    
    try:
        return await notification_service.get_user_notifications(current_user.id, filters)
    except NotificationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/unread-count", response_model=UnreadCountResponse)
async def get_unread_count(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get unread notification count for the current user.
    
    Returns counts broken down by type and priority.
    Useful for notification badges and dashboard widgets.
    """
    notification_service = NotificationService(db)
    
    try:
        return await notification_service.get_unread_count(current_user.id)
    except NotificationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.patch("/{notification_id}/read", response_model=NotificationUpdatedResponse)
async def mark_notification_read(
    notification_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Mark a specific notification as read.
    
    Updates the notification's read status and sets the read timestamp.
    Only the notification recipient can mark it as read.
    """
    notification_service = NotificationService(db)
    
    try:
        notification = await notification_service.mark_as_read(notification_id, current_user.id)
        
        # Send real-time update if user is connected
        unread_count = await notification_service.get_unread_count(current_user.id)
        await manager.send_personal_message(
            UnreadCountWebSocketMessage(
                type="unread_count",
                data=unread_count
            ).dict(),
            current_user.id
        )
        
        return NotificationUpdatedResponse(
            notification=notification,
            message="Notification marked as read"
        )
        
    except NotificationPermissionError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )
    except InvalidNotificationError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except NotificationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.patch("/read-all", response_model=BulkReadResponse)
async def mark_all_notifications_read(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Mark all notifications as read for the current user.
    
    Bulk operation that updates all unread notifications.
    Returns the count of notifications that were updated.
    """
    notification_service = NotificationService(db)
    
    try:
        updated_count = await notification_service.mark_all_as_read(current_user.id)
        
        # Send real-time update if user is connected
        unread_count = await notification_service.get_unread_count(current_user.id)
        await manager.send_personal_message(
            UnreadCountWebSocketMessage(
                type="unread_count",
                data=unread_count
            ).dict(),
            current_user.id
        )
        
        return BulkReadResponse(
            updated_count=updated_count,
            message=f"Marked {updated_count} notifications as read"
        )
        
    except NotificationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.delete("/{notification_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_notification(
    notification_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Delete a specific notification.
    
    Permanently removes the notification from the user's inbox.
    Only the notification recipient can delete it.
    """
    notification_service = NotificationService(db)
    
    try:
        success = await notification_service.delete_notification(notification_id, current_user.id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Notification not found"
            )
        
        # Send real-time update if user is connected
        unread_count = await notification_service.get_unread_count(current_user.id)
        await manager.send_personal_message(
            UnreadCountWebSocketMessage(
                type="unread_count",
                data=unread_count
            ).dict(),
            current_user.id
        )
        
    except NotificationPermissionError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )
    except NotificationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/preferences", response_model=NotificationPreferencesResponse)
async def get_notification_preferences(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get user's notification preferences.
    
    Returns detailed preferences including channel settings,
    notification type preferences, and quiet hours.
    """
    notification_service = NotificationService(db)
    
    try:
        return await notification_service.get_user_preferences(current_user.id)
    except NotificationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.patch("/preferences", response_model=PreferencesUpdatedResponse)
async def update_notification_preferences(
    updates: NotificationPreferencesUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Update user's notification preferences.
    
    Allows users to customize their notification experience including:
    - Channel preferences (in-app, email, push)
    - Notification type preferences (booking, review, system)
    - Quiet hours settings
    - Timezone preferences
    """
    notification_service = NotificationService(db)
    
    try:
        preferences = await notification_service.update_user_preferences(current_user.id, updates)
        
        return PreferencesUpdatedResponse(
            preferences=preferences,
            message="Notification preferences updated successfully"
        )
        
    except NotificationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


# Admin endpoints

@router.post("/admin/broadcast", response_model=BroadcastResult)
async def broadcast_notification(
    broadcast_request: BroadcastNotificationRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Send a broadcast notification to multiple users (Admin only).
    
    Creates notifications for multiple users based on targeting criteria.
    Supports filtering by user status, verification, registration date, etc.
    
    **Admin permissions required.**
    """
    # TODO: Add admin permission check
    # if not current_user.is_admin:
    #     raise HTTPException(
    #         status_code=status.HTTP_403_FORBIDDEN,
    #         detail="Admin permissions required"
    #     )
    
    notification_service = NotificationService(db)
    
    try:
        result = await notification_service.broadcast_notification(broadcast_request)
        
        # Send real-time updates to all affected users
        # This would typically be handled by a background job
        
        return result
        
    except NotificationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


# WebSocket endpoint for real-time notifications

@router.websocket("/ws")
async def websocket_notifications(
    websocket: WebSocket,
    token: str = Query(..., description="JWT access token"),
    db: AsyncSession = Depends(get_db)
):
    """
    WebSocket endpoint for real-time notification delivery.
    
    Establishes a WebSocket connection for receiving real-time notifications.
    Requires JWT authentication via query parameter.
    
    **Connection URL**: `ws://api/v1/notifications/ws?token=<jwt_token>`
    
    **Message Types**:
    - `notification`: New notification received
    - `unread_count`: Updated unread count
    - `connection_status`: Connection status updates
    """
    try:
        # Authenticate user via token
        from wippestoolen.app.core.security import verify_token
        from wippestoolen.app.services.auth_service import AuthService

        try:
            payload = verify_token(token)
            if payload is None:
                await websocket.close(code=4001, reason="Invalid token")
                return
            user_id = UUID(payload.get("sub"))
            
            # Verify user exists and is active
            auth_service = AuthService(db)
            user = await auth_service.get_user_by_id(user_id)
            if not user or not user.is_active:
                await websocket.close(code=4001, reason="Invalid user")
                return
                
        except Exception:
            await websocket.close(code=4001, reason="Invalid token")
            return
        
        # Connect user
        await manager.connect(websocket, user_id)
        
        # Send connection confirmation
        await websocket.send_json(
            ConnectionStatusMessage(
                type="connection_status",
                data={"status": "connected", "user_id": str(user_id)}
            ).dict()
        )
        
        # Send current unread count
        notification_service = NotificationService(db)
        unread_count = await notification_service.get_unread_count(user_id)
        await websocket.send_json(
            UnreadCountWebSocketMessage(
                type="unread_count",
                data=unread_count
            ).dict()
        )
        
        try:
            while True:
                # Keep connection alive and handle client messages
                data = await websocket.receive_text()
                # Handle ping/pong or other client messages if needed
                
        except WebSocketDisconnect:
            manager.disconnect(user_id)
            
    except Exception as e:
        try:
            await websocket.close(code=4000, reason="Server error")
        except:
            pass


# Utility functions for sending notifications via WebSocket

async def send_notification_to_user(user_id: UUID, notification: NotificationResponse):
    """Send notification to user via WebSocket if connected."""
    await manager.send_personal_message(
        NotificationWebSocketMessage(
            type="notification",
            data=notification
        ).dict(),
        user_id
    )


async def send_unread_count_update(user_id: UUID, unread_count: UnreadCountResponse):
    """Send unread count update to user via WebSocket if connected."""
    await manager.send_personal_message(
        UnreadCountWebSocketMessage(
            type="unread_count",
            data=unread_count
        ).dict(),
        user_id
    )


# Health check endpoint

@router.get("/health")
async def notification_health():
    """
    Health check for notification service.

    Returns service status and connection information.
    """
    return {
        "status": "healthy",
        "active_connections": len(manager.active_connections),
        "timestamp": datetime.utcnow().isoformat()
    }


# ---------------------------------------------------------------------------
# Push notification token endpoints
# ---------------------------------------------------------------------------


class PushTokenRequest(BaseModel):
    """Request body for registering a push token."""

    token: str
    platform: str  # "ios" or "android"
    device_name: Optional[str] = None


class PushTokenDeleteRequest(BaseModel):
    """Request body for unregistering a push token."""

    token: str


@router.post(
    "/push-token",
    status_code=status.HTTP_201_CREATED,
)
async def register_push_token(
    payload: PushTokenRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Register a device push token for the authenticated user.

    Registers an Expo push token so the user can receive push notifications on
    their device. If the token already exists it will be reactivated and
    associated with the current user.

    Args:
        payload: Token registration data (token, platform, optional device_name)
        current_user: Current authenticated user
        db: Database session

    Returns:
        dict: Confirmation with the token id
    """
    if payload.platform not in ("ios", "android"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="platform must be 'ios' or 'android'",
        )

    push_service = PushService(db)
    push_token = await push_service.register_push_token(
        user_id=current_user.id,
        token=payload.token,
        platform=payload.platform,
        device_name=payload.device_name,
    )
    return {"id": str(push_token.id), "token": push_token.token, "platform": push_token.platform}


@router.delete(
    "/push-token",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def unregister_push_token(
    payload: PushTokenDeleteRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Unregister a device push token for the authenticated user.

    Deactivates the given push token so the user no longer receives push
    notifications on that device. The record is soft-deleted, not removed.

    Args:
        payload: Token to deactivate
        current_user: Current authenticated user
        db: Database session
    """
    push_service = PushService(db)
    await push_service.unregister_push_token(
        user_id=current_user.id,
        token=payload.token,
    )