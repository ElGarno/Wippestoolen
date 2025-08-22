#!/usr/bin/env python3
"""Seed tool categories."""

import asyncio
import sys
from pathlib import Path

# Add the project root to the path
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

from wippestoolen.app.core.database import AsyncSessionLocal
from wippestoolen.app.models.tool import ToolCategory


CATEGORIES = [
    {
        "name": "Power Tools",
        "slug": "power-tools",
        "description": "Electric and battery-powered tools for construction and DIY projects",
        "icon_name": "drill",
        "sort_order": 1,
    },
    {
        "name": "Hand Tools",
        "slug": "hand-tools", 
        "description": "Manual tools for precision work and detailed tasks",
        "icon_name": "wrench",
        "sort_order": 2,
    },
    {
        "name": "Garden Tools",
        "slug": "garden-tools",
        "description": "Tools for gardening, landscaping, and outdoor maintenance",
        "icon_name": "leaf",
        "sort_order": 3,
    },
    {
        "name": "Measuring Tools",
        "slug": "measuring-tools",
        "description": "Precision measuring and leveling tools",
        "icon_name": "ruler",
        "sort_order": 4,
    },
    {
        "name": "Cleaning Equipment",
        "slug": "cleaning-equipment", 
        "description": "Pressure washers, vacuums, and cleaning tools",
        "icon_name": "spray-bottle",
        "sort_order": 5,
    },
    {
        "name": "Woodworking Tools",
        "slug": "woodworking-tools",
        "description": "Specialized tools for woodworking and carpentry",
        "icon_name": "saw",
        "sort_order": 6,
    },
    {
        "name": "Automotive Tools", 
        "slug": "automotive-tools",
        "description": "Tools for car maintenance and repair",
        "icon_name": "car",
        "sort_order": 7,
    },
    {
        "name": "Painting Tools",
        "slug": "painting-tools",
        "description": "Brushes, rollers, sprayers, and painting equipment",
        "icon_name": "paint-brush",
        "sort_order": 8,
    },
    {
        "name": "Plumbing Tools",
        "slug": "plumbing-tools",
        "description": "Pipes, wrenches, and plumbing repair tools",
        "icon_name": "pipe",
        "sort_order": 9,
    },
    {
        "name": "Electrical Tools",
        "slug": "electrical-tools", 
        "description": "Meters, testers, and electrical installation tools",
        "icon_name": "plug",
        "sort_order": 10,
    },
    {
        "name": "Ladders & Scaffolding",
        "slug": "ladders-scaffolding",
        "description": "Access equipment for height work",
        "icon_name": "ladder",
        "sort_order": 11,
    },
    {
        "name": "Safety Equipment", 
        "slug": "safety-equipment",
        "description": "Protective gear and safety tools",
        "icon_name": "shield",
        "sort_order": 12,
    },
]


async def seed_categories():
    """Seed tool categories if they don't exist."""
    async with AsyncSessionLocal() as db:
        try:
            # Check if categories already exist
            from sqlalchemy import select, func
            
            result = await db.execute(select(func.count(ToolCategory.id)))
            count = result.scalar()
            
            if count > 0:
                print(f"Categories already exist ({count} categories found). Skipping seed.")
                return
            
            # Create categories
            categories = []
            for cat_data in CATEGORIES:
                category = ToolCategory(**cat_data)
                categories.append(category)
                db.add(category)
            
            await db.commit()
            print(f"Successfully seeded {len(categories)} tool categories:")
            
            for category in categories:
                print(f"  - {category.name} ({category.slug})")
                
        except Exception as e:
            await db.rollback()
            print(f"Error seeding categories: {e}")
            raise


if __name__ == "__main__":
    asyncio.run(seed_categories())