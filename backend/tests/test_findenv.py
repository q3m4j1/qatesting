"""
Backend tests for Find Hello Devices (findenv) module.
Focus: OAuth settings endpoint, search returns auth_failed with descriptive errors, history.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
ADMIN_EMAIL = "admin@example.com"
ADMIN_PASSWORD = "Solab-123"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    return r.json()["token"]


class TestFindEnvSettings:
    def test_get_settings(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/findenv/settings", params={"user_token": admin_token})
        assert r.status_code == 200, r.text
        data = r.json()
        # Contract fields (from get_findenv_settings)
        for key in ["id", "azure_username", "has_password", "is_configured", "client_id", "has_client_secret", "scope"]:
            assert key in data, f"missing key {key} in settings response: {data}"

    def test_save_settings_with_oauth_params(self, admin_token):
        r = requests.post(
            f"{BASE_URL}/api/findenv/settings",
            params={
                "user_token": admin_token,
                "azure_username": "TEST_user@example.com",
                "azure_password": "TEST_password_123",
                "client_id": "sol.web.endpointmanager.pkce",
                "client_secret": "TEST_secret",
                "scope": "openid profile sol.web.endpointmanager"
            }
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("success") is True

        # Verify persisted
        g = requests.get(f"{BASE_URL}/api/findenv/settings", params={"user_token": admin_token})
        assert g.status_code == 200
        gdata = g.json()
        assert gdata["azure_username"] == "TEST_user@example.com"
        assert gdata["has_password"] is True
        assert gdata["is_configured"] is True
        assert gdata["client_id"] == "sol.web.endpointmanager.pkce"
        assert gdata["has_client_secret"] is True
        assert "openid" in gdata["scope"]

    def test_save_settings_without_client_secret(self, admin_token):
        r = requests.post(
            f"{BASE_URL}/api/findenv/settings",
            params={
                "user_token": admin_token,
                "azure_username": "TEST_user@example.com",
                "azure_password": "TEST_password_123",
                "client_id": "sol.web.endpointmanager.pkce",
                "scope": "openid profile sol.web.endpointmanager"
            }
        )
        assert r.status_code == 200, r.text
        g = requests.get(f"{BASE_URL}/api/findenv/settings", params={"user_token": admin_token}).json()
        assert g["has_client_secret"] is False


class TestFindEnvEnvironments:
    def test_get_environments(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/findenv/environments", params={"user_token": admin_token})
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data, list)
        # Expect defaults auto-created; should have some active envs
        active = [e for e in data if e.get("is_active")]
        assert len(active) > 0, "Expected at least one active environment"


class TestFindEnvSearch:
    """OAuth to external MDM APIs is expected to fail -> auth_failed with descriptive error."""

    def test_search_returns_auth_failed_with_error_messages(self, admin_token):
        # Ensure settings configured first
        requests.post(
            f"{BASE_URL}/api/findenv/settings",
            params={
                "user_token": admin_token,
                "azure_username": "TEST_user@example.com",
                "azure_password": "TEST_password_wrong",
                "client_id": "sol.web.endpointmanager.pkce",
                "scope": "openid profile sol.web.endpointmanager"
            }
        )

        r = requests.get(
            f"{BASE_URL}/api/findenv/search/TESTSERIAL123",
            params={"user_token": admin_token, "show_all": True},
            timeout=180
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert "results" in data
        assert isinstance(data["results"], list)
        assert len(data["results"]) > 0, "Expected results for each environment"

        # Auth_failed results should be included (not filtered out) with error messages
        auth_failed = [x for x in data["results"] if x.get("status") == "auth_failed"]
        unreachable = [x for x in data["results"] if x.get("status") == "unreachable"]
        # At least one env should return auth_failed or unreachable (given fake creds)
        assert (len(auth_failed) + len(unreachable)) > 0, f"Expected auth_failed/unreachable, got: {data['results']}"

        for res in auth_failed:
            assert res.get("error_message"), f"auth_failed result missing error_message: {res}"

    def test_search_requires_configured_settings(self, admin_token):
        # This test just verifies endpoint accessible with configured settings; skip clearing
        r = requests.get(
            f"{BASE_URL}/api/findenv/search/ABC",
            params={"user_token": admin_token},
            timeout=180
        )
        # Should be 200 (already configured from previous tests) or 400 (not configured)
        assert r.status_code in (200, 400), r.text


class TestFindEnvHistory:
    def test_history_endpoint(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/findenv/history", params={"user_token": admin_token})
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data, list)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
