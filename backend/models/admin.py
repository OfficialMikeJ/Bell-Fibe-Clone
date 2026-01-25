from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
import uuid

class AdminBase(BaseModel):
    username: str

class AdminCreate(AdminBase):
    password: str
    security_questions: Optional[List[dict]] = []  # [{question: str, answer_hash: str}]
    two_fa_enabled: Optional[bool] = False

class Admin(AdminBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    password_hash: str
    security_questions: Optional[List[dict]] = []
    two_fa_enabled: bool = False
    two_fa_secret: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        from_attributes = True

class AdminLogin(BaseModel):
    username: str
    password: str
    two_fa_code: Optional[str] = None

class Token(BaseModel):
    access_token: str
    token_type: str

class PasswordReset(BaseModel):
    username: str
    security_answers: List[dict]  # [{question: str, answer: str}]
    new_password: str

class TwoFASetup(BaseModel):
    enabled: bool