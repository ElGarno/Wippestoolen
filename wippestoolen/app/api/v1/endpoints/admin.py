"""Admin API endpoints.

Schema changes must be handled via Alembic migrations, not runtime endpoints.
The /create-tool-photos-table endpoint that previously existed here was removed
because it executed DDL without any authentication, constituting a critical
security vulnerability (A33).
"""

from fastapi import APIRouter

router = APIRouter(prefix="/admin", tags=["Admin"])
