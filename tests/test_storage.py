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
    svc._s3 = MagicMock()
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
