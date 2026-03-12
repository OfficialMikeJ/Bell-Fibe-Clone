from fastapi import APIRouter, HTTPException, Depends, Request, Header
from models.customer import CustomerAccount, CustomerCreate, CustomerLogin
from models.admin import Admin
from typing import Optional, List
from motor.motor_asyncio import AsyncIOMotorDatabase
from utils.security import (
    verify_password, get_password_hash, create_access_token, verify_token
)
from utils.geo_location import get_client_ip
from utils.qr_generator import generate_qr_code
from datetime import datetime, timedelta
import os

router = APIRouter(prefix="/api/customer", tags=["customer"])

PIN_MAX_ATTEMPTS = 3
PIN_LOCKOUT_MINUTES = 45


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
    admin = await db.admins.find_one({"username": payload.get("sub")})
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


def check_pin_lockout(pin_failed_attempts: List[str]):
    """Return (is_locked, minutes_remaining, recent_count)"""
    now = datetime.utcnow()
    window_start = now - timedelta(minutes=PIN_LOCKOUT_MINUTES)
    recent = [
        ts for ts in pin_failed_attempts
        if datetime.fromisoformat(ts) > window_start
    ]
    if len(recent) >= PIN_MAX_ATTEMPTS:
        oldest_in_window = min(datetime.fromisoformat(ts) for ts in recent)
        unlock_at = oldest_in_window + timedelta(minutes=PIN_LOCKOUT_MINUTES)
        minutes_remaining = int((unlock_at - now).total_seconds() / 60) + 1
        return True, minutes_remaining, len(recent)
    return False, 0, len(recent)


def safe_customer(customer: dict) -> dict:
    """Strip sensitive fields before returning to client"""
    return {
        "id": customer.get("id"),
        "first_name": customer.get("first_name"),
        "last_name": customer.get("last_name"),
        "email": customer.get("email"),
        "device_brand": customer.get("device_brand"),
        "device_type": customer.get("device_type"),
        "activation_pin": customer.get("activation_pin"),
        "qr_code_path": customer.get("qr_code_path"),
        "is_activated": customer.get("is_activated", False),
        "device_id": customer.get("device_id"),
        "status": customer.get("status"),
        "created_at": customer.get("created_at"),
    }


@router.post("/register")
async def register_customer(
    data: CustomerCreate,
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Public: register a new customer account"""
    # Normalize email
    email = data.email.lower().strip()

    # Check if email already registered
    existing = await db.customer_accounts.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="An account with this email already exists")

    # Hash password
    password_hash = get_password_hash(data.password)

    # Create account
    customer = CustomerAccount(
        first_name=data.first_name.strip(),
        last_name=data.last_name.strip(),
        email=email,
        password_hash=password_hash,
        device_brand=data.device_brand,
        device_type=data.device_type,
    )

    # Generate QR code pointing to activation page with PIN pre-filled
    activation_domain = os.environ.get("ACTIVATION_DOMAIN", "http://localhost:3000")
    qr_data = f"{activation_domain}/activate?pin={customer.activation_pin}"

    try:
        from pathlib import Path
        import qrcode as qrcode_lib

        qr_dir = Path("/app/backend/uploads/qr_codes")
        qr_dir.mkdir(parents=True, exist_ok=True)
        filename = f"customer_qr_{customer.id}.png"
        filepath = qr_dir / filename

        qr = qrcode_lib.QRCode(version=1, error_correction=qrcode_lib.constants.ERROR_CORRECT_L, box_size=10, border=4)
        qr.add_data(qr_data)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")
        img.save(filepath)
        customer.qr_code_path = f"/uploads/qr_codes/{filename}"
    except Exception:
        pass  # QR generation is non-blocking

    await db.customer_accounts.insert_one(customer.dict())

    # Issue JWT for auto-login
    token = create_access_token(data={"sub": email, "type": "customer"})

    return {
        "access_token": token,
        "token_type": "bearer",
        "customer": safe_customer(customer.dict()),
        "message": "Account created successfully",
    }


@router.post("/login")
async def login_customer(
    data: CustomerLogin,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Customer login with email/password"""
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
    """Get current customer profile"""
    raw = await db.customer_accounts.find_one({"email": customer.email}, {"_id": 0})
    return safe_customer(raw)


@router.post("/activate-with-pin")
async def activate_with_pin(
    pin: str,
    device_uuid: Optional[str] = None,
    device_name: Optional[str] = None,
    request: Request = None,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """
    Device activation using 6-digit PIN.
    Rate-limited by IP: 3 failed attempts → 45-minute lockout.
    """
    client_ip = get_client_ip(request) if request else "unknown"
    now = datetime.utcnow()
    window_start = now - timedelta(minutes=PIN_LOCKOUT_MINUTES)

    # Check IP-based lockout
    ip_record = await db.pin_attempt_log.find_one({"ip": client_ip})
    if ip_record:
        recent_failures = [
            ts for ts in ip_record.get("failures", [])
            if datetime.fromisoformat(ts) > window_start
        ]
        if len(recent_failures) >= PIN_MAX_ATTEMPTS:
            oldest = min(datetime.fromisoformat(ts) for ts in recent_failures)
            unlock_at = oldest + timedelta(minutes=PIN_LOCKOUT_MINUTES)
            minutes_remaining = max(1, int((unlock_at - now).total_seconds() / 60) + 1)
            raise HTTPException(
                status_code=429,
                detail=f"Too many failed attempts. Please wait {minutes_remaining} minute(s) before trying again."
            )

    # Find customer with this PIN
    customer = await db.customer_accounts.find_one({"activation_pin": pin})
    if not customer:
        # Record failed attempt for this IP
        await db.pin_attempt_log.update_one(
            {"ip": client_ip},
            {"$push": {"failures": now.isoformat()}, "$set": {"last_attempt": now.isoformat()}},
            upsert=True,
        )
        # Determine how many recent attempts remain
        updated = await db.pin_attempt_log.find_one({"ip": client_ip})
        recent = [ts for ts in updated.get("failures", []) if datetime.fromisoformat(ts) > window_start]
        remaining = PIN_MAX_ATTEMPTS - len(recent)
        if remaining <= 0:
            raise HTTPException(
                status_code=429,
                detail=f"Too many failed attempts. Your account is locked for {PIN_LOCKOUT_MINUTES} minutes."
            )
        raise HTTPException(
            status_code=404,
            detail=f"Invalid PIN. {remaining} attempt(s) remaining before lockout."
        )

    if customer.get("is_activated"):
        raise HTTPException(status_code=400, detail="This PIN has already been used to activate a device.")

    # Success: clear IP failures
    await db.pin_attempt_log.delete_one({"ip": client_ip})

    # Create a device entry linked to this customer
    import secrets as secrets_mod
    import uuid as uuid_mod
    from models.device import Device

    device_id = str(uuid_mod.uuid4())
    activation_code = secrets_mod.token_urlsafe(16)

    new_device = Device(
        id=device_id,
        device_name=device_name or f"{customer['first_name']}'s Device",
        mac_address=device_uuid or f"AUTO-{device_id[:12].upper()}",
        device_uuid=device_uuid or device_id,
        user_id=customer["id"],
        activation_code=activation_code,
        status="active",
        activated_at=datetime.utcnow(),
        current_ip=client_ip,
    )

    await db.devices.insert_one(new_device.dict())

    # Mark customer as activated
    await db.customer_accounts.update_one(
        {"id": customer["id"]},
        {
            "$set": {
                "is_activated": True,
                "device_id": device_id,
                "status": "active",
            }
        }
    )

    return {
        "message": "Device activated successfully!",
        "user_id": customer["id"],
        "device_id": device_id,
        "customer_name": f"{customer['first_name']} {customer['last_name']}",
    }


@router.post("/refresh-pin")
async def refresh_pin(
    customer: CustomerAccount = Depends(get_current_customer),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Generate a new 6-digit PIN for the customer"""
    from models.customer import generate_pin
    new_pin = generate_pin()

    # Regenerate QR code with new PIN
    activation_domain = os.environ.get("ACTIVATION_DOMAIN", "http://localhost:3000")
    qr_data = f"{activation_domain}/activate?pin={new_pin}"

    qr_code_path = customer.qr_code_path
    try:
        from pathlib import Path
        import qrcode as qrcode_lib

        qr_dir = Path("/app/backend/uploads/qr_codes")
        filename = f"customer_qr_{customer.id}.png"
        filepath = qr_dir / filename

        qr = qrcode_lib.QRCode(version=1, error_correction=qrcode_lib.constants.ERROR_CORRECT_L, box_size=10, border=4)
        qr.add_data(qr_data)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")
        img.save(filepath)
        qr_code_path = f"/uploads/qr_codes/{filename}"
    except Exception:
        pass

    await db.customer_accounts.update_one(
        {"email": customer.email},
        {
            "$set": {
                "activation_pin": new_pin,
                "pin_failed_attempts": [],
                "is_activated": False,
                "qr_code_path": qr_code_path,
            }
        }
    )

    return {"activation_pin": new_pin, "qr_code_path": qr_code_path, "message": "New PIN generated"}


# ─── Admin endpoints ───────────────────────────────────────────────────────────

@router.get("/admin/all")
async def admin_get_all_customers(
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    """Admin: list all customer accounts"""
    customers = await db.customer_accounts.find({}, {"_id": 0, "password_hash": 0}).sort("created_at", -1).to_list(1000)
    return customers


@router.put("/admin/{customer_id}/status")
async def admin_update_customer_status(
    customer_id: str,
    status: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    """Admin: suspend or reactivate a customer"""
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
    """Admin: delete a customer account"""
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
    """Admin: clear PIN attempt lockout for a specific IP (or all IPs if none specified)"""
    if ip:
        await db.pin_attempt_log.delete_one({"ip": ip})
        return {"message": f"Lockout cleared for IP: {ip}"}
    else:
        result = await db.pin_attempt_log.delete_many({})
        return {"message": f"All IP lockouts cleared ({result.deleted_count} records)"}
