"""
StreamVault TV - IPTV Service - New Features Backend API Tests (Iteration 2)
Tests new endpoints: Media Library, VOD, Notifications, CVR/Recordings, Branding/Setup Config
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://vault-epg-test.preview.emergentagent.com').rstrip('/')

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


# ===== PUBLIC ENDPOINT TESTS =====

class TestPublicEndpoints:
    """Tests for public (no-auth) endpoints"""

    def test_vod_returns_200_public(self):
        """GET /api/vod should return 200 without auth token"""
        response = requests.get(f"{BASE_URL}/api/vod")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), f"Expected list, got {type(data)}"
        print(f"VOD public: {len(data)} items returned")

    def test_notifications_returns_200_public(self):
        """GET /api/notifications should return 200 without auth token"""
        response = requests.get(f"{BASE_URL}/api/notifications")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), f"Expected list, got {type(data)}"
        print(f"Notifications public: {len(data)} items returned")

    def test_setup_config_returns_200_public(self):
        """GET /api/setup/config should return 200 without auth"""
        response = requests.get(f"{BASE_URL}/api/setup/config")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "service_name" in data, f"Missing service_name in: {data}"
        assert "logo_path" in data, f"Missing logo_path in: {data}"
        print(f"Setup config: service_name={data['service_name']}, logo_path={data['logo_path']}")

    def test_vod_category_filter(self):
        """GET /api/vod?category=movie should filter by category"""
        response = requests.get(f"{BASE_URL}/api/vod", params={"category": "movie"})
        assert response.status_code == 200
        data = response.json()
        for item in data:
            assert item.get("category") == "movie", f"Unexpected category: {item.get('category')}"
        print(f"VOD category filter: {len(data)} movie items")


# ===== AUTH-REQUIRED ENDPOINT TESTS =====

class TestAuthRequiredEndpoints:
    """Tests that protected endpoints require auth"""

    def test_media_requires_auth_401(self):
        """GET /api/media without token should return 401"""
        response = requests.get(f"{BASE_URL}/api/media")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        print(f"Media without auth: {response.status_code} (correct)")

    def test_media_returns_200_with_auth(self, auth_headers):
        """GET /api/media with valid token should return 200"""
        response = requests.get(f"{BASE_URL}/api/media", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), f"Expected list, got {type(data)}"
        print(f"Media with auth: {len(data)} items returned")

    def test_recordings_requires_auth_401(self):
        """GET /api/recordings without token should return 401"""
        response = requests.get(f"{BASE_URL}/api/recordings")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        print(f"Recordings without auth: {response.status_code} (correct)")

    def test_recordings_returns_200_with_auth(self, auth_headers):
        """GET /api/recordings with valid token should return 200"""
        response = requests.get(f"{BASE_URL}/api/recordings", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"Recordings with auth: {len(data)} items returned")

    def test_notifications_post_requires_auth_401(self):
        """POST /api/notifications without token should return 401"""
        response = requests.post(f"{BASE_URL}/api/notifications", json={
            "title": "Test",
            "message": "Test message",
            "type": "system"
        })
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        print(f"POST notifications without auth: {response.status_code} (correct)")

    def test_vod_post_requires_auth_401(self):
        """POST /api/vod without token should return 401"""
        response = requests.post(f"{BASE_URL}/api/vod", json={
            "title": "Test VOD",
            "category": "movie"
        })
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        print(f"POST vod without auth: {response.status_code} (correct)")


# ===== NOTIFICATIONS CRUD TESTS =====

class TestNotificationsCRUD:
    """Create, Read, Delete notifications"""

    def test_create_notification_with_auth(self, auth_headers):
        """POST /api/notifications with valid token creates notification"""
        payload = {
            "title": "TEST_New Movie Available",
            "message": "Test notification for movie release",
            "type": "movie"
        }
        response = requests.post(f"{BASE_URL}/api/notifications", json=payload, headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["title"] == payload["title"], f"Title mismatch: {data}"
        assert data["message"] == payload["message"]
        assert data["type"] == payload["type"]
        assert "id" in data
        assert data.get("is_active") == True
        print(f"Created notification: {data['id']}, title={data['title']}")
        return data["id"]

    def test_notification_visible_in_public_list(self, auth_headers):
        """Notification created should appear in GET /api/notifications (public)"""
        # Create notification first
        unique_title = f"TEST_Notification_{uuid.uuid4().hex[:8]}"
        payload = {
            "title": unique_title,
            "message": "Notification visibility test",
            "type": "system"
        }
        create_response = requests.post(f"{BASE_URL}/api/notifications", json=payload, headers=auth_headers)
        assert create_response.status_code == 200
        created_id = create_response.json()["id"]

        # Check public list contains notification (default active_only=True, and is_active=True by default)
        get_response = requests.get(f"{BASE_URL}/api/notifications")
        assert get_response.status_code == 200
        notifications = get_response.json()
        ids = [n["id"] for n in notifications]
        assert created_id in ids, f"Created notification {created_id} not found in public list. Got IDs: {ids}"
        print(f"Notification {created_id} visible in public list: YES")

        # Cleanup
        requests.delete(f"{BASE_URL}/api/notifications/{created_id}", headers=auth_headers)

    def test_notification_type_filter(self, auth_headers):
        """GET /api/notifications?type=system should filter by type"""
        # Create a system notification
        payload = {"title": "TEST_System notif", "message": "System msg", "type": "system"}
        create_response = requests.post(f"{BASE_URL}/api/notifications", json=payload, headers=auth_headers)
        assert create_response.status_code == 200
        created_id = create_response.json()["id"]

        # Filter by type
        get_response = requests.get(f"{BASE_URL}/api/notifications", params={"type": "system", "active_only": False})
        assert get_response.status_code == 200
        for item in get_response.json():
            assert item.get("type") == "system", f"Unexpected type: {item.get('type')}"
        print("Notification type filter works correctly")

        # Cleanup
        requests.delete(f"{BASE_URL}/api/notifications/{created_id}", headers=auth_headers)

    def test_notification_update(self, auth_headers):
        """PUT /api/notifications/{id} should update notification"""
        payload = {"title": "TEST_Update Me", "message": "Before update", "type": "system"}
        create_response = requests.post(f"{BASE_URL}/api/notifications", json=payload, headers=auth_headers)
        assert create_response.status_code == 200
        notif_id = create_response.json()["id"]

        # Update
        update_response = requests.put(f"{BASE_URL}/api/notifications/{notif_id}",
            json={"title": "TEST_Updated Title"}, headers=auth_headers)
        assert update_response.status_code == 200
        updated = update_response.json()
        assert updated["title"] == "TEST_Updated Title"

        # Verify with GET (admin)
        get_response = requests.get(f"{BASE_URL}/api/notifications",
            params={"active_only": False}, headers=auth_headers)
        assert get_response.status_code == 200
        items = get_response.json()
        found = next((n for n in items if n["id"] == notif_id), None)
        assert found is not None
        assert found["title"] == "TEST_Updated Title"
        print(f"Notification updated successfully: {found['title']}")

        # Cleanup
        requests.delete(f"{BASE_URL}/api/notifications/{notif_id}", headers=auth_headers)

    def test_notification_delete(self, auth_headers):
        """DELETE /api/notifications/{id} should delete notification"""
        payload = {"title": "TEST_Delete Me", "message": "To be deleted", "type": "system"}
        create_response = requests.post(f"{BASE_URL}/api/notifications", json=payload, headers=auth_headers)
        assert create_response.status_code == 200
        notif_id = create_response.json()["id"]

        # Delete
        delete_response = requests.delete(f"{BASE_URL}/api/notifications/{notif_id}", headers=auth_headers)
        assert delete_response.status_code == 200

        # Verify gone
        get_response = requests.get(f"{BASE_URL}/api/notifications", params={"active_only": False})
        ids = [n["id"] for n in get_response.json()]
        assert notif_id not in ids
        print(f"Notification {notif_id} deleted successfully")


# ===== VOD CRUD TESTS =====

class TestVODCRUD:
    """Create, Read, Update, Delete VOD items"""

    def test_create_vod_with_auth(self, auth_headers):
        """POST /api/vod with valid token creates VOD item"""
        payload = {
            "title": "TEST_VOD Movie",
            "description": "Test VOD description",
            "category": "movie",
            "genre": "Action",
            "year": 2024,
            "rating": "PG-13",
            "is_featured": False
        }
        response = requests.post(f"{BASE_URL}/api/vod", json=payload, headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["title"] == payload["title"]
        assert data["category"] == payload["category"]
        assert "id" in data
        print(f"Created VOD: {data['id']}, title={data['title']}")
        return data["id"]

    def test_vod_visible_in_public_list(self, auth_headers):
        """VOD item created should appear in GET /api/vod (public)"""
        unique_title = f"TEST_VOD_{uuid.uuid4().hex[:8]}"
        payload = {
            "title": unique_title,
            "category": "movie",
            "description": "Visibility test"
        }
        create_response = requests.post(f"{BASE_URL}/api/vod", json=payload, headers=auth_headers)
        assert create_response.status_code == 200
        created_id = create_response.json()["id"]

        # Check public list
        get_response = requests.get(f"{BASE_URL}/api/vod")
        assert get_response.status_code == 200
        ids = [v["id"] for v in get_response.json()]
        assert created_id in ids, f"Created VOD {created_id} not found in public list. Got: {ids}"
        print(f"VOD {created_id} visible in public list: YES")

        # Cleanup
        requests.delete(f"{BASE_URL}/api/vod/{created_id}", headers=auth_headers)

    def test_vod_update(self, auth_headers):
        """PUT /api/vod/{id} should update VOD item"""
        payload = {"title": "TEST_VOD Update Me", "category": "tv_show"}
        create_response = requests.post(f"{BASE_URL}/api/vod", json=payload, headers=auth_headers)
        assert create_response.status_code == 200
        vod_id = create_response.json()["id"]

        update_response = requests.put(f"{BASE_URL}/api/vod/{vod_id}",
            json={"title": "TEST_VOD Updated", "is_featured": True}, headers=auth_headers)
        assert update_response.status_code == 200
        updated = update_response.json()
        assert updated["title"] == "TEST_VOD Updated"
        assert updated["is_featured"] == True
        print(f"VOD updated: {updated['title']}, featured={updated['is_featured']}")

        # Cleanup
        requests.delete(f"{BASE_URL}/api/vod/{vod_id}", headers=auth_headers)

    def test_vod_delete(self, auth_headers):
        """DELETE /api/vod/{id} should delete VOD item"""
        payload = {"title": "TEST_VOD Delete Me", "category": "movie"}
        create_response = requests.post(f"{BASE_URL}/api/vod", json=payload, headers=auth_headers)
        assert create_response.status_code == 200
        vod_id = create_response.json()["id"]

        delete_response = requests.delete(f"{BASE_URL}/api/vod/{vod_id}", headers=auth_headers)
        assert delete_response.status_code == 200

        # Verify gone
        get_response = requests.get(f"{BASE_URL}/api/vod")
        ids = [v["id"] for v in get_response.json()]
        assert vod_id not in ids
        print(f"VOD {vod_id} deleted successfully")


# ===== RECORDINGS / CVR TESTS =====

class TestRecordingsCVR:
    """CVR recording endpoints"""

    def test_recording_stats_with_auth(self, auth_headers):
        """GET /api/recordings/stats/summary requires auth"""
        response = requests.get(f"{BASE_URL}/api/recordings/stats/summary", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "total" in data, f"Missing 'total' in: {data}"
        assert "scheduled" in data
        assert "completed" in data
        assert "failed" in data
        print(f"Recording stats: {data}")

    def test_recording_stats_without_auth(self):
        """GET /api/recordings/stats/summary should return 401 without auth"""
        response = requests.get(f"{BASE_URL}/api/recordings/stats/summary")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print(f"Recording stats without auth: {response.status_code} (correct)")


# ===== SETUP / BRANDING TESTS =====

class TestSetupBranding:
    """Setup and branding endpoints"""

    def test_setup_config_has_service_name_and_logo(self):
        """GET /api/setup/config returns both service_name and logo_path"""
        response = requests.get(f"{BASE_URL}/api/setup/config")
        assert response.status_code == 200
        data = response.json()
        assert "service_name" in data, f"Missing service_name: {data}"
        assert "logo_path" in data, f"Missing logo_path: {data}"
        # logo_path can be None (no logo uploaded yet)
        assert isinstance(data["service_name"], str)
        print(f"Config - service_name: {data['service_name']}, logo_path: {data['logo_path']}")

    def test_master_pin_requires_auth(self):
        """POST /api/auth/master-pin requires auth"""
        response = requests.post(f"{BASE_URL}/api/auth/master-pin", json={
            "current_pin": "",
            "new_pin": "1234"
        })
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print(f"Master PIN without auth: {response.status_code} (correct)")


# ===== MEDIA LIBRARY TESTS =====

class TestMediaLibrary:
    """Media library endpoints"""

    def test_media_list_returns_empty_or_list(self, auth_headers):
        """GET /api/media with auth returns list"""
        response = requests.get(f"{BASE_URL}/api/media", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Media library: {len(data)} items")

    def test_media_type_filter(self, auth_headers):
        """GET /api/media?media_type=movie filters correctly"""
        response = requests.get(f"{BASE_URL}/api/media", params={"media_type": "movie"}, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        for item in data:
            assert item.get("media_type") == "movie"
        print(f"Media type filter: {len(data)} movies")
