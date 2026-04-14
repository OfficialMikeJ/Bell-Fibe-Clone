# Test Credentials

## Admin Account
- **Email:** admin@streamvault.ca
- **Password:** brEtymFerg
- **Role:** Admin

## Password Reset
- CLI only: `cd /app/backend && python3 reset_password.py admin@streamvault.ca`

## Auth Endpoints
- POST /api/auth/login (email + password)
- POST /api/auth/register (admin-only, requires Bearer token)
- POST /api/auth/password-reset (admin-only, requires Bearer token)
- GET /api/auth/verify (Bearer token)
