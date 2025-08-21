#!/usr/bin/env python
"""Create sample data for Wippestoolen"""

import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'wippestoolen.settings.development')
django.setup()

from django.contrib.auth import get_user_model
from apps.tools.models import Tool, ToolCategory
from apps.accounts.models import Profile

User = get_user_model()

def create_sample_data():
    print("Creating sample data...")
    
    # Create tool categories
    categories = [
        {'name': 'Power Tools', 'slug': 'power-tools', 'description': 'Electric and battery-powered tools'},
        {'name': 'Hand Tools', 'slug': 'hand-tools', 'description': 'Manual tools'},
        {'name': 'Garden Tools', 'slug': 'garden-tools', 'description': 'Tools for gardening and landscaping'},
        {'name': 'Specialty Tools', 'slug': 'specialty-tools', 'description': 'Specialized equipment'},
    ]
    
    for cat_data in categories:
        category, created = ToolCategory.objects.get_or_create(
            slug=cat_data['slug'],
            defaults=cat_data
        )
        if created:
            print(f"Created category: {category.name}")
    
    # Create sample users
    users_data = [
        {'username': 'john_doe', 'email': 'john@example.com', 'password': 'testpass123'},
        {'username': 'jane_smith', 'email': 'jane@example.com', 'password': 'testpass123'},
        {'username': 'bob_builder', 'email': 'bob@example.com', 'password': 'testpass123'},
    ]
    
    for user_data in users_data:
        user, created = User.objects.get_or_create(
            email=user_data['email'],
            defaults={
                'username': user_data['username'],
                'email': user_data['email'],
            }
        )
        if created:
            user.set_password(user_data['password'])
            user.save()
            
            # Create profile
            Profile.objects.create(
                user=user,
                display_name=user_data['username'].replace('_', ' ').title(),
                latitude=40.7128,
                longitude=-74.0060,
                address='New York, NY',
                total_ratings=5,
                rating_sum=22,
            )
            print(f"Created user: {user.username}")
    
    # Create sample tools
    power_tools = ToolCategory.objects.get(slug='power-tools')
    garden_tools = ToolCategory.objects.get(slug='garden-tools')
    hand_tools = ToolCategory.objects.get(slug='hand-tools')
    
    john = User.objects.get(username='john_doe')
    jane = User.objects.get(username='jane_smith')
    bob = User.objects.get(username='bob_builder')
    
    tools_data = [
        {
            'owner': john,
            'title': 'DeWalt Cordless Drill',
            'category': power_tools,
            'manufacturer': 'DeWalt',
            'model': 'DCD791D2',
            'condition': 'excellent',
            'manual_description': '20V MAX cordless drill with 2 batteries and charger. Perfect for home projects.',
            'latitude': 40.7128,
            'longitude': -74.0060,
            'address': '123 Main St, New York, NY',
            'max_loan_days': 7,
            'deposit_amount': 50.00,
        },
        {
            'owner': jane,
            'title': 'Extension Ladder 24ft',
            'category': hand_tools,
            'manufacturer': 'Werner',
            'model': 'D1224-2',
            'condition': 'good',
            'manual_description': 'Aluminum extension ladder, extends up to 24 feet. Great for gutter cleaning and painting.',
            'latitude': 40.7200,
            'longitude': -74.0100,
            'address': '456 Oak Ave, New York, NY',
            'max_loan_days': 3,
        },
        {
            'owner': bob,
            'title': 'Electric Lawn Mower',
            'category': garden_tools,
            'manufacturer': 'Greenworks',
            'model': '25022',
            'condition': 'good',
            'manual_description': '12 Amp 20-Inch electric lawn mower. Quiet and eco-friendly.',
            'latitude': 40.7050,
            'longitude': -74.0150,
            'address': '789 Pine St, New York, NY',
            'max_loan_days': 1,
        },
    ]
    
    for tool_data in tools_data:
        tool, created = Tool.objects.get_or_create(
            title=tool_data['title'],
            owner=tool_data['owner'],
            defaults=tool_data
        )
        if created:
            print(f"Created tool: {tool.title}")
    
    print("\nSample data created successfully!")
    print("\nYou can now login with:")
    print("Email: john@example.com, Password: testpass123")
    print("Email: jane@example.com, Password: testpass123")
    print("Email: bob@example.com, Password: testpass123")

if __name__ == '__main__':
    create_sample_data()