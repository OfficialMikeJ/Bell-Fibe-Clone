from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
import uuid
import secrets

class DeviceBase(BaseModel):
    device_name: str
    mac_address: str

class DeviceCreate(DeviceBase):
    device_uuid: Optional[str] = None  # Hardware UUID from IPTV box

class Device(DeviceBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    device_uuid: Optional[str] = Field(default_factory=lambda: str(uuid.uuid4()))  # Unique device identifier
    activation_code: str = Field(default_factory=lambda: secrets.token_urlsafe(16))
    qr_code_path: Optional[str] = ""
    status: str = "pending"  # pending, active, deactivated, suspended
    current_ip: Optional[str] = None
    ip_history: Optional[List[dict]] = []  # [{ip: str, timestamp: str, country: str}]
    last_geo_check: Optional[dict] = None  # {country: str, region: str, city: str, timestamp: str}
    activated_at: Optional[datetime] = None
    last_access: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        from_attributes = True

class DeviceActivate(BaseModel):
    activation_code: str
    device_uuid: Optional[str] = None  # Optional: IPTV box can send its hardware UUID
    ip_address: Optional[str] = None