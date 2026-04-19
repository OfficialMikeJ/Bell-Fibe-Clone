# Test Credentials

## Admin Account
- **Email:** admin@streamvault.ca
- **Password:** brEtymFerg
- **Role:** Admin

## Password Reset
- CLI only: `cd /home/streamvault/streamvault/backend && source venv/bin/activate && python3 reset_password.py admin@streamvault.ca`

## Auth Endpoints
- POST /api/auth/login (email + password)
- POST /api/auth/register (admin-only, requires Bearer token)
- GET /api/auth/verify (Bearer token)

## Backup Agent
- Default port: 9500
- Health check: GET http://backup-server-ip:9500/health
