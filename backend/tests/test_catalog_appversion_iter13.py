"""
Iteration 13 Backend Tests
- Media Catalog CRUD: POST, GET, PUT, DELETE /api/catalog
- Cast management: POST, DELETE /api/catalog/{id}/cast
- App Version: GET /api/app-version
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

ADMIN_CREDS = {"username": "admin", "password": "admin123"}
TEST_ENTRY_TITLE = "TEST_Inception_Iter13"


@pytest.fixture(scope="module")
def admin_token():
    resp = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDS)
    assert resp.status_code == 200, f"Login failed: {resp.text}"
    return resp.json()["access_token"]


@pytest.fixture(scope="module")
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


# ── App Version ───────────────────────────────────────────────────────────────

class TestAppVersion:
    """Tests for GET /api/app-version"""

    def test_get_app_version_returns_200(self):
        resp = requests.get(f"{BASE_URL}/api/app-version")
        assert resp.status_code == 200, f"Expected 200 got {resp.status_code}: {resp.text}"

    def test_get_app_version_has_version_field(self):
        resp = requests.get(f"{BASE_URL}/api/app-version")
        data = resp.json()
        assert "version" in data, f"Missing 'version' in response: {data}"

    def test_get_app_version_correct_value(self):
        resp = requests.get(f"{BASE_URL}/api/app-version")
        data = resp.json()
        assert data["version"] == "0.94.0.1.A (Alpha build)", (
            f"Expected '0.94.0.1.A (Alpha build)', got '{data['version']}'"
        )

    def test_get_app_version_has_sections_field(self):
        resp = requests.get(f"{BASE_URL}/api/app-version")
        data = resp.json()
        assert "sections" in data, f"Missing 'sections' in response: {data}"
        assert isinstance(data["sections"], list), "sections should be a list"

    def test_app_version_no_mongodb_id_leak(self):
        resp = requests.get(f"{BASE_URL}/api/app-version")
        data = resp.json()
        assert "_id" not in data, "MongoDB _id should not be in response"


# ── Catalog List ──────────────────────────────────────────────────────────────

class TestCatalogList:
    """Tests for GET /api/catalog"""

    def test_get_catalog_returns_200(self):
        resp = requests.get(f"{BASE_URL}/api/catalog")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"

    def test_get_catalog_returns_list(self):
        resp = requests.get(f"{BASE_URL}/api/catalog")
        data = resp.json()
        assert isinstance(data, list), f"Expected list, got {type(data)}"

    def test_get_catalog_filter_by_type(self):
        resp = requests.get(f"{BASE_URL}/api/catalog", params={"content_type": "movie"})
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        # All returned entries should be movies
        for entry in data:
            assert entry.get("content_type") == "movie", (
                f"Expected content_type=movie, got {entry.get('content_type')}"
            )


# ── Catalog CRUD ──────────────────────────────────────────────────────────────

class TestCatalogCRUD:
    """CRUD: Create, Read, Update, Delete catalog entries"""
    created_id = None  # shared across tests in class

    def test_create_catalog_requires_auth(self):
        """POST without auth should be 401"""
        resp = requests.post(f"{BASE_URL}/api/catalog", json={"title": "Unauthed"})
        assert resp.status_code == 401, f"Expected 401 without auth, got {resp.status_code}"

    def test_create_catalog_entry(self, auth_headers):
        payload = {
            "title": TEST_ENTRY_TITLE,
            "content_type": "movie",
            "genres": ["Action", "Sci-Fi"],
            "director": "Christopher Nolan",
            "release_date": "2010-07-16",
            "runtime_minutes": 148,
            "rating": "PG-13",
            "description": "A dream heist film"
        }
        resp = requests.post(f"{BASE_URL}/api/catalog", json=payload, headers=auth_headers)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert data["title"] == TEST_ENTRY_TITLE
        assert data["content_type"] == "movie"
        assert data["director"] == "Christopher Nolan"
        assert "id" in data
        assert "_id" not in data, "MongoDB _id should not be in response"
        TestCatalogCRUD.created_id = data["id"]

    def test_get_created_entry(self, auth_headers):
        """Verify the created entry is retrievable"""
        entry_id = TestCatalogCRUD.created_id
        if not entry_id:
            pytest.skip("No created entry ID available")
        resp = requests.get(f"{BASE_URL}/api/catalog/{entry_id}")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        data = resp.json()
        assert data["title"] == TEST_ENTRY_TITLE
        assert data["director"] == "Christopher Nolan"
        assert data["rating"] == "PG-13"
        assert data["runtime_minutes"] == 148
        assert "_id" not in data

    def test_entry_appears_in_list(self):
        """Entry should appear in the catalog list"""
        entry_id = TestCatalogCRUD.created_id
        if not entry_id:
            pytest.skip("No created entry ID available")
        resp = requests.get(f"{BASE_URL}/api/catalog")
        assert resp.status_code == 200
        ids = [e["id"] for e in resp.json()]
        assert entry_id in ids, f"Created entry {entry_id} not found in catalog list"

    def test_update_catalog_entry(self, auth_headers):
        """PUT should update the entry"""
        entry_id = TestCatalogCRUD.created_id
        if not entry_id:
            pytest.skip("No created entry ID available")
        update = {"description": "Updated: A mind-bending dream heist thriller"}
        resp = requests.put(f"{BASE_URL}/api/catalog/{entry_id}", json=update, headers=auth_headers)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert data["description"] == "Updated: A mind-bending dream heist thriller"

    def test_update_persisted_via_get(self, auth_headers):
        """Verify update is persisted in the database"""
        entry_id = TestCatalogCRUD.created_id
        if not entry_id:
            pytest.skip("No created entry ID available")
        resp = requests.get(f"{BASE_URL}/api/catalog/{entry_id}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["description"] == "Updated: A mind-bending dream heist thriller"

    def test_update_requires_auth(self):
        """PUT without auth should be 401"""
        entry_id = TestCatalogCRUD.created_id
        if not entry_id:
            pytest.skip("No created entry ID available")
        resp = requests.put(f"{BASE_URL}/api/catalog/{entry_id}", json={"description": "Hack"})
        assert resp.status_code == 401

    def test_update_not_found_404(self, auth_headers):
        """PUT on nonexistent ID should be 404"""
        resp = requests.put(f"{BASE_URL}/api/catalog/nonexistent-id", json={"description": "X"},
                            headers=auth_headers)
        assert resp.status_code == 404

    def test_get_not_found_404(self):
        """GET on nonexistent ID should be 404"""
        resp = requests.get(f"{BASE_URL}/api/catalog/nonexistent-id-xyz")
        assert resp.status_code == 404


# ── Cast Management ───────────────────────────────────────────────────────────

class TestCatalogCast:
    """Cast member add and remove"""

    def test_add_cast_member(self, auth_headers):
        entry_id = TestCatalogCRUD.created_id
        if not entry_id:
            pytest.skip("No created entry ID available")
        resp = requests.post(
            f"{BASE_URL}/api/catalog/{entry_id}/cast",
            params={"name": "Christian Bale", "character": "Cobb"},
            headers=auth_headers
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert data["name"] == "Christian Bale"
        assert data["character"] == "Cobb"
        assert "id" in data

    def test_cast_appears_in_entry(self):
        """Cast member should appear in GET entry response"""
        entry_id = TestCatalogCRUD.created_id
        if not entry_id:
            pytest.skip("No created entry ID available")
        resp = requests.get(f"{BASE_URL}/api/catalog/{entry_id}")
        data = resp.json()
        cast = data.get("cast", [])
        names = [m["name"] for m in cast]
        assert "Christian Bale" in names, f"Cast not found in entry. Cast: {names}"

    def test_delete_cast_member(self, auth_headers):
        """Delete first cast member"""
        entry_id = TestCatalogCRUD.created_id
        if not entry_id:
            pytest.skip("No created entry ID available")
        resp = requests.get(f"{BASE_URL}/api/catalog/{entry_id}")
        data = resp.json()
        cast = data.get("cast", [])
        if not cast:
            pytest.skip("No cast members to delete")
        cast_id = cast[0]["id"]
        del_resp = requests.delete(
            f"{BASE_URL}/api/catalog/{entry_id}/cast/{cast_id}",
            headers=auth_headers
        )
        assert del_resp.status_code == 200

    def test_cast_removed_from_entry(self):
        """Verify cast member removed from entry"""
        entry_id = TestCatalogCRUD.created_id
        if not entry_id:
            pytest.skip("No created entry ID available")
        resp = requests.get(f"{BASE_URL}/api/catalog/{entry_id}")
        data = resp.json()
        cast = data.get("cast", [])
        assert len(cast) == 0, f"Expected 0 cast members after deletion, got {len(cast)}"


# ── Delete Catalog Entry ──────────────────────────────────────────────────────

class TestCatalogDelete:
    """Delete catalog entry (runs last)"""

    def test_delete_requires_auth(self):
        entry_id = TestCatalogCRUD.created_id
        if not entry_id:
            pytest.skip("No created entry ID available")
        resp = requests.delete(f"{BASE_URL}/api/catalog/{entry_id}")
        assert resp.status_code == 401

    def test_delete_catalog_entry(self, auth_headers):
        entry_id = TestCatalogCRUD.created_id
        if not entry_id:
            pytest.skip("No created entry ID available")
        resp = requests.delete(f"{BASE_URL}/api/catalog/{entry_id}", headers=auth_headers)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "message" in data or "deleted" in str(data).lower()

    def test_deleted_entry_returns_404(self):
        """After delete, GET should return 404"""
        entry_id = TestCatalogCRUD.created_id
        if not entry_id:
            pytest.skip("No created entry ID available")
        resp = requests.get(f"{BASE_URL}/api/catalog/{entry_id}")
        assert resp.status_code == 404, f"Expected 404 after delete, got {resp.status_code}"

    def test_deleted_not_in_list(self):
        """After delete, entry should not appear in list"""
        entry_id = TestCatalogCRUD.created_id
        if not entry_id:
            pytest.skip("No created entry ID available")
        resp = requests.get(f"{BASE_URL}/api/catalog")
        ids = [e["id"] for e in resp.json()]
        assert entry_id not in ids, f"Deleted entry {entry_id} still in catalog list"

    def test_delete_not_found_404(self, auth_headers):
        resp = requests.delete(f"{BASE_URL}/api/catalog/nonexistent-id", headers=auth_headers)
        assert resp.status_code == 404
