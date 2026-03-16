#!/usr/bin/env python
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'wippestoolen.settings')
django.setup()

from apps.accounts.models import User

# Delete existing admin users
User.objects.filter(username__in=['admin', 'admin2']).delete()

# Create new superuser
user = User.objects.create_superuser(
    username='admin',
    email='admin@wippestoolen.com', 
    password='admin123'
)
print(f"Created superuser: {user.username}")
print(f"Email: {user.email}")
print(f"Is staff: {user.is_staff}")
print(f"Is superuser: {user.is_superuser}")

# Test login
from django.contrib.auth import authenticate
auth_user = authenticate(username='admin', password='admin123')
print(f"Authentication test: {'SUCCESS' if auth_user else 'FAILED'}")