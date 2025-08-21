from django.shortcuts import render, redirect
from django.contrib.auth import login, authenticate, logout
from django.contrib.auth.forms import UserCreationForm
from django.contrib import messages
from django.contrib.auth import get_user_model

User = get_user_model()


def signup_view(request):
    """User registration view"""
    if request.method == 'POST':
        # Simplified signup (would use proper form in production)
        email = request.POST.get('email')
        username = request.POST.get('username')
        password = request.POST.get('password')
        
        if User.objects.filter(email=email).exists():
            messages.error(request, 'Email already exists')
        else:
            user = User.objects.create_user(
                username=username,
                email=email,
                password=password
            )
            login(request, user)
            messages.success(request, 'Welcome to Wippestoolen!')
            return redirect('home')
    
    return render(request, 'accounts/signup.html')


def login_view(request):
    """User login view"""
    if request.method == 'POST':
        email = request.POST.get('email')
        password = request.POST.get('password')
        
        # Try to authenticate with email
        try:
            user = User.objects.get(email=email)
            user = authenticate(request, username=user.username, password=password)
            if user:
                login(request, user)
                return redirect('home')
            else:
                messages.error(request, 'Invalid credentials')
        except User.DoesNotExist:
            messages.error(request, 'Invalid credentials')
    
    return render(request, 'accounts/login.html')


def logout_view(request):
    """User logout view"""
    logout(request)
    messages.success(request, 'You have been logged out.')
    return redirect('home')
