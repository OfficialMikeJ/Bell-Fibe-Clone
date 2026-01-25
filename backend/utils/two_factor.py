import pyotp
import qrcode
from io import BytesIO
import base64
from typing import Tuple

def generate_2fa_secret() -> str:
    """Generate a new 2FA secret"""
    return pyotp.random_base32()

def generate_2fa_qr_code(username: str, secret: str, service_name: str = "TV Service") -> str:
    """
    Generate QR code for 2FA setup
    Returns base64 encoded image
    """
    # Create provisioning URI
    totp = pyotp.TOTP(secret)
    provisioning_uri = totp.provisioning_uri(
        name=username,
        issuer_name=service_name
    )
    
    # Generate QR code
    qr = qrcode.QRCode(version=1, box_size=10, border=4)
    qr.add_data(provisioning_uri)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    
    # Convert to base64
    buffer = BytesIO()
    img.save(buffer, format='PNG')
    img_str = base64.b64encode(buffer.getvalue()).decode()
    
    return f"data:image/png;base64,{img_str}"

def verify_2fa_code(secret: str, code: str) -> bool:
    """Verify a 2FA code"""
    totp = pyotp.TOTP(secret)
    return totp.verify(code, valid_window=1)

def get_2fa_uri(username: str, secret: str, service_name: str = "TV Service") -> str:
    """Get the provisioning URI for manual entry"""
    totp = pyotp.TOTP(secret)
    return totp.provisioning_uri(name=username, issuer_name=service_name)
