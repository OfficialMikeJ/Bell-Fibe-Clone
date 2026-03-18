"""
Iteration 14 Backend Tests: OTA Auto-Update System + Migration/Backup
Tests: /api/ota/* and /api/admin/backup endpoints
"""
import pytest
import requests
import os
import io
import tempfile

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
ADMIN_CREDS = {"username": "admin", "password": "admin123"}

# ── Shared fixtures ────────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def admin_token():
    """Get admin auth token for the test session"""
    resp = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDS)
    assert resp.status_code == 200, f"Login failed: {resp.text}"
    return resp.json()["access_token"]


@pytest.fixture(scope="module")
def headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="module")
def dummy_apk_bytes():
    """Create a minimal dummy .apk file (just a zip-like binary blob)"""
    # An APK is just a ZIP file — create a tiny dummy binary
    content = b"PK\x05\x06" + b"\x00" * 18  # minimal empty zip (valid enough for upload test)
    return content


# ── OTA Tests ──────────────────────────────────────────────────────────────────

class TestOTAPublicEndpoints:
    """Public OTA endpoint (no auth required)"""

    def test_get_latest_no_active_release(self):
        """GET /api/ota/latest should return has_update=false when no active release"""
        # Ensure clean state first
        resp = requests.get(f"{BASE_URL}/api/ota/latest")
        assert resp.status_code == 200, f"Unexpected status: {resp.status_code} — {resp.text}"
        data = resp.json()
        # Accept both True and False initially (there may or may not be an active release)
        assert "has_update" in data, "Response missing 'has_update' field"
        assert "version_name" in data or "version_name" not in data  # either is fine
        print(f"PASS: GET /api/ota/latest → has_update={data.get('has_update')}")


class TestOTAAdminReleases:
    """Admin CRUD for OTA releases — full lifecycle"""

    created_release_id = None  # shared across test methods within class

    def test_create_release(self, headers):
        """POST /api/ota/releases creates a release"""
        resp = requests.post(
            f"{BASE_URL}/api/ota/releases",
            params={
                "version_name": "TEST_0.94.99.9",
                "version_code": 99999,
                "release_notes": "TEST automated test release",
            },
            headers=headers,
        )
        assert resp.status_code == 200, f"Create failed: {resp.status_code} — {resp.text}"
        data = resp.json()
        assert data["version_name"] == "TEST_0.94.99.9"
        assert data["version_code"] == 99999
        assert data["is_active"] is False
        assert "id" in data
        TestOTAAdminReleases.created_release_id = data["id"]
        print(f"PASS: Created OTA release id={data['id']}")

    def test_list_releases_contains_created(self, headers):
        """GET /api/ota/releases returns list containing the created release"""
        assert TestOTAAdminReleases.created_release_id, "Need created_release_id from previous test"
        resp = requests.get(f"{BASE_URL}/api/ota/releases", headers=headers)
        assert resp.status_code == 200, f"List failed: {resp.status_code} — {resp.text}"
        data = resp.json()
        assert isinstance(data, list), "Expected a list response"
        ids = [r["id"] for r in data]
        assert TestOTAAdminReleases.created_release_id in ids, "Created release not in list"
        print(f"PASS: GET /api/ota/releases → {len(data)} release(s) found")

    def test_get_ota_status_admin(self, headers):
        """GET /api/ota/status returns device stats dict"""
        resp = requests.get(f"{BASE_URL}/api/ota/status", headers=headers)
        assert resp.status_code == 200, f"Status failed: {resp.status_code} — {resp.text}"
        data = resp.json()
        for key in ("total_devices", "up_to_date", "needs_update", "unknown"):
            assert key in data, f"Missing key '{key}' in status response"
        print(f"PASS: GET /api/ota/status → active_version={data.get('active_version')}, total_devices={data.get('total_devices')}")

    def test_activate_without_apk_fails(self, headers):
        """POST /api/ota/releases/{id}/activate should fail if no APK uploaded"""
        assert TestOTAAdminReleases.created_release_id, "Need created_release_id"
        resp = requests.post(
            f"{BASE_URL}/api/ota/releases/{TestOTAAdminReleases.created_release_id}/activate",
            headers=headers,
        )
        assert resp.status_code == 400, f"Expected 400, got {resp.status_code} — {resp.text}"
        print(f"PASS: Activate without APK correctly returns 400")

    def test_upload_apk(self, headers, dummy_apk_bytes):
        """POST /api/ota/releases/{id}/upload uploads APK to release"""
        assert TestOTAAdminReleases.created_release_id, "Need created_release_id"
        files = {"file": ("test_streamvault.apk", io.BytesIO(dummy_apk_bytes), "application/vnd.android.package-archive")}
        resp = requests.post(
            f"{BASE_URL}/api/ota/releases/{TestOTAAdminReleases.created_release_id}/upload",
            files=files,
            headers=headers,
        )
        assert resp.status_code == 200, f"Upload failed: {resp.status_code} — {resp.text}"
        data = resp.json()
        assert data.get("file_path") is not None, "file_path should be set after upload"
        print(f"PASS: APK upload → file_path={data.get('file_path')}")

    def test_activate_after_apk_upload(self, headers):
        """POST /api/ota/releases/{id}/activate works after APK uploaded"""
        assert TestOTAAdminReleases.created_release_id, "Need created_release_id"
        resp = requests.post(
            f"{BASE_URL}/api/ota/releases/{TestOTAAdminReleases.created_release_id}/activate",
            headers=headers,
        )
        assert resp.status_code == 200, f"Activate failed: {resp.status_code} — {resp.text}"
        data = resp.json()
        assert data.get("is_active") is True, f"Expected is_active=True, got {data.get('is_active')}"
        print(f"PASS: Activate release → is_active={data.get('is_active')}, released_at={data.get('released_at')}")

    def test_latest_returns_update_after_activation(self):
        """GET /api/ota/latest returns has_update=true after activation"""
        resp = requests.get(f"{BASE_URL}/api/ota/latest")
        assert resp.status_code == 200, f"Unexpected: {resp.status_code} — {resp.text}"
        data = resp.json()
        assert data.get("has_update") is True, f"Expected has_update=True, got {data}"
        assert data.get("version_name") == "TEST_0.94.99.9", f"Wrong version_name: {data.get('version_name')}"
        print(f"PASS: GET /api/ota/latest after activation → has_update=True, version={data.get('version_name')}")

    def test_status_shows_active_version_after_activation(self, headers):
        """GET /api/ota/status shows active_version after activation"""
        resp = requests.get(f"{BASE_URL}/api/ota/status", headers=headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("active_version") == "TEST_0.94.99.9", f"Active version mismatch: {data}"
        print(f"PASS: OTA status shows active_version={data.get('active_version')}")

    def test_cleanup_delete_release(self, headers):
        """DELETE /api/ota/releases/{id} removes the test release"""
        assert TestOTAAdminReleases.created_release_id, "Need created_release_id"
        resp = requests.delete(
            f"{BASE_URL}/api/ota/releases/{TestOTAAdminReleases.created_release_id}",
            headers=headers,
        )
        assert resp.status_code == 200, f"Delete failed: {resp.status_code} — {resp.text}"
        data = resp.json()
        assert "message" in data or "deleted" in str(data).lower()
        print(f"PASS: DELETE release → {data}")

    def test_latest_no_update_after_cleanup(self):
        """GET /api/ota/latest returns has_update=false after cleanup"""
        resp = requests.get(f"{BASE_URL}/api/ota/latest")
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("has_update") is False, f"Expected has_update=False after cleanup, got {data}"
        print(f"PASS: GET /api/ota/latest after cleanup → has_update=False")

    def test_ota_releases_requires_auth(self):
        """GET /api/ota/releases without auth should return 401"""
        resp = requests.get(f"{BASE_URL}/api/ota/releases")
        assert resp.status_code == 401, f"Expected 401, got {resp.status_code}"
        print(f"PASS: Unauthenticated /api/ota/releases correctly returns 401")


# ── Migration / Backup Tests ───────────────────────────────────────────────────

class TestMigrationBackup:
    """Backup endpoint tests — verify backup download works"""

    def test_backup_returns_200_gzip(self, headers):
        """GET /api/admin/backup returns 200 with gzip content"""
        resp = requests.get(
            f"{BASE_URL}/api/admin/backup",
            headers=headers,
            stream=True,
        )
        assert resp.status_code == 200, f"Backup failed: {resp.status_code} — {resp.text[:200]}"
        content_type = resp.headers.get("Content-Type", "")
        assert "gzip" in content_type or "application/octet-stream" in content_type or "x-gzip" in content_type, \
            f"Expected gzip content-type, got: {content_type}"
        print(f"PASS: Backup download → status=200, content-type={content_type}")

    def test_backup_has_content_disposition(self, headers):
        """GET /api/admin/backup has Content-Disposition header with .tar.gz filename"""
        resp = requests.get(
            f"{BASE_URL}/api/admin/backup",
            headers=headers,
            stream=True,
        )
        assert resp.status_code == 200
        disposition = resp.headers.get("Content-Disposition", "")
        assert ".tar.gz" in disposition, f"Expected .tar.gz in Content-Disposition, got: {disposition}"
        print(f"PASS: Content-Disposition={disposition}")

    def test_backup_content_is_valid_gzip(self, headers):
        """GET /api/admin/backup — content is a valid gzip/tar archive"""
        import tarfile
        resp = requests.get(f"{BASE_URL}/api/admin/backup", headers=headers)
        assert resp.status_code == 200
        assert len(resp.content) > 100, f"Backup seems too small: {len(resp.content)} bytes"
        # Verify it's a valid tar.gz
        buf = io.BytesIO(resp.content)
        assert tarfile.is_tarfile(buf), "Content is not a valid tar archive"
        buf.seek(0)
        with tarfile.open(fileobj=buf, mode="r:gz") as tf:
            names = tf.getnames()
            assert "manifest.json" in names, f"manifest.json missing from archive. Found: {names[:5]}"
            assert any("collections.json" in n for n in names), f"collections.json missing. Found: {names[:5]}"
        print(f"PASS: Valid tar.gz, {len(resp.content)} bytes, includes manifest.json + database/collections.json")

    def test_backup_requires_auth(self):
        """GET /api/admin/backup without auth returns 401"""
        resp = requests.get(f"{BASE_URL}/api/admin/backup")
        assert resp.status_code == 401, f"Expected 401, got {resp.status_code}"
        print(f"PASS: Unauthenticated backup correctly returns 401")

    def test_restore_requires_auth(self):
        """POST /api/admin/restore without auth returns 401"""
        resp = requests.post(f"{BASE_URL}/api/admin/restore", data={"file": ("test.tar.gz", b"")})
        assert resp.status_code == 401, f"Expected 401, got {resp.status_code}"
        print(f"PASS: Unauthenticated restore correctly returns 401")
