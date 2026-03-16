import pytest
from datetime import datetime, timedelta
from httpx import AsyncClient

from wippestoolen.app.models.tool import Tool
from wippestoolen.app.models.enums import BookingStatus

@pytest.fixture
async def test_tool(async_session, test_user):
    tool = Tool(
        title="Test Drill",
        description="Electric drill for testing",
        category="power_tools",
        owner_id=test_user.id,
        condition="excellent",
        daily_rate=10.00,
        weekly_rate=50.00,
        deposit_amount=100.00,
        availability_status="available"
    )
    async_session.add(tool)
    await async_session.commit()
    await async_session.refresh(tool)
    return tool

@pytest.mark.asyncio
async def test_create_booking(client: AsyncClient, test_tool, auth_headers2):
    start_date = datetime.now() + timedelta(days=1)
    end_date = start_date + timedelta(days=3)
    
    response = await client.post(
        "/api/v1/bookings/",
        headers=auth_headers2,
        json={
            "tool_id": test_tool.id,
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "message": "Would love to borrow this drill for my project"
        }
    )
    assert response.status_code == 201
    data = response.json()
    assert data["tool_id"] == test_tool.id
    assert data["status"] == "pending"
    assert data["total_cost"] == 30.00
    assert data["deposit_amount"] == 100.00

@pytest.mark.asyncio
async def test_create_booking_own_tool(client: AsyncClient, test_tool, auth_headers):
    start_date = datetime.now() + timedelta(days=1)
    end_date = start_date + timedelta(days=2)
    
    response = await client.post(
        "/api/v1/bookings/",
        headers=auth_headers,
        json={
            "tool_id": test_tool.id,
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat()
        }
    )
    assert response.status_code == 400
    assert "cannot book your own tool" in response.json()["detail"].lower()

@pytest.mark.asyncio
async def test_create_booking_invalid_dates(client: AsyncClient, test_tool, auth_headers2):
    start_date = datetime.now() + timedelta(days=2)
    end_date = datetime.now() + timedelta(days=1)
    
    response = await client.post(
        "/api/v1/bookings/",
        headers=auth_headers2,
        json={
            "tool_id": test_tool.id,
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat()
        }
    )
    assert response.status_code == 400
    assert "must be after start date" in response.json()["detail"].lower()

@pytest.mark.asyncio
async def test_get_booking(client: AsyncClient, test_tool, auth_headers2):
    start_date = datetime.now() + timedelta(days=1)
    end_date = start_date + timedelta(days=1)
    
    create_response = await client.post(
        "/api/v1/bookings/",
        headers=auth_headers2,
        json={
            "tool_id": test_tool.id,
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat()
        }
    )
    booking_id = create_response.json()["id"]
    
    response = await client.get(f"/api/v1/bookings/{booking_id}", headers=auth_headers2)
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == booking_id

@pytest.mark.asyncio
async def test_confirm_booking(client: AsyncClient, test_tool, auth_headers, auth_headers2):
    start_date = datetime.now() + timedelta(days=1)
    end_date = start_date + timedelta(days=1)
    
    create_response = await client.post(
        "/api/v1/bookings/",
        headers=auth_headers2,
        json={
            "tool_id": test_tool.id,
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat()
        }
    )
    booking_id = create_response.json()["id"]
    
    response = await client.post(
        f"/api/v1/bookings/{booking_id}/confirm",
        headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "confirmed"

@pytest.mark.asyncio
async def test_cancel_booking(client: AsyncClient, test_tool, auth_headers2):
    start_date = datetime.now() + timedelta(days=1)
    end_date = start_date + timedelta(days=1)
    
    create_response = await client.post(
        "/api/v1/bookings/",
        headers=auth_headers2,
        json={
            "tool_id": test_tool.id,
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat()
        }
    )
    booking_id = create_response.json()["id"]
    
    response = await client.post(
        f"/api/v1/bookings/{booking_id}/cancel",
        headers=auth_headers2,
        json={"reason": "No longer needed"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "cancelled"

@pytest.mark.asyncio
async def test_decline_booking(client: AsyncClient, test_tool, auth_headers, auth_headers2):
    start_date = datetime.now() + timedelta(days=1)
    end_date = start_date + timedelta(days=1)
    
    create_response = await client.post(
        "/api/v1/bookings/",
        headers=auth_headers2,
        json={
            "tool_id": test_tool.id,
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat()
        }
    )
    booking_id = create_response.json()["id"]
    
    response = await client.post(
        f"/api/v1/bookings/{booking_id}/decline",
        headers=auth_headers,
        json={"reason": "Tool not available on those dates"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "declined"

@pytest.mark.asyncio
async def test_start_booking(client: AsyncClient, test_tool, auth_headers, auth_headers2):
    start_date = datetime.now() + timedelta(days=1)
    end_date = start_date + timedelta(days=1)
    
    create_response = await client.post(
        "/api/v1/bookings/",
        headers=auth_headers2,
        json={
            "tool_id": test_tool.id,
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat()
        }
    )
    booking_id = create_response.json()["id"]
    
    await client.post(f"/api/v1/bookings/{booking_id}/confirm", headers=auth_headers)
    
    response = await client.post(
        f"/api/v1/bookings/{booking_id}/start",
        headers=auth_headers,
        json={"pickup_notes": "Picked up at 10 AM"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "active"

@pytest.mark.asyncio
async def test_complete_booking(client: AsyncClient, test_tool, auth_headers, auth_headers2):
    start_date = datetime.now() + timedelta(days=1)
    end_date = start_date + timedelta(days=1)
    
    create_response = await client.post(
        "/api/v1/bookings/",
        headers=auth_headers2,
        json={
            "tool_id": test_tool.id,
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat()
        }
    )
    booking_id = create_response.json()["id"]
    
    await client.post(f"/api/v1/bookings/{booking_id}/confirm", headers=auth_headers)
    await client.post(f"/api/v1/bookings/{booking_id}/start", headers=auth_headers)
    
    response = await client.post(
        f"/api/v1/bookings/{booking_id}/complete",
        headers=auth_headers2,
        json={"return_notes": "Returned in good condition"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "completed"

@pytest.mark.asyncio
async def test_list_user_bookings(client: AsyncClient, test_tool, auth_headers2):
    for i in range(3):
        start_date = datetime.now() + timedelta(days=i+1)
        end_date = start_date + timedelta(days=1)
        await client.post(
            "/api/v1/bookings/",
            headers=auth_headers2,
            json={
                "tool_id": test_tool.id,
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat()
            }
        )
    
    response = await client.get("/api/v1/bookings/my-bookings", headers=auth_headers2)
    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) >= 3

@pytest.mark.asyncio
async def test_list_owner_bookings(client: AsyncClient, test_tool, auth_headers, auth_headers2):
    start_date = datetime.now() + timedelta(days=1)
    end_date = start_date + timedelta(days=1)
    
    await client.post(
        "/api/v1/bookings/",
        headers=auth_headers2,
        json={
            "tool_id": test_tool.id,
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat()
        }
    )
    
    response = await client.get("/api/v1/bookings/owner-bookings", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) >= 1
    assert all(booking["tool"]["owner_id"] == test_tool.owner_id for booking in data["items"])

@pytest.mark.asyncio
async def test_check_availability(client: AsyncClient, test_tool, auth_headers2):
    start_date = datetime.now() + timedelta(days=1)
    end_date = start_date + timedelta(days=3)
    
    await client.post(
        "/api/v1/bookings/",
        headers=auth_headers2,
        json={
            "tool_id": test_tool.id,
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat()
        }
    )
    
    response = await client.get(
        f"/api/v1/bookings/tool/{test_tool.id}/availability",
        params={
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat()
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["available"] == False
    
    new_start = datetime.now() + timedelta(days=10)
    new_end = new_start + timedelta(days=1)
    response = await client.get(
        f"/api/v1/bookings/tool/{test_tool.id}/availability",
        params={
            "start_date": new_start.isoformat(),
            "end_date": new_end.isoformat()
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["available"] == True