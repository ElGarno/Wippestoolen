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
            {"name": "Elektrowerkzeuge", "slug": "power-tools"},
            {"name": "Gartenwerkzeuge", "slug": "garden-tools"},
            {"name": "Reinigungsgeräte", "slug": "cleaning-equipment"},
            {"name": "Leitern & Gerüste", "slug": "ladders-scaffolding"},
            {"name": "Malerwerkzeuge", "slug": "painting-tools"},
            {"name": "Elektrogeräte", "slug": "electrical-equipment"},
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
                "title": "Akku-Bohrschrauber",
                "description": "Leistungsstarker Akkubohrer perfekt für Heimwerkerprojekte. 20V Akku inklusive.",
                "category_name": "Elektrowerkzeuge",
                "daily_rate": 15.00,
                "deposit_amount": 50.00,
                "is_available": True,
                "condition": "excellent",
                "brand": "DeWalt",
                "model": "DCD777C2"
            },
            {
                "title": "Rasenmäher",
                "description": "Benzin-Rasenmäher mit Radantrieb, ideal für mittlere bis große Gärten. Kürzlich gewartet.",
                "category_name": "Gartenwerkzeuge",
                "daily_rate": 25.00,
                "deposit_amount": 100.00,
                "is_available": True,
                "condition": "good",
                "brand": "Honda",
                "model": "HRX217"
            },
            {
                "title": "Hochdruckreiniger",
                "description": "2000 PSI Elektro-Hochdruckreiniger. Perfekt für Einfahrten, Terrassen und Fassaden.",
                "category_name": "Reinigungsgeräte",
                "daily_rate": 30.00,
                "deposit_amount": 75.00,
                "is_available": True,
                "condition": "excellent",
                "brand": "Kärcher",
                "model": "K1700"
            },
            {
                "title": "Handkreissäge",
                "description": "185mm Handkreissäge mit Laserführung. Ideal für gerade Schnitte.",
                "category_name": "Elektrowerkzeuge",
                "daily_rate": 12.00,
                "deposit_amount": 40.00,
                "is_available": True,
                "condition": "good",
                "brand": "Makita",
                "model": "5007MG"
            },
            {
                "title": "Leiter - 7m Schiebeleiter",
                "description": "Aluminium-Schiebeleiter, ausziehbar bis 7 Meter. Perfekt für Dacharbeiten.",
                "category_name": "Leitern & Gerüste",
                "daily_rate": 20.00,
                "deposit_amount": 60.00,
                "is_available": True,
                "condition": "good",
                "brand": "Werner"
            },
            {
                "title": "Fliesenschneidemaschine",
                "description": "Nass-Fliesenschneider für Keramik- und Porzellanfliesen. Mit Untergestell.",
                "category_name": "Elektrowerkzeuge",
                "daily_rate": 35.00,
                "deposit_amount": 100.00,
                "is_available": True,
                "condition": "good",
                "brand": "RIDGID"
            },
            {
                "title": "Farbsprühgerät",
                "description": "Airless-Farbsprühgerät für Innen- und Außenprojekte.",
                "category_name": "Malerwerkzeuge",
                "daily_rate": 40.00,
                "deposit_amount": 120.00,
                "is_available": True,
                "condition": "excellent",
                "brand": "Graco",
                "model": "Magnum X5"
            },
            {
                "title": "Stromgenerator - 3500W",
                "description": "Tragbarer Stromerzeuger, 3500 Watt. Ideal bei Stromausfall oder auf Baustellen.",
                "category_name": "Elektrogeräte",
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