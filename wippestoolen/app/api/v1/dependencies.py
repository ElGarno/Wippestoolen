"""Authentication dependencies for FastAPI."""

from datetime import datetime
from typing import Optional
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from wippestoolen.app.core.database import get_db
from wippestoolen.app.core.security import verify_token
from wippestoolen.app.models.user import User
from wippestoolen.app.schemas.auth import TokenData


# Security scheme
security = HTTPBearer()


class AuthenticationError(HTTPException):
    """Authentication error exception."""
    
    def __init__(self, detail: str = "Could not validate credentials"):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail,
            headers={"WWW-Authenticate": "Bearer"},
        )


class InactiveUserError(HTTPException):
    """Inactive user error exception."""
    
    def __init__(self, detail: str = "Inactive user"):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=detail
        )


async def get_current_user(
    db: AsyncSession = Depends(get_db),
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> User:
    """
    Get current authenticated user from JWT token.
    
    Args:
        db: Database session
        credentials: HTTP Bearer credentials
        
    Returns:
        User: Current authenticated user
        
    Raises:
        AuthenticationError: If token is invalid or user not found
    """
    token = credentials.credentials
    
    # Verify and decode token
    payload = verify_token(token)
    if payload is None:
        raise AuthenticationError("Invalid token")
    
    # Extract user information from token
    user_id: str = payload.get("sub")
    token_type: str = payload.get("type")
    
    if user_id is None or token_type != "access":
        raise AuthenticationError("Invalid token payload")
    
    # Get user from database
    try:
        user_uuid = UUID(user_id)
    except ValueError:
        raise AuthenticationError("Invalid user ID in token")
    
    stmt = select(User).where(User.id == user_uuid)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    
    if user is None:
        raise AuthenticationError("User not found")
    
    # Update last login time
    user.last_login_at = datetime.utcnow()
    await db.commit()
    
    return user


async def get_current_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """
    Get current active user.
    
    Args:
        current_user: Current authenticated user
        
    Returns:
        User: Current active user
        
    Raises:
        InactiveUserError: If user is inactive
    """
    if not current_user.is_active:
        raise InactiveUserError("User account is inactive")
    
    return current_user


async def get_current_verified_user(
    current_user: User = Depends(get_current_active_user)
) -> User:
    """
    Get current verified user.
    
    Args:
        current_user: Current active user
        
    Returns:
        User: Current verified user
        
    Raises:
        HTTPException: If user is not verified
    """
    if not current_user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email verification required"
        )
    
    return current_user


async def get_optional_current_user(
    db: AsyncSession = Depends(get_db),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False))
) -> Optional[User]:
    """
    Get current user if authenticated, otherwise None.
    
    Args:
        db: Database session
        credentials: Optional HTTP Bearer credentials
        
    Returns:
        Optional[User]: Current user if authenticated, None otherwise
    """
    if credentials is None:
        return None
    
    try:
        return await get_current_user(db=db, credentials=credentials)
    except AuthenticationError:
        return None