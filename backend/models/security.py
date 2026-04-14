from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, timezone
import uuid

class SecurityLog(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: str  # unauthorized_settings_access, failed_login_attempt
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    message: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Config:
        from_attributes = True

class HoursRequest(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    username: Optional[str] = None
    current_hours: int = 95
    requested_hours: int
    reason: Optional[str] = None
    status: str = "pending"  # pending, approved, denied
    admin_note: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class HoursRequestCreate(BaseModel):
    user_id: str
    username: Optional[str] = None
    current_hours: int = 95
    requested_hours: int
    reason: Optional[str] = None

class HoursRequestUpdate(BaseModel):
    status: str  # approved, denied
    admin_note: Optional[str] = None
