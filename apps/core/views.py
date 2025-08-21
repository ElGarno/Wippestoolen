from django.shortcuts import render
from django.contrib.auth import get_user_model
from apps.tools.models import Tool
from apps.bookings.models import Booking

User = get_user_model()


def home(request):
    """Home page view with stats and featured tools"""
    context = {
        'stats': {
            'users': User.objects.count(),
            'tools': Tool.objects.count(),
            'bookings': Booking.objects.filter(status='returned').count(),
            'rating': 4.8,  # Placeholder
        },
        'featured_tools': Tool.objects.filter(is_available=True)[:3],
    }
    return render(request, 'home.html', context)
