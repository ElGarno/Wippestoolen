#!/usr/bin/env python3
"""
Standalone script to create the tool_photos table.
This can be run in the container or locally with database access.
"""
import asyncio
import os
import sys
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

# Database URL for production
DATABASE_URL = "postgresql+asyncpg://wippestoolen_user:wippestoolen_production_password@wippestoolen-production.cvx466dfq2il.eu-central-1.rds.amazonaws.com:5432/wippestoolen_production"

async def create_tool_photos_table():
    """Create the tool_photos table."""
    
    # Create async engine
    engine = create_async_engine(DATABASE_URL, echo=True)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    try:
        async with async_session() as session:
            # Create the table SQL
            create_table_sql = """
            CREATE TABLE IF NOT EXISTS tool_photos (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
                original_url VARCHAR(500) NOT NULL,
                thumbnail_url VARCHAR(500),
                medium_url VARCHAR(500),
                large_url VARCHAR(500),
                display_order INTEGER DEFAULT 0 NOT NULL,
                is_primary BOOLEAN DEFAULT false NOT NULL,
                is_active BOOLEAN DEFAULT true NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
            );
            """
            
            print("Creating tool_photos table...")
            await session.execute(text(create_table_sql))
            
            # Create indexes
            create_indexes_sql = [
                "CREATE INDEX IF NOT EXISTS ix_tool_photos_tool_id ON tool_photos(tool_id);",
                "CREATE INDEX IF NOT EXISTS ix_tool_photos_is_primary ON tool_photos(is_primary);", 
                "CREATE INDEX IF NOT EXISTS ix_tool_photos_is_active ON tool_photos(is_active);"
            ]
            
            print("Creating indexes...")
            for index_sql in create_indexes_sql:
                await session.execute(text(index_sql))
            
            await session.commit()
            print("✅ Successfully created tool_photos table and indexes!")
            return True
            
    except Exception as e:
        print(f"❌ Error creating table: {str(e)}")
        return False
    finally:
        await engine.dispose()

if __name__ == "__main__":
    success = asyncio.run(create_tool_photos_table())
    sys.exit(0 if success else 1)