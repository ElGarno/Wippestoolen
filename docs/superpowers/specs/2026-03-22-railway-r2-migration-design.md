# Wippestoolen Railway + Cloudflare R2 Migration

## Goal

Migrate the Wippestoolen backend from Synology NAS (Portainer + Cloudflare Tunnel) to Railway with Cloudflare R2 for photo storage. No data migration needed — existing NAS data is test-only.

## Current Architecture

- **Backend**: FastAPI in Docker on Synology NAS, exposed via Cloudflare Tunnel
- **Database**: PostgreSQL 15 container on NAS (port 5435)
- **Photo Storage**: Local filesystem volume (`/app/uploads/photos`), served via FastAPI `StaticFiles`
- **Domain**: `api.wippestoolen.de` → Cloudflare Tunnel → NAS container

## Target Architecture

- **Backend**: FastAPI on Railway (auto-deploy from GitHub, Dockerfile builder)
- **Database**: Railway PostgreSQL plugin (managed, `DATABASE_URL` env var)
- **Photo Storage**: Cloudflare R2 via S3-compatible API (`boto3`)
- **Domain**: `api.wippestoolen.de` → Railway Custom Domain (CNAME)
- **Assets**: `assets.wippestoolen.de` → R2 Custom Domain (or R2 dev URL)

## Reference Implementation

ElGarno/whisky-api uses the same pattern:
- `boto3` with S3-compatible endpoint (`https://{account_id}.r2.cloudflarestorage.com`)
- `R2StorageService` class with `upload()`, `delete()`, `key_from_url()`
- `railway.toml` with Dockerfile builder + healthcheck
- `DATABASE_URL` directly from Railway

## Changes Required

### 1. Dependencies

`boto3>=1.34` is already in `pyproject.toml`. No new dependency needed.

### 2. R2 Storage Service

Create `wippestoolen/app/services/storage.py` — adapted from whisky-api pattern:

```python
class R2StorageService:
    def __init__(self, account_id, access_key_id, secret_access_key, bucket_name, public_url):
        # boto3 S3 client with R2 endpoint

    def upload(self, file_bytes: bytes, key: str, content_type: str) -> str:
        # Upload to R2, return public URL

    def delete(self, key: str) -> None:
        # Delete from R2

    def key_from_url(self, url: str) -> str | None:
        # Extract R2 object key from public URL

storage = _create_storage()  # module-level singleton
```

Object key format: `photos/{tool_id}/{photo_id}.{ext}`

### 3. Photo Service Refactor

Modify `wippestoolen/app/services/photo_service.py`:

- Remove `PHOTO_STORAGE_DIR` and `PHOTO_BASE_URL` module-level vars
- Remove `Path` / filesystem operations
- Import and use `storage` singleton from `storage.py`
- `upload_photo()`: call `storage.upload(content, key, content_type)` instead of `full_path.write_bytes(content)`. Store the returned absolute URL as `original_url`.
- `delete_photo()`: call `storage.delete(storage.key_from_url(photo.original_url))` instead of `file_path.unlink()`

### 4. Config Changes

Update `wippestoolen/app/core/config.py`:

**Add:**
```python
# Cloudflare R2 Storage
R2_ACCOUNT_ID: str = Field(default="", description="Cloudflare account ID")
R2_ACCESS_KEY_ID: str = Field(default="", description="R2 access key ID")
R2_SECRET_ACCESS_KEY: str = Field(default="", description="R2 secret access key")
R2_BUCKET_NAME: str = Field(default="wippestoolen-photos", description="R2 bucket name")
R2_PUBLIC_URL: str = Field(default="", description="R2 public URL for assets")
```

**Keep but make optional:** `DATABASE_URL` field already exists and takes precedence over individual POSTGRES_* fields — this already works for Railway.

**Remove:** `PHOTO_STORAGE_DIR`, `PHOTO_BASE_URL` env vars (only used in photo_service.py module-level vars, not in Settings class). Remove unused AWS fields from Settings: `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET_NAME`, `EMAIL_FROM`, `EMAIL_FROM_NAME`.

### 5. FastAPI Main App

Update `wippestoolen/app/main.py`:

- Remove `StaticFiles` mount for `/uploads/photos` (photos served directly from R2 CDN)
- Remove `_photo_dir` variable and `os` import if no longer needed

### 6. Frontend: getPhotoUrl Helper

Update `mobile/constants/config.ts`:

- Since photo URLs stored in DB will now be absolute R2 URLs (e.g., `https://assets.wippestoolen.de/photos/...`), `getPhotoUrl()` should detect absolute URLs and return them as-is
- Backward-compatible: still converts relative URLs for any legacy data

### 7. Entrypoint: Railway PORT Support

Update `entrypoint.sh` to use Railway's `PORT` env var:

```bash
exec uvicorn wippestoolen.app.main:app --host 0.0.0.0 --port ${PORT:-8000}
```

Railway injects `PORT` and expects the app to bind to it. Without this, the app is unreachable.

### 8. Dockerfile Cleanup

Remove `/app/uploads/photos` directory creation from Dockerfile (no longer needed):

```dockerfile
RUN mkdir -p /app/logs && \
```

### 9. Railway Configuration

Create `railway.toml`:
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

Note: `healthcheckTimeout = 60` to allow for Alembic migrations on first deploy.

### 10. Environment Variables

**Railway service env vars:**
```
DATABASE_URL          — auto-injected by Railway PostgreSQL plugin
SECRET_KEY            — JWT secret
ENVIRONMENT=production
DEBUG=false
LOG_LEVEL=INFO
RUN_MIGRATIONS=true
ANTHROPIC_API_KEY     — for AI photo analysis
R2_ACCOUNT_ID         — Cloudflare account ID
R2_ACCESS_KEY_ID      — R2 API token access key
R2_SECRET_ACCESS_KEY  — R2 API token secret
R2_BUCKET_NAME=wippestoolen-photos
R2_PUBLIC_URL          — e.g., https://assets.wippestoolen.de
ALLOWED_HOSTS=["api.wippestoolen.de","*.up.railway.app","localhost"]
ALLOWED_ORIGINS=["https://wippestoolen.de","http://localhost:3000"]
RATE_LIMIT_ENABLED=true
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=30
```

Note: Include `*.up.railway.app` in `ALLOWED_HOSTS` during transition before custom domain is configured.

**No longer needed:**
```
POSTGRES_SERVER, POSTGRES_PORT, POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB
PHOTO_STORAGE_DIR, PHOTO_BASE_URL
CLOUDFLARE_TUNNEL_TOKEN
REDIS_URL (unless Redis is added to Railway)
```

### 11. Docker Compose

Update `docker-compose.yml` to be development-only (local dev with PostgreSQL). Remove `cloudflared` service. Keep `db` service for local development.

### 12. DNS Changes

- `api.wippestoolen.de` — change from Cloudflare Tunnel to CNAME pointing to Railway
- `assets.wippestoolen.de` — new CNAME for R2 Custom Domain (or use R2 dev URL)

### 13. .env.example

Create/update `.env.railway.example` with all Railway env vars for documentation.

## Out of Scope

- Redis on Railway (not critical for MVP, rate limiting works in-memory)
- Photo thumbnails/resizing (not currently implemented, can be added later)
- CI/CD pipeline (Railway auto-deploys from GitHub branch)
- Data migration (all existing data is test data)

## Prerequisites (Manual Steps)

1. **R2 bucket**: Create `wippestoolen-photos` bucket in Cloudflare dashboard
2. **R2 public access**: Enable public access on the bucket (R2 Custom Domain or Public Bucket settings)
3. **R2 CORS policy**: Allow GET from `*` (images are public assets)
4. **R2 API token**: Create token with R2 read/write permissions, note Account ID + Access Key + Secret
5. **DNS TTL**: Lower TTL on `api.wippestoolen.de` before cutover to minimize downtime
6. **Railway project**: Create project, add PostgreSQL plugin, connect GitHub repo

## Risks

- **R2 bucket setup**: Needs manual creation in Cloudflare dashboard + API token with R2 permissions + public access enabled
- **DATABASE_URL format**: Railway provides `postgresql://` URLs — entrypoint.sh health check replacement is a no-op (harmless), async driver conversion in database.py works correctly
- **ALLOWED_HOSTS**: Railway temporary domain (`*.up.railway.app`) must be in ALLOWED_HOSTS before custom domain is set up, otherwise TrustedHostMiddleware rejects all requests
- **DNS propagation**: Brief downtime when switching CNAME from Tunnel to Railway. Mitigate by lowering TTL beforehand
- **Rate limit reset**: In-memory rate limiting resets on every Railway deploy (acceptable for MVP)

## Rollback Plan

If Railway deployment fails:
1. Re-enable Cloudflare Tunnel on NAS (Portainer stack is still configured)
2. Switch DNS back to Tunnel CNAME
3. NAS containers and data remain untouched throughout migration
