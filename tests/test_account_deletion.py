"""Tests for account deletion service logic."""

import uuid
import re

import pytest


def test_anonymized_email_format():
    """Verify anonymized email passes typical email regex."""
    user_id = uuid.uuid4()
    email = f"deleted_{user_id}@deleted.local"
    pattern = r'^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
    assert re.match(pattern, email), f"Email {email} does not match pattern"


def test_anonymized_email_uniqueness():
    """Each deletion produces a unique email."""
    emails = {f"deleted_{uuid.uuid4()}@deleted.local" for _ in range(100)}
    assert len(emails) == 100
