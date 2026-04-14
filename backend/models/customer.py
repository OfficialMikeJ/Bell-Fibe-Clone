from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone
import uuid
import secrets
import random
import string


DEVICE_BRANDS = [
    "Samsung", "LG", "TCL", "Sony", "Hisense",
    "OnePlus", "Motorola", "Xiaomi", "Philips", "Other"
]

DEVICE_TYPES = [
    "Android Smart TV",
    "Android Box",
    "Android Tablet",
    "Android Phone",
    "Other/Not Listed",
]

_SPECIAL = "@#$!%*?"
_VOWELS = "aeiou"
_CONSONANTS = "bcdfghjklmnpqrstvwxyz"


def generate_app_username() -> str:
    """8-letter pronounceable lowercase username — no numbers or special chars."""
    # Alternate consonant-vowel for readability: e.g. "marovebi"
    pattern = [_CONSONANTS, _VOWELS, _CONSONANTS, _VOWELS,
               _CONSONANTS, _VOWELS, _CONSONANTS, _VOWELS]
    return "".join(random.choice(pool) for pool in pattern)


def generate_app_password() -> str:
    """
    Exactly 6 characters guaranteed to contain:
    one uppercase letter, one lowercase letter, one digit, one special char,
    plus two more random chars from the full set.
    """
    pool = string.ascii_letters + string.digits + _SPECIAL
    required = [
        random.choice(string.ascii_uppercase),
        random.choice(string.ascii_lowercase),
        random.choice(string.digits),
        random.choice(_SPECIAL),
    ]
    extra = [secrets.choice(pool) for _ in range(2)]
    combined = required + extra
    random.shuffle(combined)
    return "".join(combined)


class CustomerCreate(BaseModel):
    first_name: str
    last_name: str
    email: str
    password: str
    device_brand: str
    device_type: str


class CustomerLogin(BaseModel):
    email: str
    password: str


class CredentialsActivateRequest(BaseModel):
    app_username: str
    app_password: str
    device_uuid: Optional[str] = None
    device_name: Optional[str] = None


class CustomerAccount(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    first_name: str
    last_name: str
    email: str
    password_hash: str
    device_brand: str
    device_type: str
    # TV guide app credentials — generated automatically, visible to admin only
    app_username: str = Field(default_factory=generate_app_username)
    app_password: str = Field(default_factory=generate_app_password)
    pin_failed_attempts: List[str] = []
    is_activated: bool = False
    device_id: Optional[str] = None
    qr_code_path: Optional[str] = None
    status: str = "pending"  # pending, active, suspended
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_active_at: Optional[datetime] = None

    class Config:
        from_attributes = True
