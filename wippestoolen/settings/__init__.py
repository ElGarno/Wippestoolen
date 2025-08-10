"""
Django settings for wippestoolen project.
"""

import os

# Determine which settings to use based on environment
environment = os.environ.get('DJANGO_ENVIRONMENT', 'development')

if environment == 'production':
    from .production import *
elif environment == 'development':
    from .development import *
else:
    from .development import *