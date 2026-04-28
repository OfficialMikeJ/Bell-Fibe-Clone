from fastapi import APIRouter, HTTPException, Depends, Request, Header
from pydantic import BaseModel
from models.customer import (
    CustomerAccount, CustomerCreate, CustomerLogin,
    CredentialsActivateRequest, generate_app_username, generate_app_password,
)
from models.admin import Admin
from typing import Optional, List
from motor.motor_asyncio import AsyncIOMotorDatabase
from utils.security import (
    verify_password, get_password_hash, create_access_token, verify_token
)
from utils.geo_location import get_client_ip, get_geo_location
from datetime import datetime, timedelta, timezone
import os

router = APIRouter(prefix="/api/customer", tags=["customer"])

LOGIN_MAX_ATTEMPTS = 3
LOGIN_LOCKOUT_MINUTES = 45


async def get_db():
    from server import db
    return db


async def get_current_admin(
    authorization: Optional[str] = Header(None),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.replace("Bearer ", "")
    payload = verify_token(token)
    if not payload or payload.get("type") == "customer":
        raise HTTPException(status_code=401, detail="Admin token required")
    admin = await db.admins.find_one({"email": payload.get("sub")})
    if not admin:
        raise HTTPException(status_code=401, detail="Admin not found")
    return Admin(**admin)


async def get_current_customer(
    authorization: Optional[str] = Header(None),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.replace("Bearer ", "")
    payload = verify_token(token)
    if not payload or payload.get("type") != "customer":
        raise HTTPException(status_code=401, detail="Customer token required")
    customer = await db.customer_accounts.find_one(
        {"email": payload.get("sub")}, {"_id": 0}
    )
    if not customer:
        raise HTTPException(status_code=401, detail="Customer not found")
    return CustomerAccount(**customer)


def safe_customer(customer: dict) -> dict:
    """Strip sensitive fields before returning to client"""
    return {
        "id": customer.get("id"),
        "first_name": customer.get("first_name"),
        "last_name": customer.get("last_name"),
        "email": customer.get("email"),
        "device_brand": customer.get("device_brand"),
        "device_type": customer.get("device_type"),
        "is_activated": customer.get("is_activated", False),
        "device_id": customer.get("device_id"),
        "status": customer.get("status"),
        "created_at": customer.get("created_at"),
        "last_active_at": customer.get("last_active_at"),
    }


# ─── Public: Customer Registration ────────────────────────────────────────────

@router.post("/register")
async def register_customer(
    data: CustomerCreate,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Public: register a new customer account. Credentials are generated automatically."""
    email = data.email.lower().strip()

    existing = await db.customer_accounts.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="An account with this email already exists")

    # Ensure username is unique
    username = generate_app_username()
    while await db.customer_accounts.find_one({"app_username": username}):
        username = generate_app_username()

    password = generate_app_password()

    customer = CustomerAccount(
        first_name=data.first_name.strip(),
        last_name=data.last_name.strip(),
        email=email,
        password_hash=get_password_hash(data.password),
        device_brand=data.device_brand,
        device_type=data.device_type,
        app_username=username,
        app_password=password,
    )

    doc = customer.dict()
    await db.customer_accounts.insert_one(doc)

    token = create_access_token(data={"sub": email, "type": "customer"})

    return {
        "access_token": token,
        "token_type": "bearer",
        "customer": safe_customer(doc),
        "message": "Account created successfully. Your service provider will activate your device.",
    }


@router.post("/login")
async def login_customer(
    data: CustomerLogin,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Customer portal login with email/password"""
    email = data.email.lower().strip()
    customer = await db.customer_accounts.find_one({"email": email})

    if not customer or not verify_password(data.password, customer["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if customer.get("status") == "suspended":
        raise HTTPException(status_code=403, detail="Your account has been suspended. Please contact support.")

    token = create_access_token(data={"sub": email, "type": "customer"})
    return {
        "access_token": token,
        "token_type": "bearer",
        "customer": safe_customer(customer),
    }


@router.get("/me")
async def get_me(
    customer: CustomerAccount = Depends(get_current_customer),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    raw = await db.customer_accounts.find_one({"email": customer.email}, {"_id": 0})
    return safe_customer(raw)


# ─── TV Guide App: Device Activation ──────────────────────────────────────────

@router.post("/activate-with-credentials")
async def activate_with_credentials(
    data: CredentialsActivateRequest,
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """
    Activate a TV device using the admin-generated app_username + app_password.
    Rate-limited by IP: 3 failed attempts → 45-minute lockout.
    Also handles 45-day re-authentication.
    """
    client_ip = get_client_ip(request) if request else "unknown"
    now = datetime.now(timezone.utc)
    window_start = now - timedelta(minutes=LOGIN_LOCKOUT_MINUTES)

    # IP-based lockout check
    ip_record = await db.pin_attempt_log.find_one({"ip": client_ip})
    if ip_record:
        recent_failures = [
            ts for ts in ip_record.get("failures", [])
            if datetime.fromisoformat(ts).replace(tzinfo=timezone.utc) > window_start
        ]
        if len(recent_failures) >= LOGIN_MAX_ATTEMPTS:
            oldest = min(datetime.fromisoformat(ts).replace(tzinfo=timezone.utc) for ts in recent_failures)
            unlock_at = oldest + timedelta(minutes=LOGIN_LOCKOUT_MINUTES)
            minutes_remaining = max(1, int((unlock_at - now).total_seconds() / 60) + 1)
            raise HTTPException(
                status_code=429,
                detail=f"Too many failed attempts. Please wait {minutes_remaining} minute(s) before trying again."
            )

    # Find customer by app_username (case-insensitive)
    username = data.app_username.lower().strip()
    customer = await db.customer_accounts.find_one({"app_username": username})

    def record_failure():
        return db.pin_attempt_log.update_one(
            {"ip": client_ip},
            {"$push": {"failures": now.isoformat()}, "$set": {"last_attempt": now.isoformat()}},
            upsert=True,
        )

    if not customer or customer.get("app_password") != data.app_password:
        await record_failure()
        updated = await db.pin_attempt_log.find_one({"ip": client_ip})
        recent = [
            ts for ts in updated.get("failures", [])
            if datetime.fromisoformat(ts).replace(tzinfo=timezone.utc) > window_start
        ]
        remaining = LOGIN_MAX_ATTEMPTS - len(recent)
        if remaining <= 0:
            raise HTTPException(
                status_code=429,
                detail=f"Too many failed attempts. Locked for {LOGIN_LOCKOUT_MINUTES} minutes."
            )
        raise HTTPException(
            status_code=401,
            detail=f"Invalid username or password. {remaining} attempt(s) remaining."
        )

    if customer.get("status") == "suspended":
        raise HTTPException(status_code=403, detail="This account has been suspended. Please contact support.")

    # Clear lockout on success
    await db.pin_attempt_log.delete_one({"ip": client_ip})

    import secrets as secrets_mod
    import uuid as uuid_mod
    from models.device import Device

    # Re-authentication (device already activated)
    if customer.get("is_activated") and customer.get("device_id"):
        device_id = customer["device_id"]
        await db.devices.update_one(
            {"id": device_id},
            {"$set": {"status": "active", "current_ip": client_ip}}
        )
        await db.customer_accounts.update_one(
            {"id": customer["id"]},
            {"$set": {"last_active_at": now, "status": "active"}}
        )
        return {
            "message": "Re-authentication successful!",
            "user_id": customer["id"],
            "device_id": device_id,
            "customer_name": f"{customer['first_name']} {customer['last_name']}",
        }

    # First-time activation
    device_id = str(uuid_mod.uuid4())
    new_device = Device(
        id=device_id,
        device_name=data.device_name or f"{customer['first_name']}'s Device",
        mac_address=data.device_uuid or f"AUTO-{device_id[:12].upper()}",
        device_uuid=data.device_uuid or device_id,
        user_id=customer["id"],
        activation_code=secrets_mod.token_urlsafe(16),
        status="active",
        activated_at=now,
        current_ip=client_ip,
    )

    await db.devices.insert_one(new_device.dict())
    await db.customer_accounts.update_one(
        {"id": customer["id"]},
        {"$set": {
            "is_activated": True,
            "device_id": device_id,
            "status": "active",
            "last_active_at": now,
        }}
    )

    return {
        "message": "Device activated successfully!",
        "user_id": customer["id"],
        "device_id": device_id,
        "customer_name": f"{customer['first_name']} {customer['last_name']}",
    }


# ─── Admin endpoints ───────────────────────────────────────────────────────────

@router.get("/admin/all")
async def admin_get_all_customers(
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    """Admin: list all customer accounts with their app credentials"""
    customers = await db.customer_accounts.find(
        {}, {"_id": 0, "password_hash": 0}
    ).sort("created_at", -1).to_list(1000)
    return customers


@router.post("/admin/{customer_id}/reset-credentials")
async def admin_reset_credentials(
    customer_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    """Admin: generate a fresh username + password for a customer"""
    customer = await db.customer_accounts.find_one({"id": customer_id})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    # Ensure new username is unique
    new_username = generate_app_username()
    while await db.customer_accounts.find_one({"app_username": new_username, "id": {"$ne": customer_id}}):
        new_username = generate_app_username()

    new_password = generate_app_password()

    await db.customer_accounts.update_one(
        {"id": customer_id},
        {"$set": {"app_username": new_username, "app_password": new_password}}
    )
    return {
        "message": "Credentials reset successfully",
        "app_username": new_username,
        "app_password": new_password,
    }


class AdminCreateCustomer(BaseModel):
    first_name: str
    last_name: str
    email: str
    device_brand: Optional[str] = "Other"
    device_type: Optional[str] = "Other/Not Listed"

@router.post("/admin/create")
async def admin_create_customer(
    data: AdminCreateCustomer,
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    """Admin: create a customer account with auto-generated credentials"""
    email = data.email.lower().strip()
    existing = await db.customer_accounts.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    new_username = generate_app_username()
    while await db.customer_accounts.find_one({"app_username": new_username}):
        new_username = generate_app_username()

    new_password = generate_app_password()

    customer = CustomerAccount(
        first_name=data.first_name.strip(),
        last_name=data.last_name.strip(),
        email=email,
        password_hash="admin-created",
        device_brand=data.device_brand or "Other",
        device_type=data.device_type or "Other/Not Listed",
        app_username=new_username,
        app_password=new_password,
        status="active",
    )

    await db.customer_accounts.insert_one(customer.dict())

    return {
        "message": "Customer created",
        "id": customer.id,
        "first_name": customer.first_name,
        "last_name": customer.last_name,
        "email": email,
        "app_username": new_username,
        "app_password": new_password,
    }

@router.get("/admin/{customer_id}/location")
async def admin_get_customer_location(
    customer_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    """Admin: get geo-location for a customer based on their last known IP"""
    customer = await db.customer_accounts.find_one({"id": customer_id}, {"_id": 0})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    # Check device for IP
    device = await db.devices.find_one({"user_id": customer_id}, {"_id": 0})
    ip = None
    if device:
        ip = device.get("current_ip")
    if not ip:
        ip = customer.get("current_ip")

    if not ip:
        return {"ip": None, "location": None, "message": "No IP recorded yet"}

    geo = get_geo_location(ip)
    return {
        "ip": ip,
        "location": geo,
    }



@router.put("/admin/{customer_id}/status")
async def admin_update_customer_status(
    customer_id: str,
    status: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    if status not in ("active", "suspended", "pending"):
        raise HTTPException(status_code=400, detail="Invalid status")
    result = await db.customer_accounts.update_one(
        {"id": customer_id}, {"$set": {"status": status}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Customer not found")
    return {"message": f"Customer status updated to {status}"}


@router.delete("/admin/{customer_id}")
async def admin_delete_customer(
    customer_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    result = await db.customer_accounts.delete_one({"id": customer_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Customer not found")
    return {"message": "Customer deleted"}


@router.delete("/admin/lockout/clear")
async def admin_clear_ip_lockout(
    ip: Optional[str] = None,
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    """Admin: clear login lockout for a specific IP or all IPs"""
    if ip:
        await db.pin_attempt_log.delete_one({"ip": ip})
        return {"message": f"Lockout cleared for IP: {ip}"}
    else:
        result = await db.pin_attempt_log.delete_many({})
        return {"message": f"All lockouts cleared ({result.deleted_count} records)"}
