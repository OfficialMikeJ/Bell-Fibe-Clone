"""
Iteration 11: Docker/Infrastructure validation tests
- Tests /api/health endpoint (added for Docker health checks)
- Validates docker-compose.yml YAML syntax and structure
- Verifies .env.example covers all vars used in docker-compose.yml
- Validates nginx.conf files for correct listen port and SPA fallback
- Validates .dockerignore files exclude required dirs
"""
import pytest
import requests
import yaml
import re
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestHealthEndpoint:
    """Test the /api/health endpoint used by Docker health checks"""

    def test_health_endpoint_returns_200(self):
        """GET /api/health must return HTTP 200"""
        response = requests.get(f"{BASE_URL}/api/health", timeout=10)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"

    def test_health_endpoint_returns_status_ok(self):
        """GET /api/health must return JSON with status: ok"""
        response = requests.get(f"{BASE_URL}/api/health", timeout=10)
        data = response.json()
        assert "status" in data, "Response missing 'status' key"
        assert data["status"] == "ok", f"Expected status=ok, got {data['status']}"

    def test_health_endpoint_content_type_json(self):
        """GET /api/health should return JSON content type"""
        response = requests.get(f"{BASE_URL}/api/health", timeout=10)
        assert "application/json" in response.headers.get("content-type", ""), \
            f"Expected JSON content type, got: {response.headers.get('content-type')}"


class TestDockerComposeYAML:
    """Validate docker-compose.yml YAML structure and correctness"""

    @pytest.fixture(autouse=True)
    def load_compose(self):
        with open('/app/docker-compose.yml', 'r') as f:
            self.compose = yaml.safe_load(f)

    def test_yaml_parses_without_errors(self):
        """docker-compose.yml must be valid YAML"""
        assert self.compose is not None
        assert "services" in self.compose

    def test_all_five_services_present(self):
        """All 5 services must be defined"""
        services = set(self.compose["services"].keys())
        expected = {"mongo", "backend", "frontend", "guide-app", "nginx-proxy-manager"}
        assert expected == services, f"Services mismatch: {services}"

    def test_mongo_image_version(self):
        """mongo service must use mongo:7.0"""
        assert self.compose["services"]["mongo"]["image"] == "mongo:7.0"

    def test_npm_image_version(self):
        """nginx-proxy-manager must use jc21/nginx-proxy-manager:2.12.3"""
        assert self.compose["services"]["nginx-proxy-manager"]["image"] == "jc21/nginx-proxy-manager:2.12.3"

    def test_mongo_healthcheck_syntax(self):
        """mongo healthcheck must use mongosh CMD form"""
        hc = self.compose["services"]["mongo"]["healthcheck"]
        assert hc["test"][0] == "CMD"
        assert "mongosh" in hc["test"][1]
        assert "ping" in " ".join(hc["test"])

    def test_backend_healthcheck_syntax(self):
        """backend healthcheck must use curl /api/health via CMD-SHELL"""
        hc = self.compose["services"]["backend"]["healthcheck"]
        assert hc["test"][0] == "CMD-SHELL"
        assert "/api/health" in hc["test"][1]
        assert "curl" in hc["test"][1]

    def test_depends_on_service_healthy_backend(self):
        """backend must depend on mongo with service_healthy"""
        dep = self.compose["services"]["backend"]["depends_on"]
        assert "mongo" in dep
        assert dep["mongo"]["condition"] == "service_healthy"

    def test_depends_on_service_healthy_frontend(self):
        """frontend must depend on backend with service_healthy"""
        dep = self.compose["services"]["frontend"]["depends_on"]
        assert "backend" in dep
        assert dep["backend"]["condition"] == "service_healthy"

    def test_depends_on_service_healthy_guide_app(self):
        """guide-app must depend on backend with service_healthy"""
        dep = self.compose["services"]["guide-app"]["depends_on"]
        assert "backend" in dep
        assert dep["backend"]["condition"] == "service_healthy"

    def test_internal_network_has_internal_true(self):
        """internal network must have internal:true"""
        net = self.compose["networks"]["internal"]
        assert net.get("internal") is True, "internal network must have internal:true"

    def test_proxy_network_is_bridge(self):
        """proxy network must be bridge driver"""
        net = self.compose["networks"]["proxy"]
        assert net.get("driver") == "bridge"

    def test_mongo_only_on_internal_network(self):
        """mongo must ONLY be on internal network (not proxy)"""
        mongo_nets = self.compose["services"]["mongo"].get("networks", [])
        assert "internal" in mongo_nets
        assert "proxy" not in mongo_nets, "SECURITY: mongo must not be on proxy network!"

    def test_backend_on_both_networks(self):
        """backend must be on both internal (for mongo) and proxy (for NPM)"""
        nets = self.compose["services"]["backend"].get("networks", [])
        assert "internal" in nets, "backend must be on internal network to reach mongo"
        assert "proxy" in nets, "backend must be on proxy network to be reachable by NPM"

    def test_frontend_port_mapping_80(self):
        """frontend must map internal port 80 (nginx) to external 3000"""
        ports = self.compose["services"]["frontend"].get("ports", [])
        assert "3000:80" in ports, f"Expected 3000:80, got {ports}"

    def test_guide_app_port_mapping_80(self):
        """guide-app must map internal port 80 (nginx) to external 3001"""
        ports = self.compose["services"]["guide-app"].get("ports", [])
        assert "3001:80" in ports, f"Expected 3001:80, got {ports}"

    def test_volumes_defined(self):
        """All 4 volumes must be defined"""
        volumes = set(self.compose.get("volumes", {}).keys())
        expected = {"mongo_data", "uploads", "npm_data", "npm_letsencrypt"}
        assert expected == volumes


class TestEnvExample:
    """Validate .env.example covers all vars used in docker-compose.yml"""

    def test_all_compose_env_vars_in_env_example(self):
        """Every ${VAR} used in docker-compose.yml must be in .env.example"""
        with open('/app/docker-compose.yml', 'r') as f:
            compose_content = f.read()
        with open('/app/.env.example', 'r') as f:
            env_content = f.read()

        env_vars = re.findall(r'\${([A-Z_]+)(?::-[^}]*)?}', compose_content)
        missing = [v for v in set(env_vars) if v not in env_content]
        assert not missing, f"Missing from .env.example: {missing}"


class TestDockerfiles:
    """Validate Dockerfile structure for frontend/guide-app/backend"""

    def test_backend_dockerfile_uses_python311_slim(self):
        with open('/app/backend/Dockerfile', 'r') as f:
            content = f.read()
        assert "FROM python:3.11-slim" in content

    def test_backend_dockerfile_upload_subdirs(self):
        """All 9 upload subdirectories must be created in backend Dockerfile"""
        with open('/app/backend/Dockerfile', 'r') as f:
            content = f.read()
        required_dirs = [
            "uploads/media", "uploads/posters", "uploads/logos",
            "uploads/qr_codes", "uploads/branding", "uploads/notifications",
            "uploads/cvr", "uploads/apk", "uploads/thumbnails"
        ]
        for d in required_dirs:
            assert d in content, f"Missing upload dir: {d}"

    def test_frontend_dockerfile_multistage_node20_alpine(self):
        with open('/app/frontend/Dockerfile', 'r') as f:
            content = f.read()
        assert "FROM node:20-alpine AS builder" in content
        assert "FROM nginx:1.27-alpine" in content

    def test_guide_app_dockerfile_multistage_node20_alpine(self):
        with open('/app/guide-app/Dockerfile', 'r') as f:
            content = f.read()
        assert "FROM node:20-alpine AS builder" in content
        assert "FROM nginx:1.27-alpine" in content


class TestNginxConf:
    """Validate nginx.conf for frontend and guide-app"""

    @pytest.mark.parametrize("conf_path", [
        "/app/frontend/nginx.conf",
        "/app/guide-app/nginx.conf"
    ])
    def test_nginx_listens_on_port_80(self, conf_path):
        with open(conf_path, 'r') as f:
            content = f.read()
        assert "listen 80;" in content, f"{conf_path}: must listen on port 80"

    @pytest.mark.parametrize("conf_path", [
        "/app/frontend/nginx.conf",
        "/app/guide-app/nginx.conf"
    ])
    def test_nginx_spa_fallback(self, conf_path):
        with open(conf_path, 'r') as f:
            content = f.read()
        assert "try_files $uri $uri/ /index.html" in content, \
            f"{conf_path}: must have SPA fallback to index.html"


class TestDockerignore:
    """Validate .dockerignore files exclude required directories"""

    def test_backend_dockerignore_excludes_pycache(self):
        with open('/app/backend/.dockerignore', 'r') as f:
            content = f.read()
        assert "__pycache__" in content
        assert ".env" in content

    def test_frontend_dockerignore_excludes_node_modules_and_build(self):
        with open('/app/frontend/.dockerignore', 'r') as f:
            content = f.read()
        assert "node_modules" in content
        assert "build" in content

    def test_guide_app_dockerignore_excludes_node_modules_and_build(self):
        with open('/app/guide-app/.dockerignore', 'r') as f:
            content = f.read()
        assert "node_modules" in content
        assert "build" in content
