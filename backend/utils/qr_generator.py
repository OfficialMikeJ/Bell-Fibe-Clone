import qrcode
import os
from pathlib import Path

BACKEND_DIR = Path(__file__).parent.parent
QR_DIR = BACKEND_DIR / "uploads" / "qr_codes"

def generate_qr_code(activation_code: str, device_id: str) -> str:
    """
    Generate QR code for device activation
    Returns the file path of the generated QR code
    """
    activation_domain = os.environ.get('ACTIVATION_DOMAIN', 'http://localhost:8001')
    activation_url = f"{activation_domain}/activate?code={activation_code}"
    
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=4,
    )
    qr.add_data(activation_url)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    
    # Ensure directory exists
    QR_DIR.mkdir(parents=True, exist_ok=True)
    
    # Save QR code
    filename = f"qr_{device_id}.png"
    filepath = QR_DIR / filename
    img.save(filepath)
    
    return f"/uploads/qr_codes/{filename}"