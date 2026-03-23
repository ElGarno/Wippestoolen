"""Authentication Pydantic schemas."""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, validator


class UserLogin(BaseModel):
    """User login schema."""
    
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)


class UserCreate(BaseModel):
    """User registration schema."""

    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    display_name: str = Field(..., min_length=2, max_length=100)
    first_name: Optional[str] = Field(None, max_length=50)
    last_name: Optional[str] = Field(None, max_length=50)
    phone_number: Optional[str] = Field(None, max_length=20)
    street_address: Optional[str] = Field(None, max_length=200)
    city: Optional[str] = Field(None, max_length=100)
    postal_code: Optional[str] = Field(None, max_length=20)
    
    @validator("password")
    def validate_password(cls, v):
        """Validate password strength."""
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not any(c.islower() for c in v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit")
        return v
    
    @validator("display_name")
    def validate_display_name(cls, v):
        """Validate display name."""
        if v.strip() != v:
            raise ValueError("Display name cannot have leading/trailing spaces")
        if any(char in v for char in ['<', '>', '"', "'"]):
            raise ValueError("Display name contains invalid characters")
        return v


class UserResponse(BaseModel):
    """User response schema."""

    id: UUID
    email: EmailStr
    display_name: str
    first_name: Optional[str]
    last_name: Optional[str]
    phone_number: Optional[str]
    bio: Optional[str]
    avatar_url: Optional[str]
    average_rating: float
    total_ratings: int
    is_active: bool
    is_verified: bool
    email_verified_at: Optional[datetime]
    location_visible: bool
    profile_visible: bool
    street_address: Optional[str] = None
    city: Optional[str] = None
    postal_code: Optional[str] = None
    created_at: datetime
    last_login_at: Optional[datetime]

    class Config:
        from_attributes = True


class UserPublicResponse(BaseModel):
    """Public user response schema (limited data)."""
    
    id: UUID
    display_name: str
    bio: Optional[str]
    avatar_url: Optional[str]
    average_rating: float
    total_ratings: int
    created_at: datetime
    
    class Config:
        from_attributes = True


class Token(BaseModel):
    """Token response schema."""
    
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds


class TokenData(BaseModel):
    """Token payload data."""
    
    user_id: Optional[str] = None
    email: Optional[str] = None


class AuthResponse(BaseModel):
    """Authentication response schema."""
    
    user: UserResponse
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class RefreshTokenRequest(BaseModel):
    """Refresh token request schema."""
    
    refresh_token: str


class PasswordResetRequest(BaseModel):
    """Password reset request schema."""
    
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    """Password reset confirmation schema."""
    
    token: str
    new_password: str = Field(..., min_length=8, max_length=128)
    
    @validator("new_password")
    def validate_new_password(cls, v):
        """Validate new password strength."""
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not any(c.islower() for c in v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit")
        return v


class EmailVerificationRequest(BaseModel):
    """Email verification request schema."""
    
    token: str


class ChangePasswordRequest(BaseModel):
    """Change password request schema."""
    
    current_password: str
    new_password: str = Field(..., min_length=8, max_length=128)
    
    @validator("new_password")
    def validate_new_password(cls, v):
        """Validate new password strength."""
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not any(c.islower() for c in v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit")
        return v


class UpdateProfileRequest(BaseModel):
    """Update user profile schema."""

    display_name: Optional[str] = Field(None, min_length=2, max_length=100)
    first_name: Optional[str] = Field(None, max_length=50)
    last_name: Optional[str] = Field(None, max_length=50)
    phone_number: Optional[str] = Field(None, max_length=20)
    bio: Optional[str] = Field(None, max_length=500)
    location_visible: Optional[bool] = None
    profile_visible: Optional[bool] = None
    street_address: Optional[str] = Field(None, max_length=200)
    city: Optional[str] = Field(None, max_length=100)
    postal_code: Optional[str] = Field(None, max_length=20)
    
    @validator("display_name")
    def validate_display_name(cls, v):
        """Validate display name."""
        if v is not None:
            if v.strip() != v:
                raise ValueError("Display name cannot have leading/trailing spaces")
            if any(char in v for char in ['<', '>', '"', "'"]):
                raise ValueError("Display name contains invalid characters")
        return v


class DeleteAccountRequest(BaseModel):
    """Request to delete user account. Requires password confirmation."""

    password: str = Field(..., min_length=1, description="Current password for confirmation")