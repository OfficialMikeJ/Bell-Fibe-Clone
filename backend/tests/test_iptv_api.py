"""
StreamVault TV - IPTV Service - Backend API Tests
Tests all critical API endpoints: auth, setup, channels, programs, devices, users
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://vault-preview-38.preview.emergentagent.com').rstrip('/')

# Test credentials
ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "admin123"

# ===== FIXTURES =====

@pytest.fixture(scope="session")
def auth_token():
    """Get JWT token for admin"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "username": ADMIN_USERNAME,
        "password": ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip(f"Authentication failed: {response.status_code} - {response.text}")

@pytest.fixture(scope="session")
def auth_headers(auth_token):
    """Headers with JWT token"""
    return {"Authorization": f"Bearer {auth_token}"}


# ===== SETUP API TESTS =====

class TestSetupAPI:
    """Tests for /api/setup endpoints"""

    def test_setup_status_returns_200(self):
        """GET /api/setup/status should return setup status"""
        response = requests.get(f"{BASE_URL}/api/setup/status")
        assert response.status_code == 200
        data = response.json()
        assert "setup_completed" in data
        print(f"Setup completed: {data['setup_completed']}")

    def test_setup_status_completed(self):
        """Setup should be marked as completed"""
        response = requests.get(f"{BASE_URL}/api/setup/status")
        assert response.status_code == 200
        data = response.json()
        assert data["setup_completed"] == True, f"Setup not completed: {data}"

    def test_setup_config_returns_service_name(self):
        """GET /api/setup/config should return service_name"""
        response = requests.get(f"{BASE_URL}/api/setup/config")
        assert response.status_code == 200
        data = response.json()
        assert "service_name" in data
        assert data["service_name"] is not None
        assert isinstance(data["service_name"], str)
        print(f"Service name: {data['service_name']}")


# ===== AUTH API TESTS =====

class TestAuthAPI:
    """Tests for /api/auth endpoints"""

    def test_login_success(self):
        """Login with valid credentials returns token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": ADMIN_USERNAME,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "token_type" in data
        assert data["token_type"] == "bearer"
        assert len(data["access_token"]) > 10

    def test_login_invalid_credentials_returns_401(self):
        """Login with wrong password returns 401"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": ADMIN_USERNAME,
            "password": "wrong_password"
        })
        assert response.status_code == 401
        data = response.json()
        assert "detail" in data

    def test_login_wrong_username_returns_401(self):
        """Login with non-existent user returns 401"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "nonexistent_user",
            "password": "anypassword"
        })
        assert response.status_code == 401

    def test_verify_auth_with_valid_token(self, auth_headers):
        """GET /api/auth/verify returns admin info with valid token"""
        response = requests.get(f"{BASE_URL}/api/auth/verify", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "username" in data
        assert data["username"] == ADMIN_USERNAME
        assert "two_fa_enabled" in data

    def test_verify_auth_without_token_returns_401(self):
        """GET /api/auth/verify without token returns 401"""
        response = requests.get(f"{BASE_URL}/api/auth/verify")
        assert response.status_code == 401

    def test_security_questions_no_config_returns_400(self):
        """Security questions for admin with no questions configured returns 400"""
        response = requests.get(f"{BASE_URL}/api/auth/security-questions/{ADMIN_USERNAME}")
        # Admin has no security questions set up by default - should return 400
        assert response.status_code in [400, 404]
        print(f"Security questions response: {response.status_code} - {response.text}")

    def test_security_questions_unknown_user_returns_404(self):
        """Security questions for non-existent user returns 404"""
        response = requests.get(f"{BASE_URL}/api/auth/security-questions/nonexistent_xyz_user")
        assert response.status_code == 404


# ===== CHANNELS API TESTS =====

class TestChannelsAPI:
    """Tests for /api/channels CRUD endpoints"""

    def test_get_channels_returns_200(self):
        """GET /api/channels should return a list"""
        response = requests.get(f"{BASE_URL}/api/channels")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Total channels: {len(data)}")

    def test_create_channel(self, auth_headers):
        """POST /api/channels creates a new channel"""
        test_channel = {
            "name": f"TEST_Channel_{uuid.uuid4().hex[:8]}",
            "number": f"9{uuid.uuid4().hex[:3]}",
            "description": "Test channel for automated testing"
        }
        response = requests.post(f"{BASE_URL}/api/channels", json=test_channel, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == test_channel["name"]
        assert data["number"] == test_channel["number"]
        assert "id" in data
        print(f"Created channel id: {data['id']}")
        return data["id"]

    def test_create_and_get_channel(self, auth_headers):
        """Create channel and verify it can be retrieved"""
        test_name = f"TEST_Channel_{uuid.uuid4().hex[:8]}"
        # CREATE
        create_resp = requests.post(f"{BASE_URL}/api/channels", json={
            "name": test_name,
            "number": f"8{uuid.uuid4().hex[:3]}",
            "description": "Test channel"
        }, headers=auth_headers)
        assert create_resp.status_code == 200
        channel_id = create_resp.json()["id"]

        # GET by ID
        get_resp = requests.get(f"{BASE_URL}/api/channels/{channel_id}")
        assert get_resp.status_code == 200
        assert get_resp.json()["name"] == test_name

        # Cleanup
        requests.delete(f"{BASE_URL}/api/channels/{channel_id}", headers=auth_headers)

    def test_update_channel(self, auth_headers):
        """PUT /api/channels/{id} updates channel data"""
        # Create
        create_resp = requests.post(f"{BASE_URL}/api/channels", json={
            "name": f"TEST_Chan_{uuid.uuid4().hex[:8]}",
            "number": f"7{uuid.uuid4().hex[:3]}",
        }, headers=auth_headers)
        assert create_resp.status_code == 200
        channel_id = create_resp.json()["id"]

        # Update
        new_name = f"TEST_Updated_{uuid.uuid4().hex[:8]}"
        update_resp = requests.put(f"{BASE_URL}/api/channels/{channel_id}",
                                   json={"name": new_name}, headers=auth_headers)
        assert update_resp.status_code == 200
        assert update_resp.json()["name"] == new_name

        # Verify persistence via GET
        get_resp = requests.get(f"{BASE_URL}/api/channels/{channel_id}")
        assert get_resp.status_code == 200
        assert get_resp.json()["name"] == new_name

        # Cleanup
        requests.delete(f"{BASE_URL}/api/channels/{channel_id}", headers=auth_headers)

    def test_delete_channel(self, auth_headers):
        """DELETE /api/channels/{id} removes channel"""
        # Create
        create_resp = requests.post(f"{BASE_URL}/api/channels", json={
            "name": f"TEST_Del_{uuid.uuid4().hex[:8]}",
            "number": f"6{uuid.uuid4().hex[:3]}",
        }, headers=auth_headers)
        assert create_resp.status_code == 200
        channel_id = create_resp.json()["id"]

        # Delete
        del_resp = requests.delete(f"{BASE_URL}/api/channels/{channel_id}", headers=auth_headers)
        assert del_resp.status_code == 200

        # Verify deletion
        get_resp = requests.get(f"{BASE_URL}/api/channels/{channel_id}")
        assert get_resp.status_code == 404

    def test_delete_nonexistent_channel_returns_404(self, auth_headers):
        """DELETE non-existent channel returns 404"""
        response = requests.delete(f"{BASE_URL}/api/channels/nonexistent_id_xyz", headers=auth_headers)
        assert response.status_code == 404


# ===== PROGRAMS API TESTS =====

class TestProgramsAPI:
    """Tests for /api/programs endpoints"""

    def test_get_programs_returns_200(self):
        """GET /api/programs should return a list"""
        response = requests.get(f"{BASE_URL}/api/programs")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Total programs: {len(data)}")

    def test_create_program(self, auth_headers):
        """POST /api/programs creates a new program"""
        # First get a channel to use
        channels_resp = requests.get(f"{BASE_URL}/api/channels")
        channels = channels_resp.json()

        if not channels:
            # Create a test channel
            ch_resp = requests.post(f"{BASE_URL}/api/channels", json={
                "name": f"TEST_Chan_For_Prog_{uuid.uuid4().hex[:8]}",
                "number": f"5{uuid.uuid4().hex[:3]}"
            }, headers=auth_headers)
            channel_id = ch_resp.json()["id"]
        else:
            channel_id = channels[0]["id"]

        program_data = {
            "channel_id": channel_id,
            "title": f"TEST_Program_{uuid.uuid4().hex[:8]}",
            "description": "Test program",
            "start_time": "09:00",
            "duration_minutes": 60,
            "date": "2026-02-15"
        }
        response = requests.post(f"{BASE_URL}/api/programs", json=program_data, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == program_data["title"]
        assert "id" in data

        # Cleanup
        requests.delete(f"{BASE_URL}/api/programs/{data['id']}", headers=auth_headers)


# ===== DEVICES API TESTS =====

class TestDevicesAPI:
    """Tests for /api/devices endpoints"""

    def test_get_devices_returns_200(self):
        """GET /api/devices should return a list"""
        response = requests.get(f"{BASE_URL}/api/devices")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Total devices: {len(data)}")

    def test_create_device(self, auth_headers):
        """POST /api/devices creates a new device with QR code"""
        mac = f"AA:BB:CC:DD:{uuid.uuid4().hex[:2].upper()}:{uuid.uuid4().hex[:2].upper()}"
        device_data = {
            "device_name": f"TEST_Device_{uuid.uuid4().hex[:8]}",
            "mac_address": mac
        }
        response = requests.post(f"{BASE_URL}/api/devices", json=device_data, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["device_name"] == device_data["device_name"]
        assert data["mac_address"] == mac
        assert "id" in data
        assert "activation_code" in data
        print(f"Device activation_code: {data.get('activation_code')}")

        # Cleanup - delete device
        requests.delete(f"{BASE_URL}/api/devices/{data['id']}", headers=auth_headers)

    def test_create_duplicate_mac_returns_400(self, auth_headers):
        """Creating device with duplicate MAC returns 400"""
        mac = f"FF:EE:DD:CC:{uuid.uuid4().hex[:2].upper()}:{uuid.uuid4().hex[:2].upper()}"
        device_data = {"device_name": f"TEST_Dev1_{uuid.uuid4().hex[:8]}", "mac_address": mac}

        # Create first
        resp1 = requests.post(f"{BASE_URL}/api/devices", json=device_data, headers=auth_headers)
        assert resp1.status_code == 200
        device_id = resp1.json()["id"]

        # Try duplicate
        device_data2 = {"device_name": f"TEST_Dev2_{uuid.uuid4().hex[:8]}", "mac_address": mac}
        resp2 = requests.post(f"{BASE_URL}/api/devices", json=device_data2, headers=auth_headers)
        assert resp2.status_code == 400

        # Cleanup
        requests.delete(f"{BASE_URL}/api/devices/{device_id}", headers=auth_headers)


# ===== USERS API TESTS =====

class TestUsersAPI:
    """Tests for /api/users endpoints"""

    def test_get_users_returns_200(self, auth_headers):
        """GET /api/users with auth should return a list"""
        response = requests.get(f"{BASE_URL}/api/users", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Total users: {len(data)}")

    def test_create_user_and_verify(self, auth_headers):
        """POST /api/users creates user, GET verifies persistence"""
        unique_id = uuid.uuid4().hex[:8]
        user_data = {
            "username": f"test_user_{unique_id}",
            "email": f"test_{unique_id}@example.com",
            "password": "testpass123",
            "full_name": "Test User",
            "max_devices": 3,
            "account_status": "active",
            "notes": "Created for automated testing"
        }
        # Create
        create_resp = requests.post(f"{BASE_URL}/api/users", json=user_data, headers=auth_headers)
        assert create_resp.status_code == 200
        created = create_resp.json()
        assert created["username"] == user_data["username"]
        assert created["email"] == user_data["email"]
        assert "id" in created
        user_id = created["id"]

        # GET to verify persistence
        get_resp = requests.get(f"{BASE_URL}/api/users/{user_id}", headers=auth_headers)
        assert get_resp.status_code == 200
        fetched = get_resp.json()
        assert fetched["username"] == user_data["username"]
        assert fetched["email"] == user_data["email"]
        assert fetched["notes"] == user_data["notes"]

        # Cleanup
        requests.delete(f"{BASE_URL}/api/users/{user_id}", headers=auth_headers)

    def test_update_user_status(self, auth_headers):
        """PUT /api/users/{id} updates user account status"""
        unique_id = uuid.uuid4().hex[:8]
        # Create
        create_resp = requests.post(f"{BASE_URL}/api/users", json={
            "username": f"test_upd_{unique_id}",
            "email": f"upd_{unique_id}@example.com",
            "password": "testpass123",
            "account_status": "active"
        }, headers=auth_headers)
        assert create_resp.status_code == 200
        user_id = create_resp.json()["id"]

        # Update
        update_resp = requests.put(f"{BASE_URL}/api/users/{user_id}",
                                   json={"account_status": "suspended", "notes": "Test update"},
                                   headers=auth_headers)
        assert update_resp.status_code == 200
        assert update_resp.json()["account_status"] == "suspended"

        # Verify persistence
        get_resp = requests.get(f"{BASE_URL}/api/users/{user_id}", headers=auth_headers)
        assert get_resp.status_code == 200
        assert get_resp.json()["account_status"] == "suspended"
        assert get_resp.json()["notes"] == "Test update"

        # Cleanup
        requests.delete(f"{BASE_URL}/api/users/{user_id}", headers=auth_headers)

    def test_create_duplicate_username_returns_400(self, auth_headers):
        """Creating user with duplicate username returns 400"""
        unique_id = uuid.uuid4().hex[:8]
        user_data = {
            "username": f"test_dup_{unique_id}",
            "email": f"dup_{unique_id}@example.com",
            "password": "testpass123"
        }
        # Create first
        resp1 = requests.post(f"{BASE_URL}/api/users", json=user_data, headers=auth_headers)
        assert resp1.status_code == 200
        user_id = resp1.json()["id"]

        # Duplicate username with different email
        user_data2 = {**user_data, "email": f"dup2_{unique_id}@example.com"}
        resp2 = requests.post(f"{BASE_URL}/api/users", json=user_data2, headers=auth_headers)
        assert resp2.status_code == 400

        # Cleanup
        requests.delete(f"{BASE_URL}/api/users/{user_id}", headers=auth_headers)

    def test_delete_user(self, auth_headers):
        """DELETE /api/users/{id} removes user"""
        unique_id = uuid.uuid4().hex[:8]
        create_resp = requests.post(f"{BASE_URL}/api/users", json={
            "username": f"test_del_{unique_id}",
            "email": f"del_{unique_id}@example.com",
            "password": "testpass123"
        }, headers=auth_headers)
        assert create_resp.status_code == 200
        user_id = create_resp.json()["id"]

        # Delete
        del_resp = requests.delete(f"{BASE_URL}/api/users/{user_id}", headers=auth_headers)
        assert del_resp.status_code == 200

        # Verify deletion
        get_resp = requests.get(f"{BASE_URL}/api/users/{user_id}", headers=auth_headers)
        assert get_resp.status_code == 404
