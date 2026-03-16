#!/usr/bin/env python3
"""Add categories to production database."""

import asyncio
import urllib.parse
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

async def add_production_categories():
    """Add categories to production database."""
    
    # Production database credentials (URL encoded)
    user = "wippestoolen_admin"
    password = urllib.parse.quote_plus("Z4%ASK{S*mqY<DrFL36}4e*[X0Mx}9nw")
    host = "wippestoolen-production.cvx466dfq2il.eu-central-1.rds.amazonaws.com"
    port = "5432"
    database = "wippestoolen"
    
    prod_url = f"postgresql+asyncpg://{user}:{password}@{host}:{port}/{database}?ssl=require"
    
    print(f"Connecting to production database...")
    
    engine = create_async_engine(prod_url, echo=False)
    AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    # Categories to create (matching the frontend hardcoded IDs)
    categories = [
        {"id": 1, "name": "Elektrowerkzeuge", "slug": "power-tools", "description": "Bohrmaschinen, Sägen, Schleifer", "sort_order": 1},
        {"id": 2, "name": "Handwerkzeuge", "slug": "hand-tools", "description": "Schraubendreher, Hammer, Zangen", "sort_order": 2},
        {"id": 3, "name": "Gartenwerkzeuge", "slug": "garden-tools", "description": "Rasenmäher, Spaten, Scheren", "sort_order": 3},
        {"id": 4, "name": "Leiter & Gerüste", "slug": "ladders-scaffolding", "description": "Leitern und Gerüstteile", "sort_order": 4},
        {"id": 5, "name": "Reinigungsgeräte", "slug": "cleaning-equipment", "description": "Hochdruckreiniger, Staubsauger", "sort_order": 5},
    ]
    
    try:
        async with AsyncSessionLocal() as db:
            # Check existing categories
            result = await db.execute(text("SELECT COUNT(*) FROM tool_categories"))
            count = result.scalar()
            print(f"Current categories in production: {count}")
            
            for cat in categories:
                # Insert with specific ID to match frontend expectations
                await db.execute(
                    text('''
                        INSERT INTO tool_categories (id, name, slug, description, is_active, sort_order, created_at)
                        VALUES (:id, :name, :slug, :description, true, :sort_order, NOW())
                        ON CONFLICT (id) DO UPDATE SET
                            name = EXCLUDED.name,
                            slug = EXCLUDED.slug,
                            description = EXCLUDED.description,
                            is_active = true,
                            sort_order = EXCLUDED.sort_order
                    '''),
                    cat
                )
                print(f"✅ Added/Updated category {cat['id']}: {cat['name']}")
            
            await db.commit()
            
            # Verify the categories
            result = await db.execute(
                text("SELECT id, name, is_active FROM tool_categories ORDER BY sort_order")
            )
            rows = result.fetchall()
            print(f"\n✅ Production database now has {len(rows)} categories:")
            for row in rows:
                status = "ACTIVE" if row[2] else "INACTIVE"
                print(f"  ID {row[0]}: {row[1]} ({status})")
        
        await engine.dispose()
        print("\n🎉 Categories successfully added to production database!")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        await engine.dispose()
        raise

if __name__ == "__main__":
    asyncio.run(add_production_categories())