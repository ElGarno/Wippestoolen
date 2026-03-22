"""Application configuration settings."""

import json
from typing import Any, Optional, Union

from pydantic import Field, PostgresDsn, computed_field, validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
    )

    # Basic app settings
    PROJECT_NAME: str = "Wippestoolen"
    VERSION: str = "0.1.0"
    ENVIRONMENT: str = Field(default="development", description="Environment name")
    DEBUG: bool = Field(default=True, description="Debug mode")

    # Security
    SECRET_KEY: str = Field(
        default="super-secret-key-change-in-production",
        description="Secret key for JWT tokens",
    )
    ALGORITHM: str = Field(default="HS256", description="JWT algorithm")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(
        default=30, description="Access token expiration in minutes"
    )
    REFRESH_TOKEN_EXPIRE_DAYS: int = Field(
        default=30, description="Refresh token expiration in days"
    )

    # CORS and hosts
    ALLOWED_HOSTS: list[str] = Field(
        default=["localhost", "127.0.0.1", "0.0.0.0", "testserver"], description="Allowed hosts"
    )
    ALLOWED_ORIGINS: list[str] = Field(
        default=[
            "http://localhost:3000",
            "http://localhost:8000",
            "http://localhost:8002",
            "http://127.0.0.1:3000",
            "http://127.0.0.1:8000",
            "http://127.0.0.1:8002",
        ],
        description="Allowed CORS origins",
    )

    # Database settings
    POSTGRES_SERVER: str = Field(default="localhost", description="PostgreSQL server")
    POSTGRES_PORT: int = Field(default=5432, description="PostgreSQL port")
    POSTGRES_USER: str = Field(default="wippestoolen", description="PostgreSQL user")
    POSTGRES_PASSWORD: str = Field(
        default="password", description="PostgreSQL password"
    )
    POSTGRES_DB: str = Field(default="wippestoolen", description="PostgreSQL database")

    # Database URL - can be set directly or will be constructed from individual settings
    DATABASE_URL: Optional[str] = Field(default=None, description="Complete database URL")

    @computed_field  # type: ignore
    @property
    def database_url(self) -> str:
        """Get database URL - use direct URL if provided, otherwise construct from components."""
        if self.DATABASE_URL:
            return self.DATABASE_URL
        return (
            f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    # Redis settings
    REDIS_URL: str = Field(
        default="redis://localhost:6379", description="Redis connection URL"
    )

    # File upload settings
    MAX_FILE_SIZE: int = Field(
        default=5 * 1024 * 1024, description="Max file size in bytes (5MB)"
    )
    ALLOWED_IMAGE_TYPES: list[str] = Field(
        default=["image/jpeg", "image/png", "image/webp"],
        description="Allowed image MIME types",
    )

    # AI / Anthropic
    ANTHROPIC_API_KEY: Optional[str] = Field(
        default=None, description="Anthropic API key for tool photo analysis"
    )

    # Cloudflare R2 Storage
    R2_ACCOUNT_ID: str = Field(default="", description="Cloudflare account ID")
    R2_ACCESS_KEY_ID: str = Field(default="", description="R2 access key ID")
    R2_SECRET_ACCESS_KEY: str = Field(default="", description="R2 secret access key")
    R2_BUCKET_NAME: str = Field(default="wippestoolen-photos", description="R2 bucket name")
    R2_PUBLIC_URL: str = Field(default="", description="R2 public URL for assets")

    # Rate limiting
    RATE_LIMIT_ENABLED: bool = Field(
        default=True, description="Enable rate limiting"
    )
    
    # Logging
    LOG_LEVEL: str = Field(default="INFO", description="Logging level")

    @validator("ALLOWED_HOSTS", pre=True)
    def parse_allowed_hosts(cls, v: Union[str, list[str]]) -> list[str]:
        """Parse ALLOWED_HOSTS from JSON string or list."""
        if isinstance(v, str):
            try:
                return json.loads(v)
            except json.JSONDecodeError:
                # If it's not JSON, treat as comma-separated string
                return [host.strip() for host in v.split(",") if host.strip()]
        return v

    @validator("ENVIRONMENT")
    def validate_environment(cls, v: str) -> str:
        """Validate environment setting."""
        allowed = ["development", "staging", "production"]
        if v not in allowed:
            raise ValueError(f"Environment must be one of: {allowed}")
        return v


# Create settings instance
settings = Settings()