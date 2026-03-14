"""Main FastAPI application."""

import os
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from sqlalchemy import text

from wippestoolen.app.core.config import settings
from wippestoolen.app.api.v1.api import api_router
from wippestoolen.app.core.database import AsyncSessionLocal

# Create rate limiter
limiter = Limiter(key_func=get_remote_address)

# Create FastAPI app instance
app = FastAPI(
    title="Wippestoolen API",
    description="Neighborhood tool-sharing platform",
    version="0.1.0",
    docs_url="/docs" if settings.ENVIRONMENT == "development" else None,
    redoc_url="/redoc" if settings.ENVIRONMENT == "development" else None,
)

# Add rate limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Security middleware
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=settings.ALLOWED_HOSTS,
)

# CORS middleware for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=[
        "accept",
        "accept-encoding",
        "authorization", 
        "content-type",
        "dnt",
        "origin",
        "user-agent",
        "x-csrftoken",
        "x-csrf-token",
        "x-requested-with",
    ],
)

# Include API routes
app.include_router(api_router)

# Serve uploaded photos as static files
_photo_dir = Path(os.getenv("PHOTO_STORAGE_DIR", "/app/uploads/photos"))
_photo_dir.mkdir(parents=True, exist_ok=True)
app.mount("/uploads/photos", StaticFiles(directory=str(_photo_dir)), name="photos")


@app.on_event("startup")
async def create_default_categories():
    """Create default tool categories if they don't exist."""
    categories = [
        {"id": 1, "name": "Elektrowerkzeuge", "slug": "power-tools", "description": "Bohrmaschinen, Sägen, Schleifer", "sort_order": 1},
        {"id": 2, "name": "Handwerkzeuge", "slug": "hand-tools", "description": "Schraubendreher, Hammer, Zangen", "sort_order": 2},
        {"id": 3, "name": "Gartenwerkzeuge", "slug": "garden-tools", "description": "Rasenmäher, Spaten, Scheren", "sort_order": 3},
        {"id": 4, "name": "Leiter & Gerüste", "slug": "ladders-scaffolding", "description": "Leitern und Gerüstteile", "sort_order": 4},
        {"id": 5, "name": "Reinigungsgeräte", "slug": "cleaning-equipment", "description": "Hochdruckreiniger, Staubsauger", "sort_order": 5},
    ]
    
    try:
        async with AsyncSessionLocal() as db:
            # Check if categories exist
            result = await db.execute(text("SELECT COUNT(*) FROM tool_categories"))
            count = result.scalar()
            
            if count == 0:
                print("Creating default tool categories...")
                for cat in categories:
                    await db.execute(
                        text('''
                            INSERT INTO tool_categories (id, name, slug, description, is_active, sort_order, created_at)
                            VALUES (:id, :name, :slug, :description, true, :sort_order, NOW())
                            ON CONFLICT (id) DO NOTHING
                        '''),
                        cat
                    )
                    print(f"Created category: {cat['name']}")
                
                await db.commit()
                print("✅ Default categories created successfully!")
            else:
                print(f"Categories already exist ({count} found)")
    except Exception as e:
        print(f"❌ Error creating categories: {e}")


@app.get("/")
async def root() -> dict[str, str]:
    """Root endpoint."""
    return {"message": "Welcome to Wippestoolen API", "version": "0.1.0"}


@app.get("/health")
async def health_check() -> dict[str, str]:
    """Health check endpoint."""
    return {"status": "healthy"}