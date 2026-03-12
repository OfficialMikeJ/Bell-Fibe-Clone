"""
Iteration 4 Backend Tests - New Features:
- Portal login (POST /api/devices/portal-login)
- Device by code (GET /api/devices/by-code/{code})
- FAQ CRUD (POST/GET/PUT/DELETE /api/faq)
- Tickets CRUD (POST/GET/PUT /api/tickets)
- Ticket reply (POST /api/tickets/{id}/reply)
- Tickets by user (GET /api/tickets/by-user/{user_id})
- Service config uptime_kuma_url (POST /api/setup/service-config)
- GET /api/setup/config - returns uptime_kuma_url
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    # fallback from .env file
    import subprocess
    result = subprocess.run(['grep', 'REACT_APP_BACKEND_URL', '/app/frontend/.env'], capture_output=True, text=True)
    for line in result.stdout.strip().splitlines():
        if '=' in line:
            BASE_URL = line.split('=', 1)[1].strip()
            break

ADMIN_CREDENTIALS = {"username": "admin", "password": "admin123"}


@pytest.fixture(scope="module")
def admin_token():
    """Get admin token once per module"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDENTIALS)
    assert response.status_code == 200, f"Admin login failed: {response.text}"
    # API returns access_token not token
    return response.json().get("access_token") or response.json().get("token")


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    """Admin auth headers"""
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="module")
def active_device_info(admin_headers):
    """Get an active device to use for portal-login tests"""
    response = requests.get(f"{BASE_URL}/api/devices", headers=admin_headers)
    assert response.status_code == 200, "Failed to get devices"
    devices = response.json()
    active_devices = [d for d in devices if d.get("status") == "active"]
    if not active_devices:
        pytest.skip("No active devices found - skipping portal-dependent tests")
    device = active_devices[0]
    return {
        "id": device["id"],
        "activation_code": device["activation_code"],
        "device_name": device["device_name"],
        "user_id": device.get("user_id"),
    }


# ──────────────────────────────────────────────
# Service Config Tests
# ──────────────────────────────────────────────

class TestServiceConfig:
    """Service config endpoint tests - uptime_kuma_url"""

    def test_get_config_returns_uptime_kuma_url_field(self):
        """GET /api/setup/config should include uptime_kuma_url field"""
        response = requests.get(f"{BASE_URL}/api/setup/config")
        assert response.status_code == 200, f"Get config failed: {response.text}"
        data = response.json()
        assert "uptime_kuma_url" in data, "uptime_kuma_url field missing from config response"
        print(f"PASS: GET /api/setup/config returns uptime_kuma_url: {data.get('uptime_kuma_url')!r}")

    def test_set_uptime_kuma_url(self, admin_headers):
        """POST /api/setup/service-config?uptime_kuma_url=... should save the URL"""
        test_url = "https://status.example.com"
        response = requests.post(
            f"{BASE_URL}/api/setup/service-config",
            params={"uptime_kuma_url": test_url},
            headers=admin_headers,
        )
        assert response.status_code == 200, f"Failed to save uptime_kuma_url: {response.text}"
        data = response.json()
        assert "message" in data
        print(f"PASS: POST service-config saved uptime_kuma_url: {test_url}")

    def test_uptime_kuma_url_persists_after_save(self, admin_headers):
        """After saving, GET /api/setup/config should return the new URL"""
        test_url = "https://status.example.com"
        # Save first
        requests.post(
            f"{BASE_URL}/api/setup/service-config",
            params={"uptime_kuma_url": test_url},
            headers=admin_headers,
        )
        # Now verify
        response = requests.get(f"{BASE_URL}/api/setup/config")
        assert response.status_code == 200
        data = response.json()
        assert data.get("uptime_kuma_url") == test_url, (
            f"Expected {test_url!r}, got {data.get('uptime_kuma_url')!r}"
        )
        print(f"PASS: uptime_kuma_url persisted correctly")

    def test_clear_uptime_kuma_url(self, admin_headers):
        """Can set uptime_kuma_url to empty string"""
        response = requests.post(
            f"{BASE_URL}/api/setup/service-config",
            params={"uptime_kuma_url": ""},
            headers=admin_headers,
        )
        assert response.status_code == 200
        print(f"PASS: uptime_kuma_url cleared")


# ──────────────────────────────────────────────
# Device Portal Endpoints
# ──────────────────────────────────────────────

class TestDevicePortalEndpoints:
    """Tests for portal-login and by-code endpoints"""

    def test_get_device_by_code_valid(self, admin_headers, active_device_info):
        """GET /api/devices/by-code/{code} should return device info"""
        code = active_device_info["activation_code"]
        response = requests.get(f"{BASE_URL}/api/devices/by-code/{code}")
        assert response.status_code == 200, f"by-code failed: {response.text}"
        data = response.json()
        assert "device_name" in data
        assert "status" in data
        assert "device_id" in data
        assert data["device_name"] == active_device_info["device_name"]
        print(f"PASS: GET /api/devices/by-code returns: {data}")

    def test_get_device_by_code_invalid(self):
        """GET /api/devices/by-code/{code} with invalid code returns 404"""
        response = requests.get(f"{BASE_URL}/api/devices/by-code/INVALID-CODE-XYZ")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print(f"PASS: invalid activation code returns 404")

    def test_portal_login_with_active_device(self, active_device_info):
        """POST /api/devices/portal-login returns user_id for active device"""
        code = active_device_info["activation_code"]
        response = requests.post(
            f"{BASE_URL}/api/devices/portal-login",
            params={"activation_code": code},
        )
        assert response.status_code == 200, f"portal-login failed: {response.text}"
        data = response.json()
        assert "user_id" in data
        assert "device_name" in data
        assert "device_id" in data
        assert data["user_id"], "user_id should not be empty"
        print(f"PASS: portal-login returns user_id: {data['user_id']}")
        return data["user_id"]

    def test_portal_login_invalid_code(self):
        """POST /api/devices/portal-login with invalid code returns 404"""
        response = requests.post(
            f"{BASE_URL}/api/devices/portal-login",
            params={"activation_code": "INVALID-CODE-XYZ"},
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print(f"PASS: portal-login with invalid code returns 404")


# ──────────────────────────────────────────────
# FAQ Tests
# ──────────────────────────────────────────────

class TestFAQ:
    """FAQ CRUD tests"""

    created_faq_id = None

    def test_get_faqs_public(self):
        """GET /api/faq should return active FAQ items (public)"""
        response = requests.get(f"{BASE_URL}/api/faq")
        assert response.status_code == 200, f"GET /api/faq failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"PASS: GET /api/faq returns {len(data)} items")
        if data:
            first = data[0]
            assert "id" in first
            assert "question" in first
            assert "answer" in first
            assert "category" in first

    def test_get_faqs_all_with_admin(self, admin_headers):
        """GET /api/faq?all=true returns all including inactive (admin)"""
        response = requests.get(f"{BASE_URL}/api/faq", params={"all": "true"}, headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"PASS: GET /api/faq?all=true returns {len(data)} items")

    def test_create_faq(self, admin_headers):
        """POST /api/faq with admin token creates FAQ item"""
        payload = {
            "question": "TEST_How do I contact support?",
            "answer": "TEST_You can contact support via the portal at /portal/support.",
            "category": "General",
            "order": 99,
            "is_active": True,
        }
        response = requests.post(f"{BASE_URL}/api/faq", json=payload, headers=admin_headers)
        assert response.status_code == 200, f"Create FAQ failed: {response.text}"
        data = response.json()
        assert "id" in data
        assert data["question"] == payload["question"]
        assert data["answer"] == payload["answer"]
        assert data["category"] == "General"
        TestFAQ.created_faq_id = data["id"]
        print(f"PASS: POST /api/faq created FAQ id={data['id']}")

    def test_create_faq_without_auth_fails(self):
        """POST /api/faq without auth should return 401"""
        payload = {"question": "Q?", "answer": "A."}
        response = requests.post(f"{BASE_URL}/api/faq", json=payload)
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print(f"PASS: POST /api/faq without auth returns 401")

    def test_update_faq(self, admin_headers):
        """PUT /api/faq/{id} with admin token updates FAQ item"""
        if not TestFAQ.created_faq_id:
            pytest.skip("No FAQ created to update")
        updated_answer = "TEST_Updated answer for testing."
        response = requests.put(
            f"{BASE_URL}/api/faq/{TestFAQ.created_faq_id}",
            json={"answer": updated_answer},
            headers=admin_headers,
        )
        assert response.status_code == 200, f"Update FAQ failed: {response.text}"
        data = response.json()
        assert data["answer"] == updated_answer
        print(f"PASS: PUT /api/faq updated answer successfully")

    def test_faq_appears_in_public_list_when_active(self):
        """Active FAQ items should appear in public GET /api/faq"""
        response = requests.get(f"{BASE_URL}/api/faq")
        assert response.status_code == 200
        faqs = response.json()
        faq_ids = [f["id"] for f in faqs]
        if TestFAQ.created_faq_id:
            assert TestFAQ.created_faq_id in faq_ids, (
                f"Created FAQ id={TestFAQ.created_faq_id} not in public list"
            )
        print(f"PASS: Active FAQ appears in public list")

    def test_delete_faq(self, admin_headers):
        """DELETE /api/faq/{id} with admin token removes FAQ item"""
        if not TestFAQ.created_faq_id:
            pytest.skip("No FAQ created to delete")
        response = requests.delete(
            f"{BASE_URL}/api/faq/{TestFAQ.created_faq_id}",
            headers=admin_headers,
        )
        assert response.status_code == 200, f"Delete FAQ failed: {response.text}"
        print(f"PASS: DELETE /api/faq deleted FAQ successfully")

    def test_delete_nonexistent_faq(self, admin_headers):
        """DELETE /api/faq/{id} for non-existent item returns 404"""
        response = requests.delete(
            f"{BASE_URL}/api/faq/nonexistent-id-xyz",
            headers=admin_headers,
        )
        assert response.status_code == 404
        print(f"PASS: DELETE non-existent FAQ returns 404")


# ──────────────────────────────────────────────
# Ticket Tests
# ──────────────────────────────────────────────

@pytest.fixture(scope="module")
def portal_user_id(active_device_info):
    """Get user_id via portal-login"""
    code = active_device_info["activation_code"]
    response = requests.post(
        f"{BASE_URL}/api/devices/portal-login",
        params={"activation_code": code},
    )
    if response.status_code != 200:
        pytest.skip(f"portal-login failed: {response.text}")
    data = response.json()
    user_id = data.get("user_id")
    if not user_id:
        pytest.skip("No user_id returned from portal-login")
    return user_id


class TestTickets:
    """Ticket CRUD tests"""

    created_ticket_id = None

    def test_get_tickets_requires_admin(self):
        """GET /api/tickets without auth returns 401"""
        response = requests.get(f"{BASE_URL}/api/tickets")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print(f"PASS: GET /api/tickets without auth returns 401")

    def test_get_all_tickets_as_admin(self, admin_headers):
        """GET /api/tickets with admin token returns list"""
        response = requests.get(f"{BASE_URL}/api/tickets", headers=admin_headers)
        assert response.status_code == 200, f"GET /api/tickets failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"PASS: GET /api/tickets returns {len(data)} tickets")

    def test_create_ticket_with_valid_user(self, portal_user_id):
        """POST /api/tickets with valid user_id creates a ticket"""
        payload = {
            "title": "TEST_My device is not connecting",
            "description": "TEST_I am unable to connect to the service since this morning.",
            "ticket_type": "General Support",
            "user_id": portal_user_id,
        }
        response = requests.post(f"{BASE_URL}/api/tickets", json=payload)
        assert response.status_code == 200, f"Create ticket failed: {response.text}"
        data = response.json()
        assert "id" in data
        assert data["title"] == payload["title"]
        assert data["user_id"] == portal_user_id
        assert data["status"] == "open"
        assert data["priority"] == "medium"
        assert len(data["messages"]) == 1  # Initial message created
        TestTickets.created_ticket_id = data["id"]
        print(f"PASS: POST /api/tickets created ticket id={data['id']}")

    def test_create_ticket_invalid_user(self):
        """POST /api/tickets with invalid user_id returns 403"""
        payload = {
            "title": "Test ticket",
            "description": "Test description",
            "ticket_type": "General Support",
            "user_id": "INVALID-USER-ID-XYZ",
        }
        response = requests.post(f"{BASE_URL}/api/tickets", json=payload)
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        print(f"PASS: POST /api/tickets with invalid user returns 403")

    def test_get_tickets_by_user(self, portal_user_id):
        """GET /api/tickets/by-user/{user_id} returns user's tickets"""
        response = requests.get(f"{BASE_URL}/api/tickets/by-user/{portal_user_id}")
        assert response.status_code == 200, f"Get tickets by user failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        if TestTickets.created_ticket_id:
            ticket_ids = [t["id"] for t in data]
            assert TestTickets.created_ticket_id in ticket_ids, (
                f"Created ticket {TestTickets.created_ticket_id} not in user tickets"
            )
        print(f"PASS: GET /api/tickets/by-user returns {len(data)} tickets")

    def test_get_tickets_by_user_empty(self):
        """GET /api/tickets/by-user/{user_id} for unknown user returns empty list"""
        response = requests.get(f"{BASE_URL}/api/tickets/by-user/UNKNOWN-USER-XYZ")
        assert response.status_code == 200
        data = response.json()
        assert data == [], f"Expected empty list, got {data}"
        print(f"PASS: tickets/by-user for unknown user returns empty list")

    def test_update_ticket_priority_and_status(self, admin_headers):
        """PUT /api/tickets/{id} with admin token updates priority and status"""
        if not TestTickets.created_ticket_id:
            pytest.skip("No ticket created to update")
        response = requests.put(
            f"{BASE_URL}/api/tickets/{TestTickets.created_ticket_id}",
            json={"priority": "high", "status": "in_progress"},
            headers=admin_headers,
        )
        assert response.status_code == 200, f"Update ticket failed: {response.text}"
        data = response.json()
        assert data["priority"] == "high", f"Expected high, got {data['priority']}"
        assert data["status"] == "in_progress", f"Expected in_progress, got {data['status']}"
        print(f"PASS: PUT /api/tickets updated priority=high status=in_progress")

    def test_update_ticket_requires_admin(self):
        """PUT /api/tickets/{id} without auth returns 401"""
        if not TestTickets.created_ticket_id:
            pytest.skip("No ticket created to update")
        response = requests.put(
            f"{BASE_URL}/api/tickets/{TestTickets.created_ticket_id}",
            json={"priority": "critical"},
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print(f"PASS: PUT ticket without auth returns 401")

    def test_admin_reply_to_ticket(self, admin_headers, portal_user_id):
        """POST /api/tickets/{id}/reply with admin adds reply with is_admin=true"""
        if not TestTickets.created_ticket_id:
            pytest.skip("No ticket created to reply to")
        payload = {
            "message": "TEST_Hello, we are looking into your issue right away.",
            "sender_id": "admin",
            "is_admin": True,
        }
        response = requests.post(
            f"{BASE_URL}/api/tickets/{TestTickets.created_ticket_id}/reply",
            json=payload,
            headers=admin_headers,
        )
        assert response.status_code == 200, f"Reply failed: {response.text}"
        data = response.json()
        messages = data.get("messages", [])
        assert len(messages) >= 2, f"Expected at least 2 messages, got {len(messages)}"
        # Find admin message
        admin_msgs = [m for m in messages if m.get("is_admin") is True]
        assert len(admin_msgs) >= 1, "Admin message not found in ticket thread"
        assert admin_msgs[-1]["message"] == payload["message"]
        # Admin reply should move status to in_progress if was open
        print(f"PASS: POST /api/tickets/{TestTickets.created_ticket_id}/reply added admin reply")

    def test_get_all_tickets_with_filter_status(self, admin_headers):
        """GET /api/tickets?status=open filters by status"""
        response = requests.get(
            f"{BASE_URL}/api/tickets",
            params={"status": "open"},
            headers=admin_headers,
        )
        assert response.status_code == 200
        data = response.json()
        for ticket in data:
            assert ticket["status"] == "open", f"Got non-open ticket: {ticket['status']}"
        print(f"PASS: GET /api/tickets?status=open returns {len(data)} open tickets")

    def test_get_all_tickets_with_filter_priority(self, admin_headers):
        """GET /api/tickets?priority=high filters by priority"""
        response = requests.get(
            f"{BASE_URL}/api/tickets",
            params={"priority": "high"},
            headers=admin_headers,
        )
        assert response.status_code == 200
        data = response.json()
        for ticket in data:
            assert ticket["priority"] == "high", f"Got non-high ticket: {ticket['priority']}"
        print(f"PASS: GET /api/tickets?priority=high returns {len(data)} high priority tickets")

    def test_delete_test_ticket(self, admin_headers):
        """DELETE /api/tickets/{id} removes the test ticket"""
        if not TestTickets.created_ticket_id:
            pytest.skip("No ticket created to delete")
        response = requests.delete(
            f"{BASE_URL}/api/tickets/{TestTickets.created_ticket_id}",
            headers=admin_headers,
        )
        assert response.status_code == 200, f"Delete ticket failed: {response.text}"
        print(f"PASS: DELETE /api/tickets deleted ticket successfully")

    def test_get_ticket_after_delete_returns_404(self, admin_headers):
        """After delete, GET ticket returns 404"""
        if not TestTickets.created_ticket_id:
            pytest.skip("No ticket created")
        response = requests.get(
            f"{BASE_URL}/api/tickets/{TestTickets.created_ticket_id}",
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print(f"PASS: Deleted ticket returns 404")
