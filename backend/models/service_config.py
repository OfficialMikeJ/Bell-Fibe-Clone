from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
import uuid

class ServiceConfig(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    service_name: str = "TV Service"
    service_logo: Optional[str] = None
    setup_completed: bool = False
    
    # Domain Configuration
    custom_domain: Optional[str] = None
    guide_domain: Optional[str] = None  # Separate domain for guide (Android app)
    admin_domain: Optional[str] = None  # Separate domain for admin
    
    # SSL Configuration
    ssl_enabled: bool = False
    ssl_cert_path: Optional[str] = None
    ssl_key_path: Optional[str] = None
    https_only: bool = False  # Enforce HTTPS only
    
    # Setup Status
    domain_name: Optional[str] = None
    min_channels_configured: bool = False
    admin_configured: bool = False
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        from_attributes = True

class ServiceConfigUpdate(BaseModel):
    service_name: Optional[str] = None
    service_logo: Optional[str] = None
    custom_domain: Optional[str] = None
    guide_domain: Optional[str] = None
    admin_domain: Optional[str] = None
    ssl_enabled: Optional[bool] = None
    ssl_cert_path: Optional[str] = None
    ssl_key_path: Optional[str] = None
    https_only: Optional[bool] = None
    domain_name: Optional[str] = None
