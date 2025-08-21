from django.db import models
from django.contrib.auth import get_user_model
from django.core.validators import MinValueValidator, MaxValueValidator
from apps.bookings.models import Booking
import uuid

User = get_user_model()


class Review(models.Model):
    """
    Review model for mutual ratings after booking completion
    """
    # Basic information
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    booking = models.ForeignKey(Booking, on_delete=models.CASCADE, related_name='reviews')
    reviewer = models.ForeignKey(User, on_delete=models.CASCADE, related_name='reviews_given')
    reviewee = models.ForeignKey(User, on_delete=models.CASCADE, related_name='reviews_received')
    
    # Review content
    rating = models.PositiveIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)],
        help_text="Rating from 1 to 5 stars"
    )
    comment = models.TextField(max_length=500, blank=True)
    
    # Review type
    review_type = models.CharField(
        max_length=20,
        choices=[
            ('borrower_to_owner', 'Borrower to Owner'),
            ('owner_to_borrower', 'Owner to Borrower'),
        ]
    )
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'reviews_review'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['reviewer']),
            models.Index(fields=['reviewee']),
            models.Index(fields=['booking']),
            models.Index(fields=['rating']),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['booking', 'reviewer', 'reviewee'],
                name='unique_review_per_booking_pair'
            )
        ]
    
    def __str__(self):
        return f"{self.reviewer.username} → {self.reviewee.username} ({self.rating}★)"
    
    def save(self, *args, **kwargs):
        # Automatically determine review type
        if not self.review_type:
            if self.reviewer == self.booking.borrower:
                self.review_type = 'borrower_to_owner'
            else:
                self.review_type = 'owner_to_borrower'
        
        is_new = self._state.adding
        super().save(*args, **kwargs)
        
        # Update reviewee's profile rating
        if is_new:
            self._update_profile_rating()
    
    def _update_profile_rating(self):
        """Update the reviewee's profile rating"""
        if hasattr(self.reviewee, 'profile'):
            self.reviewee.profile.add_rating(self.rating)


class ReviewResponse(models.Model):
    """
    Optional response from reviewee to a review
    """
    review = models.OneToOneField(Review, on_delete=models.CASCADE, related_name='response')
    response_text = models.TextField(max_length=300)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'reviews_response'
    
    def __str__(self):
        return f"Response to {self.review}"
