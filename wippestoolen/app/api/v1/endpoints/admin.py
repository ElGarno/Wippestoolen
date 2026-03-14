"""Admin API endpoints for database management."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from wippestoolen.app.core.database import get_db

router = APIRouter(prefix="/admin", tags=["Admin"])

@router.post("/create-tool-photos-table", status_code=status.HTTP_201_CREATED)
async def create_tool_photos_table(db: AsyncSession = Depends(get_db)):
    """
    Create the tool_photos table if it doesn't exist.
    This is a temporary endpoint to fix the missing table issue.
    """
    try:
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
        
        await db.execute(text(create_table_sql))
        
        # Create indexes
        create_indexes_sql = [
            "CREATE INDEX IF NOT EXISTS ix_tool_photos_tool_id ON tool_photos(tool_id);",
            "CREATE INDEX IF NOT EXISTS ix_tool_photos_is_primary ON tool_photos(is_primary);", 
            "CREATE INDEX IF NOT EXISTS ix_tool_photos_is_active ON tool_photos(is_active);"
        ]
        
        for index_sql in create_indexes_sql:
            await db.execute(text(index_sql))
        
        await db.commit()
        
        return {"message": "tool_photos table and indexes created successfully"}
        
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create table: {str(e)}"
        )