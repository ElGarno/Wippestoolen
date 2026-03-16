import pytest
from fastapi.testclient import TestClient

from wippestoolen.app.core.security import verify_password
from wippestoolen.app.models.user import User

def test_register_user(client: TestClient):
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": "newuser@example.com",
            "username": "newuser",
            "display_name": "newuser",
            "password": "SecurePassword123",
            "full_name": "New User",
            "location": "New York",
            "phone": "+1234567890"
        }
    )
    print(f"Response status: {response.status_code}")
    print(f"Response: {response.json() if response.status_code != 500 else response.text}")
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "newuser@example.com"
    assert data["username"] == "newuser"
    assert "id" in data
    assert "password" not in data
    assert "hashed_password" not in data

def test_register_duplicate_email(client: TestClient, test_user):
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": test_user.email,
            "username": "anotheruser",
            "display_name": "anotheruser",
            "password": "Password123",
            "full_name": "Another User",
            "location": "Location"
        }
    )
    assert response.status_code == 400
    assert "already registered" in response.json()["detail"].lower()

def test_register_duplicate_username(client: TestClient, test_user):
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": "another@example.com",
            "username": test_user.username,
            "display_name": test_user.username,
            "password": "Password123",
            "full_name": "Another User",
            "location": "Location"
        }
    )
    assert response.status_code == 400
    assert "username already taken" in response.json()["detail"].lower()

def test_login_success(client: TestClient, test_user):
    response = client.post(
        "/api/v1/auth/login",
        data={
            "username": test_user.email,
            "password": "testpassword123"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"

def test_login_with_username(client: TestClient, test_user):
    response = client.post(
        "/api/v1/auth/login",
        data={
            "username": test_user.display_name,
            "password": "testpassword123"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data

def test_login_wrong_password(client: TestClient, test_user):
    response = client.post(
        "/api/v1/auth/login",
        data={
            "username": test_user.email,
            "password": "wrongpassword"
        }
    )
    assert response.status_code == 401
    assert "incorrect" in response.json()["detail"].lower()

def test_login_nonexistent_user(client: TestClient):
    response = client.post(
        "/api/v1/auth/login",
        data={
            "username": "nonexistent@example.com",
            "password": "password123"
        }
    )
    assert response.status_code == 401

def test_get_current_user(client: TestClient, test_user, auth_headers):
    response = client.get("/api/v1/auth/me", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == test_user.email
    assert data["display_name"] == test_user.display_name
    assert data["id"] == str(test_user.id)

def test_get_current_user_unauthorized(client: TestClient):
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 401

def test_update_profile(client: TestClient, auth_headers):
    response = client.patch(
        "/api/v1/auth/me",
        headers=auth_headers,
        json={
            "full_name": "Updated Name",
            "bio": "Updated bio",
            "location": "Updated Location"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["full_name"] == "Updated Name"
    assert data["bio"] == "Updated bio"
    assert data["location"] == "Updated Location"

def test_logout(client: TestClient, auth_headers):
    response = client.post("/api/v1/auth/logout", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["message"] == "Logged out successfully"