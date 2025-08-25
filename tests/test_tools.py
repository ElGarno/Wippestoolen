import pytest
from httpx import AsyncClient

from wippestoolen.app.models.tool import Tool, ToolCategory

@pytest.mark.asyncio
async def test_create_tool(client: AsyncClient, auth_headers):
    response = await client.post(
        "/api/v1/tools/",
        headers=auth_headers,
        json={
            "title": "Electric Drill",
            "description": "Powerful cordless drill, perfect for DIY projects",
            "category": "power_tools",
            "brand": "DeWalt",
            "model": "DCD791D2",
            "condition": "excellent",
            "daily_rate": 15.00,
            "weekly_rate": 75.00,
            "deposit_amount": 100.00,
            "pickup_location": "123 Main St",
            "availability_status": "available",
            "delivery_available": True,
            "delivery_fee": 5.00,
            "instructions": "Charge battery before use"
        }
    )
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "Electric Drill"
    assert data["category"] == "power_tools"
    assert data["daily_rate"] == 15.00
    assert "id" in data

@pytest.mark.asyncio
async def test_get_tool(client: AsyncClient, auth_headers):
    create_response = await client.post(
        "/api/v1/tools/",
        headers=auth_headers,
        json={
            "title": "Hammer",
            "description": "Standard claw hammer",
            "category": "hand_tools",
            "condition": "good",
            "daily_rate": 5.00
        }
    )
    tool_id = create_response.json()["id"]
    
    response = await client.get(f"/api/v1/tools/{tool_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "Hammer"
    assert data["id"] == tool_id

@pytest.mark.asyncio
async def test_update_tool(client: AsyncClient, auth_headers):
    create_response = await client.post(
        "/api/v1/tools/",
        headers=auth_headers,
        json={
            "title": "Ladder",
            "description": "6ft ladder",
            "category": "ladders",
            "condition": "good",
            "daily_rate": 10.00
        }
    )
    tool_id = create_response.json()["id"]
    
    response = await client.put(
        f"/api/v1/tools/{tool_id}",
        headers=auth_headers,
        json={
            "title": "Tall Ladder",
            "description": "8ft aluminum ladder",
            "daily_rate": 12.00
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "Tall Ladder"
    assert data["description"] == "8ft aluminum ladder"
    assert data["daily_rate"] == 12.00

@pytest.mark.asyncio
async def test_update_tool_unauthorized(client: AsyncClient, auth_headers, auth_headers2):
    create_response = await client.post(
        "/api/v1/tools/",
        headers=auth_headers,
        json={
            "title": "My Tool",
            "description": "Description",
            "category": "hand_tools",
            "condition": "good",
            "daily_rate": 5.00
        }
    )
    tool_id = create_response.json()["id"]
    
    response = await client.put(
        f"/api/v1/tools/{tool_id}",
        headers=auth_headers2,
        json={"title": "Hacked Tool"}
    )
    assert response.status_code == 403

@pytest.mark.asyncio
async def test_delete_tool(client: AsyncClient, auth_headers):
    create_response = await client.post(
        "/api/v1/tools/",
        headers=auth_headers,
        json={
            "title": "To Delete",
            "description": "This will be deleted",
            "category": "hand_tools",
            "condition": "fair",
            "daily_rate": 3.00
        }
    )
    tool_id = create_response.json()["id"]
    
    response = await client.delete(f"/api/v1/tools/{tool_id}", headers=auth_headers)
    assert response.status_code == 204
    
    get_response = await client.get(f"/api/v1/tools/{tool_id}")
    assert get_response.status_code == 404

@pytest.mark.asyncio
async def test_browse_tools(client: AsyncClient, auth_headers):
    for i in range(5):
        await client.post(
            "/api/v1/tools/",
            headers=auth_headers,
            json={
                "title": f"Tool {i}",
                "description": f"Description {i}",
                "category": "hand_tools",
                "condition": "good",
                "daily_rate": 5.00 + i
            }
        )
    
    response = await client.get("/api/v1/tools/browse?limit=3")
    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) == 3
    assert data["total"] >= 5
    assert data["limit"] == 3

@pytest.mark.asyncio
async def test_browse_tools_by_category(client: AsyncClient, auth_headers):
    await client.post(
        "/api/v1/tools/",
        headers=auth_headers,
        json={
            "title": "Power Drill",
            "description": "Electric drill",
            "category": "power_tools",
            "condition": "excellent",
            "daily_rate": 15.00
        }
    )
    
    await client.post(
        "/api/v1/tools/",
        headers=auth_headers,
        json={
            "title": "Screwdriver",
            "description": "Phillips head",
            "category": "hand_tools",
            "condition": "good",
            "daily_rate": 2.00
        }
    )
    
    response = await client.get("/api/v1/tools/browse?category=power_tools")
    assert response.status_code == 200
    data = response.json()
    assert all(tool["category"] == "power_tools" for tool in data["items"])

@pytest.mark.asyncio
async def test_search_tools(client: AsyncClient, auth_headers):
    await client.post(
        "/api/v1/tools/",
        headers=auth_headers,
        json={
            "title": "Circular Saw",
            "description": "Professional grade saw for woodworking",
            "category": "power_tools",
            "condition": "excellent",
            "daily_rate": 20.00
        }
    )
    
    response = await client.get("/api/v1/tools/search?q=saw")
    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) > 0
    assert any("saw" in tool["title"].lower() for tool in data["items"])

@pytest.mark.asyncio
async def test_get_user_tools(client: AsyncClient, auth_headers):
    for i in range(3):
        await client.post(
            "/api/v1/tools/",
            headers=auth_headers,
            json={
                "title": f"My Tool {i}",
                "description": f"Description {i}",
                "category": "hand_tools",
                "condition": "good",
                "daily_rate": 5.00
            }
        )
    
    response = await client.get("/api/v1/tools/my-tools", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) >= 3
    assert all("My Tool" in tool["title"] for tool in data["items"])

@pytest.mark.asyncio
async def test_get_tool_categories(client: AsyncClient):
    response = await client.get("/api/v1/tools/categories")
    assert response.status_code == 200
    data = response.json()
    assert len(data) > 0
    assert any(cat["key"] == "power_tools" for cat in data)
    assert any(cat["key"] == "hand_tools" for cat in data)