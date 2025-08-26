#!/usr/bin/env python3
"""Script to create test data for the Wippestoolen application."""

import asyncio
from sqlalchemy import select
from wippestoolen.app.core.database import AsyncSessionLocal
from wippestoolen.app.models.tool import Tool, ToolCategory
from wippestoolen.app.models.user import User


async def create_test_tools():
    """Create test tools in the database."""
    async with AsyncSessionLocal() as db:
        # Get the first user
        result = await db.execute(select(User).limit(1))
        user = result.scalar_one_or_none()
        
        if not user:
            print("⚠️ No users found. Please register a user first through the web interface.")
            print("   Go to: http://localhost:3000/auth/register")
            return
        
        print(f"✅ Found user: {user.display_name} ({user.email})")
        
        # First, create tool categories
        categories = [
            {"name": "Power Tools", "slug": "power-tools"},
            {"name": "Garden Tools", "slug": "garden-tools"},
            {"name": "Cleaning Equipment", "slug": "cleaning-equipment"},
            {"name": "Ladders & Scaffolding", "slug": "ladders-scaffolding"},
            {"name": "Painting Tools", "slug": "painting-tools"},
            {"name": "Electrical Equipment", "slug": "electrical-equipment"},
        ]
        
        category_ids = {}
        
        for cat_data in categories:
            result = await db.execute(
                select(ToolCategory).where(ToolCategory.name == cat_data["name"])
            )
            category = result.scalar_one_or_none()
            
            if not category:
                category = ToolCategory(**cat_data)
                db.add(category)
                await db.flush()  # Get the ID
                print(f"  📂 Created category: {cat_data['name']}")
            
            category_ids[cat_data["name"]] = category.id
        
        # Define test tools (using proper Tool model fields)
        test_tools = [
            {
                "title": "Electric Drill",
                "description": "Powerful cordless drill perfect for home projects. 20V battery included.",
                "category_name": "Power Tools",
                "daily_rate": 15.00,
                "deposit_amount": 50.00,
                "is_available": True,
                "condition": "excellent",
                "brand": "DeWalt",
                "model": "DCD777C2"
            },
            {
                "title": "Lawn Mower",
                "description": "Self-propelled gas lawn mower, great for medium to large yards. Recently serviced.",
                "category_name": "Garden Tools",
                "daily_rate": 25.00,
                "deposit_amount": 100.00,
                "is_available": True,
                "condition": "good",
                "brand": "Honda",
                "model": "HRX217"
            },
            {
                "title": "Pressure Washer",
                "description": "2000 PSI electric pressure washer. Perfect for driveways, decks, and siding.",
                "category_name": "Cleaning Equipment",
                "daily_rate": 30.00,
                "deposit_amount": 75.00,
                "is_available": True,
                "condition": "excellent",
                "brand": "Karcher",
                "model": "K1700"
            },
            {
                "title": "Circular Saw",
                "description": "7-1/4 inch circular saw with laser guide. Great for straight cuts.",
                "category_name": "Power Tools",
                "daily_rate": 12.00,
                "deposit_amount": 40.00,
                "is_available": True,
                "condition": "good",
                "brand": "Makita",
                "model": "5007MG"
            },
            {
                "title": "Ladder - 24ft Extension",
                "description": "Aluminum extension ladder, extends up to 24 feet. Perfect for roof work.",
                "category_name": "Ladders & Scaffolding",
                "daily_rate": 20.00,
                "deposit_amount": 60.00,
                "is_available": True,
                "condition": "good",
                "brand": "Werner"
            },
            {
                "title": "Tile Saw",
                "description": "Wet tile saw for ceramic and porcelain tiles. Includes stand.",
                "category_name": "Power Tools",
                "daily_rate": 35.00,
                "deposit_amount": 100.00,
                "is_available": True,
                "condition": "good",
                "brand": "RIDGID"
            },
            {
                "title": "Paint Sprayer",
                "description": "Airless paint sprayer for interior and exterior projects.",
                "category_name": "Painting Tools",
                "daily_rate": 40.00,
                "deposit_amount": 120.00,
                "is_available": True,
                "condition": "excellent",
                "brand": "Graco",
                "model": "Magnum X5"
            },
            {
                "title": "Generator - 3500W",
                "description": "Portable generator, 3500 watts. Great for power outages or job sites.",
                "category_name": "Electrical Equipment",
                "daily_rate": 45.00,
                "deposit_amount": 200.00,
                "is_available": True,
                "condition": "good",
                "brand": "Champion"
            }
        ]
        
        # Create tools
        created_count = 0
        for tool_data in test_tools:
            # Check if tool already exists
            result = await db.execute(
                select(Tool).where(Tool.title == tool_data["title"])
            )
            existing_tool = result.scalar_one_or_none()
            
            if not existing_tool:
                # Get the category ID
                category_name = tool_data.pop("category_name")
                category_id = category_ids[category_name]
                
                tool = Tool(
                    **tool_data,
                    owner_id=user.id,
                    category_id=category_id,
                    pickup_city=user.city or "Local area",
                    delivery_available=True,
                    delivery_radius_km=10
                )
                db.add(tool)
                created_count += 1
                print(f"  ✅ Created: {tool_data['title']}")
            else:
                print(f"  ⚠️ Already exists: {tool_data['title']}")
        
        await db.commit()
        
        if created_count > 0:
            print(f"\n🎉 Successfully created {created_count} test tools!")
        else:
            print("\n✅ All test tools already exist in the database.")
        
        print("\n📱 You can now browse tools at: http://localhost:3000/tools")


if __name__ == "__main__":
    asyncio.run(create_test_tools())