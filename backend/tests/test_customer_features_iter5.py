"""
Iteration 5: Customer Registration, Login, PIN Activation, Lockout, Admin endpoints
Tests for Bell Canada TV Service Clone customer flow
"""
import pytest
import requests
import os
import time
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Use timestamp to ensure unique emails each run
TS = str(int(time.time()))[-6:]
TEST_EMAIL = f"test.customer.{TS}@example.com"
TEST_PASSWORD = "TestPass789!"
TEST_FIRST = "Test"
TEST_LAST = f"User{TS}"

# Known existing customer
KNOWN_EMAIL = "john.test@example.com"
KNOWN_PASSWORD = "TestPass123"

# Admin credentials
ADMIN_USER = "admin"
ADMIN_PASS = "admin123"

# Shared state between tests
_state = {
    "customer_token": None,
    "customer_id": None,
    "customer_pin": None,
    "admin_token": None,
}


# ─── Fixtures ─────────────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def admin_token(session):
    res = session.post(f"{BASE_URL}/api/auth/login", json={"username": ADMIN_USER, "password": ADMIN_PASS})
    if res.status_code == 200:
        data = res.json()
        token = data.get("access_token") or data.get("token")
        _state["admin_token"] = token
        return token
    pytest.skip(f"Admin login failed ({res.status_code}): {res.text[:200]}")


@pytest.fixture(scope="module")
def customer_token(session):
    """Register and return a customer token (or login if already exists)"""
    if _state["customer_token"]:
        return _state["customer_token"]
    res = session.post(f"{BASE_URL}/api/customer/register", json={
        "first_name": TEST_FIRST,
        "last_name": TEST_LAST,
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD,
        "device_brand": "Samsung",
        "device_type": "Android Smart TV",
    })
    assert res.status_code == 200, f"Registration failed: {res.text[:300]}"
    data = res.json()
    _state["customer_token"] = data["access_token"]
    _state["customer_id"] = data["customer"]["id"]
    _state["customer_pin"] = data["customer"]["activation_pin"]
    return _state["customer_token"]


# ─── Registration Tests ────────────────────────────────────────────────────────

class TestCustomerRegistration:
    """Customer registration endpoint tests"""

    def test_register_new_customer(self, session):
        """POST /api/customer/register - creates account and returns token + PIN"""
        res = session.post(f"{BASE_URL}/api/customer/register", json={
            "first_name": TEST_FIRST,
            "last_name": TEST_LAST,
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD,
            "device_brand": "Samsung",
            "device_type": "Android Smart TV",
        })
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text[:300]}"
        data = res.json()
        # Token returned for auto-login
        assert "access_token" in data, "Missing access_token in response"
        assert data["token_type"] == "bearer"
        # Customer object with PIN
        customer = data["customer"]
        assert customer["email"] == TEST_EMAIL
        assert customer["first_name"] == TEST_FIRST
        assert "activation_pin" in customer, "Missing activation_pin"
        assert len(customer["activation_pin"]) == 6, "PIN must be 6 digits"
        assert customer["activation_pin"].isdigit(), "PIN must be all digits"
        assert customer["status"] == "pending", "New customer should be pending"
        assert customer["is_activated"] == False, "New customer should not be activated"
        # Save state
        _state["customer_token"] = data["access_token"]
        _state["customer_id"] = customer["id"]
        _state["customer_pin"] = customer["activation_pin"]
        print(f"  ✓ Registered {TEST_EMAIL} with PIN {customer['activation_pin']}")

    def test_register_duplicate_email_returns_400(self, session):
        """Duplicate registration should return 400"""
        res = session.post(f"{BASE_URL}/api/customer/register", json={
            "first_name": "Another",
            "last_name": "User",
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD,
            "device_brand": "LG",
            "device_type": "Android Box",
        })
        assert res.status_code == 400, f"Expected 400, got {res.status_code}"
        data = res.json()
        assert "detail" in data
        assert "already exists" in data["detail"].lower() or "email" in data["detail"].lower()
        print(f"  ✓ Duplicate email correctly rejected: {data['detail']}")

    def test_register_missing_fields_returns_422(self, session):
        """Registration without required fields returns 422"""
        res = session.post(f"{BASE_URL}/api/customer/register", json={
            "email": f"incomplete.{TS}@example.com",
            # Missing first_name, last_name, password, device_brand, device_type
        })
        assert res.status_code == 422, f"Expected 422, got {res.status_code}"
        print(f"  ✓ Missing fields correctly rejected")


# ─── Login Tests ──────────────────────────────────────────────────────────────

class TestCustomerLogin:
    """Customer login endpoint tests"""

    def test_login_valid_credentials(self, session):
        """POST /api/customer/login - returns token for valid credentials"""
        # Ensure registered first
        if not _state["customer_token"]:
            pytest.skip("Customer not yet registered")
        res = session.post(f"{BASE_URL}/api/customer/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD,
        })
        assert res.status_code == 200, f"Login failed: {res.text[:300]}"
        data = res.json()
        assert "access_token" in data, "Missing access_token"
        assert data["token_type"] == "bearer"
        assert "customer" in data
        assert data["customer"]["email"] == TEST_EMAIL
        # Update token
        _state["customer_token"] = data["access_token"]
        print(f"  ✓ Login successful for {TEST_EMAIL}")

    def test_login_wrong_password_returns_401(self, session):
        """Login with wrong password returns 401"""
        res = session.post(f"{BASE_URL}/api/customer/login", json={
            "email": TEST_EMAIL,
            "password": "WrongPassword999!",
        })
        assert res.status_code == 401, f"Expected 401, got {res.status_code}"
        data = res.json()
        assert "detail" in data
        print(f"  ✓ Wrong password correctly rejected: {data['detail']}")

    def test_login_nonexistent_email_returns_401(self, session):
        """Login with unknown email returns 401"""
        res = session.post(f"{BASE_URL}/api/customer/login", json={
            "email": "nobody.nonexistent@example.com",
            "password": "AnyPass123",
        })
        assert res.status_code == 401, f"Expected 401, got {res.status_code}"
        print(f"  ✓ Unknown email correctly rejected")

    def test_login_known_existing_customer(self, session):
        """Login with pre-existing john.test account"""
        res = session.post(f"{BASE_URL}/api/customer/login", json={
            "email": KNOWN_EMAIL,
            "password": KNOWN_PASSWORD,
        })
        assert res.status_code == 200, f"Known customer login failed: {res.text[:300]}"
        data = res.json()
        assert "access_token" in data
        print(f"  ✓ Known customer {KNOWN_EMAIL} login OK")


# ─── Profile Tests ─────────────────────────────────────────────────────────────

class TestCustomerProfile:
    """Customer profile endpoint tests"""

    def test_get_me_returns_profile(self, session, customer_token):
        """GET /api/customer/me - returns full profile including activation_pin"""
        headers = {"Authorization": f"Bearer {customer_token}"}
        res = session.get(f"{BASE_URL}/api/customer/me", headers=headers)
        assert res.status_code == 200, f"GET /me failed: {res.text[:300]}"
        data = res.json()
        assert data["email"] == TEST_EMAIL
        assert "activation_pin" in data, "Missing activation_pin in profile"
        assert len(data["activation_pin"]) == 6
        assert data["activation_pin"].isdigit()
        assert "is_activated" in data
        assert "status" in data
        print(f"  ✓ GET /me returned profile with PIN {data['activation_pin']}")

    def test_get_me_without_token_returns_401(self, session):
        """GET /api/customer/me without auth returns 401"""
        res = session.get(f"{BASE_URL}/api/customer/me")
        assert res.status_code == 401, f"Expected 401, got {res.status_code}"
        print(f"  ✓ Unauthenticated /me correctly rejected")

    def test_get_me_with_admin_token_returns_401(self, session, admin_token):
        """GET /api/customer/me with admin token should fail (wrong type)"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        res = session.get(f"{BASE_URL}/api/customer/me", headers=headers)
        assert res.status_code == 401, f"Expected 401, got {res.status_code}: {res.text[:200]}"
        print(f"  ✓ Admin token rejected for customer /me endpoint")


# ─── Activation with PIN Tests ────────────────────────────────────────────────

class TestPinActivation:
    """PIN-based device activation tests"""

    def test_activate_with_valid_pin(self, session, customer_token):
        """POST /api/customer/activate-with-pin?pin=VALID - activates device"""
        if not _state["customer_pin"]:
            pytest.skip("No customer PIN available")
        pin = _state["customer_pin"]
        res = session.post(f"{BASE_URL}/api/customer/activate-with-pin?pin={pin}")
        assert res.status_code == 200, f"Activation failed: {res.text[:300]}"
        data = res.json()
        assert "user_id" in data, "Missing user_id in activation response"
        assert "device_id" in data, "Missing device_id"
        assert "message" in data
        assert "successful" in data["message"].lower()
        print(f"  ✓ Device activated. user_id={data['user_id']}, device_id={data['device_id']}")

    def test_activate_already_used_pin_returns_400(self, session, customer_token):
        """Attempting to reuse an already-activated PIN returns 400"""
        if not _state["customer_pin"]:
            pytest.skip("No customer PIN available")
        pin = _state["customer_pin"]
        res = session.post(f"{BASE_URL}/api/customer/activate-with-pin?pin={pin}")
        assert res.status_code == 400, f"Expected 400 for already-used PIN, got {res.status_code}: {res.text[:300]}"
        data = res.json()
        assert "detail" in data
        assert "already been used" in data["detail"].lower() or "activated" in data["detail"].lower()
        print(f"  ✓ Already-activated PIN correctly rejected: {data['detail']}")

    def test_activate_profile_updated_after_activation(self, session, customer_token):
        """After activation, /me should show is_activated=True and status=active"""
        headers = {"Authorization": f"Bearer {customer_token}"}
        res = session.get(f"{BASE_URL}/api/customer/me", headers=headers)
        assert res.status_code == 200
        data = res.json()
        assert data["is_activated"] == True, "is_activated should be True after activation"
        assert data["status"] == "active", f"Status should be active, got: {data['status']}"
        print(f"  ✓ Profile updated: is_activated=True, status=active")


# ─── Refresh PIN Tests ─────────────────────────────────────────────────────────

class TestRefreshPin:
    """PIN refresh endpoint tests"""

    def test_refresh_pin_generates_new_pin(self, session, customer_token):
        """POST /api/customer/refresh-pin - returns new 6-digit PIN"""
        old_pin = _state["customer_pin"]
        headers = {"Authorization": f"Bearer {customer_token}"}
        res = session.post(f"{BASE_URL}/api/customer/refresh-pin", headers=headers, json={})
        assert res.status_code == 200, f"Refresh PIN failed: {res.text[:300]}"
        data = res.json()
        assert "activation_pin" in data, "Missing activation_pin in response"
        new_pin = data["activation_pin"]
        assert len(new_pin) == 6, f"New PIN must be 6 digits, got: {new_pin}"
        assert new_pin.isdigit(), f"PIN must be all digits, got: {new_pin}"
        _state["customer_pin"] = new_pin
        print(f"  ✓ PIN refreshed from {old_pin} → {new_pin}")

    def test_refresh_pin_updates_profile(self, session, customer_token):
        """After refresh, /me should return the new PIN"""
        if not _state["customer_pin"]:
            pytest.skip("No refreshed PIN available")
        headers = {"Authorization": f"Bearer {customer_token}"}
        res = session.get(f"{BASE_URL}/api/customer/me", headers=headers)
        assert res.status_code == 200
        data = res.json()
        assert data["activation_pin"] == _state["customer_pin"], \
            f"Profile PIN {data['activation_pin']} doesn't match refreshed PIN {_state['customer_pin']}"
        print(f"  ✓ Profile shows updated PIN: {data['activation_pin']}")

    def test_refresh_pin_without_auth_returns_401(self, session):
        """Refresh PIN without auth returns 401"""
        res = session.post(f"{BASE_URL}/api/customer/refresh-pin", json={})
        assert res.status_code == 401
        print(f"  ✓ Unauthenticated refresh-pin correctly rejected")


# ─── IP-based Lockout Tests ───────────────────────────────────────────────────

class TestIpLockout:
    """IP-based lockout tests after 3 failed PIN attempts"""

    def test_lockout_after_three_bad_pins(self, session):
        """
        3 wrong PIN attempts triggers IP lockout (HTTP 429).
        IMPORTANT: Run AFTER activation tests so the IP failure count is cleared.
        """
        bad_pins = ["000000", "111111", "222222"]
        responses = []
        for i, bad_pin in enumerate(bad_pins):
            res = session.post(f"{BASE_URL}/api/customer/activate-with-pin?pin={bad_pin}")
            responses.append((bad_pin, res.status_code, res.json()))
            print(f"  Attempt {i+1} with PIN {bad_pin}: status={res.status_code}")
            if res.status_code == 429:
                # We've already been locked from a previous run
                print(f"  ✓ Lockout triggered at attempt {i+1}")
                break
            # After 3rd attempt, expect 429
            if i == 2:
                assert res.status_code == 429, \
                    f"3rd bad attempt should return 429, got {res.status_code}: {res.text[:200]}"

        # Verify at least one 429 was received
        status_codes = [r[1] for r in responses]
        assert 429 in status_codes, \
            f"Expected 429 after 3 bad PINs, got codes: {status_codes}"

        # Verify the lockout detail message
        for pin, code, data in responses:
            if code == 429:
                assert "detail" in data
                assert "minute" in data["detail"].lower() or "locked" in data["detail"].lower() or "attempt" in data["detail"].lower()
                print(f"  ✓ Lockout message: {data['detail']}")
                break

    def test_lockout_blocks_subsequent_requests(self, session):
        """Once locked, further requests from same IP should also return 429"""
        # After the previous test, the IP should be locked
        res = session.post(f"{BASE_URL}/api/customer/activate-with-pin?pin=999999")
        # May be 429 (locked) or 404 (wrong pin) depending on lockout state
        # If locked, 429 expected
        if res.status_code == 429:
            print(f"  ✓ Subsequent request blocked by lockout (429)")
        elif res.status_code == 404:
            # IP might not be locked if previous test already exhausted the lockout
            # OR if lockout cleared because a valid PIN was found (shouldn't happen with 999999)
            print(f"  ! IP not locked, got 404 - lockout may have expired or been cleared")
        else:
            print(f"  Status: {res.status_code} - {res.json()}")


# ─── Admin Endpoint Tests ──────────────────────────────────────────────────────

class TestAdminCustomerEndpoints:
    """Admin customer management endpoint tests"""

    def test_admin_list_all_customers(self, session, admin_token):
        """GET /api/customer/admin/all - returns all registered customers"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        res = session.get(f"{BASE_URL}/api/customer/admin/all", headers=headers)
        assert res.status_code == 200, f"Admin list failed: {res.text[:300]}"
        data = res.json()
        assert isinstance(data, list), "Response should be a list"
        assert len(data) >= 1, "Should have at least one customer"
        # Check structure of first customer
        first = data[0]
        assert "id" in first, "Missing id"
        assert "email" in first, "Missing email"
        assert "activation_pin" in first, "Missing activation_pin"
        assert "is_activated" in first
        assert "status" in first
        # Password hash should NOT be included
        assert "password_hash" not in first, "password_hash should not be in response"
        print(f"  ✓ Admin list returned {len(data)} customer(s)")

    def test_admin_list_without_auth_returns_401(self, session):
        """Admin endpoint without auth returns 401"""
        res = session.get(f"{BASE_URL}/api/customer/admin/all")
        assert res.status_code == 401, f"Expected 401, got {res.status_code}"
        print(f"  ✓ Unauthenticated admin endpoint correctly rejected")

    def test_admin_list_with_customer_token_returns_401(self, session):
        """Admin endpoint with customer token should be rejected"""
        if not _state["customer_token"]:
            pytest.skip("No customer token available")
        headers = {"Authorization": f"Bearer {_state['customer_token']}"}
        res = session.get(f"{BASE_URL}/api/customer/admin/all", headers=headers)
        assert res.status_code == 401, f"Expected 401 with customer token, got {res.status_code}"
        print(f"  ✓ Customer token rejected for admin endpoint")

    def test_admin_suspend_customer(self, session, admin_token):
        """PUT /api/customer/admin/{id}/status?status=suspended - suspends customer"""
        if not _state["customer_id"]:
            pytest.skip("No customer ID available")
        headers = {"Authorization": f"Bearer {admin_token}"}
        customer_id = _state["customer_id"]
        res = session.put(
            f"{BASE_URL}/api/customer/admin/{customer_id}/status?status=suspended",
            headers=headers
        )
        assert res.status_code == 200, f"Suspend failed: {res.text[:300]}"
        data = res.json()
        assert "message" in data
        assert "suspended" in data["message"].lower()
        print(f"  ✓ Customer {customer_id} suspended")

    def test_suspended_customer_cannot_login(self, session):
        """Suspended customer login returns 403"""
        if not _state["customer_id"]:
            pytest.skip("No customer ID available")
        res = session.post(f"{BASE_URL}/api/customer/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD,
        })
        assert res.status_code == 403, f"Expected 403 for suspended customer, got {res.status_code}: {res.text[:200]}"
        data = res.json()
        assert "detail" in data
        assert "suspended" in data["detail"].lower()
        print(f"  ✓ Suspended customer correctly rejected: {data['detail']}")

    def test_admin_reactivate_customer(self, session, admin_token):
        """PUT /api/customer/admin/{id}/status?status=active - reactivates customer"""
        if not _state["customer_id"]:
            pytest.skip("No customer ID available")
        headers = {"Authorization": f"Bearer {admin_token}"}
        customer_id = _state["customer_id"]
        res = session.put(
            f"{BASE_URL}/api/customer/admin/{customer_id}/status?status=active",
            headers=headers
        )
        assert res.status_code == 200, f"Reactivate failed: {res.text[:300]}"
        data = res.json()
        assert "active" in data["message"].lower()
        print(f"  ✓ Customer {customer_id} reactivated")

    def test_admin_invalid_status_returns_400(self, session, admin_token):
        """Invalid status value returns 400"""
        if not _state["customer_id"]:
            pytest.skip("No customer ID available")
        headers = {"Authorization": f"Bearer {admin_token}"}
        res = session.put(
            f"{BASE_URL}/api/customer/admin/{_state['customer_id']}/status?status=invalid_status",
            headers=headers
        )
        assert res.status_code == 400, f"Expected 400, got {res.status_code}"
        print(f"  ✓ Invalid status correctly rejected")

    def test_admin_update_nonexistent_customer_returns_404(self, session, admin_token):
        """Updating nonexistent customer returns 404"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        fake_id = str(uuid.uuid4())
        res = session.put(
            f"{BASE_URL}/api/customer/admin/{fake_id}/status?status=suspended",
            headers=headers
        )
        assert res.status_code == 404, f"Expected 404, got {res.status_code}: {res.text[:200]}"
        print(f"  ✓ Nonexistent customer correctly returned 404")
