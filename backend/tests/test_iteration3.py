"""
StreamVault TV - IPTV Service - Iteration 3 Backend API Tests
Tests: Analytics, CVR Storage Config, Hours Requests, Service Config CVR fields,
       Channel Edit (quality_label/channel_type/stream_url), Branding
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://epg-test.preview.emergentagent.com').rstrip('/')

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
        token = response.json().get("access_token")
        print(f"Auth token obtained: {token[:20]}...")
        return token
    pytest.skip(f"Authentication failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="session")
def auth_headers(auth_token):
    """Headers with JWT token"""
    return {"Authorization": f"Bearer {auth_token}"}


# ===== TEST: GET /api/setup/config - returns CVR fields =====

class TestSetupConfig:
    """Test /api/setup/config returns cvr fields"""

    def test_get_config_returns_200(self):
        """GET /api/setup/config should return 200 without auth"""
        response = requests.get(f"{BASE_URL}/api/setup/config")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

    def test_get_config_returns_cvr_fields(self):
        """GET /api/setup/config must include cvr_total_storage_gb, hours_request_min, hours_request_max"""
        response = requests.get(f"{BASE_URL}/api/setup/config")
        assert response.status_code == 200
        data = response.json()
        assert "cvr_total_storage_gb" in data, f"Missing cvr_total_storage_gb in response: {data}"
        assert "hours_request_min" in data, f"Missing hours_request_min in response: {data}"
        assert "hours_request_max" in data, f"Missing hours_request_max in response: {data}"
        assert isinstance(data["cvr_total_storage_gb"], int), "cvr_total_storage_gb should be int"
        assert isinstance(data["hours_request_min"], int), "hours_request_min should be int"
        assert isinstance(data["hours_request_max"], int), "hours_request_max should be int"
        print(f"Config CVR fields: storage={data['cvr_total_storage_gb']}GB, min={data['hours_request_min']}h, max={data['hours_request_max']}h")

    def test_get_config_returns_service_name(self):
        """GET /api/setup/config must include service_name"""
        response = requests.get(f"{BASE_URL}/api/setup/config")
        assert response.status_code == 200
        data = response.json()
        assert "service_name" in data, f"Missing service_name in response: {data}"
        assert data["service_name"], "service_name should not be empty"
        print(f"Service name: {data['service_name']}")


# ===== TEST: POST /api/setup/service-config - CVR config save =====

class TestServiceConfigSave:
    """Test /api/setup/service-config saves CVR fields"""

    def test_save_cvr_config_with_service_name_optional(self, auth_headers):
        """POST without service_name should succeed (service_name is optional)"""
        response = requests.post(
            f"{BASE_URL}/api/setup/service-config",
            params={
                "cvr_total_storage_gb": 500,
                "hours_request_min": 96,
                "hours_request_max": 105
            },
            headers=auth_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "message" in data, f"Missing message in response: {data}"
        print(f"CVR config save response: {data}")

    def test_save_cvr_config_persists(self, auth_headers):
        """POST CVR config, then GET config to verify persistence"""
        test_storage = 750
        test_min = 97
        test_max = 110

        # Save new values
        post_response = requests.post(
            f"{BASE_URL}/api/setup/service-config",
            params={
                "cvr_total_storage_gb": test_storage,
                "hours_request_min": test_min,
                "hours_request_max": test_max
            },
            headers=auth_headers
        )
        assert post_response.status_code == 200, f"Save failed: {post_response.status_code}: {post_response.text}"

        # Verify persistence with GET
        get_response = requests.get(f"{BASE_URL}/api/setup/config")
        assert get_response.status_code == 200
        data = get_response.json()
        assert data["cvr_total_storage_gb"] == test_storage, f"Expected {test_storage}, got {data.get('cvr_total_storage_gb')}"
        assert data["hours_request_min"] == test_min, f"Expected {test_min}, got {data.get('hours_request_min')}"
        assert data["hours_request_max"] == test_max, f"Expected {test_max}, got {data.get('hours_request_max')}"
        print(f"CVR config persisted: storage={data['cvr_total_storage_gb']}GB, min={data['hours_request_min']}h, max={data['hours_request_max']}h")

    def test_save_cvr_config_requires_auth(self):
        """POST /api/setup/service-config without auth should return 401"""
        response = requests.post(
            f"{BASE_URL}/api/setup/service-config",
            params={"cvr_total_storage_gb": 500}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"

    def test_save_service_name_only(self, auth_headers):
        """POST with only service_name should succeed"""
        response = requests.post(
            f"{BASE_URL}/api/setup/service-config",
            params={"service_name": "StreamVault TV"},
            headers=auth_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

        # Verify persistence
        get_response = requests.get(f"{BASE_URL}/api/setup/config")
        assert get_response.status_code == 200
        data = get_response.json()
        assert data["service_name"] == "StreamVault TV", f"Expected 'StreamVault TV', got {data.get('service_name')}"
        print(f"Service name saved: {data['service_name']}")


# ===== TEST: GET /api/stats/analytics =====

class TestAnalytics:
    """Test analytics endpoint"""

    def test_analytics_requires_auth(self):
        """GET /api/stats/analytics without auth should return 401"""
        response = requests.get(f"{BASE_URL}/api/stats/analytics")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"

    def test_analytics_returns_200_with_auth(self, auth_headers):
        """GET /api/stats/analytics should return 200 with auth"""
        response = requests.get(f"{BASE_URL}/api/stats/analytics", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

    def test_analytics_has_required_keys(self, auth_headers):
        """GET /api/stats/analytics must return content_types, genres, storage, counts, recording_hours"""
        response = requests.get(f"{BASE_URL}/api/stats/analytics", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        required_keys = ["content_types", "genres", "storage", "counts", "recording_hours"]
        for key in required_keys:
            assert key in data, f"Missing key '{key}' in analytics response. Keys found: {list(data.keys())}"
        print(f"Analytics keys: {list(data.keys())}")

    def test_analytics_storage_structure(self, auth_headers):
        """Analytics storage field should have proper subkeys"""
        response = requests.get(f"{BASE_URL}/api/stats/analytics", headers=auth_headers)
        assert response.status_code == 200
        storage = response.json().get("storage", {})
        assert "cvr_used_gb" in storage, f"Missing cvr_used_gb in storage: {storage}"
        assert "cvr_total_gb" in storage, f"Missing cvr_total_gb in storage: {storage}"
        assert "disk_free_gb" in storage, f"Missing disk_free_gb in storage: {storage}"
        print(f"Storage info: {storage}")

    def test_analytics_counts_structure(self, auth_headers):
        """Analytics counts field should have channels, media_files, vod_items, etc."""
        response = requests.get(f"{BASE_URL}/api/stats/analytics", headers=auth_headers)
        assert response.status_code == 200
        counts = response.json().get("counts", {})
        assert "channels" in counts, f"Missing channels in counts: {counts}"
        assert "media_files" in counts, f"Missing media_files in counts: {counts}"
        assert "vod_items" in counts, f"Missing vod_items in counts: {counts}"
        assert "total_recordings" in counts, f"Missing total_recordings in counts: {counts}"
        assert "pending_hours_requests" in counts, f"Missing pending_hours_requests in counts: {counts}"
        print(f"Counts: {counts}")

    def test_analytics_recording_hours_structure(self, auth_headers):
        """Analytics recording_hours field should have total_allocated_hours, total_used_hours, average_per_user"""
        response = requests.get(f"{BASE_URL}/api/stats/analytics", headers=auth_headers)
        assert response.status_code == 200
        rec_hours = response.json().get("recording_hours", {})
        assert "total_allocated_hours" in rec_hours, f"Missing total_allocated_hours: {rec_hours}"
        assert "total_used_hours" in rec_hours, f"Missing total_used_hours: {rec_hours}"
        assert "average_per_user" in rec_hours, f"Missing average_per_user: {rec_hours}"
        print(f"Recording hours: {rec_hours}")


# ===== TEST: Hours Requests CRUD =====

class TestHoursRequests:
    """Test hours requests create/read/update workflow"""

    _created_request_id = None

    def test_create_hours_request_public(self, auth_headers):
        """POST /api/security/hours-requests - public endpoint (no auth needed)"""
        # Get current limits first
        config_response = requests.get(f"{BASE_URL}/api/setup/config")
        config = config_response.json()
        min_h = config.get("hours_request_min", 96)
        max_h = config.get("hours_request_max", 105)

        payload = {
            "user_id": f"TEST_user_{uuid.uuid4().hex[:8]}",
            "username": "TEST_testuser",
            "current_hours": 95,
            "requested_hours": min_h,
            "reason": "Need more storage for test"
        }
        response = requests.post(f"{BASE_URL}/api/security/hours-requests", json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "id" in data, f"Missing id in response: {data}"
        assert data["user_id"] == payload["user_id"], f"user_id mismatch"
        assert data["requested_hours"] == min_h, f"requested_hours mismatch"
        assert data["status"] == "pending", f"Expected pending, got {data['status']}"
        TestHoursRequests._created_request_id = data["id"]
        print(f"Created hours request: {data['id']}, status={data['status']}")

    def test_create_hours_request_out_of_range(self):
        """POST with hours outside min/max should return 400"""
        payload = {
            "user_id": f"TEST_user_{uuid.uuid4().hex[:8]}",
            "username": "TEST_outofrange",
            "current_hours": 95,
            "requested_hours": 200,  # Too high
            "reason": "Testing out of range"
        }
        response = requests.post(f"{BASE_URL}/api/security/hours-requests", json=payload)
        assert response.status_code == 400, f"Expected 400 for out-of-range hours, got {response.status_code}: {response.text}"
        print(f"Out-of-range rejected: {response.status_code}")

    def test_get_hours_requests_admin(self, auth_headers):
        """GET /api/security/hours-requests - admin can view all requests"""
        response = requests.get(f"{BASE_URL}/api/security/hours-requests", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), f"Expected list, got {type(data)}"
        print(f"Hours requests count: {len(data)}")

    def test_get_hours_requests_requires_auth(self):
        """GET /api/security/hours-requests without auth should return 401"""
        response = requests.get(f"{BASE_URL}/api/security/hours-requests")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"

    def test_approve_hours_request(self, auth_headers):
        """PUT /api/security/hours-requests/{id} - admin can approve"""
        if not TestHoursRequests._created_request_id:
            pytest.skip("No created request ID available")

        response = requests.put(
            f"{BASE_URL}/api/security/hours-requests/{TestHoursRequests._created_request_id}",
            json={"status": "approved", "admin_note": "Approved by test"},
            headers=auth_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["status"] == "approved", f"Expected approved, got {data['status']}"
        assert data["admin_note"] == "Approved by test", f"admin_note mismatch: {data.get('admin_note')}"
        print(f"Request approved: id={data['id']}, status={data['status']}")

    def test_deny_hours_request(self, auth_headers):
        """PUT /api/security/hours-requests/{id} - admin can deny a new request"""
        # Create a new request to deny
        config_response = requests.get(f"{BASE_URL}/api/setup/config")
        config = config_response.json()
        min_h = config.get("hours_request_min", 96)

        payload = {
            "user_id": f"TEST_user_{uuid.uuid4().hex[:8]}",
            "username": "TEST_deny_user",
            "current_hours": 95,
            "requested_hours": min_h,
            "reason": "Test denial"
        }
        create_response = requests.post(f"{BASE_URL}/api/security/hours-requests", json=payload)
        assert create_response.status_code == 200
        req_id = create_response.json()["id"]

        # Deny the request
        deny_response = requests.put(
            f"{BASE_URL}/api/security/hours-requests/{req_id}",
            json={"status": "denied", "admin_note": "Denied by test"},
            headers=auth_headers
        )
        assert deny_response.status_code == 200, f"Expected 200, got {deny_response.status_code}: {deny_response.text}"
        data = deny_response.json()
        assert data["status"] == "denied", f"Expected denied, got {data['status']}"
        print(f"Request denied: id={data['id']}, status={data['status']}")

    def test_update_hours_request_requires_auth(self):
        """PUT /api/security/hours-requests/{id} without auth should return 401"""
        response = requests.put(
            f"{BASE_URL}/api/security/hours-requests/nonexistent-id",
            json={"status": "approved"}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"

    def test_update_nonexistent_request(self, auth_headers):
        """PUT /api/security/hours-requests/{id} with non-existent ID should return 404"""
        response = requests.put(
            f"{BASE_URL}/api/security/hours-requests/nonexistent-request-id",
            json={"status": "approved"},
            headers=auth_headers
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"


# ===== TEST: Channel Edit - quality_label, channel_type, stream_url fields =====

class TestChannelEditFields:
    """Test channel CRUD preserves quality_label, channel_type, stream_url"""

    _created_channel_id = None

    def test_create_channel_with_all_fields(self, auth_headers):
        """POST /api/channels with quality_label, channel_type, stream_url"""
        payload = {
            "name": "TEST_4K Sports Channel",
            "number": "9991",
            "description": "Test 4K channel",
            "quality_label": "4K",
            "channel_type": "live",
            "stream_url": "rtmp://test.example.com/live/4k"
        }
        response = requests.post(f"{BASE_URL}/api/channels", json=payload, headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("quality_label") == "4K", f"quality_label not preserved: {data.get('quality_label')}"
        assert data.get("channel_type") == "live", f"channel_type not preserved: {data.get('channel_type')}"
        assert data.get("stream_url") == "rtmp://test.example.com/live/4k", f"stream_url not preserved"
        TestChannelEditFields._created_channel_id = data["id"]
        print(f"Created channel: {data['id']}, quality={data.get('quality_label')}, type={data.get('channel_type')}")

    def test_get_channel_returns_all_fields(self, auth_headers):
        """GET /api/channels/{id} should return quality_label, channel_type, stream_url"""
        if not TestChannelEditFields._created_channel_id:
            pytest.skip("No channel created")

        response = requests.get(f"{BASE_URL}/api/channels/{TestChannelEditFields._created_channel_id}", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("quality_label") == "4K", f"Expected 4K, got {data.get('quality_label')}"
        assert data.get("channel_type") == "live", f"Expected live, got {data.get('channel_type')}"
        assert data.get("stream_url") == "rtmp://test.example.com/live/4k", f"stream_url mismatch"

    def test_update_channel_preserves_quality_fields(self, auth_headers):
        """PUT /api/channels/{id} should preserve quality_label, channel_type, stream_url"""
        if not TestChannelEditFields._created_channel_id:
            pytest.skip("No channel created")

        update_payload = {
            "name": "TEST_4K Sports Channel Updated",
            "number": "9991",
            "quality_label": "4K",
            "channel_type": "vod",
            "stream_url": "rtmp://test.example.com/live/4k_v2"
        }
        response = requests.put(
            f"{BASE_URL}/api/channels/{TestChannelEditFields._created_channel_id}",
            json=update_payload,
            headers=auth_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("quality_label") == "4K", f"quality_label lost after update"
        assert data.get("channel_type") == "vod", f"channel_type not updated"
        assert data.get("stream_url") == "rtmp://test.example.com/live/4k_v2", f"stream_url not updated"
        print(f"Channel updated: quality={data.get('quality_label')}, type={data.get('channel_type')}")

    def test_cleanup_created_channel(self, auth_headers):
        """DELETE TEST_ channel created during testing"""
        if not TestChannelEditFields._created_channel_id:
            pytest.skip("No channel to cleanup")

        response = requests.delete(
            f"{BASE_URL}/api/channels/{TestChannelEditFields._created_channel_id}",
            headers=auth_headers
        )
        assert response.status_code in [200, 204], f"Delete failed: {response.status_code}"
        print(f"Cleaned up test channel: {TestChannelEditFields._created_channel_id}")


# ===== TEST: Restore CVR config defaults after tests =====

class TestRestoreDefaults:
    """Restore default config after CVR persistence test"""

    def test_restore_default_cvr_config(self, auth_headers):
        """Restore cvr config to default values after testing"""
        response = requests.post(
            f"{BASE_URL}/api/setup/service-config",
            params={
                "cvr_total_storage_gb": 500,
                "hours_request_min": 96,
                "hours_request_max": 105
            },
            headers=auth_headers
        )
        assert response.status_code == 200, f"Restore failed: {response.status_code}: {response.text}"
        print("CVR config restored to defaults")
