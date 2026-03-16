"""API v1 router."""

from fastapi import APIRouter

from wippestoolen.app.api.v1.endpoints import ai, auth, tools, bookings, reviews, notifications, admin, photos

api_router = APIRouter(prefix="/api/v1")

# Include authentication routes
api_router.include_router(auth.router)

# Include tool management routes
api_router.include_router(tools.router)

# Include photo management routes
api_router.include_router(photos.router)

# Include booking management routes
api_router.include_router(bookings.router)

# Include review management routes
api_router.include_router(reviews.router)

# Include notification management routes
api_router.include_router(notifications.router)

# Include admin routes (temporary for database management)
api_router.include_router(admin.router)

# Include AI analysis routes
api_router.include_router(ai.router)