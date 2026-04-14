from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone
import uuid

class AdminBase(BaseModel):
    email: str

class AdminCreate(AdminBase):
    password: Optional[str] = None
    two_fa_enabled: Optional[bool] = False

class Admin(AdminBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    password_hash: str
    two_fa_enabled: bool = False
    two_fa_secret: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Config:
        from_attributes = True

class AdminLogin(BaseModel):
    email: str
    password: str
    two_fa_code: Optional[str] = None

class Token(BaseModel):
    access_token: str
    token_type: str

class PasswordReset(BaseModel):
    email: str

class TwoFASetup(BaseModel):
    enabled: bool
