# Database Connection Security Patterns

## Overview

This document provides security-focused patterns and best practices for PostgreSQL RDS connections in production environments, with emphasis on preventing common authentication and authorization vulnerabilities.

## Authentication Architecture

### Multi-Layer Authentication Strategy

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Application   │    │   RDS Proxy      │    │   PostgreSQL    │
│   (ECS Tasks)   │────│   (Optional)     │────│   RDS Instance  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
    ┌────▼────┐             ┌───▼────┐            ┌─────▼──────┐
    │ IAM     │             │ Secret │            │ Database   │
    │ Roles   │             │ Manager│            │ Users &    │
    │         │             │        │            │ Permissions│
    └─────────┘             └────────┘            └────────────┘
```

### Primary Authentication Methods

#### 1. Username/Password Authentication (Current)

```python
# Secure password-based connection
DATABASE_URL = (
    f"postgresql+asyncpg://{DB_USER}:{DB_PASSWORD}@"
    f"{DB_HOST}:{DB_PORT}/{DB_NAME}"
    f"?sslmode=require&sslcert={SSL_CERT_PATH}"
)
```

#### 2. IAM Database Authentication (Recommended)

```python
import boto3
from sqlalchemy import create_async_engine

def get_iam_token():
    """Generate IAM database authentication token"""
    rds_client = boto3.client('rds')
    return rds_client.generate_db_auth_token(
        DBHostname=DB_HOST,
        Port=DB_PORT,
        DBUsername=DB_USER,
        Region='eu-central-1'
    )

# Connection with IAM authentication
async def create_iam_engine():
    token = get_iam_token()
    url = (
        f"postgresql+asyncpg://{DB_USER}:{token}@"
        f"{DB_HOST}:{DB_PORT}/{DB_NAME}"
        f"?sslmode=require"
    )
    return create_async_engine(url, connect_args={"server_settings": {"application_name": "wippestoolen"}})
```

## SSL/TLS Configuration

### Certificate Management

```python
# Download and verify RDS certificate bundle
import ssl
import urllib.request

def setup_ssl_context():
    """Configure SSL context for RDS connections"""
    # Download RDS CA bundle
    ca_bundle_url = "https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem"
    urllib.request.urlretrieve(ca_bundle_url, "/tmp/rds-ca-2019-root.pem")
    
    # Create SSL context
    context = ssl.create_default_context(cafile="/tmp/rds-ca-2019-root.pem")
    context.check_hostname = True
    context.verify_mode = ssl.CERT_REQUIRED
    
    return context

# SQLAlchemy configuration with SSL
engine = create_async_engine(
    DATABASE_URL,
    connect_args={
        "ssl": setup_ssl_context(),
        "server_settings": {
            "application_name": "wippestoolen-production",
            "timezone": "UTC"
        }
    }
)
```

### SSL Mode Configuration Matrix

| SSL Mode | Connection Security | Certificate Validation | Use Case |
|----------|-------------------|------------------------|----------|
| `disable` | ❌ No encryption | ❌ None | Local development only |
| `allow` | ⚠️ Opportunistic | ❌ None | Not recommended |
| `prefer` | ⚠️ Opportunistic | ❌ None | Not recommended |
| `require` | ✅ Encrypted | ❌ No hostname check | Basic production |
| `verify-ca` | ✅ Encrypted | ⚠️ CA only | Enhanced security |
| `verify-full` | ✅ Encrypted | ✅ Full validation | **Recommended** |

## Connection Pooling Security

### Secure Pool Configuration

```python
from sqlalchemy.pool import QueuePool
from sqlalchemy import create_async_engine, event

def create_secure_engine():
    """Create database engine with security-focused pool configuration"""
    
    engine = create_async_engine(
        DATABASE_URL,
        
        # Pool security settings
        poolclass=QueuePool,
        pool_size=5,              # Limit concurrent connections
        max_overflow=10,          # Maximum additional connections
        pool_timeout=30,          # Connection acquisition timeout
        pool_recycle=3600,        # Recycle connections hourly
        pool_pre_ping=True,       # Validate connections before use
        
        # Connection security
        connect_args={
            "sslmode": "verify-full",
            "sslcert": "/app/certs/client-cert.pem",
            "sslkey": "/app/certs/client-key.pem", 
            "sslrootcert": "/app/certs/ca-cert.pem",
            "connect_timeout": 10,
            "command_timeout": 30,
            "application_name": "wippestoolen-ecs-task",
        },
        
        # Query logging for security monitoring
        echo=False,  # Disable in production to avoid logging sensitive data
    )
    
    return engine

# Event listeners for security monitoring
@event.listens_for(engine, "connect")
def set_connection_security(dbapi_connection, connection_record):
    """Set session-level security parameters"""
    with dbapi_connection.cursor() as cursor:
        # Set session timeout
        cursor.execute("SET statement_timeout = '300s'")
        # Enable logging of long-running queries
        cursor.execute("SET log_min_duration_statement = 1000")
        # Set application name for monitoring
        cursor.execute("SET application_name = 'wippestoolen-production'")
```

## Database User Management

### Principle of Least Privilege

```sql
-- Create application-specific roles
CREATE ROLE wippestoolen_app_role;
CREATE ROLE wippestoolen_readonly_role;
CREATE ROLE wippestoolen_migration_role;

-- Grant minimal permissions to application role
GRANT CONNECT ON DATABASE wippestoolen_production TO wippestoolen_app_role;
GRANT USAGE ON SCHEMA public TO wippestoolen_app_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO wippestoolen_app_role;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO wippestoolen_app_role;

-- Create users with specific roles
CREATE USER wippestoolen_app WITH ENCRYPTED PASSWORD 'app-specific-password';
GRANT wippestoolen_app_role TO wippestoolen_app;

CREATE USER wippestoolen_readonly WITH ENCRYPTED PASSWORD 'readonly-password';
GRANT wippestoolen_readonly_role TO wippestoolen_readonly;

-- Migration user (used only during deployments)
CREATE USER wippestoolen_migration WITH ENCRYPTED PASSWORD 'migration-password';
GRANT wippestoolen_migration_role TO wippestoolen_migration;
GRANT CREATE ON SCHEMA public TO wippestoolen_migration_role;
```

### User Permission Audit

```sql
-- Audit user permissions
SELECT 
    r.rolname as username,
    r.rolsuper as is_superuser,
    r.rolinherit as inherits_privileges,
    r.rolcreaterole as can_create_roles,
    r.rolcreatedb as can_create_databases,
    r.rolcanlogin as can_login,
    r.rolconnlimit as connection_limit
FROM pg_roles r 
WHERE r.rolname LIKE 'wippestoolen%';

-- Check table-level permissions
SELECT 
    t.table_schema,
    t.table_name,
    t.privilege_type,
    t.grantee
FROM information_schema.table_privileges t
WHERE t.grantee LIKE 'wippestoolen%'
ORDER BY t.table_name, t.grantee;
```

## Secret Management Integration

### AWS Secrets Manager Integration

```python
import json
import boto3
from botocore.exceptions import ClientError

class SecureDBConfig:
    def __init__(self, secret_name: str, region: str = "eu-central-1"):
        self.secret_name = secret_name
        self.region = region
        self._secret_cache = None
        self._cache_ttl = 300  # 5 minutes
        self._cache_timestamp = 0
    
    def get_credentials(self) -> dict:
        """Retrieve database credentials from AWS Secrets Manager"""
        import time
        
        # Check cache validity
        if (self._secret_cache and 
            time.time() - self._cache_timestamp < self._cache_ttl):
            return self._secret_cache
        
        session = boto3.session.Session()
        client = session.client(service_name='secretsmanager', region_name=self.region)
        
        try:
            response = client.get_secret_value(SecretId=self.secret_name)
            secret = json.loads(response['SecretString'])
            
            # Cache the result
            self._secret_cache = secret
            self._cache_timestamp = time.time()
            
            return secret
            
        except ClientError as e:
            raise Exception(f"Failed to retrieve database credentials: {e}")
    
    def get_connection_url(self) -> str:
        """Build secure connection URL"""
        creds = self.get_credentials()
        
        return (
            f"postgresql+asyncpg://{creds['username']}:{creds['password']}@"
            f"{creds['host']}:{creds['port']}/{creds['dbname']}"
            f"?sslmode=verify-full&application_name=wippestoolen"
        )

# Usage
db_config = SecureDBConfig("wippestoolen/production/database")
DATABASE_URL = db_config.get_connection_url()
```

### Environment-based Configuration

```python
import os
from enum import Enum

class DatabaseEnvironment(Enum):
    DEVELOPMENT = "development"
    STAGING = "staging" 
    PRODUCTION = "production"

class SecureConnectionFactory:
    @staticmethod
    def create_engine(env: DatabaseEnvironment):
        """Create database engine with environment-appropriate security"""
        
        base_config = {
            "pool_pre_ping": True,
            "pool_recycle": 3600,
        }
        
        if env == DatabaseEnvironment.PRODUCTION:
            return create_async_engine(
                os.getenv("DATABASE_URL"),
                **base_config,
                pool_size=10,
                max_overflow=20,
                connect_args={
                    "sslmode": "verify-full",
                    "sslcert": "/app/certs/client.crt",
                    "sslkey": "/app/certs/client.key",
                    "sslrootcert": "/app/certs/ca.crt",
                    "connect_timeout": 10,
                    "application_name": "wippestoolen-production"
                }
            )
        elif env == DatabaseEnvironment.STAGING:
            return create_async_engine(
                os.getenv("STAGING_DATABASE_URL"),
                **base_config,
                pool_size=5,
                max_overflow=10,
                connect_args={
                    "sslmode": "require",
                    "application_name": "wippestoolen-staging"
                }
            )
        else:  # Development
            return create_async_engine(
                os.getenv("DEV_DATABASE_URL", "postgresql://localhost/wippestoolen_dev"),
                **base_config,
                pool_size=2,
                max_overflow=5,
                connect_args={"application_name": "wippestoolen-dev"}
            )
```

## Security Monitoring and Auditing

### Connection Monitoring

```python
import logging
import time
from sqlalchemy import event
from contextlib import asynccontextmanager

# Security logger
security_logger = logging.getLogger('database.security')
security_logger.setLevel(logging.INFO)

class ConnectionSecurityMonitor:
    def __init__(self):
        self.connection_attempts = {}
        self.failed_attempts = {}
    
    def log_connection_attempt(self, host: str, user: str, success: bool):
        """Log database connection attempts for security monitoring"""
        timestamp = time.time()
        key = f"{host}:{user}"
        
        if success:
            security_logger.info(f"Database connection successful: {user}@{host}")
            # Reset failed attempt counter on success
            self.failed_attempts.pop(key, None)
        else:
            security_logger.warning(f"Database connection failed: {user}@{host}")
            # Track failed attempts
            if key not in self.failed_attempts:
                self.failed_attempts[key] = []
            self.failed_attempts[key].append(timestamp)
            
            # Alert on multiple failures
            recent_failures = [
                t for t in self.failed_attempts[key] 
                if timestamp - t < 300  # Last 5 minutes
            ]
            if len(recent_failures) >= 5:
                security_logger.critical(f"Multiple failed connections: {key}")

# Global monitor instance
monitor = ConnectionSecurityMonitor()

@event.listens_for(engine, "connect")
def on_connect(dbapi_connection, connection_record):
    """Monitor successful connections"""
    info = dbapi_connection.get_dsn_parameters()
    monitor.log_connection_attempt(
        host=info.get('host', 'unknown'),
        user=info.get('user', 'unknown'),
        success=True
    )

@asynccontextmanager
async def monitored_database_session():
    """Database session with security monitoring"""
    session_start = time.time()
    async with get_db_session() as session:
        try:
            yield session
            # Log successful session
            duration = time.time() - session_start
            if duration > 10:  # Long-running session
                security_logger.warning(f"Long database session: {duration:.2f}s")
        except Exception as e:
            # Log failed session
            security_logger.error(f"Database session error: {str(e)}")
            raise
```

### Query Security Analysis

```python
import re
from typing import List, Dict

class QuerySecurityAnalyzer:
    """Analyze queries for potential security issues"""
    
    SUSPICIOUS_PATTERNS = [
        r'(?i)\b(DROP|DELETE|TRUNCATE)\s+(?!.*WHERE)',  # Unfiltered destructive operations
        r'(?i)\bUNION\s+SELECT',                        # Potential SQL injection
        r'(?i)\b\d+\s*=\s*\d+',                        # Always true conditions
        r'(?i)--',                                      # SQL comments (potential injection)
        r'(?i)/\*.*\*/',                               # SQL block comments
        r'(?i)\bOR\s+\d+\s*=\s*\d+',                  # SQL injection patterns
    ]
    
    def analyze_query(self, query: str, params: Dict = None) -> Dict:
        """Analyze a query for security issues"""
        issues = []
        risk_level = "LOW"
        
        for pattern in self.SUSPICIOUS_PATTERNS:
            matches = re.findall(pattern, query)
            if matches:
                issues.append({
                    "pattern": pattern,
                    "matches": matches,
                    "risk": "HIGH"
                })
                risk_level = "HIGH"
        
        # Check for parameterized queries
        if params is None and any(char in query for char in ['%', '$']):
            issues.append({
                "issue": "Non-parameterized query detected",
                "risk": "MEDIUM"
            })
            risk_level = max(risk_level, "MEDIUM")
        
        return {
            "query": query[:100] + "..." if len(query) > 100 else query,
            "risk_level": risk_level,
            "issues": issues,
            "safe": len(issues) == 0
        }

# Usage in SQLAlchemy
@event.listens_for(engine, "before_cursor_execute")
def security_check_query(conn, cursor, statement, parameters, context, executemany):
    """Security check before query execution"""
    analyzer = QuerySecurityAnalyzer()
    analysis = analyzer.analyze_query(statement, parameters)
    
    if analysis["risk_level"] == "HIGH":
        security_logger.critical(f"High-risk query detected: {analysis}")
        # In production, you might want to block the query
        # raise Exception("High-risk query blocked by security policy")
    elif analysis["risk_level"] == "MEDIUM":
        security_logger.warning(f"Medium-risk query: {analysis}")
```

## Incident Response Procedures

### Database Security Incident Response

```python
class DatabaseSecurityIncident:
    """Handle database security incidents"""
    
    @staticmethod
    async def handle_authentication_failure(user: str, host: str, attempts: int):
        """Respond to repeated authentication failures"""
        if attempts >= 5:
            # Block further attempts (implement rate limiting)
            security_logger.critical(f"Blocking user {user} from {host} due to repeated failures")
            
            # Notify security team
            await notify_security_team({
                "incident_type": "authentication_failure",
                "user": user,
                "source_host": host,
                "attempt_count": attempts,
                "timestamp": time.time()
            })
    
    @staticmethod
    async def handle_suspicious_query(query: str, source_ip: str):
        """Respond to suspicious query patterns"""
        security_logger.critical(f"Suspicious query from {source_ip}: {query[:200]}")
        
        # Log to security audit trail
        await log_security_event({
            "event_type": "suspicious_query",
            "source_ip": source_ip,
            "query_hash": hash(query),
            "timestamp": time.time()
        })
    
    @staticmethod
    async def handle_connection_anomaly(connection_count: int, threshold: int):
        """Respond to unusual connection patterns"""
        if connection_count > threshold:
            security_logger.warning(f"High connection count: {connection_count} > {threshold}")
            
            # Check for potential DoS attack
            await monitor_connection_sources()

async def notify_security_team(incident: Dict):
    """Notify security team of incidents"""
    # Implementation depends on your notification system
    # Could be Slack, email, PagerDuty, etc.
    pass

async def log_security_event(event: Dict):
    """Log security events for audit trail"""
    # Implementation depends on your logging system
    # Could be CloudTrail, custom audit log, etc.
    pass
```

## Compliance and Audit Requirements

### GDPR-Compliant Database Configuration

```sql
-- Enable audit logging for GDPR compliance
ALTER DATABASE wippestoolen_production SET log_statement = 'all';
ALTER DATABASE wippestoolen_production SET log_min_duration_statement = 0;

-- Set up audit triggers for personal data access
CREATE OR REPLACE FUNCTION audit_personal_data_access()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO audit_log (
        table_name,
        operation,
        user_id,
        timestamp,
        old_values,
        new_values
    ) VALUES (
        TG_TABLE_NAME,
        TG_OP,
        current_user,
        NOW(),
        to_jsonb(OLD),
        to_jsonb(NEW)
    );
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Apply audit triggers to tables containing personal data
CREATE TRIGGER audit_users 
    AFTER INSERT OR UPDATE OR DELETE ON users
    FOR EACH ROW EXECUTE FUNCTION audit_personal_data_access();

CREATE TRIGGER audit_user_profiles 
    AFTER INSERT OR UPDATE OR DELETE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION audit_personal_data_access();
```

### Backup and Recovery Security

```bash
#!/bin/bash
# secure-backup.sh - Secure database backup with encryption

set -e

DB_HOST="wippestoolen-production.cvx466dfq2il.eu-central-1.rds.amazonaws.com"
BACKUP_BUCKET="wippestoolen-backups-secure"
ENCRYPTION_KEY_ID="alias/wippestoolen-backup-key"

# Create encrypted backup
pg_dump "host=$DB_HOST sslmode=require" \
    --format=custom \
    --compress=9 \
    --verbose \
    | aws s3 cp - "s3://$BACKUP_BUCKET/backups/$(date +%Y-%m-%d-%H-%M-%S).dump" \
    --sse=aws:kms \
    --sse-kms-key-id="$ENCRYPTION_KEY_ID"

echo "Encrypted backup completed successfully"
```

## Conclusion

Implementing robust database security requires a multi-layered approach combining proper authentication, encryption, monitoring, and incident response. Regular security audits and compliance checks ensure ongoing protection of sensitive data in the Wippestoolen platform.

Key security principles:
- **Defense in Depth**: Multiple security layers
- **Principle of Least Privilege**: Minimal necessary permissions
- **Zero Trust**: Verify all connections and queries
- **Continuous Monitoring**: Real-time security monitoring
- **Incident Response**: Prepared response procedures