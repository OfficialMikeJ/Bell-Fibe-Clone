"""
APK Management Backend Tests — Iteration 8
Tests all 4 APK endpoints: GET /api/apk/latest, GET /api/apk/releases,
POST /api/apk/upload, DELETE /api/apk/release/{version_code}
"""

import pytest
import requests
import os
import io
import tempfile

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
ADMIN_USER = "admin"
ADMIN_PASS = "admin123"

TEST_VERSION = "99.0.0"
TEST_VERSION_CODE = 99001  # Large number to avoid conflicts


# ─── Fixtures ────────────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def admin_token():
    """Obtain admin Bearer token."""
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"username": ADMIN_USER, "password": ADMIN_PASS})
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    token = r.json().get("access_token") or r.json().get("token")
    assert token, f"No token in login response: {r.json()}"
    return token


@pytest.fixture(scope="module")
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="module")
def dummy_apk_bytes():
    """Create a small dummy APK-like file content (just a few bytes)."""
    # A minimal APK file content — just enough data to test upload
    return b"PK\x03\x04" + b"\x00" * 100  # ZIP-like header for .apk


# ─── Helper: cleanup test APK release if it exists ────────────────────────────

def cleanup_test_release(auth_headers):
    """Delete TEST release to keep DB clean after tests."""
    r = requests.delete(
        f"{BASE_URL}/api/apk/release/{TEST_VERSION_CODE}",
        headers=auth_headers
    )
    # 404 is fine — means it was already cleaned up
    return r.status_code in (200, 404)


# ─── 1. Public endpoint: GET /api/apk/latest (no auth) ───────────────────────

class TestGetLatestApk:
    """GET /api/apk/latest — public endpoint tests."""

    def test_latest_returns_200_no_auth(self):
        """Should return 200 without any auth token."""
        r = requests.get(f"{BASE_URL}/api/apk/latest")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        print(f"GET /api/apk/latest => {r.status_code}: {r.json()}")

    def test_latest_has_release_field(self):
        """Response must always contain has_release field."""
        r = requests.get(f"{BASE_URL}/api/apk/latest")
        assert r.status_code == 200
        data = r.json()
        assert "has_release" in data, f"'has_release' missing from response: {data}"
        print(f"has_release value: {data['has_release']}")

    def test_latest_no_releases_returns_false(self, auth_headers):
        """When no APKs exist, should return has_release: False."""
        # Ensure test APK is removed first
        cleanup_test_release(auth_headers)

        # Check if any releases exist
        releases_r = requests.get(f"{BASE_URL}/api/apk/releases", headers=auth_headers)
        if releases_r.status_code == 200 and len(releases_r.json()) == 0:
            r = requests.get(f"{BASE_URL}/api/apk/latest")
            assert r.status_code == 200
            data = r.json()
            assert data.get("has_release") == False, f"Expected has_release=False when no APKs, got: {data}"
            print(f"Correctly returns has_release=False when no releases: {data}")
        else:
            print(f"Skipping empty-state check (existing releases found: {releases_r.json()})")
            pytest.skip("DB already has APK releases, skip empty-state test")


# ─── 2. Admin endpoint: GET /api/apk/releases ─────────────────────────────────

class TestListReleases:
    """GET /api/apk/releases — admin auth required."""

    def test_releases_requires_auth(self):
        """Without auth should return 401 or 403."""
        r = requests.get(f"{BASE_URL}/api/apk/releases")
        assert r.status_code in (401, 403), f"Expected 401/403 without auth, got {r.status_code}"
        print(f"Correctly blocked without auth: {r.status_code}")

    def test_releases_returns_list_with_auth(self, auth_headers):
        """With valid admin token should return a list."""
        r = requests.get(f"{BASE_URL}/api/apk/releases", headers=auth_headers)
        assert r.status_code == 200, f"Expected 200 with auth, got {r.status_code}: {r.text}"
        data = r.json()
        assert isinstance(data, list), f"Expected list, got: {type(data)}: {data}"
        print(f"GET /api/apk/releases => {r.status_code}: {len(data)} releases")

    def test_releases_invalid_token_rejected(self):
        """Invalid token should be rejected."""
        r = requests.get(f"{BASE_URL}/api/apk/releases", headers={"Authorization": "Bearer invalid_token_xyz"})
        assert r.status_code in (401, 403), f"Expected 401/403 with invalid token, got {r.status_code}"
        print(f"Correctly rejected invalid token: {r.status_code}")


# ─── 3. POST /api/apk/upload ──────────────────────────────────────────────────

class TestUploadApk:
    """POST /api/apk/upload — admin auth required."""

    def test_upload_requires_auth(self, dummy_apk_bytes):
        """Should reject upload without auth."""
        files = {"file": ("test.apk", io.BytesIO(dummy_apk_bytes), "application/vnd.android.package-archive")}
        data = {"version": "1.0.0", "version_code": "1", "release_notes": "test"}
        r = requests.post(f"{BASE_URL}/api/apk/upload", files=files, data=data)
        assert r.status_code in (401, 403), f"Expected 401/403 without auth, got {r.status_code}: {r.text}"
        print(f"Correctly blocked upload without auth: {r.status_code}")

    def test_upload_rejects_non_apk_file(self, auth_headers, dummy_apk_bytes):
        """Should reject files without .apk extension."""
        files = {"file": ("test.txt", io.BytesIO(dummy_apk_bytes), "text/plain")}
        data = {"version": "1.0.0", "version_code": "998", "release_notes": "test"}
        r = requests.post(f"{BASE_URL}/api/apk/upload", files=files, data=data, headers=auth_headers)
        assert r.status_code == 400, f"Expected 400 for non-APK file, got {r.status_code}: {r.text}"
        assert "apk" in r.json().get("detail", "").lower(), f"Error message should mention .apk: {r.json()}"
        print(f"Correctly rejected non-APK: {r.status_code} {r.json()}")

    def test_upload_rejects_zip_disguised_as_non_apk(self, auth_headers, dummy_apk_bytes):
        """Should reject .zip file (not .apk extension)."""
        files = {"file": ("app.zip", io.BytesIO(dummy_apk_bytes), "application/zip")}
        data = {"version": "1.0.0", "version_code": "999", "release_notes": "test"}
        r = requests.post(f"{BASE_URL}/api/apk/upload", files=files, data=data, headers=auth_headers)
        assert r.status_code == 400, f"Expected 400 for .zip file, got {r.status_code}: {r.text}"
        print(f"Correctly rejected .zip: {r.status_code}")

    def test_upload_valid_apk(self, auth_headers, dummy_apk_bytes):
        """Should successfully upload a valid .apk file."""
        # First cleanup any existing test release
        cleanup_test_release(auth_headers)

        files = {"file": (f"streamvault-test-v{TEST_VERSION}.apk", io.BytesIO(dummy_apk_bytes), "application/vnd.android.package-archive")}
        data = {
            "version": TEST_VERSION,
            "version_code": str(TEST_VERSION_CODE),
            "release_notes": "Test release for automated testing",
            "required": "false"
        }
        r = requests.post(f"{BASE_URL}/api/apk/upload", files=files, data=data, headers=auth_headers)
        assert r.status_code == 200, f"Upload failed: {r.status_code}: {r.text}"

        resp = r.json()
        assert resp.get("version") == TEST_VERSION, f"Version mismatch: {resp}"
        assert resp.get("version_code") == TEST_VERSION_CODE, f"Version code mismatch: {resp}"
        assert "download_url" in resp, f"download_url missing: {resp}"
        assert "file_size_mb" in resp, f"file_size_mb missing: {resp}"
        assert "message" in resp, f"message missing: {resp}"
        print(f"Upload successful: {resp}")

    def test_upload_rejects_duplicate_version_code(self, auth_headers, dummy_apk_bytes):
        """Should reject upload with an already-used version_code (409)."""
        # Upload should have already been done in previous test
        files = {"file": ("streamvault-duplicate.apk", io.BytesIO(dummy_apk_bytes), "application/vnd.android.package-archive")}
        data = {
            "version": "99.0.1",
            "version_code": str(TEST_VERSION_CODE),  # Same version_code — should conflict
            "release_notes": "Duplicate test"
        }
        r = requests.post(f"{BASE_URL}/api/apk/upload", files=files, data=data, headers=auth_headers)
        assert r.status_code == 409, f"Expected 409 for duplicate version_code, got {r.status_code}: {r.text}"
        print(f"Correctly rejected duplicate version_code: {r.status_code} {r.json()}")


# ─── 4. GET /api/apk/latest after upload (absolute URL check) ─────────────────

class TestLatestAfterUpload:
    """Verify GET /api/apk/latest returns correct data after upload."""

    def test_latest_has_release_true_after_upload(self, auth_headers, dummy_apk_bytes):
        """After an upload, has_release should be True."""
        # Ensure test APK exists
        r = requests.get(f"{BASE_URL}/api/apk/releases", headers=auth_headers)
        releases = r.json()
        if not any(rel.get("version_code") == TEST_VERSION_CODE for rel in releases):
            # Upload it
            cleanup_test_release(auth_headers)
            files = {"file": (f"sv-{TEST_VERSION}.apk", io.BytesIO(dummy_apk_bytes), "application/vnd.android.package-archive")}
            data = {"version": TEST_VERSION, "version_code": str(TEST_VERSION_CODE), "release_notes": "auto-test"}
            requests.post(f"{BASE_URL}/api/apk/upload", files=files, data=data, headers=auth_headers)

        latest_r = requests.get(f"{BASE_URL}/api/apk/latest")
        assert latest_r.status_code == 200
        latest = latest_r.json()
        assert latest.get("has_release") == True, f"Expected has_release=True after upload, got: {latest}"
        print(f"has_release=True after upload: {latest}")

    def test_latest_returns_correct_version_info(self, auth_headers, dummy_apk_bytes):
        """Latest should return version, version_code, download_url, release_notes, required."""
        r = requests.get(f"{BASE_URL}/api/apk/latest")
        assert r.status_code == 200
        data = r.json()
        assert "version" in data, f"'version' missing: {data}"
        assert "version_code" in data, f"'version_code' missing: {data}"
        assert "download_url" in data, f"'download_url' missing: {data}"
        assert "release_notes" in data, f"'release_notes' missing: {data}"
        assert "required" in data, f"'required' missing: {data}"
        assert "uploaded_at" in data, f"'uploaded_at' missing: {data}"
        print(f"Latest APK info: {data}")

    def test_latest_download_url_is_absolute(self, auth_headers):
        """download_url in /api/apk/latest must be absolute (start with http:// or https://)."""
        r = requests.get(f"{BASE_URL}/api/apk/latest")
        assert r.status_code == 200
        data = r.json()
        download_url = data.get("download_url", "")
        assert download_url.startswith("http://") or download_url.startswith("https://"), \
            f"download_url must be absolute URL, got: '{download_url}'"
        print(f"download_url is absolute: {download_url}")

    def test_latest_download_url_not_relative(self, auth_headers):
        """download_url must NOT be a relative path like /uploads/apk/..."""
        r = requests.get(f"{BASE_URL}/api/apk/latest")
        assert r.status_code == 200
        data = r.json()
        download_url = data.get("download_url", "")
        assert not download_url.startswith("/"), \
            f"download_url is still a relative path: '{download_url}'"
        print(f"download_url is not relative: {download_url}")


# ─── 5. DELETE /api/apk/release/{version_code} ────────────────────────────────

class TestDeleteRelease:
    """DELETE /api/apk/release/{version_code} — admin auth required."""

    def test_delete_requires_auth(self):
        """Should reject delete without auth."""
        r = requests.delete(f"{BASE_URL}/api/apk/release/{TEST_VERSION_CODE}")
        assert r.status_code in (401, 403), f"Expected 401/403 without auth, got {r.status_code}"
        print(f"Correctly blocked delete without auth: {r.status_code}")

    def test_delete_nonexistent_returns_404(self, auth_headers):
        """Deleting a non-existent version_code should return 404."""
        non_existent_code = 9999999
        r = requests.delete(f"{BASE_URL}/api/apk/release/{non_existent_code}", headers=auth_headers)
        assert r.status_code == 404, f"Expected 404 for non-existent release, got {r.status_code}: {r.text}"
        print(f"Correctly 404 for non-existent: {r.status_code}")

    def test_delete_release_and_verify_removal(self, auth_headers, dummy_apk_bytes):
        """After deleting, release should not appear in list."""
        # Ensure the test release exists
        releases_r = requests.get(f"{BASE_URL}/api/apk/releases", headers=auth_headers)
        releases = releases_r.json()
        if not any(rel.get("version_code") == TEST_VERSION_CODE for rel in releases):
            # Upload it
            files = {"file": (f"sv-{TEST_VERSION}.apk", io.BytesIO(dummy_apk_bytes), "application/vnd.android.package-archive")}
            data = {"version": TEST_VERSION, "version_code": str(TEST_VERSION_CODE), "release_notes": "delete-test"}
            up_r = requests.post(f"{BASE_URL}/api/apk/upload", files=files, data=data, headers=auth_headers)
            assert up_r.status_code == 200, f"Could not create test release for delete test: {up_r.text}"

        # Now delete
        del_r = requests.delete(f"{BASE_URL}/api/apk/release/{TEST_VERSION_CODE}", headers=auth_headers)
        assert del_r.status_code == 200, f"Delete failed: {del_r.status_code}: {del_r.text}"
        assert "deleted" in del_r.json().get("message", "").lower(), f"Expected 'deleted' in message: {del_r.json()}"

        # Verify it's gone
        releases_after_r = requests.get(f"{BASE_URL}/api/apk/releases", headers=auth_headers)
        releases_after = releases_after_r.json()
        codes_after = [rel.get("version_code") for rel in releases_after]
        assert TEST_VERSION_CODE not in codes_after, \
            f"Release {TEST_VERSION_CODE} still present after delete: {codes_after}"
        print(f"Release {TEST_VERSION_CODE} successfully deleted and removed from list")

    def test_get_releases_persistence_check(self, auth_headers):
        """After all operations, releases endpoint returns proper list."""
        r = requests.get(f"{BASE_URL}/api/apk/releases", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        # TEST release should have been cleaned up
        codes = [rel.get("version_code") for rel in data]
        assert TEST_VERSION_CODE not in codes, f"Test release was not cleaned up: {codes}"
        print(f"Final releases list: {codes}")
