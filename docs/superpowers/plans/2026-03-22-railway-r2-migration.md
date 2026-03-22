# Railway + Cloudflare R2 Migration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate Wippestoolen backend from Synology NAS to Railway with Cloudflare R2 for photo storage.

**Architecture:** FastAPI on Railway (Dockerfile builder, auto-deploy from GitHub), Railway PostgreSQL plugin for database, Cloudflare R2 via boto3 S3-compatible API for photo storage. Frontend `getPhotoUrl()` already handles absolute URLs — no frontend change needed.

**Tech Stack:** FastAPI, SQLAlchemy, boto3 (S3-compatible), Railway, Cloudflare R2

**Spec:** `docs/superpowers/specs/2026-03-22-railway-r2-migration-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `wippestoolen/app/services/storage.py` | Create | R2 storage service (upload, delete, key_from_url) |
| `wippestoolen/app/services/photo_service.py` | Modify | Replace filesystem ops with R2 storage calls |
| `wippestoolen/app/core/config.py` | Modify | Add R2 fields, remove unused AWS/email fields |
| `wippestoolen/app/main.py` | Modify | Remove StaticFiles mount |
| `entrypoint.sh` | Modify | Use `${PORT:-8000}` for Railway |
| `Dockerfile` | Modify | Remove `/app/uploads/photos` dir creation |
| `railway.toml` | Create | Railway deployment config |
| `docker-compose.yml` | Modify | Dev-only, remove cloudflared |
| `.env.railway.example` | Create | Document Railway env vars |
| `tests/test_storage.py` | Create | Unit tests for R2StorageService |

---

### Task 1: Config — Add R2 Fields, Remove Unused AWS Fields

**Files:**
- Modify: `wippestoolen/app/core/config.py`

Config must be updated first — `storage.py` imports `settings.R2_*` at module level.

- [ ] **Step 1: Add R2 fields to Settings class**

Add after the existing `ANTHROPIC_API_KEY` field (around line 114):

```python
    # Cloudflare R2 Storage
    R2_ACCOUNT_ID: str = Field(default="", description="Cloudflare account ID")
    R2_ACCESS_KEY_ID: str = Field(default="", description="R2 access key ID")
    R2_SECRET_ACCESS_KEY: str = Field(default="", description="R2 secret access key")
    R2_BUCKET_NAME: str = Field(default="wippestoolen-photos", description="R2 bucket name")
    R2_PUBLIC_URL: str = Field(default="", description="R2 public URL for assets")
```

- [ ] **Step 2: Remove unused AWS and email fields**

Remove these fields from Settings:
- `AWS_REGION` (line 83)
- `AWS_ACCESS_KEY_ID` (lines 84-86)
- `AWS_SECRET_ACCESS_KEY` (lines 87-89)
- `S3_BUCKET_NAME` (lines 90-92)
- `EMAIL_FROM` (lines 95-97)
- `EMAIL_FROM_NAME` (lines 98-100)

- [ ] **Step 3: Verify config loads correctly**

Run: `python -c "from wippestoolen.app.core.config import settings; print(settings.R2_BUCKET_NAME)"`
Expected: `wippestoolen-photos`

- [ ] **Step 4: Commit**

```bash
git add wippestoolen/app/core/config.py
git commit -m "feat: add R2 config fields, remove unused AWS/email settings"
```

---

### Task 2: R2 Storage Service

**Files:**
- Create: `wippestoolen/app/services/storage.py`
- Create: `tests/test_storage.py`

- [ ] **Step 1: Write the R2StorageService**

Create `wippestoolen/app/services/storage.py`:

```python
"""Cloudflare R2 storage service (S3-compatible)."""

import boto3
from wippestoolen.app.core.config import settings


class R2StorageService:
    """Service for storing files in Cloudflare R2."""

    def __init__(
        self,
        account_id: str,
        access_key_id: str,
        secret_access_key: str,
        bucket_name: str,
        public_url: str,
    ):
        self.bucket_name = bucket_name
        self.public_url = public_url.rstrip("/")
        self._s3 = (
            boto3.client(
                "s3",
                endpoint_url=f"https://{account_id}.r2.cloudflarestorage.com",
                aws_access_key_id=access_key_id,
                aws_secret_access_key=secret_access_key,
                region_name="auto",
            )
            if account_id
            else None
        )

    @property
    def is_configured(self) -> bool:
        return bool(self.public_url and self.bucket_name and self._s3)

    def upload(self, file_bytes: bytes, key: str, content_type: str) -> str:
        """Upload file to R2 and return public URL."""
        if not self._s3:
            raise RuntimeError("R2 storage is not configured")
        self._s3.put_object(
            Bucket=self.bucket_name,
            Key=key,
            Body=file_bytes,
            ContentType=content_type,
        )
        return f"{self.public_url}/{key}"

    def delete(self, key: str) -> None:
        """Delete file from R2."""
        if not self._s3:
            raise RuntimeError("R2 storage is not configured")
        self._s3.delete_object(
            Bucket=self.bucket_name,
            Key=key,
        )

    def key_from_url(self, url: str) -> str | None:
        """Extract R2 key from a public URL. Returns None if URL doesn't match."""
        prefix = f"{self.public_url}/"
        if url.startswith(prefix):
            return url[len(prefix):]
        return None


def _create_storage() -> R2StorageService:
    return R2StorageService(
        account_id=settings.R2_ACCOUNT_ID,
        access_key_id=settings.R2_ACCESS_KEY_ID,
        secret_access_key=settings.R2_SECRET_ACCESS_KEY,
        bucket_name=settings.R2_BUCKET_NAME,
        public_url=settings.R2_PUBLIC_URL,
    )


storage = _create_storage()
```

- [ ] **Step 2: Write unit tests**

Create `tests/test_storage.py`:

```python
"""Tests for R2StorageService."""

from unittest.mock import MagicMock

import pytest

from wippestoolen.app.services.storage import R2StorageService


def _make_svc(bucket: str = "test-bucket", public_url: str = "https://assets.example.com") -> R2StorageService:
    """Create a test R2StorageService with a mocked S3 client."""
    svc = R2StorageService(
        account_id="test-account",
        access_key_id="key",
        secret_access_key="secret",
        bucket_name=bucket,
        public_url=public_url,
    )
    svc._s3 = MagicMock()  # Replace real boto3 client with mock
    return svc


def test_upload_returns_public_url():
    svc = _make_svc()
    url = svc.upload(b"data", "photos/abc/123.jpg", "image/jpeg")

    assert url == "https://assets.example.com/photos/abc/123.jpg"
    svc._s3.put_object.assert_called_once_with(
        Bucket="test-bucket",
        Key="photos/abc/123.jpg",
        Body=b"data",
        ContentType="image/jpeg",
    )


def test_delete_calls_s3():
    svc = _make_svc()
    svc.delete("photos/abc/123.jpg")

    svc._s3.delete_object.assert_called_once_with(
        Bucket="test-bucket",
        Key="photos/abc/123.jpg",
    )


def test_key_from_url_matching():
    svc = _make_svc()
    assert svc.key_from_url("https://assets.example.com/photos/abc/123.jpg") == "photos/abc/123.jpg"


def test_key_from_url_non_matching():
    svc = _make_svc()
    assert svc.key_from_url("https://other.com/photos/abc/123.jpg") is None


def test_is_configured_true():
    svc = _make_svc()
    assert svc.is_configured is True


def test_is_configured_false_no_client():
    svc = R2StorageService(
        account_id="",
        access_key_id="",
        secret_access_key="",
        bucket_name="bucket",
        public_url="https://url",
    )
    assert svc.is_configured is False


def test_upload_raises_when_not_configured():
    svc = R2StorageService(
        account_id="",
        access_key_id="",
        secret_access_key="",
        bucket_name="bucket",
        public_url="https://url",
    )
    with pytest.raises(RuntimeError, match="not configured"):
        svc.upload(b"data", "key", "image/jpeg")
```

- [ ] **Step 3: Run tests**

Run: `pytest tests/test_storage.py -v`
Expected: All 7 tests PASS

- [ ] **Step 4: Commit**

```bash
git add wippestoolen/app/services/storage.py tests/test_storage.py
git commit -m "feat: add R2 storage service for Cloudflare R2 photo storage"
```

---

### Task 3: Photo Service — Replace Filesystem with R2

**Files:**
- Modify: `wippestoolen/app/services/photo_service.py`

- [ ] **Step 1: Refactor photo_service.py**

Replace the entire file. Key changes:
- Remove `PHOTO_STORAGE_DIR`, `PHOTO_BASE_URL`, `Path`, `os` imports
- Import `storage` from `storage.py`
- `upload_photo()`: build R2 key as `photos/{tool_id}/{photo_id}.{ext}`, call `storage.upload()`
- `delete_photo()`: extract key via `storage.key_from_url()`, call `storage.delete()`

```python
"""Photo service for tool photo uploads and management."""

import logging
import uuid

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from wippestoolen.app.core.config import settings
from wippestoolen.app.models.tool import Tool, ToolPhoto
from wippestoolen.app.services.storage import storage

logger = logging.getLogger(__name__)


class PhotoService:
    """Service for managing tool photos with R2 cloud storage."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def upload_photo(
        self,
        tool_id: uuid.UUID,
        file: UploadFile,
        user_id: uuid.UUID,
    ) -> ToolPhoto:
        """Upload a photo for a tool to R2 storage."""
        # Check tool exists and user owns it
        result = await self.db.execute(select(Tool).where(Tool.id == tool_id))
        tool = result.scalar_one_or_none()

        if tool is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Tool not found",
            )

        if tool.owner_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not own this tool",
            )

        # Validate content type — fall back to extension-based detection
        content_type = file.content_type or ""
        if content_type not in settings.ALLOWED_IMAGE_TYPES:
            filename = (file.filename or "").lower()
            if filename.endswith(".png"):
                content_type = "image/png"
            elif filename.endswith(".webp"):
                content_type = "image/webp"
            elif filename.endswith((".jpg", ".jpeg", ".heic")):
                content_type = "image/jpeg"
            else:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"File type not allowed. Allowed types: {', '.join(settings.ALLOWED_IMAGE_TYPES)}",
                )

        # Read file and validate size
        content = await file.read()
        if len(content) > settings.MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"File too large. Maximum size is {settings.MAX_FILE_SIZE // (1024 * 1024)}MB",
            )

        # Generate unique key and upload to R2
        extension = (file.filename or "photo").rsplit(".", 1)[-1].lower()
        photo_id = uuid.uuid4()
        key = f"photos/{tool_id}/{photo_id}.{extension}"
        original_url = storage.upload(content, key, content_type)

        # Count existing photos for display_order
        existing_count_result = await self.db.execute(
            select(ToolPhoto).where(
                ToolPhoto.tool_id == tool_id,
                ToolPhoto.is_active == True,  # noqa: E712
            )
        )
        existing_photos = existing_count_result.scalars().all()
        display_order = len(existing_photos)
        is_primary = display_order == 0

        # Create ToolPhoto record
        photo = ToolPhoto(
            tool_id=tool_id,
            original_url=original_url,
            filename=file.filename,
            file_size_bytes=len(content),
            mime_type=content_type,
            display_order=display_order,
            is_primary=is_primary,
            is_active=True,
        )
        self.db.add(photo)
        await self.db.commit()
        await self.db.refresh(photo)

        return photo

    async def delete_photo(
        self,
        photo_id: uuid.UUID,
        user_id: uuid.UUID,
        tool_id: uuid.UUID,
    ) -> None:
        """Delete a photo by soft-deleting it and removing from R2."""
        result = await self.db.execute(
            select(ToolPhoto).where(
                ToolPhoto.id == photo_id,
                ToolPhoto.tool_id == tool_id,
                ToolPhoto.is_active == True,  # noqa: E712
            )
        )
        photo = result.scalar_one_or_none()

        if photo is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Photo not found",
            )

        # Validate ownership via the tool
        tool_result = await self.db.execute(select(Tool).where(Tool.id == tool_id))
        tool = tool_result.scalar_one_or_none()

        if tool is None or tool.owner_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not own this tool",
            )

        # Delete from R2 (best-effort)
        key = storage.key_from_url(photo.original_url)
        if key:
            try:
                storage.delete(key)
            except Exception:
                logger.warning("Failed to delete photo from R2: %s", key, exc_info=True)

        # Soft-delete the record
        photo.is_active = False
        await self.db.commit()

    async def get_photos_for_tool(self, tool_id: uuid.UUID) -> list[ToolPhoto]:
        """Return active photos for a tool, ordered by display_order."""
        result = await self.db.execute(
            select(ToolPhoto)
            .where(
                ToolPhoto.tool_id == tool_id,
                ToolPhoto.is_active == True,  # noqa: E712
            )
            .order_by(ToolPhoto.display_order)
        )
        return list(result.scalars().all())
```

- [ ] **Step 2: Verify no remaining filesystem references**

Run: `grep -rn "PHOTO_STORAGE_DIR\|PHOTO_BASE_URL\|write_bytes\|unlink" wippestoolen/app/services/photo_service.py`
Expected: No output (all filesystem references removed)

- [ ] **Step 3: Commit**

```bash
git add wippestoolen/app/services/photo_service.py
git commit -m "refactor: replace filesystem photo storage with Cloudflare R2"
```

---

### Task 4: FastAPI Main App — Remove StaticFiles Mount

**Files:**
- Modify: `wippestoolen/app/main.py`

- [ ] **Step 1: Remove StaticFiles mount and related imports**

Remove these lines from `main.py`:
- Line 2: `import os` (remove if not used elsewhere)
- Line 3: `from pathlib import Path` (remove if not used elsewhere)
- Line 9: `from fastapi.staticfiles import StaticFiles`
- Lines 64-67: The `_photo_dir` variable and `app.mount(...)` call

- [ ] **Step 2: Verify app still starts**

Run: `python -c "from wippestoolen.app.main import app; print(app.title)"`
Expected: `Wippestoolen API`

- [ ] **Step 3: Commit**

```bash
git add wippestoolen/app/main.py
git commit -m "refactor: remove StaticFiles mount, photos served from R2"
```

---

### Task 5: Entrypoint + Dockerfile + Railway Config

**Files:**
- Modify: `entrypoint.sh`
- Modify: `Dockerfile`
- Create: `railway.toml`

- [ ] **Step 1: Update entrypoint.sh for Railway PORT**

Change the last line from:
```bash
exec uvicorn wippestoolen.app.main:app --host 0.0.0.0 --port 8000
```
to:
```bash
exec uvicorn wippestoolen.app.main:app --host 0.0.0.0 --port ${PORT:-8000}
```

- [ ] **Step 2: Clean up Dockerfile**

1. Update comment on line 2 from "Optimized for production deployment on AWS ECS" to "Optimized for production deployment on Railway"

2. Change the `mkdir` line from:
```dockerfile
RUN mkdir -p /app/logs /app/uploads/photos && \
```
to:
```dockerfile
RUN mkdir -p /app/logs && \
```

3. Remove the `HEALTHCHECK` directive (lines 68-69) — Railway handles health checks via `railway.toml`, and the hardcoded port 8000 would mismatch Railway's dynamic `PORT`:
```dockerfile
# Remove these lines:
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1
```

- [ ] **Step 3: Create railway.toml**

```toml
[build]
builder = "DOCKERFILE"
dockerfilePath = "Dockerfile"

[deploy]
healthcheckPath = "/health"
healthcheckTimeout = 60
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 3
```

- [ ] **Step 4: Commit**

```bash
git add entrypoint.sh Dockerfile railway.toml
git commit -m "feat: add Railway deployment config, update entrypoint for PORT env"
```

---

### Task 6: Docker Compose — Dev-Only + .env.railway.example

**Files:**
- Modify: `docker-compose.yml`
- Create: `.env.railway.example`

- [ ] **Step 1: Simplify docker-compose.yml for local dev**

Replace entire file — remove `cloudflared` service, keep `db` and `api` for local development:

```yaml
# Local development only — production runs on Railway
services:
  db:
    image: postgres:15-alpine
    container_name: wippestoolen_postgres
    restart: unless-stopped
    ports:
      - "5435:5432"
    environment:
      - POSTGRES_USER=wippestoolen
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-localdev}
      - POSTGRES_DB=wippestoolen
    volumes:
      - wippestoolen_pgdata:/var/lib/postgresql/data

  api:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: wippestoolen_api
    restart: unless-stopped
    ports:
      - "8092:8000"
    depends_on:
      - db
    environment:
      - ENVIRONMENT=development
      - DEBUG=true
      - SECRET_KEY=${SECRET_KEY:-dev-secret-key}
      - POSTGRES_SERVER=db
      - POSTGRES_PORT=5432
      - POSTGRES_USER=wippestoolen
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-localdev}
      - POSTGRES_DB=wippestoolen
      - RUN_MIGRATIONS=true
      - R2_ACCOUNT_ID=${R2_ACCOUNT_ID:-}
      - R2_ACCESS_KEY_ID=${R2_ACCESS_KEY_ID:-}
      - R2_SECRET_ACCESS_KEY=${R2_SECRET_ACCESS_KEY:-}
      - R2_BUCKET_NAME=${R2_BUCKET_NAME:-wippestoolen-photos}
      - R2_PUBLIC_URL=${R2_PUBLIC_URL:-}

volumes:
  wippestoolen_pgdata:
```

- [ ] **Step 2: Create .env.railway.example**

```
# Wippestoolen Railway Deployment - Environment Variables
# Set these in Railway service settings

# Database (auto-injected by Railway PostgreSQL plugin)
# DATABASE_URL=postgresql://...

# JWT Secret (generate with: python3 -c "import secrets; print(secrets.token_hex(32))")
SECRET_KEY=<generate-secret>

# App
ENVIRONMENT=production
DEBUG=false
LOG_LEVEL=INFO
RUN_MIGRATIONS=true

# Token expiry
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=30

# Cloudflare R2 Storage
R2_ACCOUNT_ID=<cloudflare-account-id>
R2_ACCESS_KEY_ID=<r2-access-key>
R2_SECRET_ACCESS_KEY=<r2-secret-key>
R2_BUCKET_NAME=wippestoolen-photos
R2_PUBLIC_URL=https://assets.wippestoolen.de

# AI (optional)
ANTHROPIC_API_KEY=<anthropic-api-key>

# Security
ALLOWED_HOSTS=["api.wippestoolen.de","*.up.railway.app","localhost"]
ALLOWED_ORIGINS=["https://wippestoolen.de","http://localhost:3000"]
RATE_LIMIT_ENABLED=true
```

- [ ] **Step 3: Commit**

```bash
git add docker-compose.yml .env.railway.example
git commit -m "chore: simplify docker-compose for local dev, add Railway env example"
```

---

### Task 7: Final Verification + Cleanup

**Files:**
- Modify: `.env.nas.example` (delete — superseded by `.env.railway.example`)

- [ ] **Step 1: Delete obsolete .env.nas.example**

```bash
git rm .env.nas.example
```

- [ ] **Step 2: Verify no broken imports**

Run: `python -c "from wippestoolen.app.main import app; from wippestoolen.app.services.storage import storage; from wippestoolen.app.services.photo_service import PhotoService; print('All imports OK')"`
Expected: `All imports OK`

- [ ] **Step 3: Run existing tests (if any)**

Run: `pytest tests/ -v --no-header 2>&1 | tail -20`
Expected: Tests pass (or skip gracefully if DB not available)

- [ ] **Step 4: Final commit**

```bash
git rm .env.nas.example
git commit -m "chore: remove obsolete NAS env example"
```

---

## Post-Implementation: Manual Steps (User)

These are done by the user in Cloudflare and Railway dashboards:

1. **Cloudflare R2**: Create bucket `wippestoolen-photos`, enable public access, set CORS
2. **Railway**: Create project, add PostgreSQL plugin, connect GitHub repo
3. **Railway env vars**: Set all variables from `.env.railway.example`
4. **DNS**: Point `api.wippestoolen.de` CNAME to Railway, `assets.wippestoolen.de` to R2
5. **Deploy**: Push to GitHub, Railway auto-deploys
6. **Verify**: Test `/health`, create a tool with photo, verify R2 upload
