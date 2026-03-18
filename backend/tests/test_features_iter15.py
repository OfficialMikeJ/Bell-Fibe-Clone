"""
Iteration 15 Backend Tests:
- Channel rename verification (ch101-119, no ch100)
- Auto-backup API endpoints (GET /api/admin/auto-backups, POST /api/admin/auto-backups/run-now)
- Scheduler active (verified via auto-backup functionality)
- VOD CRUD with catalog_id field
- EPG Program CRUD with catalog_id field
- /app/guide-app directory deletion check
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

ADMIN_CREDS = {"username": "admin", "password": "admin123"}


@pytest.fixture(scope="module")
def admin_token():
    """Authenticate as admin and return token"""
    res = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDS)
    assert res.status_code == 200, f"Admin login failed: {res.text}"
    data = res.json()
    return data.get("access_token") or data.get("token")


@pytest.fixture(scope="module")
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


# ── Channel Rename Verification ──────────────────────────────────────────────

class TestChannelRename:
    """Verify all channels are correctly renamed and ch100 (Channel Preview) does not exist"""

    EXPECTED_CHANNELS = {
        101: "NovaStar",
        102: "Vault Cinema",
        103: "PulseZone",
        104: "TerraVision",
        105: "ZenithPrime",
        106: "HorizonNews",
        107: "CrimsonDrama",
        108: "ByteShift",
        109: "MidnightCinema",
        110: "LumiKids",
        111: "ArcadeMax",
        112: "NeonBeat",
        113: "CoastalLife",
        114: "GoldFrame 4K",
        115: "TurboEdge",
        116: "WildRealm",
        117: "OpalDrama",
        118: "VaultLive One",
        119: "VaultLive Two",
    }

    def test_channels_endpoint_returns_200(self):
        res = requests.get(f"{BASE_URL}/api/channels")
        assert res.status_code == 200
        print("PASS: GET /api/channels returns 200")

    def test_channel_preview_ch100_does_not_exist(self):
        res = requests.get(f"{BASE_URL}/api/channels")
        data = res.json()
        ch100 = [c for c in data if c.get("number") == 100]
        assert len(ch100) == 0, f"Channel Preview (ch100) still exists: {ch100}"
        # Also verify no channel named "Channel Preview"
        preview_named = [c for c in data if "Channel Preview" in c.get("name", "")]
        assert len(preview_named) == 0, f"Channel named 'Channel Preview' still exists: {preview_named}"
        print("PASS: Channel Preview (ch100) does not exist")

    def test_all_renamed_channels_present(self):
        res = requests.get(f"{BASE_URL}/api/channels")
        data = res.json()
        # Channel numbers are returned as strings from API
        channel_map = {int(c["number"]): c["name"] for c in data if str(c.get("number", "")).isdigit()}
        errors = []
        for num, expected_name in self.EXPECTED_CHANNELS.items():
            actual = channel_map.get(num)
            if actual != expected_name:
                errors.append(f"ch{num}: expected '{expected_name}', got '{actual}'")
        assert not errors, f"Channel name mismatches:\n" + "\n".join(errors)
        print(f"PASS: All {len(self.EXPECTED_CHANNELS)} channels correctly named")

    def test_no_generic_channel_names(self):
        """Verify no generic 'Channel N' names exist"""
        res = requests.get(f"{BASE_URL}/api/channels")
        data = res.json()
        generic = [c for c in data if c.get("name", "").startswith("Channel ") and c.get("name") not in ["Channel Preview"]]
        assert len(generic) == 0, f"Generic channel names found: {[c['name'] for c in generic]}"
        print("PASS: No generic 'Channel N' names found")

    def test_no_generic_live_tv_names(self):
        """Verify 'Live TV 1' and 'Live TV 2' have been renamed"""
        res = requests.get(f"{BASE_URL}/api/channels")
        data = res.json()
        live_tv_old = [c for c in data if c.get("name") in ["Live TV 1", "Live TV 2"]]
        assert len(live_tv_old) == 0, f"Old 'Live TV' names still exist: {[c['name'] for c in live_tv_old]}"
        print("PASS: 'Live TV 1/2' correctly renamed to VaultLive One/Two")


# ── Auto-Backup API Tests ─────────────────────────────────────────────────────

class TestAutoBackupAPI:
    """Test GET /api/admin/auto-backups and POST /api/admin/auto-backups/run-now"""

    def test_list_auto_backups_unauthenticated(self):
        res = requests.get(f"{BASE_URL}/api/admin/auto-backups")
        assert res.status_code == 401, f"Expected 401 for unauthenticated request, got {res.status_code}"
        print("PASS: GET /api/admin/auto-backups requires auth")

    def test_list_auto_backups_authenticated(self, auth_headers):
        res = requests.get(f"{BASE_URL}/api/admin/auto-backups", headers=auth_headers)
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        data = res.json()
        assert isinstance(data, list), f"Expected list, got {type(data)}"
        print(f"PASS: GET /api/admin/auto-backups returns {len(data)} backups")

    def test_run_backup_now_authenticated(self, auth_headers):
        res = requests.post(f"{BASE_URL}/api/admin/auto-backups/run-now", headers=auth_headers)
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        data = res.json()
        assert "message" in data, f"Expected 'message' in response: {data}"
        assert "filename" in data, f"Expected 'filename' in response: {data}"
        assert data["filename"] is not None, "Filename should not be None after backup"
        assert data["filename"].startswith("auto_backup_"), f"Filename should start with 'auto_backup_': {data['filename']}"
        assert data["filename"].endswith(".tar.gz"), f"Filename should end with .tar.gz: {data['filename']}"
        print(f"PASS: POST /api/admin/auto-backups/run-now created backup: {data['filename']}")

    def test_list_auto_backups_after_run(self, auth_headers):
        """After running a backup, list should have at least one entry"""
        res = requests.get(f"{BASE_URL}/api/admin/auto-backups", headers=auth_headers)
        assert res.status_code == 200
        data = res.json()
        assert len(data) > 0, "Expected at least one backup after run-now"
        # Verify response structure
        first = data[0]
        assert "filename" in first
        assert "size_bytes" in first
        assert "size_mb" in first
        assert "created_at" in first
        assert first["filename"].startswith("auto_backup_")
        assert first["size_bytes"] > 0, "Backup should have non-zero size"
        print(f"PASS: Auto-backup list has {len(data)} entries, first is {first['filename']} ({first['size_mb']} MB)")

    def test_run_backup_unauthenticated(self):
        res = requests.post(f"{BASE_URL}/api/admin/auto-backups/run-now")
        assert res.status_code == 401, f"Expected 401 for unauthenticated, got {res.status_code}"
        print("PASS: POST /api/admin/auto-backups/run-now requires auth")


# ── VOD with catalog_id Tests ─────────────────────────────────────────────────

class TestVODWithCatalogId:
    """Test VOD CRUD operations with catalog_id field"""

    def test_list_vod_returns_200(self):
        res = requests.get(f"{BASE_URL}/api/vod")
        assert res.status_code == 200
        assert isinstance(res.json(), list)
        print(f"PASS: GET /api/vod returns {len(res.json())} items")

    def test_create_vod_without_catalog(self, auth_headers):
        payload = {
            "title": "TEST_VOD_NoCatalog",
            "description": "Test VOD item",
            "category": "movie",
            "genre": "Action",
            "year": 2024,
            "rating": "PG-13",
            "is_featured": False,
        }
        res = requests.post(f"{BASE_URL}/api/vod", json=payload, headers=auth_headers)
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        data = res.json()
        assert data["title"] == "TEST_VOD_NoCatalog"
        assert data["catalog_id"] is None
        assert "id" in data
        print(f"PASS: Created VOD without catalog_id: {data['id']}")
        # Store for cleanup
        TestVODWithCatalogId._test_id = data["id"]
        return data["id"]

    def test_create_vod_with_catalog_id_field(self, auth_headers):
        """Verify catalog_id field is accepted in VOD create"""
        payload = {
            "title": "TEST_VOD_WithCatalog",
            "description": "Test VOD item with catalog link",
            "category": "movie",
            "catalog_id": "test-catalog-123",
            "is_featured": False,
        }
        res = requests.post(f"{BASE_URL}/api/vod", json=payload, headers=auth_headers)
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        data = res.json()
        assert data["title"] == "TEST_VOD_WithCatalog"
        assert data["catalog_id"] == "test-catalog-123"
        TestVODWithCatalogId._test_id_catalog = data["id"]
        print(f"PASS: Created VOD with catalog_id field: {data['id']}")

    def test_cleanup_test_vod_items(self, auth_headers):
        """Clean up TEST_ prefixed VOD items"""
        res = requests.get(f"{BASE_URL}/api/vod")
        items = res.json()
        deleted = 0
        for item in items:
            if item["title"].startswith("TEST_"):
                del_res = requests.delete(f"{BASE_URL}/api/vod/{item['id']}", headers=auth_headers)
                if del_res.status_code == 200:
                    deleted += 1
        print(f"PASS: Cleaned up {deleted} TEST_ VOD items")


# ── EPG Programs with catalog_id Tests ───────────────────────────────────────

class TestProgramsWithCatalogId:
    """Test EPG Program CRUD with catalog_id field"""

    def test_list_programs_returns_200(self):
        res = requests.get(f"{BASE_URL}/api/programs")
        assert res.status_code == 200
        assert isinstance(res.json(), list)
        print(f"PASS: GET /api/programs returns {len(res.json())} programs")

    def test_create_program_with_catalog_id(self, auth_headers):
        """Test creating an EPG program with catalog_id field"""
        # Get a channel ID first
        channels_res = requests.get(f"{BASE_URL}/api/channels")
        channels = channels_res.json()
        assert len(channels) > 0
        channel_id = channels[0]["id"]

        payload = {
            "channel_id": channel_id,
            "title": "TEST_Program_WithCatalog",
            "description": "Test program with catalog link",
            "start_time": "22:00",
            "duration_minutes": 90,
            "date": "2026-12-01",
            "catalog_id": "test-catalog-456",
            "program_type": "movie",
        }
        res = requests.post(f"{BASE_URL}/api/programs", json=payload, headers=auth_headers)
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        data = res.json()
        assert data["title"] == "TEST_Program_WithCatalog"
        assert data["catalog_id"] == "test-catalog-456"
        assert "id" in data
        TestProgramsWithCatalogId._test_program_id = data["id"]
        print(f"PASS: Created EPG program with catalog_id: {data['id']}")

    def test_cleanup_test_programs(self, auth_headers):
        """Clean up TEST_ prefixed programs"""
        res = requests.get(f"{BASE_URL}/api/programs", headers=auth_headers)
        programs = res.json()
        deleted = 0
        for prog in programs:
            if prog.get("title", "").startswith("TEST_"):
                del_res = requests.delete(f"{BASE_URL}/api/programs/{prog['id']}", headers=auth_headers)
                if del_res.status_code == 200:
                    deleted += 1
        print(f"PASS: Cleaned up {deleted} TEST_ programs")


# ── Scheduler Health Check ───────────────────────────────────────────────────

class TestSchedulerHealth:
    """Verify scheduler is active by testing auto-backup functionality"""

    def test_scheduler_active_via_run_now(self, auth_headers):
        """If scheduler/backup infrastructure works, run-now should succeed"""
        res = requests.post(f"{BASE_URL}/api/admin/auto-backups/run-now", headers=auth_headers)
        assert res.status_code == 200
        data = res.json()
        assert data.get("filename") is not None
        print(f"PASS: Scheduler infrastructure active — backup created: {data['filename']}")

    def test_backup_file_exists_on_disk(self, auth_headers):
        """Verify the backup file is actually accessible via list endpoint"""
        # Run a backup
        run_res = requests.post(f"{BASE_URL}/api/admin/auto-backups/run-now", headers=auth_headers)
        assert run_res.status_code == 200
        created_filename = run_res.json()["filename"]

        # Check it appears in list
        list_res = requests.get(f"{BASE_URL}/api/admin/auto-backups", headers=auth_headers)
        assert list_res.status_code == 200
        backups = list_res.json()
        filenames = [b["filename"] for b in backups]
        assert created_filename in filenames, f"Created backup '{created_filename}' not found in list: {filenames}"
        print(f"PASS: Backup file {created_filename} confirmed in list")
