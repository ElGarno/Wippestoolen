-- Create tool_photos table
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

-- Create indexes
CREATE INDEX IF NOT EXISTS ix_tool_photos_tool_id ON tool_photos(tool_id);
CREATE INDEX IF NOT EXISTS ix_tool_photos_is_primary ON tool_photos(is_primary);
CREATE INDEX IF NOT EXISTS ix_tool_photos_is_active ON tool_photos(is_active);