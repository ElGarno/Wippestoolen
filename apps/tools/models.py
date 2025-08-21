from django.db import models
from django.contrib.auth import get_user_model
from django.core.validators import MinValueValidator, MaxValueValidator
from django.urls import reverse
import uuid

User = get_user_model()


class ToolCategory(models.Model):
    """
    Categories for tools (Power Tools, Hand Tools, Garden Tools, etc.)
    """
    name = models.CharField(max_length=100, unique=True)
    slug = models.SlugField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    icon = models.CharField(max_length=50, blank=True, help_text="Font Awesome icon class")
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'tools_category'
        verbose_name_plural = 'Tool Categories'
        ordering = ['name']
    
    def __str__(self):
        return self.name


def tool_image_path(instance, filename):
    """Generate upload path for tool images"""
    return f'tools/{instance.tool.id}/{filename}'


class Tool(models.Model):
    """
    Main tool model with geospatial and AI-generated description support
    """
    # Basic information
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='owned_tools')
    title = models.CharField(max_length=200)
    category = models.ForeignKey(ToolCategory, on_delete=models.SET_NULL, null=True, blank=True)
    
    # AI-enhanced description (JSON field)
    description = models.JSONField(default=dict, help_text="AI-generated structured description")
    manual_description = models.TextField(blank=True, help_text="Manual description override")
    
    # Tool details
    manufacturer = models.CharField(max_length=100, blank=True)
    model = models.CharField(max_length=100, blank=True)
    year_purchased = models.PositiveIntegerField(null=True, blank=True)
    condition = models.CharField(
        max_length=20,
        choices=[
            ('excellent', 'Excellent'),
            ('good', 'Good'),
            ('fair', 'Fair'),
            ('poor', 'Poor'),
        ],
        default='good'
    )
    
    # Location
    latitude = models.FloatField(help_text="Tool's latitude")
    longitude = models.FloatField(help_text="Tool's longitude")
    address = models.CharField(max_length=255, help_text="Human-readable address")
    
    # Availability
    is_available = models.BooleanField(default=True)
    max_loan_days = models.PositiveIntegerField(default=7, validators=[MinValueValidator(1)])
    deposit_amount = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    
    # AI processing flags
    ai_description_generated = models.BooleanField(default=False)
    ai_processing_status = models.CharField(
        max_length=20,
        choices=[
            ('pending', 'Pending'),
            ('processing', 'Processing'),
            ('completed', 'Completed'),
            ('failed', 'Failed'),
        ],
        default='pending'
    )
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'tools_tool'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['is_available']),
            models.Index(fields=['category']),
            models.Index(fields=['owner']),
        ]
    
    def __str__(self):
        return f"{self.title} - {self.owner.username}"
    
    def get_absolute_url(self):
        return reverse('tools:detail', kwargs={'pk': self.pk})
    
    @property
    def main_photo(self):
        """Get the first photo or None"""
        return self.photos.first()
    
    def get_description_text(self):
        """Get description text, preferring manual over AI-generated"""
        if self.manual_description:
            return self.manual_description
        
        if isinstance(self.description, dict) and 'description' in self.description:
            return self.description.get('description', '')
        
        return ''
    
    def get_features_list(self):
        """Get features from AI description"""
        if isinstance(self.description, dict):
            return self.description.get('features', [])
        return []


class ToolPhoto(models.Model):
    """
    Photos for tools - supports multiple images per tool
    """
    tool = models.ForeignKey(Tool, on_delete=models.CASCADE, related_name='photos')
    image = models.ImageField(upload_to=tool_image_path)
    caption = models.CharField(max_length=255, blank=True)
    is_primary = models.BooleanField(default=False)
    
    # AI analysis results
    ai_analyzed = models.BooleanField(default=False)
    ai_tags = models.JSONField(default=list, blank=True)
    
    uploaded_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'tools_photo'
        ordering = ['-is_primary', 'uploaded_at']
    
    def __str__(self):
        return f"Photo for {self.tool.title}"
    
    def save(self, *args, **kwargs):
        # Ensure only one primary photo per tool
        if self.is_primary:
            ToolPhoto.objects.filter(tool=self.tool, is_primary=True).update(is_primary=False)
        super().save(*args, **kwargs)
