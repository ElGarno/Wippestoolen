"""Authentication service layer."""

import secrets
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Optional, Tuple
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from wippestoolen.app.core.config import settings
from wippestoolen.app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    verify_token
)
from wippestoolen.app.models.user import User
from wippestoolen.app.schemas.auth import (
    UserCreate,
    UserLogin,
    AuthResponse,
    UserResponse,
    UpdateProfileRequest
)


class AuthenticationError(Exception):
    """Authentication related errors."""
    pass


class UserAlreadyExistsError(Exception):
    """User already exists error."""
    pass


class UserNotFoundError(Exception):
    """User not found error."""
    pass


class InvalidCredentialsError(Exception):
    """Invalid credentials error."""
    pass


class AuthService:
    """Authentication service."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def register_user(self, user_data: UserCreate) -> AuthResponse:
        """
        Register a new user.
        
        Args:
            user_data: User registration data
            
        Returns:
            AuthResponse: User and tokens
            
        Raises:
            UserAlreadyExistsError: If user with email already exists
        """
        # Check if user already exists
        stmt = select(User).where(User.email == user_data.email)
        result = await self.db.execute(stmt)
        existing_user = result.scalar_one_or_none()
        
        if existing_user:
            raise UserAlreadyExistsError("User with this email already exists")
        
        # Hash password
        password_hash = hash_password(user_data.password)
        
        # Create user
        user = User(
            email=user_data.email,
            password_hash=password_hash,
            display_name=user_data.display_name,
            first_name=user_data.first_name,
            last_name=user_data.last_name,
            phone_number=user_data.phone_number,
            country="DE",  # Default to Germany
            location_precision=100,  # Default precision in meters
            average_rating=Decimal("0.00"),
            total_ratings=0,
            is_active=True,
            is_verified=False,  # Require email verification
            location_visible=True,  # Default privacy settings
            profile_visible=True
        )
        
        try:
            self.db.add(user)
            await self.db.commit()
            await self.db.refresh(user)
        except IntegrityError as e:
            await self.db.rollback()
            if "email" in str(e.orig):
                raise UserAlreadyExistsError("User with this email already exists")
            else:
                raise Exception(f"Data integrity violation: {str(e.orig)}")
        except SQLAlchemyError as e:
            await self.db.rollback()
            raise Exception(f"Database error: {str(e)}")
        except Exception as e:
            await self.db.rollback()
            raise Exception(f"Unexpected error during registration: {str(e)}")
        
        # Generate tokens
        access_token = create_access_token(subject=str(user.id))
        refresh_token = create_refresh_token(subject=str(user.id))
        
        return AuthResponse(
            user=UserResponse.model_validate(user),
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
        )
    
    async def authenticate_user(self, credentials: UserLogin) -> AuthResponse:
        """
        Authenticate user with email and password.
        
        Args:
            credentials: User login credentials
            
        Returns:
            AuthResponse: User and tokens
            
        Raises:
            InvalidCredentialsError: If credentials are invalid
        """
        # Get user by email
        stmt = select(User).where(User.email == credentials.email)
        result = await self.db.execute(stmt)
        user = result.scalar_one_or_none()
        
        if not user:
            raise InvalidCredentialsError("Invalid email or password")
        
        # Verify password
        if not verify_password(credentials.password, user.password_hash):
            raise InvalidCredentialsError("Invalid email or password")
        
        # Check if user is active
        if not user.is_active:
            raise InvalidCredentialsError("User account is inactive")
        
        # Update last login
        user.last_login_at = datetime.utcnow()
        await self.db.commit()
        
        # Generate tokens
        access_token = create_access_token(subject=str(user.id))
        refresh_token = create_refresh_token(subject=str(user.id))
        
        return AuthResponse(
            user=UserResponse.model_validate(user),
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
        )
    
    async def refresh_access_token(self, refresh_token: str) -> Tuple[str, str]:
        """
        Refresh access token using refresh token.
        
        Args:
            refresh_token: Valid refresh token
            
        Returns:
            Tuple[str, str]: New access token and refresh token
            
        Raises:
            InvalidCredentialsError: If refresh token is invalid
        """
        # Verify refresh token
        payload = verify_token(refresh_token)
        if payload is None or payload.get("type") != "refresh":
            raise InvalidCredentialsError("Invalid refresh token")
        
        user_id = payload.get("sub")
        if not user_id:
            raise InvalidCredentialsError("Invalid refresh token payload")
        
        # Get user
        try:
            user_uuid = UUID(user_id)
        except ValueError:
            raise InvalidCredentialsError("Invalid user ID in refresh token")
        
        stmt = select(User).where(User.id == user_uuid)
        result = await self.db.execute(stmt)
        user = result.scalar_one_or_none()
        
        if not user or not user.is_active:
            raise InvalidCredentialsError("User not found or inactive")
        
        # Generate new tokens
        new_access_token = create_access_token(subject=str(user.id))
        new_refresh_token = create_refresh_token(subject=str(user.id))
        
        return new_access_token, new_refresh_token
    
    async def get_user_by_id(self, user_id: UUID) -> Optional[User]:
        """
        Get user by ID.
        
        Args:
            user_id: User UUID
            
        Returns:
            Optional[User]: User or None if not found
        """
        stmt = select(User).where(User.id == user_id)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()
    
    async def update_user_profile(
        self, 
        user: User, 
        update_data: UpdateProfileRequest
    ) -> UserResponse:
        """
        Update user profile.
        
        Args:
            user: Current user
            update_data: Profile update data
            
        Returns:
            UserResponse: Updated user data
        """
        # Update fields if provided
        if update_data.display_name is not None:
            user.display_name = update_data.display_name
        if update_data.first_name is not None:
            user.first_name = update_data.first_name
        if update_data.last_name is not None:
            user.last_name = update_data.last_name
        if update_data.phone_number is not None:
            user.phone_number = update_data.phone_number
        if update_data.bio is not None:
            user.bio = update_data.bio
        if update_data.location_visible is not None:
            user.location_visible = update_data.location_visible
        if update_data.profile_visible is not None:
            user.profile_visible = update_data.profile_visible
        
        await self.db.commit()
        await self.db.refresh(user)
        
        return UserResponse.model_validate(user)
    
    async def change_password(
        self, 
        user: User, 
        current_password: str, 
        new_password: str
    ) -> None:
        """
        Change user password.
        
        Args:
            user: Current user
            current_password: Current password
            new_password: New password
            
        Raises:
            InvalidCredentialsError: If current password is invalid
        """
        # Verify current password
        if not verify_password(current_password, user.password_hash):
            raise InvalidCredentialsError("Invalid current password")
        
        # Hash new password
        user.password_hash = hash_password(new_password)
        
        await self.db.commit()