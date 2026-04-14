# Test Credentials

## Admin Account
- **Email:** admin@streamvault.ca
- **Password:** vubs2V4mzl
- **Role:** Admin

## Test Admin Account
- **Email:** test@streamvault.ca
- **Password:** BXPSzBOvID
- **Role:** Admin

## Auth Endpoints
- POST /api/auth/login (email + password)
- POST /api/auth/register (email only, password auto-generated)
- POST /api/auth/password-reset (email, returns new random password)
- GET /api/auth/verify (Bearer token)
