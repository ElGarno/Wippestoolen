"""API v1 router."""

from fastapi import APIRouter

from wippestoolen.app.api.v1.endpoints import auth, tools, bookings, reviews, notifications

api_router = APIRouter(prefix="/api/v1")

# Include authentication routes
api_router.include_router(auth.router)

# Include tool management routes
api_router.include_router(tools.router)

# Include booking management routes
api_router.include_router(bookings.router)

# Include review management routes
api_router.include_router(reviews.router)

# Include notification management routes
api_router.include_router(notifications.router)