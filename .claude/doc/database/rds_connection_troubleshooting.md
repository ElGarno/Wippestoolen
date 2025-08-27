# PostgreSQL RDS Connection Troubleshooting Guide

## Overview

This document provides comprehensive troubleshooting strategies for PostgreSQL RDS connection issues, specifically focusing on authentication failures and pg_hba.conf entry errors in AWS ECS environments.

## Error Analysis

### Common Error Patterns

```
FATAL: password authentication failed for user "wippestoolen_user"
FATAL: no pg_hba.conf entry for host "10.0.10.252", user "wippestoolen_user", database "wippestoolen_production", no encryption
```

### Root Cause Analysis

These errors occurring together typically indicate:

1. **Database Initialization Issue**: The user/database wasn't created during RDS setup
2. **SSL/Encryption Mismatch**: RDS requires SSL but application connects without encryption
3. **Password Mismatch**: Different passwords in Terraform variables vs application environment
4. **Network Configuration**: Security group or subnet routing issues

## Systematic Diagnosis

### Phase 1: Network Connectivity

#### 1.1 Verify Basic Network Connectivity

```bash
# From ECS task or EC2 instance in same VPC
telnet wippestoolen-production.cvx466dfq2il.eu-central-1.rds.amazonaws.com 5432

# Expected: Connection established
# If fails: Network/security group issue
```

#### 1.2 Check Security Group Configuration

```bash
# Verify RDS security group allows inbound on port 5432
aws ec2 describe-security-groups --group-ids sg-xxxxxxxxx

# Expected: Rule allowing 5432 from ECS security group or VPC CIDR
```

#### 1.3 Verify Subnet Routing

```bash
# Check route tables for private subnets
aws ec2 describe-route-tables --filters "Name=vpc-id,Values=vpc-xxxxxxxxx"

# Expected: Routes to NAT gateway for internet access (if needed)
```

### Phase 2: Database Authentication

#### 2.1 Connect with Master Credentials

```bash
# Test connection with RDS master user
psql -h wippestoolen-production.cvx466dfq2il.eu-central-1.rds.amazonaws.com \
     -U masteruser \
     -d postgres \
     --no-password

# If this works: Issue is with application user
# If this fails: Network or RDS configuration issue
```

#### 2.2 Verify Database and User Existence

```sql
-- Connect as master user and check
\l                                    -- List databases
\du                                  -- List users

-- Check if application database exists
SELECT datname FROM pg_database WHERE datname = 'wippestoolen_production';

-- Check if application user exists
SELECT usename FROM pg_user WHERE usename = 'wippestoolen_user';
```

#### 2.3 Verify User Permissions

```sql
-- Check user permissions on database
SELECT datname, datacl FROM pg_database WHERE datname = 'wippestoolen_production';

-- Grant necessary permissions if missing
GRANT ALL PRIVILEGES ON DATABASE wippestoolen_production TO wippestoolen_user;
```

### Phase 3: SSL/Encryption Configuration

#### 3.1 Check RDS Parameter Group SSL Settings

```bash
# Check parameter group SSL settings
aws rds describe-db-parameters --db-parameter-group-name your-parameter-group \
    --parameter-name ssl

# Check force_ssl setting
aws rds describe-db-parameters --db-parameter-group-name your-parameter-group \
    --parameter-name force_ssl
```

#### 3.2 Test SSL Connection

```bash
# Test with SSL required
psql "host=wippestoolen-production.cvx466dfq2il.eu-central-1.rds.amazonaws.com \
      user=wippestoolen_user \
      dbname=wippestoolen_production \
      sslmode=require"

# Test without SSL (should fail if force_ssl=on)
psql "host=wippestoolen-production.cvx466dfq2il.eu-central-1.rds.amazonaws.com \
      user=wippestoolen_user \
      dbname=wippestoolen_production \
      sslmode=disable"
```

## Resolution Strategies

### Fix 1: Database Initialization

If database/user don't exist, create them:

```sql
-- Connect as master user
CREATE DATABASE wippestoolen_production;
CREATE USER wippestoolen_user WITH ENCRYPTED PASSWORD 'your-secure-password';
GRANT ALL PRIVILEGES ON DATABASE wippestoolen_production TO wippestoolen_user;

-- Grant schema permissions
\c wippestoolen_production
GRANT ALL ON SCHEMA public TO wippestoolen_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO wippestoolen_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO wippestoolen_user;
```

### Fix 2: SSL Configuration

#### Option A: Enable SSL in Application

Update application database URL:

```python
# Add SSL parameters to DATABASE_URL
DATABASE_URL = "postgresql://wippestoolen_user:password@host:5432/wippestoolen_production?sslmode=require"

# Or in SQLAlchemy engine
engine = create_async_engine(
    DATABASE_URL,
    connect_args={"sslmode": "require"}
)
```

#### Option B: Disable SSL Requirement (Not Recommended for Production)

```bash
# Modify parameter group to allow non-SSL connections
aws rds modify-db-parameter-group \
    --db-parameter-group-name your-parameter-group \
    --parameters "ParameterName=force_ssl,ParameterValue=0"

# Apply parameter group changes (requires reboot)
aws rds reboot-db-instance --db-instance-identifier wippestoolen-production
```

### Fix 3: Password Synchronization

Ensure passwords match between Terraform and application:

```bash
# Check Terraform variable
echo $TF_VAR_db_password

# Check application environment variable
echo $DATABASE_PASSWORD

# Update RDS password if needed
aws rds modify-db-instance \
    --db-instance-identifier wippestoolen-production \
    --master-user-password new-secure-password
```

### Fix 4: Security Group Updates

```bash
# Add rule allowing PostgreSQL access
aws ec2 authorize-security-group-ingress \
    --group-id sg-rds-security-group \
    --protocol tcp \
    --port 5432 \
    --source-group sg-ecs-security-group
```

## Advanced Diagnostics

### Connection String Analysis

```python
# Debug connection parameters
from sqlalchemy import create_async_engine
from sqlalchemy.engine.url import make_url

url = make_url(DATABASE_URL)
print(f"Driver: {url.drivername}")
print(f"Host: {url.host}")
print(f"Port: {url.port}")
print(f"Database: {url.database}")
print(f"Username: {url.username}")
print(f"Query params: {url.query}")
```

### RDS Logs Analysis

```bash
# Download RDS logs for analysis
aws rds download-db-log-file-portion \
    --db-instance-identifier wippestoolen-production \
    --log-file-name error/postgresql.log.2024-08-27-12
```

### Connection Pool Monitoring

```python
# Monitor SQLAlchemy connection pool
engine = create_async_engine(DATABASE_URL, echo=True)
pool = engine.pool

print(f"Pool size: {pool.size()}")
print(f"Active connections: {pool.checkedin()}")
print(f"Pool overflow: {pool.overflow()}")
```

## Production Database Access Scripts

### Safe Database Access Script

```bash
#!/bin/bash
# safe-db-access.sh - Safe production database access

set -e

DB_HOST="wippestoolen-production.cvx466dfq2il.eu-central-1.rds.amazonaws.com"
DB_NAME="wippestoolen_production"
DB_USER="wippestoolen_user"

echo "Connecting to production database..."
echo "Host: $DB_HOST"
echo "Database: $DB_NAME"
echo "User: $DB_USER"

# Test connection first
if pg_isready -h "$DB_HOST" -p 5432; then
    echo "Database is accepting connections"
    
    # Connect with SSL
    psql "host=$DB_HOST user=$DB_USER dbname=$DB_NAME sslmode=require" \
         -c "\conninfo" \
         -c "SELECT version();"
else
    echo "ERROR: Database is not accepting connections"
    exit 1
fi
```

### Database Initialization Script

```bash
#!/bin/bash
# init-production-db.sh - Initialize production database

set -e

# Variables from environment
DB_HOST="${DB_HOST}"
MASTER_USER="${DB_MASTER_USER}"
MASTER_PASSWORD="${DB_MASTER_PASSWORD}"
APP_USER="${DB_USER}"
APP_PASSWORD="${DB_PASSWORD}"
APP_DATABASE="${DB_NAME}"

echo "Initializing production database..."

# Create database and user
psql "host=$DB_HOST user=$MASTER_USER dbname=postgres sslmode=require" << EOF
-- Create database if not exists
SELECT 'CREATE DATABASE $APP_DATABASE'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$APP_DATABASE')\gexec

-- Create user if not exists
DO \$\$
BEGIN
    CREATE USER $APP_USER WITH ENCRYPTED PASSWORD '$APP_PASSWORD';
EXCEPTION WHEN duplicate_object THEN
    RAISE NOTICE 'User already exists';
END
\$\$;

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE $APP_DATABASE TO $APP_USER;
EOF

echo "Database initialization completed"
```

## Monitoring and Alerting

### CloudWatch Metrics to Monitor

```bash
# Connection failures
aws cloudwatch get-metric-statistics \
    --namespace AWS/RDS \
    --metric-name DatabaseConnections \
    --dimensions Name=DBInstanceIdentifier,Value=wippestoolen-production \
    --start-time 2024-08-27T00:00:00Z \
    --end-time 2024-08-27T23:59:59Z \
    --period 300 \
    --statistics Maximum

# Connection authentication failures
aws logs filter-log-events \
    --log-group-name /aws/rds/instance/wippestoolen-production/postgresql \
    --filter-pattern "authentication failed"
```

### Health Check Implementation

```python
# Application health check
import asyncio
import logging
from sqlalchemy import text

async def database_health_check():
    """Check database connectivity and basic functionality"""
    try:
        async with get_db_session() as session:
            result = await session.execute(text("SELECT 1"))
            return {"status": "healthy", "database": "connected"}
    except Exception as e:
        logging.error(f"Database health check failed: {e}")
        return {"status": "unhealthy", "error": str(e)}

# FastAPI health endpoint
@app.get("/health/database")
async def health_database():
    return await database_health_check()
```

## Best Practices

### 1. Environment Variable Management

```bash
# Use AWS Systems Manager Parameter Store
aws ssm put-parameter \
    --name "/wippestoolen/production/database/password" \
    --value "secure-password" \
    --type "SecureString"

# Application retrieval
DB_PASSWORD=$(aws ssm get-parameter --name "/wippestoolen/production/database/password" --with-decryption --query 'Parameter.Value' --output text)
```

### 2. Connection String Security

```python
# Never log connection strings
import logging
from urllib.parse import urlparse

def safe_log_db_url(url: str) -> str:
    """Log database URL without credentials"""
    parsed = urlparse(url)
    return f"{parsed.scheme}://***:***@{parsed.hostname}:{parsed.port}{parsed.path}"

logging.info(f"Connecting to: {safe_log_db_url(DATABASE_URL)}")
```

### 3. Connection Pool Configuration

```python
# Optimal connection pool settings for ECS
engine = create_async_engine(
    DATABASE_URL,
    pool_size=5,           # Base connections
    max_overflow=10,       # Additional connections
    pool_timeout=30,       # Wait time for connection
    pool_recycle=1800,     # Recycle connections every 30 min
    pool_pre_ping=True,    # Validate connections before use
    connect_args={
        "sslmode": "require",
        "connect_timeout": 10,
        "command_timeout": 30,
    }
)
```

### 4. Error Handling Patterns

```python
import asyncio
from sqlalchemy.exc import OperationalError, DatabaseError

async def robust_db_operation():
    """Database operation with retry logic"""
    max_retries = 3
    retry_delay = 2
    
    for attempt in range(max_retries):
        try:
            async with get_db_session() as session:
                # Your database operation
                result = await session.execute(query)
                return result
                
        except OperationalError as e:
            if "authentication failed" in str(e):
                # Authentication issue - don't retry
                raise
            elif attempt < max_retries - 1:
                # Connection issue - retry
                await asyncio.sleep(retry_delay * (2 ** attempt))
                continue
            else:
                raise
```

## Emergency Procedures

### 1. Connection Pool Exhaustion

```bash
# Reset application containers
aws ecs update-service \
    --cluster wippestoolen-cluster \
    --service wippestoolen-service \
    --force-new-deployment

# Monitor connection count
aws cloudwatch get-metric-statistics \
    --namespace AWS/RDS \
    --metric-name DatabaseConnections \
    --dimensions Name=DBInstanceIdentifier,Value=wippestoolen-production
```

### 2. Database Lockout

```bash
# Create emergency access user
aws rds modify-db-instance \
    --db-instance-identifier wippestoolen-production \
    --master-user-password emergency-password

# Connect and fix user issues
psql "host=... user=masteruser dbname=postgres sslmode=require"
```

### 3. SSL Certificate Issues

```bash
# Download RDS certificate bundle
wget https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem

# Test with certificate bundle
psql "host=... sslmode=require sslcert=client-cert.pem sslkey=client-key.pem sslrootcert=global-bundle.pem"
```

## Terraform Configuration Verification

### RDS Resource Validation

```hcl
# Ensure proper RDS configuration
resource "aws_db_instance" "main" {
  identifier = "wippestoolen-production"
  
  # Database configuration
  db_name  = replace("${var.app_name}_${var.environment}", "-", "_")
  username = "wippestoolen_user"
  password = var.db_password
  
  # Network configuration
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  
  # SSL configuration
  parameter_group_name = aws_db_parameter_group.main.name
  
  # Backup and maintenance
  backup_retention_period = 7
  backup_window          = "03:00-04:00"
  maintenance_window     = "sun:04:00-sun:05:00"
  
  skip_final_snapshot = false
  final_snapshot_identifier = "${var.app_name}-${var.environment}-final-snapshot"
}

resource "aws_db_parameter_group" "main" {
  name   = "${var.app_name}-${var.environment}-params"
  family = "postgres15"

  parameter {
    name  = "force_ssl"
    value = "1"  # Require SSL connections
  }
  
  parameter {
    name  = "log_connections"
    value = "1"  # Log connection attempts
  }
  
  parameter {
    name  = "log_disconnections"
    value = "1"  # Log disconnections
  }
}
```

## Conclusion

PostgreSQL RDS connection issues typically stem from a combination of network configuration, authentication setup, and SSL requirements. The key to successful troubleshooting is systematic diagnosis starting with network connectivity, then authentication, and finally encryption configuration.

Always test changes in a development environment first, and maintain comprehensive logging and monitoring to prevent and quickly identify future issues.