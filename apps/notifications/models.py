from django.db import models
from django.contrib.auth import get_user_model
from django.contrib.contenttypes.models import ContentType
from django.contrib.contenttypes.fields import GenericForeignKey
import uuid

User = get_user_model()


class Notification(models.Model):
    """
    In-app notification system
    """
    NOTIFICATION_TYPES = [
        ('booking_request', 'Booking Request'),
        ('booking_confirmed', 'Booking Confirmed'),
        ('booking_declined', 'Booking Declined'),
        ('booking_started', 'Booking Started'),
        ('booking_completed', 'Booking Completed'),
        ('booking_cancelled', 'Booking Cancelled'),
        ('review_received', 'Review Received'),
        ('tool_available', 'Tool Available'),
        ('system', 'System Notification'),
    ]
    
    # Basic information
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    recipient = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    sender = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True, related_name='sent_notifications')
    
    # Notification content
    notification_type = models.CharField(max_length=20, choices=NOTIFICATION_TYPES)
    title = models.CharField(max_length=200)
    message = models.TextField(max_length=500)
    
    # Generic foreign key to link to any model
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE, null=True, blank=True)
    object_id = models.UUIDField(null=True, blank=True)
    content_object = GenericForeignKey('content_type', 'object_id')
    
    # Status
    is_read = models.BooleanField(default=False)
    is_email_sent = models.BooleanField(default=False)
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    read_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        db_table = 'notifications_notification'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['recipient', 'is_read']),
            models.Index(fields=['notification_type']),
            models.Index(fields=['created_at']),
        ]
    
    def __str__(self):
        return f"{self.title} - {self.recipient.username}"
    
    def mark_as_read(self):
        """Mark notification as read"""
        if not self.is_read:
            self.is_read = True
            self.read_at = models.functions.Now()
            self.save(update_fields=['is_read', 'read_at'])
    
    @classmethod
    def create_booking_notification(cls, booking, notification_type, recipient):
        """Create a booking-related notification"""
        type_messages = {
            'booking_request': f"New booking request for your {booking.tool.title}",
            'booking_confirmed': f"Your booking request for {booking.tool.title} was confirmed",
            'booking_declined': f"Your booking request for {booking.tool.title} was declined",
            'booking_started': f"Booking for {booking.tool.title} has started",
            'booking_completed': f"Booking for {booking.tool.title} has been completed",
            'booking_cancelled': f"Booking for {booking.tool.title} was cancelled",
        }
        
        sender = None
        if notification_type == 'booking_request':
            sender = booking.borrower
        elif notification_type in ['booking_confirmed', 'booking_declined']:
            sender = booking.tool.owner
        
        return cls.objects.create(
            recipient=recipient,
            sender=sender,
            notification_type=notification_type,
            title=type_messages.get(notification_type, 'Booking Update'),
            message=type_messages.get(notification_type, 'Your booking status has changed'),
            content_object=booking
        )
    
    @classmethod
    def create_review_notification(cls, review):
        """Create a review notification"""
        return cls.objects.create(
            recipient=review.reviewee,
            sender=review.reviewer,
            notification_type='review_received',
            title=f"New {review.rating}-star review received",
            message=f"You received a {review.rating}-star review from {review.reviewer.get_full_name() or review.reviewer.username}",
            content_object=review
        )


class EmailNotificationLog(models.Model):
    """
    Log of email notifications sent
    """
    notification = models.OneToOneField(Notification, on_delete=models.CASCADE, related_name='email_log')
    email_address = models.EmailField()
    sent_at = models.DateTimeField(auto_now_add=True)
    success = models.BooleanField(default=False)
    error_message = models.TextField(blank=True)
    
    class Meta:
        db_table = 'notifications_email_log'
        ordering = ['-sent_at']
    
    def __str__(self):
        status = "✓" if self.success else "✗"
        return f"{status} {self.email_address} - {self.notification.title}"
