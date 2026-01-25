from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
import uuid
import secrets

class DeviceBase(BaseModel):
    device_name: str
    mac_address: str

class DeviceCreate(DeviceBase):
    device_uuid: Optional[str] = None  # Hardware UUID from box
    user_id: Optional[str] = None  # Associate with user

class Device(DeviceBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    device_uuid: Optional[str] = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: Optional[str] = None  # User who owns this device
    activation_code: str = Field(default_factory=lambda: secrets.token_urlsafe(16))
    qr_code_path: Optional[str] = ""
    status: str = "pending"  # pending, active, deactivated, suspended
    current_ip: Optional[str] = None
    ip_history: Optional[List[dict]] = []
    last_geo_check: Optional[dict] = None
    activated_at: Optional[datetime] = None
    last_access: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        from_attributes = True

class DeviceActivate(BaseModel):
    activation_code: str
    device_uuid: Optional[str] = None
    ip_address: Optional[str] = None

class DeviceQRRefresh(BaseModel):
    device_id: str
    reset_activation: bool = False  # True = new code, False = regenerate QR only