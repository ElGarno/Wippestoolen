"""Simple tests that don't require database."""

import pytest
from wippestoolen.app.core.security import hash_password, verify_password, create_access_token


def test_password_hashing():
    password = "testpassword123"
    hashed = hash_password(password)
    assert hashed != password
    assert verify_password(password, hashed)
    assert not verify_password("wrongpassword", hashed)


def test_access_token_creation():
    token = create_access_token(subject="test@example.com")
    assert token is not None
    assert isinstance(token, str)
    assert len(token) > 0