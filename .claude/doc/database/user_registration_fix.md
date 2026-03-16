# User Registration Database Issue - Analysis & Solution

## Problem Analysis

The user registration endpoint is failing with database rollbacks due to several schema and model inconsistencies.

## Root Causes Identified

1. **Mixed Default Strategy**: Using both `default` and `server_default` creates conflicts
2. **Data Type Mismatches**: Float vs Decimal for numeric fields
3. **Insufficient Error Handling**: Masking real database errors
4. **Missing Explicit Field Values**: Relying on defaults that may not work properly

## Solutions

### 1. Fixed SQLAlchemy Model

```python
from decimal import Decimal
import uuid
from datetime import datetime
from sqlalchemy import Boolean, DateTime, Integer, Numeric, String, UUID, func
from sqlalchemy.orm import Mapped, mapped_column

class User(Base):
    # Primary key - let database generate UUID
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), 
        primary_key=True, 
        server_default=func.gen_random_uuid()  # Use PostgreSQL function
    )
    
    # Required fields - no defaults needed
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    display_name: Mapped[str] = mapped_column(String(100))
    
    # Fields with application defaults (use default, not server_default)
    country: Mapped[str] = mapped_column(String(2), default="DE")
    location_precision: Mapped[int] = mapped_column(Integer, default=100)
    average_rating: Mapped[Decimal] = mapped_column(
        Numeric(3, 2), 
        default=Decimal("0.00")  # Use Decimal, not float
    )
    total_ratings: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    location_visible: Mapped[bool] = mapped_column(Boolean, default=True)
    profile_visible: Mapped[bool] = mapped_column(Boolean, default=True)
    
    # Timestamps - use server_default only
    created_at: Mapped[datetime] = mapped_column(
        DateTime, 
        server_default=func.current_timestamp()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, 
        server_default=func.current_timestamp(),
        onupdate=func.current_timestamp()
    )
    
    # Optional fields
    first_name: Mapped[str] = mapped_column(String(50), nullable=True)
    last_name: Mapped[str] = mapped_column(String(50), nullable=True)
    phone_number: Mapped[str] = mapped_column(String(20), nullable=True)
```

### 2. Enhanced User Creation with Proper Error Handling

```python
from decimal import Decimal
import logging
from sqlalchemy.exc import SQLAlchemyError, IntegrityError
from sqlalchemy import text

logger = logging.getLogger(__name__)

async def create_user(self, user_data: UserRegistrationRequest) -> User:
    """Create a new user with comprehensive error handling."""
    
    # Hash the password
    password_hash = self.password_handler.hash_password(user_data.password)
    
    # Create user with explicit values for all required fields
    user = User(
        email=user_data.email.lower().strip(),  # Normalize email
        password_hash=password_hash,
        display_name=user_data.display_name.strip(),
        first_name=user_data.first_name.strip() if user_data.first_name else None,
        last_name=user_data.last_name.strip() if user_data.last_name else None,
        phone_number=user_data.phone_number.strip() if user_data.phone_number else None,
        # Explicitly set defaults (these will override model defaults if needed)
        country="DE",
        location_precision=100,
        average_rating=Decimal("0.00"),  # Use Decimal
        total_ratings=0,
        is_active=True,
        is_verified=False,
        location_visible=True,
        profile_visible=True
    )
    
    try:
        logger.info(f"Attempting to create user with email: {user_data.email}")
        
        # Add to session
        self.db.add(user)
        
        # Log the SQL that will be executed (for debugging)
        logger.debug("About to commit user creation transaction")
        
        # Commit the transaction
        await self.db.commit()
        
        # Refresh to get server-generated values
        await self.db.refresh(user)
        
        logger.info(f"Successfully created user with ID: {user.id}")
        return user
        
    except IntegrityError as e:
        logger.warning(f"Integrity constraint violated during user creation: {str(e)}")
        await self.db.rollback()
        
        # Check if it's a unique constraint violation on email
        if "email" in str(e.orig):
            raise UserAlreadyExistsError("User with this email already exists")
        else:
            raise UserCreationError(f"Data integrity violation: {str(e.orig)}")
            
    except SQLAlchemyError as e:
        logger.error(f"Database error during user creation: {str(e)}")
        await self.db.rollback()
        raise UserCreationError(f"Database error: {str(e)}")
        
    except Exception as e:
        logger.error(f"Unexpected error during user creation: {str(e)}")
        await self.db.rollback()
        raise UserCreationError("An unexpected error occurred during user creation")
```

### 3. Custom Exception Classes

```python
class UserCreationError(Exception):
    """Raised when user creation fails due to database or validation issues."""
    pass

class UserAlreadyExistsError(UserCreationError):
    """Raised when attempting to create a user with an existing email."""
    pass
```

### 4. Database Connection Testing

```python
async def test_db_connection(db_session):
    """Test database connection and table access."""
    try:
        # Test basic connection
        result = await db_session.execute(text("SELECT 1"))
        logger.info("Database connection successful")
        
        # Test table access
        result = await db_session.execute(text("SELECT COUNT(*) FROM users"))
        count = result.scalar()
        logger.info(f"Users table accessible, current count: {count}")
        
        # Test table structure
        result = await db_session.execute(text("""
            SELECT column_name, data_type, is_nullable, column_default 
            FROM information_schema.columns 
            WHERE table_name = 'users' 
            ORDER BY ordinal_position
        """))
        columns = result.fetchall()
        logger.info("Users table structure:")
        for col in columns:
            logger.info(f"  {col[0]}: {col[1]}, nullable={col[2]}, default={col[3]}")
            
    except Exception as e:
        logger.error(f"Database connection test failed: {e}")
        raise
```

## Debugging Steps

### 1. Enable SQL Logging
Add this to your SQLAlchemy engine configuration:
```python
engine = create_async_engine(
    DATABASE_URL,
    echo=True,  # This will log all SQL statements
    echo_pool=True  # This will log connection pool events
)
```

### 2. Add Detailed Logging
```python
import logging

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logging.getLogger('sqlalchemy.engine').setLevel(logging.INFO)
logging.getLogger('sqlalchemy.pool').setLevel(logging.DEBUG)
```

### 3. Database Schema Verification
Run this query to verify your database schema matches expectations:
```sql
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default,
    character_maximum_length
FROM information_schema.columns 
WHERE table_name = 'users' 
ORDER BY ordinal_position;
```

## Testing the Fix

1. **Test with minimal user data**:
```python
test_user = UserRegistrationRequest(
    email="test@example.com",
    password="securepassword123",
    display_name="Test User"
)
```

2. **Monitor logs** for the actual SQL statements and any error messages

3. **Verify data types** by checking the inserted values match expected types

## Prevention Strategies

1. **Always use explicit field values** for required fields
2. **Choose either `default` OR `server_default`**, not both
3. **Use proper data types** (Decimal for numeric, not float)
4. **Implement comprehensive error handling** with logging
5. **Test database operations** with various input scenarios
6. **Use database migrations** to ensure schema consistency

## Migration Script (if needed)

If you need to fix existing schema issues:
```sql
-- Fix any inconsistent defaults
ALTER TABLE users ALTER COLUMN average_rating SET DEFAULT 0.00;
ALTER TABLE users ALTER COLUMN total_ratings SET DEFAULT 0;
ALTER TABLE users ALTER COLUMN is_active SET DEFAULT true;
ALTER TABLE users ALTER COLUMN is_verified SET DEFAULT false;
```