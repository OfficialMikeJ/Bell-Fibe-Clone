"""
Test Suite for Email-Based Authentication System (Iteration 17)
Tests the new auth model: email + auto-generated 10-char passwords
- Admin login with email and password
- Admin registration with auto-generated password
- Password reset generates new random 10-char password
- Token verification returns email (not username)
- Admin-protected endpoints work with new token
"""

import pytest
import requests
import os
import re

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from /app/memory/test_credentials.md
ADMIN_EMAIL = "admin@streamvault.ca"
ADMIN_PASSWORD = "vubs2V4mzl"
TEST_ADMIN_EMAIL = "test@streamvault.ca"
TEST_ADMIN_PASSWORD = "BXPSzBOvID"


class TestAuthLogin:
    """Test POST /api/auth/login with email-based authentication"""
    
    def test_login_success_with_admin_email(self):
        """Login with valid admin email and password"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "access_token" in data, "Response should contain access_token"
        assert "token_type" in data, "Response should contain token_type"
        assert data["token_type"] == "bearer", "Token type should be 'bearer'"
        assert len(data["access_token"]) > 0, "Access token should not be empty"
        print(f"✓ Admin login successful with email: {ADMIN_EMAIL}")
    
    def test_login_success_with_test_admin_email(self):
        """Login with test admin email and password"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_ADMIN_EMAIL,
            "password": TEST_ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "access_token" in data, "Response should contain access_token"
        print(f"✓ Test admin login successful with email: {TEST_ADMIN_EMAIL}")
    
    def test_login_invalid_email(self):
        """Login with non-existent email should fail"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "nonexistent@example.com",
            "password": "anypassword"
        })
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Login with invalid email correctly rejected")
    
    def test_login_invalid_password(self):
        """Login with wrong password should fail"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": "wrongpassword123"
        })
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Login with invalid password correctly rejected")
    
    def test_login_email_case_insensitive(self):
        """Login should work with different email casing"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL.upper(),
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("✓ Login works with uppercase email (case-insensitive)")


class TestAuthVerify:
    """Test GET /api/auth/verify returns email (not username)"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed - skipping authenticated tests")
    
    def test_verify_returns_email(self, auth_token):
        """Verify endpoint should return email field"""
        response = requests.get(f"{BASE_URL}/api/auth/verify", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "email" in data, "Response should contain 'email' field"
        assert data["email"] == ADMIN_EMAIL, f"Email should be {ADMIN_EMAIL}"
        assert "id" in data, "Response should contain 'id' field"
        assert "two_fa_enabled" in data, "Response should contain 'two_fa_enabled' field"
        
        # Verify username is NOT in response (old system)
        assert "username" not in data, "Response should NOT contain 'username' field (old system)"
        print(f"✓ Verify returns email: {data['email']}")
    
    def test_verify_without_token(self):
        """Verify without token should fail"""
        response = requests.get(f"{BASE_URL}/api/auth/verify")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Verify without token correctly rejected")
    
    def test_verify_with_invalid_token(self):
        """Verify with invalid token should fail"""
        response = requests.get(f"{BASE_URL}/api/auth/verify", headers={
            "Authorization": "Bearer invalid_token_12345"
        })
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Verify with invalid token correctly rejected")


class TestAuthRegister:
    """Test POST /api/auth/register with auto-generated password"""
    
    def test_register_generates_10_char_password(self):
        """Registration should auto-generate a 10-character password"""
        test_email = f"TEST_newadmin_{os.urandom(4).hex()}@example.com"
        
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": test_email
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "email" in data, "Response should contain 'email'"
        assert "password" in data, "Response should contain auto-generated 'password'"
        assert "id" in data, "Response should contain 'id'"
        
        # Verify password is 10 characters
        generated_password = data["password"]
        assert len(generated_password) == 10, f"Password should be 10 chars, got {len(generated_password)}"
        
        # Verify password is alphanumeric
        assert generated_password.isalnum(), "Password should be alphanumeric"
        
        print(f"✓ Registration generated 10-char password: {generated_password}")
        
        # Verify we can login with the generated password
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": test_email,
            "password": generated_password
        })
        assert login_response.status_code == 200, "Should be able to login with generated password"
        print(f"✓ Login with generated password successful")
    
    def test_register_duplicate_email_fails(self):
        """Registration with existing email should fail"""
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": ADMIN_EMAIL
        })
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        
        data = response.json()
        assert "detail" in data, "Response should contain error detail"
        print("✓ Duplicate email registration correctly rejected")


class TestPasswordReset:
    """Test POST /api/auth/password-reset generates new random password"""
    
    def test_password_reset_generates_new_password(self):
        """Password reset should generate a new 10-char random password"""
        # First create a test admin
        test_email = f"TEST_resetadmin_{os.urandom(4).hex()}@example.com"
        
        reg_response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": test_email
        })
        assert reg_response.status_code == 200, f"Registration failed: {reg_response.text}"
        original_password = reg_response.json()["password"]
        
        # Now reset the password
        reset_response = requests.post(f"{BASE_URL}/api/auth/password-reset", json={
            "email": test_email
        })
        assert reset_response.status_code == 200, f"Expected 200, got {reset_response.status_code}: {reset_response.text}"
        
        data = reset_response.json()
        assert "new_password" in data, "Response should contain 'new_password'"
        assert "message" in data, "Response should contain 'message'"
        
        new_password = data["new_password"]
        assert len(new_password) == 10, f"New password should be 10 chars, got {len(new_password)}"
        assert new_password.isalnum(), "New password should be alphanumeric"
        assert new_password != original_password, "New password should be different from original"
        
        print(f"✓ Password reset generated new 10-char password: {new_password}")
        
        # Verify old password no longer works
        old_login = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": test_email,
            "password": original_password
        })
        assert old_login.status_code == 401, "Old password should no longer work"
        print("✓ Old password correctly invalidated")
        
        # Verify new password works
        new_login = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": test_email,
            "password": new_password
        })
        assert new_login.status_code == 200, "New password should work"
        print("✓ New password works for login")
    
    def test_password_reset_nonexistent_email(self):
        """Password reset for non-existent email should fail"""
        response = requests.post(f"{BASE_URL}/api/auth/password-reset", json={
            "email": "nonexistent@example.com"
        })
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Password reset for non-existent email correctly rejected")


class TestProtectedEndpoints:
    """Test that admin-protected endpoints work with new email-based token"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed - skipping authenticated tests")
    
    def test_get_users_with_token(self, auth_token):
        """GET /api/users should work with valid token"""
        response = requests.get(f"{BASE_URL}/api/users", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list of users"
        print(f"✓ GET /api/users works with token, returned {len(data)} users")
    
    def test_get_customers_with_token(self, auth_token):
        """GET /api/customer/admin/all should work with valid token"""
        response = requests.get(f"{BASE_URL}/api/customer/admin/all", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list of customers"
        print(f"✓ GET /api/customer/admin/all works with token, returned {len(data)} customers")
    
    def test_get_users_without_token(self):
        """GET /api/users without token should fail"""
        response = requests.get(f"{BASE_URL}/api/users")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ GET /api/users without token correctly rejected")
    
    def test_get_setup_config(self, auth_token):
        """GET /api/setup/config should work (public endpoint)"""
        response = requests.get(f"{BASE_URL}/api/setup/config")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("✓ GET /api/setup/config works")


class TestSecurityUtilsPasswordGeneration:
    """Test that password generation produces valid 10-char alphanumeric passwords"""
    
    def test_multiple_registrations_unique_passwords(self):
        """Multiple registrations should generate unique passwords"""
        passwords = []
        for i in range(3):
            test_email = f"TEST_unique_{i}_{os.urandom(4).hex()}@example.com"
            response = requests.post(f"{BASE_URL}/api/auth/register", json={
                "email": test_email
            })
            if response.status_code == 200:
                passwords.append(response.json()["password"])
        
        # All passwords should be unique
        assert len(passwords) == len(set(passwords)), "All generated passwords should be unique"
        print(f"✓ Generated {len(passwords)} unique passwords")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
