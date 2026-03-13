from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
import uuid
import secrets
import pyotp

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


def generate_pin() -> str:
    """Generate a cryptographically secure 6-digit numeric PIN"""
    return str(secrets.randbelow(1000000)).zfill(6)


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


class TOTPActivateRequest(BaseModel):
    email: str
    totp_code: str
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
    activation_pin: str = Field(default_factory=generate_pin)
    totp_secret: str = Field(default_factory=pyotp.random_base32)
    pin_failed_attempts: List[str] = []  # ISO timestamp strings
    is_activated: bool = False
    device_id: Optional[str] = None
    qr_code_path: Optional[str] = None
    status: str = "pending"  # pending, active, suspended
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_active_at: Optional[datetime] = None

    class Config:
        from_attributes = True
