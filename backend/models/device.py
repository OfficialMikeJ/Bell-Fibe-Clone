from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
import uuid
import secrets

class DeviceBase(BaseModel):
    device_name: str
    mac_address: str

class DeviceCreate(DeviceBase):
    pass

class Device(DeviceBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    activation_code: str = Field(default_factory=lambda: secrets.token_urlsafe(16))
    qr_code_path: Optional[str] = ""
    status: str = "pending"  # pending, active, deactivated
    activated_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        from_attributes = True

class DeviceActivate(BaseModel):
    activation_code: str