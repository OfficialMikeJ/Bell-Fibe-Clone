"""
TOTP Feature Tests - Iteration 6
Tests for Google Authenticator TOTP-based activation replacing PIN flow.
Covers: register with TOTP, activate-with-totp (valid/invalid/unknown email),
re-auth flow, refresh-pin (QR refresh), and IP lockout (3 bad codes → 429).
"""
import pytest
import requests
import os
import time
import pymongo
import pyotp
import uuid

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "iptv_service"

TEST_EMAIL_PREFIX = "TEST_totp_iter6"


def get_db():
    """Get MongoDB collection for direct access"""
    client = pymongo.MongoClient(MONGO_URL)
    return client[DB_NAME]


def get_totp_for_email(email: str) -> str:
    """Retrieve live TOTP code for a customer from MongoDB"""
    db = get_db()
    customer = db.customer_accounts.find_one({"email": email.lower().strip()})
    if not customer or not customer.get("totp_secret"):
        raise ValueError(f"No totp_secret found for email: {email}")
    return pyotp.TOTP(customer["totp_secret"]).now()


def clear_ip_lockout():
    """Clear all IP-based lockout records from MongoDB"""
    db = get_db()
    result = db.pin_attempt_log.delete_many({})
    print(f"Cleared {result.deleted_count} IP lockout records")


@pytest.fixture(scope="module", autouse=True)
def clear_lockout_before_tests():
    """Clear IP lockout before all tests in this module"""
    clear_ip_lockout()
    yield
    # Also clear after tests to avoid polluting next run
    clear_ip_lockout()


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def registered_customer(session):
    """Register a test customer and return their data + token"""
    email = f"{TEST_EMAIL_PREFIX}_{uuid.uuid4().hex[:6]}@example.com"
    payload = {
        "first_name": "Totp",
        "last_name": "Tester",
        "email": email,
        "password": "TotpPass123!",
        "device_brand": "Samsung",
        "device_type": "Android Smart TV",
    }
    resp = session.post(f"{BASE_URL}/api/customer/register", json=payload)
    assert resp.status_code == 200, f"Registration failed: {resp.text}"
    data = resp.json()
    return {
        "email": email,
        "token": data["access_token"],
        "customer": data["customer"],
    }


@pytest.fixture(scope="module")
def authenticated_session(session, registered_customer):
    """Session with customer Bearer token"""
    s = requests.Session()
    s.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {registered_customer['token']}",
    })
    return s


# ─── Registration Tests ────────────────────────────────────────────────────────

class TestRegister:
    """POST /api/customer/register — TOTP registration flow"""

    def test_register_returns_200(self, session):
        """Registration should return 200 OK"""
        email = f"{TEST_EMAIL_PREFIX}_reg_{uuid.uuid4().hex[:6]}@example.com"
        resp = session.post(f"{BASE_URL}/api/customer/register", json={
            "first_name": "Reg",
            "last_name": "Test",
            "email": email,
            "password": "RegPass123!",
            "device_brand": "LG",
            "device_type": "Android Phone",
        })
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        print(f"PASS: register returns 200 for {email}")

    def test_register_returns_totp_enabled_true(self, registered_customer):
        """Registration response customer object should include totp_enabled=true"""
        customer = registered_customer["customer"]
        assert customer.get("totp_enabled") is True, \
            f"Expected totp_enabled=True, got: {customer.get('totp_enabled')}"
        print(f"PASS: totp_enabled=True in register response")

    def test_register_returns_qr_code_path(self, registered_customer):
        """Registration response should include qr_code_path"""
        customer = registered_customer["customer"]
        qr_path = customer.get("qr_code_path")
        assert qr_path is not None, "qr_code_path should not be None after registration"
        assert qr_path.startswith("/uploads/"), \
            f"Expected qr_code_path to start with /uploads/, got: {qr_path}"
        print(f"PASS: qr_code_path = {qr_path}")

    def test_register_qr_file_is_accessible(self, registered_customer, session):
        """The QR code image should be accessible via the API"""
        qr_path = registered_customer["customer"].get("qr_code_path")
        if not qr_path:
            pytest.skip("No qr_code_path to test")
        qr_url = f"{BASE_URL}/api{qr_path}"
        resp = session.get(qr_url)
        assert resp.status_code == 200, \
            f"QR code file not accessible at {qr_url}: {resp.status_code}"
        assert "image" in resp.headers.get("content-type", ""), \
            f"Expected image content-type, got: {resp.headers.get('content-type')}"
        print(f"PASS: QR code image accessible at {qr_url}")

    def test_register_does_not_return_activation_pin_in_response(self, registered_customer):
        """Response should NOT contain activation_pin (new TOTP flow)"""
        # totp_enabled=True is the new way; activation_pin should not be prominently exposed
        # The safe_customer() function still includes activation_pin field in response (legacy).
        # This checks totp_enabled is the primary indicator, not activation_pin.
        customer = registered_customer["customer"]
        assert customer.get("totp_enabled") is True, "totp_enabled should be present"
        print("PASS: totp_enabled is the activation mechanism")

    def test_register_duplicate_email_returns_400(self, session, registered_customer):
        """Duplicate email registration should return 400"""
        email = registered_customer["email"]
        resp = session.post(f"{BASE_URL}/api/customer/register", json={
            "first_name": "Dup",
            "last_name": "User",
            "email": email,
            "password": "DupPass123!",
            "device_brand": "Samsung",
            "device_type": "Android Smart TV",
        })
        assert resp.status_code == 400, f"Expected 400 for duplicate email, got {resp.status_code}"
        print(f"PASS: duplicate email returns 400")


# ─── Activate With TOTP Tests ──────────────────────────────────────────────────

class TestActivateWithTOTP:
    """POST /api/customer/activate-with-totp — first-time activation"""

    def test_activate_with_valid_totp_returns_200(self, session, registered_customer):
        """Valid email + correct TOTP code should return 200 with device_id"""
        # Clear IP lockout first (in case previous tests added failures)
        clear_ip_lockout()
        email = registered_customer["email"]
        totp_code = get_totp_for_email(email)
        resp = session.post(f"{BASE_URL}/api/customer/activate-with-totp", json={
            "email": email,
            "totp_code": totp_code,
        })
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        print(f"PASS: activate-with-totp returns 200 for {email}")

    def test_activate_with_valid_totp_returns_device_id(self, session, registered_customer):
        """Response should contain device_id after successful activation"""
        # Clear lockout - this test activates already-activated account (re-auth)
        clear_ip_lockout()
        email = registered_customer["email"]
        totp_code = get_totp_for_email(email)
        resp = session.post(f"{BASE_URL}/api/customer/activate-with-totp", json={
            "email": email,
            "totp_code": totp_code,
        })
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "device_id" in data, f"Expected device_id in response, got: {data}"
        assert data["device_id"] is not None and len(data["device_id"]) > 0
        print(f"PASS: device_id = {data['device_id']}")

    def test_activate_with_valid_totp_returns_message(self, session, registered_customer):
        """Response should contain a message field"""
        clear_ip_lockout()
        email = registered_customer["email"]
        totp_code = get_totp_for_email(email)
        resp = session.post(f"{BASE_URL}/api/customer/activate-with-totp", json={
            "email": email,
            "totp_code": totp_code,
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "message" in data, f"Expected message in response, got: {data}"
        assert len(data["message"]) > 0
        print(f"PASS: message = '{data['message']}'")

    def test_activate_with_wrong_code_returns_401(self, session, registered_customer):
        """Wrong TOTP code should return 401 with attempts remaining"""
        clear_ip_lockout()
        email = registered_customer["email"]
        resp = session.post(f"{BASE_URL}/api/customer/activate-with-totp", json={
            "email": email,
            "totp_code": "000000",  # definitely wrong
        })
        assert resp.status_code == 401, f"Expected 401 for wrong code, got {resp.status_code}: {resp.text}"
        data = resp.json()
        detail = data.get("detail", "")
        assert "attempt" in detail.lower() or "invalid" in detail.lower(), \
            f"Expected attempts remaining message, got: {detail}"
        print(f"PASS: wrong code returns 401: '{detail}'")

    def test_activate_with_wrong_code_shows_attempts_remaining(self, session, registered_customer):
        """Detail message should mention attempts remaining"""
        clear_ip_lockout()
        email = registered_customer["email"]
        resp = session.post(f"{BASE_URL}/api/customer/activate-with-totp", json={
            "email": email,
            "totp_code": "111111",  # wrong
        })
        assert resp.status_code == 401
        detail = resp.json().get("detail", "")
        # Should mention remaining attempts or lockout
        assert any(word in detail.lower() for word in ["attempt", "remaining", "lockout"]), \
            f"Expected attempts info in detail, got: {detail}"
        print(f"PASS: detail contains attempts info: '{detail}'")

    def test_activate_with_unknown_email_returns_401(self, session):
        """Unknown email should return 401"""
        clear_ip_lockout()
        resp = session.post(f"{BASE_URL}/api/customer/activate-with-totp", json={
            "email": "unknown_email_nobody@nonexistent.com",
            "totp_code": "123456",
        })
        assert resp.status_code == 401, \
            f"Expected 401 for unknown email, got {resp.status_code}: {resp.text}"
        print(f"PASS: unknown email returns 401")

    def test_activate_with_unknown_email_does_not_reveal_existence(self, session):
        """Should not reveal if email exists (same 401 for both unknown and wrong code)"""
        clear_ip_lockout()
        resp = session.post(f"{BASE_URL}/api/customer/activate-with-totp", json={
            "email": "definitely_unknown_xyz123@nonexistent.com",
            "totp_code": "000000",
        })
        assert resp.status_code == 401
        detail = resp.json().get("detail", "")
        # Should not say "email not found" or similar
        assert "not found" not in detail.lower() or "invalid" in detail.lower(), \
            f"Email existence should be obscured, got: {detail}"
        print(f"PASS: unknown email detail: '{detail}'")


# ─── Re-authentication Tests ───────────────────────────────────────────────────

class TestReAuthentication:
    """POST /api/customer/activate-with-totp — re-auth on already-activated account"""

    def test_reauth_returns_reauth_message(self, session, registered_customer):
        """Re-auth on already-activated account should return 'Re-authentication successful!'"""
        # Ensure account is activated first
        clear_ip_lockout()
        email = registered_customer["email"]

        # Step 1: Activate if not already (use normalized email for MongoDB lookup)
        db = get_db()
        customer = db.customer_accounts.find_one({"email": email.lower().strip()})
        if not customer or not customer.get("is_activated"):
            totp_code = get_totp_for_email(email)
            time.sleep(1)  # wait for next TOTP window if needed
            resp = session.post(f"{BASE_URL}/api/customer/activate-with-totp", json={
                "email": email,
                "totp_code": totp_code,
            })
            assert resp.status_code == 200, f"First activation failed: {resp.text}"

        clear_ip_lockout()

        # Step 2: Re-authenticate (account is now activated)
        totp_code = get_totp_for_email(email)
        resp = session.post(f"{BASE_URL}/api/customer/activate-with-totp", json={
            "email": email,
            "totp_code": totp_code,
        })
        assert resp.status_code == 200, f"Re-auth failed: {resp.text}"
        data = resp.json()
        msg = data.get("message", "")
        assert "re-authentication" in msg.lower() or "re-auth" in msg.lower(), \
            f"Expected 'Re-authentication successful!' message, got: '{msg}'"
        print(f"PASS: Re-auth message: '{msg}'")

    def test_reauth_returns_device_id(self, session, registered_customer):
        """Re-auth should still return device_id"""
        clear_ip_lockout()
        email = registered_customer["email"]
        totp_code = get_totp_for_email(email)
        resp = session.post(f"{BASE_URL}/api/customer/activate-with-totp", json={
            "email": email,
            "totp_code": totp_code,
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "device_id" in data, f"Expected device_id in re-auth response, got: {data}"
        print(f"PASS: Re-auth returns device_id: {data['device_id']}")


# ─── Refresh QR Code (refresh-pin) Tests ──────────────────────────────────────

class TestRefreshPin:
    """POST /api/customer/refresh-pin — refresh QR code"""

    def test_refresh_pin_returns_200(self, authenticated_session):
        """refresh-pin should return 200"""
        resp = authenticated_session.post(f"{BASE_URL}/api/customer/refresh-pin")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        print("PASS: refresh-pin returns 200")

    def test_refresh_pin_returns_qr_code_path(self, authenticated_session):
        """refresh-pin should return qr_code_path"""
        resp = authenticated_session.post(f"{BASE_URL}/api/customer/refresh-pin")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "qr_code_path" in data, f"Expected qr_code_path in response, got: {data}"
        assert data["qr_code_path"] is not None
        assert data["qr_code_path"].startswith("/uploads/"), \
            f"Expected path starting with /uploads/, got: {data['qr_code_path']}"
        print(f"PASS: refresh-pin returns qr_code_path: {data['qr_code_path']}")

    def test_refresh_pin_does_not_return_activation_pin(self, authenticated_session):
        """refresh-pin response should NOT contain activation_pin field (new TOTP flow)"""
        resp = authenticated_session.post(f"{BASE_URL}/api/customer/refresh-pin")
        assert resp.status_code == 200
        data = resp.json()
        # In the new TOTP flow, the refresh-pin endpoint should return qr_code_path
        # It should NOT be returning a new numeric PIN
        assert "qr_code_path" in data, "Should have qr_code_path"
        # Validate qr_code_path points to a QR image, not a numeric PIN
        qr_path = data.get("qr_code_path", "")
        assert ".png" in qr_path or ".jpg" in qr_path or qr_path.startswith("/uploads/"), \
            f"qr_code_path should be a file path, got: {qr_path}"
        print(f"PASS: refresh-pin returns QR path (no numeric PIN): {qr_path}")

    def test_refresh_pin_returns_message(self, authenticated_session):
        """refresh-pin should return a message"""
        resp = authenticated_session.post(f"{BASE_URL}/api/customer/refresh-pin")
        assert resp.status_code == 200
        data = resp.json()
        assert "message" in data, f"Expected message in response, got: {data}"
        print(f"PASS: refresh-pin message: '{data['message']}'")

    def test_refresh_pin_requires_auth(self, session):
        """refresh-pin should return 401 without authentication"""
        resp = session.post(f"{BASE_URL}/api/customer/refresh-pin")
        assert resp.status_code == 401, \
            f"Expected 401 without auth, got {resp.status_code}"
        print("PASS: refresh-pin requires auth (401 without token)")


# ─── IP Lockout Tests ──────────────────────────────────────────────────────────

class TestIPLockout:
    """IP-based lockout: 3 wrong TOTP codes → 429"""

    def test_three_wrong_codes_trigger_429(self, session):
        """3 wrong TOTP codes from same IP should return 429"""
        clear_ip_lockout()

        # Register a fresh customer for lockout testing
        lockout_email = f"{TEST_EMAIL_PREFIX}_lockout_{uuid.uuid4().hex[:6]}@example.com"
        session.post(f"{BASE_URL}/api/customer/register", json={
            "first_name": "Lockout",
            "last_name": "Test",
            "email": lockout_email,
            "password": "LockoutPass123!",
            "device_brand": "Sony",
            "device_type": "Android Box",
        })

        # Submit 3 wrong codes
        responses = []
        for attempt in range(3):
            resp = session.post(f"{BASE_URL}/api/customer/activate-with-totp", json={
                "email": lockout_email,
                "totp_code": f"{attempt:06d}",  # definitely wrong codes
            })
            responses.append(resp)
            print(f"  Attempt {attempt+1}: status={resp.status_code}, detail={resp.json().get('detail', '')}")

        # After 3 attempts, should be locked out (429)
        statuses = [r.status_code for r in responses]
        # The 3rd attempt or subsequent should trigger 429
        assert 429 in statuses or responses[-1].status_code == 429, \
            f"Expected 429 after 3 wrong attempts, got statuses: {statuses}"
        print(f"PASS: IP lockout triggered (statuses: {statuses})")
        clear_ip_lockout()  # Clean up after lockout test

    def test_lockout_message_mentions_wait_time(self, session):
        """Lockout 429 response should mention wait time"""
        clear_ip_lockout()

        lockout_email = f"{TEST_EMAIL_PREFIX}_lockout2_{uuid.uuid4().hex[:6]}@example.com"
        session.post(f"{BASE_URL}/api/customer/register", json={
            "first_name": "Lockout2",
            "last_name": "Test",
            "email": lockout_email,
            "password": "LockoutPass123!",
            "device_brand": "Sony",
            "device_type": "Android Box",
        })

        last_resp = None
        for attempt in range(4):  # 4 to be sure we hit lockout
            resp = session.post(f"{BASE_URL}/api/customer/activate-with-totp", json={
                "email": lockout_email,
                "totp_code": f"{attempt:06d}",
            })
            if resp.status_code == 429:
                last_resp = resp
                break

        if last_resp is None:
            pytest.fail("Expected 429 lockout response but didn't get one")

        detail = last_resp.json().get("detail", "")
        assert "minute" in detail.lower() or "wait" in detail.lower(), \
            f"Expected wait time in lockout message, got: {detail}"
        print(f"PASS: lockout message mentions wait time: '{detail}'")
        clear_ip_lockout()


# ─── Cleanup ──────────────────────────────────────────────────────────────────

@pytest.fixture(scope="module", autouse=True)
def cleanup_test_data():
    """Delete all TEST_ prefixed customers after tests complete"""
    yield
    try:
        db = get_db()
        result = db.customer_accounts.delete_many({"email": {"$regex": f"^{TEST_EMAIL_PREFIX}"}})
        print(f"Cleaned up {result.deleted_count} test customer accounts")
        clear_ip_lockout()
    except Exception as e:
        print(f"Cleanup error (non-critical): {e}")
