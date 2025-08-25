import pytest
from httpx import AsyncClient
from datetime import datetime

from wippestoolen.app.models.enums import NotificationType

@pytest.mark.asyncio
async def test_get_notifications(client: AsyncClient, auth_headers):
    response = await client.get("/api/v1/notifications/", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "total" in data
    assert "unread_count" in data

@pytest.mark.asyncio
async def test_mark_notification_read(client: AsyncClient, async_session, test_user, auth_headers):
    from wippestoolen.app.models.notification import Notification
    
    notification = Notification(
        user_id=test_user.id,
        type=NotificationType.BOOKING_REQUEST,
        title="New Booking Request",
        message="Someone wants to borrow your tool",
        is_read=False
    )
    async_session.add(notification)
    await async_session.commit()
    await async_session.refresh(notification)
    
    response = await client.patch(
        f"/api/v1/notifications/{notification.id}/read",
        headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert data["is_read"] == True

@pytest.mark.asyncio
async def test_mark_all_notifications_read(client: AsyncClient, async_session, test_user, auth_headers):
    from wippestoolen.app.models.notification import Notification
    
    for i in range(3):
        notification = Notification(
            user_id=test_user.id,
            type=NotificationType.BOOKING_REQUEST,
            title=f"Notification {i}",
            message=f"Message {i}",
            is_read=False
        )
        async_session.add(notification)
    await async_session.commit()
    
    response = await client.post("/api/v1/notifications/mark-all-read", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["updated_count"] >= 3

@pytest.mark.asyncio
async def test_delete_notification(client: AsyncClient, async_session, test_user, auth_headers):
    from wippestoolen.app.models.notification import Notification
    
    notification = Notification(
        user_id=test_user.id,
        type=NotificationType.SYSTEM,
        title="System Update",
        message="System will be updated",
        is_read=False
    )
    async_session.add(notification)
    await async_session.commit()
    await async_session.refresh(notification)
    
    response = await client.delete(
        f"/api/v1/notifications/{notification.id}",
        headers=auth_headers
    )
    assert response.status_code == 204

@pytest.mark.asyncio
async def test_get_notification_preferences(client: AsyncClient, auth_headers):
    response = await client.get("/api/v1/notifications/preferences", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert "email_enabled" in data
    assert "push_enabled" in data
    assert "email_bookings" in data

@pytest.mark.asyncio
async def test_update_notification_preferences(client: AsyncClient, auth_headers):
    response = await client.put(
        "/api/v1/notifications/preferences",
        headers=auth_headers,
        json={
            "email_enabled": False,
            "push_enabled": True,
            "email_bookings": False,
            "email_reviews": True,
            "push_bookings": True,
            "push_reviews": False
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["email_enabled"] == False
    assert data["push_enabled"] == True
    assert data["email_reviews"] == True

@pytest.mark.asyncio
async def test_notification_filtering(client: AsyncClient, async_session, test_user, auth_headers):
    from wippestoolen.app.models.notification import Notification
    
    notification_types = [
        (NotificationType.BOOKING_REQUEST, "Booking Request"),
        (NotificationType.BOOKING_CONFIRMED, "Booking Confirmed"),
        (NotificationType.REVIEW_RECEIVED, "Review Received"),
        (NotificationType.SYSTEM, "System Message")
    ]
    
    for notif_type, title in notification_types:
        notification = Notification(
            user_id=test_user.id,
            type=notif_type,
            title=title,
            message=f"Test {title}",
            is_read=False
        )
        async_session.add(notification)
    await async_session.commit()
    
    response = await client.get(
        "/api/v1/notifications/?type=booking_request",
        headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert all(n["type"] == "booking_request" for n in data["items"])
    
    response = await client.get(
        "/api/v1/notifications/?unread_only=true",
        headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert all(n["is_read"] == False for n in data["items"])

@pytest.mark.asyncio
async def test_notification_pagination(client: AsyncClient, async_session, test_user, auth_headers):
    from wippestoolen.app.models.notification import Notification
    
    for i in range(15):
        notification = Notification(
            user_id=test_user.id,
            type=NotificationType.SYSTEM,
            title=f"Notification {i}",
            message=f"Message {i}",
            is_read=False
        )
        async_session.add(notification)
    await async_session.commit()
    
    response = await client.get(
        "/api/v1/notifications/?limit=5&offset=0",
        headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) <= 5
    assert data["total"] >= 15
    
    response = await client.get(
        "/api/v1/notifications/?limit=5&offset=5",
        headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) <= 5