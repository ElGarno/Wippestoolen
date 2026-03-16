#!/usr/bin/env python3
"""Test tool creation endpoint."""

import httpx
import json

# Production URL
BASE_URL = "https://api.wippestoolen.de"

def test_tool_creation():
    """Test creating a tool."""
    
    # First, we need to login
    print("Logging in...")
    
    # Test credentials - you may need to replace these
    login_data = {
        "username": "test@example.com",  # Replace with actual test account
        "password": "TestPassword123!"   # Replace with actual password
    }
    
    with httpx.Client(timeout=30.0) as client:
        # Login
        response = client.post(
            f"{BASE_URL}/api/v1/auth/login",
            data=login_data
        )
        
        if response.status_code != 200:
            print(f"Login failed: {response.status_code}")
            print(f"Response: {response.text}")
            return
        
        token_data = response.json()
        access_token = token_data['access_token']
        print(f"Login successful, token: {access_token[:20]}...")
        
        # Get categories first
        headers = {"Authorization": f"Bearer {access_token}"}
        response = client.get(f"{BASE_URL}/api/v1/tools/categories", headers=headers)
        
        if response.status_code == 200:
            categories = response.json()
            print(f"Available categories: {json.dumps(categories, indent=2)}")
            
            if categories:
                category_id = categories[0]['id']
            else:
                print("No categories available!")
                return
        else:
            print(f"Failed to get categories: {response.status_code}")
            print(f"Response: {response.text}")
            category_id = 1  # Default to 1
        
        # Create a tool
        tool_data = {
            "title": "Test Hammer",
            "description": "A test hammer for testing",
            "category_id": category_id,
            "brand": "TestBrand",
            "model": "TH-100",
            "condition": "good",
            "max_loan_days": 7,
            "deposit_amount": 10.00,
            "daily_rate": 5.00,
            "pickup_address": "Test Street 123",
            "pickup_city": "Berlin",
            "pickup_postal_code": "10115",
            "pickup_latitude": 52.520008,
            "pickup_longitude": 13.404954,
            "delivery_available": False,
            "delivery_radius_km": 0,
            "usage_instructions": "Use carefully",
            "safety_notes": "Wear safety goggles"
        }
        
        print(f"\nCreating tool with data:")
        print(json.dumps(tool_data, indent=2))
        
        response = client.post(
            f"{BASE_URL}/api/v1/tools",
            json=tool_data,
            headers=headers
        )
        
        print(f"\nResponse status: {response.status_code}")
        print(f"Response headers: {dict(response.headers)}")
        print(f"Response body: {response.text}")
        
        if response.status_code == 201:
            print("\n✅ Tool created successfully!")
            print(json.dumps(response.json(), indent=2))
        else:
            print(f"\n❌ Tool creation failed!")
            print(f"Status: {response.status_code}")
            print(f"Error: {response.text}")

if __name__ == "__main__":
    test_tool_creation()