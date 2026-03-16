#!/usr/bin/env python3
"""Script to clear test data from the Wippestoolen application."""

import asyncio
from sqlalchemy import select, delete
from wippestoolen.app.core.database import AsyncSessionLocal
from wippestoolen.app.models.tool import Tool, ToolCategory

# Old English titles to remove
OLD_TOOL_TITLES = [
    "Electric Drill",
    "Lawn Mower",
    "Pressure Washer",
    "Circular Saw",
    "Ladder - 24ft Extension",
    "Tile Saw",
    "Paint Sprayer",
    "Generator - 3500W"
]

# Old English category names to update
OLD_CATEGORY_NAMES = {
    "Power Tools": "Elektrowerkzeuge",
    "Garden Tools": "Gartenwerkzeuge", 
    "Cleaning Equipment": "Reinigungsgeräte",
    "Ladders & Scaffolding": "Leitern & Gerüste",
    "Painting Tools": "Malerwerkzeuge",
    "Electrical Equipment": "Elektrogeräte"
}

async def clear_old_test_data():
    """Clear old English test data from the database."""
    async with AsyncSessionLocal() as db:
        # Delete old English tools
        deleted_tools = 0
        for title in OLD_TOOL_TITLES:
            result = await db.execute(
                select(Tool).where(Tool.title == title)
            )
            tool = result.scalar_one_or_none()
            if tool:
                await db.delete(tool)
                deleted_tools += 1
                print(f"  🗑️ Deleted tool: {title}")
        
        # Update category names from English to German
        updated_categories = 0
        for old_name, new_name in OLD_CATEGORY_NAMES.items():
            result = await db.execute(
                select(ToolCategory).where(ToolCategory.name == old_name)
            )
            category = result.scalar_one_or_none()
            if category:
                category.name = new_name
                updated_categories += 1
                print(f"  ✏️ Updated category: {old_name} → {new_name}")
        
        await db.commit()
        
        if deleted_tools > 0:
            print(f"\n🗑️ Deleted {deleted_tools} old English tools")
        if updated_categories > 0:
            print(f"✏️ Updated {updated_categories} categories to German")
        
        if deleted_tools == 0 and updated_categories == 0:
            print("✅ No old English data found to clean up")

if __name__ == "__main__":
    asyncio.run(clear_old_test_data())