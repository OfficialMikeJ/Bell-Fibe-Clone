from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta
from typing import Optional
import os
import hmac
import hashlib
import time
import string
import secrets

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key-change-in-production')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

# ── Media URL signing ─────────────────────────────────────────────────────────
MEDIA_TOKEN_TTL = 4 * 3600  # 4 hours — enough for the longest movies


def _media_secret() -> bytes:
    """Derive a consistent bytes key for HMAC from JWT_SECRET."""
    return JWT_SECRET.encode()


def sign_media_url(filename: str, ttl: int = MEDIA_TOKEN_TTL) -> str:
    """
    Returns a query string  ?t={expiry_unix}&s={hmac_hex}  for the given filename.
    Append directly to any media file path before returning it to the client.

    Example:
        path = "/uploads/media/movie.mp4" + sign_media_url("movie.mp4")
        # → /uploads/media/movie.mp4?t=1234567890&s=abcdef...
    """
    expiry = int(time.time()) + ttl
    msg = f"{filename}:{expiry}".encode()
    sig = hmac.new(_media_secret(), msg, hashlib.sha256).hexdigest()
    return f"?t={expiry}&s={sig}"


def verify_media_token(filename: str, t: Optional[str], s: Optional[str]) -> bool:
    """
    Verify a media access token.
    Returns True only if the signature is valid AND the token has not expired.
    Uses constant-time comparison to prevent timing attacks.
    """
    if not t or not s:
        return False
    try:
        expiry = int(t)
    except (ValueError, TypeError):
        return False
    if time.time() > expiry:
        return False
    msg = f"{filename}:{expiry}".encode()
    expected = hmac.new(_media_secret(), msg, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, s)


def generate_random_password(length: int = 10) -> str:
    """Generate a random alphanumeric password of the given length."""
    alphabet = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(length))

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET, algorithm=ALGORITHM)
    return encoded_jwt

def verify_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None