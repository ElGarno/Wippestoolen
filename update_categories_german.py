#!/usr/bin/env python3
"""Update tool categories to German for Attendorn community"""

import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text
from wippestoolen.app.models.tool import ToolCategory

async def update_categories_to_german():
    """Update tool category names to German"""
    
    # Database connection
    DATABASE_URL = "postgresql+asyncpg://wippestoolen_user:secure_password@localhost:5433/wippestoolen_db"
    engine = create_async_engine(DATABASE_URL)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    # German translations
    translations = {
        "Power Tools": "Elektrowerkzeuge",
        "Garden Tools": "Gartenwerkzeuge", 
        "Cleaning Equipment": "Reinigungsgeräte",
        "Ladders & Scaffolding": "Leitern & Gerüste",
        "Painting Tools": "Malerwerkzeuge",
        "Electrical Equipment": "Elektrogeräte"
    }
    
    async with async_session() as session:
        try:
            # Get all categories
            result = await session.execute(
                text("SELECT id, name FROM tool_categories WHERE is_active = true")
            )
            categories = result.fetchall()
            
            print("Updating categories to German:")
            for cat_id, current_name in categories:
                if current_name in translations:
                    german_name = translations[current_name]
                    await session.execute(
                        text("UPDATE tool_categories SET name = :german_name WHERE id = :cat_id"),
                        {"german_name": german_name, "cat_id": cat_id}
                    )
                    print(f"  {current_name} → {german_name}")
                else:
                    print(f"  No translation found for: {current_name}")
            
            await session.commit()
            print("✅ Categories updated successfully!")
            
        except Exception as e:
            print(f"❌ Error updating categories: {e}")
            await session.rollback()
        finally:
            await engine.dispose()

if __name__ == "__main__":
    asyncio.run(update_categories_to_german())