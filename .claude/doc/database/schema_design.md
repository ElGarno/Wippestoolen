# Database Schema Design - Wippestoolen Tool-Sharing Platform

## Overview

This document outlines the PostgreSQL database schema design for the Wippestoolen tool-sharing platform MVP. The design focuses on normalized data structure with strategic denormalization for performance, scalability from 10-40 initial users to 10,000+ users, and cost-effective storage patterns.

## Entity-Relationship Diagram Description

### Core Entities and Relationships

```
Users (1) ←→ (M) Tools
Users (1) ←→ (M) Bookings (as borrower)
Users (1) ←→ (M) Bookings (as tool owner via Tools)
Bookings (1) ←→ (M) Reviews
Users (1) ←→ (M) Notifications
Tools (1) ←→ (M) ToolPhotos
Users (1) ←→ (M) UserSessions
Bookings (1) ←→ (M) BookingStatusHistory
Tools (1) ←→ (1) ToolCategories
Users (1) ←→ (M) AuditLogs
```

## Database Schema

### 1. Users Table

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    first_name VARCHAR(50),
    last_name VARCHAR(50),
    phone_number VARCHAR(20),
    
    -- Location data
    address TEXT,
    city VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(2) DEFAULT 'NL',
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    location_precision INTEGER DEFAULT 100, -- meters radius for privacy
    
    -- Profile data
    bio TEXT,
    avatar_url VARCHAR(500),
    
    -- Ratings (denormalized for performance)
    average_rating DECIMAL(3, 2) DEFAULT 0.0,
    total_ratings INTEGER DEFAULT 0,
    
    -- Account status
    is_active BOOLEAN DEFAULT true,
    is_verified BOOLEAN DEFAULT false,
    email_verified_at TIMESTAMP,
    
    -- Privacy settings
    location_visible BOOLEAN DEFAULT true,
    profile_visible BOOLEAN DEFAULT true,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP,
    
    -- GDPR compliance
    data_retention_until DATE,
    deleted_at TIMESTAMP,
    
    CONSTRAINT users_rating_range CHECK (average_rating >= 0 AND average_rating <= 5),
    CONSTRAINT users_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Indexes for performance
CREATE INDEX idx_users_location ON users USING GIST (point(longitude, latitude)) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_email ON users (email) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_active ON users (is_active) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_created_at ON users (created_at);
```

### 2. Tool Categories Table

```sql
CREATE TABLE tool_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    slug VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    icon_name VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default categories
INSERT INTO tool_categories (name, slug, description, sort_order) VALUES
('Power Tools', 'power-tools', 'Electric and battery-powered tools', 1),
('Hand Tools', 'hand-tools', 'Manual tools and equipment', 2),
('Garden Tools', 'garden-tools', 'Lawn and garden equipment', 3),
('Cleaning', 'cleaning', 'Cleaning equipment and supplies', 4),
('Kitchen', 'kitchen', 'Kitchen appliances and tools', 5),
('DIY & Repair', 'diy-repair', 'General repair and DIY tools', 6),
('Automotive', 'automotive', 'Car and bike maintenance tools', 7),
('Sports & Recreation', 'sports-recreation', 'Sports and outdoor equipment', 8),
('Electronics', 'electronics', 'Electronic devices and gadgets', 9),
('Other', 'other', 'Miscellaneous tools and equipment', 10);
```

### 3. Tools Table

```sql
CREATE TABLE tools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id INTEGER NOT NULL REFERENCES tool_categories(id),
    
    -- Tool information
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    brand VARCHAR(100),
    model VARCHAR(100),
    condition VARCHAR(20) DEFAULT 'good', -- excellent, good, fair, poor
    
    -- Availability and pricing
    is_available BOOLEAN DEFAULT true,
    max_loan_days INTEGER DEFAULT 7,
    deposit_amount DECIMAL(10, 2) DEFAULT 0,
    daily_rate DECIMAL(10, 2) DEFAULT 0, -- Future: paid rentals
    
    -- Location (can differ from owner location)
    pickup_address TEXT,
    pickup_city VARCHAR(100),
    pickup_postal_code VARCHAR(20),
    pickup_latitude DECIMAL(10, 8),
    pickup_longitude DECIMAL(11, 8),
    delivery_available BOOLEAN DEFAULT false,
    delivery_radius_km INTEGER DEFAULT 0,
    
    -- Usage and maintenance
    usage_instructions TEXT,
    safety_notes TEXT,
    last_maintenance_date DATE,
    next_maintenance_due DATE,
    
    -- Statistics (denormalized for performance)
    total_bookings INTEGER DEFAULT 0,
    average_rating DECIMAL(3, 2) DEFAULT 0.0,
    total_ratings INTEGER DEFAULT 0,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP,
    
    CONSTRAINT tools_condition_check CHECK (condition IN ('excellent', 'good', 'fair', 'poor')),
    CONSTRAINT tools_rating_range CHECK (average_rating >= 0 AND average_rating <= 5),
    CONSTRAINT tools_max_loan_days CHECK (max_loan_days > 0 AND max_loan_days <= 365),
    CONSTRAINT tools_deposit_amount CHECK (deposit_amount >= 0)
);

-- Indexes for performance
CREATE INDEX idx_tools_owner ON tools (owner_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_tools_category ON tools (category_id) WHERE is_active = true AND deleted_at IS NULL;
CREATE INDEX idx_tools_location ON tools USING GIST (point(pickup_longitude, pickup_latitude)) WHERE is_active = true AND deleted_at IS NULL;
CREATE INDEX idx_tools_available ON tools (is_available, is_active) WHERE deleted_at IS NULL;
CREATE INDEX idx_tools_search ON tools USING GIN (to_tsvector('english', title || ' ' || description)) WHERE is_active = true AND deleted_at IS NULL;
CREATE INDEX idx_tools_created_at ON tools (created_at);
```

### 4. Tool Photos Table

```sql
CREATE TABLE tool_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
    
    -- Photo data
    original_url VARCHAR(500) NOT NULL,
    thumbnail_url VARCHAR(500),
    medium_url VARCHAR(500),
    large_url VARCHAR(500),
    
    -- Metadata
    filename VARCHAR(255),
    file_size_bytes INTEGER,
    mime_type VARCHAR(50),
    width INTEGER,
    height INTEGER,
    
    -- Ordering
    display_order INTEGER DEFAULT 0,
    is_primary BOOLEAN DEFAULT false,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT tool_photos_file_size CHECK (file_size_bytes > 0),
    CONSTRAINT tool_photos_dimensions CHECK (width > 0 AND height > 0)
);

CREATE INDEX idx_tool_photos_tool ON tool_photos (tool_id, display_order) WHERE is_active = true;
CREATE UNIQUE INDEX idx_tool_photos_primary ON tool_photos (tool_id) WHERE is_primary = true AND is_active = true;
```

### 5. Bookings Table

```sql
CREATE TABLE bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    borrower_id UUID NOT NULL REFERENCES users(id),
    tool_id UUID NOT NULL REFERENCES tools(id),
    
    -- Booking details
    requested_start_date DATE NOT NULL,
    requested_end_date DATE NOT NULL,
    actual_start_date DATE,
    actual_end_date DATE,
    
    -- Status workflow: pending -> confirmed -> active -> returned -> completed
    -- or: pending -> declined / cancelled
    status VARCHAR(20) DEFAULT 'pending' NOT NULL,
    
    -- Messages and notes
    borrower_message TEXT, -- Initial request message
    owner_response TEXT,   -- Owner's response to request
    pickup_notes TEXT,     -- Notes about pickup/delivery
    return_notes TEXT,     -- Notes about return condition
    
    -- Financial details
    deposit_amount DECIMAL(10, 2) DEFAULT 0,
    deposit_paid BOOLEAN DEFAULT false,
    deposit_returned BOOLEAN DEFAULT false,
    daily_rate DECIMAL(10, 2) DEFAULT 0,
    total_amount DECIMAL(10, 2) DEFAULT 0,
    
    -- Pickup/delivery details
    pickup_method VARCHAR(20) DEFAULT 'pickup', -- pickup, delivery
    pickup_address TEXT,
    delivery_fee DECIMAL(10, 2) DEFAULT 0,
    
    -- Cancellation
    cancelled_by UUID REFERENCES users(id),
    cancellation_reason TEXT,
    cancelled_at TIMESTAMP,
    
    -- Important dates
    confirmed_at TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT bookings_status_check CHECK (status IN ('pending', 'confirmed', 'active', 'returned', 'completed', 'declined', 'cancelled')),
    CONSTRAINT bookings_pickup_method_check CHECK (pickup_method IN ('pickup', 'delivery')),
    CONSTRAINT bookings_date_logic CHECK (requested_end_date >= requested_start_date),
    CONSTRAINT bookings_amounts_positive CHECK (deposit_amount >= 0 AND daily_rate >= 0 AND total_amount >= 0)
);

-- Indexes for performance
CREATE INDEX idx_bookings_borrower ON bookings (borrower_id, created_at DESC);
CREATE INDEX idx_bookings_tool ON bookings (tool_id, created_at DESC);
CREATE INDEX idx_bookings_status ON bookings (status, created_at DESC);
CREATE INDEX idx_bookings_dates ON bookings (requested_start_date, requested_end_date) WHERE status IN ('confirmed', 'active');
CREATE INDEX idx_bookings_owner ON bookings (tool_id) INCLUDE (borrower_id, status, created_at);

-- Get owner_id for bookings via tools table
CREATE INDEX idx_bookings_for_owners ON tools (owner_id) INCLUDE (id);
```

### 6. Booking Status History Table

```sql
CREATE TABLE booking_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    
    -- Status change details
    from_status VARCHAR(20),
    to_status VARCHAR(20) NOT NULL,
    changed_by UUID NOT NULL REFERENCES users(id),
    
    -- Context
    reason TEXT,
    notes TEXT,
    
    -- Timestamp
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT bsh_status_check CHECK (
        from_status IN ('pending', 'confirmed', 'active', 'returned', 'completed', 'declined', 'cancelled') AND
        to_status IN ('pending', 'confirmed', 'active', 'returned', 'completed', 'declined', 'cancelled')
    )
);

CREATE INDEX idx_booking_status_history ON booking_status_history (booking_id, created_at);
```

### 7. Reviews Table

```sql
CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES bookings(id),
    reviewer_id UUID NOT NULL REFERENCES users(id),
    reviewee_id UUID NOT NULL REFERENCES users(id),
    
    -- Review content
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    title VARCHAR(200),
    comment TEXT,
    
    -- Review type
    review_type VARCHAR(20) NOT NULL, -- 'borrower_to_owner' or 'owner_to_borrower'
    
    -- Tool condition (for borrower reviews)
    tool_condition_rating INTEGER CHECK (tool_condition_rating >= 1 AND tool_condition_rating <= 5),
    
    -- Response to review
    response TEXT,
    response_at TIMESTAMP,
    
    -- Moderation
    is_flagged BOOLEAN DEFAULT false,
    flagged_reason TEXT,
    is_approved BOOLEAN DEFAULT true,
    moderated_by UUID REFERENCES users(id),
    moderated_at TIMESTAMP,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT reviews_type_check CHECK (review_type IN ('borrower_to_owner', 'owner_to_borrower')),
    CONSTRAINT reviews_not_self_review CHECK (reviewer_id != reviewee_id)
);

-- Ensure one review per user per booking per type
CREATE UNIQUE INDEX idx_reviews_unique ON reviews (booking_id, reviewer_id, review_type);
CREATE INDEX idx_reviews_reviewee ON reviews (reviewee_id, created_at DESC) WHERE is_approved = true;
CREATE INDEX idx_reviews_reviewer ON reviews (reviewer_id, created_at DESC);
CREATE INDEX idx_reviews_moderation ON reviews (is_approved, is_flagged) WHERE is_flagged = true OR is_approved = false;
```

### 8. Notifications Table

```sql
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Notification content
    type VARCHAR(50) NOT NULL,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    
    -- Related entities (optional)
    related_booking_id UUID REFERENCES bookings(id),
    related_tool_id UUID REFERENCES tools(id),
    related_user_id UUID REFERENCES users(id),
    
    -- Action data (for deep linking)
    action_url VARCHAR(500),
    action_data JSONB,
    
    -- Status
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMP,
    
    -- Priority
    priority VARCHAR(10) DEFAULT 'normal', -- low, normal, high, urgent
    
    -- Delivery channels
    sent_in_app BOOLEAN DEFAULT true,
    sent_email BOOLEAN DEFAULT false,
    sent_push BOOLEAN DEFAULT false,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '30 days'),
    
    CONSTRAINT notifications_priority_check CHECK (priority IN ('low', 'normal', 'high', 'urgent'))
);

CREATE INDEX idx_notifications_recipient ON notifications (recipient_id, created_at DESC) WHERE expires_at > CURRENT_TIMESTAMP;
CREATE INDEX idx_notifications_unread ON notifications (recipient_id, is_read, created_at DESC) WHERE is_read = false AND expires_at > CURRENT_TIMESTAMP;
CREATE INDEX idx_notifications_type ON notifications (type, created_at DESC);
CREATE INDEX idx_notifications_cleanup ON notifications (expires_at) WHERE expires_at <= CURRENT_TIMESTAMP;
```

### 9. User Sessions Table

```sql
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Session data
    session_token VARCHAR(255) UNIQUE NOT NULL,
    refresh_token VARCHAR(255) UNIQUE,
    
    -- Client information
    ip_address INET,
    user_agent TEXT,
    device_type VARCHAR(50), -- web, mobile, tablet
    
    -- Session management
    is_active BOOLEAN DEFAULT true,
    last_activity_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    
    CONSTRAINT user_sessions_expiry CHECK (expires_at > created_at)
);

CREATE INDEX idx_user_sessions_token ON user_sessions (session_token) WHERE is_active = true;
CREATE INDEX idx_user_sessions_user ON user_sessions (user_id, last_activity_at DESC) WHERE is_active = true;
CREATE INDEX idx_user_sessions_cleanup ON user_sessions (expires_at) WHERE expires_at <= CURRENT_TIMESTAMP OR is_active = false;
```

### 10. Audit Log Table

```sql
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Who performed the action
    user_id UUID REFERENCES users(id),
    session_id UUID REFERENCES user_sessions(id),
    
    -- What action was performed
    table_name VARCHAR(50) NOT NULL,
    record_id UUID,
    action VARCHAR(20) NOT NULL, -- INSERT, UPDATE, DELETE
    
    -- Change details
    old_values JSONB,
    new_values JSONB,
    changed_fields TEXT[],
    
    -- Context
    ip_address INET,
    user_agent TEXT,
    
    -- Timestamp
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT audit_logs_action_check CHECK (action IN ('INSERT', 'UPDATE', 'DELETE'))
);

CREATE INDEX idx_audit_logs_user ON audit_logs (user_id, created_at DESC);
CREATE INDEX idx_audit_logs_table ON audit_logs (table_name, record_id, created_at DESC);
CREATE INDEX idx_audit_logs_created_at ON audit_logs (created_at);
```

## Data Integrity Rules

### 1. Referential Integrity

```sql
-- Ensure booking dates don't overlap for the same tool
CREATE OR REPLACE FUNCTION check_booking_overlap()
RETURNS TRIGGER AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM bookings 
        WHERE tool_id = NEW.tool_id 
          AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000')
          AND status IN ('confirmed', 'active')
          AND (
              (NEW.requested_start_date, NEW.requested_end_date) OVERLAPS 
              (requested_start_date, requested_end_date)
          )
    ) THEN
        RAISE EXCEPTION 'Booking dates overlap with existing confirmed booking';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_check_booking_overlap
    BEFORE INSERT OR UPDATE ON bookings
    FOR EACH ROW EXECUTE FUNCTION check_booking_overlap();
```

### 2. Rating Updates

```sql
-- Update user ratings when reviews are added/updated/deleted
CREATE OR REPLACE FUNCTION update_user_ratings()
RETURNS TRIGGER AS $$
BEGIN
    -- Update reviewee ratings
    WITH rating_stats AS (
        SELECT 
            AVG(rating)::DECIMAL(3,2) as avg_rating,
            COUNT(*)::INTEGER as total_ratings
        FROM reviews 
        WHERE reviewee_id = COALESCE(NEW.reviewee_id, OLD.reviewee_id)
          AND is_approved = true
    )
    UPDATE users 
    SET 
        average_rating = rating_stats.avg_rating,
        total_ratings = rating_stats.total_ratings,
        updated_at = CURRENT_TIMESTAMP
    FROM rating_stats 
    WHERE id = COALESCE(NEW.reviewee_id, OLD.reviewee_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_user_ratings
    AFTER INSERT OR UPDATE OR DELETE ON reviews
    FOR EACH ROW EXECUTE FUNCTION update_user_ratings();
```

### 3. Tool Statistics Updates

```sql
-- Update tool statistics when bookings are completed
CREATE OR REPLACE FUNCTION update_tool_stats()
RETURNS TRIGGER AS $$
BEGIN
    -- Update booking count when status changes to completed
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        UPDATE tools 
        SET 
            total_bookings = total_bookings + 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = NEW.tool_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_tool_stats
    AFTER UPDATE ON bookings
    FOR EACH ROW EXECUTE FUNCTION update_tool_stats();
```

## Performance Optimization Strategies

### 1. Indexing Strategy

**Primary Indexes (Already Defined Above)**
- Spatial indexes for location-based searches
- Full-text search indexes for tool discovery
- Compound indexes for common query patterns

**Additional Optimization Indexes**

```sql
-- For dashboard queries
CREATE INDEX idx_user_dashboard_bookings ON bookings (borrower_id, status, requested_start_date DESC) 
    WHERE status IN ('pending', 'confirmed', 'active');

-- For owner tool management
CREATE INDEX idx_owner_tools_with_bookings ON tools (owner_id, is_active) 
    INCLUDE (title, total_bookings, average_rating);

-- For notification counts
CREATE INDEX idx_unread_notification_counts ON notifications (recipient_id) 
    WHERE is_read = false AND expires_at > CURRENT_TIMESTAMP;
```

### 2. Query Optimization Patterns

**Nearby Tools Search (Most Common Query)**

```sql
-- Optimized nearby tools query with filters
EXPLAIN (ANALYZE, BUFFERS) 
SELECT t.id, t.title, t.average_rating, t.deposit_amount,
       tp.thumbnail_url,
       point(t.pickup_longitude, t.pickup_latitude) <@> point($1, $2) AS distance_km
FROM tools t
LEFT JOIN tool_photos tp ON tp.tool_id = t.id AND tp.is_primary = true
WHERE t.is_active = true 
  AND t.is_available = true
  AND t.deleted_at IS NULL
  AND t.category_id = COALESCE($3, t.category_id)
  AND point(t.pickup_longitude, t.pickup_latitude) <@> point($1, $2) <= $4
ORDER BY distance_km, t.average_rating DESC
LIMIT 20;
```

### 3. Denormalization Strategy

**Already Implemented**
- User average ratings stored in users table
- Tool statistics cached in tools table
- Primary photo reference for quick loading

**Future Considerations**
- Tool availability cache table for complex availability rules
- User location cache for privacy-adjusted coordinates
- Search result caching for popular queries

## Migration Strategy

### 1. Migration Phases

**Phase 1: Core Tables (Week 1)**
```sql
-- 001_create_users.sql
-- 002_create_tool_categories.sql
-- 003_create_tools.sql
-- 004_create_tool_photos.sql
```

**Phase 2: Booking System (Week 2)**
```sql
-- 005_create_bookings.sql
-- 006_create_booking_status_history.sql
-- 007_add_booking_constraints.sql
```

**Phase 3: Reviews and Notifications (Week 3)**
```sql
-- 008_create_reviews.sql
-- 009_create_notifications.sql
-- 010_add_rating_triggers.sql
```

**Phase 4: Security and Audit (Week 4)**
```sql
-- 011_create_user_sessions.sql
-- 012_create_audit_logs.sql
-- 013_add_security_constraints.sql
```

### 2. Data Seeding Strategy

```sql
-- seed_categories.sql
INSERT INTO tool_categories (name, slug, description, sort_order) VALUES 
    -- Categories as defined above

-- seed_test_users.sql (for development)
INSERT INTO users (email, password_hash, display_name, city, latitude, longitude) VALUES
    ('alice@example.com', '$2b$12$...', 'Alice', 'Amsterdam', 52.3676, 4.9041),
    ('bob@example.com', '$2b$12$...', 'Bob', 'Utrecht', 52.0907, 5.1214);
```

### 3. Migration Rollback Strategy

```sql
-- Each migration includes corresponding DOWN migration
-- Example: 001_create_users_down.sql
DROP TRIGGER IF EXISTS trigger_users_updated_at ON users;
DROP FUNCTION IF EXISTS update_updated_at_column();
DROP TABLE IF EXISTS users CASCADE;
```

## Backup and Recovery Considerations

### 1. Backup Strategy

**Production Backup Schedule**
```bash
# Full backup daily at 2 AM
0 2 * * * pg_dump -h $DB_HOST -U $DB_USER -d wippestoolen_prod > /backups/full_$(date +%Y%m%d).sql

# Incremental WAL archiving (continuous)
archive_mode = on
archive_command = 'aws s3 cp %p s3://wippestoolen-backups/wal/%f'
```

**Critical Tables Priority**
1. **users** - Core user data
2. **bookings** - Transaction records
3. **tools** - Tool inventory
4. **reviews** - Trust system data
5. **notifications** - Communication logs

### 2. Recovery Procedures

**Point-in-Time Recovery**
```sql
-- Restore from backup and replay WAL to specific timestamp
SELECT pg_create_restore_point('before_data_migration_20250821');
```

**Table-Level Recovery**
```sql
-- Restore single table from backup
pg_restore --table=users --data-only backup_20250821.dump
```

### 3. Disaster Recovery Plan

**RTO/RPO Targets**
- **RTO**: 4 hours maximum downtime
- **RPO**: 15 minutes maximum data loss
- **Multi-AZ**: Primary/standby in different availability zones

**Recovery Testing**
- Monthly backup restoration tests
- Quarterly disaster recovery drills
- Automated backup integrity checks

## Security Considerations

### 1. Data Encryption

**At Rest**
```sql
-- Enable transparent data encryption
ALTER SYSTEM SET encryption_key_management = 'AWS_KMS';
ALTER SYSTEM SET encryption_key_id = 'arn:aws:kms:eu-west-1:123456789:key/...';
```

**In Transit**
- Force SSL connections
- Certificate-based authentication for applications

### 2. Access Control

**Database Users**
```sql
-- Application user (limited permissions)
CREATE USER wippestoolen_app WITH PASSWORD 'secure_password';
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO wippestoolen_app;
REVOKE ALL ON audit_logs FROM wippestoolen_app; -- Read-only access

-- Read-only analytics user
CREATE USER wippestoolen_analytics WITH PASSWORD 'secure_password';
GRANT SELECT ON ALL TABLES IN SCHEMA public TO wippestoolen_analytics;
```

**Row Level Security**
```sql
-- Enable RLS for user data privacy
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY users_own_data ON users FOR ALL USING (id = current_user_id());

-- Tools privacy policy
ALTER TABLE tools ENABLE ROW LEVEL SECURITY;
CREATE POLICY tools_visibility ON tools FOR SELECT USING (
    is_active = true OR owner_id = current_user_id()
);
```

### 3. GDPR Compliance

**Data Retention**
```sql
-- Automated data cleanup for GDPR
CREATE OR REPLACE FUNCTION cleanup_expired_data()
RETURNS void AS $$
BEGIN
    -- Soft delete users past retention period
    UPDATE users 
    SET deleted_at = CURRENT_TIMESTAMP,
        email = 'deleted_' || id::text || '@example.com',
        password_hash = 'DELETED'
    WHERE data_retention_until < CURRENT_DATE 
      AND deleted_at IS NULL;
      
    -- Clean up old sessions
    DELETE FROM user_sessions 
    WHERE expires_at < CURRENT_TIMESTAMP - INTERVAL '30 days';
    
    -- Clean up old notifications
    DELETE FROM notifications 
    WHERE expires_at < CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- Schedule cleanup job
SELECT cron.schedule('gdpr-cleanup', '0 3 * * *', 'SELECT cleanup_expired_data();');
```

## Scaling Considerations

### 1. Read Replicas

**Configuration for 1000+ Users**
```sql
-- Configure streaming replication
# Primary server postgresql.conf
wal_level = replica
max_wal_senders = 3
wal_keep_segments = 32

# Replica server postgresql.conf
hot_standby = on
max_standby_streaming_delay = 30s
```

**Read/Write Splitting**
- Write operations: Primary database
- Analytics queries: Read replica
- Search operations: Read replica with search-optimized indexes

### 2. Partitioning Strategy (10,000+ Users)

**Audit Logs Partitioning**
```sql
-- Partition by month for audit logs
CREATE TABLE audit_logs_y2025m01 PARTITION OF audit_logs
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

-- Automated partition creation
CREATE OR REPLACE FUNCTION create_monthly_partitions()
RETURNS void AS $$
DECLARE
    start_date date;
    end_date date;
    partition_name text;
BEGIN
    start_date := date_trunc('month', CURRENT_DATE + INTERVAL '1 month');
    end_date := start_date + INTERVAL '1 month';
    partition_name := 'audit_logs_y' || extract(year from start_date) || 'm' || 
                     lpad(extract(month from start_date)::text, 2, '0');
    
    EXECUTE format('CREATE TABLE IF NOT EXISTS %I PARTITION OF audit_logs 
                   FOR VALUES FROM (%L) TO (%L)', 
                   partition_name, start_date, end_date);
END;
$$ LANGUAGE plpgsql;
```

### 3. Connection Pooling

**PgBouncer Configuration**
```ini
[databases]
wippestoolen_prod = host=localhost port=5432 dbname=wippestoolen_prod

[pgbouncer]
pool_mode = transaction
max_client_conn = 100
default_pool_size = 25
reserve_pool_size = 5
```

## Cost Optimization

### 1. Storage Optimization

**Table Size Monitoring**
```sql
-- Monitor table sizes for cost optimization
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
    pg_total_relation_size(schemaname||'.'||tablename) as bytes
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY bytes DESC;
```

**Index Usage Analysis**
```sql
-- Identify unused indexes for removal
SELECT 
    schemaname, 
    tablename, 
    indexname, 
    idx_tup_read, 
    idx_tup_fetch
FROM pg_stat_user_indexes 
WHERE idx_tup_read = 0 AND idx_tup_fetch = 0
ORDER BY schemaname, tablename, indexname;
```

### 2. Automated Maintenance

**Vacuum and Analyze Schedule**
```sql
-- Automated statistics update
CREATE OR REPLACE FUNCTION update_table_statistics()
RETURNS void AS $$
BEGIN
    -- High-frequency tables
    ANALYZE users, tools, bookings;
    
    -- Less frequent for larger tables
    IF extract(hour from now()) = 3 THEN
        ANALYZE reviews, notifications, audit_logs;
    END IF;
END;
$$ LANGUAGE plpgsql;

SELECT cron.schedule('update-stats', '0 */6 * * *', 'SELECT update_table_statistics();');
```

## Monitoring and Alerting

### 1. Key Metrics

**Performance Metrics**
```sql
-- Query performance monitoring
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    max_time
FROM pg_stat_statements 
ORDER BY total_time DESC 
LIMIT 10;
```

**Database Health Metrics**
```sql
-- Connection and lock monitoring
SELECT 
    state,
    COUNT(*) as connection_count
FROM pg_stat_activity 
WHERE state IS NOT NULL
GROUP BY state;

-- Blocking queries
SELECT 
    blocked_locks.pid AS blocked_pid,
    blocked_activity.usename AS blocked_user,
    blocking_locks.pid AS blocking_pid,
    blocking_activity.usename AS blocking_user,
    blocked_activity.query AS blocked_statement,
    blocking_activity.query AS blocking_statement
FROM pg_catalog.pg_locks blocked_locks
    JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
    JOIN pg_catalog.pg_locks blocking_locks ON blocking_locks.locktype = blocked_locks.locktype
        AND blocking_locks.database IS NOT DISTINCT FROM blocked_locks.database
    JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.granted;
```

### 2. Alerting Thresholds

**Critical Alerts**
- Connection count > 80% of max_connections
- Replication lag > 1 minute
- Disk usage > 85%
- Query execution time > 5 seconds

**Warning Alerts**
- Average query time increase > 50%
- Failed authentication attempts > 10/minute
- Table bloat > 20%

## Implementation Checklist

### Phase 1: Foundation (Week 1)
- [ ] Set up PostgreSQL with required extensions
- [ ] Create core tables: users, tool_categories, tools, tool_photos
- [ ] Implement basic indexes and constraints
- [ ] Set up connection pooling
- [ ] Configure backup strategy

### Phase 2: Business Logic (Week 2)
- [ ] Create booking system tables
- [ ] Implement booking overlap prevention
- [ ] Add booking status history tracking
- [ ] Create data integrity triggers
- [ ] Test booking workflow end-to-end

### Phase 3: Trust System (Week 3)
- [ ] Implement reviews table and constraints
- [ ] Create rating update triggers
- [ ] Add notification system
- [ ] Implement user session management
- [ ] Test review and rating calculations

### Phase 4: Security and Monitoring (Week 4)
- [ ] Set up audit logging
- [ ] Implement row-level security
- [ ] Configure monitoring and alerting
- [ ] Set up automated maintenance
- [ ] Perform security audit
- [ ] Load testing and optimization

### Phase 5: Production Readiness
- [ ] Set up read replicas
- [ ] Configure disaster recovery
- [ ] Implement GDPR compliance procedures
- [ ] Create operational runbooks
- [ ] Performance benchmarking
- [ ] Go-live checklist completion

This database schema design provides a solid foundation for the Wippestoolen tool-sharing platform, balancing normalization with performance, scalability with cost-effectiveness, and functionality with security.