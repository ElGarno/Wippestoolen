"""Authentication API endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address

from wippestoolen.app.core.database import get_db
from wippestoolen.app.api.v1.dependencies import get_current_active_user
from wippestoolen.app.services.auth_service import (
    AuthService,
    UserAlreadyExistsError,
    InvalidCredentialsError,
    AuthenticationError
)
from wippestoolen.app.schemas.auth import (
    UserCreate,
    UserLogin,
    AuthResponse,
    UserResponse,
    RefreshTokenRequest,
    Token,
    ChangePasswordRequest,
    UpdateProfileRequest
)
from wippestoolen.app.models.user import User

# Create router
router = APIRouter(prefix="/auth", tags=["Authentication"])

# Rate limiter
limiter = Limiter(key_func=get_remote_address)


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
async def register(
    request: Request,
    user_data: UserCreate,
    db: AsyncSession = Depends(get_db),
) -> AuthResponse:
    """
    Register a new user.
    
    Args:
        user_data: User registration data
        db: Database session
        
    Returns:
        AuthResponse: User data and authentication tokens
        
    Raises:
        HTTPException: If user already exists or validation fails
    """
    auth_service = AuthService(db)
    
    try:
        return await auth_service.register_user(user_data)
    except UserAlreadyExistsError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Registration failed"
        )


@router.post("/login", response_model=AuthResponse)
@limiter.limit("10/minute")
async def login(
    request: Request,
    credentials: UserLogin,
    db: AsyncSession = Depends(get_db),
) -> AuthResponse:
    """
    Authenticate user and return tokens.
    
    Args:
        credentials: User login credentials
        db: Database session
        
    Returns:
        AuthResponse: User data and authentication tokens
        
    Raises:
        HTTPException: If credentials are invalid
    """
    auth_service = AuthService(db)
    
    try:
        return await auth_service.authenticate_user(credentials)
    except InvalidCredentialsError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication failed"
        )


@router.post("/refresh", response_model=Token)
@limiter.limit("20/minute")
async def refresh_token(
    request: Request,
    refresh_data: RefreshTokenRequest,
    db: AsyncSession = Depends(get_db),
) -> Token:
    """
    Refresh access token using refresh token.
    
    Args:
        refresh_data: Refresh token request data
        db: Database session
        
    Returns:
        Token: New access and refresh tokens
        
    Raises:
        HTTPException: If refresh token is invalid
    """
    auth_service = AuthService(db)
    
    try:
        access_token, refresh_token = await auth_service.refresh_access_token(
            refresh_data.refresh_token
        )
        
        return Token(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
            expires_in=30 * 60  # 30 minutes
        )
    except InvalidCredentialsError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Token refresh failed"
        )


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: User = Depends(get_current_active_user)
) -> UserResponse:
    """
    Get current user information.
    
    Args:
        current_user: Current authenticated user
        
    Returns:
        UserResponse: Current user data
    """
    return UserResponse.model_validate(current_user)


@router.put("/me", response_model=UserResponse)
@limiter.limit("10/minute")
async def update_profile(
    request: Request,
    profile_data: UpdateProfileRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    """
    Update current user profile.
    
    Args:
        profile_data: Profile update data
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        UserResponse: Updated user data
    """
    auth_service = AuthService(db)
    
    try:
        return await auth_service.update_user_profile(current_user, profile_data)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Profile update failed"
        )


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("5/minute")
async def change_password(
    request: Request,
    password_data: ChangePasswordRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """
    Change user password.
    
    Args:
        password_data: Password change data
        current_user: Current authenticated user
        db: Database session
        
    Raises:
        HTTPException: If current password is invalid
    """
    auth_service = AuthService(db)
    
    try:
        await auth_service.change_password(
            current_user,
            password_data.current_password,
            password_data.new_password
        )
    except InvalidCredentialsError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Password change failed"
        )