# Booking Database Schema Optimization

## Current Schema Analysis

The existing booking schema is well-designed with proper constraints and data types. This document provides optimization recommendations for performance and scalability.

### Current Booking Table Structure

```sql
CREATE TABLE bookings (
    id UUID PRIMARY KEY,
    borrower_id UUID REFERENCES users(id),
    tool_id UUID REFERENCES tools(id),
    requested_start_date DATE NOT NULL,
    requested_end_date DATE NOT NULL,
    actual_start_date DATE,
    actual_end_date DATE,
    status VARCHAR(20) CHECK (status IN ('pending', 'confirmed', 'active', 'returned', 'completed', 'declined', 'cancelled')),
    borrower_message TEXT,
    owner_response TEXT,
    pickup_notes TEXT,
    return_notes TEXT,
    deposit_amount DECIMAL(10,2) NOT NULL,
    deposit_paid BOOLEAN NOT NULL DEFAULT FALSE,
    deposit_returned BOOLEAN NOT NULL DEFAULT FALSE,
    daily_rate DECIMAL(10,2) NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    pickup_method VARCHAR(20) CHECK (pickup_method IN ('pickup', 'delivery')),
    pickup_address TEXT,
    delivery_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
    cancelled_by UUID REFERENCES users(id),
    cancellation_reason TEXT,
    cancelled_at TIMESTAMP,
    confirmed_at TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CHECK (requested_end_date >= requested_start_date),
    CHECK (deposit_amount >= 0 AND daily_rate >= 0 AND total_amount >= 0)
);
```

## Recommended Database Indexes

### 1. Primary Availability Query Optimization

```sql
-- Critical index for availability checking
-- Optimizes queries filtering by tool_id, status, and date ranges
CREATE INDEX idx_bookings_availability ON bookings 
(tool_id, status, requested_start_date, requested_end_date)
WHERE status IN ('pending', 'confirmed', 'active', 'returned');
```

**Rationale**: This partial index covers the most common query pattern for checking tool availability. The WHERE clause reduces index size by excluding cancelled/declined bookings.

### 2. User Booking History Queries

```sql
-- Index for borrower's booking history
CREATE INDEX idx_bookings_borrower_history ON bookings 
(borrower_id, created_at DESC, status);

-- Index for tool owner's booking management
CREATE INDEX idx_bookings_owner_management ON bookings 
(tool_id, status, created_at DESC)
WHERE status IN ('pending', 'confirmed', 'active');
```

**Rationale**: Optimizes user dashboard queries and booking management interfaces.

### 3. Status-Based Queries

```sql
-- Index for pending bookings requiring action
CREATE INDEX idx_bookings_pending_action ON bookings 
(status, created_at)
WHERE status = 'pending';

-- Index for active bookings monitoring
CREATE INDEX idx_bookings_active_monitoring ON bookings 
(status, requested_end_date)
WHERE status IN ('confirmed', 'active');
```

### 4. Calendar and Date-Range Queries

```sql
-- Index for calendar view queries
CREATE INDEX idx_bookings_calendar ON bookings 
(requested_start_date, requested_end_date, status)
WHERE status IN ('confirmed', 'active', 'returned');
```

## Query Optimization Strategies

### 1. Availability Checking Query

**Optimized Query**:
```sql
-- Check tool availability for date range
SELECT EXISTS (
    SELECT 1 FROM bookings 
    WHERE tool_id = $1 
      AND status IN ('confirmed', 'active', 'returned')
      AND requested_start_date <= $3  -- end_date
      AND requested_end_date >= $2    -- start_date
) AS has_conflict;
```

**Performance**: Uses the `idx_bookings_availability` index for O(log n) lookup.

### 2. User Booking History Query

**Optimized Query**:
```sql
-- Get user's booking history with pagination
SELECT b.*, t.title, t.category, u.username as owner_username
FROM bookings b
JOIN tools t ON b.tool_id = t.id
JOIN users u ON t.owner_id = u.id
WHERE b.borrower_id = $1
  AND ($2 IS NULL OR b.status = $2)  -- Optional status filter
ORDER BY b.created_at DESC
LIMIT $3 OFFSET $4;
```

**Performance**: Uses `idx_bookings_borrower_history` for efficient sorting and filtering.

### 3. Tool Owner's Pending Requests

**Optimized Query**:
```sql
-- Get pending booking requests for tool owner
SELECT b.*, t.title, u.username as borrower_username, u.rating as borrower_rating
FROM bookings b
JOIN tools t ON b.tool_id = t.id
JOIN users u ON b.borrower_id = u.id
WHERE t.owner_id = $1
  AND b.status = 'pending'
ORDER BY b.created_at ASC;
```

## Concurrency and Locking Strategies

### 1. Preventing Double Bookings

**Row-Level Locking Approach**:
```sql
-- Lock tool row to prevent concurrent bookings
BEGIN;
SELECT * FROM tools WHERE id = $1 FOR UPDATE;

-- Check availability within transaction
SELECT COUNT(*) FROM bookings 
WHERE tool_id = $1 
  AND status IN ('confirmed', 'active', 'returned')
  AND requested_start_date <= $3 
  AND requested_end_date >= $2;

-- Insert booking if available
INSERT INTO bookings (...) VALUES (...);
COMMIT;
```

### 2. Optimistic Locking for Updates

**Version Column Approach**:
```sql
-- Add version column for optimistic locking
ALTER TABLE bookings ADD COLUMN version INTEGER DEFAULT 1;

-- Update with version check
UPDATE bookings 
SET status = $2, version = version + 1, updated_at = CURRENT_TIMESTAMP
WHERE id = $1 AND version = $3;
```

## Performance Monitoring Queries

### 1. Index Usage Analysis

```sql
-- Check index usage statistics
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes 
WHERE tablename = 'bookings'
ORDER BY idx_scan DESC;
```

### 2. Slow Query Identification

```sql
-- Find slow booking-related queries
SELECT 
    query,
    mean_exec_time,
    calls,
    total_exec_time
FROM pg_stat_statements 
WHERE query ILIKE '%bookings%'
ORDER BY mean_exec_time DESC
LIMIT 10;
```

## Scalability Considerations

### 1. Partitioning Strategy

For high-volume scenarios (10,000+ bookings per month):

```sql
-- Partition by month for time-based queries
CREATE TABLE bookings_2024_01 PARTITION OF bookings
FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE TABLE bookings_2024_02 PARTITION OF bookings
FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');
```

### 2. Archive Strategy

```sql
-- Archive completed bookings older than 2 years
CREATE TABLE bookings_archive (LIKE bookings INCLUDING ALL);

-- Move old completed bookings
WITH moved_bookings AS (
    DELETE FROM bookings 
    WHERE status = 'completed' 
      AND completed_at < CURRENT_DATE - INTERVAL '2 years'
    RETURNING *
)
INSERT INTO bookings_archive SELECT * FROM moved_bookings;
```

### 3. Read Replicas for Analytics

Configure read replicas for:
- User dashboard queries
- Reporting and analytics
- Availability calendars

## Caching Strategies

### 1. Tool Availability Cache

**Redis Cache Pattern**:
```python
# Cache key pattern: availability:{tool_id}:{month}
# Cache monthly availability for popular tools

async def get_cached_availability(tool_id: UUID, month: str) -> Optional[dict]:
    key = f"availability:{tool_id}:{month}"
    data = await redis.get(key)
    return json.loads(data) if data else None

async def cache_availability(tool_id: UUID, month: str, data: dict):
    key = f"availability:{tool_id}:{month}"
    await redis.setex(key, 3600, json.dumps(data))  # 1 hour TTL
```

### 2. User Booking Cache

**Application-Level Caching**:
```python
# Cache user's recent bookings
async def get_user_bookings_cached(user_id: UUID) -> List[dict]:
    key = f"user_bookings:{user_id}"
    cached = await redis.get(key)
    
    if cached:
        return json.loads(cached)
    
    # Fetch from database
    bookings = await fetch_user_bookings(user_id)
    await redis.setex(key, 300, json.dumps(bookings))  # 5 min TTL
    return bookings
```

## Data Integrity Safeguards

### 1. Trigger for Automatic Status Updates

```sql
-- Trigger to auto-complete returned bookings
CREATE OR REPLACE FUNCTION auto_complete_bookings()
RETURNS TRIGGER AS $$
BEGIN
    -- Auto-complete bookings that have been returned for 24+ hours
    UPDATE bookings 
    SET status = 'completed', 
        completed_at = CURRENT_TIMESTAMP
    WHERE status = 'returned' 
      AND updated_at < CURRENT_TIMESTAMP - INTERVAL '24 hours';
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_complete_bookings
    AFTER UPDATE ON bookings
    FOR EACH STATEMENT
    EXECUTE FUNCTION auto_complete_bookings();
```

### 2. Constraint Validation

```sql
-- Additional constraints for data integrity
ALTER TABLE bookings ADD CONSTRAINT check_actual_dates
CHECK (
    (actual_start_date IS NULL AND actual_end_date IS NULL) OR
    (actual_start_date IS NOT NULL AND actual_end_date >= actual_start_date)
);

ALTER TABLE bookings ADD CONSTRAINT check_status_dates
CHECK (
    (status = 'confirmed' AND confirmed_at IS NOT NULL) OR
    (status != 'confirmed') OR
    (status = 'active' AND started_at IS NOT NULL) OR
    (status != 'active')
);
```

## Migration Scripts

### 1. Index Creation Migration

```python
"""Add booking optimization indexes

Revision ID: 003_booking_indexes
Revises: 002_booking_schema
Create Date: 2024-01-15
"""

from alembic import op

def upgrade():
    # Create availability checking index
    op.execute("""
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookings_availability 
        ON bookings (tool_id, status, requested_start_date, requested_end_date)
        WHERE status IN ('pending', 'confirmed', 'active', 'returned')
    """)
    
    # Create user history indexes
    op.execute("""
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookings_borrower_history 
        ON bookings (borrower_id, created_at DESC, status)
    """)
    
    # Create owner management index
    op.execute("""
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookings_owner_management 
        ON bookings (tool_id, status, created_at DESC)
        WHERE status IN ('pending', 'confirmed', 'active')
    """)

def downgrade():
    op.execute("DROP INDEX IF EXISTS idx_bookings_availability")
    op.execute("DROP INDEX IF EXISTS idx_bookings_borrower_history")
    op.execute("DROP INDEX IF EXISTS idx_bookings_owner_management")
```

### 2. Performance Monitoring Setup

```python
"""Enable query performance monitoring

Revision ID: 004_performance_monitoring
"""

def upgrade():
    # Enable pg_stat_statements extension
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_stat_statements")
    
    # Create monitoring view
    op.execute("""
        CREATE VIEW booking_query_stats AS
        SELECT 
            query,
            calls,
            total_exec_time,
            mean_exec_time,
            rows
        FROM pg_stat_statements 
        WHERE query ILIKE '%bookings%'
        ORDER BY total_exec_time DESC
    """)
```

## Backup and Recovery

### 1. Point-in-Time Recovery Setup

```sql
-- Enable WAL archiving for PITR
archive_mode = on
archive_command = 'cp %p /backup/wal/%f'
wal_level = replica
```

### 2. Booking Data Export

```python
async def export_booking_data(start_date: date, end_date: date) -> str:
    """Export booking data for backup or analysis."""
    
    query = """
    SELECT 
        b.*,
        t.title as tool_title,
        t.category as tool_category,
        bo.username as borrower_username,
        o.username as owner_username
    FROM bookings b
    JOIN tools t ON b.tool_id = t.id
    JOIN users bo ON b.borrower_id = bo.id
    JOIN users o ON t.owner_id = o.id
    WHERE b.created_at BETWEEN $1 AND $2
    ORDER BY b.created_at
    """
    
    # Export to CSV or JSON format
    # Implementation depends on export requirements
```

This optimization guide provides comprehensive database strategies for high-performance booking operations while maintaining data integrity and scalability.