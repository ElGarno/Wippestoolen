from django.contrib.auth.models import AbstractUser
from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator


class User(AbstractUser):
    """
    Extended user model with additional profile fields
    """
    email = models.EmailField(unique=True)
    email_verified = models.BooleanField(default=False)
    
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']


class Profile(models.Model):
    """
    User profile with location and rating information
    """
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    display_name = models.CharField(max_length=100, blank=True)
    bio = models.TextField(max_length=500, blank=True)
    latitude = models.FloatField(null=True, blank=True, help_text="User's latitude")
    longitude = models.FloatField(null=True, blank=True, help_text="User's longitude")
    address = models.CharField(max_length=255, blank=True, help_text="Human-readable address")
    phone = models.CharField(max_length=20, blank=True)
    
    # Rating fields
    total_ratings = models.PositiveIntegerField(default=0)
    rating_sum = models.PositiveIntegerField(default=0)
    
    # Profile settings
    show_location_publicly = models.BooleanField(default=True)
    receive_email_notifications = models.BooleanField(default=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'accounts_profile'
    
    def __str__(self):
        return f"{self.display_name or self.user.username}'s Profile"
    
    @property
    def average_rating(self):
        """Calculate average rating"""
        if self.total_ratings == 0:
            return 0
        return round(self.rating_sum / self.total_ratings, 1)
    
    def add_rating(self, rating):
        """Add a new rating to the profile"""
        self.total_ratings += 1
        self.rating_sum += rating
        self.save()
    
    def get_display_name(self):
        """Get display name or fallback to username"""
        return self.display_name or self.user.username
