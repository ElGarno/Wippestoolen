from django.db import models
from django.contrib.auth import get_user_model
from django.core.validators import MinValueValidator, MaxValueValidator
from django.utils import timezone
from apps.tools.models import Tool
import uuid

User = get_user_model()


class Booking(models.Model):
    """
    Booking model managing the tool borrowing lifecycle
    """
    STATUS_CHOICES = [
        ('requested', 'Requested'),
        ('confirmed', 'Confirmed'),
        ('active', 'Active'),
        ('returned', 'Returned'),
        ('cancelled', 'Cancelled'),
    ]
    
    # Basic information
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tool = models.ForeignKey(Tool, on_delete=models.CASCADE, related_name='bookings')
    borrower = models.ForeignKey(User, on_delete=models.CASCADE, related_name='bookings_as_borrower')
    
    # Booking details
    requested_start_date = models.DateField()
    requested_end_date = models.DateField()
    actual_start_date = models.DateField(null=True, blank=True)
    actual_end_date = models.DateField(null=True, blank=True)
    
    # Status and communication
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='requested')
    borrower_message = models.TextField(max_length=500, blank=True)
    owner_response = models.TextField(max_length=500, blank=True)
    
    # Financial
    deposit_amount = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    deposit_paid = models.BooleanField(default=False)
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    confirmed_at = models.DateTimeField(null=True, blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        db_table = 'bookings_booking'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status']),
            models.Index(fields=['borrower']),
            models.Index(fields=['tool']),
            models.Index(fields=['requested_start_date']),
        ]
    
    def __str__(self):
        return f"{self.tool.title} - {self.borrower.username} ({self.status})"
    
    @property
    def owner(self):
        """Get the tool owner"""
        return self.tool.owner
    
    @property
    def duration_days(self):
        """Calculate requested duration in days"""
        return (self.requested_end_date - self.requested_start_date).days + 1
    
    @property
    def is_overdue(self):
        """Check if booking is overdue"""
        if self.status == 'active' and self.requested_end_date:
            return timezone.now().date() > self.requested_end_date
        return False
    
    def can_be_confirmed(self):
        """Check if booking can be confirmed"""
        return self.status == 'requested'
    
    def can_be_started(self):
        """Check if booking can be started"""
        return self.status == 'confirmed'
    
    def can_be_returned(self):
        """Check if booking can be returned"""
        return self.status == 'active'
    
    def can_be_cancelled(self):
        """Check if booking can be cancelled"""
        return self.status in ['requested', 'confirmed']
    
    def confirm(self, owner_response=''):
        """Confirm a booking"""
        if self.can_be_confirmed():
            self.status = 'confirmed'
            self.owner_response = owner_response
            self.confirmed_at = timezone.now()
            self.save()
            return True
        return False
    
    def start(self):
        """Start a booking (mark as active)"""
        if self.can_be_started():
            self.status = 'active'
            self.actual_start_date = timezone.now().date()
            self.started_at = timezone.now()
            self.save()
            return True
        return False
    
    def complete(self):
        """Complete a booking (mark as returned)"""
        if self.can_be_returned():
            self.status = 'returned'
            self.actual_end_date = timezone.now().date()
            self.completed_at = timezone.now()
            self.save()
            return True
        return False
    
    def cancel(self):
        """Cancel a booking"""
        if self.can_be_cancelled():
            self.status = 'cancelled'
            self.save()
            return True
        return False


class BookingStatusHistory(models.Model):
    """
    Audit trail for booking status changes
    """
    booking = models.ForeignKey(Booking, on_delete=models.CASCADE, related_name='status_history')
    old_status = models.CharField(max_length=20)
    new_status = models.CharField(max_length=20)
    changed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    changed_at = models.DateTimeField(auto_now_add=True)
    notes = models.TextField(blank=True)
    
    class Meta:
        db_table = 'bookings_status_history'
        ordering = ['-changed_at']
    
    def __str__(self):
        return f"{self.booking} - {self.old_status} → {self.new_status}"
