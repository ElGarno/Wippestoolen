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
