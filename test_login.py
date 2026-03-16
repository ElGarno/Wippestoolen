#!/usr/bin/env python
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'wippestoolen.settings')
django.setup()

from django.contrib.auth import authenticate

# Test authentication with email (since USERNAME_FIELD = 'email')
auth_user = authenticate(username='admin@wippestoolen.com', password='admin123')
print(f"Email authentication test: {'SUCCESS' if auth_user else 'FAILED'}")

if auth_user:
    print(f"User: {auth_user.username}")
    print(f"Email: {auth_user.email}")
    print(f"Is staff: {auth_user.is_staff}")