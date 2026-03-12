from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
import uuid

class UserBase(BaseModel):
    username: str
    email: str
    full_name: Optional[str] = None

class UserCreate(UserBase):
    password: str
    account_status: str = "active"
    max_devices: int = 3
    notes: Optional[str] = None

class User(UserBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    password_hash: str
    is_active: bool = True
    account_status: str = "active"  # active, suspended, cancelled, trial
    max_devices: int = 3
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_login: Optional[datetime] = None

    class Config:
        from_attributes = True

class UserUpdate(BaseModel):
    email: Optional[str] = None
    full_name: Optional[str] = None
    is_active: Optional[bool] = None
    account_status: Optional[str] = None
    max_devices: Optional[int] = None
    notes: Optional[str] = None

class UserLogin(BaseModel):
    username: str
    password: str
