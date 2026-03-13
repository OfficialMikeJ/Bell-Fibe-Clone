"""
Iteration 7: Roku link-code endpoint tests.
Tests: POST /api/roku/request-link, GET /api/roku/check-link, POST /api/roku/confirm-link
"""

import pytest
import requests
import os
import pymongo
import pyotp

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test customer created via setup
TEST_EMAIL = 'test_roku@streamvault.test'
TOTP_SECRET = '3PUD3CMU6JFTXU2NS7LLHCTJ7QYCGHSF'


class TestRokuRequestLink:
    """POST /api/roku/request-link — Step 1: Generate link code"""

    def test_request_link_returns_200(self):
        """Request link returns 200 with link_code and expires_in"""
        response = requests.post(f"{BASE_URL}/api/roku/request-link")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

    def test_request_link_returns_link_code(self):
        """Response contains link_code field as 6-character uppercase string"""
        response = requests.post(f"{BASE_URL}/api/roku/request-link")
        assert response.status_code == 200
        data = response.json()
        assert "link_code" in data, "Response missing 'link_code'"
        code = data["link_code"]
        assert isinstance(code, str), f"link_code should be string, got {type(code)}"
        assert len(code) == 6, f"link_code should be 6 chars, got '{code}'"
        assert code.isupper() or code.isalnum(), f"link_code should be alphanumeric uppercase: '{code}'"

    def test_request_link_returns_expires_in(self):
        """Response contains expires_in field (600 seconds = 10 minutes)"""
        response = requests.post(f"{BASE_URL}/api/roku/request-link")
        assert response.status_code == 200
        data = response.json()
        assert "expires_in" in data, "Response missing 'expires_in'"
        assert data["expires_in"] == 600, f"Expected expires_in=600, got {data['expires_in']}"

    def test_request_link_creates_unique_codes(self):
        """Multiple requests create different codes"""
        r1 = requests.post(f"{BASE_URL}/api/roku/request-link")
        r2 = requests.post(f"{BASE_URL}/api/roku/request-link")
        assert r1.status_code == 200
        assert r2.status_code == 200
        code1 = r1.json()["link_code"]
        code2 = r2.json()["link_code"]
        # Codes are random; very unlikely to collide
        assert isinstance(code1, str) and len(code1) == 6
        assert isinstance(code2, str) and len(code2) == 6


class TestRokuCheckLink:
    """GET /api/roku/check-link — Step 3: Poll link status"""

    def get_fresh_code(self):
        r = requests.post(f"{BASE_URL}/api/roku/request-link")
        assert r.status_code == 200
        return r.json()["link_code"]

    def test_check_link_unlinked_returns_linked_false(self):
        """Freshly created code returns {linked: false}"""
        code = self.get_fresh_code()
        response = requests.get(f"{BASE_URL}/api/roku/check-link", params={"code": code})
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "linked" in data, "Response missing 'linked'"
        assert data["linked"] is False, f"Expected linked=false for fresh code, got {data['linked']}"

    def test_check_link_invalid_code_returns_404(self):
        """Non-existent code returns 404"""
        response = requests.get(f"{BASE_URL}/api/roku/check-link", params={"code": "XXXXXX"})
        assert response.status_code == 404, f"Expected 404 for invalid code, got {response.status_code}"

    def test_check_link_no_session_token_before_confirm(self):
        """Unlinked code should NOT have session_token"""
        code = self.get_fresh_code()
        response = requests.get(f"{BASE_URL}/api/roku/check-link", params={"code": code})
        assert response.status_code == 200
        data = response.json()
        assert data.get("session_token") is None or "session_token" not in data, \
            "Should not have session_token before linking"


class TestRokuConfirmLink:
    """POST /api/roku/confirm-link — Step 2: Link with email+TOTP"""

    def get_fresh_code(self):
        r = requests.post(f"{BASE_URL}/api/roku/request-link")
        assert r.status_code == 200
        return r.json()["link_code"]

    def test_confirm_link_with_valid_totp_returns_200(self):
        """Valid email + TOTP links the code and returns success"""
        code = self.get_fresh_code()
        totp_code = pyotp.TOTP(TOTP_SECRET).now()
        response = requests.post(f"{BASE_URL}/api/roku/confirm-link", json={
            "link_code": code,
            "email": TEST_EMAIL,
            "totp_code": totp_code,
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

    def test_confirm_link_response_has_message(self):
        """Confirm link response contains a message"""
        code = self.get_fresh_code()
        totp_code = pyotp.TOTP(TOTP_SECRET).now()
        response = requests.post(f"{BASE_URL}/api/roku/confirm-link", json={
            "link_code": code,
            "email": TEST_EMAIL,
            "totp_code": totp_code,
        })
        assert response.status_code == 200
        data = response.json()
        assert "message" in data, "Confirm response missing 'message'"
        assert "linked" in data["message"].lower() or "roku" in data["message"].lower() or "success" in data["message"].lower()

    def test_check_link_after_confirm_returns_linked_true(self):
        """After confirm, check-link returns {linked: true, session_token}"""
        code = self.get_fresh_code()
        totp_code = pyotp.TOTP(TOTP_SECRET).now()

        # Confirm the link
        confirm_resp = requests.post(f"{BASE_URL}/api/roku/confirm-link", json={
            "link_code": code,
            "email": TEST_EMAIL,
            "totp_code": totp_code,
        })
        assert confirm_resp.status_code == 200, f"Confirm failed: {confirm_resp.text}"

        # Check link status
        check_resp = requests.get(f"{BASE_URL}/api/roku/check-link", params={"code": code})
        assert check_resp.status_code == 200, f"Check after confirm failed: {check_resp.text}"
        data = check_resp.json()
        assert data.get("linked") is True, f"Expected linked=true after confirm, got {data}"
        assert "session_token" in data, "Expected session_token after linking"
        assert isinstance(data["session_token"], str) and len(data["session_token"]) > 0, \
            "session_token should be non-empty string"

    def test_confirm_link_wrong_totp_returns_401(self):
        """Wrong TOTP code returns 401"""
        code = self.get_fresh_code()
        response = requests.post(f"{BASE_URL}/api/roku/confirm-link", json={
            "link_code": code,
            "email": TEST_EMAIL,
            "totp_code": "000000",  # Wrong TOTP
        })
        assert response.status_code == 401, f"Expected 401 for wrong TOTP, got {response.status_code}: {response.text}"

    def test_confirm_link_invalid_code_returns_404(self):
        """Non-existent link code returns 404"""
        totp_code = pyotp.TOTP(TOTP_SECRET).now()
        response = requests.post(f"{BASE_URL}/api/roku/confirm-link", json={
            "link_code": "XXXXXX",
            "email": TEST_EMAIL,
            "totp_code": totp_code,
        })
        assert response.status_code == 404, f"Expected 404 for invalid code, got {response.status_code}: {response.text}"

    def test_confirm_link_wrong_email_returns_401(self):
        """Non-existent customer email returns 401"""
        code = self.get_fresh_code()
        totp_code = pyotp.TOTP(TOTP_SECRET).now()
        response = requests.post(f"{BASE_URL}/api/roku/confirm-link", json={
            "link_code": code,
            "email": "nonexistent@nowhere.test",
            "totp_code": totp_code,
        })
        assert response.status_code == 401, f"Expected 401 for unknown email, got {response.status_code}: {response.text}"
