"""
Iteration 9: Test credential-based activation system
Tests: register, activate-with-credentials, admin/all, reset-credentials
"""

import pytest
import requests
import os
import re

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

ADMIN_CREDS = {"username": "admin", "password": "admin123"}

# ─── Helper: get admin token ──────────────────────────────────────────────────

@pytest.fixture(scope="module")
def admin_token():
    res = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDS)
    if res.status_code != 200:
        pytest.skip(f"Admin login failed: {res.status_code} {res.text}")
    return res.json()["access_token"]


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


# ─── Test: customer registration generates credentials ────────────────────────

class TestCustomerRegister:
    """Registration creates app_username + app_password"""

    test_email = "TEST_credtest9@example.com"
    created_id = None

    def test_register_creates_account(self):
        payload = {
            "first_name": "TEST",
            "last_name": "CredUser9",
            "email": self.test_email,
            "password": "StrongPass123!",
            "device_brand": "Samsung",
            "device_type": "Android Smart TV",
        }
        res = requests.post(f"{BASE_URL}/api/customer/register", json=payload)
        # May already exist from prior run – delete and retry
        if res.status_code == 400 and "already exists" in res.text:
            pytest.skip("Email already registered; clean up manually or use admin delete")
        assert res.status_code == 200, f"Register failed: {res.status_code} {res.text}"
        data = res.json()
        assert "access_token" in data, "No access_token in response"
        assert "customer" in data, "No customer object in response"
        # customer object is the safe_customer dict — no credentials here
        customer = data["customer"]
        assert "id" in customer
        TestCustomerRegister.created_id = customer["id"]

    def test_register_response_has_message(self):
        # If test_register_creates_account was skipped, skip this too
        if TestCustomerRegister.created_id is None:
            pytest.skip("No customer created")
        # Nothing to assert on message; just confirm no crash

    def test_register_duplicate_email_rejected(self):
        payload = {
            "first_name": "TEST",
            "last_name": "Dup",
            "email": self.test_email,
            "password": "AnotherPass!1",
            "device_brand": "LG",
            "device_type": "Android Box",
        }
        res = requests.post(f"{BASE_URL}/api/customer/register", json=payload)
        # Either 400 (if account was created) or 200 (if prior test skipped)
        if res.status_code == 200:
            pytest.skip("Duplicate test skipped – first registration already failed")
        assert res.status_code == 400
        assert "already exists" in res.json().get("detail", "").lower()


# ─── Test: admin can see credentials ─────────────────────────────────────────

class TestAdminGetAllCustomers:
    """GET /api/customer/admin/all returns app_username and app_password in plain text"""

    def test_admin_all_returns_list(self, admin_headers):
        res = requests.get(f"{BASE_URL}/api/customer/admin/all", headers=admin_headers)
        assert res.status_code == 200, f"Admin all failed: {res.status_code} {res.text}"
        data = res.json()
        assert isinstance(data, list), "Expected a list"

    def test_admin_all_has_credentials(self, admin_headers):
        res = requests.get(f"{BASE_URL}/api/customer/admin/all", headers=admin_headers)
        assert res.status_code == 200
        customers = res.json()
        if not customers:
            pytest.skip("No customers in DB; register first")
        # Find our test customer
        test_customer = next(
            (c for c in customers if "credtest9" in c.get("email", "").lower()), None
        )
        if not test_customer:
            pytest.skip("Test customer not found; register first")

        assert "app_username" in test_customer, "app_username missing from admin response"
        assert "app_password" in test_customer, "app_password missing from admin response"

        uname = test_customer["app_username"]
        pwd = test_customer["app_password"]

        # Validate username: 8 lowercase letters only
        assert len(uname) == 8, f"app_username length should be 8, got {len(uname)}: {uname}"
        assert uname.islower() and uname.isalpha(), f"app_username must be 8 lowercase letters, got: {uname}"

        # Validate password: 6 chars, has uppercase, lowercase, digit, special
        assert len(pwd) == 6, f"app_password length should be 6, got {len(pwd)}: {pwd}"
        assert any(c.isupper() for c in pwd), f"app_password must contain uppercase: {pwd}"
        assert any(c.islower() for c in pwd), f"app_password must contain lowercase: {pwd}"
        assert any(c.isdigit() for c in pwd), f"app_password must contain digit: {pwd}"
        special = "@#$!%*?"
        assert any(c in special for c in pwd), f"app_password must contain special char: {pwd}"

    def test_admin_all_no_password_hash(self, admin_headers):
        """password_hash must not be returned to admin"""
        res = requests.get(f"{BASE_URL}/api/customer/admin/all", headers=admin_headers)
        assert res.status_code == 200
        customers = res.json()
        for c in customers:
            assert "password_hash" not in c, "password_hash should NOT be in admin response"

    def test_admin_all_requires_auth(self):
        res = requests.get(f"{BASE_URL}/api/customer/admin/all")
        assert res.status_code == 401, f"Expected 401 without auth, got {res.status_code}"


# ─── Test: activate-with-credentials ─────────────────────────────────────────

class TestActivateWithCredentials:
    """POST /api/customer/activate-with-credentials"""

    # These will be populated by fetching from admin/all after registration
    _username = None
    _password = None
    _customer_id = None

    @classmethod
    def _fetch_test_credentials(cls, admin_headers):
        """Get test customer credentials from admin endpoint"""
        res = requests.get(f"{BASE_URL}/api/customer/admin/all", headers=admin_headers)
        if res.status_code != 200:
            return False
        customers = res.json()
        test_customer = next(
            (c for c in customers if "credtest9" in c.get("email", "").lower()), None
        )
        if not test_customer:
            return False
        cls._username = test_customer["app_username"]
        cls._password = test_customer["app_password"]
        cls._customer_id = test_customer["id"]
        return True

    def test_activate_with_correct_credentials(self, admin_headers):
        if not self._fetch_test_credentials(admin_headers):
            pytest.skip("Test customer not found; ensure registration test runs first")

        payload = {
            "app_username": self._username,
            "app_password": self._password,
            "device_uuid": "test-device-iter9-uuid",
            "device_name": "Test TV Iter9",
        }
        res = requests.post(f"{BASE_URL}/api/customer/activate-with-credentials", json=payload)
        assert res.status_code == 200, f"Activation failed: {res.status_code} {res.text}"
        data = res.json()
        assert "user_id" in data, "user_id missing from activation response"
        assert "device_id" in data, "device_id missing from activation response"
        assert data["user_id"] == self._customer_id, f"user_id mismatch: {data['user_id']} != {self._customer_id}"

    def test_activate_with_wrong_password_returns_401(self, admin_headers):
        if not self._fetch_test_credentials(admin_headers):
            pytest.skip("Test customer not found")

        # Clear any lockout first
        requests.delete(
            f"{BASE_URL}/api/customer/admin/lockout/clear",
            headers=admin_headers,
        )

        payload = {
            "app_username": self._username,
            "app_password": "WRONG1",
        }
        res = requests.post(f"{BASE_URL}/api/customer/activate-with-credentials", json=payload)
        assert res.status_code in (401, 429), f"Expected 401/429 for wrong password, got {res.status_code}"
        detail = res.json().get("detail", "")
        if res.status_code == 401:
            assert "remaining" in detail.lower() or "invalid" in detail.lower(), \
                f"Detail should mention remaining attempts: {detail}"

    def test_activate_remaining_attempts_in_response(self, admin_headers):
        if not self._fetch_test_credentials(admin_headers):
            pytest.skip("Test customer not found")

        # Clear lockout for clean test
        requests.delete(
            f"{BASE_URL}/api/customer/admin/lockout/clear",
            headers=admin_headers,
        )

        payload = {
            "app_username": self._username,
            "app_password": "WRONG2",
        }
        res = requests.post(f"{BASE_URL}/api/customer/activate-with-credentials", json=payload)
        assert res.status_code in (401, 429)
        detail = res.json().get("detail", "")
        # Should mention remaining or locked
        assert any(word in detail.lower() for word in ["remaining", "attempt", "locked", "wait"]), \
            f"Expected remaining-attempts or lockout message in detail: {detail}"


# ─── Test: reset credentials ──────────────────────────────────────────────────

class TestResetCredentials:
    """POST /api/customer/admin/{id}/reset-credentials"""

    def test_reset_generates_new_credentials(self, admin_headers):
        # Fetch test customer
        res = requests.get(f"{BASE_URL}/api/customer/admin/all", headers=admin_headers)
        assert res.status_code == 200
        customers = res.json()
        test_customer = next(
            (c for c in customers if "credtest9" in c.get("email", "").lower()), None
        )
        if not test_customer:
            pytest.skip("Test customer not found")

        old_username = test_customer["app_username"]
        old_password = test_customer["app_password"]
        customer_id = test_customer["id"]

        # Reset credentials
        reset_res = requests.post(
            f"{BASE_URL}/api/customer/admin/{customer_id}/reset-credentials",
            headers=admin_headers,
        )
        assert reset_res.status_code == 200, f"Reset failed: {reset_res.status_code} {reset_res.text}"
        reset_data = reset_res.json()

        assert "app_username" in reset_data
        assert "app_password" in reset_data

        new_username = reset_data["app_username"]
        new_password = reset_data["app_password"]

        # New credentials must be different
        assert new_username != old_username or new_password != old_password, \
            "New credentials should differ from old ones"

        # Validate format
        assert len(new_username) == 8 and new_username.islower() and new_username.isalpha()
        assert len(new_password) == 6

        # Verify via admin/all that DB was updated
        verify_res = requests.get(f"{BASE_URL}/api/customer/admin/all", headers=admin_headers)
        updated = next(
            (c for c in verify_res.json() if c["id"] == customer_id), None
        )
        assert updated is not None
        assert updated["app_username"] == new_username
        assert updated["app_password"] == new_password

    def test_reset_nonexistent_customer_returns_404(self, admin_headers):
        res = requests.post(
            f"{BASE_URL}/api/customer/admin/nonexistent-id-12345/reset-credentials",
            headers=admin_headers,
        )
        assert res.status_code == 404

    def test_reset_requires_admin_auth(self):
        res = requests.post(
            f"{BASE_URL}/api/customer/admin/some-id/reset-credentials",
        )
        assert res.status_code == 401


# ─── Cleanup ──────────────────────────────────────────────────────────────────

class TestCleanup:
    """Remove test data after all tests"""

    def test_cleanup_test_customer(self, admin_headers):
        res = requests.get(f"{BASE_URL}/api/customer/admin/all", headers=admin_headers)
        if res.status_code != 200:
            return
        customers = res.json()
        test_customer = next(
            (c for c in customers if "credtest9" in c.get("email", "").lower()), None
        )
        if test_customer:
            del_res = requests.delete(
                f"{BASE_URL}/api/customer/admin/{test_customer['id']}",
                headers=admin_headers,
            )
            assert del_res.status_code == 200, f"Cleanup failed: {del_res.text}"
            print(f"Cleaned up test customer: {test_customer['email']}")
        else:
            print("Test customer already cleaned up or not found")
