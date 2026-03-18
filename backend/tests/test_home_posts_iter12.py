"""
Backend tests for Home Posts CRUD API (/api/home-posts)
Tests: public GET, admin GET all, create, update, delete, category validation
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


# ── Fixtures ───────────────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def admin_token():
    """Get admin JWT token."""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "username": "admin",
        "password": "admin123"
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    return response.json()["access_token"]


@pytest.fixture(scope="module")
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="module")
def created_post_ids():
    """Track IDs of test posts for cleanup."""
    return []


# ── Auth Tests ─────────────────────────────────────────────────────────────────

class TestAdminLogin:
    """Verify admin auth works"""

    def test_admin_login_success(self):
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin", "password": "admin123"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert isinstance(data["access_token"], str)
        assert len(data["access_token"]) > 20

    def test_admin_login_wrong_password(self):
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin", "password": "wrong"
        })
        assert resp.status_code == 401


# ── Public GET ─────────────────────────────────────────────────────────────────

class TestPublicGet:
    """Public endpoint returns only published posts"""

    def test_public_get_returns_200(self):
        resp = requests.get(f"{BASE_URL}/api/home-posts")
        assert resp.status_code == 200

    def test_public_get_returns_list(self):
        resp = requests.get(f"{BASE_URL}/api/home-posts")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_public_get_no_auth_required(self):
        """No Authorization header needed."""
        resp = requests.get(f"{BASE_URL}/api/home-posts")
        assert resp.status_code == 200


# ── Admin GET All ──────────────────────────────────────────────────────────────

class TestAdminGetAll:
    """Admin endpoint requires auth and returns all posts."""

    def test_admin_get_all_requires_auth(self):
        resp = requests.get(f"{BASE_URL}/api/home-posts/admin/all")
        assert resp.status_code == 401

    def test_admin_get_all_with_token(self, admin_token):
        resp = requests.get(f"{BASE_URL}/api/home-posts/admin/all",
                            headers={"Authorization": f"Bearer {admin_token}"})
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)


# ── Create Post ────────────────────────────────────────────────────────────────

class TestCreatePost:
    """Create posts with different categories."""

    def test_create_requires_auth(self):
        resp = requests.post(f"{BASE_URL}/api/home-posts", json={
            "title": "Unauthorized", "body": "body", "category": "app_update"
        })
        assert resp.status_code == 401

    def test_create_app_update_post(self, auth_headers, created_post_ids):
        payload = {
            "title": "TEST_v1.0 Released",
            "body": "First release notes",
            "category": "app_update",
            "is_published": True,
            "version_tag": "v1.0"
        }
        resp = requests.post(f"{BASE_URL}/api/home-posts", json=payload, headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["title"] == "TEST_v1.0 Released"
        assert data["category"] == "app_update"
        assert data["is_published"] is True
        assert data["version_tag"] == "v1.0"
        assert "id" in data
        created_post_ids.append(data["id"])

    def test_create_upcoming_feature_post(self, auth_headers, created_post_ids):
        payload = {
            "title": "TEST_Dark Mode Coming Soon",
            "body": "Dark mode for all screens",
            "category": "upcoming_feature",
            "is_published": True
        }
        resp = requests.post(f"{BASE_URL}/api/home-posts", json=payload, headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["title"] == "TEST_Dark Mode Coming Soon"
        assert data["category"] == "upcoming_feature"
        assert data["is_published"] is True
        created_post_ids.append(data["id"])

    def test_create_post_invalid_category(self, auth_headers):
        payload = {
            "title": "TEST_Invalid Cat",
            "body": "body",
            "category": "invalid_category"
        }
        resp = requests.post(f"{BASE_URL}/api/home-posts", json=payload, headers=auth_headers)
        assert resp.status_code == 400

    def test_create_draft_post(self, auth_headers, created_post_ids):
        payload = {
            "title": "TEST_Draft Post",
            "body": "This is a draft",
            "category": "app_update",
            "is_published": False
        }
        resp = requests.post(f"{BASE_URL}/api/home-posts", json=payload, headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["is_published"] is False
        created_post_ids.append(data["id"])


# ── Read / Verify Persistence ──────────────────────────────────────────────────

class TestPublishFilter:
    """Draft posts should not appear in public GET."""

    @pytest.fixture(autouse=True)
    def setup_post(self, auth_headers):
        # Create one published + one draft
        pub = requests.post(f"{BASE_URL}/api/home-posts", json={
            "title": "TEST_Published Post Filter",
            "body": "visible",
            "category": "app_update",
            "is_published": True
        }, headers=auth_headers).json()

        draft = requests.post(f"{BASE_URL}/api/home-posts", json={
            "title": "TEST_Draft Post Filter",
            "body": "hidden",
            "category": "app_update",
            "is_published": False
        }, headers=auth_headers).json()

        self.pub_id = pub["id"]
        self.draft_id = draft["id"]
        yield
        # Cleanup
        for pid in [self.pub_id, self.draft_id]:
            requests.delete(f"{BASE_URL}/api/home-posts/{pid}", headers=auth_headers)

    def test_public_shows_published_not_draft(self, auth_headers):
        public_posts = requests.get(f"{BASE_URL}/api/home-posts").json()
        pub_ids = {p["id"] for p in public_posts}
        assert self.pub_id in pub_ids, "Published post should be in public list"
        assert self.draft_id not in pub_ids, "Draft post should NOT be in public list"

    def test_admin_all_shows_both(self, auth_headers):
        all_posts = requests.get(f"{BASE_URL}/api/home-posts/admin/all", headers=auth_headers).json()
        all_ids = {p["id"] for p in all_posts}
        assert self.pub_id in all_ids
        assert self.draft_id in all_ids


# ── Update Post ────────────────────────────────────────────────────────────────

class TestUpdatePost:
    """Update fields and verify persistence."""

    @pytest.fixture(autouse=True)
    def setup_post(self, auth_headers):
        resp = requests.post(f"{BASE_URL}/api/home-posts", json={
            "title": "TEST_Update Original Title",
            "body": "Original body",
            "category": "app_update",
            "is_published": True
        }, headers=auth_headers)
        self.post_id = resp.json()["id"]
        self.auth_headers = auth_headers
        yield
        requests.delete(f"{BASE_URL}/api/home-posts/{self.post_id}", headers=auth_headers)

    def test_update_title(self):
        resp = requests.put(f"{BASE_URL}/api/home-posts/{self.post_id}",
                            json={"title": "TEST_Updated Title"},
                            headers=self.auth_headers)
        assert resp.status_code == 200
        assert resp.json()["title"] == "TEST_Updated Title"

    def test_update_toggle_unpublish(self):
        resp = requests.put(f"{BASE_URL}/api/home-posts/{self.post_id}",
                            json={"is_published": False},
                            headers=self.auth_headers)
        assert resp.status_code == 200
        assert resp.json()["is_published"] is False

    def test_update_toggle_republish(self):
        # First unpublish
        requests.put(f"{BASE_URL}/api/home-posts/{self.post_id}",
                     json={"is_published": False}, headers=self.auth_headers)
        # Then republish
        resp = requests.put(f"{BASE_URL}/api/home-posts/{self.post_id}",
                            json={"is_published": True}, headers=self.auth_headers)
        assert resp.status_code == 200
        assert resp.json()["is_published"] is True

    def test_update_not_found(self):
        resp = requests.put(f"{BASE_URL}/api/home-posts/nonexistent-id-xyz",
                            json={"title": "New"},
                            headers=self.auth_headers)
        assert resp.status_code == 404

    def test_update_requires_auth(self):
        resp = requests.put(f"{BASE_URL}/api/home-posts/{self.post_id}",
                            json={"title": "New"})
        assert resp.status_code == 401


# ── Delete Post ────────────────────────────────────────────────────────────────

class TestDeletePost:
    """Delete a post and verify it's gone."""

    def test_delete_post(self, auth_headers):
        # Create a post to delete
        create_resp = requests.post(f"{BASE_URL}/api/home-posts", json={
            "title": "TEST_Post To Delete",
            "body": "will be deleted",
            "category": "upcoming_feature",
            "is_published": True
        }, headers=auth_headers)
        assert create_resp.status_code == 200
        post_id = create_resp.json()["id"]

        # Delete it
        del_resp = requests.delete(f"{BASE_URL}/api/home-posts/{post_id}", headers=auth_headers)
        assert del_resp.status_code == 200
        assert "deleted" in del_resp.json().get("message", "").lower()

        # Verify removed from public list
        public_posts = requests.get(f"{BASE_URL}/api/home-posts").json()
        assert post_id not in {p["id"] for p in public_posts}

    def test_delete_not_found(self, auth_headers):
        resp = requests.delete(f"{BASE_URL}/api/home-posts/nonexistent-xyz", headers=auth_headers)
        assert resp.status_code == 404

    def test_delete_requires_auth(self, auth_headers):
        # Create first
        create_resp = requests.post(f"{BASE_URL}/api/home-posts", json={
            "title": "TEST_Unauthorized Delete",
            "body": "body",
            "category": "app_update"
        }, headers=auth_headers)
        post_id = create_resp.json()["id"]
        # Try to delete without auth
        resp = requests.delete(f"{BASE_URL}/api/home-posts/{post_id}")
        assert resp.status_code == 401
        # Cleanup
        requests.delete(f"{BASE_URL}/api/home-posts/{post_id}", headers=auth_headers)


# ── Cleanup Module-Scoped Posts ────────────────────────────────────────────────

@pytest.fixture(scope="module", autouse=True)
def cleanup_module_posts(request, auth_headers, created_post_ids):
    """Delete any TEST_ posts created at module scope after all tests run."""
    yield
    for pid in created_post_ids:
        try:
            requests.delete(f"{BASE_URL}/api/home-posts/{pid}", headers=auth_headers)
        except Exception:
            pass
