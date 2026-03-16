import pytest
from datetime import datetime, timedelta
from httpx import AsyncClient

from wippestoolen.app.models.tool import Tool
from wippestoolen.app.models.booking import Booking
from wippestoolen.app.models.enums import BookingStatus

@pytest.fixture
async def completed_booking(async_session, test_user, test_user2):
    tool = Tool(
        title="Review Test Tool",
        description="Tool for review testing",
        category="hand_tools",
        owner_id=test_user.id,
        condition="good",
        daily_rate=10.00,
        deposit_amount=50.00,
        availability_status="available"
    )
    async_session.add(tool)
    await async_session.flush()
    
    booking = Booking(
        tool_id=tool.id,
        borrower_id=test_user2.id,
        start_date=datetime.now() - timedelta(days=3),
        end_date=datetime.now() - timedelta(days=1),
        status=BookingStatus.COMPLETED,
        total_cost=20.00,
        deposit_amount=50.00,
        actual_return_date=datetime.now() - timedelta(days=1)
    )
    async_session.add(booking)
    await async_session.commit()
    await async_session.refresh(booking)
    await async_session.refresh(tool)
    return booking

@pytest.mark.asyncio
async def test_create_tool_review(client: AsyncClient, completed_booking, auth_headers2):
    response = await client.post(
        "/api/v1/reviews/",
        headers=auth_headers2,
        json={
            "booking_id": completed_booking.id,
            "review_type": "tool",
            "rating": 5,
            "comment": "Excellent tool, worked perfectly!",
            "tool_condition_on_return": "same"
        }
    )
    assert response.status_code == 201
    data = response.json()
    assert data["rating"] == 5
    assert data["review_type"] == "tool"
    assert data["comment"] == "Excellent tool, worked perfectly!"

@pytest.mark.asyncio
async def test_create_borrower_review(client: AsyncClient, completed_booking, auth_headers):
    response = await client.post(
        "/api/v1/reviews/",
        headers=auth_headers,
        json={
            "booking_id": completed_booking.id,
            "review_type": "borrower",
            "rating": 4,
            "comment": "Good borrower, returned on time",
            "returned_on_time": True,
            "tool_condition_on_return": "same"
        }
    )
    assert response.status_code == 201
    data = response.json()
    assert data["rating"] == 4
    assert data["review_type"] == "borrower"

@pytest.mark.asyncio
async def test_cannot_review_incomplete_booking(client: AsyncClient, async_session, test_user, test_user2, auth_headers2):
    tool = Tool(
        title="Incomplete Booking Tool",
        description="Tool",
        category="hand_tools",
        owner_id=test_user.id,
        condition="good",
        daily_rate=10.00,
        availability_status="available"
    )
    async_session.add(tool)
    await async_session.flush()
    
    booking = Booking(
        tool_id=tool.id,
        borrower_id=test_user2.id,
        start_date=datetime.now() + timedelta(days=1),
        end_date=datetime.now() + timedelta(days=2),
        status=BookingStatus.CONFIRMED,
        total_cost=10.00,
        deposit_amount=50.00
    )
    async_session.add(booking)
    await async_session.commit()
    await async_session.refresh(booking)
    
    response = await client.post(
        "/api/v1/reviews/",
        headers=auth_headers2,
        json={
            "booking_id": booking.id,
            "review_type": "tool",
            "rating": 5,
            "comment": "Cannot review yet"
        }
    )
    assert response.status_code == 400
    assert "not completed" in response.json()["detail"].lower()

@pytest.mark.asyncio
async def test_cannot_duplicate_review(client: AsyncClient, completed_booking, auth_headers2):
    await client.post(
        "/api/v1/reviews/",
        headers=auth_headers2,
        json={
            "booking_id": completed_booking.id,
            "review_type": "tool",
            "rating": 5,
            "comment": "First review"
        }
    )
    
    response = await client.post(
        "/api/v1/reviews/",
        headers=auth_headers2,
        json={
            "booking_id": completed_booking.id,
            "review_type": "tool",
            "rating": 4,
            "comment": "Second review"
        }
    )
    assert response.status_code == 400
    assert "already reviewed" in response.json()["detail"].lower()

@pytest.mark.asyncio
async def test_check_review_eligibility(client: AsyncClient, completed_booking, auth_headers, auth_headers2):
    response = await client.get(
        f"/api/v1/reviews/eligibility?booking_id={completed_booking.id}",
        headers=auth_headers2
    )
    assert response.status_code == 200
    data = response.json()
    assert data["can_review_tool"] == True
    assert data["can_review_borrower"] == False
    
    response = await client.get(
        f"/api/v1/reviews/eligibility?booking_id={completed_booking.id}",
        headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert data["can_review_tool"] == False
    assert data["can_review_borrower"] == True

@pytest.mark.asyncio
async def test_get_review(client: AsyncClient, completed_booking, auth_headers2):
    create_response = await client.post(
        "/api/v1/reviews/",
        headers=auth_headers2,
        json={
            "booking_id": completed_booking.id,
            "review_type": "tool",
            "rating": 5,
            "comment": "Great tool!"
        }
    )
    review_id = create_response.json()["id"]
    
    response = await client.get(f"/api/v1/reviews/{review_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == review_id
    assert data["rating"] == 5

@pytest.mark.asyncio
async def test_update_review(client: AsyncClient, completed_booking, auth_headers2):
    create_response = await client.post(
        "/api/v1/reviews/",
        headers=auth_headers2,
        json={
            "booking_id": completed_booking.id,
            "review_type": "tool",
            "rating": 4,
            "comment": "Good tool"
        }
    )
    review_id = create_response.json()["id"]
    
    response = await client.put(
        f"/api/v1/reviews/{review_id}",
        headers=auth_headers2,
        json={
            "rating": 5,
            "comment": "Actually, it was excellent!"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["rating"] == 5
    assert data["comment"] == "Actually, it was excellent!"

@pytest.mark.asyncio
async def test_delete_review(client: AsyncClient, completed_booking, auth_headers2):
    create_response = await client.post(
        "/api/v1/reviews/",
        headers=auth_headers2,
        json={
            "booking_id": completed_booking.id,
            "review_type": "tool",
            "rating": 3,
            "comment": "Average"
        }
    )
    review_id = create_response.json()["id"]
    
    response = await client.delete(f"/api/v1/reviews/{review_id}", headers=auth_headers2)
    assert response.status_code == 204
    
    get_response = await client.get(f"/api/v1/reviews/{review_id}")
    assert get_response.status_code == 404

@pytest.mark.asyncio
async def test_get_tool_reviews(client: AsyncClient, completed_booking, auth_headers2):
    await client.post(
        "/api/v1/reviews/",
        headers=auth_headers2,
        json={
            "booking_id": completed_booking.id,
            "review_type": "tool",
            "rating": 5,
            "comment": "Excellent tool!"
        }
    )
    
    response = await client.get(f"/api/v1/reviews/tool/{completed_booking.tool_id}")
    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) >= 1
    assert data["items"][0]["rating"] == 5

@pytest.mark.asyncio
async def test_get_user_reviews(client: AsyncClient, completed_booking, auth_headers):
    await client.post(
        "/api/v1/reviews/",
        headers=auth_headers,
        json={
            "booking_id": completed_booking.id,
            "review_type": "borrower",
            "rating": 4,
            "comment": "Good borrower"
        }
    )
    
    response = await client.get(f"/api/v1/reviews/user/{completed_booking.borrower_id}")
    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) >= 1

@pytest.mark.asyncio
async def test_flag_review(client: AsyncClient, completed_booking, auth_headers, auth_headers2):
    create_response = await client.post(
        "/api/v1/reviews/",
        headers=auth_headers2,
        json={
            "booking_id": completed_booking.id,
            "review_type": "tool",
            "rating": 1,
            "comment": "Inappropriate content here"
        }
    )
    review_id = create_response.json()["id"]
    
    response = await client.post(
        f"/api/v1/reviews/{review_id}/flag",
        headers=auth_headers,
        json={"reason": "inappropriate"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["is_flagged"] == True

@pytest.mark.asyncio
async def test_pending_reviews(client: AsyncClient, completed_booking, auth_headers2):
    response = await client.get("/api/v1/reviews/pending", headers=auth_headers2)
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert any(pr["booking_id"] == completed_booking.id for pr in data)